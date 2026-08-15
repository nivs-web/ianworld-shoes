/**
 * 계단 블록 슬라이서
 *
 *   입력: etc/UI/계단.png  (2770×1504 돌블록 렌더 — 어두운 테두리 + 회색 면 + 얼룩)
 *   출력: public/assets/ui/stair.png  (36×19)
 *
 * 원본이 매끈한 렌더라 [불투명 영역 크롭 → lanczos 축소 → 12색 양자화]로 도트화한다.
 * 출력 크기는 layout.js STAIR.w / STAIR.h 와 반드시 일치해야 한다.
 */

import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = resolve(ROOT, 'etc/UI/계단.png');
const OUT_DIR = resolve(ROOT, 'public/assets/ui');

/** layout.js STAIR 과 일치 */
const OUT_W = 36;
const OUT_H = 19;
const COLORS = 12;

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;

  // 불투명 영역 바운딩 박스 (위쪽 투명 여백 제거)
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (data[(y * W + x) * C + 3] < 40) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  const bw = x1 - x0 + 1;
  const bh = y1 - y0 + 1;

  const png = await sharp(SRC)
    .extract({ left: x0, top: y0, width: bw, height: bh })
    .resize(OUT_W, OUT_H, { kernel: 'lanczos3', fit: 'fill' })
    .png({ palette: true, colors: COLORS, dither: 0 })
    .toBuffer();

  // 알파 이진화
  const { data: q, info: qi } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 3; i < q.length; i += 4) q[i] = q[i] >= 128 ? 255 : 0;

  await sharp(q, { raw: { width: qi.width, height: qi.height, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toFile(resolve(OUT_DIR, 'stair.png'));

  console.log(`계단 블록  원본 ${bw}×${bh} → ${OUT_W}×${OUT_H}`);
  console.log(`  → ${OUT_DIR}/stair.png`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
