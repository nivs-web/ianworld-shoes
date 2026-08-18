/**
 * 멀티플레이 방 — Realtime Database. (기획서 §5-7, §8-2, M7)
 *
 * Firestore 가 아니라 RTDB 인 이유는 **지연**이다. 상대 진행도가 1초 늦게 오면
 * 옆에서 같이 뛰는 느낌이 안 난다. 대신 RTDB 는 쿼리가 약하므로 방 목록은
 * `open` 플래그 하나로만 거른다.
 *
 * 정산 계산은 `matchRules.js`(순수 함수), 지갑 반영은 `multiSettle.js` 에 있다.
 * 여기는 **방의 생애**만 다룬다 — 만들고, 넣고, 시작하고, 끝내고, 치운다.
 */

import { getRtdb, configured, withTimeout } from './firebase.js';
import { currentUser } from './auth.js';
import * as L from './storageLocal.js';
import { MULTI } from '../config/balance.js';
import { makeRoomCode, isRoomCode, rankPlayers, byPreference, hasSeat, playersInRound, reviveFloor, canRevive, roundOver } from './matchRules.js';

const ROOMS = 'rooms';
const MY_ROOMS = 'userRooms';

/** 방을 새로 팔 때 몇 번까지 코드 충돌을 다시 시도할지 */
const CODE_RETRIES = 8;
/** 자동 매칭이 훑어볼 공개방 수 */
const SCAN_LIMIT = 12;
/**
 * 방을 만든 뒤 '동시에 만든 사람'이 있는지 다시 볼 때까지 기다리는 시간.
 * 너무 짧으면 상대 방이 아직 안 보이고, 너무 길면 매칭이 굼떠 보인다.
 */
const RETRY_SCAN_MS = 1400;
/** 첫 스캔이 비었을 때 한 번 더 볼 때까지 기다리는 시간 */
const EMPTY_RESCAN_MS = 900;

const path = (...parts) => parts.join('/');

/** 대기자인가 — 이번 판을 뛰지 않는 사람은 순위·정산에서 통째로 빠진다 */
const nowaiter = (p) => !!p?.waiting;

async function rt() {
  if (!configured()) return null;
  const u = currentUser();
  if (!u || u.guest) return null;
  const fb = await getRtdb();
  return fb ? { ...fb, uid: u.uid } : null;
}

/**
 * 서버 시계와 내 시계의 차이(ms).
 *
 * 카운트다운을 "3초 뒤"가 아니라 **절대 시각**으로 잡아야 네 명이 같은 순간에 출발한다.
 * 기기 시계는 몇 초씩 어긋나 있는 게 보통이라, 그 차이를 먼저 알아 둔다.
 */
let offsetCache = null;

/**
 * 지금까지 잰 서버 시각 보정값 (없으면 0).
 * 게임 루프처럼 **await 를 걸 수 없는 자리**에서 서버 기준 '지금'을 만들 때 쓴다.
 */
export const serverOffsetSync = () => offsetCache ?? 0;

export async function serverOffset(fb) {
  /**
   * ★ **한 번만 재고 기억한다.** (2026-08-18)
   * `reportDeath` 가 이 값을 쓰기 시작하면서, 죽는 순간 왕복 한 번이 더 끼었다.
   * 그 사이에 `finalizeResult` 가 방을 읽어 버리면 **죽은 사람이 아직 살아 있는 것으로**
   * 순위가 매겨진다(동점 판정이 뒤집힌다). 시계 차이는 판이 도는 몇 분 사이에
   * 의미 있게 변하지 않으므로 세션 하나에 한 번이면 충분하다.
   */
  if (offsetCache !== null) return offsetCache;
  try {
    const snap = await withTimeout(fb.dbMod.get(fb.dbMod.ref(fb.rtdb, '.info/serverTimeOffset')), undefined, '서버 시각');
    offsetCache = snap.val() ?? 0;
  } catch {
    offsetCache = 0;
  }
  return offsetCache;
}

const nowOn = (fb, offset) => Date.now() + offset;

/**
 * 내 참가자 레코드 초기값.
 *
 * `seenAt` 은 **처음부터** 넣는다 — 들어오자마자 튕긴 사람도 기준 시각이 있어야
 * `matchRules.isStale` 이 판정할 수 있다. 값이 없으면 판정을 안 하므로(모르는 것을
 * 근거로 남을 빼지 않는다) 그런 사람이 판을 영영 못 끝내게 만든다.
 */
/**
 * 참가자 카드(§11, 2026-08-19)를 위한 스냅샷. `nickname`·`characterId` 처럼
 * **입장 시점 값**이다 — 판 중에 신발을 더 모아도 방 안의 숫자는 바뀌지 않는다.
 * 실시간으로 쫓아가려면 방을 계속 다시 쓰는 별도 동기화가 필요한데, 대기방에
 * 앉아 있는 짧은 시간 동안은 입장 시점 값으로도 충분하다.
 */
function meRecord(profile, fb) {
  return {
    seenAt: fb ? fb.dbMod.serverTimestamp() : 0,
    nickname: profile.nickname ?? '',
    characterId: profile.selectedCharacter ?? 'ian',
    ready: false,
    stairs: 0,
    shoesFound: 0,
    alive: true,
    joinedAt: Date.now(),
    shoesOwned: profile.shoesOwned ?? 0,
    multiWins: profile.multiWins ?? 0,
    multiLosses: profile.multiLosses ?? 0,
  };
}

// ─────────────────────────────────────────────
// 만들기 · 들어가기
// ─────────────────────────────────────────────

/**
 * 방 만들기. 코드가 겹치면 다시 뽑는다.
 *
 * `open` 은 자동 매칭 쿼리용 플래그다. RTDB 는 "state=waiting 이고 인원<정원"
 * 같은 복합 조건을 못 걸어서, 그 답을 **미리 계산해 한 필드에 적어 둔다.**
 */
export async function createRoom({ isPrivate = false, difficulty } = {}) {
  const fb = await rt();
  if (!fb) return null;
  const p = L.loadProfile();
  const offset = await serverOffset(fb);

  for (let i = 0; i < CODE_RETRIES; i++) {
    const code = makeRoomCode();
    const roomRef = fb.dbMod.ref(fb.rtdb, path(ROOMS, code));
    const res = await withTimeout(fb.dbMod.runTransaction(roomRef, (cur) => {
      if (cur) return; // 이미 있는 코드 — 중단하고 다시 뽑는다
      return {
        code,
        isPrivate: !!isPrivate,
        open: !isPrivate,          // 비밀방은 자동 매칭에 걸리면 안 된다
        hostUid: fb.uid,
        state: 'waiting',
        difficulty: difficulty ?? p.difficulty ?? 'normal',
        seed: Math.floor(Math.random() * 0x7fffffff),
        maxPlayers: MULTI.maxPlayers,
        createdAt: nowOn(fb, offset),
        players: { [fb.uid]: meRecord(p, fb) },
      };
    }), undefined, '방 만들기');

    if (res.committed) {
      await noteMyRoom(fb, code);
      return code;
    }
  }
  return null;
}

/** 내가 들어간 방을 기록해 둔다 — 정산을 안 하고 껐을 때 여기서 찾아 청산한다 */
async function noteMyRoom(fb, code) {
  L.noteMultiJoin();   // 접속 시 청산 대상이 되도록 로컬에도 흔적을 남긴다
  armDisconnect(fb, code);
  try {
    await withTimeout(fb.dbMod.set(fb.dbMod.ref(fb.rtdb, path(MY_ROOMS, fb.uid, code)), Date.now()), undefined, '방 기록');
  } catch { /* 없어도 게임은 된다 */ }
}

/**
 * ★ **탭을 닫으면 방에서 자동으로 빠진다.** (2026-08-16)
 *
 * 저장소 전체에 `onDisconnect` 가 한 건도 없었다. `leaveRoom` 은 사용자가 `뒤로` 를
 * 눌러야만 돌기 때문에, 탭을 그냥 닫거나 네트워크가 끊기면 `open:true` 인 1인 방이
 * **영구히** 남았다. 자동 매칭은 `open == true` 인 방을 앞에서 12개만 훑고 **인원이
 * 많은 순**으로 고르므로, 유령 방이 12개만 쌓여도 **모든 사용자의 자동 매칭이
 * 유령 방에 갇힌다.** 사람이 자연스럽게 이탈하는 것만으로도 쌓인다.
 *
 * RTDB 서버가 연결이 끊긴 걸 감지하면 대신 지워 준다 — 클라이언트가 죽어도 동작한다.
 */
