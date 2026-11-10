/**
 * «좀비와 드래곤» 오락실 카드 배너 + 로비 로고 굽기 (2026-11-10, 겜팀장) — build-jumprope-banner.mjs 를 복사해 가운데 내용만 바꾼 것
 *
 *   node tools/build-iandragon-banner.mjs
 *     → public/assets/ui/banner_iandragon.webp   (792x336, 무손실)
 *     → public/assets/iandragon-logo.png          (제목 로고 — 도트 180칸 폭을 3배 = 540px, 투명)
 *     → tools/_out/banner_iandragon_preview.png    (확인용)
 *     → tools/_out/banner-compare-7.png            (배너 7개를 한 장에 — 2줄 x 4칸, 마지막이 좀비와 드래곤)
 *
 * 바탕판 만들기(1단계)는 줄넘기 스크립트와 똑같다 — 캐치볼 배너의 틀(무지개 테두리 · 동전 더미 · 위 동전 · 은하 · 우주 배경)을
 * 픽셀 그대로 물려받고, 가운데 내용만 지워 둘레 배경 흐름으로 채운다. 그 위에 3배 도트로 올린다:
 * 제목 «좀비와»(노랑 → 주황) «드래곤»(하늘 → 초록 → 파랑) · 영어 ZOMBIE & DRAGON · 왼쪽 아기 용 셋 · 오른쪽 좀비 셋 · 가운데 화로와 불씨.
 * 캐릭터는 게임 안 스프라이트(src/games/iandragon_game/art/)와 같은 도트 · 같은 팔레트. 글꼴은 «가면»으로만 쓴다(문턱 128).
 * 우리 그림은 전부 코드가 한 칸씩 찍는다(AI 생성 0 · 벡터 0 · 반투명 0).
 */
import { build } from 'esbuild';
import { chromium } from 'playwright';
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const BW = 792, BH = 336, Z = 3;
/* 「드래곤」의 래 · 곤 가로획이 800 에선 뭉개져서(명령서 9장 대응) 굵기 700 + 크기 상한 27 로 내렸다 */
const MAXS = 27;
const TITLE_A = '좀비와', TITLE_B = '드래곤', SUB = process.env.IDG_SUB || 'ZOMBIE & DRAGON';

/* =====================================================================
 * 2. 우리 그림(투명 도트 264x112 + 로고) — 브라우저에서 찍는다
 * ===================================================================== */
const bundle = await build({
  stdin: { contents: "import * as B from './tools/_banner-art.mjs'; import * as A from './tools/_banner-art-iandragon.mjs'; window.B = B; window.A = A;", resolveDir: root, loader: 'js' },
  bundle: true, write: false, format: 'iife',
});
/* 제목 글꼴 — 노토 산스 KR Bold(700 — 800 은 래 · 곤이 뭉개짐), 없으면 맑은 고딕 Bold. «가면»으로만 쓴다 */
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

