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
 * 착용(캐릭터 발) 전용 — 2026-08-15 신설.
 *
 * 예전엔 game 아틀라스(40×24)를 런타임에 0.7배로 줄여 그렸다. 비정수 축소라
 * 가장자리 도트가 들쭉날쭉해 "경계가 흐린" 느낌이 났다. 그래서 **원본 크롭에서
 * 착용 크기로 직접 렌더**하고, 캐릭터 위에 얹혀도 형태가 또렷하도록
 * **1도트 진회색 외곽선**을 두른다. (신발 찾기 게임이라 신발이 눈에 띄어야 한다)
 *
 * 신발 알맹이 29×17 + 외곽선 1도트 = 총 31×19 (이전 28×17의 약 1.1배)
 */
const WORN = { w: 29, h: 17, colors: 12, outline: [0x3a, 0x3a, 0x42, 255], cellW: 33, cellH: 21 };

/**
 * HUD 아이콘으로 쓸 신발의 **아틀라스 인덱스** (티어순 정렬 후 기준).
 * 94 = 레드/화이트 클래식 — 작게 줄여도 형태와 색이 또렷하다.
 */
const ICON_ATLAS_INDEX = 94;

const MIN_SRC_H = 90;
const MIN_SRC_AREA = 6000;

// ─────────────────────────────────────────────

/**
 * 내부 구멍 메우기 (2026-08-14).
 *
 * 블롭 검출이 "배경색과 비슷한 픽셀"을 전부 배경으로 보기 때문에,
 * 신발 안쪽의 밝은 면(흰 미드솔·밝은 갑피)이 배경색과 겹치면 그 부분이
 * 통째로 뚫려서 계단이 비쳐 보인다. 테두리에서 도달 가능한 투명 픽셀만
 * "바깥"으로 인정하고, 나머지 투명 픽셀은 이웃 색으로 메운다.
 *
 * @returns {number} 메운 픽셀 수
 */
function fillHoles(buf, w, h) {
  const n = w * h;
  const outside = new Uint8Array(n);
  const stack = [];
  const push = (i) => {
    if (!outside[i] && buf[i * 4 + 3] === 0) {
      outside[i] = 1;
      stack.push(i);
    }
  };
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
  while (stack.length) {
    const p = stack.pop();
    const x = p % w;
    const y = (p / w) | 0;
    if (x > 0) push(p - 1);
    if (x < w - 1) push(p + 1);
    if (y > 0) push(p - w);
    if (y < h - 1) push(p + w);
  }

  let remaining = [];
  for (let i = 0; i < n; i++) if (buf[i * 4 + 3] === 0 && !outside[i]) remaining.push(i);
  const total = remaining.length;
  if (!total) return 0;

  // 구멍 가장자리부터 이웃 불투명 색 평균으로 한 겹씩 채워 들어간다
  while (remaining.length) {
    const next = [];
    const writes = [];
    for (const p of remaining) {
      const x = p % w;
      let r = 0, g = 0, b = 0, c = 0;
      for (const q of [p - 1, p + 1, p - w, p + w]) {
        if (q < 0 || q >= n) continue;
        if (Math.abs((q % w) - x) > 1) continue;
        if (buf[q * 4 + 3] !== 255) continue;
        r += buf[q * 4]; g += buf[q * 4 + 1]; b += buf[q * 4 + 2]; c++;
      }
      if (c) writes.push([p, (r / c) | 0, (g / c) | 0, (b / c) | 0]);
      else next.push(p);
    }
    if (!writes.length) break; // 더 못 채움 (이론상 발생하지 않음)
    for (const [p, r, g, b] of writes) {
      buf[p * 4] = r; buf[p * 4 + 1] = g; buf[p * 4 + 2] = b; buf[p * 4 + 3] = 255;
    }
    remaining = next;
  }
  return total;
}

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
  // 축소·이진화 과정에서 새로 생긴 내부 구멍도 막는다
  fillHoles(data, info.width, info.height);
  return { buf: data, w: info.width, h: info.height };
}

/**
 * 스프라이트 둘레에 1도트 외곽선을 두른다 (8방향 팽창).
 * 반환 스프라이트는 상하좌우로 1도트씩 커진다.
 */
