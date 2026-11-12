/**
 * 그림 담당 — 용 날개 다시 그리기 (2026-11-11 · 대표님 «용 날개가 정상으로 보이니? 용 날개 다시 그리자» · 겜팀장 전달)
 *
 *   node tools/idg-wing-fix.mjs <id> [id ...]
 *
 * 제미나이로 새로 그린 날개(wingfix_<id> · 뿌리 = 오른쪽 아래 어깨 관절 · 뼈 3~4개 + 이어진 막 · 분홍 바탕)를
 * 지금 ai/<id>/wing.png 와 **같은 칸 크기**, 지금 날개 그림이 차지하던 자리(왼쪽 아래 맞춤 · 부품 파일은 뿌리가 왼쪽 아래)에 넣는다 → rig.json 의 기준점(뿌리) 그대로.
 * 바꾸기 전/후 조립 비교를 public/admin/idg-gallery-review/wing_<id>.png 로 남긴다(갤러리 «고친 것» 탭).
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { assemble } from './idg-rig-preview.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const G = 'C:/Users/ariancepc/Desktop/cowork/iandragon/docs/style_refs/gen/';
const AI = path.join(ROOT, 'public/assets/iandragon_game/ai');
const TMP = path.join(ROOT, 'tools/_out/newwings'), REV = path.join(ROOT, 'public/admin/idg-gallery-review');
fs.mkdirSync(TMP, { recursive: true }); fs.mkdirSync(REV, { recursive: true });
const latest = (n) => fs.readdirSync(G).filter((f) => f.startsWith(n + '_') && /^\d+\.png$/.test(f.slice(n.length + 1))).sort().at(-1);
const isKey = (r, g, b) => (r > 150 && b > 150 && g < 110 && Math.abs(r - b) < 90) || ((r + b) / 2 - g > 70 && r > 120 && b > 110);

for (const id of process.argv.slice(2)) {
  const cur = path.join(AI, id, 'wing.png'), cm = await sharp(cur).metadata();
  /* 지금 날개가 차지한 자리 */
  const { data: cd } = await sharp(cur).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let x0 = cm.width, y0 = cm.height, x1 = 0, y1 = 0;
  for (let y = 0; y < cm.height; y++) for (let x = 0; x < cm.width; x++) if (cd[(y * cm.width + x) * 4 + 3] > 0) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
  /* 새 날개 : 바깥에서 이어진 분홍만 투명 · 잘라내기 */
  const { data, info } = await sharp(G + latest('wingfix_' + id)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, rgba = Buffer.alloc(W * H * 4), seen = new Uint8Array(W * H), st = [];
  for (let i = 0; i < W * H; i++) { rgba[i * 4] = data[i * 3]; rgba[i * 4 + 1] = data[i * 3 + 1]; rgba[i * 4 + 2] = data[i * 3 + 2]; rgba[i * 4 + 3] = data[i * 3] > 200 && data[i * 3 + 2] > 200 && data[i * 3 + 1] < 70 ? 0 : 255; }
  for (let x = 0; x < W; x++) st.push(x, (H - 1) * W + x); for (let y = 0; y < H; y++) st.push(y * W, y * W + W - 1);
  while (st.length) { const q = st.pop(); if (seen[q]) continue; seen[q] = 1; if (!isKey(data[q * 3], data[q * 3 + 1], data[q * 3 + 2])) continue; rgba[q * 4 + 3] = 0;
    const x = q % W, y = (q / W) | 0; if (x > 0) st.push(q - 1); if (x < W - 1) st.push(q + 1); if (y > 0) st.push(q - W); if (y < H - 1) st.push(q + W); }
  // 부품 파일은 뿌리가 왼쪽 아래 (rig 가 flip 해서 몸 쪽으로 붙임) → 새 그림(뿌리 오른쪽 아래)을 좌우로 뒤집어 넣는다
  const trimmed = await sharp(await sharp(rgba, { raw: { width: W, height: H, channels: 4 } }).trim({ threshold: 0 }).png().toBuffer()).flop().png().toBuffer(), tm = await sharp(trimmed).metadata();
  const k = Math.min(bw / tm.width, bh / tm.height), nw = Math.max(1, Math.round(tm.width * k)), nh = Math.max(1, Math.round(tm.height * k));
  const small = await sharp(trimmed).resize(nw, nh, { kernel: 'lanczos3' }).raw().toBuffer();
  for (let i = 0; i < small.length; i += 4) { if (small[i + 3] < 128) small[i] = small[i + 1] = small[i + 2] = small[i + 3] = 0; else { const a = small[i + 3] / 255; for (let c = 0; c < 3; c++) small[i + c] = Math.min(255, Math.round(small[i + c] / a)); small[i + 3] = 255; } }
  const piece = await sharp(small, { raw: { width: nw, height: nh, channels: 4 } }).png().toBuffer();
  const out = await sharp({ create: { width: cm.width, height: cm.height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([{ input: piece, left: x0, top: y1 + 1 - nh }]).png({ compressionLevel: 9 }).toBuffer();
  fs.writeFileSync(path.join(TMP, id + '.png'), out);
  /* 전/후 조립 비교 */
  const [a, b] = [await assemble(id, 5), await assemble(id, 5, TMP)];
  const [ma, mb] = [await sharp(a).metadata(), await sharp(b).metadata()], Hh = Math.max(ma.height, mb.height) + 40;
  const lab = (t, x) => ({ input: Buffer.from(`<svg width="300" height="30" xmlns="http://www.w3.org/2000/svg"><text x="4" y="22" font-size="20" font-family="Malgun Gothic,Arial" font-weight="700" fill="#ffe08a">${t}</text></svg>`), left: x, top: 4 });
  await sharp({ create: { width: ma.width + mb.width + 60, height: Hh, channels: 3, background: '#2a2140' } })
    .composite([{ input: a, left: 20, top: Hh - ma.height - 6 }, { input: b, left: ma.width + 40, top: Hh - mb.height - 6 }, lab(`${id} 고치기 전`, 20), lab(`${id} 고친 뒤`, ma.width + 40)]).png().toFile(path.join(REV, `wing_${id}.png`));
  fs.copyFileSync(path.join(TMP, id + '.png'), cur);
  console.log(`→ ai/${id}/wing.png ${cm.width}×${cm.height} (기존 파일 바꿈) · 전/후 admin/idg-gallery-review/wing_${id}.png`);
}
