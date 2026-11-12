/**
 * 그림 담당 — 프로필 · 명예의 전당용 큰 머리 그림 (2026-11-11 · 대표님 «프로필 카드의 용이 너무 작다» · 겜팀장 전달)
 *
 *   node tools/idg-head-big.mjs [id ...]      (없으면 parts.json 이 있는 용 · 리더 전부)
 *
 * 게임 부품 ai/<id>/head.png 는 전투용이라 40칸 남짓 — 카드에 키우면 흐릿하고 작다.
 * 그 부품을 잘라 낸 **원본 제미나이 시트**(parts.json 의 src · 머리 칸)에서 다시 잘라 높이 256 으로 → ai/<id>/head_big.png (새 파일)
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const G = 'C:/Users/ariancepc/Desktop/cowork/iandragon/docs/style_refs/gen/';
const AI = path.join(ROOT, 'public/assets/iandragon_game/ai');
const isKey = (r, g, b) => (r > 150 && b > 150 && g < 110 && Math.abs(r - b) < 90) || ((r + b) / 2 - g > 70 && r > 120 && b > 110);
let ids = process.argv.slice(2);
if (!ids.length) ids = fs.readdirSync(AI).filter((d) => { const f = path.join(AI, d, 'rig.json'); return fs.existsSync(f) && JSON.parse(fs.readFileSync(f, 'utf8')).kind !== 'zombie' && fs.existsSync(path.join(AI, d, 'parts.json')) && fs.existsSync(path.join(AI, d, 'wing.png')) && !/^boss|^bat$|wingz|shard/.test(d); });
const made = [], skip = [];
for (const id of ids) {
  const P = JSON.parse(fs.readFileSync(path.join(AI, id, 'parts.json'), 'utf8')), r = P.parts?.head?.src;
  if (!r || !fs.existsSync(G + P.src)) { skip.push(id); continue; }
  const pad = 6, m = await sharp(G + P.src).metadata();
  const L = Math.max(0, r.x - pad), T = Math.max(0, r.y - pad), Wc = Math.min(m.width - L, r.w + pad * 2), Hc = Math.min(m.height - T, r.h + pad * 2);
  const { data, info } = await sharp(G + P.src).extract({ left: L, top: T, width: Wc, height: Hc }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, rgba = Buffer.alloc(W * H * 4), seen = new Uint8Array(W * H), st = [];
  for (let i = 0; i < W * H; i++) { rgba[i * 4] = data[i * 3]; rgba[i * 4 + 1] = data[i * 3 + 1]; rgba[i * 4 + 2] = data[i * 3 + 2]; rgba[i * 4 + 3] = 255; }
  for (let x = 0; x < W; x++) st.push(x, (H - 1) * W + x); for (let y = 0; y < H; y++) st.push(y * W, y * W + W - 1);
  while (st.length) { const q = st.pop(); if (seen[q]) continue; seen[q] = 1; if (!isKey(data[q * 3], data[q * 3 + 1], data[q * 3 + 2])) continue; rgba[q * 4 + 3] = 0;
    const x = q % W, y = (q / W) | 0; if (x > 0) st.push(q - 1); if (x < W - 1) st.push(q + 1); if (y > 0) st.push(q - W); if (y < H - 1) st.push(q + W); }
  /* 머리 칸 옆 다른 부품 조각이 끼면 지우기 : 가장 큰 덩어리만 남김 */
  const lab = new Int32Array(W * H).fill(-1), sizes = [];
  for (let s0 = 0; s0 < W * H; s0++) { if (!rgba[s0 * 4 + 3] || lab[s0] >= 0) continue; const id2 = sizes.length, q2 = [s0]; lab[s0] = id2; let n = 0;
    while (q2.length) { const q = q2.pop(); n++; const x = q % W, y = (q / W) | 0; for (const nq of [x > 0 ? q - 1 : -1, x < W - 1 ? q + 1 : -1, y > 0 ? q - W : -1, y < H - 1 ? q + W : -1]) if (nq >= 0 && rgba[nq * 4 + 3] && lab[nq] < 0) { lab[nq] = id2; q2.push(nq); } }
    sizes.push(n); }
  const big = sizes.indexOf(Math.max(...sizes));
  for (let i = 0; i < W * H; i++) if (rgba[i * 4 + 3] && lab[i] !== big && sizes[lab[i]] < sizes[big] * 0.08) rgba[i * 4 + 3] = 0;
  const t = await sharp(await sharp(rgba, { raw: { width: W, height: H, channels: 4 } }).trim({ threshold: 0 }).png().toBuffer()).resize({ height: 256, kernel: 'lanczos3' }).raw().toBuffer({ resolveWithObject: true });
  const d = t.data; for (let i = 0; i < d.length; i += 4) { if (d[i + 3] < 128) d[i] = d[i + 1] = d[i + 2] = d[i + 3] = 0; else { const a = d[i + 3] / 255; for (let c = 0; c < 3; c++) d[i + c] = Math.min(255, Math.round(d[i + c] / a)); d[i + 3] = 255; } }
  await sharp(d, { raw: { width: t.info.width, height: 256, channels: 4 } }).png({ compressionLevel: 9 }).toFile(path.join(AI, id, 'head_big.png'));
  made.push(`${id} ${t.info.width}×256`);
}
console.log(`→ ai/<id>/head_big.png ${made.length}개 : ${made.join(' · ')}${skip.length ? `\n✘ 원본 없음 : ${skip.join(' ')}` : ''}`);
