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
import { markActive, msSinceActive } from '../core/activity.js';
import { presenceLive } from './matchRules.js';
import { MULTI } from '../config/balance.js';

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

/**
 * ★ **접속 판정 = 연결이 아니라 활동.** (2026-08-19 19차, 사용자 지정)
 *
 * *"60초 동안 움직임이 없고 메뉴도 누르지 않고 아무런 행동도 하지 않으면,
 *   그 사용자는 나간 사용자라고 판단하자"*
 *
 * 예전에는 `onDisconnect` 하나로만 판단했다. 그건 **소켓이 죽었는지**만 알려 준다 —
 * 탭을 열어 둔 채 폰을 주머니에 넣으면 소켓은 멀쩡하고 서버는 끊긴 걸 알 방법이 없다.
 * 그래서 **아무도 없는데 5명이 접속 중**으로 남았다.
 *
 * 조사해 보니 실제 제품들도 전부 신호를 둘로 나눈다(연결성 / 활동성).
 * 값의 근거:
 *
 * | | 값 | 왜 |
 * |---|---|---|
 * | `ACTIVITY_TIMEOUT_MS` | 60초 | 사용자 지정 |
 * | `HEARTBEAT_MS` | 15초 | 신호를 **연속 3번 놓쳐도** 안 잘린다. Zulip 이 같은 규칙을 코드 주석에 적어 뒀다(`OFFLINE_THRESHOLD = PING × 3 + 여유`). PubNub 은 2배, Pusher 는 1.25배(그쪽은 프로토콜 ping 이라 왕복만 보면 된다) |
 * | `RECOMPUTE_MS` | 5초 | **오래됨은 이벤트를 만들지 않는다.** 아무도 쓰지 않으면 RTDB 콜백이 안 오므로 목록이 그대로 멈춘다 — 타이머로 다시 걸러야 유령이 사라진다 |
 * | `WRITE_THROTTLE_MS` | 10초 | 같은 값을 자주 쓰면 그게 그대로 **모두에게 브로드캐스트**된다(RTDB 는 바이트 과금) |
 *
 * 그리고 **활동이 없으면 아예 안 쓴다.** 자리를 비운 사람의 비용이 0이 되고,
 * 60초가 지나면 저절로 목록에서 빠진다 — 따로 지우는 사람이 필요 없다.
 */
export const ACTIVITY_TIMEOUT_MS = MULTI.onlineSeconds * 1000;
const HEARTBEAT_MS = 15 * 1000;
const RECOMPUTE_MS = 5 * 1000;
const WRITE_THROTTLE_MS = 10 * 1000;

/**
 * 기기가 잠들었다 깨어난 것을 알아채는 문턱.
 *
 * 사파리에는 `resume` 이벤트가 없고, 크롬은 숨은 탭의 타이머를 **1분에 한 번**까지
 * 조인다. 그래서 "타이머가 이만큼이나 늦게 돌았다"로 판정한다 — 문턱이 60초보다
 * 길어야 스로틀링을 잠든 것으로 오해하지 않는다(Zulip 워치독이 같은 이유로 75초다).
 */
const SUSPEND_MS = 75 * 1000;

/** 서버 시계와의 차이 — `lastActive` 는 서버가 찍으므로 읽을 때도 서버 시각으로 재야 한다 */
let serverOffset = 0;
const serverNow = () => Date.now() + serverOffset;

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

/**
 * ★ **연결이 붙을 때까지 기다린다.** (2026-08-19 15차)
 *
 * RTDB 쓰기는 소켓이 없으면 **거절하지 않고 큐에 쌓인다.** 그래서 `withTimeout` 이
 * 12초를 세고 나서야 실패가 되는데, 사용자에게는 그 12초가 **"보내기를 눌렀는데
 * 아무 일도 안 난다"** 로 보인다. 접속 표시는 2.5초 뒤에 한가할 때 붙으므로(§9-0-43),
 * 로비에 들어오자마자 쪽지를 보내면 정확히 그 창에 걸린다.
 *
 * 방(`multiplayer.js`)은 이미 같은 이유로 `waitConnected` 를 쓴다(§9-0-17).
 * 여기서 그 파일을 물면 **쪽지 하나 보내려고 멀티 모듈 전체를 받게 되므로** 따로 둔다.
 *
 * 붙은 뒤에는 곧바로 참을 돌려주므로 두 번째부터는 비용이 0 이다.
 */
