/**
 * 포스터에서 그림 패널을 찾아 규격 크기로 굽는 공용 부품.
 *
 * 시즌1(`downscale-bg.mjs`)과 시즌2(`build-season2-bg.mjs`)가 **같은 검출기**를 쓴다.
 * 예전엔 시즌1 안에 박혀 있었는데, 시즌2를 붙이려고 복사했다가는 한쪽만 고쳐서
 * 두 시즌의 잘라내기 결과가 미묘하게 달라지는 사고가 난다 — 그래서 떼어 냈다.
 *
 * 원본은 픽셀아트가 아니라 매끈하게 렌더된 일러스트다(런렝스 분석 결과 확대배율 1).
 * 따라서 nearest 축소는 노이즈만 남는다. 대신
 *   ① 포스터에서 그림 패널만 잘라내고            → 국소 표준편차 기반 검출
 *   ② 면적 평균(lanczos)으로 규격 크기까지 줄이고
 *   ③ 색을 32색으로 양자화해 도트처럼 각을 세운다.
 */

import sharp from 'sharp';

/** 양자화 색 수 — 낮출수록 도트 느낌이 강해진다 */
export const COLORS = 32;
/** 검출 블록 크기 (px) */
export const B = 16;

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
      let s = 0, s2 = 0;
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
            const nx = x + dx, ny = y + dy;
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
    let x0 = W, y0 = H, x1 = -1, y1 = -1, area = 0;

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
 * 포스터에서 그림 패널들의 픽셀 바운딩 박스를 찾는다 (왼쪽부터 정렬).
 * @param {string} file
 * @param {number} want 기대 패널 수
 */
export async function findPanels(file, want) {
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

/** 잘라내고 규격 크기로 줄인 뒤 32색으로 양자화해서 저장한다 */
export async function convert(src, crop, w, h, outPath) {
  let pipe = sharp(src);
  if (crop) pipe = pipe.extract(crop);
  const buf = await pipe
    .resize(w, h, { kernel: 'lanczos3', fit: 'fill' })
    .png({ palette: true, colors: COLORS, dither: 0.4, compressionLevel: 9 })
    .toBuffer();
  await sharp(buf).toFile(outPath);
}
