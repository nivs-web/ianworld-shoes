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
