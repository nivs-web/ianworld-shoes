/**
 * 이안 드래곤 게임 — 계산기(기획) → 게임 옮기기. (겜부장 · 제작 명령서 B1)
 *
 *   node tools/idg-import-data.mjs            (계산기 위치 기본값 : ../../iandragon/docs/sim · 바꾸려면 IDG_SIM=경로)
 *
 * 만드는 것 (전부 "생성 파일" — 손으로 고치지 않는다. 고칠 일이 있으면 계산기를 고치고 다시 돌린다) :
 *  1. src/games/iandragon_game/core/{rules,battle,step,ai,index}.js
 *       계산기 `engine.js` 의 줄을 **한 글자도 바꾸지 않고** 잘라 붙인다 (require/exports 만 ESM 으로).
 *       잘라 붙인 뒤 원본의 모든 줄이 빠짐없이 들어갔는지 스스로 대조한다.
 *  2. src/games/iandragon_game/data/{units,enemies,leaders,skills,wallet,econ}.js · data/stages/w01~w10.js · data/stages/index.js
 *     + data/stages/hard.js · master.js (어려움 · 초고수 100판씩) · data/stages/diffLoad.js (그 둘을 따로 묶음으로 불러옴)
 *  3. src/games/iandragon_game/data/artManifest.js — 1차(월드 1~5)에 필요한 그림 프레임 이름 (팀 계획서 2.1)
 *  4. tools/idg-golden.json · tools/idg-golden-diff.json · tools/idg-golden-castle.json — 계산기 golden.js 가 뽑은 정답표 (보통 300 · 어려움/초고수 60 · 키우기 30 + «?» 10, `npm run qa:idg-core` 가 대조)
 */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const SIM = path.resolve(ROOT, process.env.IDG_SIM || '../../iandragon/docs/sim');
const GAME = path.join(ROOT, 'src/games/iandragon_game');
const require = createRequire(path.join(SIM, 'x.js'));
const FIRST_WORLDS = 5;                       // 1차 = 월드 1~5 (대표님 결정 2026-11-10)

const HEAD = (what) => `/* 생성 파일 — tools/idg-import-data.mjs 가 계산기(${what})에서 만든다. 손으로 고치지 말 것. */\n`;
const write = (rel, text) => {
  const p = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, text.replace(/\r\n/g, '\n'));
  return rel;
};
const fail = (m) => { console.error('✘ ' + m); process.exit(1); };

