/**
 * «좀비와 드래곤» 오락실 카드 배너 + 로비 로고 굽기 — v2 (2026-11-11, 겜팀장 · 대표님 방향)
 *
 *   node tools/build-iandragon-banner.mjs
 *     → public/assets/ui/banner_iandragon.webp        (792x336, 무손실)
 *     → public/assets/ui/banner_iandragon_lobby.webp  (720x305 — 다른 로비 맨 위 그림과 같은 크기)
 *     → public/assets/iandragon-logo.png               (제목 로고 540x150, 투명)
 *     → tools/_out/banner_iandragon_preview.png        (확인용)
 *     → tools/_out/banner-compare-7.png                (배너 7개 — 2줄 x 4칸, 마지막이 좀비와 드래곤)
 *
 * v1 은 도트 캐릭터를 3배 도트판에 찍었지만, v2 는 대표님 지시로 «게임 새 그림 에셋»을 쓴다:
 *   · 틀 = 캐치볼 배너 그대로(무지개 테두리 · 우주 · 은하 · 위 동전 · 아래 좌우 동전 더미) — v1 과 같다. 동전 더미는 지우지 않는다.
 *   · 양옆 성(ai/castles/nest_hp0 · tower_hp0)을 틀 가장자리에 반쯤 걸쳐 세우고, 동전 더미가 성 아랫도리를 가린다.
 *   · 앞에 큰 캐릭터 둘씩: 왼쪽 노바트 · 불똥이(오른쪽을 봄) / 오른쪽 거대 좀비 · 고깔 좀비(왼쪽을 봄).
 *     부품 시트(분홍 배경)를 rig 대로 고해상도로 조립(tools/_banner-chars.mjs)한 뒤 목표 높이로 줄여 792x336 에 바로 얹는다.
 *   · 제목 · 영어 · 반짝이는 v1 처럼 3배 도트판. 「좀비와」 는 좀비 살색 띠, 「드래곤」 · 영어는 v1 그대로.
 * 새 그림 생성 없음 — 기존 에셋을 자르고 이어 붙인다. 성 · 캐릭터는 틀 안쪽(둥근 네모)으로 잘라 네온 테두리를 덮지 않는다.
 */
import { build } from 'esbuild';
import { chromium } from 'playwright';
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { assemble, makeSprite, AI_DIR } from './_banner-chars.mjs';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const BW = 792, BH = 336, Z = 3;
/* 「드래곤」의 래 · 곤 가로획이 800 에선 뭉개져서 굵기 700 + 크기 상한 27 (v1 에서 정한 값) */
const MAXS = 27;
const TITLE_A = '좀비와', TITLE_B = '드래곤', SUB = 'ZOMBIE & DRAGON';

/* =====================================================================
 * 1. 캐치볼 배너를 바탕판으로 — 가운데 내용만 지우고 우주 배경을 이어 채운다 (줄넘기 · v1 과 같은 방법)
 * ===================================================================== */
