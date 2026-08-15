/**
 * 캐릭터 에셋 슬라이서
 *
 *   입력: etc/캐릭터/캐릭터에셋.png  (10행 × 3열 컨택트 시트, 논리 1픽셀 = 7px 확대)
 *   출력: public/assets/characters/{id}_{front|side|jump}.png
 *         src/data/characters.generated.json  (실제 바운딩 박스 기록)
 *
 * 규칙 (CLAUDE.md §5)
 *   · 원본은 절대 수정하지 않는다
 *   · 축소는 nearest-neighbor. 각 7×7 블록의 중심 픽셀을 그대로 집는다
 *   · 왼쪽 보기 컷은 만들지 않는다 (런타임 ctx.scale(-1,1))
 */

import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = resolve(ROOT, 'etc/캐릭터/캐릭터에셋.png');
const OUT_DIR = resolve(ROOT, 'public/assets/characters');
const OUT_JSON = resolve(ROOT, 'src/data/characters.generated.json');

/** 확대 배율 — 원본 시트가 논리 1px을 7px로 그렸다 */
const ZOOM = 7;
/** 시트 배경색 (이 색은 투명으로 뺀다) */
const BG = [26, 28, 38];
const BG_TOL = 14;

/** 출력 규격 (기획서 §9-2) */
const SIZE = {
  front: { w: 35, h: 50 },
  side: { w: 35, h: 50 },
  jump: { w: 50, h: 50 },
};

/** 시트 위에서 아래 순서. 기획서 §9-2 */
const ORDER = [
  { id: 'denny', ko: '데니' },
  { id: 'maho', ko: '마호' },
  { id: 'kyungtae', ko: '경태' },
  { id: 'lisa', ko: '리사' },
  { id: 'ian', ko: '이안' },
  { id: 'ipo', ko: '이포' },
  { id: 'charles', ko: '찰스' },
  { id: 'rose', ko: '로제' },
  { id: 'jenny', ko: '제니' },
  { id: 'tony', ko: '토니' },
];

const CUTS = ['front', 'side', 'jump'];

// ─────────────────────────────────────────────

function makeReader(data, W, C) {
  return {
    isBg(x, y) {
      const i = (y * W + x) * C;
      return (
        Math.abs(data[i] - BG[0]) < BG_TOL &&
        Math.abs(data[i + 1] - BG[1]) < BG_TOL &&
        Math.abs(data[i + 2] - BG[2]) < BG_TOL
      );
    },
    rgb(x, y) {
      const i = (y * W + x) * C;
      return [data[i], data[i + 1], data[i + 2]];
    },
  };
}

/** 연속 구간(밴드) 추출 */
function bands(counts, threshold, minLen) {
  const out = [];
  let s = -1;
  for (let i = 0; i < counts.length; i++) {
    if (counts[i] > threshold) {
      if (s < 0) s = i;
    } else {
      if (s >= 0 && i - s >= minLen) out.push([s, i - 1]);
      s = -1;
    }
  }
  if (s >= 0 && counts.length - s >= minLen) out.push([s, counts.length - 1]);
  return out;
}

/**
 * 7×7 블록의 중심을 집어 논리 픽셀로 축소한다.
 *
 * 배경 제거는 **바깥에서 들어오는 플러드 필**로만 한다.
 * 단순 색 키잉을 하면 캐릭터의 짙은 머리카락처럼 시트 배경(어두운 남색)과
 * 비슷한 색이 통째로 뚫려버린다. (2026-08-14 버그 수정)
 *
 * @returns {{buf:Buffer,w:number,h:number}} RGBA
 */
