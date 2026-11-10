/**
 * 이안 드래곤 게임 — 전투 코어 정답 검사 (제작 명령서 B1 합격 기준).
 *
 *   npm run qa:idg-core
 *
 * 1. 게임 쪽 코어(`src/games/iandragon_game/core`)로 정답표(`tools/idg-golden.json`) 300판을 다시 돌려
 *    승패 · 걸린 틱 · 끝난 순간의 상태 해시가 계산기와 **모두** 같은지 본다.
 * 2. 코어 폴더에 금지된 것(난수 · 시계 · 삼각함수 · 화면)이 없는지 글자로 찾는다.
 * 3. 스테이지 데이터가 정답표를 만든 데이터와 같은지 (게임 쪽 스테이지 객체로 돌린다).
 *
 * 토큰 절약 : **틀린 줄만** 찍는다. 다 맞으면 한 줄 "300/300 OK".
 */

import fs from 'node:fs';
import path from 'node:path';
import { simulate, hashState } from '../src/games/iandragon_game/core/index.js';
import { D } from '../src/games/iandragon_game/data/battleData.js';
import { STAGE_BY_ID } from '../src/games/iandragon_game/data/stages/index.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const golden = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/idg-golden.json'), 'utf8'));
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

if (bad) { console.log(`${ok}/${golden.length} 일치 · 문제 ${bad}건`); process.exit(1); }
console.log(`${ok}/${golden.length} OK · 금지 글자 0`);
