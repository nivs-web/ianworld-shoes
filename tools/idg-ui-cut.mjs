/**
 * 그림 담당 — UI 시트 자르기 (2026-11-11) : 제미나이 아이콘 · 버튼 시트(분홍 바탕) → 게임 크기 PNG
 *
 *   node tools/idg-ui-cut.mjs <시트.png> <칸 가로x세로> <이름들(쉼표 · '-' 는 버림)> [--hud | --out <폴더> --max <긴 변>]
 *
 * 분홍(#FF00FF)을 지우고 → 붙은 덩어리를 찾아 → 덩어리 중심이 든 칸(왼→오른, 위→아래)으로 묶는다
 * (불꽃 · 반짝이처럼 떨어진 조각도 같은 칸이면 한 아이콘). 칸마다 덩어리를 감싼 상자로 자른다.
 *  --hud : 이름 = hud_icons.json 의 «ui/hud/<이름>» — 같은 이름의 크기(srcW×srcH 바탕 칸 → scale 배 최근접)로
 *          public/assets/iandragon_game/ui/hud_<이름>.png · _s · _xs 를 덮어쓴다 (json 은 그대로 → 코드 수정 없이 교체).
 *          바탕 칸으로 줄일 때 반투명을 없앤다(게임 도트 규칙 : 칸은 완전 투명 아니면 완전 불투명).
 *  --out/--max : 고해상도 그대로(긴 변 max 칸) <폴더>/<이름>.png 로 — 로비 배경 · 버튼 판처럼 매끈하게 쓸 것.
 * 디버그 : IDG_DEBUG=1 → tools/_out/ui_cut_<시트이름>.png (칸마다 상자)
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const args = process.argv.slice(2);
const [src, gridArg, namesArg] = args;
const opt = (k) => { const i = args.indexOf(k); return i < 0 ? null : args[i + 1] ?? true; };
const HUD = args.includes('--hud');
const OUT = opt('--out');
const MAX = Number(opt('--max') || 512);
/* 칸 : «3x3» (가로x세로) 또는 «1,1,3,1» (줄마다 개수 — 줄별로 크기가 다른 버튼 시트) */
const ROWS = gridArg.includes(',') ? gridArg.split(',').map(Number) : Array(Number(gridArg.split('x')[1])).fill(Number(gridArg.split('x')[0]));
const GY = ROWS.length;
const PIXEL = Number(opt('--pixel') || 0), PSCALE = Number(opt('--scale') || 3);
const ERASE = (opt('--erase') || '').split(';').filter(Boolean).map((r) => r.split(',').map(Number));   // x,y,w,h;... 를 분홍으로 (글자 · 군더더기 지우기)
const names = namesArg.split(',');
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');

const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height;

for (const [ex, ey, ew, eh] of ERASE) for (let y = ey; y < Math.min(H, ey + eh); y++) for (let x = ex; x < Math.min(W, ex + ew); x++) { const i = (y * W + x) * 4; data[i] = 255; data[i + 1] = 0; data[i + 2] = 255; }
/* 1. 분홍 지우기 + 분홍 번짐 걷어내기 (투명과 맞닿은 분홍 기운 칸 → 투명, 세 번) */
const isKey = (i) => { const r = data[i], g = data[i + 1], b = data[i + 2]; return r > 150 && b > 150 && g < 110 && Math.abs(r - b) < 90; };
for (let i = 0; i < W * H * 4; i += 4) if (isKey(i)) data[i + 3] = 0;
const pinkish = (i) => (data[i] + data[i + 2]) / 2 - data[i + 1] > 60 && data[i] > 120 && data[i + 2] > 110;
for (let pass = 0; pass < 3; pass++) {
  const kill = [];
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = (y * W + x) * 4; if (!data[i + 3] || !pinkish(i)) continue;
    if (!data[i - 4 + 3] || !data[i + 4 + 3] || !data[i - W * 4 + 3] || !data[i + W * 4 + 3]) kill.push(i);
  }
  for (const i of kill) data[i + 3] = 0;
}

/* 2. 덩어리 (8방향) → 중심이 든 칸 */
const lab = new Int32Array(W * H).fill(-1);
const comps = [];
for (let s = 0; s < W * H; s++) {
  if (lab[s] >= 0 || !data[s * 4 + 3]) continue;
  const c = { n: 0, sx: 0, sy: 0, x0: W, y0: H, x1: 0, y1: 0, id: comps.length };
  const st = [s]; lab[s] = c.id;
  while (st.length) {
    const p = st.pop(), x = p % W, y = (p / W) | 0;
    c.n++; c.sx += x; c.sy += y; if (x < c.x0) c.x0 = x; if (y < c.y0) c.y0 = y; if (x > c.x1) c.x1 = x; if (y > c.y1) c.y1 = y;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
      const q = Y * W + X; if (lab[q] < 0 && data[q * 4 + 3]) { lab[q] = c.id; st.push(q); }
    }
  }
  comps.push(c);
}
const cells = Array.from({ length: ROWS.reduce((a, b) => a + b, 0) }, () => ({ x0: W, y0: H, x1: -1, y1: -1, ids: new Set() }));
for (const c of comps) {
  if (c.n < 40) continue;                                                    // 티끌
  const cx = c.sx / c.n, cy = c.sy / c.n;
  const row = Math.min(GY - 1, (cy / (H / GY)) | 0), n = ROWS[row];
  const k = ROWS.slice(0, row).reduce((a, b) => a + b, 0) + Math.min(n - 1, (cx / (W / n)) | 0);
  const C = cells[k]; C.ids.add(c.id);
  C.x0 = Math.min(C.x0, c.x0); C.y0 = Math.min(C.y0, c.y0); C.x1 = Math.max(C.x1, c.x1); C.y1 = Math.max(C.y1, c.y1);
}