function downsample(reader, x0, y0, lw, lh) {
  const buf = Buffer.alloc(lw * lh * 4, 0);
  const half = (ZOOM / 2) | 0;
  const bgLike = new Uint8Array(lw * lh);

  // 1) 전부 불투명하게 샘플링 + 배경색 여부 기록
  for (let j = 0; j < lh; j++) {
    for (let i = 0; i < lw; i++) {
      const sx = x0 + i * ZOOM + half;
      const sy = y0 + j * ZOOM + half;
      const [r, g, b] = reader.rgb(sx, sy);
      const o = (j * lw + i) * 4;
      buf[o] = r;
      buf[o + 1] = g;
      buf[o + 2] = b;
      buf[o + 3] = 255;
      if (reader.isBg(sx, sy)) bgLike[j * lw + i] = 1;
    }
  }

  // 2) 테두리에서 시작하는 플러드 필 — 바깥과 이어진 배경색만 투명으로
  const stack = [];
  const push = (i, j) => {
    if (i < 0 || j < 0 || i >= lw || j >= lh) return;
    const p = j * lw + i;
    if (!bgLike[p] || bgLike[p] === 2) return;
    bgLike[p] = 2;
    stack.push(p);
  };
  for (let i = 0; i < lw; i++) { push(i, 0); push(i, lh - 1); }
  for (let j = 0; j < lh; j++) { push(0, j); push(lw - 1, j); }
  while (stack.length) {
    const p = stack.pop();
    const i = p % lw;
    const j = (p / lw) | 0;
    buf[p * 4 + 3] = 0; // 투명
    push(i - 1, j);
    push(i + 1, j);
    push(i, j - 1);
    push(i, j + 1);
  }

  return { buf, w: lw, h: lh };
}

/**
 * 발 앵커 — 스프라이트 **하단 N줄**에서 불투명 픽셀의 x 범위를 잰다.
 * 신발을 캐릭터 발에 정확히 얹으려면 캐릭터마다 다른 발 위치를 알아야 한다.
 * (2026-08-14 추가 — 신발이 발에서 어긋나 맨발이 비치던 문제)
 * @returns {{x0:number,x1:number,cx:number,w:number,top:number}|null} 배치 후 캔버스 좌표계
 */
/**
 * 맨발 영역을 **살색으로** 찾는다 (2026-08-15 개정).
 *
 * 신발을 신으면 맨발이 1도트도 보이면 안 된다. 그러려면 "발이 어디서 시작하는지"를
 * 정확히 알아야 하는데, 캐릭터마다 바지 길이·다리 굵기가 달라 고정 행수로는 안 된다.
 * → 얼굴에서 살색을 뽑고, 아래에서 위로 올라가며 **그 행의 불투명 픽셀 중 살색 비율**이
 *   임계치 이상인 동안을 발로 본다.
 *
 * 맨다리 캐릭터(치마·반바지)는 무릎까지 살색이라 위로 무한정 올라간다 →
 * 아래 5~9행으로 클램프한다. 인게임 신발 높이가 19도트(원본 약 12행)라 넉넉히 덮는다.
 */
function footAnchor(buf, w, h) {
  const MIN_ROWS = 5;
  const MAX_ROWS = 9;

  // ① 얼굴 영역(위 25~50%)에서 가장 흔한 살색을 찾는다
  const tally = new Map();
  for (let y = (h * 0.25) | 0; y < (h * 0.5) | 0; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (buf[i + 3] === 0) continue;
      const r = buf[i], g = buf[i + 1], b = buf[i + 2];
      if (!(r > 150 && r > g && g > b && r - b > 25)) continue; // 살색 후보
      const k = (r << 16) | (g << 8) | b;
      tally.set(k, (tally.get(k) ?? 0) + 1);
    }
  }
  let skin = null, best = 0;
  for (const [k, n] of tally) if (n > best) { best = n; skin = k; }

  const near = (i) => {
    if (skin === null) return false;
    const r = buf[i], g = buf[i + 1], b = buf[i + 2];
    const sr = (skin >> 16) & 255, sg = (skin >> 8) & 255, sb = skin & 255;
    // 음영까지 잡도록 넉넉하게 (발등은 그늘이 져서 더 어둡다)
    return Math.abs(r - sr) < 70 && Math.abs(g - sg) < 70 && Math.abs(b - sb) < 70 && r > g && g >= b;
  };

  // ② 아래에서 위로 — 살색이 과반인 행이 이어지는 동안이 발
  let top = h;
  for (let y = h - 1; y >= h - MAX_ROWS; y--) {
    let opaque = 0, skinN = 0;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (buf[i + 3] === 0) continue;
      opaque++;
      if (near(i)) skinN++;
    }
    if (opaque === 0) { top = y; continue; } // 빈 줄도 발 위쪽 경계로 인정
    if (skinN * 2 < opaque) break;
    top = y;
  }
  top = Math.min(top, h - MIN_ROWS);
  top = Math.max(top, h - MAX_ROWS);

  // ③ 발 좌우 중심 (발 영역의 불투명 픽셀 기준)
  let x0 = w, x1 = -1;
  for (let y = top; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (buf[(y * w + x) * 4 + 3] === 0) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
    }
  }
  if (x1 < 0) return null;
  return { x0, x1, cx: Math.round((x0 + x1) / 2), w: x1 - x0 + 1, top };
}