const out = await page.evaluate(async ({ WT, THIN, TITLE_A, TITLE_B, SUB, MAXS }) => {
  await document.fonts.load(`${WT} 30px 'TITLE'`, TITLE_A + TITLE_B);
  const { B, A } = window;
  const { W, H } = B;
  B.reseed(11);
  const NAVY = '#0c0a26';                                                                    // 우주 배경색에 가까운 아주 진한 남색
  const RB = ['#ff3d6e', '#ff9a1a', '#ffe14d', '#4dd27a', '#3fc4ff', '#6a5cff', '#d24dff'];
  const rainbow = (x0, w) => (x) => RB[Math.max(0, Math.min(RB.length - 1, Math.floor(((x - x0) / w) * RB.length)))];

  /* ---- 제목: 폭 196칸 · 높이 27칸 안에 들어가는 가장 큰 크기 (줄넘기 배너와 같은 상한) ---- */
  const GAP = 7;
  const fit = (maxW, hMax) => {
    for (let s = MAXS; s > 16; s--) {
      const a = B.mask(TITLE_A, 'TITLE', s, WT, 1, THIN), b = B.mask(TITLE_B, 'TITLE', s, WT, 1, THIN);
      if (a.w + GAP + b.w <= maxW && Math.max(a.h, b.h) <= hMax) return [a, b, s];
    }
  };
  const [t1, t2, size] = fit(196, 27);
  const [l1, l2, lsize] = fit(174, 27);
  const T1 = ['#fff8c8', '#ffe85a', '#ffd21f', '#ffb21a', '#ff8a1a', '#ff5a1a'];             // 좀비와 — 노랑 → 주황
  const T2 = ['#f0fffa', '#a8fff0', '#5ff0d0', '#3fd890', '#2fb8c8', '#3a7dff'];             // 드래곤 — 하늘 → 초록 → 파랑
  const tO = (bands, side, rb) => ({ bands, depth: 3, side, edges: [[NAVY, 1], [rb, 2]], glow: null });
  const drawTitle = (c, x, y, a, b) => {
    const rb = rainbow(x - 2, a.w + GAP + b.w + 4);
    B.title(c, a, x, y, tO(T1, '#8a2a00', rb));
    B.title(c, b, x + a.w + GAP, y, tO(T2, '#123a7a', rb));
  };
  /* ---- 영어: 밝은 주황 단색 + 진한 남색 얇은 테 ---- */
  const sub = B.pixelMask(SUB, 1);
  const subO = { bands: ['#ffa526'], depth: 0, edges: [[NAVY, 1]], glow: null, flat: true };

  /* ===== 배너 위에 올릴 투명 도트 판 264x112 ===== */
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  const tw = t1.w + GAP + t2.w, titleX = Math.round((W - tw) / 2), titleY = 12;
  const th = Math.max(t1.h, t2.h);
  const subY = titleY + th + 3 + 4;
  const info = A.scene(c, B);                       // 빛살 · 화로 · 불씨 · 용 셋 · 좀비 셋
  drawTitle(c, titleX, titleY, t1, t2);
  B.title(c, sub, Math.round((W - sub.w) / 2), subY, subO);
  for (const [x, y, big] of A.SPARKS) B.sparkle(c, x, y, big);

  /* ===== 도트판 검사: 알파는 0 아니면 255 ===== */
  const d = c.getImageData(0, 0, W, H).data;
  let semi = 0; for (let i = 3; i < d.length; i += 4) if (d[i] !== 0 && d[i] !== 255) semi++;

  /* ===== 로비 로고 (투명) — 폭 180칸 ===== */
  const ltw = l1.w + GAP + l2.w, LW = 180, LH = 4 + Math.max(l1.h, l2.h) + 2 + 5 + sub.h + 3;
  const L = document.createElement('canvas'); L.width = LW; L.height = LH;
  const l = L.getContext('2d');
  drawTitle(l, Math.round((LW - ltw) / 2), 3, l1, l2);
  B.title(l, sub, Math.round((LW - sub.w) / 2), 3 + Math.max(l1.h, l2.h) + 2 + 4, subO);
  const dl = l.getImageData(0, 0, LW, LH).data;
  let semiL = 0; for (let i = 3; i < dl.length; i += 4) if (dl[i] !== 0 && dl[i] !== 255) semiL++;
  return { over: cv.toDataURL('image/png'), logo: L.toDataURL('image/png'), size, lsize, tw, ltw, th, sub: sub.w, subY, titleX, titleY, lw: LW, lh: LH, semi, semiL, info: JSON.parse(JSON.stringify(info, (k, v) => (k === 'p' ? undefined : v))) };
}, { WT, THIN, TITLE_A, TITLE_B, SUB, MAXS });
await browser.close();

/* =====================================================================
 * 1. 캐치볼 배너를 바탕판으로 — 가운데 내용만 지우고 우주 배경을 이어 채운다
 * ===================================================================== */
