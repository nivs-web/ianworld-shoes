/**
 * «점프 피아노» 오락실 카드 배너 (2026-11-07) — 줄넘기 챔피언 배너와 같은 틀 · 같은 배경. 제목 «점프»(파랑) «피아노»(누런 주황), 가운데 작은 건반 치기, 양쪽 건반 위 두 아이
 *
 *   node tools/build-jumprope-banner.mjs
 *     → public/assets/ui/banner_jumppiano.webp   (792x336)
 *     → public/assets/jumprope-logo.png          (로비 제목 — 도트 180칸 폭을 3배, 화면 360px 에 딱 2배)
 *     → tools/_out/banner_jumppiano_preview.png    (확인용)
 *     → tools/_out/banner-compare-piano.png             (캐치볼 · 드래곤 · 줄넘기 나란히)
 *
 * 권반장 지시: «캐치볼 만들 때 디자인 스킨을 가져와» — 그래서 틀은 **캐치볼 배너의 픽셀을 그대로** 쓴다
 * (무지개 테두리 · 좌우 동전 더미 · 위 가운데 동전 · 은하 · 우주 배경). 가운데 내용(제목 · 선수 둘 · 공 · 잔디 줄)만 지우고,
 * 지운 자리는 둘레 우주 배경의 색 흐름을 이어 채운 뒤(확산 채움) 도트 별을 뿌린다. 그 위에 우리 것을 3배 도트로 올린다:
 * 제목(노토 산스 KR Bold — 드래곤 · 캐치볼처럼 획이 고른 고딕 · 얇은 진한 테 + 바깥 무지개 테) ·
 * 영어(밝은 주황 단색 + 아주 진한 남색 얇은 테) · 양옆 신나게 뛰는 두 아이 · 가운데 시상대 위 트로피.
 * 글꼴은 «가면»으로만 쓴다(문턱 128) — 우리 그림은 전부 tools/_banner-art.mjs 가 한 칸씩 찍는다(AI 생성 0).
 */
import { build } from 'esbuild';
import { chromium } from 'playwright';
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const BW = 792, BH = 336, Z = 3;
const KIDS = [[40, 44, 'boy'], [224, 44, 'girl']];          // 아이 자리(도트): 머리 가운데 X, Y — 캐치볼 두 선수 자리

/* =====================================================================
 * 1. 캐치볼 배너를 바탕판으로 — 가운데 내용만 지우고 우주 배경을 이어 채운다
 * ===================================================================== */
