/**
 * 이안 드래곤 게임 — 그림 시트 검사 (겜팀장)   npm run qa:idg-art
 * 필요한 프레임(겜부장 data/artManifest.js — 없으면 자리표시 목록)과 시트를 대조해 **문제만** 출력한다:
 *   ① 시트에 없는 이름  ② 아직 자리표시인 이름(개수만)  ③ 같은 캐릭터의 동작끼리 크기가 다른 것(걸을 때 흔들림)
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const A = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/assets/iandragon_game/atlas.json'), 'utf8'));
const MAN = path.join(ROOT, 'src/games/iandragon_game/data/artManifest.js');
let need = [];
if (fs.existsSync(MAN)) {
  const m = await import(pathToFileURL(MAN).href);
  const anims = { unit: ['idle0', 'walk0', 'walk1', 'atk0', 'atk1', 'kb0'], boss: ['idle0', 'walk0', 'walk1', 'walk2', 'walk3', 'atk0', 'atk1', 'kb0'], idle: ['idle0'] };
  for (const e of m.ART_FRAMES ?? []) {
    const [prefix, , , kind] = e;
    if (anims[kind]) for (const a of anims[kind]) need.push(`${prefix}/${a}`); else need.push(prefix);
  }
  if (m.ART_NAMES) need = [...m.ART_NAMES];   // 겜부장 목록이 정답 (351)
} else {
  const P = path.join(ROOT, 'public/assets/iandragon_game/_placeholder.json');
  if (fs.existsSync(P)) need = Object.keys(JSON.parse(fs.readFileSync(P, 'utf8')).frames);
}
let bad = 0;
const missing = need.filter((n) => !A.frames[n]);
for (const n of missing) { console.log('✗ 없음', n); bad++; }
const groups = {};
for (const [n, f] of Object.entries(A.frames)) { const g = n.split('/').slice(0, -1).join('/'); (groups[g] ??= new Set()).add(`${f.sourceSize.w}x${f.sourceSize.h}`); }
for (const [g, s] of Object.entries(groups)) if (s.size > 1 && !g.startsWith('bg') && !g.startsWith('base')) { console.log('✗ 동작끼리 크기 다름', g, [...s].join(' ')); bad++; }
const stub = (A.meta?.stub ?? []).length;
console.log(bad ? `그림 검사 실패 ${bad}건` : `그림 검사 통과 — 필요 ${need.length} · 아직 자리표시 ${stub}${A.meta?.placeholder ? ' (시트 전체가 자리표시)' : ''}`);
process.exit(bad ? 1 : 0);
