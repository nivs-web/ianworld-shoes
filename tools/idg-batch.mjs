/**
 * 그림 공장 — 묶음 돌리기 (겜부장 · 2026-11-11)
 *   node tools/idg-batch.mjs <묶음.json> [작업id ...]
 * 일마다 styleRef(화풍 그림) · size(512/1K/2K) · aspect(1:1 · 21:9 …)를 따로 줄 수 있다.
 * 묶음 json 의 jobs 를 차례로 idg-gen-vertex.mjs 로 보낸다 (예산 장부 한도에서 멈춤). 참고 그림 = [그 캐릭터 그림?] + 대표님 화풍 그림.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const [file, ...only] = process.argv.slice(2);
const B = JSON.parse(fs.readFileSync(file, 'utf8'));
const dir = path.dirname(file);
const STYLE_REF = { dragonParts: 'ref_dragons.webp', zombieParts: 'ref_zombies.webp' };
for (const j of B.jobs) {
  if (only.length && !only.includes(j.id)) continue;
  const refs = [];
  if (j.ref) refs.push(path.join(dir, j.ref));
  const style = j.styleRef || STYLE_REF[j.kind] || (j.id === 'novart' ? 'ref_dragons.webp' : 'ref_zombies.webp');
  if (!j.ref || !j.ref.endsWith(style)) refs.push(path.join(dir, style));
  const prompt = [j.desc, j.kind === 'custom' ? '' : B[j.kind], `The LAST image is the art-style reference. ${B.style}`].filter(Boolean).join(' ');
  const r = spawnSync('node', ['tools/idg-gen-vertex.mjs', j.id, prompt, ...refs], { stdio: 'inherit', env: { ...process.env, IDG_SIZE: j.size || process.env.IDG_SIZE || '1K', IDG_ASPECT: j.aspect || process.env.IDG_ASPECT || '1:1' } });
  if (r.status === 2) { console.log('예산 한도 — 멈춤'); break; }
}