const { data: src } = await sharp(path.join(root, 'public/assets/ui/banner_catchball.webp')).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const plate = Buffer.from(src);
const at = (x, y) => (y * BW + x) * 3;
/* 지울 곳 (원본 px). 동전 더미와 겹치는 아래 바깥쪽은 «금빛 칸만 남기고» 지운다 */
const ERASE = [
  [212, 50, 588, 232],    // 캐치볼 제목 + CATCH BALL
  [288, 204, 512, 288],   // 공 + 꼬리
  [104, 114, 272, 305],   // 왼쪽 선수
  [538, 114, 698, 305],   // 오른쪽 선수
  [104, 278, 698, 305],   // 잔디 줄 (아래 테두리 빛은 건드리지 않는다)
  /* 아이 무릎 사이로 보이는 곳 — 더미 가장자리 동전 조각이 «다리 사이 금덩이»처럼 보여서 통째로 비운다 */
  ...KIDS.map(([X, Y]) => [(X - 5) * Z, (Y + 27) * Z, (X + 5) * Z, (Y + 43) * Z, true]),
];
const isGold = (i) => { const r = src[i], g = src[i + 1], b = src[i + 2]; return r > b + 40 && g > r * 0.42 && r >= g && r > 70; };   // 연두(잔디)는 빼고
const er = new Uint8Array(BW * BH);
for (const [x0, y0, x1, y1, all] of ERASE) for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
  const nearPile = !all && (x < 186 || x > 640) && y > 236;   // 더미 가장자리만 (선수 글러브 · 반짝이는 지운다)
  if (nearPile && isGold(at(x, y))) continue;
  er[y * BW + x] = 1;
}
/* 배경 색 흐름: 4px 칸마다 «배경처럼 보이는»(파랑이 강하고 어두운) 칸의 평균 → 모르는 칸은 확산으로 채운다 */
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
/* 모르는 칸 = 이웃 평균을 되풀이 (라플라스 채움) */
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
const bgAt = (x, y) => {                                   // 칸 가운데끼리 이어 읽기
  const fx = Math.max(0, Math.min(GW - 1.001, x / G - 0.5)), fy = Math.max(0, Math.min(GH - 1.001, y / G - 0.5));
  const x0 = Math.floor(fx), y0 = Math.floor(fy), u = fx - x0, v = fy - y0;
  const c = (gx, gy, k) => gr[(gy * GW + gx) * 3 + k];
  return [0, 1, 2].map((k) => (c(x0, y0, k) * (1 - u) + c(x0 + 1, y0, k) * u) * (1 - v) + (c(x0, y0 + 1, k) * (1 - u) + c(x0 + 1, y0 + 1, k) * u) * v);
};
/* 지운 칸 칠하기 — 3x3 덩어리(우리 도트 격자)로. 별은 도트 한 칸씩 뿌린다 */
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const STAR = [[255, 255, 255], [191, 224, 255], [255, 214, 240], [255, 243, 160], [170, 190, 255]];
for (let by = 0; by < BH; by += Z) for (let bx = 0; bx < BW; bx += Z) {
  let any = false;
  for (let y = by; y < by + Z; y++) for (let x = bx; x < bx + Z; x++) if (er[y * BW + x]) any = true;
  if (!any) continue;
  let col = bgAt(bx + 1, by + 1).map((v) => Math.round(v));
  if (rnd() < 0.003) col = STAR[Math.floor(rnd() * STAR.length)];
  for (let y = by; y < by + Z; y++) for (let x = bx; x < bx + Z; x++) if (er[y * BW + x]) { const i = at(x, y); plate[i] = col[0]; plate[i + 1] = col[1]; plate[i + 2] = col[2]; }
}

/* =====================================================================
 * 2. 우리 그림(투명 도트 264x112 + 로고) — 브라우저에서 찍는다
 * ===================================================================== */
const bundle = await build({
  stdin: { contents: "import * as B from './tools/_banner-art.mjs'; import { bannerMask } from './src/games/jumprope/art.js'; window.B = B; window.BM = bannerMask;", resolveDir: root, loader: 'js' },
  bundle: true, write: false, format: 'iife',
});
/* 제목 글꼴 — 노토 산스 KR ExtraBold(800): 드래곤 · 캐치볼 제목처럼 획 굵기가 고른 굵은 고딕. 테두리는 얇게(진한 남색 1칸 + 바깥 무지개 1칸).
 * (도현체 · 주아 · 한나도 찍어 봤지만 이 크기에선 «줄»의 ㅈ · «챔»의 ㅊ 이 뭉개져 읽기 어려웠다. 900 도 «줄»이 뭉개진다) */
const FONTS = [
  ['C:/Windows/Fonts/NotoSansKR-VF.ttf', 800, 0],
  ['C:/Windows/Fonts/malgunbd.ttf', 700, 0],
];
const [fontFile, WT, THIN] = FONTS.find(([f]) => fs.existsSync(f)) || [];
if (!fontFile) throw new Error('제목 글꼴을 찾지 못했습니다');
const fontCss = `@font-face { font-family: 'TITLE'; src: url(data:font/ttf;base64,${fs.readFileSync(fontFile).toString('base64')}); font-weight: 100 900; }`;

const browser = await chromium.launch({ channel: 'chrome' }).catch(() => chromium.launch());
const page = await browser.newPage();
await page.setContent(`<!doctype html><html><head><style>${fontCss}</style></head><body></body></html>`);
await page.addScriptTag({ content: bundle.outputFiles[0].text });

