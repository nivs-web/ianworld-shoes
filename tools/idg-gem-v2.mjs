/**
 * 그림 담당 — 밝은 형광 보라 젬 (2026-11-11 · 대표님 «젬이 어두운 자주색이라 젬 같지 않다 · 게임에서 나오는 밝은 형광 보라 보석처럼» · 겜부장 전달)
 *
 *   node tools/idg-gem-v2.mjs
 *
 * 지금 로비 젬(ui/lobby/icon_gem.png)은 윗면이 비어 있고 어두운 자주라 색만 바꿔서는 보석처럼 안 보여, 제미나이로 새로 그림(gem_v2).
 * 분홍 바탕 → 투명 · 64×64 칸 가운데 · 반투명 없음 · 바깥 1칸 어두운 외곽선 · 빛번짐 없음.
 * → ui/lobby/icon_gem_v2.png (+ 같은 그림 ui/icon_gem_v2.png) — 같은 이름 덮어쓰기 금지(R2 1년 캐시)라 새 이름
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const G = 'C:/Users/ariancepc/Desktop/cowork/iandragon/docs/style_refs/gen/';
const UI = path.join(ROOT, 'public/assets/iandragon_game/ui');
const src = fs.readdirSync(G).filter((n) => /^gem_v2_\d+\.png$/.test(n)).sort().at(-1);
const isKey = (r, g, b) => (r > 150 && b > 150 && g < 110 && Math.abs(r - b) < 90) || ((r + b) / 2 - g > 70 && r > 120 && b > 110);
const OUT = [28, 10, 44];

const { data, info } = await sharp(G + src).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height, rgba = Buffer.alloc(W * H * 4), seen = new Uint8Array(W * H), st = [];
for (let i = 0; i < W * H; i++) { rgba[i * 4] = data[i * 3]; rgba[i * 4 + 1] = data[i * 3 + 1]; rgba[i * 4 + 2] = data[i * 3 + 2]; rgba[i * 4 + 3] = 255; }
for (let x = 0; x < W; x++) st.push(x, (H - 1) * W + x); for (let y = 0; y < H; y++) st.push(y * W, y * W + W - 1);
while (st.length) { const q = st.pop(); if (seen[q]) continue; seen[q] = 1; if (!isKey(data[q * 3], data[q * 3 + 1], data[q * 3 + 2])) continue; rgba[q * 4 + 3] = 0;
  const x = q % W, y = (q / W) | 0; if (x > 0) st.push(q - 1); if (x < W - 1) st.push(q + 1); if (y > 0) st.push(q - W); if (y < H - 1) st.push(q + W); }
const trimmed = await sharp(rgba, { raw: { width: W, height: H, channels: 4 } }).trim({ threshold: 0 }).png().toBuffer();
const tm = await sharp(trimmed).metadata(), N = 64, S = 60, k = Math.min(S / tm.width, S / tm.height);
const sm = await sharp(trimmed).resize(Math.round(tm.width * k), Math.round(tm.height * k), { kernel: 'lanczos3' }).raw().toBuffer({ resolveWithObject: true });
const sw = sm.info.width, sh = sm.info.height, ox = Math.floor((N - sw) / 2), oy = Math.floor((N - sh) / 2), img = Buffer.alloc(N * N * 4);
for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
  const s = (y * sw + x) * 4, a = sm.data[s + 3]; if (a < 128) continue;
  const o = ((oy + y) * N + ox + x) * 4; for (let c = 0; c < 3; c++) img[o + c] = Math.min(255, Math.round(sm.data[s + c] * 255 / a)); img[o + 3] = 255;
}
/* 바깥 1칸 어두운 외곽선 (줄이면서 가늘어진 테두리 보강) */
const ring = [];
for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const o = (y * N + x) * 4; if (img[o + 3]) continue;
  if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= N || yy >= N) return false; const p = (yy * N + xx) * 4; return img[p + 3] && Math.max(img[p], img[p + 1], img[p + 2]) > 70; })) ring.push(o); }
for (const o of ring) { img[o] = OUT[0]; img[o + 1] = OUT[1]; img[o + 2] = OUT[2]; img[o + 3] = 255; }
const png = await sharp(img, { raw: { width: N, height: N, channels: 4 } }).png({ compressionLevel: 9 }).toBuffer();
await sharp(png).toFile(path.join(UI, 'lobby/icon_gem_v2.png'));
await sharp(png).toFile(path.join(UI, 'icon_gem_v2.png'));
console.log('→ ui/lobby/icon_gem_v2.png · ui/icon_gem_v2.png 64×64 (' + src + ')');
