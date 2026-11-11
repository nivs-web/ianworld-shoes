/**
 * 초강력 브레스 (2026-11-11 대표님 «냥코는 오른쪽 단추가 거의 초강력인데 우린 너무 약해 · 필살기 사거리가 보였으면»)
 *
 * 전투 코어 · 계산기 정답표(tools/idg-golden.json)는 그대로 두고, 게임이 코어에 넘기는 리더 숫자만 키운다 :
 *  위력 ×SUPER.dmg · 사거리 ×SUPER.range · 밀어내기 최소 SUPER.kb · 충전 시간 ×SUPER.charge (아껴 쓰는 맛)
 * 같은 식을 판 준비 검사(tools/idg-play-qa.mjs --super)도 써서 너무 쉬워지지 않는지 본다.
 * breathStats = 파워 업 · 둥지 화면에 보이는 «브레스 사거리 · 위력 · 밀어내기 · 충전» 숫자.
 */
import { LEADERS } from '../data/leaders.js';
import { powerMul } from '../core/rules.js';
import { stageByNo, LAST_STAGE } from './battleSetup.js';

export const SUPER = { dmg: 2.5, range: 1.25, kb: 2, charge: 1.4 };

export function superLeader(L) {
  return { ...L, dmg: L.dmg * SUPER.dmg, range: Math.round(L.range * SUPER.range), kb: L.freeze ? L.kb : Math.max(SUPER.kb, (L.kb || 0) * 2), charge: Math.round(L.charge * SUPER.charge) };
}
/** 데이터 묶음(D)의 리더만 초강력으로 바꾼 사본 */
export const superData = (D) => ({ ...D, leaders: Object.fromEntries(Object.entries(D.leaders).map(([k, L]) => [k, superLeader(L)])) });

/** 화면에 보일 브레스 숫자 (리더 레벨 = 다음 판의 경험 레벨) */
export function breathStats(id, save = {}) {
  const L = superLeader(LEADERS[id] || LEADERS.novart), lv = Math.max(1, stageByNo(Math.min(LAST_STAGE, (save.cleared || 0) + 1)).expLevel || 1);
  return { range: L.range, power: Math.round(L.dmg * powerMul(lv)), push: L.kb || 0, charge: L.charge, lv };
}
