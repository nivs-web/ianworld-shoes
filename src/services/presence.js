/**
 * 접속 표시(`presence`)와 쪽지함(`inbox`) — Realtime Database. (2026-08-19 11차)
 *
 * ## 왜 RTDB 인가
 *
 * "지금 누가 접속해 있나"는 **끊기는 순간을 서버가 알아야** 성립한다. Firestore 에는
 * `onDisconnect` 가 없어서 "브라우저를 그냥 닫은 사람"을 영원히 접속 중으로 남긴다.
 * 방(`multiplayer.js`)이 같은 이유로 RTDB 를 쓰고 있으므로 그 연결을 그대로 탄다.
 *
 * ## 이 파일은 DOM 을 모른다
 *
 * 받은 쪽지를 **팝업으로 띄우는 일**은 화면의 몫이라 `screens/inboxPopups.js` 에 있다.
 * 여기서 화면을 만지면 인게임(캔버스) 중에도 DOM 이 튀어나온다(CLAUDE.md §6-3).
 *
 * ## 접속하자마자 붙지 않는다
 *
 * §9-0-11 에서 "싱글만 하는 사람이 RTDB 192KB 를 받는" 회귀를 한 번 고쳤다. 그런데
 * 쪽지·대결신청은 **접속해 있는 모두**가 받아야 하는 기능이라, 이제는 전원이 붙어야 한다.
 * 대신 **부팅을 막지 않는다** — 첫 화면이 그려지고 한참 뒤에 조용히 붙는다(`startLater`).
 */

import { getRtdb, configured, withTimeout } from './firebase.js';
import { currentUser } from './auth.js';
import * as L from './storageLocal.js';

const PRESENCE = 'presence';
const INBOX = 'inbox';

/** 부팅을 방해하지 않으려고 이만큼 미뤘다 붙는다 */
const START_DELAY_MS = 1500;
/**
 * 이보다 오래된 대결 신청은 **버린다.** 앱을 꺼 뒀다 몇 시간 뒤에 켰는데
 * "대결 신청이 들어왔습니다"가 뜨면, 수락해 봐야 상대는 이미 없다.
 */
export const CHALLENGE_TTL_MS = 90 * 1000;

async function rt() {
  if (!configured()) return null;
  const u = currentUser();
  if (!u || u.guest) return null;
  const fb = await getRtdb();
  return fb ? { ...fb, uid: u.uid } : null;
}

const path = (...parts) => parts.join('/');

/** 지금 내 상태 — 'lobby'(대기중) 또는 'playing'(게임중) */
let myState = 'lobby';
let started = false;
let stopConn = null;
let startTimer = null;

/** 내 접속 카드. 프로필이 바뀌면 다시 쓴다 (신발 수·승패가 여기 실린다) */
function myCard() {
  const p = L.loadProfile();
  return {
    nickname: p.nickname ?? '',
    characterId: p.selectedCharacter ?? 'ian',
    shoesOwned: p.shoesOwned ?? 0,
    multiWins: p.multiWins ?? 0,
    multiLosses: p.multiLosses ?? 0,
    state: myState,
    at: Date.now(),
  };
}

/**
 * 접속 표시를 켠다. 여러 번 불러도 한 번만 붙는다.
 *
 * `.info/connected` 를 구독하는 이유는 **재접속** 때문이다. 한 번만 쓰고 말면
 * 잠깐 끊겼다 돌아온 사람은 `onDisconnect` 로 지워진 채 영영 목록에서 사라진다.
 */
export async function start() {
  if (started) return;
  started = true;
  const fb = await rt();
  if (!fb) { started = false; return; }
  const ref = fb.dbMod.ref(fb.rtdb, path(PRESENCE, fb.uid));
  try {
    stopConn = fb.dbMod.onValue(fb.dbMod.ref(fb.rtdb, '.info/connected'), async (snap) => {
      if (snap.val() !== true) return;
      try {
        // 끊기면 서버가 지운다 — 브라우저를 그냥 닫아도 목록에 유령이 안 남는다
        await fb.dbMod.onDisconnect(ref).remove();
        await withTimeout(fb.dbMod.set(ref, myCard()), undefined, '접속 표시');
      } catch { /* 규칙이 아직 없으면 조용히 넘어간다 — 게임은 그대로 돈다 */ }
    });
  } catch { started = false; }
}

/**
 * 부팅을 막지 않고 조금 뒤에 붙는다.
 *
 * `after` 는 **붙은 뒤에** 돌릴 일이다(쪽지함 구독 같은 것). 호출부에서 따로
 * `setTimeout` 을 잡으면 지연 값이 두 곳에 생기고, 무엇보다 쪽지함이 먼저 붙어
 * **RTDB 청크를 앞당겨 받아** 이 미루기가 통째로 무의미해진다.
 */
export function startLater(after, delay = START_DELAY_MS) {
  if (started || startTimer) return;
  startTimer = setTimeout(() => {
    startTimer = null;
    start().catch(() => {}).then(() => { try { after?.(); } catch { /* 무시 */ } });
  }, delay);
}

/**
 * 지금 무엇을 하고 있는가. **인게임이면 'playing'** 이고 그 사람에게는 대결 신청을
 * 보낼 수 없다(팝업을 띄울 화면이 없다). 대기방도 'playing' 으로 둔다 — 이미 한 방에
 * 앉아 있는 사람이 다른 방 초대를 수락하면 앞 방에 유령으로 남는다.
 */
