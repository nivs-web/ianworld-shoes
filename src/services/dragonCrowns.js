/**
 * 드래곤 스트라이커 로비 딱지 — **내가 점수왕/금화왕/승리왕 1·2·3위인가.**
 *
 * 신발게임의 `crowns.js` 와 같은 규칙을 따른다:
 *   · 이 값은 **없어도 화면이 성립한다**(딱지가 안 붙을 뿐). 로비는 기다리지 않는다.
 *   · 조회는 한가할 때 나간다 — 로비를 그린 직후는 사용자가 곧바로 [싱글게임] 을
 *     누르는 순간이라 게임 코드와 회선을 다툰다.
 *   · 10분간 재사용한다. 1위가 하루에 몇 번씩 바뀌지 않는다.
 *
 * 신발 것과 파일을 나눈 이유: 읽는 필드가 다르고(3개 vs 2개), 드래곤 로비에
 * 들어가지 않는 사람에게 드래곤 문서 세 장을 읽힐 이유가 없다.
 */

import { fetchDragonCrowns } from './leaderboard.js';

const TTL_MS = 10 * 60 * 1000;
const KEY = 'sf_dragonCrowns';

let mem = null;
let inflight = null;

function load() {
  try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; }
}
function save(v) {
  try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* 막힌 환경 */ }
}

/** @returns {{score:number, coins:number, wins:number, at:number}|null} */
export function cached() {
  if (mem) return mem;
  const v = load();
  if (v && typeof v.score === 'number') mem = v;
  return mem;
}

const fresh = (v) => !!v && Date.now() - (v.at ?? 0) < TTL_MS;
const same = (a, b) => !!a && !!b && a.score === b.score && a.coins === b.coins && a.wins === b.wins;

/**
 * 필요하면 새로 받아 온다.
 * @param {(v:object)=>void} [onChange] 값이 **달라졌을 때만** 부른다 —
 *   같은 값으로 화면을 다시 그리면 드래곤 그림이 깜빡인다.
 */
export function refresh(onChange) {
  const now = cached();
  if (fresh(now)) return () => {};
  if (inflight) return () => {};

  let live = true;
  const go = () => {
    inflight = fetchDragonCrowns()
      .then((v) => {
        if (!v) return;
        const next = { ...v, at: Date.now() };
        const changed = !same(mem, next);
        mem = next;
        save(next);
        if (live && changed) onChange?.(next);
      })
      .catch(() => { /* 딱지가 없을 뿐이다 */ })
      .finally(() => { inflight = null; });
  };
  if (typeof requestIdleCallback === 'function') requestIdleCallback(go, { timeout: 4000 });
  else setTimeout(go, 1500);

  return () => { live = false; };
}

export function clear() {
  mem = null;
  try { localStorage.removeItem(KEY); } catch { /* 막힌 환경 */ }
}
