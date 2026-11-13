/**
 * 좀비와 드래곤 — 도전 과제 (B6 · 2026-11-11 야간 · 기획서 10.7 «30개쯤 · 젬 10~50 · 가벼운 것만»)
 * 월드 1~10 에 맞는 27개 (1차 22 + 2차 5). 진행도는 저장의 stat(쌓인 기록) · 별 · 깬 판 · 용에서 계산하고,
 * 받은 과제는 quests 비트 문자열(i 번째 = '1')로 기억한다. 순서를 바꾸면 비트가 어긋나니 뒤에만 붙인다.
 */
import { UNITS } from '../games/iandragon_game/data/units.js';

const starsOf = (g) => [...(g.stars || '')].reduce((a, c) => a + (Number(c) || 0), 0);
const threeOf = (g) => [...(g.stars || '')].filter((c) => c === '3').length;
const owned = (g) => Object.keys(g.units || {}).length;
const hasLegend = (g) => Object.keys(g.units || {}).some((id) => UNITS[id]?.rar === 'legend') ? 1 : 0;
const maxLv = (g) => Math.max(1, ...Object.values(g.units || {}).map((u) => u[0] || 1));

/** [이름, 진행도(g), 목표, 젬] — 이 순서가 비트 번호 */
export const QUESTS = [
  ['첫 승리!', (g) => g.stat.wins, 1, 10],
  ['좀비 100마리 쓰러뜨리기', (g) => g.stat.kills, 100, 10],
  ['좀비 500마리', (g) => g.stat.kills, 500, 20],
  ['좀비 1,000마리', (g) => g.stat.kills, 1000, 30],
  ['좀비 3,000마리', (g) => g.stat.kills, 3000, 50],
  ['브레스 10번', (g) => g.stat.breath, 10, 10],
  ['브레스 50번', (g) => g.stat.breath, 50, 20],
  ['화로 Lv5 만들기', (g) => g.stat.maxWl, 5, 10],
  ['화로 Lv8 만들기', (g) => g.stat.maxWl, 8, 30],
  ['별 10개', starsOf, 10, 10],
  ['별 50개', starsOf, 50, 20],
  ['별 100개', starsOf, 100, 30],
  ['별 150개', starsOf, 150, 50],
  ['월드 1 깨기', (g) => g.cleared, 10, 20],
  ['월드 3 깨기', (g) => g.cleared, 30, 30],
  ['월드 5 깨기', (g) => g.cleared, 50, 50],
  ['보스 3마리 쓰러뜨리기', (g) => g.stat.boss, 3, 20],
  ['★★★ 스테이지 10개', threeOf, 10, 20],
  ['드래곤 10마리 모으기', owned, 10, 20],
  ['처음으로 알 깨기', (g) => g.stat.hatch, 1, 10],
  ['전설 드래곤 만나기', hasLegend, 1, 50],
  ['드래곤 하나를 Lv10 (진화!)', maxLv, 10, 20],
  /* 2차 (월드 6~10 · 2026-11-11) — 비트 순서 때문에 뒤에만 붙인다 */
  ['월드 7 깨기', (g) => g.cleared, 70, 30],
  ['월드 10 깨기 — 엔딩!', (g) => g.cleared, 100, 50],
  ['보스 10마리 쓰러뜨리기', (g) => g.stat.boss, 10, 30],
  ['별 300개 모두 모으기', starsOf, 300, 50],
  ['드래곤 하나를 Lv20 (마지막 진화!)', maxLv, 20, 30],
].map(([name, prog, need, gems], i) => ({ i, name, prog, need, gems }));

export const questState = (g, q) => ({ now: Math.min(q.need, q.prog(g) || 0), done: (q.prog(g) || 0) >= q.need, got: (g.quests || '')[q.i] === '1' });
/** 받을 수 있는 과제 수 (로비 빨간 점) */
export const claimable = (g) => QUESTS.filter((q) => { const s = questState(g, q); return s.done && !s.got; }).length;
/** 받기 → saveIdg 에 넣을 part (못 받으면 null) */
export function claim(g, i) {
  const q = QUESTS[i], s = questState(g, q);
  if (!s.done || s.got) return null;
  const bits = (g.quests || '').padEnd(QUESTS.length, '0').split(''); bits[i] = '1';
  return { gems: (g.gems || 0) + q.gems, quests: bits.join('') };
}
