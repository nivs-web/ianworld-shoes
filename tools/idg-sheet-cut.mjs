/**
 * 그림 공장 — 흰 바탕 그림 시트를 칸으로 잘라 게임 그림으로 (겜부장 · 2026-11-11)
 *
 *   node tools/idg-sheet-cut.mjs <시트> <출력폴더> <열>x<행> <이름들(쉼표, 칸 순서)> <목표 높이>
 *
 * 칸마다 가장자리에서부터 흰 바탕만 지운다(가운데 흰 부분 — 알 · 해골 · 연기는 남는다) → 남은 덩어리에 맞춰 자르고
 * → 목표 높이로 줄인다. 같은 줄의 그림(체력 단계)은 같은 배율로 줄여 크기가 흔들리지 않게 한다.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const [src, outDir, grid, namesArg, hArg] = process.argv.slice(2);
const [C, R] = grid.split('x').map(Number), names = namesArg.split(','), TH = Number(hArg);
const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height, cw = Math.floor(W / C), ch = Math.floor(H / R);
const white = (i) => data[i] > 228 && data[i + 1] > 228 && data[i + 2] > 228;
fs.mkdirSync(outDir, { recursive: true });
const cells = [];
for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
  const X0 = c * cw, Y0 = r * ch, seen = new Uint8Array(cw * ch), st = [];
  for (let x = 0; x < cw; x++) st.push([x, 0], [x, ch - 1]);
  for (let y = 0; y < ch; y++) st.push([0, y], [cw - 1, y]);
  while (st.length) {                                       // 가장자리에서 흰 바탕만 번져 지우기
    const [x, y] = st.pop(); if (x < 0 || y < 0 || x >= cw || y >= ch) continue;
    const k = y * cw + x; if (seen[k]) continue;
    const i = ((Y0 + y) * W + X0 + x) * 4; if (!white(i)) continue;
    seen[k] = 1; data[i + 3] = 0; st.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  let x0 = cw, y0 = ch, x1 = 0, y1 = 0;
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) if (data[((Y0 + y) * W + X0 + x) * 4 + 3]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  cells.push({ r, X0, Y0, x0, y0, x1, y1 });
}
/* 줄마다 같은 배율 (가장 높은 그림을 목표 높이로) */
const rowScale = {};
for (const c of cells) rowScale[c.r] = Math.min(rowScale[c.r] ?? 1, TH / (c.y1 - c.y0 + 1));
const meta = {};
for (let k = 0; k < cells.length && k < names.length; k++) {
  const c = cells[k], w = c.x1 - c.x0 + 1, h = c.y1 - c.y0 + 1, s = rowScale[c.r];
  const buf = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) data.copy(buf, y * w * 4, ((c.Y0 + c.y0 + y) * W + c.X0 + c.x0) * 4, ((c.Y0 + c.y0 + y) * W + c.X0 + c.x1 + 1) * 4);
  const ow = Math.round(w * s), oh = Math.round(h * s);
  await sharp(buf, { raw: { width: w, height: h, channels: 4 } }).resize(ow, oh, { kernel: 'lanczos3' }).png().toFile(path.join(outDir, names[k] + '.png'));
  meta[names[k]] = { w: ow, h: oh };
}
fs.writeFileSync(path.join(outDir, 'sheet.json'), JSON.stringify(meta, null, 1));
console.log(Object.entries(meta).map(([k, v]) => `${k} ${v.w}×${v.h}`).join(' · '));