function armDisconnect(fb, code) {
  try {
    const meRef = fb.dbMod.ref(fb.rtdb, path(ROOMS, code, 'players', fb.uid));
    fb.dbMod.onDisconnect(meRef).remove().catch(() => {});
    disconnectRefs.set(code, meRef);
  } catch { /* 지원이 안 되면 그냥 예전처럼 동작한다 */ }
}

/** 대기방에서 등록한 자동 이탈을 취소한다 (@see armDisconnect) */
const disconnectRefs = new Map();

/** 방을 떠났으니 예약도 지운다 — 남겨 두면 다음 방의 예약과 헷갈린다 */
function clearDisconnect(fb, code) {
  const ref = disconnectRefs.get(code);
  if (!ref) return;
  disconnectRefs.delete(code);
  try { fb.dbMod.onDisconnect(ref).cancel().catch(() => {}); } catch { /* 무시 */ }
}

/**
 * ★ **판이 끝나면 자동 이탈을 다시 켠다.** (2026-08-18)
 *
 * `holdRoomSeat` 가 게임 시작 때 예약을 껐는데 **다시 켜는 곳이 없었다.** 그래서
 * 한 판을 끝낸 사람이 탭을 닫으면 그 방에 영원히 남는다. 결과 화면에서 로비로
 * 나가도 `leaveRoom` 을 안 불렀으니(그것도 이번에 고쳤다) 방은 `open:true` 인 채
 * 시체로 쌓였고, 매칭은 `open==true` 인 앞 12개만 훑으므로 **시체 12개면 전원이
 * 새 방만 파게 된다** — 폰 세 대가 전부 방장이 되던 그 증상이다.
 */
export async function rearmRoomSeat(code) {
  const fb = await rt();
  if (!fb) return;
  const mine = (await readOnce(fb, path(ROOMS, code, 'players', fb.uid))).val;
  if (!mine) return;                 // 이미 방에 없다
  if (disconnectRefs.has(code)) return;
  armDisconnect(fb, code);
}

/**
 * 게임이 시작되면 자동 이탈을 **취소한다.** 판이 도는 중에 잠깐 끊겼다고
 * 참가자가 사라지면 순위·정산에서 통째로 빠져 버린다.
 */
export async function holdRoomSeat(code) {
  const ref = disconnectRefs.get(code);
  if (!ref) return;
  disconnectRefs.delete(code);
  const fb = await rt();
  if (!fb) return;
  try { await fb.dbMod.onDisconnect(ref).cancel(); } catch { /* 무시 */ }
}


/**
 * 멀티 메뉴에 들어가는 순간 **미리 붙여 둔다.**
 *
 * RTDB 는 첫 사용 시점에 청크(192KB)를 받고 웹소켓을 새로 연다. 그 사이에
 * `방 입장` 을 누르면 스캔이 빈 목록을 보고 곧장 새 방을 판다 — 실기기 세 대가
 * 전부 방장이 된 증상의 정체다. 메뉴를 여는 순간 붙여 두면 누를 때는 이미 준비돼 있다.
 * 실패해도 아무 일도 일어나지 않는다.
 */
export function prewarm() {
  rt().then((fb) => { if (fb) waitConnected(fb, 10000); }).catch(() => {});
}

/**
 * ★ **RTDB 가 붙었는지 먼저 확인한다.** (2026-08-16)
 *
 * `get()` 은 서버에 못 닿으면 **오류를 던지지 않고 캐시 값을 돌려준다.** 캐시가 비어
 * 있으면 그 값은 `null` 이다. 그러면 `joinRoom` 은 "방이 없다"로 판정하고,
 * 자동 매칭은 후보를 전부 흘려보낸 뒤 새 방을 판다 — **연결이 덜 됐을 뿐인데
 * 화면에는 "방을 찾을 수 없습니다"가 뜨고 다들 방장이 된다.**
 *
 * `.info/connected` 는 SDK 가 로컬에서 관리하는 값이라 즉시 답한다.
 * 붙을 때까지 잠깐 기다렸다 시작하면 이 오판 자체가 사라진다.
 */
export async function waitConnected(fb, ms = 6000) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => { if (done) return; done = true; off?.(); clearTimeout(timer); resolve(v); };
    const timer = setTimeout(() => finish(false), ms);
    let off = null;
    try {
      off = fb.dbMod.onValue(fb.dbMod.ref(fb.rtdb, '.info/connected'), (s) => { if (s.val() === true) finish(true); });
    } catch { finish(false); }
  });
}

/**
 * 값 하나를 **서버에서** 읽는다.
 *
 * `get()` 대신 `onValue(..., {onlyOnce:true})` 를 쓰는 이유: `get()` 은 못 닿으면
 * 조용히 캐시(=null)를 돌려주는데, 이쪽은 **연결이 끊겨 있으면 콜백 자체가 안 온다.**
 * 그래서 "값이 없다"와 "못 읽었다"를 구별할 수 있다 — 이 구별이 없어서 멀티가
 * 통째로 오작동했다.
 * @returns {Promise<{ok:boolean, val:any}>}
 */
export async function readOnce(fb, path_, ms = 8000) {
  const r = fb.dbMod.ref(fb.rtdb, path_);
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => { if (done) return; done = true; clearTimeout(timer); resolve(v); };
    const timer = setTimeout(() => finish({ ok: false, val: null }), ms);
    try {
      fb.dbMod.onValue(r, (s) => finish({ ok: true, val: s.val() }),
        () => finish({ ok: false, val: null }), { onlyOnce: true });
    } catch { finish({ ok: false, val: null }); }
  });
}

/**
 * 방에 들어간다. **트랜잭션이어야 한다** — 정원이 1자리 남았는데 두 명이 동시에
 * 누르면, 그냥 쓰기로는 둘 다 들어가 5인 방이 된다.
 * @returns {'ok'|'full'|'notfound'|'started'|'error'}
 */
export async function joinRoom(code) {
  const fb = await rt();
  if (!fb) return 'error';
  const p = L.loadProfile();

  /**
   * ★ **트랜잭션을 버렸다.** (2026-08-16, 세 번째 시도 만에)
   *
   * 파이어베이스 트랜잭션은 **로컬 캐시 값으로 먼저 한 번 호출**된다. 남의 방은 캐시에
   * 없으니 그 값이 `null` 이고, 핸들러가 `undefined` 를 돌려주면 트랜잭션은 서버 값을
   * 기다리지 않고 **그 자리에서 끝난다.** 그래서 남의 방은 언제나 '없는 방'이었다.
   *
   * 미리 `get()` 으로 읽어 캐시를 채워 봤지만 소용없었다 — `onlyOnce` 읽기는 리스너가
   * 곧바로 떨어지고, **리스너가 없으면 RTDB 는 그 경로의 캐시를 버린다.** 진단 훅으로
   * 확인한 결과가 정확히 그랬다: `readRoom` 은 방을 제대로 읽는데 바로 다음 줄의
   * `joinRoom` 은 여전히 `notfound` 였다.
   *
   * 그래서 방향을 바꿨다. **입장은 내 참가자 노드 하나를 쓰는 일**이다 —
   * 남의 값을 건드리지 않으므로 애초에 트랜잭션이 필요 없다.
   * 정원 초과만 쓰고 나서 확인하고, 넘쳤으면 스스로 물러난다.
   */
  if (!(await waitConnected(fb))) return 'error';
  const read = await readOnce(fb, path(ROOMS, code));
  if (!read.ok) return 'error';                     // 못 읽은 것과 없는 것은 다르다
  const room = read.val;
  if (!room) return 'notfound';
  if (room.players?.[fb.uid]) { await noteMyRoom(fb, code); return 'ok'; }  // 재입장

  const max = room.maxPlayers ?? MULTI.maxPlayers;
  const n = Object.keys(room.players ?? {}).length;
  if (n >= max) return 'full';

  /**
   * ★ **게임 중인 방에는 '대기자'로 들어간다.** (2026-08-16)
   * 보통의 온라인 게임처럼, 자리가 남아 있으면 일단 들어가서 다음 판을 기다린다.
   * `waiting: true` 인 사람은 **이번 판의 순위·정산에서 통째로 빠진다** —
   * 뛰지도 않은 판에서 져서 신발을 뺏기면 안 된다. (matchRules.playersInRound)
   */
  const asWaiter = room.state !== 'waiting';
  const me = { ...meRecord(p, fb), ...(asWaiter ? { waiting: true } : {}) };

  try {
    await withTimeout(
      fb.dbMod.set(fb.dbMod.ref(fb.rtdb, path(ROOMS, code, 'players', fb.uid)), me),
      undefined, '방 입장'
    );
  } catch {
    return 'error';
  }

  // 정원 확인 — 마지막 한 자리에 둘이 동시에 들어왔을 수 있다
  const after = (await readOnce(fb, path(ROOMS, code))).val;
  const seats = Object.entries(after?.players ?? {});
  if (seats.length > max) {
    // 늦게 들어온 순으로 물러난다 — 모두가 같은 규칙을 보므로 정확히 초과분만 빠진다
    const order = seats.sort((a, b) => (a[1].joinedAt ?? 0) - (b[1].joinedAt ?? 0)).map(([u]) => u);
    if (order.indexOf(fb.uid) >= max) {
      await withTimeout(fb.dbMod.remove(fb.dbMod.ref(fb.rtdb, path(ROOMS, code, 'players', fb.uid))), undefined, '자리 반납').catch(() => {});
      return 'full';
    }
  }

  /**
   * 방장이 이미 없는 방이면 내가 이어받는다. 안 그러면 **아무도 방장이 아니라서
   * 시작 버튼이 영영 안 나온다** — 둘이 만나도 게임을 시작할 수가 없다.
   */
  if (after && !after.players?.[after.hostUid]) {
    await withTimeout(fb.dbMod.set(fb.dbMod.ref(fb.rtdb, path(ROOMS, code, 'hostUid')), fb.uid), undefined, '방장 승계').catch(() => {});
  }
  // 정원이 찼으면 목록에서 내린다
  if (seats.length >= max) {
    await withTimeout(fb.dbMod.set(fb.dbMod.ref(fb.rtdb, path(ROOMS, code, 'open')), false), undefined, '정원 마감').catch(() => {});
  }

  await noteMyRoom(fb, code);
  return asWaiter ? 'waiting' : 'ok';
}


