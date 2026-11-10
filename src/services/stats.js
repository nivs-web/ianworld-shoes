/**
 * 운영자 통계 — 오늘 접속자 · 지금 동시접속 · 오늘 최대 동시접속. (2026-11-04)
 *
 * ★ 대표님 지시 (권반장 전달):
 * *"운영자만 보는 것조차도 없어도 돼. 통계만 나오면 돼"*
 *
 * 예전에는 "현재접속자" 화면이 `presence` 를 **통째로 실시간 구독**했다. 보는 사람마다
 * 접속자 전원의 15초 신호를 다 받아 사람이 늘수록 제곱으로 비싸졌다. 운영자가 알고
 * 싶은 것은 **숫자 몇 개**뿐이라, 숫자만 서버에 따로 센다.
 *
 * ## 서버에 남는 것 (`stats/`)
 *
 *   stats/live                 지금 연결된 수 — 붙을 때 +1, 끊기면 서버가 −1
 *   stats/days/{YYYYMMDD}/u/{uid}  오늘 왔다 (하루 한 번, 본인 칸만)
 *   stats/days/{YYYYMMDD}/n    오늘 접속자 수 — `u/{uid}` 를 처음 쓸 때 같은 쓰기로 +1
 *   stats/days/{YYYYMMDD}/peak 오늘 최대 동시접속
 *
 * 쓰는 양은 **사람당 하루 100바이트 남짓**, 읽는 사람은 운영자 한 명이다(열 때만).
 * 날짜는 **한국 시각** 기준이다 — 자정에 하루가 바뀌어야 "오늘" 이 맞다.
 *
 * ## 운영자 판별 — 이름이 아니라 uid
 *
 * 화면 이름은 누구나 바꿀 수 있다. 운영자는 서버의 `admins/{uid}: true` 로 정한다 —
 * 대표님이 Firebase 콘솔에서 **한 줄만 넣으면** 되고, 코드에 uid 를 박지 않는다.
 * 통계 읽기 권한도 같은 칸을 보는 **서버 규칙**이 막는다(`docs/rtdb-rules.json`).
 * 그래서 메뉴를 몰래 띄워도 숫자는 안 읽힌다.
 *
 * 이 파일은 DOM 을 모른다. 실패해도 게임에는 아무 영향이 없다(전부 조용히 넘어간다).
 */

import { getRtdb, configured, withTimeout } from './firebase.js';
import { currentUser } from './auth.js';
import { loadProfile } from './storageLocal.js';

const STATS = 'stats';
const ADMINS = 'admins';
const path = (...p) => p.join('/');

