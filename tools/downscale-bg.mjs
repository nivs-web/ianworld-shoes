/**
 * 배경 변환기
 *
 *   입력: etc/백그라운드건물/*.png     각 장에 도로 / 1층 / 2·3층 3패널이 나란히 그려진 설명 포스터
 *         etc/200층이상배경/*.png       층수별 교체 배경 (역시 포스터 형식, 패널 1개)
 *   출력: public/assets/bg/build_NN_{road|floor1|tile}.png
 *         public/assets/bg/floor200|300|400|500.png
 *         src/data/backgrounds.generated.json
 *
 * 원본은 픽셀아트가 아니라 매끈하게 렌더된 일러스트다(런렝스 분석 결과 확대배율 1).
 * 따라서 nearest 축소는 노이즈만 남는다. 대신
 *   ① 포스터에서 그림 패널만 잘라내고            → 국소 표준편차 기반 검출
 *   ② 면적 평균(lanczos)으로 규격 크기까지 줄이고
 *   ③ 색을 32색으로 양자화해 도트처럼 각을 세운다.
 * 런타임에서는 이 결과물을 정수배로만 확대하므로 화면에서는 완전한 픽셀 퍼펙트다.
 */

import sharp from 'sharp';
import { mkdir, readdir, writeFile, readFile } from 'node:fs/promises';
import { dirname, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BG } from '../src/config/layout.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC_BUILD = resolve(ROOT, 'etc/백그라운드건물');
const SRC_FLOOR = resolve(ROOT, 'etc/200층이상배경');
const OUT_DIR = resolve(ROOT, 'public/assets/bg');
const OUT_JSON = resolve(ROOT, 'src/data/backgrounds.generated.json');
/** 자동 검출이 실패한 포스터의 패널 좌표를 손으로 지정하는 파일 */
const OVERRIDE = resolve(ROOT, 'tools/bg-panels.json');

/** 양자화 색 수 — 낮출수록 도트 느낌이 강해진다 */
const COLORS = 32;
/** 검출 블록 크기 (px) */
const B = 16;

const PANELS = [
  { key: 'road', w: BG.roadW, h: BG.roadH },
  { key: 'floor1', w: BG.floor1W, h: BG.floor1H },
  { key: 'tile', w: BG.tileW, h: BG.tileH },
];

// ─────────────────────────────────────────────

/**
 * 국소 표준편차 격자.
 * 모눈종이 배경은 밋밋하고(낮음) 그림 패널은 디테일이 많다(높음).
 */
function blockSD(grey, W, H) {
  const bw = Math.floor(W / B);
  const bh = Math.floor(H / B);
  const sd = new Float32Array(bw * bh);
  for (let by = 0; by < bh; by++) {
    for (let bx = 0; bx < bw; bx++) {
      let s = 0,
        s2 = 0;
      for (let y = by * B; y < by * B + B; y++) {
        for (let x = bx * B; x < bx * B + B; x++) {
          const v = grey[y * W + x];
          s += v;
          s2 += v * v;
        }
      }
      const n = B * B;
      const m = s / n;
      sd[by * bw + bx] = Math.sqrt(Math.max(0, s2 / n - m * m));
    }
  }
  return { sd, bw, bh };
}

/** 1블록 팽창 — 패널 내부의 밋밋한 구멍(하늘, 단색 벽)을 메운다 */
function dilate(mask, bw, bh, times = 2) {
  let cur = mask;
  for (let t = 0; t < times; t++) {
    const next = new Uint8Array(cur.length);
    for (let y = 0; y < bh; y++) {
      for (let x = 0; x < bw; x++) {
        if (!cur[y * bw + x]) continue;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx,
              ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= bw || ny >= bh) continue;
            next[ny * bw + nx] = 1;
          }
        }
      }
    }
    cur = next;
  }
  return cur;
}

function components(mask, W, H, minArea) {
  const seen = new Uint8Array(W * H);
  const out = [];
  const stack = new Int32Array(W * H);

  for (let p0 = 0; p0 < W * H; p0++) {
    if (!mask[p0] || seen[p0]) continue;
    let sp = 0;
    stack[sp++] = p0;
    seen[p0] = 1;
    let x0 = W,
      y0 = H,
      x1 = -1,
      y1 = -1,
      area = 0;

    while (sp > 0) {
      const p = stack[--sp];
      const x = p % W;
      const y = (p / W) | 0;
      area++;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      if (x > 0 && mask[p - 1] && !seen[p - 1]) (seen[p - 1] = 1), (stack[sp++] = p - 1);
      if (x < W - 1 && mask[p + 1] && !seen[p + 1]) (seen[p + 1] = 1), (stack[sp++] = p + 1);
      if (y > 0 && mask[p - W] && !seen[p - W]) (seen[p - W] = 1), (stack[sp++] = p - W);
      if (y < H - 1 && mask[p + W] && !seen[p + W]) (seen[p + W] = 1), (stack[sp++] = p + W);
    }
    if (area >= minArea) out.push({ x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1, area });
  }
  return out;
}

/**
 * 포스터에서 그림 패널들의 픽셀 바운딩 박스를 찾는다.
 * @param {number} want 기대 패널 수
 */