/** 칸 하나를 투명 바탕 RGBA 로 (그 칸에 묶인 덩어리만) */
function cellImage(C) {
  const w = C.x1 - C.x0 + 1, h = C.y1 - C.y0 + 1, b = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = (C.y0 + y) * W + C.x0 + x; if (!C.ids.has(lab[p])) continue;
    const i = p * 4, o = (y * w + x) * 4; b[o] = data[i]; b[o + 1] = data[i + 1]; b[o + 2] = data[i + 2]; b[o + 3] = data[i + 3];
  }
  return { b, w, h };
}

/** 바탕 칸(bw×bh) 안에 맞춰 줄이고 → 반투명 없애고 → scale 배 최근접 */
async function toPixel(img, bw, bh, scale) {
  const k = Math.min(bw / img.w, bh / img.h);
  const w = Math.max(1, Math.round(img.w * k)), h = Math.max(1, Math.round(img.h * k));
  const small = await sharp(img.b, { raw: { width: img.w, height: img.h, channels: 4 } }).resize(w, h, { kernel: 'lanczos3' }).raw().toBuffer();
  const out = Buffer.alloc(bw * bh * 4), ox = Math.floor((bw - w) / 2), oy = Math.floor((bh - h) / 2);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4, o = ((oy + y) * bw + ox + x) * 4;
    if (small[i + 3] < 110) continue;
    const a = small[i + 3] / 255;                                            // 줄이며 섞인 가장자리 색을 되돌린다
    out[o] = Math.min(255, small[i] / a); out[o + 1] = Math.min(255, small[i + 1] / a); out[o + 2] = Math.min(255, small[i + 2] / a); out[o + 3] = 255;
  }
  return sharp(out, { raw: { width: bw, height: bh, channels: 4 } }).resize(bw * scale, bh * scale, { kernel: 'nearest' }).png({ compressionLevel: 9 });
}

const hudJson = HUD ? JSON.parse(fs.readFileSync(path.join(ROOT, 'public/assets/iandragon_game/ui/hud_icons.json'), 'utf8')) : null;
const debug = [];
for (let k = 0; k < names.length; k++) {
  const name = names[k], C = cells[k];
  if (!name || name === '-') continue;
  if (C.x1 < 0) { console.log(`✘ ${name} : 칸 ${k + 1} 이 비었다`); continue; }
  debug.push(C);
  const img = cellImage(C);
  if (HUD) {
    const keys = ['', '_s', '_xs'].map((s) => `ui/hud/${name}${s}`).filter((key) => hudJson[key]);
    for (const key of keys) {
      const e = hudJson[key];
      await (await toPixel(img, e.srcW, e.srcH, e.scale)).toFile(path.join(ROOT, 'public/assets/iandragon_game', e.file));
      console.log(`→ ${e.file} (${e.srcW}×${e.srcH} ×${e.scale})`);
    }
    if (!keys.length) console.log(`✘ ${name} : hud_icons.json 에 없음`);
  } else {
    fs.mkdirSync(OUT, { recursive: true });
    if (PIXEL) {                                                             // 아이콘 : HUD 와 같은 칸 굵기
      await (await toPixel(img, PIXEL, PIXEL, PSCALE)).toFile(path.join(OUT, name + '.png'));
      console.log(`→ ${path.join(OUT, name + '.png')} (${PIXEL}칸 ×${PSCALE})`);
      continue;
    }
    const k2 = Math.min(1, MAX / Math.max(img.w, img.h));
    await sharp(img.b, { raw: { width: img.w, height: img.h, channels: 4 } }).resize(Math.round(img.w * k2), Math.round(img.h * k2), { kernel: 'lanczos3' }).png({ compressionLevel: 9 }).toFile(path.join(OUT, name + '.png'));
    console.log(`→ ${path.join(OUT, name + '.png')} (${Math.round(img.w * k2)}×${Math.round(img.h * k2)})`);
  }
}
if (process.env.IDG_DEBUG) {
  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">${debug.map((C) => `<rect x="${C.x0}" y="${C.y0}" width="${C.x1 - C.x0}" height="${C.y1 - C.y0}" fill="none" stroke="#0f0" stroke-width="3"/>`).join('')}</svg>`;
  fs.mkdirSync(path.join(ROOT, 'tools/_out'), { recursive: true });
  await sharp(data, { raw: { width: W, height: H, channels: 4 } }).flatten({ background: '#2a1f50' }).composite([{ input: Buffer.from(svg) }]).png().toFile(path.join(ROOT, 'tools/_out/ui_cut_' + path.basename(src)));
}
