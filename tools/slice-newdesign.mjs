/**
 * newdesign.png 신발 슬라이서 — 마스터 50×30 체계 (기획서 §9-3)
 *
 * 원본은 픽셀아트풍 렌더링(안티앨리어싱 56%)이라 그대로 못 쓰고,
 * [블롭 검출 → 배경 키잉 → 목표 크기로 축소(lanczos) → 팔레트 양자화]로 도트화한다.
 *
 * ※ 중요: 인게임용 크기는 **원본 고해상도 크롭에서 직접** 만든다.
 *   마스터를 다시 축소하면 두 번 깎여 뭉개진다. (2026-08-14 화질 개선)
 *
 * 출력:
 *   public/assets/shoes/shoes_master.png  520×416 (셀 52×32, 신발 50×30) — 도감
 *   public/assets/shoes/shoes_game.png    420×338 (셀 42×26, 신발 40×24) — 인게임(계단·착용)
 *   public/assets/shoes/shoe_icon.png      18×11                          — HUD 아이콘
 *   src/data/shoes.json
 */

import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = resolve(ROOT, 'etc/신발자료/newdesign.png');
const OUT_DIR = resolve(ROOT, 'public/assets/shoes');
const OUT_JSON = resolve(ROOT, 'src/data/shoes.json');

const COLS = 10;
const ROWS = 13;
const TOTAL = 130;

/** 출력 규격 — 전부 원본 크롭에서 직접 생성한다 */
const MASTER = { w: 50, h: 30, cellW: 52, cellH: 32, colors: 16 };
const GAME = { w: 40, h: 24, cellW: 42, cellH: 26, colors: 14 };
const ICON = { w: 24, h: 15, colors: 10 };

/**
 * HUD 아이콘으로 쓸 신발의 **아틀라스 인덱스** (티어순 정렬 후 기준).
 * 94 = 레드/화이트 클래식 — 작게 줄여도 형태와 색이 또렷하다.
 */
const ICON_ATLAS_INDEX = 94;

const MIN_SRC_H = 90;
const MIN_SRC_AREA = 6000;

// ─────────────────────────────────────────────

/** 원본 크롭 → 지정 크기 RGBA (비율 유지, 알파 이진화) */
async function renderAt(crop, bw, bh, maxW, maxH, colors) {
  let tw = maxW;
  let th = Math.round((bh * maxW) / bw);
  if (th > maxH) {
    th = maxH;
    tw = Math.max(6, Math.round((bw * maxH) / bh));
  }
  const png = await sharp(crop, { raw: { width: bw, height: bh, channels: 4 } })
    .resize(tw, th, { kernel: 'lanczos3', fit: 'fill' })
    .png({ palette: true, colors, dither: 0 })
    .toBuffer();
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 3; i < data.length; i += 4) data[i] = data[i] >= 128 ? 255 : 0;
  return { buf: data, w: info.width, h: info.height };
}

/** 화려함 점수: 색상 다양성 + 고유 색 수 + 평균 채도 */
function colorfulness(s) {
  const colors = new Set();
  const hueBins = new Set();
  let satSum = 0;
  let n = 0;
  for (let i = 0; i < s.buf.length; i += 4) {
    if (s.buf[i + 3] === 0) continue;
    const r = s.buf[i], g = s.buf[i + 1], b = s.buf[i + 2];
    colors.add((r << 16) | (g << 8) | b);
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const sat = max === 0 ? 0 : (max - min) / max;
    satSum += sat;
    n++;
    if (sat > 0.25 && max > 60) {
      let h;
      if (max === r) h = ((g - b) / (max - min) + 6) % 6;
      else if (max === g) h = (b - r) / (max - min) + 2;
      else h = (r - g) / (max - min) + 4;
      hueBins.add(Math.floor(h * 2));
    }
  }
  return hueBins.size * 3 + colors.size * 0.35 + (satSum / Math.max(1, n)) * 6;
}

/** 셀 격자에 스프라이트를 배치 (가로 중앙, 세로 바닥 정렬) */
function blit(atlas, aw, spr, index, cellW, cellH, boxW, boxH) {
  const col = index % COLS;
  const row = (index / COLS) | 0;
  const ox = col * cellW + 1 + ((boxW - spr.w) >> 1);
  const oy = row * cellH + 1 + (boxH - spr.h);
  for (let y = 0; y < spr.h; y++) {
    for (let x = 0; x < spr.w; x++) {
      const si = (y * spr.w + x) * 4;
      if (spr.buf[si + 3] === 0) continue;
      const di = ((oy + y) * aw + ox + x) * 4;
      atlas[di] = spr.buf[si];
      atlas[di + 1] = spr.buf[si + 1];
      atlas[di + 2] = spr.buf[si + 2];
      atlas[di + 3] = 255;
    }
  }
}