const { data: src } = await sharp(path.join(root, 'public/assets/ui/banner_catchball.webp')).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const plate = Buffer.from(src);
const at = (x, y) => (y * BW + x) * 3;
const ERASE = [
  [212, 50, 588, 232],    // 캐치볼 제목 + CATCH BALL
  [288, 204, 512, 288],   // 공 + 꼬리
  [104, 114, 272, 305],   // 왼쪽 선수
  [538, 114, 698, 305],   // 오른쪽 선수
  [104, 278, 698, 305],   // 잔디 줄 (아래 테두리 빛은 건드리지 않는다)
  [150, 278, 186, 296, true],   // 잔디 줄에 남은 금빛 부스러기
  [590, 276, 650, 294, true],
  [640, 270, 668, 300, true],
  [112, 294, 128, 306, true],
];
fs.writeFileSync(path.join(root, 'tools/_out/_idg-erase.json'), JSON.stringify(ERASE));
const isGold = (i) => { const r = src[i], g = src[i + 1], b = src[i + 2]; return r > b + 40 && g > r * 0.42 && r >= g && r > 70; };
const er = new Uint8Array(BW * BH);
for (const [x0, y0, x1, y1, all] of ERASE) for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
  const nearPile = !all && (x < 186 || x > 640) && y > 236;   // 더미 가장자리 금빛 칸은 남긴다
  if (nearPile && isGold(at(x, y))) continue;
  er[y * BW + x] = 1;
}
const G = 4, GW = Math.ceil(BW / G), GH = Math.ceil(BH / G);
const gr = new Float32Array(GW * GH * 3), known = new Uint8Array(GW * GH);
for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) {
  let n = 0, r = 0, g = 0, b = 0, tot = 0;
  for (let y = gy * G; y < Math.min(BH, gy * G + G); y++) for (let x = gx * G; x < Math.min(BW, gx * G + G); x++) {
    tot++;
    if (er[y * BW + x]) continue;
    const i = at(x, y), R = src[i], Gc = src[i + 1], B = src[i + 2];
    if (B > R + 25 && B >= Gc && R + Gc + B < 420) { n++; r += R; g += Gc; b += B; }
  }
  const k = (gy * GW + gx) * 3;
  if (n >= tot * 0.5) { gr[k] = r / n; gr[k + 1] = g / n; gr[k + 2] = b / n; known[gy * GW + gx] = 1; }
}
for (let i = 0; i < GW * GH; i++) if (!known[i]) { gr[i * 3] = 2; gr[i * 3 + 1] = 30; gr[i * 3 + 2] = 120; }
for (let it = 0; it < 1500; it++) {
  for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) {
    const id = gy * GW + gx;
    if (known[id]) continue;
    let r = 0, g = 0, b = 0, n = 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = gx + dx, y = gy + dy;
      if (x < 0 || y < 0 || x >= GW || y >= GH) continue;
      const j = (y * GW + x) * 3; r += gr[j]; g += gr[j + 1]; b += gr[j + 2]; n++;
    }
    gr[id * 3] = r / n; gr[id * 3 + 1] = g / n; gr[id * 3 + 2] = b / n;
  }
}
const bgAt = (x, y) => {
  const fx = Math.max(0, Math.min(GW - 1.001, x / G - 0.5)), fy = Math.max(0, Math.min(GH - 1.001, y / G - 0.5));
  const x0 = Math.floor(fx), y0 = Math.floor(fy), u = fx - x0, v = fy - y0;
  const c = (gx, gy, k) => gr[(gy * GW + gx) * 3 + k];
  return [0, 1, 2].map((k) => (c(x0, y0, k) * (1 - u) + c(x0 + 1, y0, k) * u) * (1 - v) + (c(x0, y0 + 1, k) * (1 - u) + c(x0 + 1, y0 + 1, k) * u) * v);
};
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const STAR = [[255, 255, 255], [191, 224, 255], [255, 214, 240], [255, 243, 160], [170, 190, 255]];
for (let by = 0; by < BH; by += Z) for (let bx = 0; bx < BW; bx += Z) {
  let any = false;
  for (let y = by; y < by + Z; y++) for (let x = bx; x < bx + Z; x++) if (er[y * BW + x]) any = true;
  if (!any) continue;
  let col = bgAt(bx + 1, by + 1).map((v) => Math.round(v));
  if (rnd() < 0.022) col = STAR[Math.floor(rnd() * STAR.length)];
  for (let y = by; y < by + Z; y++) for (let x = bx; x < bx + Z; x++) if (er[y * BW + x]) { const i = at(x, y); plate[i] = col[0]; plate[i + 1] = col[1]; plate[i + 2] = col[2]; }
}

/* =====================================================================
 * 2. 우리 도트 그림(투명 3배 도트판 264x112: 제목 · 영어 · 반짝이) + 로고 — 브라우저에서 찍는다
 * ===================================================================== */
