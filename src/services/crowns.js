/**
 * 로비 딱지 — **내가 신발왕/승리왕 1·2·3위인가.** (2026-08-19 23차, 사용자 지정)
 *
 * *"만약 신발왕이면, 보유신발에 [신발왕] 딱지가 붙으면 좋겠어 (…) 딱지 붙이고 싶은
 *   사람은 경쟁하게끔 만들어"*
 *
 * ## 로비를 막지 않는다
 *
 * 이 값은 **없어도 화면이 성립한다**(딱지가 안 붙을 뿐이다). 그래서 로비는 기다리지
 * 않는다 — 지난번 값을 바로 그리고, 새 값이 오면 그 줄만 다시 그린다.
 * 조회 자체도 한가할 때(`requestIdleCallback`) 나간다: 로비를 그린 직후는 사용자가
 * 곧바로 `싱글게임` 을 누르는 순간이라 판 에셋과 회선을 다툰다(§9-0-43).
 *
 * ## 캐시를 로컬에 남긴다
 *
 * 딱지는 **자주 바뀌지 않는다**(1위가 하루에 몇 번씩 바뀌지 않는다). 로비에 들어올
 * 때마다 문서 6장을 읽을 이유가 없어서 10분간 재사용한다. 저장소에 남기므로
 * 앱을 껐다 켜도 첫 화면부터 딱지가 붙어 있다 — 있다가 없어지는 것보다 낫다.
 */

import { loadCrowns, saveCrowns } from './storageLocal.js';

const TTL_MS = 10 * 60 * 1000;

/** 메모리 캐시 — 같은 세션에서 로비를 드나들 때 저장소를 다시 읽지 않는다 */
let mem = null;
let inflight = null;

/** @returns {{shoes:number, wins:number, at:number}|null} */
export function cached() {
  if (mem) return mem;
  const v = loadCrowns();
  if (v && typeof v.shoes === 'number' && typeof v.wins === 'number') mem = v;
  return mem;
}

const fresh = (v) => !!v && Date.now() - (v.at ?? 0) < TTL_MS;

/**
 * 필요하면 새로 받아 온다.
 * @param {(v:{shoes:number,wins:number})=>void} [onChange] 값이 **달라졌을 때만** 부른다
 *   (같은 값으로 화면을 다시 그리면 캐릭터 그림이 깜빡인다 — §9-0-45 ④)
 */
export function refresh(onChange) {
  const now = cached();
  if (fresh(now)) return Promise.resolve(now);
  if (inflight) return inflight;

  inflight = (async () => {
    // 순위표 코드(=Firestore)는 로비를 그리는 데 한 줄도 안 쓴다 — 동적으로 부른다
    const { fetchMyCrowns } = await import('./leaderboard.js');
    const v = await fetchMyCrowns();
    inflight = null;
    if (!v) return now;
    const next = { ...v, at: Date.now() };
    const changed = !now || now.shoes !== v.shoes || now.wins !== v.wins;
    mem = next;
    saveCrowns(next);
    if (changed) onChange?.(v);
    return next;
  })().catch(() => { inflight = null; return now; });

  return inflight;
}

/**
 * 계정이 바뀌면 저장소는 `resetAll` 이 통째로 비운다(`storageLocal.KEY.crowns`).
 * 하지만 **메모리 캐시는 그 청소를 모른다** — 로그아웃 없이 계정이 갈리는 경로에서
 * 남의 왕관이 한 번 더 그려진다. 그래서 여기서도 지울 길을 둔다.
 */
export function clear() {
  mem = null;
  saveCrowns(null);
}
