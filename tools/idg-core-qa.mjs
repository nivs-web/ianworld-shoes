/**
 * 이안 드래곤 게임 — 전투 코어 정답 검사 (제작 명령서 B1 합격 기준).
 *
 *   npm run qa:idg-core
 *
 * 1. 게임 쪽 코어(`src/games/iandragon_game/core`)로 정답표(`tools/idg-golden.json`) 300판을 다시 돌려
 *    승패 · 걸린 틱 · 끝난 순간의 상태 해시가 계산기와 **모두** 같은지 본다.
 * 2. 코어 폴더에 금지된 것(난수 · 시계 · 삼각함수 · 화면)이 없는지 글자로 찾는다.
 * 3. 스테이지 데이터가 정답표를 만든 데이터와 같은지 (게임 쪽 스테이지 객체로 돌린다).
 * 4. 어려움 · 초고수 정답(`tools/idg-golden-diff.json` 60판)을 `loadDiffStages()` 로 불러온 판으로 다시 돌린다 (난이도 기획 2026-11-13).
 *
 * 토큰 절약 : **틀린 줄만** 찍는다. 다 맞으면 한 줄 "300/300 OK".
 */

import fs from 'node:fs';
import path from 'node:path';
import { simulate, hashState } from '../src/games/iandragon_game/core/index.js';
import { D } from '../src/games/iandragon_game/data/battleData.js';
import { STAGE_BY_ID } from '../src/games/iandragon_game/data/stages/index.js';
import { loadDiffStages } from '../src/games/iandragon_game/data/stages/diffLoad.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const golden = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/idg-golden.json'), 'utf8'));
const goldenDiff = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/idg-golden-diff.json'), 'utf8'));
let bad = 0;

/* 2. 금지 글자 — 주석을 걷어 낸 뒤 본다 */
const CORE = path.join(ROOT, 'src/games/iandragon_game/core');
const BANNED = [/Math\.random/, /Date\.now/, /new Date/, /performance\./, /Math\.(sin|cos|tan|pow|exp|log|sqrt|atan2?)\b/, /\bwindow\b/, /\bdocument\b/, /pixi/i, /requestAnimationFrame/, /setTimeout|setInterval/];
for (const f of fs.readdirSync(CORE)) {
  const src = fs.readFileSync(path.join(CORE, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '').replace(/'[^'\n]*'/g, "''");
  for (const re of BANNED) if (re.test(src)) { bad++; console.log(`✘ 금지 ${re} : core/${f}`); }
}

/* 1 · 3. 300판 */
let ok = 0;
for (const g of golden) {
  const st = STAGE_BY_ID[g.id];
  if (!st) { bad++; console.log(`✘ ${g.id} : 게임 쪽 스테이지 없음`); continue; }
  let hash = 0;
  const out = simulate(st, g.load, D, g.policy, g.seed, (S) => { if (S.over) hash = hashState(S); });
  const ticks = Math.round(out.time * 30);
  if (out.win !== g.win || ticks !== g.ticks || hash !== g.hash) {
    bad++;
    console.log(`✘ ${g.id} 씨앗 ${g.seed} : 승 ${out.win}/${g.win} · 틱 ${ticks}/${g.ticks} · 해시 ${hash}/${g.hash}`);
  } else ok++;
}

/* 4. 어려움 · 초고수 60판 — 게임이 실제로 쓰는 loadDiffStages(d)[g - 1] 로 */
let okD = 0;
const DS = { hard: await loadDiffStages('hard'), master: await loadDiffStages('master') };
for (const d of ['hard', 'master']) if (DS[d]?.length !== 100 || DS[d].some((s, i) => s.g !== i + 1 || s.diff !== d)) { bad++; console.log(`✘ ${d} : 판 100개 · g 순서 · diff 가 아니다`); }
for (const g of goldenDiff) {
  const st = DS[g.diff]?.find((s) => s.id === g.id);
  if (!st || DS[g.diff][st.g - 1] !== st) { bad++; console.log(`✘ ${g.diff} ${g.id} : 게임 쪽 판 없음`); continue; }
  for (const ln of st.lines) if (!D.enemies[ln.id]) { bad++; console.log(`✘ ${g.diff} ${g.id} : 좀비 ${ln.id} 없음`); }
  let hash = 0;
  const out = simulate(st, g.load, D, g.policy, g.seed, (S) => { if (S.over) hash = hashState(S); });
  const ticks = Math.round(out.time * 30);
  if (out.win !== g.win || ticks !== g.ticks || hash !== g.hash) {
    bad++;
    console.log(`✘ ${g.diff} ${g.id} 씨앗 ${g.seed} : 승 ${out.win}/${g.win} · 틱 ${ticks}/${g.ticks} · 해시 ${hash}/${g.hash}`);
  } else okD++;
}

if (bad) { console.log(`보통 ${ok}/${golden.length} · 어려움/초고수 ${okD}/${goldenDiff.length} 일치 · 문제 ${bad}건`); process.exit(1); }
console.log(`${ok}/${golden.length} OK · 어려움/초고수 ${okD}/${goldenDiff.length} OK · 금지 글자 0`);