/**
 * ★ **다음 판을 위해 방을 되돌린다.** (2026-08-16)
 *
 * 판이 끝나면 방은 `finished` 로 굳고 모두가 로비로 흩어졌다. 그러면 게임 중에 들어온
 * **대기자는 영영 자기 판을 못 한다** — "레디가 풀릴 때까지 기다린다"가 성립하려면
 * 방이 다시 `waiting` 으로 돌아와야 한다.
 *
 * 누가 눌러도 결과가 같아야 하므로 **이미 `waiting` 이면 아무것도 하지 않는다.**
 * 시드는 새로 뽑는다 — 같은 계단을 두 번 뛰면 외운 사람이 이긴다.
 */
export async function resetRoom(code) {
  const fb = await rt();
  if (!fb) return false;
  const read = await readOnce(fb, path(ROOMS, code));
  const room = read.val;
  if (!room) return false;
  if (room.state === 'waiting') return 'ok';

  /**
   * ★ **아직 아무도 못 걷은 신발이 있으면 지우지 않는다.** (2026-08-18)
   *
   * 이 함수는 `result` 를 통째로 지우는데 그 안에 패자가 내놓은 `given` 이 들어 있다.
   * 패자는 자기 지갑에서 **먼저 빼고** 올리므로, 승자가 걷기 전에 지워지면 그 신발은
   * 게임에서 증발한다. 특히 **패자 본인이** '방에 남기'를 누르면 100% 이 경우다 —
   * 정산은 승자만 걷어 가기 때문이다.
   *
   * 승자가 걷었는지는 서버의 `result/settled` 비트마스크가 안다. 걷힐 때까지
   * 잠깐 미루면 되고, 패자가 아예 안 냈으면 `given` 자체가 없으니 바로 통과한다.
   */
  /**
   * 아직 안 걷힌 신발이 있으면 지우면 안 된다(증발한다). 그리고 **아직 안 낸 패자**가
   * 있으면 잠깐 기다린다 — 지우는 순간 그 사람의 빚(최대 201켤레)이 통째로 면제된다.
   * 영원히 기다리지는 않는다: 끝난 지 3분이 지나면 안 온 것으로 본다.
   */
  const 끝난지 = Date.now() - (room.result?.endedAt ?? 0);
  if (hasUnclaimed(room)) return 'pending';
  if (hasUnpaid(room) && 끝난지 < RESET_WAIT_MS) return 'pending';

  /**
   * ★ **다음 판에는 지금 이 방을 보고 있는 사람만 데려간다.** (2026-08-19)
   *
   * 판이 끝나기 전에 나간 사람은 순위·정산 때문에 방에 남아 있어야 한다(`leaveRoom`).
   * 그 사람을 그대로 다음 판에 태우면, **자리에 없는 사람이 자동으로 꼴찌가 되어
   * 신발을 잃는다.** 그래서 생존 신호(`seenAt`)가 살아 있는 사람만 넘긴다 —
   * 결과 화면·대기방은 신호를 계속 보내므로 자리를 지키고 있으면 절대 안 빠진다.
   */
  const 지금 = Date.now() + serverOffsetSync();
  const 자리에있다 = (uid, v) =>
    uid === fb.uid || !v?.seenAt || 지금 - v.seenAt <= MULTI.staleSeconds * 1000;

  const players = {};
  for (const [uid, v] of Object.entries(room.players ?? {})) {
    if (!자리에있다(uid, v)) continue;
    // 대기자도 이제 정식 참가자가 된다. 진행도는 전부 초기화한다.
    // 빠진 키(reachedAt·deadAt·out·revives·waiting)는 **삭제**된다 — 다음 판은 백지에서 시작한다
    players[uid] = {
      nickname: v.nickname ?? '', characterId: v.characterId ?? 'ian',
      /**
       * ★ **'계속하기'를 누른 사람은 레디가 자동으로 켜진다.** (2026-08-19, 사용자 요청)
       * 이 함수를 타는 사람은 전부 "이미 이 방에 있던" 사람이다 — 방금 결과 화면에서
       * `계속하기` 를 눌렀다는 뜻이다. 그 의사를 다시 레디 버튼으로 확인받을 필요가
       * 없다. **새로 들어오는 사람만** `joinRoom`(→ `meRecord`)을 타므로 거기서는
       * 여전히 `ready: false` 로 시작한다 — 신규 유저는 당연히 레디를 눌러야 한다.
       * 원하면 `레디 취소`로 언제든 끌 수 있다.
       */
      ready: true, stairs: 0, shoesFound: 0, alive: true, joinedAt: v.joinedAt ?? Date.now(),
      // ★ 생존 신호도 지금으로 다시 찍는다 — 안 그러면 지난 판의 낡은 값 때문에
      //   **다음 판이 시작하자마자 전원이 '튕긴 사람'으로 판정된다.** (2026-08-19)
      seenAt: fb.dbMod.serverTimestamp(),
      // ★ 참가자 카드 스냅샷은 다음 판에도 그대로 옮긴다 — 진행도가 아니라 프로필값이라
      //   지울 이유가 없다. 값을 그대로 옮기므로 "남의 것은 값이 그대로" 규칙도 통과한다.
      shoesOwned: v.shoesOwned ?? 0, multiWins: v.multiWins ?? 0, multiLosses: v.multiLosses ?? 0,
    };
  }
  const n = Object.keys(players).length;
  if (!n) return false;
  try {
    await withTimeout(fb.dbMod.update(fb.dbMod.ref(fb.rtdb, path(ROOMS, code)), {
      state: 'waiting',
      open: !room.isPrivate && n < (room.maxPlayers ?? MULTI.maxPlayers),
      seed: Math.floor(Math.random() * 0x7fffffff),
      hostUid: players[room.hostUid] ? room.hostUid : Object.keys(players)[0],
      players,
      result: null,
      startAt: null,
    }), undefined, '다음 판 준비');
    return 'ok';
  } catch {
    return false;
  }
}

/**
 * 공개 방 목록 — 화면에 그대로 뿌릴 수 있는 모양으로. (2026-08-16)
 *
 * 게임 중인 방도 **숨기지 않는다.** 자리가 있으면 대기자로 들어가 다음 판을 기다리는 게
 * 보통의 온라인 게임이고, 목록에 아무것도 없으면 사용자는 방을 새로 팔 수밖에 없다 —
 * 그게 "다들 방장만 된다"의 사용자 쪽 원인이기도 했다.
 */
export async function listRooms() {
  const fb = await rt();
  if (!fb) return [];
  await waitConnected(fb);
  const rooms = await scanOpenRooms(fb);
  const max = MULTI.maxPlayers;
  return rooms
    // 끝난 방은 목록에 올리지 않는다 — 들어가도 아무것도 못 한다
    .filter((r) => r && r.code && !r.isPrivate && r.state !== 'finished')
    .map((r) => {
      const players = Object.values(r.players ?? {});
      const host = r.players?.[r.hostUid];
      return {
        code: r.code,
        state: r.state,
        playing: r.state === 'countdown' || r.state === 'playing',
        count: players.length,
        max: r.maxPlayers ?? max,
        hostName: host?.nickname || players[0]?.nickname || '',
        // 방 목록에도 방장의 보유신발을 보여 준다 (§11, 2026-08-19) — 들어가기 전에
        // "얼마나 걸 수 있는 상대인지"가 보이는 게 이 게임에서는 방 고르는 기준이 된다
        hostShoes: host?.shoesOwned ?? players[0]?.shoesOwned ?? 0,
        mine: !!r.players?.[fb.uid],
        full: players.length >= (r.maxPlayers ?? max),
        createdAt: r.createdAt ?? 0,
      };
    })
    .sort((a, b) => Number(a.playing) - Number(b.playing) || b.count - a.count || a.createdAt - b.createdAt);
}