/** 논리 픽셀 이미지에서 알파가 있는 영역의 바운딩 박스 */
function alphaBBox(img) {
  let x0 = img.w,
    y0 = img.h,
    x1 = -1,
    y1 = -1;
  for (let j = 0; j < img.h; j++) {
    for (let i = 0; i < img.w; i++) {
      if (img.buf[(j * img.w + i) * 4 + 3] === 0) continue;
      if (i < x0) x0 = i;
      if (i > x1) x1 = i;
      if (j < y0) y0 = j;
      if (j > y1) y1 = j;
    }
  }
  return x1 < 0 ? null : { x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/**
 * 번개 이펙트(청백색)를 제외한 "몸통" 바운딩 박스.
 * 점프 컷을 서있는 컷과 같은 위치에 맞추기 위해 필요하다.
 */
function bodyBBox(img) {
  let x0 = img.w,
    x1 = -1;
  for (let j = 0; j < img.h; j++) {
    for (let i = 0; i < img.w; i++) {
      const o = (j * img.w + i) * 4;
      if (img.buf[o + 3] === 0) continue;
      const r = img.buf[o];
      const g = img.buf[o + 1];
      const b = img.buf[o + 2];
      // 번개: 파랑이 강하고 빨강이 약한 밝은 색
      const isBolt = b > 170 && b - r > 45;
      if (isBolt) continue;
      if (i < x0) x0 = i;
      if (i > x1) x1 = i;
    }
  }
  return x1 < 0 ? null : { x0, x1, w: x1 - x0 + 1 };
}

/** 논리 이미지를 고정 크기 캔버스에 배치 */
function compose(img, targetW, targetH, offsetX, offsetY) {
  const out = Buffer.alloc(targetW * targetH * 4, 0);
  for (let j = 0; j < img.h; j++) {
    const ty = j + offsetY;
    if (ty < 0 || ty >= targetH) continue;
    for (let i = 0; i < img.w; i++) {
      const tx = i + offsetX;
      if (tx < 0 || tx >= targetW) continue;
      const so = (j * img.w + i) * 4;
      if (img.buf[so + 3] === 0) continue;
      const to = (ty * targetW + tx) * 4;
      out[to] = img.buf[so];
      out[to + 1] = img.buf[so + 1];
      out[to + 2] = img.buf[so + 2];
      out[to + 3] = 255;
    }
  }
  return out;
}

async function savePng(buf, w, h, path) {
  await sharp(buf, { raw: { width: w, height: h, channels: 4 } })
    .png({ compressionLevel: 9, palette: true })
    .toFile(path);
}

// ─────────────────────────────────────────────

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  await mkdir(dirname(OUT_JSON), { recursive: true });

  const { data, info } = await sharp(SRC).raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;
  const R = makeReader(data, W, C);

  // ── 행(캐릭터) 밴드 ──
  const rowCounts = new Array(H).fill(0);
  for (let y = 0; y < H; y++) {
    let n = 0;
    for (let x = 0; x < W; x++) if (!R.isBg(x, y)) n++;
    rowCounts[y] = n;
  }
  const rows = bands(rowCounts, 30, 40);
  if (rows.length !== ORDER.length) {
    throw new Error(`행 감지 실패: ${rows.length}개 (기대 ${ORDER.length}개)`);
  }

  const meta = {};
  let warnings = 0;

  for (let r = 0; r < rows.length; r++) {
    const [ry0, ry1] = rows[r];
    const char = ORDER[r];

    // ── 열(컷) 밴드. x<150은 한글 이름 라벨이므로 제외 ──
    const colCounts = new Array(W).fill(0);
    for (let x = 150; x < W; x++) {
      let n = 0;
      for (let y = ry0; y <= ry1; y++) if (!R.isBg(x, y)) n++;
      colCounts[x] = n;
    }
    const cols = bands(colCounts, 3, 20);
    if (cols.length !== 3) {
      throw new Error(`${char.ko}: 열 감지 실패 (${cols.length}개)`);
    }

    meta[char.id] = { ko: char.ko, cuts: {} };

    for (let c = 0; c < 3; c++) {
      const cut = CUTS[c];
      const [cx0, cx1] = cols[c];
      const pw = cx1 - cx0 + 1;
      const ph = ry1 - ry0 + 1;

      if (pw % ZOOM || ph % ZOOM) {
        console.warn(`  ! ${char.ko}/${cut}: ${pw}×${ph} 가 ${ZOOM}의 배수가 아님 (반올림 처리)`);
        warnings++;
      }

      const lw = Math.round(pw / ZOOM);
      const lh = Math.round(ph / ZOOM);
      const img = downsample(R, cx0, ry0, lw, lh);
      const bb = alphaBBox(img);
      if (!bb) throw new Error(`${char.ko}/${cut}: 내용이 비어 있음`);

      const T = SIZE[cut];
      let offsetX;
      // 세로: 항상 바닥 정렬 (발끝이 캔버스 맨 아래)
      const offsetY = T.h - bb.y1 - 1;

      if (cut === 'jump') {
        // 번개를 뺀 몸통의 오른쪽 끝을 서있는 컷과 맞춘다.
        const body = bodyBBox(img) ?? { x1: bb.x1 };
        const sideRight = meta[char.id].cuts.side?.bodyRight ?? T.w - 1;
        // 몸통 오른쪽 끝이 (50-35)/2 만큼 밀린 위치에 오도록
        offsetX = sideRight + ((SIZE.jump.w - SIZE.side.w) >> 1) - body.x1;
      } else {
        offsetX = ((T.w - bb.w) >> 1) - bb.x0;
      }

      const out = compose(img, T.w, T.h, offsetX, offsetY);
      const file = `${char.id}_${cut}.png`;
      await savePng(out, T.w, T.h, resolve(OUT_DIR, file));

      const placed = { x0: bb.x0 + offsetX, x1: bb.x1 + offsetX };
      const foot = footAnchor(out, T.w, T.h);
      meta[char.id].cuts[cut] = {
        file,
        w: T.w,
        h: T.h,
        content: { x: placed.x0, w: bb.w, h: bb.h },
        /** 발 앵커 (배치 후 캔버스 좌표) — 신발 위치 계산에 쓴다 */
        foot: foot ? { cx: foot.cx, w: foot.w, top: foot.top } : null,
        bodyRight: cut === 'side' ? (bodyBBox(img)?.x1 ?? bb.x1) + offsetX : undefined,
        source: { x: cx0, y: ry0, w: pw, h: ph },
      };

      if (bb.w > T.w || bb.h > T.h) {
        console.warn(`  ! ${char.ko}/${cut}: 내용 ${bb.w}×${bb.h} 가 규격 ${T.w}×${T.h} 초과`);
        warnings++;
      }
    }

    const s = meta[char.id].cuts;
    console.log(
      `  ${char.ko.padEnd(3)} front ${s.front.content.w}×${s.front.content.h}` +
        `  side ${s.side.content.w}×${s.side.content.h}` +
        `  jump ${s.jump.content.w}×${s.jump.content.h}`
    );
  }

  await writeFile(OUT_JSON, JSON.stringify(meta, null, 2) + '\n', 'utf8');
  console.log(`\n캐릭터 ${ORDER.length}명 × 3컷 = ${ORDER.length * 3}장 생성`);
  console.log(`  → ${OUT_DIR}`);
  console.log(`  → ${OUT_JSON}`);
  if (warnings) console.log(`경고 ${warnings}건`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