function addOutline(spr, color) {
  const w = spr.w + 2;
  const h = spr.h + 2;
  const buf = Buffer.alloc(w * h * 4, 0);
  const set = (x, y, r, g, b) => {
    const i = (y * w + x) * 4;
    buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = 255;
  };
  // 원본을 (1,1)에 얹는다
  for (let y = 0; y < spr.h; y++) {
    for (let x = 0; x < spr.w; x++) {
      const si = (y * spr.w + x) * 4;
      if (spr.buf[si + 3] === 0) continue;
      set(x + 1, y + 1, spr.buf[si], spr.buf[si + 1], spr.buf[si + 2]);
    }
  }
  // 빈 칸 중 알맹이와 8방향으로 닿는 곳을 외곽선으로
  const solid = (x, y) => x >= 0 && y >= 0 && x < w && y < h && buf[(y * w + x) * 4 + 3] === 255;
  const ring = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (buf[(y * w + x) * 4 + 3] === 255) continue;
      let touch = false;
      for (let dy = -1; dy <= 1 && !touch; dy++)
        for (let dx = -1; dx <= 1 && !touch; dx++)
          if ((dx || dy) && solid(x + dx, y + dy)) touch = true;
      if (touch) ring.push([x, y]);
    }
  }
  for (const [x, y] of ring) set(x, y, color[0], color[1], color[2]);
  return { buf, w, h };
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
  let holePixels = 0;
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
    // 원본 해상도에서 먼저 구멍을 메운다 — 축소 전에 막아야 색이 자연스럽다
    holePixels += fillHoles(crop, bw, bh);
    crops.push({ crop, bw, bh });
  }
  if (holePixels) console.log(`내부 투명 구멍 메움: ${holePixels}px (원본 해상도 기준)`);

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

  const WAW = COLS * WORN.cellW;
  const WAH = ROWS * WORN.cellH;
  const wornAtlas = Buffer.alloc(WAW * WAH * 4, 0);

  const shoes = [];
  const tierCount = {};
  const STAR_NAMES = ["스피카", "베가", "미라", "카펠라", "미모사", "마이아", "메이사", "시리우스", "알비레오", "폴라리스", "알타이르", "안타레스", "카노푸스", "프로키온", "데네브", "샤울라", "알헤나", "메로페", "타이게타", "엘타닌", "하달", "나비", "미르잠", "나시라", "아스켈라", "페트라", "알키오네", "일렉트라", "스테로페", "리겔", "폴룩스", "카스토르", "민타카", "알니람", "알니탁", "사이프", "타비트", "하티사", "티아키", "아르카브", "아비오르", "수하일", "나오스", "레고르", "알페카", "아게나", "사드르", "지에나", "알자나", "에니프", "두베", "알골", "안카", "루크바", "셰다르", "아키르드", "세긴", "알코르", "알리오스", "메라크", "페크다", "메그레즈", "알카이드", "탈리타", "타니아", "알룰라", "하말", "호맘", "마타르", "비함", "아쿠벤스", "알타르프", "아셀루스", "조스마", "알기에바", "아드하라", "웨젠", "알루드라", "푸루드", "물리펜", "쿠르사", "자우라크", "아크라브", "아크룩스", "가크룩스", "사르가스", "눈키", "테자트", "프로푸스", "메브수타", "엘나스", "하살레", "멘칼리난", "마하심", "티안관", "피콕", "투반", "에다시크", "알사피", "네카르", "세기누스", "이자르", "무프리드", "헤제", "포리마", "아우바", "시르마", "자니아", "체르탄", "라살라스", "크라즈", "알고라브", "민카르", "쿠마", "그루미움", "알라키스", "로타네브", "수알로킨", "다비", "알샤트", "알게디", "키탈파", "타라제드", "알샤인", "시툴라", "안세르", "알나슬", "루크바트", "테레벨룸", "알발다"];  // 사용자 지정 130종 이름 (2026-08-19) — index 순서 그대로

  for (let index = 0; index < order.length; index++) {
    const m = order[index];
    const tier = tierOf[m.srcIndex];
    tierCount[tier] = (tierCount[tier] ?? 0) + 1;

    blit(masterAtlas, MAW, m, index, MASTER.cellW, MASTER.cellH, MASTER.w, MASTER.h);

    // 인게임용은 원본 크롭에서 직접 (2차 축소 금지)
    const src = picked[m.srcIndex];
    const g = await renderAt(src.crop, src.bw, src.bh, GAME.w, GAME.h, GAME.colors);
    blit(gameAtlas, GAW, g, index, GAME.cellW, GAME.cellH, GAME.w, GAME.h);

    // 착용용도 원본에서 직접 렌더 + 진회색 외곽선
    const wRaw = await renderAt(src.crop, src.bw, src.bh, WORN.w, WORN.h, WORN.colors);
    const wOut = addOutline(wRaw, WORN.outline);
    blit(wornAtlas, WAW, wOut, index, WORN.cellW, WORN.cellH, WORN.w + 2, WORN.h + 2);

    shoes.push({
      id: `t${tier}_${String(tierCount[tier]).padStart(3, '0')}`,
      index,
      tier,
      name: STAR_NAMES[index] ?? `신발 ${String(index + 1).padStart(3, '0')}`,
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
  await sharp(wornAtlas, { raw: { width: WAW, height: WAH, channels: 4 } })
    .png({ compressionLevel: 9 }).toFile(resolve(OUT_DIR, 'shoes_worn.png'));

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
    worn: { file: 'shoes_worn.png', w: WAW, h: WAH, cellW: WORN.cellW, cellH: WORN.cellH, shoeW: WORN.w + 2, shoeH: WORN.h + 2 },
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
  console.log(`  master ${MAW}×${MAH} / game ${GAW}×${GAH} / worn ${WAW}×${WAH} / icon ${icon.w}×${icon.h}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