const bundle = await build({
  stdin: { contents: "import * as B from './tools/_banner-art.mjs'; window.B = B;", resolveDir: root, loader: 'js' },
  bundle: true, write: false, format: 'iife',
});
const FONTS = [
  ['C:/Windows/Fonts/NotoSansKR-VF.ttf', 700, 0],
  ['C:/Windows/Fonts/malgunbd.ttf', 700, 0],
];
const [fontFile, WT, THIN] = FONTS.find(([f]) => fs.existsSync(f)) || [];
if (!fontFile) throw new Error('제목 글꼴을 찾지 못했습니다');
const fontCss = `@font-face { font-family: 'TITLE'; src: url(data:font/ttf;base64,${fs.readFileSync(fontFile).toString('base64')}); font-weight: 100 900; }`;

const browser = await chromium.launch({ channel: 'chrome' }).catch(() => chromium.launch());
const page = await browser.newPage();
await page.setContent(`<!doctype html><html><head><style>${fontCss}</style></head><body></body></html>`);
await page.addScriptTag({ content: bundle.outputFiles[0].text });

/* 가운데는 비워 두고 반짝이만 (도트 좌표) */
const SPARKS = [[106, 72, true], [150, 90, false], [128, 101, false], [160, 66, false], [96, 98, false], [172, 100, true]];
const out = await page.evaluate(async ({ WT, THIN, TITLE_A, TITLE_B, SUB, MAXS, SPARKS }) => {
  await document.fonts.load(`${WT} 30px 'TITLE'`, TITLE_A + TITLE_B);
  const { B } = window;
  const { W, H } = B;
  B.reseed(11);
  const NAVY = '#0c0a26';
  const RB = ['#ff3d6e', '#ff9a1a', '#ffe14d', '#4dd27a', '#3fc4ff', '#6a5cff', '#d24dff'];
  const rainbow = (x0, w) => (x) => RB[Math.max(0, Math.min(RB.length - 1, Math.floor(((x - x0) / w) * RB.length)))];
  const GAP = 7;
  const fit = (maxW, hMax) => {
    for (let s = MAXS; s > 16; s--) {
      const a = B.mask(TITLE_A, 'TITLE', s, WT, 1, THIN), b = B.mask(TITLE_B, 'TITLE', s, WT, 1, THIN);
      if (a.w + GAP + b.w <= maxW && Math.max(a.h, b.h) <= hMax) return [a, b, s];
    }
  };
  const [t1, t2, size] = fit(196, 27);
  const [l1, l2, lsize] = fit(174, 27);
  const T1 = ['#e4f5c4', '#c6e69a', '#a6d27a', '#86b862', '#6a9a4e', '#4f7c3e'];             // 좀비와 — 좀비 살색(창백한 초록)
  const T2 = ['#f0fffa', '#a8fff0', '#5ff0d0', '#3fd890', '#2fb8c8', '#3a7dff'];             // 드래곤 — 하늘 → 초록 → 파랑 (v1 그대로)
  const tO = (bands, side, rb) => ({ bands, depth: 3, side, edges: [[NAVY, 1], [rb, 2]], glow: null });
  const drawTitle = (c, x, y, a, b) => {
    const rb = rainbow(x - 2, a.w + GAP + b.w + 4);
    B.title(c, a, x, y, tO(T1, '#1f3a22', rb));
    B.title(c, b, x + a.w + GAP, y, tO(T2, '#123a7a', rb));
  };
  const sub = B.pixelMask(SUB, 1);
  const subO = { bands: ['#ffa526'], depth: 0, edges: [[NAVY, 1]], glow: null, flat: true };

  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  const tw = t1.w + GAP + t2.w, titleX = Math.round((W - tw) / 2), titleY = 12;
  const th = Math.max(t1.h, t2.h);
  const subY = titleY + th + 3 + 4;
  drawTitle(c, titleX, titleY, t1, t2);
  B.title(c, sub, Math.round((W - sub.w) / 2), subY, subO);
  for (const [x, y, big] of SPARKS) B.sparkle(c, x, y, big);
  const d = c.getImageData(0, 0, W, H).data;
  let semi = 0; for (let i = 3; i < d.length; i += 4) if (d[i] !== 0 && d[i] !== 255) semi++;

  const ltw = l1.w + GAP + l2.w, LW = 180, LH = 4 + Math.max(l1.h, l2.h) + 2 + 5 + sub.h + 3;
  const L = document.createElement('canvas'); L.width = LW; L.height = LH;
  const l = L.getContext('2d');
  drawTitle(l, Math.round((LW - ltw) / 2), 3, l1, l2);
  B.title(l, sub, Math.round((LW - sub.w) / 2), 3 + Math.max(l1.h, l2.h) + 2 + 4, subO);
  const dl = l.getImageData(0, 0, LW, LH).data;
  let semiL = 0; for (let i = 3; i < dl.length; i += 4) if (dl[i] !== 0 && dl[i] !== 255) semiL++;
  return { over: cv.toDataURL('image/png'), logo: L.toDataURL('image/png'), size, lsize, tw, ltw, th, sub: sub.w, subY, titleX, titleY, lw: LW, lh: LH, semi, semiL };
}, { WT, THIN, TITLE_A, TITLE_B, SUB, MAXS, SPARKS });
await browser.close();
const png = (u) => Buffer.from(u.split(',')[1], 'base64');
const over = await sharp(png(out.over)).resize(BW, BH, { kernel: 'nearest' }).ensureAlpha().raw().toBuffer();
fs.writeFileSync(path.join(root, 'tools/_out/_idg-dotplate.png'), png(out.over));

