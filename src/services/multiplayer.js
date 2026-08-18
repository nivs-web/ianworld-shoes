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
import { makeRoomCode, isRoomCode, rankPlayers, joinable, byPreference } from './matchRules.js';

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
export async function serverOffset(fb) {
  try {
    const snap = await withTimeout(fb.dbMod.get(fb.dbMod.ref(fb.rtdb, '.info/serverTimeOffset')), undefined, '서버 시각');
    return snap.val() ?? 0;
  } catch {
    return 0;
  }
}

const nowOn = (fb, offset) => Date.now() + offset;

/** 내 참가자 레코드 초기값 */
function meRecord(profile) {
  return {
    nickname: profile.nickname ?? '',
    characterId: profile.selectedCharacter ?? 'ian',
    ready: false,
    stairs: 0,
    shoesFound: 0,
    alive: true,
    joinedAt: Date.now(),
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
        players: { [fb.uid]: meRecord(p) },
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
  const roomRef = fb.dbMod.ref(fb.rtdb, path(ROOMS, code));

  /**
   * ★ **트랜잭션 전에 방을 반드시 한 번 읽는다.** (2026-08-16)
   *
   * 이게 없어서 **자동 매칭이 통째로 고장나 있었다.** 두 대로 '방 입장'을 눌러도
   * 서로를 못 찾고 각자 방만 만들었다.
   *
   * 파이어베이스 트랜잭션은 **클라이언트가 들고 있는 값으로 먼저 한 번 호출**된다.
   * 한 번도 읽은 적 없는 경로면 그 값은 `null` 이다. 그런데 예전 코드는
   * `if (!cur) { verdict='notfound'; return; }` 로 **거기서 곧장 중단**했다 —
   * 핸들러가 `undefined` 를 돌려주면 트랜잭션은 서버 값을 기다리지 않고 그대로 끝난다.
   *
   * 즉 **남의 방은 무조건 '없는 방'으로 판정**됐다. 자동 매칭은 후보를 전부 그렇게
   * 흘려보내고 마지막 줄의 `createRoom()` 으로 떨어졌고, 코드로 입장도 멀쩡한 코드에
   * "방을 찾을 수 없습니다"를 띄웠다. 규칙 문제로 보였지만(실제로 규칙도 따로 문제가
   * 있었다) 이건 전혀 다른 층의 버그다.
   *
   * 먼저 읽어 두면 캐시가 채워져 트랜잭션 첫 호출이 진짜 값을 받는다.
   * 덤으로 정원·상태 판정을 트랜잭션 밖에서 미리 할 수 있어 헛트랜잭션이 줄어든다.
   */
  if (!(await waitConnected(fb))) return 'error';   // 연결도 안 된 채 '방 없음'이라 하지 않는다
  const read = await readOnce(fb, path(ROOMS, code));
  if (!read.ok) return 'error';                     // 못 읽은 것과 없는 것은 다르다
  const seen = read.val;
  if (!seen) return 'notfound';
  if (!seen.players?.[fb.uid]) {
    if (seen.state !== 'waiting') return 'started';
    if (Object.keys(seen.players ?? {}).length >= (seen.maxPlayers ?? MULTI.maxPlayers)) return 'full';
  }

  let verdict = 'error';
  try {
    const res = await withTimeout(fb.dbMod.runTransaction(roomRef, (cur) => {
      // 읽고 왔는데도 null 이면 그 사이에 방이 사라진 것이다 (드물지만 가능)
      if (!cur) { verdict = 'notfound'; return; }
      if (cur.players?.[fb.uid]) { verdict = 'ok'; return cur; } // 재입장
      if (cur.state !== 'waiting') { verdict = 'started'; return; }
      const n = Object.keys(cur.players ?? {}).length;
      if (n >= (cur.maxPlayers ?? MULTI.maxPlayers)) { verdict = 'full'; return; }
      cur.players = { ...(cur.players ?? {}), [fb.uid]: meRecord(p) };
      /**
       * ★ **방장이 사라진 방은 내가 이어받는다.** (2026-08-16)
       *
       * 연결이 끊기면 `onDisconnect` 가 그 사람을 방에서 지운다. 그래서 참가자가
       * 0명인데 `hostUid` 만 남은 빈 방이 생긴다. 그 방에 들어가면 **아무도 방장이
       * 아니라서 시작 버튼이 영영 안 나온다** — 둘이 만나도 게임을 시작할 수가 없다.
       * 규칙도 "직전 방장이 이미 없으면 바꿀 수 있다"로 열어 뒀다 (FIREBASE_RULES.md).
       */
      if (!cur.players[cur.hostUid]) cur.hostUid = fb.uid;
      if (n + 1 >= (cur.maxPlayers ?? MULTI.maxPlayers)) cur.open = false;
      verdict = 'ok';
      return cur;
    }), undefined, '방 입장');
    if (!res.committed && verdict === 'error') verdict = 'full';
  } catch {
    return 'error';
  }
  if (verdict === 'ok') await noteMyRoom(fb, code);
  return verdict;
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
function sweepEmptyRooms(fb, rooms) {
  const now = Date.now();
  const dead = rooms
    .filter((r) => r && r.code && !Object.keys(r.players ?? {}).length && now - (r.createdAt ?? now) > STALE_EMPTY_MS)
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
  // 연결 전에 훑으면 빈 목록을 보고 곧장 새 방을 판다 — 그게 '전부 방장' 증상이다
  await waitConnected(fb);

  // 1) 이미 열려 있는 방 찾기
  try {
    const raw = await scanOpenRooms(fb);
    sweepEmptyRooms(fb, raw);   // 낡은 빈 방은 지나가는 김에 치운다
    let rooms = raw.filter((r) => joinable(r, fb.uid, MULTI.maxPlayers)).sort(byPreference);
    /**
     * **비어 있으면 한 번 더 본다.** 막 붙은 직후의 빈 목록은 "방이 없다"가 아니라
     * "아직 못 받았다"일 수 있다. 여기서 성급하게 방을 파면 두 사람이 각자
     * 방장이 되어 영영 안 만난다 — 실기기에서 정확히 그 증상이 나왔다.
     */
    if (!rooms.length) {
      await new Promise((r) => setTimeout(r, EMPTY_RESCAN_MS));
      rooms = (await scanOpenRooms(fb)).filter((r) => joinable(r, fb.uid, MULTI.maxPlayers)).sort(byPreference);
    }
    for (const r of rooms) {
      if (await joinRoom(r.code) === 'ok') return r.code;
    }
  } catch { /* 못 찾으면 새로 판다 */ }

  // 2) 없으면 새로 판다
  const mine = await createRoom({ isPrivate: false, difficulty });
  if (!mine) return null;

  // 3) 같은 순간에 만들어진 방이 있는지 한 번 더 본다 (동시 입장 해소)
  try {
    await new Promise((r) => setTimeout(r, RETRY_SCAN_MS));
    const mineRoom = await readRoom(mine);
    // 그 사이에 누가 내 방에 들어왔으면 옮길 이유가 없다
    if (Object.keys(mineRoom?.players ?? {}).length > 1) return mine;

    const older = (await scanOpenRooms(fb))
      .filter((r) => joinable(r, fb.uid, MULTI.maxPlayers) && r.code !== mine)
      .filter((r) => byPreference(r, mineRoom ?? { code: mine, createdAt: Infinity }) < 0)
      .sort(byPreference)[0];
    if (!older) return mine;

    if (await joinRoom(older.code) === 'ok') {
      await leaveRoom(mine).catch(() => {});   // 내 빈 방은 치운다
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
  await withTimeout(fb.dbMod.update(fb.dbMod.ref(fb.rtdb, path(ROOMS, code)), {
    state: 'countdown', open: false, startAt,
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
  if (!force && (!changed || t - lastSent.at < PROGRESS_MS)) return;
  lastSent = { at: t, stairs, shoesFound };

  const fb = await rt();
  if (!fb) return;
  await withTimeout(fb.dbMod.update(fb.dbMod.ref(fb.rtdb, path(ROOMS, code, 'players', fb.uid)), {
    stairs: stairs | 0, shoesFound: shoesFound | 0, alive: !!alive,
  }), undefined, '진행도').catch(() => {});
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
  await withTimeout(fb.dbMod.update(fb.dbMod.ref(fb.rtdb, path(ROOMS, code, 'players', fb.uid)), {
    stairs: stairs | 0, shoesFound: shoesFound | 0, alive: false, reachedAt: Date.now(),
  }), undefined, '사망 보고').catch(() => {});
  await withTimeout(fb.dbMod.update(fb.dbMod.ref(fb.rtdb, path(ROOMS, code)), { state: 'finished' }), undefined, '방 종료').catch(() => {});
}

/**
 * 순위를 확정해 방에 적는다.
 *
 * **누가 먼저 도착하든 결과가 같아야 한다.** 그래서 계산은 `rankPlayers`(결정적)로
 * 하고, 쓰기는 트랜잭션으로 **이미 적혀 있으면 건드리지 않는다.** 네 명이 동시에
 * 적으러 와도 처음 것 하나만 남는다.
 */
export async function finalizeResult(code, attempt = 0) {
  const fb = await rt();
  if (!fb) return null;
  const roomRef = fb.dbMod.ref(fb.rtdb, path(ROOMS, code));
  /**
   * 트랜잭션 첫 호출은 **로컬 캐시 값**으로 온다. 이 함수는 `endMulti()` 가 방 구독을
   * 끊은 뒤에 불리므로 캐시가 이미 비워졌을 수 있고, 그러면 `!cur` 로 중단돼
   * **순위가 영영 안 박힌다**(= 아무도 정산을 못 한다). 먼저 읽어 캐시를 채운다.
   * `joinRoom` 이 정확히 이 함정 때문에 자동 매칭을 통째로 죽이고 있었다.
   */
  await waitConnected(fb);
  await readOnce(fb, path(ROOMS, code));
  try {
    const res = await withTimeout(fb.dbMod.runTransaction(roomRef, (cur) => {
      if (!cur) return;
      if (cur.result?.rankings) return cur; // 이미 확정됨 — 덮어쓰지 않는다
      const players = Object.entries(cur.players ?? {}).map(([uid, v]) => ({ uid, ...v }));
      if (players.length < MULTI.minPlayers) return cur;
      cur.state = 'finished';
      cur.open = false;
      cur.result = { ...(cur.result ?? {}), rankings: rankPlayers(players), endedAt: Date.now() };
      return cur;
    }), undefined, '결과 확정');
    return res.snapshot?.val() ?? null;
  } catch {
    /**
     * ★ **한 번은 다시 시도한다.** (2026-08-16)
     *
     * 이 트랜잭션은 방 노드 **전체**를 다시 쓴다. 그런데 규칙이 "남의 값은 그대로여야
     * 한다"고 요구하므로, 내가 읽은 뒤 쓰기 전에 **상대의 마지막 진행도가 서버에 닿으면**
     * 내가 쓰는 값이 낡아서 거부된다. 판이 끝나는 순간은 모두가 마지막 보고를 밀어 올리는
     * 시점이라 실제로 겹칠 수 있다. 순위가 안 박히면 아무도 정산을 못 하므로,
     * 짧게 쉬고 최신 값으로 한 번 더 시도한다. (모두가 부르므로 보통은 누군가 성공한다)
     */
    if (attempt === 0) {
      await new Promise((r) => setTimeout(r, 400));
      return finalizeResult(code, 1);
    }
    return null;
  }
}

// ─────────────────────────────────────────────
// 정리
// ─────────────────────────────────────────────

/** 대기방에서 나간다. 방장이 마지막이면 방을 지운다. */
export async function leaveRoom(code) {
  const fb = await rt();
  if (!fb) return;
  const roomRef = fb.dbMod.ref(fb.rtdb, path(ROOMS, code));
  // 여기도 캐시가 비어 있으면 트랜잭션이 첫 호출에서 중단된다 (finalizeResult 주석 참고)
  await readOnce(fb, path(ROOMS, code));
  try {
    await withTimeout(fb.dbMod.runTransaction(roomRef, (cur) => {
      if (!cur) return;
      if (cur.state !== 'waiting') return cur; // 시작한 판은 빠져나가도 기록이 남아야 한다
      delete cur.players?.[fb.uid];
      const n = Object.keys(cur.players ?? {}).length;
      if (n === 0) return null; // 빈 방은 치운다
      if (cur.hostUid === fb.uid) cur.hostUid = Object.keys(cur.players)[0];
      cur.open = !cur.isPrivate;
      return cur;
    }), undefined, '방 나가기');
  } catch { /* 못 지워도 open=false 라 매칭에는 안 걸린다 */ }
}

/**
 * 내가 들어갔던 방 목록 (미정산 청산용) — **최근 것부터, 최대 `limit` 개.**
 *
 * 예전에는 전부 돌려줬고 `sweepUnsettled` 가 그걸 통째로 순회했다. 방은 어디서도
 * 지워지지 않으므로 오래 즐긴 사람일수록 **접속할 때마다 지금까지의 모든 방**을
 * 읽었다 — 무료 요금제 읽기 할당량에 그대로 꽂힌다. 정산이 밀리는 건 길어야 며칠이라
 * 최근 것만 봐도 충분하다.
 */
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
export async function markSettledRemote(code, mask) {
  const fb = await rt();
  if (!fb) return false;
  try {
    await withTimeout(
      fb.dbMod.set(fb.dbMod.ref(fb.rtdb, path(ROOMS, code, 'result', 'settled', fb.uid)), mask | 0),
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