/* (먼저 우리 그림을 찍어 두고) 인물 다리 · 발 사이 좁은 틈에 비치는 동전 조각은 통째로 비운다 */
const png = (u) => Buffer.from(u.split(',')[1], 'base64');
const GAPMAX = 7;
const srcRaw = await sharp(path.join(root, 'public/assets/ui/banner_catchball.webp')).removeAlpha().raw().toBuffer();
const gapBoxes = [];
{
  const ov = await sharp(png(out.over)).ensureAlpha().raw().toBuffer();
  const OW = ov.length / 4 / 112;
  const goldAt = (px, py) => { for (let y = py * Z; y < py * Z + Z; y++) for (let x = px * Z; x < px * Z + Z; x++) { const i = (y * BW + x) * 3; if (isGoldRaw(i)) return true; } return false; };
  const isGoldRaw = (i) => { const r = srcRaw[i], g = srcRaw[i + 1], b = srcRaw[i + 2]; return r > b + 40 && g > r * 0.42 && r >= g && r > 70; };
  for (let y = 40; y < 105; y++) {
    let last = -1;
    for (let x = 0; x < OW; x++) {
      const op = ov[(y * OW + x) * 4 + 3] > 0;
      if (!op) continue;
      const gap = x - last - 1;
      if (last >= 0 && gap >= 1 && gap <= GAPMAX) for (let gx = last + 1; gx < x; gx++) if (goldAt(gx, y)) gapBoxes.push([gx * Z, y * Z, gx * Z + Z, y * Z + Z, true]);
      last = x;
    }
  }
}
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
  /* 캐릭터 발 사이로 보이는 곳 — 더미 가장자리 동전 조각이 «다리 사이 금덩이»처럼 보여서 통째로 비운다 */
  /* 잔디 줄에 남은 금빛 부스러기(떠 있는 조각) */
  [150, 278, 186, 296, true],
  [590, 276, 650, 294, true],
  [640, 270, 668, 300, true],
  [112, 294, 128, 306, true],
  ...gapBoxes,
];
fs.writeFileSync(path.join(root, 'tools/_out/_idg-erase.json'), JSON.stringify(ERASE));
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
  if (rnd() < 0.022) col = STAR[Math.floor(rnd() * STAR.length)];
  for (let y = by; y < by + Z; y++) for (let x = bx; x < bx + Z; x++) if (er[y * BW + x]) { const i = at(x, y); plate[i] = col[0]; plate[i + 1] = col[1]; plate[i + 2] = col[2]; }
}

/* =====================================================================
 * 3. 합치기 · 저장 · 비교 그림
 * ===================================================================== */
const over = await sharp(png(out.over)).resize(BW, BH, { kernel: 'nearest' }).png().toBuffer();
const banner = await sharp(plate, { raw: { width: BW, height: BH, channels: 3 } }).composite([{ input: over }]).png().toBuffer();
await sharp(banner).webp({ lossless: true }).toFile(path.join(root, 'public/assets/ui/banner_iandragon.webp'));
await sharp(banner).toFile(path.join(root, 'tools/_out/banner_iandragon_preview.png'));
await sharp(png(out.logo)).resize(out.lw * 3, out.lh * 3, { kernel: 'nearest' }).png({ compressionLevel: 9 }).toFile(path.join(root, 'public/assets/iandragon-logo.png'));
fs.writeFileSync(path.join(root, 'tools/_out/_idg-dotplate.png'), png(out.over));
/* 배너 7개를 한 장에 — 2줄 x 4칸, 마지막(8번째 칸)은 비운다 */
const ORDER = ['banner_find_shoes', 'banner_dragon_striker', 'banner_catchball', 'banner_catchball3d', 'banner_jumprope', 'banner_jumppiano'];
const GAPX = 12, cols = 4;
const tiles = [];
for (const [i, n] of ORDER.entries()) tiles.push({ input: await sharp(path.join(root, 'public/assets/ui', n + '.webp')).png().toBuffer(), left: (i % cols) * (BW + GAPX), top: Math.floor(i / cols) * (BH + GAPX) });
tiles.push({ input: banner, left: (6 % cols) * (BW + GAPX), top: Math.floor(6 / cols) * (BH + GAPX) });
await sharp({ create: { width: BW * cols + GAPX * (cols - 1), height: BH * 2 + GAPX, channels: 3, background: '#000' } })
  .composite(tiles).png().toFile(path.join(root, 'tools/_out/banner-compare-7.png'));
console.log(`글꼴 ${path.basename(fontFile)}(${WT}, 획 깎기 ${THIN}) · 제목 ${out.size}px 폭 ${out.tw} 높이 ${out.th} (x=${out.titleX}, y=${out.titleY}) · 로고 제목 ${out.lsize}px 폭 ${out.ltw} · 영어 «${SUB}» 폭 ${out.sub} (y=${out.subY}) · 로고 ${out.lw}x${out.lh}칸`);
console.log('반투명 칸 — 도트판', out.semi, '· 로고', out.semiL);
console.log('캐릭터 자리', JSON.stringify(out.info));
for (const f of ['public/assets/ui/banner_iandragon.webp', 'public/assets/iandragon-logo.png', 'tools/_out/banner_iandragon_preview.png', 'tools/_out/banner-compare-7.png']) console.log('✓', f, fs.statSync(path.join(root, f)).size, 'bytes');
