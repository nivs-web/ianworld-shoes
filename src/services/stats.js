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
  const { ref, onDisconnect, set, runTransaction, increment } = fb.dbMod;
  const liveRef = ref(fb.rtdb, path(STATS, 'live'));
  try {
    /* 끊기면 −1 을 **먼저** 예약한다 — 순서가 반대면 +1 만 남는 틈이 생긴다 */
    await onDisconnect(liveRef).set(increment(-1));
    await withTimeout(set(liveRef, increment(1)), undefined, '동시접속');
    const day = dayKey();
    await countToday(fb, day);
    const liveNow = (await readVal(fb, path(STATS, 'live'))) | 0;
    if (liveNow > 0) {
      await runTransaction(ref(fb.rtdb, path(STATS, 'days', day, 'peak')),
        (p) => (liveNow > (p | 0) ? liveNow : undefined));    // undefined = 그대로 둔다
    }
  } catch { /* 규칙이 아직 게시 전이면 조용히 넘어간다 */ }
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