/** 한국 시각 날짜 'YYYYMMDD' */
export function dayKey(ms = Date.now()) {
  const d = new Date(ms + 9 * 3600 * 1000);
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

async function rt() {
  if (!configured()) return null;
  const u = currentUser();
  if (!u || u.guest) return null;
  const fb = await getRtdb();
  return fb ? { ...fb, uid: u.uid } : null;
}

/** 한 번 읽기 (연결 전에도 영원히 기다리지 않게 시한을 건다) */
async function readVal(fb, p) {
  const snap = await withTimeout(fb.dbMod.get(fb.dbMod.ref(fb.rtdb, p)), 8000, '통계 읽기');
  return snap.val();
}

/** 오늘 이미 센 날 — 같은 날 다시 붙을 때마다 서버를 두드리지 않는다 */
let countedDay = '';

/**
 * 연결이 붙을 때마다 부른다 (`presence.start` 의 `.info/connected` 처리 안).
 *
 * ① 동시접속 +1 을 하고, 끊기면 서버가 −1 하도록 **먼저** 예약한다.
 * ② 오늘 처음이면 오늘 접속자 +1.
 * ③ 지금 동시접속이 오늘 최대보다 크면 올린다.
 *
 * 재접속하면 ① 이 다시 돈다 — 끊길 때 이미 −1 이 됐으므로 맞는 셈이다.
 */
export async function onConnected(fb) {
  fb = fb ?? await rt();
  if (!fb) return;
  const day = dayKey();
  /**
   * ★★★ **세 가지를 따로따로 한다 — 하나가 실패해도 나머지는 센다.** (2026-11-05, 운영 버그)
   *
   * 예전에는 한 `try` 안에서 "끊기면 −1 예약 → +1 → 오늘 접속자 → 최대" 순으로 했다.
   * 그런데 RTDB 는 `onDisconnect` 쓰기를 **예약하는 순간** 규칙으로 검사한다(공식 문서).
   * `stats/live` 가 아직 없으면 −1 은 −1 이 되어 규칙(`>= 0`)에 걸리고, 예외가 나서
   * **아래 전부가 건너뛰어졌다** — 아무도 +1 을 못 하니 `live` 는 영영 안 생기고,
   * 운영에서 통계가 전부 0, `stats` 칸 자체가 안 생겼다. 규칙은 그대로 두고 코드만 고친다.
   */
  const liveNow = await countLive(fb);
  try { await countToday(fb, day); } catch { /* 규칙 게시 전 등 — 다음 접속에 다시 */ }
  if (liveNow > 0) {
    try {
      await fb.dbMod.runTransaction(fb.dbMod.ref(fb.rtdb, path(STATS, 'days', day, 'peak')),
        (p) => (liveNow > (p | 0) ? liveNow : undefined));    // undefined = 그대로 둔다
    } catch { /* 최대값만 못 올렸다 */ }
  }
}

/**
 * 동시접속 +1, 그리고 **그 다음에** "끊기면 −1" 예약. 지금 값을 돌려준다(못 셌으면 0).
 *
 * 순서가 중요하다: +1 을 해 둬야 예약 검사 때 −1 의 결과가 0 이상이라 규칙을 통과한다.
 * 예약이 실패하면 방금 한 +1 을 되돌린다 — 안 그러면 끊겨도 안 줄어드는 유령 1명이 남는다.
 * (+1 과 예약 사이에 끊기는 아주 짧은 틈에는 1명이 남을 수 있다 — 숫자 통계라 감수한다.)
 */
async function countLive(fb) {
  const { ref, onDisconnect, set, increment } = fb.dbMod;
  const liveRef = ref(fb.rtdb, path(STATS, 'live'));
  try {
    await withTimeout(set(liveRef, increment(1)), undefined, '동시접속');
  } catch { return 0; }
  try {
    await onDisconnect(liveRef).set(increment(-1));
  } catch {
    await withTimeout(set(liveRef, increment(-1)), undefined, '동시접속 되돌리기').catch(() => {});
    return 0;
  }
  try { return Math.max(0, (await readVal(fb, path(STATS, 'live'))) | 0); } catch { return 0; }
}

/**
 * 오늘 접속자 +1 — **처음 온 날에만.** 내 칸(`u/{uid}`)과 숫자(`n`, 서버가 +1)를
 * **한 번의 쓰기로** 올린다. 규칙이 "내 칸이 새로 생길 때만 n 이 정확히 1 늘어날 수
 * 있다" 를 보므로 한 사람이 여러 번 셀 수 없고, 숫자를 미리 읽을 필요도 없다.
 */
async function countToday(fb, day) {
  if (countedDay === day) return;
  const base = path(STATS, 'days', day);
  if (await readVal(fb, path(base, 'u', fb.uid))) { countedDay = day; return; }
  await withTimeout(fb.dbMod.update(fb.dbMod.ref(fb.rtdb, base), {
    [`u/${fb.uid}`]: true, n: fb.dbMod.increment(1),
  }), undefined, '오늘 접속자');
  countedDay = day;
}

/** 나는 운영자인가 — 서버의 `admins/{내uid}` 하나만 본다. 못 읽으면 아니다 */
let adminCache = null;
export async function isAdmin() {
  const fb = await rt();
  if (!fb) return false;
  if (adminCache && adminCache.uid === fb.uid) return adminCache.yes;
  let yes = false;
  try { yes = (await readVal(fb, path(ADMINS, fb.uid))) === true; } catch { yes = false; }
  adminCache = { uid: fb.uid, yes };
  return yes;
}

/**
 * 통계 읽기 (운영자만 — 규칙이 막는다). 최근 `days` 일.
 * 접속자 명단(`u/`)은 **안 읽는다** — 숫자 칸만 읽으므로 사람이 많아도 크기가 그대로다.
 * @returns {Promise<{live:number, today:string, days:Array<{day:string,n:number,peak:number}>}|null>}
 */
export async function readStats(days = 7) {
  const fb = await rt();
  if (!fb) return null;
  try {
    const keys = Array.from({ length: days }, (_, i) => dayKey(Date.now() - i * 86400000));
    const [live, ...rows] = await Promise.all([
      readVal(fb, path(STATS, 'live')),
      ...keys.map(async (day) => {
        const [n, peak] = await Promise.all([
          readVal(fb, path(STATS, 'days', day, 'n')), readVal(fb, path(STATS, 'days', day, 'peak')),
        ]);
        return { day, n: n | 0, peak: peak | 0 };
      }),
    ]);
    return { live: Math.max(0, live | 0), today: keys[0], days: rows };
  } catch { return null; }
}

/* ───────────────────────── 회원 · 접속 시간 · 게임 판 수 (2026-11-10 대표님 «신규 회원 가입 현황») ─────────────────────────
 *
 *   stats/members/{uid}          { nick, email, name, joined }   name = 구글 계정 이름 · joined = 구글 계정으로 처음 가입한 시각(Firebase 로그인 기록)
 *   stats/act/{YYYYMMDD}/{uid}   { nick, sec, first, last, v, s: { 접속ID: { a, b } }, g: { shoes, dragon, catch, catch3d, jump, piano } }
 *     v = 그날 접속 횟수(페이지를 열 때마다 1) · s = 접속마다 들어온 시각 a · 나간 시각 b(창을 닫거나 끊기면 서버가 찍는다)
 *   stats/members/{uid}/tot     { shoes, dragon, catch, catch3d, jump, piano } — 접속할 때마다 그 사람의 누적 판 수 사본
 *
 * sec = 그날 사이트를 켜 둔 시간(화면을 보고 있을 때만, 30초마다 +30). first · last = 그날 처음 · 마지막 신호 시각.
 * 쓰기는 본인 칸만, 읽기는 운영자만(규칙 `stats/.read`). 실패해도 게임에는 아무 영향이 없다.
 */
export const GAME_NAMES = { shoes: '신발을 찾아서', dragon: '드래곤 스트라이커', catch: '캐치볼', catch3d: '3D캐치볼', jump: '줄넘기 챔피언', piano: '점프 피아노' };
const BEAT_SEC = 30;
let beatTimer = 0, actDay = '', memberFor = '', sessDay = '';
const SID = (Date.now().toString(36) + Math.random().toString(36).slice(2, 5)).slice(0, 12);   // 이번 접속(페이지 열기) 하나
const sessPath = (fb, day) => path(STATS, 'act', day, fb.uid, 's', SID);
/** 누적 판 수 — 프로필에서 */
function totals() {
  const p = loadProfile() || {};
  return { shoes: p.totalPlays | 0, dragon: p.dragonPlays | 0, catch: p.catchPlays | 0, catch3d: p.catch3dPlays | 0, jump: p.jr?.plays | 0, piano: p.jp?.plays | 0 };
}
/** 그날 첫 접속이면 접속 횟수 +1 · 들어온 시각 · 끊기면 나간 시각을 서버가 찍게 예약 */
async function startSession(fb, day) {
  const { ref, update, onDisconnect, serverTimestamp, increment } = fb.dbMod;
  const now = Date.now();
  if (sessDay !== day) {
    await withTimeout(update(ref(fb.rtdb, actPath(fb, day)), { v: increment(1), [`s/${SID}/a`]: now, [`s/${SID}/b`]: now }), undefined, '접속 횟수');
    sessDay = day;
  }
  await onDisconnect(ref(fb.rtdb, path(sessPath(fb, day), 'b'))).set(serverTimestamp());
}
const nickNow = () => String(loadProfile()?.nickname || currentUser()?.nickname || '').slice(0, 24);
const actPath = (fb, day) => path(STATS, 'act', day, fb.uid);

async function touchDay(fb) {
  const day = dayKey();
  if (actDay === day) return day;
  const first = await readVal(fb, path(actPath(fb, day), 'first')).catch(() => null);
  if (!first) await withTimeout(fb.dbMod.set(fb.dbMod.ref(fb.rtdb, path(actPath(fb, day), 'first')), Date.now()), undefined, '첫 접속');
  actDay = day;
  try { await startSession(fb, day); } catch { /* */ }
  return day;
}

/** 붙을 때마다 부른다(presence) — 회원 칸을 적고, 30초 신호를 건다 */
export async function startActivity(fb) {
  fb = fb ?? await rt();
  if (!fb) return;
  const u = currentUser();
  if (memberFor !== fb.uid) {
    try {
      const cur = await readVal(fb, path(STATS, 'members', fb.uid)).catch(() => null);
      await withTimeout(fb.dbMod.update(fb.dbMod.ref(fb.rtdb, path(STATS, 'members', fb.uid)), {
        nick: nickNow(), email: String(u?.email || '').slice(0, 100), name: String(u?.name || '').slice(0, 60), joined: cur?.joined || u?.created || Date.now(), tot: totals(),
      }), undefined, '회원 기록');
      memberFor = fb.uid;
    } catch (e) { console.warn('[stats] 회원 기록 실패', e?.message || e); /* 규칙 게시 전 — 다음 접속에 다시 */ }
  }
  try { await touchDay(fb); await startSession(fb, actDay); } catch { /* */ }   // 다시 붙으면 «나간 시각» 예약을 다시 건다
  clearInterval(beatTimer);
  beatTimer = setInterval(() => { if (!document.hidden) beatOnce().catch(() => {}); }, BEAT_SEC * 1000);
}
async function beatOnce() {
  const fb = await rt();
  if (!fb) return;
  const day = await touchDay(fb);
  await withTimeout(fb.dbMod.update(fb.dbMod.ref(fb.rtdb, actPath(fb, day)), {
    sec: fb.dbMod.increment(BEAT_SEC), last: Date.now(), nick: nickNow(), [`s/${SID}/b`]: Date.now(),
  }), undefined, '접속 시간');
}

/** 게임 한 판 시작 — 그날 내 칸의 판 수 +1 */
export function countPlay(game) {
  if (!GAME_NAMES[game]) return;
  (async () => {
    const fb = await rt();
    if (!fb) return;
    const day = await touchDay(fb);
    await withTimeout(fb.dbMod.update(fb.dbMod.ref(fb.rtdb, actPath(fb, day)), {
      [`g/${game}`]: fb.dbMod.increment(1), last: Date.now(), nick: nickNow(), [`s/${SID}/b`]: Date.now(),
    }), undefined, '게임 판 수');
    /* 누적 사본도 갱신(판이 끝나야 프로필 숫자가 오르므로 1분 뒤 한 번 더) */
    setTimeout(() => { fb.dbMod.update(fb.dbMod.ref(fb.rtdb, path(STATS, 'members', fb.uid)), { tot: totals() }).catch(() => {}); }, 60000);
  })().catch(() => {});
}

/**
 * 운영자 «신규 회원 가입 현황» 읽기 — 회원 전체 + 최근 `days` 일 활동.
 * @returns {Promise<{members:Object, days:Array<{day:string, users:Object}>}|null>}
 */
export async function readMembers(days = 14) {
  const fb = await rt();
  if (!fb) return null;
  try {
    const keys = Array.from({ length: days }, (_, i) => dayKey(Date.now() - i * 86400000));
    const [members, ...acts] = await Promise.all([
      readVal(fb, path(STATS, 'members')),
      ...keys.map((day) => readVal(fb, path(STATS, 'act', day))),
    ]);
    return { members: members || {}, days: keys.map((day, i) => ({ day, users: acts[i] || {} })) };
  } catch { return null; }
}
