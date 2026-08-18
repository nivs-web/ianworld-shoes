/**
 * 1등 말풍선 굽기 — `node tools/build-bubble.mjs`
 *
 * 원본(`etc/1등이닷.png`)은 514×326 짜리 렌더 이미지다(고유색 1,717개).
 * 그대로 줄이면 테두리가 뭉개지므로 **면적 평균으로 줄인 뒤 2색으로 자른다** —
 * 결과는 테두리 1도트 + 흰 면, 즉 진짜 도트가 된다(§5 축소 규칙).
 *
 * 글씨는 **여기서 함께 굽는다.** 런타임에 매 프레임 글자를 찍으면 말풍선 하나에
 * fillRect 수십 번이 더 붙고(§9-0-25 렉), 무엇보다 위치가 매번 어긋난다.
 * 폰트는 인게임과 같은 갈무리7 도트 데이터를 그대로 쓴다.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import sharp from 'sharp';

const SRC = 'etc/1등이닷.png';
const OUT = 'public/assets/ui/bubble_first.png';
/** 말풍선 크기 (논리 픽셀) — 글자 폭 31 + 좌우 여백 */
const W = 38;
const H = 24;
/** 꼬리가 차지하는 아래쪽 높이 */
const TAIL_H = 6;
const INK = [33, 20, 37];
const TEXT = '1등이닷';

const font = JSON.parse(readFileSync('src/data/font7.generated.json', 'utf8'));

const { data: sd, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const SW = info.width, SH = info.height;

/** 결과 버퍼 (RGBA) */
const od = Buffer.alloc(W * H * 4, 0);
const put = (x, y, r, g, b) => {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 4;
  od[i] = r; od[i + 1] = g; od[i + 2] = b; od[i + 3] = 255;
};

/** 원본에서 이 논리 픽셀에 해당하는 사각형의 평균 — 알파와 밝기를 따로 본다 */
function sample(x, y) {
  const x0 = Math.floor((x * SW) / W), x1 = Math.max(x0 + 1, Math.floor(((x + 1) * SW) / W));
  const y0 = Math.floor((y * SH) / H), y1 = Math.max(y0 + 1, Math.floor(((y + 1) * SH) / H));
  let a = 0, lum = 0, n = 0;
  for (let sy = y0; sy < y1; sy++) {
    for (let sx = x0; sx < x1; sx++) {
      const i = (sy * SW + sx) * 4;
      a += sd[i + 3];
      lum += (sd[i] * 0.299 + sd[i + 1] * 0.587 + sd[i + 2] * 0.114) * (sd[i + 3] / 255);
      n++;
    }
  }
  return { a: a / n, lum: lum / n };
}

for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const { a, lum } = sample(x, y);
    if (a < 110) continue;                       // 바깥은 투명
    const 테두리 = lum < 150;
    put(x, y, 테두리 ? INK[0] : 255, 테두리 ? INK[1] : 255, 테두리 ? INK[2] : 255);
  }
}

// ── 글씨 (갈무리7 도트를 그대로 찍는다) ──
const glyphs = font.glyphs;
// 진행 폭은 런타임(`pixelfont.blit`)과 **글자 그대로 같아야** 한다 — 다르면 글씨가 삐뚤어진다
const step = (ch) => (glyphs[ch]?.w ?? 4) + font.tracking;
let tw = 0;
for (const ch of TEXT) tw += step(ch);
tw -= font.tracking;
let tx = Math.round((W - tw) / 2);
const ty = Math.round((H - TAIL_H - font.h) / 2);
for (const ch of TEXT) {
  const g = glyphs[ch];
  if (g) {
    for (let row = 0; row < font.h; row++) {
      const bits = g.r[row] ?? 0;
      for (let col = 0; col < g.w; col++) {
        if (bits & (1 << (g.w - 1 - col))) put(tx + col, ty + row, INK[0], INK[1], INK[2]);
      }
    }
  }
  tx += step(ch);
}

mkdirSync('public/assets/ui', { recursive: true });
await sharp(od, { raw: { width: W, height: H, channels: 4 } }).png().toFile(OUT);
console.log(`말풍선 구움: ${OUT} (${W}×${H}, 글자 "${TEXT}")`);