/* =====================================================================
 * 3. 성 · 캐릭터를 792x336 에 바로 얹는다 (3배 도트판이 아니라 원래 해상도 — 그림 결을 지킨다)
 *    바탕판 → 땅 빛 → 성(틀 가장자리에 반쯤) → 동전 더미가 성 아랫도리를 가림 → 캐릭터 → 도트판(제목 · 영어 · 반짝이)
 * ===================================================================== */
const cv = Buffer.alloc(BW * BH * 4);                         // 합성판 RGBA(불투명)
for (let i = 0, j = 0; i < BW * BH * 4; i += 4, j += 3) { cv[i] = plate[j]; cv[i + 1] = plate[j + 1]; cv[i + 2] = plate[j + 2]; cv[i + 3] = 255; }
/* 틀 안쪽(둥근 네모) — 네온 테두리를 덮지 않도록 잘라내는 틈. 캐치볼 틀 측정: 흰 줄 x≈15~17 / 773~777 · 아래 y≈314~318 · 위 y≈27 */
const CL = { x0: 22, y0: 33, x1: 769, y1: 311, r: 22 };
const inside = (x, y) => {
  if (x < CL.x0 || x > CL.x1 || y < CL.y0 || y > CL.y1) return false;
  const cx = x < CL.x0 + CL.r ? CL.x0 + CL.r : x > CL.x1 - CL.r ? CL.x1 - CL.r : x;
  const cy = y < CL.y0 + CL.r ? CL.y0 + CL.r : y > CL.y1 - CL.r ? CL.y1 - CL.r : y;
  return (x - cx) ** 2 + (y - cy) ** 2 <= CL.r * CL.r;
};
/* 땅 빛 — 왼쪽은 따뜻한 주황 · 오른쪽은 병든 연두. 가장자리가 부드럽게 사라지는 타원 두 개(세기 낮음) */
const glow = (cx, cy, rx, ry, col, amax) => {
  for (let y = Math.max(0, cy - ry | 0); y < Math.min(BH, cy + ry); y++) for (let x = Math.max(0, cx - rx | 0); x < Math.min(BW, cx + rx); x++) {
    if (!inside(x, y)) continue;
    const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
    if (d >= 1) continue;
    const a = amax * (1 - d) * (1 - d), i = (y * BW + x) * 4;
    for (let k = 0; k < 3; k++) cv[i + k] = Math.round(cv[i + k] * (1 - a) + col[k] * a);
  }
};
glow(130, 300, 190, 120, [255, 170, 70], 0.26);
glow(662, 300, 190, 120, [150, 230, 100], 0.24);

