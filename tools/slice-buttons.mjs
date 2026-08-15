/**
 * 조작 버튼 슬라이서
 *
 *   입력: etc/인터페이스 버튼.png  (전환 / 좌 / 상승 / 우 4개, 체커보드 배경이 구워진 렌더 이미지)
 *   출력: public/assets/ui/btn_turn.png, btn_left.png, btn_up.png, btn_right.png  (각 70×58)
 *
 * 원본이 픽셀아트가 아니라 매끈한 렌더라 배경 키잉 → lanczos 축소 → 16색 양자화로 도트화한다.
 */

import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = resolve(ROOT, 'etc/인터페이스 버튼.png');
const OUT_DIR = resolve(ROOT, 'public/assets/ui');

/** 출력 규격 (layout.js CONTROLS 와 일치해야 함) */
const OUT_W = 48;
const OUT_H = 48;
const COLORS = 16;

/** 시트 왼쪽부터의 순서 */
const NAMES = ['btn_turn', 'btn_left', 'btn_up', 'btn_right'];

/** 체커보드(무채색 밝은 색)인가 */
function isCheck(r, g, b) {
  const gray = Math.abs(r - g) < 10 && Math.abs(g - b) < 10 && Math.abs(r - b) < 10;
  return gray && r > 185;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;

  // ── 체커 제거 마스크 ──
  const solid = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * C;
      if (!isCheck(data[i], data[i + 1], data[i + 2])) solid[y * W + x] = 1;
    }
  }

  // ── 열 밴드로 버튼 4개 분리 ──
  const colCount = new Int32Array(W);
  for (let x = 0; x < W; x++) {
    let n = 0;
    for (let y = 0; y < H; y++) if (solid[y * W + x]) n++;
    colCount[x] = n;
  }
  const bands = [];
  let s = -1;
  for (let x = 0; x <= W; x++) {
    const on = x < W && colCount[x] > H * 0.05;
    if (on) { if (s < 0) s = x; }
    else { if (s >= 0 && x - s > W * 0.05) bands.push([s, x - 1]); s = -1; }
  }
  if (bands.length !== NAMES.length) {
    throw new Error(`버튼 ${bands.length}개 감지 (기대 ${NAMES.length}개)`);
  }

  for (let i = 0; i < bands.length; i++) {
    const [x0, x1] = bands[i];
    let y0 = H, y1 = -1;
    for (let y = 0; y < H; y++) {
      let n = 0;
      for (let x = x0; x <= x1; x++) if (solid[y * W + x]) n++;
      if (n > (x1 - x0) * 0.05) { if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    const bw = x1 - x0 + 1;
    const bh = y1 - y0 + 1;

    // 체커를 투명으로 바꾼 크롭
    const crop = Buffer.alloc(bw * bh * 4, 0);
    for (let y = 0; y < bh; y++) {
      for (let x = 0; x < bw; x++) {
        if (!solid[(y0 + y) * W + (x0 + x)]) continue;
        const si = ((y0 + y) * W + (x0 + x)) * C;
        const di = (y * bw + x) * 4;
        crop[di] = data[si];
        crop[di + 1] = data[si + 1];
        crop[di + 2] = data[si + 2];
        crop[di + 3] = 255;
      }
    }

    const png = await sharp(crop, { raw: { width: bw, height: bh, channels: 4 } })
      .resize(OUT_W, OUT_H, { kernel: 'lanczos3', fit: 'fill' })
      .png({ palette: true, colors: COLORS, dither: 0 })
      .toBuffer();

    // 알파 이진화 후 저장
    const { data: q, info: qi } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    for (let k = 3; k < q.length; k += 4) q[k] = q[k] >= 128 ? 255 : 0;
    await sharp(q, { raw: { width: qi.width, height: qi.height, channels: 4 } })
      .png({ compressionLevel: 9 })
      .toFile(resolve(OUT_DIR, `${NAMES[i]}.png`));

    console.log(`  ${NAMES[i]}  원본 ${bw}×${bh} → ${OUT_W}×${OUT_H}`);
  }

  console.log(`버튼 ${NAMES.length}개 → ${OUT_DIR}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
