/**
 * 판 준비 검사 (겜부장 · 2026-11-11 야간) — 실제 게임과 같은 덱 · 레벨 · 스킬(render/battleSetup.js)로
 * 1-1 ~ 5-10 을 기준 AI 가 처음부터 차례로 깨는지 본다.  node tools/idg-play-qa.mjs [판 수=50] [씨앗 수=5]
 * 정책 = 계산기 tune.js 처럼 화로 목표 1 · 3 · 5 중 가장 잘 깬 것 + 스킬 · 포효 사용.
 */
import { simulate } from '../src/games/iandragon_game/core/index.js';
import { D } from '../src/games/iandragon_game/data/battleData.js';
import { makeLoads, stageByNo, starsFor } from '../src/games/iandragon_game/render/battleSetup.js';

const N = Number(process.argv[2] || 50), SEEDS = Number(process.argv[3] || 5);
/* 계산기 tune.js 와 같게 : 화로 목표 1 · 3 · 5 중 가장 잘 깬 것 (잘하는 플레이어 기준) */
const POLS = [1, 3, 5].map((walletTarget) => ({ walletTarget, useSkills: true, useRage: true }));
let bad = 0;
const save = { units: {} };
for (let g = 1; g <= N; g++) {
  const st = stageByNo(g);
  const { loads, deck, skills } = makeLoads(st, save);
  let win = 0, tSum = 0, stars = 0;
  for (const POL of POLS) {
    let w = 0, t = 0, sr = 0;
    for (let s = 1; s <= SEEDS; s++) { const r = simulate(st, loads, D, [POL], 1000 + g * 7 + s); if (r.win) { w++; t += r.time; sr += starsFor(st, r.time); } }
    if (w > win || (w === win && t < tSum)) { win = w; tSum = t; stars = sr; }
  }
  const ok = win >= Math.ceil(SEEDS * 0.6);
  if (!ok) bad++;
  console.log(`${ok ? '✔' : '✘'} ${st.id.padEnd(5)} ${st.name.slice(0, 14).padEnd(14)} 이김 ${win}/${SEEDS} · 평균 ${win ? (tSum / win).toFixed(0) : '-'}초 · 별 ${win ? (stars / win).toFixed(1) : '-'} · 덱 ${deck.map((d) => d.id + d.lv).join(',')}${skills.length ? ' · 스킬 ' + skills.join(',') : ''}`);
}
console.log(bad ? `✘ ${bad}판이 잘 안 깨짐` : '✔ 전부 깸');
process.exit(bad ? 1 : 0);
