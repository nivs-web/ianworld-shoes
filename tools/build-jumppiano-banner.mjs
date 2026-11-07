/**
 * «줄넘기 피아노» 오락실 카드 배너 (2026-11-07) — 줄넘기 챔피언 배너(우주 · 무지개 테 · 트로피 · 두 아이)와 확연히 다르게.
 *
 *   node tools/build-jumppiano-banner.mjs  →  public/assets/ui/banner_jumppiano.webp (792x336), tools/_out/banner_jumppiano_preview.png
 *
 * 구성(도트 264x112 → 3배): 어두운 무대 · 가운데 건반 위로 파란 타일이 떨어져 건반을 치는 장면(부딪히는 번쩍임 · 눌린 건반) ·
 * 왼쪽에 줄넘기 하는 아이 1명 · 오른쪽에 피아노 도트 그림. 제목은 얼음색. 그림은 전부 한 칸씩 찍는다(AI 생성 0).
 */
import { build } from 'esbuild';
import { chromium } from 'playwright';
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const BW = 792, BH = 336;
const bundle = await build({ stdin: { contents: "import * as B from './tools/_banner-art.mjs'; window.B = B;", resolveDir: root, loader: 'js' }, bundle: true, write: false, format: 'iife' });
const FONT = ['C:/Windows/Fonts/NotoSansKR-VF.ttf', 'C:/Windows/Fonts/malgunbd.ttf'].find((f) => fs.existsSync(f));
if (!FONT) throw new Error('제목 글꼴을 찾지 못했습니다');
const fontCss = `@font-face { font-family: 'TITLE'; src: url(data:font/ttf;base64,${fs.readFileSync(FONT).toString('base64')}); font-weight: 100 900; }`;
const browser = await chromium.launch({ channel: 'chrome' }).catch(() => chromium.launch());
const page = await browser.newPage();
await page.setContent(`<!doctype html><html><head><style>${fontCss}</style></head><body></body></html>`);
await page.addScriptTag({ content: bundle.outputFiles[0].text });

