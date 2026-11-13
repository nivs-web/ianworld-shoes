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
 * 5. 드래곤캐슬 키우기 30 · «?» 드래곤 10 (`tools/idg-golden-castle.json`) + upgradeLoad ↔ 계산기 castle.js 대조.
 * 6. 판 준비(makeLoads · 대결 편성 · 같이 깨기 편성 글자 500자 · 왕복).
 *
 * 토큰 절약 : **틀린 줄만** 찍는다. 다 맞으면 한 줄 "300/300 OK".
 */

import fs from 'node:fs';
import path from 'node:path';
import { simulate, hashState } from '../src/games/iandragon_game/core/index.js';
import { D } from '../src/games/iandragon_game/data/battleData.js';
import { STAGE_BY_ID } from '../src/games/iandragon_game/data/stages/index.js';
import { loadDiffStages } from '../src/games/iandragon_game/data/stages/diffLoad.js';
import { superData } from '../src/games/iandragon_game/render/breathInfo.js';
import { upgradeLoad } from '../src/games/iandragon_game/data/upgrades.js';
import { makeLoads, stageByNo, loadToLd, ldToLoad, pvpLoad } from '../src/games/iandragon_game/render/battleSetup.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const golden = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/idg-golden.json'), 'utf8'));
const goldenDiff = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/idg-golden-diff.json'), 'utf8'));
const goldenCastle = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/idg-golden-castle.json'), 'utf8'));
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

/* 5. 드래곤캐슬 키우기 30 · «?» 드래곤 10 (2026-11-13 ⑤) — 키우기 판(sup)은 게임이 쓰는 초강력 브레스 D(superData) 로.
 *    키우기 판 중 꾸미기 없는 줄은 계산기 castle.js 가 만든 u 를 게임 upgradeLoad(save) 와 숫자로 대조한다(두 표가 같은지) */
let okC = 0, okU = 0;
const DSUP = superData(D), near = (a, b) => Math.abs(a - b) < 1e-9;
const sameU = (u, g) => {
  for (const k of ['leadLv', 'castleLv', 'atk', 'hp', 'baseHp', 'guardDmg', 'breathDmg', 'breathCharge', 'breathRange', 'bossCap', 'baseArmor', 'thorns', 'baseRegen', 'bounty']) if (!near(u[k], g[k])) return k;
  if (JSON.stringify(u.guard) !== JSON.stringify(g.guard) || JSON.stringify(u.cannon) !== JSON.stringify(g.cannon) || JSON.stringify(u.bell) !== JSON.stringify(g.bell) || JSON.stringify(u.gear) !== JSON.stringify(g.gear)) return 'guard/cannon/bell/gear';
  return null;
};
for (const g of goldenCastle) {
  const st = g.diff ? DS[g.diff]?.find((s) => s.id === g.id) : STAGE_BY_ID[g.id];
  if (!st) { bad++; console.log(`✘ 키우기/«?» ${g.diff || ''} ${g.id} : 게임 쪽 판 없음`); continue; }
  for (const l of [].concat(g.load)) for (const d of l.deck) if (!D.units[d.id]) { bad++; console.log(`✘ ${g.id} : 드래곤 ${d.id} 없음`); }
  if (g.u) { const w = sameU(g.u, upgradeLoad(g.save, { diff: 'master', mode: 'stage', leader: g.leader })); if (w) { bad++; console.log(`✘ upgradeLoad ${g.id} 모양 ${g.prof} : ${w} 가 계산기 castle.js 와 다름`); } else okU++; }
  let hash = 0;
  const out = simulate(st, g.load, g.sup ? DSUP : D, g.policy, g.seed, (S) => { if (S.over) hash = hashState(S); });
  const ticks = Math.round(out.time * 30);
  if (out.win !== g.win || ticks !== g.ticks || hash !== g.hash) { bad++; console.log(`✘ ${g.kind} ${g.id} 씨앗 ${g.seed} : 승 ${out.win}/${g.win} · 틱 ${ticks}/${g.ticks} · 해시 ${hash}/${g.hash}`); } else okC++;
}

/* 6. 판 준비 : 새 계정 = 수호 불꽃 기본 · 사거리 60% · 보스 상한 / 대결 · 습격 = 같은 조건 / 같이 깨기 편성 글자 500자 · 왕복 */
{
  const fail = (m) => { bad++; console.log('✘ 판 준비 : ' + m); };
  const L0 = makeLoads(stageByNo(1), {}).loads[0];
  if (!L0.guard || L0.guard.dmg !== 45 || L0.bonus.breathRange !== 0.6 || L0.bonus.bossCap !== 0.6 || L0.cannon || L0.bell) fail('새 계정 편성이 기획과 다름');
  const P = pvpLoad(L0, 1);
  if (!P.guard || P.guard.slow || P.cannon || P.bell || Object.keys(P.bonus).length) fail('대결 · 습격 편성에 키우기가 섞임');
  const save = { cleared: 100, owned: ['hat:crown', 'breath:ice', 'flag:skull'], look: 'h1.b5.f3', lead: { own: ['novart', 'aquantis', 'volttail'], lv: { volttail: 10 } }, leader: 'volttail',
    castle: { lv: 10, skin: 10, gear: { cannon: 5, fence: 5, bell: 5, repair: 5 }, slots: ['cannon', 'fence', 'bell'] }, breathUp: { pow: 8, rng: 5, old: 8 }, units: {} };
  const LM = makeLoads(stageByNo(100), save).loads[0], str = loadToLd(LM, save.look), back = ldToLoad(str);
  if (LM.leader !== 'volttail' || !LM.cannon || !LM.bell || LM.bell.at.length !== 2 || LM.bonus.breathRange !== 1) fail('끝까지 키운 편성이 기획과 다름');
  if (str.length > 500) fail(`같이 깨기 편성 글자 ${str.length}자 > 500`);
  const keys = ['guardDmg', 'baseArmor', 'thorns', 'baseRegen', 'breathRange', 'bossCap', 'atk', 'hp', 'baseHp', 'breathDmg'];
  if (!back || JSON.stringify(back.cannon) !== JSON.stringify(LM.cannon) || JSON.stringify(back.bell) !== JSON.stringify(LM.bell) || JSON.stringify(back.guard) !== JSON.stringify(LM.guard)
    || keys.some((k) => Math.abs((back.bonus[k] ?? 1) - LM.bonus[k]) > 0.001)) fail('같이 깨기 편성 글자 왕복이 어긋남');
  else console.log(`판 준비 OK · 같이 깨기 편성 글자 ${str.length}자`);
}

if (bad) { console.log(`보통 ${ok}/${golden.length} · 어려움/초고수 ${okD}/${goldenDiff.length} · 키우기/«?» ${okC}/${goldenCastle.length} 일치 · 문제 ${bad}건`); process.exit(1); }
console.log(`${ok}/${golden.length} OK · 어려움/초고수 ${okD}/${goldenDiff.length} OK · 키우기/«?» ${okC}/${goldenCastle.length} OK (upgradeLoad 대조 ${okU}) · 금지 글자 0`);