/* 동전 더미 마스크 — 바탕판에서 «따뜻한 색이 빽빽한 곳». 성이 이 마스크 뒤로 들어간다 */
const warm = new Uint8Array(BW * BH);
for (let y = 150; y < BH; y++) for (let x = CL.x0 - 2; x <= CL.x1 + 2; x++) { const i = at(x, y); if (plate[i] > plate[i + 2] + 35 && plate[i] > 60) warm[y * BW + x] = 1; }
const pile = new Uint8Array(BW * BH);
for (let y = 153; y < BH - 3; y++) for (let x = CL.x0; x <= CL.x1; x++) {
  if (!warm[y * BW + x]) continue;
  let n = 0; for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) n += warm[(y + dy) * BW + x + dx];
  if (n >= 30) pile[y * BW + x] = 1;
}
/* 더미에서 떨어져 떠 있는 동전은 빼고(성이 그 앞에 선다) 바닥에 이어진 덩어리만 남긴다 */
{
  const lab = new Uint8Array(BW * BH);
  for (let s0 = 0; s0 < BW * BH; s0++) {
    if (!pile[s0] || lab[s0]) continue;
    const st = [s0], mem = []; lab[s0] = 1; let maxY = 0;
    while (st.length) {
      const p = st.pop(); mem.push(p); const x = p % BW, y = (p / BW) | 0; if (y > maxY) maxY = y;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const q = (y + dy) * BW + x + dx; if (q >= 0 && q < BW * BH && pile[q] && !lab[q]) { lab[q] = 1; st.push(q); } }
    }
    if (maxY < 296) for (const p of mem) pile[p] = 0;
  }
}
const behindPile = new Uint8Array(BW * BH);

const blit = (spr, ox, oy, isCastle = false) => {
  for (let y = 0; y < spr.h; y++) for (let x = 0; x < spr.w; x++) {
    const s = (y * spr.w + x) * 4;
    if (!spr.data[s + 3]) continue;
    const X = ox + x, Y = oy + y;
    if (X < 0 || Y < 0 || X >= BW || Y >= BH || !inside(X, Y)) continue;
    const t = (Y * BW + X) * 4;
    cv[t] = spr.data[s]; cv[t + 1] = spr.data[s + 1]; cv[t + 2] = spr.data[s + 2]; cv[t + 3] = 255;
    if (isCastle) behindPile[Y * BW + X] = 1;
  }
};
const sheetOf = { novart: 'novart_015.png', bulttong: 'bulttong_008.png', bossGiant: 'bossGiant_014.png', cone: 'cone_010.png' };
const hi = {};
for (const id of Object.keys(sheetOf)) hi[id] = (await assemble(id, sheetOf[id])).png;
const castlePng = (n) => fs.readFileSync(path.join(AI_DIR, 'castles', n + '.png'));
const PL = { castleH: 270, floorY: 314 };
/* 성 — 왼쪽(용 둥지) · 오른쪽(좀비 탑). 틀 가장자리에 걸쳐 절반쯤만 보인다 */
const nest = await makeSprite(castlePng('nest_hp0'), { height: PL.castleH, ring: 1 });
const tower = await makeSprite(castlePng('tower_hp0'), { height: PL.castleH, ring: 1 });
const cTop = PL.floorY - PL.castleH;
const nestX = CL.x0 - Math.round(nest.w * 0.45), towerX = CL.x1 - Math.round(tower.w * 0.55);
blit(nest, nestX, cTop, true);
blit(tower, towerX, cTop, true);
/* 동전 더미가 성 아랫도리를 가린다 */
for (let y = 0; y < BH; y++) for (let x = 0; x < BW; x++) if (behindPile[y * BW + x] && pile[y * BW + x]) { const i = at(x, y), t = (y * BW + x) * 4; cv[t] = plate[i]; cv[t + 1] = plate[i + 1]; cv[t + 2] = plate[i + 2]; }

