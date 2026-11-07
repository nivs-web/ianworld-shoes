/**
 * «줄넘기 챔피언» 오락실 카드 배너 + 로비 로고 굽기 — **픽셀아트** (2026-11-07, 다시 그림)
 *
 *   node tools/build-jumprope-banner.mjs
 *     → public/assets/ui/banner_jumprope.webp   (792x336 = 도트 264x112 를 3배 nearest)
 *     → public/assets/jumprope-logo.png          (로비 제목, 도트 180칸 폭을 3배 — 화면 360px 에 딱 2배)
 *     → tools/_out/banner_jumprope_preview.png    (확인용)
 *
 * 권반장 지적 반영: 제목 = 드래곤 스트라이커처럼 아주 굵은 고딕 블록 글자(노토 산스 KR 900, 없으면 맑은 고딕 굵게) ·
 * 영어 = 캐치볼처럼 굵은 빨강 + 흰/진한 테두리 · 캐릭터 = 배너 전용 큰 도트 아이(≈60칸)가 신나게 높이 뛰는 순간 ·
 * 동전 = 타원 원근 · 옆면 톱니 · 별 무늬 · 더미 깊이.
 * 글꼴은 «가면»으로만 쓴다(제 크기로 찍고 반투명 칸은 버린다) — 그림은 전부 tools/_banner-art.mjs 가 한 칸씩 찍는다(AI 생성 0).
 */
import { build } from 'esbuild';
import { chromium } from 'playwright';
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const bundle = await build({
  stdin: { contents: "import * as B from './tools/_banner-art.mjs'; window.B = B;", resolveDir: root, loader: 'js' },
  bundle: true, write: false, format: 'iife',
});

/* 굵은 글꼴 — 노토 산스 KR(가변, 900 = Black). 없으면 맑은 고딕 굵게 */
const FONT_CANDIDATES = ['C:/Windows/Fonts/NotoSansKR-VF.ttf', 'C:/Windows/Fonts/malgunbd.ttf'];
const fontFile = FONT_CANDIDATES.find((f) => fs.existsSync(f));
if (!fontFile) throw new Error('굵은 한글 글꼴을 찾지 못했습니다: ' + FONT_CANDIDATES.join(', '));
const fontCss = `@font-face { font-family: 'TITLE'; src: url(data:font/ttf;base64,${fs.readFileSync(fontFile).toString('base64')}); font-weight: 100 900; }`;

const browser = await chromium.launch({ channel: 'chrome' }).catch(() => chromium.launch());
const page = await browser.newPage();
await page.setContent(`<!doctype html><html><head><style>${fontCss}</style></head><body></body></html>`);
await page.addScriptTag({ content: bundle.outputFiles[0].text });