const out = await page.evaluate(async ({ WT, THIN, KIDS }) => {
  await document.fonts.load(`${WT} 30px 'TITLE'`, '점프피아노');
  const { B } = window;
  const { W, H } = B;
  B.reseed(11);
  const NAVY = '#0c0a26';                                                                    // 우주 배경색에 가까운 아주 진한 남색
  const RB = ['#ff3d6e', '#ff9a1a', '#ffe14d', '#4dd27a', '#3fc4ff', '#6a5cff', '#d24dff'];
  const rainbow = (x0, w) => (x) => RB[Math.max(0, Math.min(RB.length - 1, Math.floor(((x - x0) / w) * RB.length)))];

  /* ---- 제목 크기 = 드래곤(글자 높이 ≈21칸)과 캐치볼(≈32칸)의 중간 ≈ 26칸 ---- */
  const GAP = 7;
  const fit = (maxW, hMax) => {
    for (let s = 36; s > 16; s--) {
      const a = B.mask('점프', 'TITLE', s, WT, 1, THIN), b = B.mask('피아노', 'TITLE', s, WT, 1, THIN);
      if (a.w + GAP + b.w <= maxW && Math.max(a.h, b.h) <= hMax) return [a, b, s];
    }
  };
  const [t1, t2, size] = fit(196, 27);
  const [l1, l2, lsize] = fit(174, 27);
  const T1 = ['#fff8c8', '#ffe85a', '#ffd21f', '#ffb21a', '#ff8a1a', '#ff5a1a'];             // 줄넘기 — 노랑 → 주황
  const T2 = ['#f0fffa', '#a8fff0', '#5ff0d0', '#3fd890', '#2fb8c8', '#3a7dff'];             // 챔피언 — 하늘 → 초록 → 파랑
  const tO = (bands, side, rb) => ({ bands, depth: 3, side, edges: [[NAVY, 1], [rb, 2]], glow: null });
  const drawTitle = (c, x, y, a, b) => {
    const rb = rainbow(x - 2, a.w + GAP + b.w + 4);
    B.title(c, a, x, y, tO(T2, '#123a7a', rb));
    B.title(c, b, x + a.w + GAP, y, tO(T1, '#8a2a00', rb));
  };
  /* ---- 영어: 밝은 주황 단색 + 진한 남색 얇은 테 ---- */
  const sub = B.pixelMask('JUMP PIANO', 1);
  const subO = { bands: ['#ffa526'], depth: 0, edges: [[NAVY, 1]], glow: null, flat: true };

  /* ===== 배너 위에 올릴 투명 도트 판 264x112 — 점프 피아노 ===== */
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  const R = (x, y, w, h, col) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h))); };
  const globe = (cx, cy, rx, ry, col, a) => { c.globalAlpha = a; for (let y = -ry; y <= ry; y++) { const w = Math.round(rx * Math.sqrt(1 - (y * y) / (ry * ry))); R(cx - w, cy + y, w * 2, 1, col); } c.globalAlpha = 1; };
  const tw = t1.w + GAP + t2.w, titleX = Math.round((W - tw) / 2), titleY = 12;
  const subY = titleY + Math.max(t1.h, t2.h) + 3 + 4;

  /* 건반 한 벌 그리기 — (x, y) 왼쪽 위, 흰 건반 n개, 폭 kw, 높이 kh, 눌린 흰 건반 번호 */
  const keys = (x0, y0, n, kw, kh, pressed, pc = '#5aa0f0', ph = '#9fd0ff', pd = '#2f62b8') => {
    R(x0 - 1, y0 - 1, n * kw + 1, kh + 2, '#0c0a26');
    for (let i = 0; i < n; i++) {
      const x = x0 + i * kw, p = pressed.has(i);
      R(x, y0, kw - 1, kh, p ? pc : '#f8f9ff'); R(x, y0, kw - 1, 1, p ? ph : '#ffffff');
      R(x, y0 + kh - 2, kw - 1, 2, p ? pd : '#cfd4e8');
    }
    const bh = Math.round(kh * 0.58), bw = Math.max(3, Math.round(kw * 0.6));
    for (let i = 0; i < n - 1; i++) {
      if (i % 7 === 2 || i % 7 === 6) continue;              // 미-파 · 시-도 사이엔 검은 건반이 없다
      const x = x0 + (i + 1) * kw - Math.ceil(bw / 2) - 1;
      R(x, y0, bw, bh, '#0c0a26'); R(x + 1, y0, 1, bh - 2, '#4a4a78');
    }
  };

  /* 큰 건반 — 왼쪽 동전 더미부터 오른쪽 동전 더미까지 쫙 (흰 건반 20) + 가운데로 떨어지는 파란 타일 3칸 · 치는 순간 번쩍 */
  B.rays(c, W / 2, 74, 20);
  const NK = 20, KW = 11, KX = Math.round(W / 2 - (NK * KW) / 2), KY = 86, KH = 19;
  const keyOf = (x) => Math.floor((x - KX) / KW);
  const hit = new Set([8, 10, 12, keyOf(KIDS[0][0]) , keyOf(KIDS[1][0])]);
  globe(W / 2, KY - 1, 60, 10, '#8fc8ff', 0.16); globe(W / 2, KY - 1, 34, 6, '#ffffff', 0.16);
  keys(KX, KY, NK, KW, KH, hit);
  R(KX - 2, KY - 2, NK * KW + 3, 1, '#ffffff');                // 판정선
  const pill = (cx, y) => { R(cx - 5, y - 1, 11, 7, '#0c2a5c'); R(cx - 4, y, 9, 5, '#4f93e6'); R(cx - 4, y, 9, 1, '#bfe0ff'); R(cx - 4, y + 4, 9, 1, '#2f6cc4'); };
  const cols = [8, 10, 12].map((i) => KX + i * KW + 5);
  for (const cx of cols) { pill(cx, 66); pill(cx, 75); }
  for (const cx of cols) {
    globe(cx, KY - 2, 8, 3, '#ffffff', 0.4);
    for (const [dx, dy] of [[-7, -2], [-5, -4], [-2, -6], [0, -7], [2, -5], [5, -4], [7, -2]]) R(cx + dx, KY + dy, 1, 1, '#ffffff');
  }

  /* 왼쪽: 최종보스 가면(콤보 300 선물)을 쓴 아이 — 보라 왕실 옷 · 금빛 줄. 오른쪽: 줄 없이 두 손 번쩍 · 분홍 머리 · 헤드폰 · 민트 옷 */
  const [[LX, LY], [RX, RY]] = KIDS;
  window.BM(c, 7, LX, LY, 'behind');
  B.bigKid(c, LX, LY, { kind: 'boy', noCap: true, emblem: 'crown', noShadow: true, uDepth: 50, pal: {
    sh: '#6a2fc8', shS: '#3e1488', shL: '#a878ff', bt: '#241838', btS: '#120a1e', btL: '#4a3a66',
    shoe: '#ffc23a', shoeS: '#a87010', rope: '#ffd23f', ropeL: '#fff3a0', ropeD: '#c88a10', hand: '#c050ff', handS: '#7a22c9' } });
  window.BM(c, 7, LX, LY, 'front');
  B.bigKid(c, RX, RY, { kind: 'girl', noRope: true, headphones: true, emblem: 'note', noShadow: true, pal: {
    hr: '#ff7ab8', hrL: '#ffc0de', hrS: '#c8408a', iris: '#2fa8c8', sh: '#2fd2b0', shS: '#13917a', shL: '#a8ffe8',
    bt: '#ffd23f', btS: '#d09a10', btL: '#fff3a0', shoe: '#7a5cff', shoeS: '#4a2ab8' } });

  drawTitle(c, titleX, titleY, t1, t2);
  B.title(c, sub, Math.round((W - sub.w) / 2), subY, subO);

  /* 음표 — 어두운 테두리 + 밝은 점 (8분음표 · 작게 두 개) */
  const noteShape = (x, y, col, hi) => {
    const cells = [];
    for (const [dx, w, dy] of [[1, 3, 6], [0, 5, 7], [1, 3, 8]]) for (let i = 0; i < w; i++) cells.push([dx + i, dy]);
    for (let dy = 0; dy <= 7; dy++) cells.push([4, dy]);
    for (const [dx, dy] of [[5, 1], [6, 2], [6, 3], [5, 4]]) cells.push([dx, dy]);
    for (const [cx, cy] of cells) for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) R(x + cx + ox, y + cy + oy, 1, 1, '#0c0a26');
    for (const [cx, cy] of cells) R(x + cx, y + cy, 1, 1, col);
    R(x + 1, y + 7, 1, 1, hi);
  };
  /* 음표: 왼쪽 3 · 오른쪽 3 (별 반짝이는 줄이고 깨끗한 하늘) */
  for (const [x, y, col, hi] of [[76, 54, '#ffd25a', '#fff6c8'], [90, 64, '#7fe0ff', '#e0f8ff'], [78, 72, '#ff9ad0', '#ffe0f0'],
    [168, 54, '#7fe0ff', '#e0f8ff'], [182, 64, '#ffd25a', '#fff6c8'], [170, 72, '#ff9ad0', '#ffe0f0']]) noteShape(x, y, col, hi);

  /* ===== 로비 로고 (투명) — 폭 180칸 ===== */
  const ltw = l1.w + GAP + l2.w, LW = 180, LH = 4 + Math.max(l1.h, l2.h) + 2 + 5 + sub.h + 3;
  const L = document.createElement('canvas'); L.width = LW; L.height = LH;
  const l = L.getContext('2d');
  drawTitle(l, Math.round((LW - ltw) / 2), 3, l1, l2);
  B.title(l, sub, Math.round((LW - sub.w) / 2), 3 + Math.max(l1.h, l2.h) + 2 + 4, subO);
  return { over: cv.toDataURL('image/png'), logo: L.toDataURL('image/png'), size, lsize, tw, ltw, th: Math.max(t1.h, t2.h), sub: sub.w, lw: LW, lh: LH };
}, { WT, THIN, KIDS });
await browser.close();

