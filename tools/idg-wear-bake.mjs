/**
 * 좀비와 드래곤 — 꾸미기 착용 그림 굽기 (겜보조 1 · 2026-11-13 · 겜부장 «꾸미기 그림은 하나 · 대장 드래곤 10마리마다 기준점 3개 + 크기»)
 *
 *   node tools/idg-wear-bake.mjs [--check]
 *
 * 표 두 장 (손으로 고치는 값) :
 *   public/assets/iandragon_game/ai/meta/wear_anchor.json  대장 드래곤마다 head · neck · back 기준점 + size(1~5) + 크기
 *   public/assets/iandragon_game/ai/meta/wear_items.json   물건마다 src(꾸미기 그림) · w(상대 폭) · anchor(그림에서 붙는 점) · layer · cover
 * 결과 : ai/meta/wear/fit/<물건>_<폭>.png — 꾸미기 그림(상점 그림 그대로)을 «그 드래곤 도트 칸에 맞는 폭»으로 줄인 그림
 *        (정수 폭 · 반투명 없음 · 흐림 없음). 표를 고치면 이 도구를 다시 돌린다(안 쓰는 폭 파일은 지운다).
 * 폭 = round(물건 w × 그 점의 w).  모자 w 는 head.w(없으면 sizes[size].head) · 목 장식 앞 = neck.w · 망토류(layer back) = back.w
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const AI = path.join(ROOT, 'public/assets/iandragon_game/ai');
const META = path.join(AI, 'meta');
const OUT = path.join(META, 'wear/fit');
const A = JSON.parse(fs.readFileSync(path.join(META, 'wear_anchor.json'), 'utf8'));
const I = JSON.parse(fs.readFileSync(path.join(META, 'wear_items.json'), 'utf8'));
const CHECK = process.argv.includes('--check');

/** 물건이 어느 점 · 몇 칸 폭으로 그려지나 (wearKit.js 와 같은 식) */
export function widthFor(item, D, sizes) {
  const base = item.slot === 'hat' ? (D.head.w ?? sizes[D.size].head) : item.layer === 'back' ? D.back.w : D.neck.w;
  return Math.max(2, Math.round(item.w * base));
}
const need = new Map();   // 파일 이름 → { id, w }
for (const [id, it] of Object.entries(I.items)) for (const D of Object.values(A.dragons)) { const w = widthFor(it, D, A.sizes); need.set(`${id}_${w}`, { id, w }); }

if (CHECK) { let miss = 0; for (const k of need.keys()) if (!fs.existsSync(path.join(OUT, k + '.png'))) { miss++; console.log('없음', k); } console.log(miss ? `❌ ${miss}개 없음` : `✅ ${need.size}개 다 있음`); process.exit(miss ? 1 : 0); }

fs.mkdirSync(OUT, { recursive: true });
const srcOf = (it) => path.join(ROOT, 'public/assets/iandragon_game', it.src);
const cache = new Map();
/**
 * 모자 속 «머리가 들어가는 어두운 구멍»을 투명으로 뚫는다 — 모자를 머리 위에 겹쳐 그리므로 구멍이 얼굴을 까맣게 가리지 않게.
 * 어두운 칸(밝기 < DARK)을 R칸 깎아 얇은 윤곽선을 없애고, 남은 덩어리 중 아래쪽에 있고 가장자리에 안 닿고 모자의 3% 이상인 것만 구멍으로 본다
 * (까만 해적 모자처럼 모자 전체가 어두우면 구멍으로 안 침). 구멍 가장자리 윤곽은 남긴다. 물건 표에 hole:false 면 건너뜀.
 */
const DARK = 62;
function punchHole(buf, w, h) {
  const R = Math.max(2, Math.round(w / 40)), N = w * h;
  const dark = new Uint8Array(N); for (let i = 0; i < N; i++) dark[i] = buf[i * 4 + 3] > 200 && (buf[i * 4] * 0.3 + buf[i * 4 + 1] * 0.59 + buf[i * 4 + 2] * 0.11) < DARK ? 1 : 0;
  const box = (src, op) => {   // 가로 · 세로 R칸 최소/최대 필터
    const t = new Uint8Array(N), o = new Uint8Array(N);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let v = op === 'min' ? 1 : 0; for (let k = -R; k <= R; k++) { const xx = x + k; const b = xx < 0 || xx >= w ? (op === 'min' ? 0 : 0) : src[y * w + xx]; v = op === 'min' ? v & b : v | b; } t[y * w + x] = v; }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let v = op === 'min' ? 1 : 0; for (let k = -R; k <= R; k++) { const yy = y + k; const b = yy < 0 || yy >= h ? 0 : t[yy * w + x]; v = op === 'min' ? v & b : v | b; } o[y * w + x] = v; }
    return o;
  };
  const core = box(dark, 'min');
  const seen = new Uint8Array(N); let best = null;
  for (let s = 0; s < N; s++) {
    if (!core[s] || seen[s]) continue;
    const q = [s]; seen[s] = 1; let area = 0, x0 = w, x1 = 0, y0 = h, y1 = 0; const px = [];
    while (q.length) { const c = q.pop(); px.push(c); area++; const x = c % w, y = (c / w) | 0; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      for (const n of [c - 1, c + 1, c - w, c + w]) if (n >= 0 && n < N && core[n] && !seen[n] && !(Math.abs((n % w) - x) > 1)) { seen[n] = 1; q.push(n); } }
    const cy = (y0 + y1) / 2;
    if (process.env.WEAR_DEBUG && area > N * 0.005) console.log('    후보', `면적 ${(area / N * 100).toFixed(1)}% 가로 ${x0}-${x1}/${w} 세로 ${y0}-${y1}/${h}`);
    if (area < N * 0.03 || cy < h * 0.5 || x0 <= 1 || x1 >= w - 2 || y0 <= 1) continue;
    if (!best || area > best.area) best = { area, px };
  }
  if (!best) return false;
  const hole = new Uint8Array(N); for (const c of best.px) hole[c] = 1;
  const grown = box(hole, 'max');
  let n = 0; for (let i = 0; i < N; i++) if (grown[i] && dark[i]) { buf[i * 4 + 3] = 0; n++; }
  return n;
}
async function crop(file, hole) {   // 투명 가장자리를 잘라낸 그림 (모자는 머리 구멍을 뚫는다)
  const key = file + (hole ? '#h' : '');
  if (cache.has(key)) return cache.get(key);
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let x0 = info.width, y0 = info.height, x1 = -1, y1 = -1;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) if (data[(y * info.width + x) * 4 + 3] > 40) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const w = x1 - x0 + 1, h = y1 - y0 + 1, buf = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) data.copy(buf, y * w * 4, ((y0 + y) * info.width + x0) * 4, ((y0 + y) * info.width + x0 + w) * 4);
  const punched = hole ? punchHole(buf, w, h) : false;
  const r = { buf: await sharp(buf, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer(), w, h, punched };
  cache.set(key, r); return r;
}

