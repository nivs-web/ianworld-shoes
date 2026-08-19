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

/**
 * 부팅을 방해하지 않으려고 이만큼 미뤘다 붙는다.
 *
 * 1500 → **2500** (2026-08-19 13차). 1.5초는 사용자가 로비를 보고 **싱글게임을 누르는
 * 바로 그 순간**이라, RTDB 청크(44KB gz)가 판 에셋(146KB)과 회선을 다퉜다.
 * 게다가 그냥 기다리는 게 아니라 `requestIdleCallback` 으로 **한가한 틈**을 고른다.
 */
const START_DELAY_MS = 2500;

/** 한가한 틈에 부른다 (없는 브라우저는 그냥 타이머) */
function whenIdle(fn, timeout) {
  if (typeof requestIdleCallback === 'function') requestIdleCallback(fn, { timeout });
  else setTimeout(fn, timeout);
}
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
    /**
     * 탭이 숨어 있으면 붙지 않는다 — 어차피 그 사람은 지금 게임을 안 보고 있고,
     * 붙자마자 `onDisconnect` 로 지워질 수도 있다. 돌아오면 그때 붙는다.
     */
    if (typeof document !== 'undefined' && document.hidden) {
      document.addEventListener('visibilitychange', function once() {
        if (document.hidden) return;
        document.removeEventListener('visibilitychange', once);
        startLater(after, 0);
      });
      return;
    }
    whenIdle(() => {
      start().catch(() => {}).then(() => { try { after?.(); } catch { /* 무시 */ } });
    }, 3000);
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

/**
 * 프로필이 바뀌었다(신발·승패·닉네임) — 카드를 다시 쓴다.
 * **값이 그대로면 안 쓴다.** 로비를 드나들 때마다 부르므로, 안 그러면 헛쓰기가 쌓인다
 * (`multiplayer.refreshMyCard` 와 같은 이유).
 */
