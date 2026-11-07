/**
 * «줄넘기 챔피언» 오락실 카드 배너 + 로비 로고 굽기 — **픽셀아트** (2026-11-07)
 *
 *   node tools/build-jumprope-banner.mjs
 *     → public/assets/ui/banner_jumprope.webp   (792x336 = 도트 264x112 를 3배 nearest)
 *     → public/assets/jumprope-logo.png          (로비 제목 그림, 도트 180x58 를 3배)
 *
 * 권반장 지시: «게임 배너는 위에 4개 스타일로 · 위 4개 스타일과 최대한 어울리게».
 * 그래서 4개 배너의 틀을 그대로 따른다 — 우주 배경 · 네온 무지개 둥근 테두리 · 위 가운데 금화 ·
 * 오른쪽 위 은하 · 양쪽 아래 금화 더미 · 굵은 입체 제목(위아래 색 띠) · 아래 영어 부제.
 * 그림은 전부 코드로 한 칸씩 찍는다(AI 이미지 생성 0). 아이 둘은 게임 그림 코드(`art.js`) 그대로다.
 * 글자: 갈무리14 · 갈무리11 굵게(OFL) — 도트 글꼴을 찍고 반투명 칸은 버린다(또렷한 도트).
 */
import { build } from 'esbuild';
import { chromium } from 'playwright';
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const bundle = await build({
  stdin: { contents: "import * as A from './src/games/jumprope/art.js'; import * as D from './src/games/jumprope/data.js'; window.A = A; window.D = D;", resolveDir: root, loader: 'js' },
  bundle: true, write: false, format: 'iife',
});
const b64 = (p) => fs.readFileSync(path.join(root, p)).toString('base64');

const browser = await chromium.launch().catch(() => chromium.launch({ channel: 'chrome' }));
const page = await browser.newPage();
await page.setContent(`<!doctype html><html><head><style>
@font-face { font-family: 'G14'; src: url(data:font/woff2;base64,${b64('node_modules/galmuri/dist/Galmuri14.woff2')}) format('woff2'); }
@font-face { font-family: 'G11B'; src: url(data:font/woff2;base64,${b64('node_modules/galmuri/dist/Galmuri11-Bold.woff2')}) format('woff2'); }
</style></head><body></body></html>`);
await page.addScriptTag({ content: bundle.outputFiles[0].text });