/**
 * 덮는 모자용 «모자용 머리»(뿔 · 볏을 지운 머리) — 지금 게임이 쓰는 머리 그림(리그 보정 files 의 head_v2 같은 새 그림 포함)을 바탕으로,
 * 옛 모자용 머리(ai/meta/wear/heads/<용>/hat_crown_head*.png = 모양만 맞춘 것)의 모양대로 오려서 만든다.
 *   모양이 같은 칸 = 지금 머리 그림 픽셀 · 옛 모자용 머리가 새로 채운 칸 = 옛 모자용 머리 픽셀 · 모자용 머리에 없는 칸(뿔 · 볏) = 투명
 * 결과 : ai/meta/wear/heads/<용>/cover.png · cover_blink.png · cover_breath.png (wear_anchor.json 의 cover 가 가리키는 이름)
 */
const FIXD = JSON.parse(fs.readFileSync(path.join(META, 'rigfix_dragon.json'), 'utf8'));
async function bakeCovers() {
  let n = 0;
  for (const art of Object.keys(A.dragons)) {
    const files = FIXD[art]?.files || {};
    for (const [part, suffix] of [['head', ''], ['head_blink', '_blink'], ['head_breath', '_breath']]) {
      const cur = await sharp(path.join(AI, art, (files[part] || part) + '.png')).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const old = await sharp(path.join(AI, art, part + '.png')).ensureAlpha().raw().toBuffer();
      const cov = await sharp(path.join(META, 'wear/heads', art, `hat_crown_head${suffix}.png`)).ensureAlpha().raw().toBuffer();
      const out = Buffer.alloc(cur.data.length);
      for (let i = 0; i < out.length; i += 4) {
        if (cov[i + 3] < 128) continue;                                   // 모자용 머리에 없는 칸 → 투명
        const src = old[i + 3] >= 128 ? cur.data : cov;                   // 옛 머리에도 있던 칸 = 지금 그림 · 새로 채운 칸 = 모자용 머리 픽셀
        out[i] = src[i]; out[i + 1] = src[i + 1]; out[i + 2] = src[i + 2]; out[i + 3] = 255;
      }
      const dir = path.join(META, 'wear/heads', art); fs.mkdirSync(dir, { recursive: true });
      await sharp(out, { raw: { width: cur.info.width, height: cur.info.height, channels: 4 } }).png({ compressionLevel: 9 }).toFile(path.join(dir, `cover${suffix}.png`)); n++;
    }
  }
  console.log(`모자용 머리 ${n}장 (cover*.png)`);
}
if (!CHECK) await bakeCovers();
const keep = new Set();
let made = 0;
for (const [k, { id, w }] of need) {
  keep.add(k + '.png');
  const out = path.join(OUT, k + '.png');
  const it = I.items[id], c = await crop(srcOf(it), it.slot === 'hat' && it.hole !== false);
  const h = Math.max(1, Math.round(c.h * w / c.w));
  const { data } = await sharp(c.buf).resize(w, h, { kernel: 'lanczos3', fit: 'fill' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {   // 반투명 없애기 (위에서 한 번 어두워진 가장자리 색은 되살림)
    if (data[i + 3] < 120) { data[i] = data[i + 1] = data[i + 2] = data[i + 3] = 0; continue; }
    const a = data[i + 3] / 255; data[i] = Math.min(255, data[i] / a); data[i + 1] = Math.min(255, data[i + 1] / a); data[i + 2] = Math.min(255, data[i + 2] / a); data[i + 3] = 255;
  }
  await sharp(data, { raw: { width: w, height: h, channels: 4 } }).png({ compressionLevel: 9 }).toFile(out);
  made++;
}
let removed = 0;
for (const f of fs.readdirSync(OUT)) if (!keep.has(f)) { fs.unlinkSync(path.join(OUT, f)); removed++; }
for (const [id, it] of Object.entries(I.items)) if (it.slot === 'hat') console.log(`  구멍 ${id.padEnd(18)} ${cache.get(srcOf(it) + '#h')?.punched ? '뚫음 ' + cache.get(srcOf(it) + '#h').punched : '안 뚫음'}`);
console.log(`굽기 끝 : ${made}개 (지운 것 ${removed}개) → ${path.relative(ROOT, OUT)}`);
