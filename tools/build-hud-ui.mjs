/**
 * HUD 도트 UI 빌더 — 게이지바 / 일시정지 버튼
 *
 *   원본: etc/게이지바.png (647×93)  ·  etc/일시정지.png (102×104)
 *   출력: public/assets/ui/gauge_frame.png (146×18)
 *         public/assets/ui/btn_pause.png   (18×18)
 *
 * 원본은 매끈한 렌더 일러스트다(고유색 6,186개 / 런렝스 1이 최빈). 그대로 축소하면
 * 1px 테두리가 뭉개져서 저해상도에서 지저분해진다. 그래서 **팔레트만 원본에서 뽑고
 * 형태는 도트로 다시 찍는다** — 동심 라운드 사각형 구조가 원본과 동일하다.
 *
 *   테두리(딥레드 1px) → 크림 띠 2px(위 하이라이트/아래 그늘) → 안쪽 테두리 1px → 트랙
 *
 * 게이지 채움은 이미지에 굽지 않는다. 프레임만 스프라이트로 두고 채움은 런타임에
 * 사각형으로 그려야 어떤 비율이든 도트가 깨지지 않는다.
 */

import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = resolve(ROOT, 'public/assets/ui');

/** layout.js HUD.gauge / HUD.pause 와 반드시 일치 */
const GAUGE = { w: 146, h: 18 };
const PAUSE = { w: 18, h: 18 };

// ─────────────────────────────────────────────
// 팔레트 추출 — 사용자 원본에서 직접 뽑는다
// ─────────────────────────────────────────────

async function sampler(file) {
  const { data, info } = await sharp(resolve(ROOT, file)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return (x, y) => {
    const i = (y * info.width + x) * 4;
    return [data[i], data[i + 1], data[i + 2], 255];
  };
}

// ─────────────────────────────────────────────
// 도트 캔버스
// ─────────────────────────────────────────────

function canvas(w, h) {
  const buf = Buffer.alloc(w * h * 4, 0);
  const put = (x, y, c) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const i = (y * w + x) * 4;
    buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2]; buf[i + 3] = 255;
  };
  const fill = (x0, y0, ww, hh, c) => {
    for (let y = y0; y < y0 + hh; y++) for (let x = x0; x < x0 + ww; x++) put(x, y, c);
  };
  /** 모서리 r칸을 깎은 사각형 채우기 (도트 라운드) */
  const round = (x0, y0, ww, hh, c, r) => {
    for (let y = 0; y < hh; y++) {
      // 위/아래 r행에서는 좌우를 (r - 해당행깊이)만큼 들여쓴다
      const dy = Math.min(y, hh - 1 - y);
      const inset = dy < r ? r - dy : 0;
      fill(x0 + inset, y0 + y, ww - inset * 2, 1, c);
    }
  };
  const png = () => sharp(buf, { raw: { width: w, height: h, channels: 4 } }).png({ compressionLevel: 9 });
  return { put, fill, round, png, buf };
}

// ─────────────────────────────────────────────

async function buildGauge() {
  const s = await sampler('etc/게이지바.png');
  const OUTLINE = s(320, 2);    // 딥레드 외곽
  const HILITE = s(320, 9);     // 크림 띠 위쪽 하이라이트
  const CREAM = s(320, 16);
  const SHADE = s(320, 83);     // 크림 띠 아래 그늘
  const INNER = s(320, 22);     // 안쪽 딥레드 테두리
  const TRACK = s(400, 46);     // 빈 트랙
  const FILL = s(100, 46);      // 채움(주황)

  const { w, h } = GAUGE;
  const c = canvas(w, h);

  c.round(0, 0, w, h, OUTLINE, 2);            // 외곽 테두리 (모서리 2칸 깎기)
  c.round(1, 1, w - 2, h - 2, CREAM, 1);      // 크림 띠
  c.fill(3, 1, w - 6, 1, HILITE);             // 위쪽 하이라이트 1줄
  c.fill(3, h - 2, w - 6, 1, SHADE);          // 아래쪽 그늘 1줄
  c.round(3, 3, w - 6, h - 6, INNER, 1);      // 안쪽 딥레드 테두리
  c.fill(4, 4, w - 8, h - 8, TRACK);          // 빈 트랙

  await c.png().toFile(resolve(OUT_DIR, 'gauge_frame.png'));
  return { OUTLINE, TRACK, FILL, inner: { x: 4, y: 4, w: w - 8, h: h - 8 } };
}

async function buildPause() {
  const s = await sampler('etc/일시정지.png');
  const OUTLINE = s(50, 2);
  const HILITE = s(50, 20);
  const FACE = s(50, 60);
  const SHADE = s(50, 95);
  const BAR = s(38, 50);

  const { w, h } = PAUSE;
  const c = canvas(w, h);

  c.round(0, 0, w, h, OUTLINE, 3);
  c.round(1, 1, w - 2, h - 2, FACE, 2);
  c.fill(4, 1, w - 8, 2, HILITE);    // 윗면 하이라이트
  c.fill(4, h - 2, w - 8, 1, SHADE); // 아랫면 그늘 1줄

  // 두 줄 바 — 원본 비율(폭 21% · 간격 8% · 높이 50%)을 18px에 맞춘 값
  const barY = 5, barH = 9;
  c.fill(4, barY, 4, barH, BAR);
  c.fill(10, barY, 4, barH, BAR);

  await c.png().toFile(resolve(OUT_DIR, 'btn_pause.png'));
  return { BAR };
}

const hex = (c) => '#' + c.slice(0, 3).map((v) => v.toString(16).padStart(2, '0')).join('');

await mkdir(OUT_DIR, { recursive: true });
const g = await buildGauge();
await buildPause();
console.log(`게이지 프레임 ${GAUGE.w}×${GAUGE.h}  트랙 ${JSON.stringify(g.inner)}`);
console.log(`  빈 트랙 ${hex(g.TRACK)} / 채움 ${hex(g.FILL)}  → palette.js 와 맞출 것`);
console.log(`일시정지 ${PAUSE.w}×${PAUSE.h}`);
console.log(`  → ${OUT_DIR}/gauge_frame.png · btn_pause.png`);
