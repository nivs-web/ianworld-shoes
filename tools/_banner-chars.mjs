/**
 * «좀비와 드래곤» 배너 v2 용 — 부품 시트에서 캐릭터를 «고해상도»로 조립한다 (겜팀장 · 2026-11-11)
 *
 * 게임의 ai/<이름>/rig.json (부품 순서 · 기준점 a · 자리 p) 과 parts.json (시트에서 자른 네모 src · 배율)을 그대로 따른다.
 * 게임은 작은 부품 그림(배율 0.164 등)에 p 를 쓰므로, 여기서는 시트 원본 크기(= 작은 단위 ÷ 배율)로 조립한다.
 * 분홍(#FF00FF) 지우기 · 가장자리 분홍 번짐 걷기 · 덩어리 나누기는 tools/idg-parts-cut.mjs 의 방식을 그대로 베꼈다(가져오지 않고 복사).
 * 새 그림은 만들지 않는다 — 기존 부품 시트를 자르고 이어 붙일 뿐.
 */
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

export const AI_DIR = 'C:/Users/ariancepc/Desktop/cowork/oraksil/fs-idg/public/assets/iandragon_game/ai';
export const SHEET_DIR = 'C:/Users/ariancepc/Desktop/cowork/iandragon/docs/style_refs/gen';

/** 시트 한 장을 읽어 분홍을 지우고 덩어리 번호표를 만든다 */
async function loadSheet(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  const isKey = (i) => { const r = data[i], g = data[i + 1], b = data[i + 2]; return r > 150 && b > 150 && g < 110 && Math.abs(r - b) < 90; };
  for (let i = 0; i < W * H * 4; i += 4) if (isKey(i)) data[i + 3] = 0;
  const pinkish = (i) => (data[i] + data[i + 2]) / 2 - data[i + 1] > 45 && data[i] > 90 && data[i + 2] > 90;
  for (let pass = 0; pass < 2; pass++) for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = (y * W + x) * 4; if (!data[i + 3] || !pinkish(i)) continue;
    if (!data[i - 4 + 3] || !data[i + 4 + 3] || !data[i - W * 4 + 3] || !data[i + W * 4 + 3]) { data[i] = 26; data[i + 1] = 16; data[i + 2] = 48; }
  }
  const lab = new Int32Array(W * H).fill(-1);
  let n = 0;
  for (let s = 0; s < W * H; s++) {
    if (lab[s] >= 0 || !data[s * 4 + 3]) continue;
    const st = [s]; lab[s] = n;
    while (st.length) {
      const p = st.pop(), x = p % W, y = (p / W) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const q = ny * W + nx; if (lab[q] < 0 && data[q * 4 + 3]) { lab[q] = n; st.push(q); }
      }
    }
    n++;
  }
  return { data, lab, W, H };
}

/** 부품 하나(시트 원본 크기) → 잘라 낸 RGBA 도트판. 덩어리 번호는 네모 안에서 가장 많은 것만 남긴다 */
function cutPart(sh, r) {
  const { data, lab, W } = sh;
  const cnt = new Map();
  for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) { const l = lab[y * W + x]; if (l >= 0) cnt.set(l, (cnt.get(l) || 0) + 1); }
  let best = -1, bn = 0; for (const [l, c] of cnt) if (c > bn) { best = l; bn = c; }
  const buf = Buffer.alloc(r.w * r.h * 4);
  for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) {
    const s = (r.y + y) * W + r.x + x;
    if (lab[s] !== best) continue;
    data.copy(buf, (y * r.w + x) * 4, s * 4, s * 4 + 4);
  }
  return buf;
}

/**
 * 캐릭터 조립 (쉬는 자세 · 눈 뜬 머리). 돌려주는 값 = { data(RGBA), w, h } — 맨 아래가 발바닥
 * opts.parts = 부품 이름 걸러내기(없으면 rig 전부)
 */