let lastCard = '';
export function refresh() {
  if (!started) return;
  const card = myCard();
  const key = `${card.nickname}|${card.characterId}|${card.shoesOwned}|${card.multiWins}|${card.multiLosses}|${card.state}`;
  if (key === lastCard) return;
  lastCard = key;
  rt().then((fb) => {
    if (!fb) return;
    return withTimeout(fb.dbMod.set(fb.dbMod.ref(fb.rtdb, path(PRESENCE, fb.uid)), card),
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
// 수신 설정 · 차단 (2026-08-19 12차)
// ─────────────────────────────────────────────

/**
 * `prefs/$uid` — 두 값뿐이다.
 *
 *   accept  : 메세지·대결신청을 받을 것인가 (없으면 받는다)
 *   blocked : 내가 차단한 사람 목록
 *
 * **읽기 범위가 다르다.** `accept` 는 누구나 읽는다 — 보내는 사람이 "왜 못 보내는지"를
 * 알아야 `상대방에 메세지 수신 거부중` 이라고 말해 줄 수 있다. 반면 `blocked` 는
 * **본인만** 읽는다. 차단 목록이 공개되면 그 자체가 사고다.
 *
 * 그래서 차단은 화면이 아니라 **규칙이 막는다**(`inbox/$uid/$id/.write`). 클라이언트는
 * 거부당했다는 사실만 보고 `상대방이 차단 설정을 했습니다` 라고 옮긴다.
 */
const PREFS = 'prefs';

/** 내 수신 설정 · 차단 목록을 구독한다 */
export function subscribeMyPrefs(cb) {
  let off = () => {};
  let dead = false;
  rt().then((fb) => {
    if (dead) return;
    if (!fb) return cb(null);
    const h = fb.dbMod.onValue(fb.dbMod.ref(fb.rtdb, path(PREFS, fb.uid)), (snap) => {
      const v = snap.val() ?? {};
      cb({ accept: v.accept !== false, blocked: v.blocked ?? {} });
    }, () => cb(null));
    if (dead) { h(); return; }
    off = h;
  }).catch(() => cb(null));
  return () => { dead = true; off(); };
}

/** 메세지·대결신청을 받을 것인가 */
export async function setAccept(on) {
  const fb = await rt();
  if (!fb) return false;
  try {
    await withTimeout(fb.dbMod.set(fb.dbMod.ref(fb.rtdb, path(PREFS, fb.uid, 'accept')), !!on),
      undefined, '수신 설정');
    return true;
  } catch { return false; }
}

/** 차단 / 해제 — 값이 `null` 이면 목록에서 빠진다 */
export async function setBlocked(uid, on) {
  const fb = await rt();
  if (!fb || !uid) return false;
  try {
    await withTimeout(
      fb.dbMod.set(fb.dbMod.ref(fb.rtdb, path(PREFS, fb.uid, 'blocked', uid)), on ? true : null),
      undefined, '차단 설정');
    return true;
  } catch { return false; }
}

/** 상대가 메세지를 받는가 (모르면 받는 것으로 본다 — 기본값은 켜짐이다) */
export async function readAccept(uid) {
  const fb = await rt();
  if (!fb || !uid) return true;
  try {
    const snap = await withTimeout(
      fb.dbMod.get(fb.dbMod.ref(fb.rtdb, path(PREFS, uid, 'accept'))), undefined, '수신 설정 확인');
    return snap.val() !== false;
  } catch { return true; }
}

// ─────────────────────────────────────────────
// 쪽지함
// ─────────────────────────────────────────────

/** 쪽지함이 무한정 자라지 않게 — 오래된 것부터 이만큼만 남긴다 */
export const INBOX_KEEP = 200;

/** 규칙에 거부당했는가 (차단·수신거부) — 네트워크 실패와 구별해야 할 말이 달라진다 */
const denied = (e) => /permission|denied/i.test(String(e?.code ?? '') + String(e?.message ?? ''));

/**
 * 쪽지를 넣는다.
 *
 * ## 왜 두 군데에 쓰는가
 *
 * *"다른 사람에게 메시지 주고, 받은거 전부다 이력 뜨게끔하자"* — 보낸 것도 남아야 한다.
 * RTDB 에 대화방을 따로 만들면 규칙이 한 벌 더 늘고 두 사람이 같은 노드를 쓰게 된다.
 * 대신 **각자 자기 쪽지함에만 쓴다**: 받는 사람 함에 한 통, 내 함에 `out: true` 사본 한 통.
 * 규칙은 이미 "내 쪽지함은 내가 쓴다"를 허용하므로 새 권한이 필요 없고,
 * 지우기·정리도 각자 자기 것만 하면 된다.
 *
 * @returns {Promise<'ok'|'off'|'blocked'|'error'>}
 *   off = 상대가 수신을 꺼 뒀다 · blocked = 상대가 나를 차단했다 (규칙이 거부한다)
 */
export async function push(toUid, body, toName = '') {
  const fb = await rt();
  if (!fb || !toUid || toUid === fb.uid) return 'error';
  /**
   * 수신 거부는 **보내기 전에** 확인한다. 규칙도 막지만, 규칙에 막힌 것만으로는
   * "꺼 뒀다"와 "나를 차단했다"를 구별할 수 없다 — 사용자에게 할 말이 달라진다.
   */
  if (!(await readAccept(toUid))) return 'off';

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
    await withTimeout(
      fb.dbMod.set(fb.dbMod.push(fb.dbMod.ref(fb.rtdb, path(INBOX, toUid))), item),
      undefined, '쪽지 보내기');
  } catch (e) {
    return denied(e) ? 'blocked' : 'error';
  }

  // 보낸 사본 — 실패해도 상대는 이미 받았으므로 성공으로 본다(이력만 빠진다)
  if (body.kind === 'msg') {
    const copy = { ...item, to: toUid, toName: String(toName).slice(0, 16), out: true, read: true };
    withTimeout(fb.dbMod.set(fb.dbMod.push(fb.dbMod.ref(fb.rtdb, path(INBOX, fb.uid))), copy),
      undefined, '보낸 쪽지 기록').catch(() => {});
  }
  return 'ok';
}

export const sendMessage = (toUid, text, toName) => push(toUid, { kind: 'msg', text }, toName);
export const sendChallenge = (toUid, code) => push(toUid, { kind: 'challenge', code });
export const sendSystem = (toUid, text) => push(toUid, { kind: 'system', text });

/**
 * 내 쪽지함 구독.
 *
 * 못 붙었으면 **`null`** 이다 — 빈 배열로 뭉뚱그리면 화면이 "주고받은 메세지가 없습니다"
 * 라고 **거짓말을 한다**(§9-0-6 에서 순위표가 했던 그 거짓말이다).
 * @param {(rows: Array|null) => void} cb
 * @returns {() => void} 해제
 */
export function subscribeInbox(cb) {
  let off = () => {};
  let dead = false;
  rt().then((fb) => {
    if (dead) return;
    if (!fb) return cb(null);
    const r = fb.dbMod.ref(fb.rtdb, path(INBOX, fb.uid));
    const h = fb.dbMod.onValue(r, (snap) => {
      const v = snap.val() ?? {};
      const rows = Object.entries(v).map(([id, m]) => ({ id, ...m }))
        .sort((a, b) => (a.at ?? 0) - (b.at ?? 0));
      prune(fb, rows);
      cb(rows);
    }, () => cb(null));
    if (dead) { h(); return; }
    off = h;
  }).catch(() => cb(null));
  return () => { dead = true; off(); };
}

/**
 * 이력은 남기되 **무한정 쌓이지는 않게** 한다. 지우는 건 오래된 쪽부터다 —
 * 최근 것이 곧 대화라서, 오래된 것을 남기면 목록이 쓸모없어진다.
 */
let pruning = false;
function prune(fb, rows) {
  if (pruning || rows.length <= INBOX_KEEP) return;
  pruning = true;
  const kill = rows.slice(0, rows.length - INBOX_KEEP);
  const patch = {};
  for (const m of kill) patch[m.id] = null;
  withTimeout(fb.dbMod.update(fb.dbMod.ref(fb.rtdb, path(INBOX, fb.uid)), patch),
    undefined, '쪽지함 정리').catch(() => {}).then(() => { pruning = false; });
}

/**
 * 읽음 표시. **지우지 않는다** — 지우면 이력이 사라진다(사용자 요청: 주고받은 것 전부).
 * 팝업은 `read` 가 아닌 것만 띄우므로 이걸로 "다시 안 뜬다"가 성립한다.
 */
export async function markRead(id) {
  const fb = await rt();
  if (!fb || !id) return;
  try {
    await withTimeout(fb.dbMod.set(fb.dbMod.ref(fb.rtdb, path(INBOX, fb.uid, id, 'read')), true),
      undefined, '읽음 표시');
  } catch { /* 다음에 또 뜬다 — 잃는 것보다 낫다 */ }
}

/** 지운다 — 대결 신청처럼 **이력으로 남길 이유가 없는** 것만 */
export async function drop(id) {
  const fb = await rt();
  if (!fb || !id) return;
  try {
    await withTimeout(fb.dbMod.set(fb.dbMod.ref(fb.rtdb, path(INBOX, fb.uid, id)), null),
      undefined, '쪽지 삭제');
  } catch { /* 다음에 또 뜬다 — 잃는 것보다 낫다 */ }
}
