/**
 * 그림 공장 2단계 — 부품 시트 자르기 (겜부장 · 2026-11-11)
 *
 *   node tools/idg-parts-cut.mjs <부품시트.png> <출력폴더> <이름들(쉼표)> [배율=0.125]
 *
 * 분홍(#FF00FF) 배경을 지우고 → 붙어 있는 덩어리마다 하나의 부품으로 자르고 → 줄 · 칸 순서(위→아래, 왼→오른)로
 * 이름을 붙인 뒤 → 배율만큼 줄여(nearest) parts/<이름>.png 와 parts.json(크기) 으로 낸다.
 * 이름이 '-' 이면 그 덩어리는 버린다. 이름 끝에 ':split' 을 붙이면 가로 반으로 나눠 _a · _b 두 부품으로 (한 쌍으로 그려진 다리).
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const [src, outDir, namesArg, scaleArg] = process.argv.slice(2);
const names = namesArg.split(',');
const SCALE = Number(scaleArg || 0.125);
const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height;

/* 1. 분홍 지우기 (번진 가장자리도) */
const isKey = (i) => { const r = data[i], g = data[i + 1], b = data[i + 2]; return r > 150 && b > 150 && g < 110 && Math.abs(r - b) < 90; };
for (let i = 0; i < W * H * 4; i += 4) if (isKey(i)) data[i + 3] = 0;
/* 분홍 번짐 걷기 : 투명과 맞닿은 칸이 분홍 기운이 있으면 외곽선 색으로 (2번 돌려 두 칸까지) */
const pinkish = (i) => (data[i] + data[i + 2]) / 2 - data[i + 1] > 45 && data[i] > 90 && data[i + 2] > 90;
for (let pass = 0; pass < 2; pass++) for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
  const i = (y * W + x) * 4; if (!data[i + 3] || !pinkish(i)) continue;
  if (!data[i - 4 + 3] || !data[i + 4 + 3] || !data[i - W * 4 + 3] || !data[i + W * 4 + 3]) { data[i] = 26; data[i + 1] = 16; data[i + 2] = 48; }
}

/* 2. 덩어리 찾기 (8방향) */
const lab = new Int32Array(W * H).fill(-1);
const comps = [];
for (let s = 0; s < W * H; s++) {
  if (lab[s] >= 0 || !data[s * 4 + 3]) continue;
  const id = comps.length, st = [s];
  let x0 = W, y0 = H, x1 = 0, y1 = 0, n = 0;
  lab[s] = id;
  while (st.length) {
    const p = st.pop(), x = p % W, y = (p / W) | 0; n++;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const q = ny * W + nx; if (lab[q] < 0 && data[q * 4 + 3]) { lab[q] = id; st.push(q); }
    }
  }
  comps.push({ id, x0, y0, x1, y1, n });
}
const big = comps.filter((c) => c.n > (W * H) / 4000);
/* 줄로 묶기 : 세로 가운데가 비슷한 것끼리 */
big.sort((a, b) => (a.y0 + a.y1) / 2 - (b.y0 + b.y1) / 2);
const rows = [];
for (const c of big) { const cy = (c.y0 + c.y1) / 2, r = rows.find((r) => Math.abs(r.cy - cy) < H / 8); if (r) r.items.push(c); else rows.push({ cy, items: [c] }); }
const ordered = rows.flatMap((r) => r.items.sort((a, b) => a.x0 - b.x0));
if (ordered.length !== names.length) console.warn(`⚠ 덩어리 ${ordered.length}개 · 이름 ${names.length}개 — 순서를 확인하세요`);

/* 3. 자르기 · 줄이기 */
fs.mkdirSync(outDir, { recursive: true });
const meta = { src: path.basename(src), scale: SCALE, parts: {} };
async function emit(name, c, x0, x1) {
  const w = x1 - x0 + 1, h = c.y1 - c.y0 + 1, buf = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const s = ((c.y0 + y) * W + x0 + x), t = (y * w + x) * 4;
    if (lab[s] !== c.id) continue;
    data.copy(buf, t, s * 4, s * 4 + 4);
  }
  const ow = Math.max(1, Math.round(w * SCALE)), oh = Math.max(1, Math.round(h * SCALE));
  await sharp(buf, { raw: { width: w, height: h, channels: 4 } }).resize(ow, oh, { kernel: 'nearest' }).png().toFile(path.join(outDir, name + '.png'));
  meta.parts[name] = { w: ow, h: oh, src: { x: x0, y: c.y0, w, h } };
}
for (let k = 0; k < Math.min(ordered.length, names.length); k++) {
  const [name, mode] = names[k].split(':'), c = ordered[k];
  if (name === '-') continue;
  if (mode === 'split') { const mid = Math.round((c.x0 + c.x1) / 2); await emit(name + '_a', c, c.x0, mid); await emit(name + '_b', c, mid + 1, c.x1); }
  else await emit(name, c, c.x0, c.x1);
}
fs.writeFileSync(path.join(outDir, 'parts.json'), JSON.stringify(meta, null, 1));
console.log(`부품 ${Object.keys(meta.parts).length}개 → ${outDir}`, Object.entries(meta.parts).map(([k, v]) => `${k} ${v.w}×${v.h}`).join(' · '));
