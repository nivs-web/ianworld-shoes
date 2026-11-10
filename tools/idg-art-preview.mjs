/**
 * 이안 드래곤 게임 — 그림 확인 시트 (겜팀장 · 기획서 12.4 품질 장치)
 *   node tools/idg-art-preview.mjs [접두 ...]   → tools/_out/idg-art-preview.png
 * 줄마다 한 캐릭터: 동작 6장(실제 크기) · 2배 · 4배 · 실루엣(검은색만). 배경은 게임과 비슷한 밤 하늘 · 풀밭.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { ANIMS } from '../src/games/iandragon_game/art/units.js';
import { FRAMES } from '../src/games/iandragon_game/art/index.js';
const UNITS = Object.fromEntries(Object.entries(FRAMES).map(([k, d]) => [k, d.draw]));

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const keys = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(UNITS);
const rows = keys.map((k) => ({ k, frames: ANIMS.map((a) => UNITS[k](a)) }));
const cell = Math.max(...rows.flatMap((r) => r.frames.map((f) => f.w))) + 6;
const COMPACT = !!process.env.COMPACT;   // 확인용 작은 시트(4배 칸 없음)
const W = cell * 6 + cell * 2 + (COMPACT ? 0 : cell * 4) + cell + 20, rowH = cell * (COMPACT ? 2 : 4) + 8;
const H = rows.length * rowH + 10;
const buf = Buffer.alloc(W * H * 4);
const fill = (x, y, w, h, c) => { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) { const k = (j * W + i) * 4; buf[k] = c[0]; buf[k + 1] = c[1]; buf[k + 2] = c[2]; buf[k + 3] = 255; } };
fill(0, 0, W, H, [34, 28, 64]);
const put = (f, ox, oy, s, sil) => {
  for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) {
    const c = f.get(x, y); if (!c) continue;
    fill(ox + x * s, oy + y * s, s, s, sil ? [10, 6, 20] : c);
  }
};
rows.forEach((r, ri) => {
  const y0 = 5 + ri * rowH, gy = y0 + cell * (COMPACT ? 2 : 4) - 4;
  fill(0, gy, W, 4, [58, 110, 58]);                                       // 풀밭 줄
  r.frames.forEach((f, i) => put(f, 4 + i * cell, gy - f.h, 1, false));   // 실제 크기 6동작
  const big = r.frames[0];
  put(big, 4 + cell * 6 + 4, gy - big.h * 2, 2, false);                   // 2배
  if (!COMPACT) put(big, 4 + cell * 8 + 8, gy - big.h * 4, 4, false);   // 4배
  put(big, 4 + cell * (COMPACT ? 8 : 12) + 12, gy - big.h, 1, true);       // 실루엣
});
fs.mkdirSync(path.join(ROOT, 'tools/_out'), { recursive: true });
const out = path.join(ROOT, 'tools/_out/idg-art-preview.png');
await sharp(buf, { raw: { width: W, height: H, channels: 4 } }).resize(W * 2, H * 2, { kernel: 'nearest' }).png().toFile(out);
console.log('✓', out, `${W * 2}x${H * 2}`);