/**
 * 참가자가 0명인 **오래된** 빈 방을 치운다. (2026-08-16)
 *
 * 연결이 끊기면 `onDisconnect` 가 그 사람을 방에서 빼는데, 마지막 한 명이 그렇게
 * 빠지면 아무도 없는 방이 `open:true` 인 채로 남는다. 그 방은 멤버가 없으니
 * **누구도 못 지우던 상태**였다(규칙을 고쳐 이제 누구나 지울 수 있다).
 * 그냥 두면 자동 매칭이 훑는 12칸을 갉아먹어 진짜 방이 안 보인다.
 *
 * **막 만들어진 빈 방은 건드리지 않는다** — 지금 막 들어가려는 사람이 있을 수 있다.
 * 실패해도 아무 일도 없다(남이 먼저 치웠거나, 그 사이 사람이 들어왔거나).
 */
const STALE_EMPTY_MS = 3 * 60 * 1000;
/** 안 낸 패자를 기다려 주는 시간 (그 뒤에는 방을 되돌린다) */
const RESET_WAIT_MS = 3 * 60 * 1000;
function sweepEmptyRooms(fb, rooms) {
  const now = Date.now();
  const dead = rooms
    .filter((r) => r && r.code && !Object.keys(r.players ?? {}).length
      && !mustKeepRoom(r)   // 신발이 걸려 있는 방은 못 지운다 (증발하거나 패널티가 면제된다)
      && now - (r.createdAt ?? now) > STALE_EMPTY_MS)
    .slice(0, 5);
  for (const r of dead) {
    withTimeout(fb.dbMod.remove(fb.dbMod.ref(fb.rtdb, path(ROOMS, r.code))), undefined, '빈 방 정리').catch(() => {});
  }
  return dead.length;
}

export async function scanRooms(fb) {
  fb = fb ?? await rt();
  if (!fb) return [];
  return scanOpenRooms(fb);
}

async function scanOpenRooms(fb) {
  const { ref, query, orderByChild, equalTo, limitToFirst, get } = fb.dbMod;
  const snap = await withTimeout(
    get(query(ref(fb.rtdb, ROOMS), orderByChild('open'), equalTo(true), limitToFirst(SCAN_LIMIT))),
    undefined, '방 찾기'
  );
  const rooms = [];
  snap.forEach((c) => { rooms.push(c.val()); });
  return rooms;
}

/**
 * 자동 매칭 — 비어 있는 공개방에 넣고, 없으면 새로 판다.
 *
 * 훑는 중에 남이 먼저 채울 수 있으므로 **실패하면 다음 방으로 넘어간다.**
 * 한 번 실패하고 포기하면 사람이 몰릴수록 매칭이 안 되는 이상한 게임이 된다.
 *
 * ★ **동시에 누르면 둘 다 방을 만든다** — 그 상황을 따로 푼다. (2026-08-16)
 *
 * 두 사람이 같은 순간에 누르면 **둘 다 빈 목록을 보고 각자 방을 만든다.** 그러면
 * 서로 대기방에 앉아 영원히 안 만난다. 실기기 두 대로 정확히 이 증상이 나왔다.
 * 그래서 방을 만든 뒤 **한 번 더 훑어보고**, 나보다 **먼저 만들어진 방**이 있으면
 * 내 방을 접고 그쪽으로 옮긴다. 판정 기준이 (생성시각, 코드)로 결정적이라
 * 양쪽이 같은 답을 내고 **정확히 한 명만** 움직인다.
 */
export async function quickJoin({ difficulty } = {}) {
  const fb = await rt();
  if (!fb) return null;
  await waitConnected(fb);

  /**
   * ★ **방은 정말 아무 데도 못 들어갈 때만 만든다.** (2026-08-16)
   *
   * 순서: ① 대기중이고 자리 있는 방 → ② 게임 중이지만 자리 있는 방(대기자로 입장)
   *      → ③ 그래도 없으면 새로 만든다.
   * 예전에는 ②가 없어서, 먼저 시작한 방이 있어도 "들어갈 데가 없다"며 새 방을 팠다.
   */
  const pickAndJoin = async (rooms) => {
    for (const r of rooms) {
      const v = await joinRoom(r.code);
      if (v === 'ok' || v === 'waiting') return r.code;
    }
    return null;
  };

  try {
    let raw = await scanOpenRooms(fb);
    sweepEmptyRooms(fb, raw);
    // 막 붙은 직후의 빈 목록은 "없다"가 아니라 "아직 못 받았다"일 수 있다
    if (!raw.length) {
      await new Promise((r) => setTimeout(r, EMPTY_RESCAN_MS));
      raw = await scanOpenRooms(fb);
    }
    const free = raw.filter((r) => hasSeat(r, fb.uid, MULTI.maxPlayers));
    const 대기중 = free.filter((r) => r.state === 'waiting').sort(byPreference);
    const 게임중 = free.filter((r) => r.state !== 'waiting').sort(byPreference);

    const got = (await pickAndJoin(대기중)) ?? (await pickAndJoin(게임중));
    if (got) return got;
  } catch { /* 못 찾으면 새로 판다 */ }

  const mine = await createRoom({ isPrivate: false, difficulty });
  if (!mine) return null;

  // 같은 순간에 만들어진 방이 있으면 한쪽만 옮겨 간다 (동시 입장 해소)
  try {
    await new Promise((r) => setTimeout(r, RETRY_SCAN_MS));
    const mineRoom = await readRoom(mine);
    if (Object.keys(mineRoom?.players ?? {}).length > 1) return mine;

    const older = (await scanOpenRooms(fb))
      .filter((r) => hasSeat(r, fb.uid, MULTI.maxPlayers) && r.code !== mine && r.state === 'waiting')
      .filter((r) => byPreference(r, mineRoom ?? { code: mine, createdAt: Infinity }) < 0)
      .sort(byPreference)[0];
    if (!older) return mine;

    const v = await joinRoom(older.code);
    if (v === 'ok' || v === 'waiting') {
      await leaveRoom(mine).catch(() => {});
      return older.code;
    }
  } catch { /* 옮기기 실패 — 내 방에 그대로 있으면 된다 */ }
  return mine;
}

// ─────────────────────────────────────────────
// 대기방
// ─────────────────────────────────────────────

/**
 * 방 변화를 구독한다. @returns {() => void} 해제 함수
 *
 * ★ **붙기 전에 끊을 수 있다.** (2026-08-16)
 * RTDB 모듈은 동적 import 라 구독이 한 박자 늦게 붙는다. 그 사이에 화면을 나가면
 * 예전 코드는 아직 비어 있는 `off()`(아무것도 안 하는 함수)를 부르고, **그 뒤에**
 * 리스너가 붙어서 영영 안 떨어졌다. 대기방에 들어가자마자 `뒤로` 를 누르면 재현된다.
 * 떠난 화면을 계속 다시 그리려 들고, RTDB 연결도 계속 물고 있는다.
 */
export function subscribeRoom(code, cb) {
  let off = null;
  let cancelled = false;
  rt().then((fb) => {
    if (cancelled) return;
    if (!fb) return cb(null);
    const r = fb.dbMod.ref(fb.rtdb, path(ROOMS, code));
    const unsub = fb.dbMod.onValue(r, (s) => cb(s.val()), () => cb(null));
    if (cancelled) { unsub(); return; }   // 붙는 사이에 이미 나갔다
    off = unsub;
  });
  return () => { cancelled = true; off?.(); off = null; };
}

export async function setReady(code, ready) {
  const fb = await rt();
  if (!fb) return;
  await withTimeout(fb.dbMod.set(fb.dbMod.ref(fb.rtdb, path(ROOMS, code, 'players', fb.uid, 'ready')), !!ready), undefined, '레디')
    .catch(() => {});
}

/** 난이도는 방장만 바꾼다 (기획서 §5-9 — 승자 기록이 이 난이도 랭킹으로 간다) */
export async function setRoomDifficulty(code, difficulty) {
  const fb = await rt();
  if (!fb) return;
  await withTimeout(fb.dbMod.update(fb.dbMod.ref(fb.rtdb, path(ROOMS, code)), { difficulty }), undefined, '난이도').catch(() => {});
}

