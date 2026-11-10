/**
 * 좀비와 드래곤 — 알 부화장 계산 (B6 · 2026-11-11 야간 · 기획서 10.4)
 * 알 1개 = 젬 100 · 10개 = 젬 900 · 희귀 70% · 슈퍼 25% · 전설 5% · 50번 안에 전설 보장(천장) ·
 * 이미 있는 용 → 「+」 1 (최대 +10) · 새 용은 «지금 월드»의 시작 레벨로 온다(ECON.joinLv). 현금 없음.
 * 화면과 분리된 순수 계산 — tools/idg-hatch-qa.mjs 가 1만 번 돌려 확률을 검사한다.
 */
import { UNITS } from '../games/iandragon_game/data/units.js';
import { ECON } from '../games/iandragon_game/data/econ.js';

export const EGG = { one: 100, ten: 900 };
export const RATES = { rare: 0.7, super: 0.25, legend: 0.05 };
export const PITY = 50;
export const OPEN_AT = 15;   // 2-5 를 깨면 열린다
export const RAR_KO = { rare: '희귀', super: '슈퍼', legend: '전설' };
const POOL = Object.fromEntries(Object.keys(RATES).map((r) => [r, Object.keys(UNITS).filter((id) => UNITS[id].rar === r)]));

/** 한 번 뽑기. pity = 전설이 안 나온 연속 횟수 */
export function roll(pity, rnd = Math.random) {
  let rar;
  if (pity + 1 >= PITY) rar = 'legend';
  else { const r = rnd(); rar = r < RATES.legend ? 'legend' : r < RATES.legend + RATES.super ? 'super' : 'rare'; }
  const pool = POOL[rar];
  return { id: pool[Math.floor(rnd() * pool.length)], rar, pity: rar === 'legend' ? 0 : pity + 1 };
}

/** n 개 깨기 (1 또는 10). 젬이 모자라면 null. 돌려주는 part 를 saveIdg 에 그대로 넣는다 */
export function hatch(save, n, rnd = Math.random) {
  const cost = n === 10 ? EGG.ten : EGG.one * n;
  if ((save.gems || 0) < cost) return null;
  const world = Math.min(10, Math.floor((save.cleared || 0) / 10) + 1);
  const units = { ...(save.units || {}) };
  let pity = save.pity || 0;
  const results = [];
  for (let i = 0; i < n; i++) {
    const r = roll(pity, rnd); pity = r.pity;
    const had = units[r.id];
    if (had) { units[r.id] = [had[0], Math.min(10, (had[1] || 0) + 1)]; r.plus = units[r.id][1]; r.dup = true; }
    else units[r.id] = [ECON.joinLv[world - 1] || 1, 0];
    results.push(r);
  }
  return { results, part: { gems: save.gems - cost, pity, units } };
}