async function findPanels(file, want) {
  const { data, info } = await sharp(file).greyscale().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info;

  const { sd, bw, bh } = blockSD(data, W, H);

  // 임계값: 상위 분포에서 자동 결정
  const sorted = Float32Array.from(sd).sort();
  const p60 = sorted[Math.floor(sorted.length * 0.6)];
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  const thr = Math.max(12, Math.min(p60 * 1.6, p95 * 0.45));

  let mask = new Uint8Array(bw * bh);
  for (let i = 0; i < sd.length; i++) mask[i] = sd[i] > thr ? 1 : 0;

  // 상단 제목 띠 / 하단 캡션 제거
  const yTop = Math.floor(bh * 0.14);
  const yBot = Math.floor(bh * 0.94);
  mask.fill(0, 0, yTop * bw);
  mask.fill(0, yBot * bw);

  mask = dilate(mask, bw, bh, 2);

  const comps = components(mask, bw, bh, 8)
    // 캡션 글자줄 제외: 너무 납작한 것
    .filter((c) => c.h >= bh * 0.12 && c.w >= bw * 0.04)
    .sort((a, b) => b.area - a.area)
    .slice(0, want)
    .sort((a, b) => a.x0 - b.x0);

  // 블록 → 픽셀 (팽창분 1블록 되돌림)
  return comps.map((c) => ({
    left: Math.max(0, (c.x0 + 1) * B),
    top: Math.max(0, (c.y0 + 1) * B),
    width: Math.min(W, (c.w - 1) * B),
    height: Math.min(H, (c.h - 1) * B),
  })).filter((c) => c.width > 16 && c.height > 16);
}

async function convert(src, crop, w, h, outPath) {
  let pipe = sharp(src);
  if (crop) pipe = pipe.extract(crop);
  const buf = await pipe
    .resize(w, h, { kernel: 'lanczos3', fit: 'fill' })
    .png({ palette: true, colors: COLORS, dither: 0.4, compressionLevel: 9 })
    .toBuffer();
  await sharp(buf).toFile(outPath);
}

// ─────────────────────────────────────────────

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  await mkdir(dirname(OUT_JSON), { recursive: true });

  const meta = { buildings: [], floors: [], colors: COLORS, blockSize: B };
  let failed = 0;

  /** @type {Record<string, Array<{left:number,top:number,width:number,height:number}>>} */
  let override = {};
  try {
    override = JSON.parse(await readFile(OVERRIDE, 'utf8'));
    delete override._readme;
    const n = Object.keys(override).length;
    if (n) console.log(`수동 패널 좌표 ${n}건 적용 (tools/bg-panels.json)\n`);
  } catch {
    /* 없으면 전부 자동 검출 */
  }

  // ── 건물 포스터 (패널 3개씩) ──
  const files = (await readdir(SRC_BUILD)).filter((f) => f.toLowerCase().endsWith('.png')).sort();
  console.log(`건물 포스터 ${files.length}장`);

  let n = 0;
  for (const f of files) {
    n++;
    const id = `build_${String(n).padStart(2, '0')}`;
    const src = resolve(SRC_BUILD, f);
    const boxes = override[f] ?? (await findPanels(src, 3));

    if (boxes.length !== 3) {
      console.warn(`  ! ${id} (${basename(f).slice(0, 30)}): 패널 ${boxes.length}개 감지 → 건너뜀`);
      failed++;
      continue;
    }

    const panels = {};
    for (let i = 0; i < 3; i++) {
      const p = PANELS[i];
      await convert(src, boxes[i], p.w, p.h, resolve(OUT_DIR, `${id}_${p.key}.png`));
      panels[p.key] = { crop: boxes[i], out: `${id}_${p.key}.png`, w: p.w, h: p.h };
    }
    meta.buildings.push({ id, source: f, panels });
    console.log(`  ${id}  ${basename(f).slice(0, 32)}`);
  }

  // ── 층수별 교체 배경 (패널 1개씩) ──
  const floorMap = {
    '200층이상.png': 'floor200',
    '300층이상.png': 'floor300',
    '400층이상.png': 'floor400',
    '500층이상.png': 'floor500',
  };
  for (const [srcName, id] of Object.entries(floorMap)) {
    const src = resolve(SRC_FLOOR, srcName);
    try {
      const boxes = override[srcName] ?? (await findPanels(src, 1));
      const crop = boxes[0] ?? null;
      // 층수 배경은 반복 타일이 아니라 화면 전체(180×320)
      await convert(src, crop, BG.fullW, BG.fullH, resolve(OUT_DIR, `${id}.png`));
      meta.floors.push({ id, source: srcName, crop, w: BG.fullW, h: BG.fullH });
      console.log(`  ${id}  ${srcName}${crop ? '' : '  (패널 미검출 → 전체 사용)'}`);
    } catch (e) {
      console.warn(`  ! ${id}: ${e.message}`);
      failed++;
    }
  }

  await writeFile(OUT_JSON, JSON.stringify(meta, null, 2) + '\n', 'utf8');
  console.log(`\n건물 ${meta.buildings.length}종 · 층수배경 ${meta.floors.length}종`);
  console.log(`  → ${OUT_DIR}`);
  if (failed) console.log(`실패 ${failed}건 — 해당 포스터는 패널 좌표 수동 지정 필요`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