let online = false;
function waitConnected(fb, ms = 6000) {
  if (online) return Promise.resolve(true);
  return new Promise((resolve) => {
    let done = false;
    let off = null;
    const finish = (v) => { if (done) return; done = true; off?.(); clearTimeout(timer); resolve(v); };
    const timer = setTimeout(() => finish(false), ms);
    try {
      off = fb.dbMod.onValue(fb.dbMod.ref(fb.rtdb, '.info/connected'), (snap) => {
        if (snap.val() !== true) return;
        online = true;
        finish(true);
      });
    } catch { finish(false); }
  });
}

/** 지금 내 상태 — 'lobby'(대기중) 또는 'playing'(게임중) */
let myState = 'lobby';
let started = false;
let stopConn = null;
let startTimer = null;
let myRef = null;
let myFb = null;
let beat = null;
let lastWriteAt = 0;
let lifecycleBound = false;

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
 * 내 카드를 서버에 쓴다. `lastActive` 는 **반드시 서버 타임스탬프**다 —
 * 폰 시계가 앞서 있으면 영원히 "방금 활동함"이 되어 유령이 되살아난다.
 */
function cardWithStamp(fb) {
  return { ...myCard(), lastActive: fb.dbMod.serverTimestamp() };
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
  myRef = ref;
  myFb = fb;
  try {
    // 서버 시계와의 차이를 받아 둔다 — 남의 `lastActive` 를 재려면 같은 시계여야 한다
    fb.dbMod.onValue(fb.dbMod.ref(fb.rtdb, '.info/serverTimeOffset'),
      (s2) => { serverOffset = s2.val() || 0; });

    stopConn = fb.dbMod.onValue(fb.dbMod.ref(fb.rtdb, '.info/connected'), async (snap) => {
      if (snap.val() !== true) { online = false; return; }
      online = true;
      try {
        /**
         * 끊기면 서버가 지운다 — 브라우저를 그냥 닫아도 목록에 유령이 안 남는다.
         * **반드시 `set` 보다 먼저 건다**(Firebase 문서의 경쟁 조건 경고).
         * 다만 이것은 **빠른 길일 뿐 정확성의 근거가 아니다** — 서버가 죽은 소켓을
         * 알아채는 데 걸리는 시간은 공개돼 있지도 않다. 정확성은 `lastActive` 가 맡는다.
         */
        await fb.dbMod.onDisconnect(ref).remove();
        await writeCard(fb, ref);
      } catch { /* 규칙이 아직 없으면 조용히 넘어간다 — 게임은 그대로 돈다 */ }
    });
    beat = setInterval(() => heartbeat().catch(() => {}), HEARTBEAT_MS);
    bindLifecycle();
  } catch { started = false; }
}

/** 지금 카드를 쓰고 마지막 쓰기 시각을 남긴다 */
async function writeCard(fb, ref) {
  await withTimeout(fb.dbMod.set(ref, cardWithStamp(fb)), undefined, '접속 표시');
  lastWriteAt = Date.now();
}

/**
 * ★ **활동이 있을 때만** 심장 박동을 보낸다.
 *
 * 숨어 있거나 60초 넘게 아무것도 안 했으면 **쓰지 않는다** — 그러면 `lastActive` 가
 * 늙어서 남들의 목록에서 저절로 빠진다. 지우러 갈 필요도, 서버 잡도 필요 없다.
 * (덤으로 자리를 비운 사람이 만드는 트래픽이 0이 된다)
 */
