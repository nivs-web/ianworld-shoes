/**
 * 그림 담당 — 성 파괴 «바바바박» 도트 연기 덩어리 6종 (2026-11-11 · 대표님 «상대 성에 먼지가 막 생겨, 우리도 이런 식으로» · 겜팀장 전달)
 *
 *   node tools/idg-smoke-cut.mjs
 *
 * 제미나이 시트(smokeburst · 분홍 바탕 · 2줄 3개씩)를 덩어리로 잘라 ai/fx/smoke_0~5.png — 원래 크기 비율 그대로, 가장 큰 것 긴 변 120.
 *  0 작은 동그란 · 1 넓적한(불티) · 2 길쭉한 · 3 큰 폭발(불꽃) · 4 조각 튀는 · 5 중간 동그란 — 성 위 여기저기 연달아 터뜨리기(반투명 없음 · 작게 → 크게 → 사라질 땐 작게)
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const G = 'C:/Users/ariancepc/Desktop/cowork/iandragon/docs/style_refs/gen/';
const FX = path.join(ROOT, 'public/assets/iandragon_game/ai/fx');
const file = fs.readdirSync(G).filter((f) => /^smokeburst_\d+\.png$/.test(f)).sort().at(-1);
const isKey = (r, g, b) => (r > 150 && b > 150 && g < 110 && Math.abs(r - b) < 90) || ((r + b) / 2 - g > 70 && r > 120 && b > 110);

const { data, info } = await sharp(G + file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height, on = new Uint8Array(W * H);
for (let i = 0; i < W * H; i++) on[i] = isKey(data[i * 3], data[i * 3 + 1], data[i * 3 + 2]) ? 0 : 1;
const lab = new Int32Array(W * H).fill(-1), comps = [];
for (let s0 = 0; s0 < W * H; s0++) {
  if (!on[s0] || lab[s0] >= 0) continue;
  const st = [s0], id = comps.length; lab[s0] = id; let n = 0, x0 = W, y0 = H, x1 = 0, y1 = 0;
  while (st.length) { const q = st.pop(), x = q % W, y = (q / W) | 0; n++; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const nq = ny * W + nx; if (on[nq] && lab[nq] < 0) { lab[nq] = id; st.push(nq); } } }
  comps.push({ ids: [id], n, x0, y0, x1, y1 });
}
let gs = comps.filter((c) => c.n > 6);
for (let merged = true; merged;) {                                               // 튀는 조각 · 불티를 가까운 덩어리에 붙임
  merged = false;
  for (let i = 0; i < gs.length && !merged; i++) for (let j = i + 1; j < gs.length && !merged; j++) {
    const a = gs[i], b = gs[j], gap = 30;
    if (a.x0 - gap <= b.x1 && b.x0 - gap <= a.x1 && a.y0 - gap <= b.y1 && b.y0 - gap <= a.y1) { gs[i] = { ids: [...a.ids, ...b.ids], n: a.n + b.n, x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) }; gs.splice(j, 1); merged = true; }
  }
}
gs = gs.filter((g) => g.n > 3000);
const cy = (g) => (g.y0 + g.y1) / 2, mid = (Math.min(...gs.map((g) => g.y0)) + Math.max(...gs.map((g) => g.y1))) / 2;
gs.sort((a, b) => (cy(a) < mid) - (cy(b) < mid) ? (cy(a) < mid ? -1 : 1) : a.x0 - b.x0);
const big = Math.max(...gs.map((g) => Math.max(g.x1 - g.x0, g.y1 - g.y0) + 1)), k = 120 / big, made = [];
for (const [i, g] of gs.slice(0, 6).entries()) {
  const keep = new Set(g.ids), w = g.x1 - g.x0 + 1, h = g.y1 - g.y0 + 1, buf = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const q = (g.y0 + y) * W + g.x0 + x, o = (y * w + x) * 4; if (!keep.has(lab[q])) continue; buf[o] = data[q * 3]; buf[o + 1] = data[q * 3 + 1]; buf[o + 2] = data[q * 3 + 2]; buf[o + 3] = 255; }
  const ow = Math.max(1, Math.round(w * k)), oh = Math.max(1, Math.round(h * k));
  const d = await sharp(buf, { raw: { width: w, height: h, channels: 4 } }).resize(ow, oh, { kernel: 'lanczos3' }).raw().toBuffer();
  for (let p = 0; p < d.length; p += 4) { if (d[p + 3] < 128) d[p] = d[p + 1] = d[p + 2] = d[p + 3] = 0; else { const a = d[p + 3] / 255; for (let c = 0; c < 3; c++) d[p + c] = Math.min(255, Math.round(d[p + c] / a)); d[p + 3] = 255; } }
  await sharp(d, { raw: { width: ow, height: oh, channels: 4 } }).png({ compressionLevel: 9 }).toFile(path.join(FX, `smoke_${i}.png`));
  made.push(`ai/fx/smoke_${i}.png ${ow}×${oh}`);
}
console.log(made.map((m) => '→ ' + m).join('\n'));