const out = await page.evaluate(async () => {
  await document.fonts.load("900 30px 'TITLE'", '줄넘기챔피언JUMPROPECHAMPION');
  const { B } = window;
  const { W, H, OUT } = B;
  B.reseed(11);

  /* ---- 글자 가면 — 900(Black)은 이 크기에서 «줄»의 ㅈ 이 뭉개져 800(ExtraBold). 배너는 양옆 아이 머리에 덜 걸리게 폭 178칸까지, 로고는 180칸 안에 ---- */
  const GAP = 6, WT = 800;
  const fit = (maxW, from) => { for (let s = from; s > 18; s--) { const a = B.mask('줄넘기', 'TITLE', s, WT, 0), b = B.mask('챔피언', 'TITLE', s, WT, 0); if (a.w + GAP + b.w <= maxW) return [a, b, s]; } };
  const [t1, t2, size] = fit(178, 34);
  const [l1, l2, lsize] = fit(172, 34);
  const sub = B.pixelMask('JUMP ROPE CHAMPION', 1), ss = 10;
  const T1 = ['#fff8c8', '#ffe85a', '#ffd21f', '#ffb21a', '#ff8a1a', '#ff5a1a'];               // 줄넘기 — 노랑 → 주황
  const T2 = ['#f0fffa', '#a8fff0', '#5ff0d0', '#3fd890', '#2fb8c8', '#3a7dff'];               // 챔피언 — 하늘 → 초록 → 파랑
  const S1 = ['#ffd8d0', '#ff7a6a', '#ff3a34', '#f0222a', '#c8121e', '#8a0a14'];               // 영어 — 밝은 빨강 → 진한 빨강
  const titleO1 = { bands: T1, depth: 3, side: '#8a2a00', edges: [[OUT, 2]] };
  const titleO2 = { bands: T2, depth: 3, side: '#123a7a', edges: [[OUT, 2]] };
  const subO = { bands: S1, depth: 2, side: '#5a0610', edges: [['#ffffff', 1], [OUT, 2]], glow: '#7a1a3a' };
  const tw = t1.w + GAP + t2.w, ltw = l1.w + GAP + l2.w;
  const drawTitle = (c, x, y, a = t1, b = t2) => { B.title(c, a, x, y, titleO1); B.title(c, b, x + a.w + GAP, y, titleO2); };

  /* ===== 배너 264 x 112 — 캐치볼 구도: 위 큰 제목 · 그 밑 빨간 영어 · 양옆 신나게 뛰는 둘 · 가운데 트로피 · 아래 금화 더미 ===== */
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  B.space(c);
  B.galaxy(c, 238, 20);
  const titleY = 12, subY = titleY + t1.h + 6;
  const tropY = subY + sub.h + 6;
  const titleX = Math.round((W - tw) / 2);
  B.rays(c, W / 2, tropY + 12, 26);
  B.coinPile(c, -2, 113, 80, 46, 6, -1);                         // 아이 발밑에서 낮아져 그림자가 금화 위에 떨어진다
  B.coinPile(c, W + 2, 113, 80, 46, 6, 1);
  B.coinPile(c, 66, 113, 48, 24);
  B.coinPile(c, W - 66, 113, 48, 24);
  B.coinPile(c, W / 2, 113, 150, 20);
  B.trophy(c, W / 2, tropY);
  B.bigKid(c, 30, 52, { kind: 'girl' });
  B.bigKid(c, W - 30, 52, { kind: 'boy' });
  drawTitle(c, titleX, titleY);
  B.title(c, sub, Math.round((W - sub.w) / 2), subY, subO);
  B.frame(c, 3, 9);
  /* 위 가운데 큰 동전 + 떠다니는 동전 · 반짝이 */
  const coinX = titleX + t1.w + Math.floor(GAP / 2);                  // 두 낱말 사이 위 — 글자를 가리지 않게
  B.coinStand(c, coinX, 8, 7, 0.9);
  B.sparkle(c, coinX - 14, 6, false); B.sparkle(c, coinX + 15, 8, true);
  B.coinStand(c, 76, 76, 6, 0.6); B.coinStand(c, 190, 72, 5, 0.45);
  for (const [x, y, big] of [[88, 70, true], [178, 66, false], [102, 96, false], [168, 98, true], [16, 22, false], [250, 44, false], [204, 92, true]]) B.sparkle(c, x, y, big);

  /* ===== 로비 로고 (투명 배경) — 폭 180칸, 같은 제목 + 영어 ===== */
  const LW = 180, LH = 4 + l1.h + 3 + 6 + sub.h + 2 + 4;
  const L = document.createElement('canvas'); L.width = LW; L.height = LH;
  const l = L.getContext('2d');
  drawTitle(l, Math.round((LW - ltw) / 2), 4, l1, l2);
  B.title(l, sub, Math.round((LW - sub.w) / 2), 4 + l1.h + 3 + 6, subO);
  return { banner: cv.toDataURL('image/png'), logo: L.toDataURL('image/png'), size, lsize, ss, tw, ltw, sub: sub.w, lw: LW, lh: LH, th: t1.h };
});
await browser.close();

const png = (u) => Buffer.from(u.split(',')[1], 'base64');
await sharp(png(out.banner)).resize(792, 336, { kernel: 'nearest' }).webp({ lossless: true }).toFile(path.join(root, 'public/assets/ui/banner_jumprope.webp'));
await sharp(png(out.banner)).resize(792, 336, { kernel: 'nearest' }).png().toFile(path.join(root, 'tools/_out/banner_jumprope_preview.png'));
await sharp(png(out.logo)).resize(out.lw * 3, out.lh * 3, { kernel: 'nearest' }).png({ compressionLevel: 9 }).toFile(path.join(root, 'public/assets/jumprope-logo.png'));
console.log(`글꼴 ${path.basename(fontFile)} · 제목 ${out.size}px(폭 ${out.tw}, 높이 ${out.th}) · 로고 제목 ${out.lsize}px(폭 ${out.ltw}) · 영어 도트 글자 ${out.ss}줄(폭 ${out.sub}) · 로고 ${out.lw}x${out.lh}칸`);
for (const f of ['public/assets/ui/banner_jumprope.webp', 'public/assets/jumprope-logo.png', 'tools/_out/banner_jumprope_preview.png']) console.log('✓', f, fs.statSync(path.join(root, f)).size, 'bytes');