/* 캐릭터 — 크기(높이) · 발 닿는 줄 · 가로 자리(왼쪽 끝 x) */
const CH = [
  /* 뒤 → 앞 */
  { id: 'bulttong', h: 132, foot: 304, x: 26, flip: false },
  { id: 'novart', h: 168, foot: 309, x: 96, flip: false },
  { id: 'bossGiant', h: 190, foot: 309, x: 580, flip: true },
  { id: 'cone', h: 132, foot: 307, x: 508, flip: true },
];
const placed = {};
for (const c of CH) {
  const spr = await makeSprite(hi[c.id], { height: c.h, flip: c.flip, ring: 1 });
  const ox = c.x - spr.pad, oy = c.foot - (spr.h - spr.pad);
  blit(spr, ox, oy);
  placed[c.id] = { x: c.x, y: oy + spr.pad, w: spr.w - spr.pad * 2, h: c.h, foot: c.foot };
}

/* 도트판(제목 · 영어 · 반짝이)을 맨 위에 */
const base = await sharp(cv, { raw: { width: BW, height: BH, channels: 4 } }).png().toBuffer();
const banner = await sharp(base).composite([{ input: await sharp(over, { raw: { width: BW, height: BH, channels: 4 } }).png().toBuffer() }]).removeAlpha().png().toBuffer();

/* =====================================================================
 * 4. 저장 · 비교 그림
 * ===================================================================== */
await sharp(banner).webp({ lossless: true }).toFile(path.join(root, 'public/assets/ui/banner_iandragon.webp'));
await sharp(banner).toFile(path.join(root, 'tools/_out/banner_iandragon_preview.png'));
/* 로비 맨 위 그림 크기(로비마다 720x305 · 479x205 로 미리 줄여 쓴다 — 가로세로 비율 2.36) */
await sharp(banner).resize(720, 305, { kernel: 'lanczos3' }).webp({ lossless: true }).toFile(path.join(root, 'public/assets/ui/banner_iandragon_lobby.webp'));
await sharp(png(out.logo)).resize(out.lw * 3, out.lh * 3, { kernel: 'nearest' }).png({ compressionLevel: 9 }).toFile(path.join(root, 'public/assets/iandragon-logo.png'));
const ORDER = ['banner_find_shoes', 'banner_dragon_striker', 'banner_catchball', 'banner_catchball3d', 'banner_jumprope', 'banner_jumppiano'];
const GAPX = 12, cols = 4;
const tiles = [];
for (const [i, n] of ORDER.entries()) tiles.push({ input: await sharp(path.join(root, 'public/assets/ui', n + '.webp')).png().toBuffer(), left: (i % cols) * (BW + GAPX), top: Math.floor(i / cols) * (BH + GAPX) });
tiles.push({ input: banner, left: (6 % cols) * (BW + GAPX), top: Math.floor(6 / cols) * (BH + GAPX) });
await sharp({ create: { width: BW * cols + GAPX * (cols - 1), height: BH * 2 + GAPX, channels: 3, background: '#000' } })
  .composite(tiles).png().toFile(path.join(root, 'tools/_out/banner-compare-7.png'));
console.log(`글꼴 ${path.basename(fontFile)}(${WT}) · 제목 ${out.size}px 폭 ${out.tw} 높이 ${out.th} (x=${out.titleX}, y=${out.titleY}) · 영어 «${SUB}» 폭 ${out.sub} (y=${out.subY}) · 로고 ${out.lw}x${out.lh}칸`);
console.log('반투명 칸 — 도트판', out.semi, '· 로고', out.semiL);
console.log('성 자리', JSON.stringify({ nestX, towerX, cTop, nest: [nest.w, nest.h], tower: [tower.w, tower.h] }));
console.log('캐릭터 자리', JSON.stringify(placed));
for (const f of ['public/assets/ui/banner_iandragon.webp', 'public/assets/ui/banner_iandragon_lobby.webp', 'public/assets/iandragon-logo.png', 'tools/_out/banner_iandragon_preview.png', 'tools/_out/banner-compare-7.png']) console.log('✓', f, fs.statSync(path.join(root, f)).size, 'bytes');
