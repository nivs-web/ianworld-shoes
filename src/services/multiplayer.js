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
import { makeRoomCode, isRoomCode, rankPlayers } from './matchRules.js';

const ROOMS = 'rooms';
const MY_ROOMS = 'userRooms';

/** 방을 새로 팔 때 몇 번까지 코드 충돌을 다시 시도할지 */
const CODE_RETRIES = 8;
/** 자동 매칭이 훑어볼 공개방 수 */
const SCAN_LIMIT = 12;

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
    const snap = await fb.dbMod.get(fb.dbMod.ref(fb.rtdb, '.info/serverTimeOffset'));
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
  try {
    await fb.dbMod.set(fb.dbMod.ref(fb.rtdb, path(MY_ROOMS, fb.uid, code)), Date.now());
  } catch { /* 없어도 게임은 된다 */ }
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

  let verdict = 'error';
  try {
    const res = await withTimeout(fb.dbMod.runTransaction(roomRef, (cur) => {
      if (!cur) { verdict = 'notfound'; return; }
      if (cur.players?.[fb.uid]) { verdict = 'ok'; return cur; } // 재입장
      if (cur.state !== 'waiting') { verdict = 'started'; return; }
      const n = Object.keys(cur.players ?? {}).length;
      if (n >= (cur.maxPlayers ?? MULTI.maxPlayers)) { verdict = 'full'; return; }
      cur.players = { ...(cur.players ?? {}), [fb.uid]: meRecord(p) };
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
 * 자동 매칭 — 비어 있는 공개방에 넣고, 없으면 새로 판다.
 *
 * 훑는 중에 남이 먼저 채울 수 있으므로 **실패하면 다음 방으로 넘어간다.**
 * 한 번 실패하고 포기하면 사람이 몰릴수록 매칭이 안 되는 이상한 게임이 된다.
 */
export async function quickJoin({ difficulty } = {}) {
  const fb = await rt();
  if (!fb) return null;
  try {
    const { ref, query, orderByChild, equalTo, limitToFirst, get } = fb.dbMod;
    const snap = await withTimeout(
      get(query(ref(fb.rtdb, ROOMS), orderByChild('open'), equalTo(true), limitToFirst(SCAN_LIMIT))),
      undefined, '방 찾기'
    );
    const rooms = [];
    snap.forEach((c) => { rooms.push(c.val()); });
    // 사람이 많은 방부터 — 빨리 찰수록 빨리 시작한다
    rooms.sort((a, b) => Object.keys(b.players ?? {}).length - Object.keys(a.players ?? {}).length);
    for (const r of rooms) {
      if (r.hostUid === fb.uid) continue;
      if (await joinRoom(r.code) === 'ok') return r.code;
    }
  } catch { /* 못 찾으면 새로 판다 */ }
  return createRoom({ isPrivate: false, difficulty });
}

// ─────────────────────────────────────────────
// 대기방
// ─────────────────────────────────────────────

/** 방 변화를 구독한다. @returns {() => void} 해제 함수 */
export function subscribeRoom(code, cb) {
  let off = () => {};
  rt().then((fb) => {
    if (!fb) return cb(null);
    const r = fb.dbMod.ref(fb.rtdb, path(ROOMS, code));
    const unsub = fb.dbMod.onValue(r, (s) => cb(s.val()), () => cb(null));
    off = unsub;
  });
  return () => off();
}

export async function setReady(code, ready) {
  const fb = await rt();
  if (!fb) return;
  await fb.dbMod.set(fb.dbMod.ref(fb.rtdb, path(ROOMS, code, 'players', fb.uid, 'ready')), !!ready)
    .catch(() => {});
}

/** 난이도는 방장만 바꾼다 (기획서 §5-9 — 승자 기록이 이 난이도 랭킹으로 간다) */
export async function setRoomDifficulty(code, difficulty) {
  const fb = await rt();
  if (!fb) return;
  await fb.dbMod.update(fb.dbMod.ref(fb.rtdb, path(ROOMS, code)), { difficulty }).catch(() => {});
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
  await fb.dbMod.update(fb.dbMod.ref(fb.rtdb, path(ROOMS, code)), {
    state: 'countdown', open: false, startAt,
  }).catch(() => {});
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
  await fb.dbMod.update(fb.dbMod.ref(fb.rtdb, path(ROOMS, code, 'players', fb.uid)), {
    stairs: stairs | 0, shoesFound: shoesFound | 0, alive: !!alive,
  }).catch(() => {});
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
  await fb.dbMod.update(fb.dbMod.ref(fb.rtdb, path(ROOMS, code, 'players', fb.uid)), {
    stairs: stairs | 0, shoesFound: shoesFound | 0, alive: false, reachedAt: Date.now(),
  }).catch(() => {});
  await fb.dbMod.update(fb.dbMod.ref(fb.rtdb, path(ROOMS, code)), { state: 'finished' }).catch(() => {});
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
  const roomRef = fb.dbMod.ref(fb.rtdb, path(ROOMS, code));
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
  try {
    await fb.dbMod.runTransaction(roomRef, (cur) => {
      if (!cur) return;
      if (cur.state !== 'waiting') return cur; // 시작한 판은 빠져나가도 기록이 남아야 한다
      delete cur.players?.[fb.uid];
      const n = Object.keys(cur.players ?? {}).length;
      if (n === 0) return null; // 빈 방은 치운다
      if (cur.hostUid === fb.uid) cur.hostUid = Object.keys(cur.players)[0];
      cur.open = !cur.isPrivate;
      return cur;
    });
  } catch { /* 못 지워도 open=false 라 매칭에는 안 걸린다 */ }
}

/** 내가 들어갔던 방 목록 (미정산 청산용) */
export async function myRoomCodes() {
  const fb = await rt();
  if (!fb) return [];
  try {
    const snap = await fb.dbMod.get(fb.dbMod.ref(fb.rtdb, path(MY_ROOMS, fb.uid)));
    return Object.keys(snap.val() ?? {}).filter(isRoomCode);
  } catch {
    return [];
  }
}

export async function readRoom(code) {
  const fb = await rt();
  if (!fb) return null;
  try {
    const snap = await fb.dbMod.get(fb.dbMod.ref(fb.rtdb, path(ROOMS, code)));
    return snap.val();
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