/* =====================================================================
 * 3. 합치기 · 저장 · 비교 그림
 * ===================================================================== */
const png = (u) => Buffer.from(u.split(',')[1], 'base64');
const over = await sharp(png(out.over)).resize(BW, BH, { kernel: 'nearest' }).png().toBuffer();
const banner = await sharp(plate, { raw: { width: BW, height: BH, channels: 3 } }).composite([{ input: over }]).png().toBuffer();
await sharp(banner).webp({ lossless: true }).toFile(path.join(root, 'public/assets/ui/banner_jumppiano.webp'));
await sharp(banner).toFile(path.join(root, 'tools/_out/banner_jumppiano_preview.png'));
await sharp(png(out.logo)).resize(out.lw * 3, out.lh * 3, { kernel: 'nearest' }).png({ compressionLevel: 9 }).toFile(path.join(root, 'public/assets/jumppiano-logo.png'));   // 게임 안 로고(로비 제목)
const cmp = ['banner_catchball.webp', 'banner_dragon_striker.webp'].map((f) => path.join(root, 'public/assets/ui', f));
await sharp({ create: { width: BW * 2 + 12, height: BH * 2 + 12, channels: 3, background: '#000' } })
  .composite([
    { input: await sharp(cmp[0]).png().toBuffer(), left: 0, top: 0 },
    { input: await sharp(cmp[1]).png().toBuffer(), left: BW + 12, top: 0 },
    { input: banner, left: Math.round((BW + 12) / 2), top: BH + 12 },
  ]).png().toFile(path.join(root, 'tools/_out/banner-compare-piano.png'));
console.log(`글꼴 ${path.basename(fontFile)}(${WT}, 획 깎기 ${THIN}) · 제목 ${out.size}px 폭 ${out.tw} 높이 ${out.th} · 로고 제목 ${out.lsize}px 폭 ${out.ltw} · 영어 폭 ${out.sub} · 로고 ${out.lw}x${out.lh}칸`);
for (const f of ['public/assets/ui/banner_jumppiano.webp', 'tools/_out/banner_jumppiano_preview.png', 'tools/_out/banner-compare-piano.png']) console.log('✓', f, fs.statSync(path.join(root, f)).size, 'bytes');