/**
 * 카운트다운 시작 (방장).
 *
 * `startAt` 을 **서버 시각 기준 절대값**으로 박는다. 각 클라이언트는 자기 시계 오차를
 * 빼고 그 순간에 출발하므로, 네트워크가 느린 사람도 같은 계단에서 시작한다.
 */
export async function startCountdown(code) {
  const fb = await rt();
  if (!fb) return null;
  const offset = await serverOffset(fb);
  const startAt = nowOn(fb, offset) + MULTI.countdownSeconds * 1000;
  /**
   * ★ `open` 을 끄지 않는다. (2026-08-16)
   * 자리가 남아 있으면 게임 중에도 목록에 보여야 대기자가 들어올 수 있다.
   * 정원이 찼을 때만 `joinRoom` 이 알아서 내린다.
   */
  await withTimeout(fb.dbMod.update(fb.dbMod.ref(fb.rtdb, path(ROOMS, code)), {
    state: 'countdown', startAt,
  }), undefined, '카운트다운').catch(() => {});
  return startAt;
}

/** 내 시계로 환산한 시작 시각까지 남은 ms */
export async function msUntilStart(startAt) {
  const fb = await rt();
  const offset = fb ? await serverOffset(fb) : 0;
  return startAt - (Date.now() + offset);
}

// ─────────────────────────────────────────────
// 인게임
// ─────────────────────────────────────────────

/**
 * 진행도 올리기. **매 계단마다 쓰면 안 된다** — 초당 10칸을 오르면 초당 10번
 * 쓰기가 나가고, 4명이면 40번이다. 무료 요금제로는 금방 바닥난다.
 * 마지막 전송 이후 값이 바뀌었을 때만, 그것도 간격을 두고 보낸다.
 */
let lastSent = { at: 0, stairs: -1, shoesFound: -1 };
const PROGRESS_MS = 300;

export async function publishProgress(code, { stairs, shoesFound, alive = true }, force = false) {
  const t = Date.now();
  const changed = stairs !== lastSent.stairs || shoesFound !== lastSent.shoesFound;
  if (!force && !changed && t - lastSent.at < MULTI.heartbeatMs) return;
  if (!force && changed && t - lastSent.at < PROGRESS_MS) return;
  lastSent = { at: t, stairs, shoesFound };

  const fb = await rt();
  if (!fb) return;
  await withTimeout(fb.dbMod.update(fb.dbMod.ref(fb.rtdb, path(ROOMS, code, 'players', fb.uid)), {
    stairs: stairs | 0, shoesFound: shoesFound | 0, alive: !!alive,
    seenAt: fb.dbMod.serverTimestamp(),
  }), undefined, '진행도').catch(() => {});
}

/**
 * ★ **살아 있다는 신호.** (2026-08-19)
 *
 * 진행도만으로는 부족하다 — 일시정지 중이거나 죽어서 부활을 고르는 동안에는
 * 계단이 안 바뀌어서 아무 쓰기도 안 나간다. 그 사이에 남들이 나를 "튕긴 사람"으로
 * 보면 억울하게 판에서 빠진다. 그래서 **게임 화면이 살아 있는 동안**은 이 신호를
 * 따로 보낸다. 반대로 진짜로 튕기면 이 신호가 끊겨 `matchRules.isStale` 이 잡는다.
 */
export async function heartbeat(code) {
  const fb = await rt();
  if (!fb) return;
  await withTimeout(fb.dbMod.update(fb.dbMod.ref(fb.rtdb, path(ROOMS, code, 'players', fb.uid)), {
    seenAt: fb.dbMod.serverTimestamp(),
  }), undefined, '생존 신호').catch(() => {});
}

export function resetProgressThrottle() {
  lastSent = { at: 0, stairs: -1, shoesFound: -1 };
}

/**
 * 내가 죽었다고 알린다. **한 명이 죽으면 전원 종료**(기획서 §5-7)라서
 * 이 한 번의 쓰기가 방 전체를 끝낸다 — 그래서 스로틀을 무시하고 강제로 보낸다.
 */
export async function reportDeath(code, { stairs, shoesFound }) {
  const fb = await rt();
  if (!fb) return;
  /**
   * ★ **죽어도 판은 안 끝난다.** (2026-08-18 역전 배틀)
   *
   * 예전에는 여기서 `state: 'finished'` 까지 썼다 — "한 명이 죽으면 전원 종료"가
   * 대전제였기 때문이다. 이제는 죽은 사람에게 **20초의 부활 창**이 열리고, 그동안
   * 남은 사람들은 계속 오른다. 판을 끝내는 건 `matchRules.roundOver` 를 관측한
   * 클라이언트의 `finalizeResult` 다.
   *
   * `deadAt` 은 **서버 보정 시각**이다. 폰 시계가 제각각이면 어떤 사람은 5초 만에,
   * 어떤 사람은 40초 동안 부활 창이 열린다. (오프셋은 세션당 한 번만 잰다)
   */
  /**
   * ★ **시각은 서버가 찍는다.** (2026-08-19)
   *
   * 예전에는 내가 잰 보정값으로 `Date.now() + offset` 을 썼다. 그 보정이 실패하면
   * 조용히 0이 되고(§9-0-22), 그 상태로 시계가 1분 빠른 폰이 죽으면 `deadAt` 이
   * **미래**라 남들의 종료 판정이 영원히 안 선다. 반대로 느린 폰이면 남들 눈에는
   * 이미 20초가 지난 것으로 보여 **부활을 고르는 중에 판이 끝나 버린다**
   * (사용자가 말한 "튕김"의 정체 중 하나다).
   *
   * `serverTimestamp()` 는 **서버가 자기 시계로** 채운다 — 쓰는 쪽 시계가 무의미해진다.
   * 읽는 쪽은 각자 `.info/serverTimeOffset` 으로 보정하므로 모두가 같은 답을 낸다.
   */
  const at = fb.dbMod.serverTimestamp();
  await withTimeout(fb.dbMod.update(fb.dbMod.ref(fb.rtdb, path(ROOMS, code, 'players', fb.uid)), {
    stairs: stairs | 0, shoesFound: shoesFound | 0, alive: false, reachedAt: at, deadAt: at,
  }), undefined, '사망 보고').catch(() => {});
}

/**
 * 부활을 포기한다 — 남은 사람들이 **20초를 기다리지 않아도 되게** 알린다.
 * 이게 없으면 나가기를 눌러도 다른 사람 화면에서는 창이 닫힐 때까지 판이 안 끝난다.
 */
export async function markOut(code) {
  return declineRevive(code);
}

export async function declineRevive(code) {
  const fb = await rt();
  if (!fb) return;
  await withTimeout(fb.dbMod.update(fb.dbMod.ref(fb.rtdb, path(ROOMS, code, 'players', fb.uid)), {
    out: true,
  }), undefined, '부활 포기').catch(() => {});
}

/**
 * ★ **신발을 걸고 1위보다 앞에서 되살아난다.** (역전 배틀의 심장)
 *
 * 순서가 전부다:
 *   ① 방을 읽어 1위 층수를 확인한다 (내 화면 값은 300ms 낡았을 수 있다)
 *   ② 판돈을 **먼저 항아리에 올린다** — 올리기 전에 살아나면 공짜 부활이 된다
 *   ③ 그 다음에 살아난다
 *
 * ②가 실패하면 아무 일도 없었던 것으로 만든다(지갑은 호출부가 되돌린다).
 * 반대 순서였다면 "살아났는데 돈은 안 냈다"가 되어 판돈이 실물과 어긋난다.
 *
 * @param {string} code
 * @param {number[]} indices 이번에 거는 신발 (호출부가 지갑에서 이미 뺐다)
 * @returns {Promise<number|null>} 되살아날 층수 (실패하면 null)
 */