async function heartbeat() {
  if (!started || !myRef || !myFb || !online) return;
  const visible = typeof document === 'undefined' || document.visibilityState === 'visible';
  if (!visible) return;
  /**
   * ★ **판·대기방에 앉아 있는 것도 활동으로 친다.** (사용자 지정)
   *
   * *"메뉴 여기저기 돌아다니거나 멀티게임에 방을 만들고 있거나, 게임로비에 있거나,
   *   등등 게임중이면, 상대방이 현재 게임중입니다 라고 뜨게 만들고"*
   *
   * 상대 차례를 지켜보거나 방에서 시작을 기다리는 사람은 60초 동안 아무것도 안 누를 수
   * 있다. 그렇다고 그 사람을 "나갔다"고 하면 대기방이 통째로 사라진다.
   *
   * 안전한 이유는 **화면이 보이는 동안만** 인정하기 때문이다 — 폰을 잠그거나 다른 앱으로
   * 넘어가면 `visibilitychange` 가 `hidden` 을 주고, 그 순간 우리는 스스로 목록에서 빠진다.
   * 즉 "폰을 내려놓은 사람"은 이 예외로 살아남지 못한다.
   */
  const inGame = myState === 'playing';
  if (!inGame && msSinceActive() > ACTIVITY_TIMEOUT_MS) return;
  if (Date.now() - lastWriteAt < WRITE_THROTTLE_MS) return;
  await withTimeout(myFb.dbMod.update(myRef, {
    lastActive: myFb.dbMod.serverTimestamp(), at: Date.now(),
  }), undefined, '접속 유지');
  lastWriteAt = Date.now();
}

/**
 * 화면을 내리는 순간 **스스로 목록에서 빠진다.**
 *
 * `beforeunload`·`unload` 는 쓰지 않는다 — 크롬 문서가 "쓰지 말라"고 못 박았고
 * 모바일에서는 거의 안 불린다(앱 전환 후 브라우저를 종료하면 셋 다 안 온다).
 * **믿을 수 있는 종료 신호는 `visibilitychange` 의 `hidden` 하나뿐이다.**
 * `pagehide` 는 보조로만 건다(bfcache 와는 호환된다).
 */
function bindLifecycle() {
  if (typeof document === 'undefined' || lifecycleBound) return;
  lifecycleBound = true;
  /**
   * 숨는 순간의 이 쓰기는 **닿을 수도, 안 닿을 수도 있다** — 브라우저가 곧바로 페이지를
   * 얼리면 큐에 남는다. 그래서 이건 "빠른 길"일 뿐이고, 못 닿아도 60초 뒤 `lastActive`
   * 가 늙어 저절로 빠진다. 두 겹을 다 두는 이유가 이것이다.
   */
  const drop = () => {
    if (myRef && myFb) withTimeout(myFb.dbMod.remove(myRef), undefined, '접속 해제').catch(() => {});
  };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') { drop(); return; }
    markActive();
    if (myRef && myFb) writeCard(myFb, myRef).catch(() => {});
    recomputeAll();
  });
  window.addEventListener('pagehide', drop);

  /**
   * 기기가 잠들었다 깨어난 것을 알아챈다 — 사파리에는 `resume` 이벤트가 없다.
   * 타이머가 문턱보다 오래 늦었으면 그 사이 우리는 아무 신호도 못 보냈으므로,
   * 카드를 새로 쓰고 목록도 다시 거른다.
   */
  let tick = Date.now();
  setInterval(() => {
    const now = Date.now();
    if (now - tick > SUSPEND_MS && myRef && myFb) {
      markActive();
      writeCard(myFb, myRef).catch(() => {});
    }
    tick = now;
    recomputeAll();
  }, RECOMPUTE_MS);
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
    // 화면을 옮긴 것 자체가 활동이다 — 여기서 안 찍으면 게임에 들어간 사람이 60초 뒤 사라진다
    markActive();
    lastWriteAt = Date.now();
    return withTimeout(fb.dbMod.update(fb.dbMod.ref(fb.rtdb, path(PRESENCE, fb.uid)),
      { state: myState, at: Date.now(), lastActive: fb.dbMod.serverTimestamp() }),
      undefined, '상태 갱신');
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
    lastWriteAt = Date.now();
    return withTimeout(fb.dbMod.set(fb.dbMod.ref(fb.rtdb, path(PRESENCE, fb.uid)),
      { ...card, lastActive: fb.dbMod.serverTimestamp() }), undefined, '접속 표시 갱신');
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
/**
 * ★ **살아 있는 접속인가** — 60초 안에 활동이 있었나. (2026-08-19 19차)
 *
 * `lastActive` 가 아예 없는 카드는 **19차 이전 클라이언트**가 쓴 것이다. 그런 카드는
 * `at`(폰 시계)으로라도 재 준다 — 배포 직후에는 옛 클라이언트가 아직 돌아다닌다(PWA 캐시).
 * 둘 다 없으면 판단할 근거가 없으므로 **접속 중으로 보지 않는다**: 근거 없이
 * "여기 있다"고 말하는 쪽이 훨씬 나쁘다(대결 신청이 허공으로 나간다).
 */