export function setState(state) {
  const next = state === 'playing' ? 'playing' : 'lobby';
  if (next === myState) return;
  myState = next;
  if (!started) return;
  rt().then((fb) => {
    if (!fb) return;
    return withTimeout(fb.dbMod.update(fb.dbMod.ref(fb.rtdb, path(PRESENCE, fb.uid)),
      { state: myState, at: Date.now() }), undefined, '상태 갱신');
  }).catch(() => {});
}

/** 프로필이 바뀌었다(신발·승패·닉네임) — 카드를 다시 쓴다 */
export function refresh() {
  if (!started) return;
  rt().then((fb) => {
    if (!fb) return;
    return withTimeout(fb.dbMod.set(fb.dbMod.ref(fb.rtdb, path(PRESENCE, fb.uid)), myCard()),
      undefined, '접속 표시 갱신');
  }).catch(() => {});
}

/**
 * 접속자 목록을 구독한다.
 *
 * **못 붙었을 때는 `null` 을 준다.** 빈 배열로 뭉뚱그리면 화면이 "접속 중인 사람이
 * 없습니다"라고 **거짓말을 한다** — 연결이 안 된 것과 아무도 없는 것은 다르다
 * (§9-0-6 에서 순위표가 같은 거짓말을 했다).
 *
 * @param {(rows: Array|null) => void} cb
 * @returns {() => void} 해제
 */
export function subscribeOnline(cb) {
  let off = () => {};
  let dead = false;
  rt().then((fb) => {
    if (dead) return;
    if (!fb) return cb(null);
    const r = fb.dbMod.ref(fb.rtdb, PRESENCE);
    const h = fb.dbMod.onValue(r, (snap) => {
      const v = snap.val() ?? {};
      cb(Object.entries(v).map(([uid, p]) => ({ uid, ...p })));
    }, () => cb(null));
    if (dead) { h(); return; }
    off = h;
  }).catch(() => cb(null));
  return () => { dead = true; off(); };
}

/** 한 사람의 접속 상태만 (없으면 null = 미접속) */
export async function readOne(uid) {
  const fb = await rt();
  if (!fb || !uid) return null;
  try {
    const snap = await withTimeout(
      fb.dbMod.get(fb.dbMod.ref(fb.rtdb, path(PRESENCE, uid))), undefined, '접속 확인');
    return snap.val() ?? null;
  } catch { return null; }
}

// ─────────────────────────────────────────────
// 쪽지함
// ─────────────────────────────────────────────

/**
 * 쪽지를 넣는다. **받는 사람이 게임 중이거나 미접속이어도 넣는다** —
 * 사용자 지정: *"이미 게임중인 사람에게 혹은 미접속중인 사람에게도 게임 대결 신청은
 * 안되지만, 메세지는 보낼 수 있도록"*. 나올 때 팝업으로 뜬다.
 *
 * @param {string} toUid
 * @param {{kind:'msg'|'challenge'|'system', text?:string, code?:string}} body
 */
export async function push(toUid, body) {
  const fb = await rt();
  if (!fb || !toUid || toUid === fb.uid) return false;
  const p = L.loadProfile();
  const item = {
    from: fb.uid,
    fromName: (p.nickname ?? '').slice(0, 16),
    kind: body.kind,
    at: Date.now(),
  };
  if (body.text) item.text = String(body.text).slice(0, 100);
  if (body.code) item.code = String(body.code).slice(0, 8);
  try {
    const listRef = fb.dbMod.ref(fb.rtdb, path(INBOX, toUid));
    await withTimeout(fb.dbMod.set(fb.dbMod.push(listRef), item), undefined, '쪽지 보내기');
    return true;
  } catch { return false; }
}

export const sendMessage = (toUid, text) => push(toUid, { kind: 'msg', text });
export const sendChallenge = (toUid, code) => push(toUid, { kind: 'challenge', code });
export const sendSystem = (toUid, text) => push(toUid, { kind: 'system', text });

/** 내 쪽지함 구독. @returns {() => void} 해제 */
export function subscribeInbox(cb) {
  let off = () => {};
  let dead = false;
  rt().then((fb) => {
    if (dead) return;
    if (!fb) return cb([]);
    const r = fb.dbMod.ref(fb.rtdb, path(INBOX, fb.uid));
    const h = fb.dbMod.onValue(r, (snap) => {
      const v = snap.val() ?? {};
      cb(Object.entries(v).map(([id, m]) => ({ id, ...m })).sort((a, b) => (a.at ?? 0) - (b.at ?? 0)));
    }, () => cb([]));
    if (dead) { h(); return; }
    off = h;
  }).catch(() => cb([]));
  return () => { dead = true; off(); };
}

/** 읽었으면 지운다 — 안 지우면 다음 접속에 또 뜬다 */
export async function drop(id) {
  const fb = await rt();
  if (!fb || !id) return;
  try {
    await withTimeout(fb.dbMod.set(fb.dbMod.ref(fb.rtdb, path(INBOX, fb.uid, id)), null),
      undefined, '쪽지 삭제');
  } catch { /* 다음에 또 뜬다 — 잃는 것보다 낫다 */ }
}