export async function reviveMe(code, indices) {
  const fb = await rt();
  if (!fb) return null;
  const read = await readOnce(fb, path(ROOMS, code));
  const room = read.val;
  if (!room) return null;
  const me = room.players?.[fb.uid];
  if (!me || !canRevive(me)) return null;
  /**
   * ★ **끝난 판에는 못 건다.** (2026-08-18 재수정)
   * 시계가 어긋나거나 내 창이 아슬아슬할 때, 남이 이미 순위를 박은 뒤에 20켤레를
   * 올릴 수 있었다. 그 신발은 **아무도 안 걷는다**(승자의 수령 루프는 순위가 확정될 때
   * 이미 도장을 찍었다) — 그대로 증발한다.
   */
  if (room.result?.rankings || room.state === 'finished') return null;

  const floor = reviveFloor(room);
  const prev = Array.isArray(room.result?.given?.[fb.uid]) ? room.result.given[fb.uid] : [];
  const merged = [...prev, ...indices];

  /**
   * ★ **판돈과 부활을 한 번의 쓰기로 묶는다.** (2026-08-18 재수정)
   *
   * 처음에는 ① 판돈 올리고 ② 되살아나는 두 단계였다. ②가 실패하면 호출부가 지갑을
   * 되돌리는데 **판돈은 이미 항아리에 들어가 있다** — 신발 20켤레가 무에서 창조된다.
   * (`withTimeout` 은 거절만 할 뿐 RTDB 쓰기를 취소하지 못하므로 ①의 실패도 같은 함정이다)
   *
   * 멀티패스 업데이트는 **전부 되거나 전부 안 된다.** 그래서 그 창이 아예 사라진다.
   */
  const patch = {
    [path('result', 'given', fb.uid)]: merged,
    [path('players', fb.uid, 'alive')]: true,
    [path('players', fb.uid, 'stairs')]: floor,
    [path('players', fb.uid, 'revives')]: (me.revives ?? 0) + 1,
    [path('players', fb.uid, 'reachedAt')]: fb.dbMod.serverTimestamp(),
    [path('players', fb.uid, 'deadAt')]: 0,
    [path('players', fb.uid, 'out')]: null,
  };
  try {
    await withTimeout(fb.dbMod.update(fb.dbMod.ref(fb.rtdb, path(ROOMS, code)), patch), undefined, '부활');
    return floor;
  } catch {
    /**
     * 시한이 지났다고 **안 들어간 건 아니다.** RTDB 는 큐에 들고 있다가 연결이 돌아오면
     * 마저 보낸다. 그대로 환불하면 그때 복제가 된다 — 그래서 서버를 다시 읽어 확인한다.
     */
    const after = (await readOnce(fb, path(ROOMS, code, 'players', fb.uid))).val;
    if (after?.alive === true && (after.revives ?? 0) > (me.revives ?? 0)) return floor;
    return null;
  }
}

/**
 * 순위를 확정해 방에 적는다.
 *
 * **누가 먼저 도착하든 결과가 같아야 한다.** 그래서 계산은 `rankPlayers`(결정적)로
 * 하고, 쓰기는 트랜잭션으로 **이미 적혀 있으면 건드리지 않는다.** 네 명이 동시에
 * 적으러 와도 처음 것 하나만 남는다.
 */
export async function finalizeResult(code) {
  const fb = await rt();
  if (!fb) return null;

  /**
   * ★ **여기도 트랜잭션을 버렸다.** (2026-08-16)
   *
   * `joinRoom` 과 똑같은 함정이다 — 트랜잭션 첫 호출은 로컬 캐시 값이고, 이 함수는
   * `endMulti()` 가 방 구독을 끊은 **뒤에** 불리므로 그 캐시가 이미 비어 있다.
   * 그러면 `if (!cur) return` 으로 중단되고 **순위가 영영 안 박힌다** —
   * 순위가 없으면 아무도 정산을 못 하니 신발이 오가지 않는다.
   * 증상이 화면에 안 보이는 자리라 더 위험했다.
   *
   * 순위 계산은 `rankPlayers` 로 **결정적**이라 누가 계산해도 같은 답이 나온다.
   * 그래서 "이미 적혀 있으면 건드리지 않는다"만 지키면 트랜잭션이 필요 없다.
   */
  const read = await readOnce(fb, path(ROOMS, code));
  const room = read.val;
  if (!room) return null;
  if (room.result?.rankings) return room;          // 이미 확정됨 — 먼저 쓴 사람 것을 남긴다
  /**
   * ★ **대기 중인 방은 끝낼 수 없다.** (2026-08-19)
   * 대기방에서는 아무도 진행도를 안 보내므로 생존 신호가 금방 낡는다. 그걸 판 종료로
   * 읽으면 **아직 시작도 안 한 판의 순위가 박히고 신발이 오간다.**
   */
  if (room.state === 'waiting') return null;

  const players = playersInRound(room.players);    // 대기자는 이번 판 사람이 아니다
  /**
   * ★ **혼자 남아도 순위는 박는다.** (2026-08-19)
   *
   * 예전에는 `minPlayers`(2) 미만이면 그냥 돌아갔다. 그런데 상대가 튕겨서 방에서
   * 빠지면 남은 사람은 **영원히 결과가 안 나온다** — "다른 사람들이 아직 오르고 있습니다"
   * 화면에 갇히고, 그 판에 걸린 신발도 아무도 못 걷는다.
   * 한 명이라도 있으면 그 사람 기준으로 끝낸다.
   */
  if (!players.length) return room;

  /**
   * ★ **판이 끝났을 때만 순위를 박는다.** (2026-08-18 역전 배틀)
   *
   * 예전에는 부르는 즉시 확정했다 — "한 명이 죽으면 전원 종료"였으니 그래도 됐다.
   * 이제는 내가 먼저 포기하고 나가도 **남은 사람들은 계속 오르고 있다.** 그때 순위를
   * 박아 버리면 남의 판을 내가 끝내는 셈이고, 1등도 그 시점 기록으로 굳어 버린다.
   * 판정은 `roundOver` 한 곳뿐이라 누가 계산해도 같은 답이 나온다.
   */
  if (!roundOver(room, Date.now() + serverOffsetSync())) return room;

  // 순위도 종료 판정과 **같은 '지금'** 을 봐야 한다 — 신호가 끊긴 사람을 위로 올리면 안 된다
  const ranked = rankPlayers(players, Date.now() + serverOffsetSync());
  try {
    await withTimeout(fb.dbMod.update(fb.dbMod.ref(fb.rtdb, path(ROOMS, code)), {
      state: 'finished',
      /**
       * ★ **끝난 방은 그 자리에서 매칭 창에서 내린다.** (2026-08-18)
       * 매칭은 `open == true` 인 방을 **앞 12개**만 훑는다(`SCAN_LIMIT`). 끝난 방이
       * `open:true` 로 남아 있으면 코드가 작은 순으로 그 12칸을 영구히 차지하고,
       * 그 뒤로는 모두가 "들어갈 방이 없다"며 새 방만 판다. `resetRoom` 이 다음 판을
       * 열 때 다시 `true` 로 올린다.
       */
      open: false,
      'result/rankings': ranked,
      'result/endedAt': Date.now(),
      /**
       * ★ **이긴 사람이 다음 판의 방장이 된다.** (2026-08-19)
       * 방장은 시작 버튼과 난이도를 쥔다. 그걸 이긴 사람에게 넘기면 "한 판 더"의
       * 주도권이 승자에게 가고, 방장이 먼저 나가 버린 방도 자동으로 주인을 찾는다.
       * 값이 **순위 1등**이라 누가 계산해도 같으므로 규칙도 이 한 가지만 허용한다.
       */
      hostUid: ranked[0] ?? room.hostUid,
    }), undefined, '결과 확정');
  } catch {
    return room;
  }
  return (await readOnce(fb, path(ROOMS, code))).val ?? room;
}

// ─────────────────────────────────────────────
// 정리
// ─────────────────────────────────────────────

/** 대기방에서 나간다. 방장이 마지막이면 방을 지운다. */
/**
 * 아직 아무도 안 걷은 신발이 방에 남아 있나.
 *
 * 패자는 자기 지갑에서 **먼저 빼고** `result/given` 에 올린다. 승자가 `result/settled`
 * 비트마스크를 찍기 전에 그 방(또는 `result`)이 사라지면 그 신발은 게임에서 증발한다.
 * 방을 지우거나 되돌리기 전에 반드시 이걸 본다.
 */
/**
 * 아직 신발을 안 낸 패자가 있나 (= 나중에 낼 수 있는 방).
 *
 * 패자가 죽자마자 앱을 껐으면 `given` 이 아예 없다. 그 방을 지워 버리면
 * **패널티를 영구히 면제**받는다 — 접속 청산(`sweepUnsettled`)이 다시 훑을 방이
 * 없어지기 때문이다. 그래서 낼 사람이 남아 있는 동안은 방을 남겨 둔다.
 */
export function hasUnpaid(room) {
  const rank = room?.result?.rankings ?? [];
  if (rank.length < 2) return false;
  const given = room.result?.given ?? {};
  return rank.slice(1).some((uid) => !Array.isArray(given[uid]));
}

/** 정산이 남아 기다려 주는 기간. 이 뒤로는 안 온 것으로 보고 방을 치운다. */
const SETTLE_GRACE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * 이 방을 지우면 안 되나 — **누군가의 신발이 걸려 있으면 지우지 않는다.**
 * 다만 영원히 기다리지는 않는다(일주일).
 */