export async function assemble(id, sheetFile) {
  const rig = JSON.parse(fs.readFileSync(path.join(AI_DIR, id, 'rig.json'), 'utf8'));
  const meta = JSON.parse(fs.readFileSync(path.join(AI_DIR, id, 'parts.json'), 'utf8'));
  const sh = await loadSheet(path.join(SHEET_DIR, sheetFile || meta.src));
  const K = 1 / meta.scale;
  const items = [];
  for (const d of rig.parts) {
    const pm = meta.parts[d.n]; if (!pm) throw new Error(`${id}: 부품 ${d.n} 없음`);
    const r = pm.src, w = r.w, h = r.h;
    const raw = cutPart(sh, r);
    const ax = d.flip ? 1 - d.a[0] : d.a[0];
    const px = d.p[0] * K, py = d.p[1] * K;
    let img = sharp(raw, { raw: { width: w, height: h, channels: 4 } });
    if (d.flip) img = img.flop();
    items.push({ buf: await img.png().toBuffer(), x: Math.round(px - ax * w), y: Math.round(py - d.a[1] * h), w, h });
  }
  const x0 = Math.min(...items.map((i) => i.x)), y0 = Math.min(...items.map((i) => i.y));
  const x1 = Math.max(...items.map((i) => i.x + i.w)), y1 = Math.max(...items.map((i) => i.y + i.h));
  const W = x1 - x0, H = y1 - y0;
  const out = await sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(items.map((i) => ({ input: i.buf, left: i.x - x0, top: i.y - y0 }))).png().toBuffer();
  /* 잔여 투명 여백 잘라내기 */
  const t = await sharp(out).trim({ threshold: 1 }).png().toBuffer({ resolveWithObject: true });
  return { png: t.data, w: t.info.width, h: t.info.height, face: rig.face, kind: rig.kind };
}

/**
 * 스프라이트 → 배너에 얹을 RGBA 조각. 높이를 targetH 로 줄이고(lanczos) 반투명 가장자리는 문턱 128 로 또렷하게 한 뒤
 * 어두운 외곽선(#14082a) ring 칸을 둘러 배경에서 떠 보이게 한다. flip 이면 좌우를 뒤집는다(그림은 오른쪽을 본다 → 좀비는 뒤집는다).
 */
export async function makeSprite(pngBuf, { height, scale, flip = false, ring = 1, line = [20, 8, 42] }) {
  let img = sharp(pngBuf);
  const m = await img.metadata();
  const h = height ? Math.round(height) : Math.round(m.height * scale);
  const w = Math.round(m.width * (h / m.height));
  img = img.resize(w, h, { kernel: 'lanczos3' });
  if (flip) img = img.flop();
  const { data } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const P = ring + 1, W = w + P * 2, H = h + P * 2;
  const out = Buffer.alloc(W * H * 4);
  const solid = new Uint8Array(W * H);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const s = (y * w + x) * 4;
    if (data[s + 3] < 128) continue;
    const t = ((y + P) * W + x + P) * 4;
    out[t] = data[s]; out[t + 1] = data[s + 1]; out[t + 2] = data[s + 2]; out[t + 3] = 255;
    solid[(y + P) * W + x + P] = 1;
  }
  let cur = solid;
  for (let r = 0; r < ring; r++) {
    const nx = cur.slice();
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      if (cur[y * W + x]) continue;
      let n = false;
      for (let dy = -1; dy <= 1 && !n; dy++) for (let dx = -1; dx <= 1; dx++) if (cur[(y + dy) * W + x + dx]) { n = true; break; }
      if (!n) continue;
      nx[y * W + x] = 1;
      const t = (y * W + x) * 4; out[t] = line[0]; out[t + 1] = line[1]; out[t + 2] = line[2]; out[t + 3] = 255;
    }
    cur = nx;
  }
  return { data: out, w: W, h: H, pad: P };
}