const out = await page.evaluate(async () => {
  await document.fonts.load("28px 'G14'");
  await document.fonts.load("11px 'G11B'");
  const { A, D } = window;
  const OUT = '#14082a';
  let seed = 11;
  const R = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

  /* 글자 → 도트 가면: 도트 글꼴을 제 크기로 찍고(반투명 칸은 버린다) → 굵게(오른쪽 한 칸) → 정수배로 키운다 */
  function mask(text, font, size, gap = 0, bold = false, scale = 1) {
    const c = document.createElement('canvas');
    c.width = Math.ceil(size * text.length * 1.3) + 8; c.height = Math.ceil(size * 1.6) + 4;
    const x = c.getContext('2d');
    x.font = `${size}px '${font}'`; x.textBaseline = 'top'; x.fillStyle = '#fff';
    let cx = 2;
    for (const ch of text) { x.fillText(ch, cx, 2); cx += Math.round(x.measureText(ch).width) + gap; }
    const d = x.getImageData(0, 0, c.width, c.height).data;
    const on = (i, j) => i >= 0 && j >= 0 && i < c.width && j < c.height && d[(j * c.width + i) * 4 + 3] > 110;
    const fat = (i, j) => on(i, j) || (bold && on(i - 1, j));
    let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
    for (let j = 0; j < c.height; j++) for (let i = 0; i < c.width + 1; i++) if (fat(i, j)) { x0 = Math.min(x0, i); y0 = Math.min(y0, j); x1 = Math.max(x1, i); y1 = Math.max(y1, j); }
    const w0 = x1 - x0 + 1, h0 = y1 - y0 + 1, w = w0 * scale, h = h0 * scale;
    const m = new Uint8Array(w * h);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) m[j * w + i] = fat(x0 + Math.floor(i / scale), y0 + Math.floor(j / scale)) ? 1 : 0;
    return { w, h, m };
  }
  /** 굵은 입체 제목 (드래곤 스트라이커 느낌): 바깥 보라 빛 → 진한 외곽선(ow칸) → 아래로 밀린 두께 → 면(위아래 색 띠) → 윗면 빛 */
  function title(ctx, M, x0, y0, bands, depth, sideCol, ow = 1, glow = '#6a3cc8') {
    const { w, h, m } = M;
    const at = (i, j) => i >= 0 && j >= 0 && i < w && j < h && m[j * w + i];
    const solid = (i, j) => { for (let k = 0; k <= depth; k++) if (at(i, j - k)) return true; return false; };
    const dist = (i, j, r) => { for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (Math.abs(dx) + Math.abs(dy) <= r + 1 && solid(i + dx, j + dy)) return true; return false; };
    for (let j = -ow - 2; j < h + depth + ow + 2; j++) for (let i = -ow - 2; i < w + ow + 2; i++) {
      if (solid(i, j)) continue;
      if (dist(i, j, ow)) A.px(ctx, x0 + i, y0 + j, OUT);
      else if (glow && dist(i, j, ow + 1) && (i + j) % 2 === 0) A.px(ctx, x0 + i, y0 + j, glow);
    }
    for (let j = 0; j < h + depth; j++) for (let i = 0; i < w; i++) if (solid(i, j) && !at(i, j)) A.px(ctx, x0 + i, y0 + j, (j + i) % 4 === 0 ? A.tone(sideCol, 0.15) : sideCol);
    for (let j = 0; j < h; j++) {
      const col = bands[Math.min(bands.length - 1, Math.floor((j / h) * bands.length))];
      for (let i = 0; i < w; i++) if (at(i, j)) A.px(ctx, x0 + i, y0 + j, at(i, j - 1) ? (at(i - 1, j) ? col : A.tone(col, 0.25)) : A.tone(col, 0.5));
    }
  }
  /** 가운데 부딪히는 빛 (드래곤 배너의 불꽃 충돌 자리) */
  function burst(ctx, cx, cy, r) {
    for (let k = 0; k < 28; k++) {
      const a = (k / 28) * Math.PI * 2 + (k % 2) * 0.06;
      const len = r * (k % 2 ? 0.55 : 1) * (0.75 + R() * 0.35);
      for (let t = 2; t < len; t++) {
        const x = Math.round(cx + Math.cos(a) * t), y = Math.round(cy + Math.sin(a) * t * 0.7);
        A.px(ctx, x, y, t < len * 0.35 ? '#ffffff' : t < len * 0.7 ? '#ffe14d' : '#ff9a1a');
      }
    }
    A.oval(ctx, cx, cy, 6, 5, '#fff6b0'); A.oval(ctx, cx, cy, 4, 3, '#ffffff');
    for (let k = 0; k < 14; k++) A.px(ctx, Math.round(cx + (R() - 0.5) * r * 2.6), Math.round(cy + (R() - 0.5) * r * 1.6), R() < 0.5 ? '#ffe14d' : '#ff9a1a');
  }
  function coin(ctx, x, y) { A.sprite(ctx, x, y, ['.oooo.', 'oyywyo', 'oywyyo', 'oyyydo', 'oyyydo', '.oddo.'], { o: '#6b3a00', y: '#ffcf33', w: '#fff6b0', d: '#d9921a' }); }
  function coinPile(ctx, cx, base, wide, high) {
    for (let k = 0; k < 140; k++) {
      const u = R();
      const x = Math.round(cx + (R() - 0.5) * wide * (1 - u * 0.7));
      const lim = high * (1 - Math.abs(x - cx) / (wide * 0.55));
      if (lim <= 0) continue;
      const y = Math.round(base - u * lim);
      coin(ctx, x - 3, y - 3);
    }
    for (let k = 0; k < 5; k++) A.sprite(ctx, Math.round(cx + (R() - 0.5) * wide * 0.7), Math.round(base - R() * high), A.SPR.spark, { w: '#ffffff' });
  }
  function frame(ctx, W, H, inset, r) {
    const RB = ['#ff3d6e', '#ff9a1a', '#ffe14d', '#4dd27a', '#3fc4ff', '#6a5cff', '#d24dff'];
    const x0 = inset, y0 = inset, x1 = W - 1 - inset, y1 = H - 1 - inset;
    const inRound = (x, y, rr) => {
      const cx = x < x0 + rr ? x0 + rr : x > x1 - rr ? x1 - rr : x;
      const cy = y < y0 + rr ? y0 + rr : y > y1 - rr ? y1 - rr : y;
      return (x - cx) ** 2 + (y - cy) ** 2 <= rr * rr + rr * 0.8;
    };
    for (let y = y0 - 2; y <= y1 + 2; y++) for (let x = x0 - 2; x <= x1 + 2; x++) {
      const o = inRound(x, y, r);
      const i2 = x > x0 + 1 && x < x1 - 1 && y > y0 + 1 && y < y1 - 1 && inRound(x, y, r - 2);
      const i3 = x > x0 + 2 && x < x1 - 2 && y > y0 + 2 && y < y1 - 2 && inRound(x, y, r - 3);
      if (o && !i2) { const t = ((x - x0) + (y - y0)) / (W + H); A.px(ctx, x, y, RB[Math.floor(t * RB.length) % RB.length]); }
      else if (i2 && !i3) A.px(ctx, x, y, '#ffffff');
      if (!o && inRound(x, y, r + 1) && (x + y) % 2 === 0) A.px(ctx, x, y, '#6a3cc8');
    }
  }
  function space(ctx, W, H) {
    const bands = ['#090726', '#0e0b33', '#141040', '#1b134d', '#22175a'];
    for (let i = 0; i < bands.length; i++) A.rect(ctx, 0, Math.round((i * H) / bands.length), W, Math.ceil(H / bands.length) + 1, bands[i]);
    for (let i = 0; i < 120; i++) A.px(ctx, Math.floor(R() * W), Math.floor(R() * H), R() < 0.7 ? '#cfd6ff' : '#ffffff');
    for (let i = 0; i < 10; i++) A.sprite(ctx, Math.floor(R() * W), Math.floor(R() * H * 0.8), A.SPR.spark, { w: ['#fff6b0', '#bfefff', '#ffd1ec'][i % 3] });
  }
  function galaxy(ctx, gx, gy) {
    for (let k = 0; k < 130; k++) {
      const a = k * 0.24, rr = k * 0.075;
      for (const s of [0, Math.PI]) {
        const x = Math.round(gx + Math.cos(a + s) * rr * 1.8), y = Math.round(gy + Math.sin(a + s) * rr * 0.7);
        A.px(ctx, x, y, k < 25 ? '#ffffff' : k < 70 ? '#e7a6ff' : '#9a5cff');
      }
    }
    A.rect(ctx, gx - 1, gy - 1, 3, 3, '#ffffff');
  }
  function trophy(ctx, x, y) {
    A.sprite(ctx, x, y, [
      '..oooooooooooooo..', 'ooyyyyyyyyyyyyywoo', 'o.oywwyyyyyyyyyo.o', 'o.oywyyyyyyyyydo.o', 'oo.oyyyyyyyyyydooo', '.o.oyyyyyyyyyydoo.',
      '..ooyyyyyyyyyddoo.', '....oyyyyyyyddo...', '.....ooyyyyddo....', '.......oyyyo......', '.......oyydo......', '......ooyyddoo....',
      '.....oyyyyyyddo...', '....oooooooooooo..', '....ossssssssso...', '....osswwwwwsso...', '....oooooooooooo..',
    ], { o: '#5a3200', y: '#ffcf33', w: '#fff6b0', d: '#d9921a', s: '#8a4a1a' });
  }
  function kid(ctx, x, foot, look, rope, theta, lift) {
    const pre = A.kidHands(theta, x, foot, lift);
    const g0 = A.ropeGeom(pre, x, foot, theta);
    if (g0.depth < 0) A.drawRope(ctx, rope, g0, 0.4);
    for (let dx = -10; dx <= 10; dx++) if (dx % 2 === 0) A.px(ctx, x + dx, foot, 'rgba(0,0,0,0.5)');
    const h = A.drawKid(ctx, x, foot, look, { theta, lift, tuck: lift > 3 ? 1 : 0, t: 1, mouth: 'grin' });
    const g1 = A.ropeGeom(h, x, foot, theta);
    if (g1.depth >= 0) A.drawRope(ctx, rope, g1, 0.4);
    A.drawHandles(ctx, rope, h);
  }
  const toURL = (c) => c.toDataURL('image/png');

  /* ===== 배너 264 x 112 — 드래곤 스트라이커 구도: 위 큰 두 색 제목 · 가운데 맞선 둘과 부딪히는 빛 · 아래 금화 더미 위 큰 영어 부제 ===== */
  const W = 264, H = 112;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  space(c, W, H);
  galaxy(c, 248, 18);
  coinPile(c, 26, 108, 96, 46);
  coinPile(c, W - 26, 108, 96, 46);
  coinPile(c, W / 2, 112, 120, 10);
  burst(c, W / 2, 64, 26);
  const girl = { skin: 0, hair: 2, hairColor: 1, eyes: 3, shirt: 6, pants: 2, shoes: 1, hat: 3, emoji: 0 };
  const boy = { skin: 1, hair: 0, hairColor: 0, eyes: 0, shirt: 8, pants: 0, shoes: 2, hat: 1, emoji: 1 };
  kid(c, 76, 92, girl, D.ROPE_BY_ID.rainbow, Math.PI * 2, 6);
  kid(c, 188, 92, boy, D.ROPE_BY_ID.gold, Math.PI * 2, 6);
  for (let i = 0; i < 10; i++) A.drawParticle(c, { kind: i % 3 ? 'spark' : 'star', x: (i % 2 ? 76 : 188) + (R() - 0.5) * 50, y: 44 + R() * 44, age: 0, life: 1 });
  /* 제목 — 갈무리14 를 굵게 2배 (줄넘기 = 노랑·주황 / 챔피언 = 하늘·초록·파랑, 드래곤 · 스트라이커처럼 두 색 묶음) */
  const T1 = ['#fff8c8', '#ffe85a', '#ffd21f', '#ffb21a', '#ff8a1a', '#ff5a1a'];
  const T2 = ['#f0fffa', '#a8fff0', '#5ff0d0', '#3fd890', '#2fb8c8', '#3a7dff'];
  const t1 = mask('줄넘기', 'G14', 14, 1, true, 2), t2 = mask('챔피언', 'G14', 14, 1, true, 2);
  const gapT = 6, tw = t1.w + gapT + t2.w, tx = Math.round((W - tw) / 2);
  title(c, t1, tx, 8, T1, 4, '#8a2a00', 2);
  title(c, t2, tx + t1.w + gapT, 8, T2, 4, '#103a6a', 2);
  /* 영어 부제 — 분홍 → 보라, 금화 더미 위 */
  const S1 = ['#ffe0f4', '#ff9ad5', '#ff5aa8', '#e04ad8', '#a84dff'];
  const sub = mask('JUMP ROPE CHAMPION', 'G11B', 11, 1, false, 1);
  title(c, sub, Math.round((W - sub.w) / 2), 90, S1, 2, '#3a0a4a', 1);
  frame(c, W, H, 3, 9);
  coin(c, W / 2 - 3, 0);
  coin(c, 12, 12);
  for (const dx of [-12, 10]) A.sprite(c, W / 2 + dx, 2, A.SPR.spark, { w: '#fff6b0' });

  /* ===== 로비 로고 (투명 배경) — 배너와 같은 제목 ===== */
  const LW = Math.max(tw, sub.w) + 12, LH = t1.h + 4 + 2 + 6 + sub.h + 2 + 6;
  const L = document.createElement('canvas'); L.width = LW; L.height = LH;
  const l = L.getContext('2d');
  const lx = Math.round((LW - tw) / 2);
  title(l, t1, lx, 4, T1, 4, '#8a2a00', 2);
  title(l, t2, lx + t1.w + gapT, 4, T2, 4, '#103a6a', 2);
  title(l, sub, Math.round((LW - sub.w) / 2), t1.h + 14, S1, 2, '#3a0a4a', 1);
  return { banner: toURL(cv), logo: toURL(L), tw, sub: sub.w, lw: LW, lh: LH };
});
await browser.close();

const png = (u) => Buffer.from(u.split(',')[1], 'base64');
await sharp(png(out.banner)).resize(792, 336, { kernel: 'nearest' }).webp({ lossless: true }).toFile(path.join(root, 'public/assets/ui/banner_jumprope.webp'));
await sharp(png(out.banner)).resize(792, 336, { kernel: 'nearest' }).png().toFile(path.join(root, 'tools/_out/banner_jumprope_preview.png'));
await sharp(png(out.logo)).resize(out.lw * 3, out.lh * 3, { kernel: 'nearest' }).png({ compressionLevel: 9 }).toFile(path.join(root, 'public/assets/jumprope-logo.png'));
console.log('제목 폭', out.tw, '부제 폭', out.sub, '로고', out.lw, 'x', out.lh);
for (const f of ['public/assets/ui/banner_jumprope.webp', 'public/assets/jumprope-logo.png']) console.log('✓', f, fs.statSync(path.join(root, f)).size, 'bytes');
