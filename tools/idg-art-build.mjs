/**
 * 이안 드래곤 게임 — 그림 시트 굽기 (겜팀장 · 팀 계획서 2.1)
 *   npm run assets:idg-art   (= node tools/idg-art-build.mjs)
 *
 * art/index.js 의 진짜 그림 + 아직 없는 이름은 겜부장의 자리표시 그림(처음 한 번 `_placeholder.*` 로 보관)으로 채워
 * public/assets/iandragon_game/atlas.png + atlas.json (PixiJS 스프라이트 시트) 을 만든다.
 * 진짜 시트라 meta.placeholder 가 없다 → 자리표시 도구가 다시 덮어쓰지 않는다. 빠진 이름은 meta.stub 에 적는다.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { FRAMES } from '../src/games/iandragon_game/art/index.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const OUT = path.join(ROOT, 'public/assets/iandragon_game');
const A_JSON = path.join(OUT, 'atlas.json'), A_PNG = path.join(OUT, 'atlas.png');
const P_JSON = path.join(OUT, '_placeholder.json'), P_PNG = path.join(OUT, '_placeholder.png');

/* 자리표시 원본 보관 (겜부장 시트가 자리표시일 때만 — 새 자리표시가 오면 다시 보관) */
if (fs.existsSync(A_JSON) && JSON.parse(fs.readFileSync(A_JSON, 'utf8')).meta?.placeholder) {
  fs.copyFileSync(A_JSON, P_JSON); fs.copyFileSync(A_PNG, P_PNG);
}
const ph = fs.existsSync(P_JSON) ? JSON.parse(fs.readFileSync(P_JSON, 'utf8')) : { frames: {} };
const phImg = fs.existsSync(P_PNG) ? await sharp(P_PNG).ensureAlpha().raw().toBuffer({ resolveWithObject: true }) : null;

/* 진짜 프레임 */
const list = [];
const real = new Set();
for (const [prefix, def] of Object.entries(FRAMES)) {
  const names = def.anims?.length ? def.anims.map((a) => [`${prefix}/${a}`, a]) : [[prefix, null]];
  for (const [name, a] of names) {
    const p = def.draw(a);
    list.push({ name, w: p.w, h: p.h, px: p.d, anchor: def.anchor ?? (name.startsWith('bg/') ? { x: 0, y: 0 } : { x: 0.5, y: 1 }) });
    real.add(name);
  }
}
/* 빠진 이름 = 자리표시 그림 그대로 */
const stub = [];
for (const [name, f] of Object.entries(ph.frames)) {
  if (real.has(name) || !phImg) continue;
  const { x, y, w, h } = f.frame, d = new Uint8ClampedArray(w * h * 4);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const s = ((y + j) * phImg.info.width + x + i) * 4, t = (j * w + i) * 4;
    d[t] = phImg.data[s]; d[t + 1] = phImg.data[s + 1]; d[t + 2] = phImg.data[s + 2]; d[t + 3] = phImg.data[s + 3];
  }
  list.push({ name, w, h, px: d, anchor: f.anchor ?? { x: 0.5, y: 1 } });
  stub.push(name);
}
/* 줄 단위 배치 (가로 2048) */
const W = 2048, GAP = 2;
let x = GAP, y = GAP, row = 0;
for (const f of [...list].sort((a, b) => b.h - a.h || a.name.localeCompare(b.name))) {
  if (x + f.w + GAP > W) { x = GAP; y += row + GAP; row = 0; }
  f.x = x; f.y = y; x += f.w + GAP; row = Math.max(row, f.h);
}
const H = y + row + GAP;
const buf = Buffer.alloc(W * H * 4);
const json = { frames: {}, meta: { image: 'atlas.png', size: { w: W, h: H }, scale: 1, by: 'idg-art-build', real: real.size, stub } };
for (const f of list.sort((a, b) => a.name.localeCompare(b.name))) {
  for (let j = 0; j < f.h; j++) for (let i = 0; i < f.w; i++) {
    const s = (j * f.w + i) * 4; if (!f.px[s + 3]) continue;
    const t = ((f.y + j) * W + f.x + i) * 4;
    buf[t] = f.px[s]; buf[t + 1] = f.px[s + 1]; buf[t + 2] = f.px[s + 2]; buf[t + 3] = 255;
  }
  json.frames[f.name] = { frame: { x: f.x, y: f.y, w: f.w, h: f.h }, sourceSize: { w: f.w, h: f.h }, spriteSourceSize: { x: 0, y: 0, w: f.w, h: f.h }, anchor: f.anchor };
}
fs.mkdirSync(OUT, { recursive: true });
await sharp(buf, { raw: { width: W, height: H, channels: 4 } }).png({ compressionLevel: 9 }).toFile(A_PNG);
fs.writeFileSync(A_JSON, JSON.stringify(json));
console.log(`그림 시트 ${list.length}프레임 (진짜 ${real.size} · 자리표시 ${stub.length}) · ${W}×${H}`);