/**
 * 지금 이 순간(서버 시각 기준) 판이 끝났나 — 화면·정산이 같은 답을 보게 하는 통로.
 *
 * **대기 중인 방은 절대 '끝난 판'이 아니다.** 대기방에 앉아 있는 사람은 진행도를
 * 안 보내므로 `seenAt` 이 금방 낡는다. 그 상태를 판 종료로 읽으면 **로비에 앉아
 * 있다가 갑자기 순위가 박히고 신발을 잃는다.**
 */
export function roundOverNow(room) {
  if (!room || room.state === 'waiting') return false;
  return roundOver(room, Date.now() + serverOffsetSync());
}

export function mustKeepRoom(room) {
  /**
   * ★ **순위가 없어도 항아리에 신발이 있으면 못 지운다.** (2026-08-19)
   *
   * 이게 없어서 **신발 100켤레가 통째로 사라졌다.** 재현 경로가 정확히 이랬다:
   * 신발 100켤레를 가진 사람이 20켤레씩 다섯 번 부활한다(항아리 100켤레, 지갑 0).
   * 그런데 상대가 렉으로 튕겨 판이 **끝나지 않는다** → `rankings` 가 안 생긴다 →
   * 예전 판정은 순위가 없으면 `false` 를 돌려주므로 마지막 사람이 나갈 때
   * `leaveRoom` 이 방을 지운다. 항아리째로 증발이다.
   *
   * 순위가 없다는 건 "아직 아무도 못 받았다"는 뜻이므로 **오히려 더 지켜야 한다.**
   * 판이 끝내 안 끝나면 `settleRoom` 이 다음 접속 때 **주인에게 되돌려준다.**
   */
  const given = room?.result?.given ?? {};
  const 항아리에있다 = Object.values(given).some((v) => Array.isArray(v) && v.length);
  if (!room?.result?.rankings) return 항아리에있다;
  const endedAt = room.result?.endedAt ?? 0;
  if (endedAt && Date.now() - endedAt > SETTLE_GRACE_MS) return false;
  return hasUnclaimed(room) || hasUnpaid(room);
}

export function hasUnclaimed(room) {
  const rank = room?.result?.rankings ?? [];
  if (!rank.length) return false;
  const given = room.result?.given ?? {};
  const 걷은양 = claimedCounts(room, rank[0]);
  return Object.entries(given).some(
    ([uid, v]) => Array.isArray(v) && v.length > (걷은양[uid] ?? 0)
  );
}

/**
 * ★ **도장은 "걷었다/안 걷었다"가 아니라 "몇 켤레 걷었나"다.** (2026-08-19)
 *
 * 예전에는 사람마다 비트 하나였다. 그런데 한 사람이 **두 번에 나눠 낸다** —
 * 부활할 때 20켤레를 먼저 걸고, 판이 끝난 뒤 기본 1켤레를 마저 낸다. 승자가
 * 20켤레를 걷으면서 비트를 찍어 버리면 **나중에 올라온 1켤레는 영영 안 걷힌다.**
 * 시뮬레이터가 정확히 그 1켤레를 잃는 것을 재현했다(`_multi-sim.mjs` S10).
 *
 * 그래서 `result/claims/{승자}/{낸사람}` 에 **걷은 켤레 수**를 적는다.
 * "지금 목록 길이 − 걷은 수" 만큼만 더 걷으므로 몇 번에 나눠 내든 정확히 한 번씩 간다.
 *
 * ## 옛 비트마스크(`result/settled`)를 왜 계속 쓰나
 *
 * 배포 직후에는 **옛 클라이언트가 아직 돌아다닌다**(PWA 캐시). 옛 코드는
 * `settled` 를 숫자로 읽으므로, 거기에 맵을 넣으면 `Number({...})` 가 `NaN` 이 되어
 * **이미 걷은 신발을 처음부터 다시 걷는다 — 신발이 복제된다.** 그래서 새 클라이언트는
 * 둘 다 쓴다: 옛 클라이언트는 비트를 보고 멈추고, 새 클라이언트는 켤레 수를 보고
 * 남은 만큼만 걷는다. 잃는 것보다 **불어나는 것이 훨씬 나쁘다.**
 */
export function claimedCounts(room, winnerUid) {
  const given = room?.result?.given ?? {};
  const rank = room?.result?.rankings ?? [];
  const counts = room?.result?.claims?.[winnerUid];
  const out = {};
  if (counts && typeof counts === 'object') {
    for (const [uid, n] of Object.entries(counts)) out[uid] = Number(n) || 0;
    return out;
  }
  const mask = Number(room?.result?.settled?.[winnerUid] ?? 0) | 0;
  if (!mask) return out;
  for (const [uid, v] of Object.entries(given)) {
    const i = rank.indexOf(uid);
    const bit = i >= 0 ? (1 << i) : ORPHAN_BIT;
    if (mask & bit) out[uid] = Array.isArray(v) ? v.length : 0;   // 옛 도장 = 그때까지 전부 걷음
  }
  return out;
}

/** 옛 클라이언트가 읽을 비트마스크 — 걷은 사람의 자리에 비트를 세운다 */
export function claimMask(room, counts) {
  const rank = room?.result?.rankings ?? [];
  let mask = 0;
  for (const uid of Object.keys(counts ?? {})) {
    const i = rank.indexOf(uid);
    mask |= i >= 0 ? (1 << i) : ORPHAN_BIT;
  }
  return mask;
}

/** (옛 방 해석용) 순위에 없는 사람의 판돈을 걷었다는 비트 */
export const ORPHAN_BIT = 1 << 15;

/**
 * 볼일이 다 끝난 방을 치운다 — **참가자가 아무도 없고 걷을 신발도 없을 때만.**
 * 정산까지 끝난 뒤 마지막으로 부른다. 규칙이 '참가자 0명인 방'의 삭제를 허용한다.
 */
export async function tidyRoom(code) {
  const fb = await rt();
  if (!fb) return;
  const room = (await readOnce(fb, path(ROOMS, code))).val;
  if (!room) return;
  if (Object.keys(room.players ?? {}).length) return;
  if (mustKeepRoom(room)) return;
  try {
    await withTimeout(fb.dbMod.remove(fb.dbMod.ref(fb.rtdb, path(ROOMS, code))), undefined, '방 정리');
  } catch { /* 다음에 다시 */ }
}