// ── 1. 전투 코어 : engine.js 줄 그대로 ─────────────────────────────────────
const engSrc = fs.readFileSync(path.join(SIM, 'engine.js'), 'utf8').replace(/\r\n/g, '\n');
const E = engSrc.split('\n');
const at = (re, from = 0) => { const i = E.findIndex((l, k) => k >= from && re.test(l)); if (i < 0) fail('engine.js 에서 못 찾음 : ' + re); return i; };
const iTick = at(/^const TICK = /), iStageDoc = at(/^\/\* stage  =/), iTarget = at(/^const targetable = /);
const iKnock = at(/^function knock\(/), iCount = at(/^function countSide\(/), iHitDoc = at(/^\/\/ 피해 한 번/);
const iDist = at(/^const distFromBase = /), iCmdDoc = at(/^\/\/ 플레이어 명령/), iStep = at(/^function step\(/);
const iAiDoc = at(/^\/\* ── 시험용 플레이어/), iExp = at(/^module\.exports/);
const take = (a, b) => E.slice(a, b);

const parts = {
  rules: [...take(iTick, iStageDoc), ...take(iTarget, iCount + 1), '', E[iDist]],
  battle: [...take(iStageDoc, iTarget), '', ...take(iHitDoc, iDist), '', ...take(iCmdDoc, iStep)],
  step: take(iStep, iAiDoc),
  ai: take(iAiDoc, iExp),
};
/* 빠짐 · 겹침 대조 : 원본의 TICK ~ exports 사이 모든 줄이 정확히 한 번씩 */
const want = take(iTick, iExp).filter((l) => l.trim());
const got = Object.values(parts).flat().filter((l) => l.trim());
if (want.length !== got.length || want.some((l) => !got.includes(l))) fail(`코어 줄 대조 실패 (원본 ${want.length} / 옮김 ${got.length})`);
if (iKnock !== iTarget + 1 || iCount !== iTarget + 2) fail('targetable · knock · countSide 가 붙어 있지 않다 — 자르는 자리 확인');

const RULES = ['TICK', 'K', 'mulberry32', 'levelMul', 'formOf', 'formMul', 'powerMul', 'resolveDef', 'hasTrait', 'ZERO_BONUS', 'targetable', 'knock', 'countSide', 'distFromBase'];
const coreHead = (role) => HEAD('engine.js') + `/* 이안 드래곤 전투 코어 — ${role}. 화면 · 소리 · 시계 · Pixi 를 모른다 (기획서 15.3). */\n`;
const files = [];
files.push(write('src/games/iandragon_game/core/rules.js', coreHead('상수 · 난수 · 레벨 배율 · 작은 도우미') + parts.rules.join('\n') + `\n\nexport { ${RULES.join(', ')} };\n`));
files.push(write('src/games/iandragon_game/core/battle.js', coreHead('판 만들기 · 유닛 · 피해 · 명령') + `import { ${RULES.join(', ')} } from './rules.js';\n\n` + parts.battle.join('\n') + '\n\nexport { createBattle, makeUnit, applyHit, applyCommand };\n'));
files.push(write('src/games/iandragon_game/core/step.js', coreHead('한 틱 (1/30초)') + `import { ${RULES.join(', ')} } from './rules.js';\nimport { makeUnit, applyHit, applyCommand } from './battle.js';\n\n` + parts.step.join('\n') + '\n\nexport { step };\n'));
files.push(write('src/games/iandragon_game/core/ai.js', coreHead('기준 AI(자동 전투) · 한 판 돌리기 · 상태 해시') + `import { ${RULES.join(', ')} } from './rules.js';\nimport { createBattle } from './battle.js';\nimport { step } from './step.js';\n\n` + parts.ai.join('\n') + '\n\nexport { aiCommands, simulate, hashState };\n'));
files.push(write('src/games/iandragon_game/core/index.js', HEAD('engine.js') + `export { ${RULES.join(', ')} } from './rules.js';\nexport { createBattle, makeUnit, applyHit, applyCommand } from './battle.js';\nexport { step } from './step.js';\nexport { aiCommands, simulate, hashState } from './ai.js';\n`));
for (const f of files.slice(0, 4)) {
  const n = fs.readFileSync(path.join(ROOT, f), 'utf8').split('\n').length;
  if (n > 300) fail(`${f} 가 ${n}줄 — 300줄 규칙`);
}

// ── 2. 데이터 ─────────────────────────────────────────────────────────────
const D = require('./data.js');
const noFn = (o, where) => JSON.stringify(o, (k, v) => { if (typeof v === 'function') fail(`${where}.${k} 가 함수 — JSON 으로 못 옮김`); return v; });
const objLines = (o) => '{\n' + Object.entries(o).map(([k, v]) => `  ${JSON.stringify(k)}: ${noFn(v, k)},`).join('\n') + '\n}';
files.push(write('src/games/iandragon_game/data/units.js', HEAD('data.js') + `export const UNITS = ${objLines(D.units)};\n`));
/* 굳센 좀비(firmOf 가 있는 것 · 초고수 전용)는 ENEMIES 와 따로 둔다 → 도감 · 주간 습격 뽑기 등 ENEMIES 목록을 쓰는 곳은 그대로. 전투 D 에만 합친다 */
const enemiesOf = (firm) => Object.fromEntries(Object.entries(D.enemies).filter(([, e]) => !!e.firmOf === firm));
files.push(write('src/games/iandragon_game/data/enemies.js', HEAD('data.js') + `export const ENEMIES = ${objLines(enemiesOf(false))};\n` +
  `/** 굳센 좀비 — 초고수 판에만 나온다(원본 + kbImmune · 그림 · 이름은 firmOf 원본). 도감 · 습격에는 쓰지 않는다 */\nexport const ENEMIES_FIRM = ${objLines(enemiesOf(true))};\n`));
files.push(write('src/games/iandragon_game/data/leaders.js', HEAD('data.js') + `export const LEADERS = ${objLines(D.leaders)};\n`));
files.push(write('src/games/iandragon_game/data/skills.js', HEAD('data.js') + `export const SKILLS = ${objLines(D.skills)};\n`));
files.push(write('src/games/iandragon_game/data/wallet.js', HEAD('data.js') + `export const WALLET = ${noFn(D.wallet, 'wallet')};\nexport const START_MONEY = ${D.startMoney};\nexport const PLAYER_BASE_HP = ${D.playerBaseHp};\n`));
files.push(write('src/games/iandragon_game/data/battleData.js', HEAD('data.js') +
  `import { UNITS } from './units.js';\nimport { ENEMIES, ENEMIES_FIRM } from './enemies.js';\nimport { LEADERS } from './leaders.js';\nimport { SKILLS } from './skills.js';\nimport { WALLET, START_MONEY, PLAYER_BASE_HP } from './wallet.js';\n\n` +
  `/** 전투 코어에 넣는 D (계산기 data.js 와 같은 모양) */\nexport const D = { units: UNITS, enemies: { ...ENEMIES, ...ENEMIES_FIRM }, wallet: WALLET, leaders: LEADERS, skills: SKILLS, startMoney: START_MONEY, playerBaseHp: PLAYER_BASE_HP };\n`));

/* 경제표 : gen-docs.js 의 ECON 블록을 글자 그대로 (함수가 섞여 있다) */
const gd = fs.readFileSync(path.join(SIM, 'gen-docs.js'), 'utf8').replace(/\r\n/g, '\n');
const em = gd.match(/^const ECON = \{\n[\s\S]*?\n\};$/m);
if (!em) fail('gen-docs.js 에서 ECON 블록을 못 찾음');
files.push(write('src/games/iandragon_game/data/econ.js', HEAD('gen-docs.js ECON') + '/* 성장 · 경제 (기획 확정값, 기획서 10장) */\n' + em[0].replace(/^const ECON/, 'export const ECON') + '\n'));

const stages = require('./stages.generated.json');
const worlds = [...new Set(stages.map((s) => s.w))].sort((a, b) => a - b);
for (const w of worlds) {
  const list = stages.filter((s) => s.w === w);
  files.push(write(`src/games/iandragon_game/data/stages/w${String(w).padStart(2, '0')}.js`, HEAD('stages.generated.json') + `export default [\n${list.map((s) => '  ' + JSON.stringify(s) + ',').join('\n')}\n];\n`));
}
files.push(write('src/games/iandragon_game/data/stages/index.js', HEAD('stages.generated.json') +
  worlds.map((w) => `import w${String(w).padStart(2, '0')} from './w${String(w).padStart(2, '0')}.js';`).join('\n') +
  `\n\n/** 스테이지 전부 (순번 g 순서) — 객체는 전투 코어 createBattle/simulate 에 그대로 들어간다 */\nexport const STAGES = [${worlds.map((w) => '...w' + String(w).padStart(2, '0')).join(', ')}];\nexport const STAGE_BY_ID = Object.fromEntries(STAGES.map((s) => [s.id, s]));\n`));

/* 어려움 · 초고수 100판씩 (난이도 기획 2026-11-13) : 계산기 stages.<d>.generated.json → data/stages/<d>.js
 * diffLoad.js 가 동적 import 로 따로 묶음(chunk)으로 불러온다 — 보통 판 묶음에 붙지 않게. 판 g = 배열 [g - 1].
 * mag · atkMag 는 최종값(게임이 난이도 배율을 또 곱하지 않는다) · reward 는 보통 판 값 그대로(배율은 게임 코드가) · key(최고 정책)는 게임에 넣지 않는다 */
const DIFF_KO = { hard: '어려움', master: '초고수' };
for (const d of Object.keys(DIFF_KO)) {
  if (!fs.existsSync(path.join(SIM, `stages.${d}.generated.json`))) fail(`계산기에 stages.${d}.generated.json 이 없다 — 먼저 diff/report.js --all`);
  const arr = require(`./stages.${d}.generated.json`);
  if (arr.length !== 100 || arr.some((s, i) => s.g !== i + 1 || s.diff !== d)) fail(`stages.${d}.generated.json 이 100판 · g 순서 · diff '${d}' 가 아니다`);
  for (const s of arr) for (const ln of s.lines) if (!D.enemies[ln.id]) fail(`${d} ${s.id} : 좀비 ${ln.id} 가 data.js 에 없다`);
  const bad = arr.filter((s) => s.fail);
  if (bad.length) console.warn(`⚠ ${DIFF_KO[d]} 합격선 미달 ${bad.length}판 : ${bad.map((s) => `${s.id}(${s.fail.join(' / ')})`).join(' · ')}`);
  const rows = arr.map(({ key, ...s }) => '  ' + JSON.stringify(s) + ',');
  files.push(write(`src/games/iandragon_game/data/stages/${d}.js`, HEAD(`stages.${d}.generated.json`) +
    `/* ${DIFF_KO[d]} 100판 — 판 g = 배열 [g - 1]. 보통 판과 같은 모양 + diff. 직접 import 하지 말고 diffLoad.js 의 loadDiffStages('${d}') 로 (따로 묶음) */\nexport default [\n${rows.join('\n')}\n];\n`));
}
files.push(write('src/games/iandragon_game/data/stages/diffLoad.js', HEAD('stages.hard/master.generated.json') +
  `/** 어려움 · 초고수 판 100개를 따로 묶음으로 불러온다 : d = 'hard' | 'master' (그 밖은 null). 판 g = 배열 [g - 1].\n *  판의 mag · atkMag 는 최종값 — 난이도 배율을 또 곱하지 않는다. */\n` +
  `export const loadDiffStages = (d) => d === 'hard' ? import('./hard.js').then((m) => m.default) : d === 'master' ? import('./master.js').then((m) => m.default) : Promise.resolve(null);\n`));

// ── 3. 그림 프레임 목록 (1차 = 월드 1~5) ───────────────────────────────────
const SS = require('./stages.js');
const lastG = FIRST_WORLDS * 10;
const dragons = SS.UNLOCK.filter((u) => u[1] < lastG).map((u) => u[0]);
const enemySet = new Set();
const addEnemy = (id) => { if (!id || enemySet.has(id)) return; enemySet.add(id); const od = D.enemies[id]?.onDeath; if (od) addEnemy(od.id); };
for (const s of stages.filter((x) => x.g <= lastG)) for (const ln of s.lines) addEnemy(ln.id);
const isBoss = (id) => /^boss/.test(id) || !!D.enemies[id]?.boss;
const leaders = SS.LEADER_AT.slice(0, FIRST_WORLDS + 1).filter((x, i, a) => a.indexOf(x) === i);
const traits = [...new Set([...enemySet].flatMap((id) => D.enemies[id]?.traits || []))].sort();
const skills = SS.SKILL_UNLOCK.filter((u) => u[1] < lastG).map((u) => u[0]);
const sizeU = (u) => (u.cost <= 100 ? 32 : u.cost <= 200 ? 40 : u.cost <= 300 ? 44 : 48);
const sizeE = (e) => (e.hp <= 100 ? 32 : e.hp <= 300 ? 40 : e.hp <= 1000 ? 44 : 56);

const ART_ANIMS = { unit: ['idle0', 'walk0', 'walk1', 'atk0', 'atk1', 'kb0'], boss: ['idle0', 'walk0', 'walk1', 'walk2', 'walk3', 'atk0', 'atk1', 'kb0'], idle: ['idle0'] };
const ART_FRAMES = [
  ...dragons.flatMap((id) => [1, 2].map((f) => { const s = sizeU(D.units[id]) + (f - 1) * 4; return [`dragon/${id}/${f}`, s, s, 'unit', 'dragon']; })),
  ...[...enemySet].filter((id) => !isBoss(id)).map((id) => { const s = sizeE(D.enemies[id]); return [`zombie/${id}/0`, s, s, 'unit', 'zombie']; }),
  ...[...enemySet].filter(isBoss).map((id) => [`boss/${id}/0`, 128, 128, 'boss', 'boss']),
  ...leaders.map((id) => [`leader/${id}/0`, 64, 56, 'idle', 'leader']),
  ['crown/0/0', 24, 16, 'idle', 'crown'],
];
const ART_ICONS = ['ember', 'coin', 'gem', 'star', ...traits.map((t) => 'attr_' + t), ...skills.map((s) => 'skill_' + s)];
const ART_FX = ['hit', 'dust', 'poof'];
const wk = (w) => 'w' + String(w).padStart(2, '0');
const names = [
  ...ART_FRAMES.flatMap(([p, , , kind]) => ART_ANIMS[kind].map((a) => `${p}/${a}`)),
  ...[0, 1, 2, 3].map((h) => `base/nest/0/hp${h}`),
  ...Array.from({ length: FIRST_WORLDS }, (_, i) => [0, 1, 2, 3].map((h) => `base/tower/${wk(i + 1)}/hp${h}`)).flat(),
  ...Array.from({ length: FIRST_WORLDS }, (_, i) => ['sky', 'far', 'near', 'ground'].map((l) => `bg/${wk(i + 1)}/${l}`)).flat(),
  ...ART_ICONS.map((i) => `icon/${i}`),
  ...ART_FX.flatMap((f) => [0, 1, 2].map((n) => `fx/${f}/0/${n}`)),
];
files.push(write('src/games/iandragon_game/data/artManifest.js', HEAD('data.js · stages.js · stages.generated.json') +
  `/**\n * 1차(월드 1~${FIRST_WORLDS})에 필요한 그림 프레임 — 팀 계획서 2.1 의 약속. 겜팀장 qa:idg-art 가 ART_NAMES 와 시트를 대조한다.\n` +
  ` * 크기(w · h)는 **참고값** — 실제 크기는 시트의 프레임 크기를 따른다. 같은 캐릭터의 동작끼리는 크기 · 기준점이 같아야 한다.\n */\n` +
  `export const ART_WORLDS = ${FIRST_WORLDS};\n` +
  `export const ART_ANIMS = ${JSON.stringify(ART_ANIMS)};\n` +
  `/** [이름 접두, 가로, 세로, 동작 묶음, 색 묶음] */\nexport const ART_FRAMES = [\n${ART_FRAMES.map((f) => '  ' + JSON.stringify(f) + ',').join('\n')}\n];\n` +
  `export const ART_ICONS = ${JSON.stringify(ART_ICONS)};\nexport const ART_FX = ${JSON.stringify(ART_FX)};\n` +
  `/** 필요한 프레임 이름 전부 (${names.length}개) */\nexport const ART_NAMES = ${JSON.stringify(names)};\n`));

// ── 4. 정답표 ─────────────────────────────────────────────────────────────
const gp = path.join(SIM, 'golden.json');
if (!fs.existsSync(gp)) fail('계산기에 golden.json 이 없다 — 먼저 `node golden.js`');
fs.copyFileSync(gp, path.join(ROOT, 'tools/idg-golden.json'));
files.push('tools/idg-golden.json');
const gdp = path.join(SIM, 'golden.diff.json');   // 어려움 · 초고수 정답 (난이도마다 30줄)
if (!fs.existsSync(gdp)) fail('계산기에 golden.diff.json 이 없다 — 먼저 `node golden.js`');
fs.copyFileSync(gdp, path.join(ROOT, 'tools/idg-golden-diff.json'));
files.push('tools/idg-golden-diff.json');
const gcp = path.join(SIM, 'golden.castle.json');   // 드래곤캐슬 키우기 30 · «?» 드래곤 10 (2026-11-13 ⑤)
if (!fs.existsSync(gcp)) fail('계산기에 golden.castle.json 이 없다 — 먼저 `node golden.js`');
fs.copyFileSync(gcp, path.join(ROOT, 'tools/idg-golden-castle.json'));
files.push('tools/idg-golden-castle.json');

console.log(`옮김 ${files.length}개 · 코어 줄 대조 OK (${want.length}줄) · 그림 프레임 ${names.length}개 (용 ${dragons.length} · 좀비 ${[...enemySet].filter((i) => !isBoss(i)).length} · 보스 ${[...enemySet].filter(isBoss).length} · 리더 ${leaders.length})`);