export function isLive(card, now = serverNow()) {
  /**
   * ★ 판정은 **`matchRules` 한 곳**에 있다 (2026-08-21 33차). 방 목록도 같은 잣대로
   * 재야 하는데(사용자 신고: "현재접속자엔 나 혼자인데 방은 3개"), 여기와 거기가 각자
   * 60초를 세면 언젠가 한쪽만 고쳐진다.
   */
  return presenceLive(card, now);
}



/**
 * 접속자 목록을 구독한다.
 *
 * **못 붙었을 때는 `null` 을 준다.** 빈 배열로 뭉뚱그리면 화면이 "접속 중인 사람이
 * 없습니다"라고 **거짓말을 한다** — 연결이 안 된 것과 아무도 없는 것은 다르다
 * (§9-0-6 에서 순위표가 같은 거짓말을 했다).
 *
 * ★ **거르는 일은 읽는 쪽이 한다.** 데이터는 이미 모두에게 내려와 있으므로 서버를
 *   한 번 더 거칠 이유가 없다(추가 쓰기·함수 호출 0). 대신 **오래됨은 이벤트를
 *   만들지 않으므로** 5초마다 스스로 다시 걸러야 한다 — 이게 없으면 `lastActive` 를
 *   넣어도 화면의 유령은 그대로 남는다.
 *
 * @param {(rows: Array|null) => void} cb
 * @returns {() => void} 해제
 */
export function subscribeOnline(cb) {
  let off = () => {};
  let dead = false;
  const entry = { cb, raw: null };
  watchers.add(entry);
  rt().then((fb) => {
    if (dead) return;
    if (!fb) return cb(null);
    const r = fb.dbMod.ref(fb.rtdb, PRESENCE);
    const h = fb.dbMod.onValue(r, (snap) => {
      entry.raw = snap.val() ?? {};
      emit(entry);
    }, () => { entry.raw = null; cb(null); });
    if (dead) { h(); return; }
    off = h;
  }).catch(() => cb(null));
  return () => { dead = true; watchers.delete(entry); off(); };
}

/** 구독자들 — 5초마다 같은 데이터로 다시 걸러 준다 */
const watchers = new Set();

function emit(entry) {
  if (!entry.raw) return;
  const now = serverNow();
  const rows = Object.entries(entry.raw)
    .map(([uid, p]) => ({ uid, ...p }))
    .filter((r) => isLive(r, now));
  entry.cb(rows);
}

function recomputeAll() {
  for (const w of watchers) emit(w);
}

/**
 * 한 사람의 접속 상태만 (없으면 null = 미접속).
 *
 * ★ **오래된 카드는 없는 것으로 본다.** (19차) 목록만 거르고 여기를 안 거르면
 *   "목록에는 없는데 대결 신청은 보내지는" 상태가 된다 — 사용자가 신고한 그것이다.
 */
export async function readOne(uid) {
  const fb = await rt();
  if (!fb || !uid) return null;
  try {
    const snap = await withTimeout(
      fb.dbMod.get(fb.dbMod.ref(fb.rtdb, path(PRESENCE, uid))), undefined, '접속 확인');
    const v = snap.val() ?? null;
    return isLive(v) ? v : null;
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
    /**
     * ★ **짧게 묻는다(3초).** (2026-08-19 15차)
     * 이 조회는 "왜 못 보내는지"를 더 정확히 말해 주려는 **곁다리**다. 그런데 기본
     * 시한(12초)을 그대로 쓰면 조회가 느릴 때 **보내기 자체가 12초 늦어진다** —
     * 곁다리가 본 줄기를 막는 꼴이다. 못 읽으면 규칙이 어차피 막아 주므로 그냥 진행한다.
     */
    const snap = await withTimeout(
      fb.dbMod.get(fb.dbMod.ref(fb.rtdb, path(PREFS, uid, 'accept'))), 3000, '수신 설정 확인');
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
   * ★ **붙기 전에는 보내지 않는다.** (2026-08-19 15차)
   * 안 그러면 쓰기가 큐에 쌓인 채 12초를 기다렸다 시한 초과로 실패한다 —
   * 사용자에게는 그냥 "안 보내진다"다. 6초 안에 못 붙으면 그건 진짜 네트워크 문제다.
   */
  if (!(await waitConnected(fb))) return 'error';
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