export async function leaveRoom(code) {
  const fb = await rt();
  if (!fb) return;

  /**
   * ★ **나가기와 뒷정리를 한 번의 쓰기로 묶는다.** (2026-08-18)
   *
   * 예전에는 ① 내 노드를 지우고 ② 그 다음에 방장 승계·`open` 갱신을 썼다.
   * ②는 **항상 401 로 거부됐다** — 그 시점엔 내가 `players` 에 없어서 방 규칙의
   * 네 조건이 하나도 안 맞는다. 실측:
   *
   *   players/나 DELETE → 200,  이어서 rooms/코드 PATCH{hostUid} → 401
   *
   * 결과가 고약했다. **떠난 사람이 계속 방장**이라 남은 사람들에겐 시작 버튼이
   * 영영 안 뜨고(`WaitingRoom` 은 `hostUid == 내uid` 로만 판단한다), 4/4 라서
   * `open:false` 가 된 방은 한 명이 빠져도 `true` 로 못 돌아가 **목록에서 사라진다.**
   * 즉 방 하나가 통째로 죽는다.
   *
   * 하나의 update 로 보내면 `.write` 는 **예전 데이터**로 평가되어 내가 아직
   * 참가자이므로 통과하고, `hostUid` 검증은 **새 데이터**를 보므로 "옛 방장이
   * 이제 참가자에 없다"가 성립해 승계가 허용된다. 실측으로 200 을 확인했다.
   */
  let room = (await readOnce(fb, path(ROOMS, code))).val;
  if (!room) return;
  if (!room.players?.[fb.uid]) return;   // 이미 빠져 있다

  /**
   * ★ **판이 안 끝났으면 자리를 비우지 않는다.** (2026-08-19)
   *
   * 순위(`rankings`)는 **방에 남아 있는 사람만** 담을 수 있다(규칙이 그렇게 막는다).
   * 그래서 판이 끝나기 전에 방을 나가면 **나는 순위에서 통째로 사라진다** —
   * 진 사람은 신발을 안 내고, 이긴 사람은 걷을 게 없어진다. 둘 다 나가면
   * 방까지 지워져 그 판이 통째로 증발한다. 사용자가 신고한
   * "둘 다 나가기를 눌렀는데 신발이 안 넘어간다"가 정확히 이 경로다.
   *
   * 그래서 순서를 뒤집었다 — **나가기 전에 판을 끝낸다.** 끝낼 조건이 안 되면
   * (아직 뛰는 사람이 있으면) 자리를 지키고 물러난다. 판이 끝나면 그때 나가면 된다.
   */
  const 나 = room.players[fb.uid];
  const 이번판참가자 = !nowaiter(나);
  const 판진행중 = room.state !== 'waiting' && !room.result?.rankings;
  if (이번판참가자 && 판진행중) {
    if (roundOver(room, Date.now() + serverOffsetSync())) {
      const after = await finalizeResult(code).catch(() => null);
      if (after) room = after;
    }
    if (!room.result?.rankings) return 'kept';
  }

  const rest = Object.entries(room.players)
    .filter(([uid]) => uid !== fb.uid)
    .sort((a, b) => (a[1]?.joinedAt ?? 0) - (b[1]?.joinedAt ?? 0) || a[0].localeCompare(b[0]));

  clearDisconnect(fb, code);

  // 아무도 안 남으면 방째로 치운다 (규칙이 '참가자 0명인 방'의 삭제를 허용한다)
  //   ★ 단 **아직 아무도 못 걷은 신발이 있으면 남긴다.** (2026-08-18)
  //   패자가 낸 신발은 방 안(`result/given`)에 있다. 방을 지우면 그 신발은
  //   패자 지갑에서만 빠진 채 증발한다. 승자는 방에 없어도 걷을 수 있으므로
  //   (규칙에 `result/settled/$uid` 쓰기를 열어 뒀다) 빈 껍데기로 남겨 둔다.
  if (!rest.length && !mustKeepRoom(room)) {
    try {
      await withTimeout(fb.dbMod.remove(fb.dbMod.ref(fb.rtdb, path(ROOMS, code, 'players', fb.uid))), undefined, '방 나가기');
      await withTimeout(fb.dbMod.remove(fb.dbMod.ref(fb.rtdb, path(ROOMS, code))), undefined, '빈 방 정리');
    } catch { /* 남아도 sweepEmptyRooms 가 치운다 */ }
    return;
  }

  const patch = { [path('players', fb.uid)]: null };
  // 내가 방장이었으면 **가장 오래 있던 사람**에게 넘긴다 (누가 계산해도 같은 답)
  // 아무도 안 남는 경우(= 신발이 남아 방을 못 지우는 경우)에는 승계할 사람이 없다
  if (room.hostUid === fb.uid && rest.length) patch.hostUid = rest[0][0];
  const 자리있음 = rest.length < (room.maxPlayers ?? MULTI.maxPlayers);
  if (!room.isPrivate && room.state !== 'finished' && room.open !== 자리있음) patch.open = 자리있음;

  await withTimeout(
    fb.dbMod.update(fb.dbMod.ref(fb.rtdb, path(ROOMS, code)), patch),
    undefined, '방 나가기'
  ).catch(() => {});
}

/**
 * 내가 들어갔던 방 목록 (미정산 청산용) — **최근 것부터, 최대 `limit` 개.**
 *
 * 예전에는 전부 돌려줬고 `sweepUnsettled` 가 그걸 통째로 순회했다. 방은 어디서도
 * 지워지지 않으므로 오래 즐긴 사람일수록 **접속할 때마다 지금까지의 모든 방**을
 * 읽었다 — 무료 요금제 읽기 할당량에 그대로 꽂힌다. 정산이 밀리는 건 길어야 며칠이라
 * 최근 것만 봐도 충분하다.
 */
/**
 * ★ **다 끝난 방 기록을 지운다.** (2026-08-18)
 * 이 목록은 접속할 때마다 훑는 청산 대상이다. 정산까지 끝난 방이 계속 남아 있으면
 * 매 접속마다 쓸모없는 RTDB 왕복이 늘어나고, 20개가 차면 정작 미정산 방이 밀려난다.
 */
export async function forgetRoom(code) {
  const fb = await rt();
  if (!fb) return;
  try {
    await withTimeout(fb.dbMod.remove(fb.dbMod.ref(fb.rtdb, path(MY_ROOMS, fb.uid, code))), undefined, '방 기록 정리');
  } catch { /* 남아도 다음에 다시 시도한다 */ }
}

export async function myRoomCodes(limit = 20) {
  const fb = await rt();
  if (!fb) return [];
  try {
    const snap = await withTimeout(fb.dbMod.get(fb.dbMod.ref(fb.rtdb, path(MY_ROOMS, fb.uid))), undefined, '내 방 목록');
    return Object.entries(snap.val() ?? {})
      .filter(([code]) => isRoomCode(code))
      .sort((a, b) => (Number(b[1]) || 0) - (Number(a[1]) || 0))
      .slice(0, limit)
      .map(([code]) => code);
  } catch {
    return [];
  }
}

/**
 * ★ **끝나지 않은 판의 내 판돈을 되돌려받는다.** (2026-08-19)
 *
 * 부활 비용은 판이 끝나야 승자에게 간다. 그런데 상대가 튕기거나 앱을 껐으면
 * 순위가 영영 안 박힌다 — 그 신발은 **아무에게도 안 가고 방에만 남는다.**
 * 그 방이 지워지면 증발이고, 안 지워져도 영원히 묶인다.
 *
 * 그래서 **순위가 없는 방**에서는 내 것을 도로 가져온다. 순서가 중요하다:
 * **서버에서 먼저 지우고** 그 다음에 지갑에 넣는다. 반대로 하면 지우기가 실패했을 때
 * 다음 접속에 또 받아 복제된다.
 *
 * @returns {Promise<number[]|null>} 되돌려받은 신발 (없으면 null)
 */
export async function reclaimStake(code) {
  const fb = await rt();
  if (!fb) return null;
  const read = await readOnce(fb, path(ROOMS, code));
  const room = read.val;
  if (!room) return null;
  if (room.result?.rankings) return null;          // 순위가 있으면 승자 몫이다
  const mine = room.result?.given?.[fb.uid];
  if (!Array.isArray(mine) || !mine.length) return null;

  try {
    await withTimeout(
      fb.dbMod.remove(fb.dbMod.ref(fb.rtdb, path(ROOMS, code, 'result', 'given', fb.uid))),
      undefined, '판돈 회수'
    );
  } catch {
    return null;   // 못 지웠으면 아직 내 것이 아니다 — 다음 접속에 다시 시도한다
  }
  return mine;
}

/**
 * 정산 도장을 **서버에** 남긴다 — `result/settled/{uid}` (승자가 걷어간 패자 비트마스크).
 *
 * 예전에는 도장이 localStorage 에만 있었다. 그런데 재정산의 입력인 `userRooms` 와
 * `result.given` 은 RTDB 에 영구히 남는다. 그래서 **기기를 바꾸거나 저장소를 지우면**
 * 승자가 같은 신발을 다시 걷어 지갑이 불어났고, 도장이 200건에서 잘려 나가는
 * 150판 즈음부터는 **가만히 있어도** 같은 일이 벌어졌다.
 *
 * 비트마스크인 이유: 패자가 여러 명일 때 **아무 순서로나** 걷어도 idempotent 해야 한다.
 * 숫자 하나면 규칙(`settled/$uid` 는 숫자, 본인만 쓰기)도 그대로 쓸 수 있다.
 * @returns {Promise<boolean>} 실제로 서버에 남았는지 — 실패하면 걷으면 안 된다
 */
export async function markSettledRemote(code, counts, mask) {
  const fb = await rt();
  if (!fb) return false;
  try {
    // 옛 비트와 새 켤레 수를 **한 번의 쓰기로** — 하나만 남으면 해석이 갈린다
    await withTimeout(
      fb.dbMod.update(fb.dbMod.ref(fb.rtdb, path(ROOMS, code, 'result')), {
        [path('settled', fb.uid)]: mask | 0,
        [path('claims', fb.uid)]: counts,
      }),
      undefined, '정산 도장'
    );
    return true;
  } catch {
    return false;
  }
}

export async function readRoom(code) {
  const fb = await rt();
  if (!fb) return null;
  try {
    const read = await readOnce(fb, path(ROOMS, code));
    return read.val;
  } catch {
    return null;
  }
}

/** 패자가 내놓은 신발 목록을 방에 적는다 (승자가 읽어 간다) */
export async function publishGiven(code, indices) {
  const fb = await rt();
  if (!fb) return false;
  try {
    await withTimeout(
      fb.dbMod.set(fb.dbMod.ref(fb.rtdb, path(ROOMS, code, 'result', 'given', fb.uid)), indices),
      undefined, '신발 내주기'
    );
    return true;
  } catch {
    return false;
  }
}