// ─────────────────────────────────────────────

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  await mkdir(dirname(OUT_JSON), { recursive: true });

  const { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;

  // ── 배경색: 네 모서리 평균 ──
  let br = 0, bg = 0, bb = 0;
  for (const [x, y] of [[2, 2], [W - 3, 2], [2, H - 3], [W - 3, H - 3]]) {
    const i = (y * W + x) * C;
    br += data[i]; bg += data[i + 1]; bb += data[i + 2];
  }
  br /= 4; bg /= 4; bb /= 4;
  const TOL = 26;
  const isBg = (x, y) => {
    const i = (y * W + x) * C;
    return Math.abs(data[i] - br) < TOL && Math.abs(data[i + 1] - bg) < TOL && Math.abs(data[i + 2] - bb) < TOL;
  };

  // ── 블롭 검출 ──
  const seen = new Uint8Array(W * H);
  const stack = new Int32Array(W * H);
  const blobs = [];

  for (let p0 = 0; p0 < W * H; p0++) {
    const x0 = p0 % W;
    const y0 = (p0 / W) | 0;
    if (seen[p0] || isBg(x0, y0)) continue;
    let sp = 0;
    stack[sp++] = p0;
    seen[p0] = 1;
    let minX = W, minY = H, maxX = -1, maxY = -1, area = 0;
    const pixels = [];
    while (sp > 0) {
      const p = stack[--sp];
      const x = p % W;
      const y = (p / W) | 0;
      area++;
      pixels.push(p);
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      for (const q of [p - 1, p + 1, p - W, p + W]) {
        if (q < 0 || q >= W * H) continue;
        const qx = q % W;
        if (Math.abs(qx - x) > 1) continue;
        if (seen[q]) continue;
        const qy = (q / W) | 0;
        if (isBg(qx, qy)) continue;
        seen[q] = 1;
        stack[sp++] = q;
      }
    }
    if (area < MIN_SRC_AREA) continue;
    if (maxY - minY + 1 < MIN_SRC_H) continue;
    blobs.push({ minX, minY, maxX, maxY, area, pixels });
  }
  console.log(`블롭 검출: ${blobs.length}개`);

  // ── 읽기 순서 정렬 ──
  blobs.forEach((b) => {
    b.cy = (b.minY + b.maxY) / 2;
    b.cx = (b.minX + b.maxX) / 2;
    b.h = b.maxY - b.minY + 1;
  });
  const avgH = blobs.reduce((s, b) => s + b.h, 0) / blobs.length;
  blobs.sort((a, b) => a.cy - b.cy);
  const rows = [];
  for (const b of blobs) {
    const row = rows.find((r) => Math.abs(r.cy - b.cy) < avgH * 0.55);
    if (row) {
      row.items.push(b);
      row.cy = row.items.reduce((s, i) => s + i.cy, 0) / row.items.length;
    } else rows.push({ cy: b.cy, items: [b] });
  }
  rows.sort((a, b) => a.cy - b.cy);
  const ordered = [];
  for (const r of rows) {
    r.items.sort((a, b) => a.cx - b.cx);
    ordered.push(...r.items);
  }

  // ── 원본 크롭 보관 (모든 출력 크기를 여기서 직접 만든다) ──
  const crops = [];
  for (const b of ordered) {
    const bw = b.maxX - b.minX + 1;
    const bh = b.maxY - b.minY + 1;
    const crop = Buffer.alloc(bw * bh * 4, 0);
    for (const p of b.pixels) {
      const x = p % W;
      const y = (p / W) | 0;
      const si = (y * W + x) * C;
      const di = ((y - b.minY) * bw + (x - b.minX)) * 4;
      crop[di] = data[si];
      crop[di + 1] = data[si + 1];
      crop[di + 2] = data[si + 2];
      crop[di + 3] = 255;
    }
    crops.push({ crop, bw, bh });
  }

  if (crops.length < TOTAL) throw new Error(`신발 ${crops.length}개 — ${TOTAL}개 미달`);
  const picked = crops.slice(0, TOTAL);
  if (crops.length > TOTAL) console.log(`  ${crops.length}개 중 앞 ${TOTAL}개 사용`);

  // ── 마스터 렌더 + 티어 랭킹 ──
  const masters = [];
  for (let i = 0; i < picked.length; i++) {
    const { crop, bw, bh } = picked[i];
    const spr = await renderAt(crop, bw, bh, MASTER.w, MASTER.h, MASTER.colors);
    spr.srcIndex = i;
    spr.score = colorfulness(spr);
    masters.push(spr);
  }
  const ranked = [...masters].sort((a, b) => b.score - a.score);
  const tierOf = new Array(TOTAL);
  ranked.forEach((s, rank) => {
    tierOf[s.srcIndex] = rank < 5 ? 1 : rank < 15 ? 2 : rank < 30 ? 3 : rank < 70 ? 4 : 5;
  });
  const order = [...masters].sort(
    (a, b) => tierOf[a.srcIndex] - tierOf[b.srcIndex] || a.srcIndex - b.srcIndex
  );

  // ── 아틀라스 2종 ──
  const MAW = COLS * MASTER.cellW;
  const MAH = ROWS * MASTER.cellH;
  const masterAtlas = Buffer.alloc(MAW * MAH * 4, 0);

  const GAW = COLS * GAME.cellW;
  const GAH = ROWS * GAME.cellH;
  const gameAtlas = Buffer.alloc(GAW * GAH * 4, 0);

  const shoes = [];
  const tierCount = {};
  const TIER_LABEL = ['', '스페셜', '레어', '트라이', '투톤', '베이식'];

  for (let index = 0; index < order.length; index++) {
    const m = order[index];
    const tier = tierOf[m.srcIndex];
    tierCount[tier] = (tierCount[tier] ?? 0) + 1;

    blit(masterAtlas, MAW, m, index, MASTER.cellW, MASTER.cellH, MASTER.w, MASTER.h);

    // 인게임용은 원본 크롭에서 직접 (2차 축소 금지)
    const src = picked[m.srcIndex];
    const g = await renderAt(src.crop, src.bw, src.bh, GAME.w, GAME.h, GAME.colors);
    blit(gameAtlas, GAW, g, index, GAME.cellW, GAME.cellH, GAME.w, GAME.h);

    shoes.push({
      id: `t${tier}_${String(tierCount[tier]).padStart(3, '0')}`,
      index,
      tier,
      name: `${TIER_LABEL[tier]} ${String(tierCount[tier]).padStart(2, '0')}`,
      ax: (index % COLS) * MASTER.cellW + 1,
      ay: ((index / COLS) | 0) * MASTER.cellH + 1,
      aw: MASTER.w,
      ah: MASTER.h,
    });
  }

  await sharp(masterAtlas, { raw: { width: MAW, height: MAH, channels: 4 } })
    .png({ compressionLevel: 9 }).toFile(resolve(OUT_DIR, 'shoes_master.png'));
  await sharp(gameAtlas, { raw: { width: GAW, height: GAH, channels: 4 } })
    .png({ compressionLevel: 9 }).toFile(resolve(OUT_DIR, 'shoes_game.png'));

  // ── HUD 아이콘 ──
  const iconAt = Math.min(ICON_ATLAS_INDEX, order.length - 1);
  const iconSrc = picked[order[iconAt].srcIndex];
  const icon = await renderAt(iconSrc.crop, iconSrc.bw, iconSrc.bh, ICON.w, ICON.h, ICON.colors);
  await sharp(icon.buf, { raw: { width: icon.w, height: icon.h, channels: 4 } })
    .png({ compressionLevel: 9 }).toFile(resolve(OUT_DIR, 'shoe_icon.png'));

  // ── 메타 ──
  const meta = {
    source: 'etc/신발자료/newdesign.png',
    master: { file: 'shoes_master.png', w: MAW, h: MAH, cellW: MASTER.cellW, cellH: MASTER.cellH, shoeW: MASTER.w, shoeH: MASTER.h },
    game: { file: 'shoes_game.png', w: GAW, h: GAH, cellW: GAME.cellW, cellH: GAME.cellH, shoeW: GAME.w, shoeH: GAME.h },
    icon: { file: 'shoe_icon.png', w: icon.w, h: icon.h },
    tiers: [
      { tier: 1, name: 'MAXIMAL', count: 5, prob: 0.05, offset: 0 },
      { tier: 2, name: 'RARE', count: 10, prob: 0.1, offset: 5 },
      { tier: 3, name: 'TRI-COLOUR', count: 15, prob: 0.15, offset: 15 },
      { tier: 4, name: 'TWO-TONE', count: 40, prob: 0.2, offset: 30 },
      { tier: 5, name: 'BASIC', count: 60, prob: 0.5, offset: 70 },
    ],
    shoes,
  };
  await writeFile(OUT_JSON, JSON.stringify(meta, null, 2) + '\n', 'utf8');

  console.log('티어 배정:', JSON.stringify(tierCount));
  console.log(`  master ${MAW}×${MAH} / game ${GAW}×${GAH} / icon ${icon.w}×${icon.h}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