const dataUrl = await page.evaluate(async () => {
  await document.fonts.load("800 30px 'TITLE'", '줄넘기피아노');
  const { B } = window; const { W, H } = B;
  B.reseed(5);
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  const R = (x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x | 0, y | 0, w | 0, h | 0); };
  const NAVY = '#0a1030';

  /* ── 무대: 어두운 세로 띠 + 건반 쪽 은은한 푸른 빛 + 옅은 세로 줄 ── */
  const bands = ['#0c0d16', '#10111d', '#141628', '#181b33', '#1c2040'];
  bands.forEach((col, i) => R(0, Math.floor(H * i / bands.length), W, Math.ceil(H / bands.length) + 1, col));
  for (const gx of [64, 108, 152, 196]) R(gx, 0, 1, H, '#232a52');
  const glow = (cx, cy, rx, ry, col, a) => { c.globalAlpha = a; for (let y = -ry; y <= ry; y++) { const w = Math.round(rx * Math.sqrt(1 - (y * y) / (ry * ry))); R(cx - w, cy + y, w * 2, 1, col); } c.globalAlpha = 1; };
  glow(130, 68, 74, 20, '#3a78d8', 0.10); glow(130, 68, 52, 14, '#6aa6ff', 0.14); glow(130, 68, 30, 8, '#cfe6ff', 0.18);

  /* ── 가운데: 건반 (흰 건반 12 · 검은 건반) ── */
  const KX = 64, KY = 70, KW = 11, NK = 12, KH = 42;
  const pressed = new Set([2, 5, 8]);
  R(KX - 1, KY - 1, KW * NK + 2, 2, '#e8ecf8');
  for (let i = 0; i < NK; i++) {
    const x = KX + i * KW, p = pressed.has(i);
    R(x, KY + 1, KW - 1, KH - 1, p ? '#5a96e0' : '#f6f7fb');
    R(x, KY + 1, KW - 1, 2, p ? '#8cc0ff' : '#ffffff');
    R(x + KW - 1, KY + 1, 1, KH - 1, '#8d93aa');
    if (p) { R(x + 2, KY + 3, 2, KH - 9, '#7fb4f5'); R(x + 3, KY + KH - 8, 5, 3, '#3a6ab8'); }
    else R(x + 1, KY + KH - 6, KW - 3, 4, '#dfe3f0');
  }
  for (const k of [0, 1, 3, 4, 5, 7, 8, 10]) {
    const x = KX + (k + 1) * KW - 3, held = pressed.has(k) || pressed.has(k + 1);
    R(x - 1, KY + 1, 8, 25, '#05060c');
    R(x, KY + 1, 6, 23, held ? '#2a3a66' : '#1c1e2e');
    R(x + 1, KY + 2, 1, 18, held ? '#4d6cb0' : '#3c4060');
    R(x, KY + 20, 6, 4, held ? '#223056' : '#0c0d16');
  }
  R(KX - 2, KY + KH, KW * NK + 4, 3, '#2a2d44');

  /* ── 파란 타일 (3칸 × 3줄) + 부딪힘 번쩍 ── */
  const pill = (cx, y) => {
    R(cx - 7, y, 14, 7, '#0c2a5c'); R(cx - 6, y - 1, 12, 9, '#0c2a5c');
    R(cx - 6, y, 12, 7, '#4f93e6'); R(cx - 5, y + 1, 10, 2, '#a9d2ff'); R(cx - 6, y + 5, 12, 2, '#2f6cc4');
  };
  const cols = [...pressed].map((i) => KX + i * KW + 5);
  for (const cx of cols) for (const y of [47, 58]) pill(cx, y);
  for (const cx of cols) {
    glow(cx, KY - 2, 11, 5, '#ffffff', 0.22); glow(cx, KY - 1, 7, 3, '#ffffff', 0.45);
    for (const [dx, dy] of [[-9, -3], [-6, -6], [-3, -9], [0, -11], [3, -8], [6, -6], [9, -3], [-11, -1], [11, -1]]) R(cx + dx, KY + dy, 1, 2, '#ffffff');
    for (const [dx, dy] of [[-8, -8], [8, -9], [0, -14], [-12, -5], [12, -4]]) R(cx + dx, KY + dy, 1, 1, '#bfe0ff');
  }

  /* ── 제목(위 가운데): 얼음색 + 노랑, 진한 남색 테 ── */
  const GAP = 7;
  let a, b, sz;
  for (sz = 34; sz > 16; sz--) { a = B.mask('줄넘기', 'TITLE', sz, 800, 1, 0); b = B.mask('피아노', 'TITLE', sz, 800, 1, 0); if (a.w + GAP + b.w <= 150 && Math.max(a.h, b.h) <= 26) break; }
  const TA = ['#ffffff', '#eaf6ff', '#c2e4ff', '#8ccaff', '#58a6f4', '#3a7ee0'];
  const TB = ['#fff7d6', '#ffe9a0', '#ffd25a', '#ffb83a', '#ff9526', '#e8701a'];
  const tO = (bd, side) => ({ bands: bd, depth: 3, side, edges: [[NAVY, 1], ['#2b4fa0', 1]], glow: null });
  const tw = a.w + GAP + b.w, tx = Math.round((W - tw) / 2) + 2, ty = 5;
  B.title(c, a, tx, ty, tO(TA, '#143a7a'));
  B.title(c, b, tx + a.w + GAP, ty, tO(TB, '#7a3a0a'));
  const sub = B.pixelMask('JUMP ROPE PIANO', 1);
  B.title(c, sub, Math.round((W - sub.w) / 2) + 2, ty + Math.max(a.h, b.h) + 6, { bands: ['#9fd8ff'], depth: 0, edges: [[NAVY, 1]], glow: null, flat: true });

  /* ── 왼쪽: 줄넘기 하는 아이 1명 ── */
  glow(33, 108, 28, 4, '#3a78d8', 0.18);
  B.bigKid(c, 33, 62, { kind: 'boy', noShadow: true, uDepth: 50 });

  /* ── 오른쪽: 피아노 도트 그림 (업라이트) ── */
  const PX = 204, PY = 38;
  R(PX - 1, PY, 56, 5, '#0b0710'); R(PX, PY + 1, 54, 3, '#5a4a7a'); R(PX, PY + 1, 54, 1, '#8a76b4');
  R(PX + 3, PY + 5, 48, 38, '#0b0710'); R(PX + 4, PY + 5, 46, 37, '#2a2238');
  R(PX + 7, PY + 8, 40, 14, '#171220'); R(PX + 8, PY + 9, 38, 12, '#201a2e');
  for (let i = 0; i < 4; i++) R(PX + 10 + i * 9, PY + 11 + (i % 2) * 2, 6, 1, '#d8cfa8');
  R(PX + 7, PY + 24, 40, 13, '#171220'); R(PX + 9, PY + 26, 36, 9, '#251d36');
  R(PX + 26, PY + 29, 2, 2, '#d6a23a');
  R(PX + 1, PY + 43, 52, 5, '#0b0710'); R(PX + 2, PY + 44, 50, 3, '#3a2f50');
  for (let i = 0; i < 9; i++) R(PX + 3 + i * 5, PY + 44, 4, 3, '#f2f2f8');
  for (const k of [0, 1, 3, 4, 6, 7]) R(PX + 6 + k * 5 + 1, PY + 44, 3, 2, '#05060c');
  R(PX + 3, PY + 48, 4, 14, '#0b0710'); R(PX + 4, PY + 48, 2, 14, '#2a2238');
  R(PX + 47, PY + 48, 4, 14, '#0b0710'); R(PX + 48, PY + 48, 2, 14, '#2a2238');
  R(PX + 22, PY + 54, 10, 3, '#d6a23a'); R(PX + 23, PY + 54, 8, 1, '#ffe08a');
  R(PX + 1, PY + 62, 8, 3, '#0b0710'); R(PX + 45, PY + 62, 8, 3, '#0b0710');
  const NOTE = ['..XX', '..X.', '..X.', '.XX.', 'XXX.'];
  const note = (x, y, col) => NOTE.forEach((row, j) => [...row].forEach((ch, i) => { if (ch === 'X') R(x + i, y + j, 1, 1, col); }));
  note(PX + 8, PY - 14, '#ffd25a'); note(PX + 30, PY - 20, '#7fe0ff'); note(PX + 44, PY - 10, '#ff8fc0');

  /* ── 테두리: 얇은 푸른 선 ── */
  R(1, 0, W - 2, 1, '#3a78d8'); R(1, H - 1, W - 2, 1, '#3a78d8'); R(0, 1, 1, H - 2, '#3a78d8'); R(W - 1, 1, 1, H - 2, '#3a78d8');
  R(1, 1, W - 2, 1, '#1d3a78'); R(1, H - 2, W - 2, 1, '#1d3a78'); R(1, 1, 1, H - 2, '#1d3a78'); R(W - 2, 1, 1, H - 2, '#1d3a78');
  return cv.toDataURL('image/png');
});
await browser.close();
const over = await sharp(Buffer.from(dataUrl.split(',')[1], 'base64')).resize(BW, BH, { kernel: 'nearest' }).png().toBuffer();
await sharp(over).webp({ lossless: true }).toFile(path.join(root, 'public/assets/ui/banner_jumppiano.webp'));
await sharp(over).toFile(path.join(root, 'tools/_out/banner_jumppiano_preview.png'));
console.log('✓ banner_jumppiano.webp', fs.statSync(path.join(root, 'public/assets/ui/banner_jumppiano.webp')).size, 'bytes');
