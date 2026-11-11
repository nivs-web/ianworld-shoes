/**
 * 그림 담당 — 새로 그린 날개 · 꼬리를 «새 이름» 부품으로 (2026-11-11 · 퉤퉤 «꼬리가 이상한 데서 꼬여 있고 날개도 날개 같지 않다»)
 *
 *   node tools/idg-part-v2.mjs <id> [id ...]
 *
 * 제미나이 wing2_<id> · tail2_<id> (분홍 바탕 · 날개 뿌리 = 오른쪽 아래 · 꼬리 뿌리 = 오른쪽 끝)를
 * rig.json 의 기준점(a) 규칙에 맞춘 칸에 놓아 ai/<id>/wing_v2.png · tail_v2.png 로 (기존 파일은 그대로 · R2 캐시).
 *  날개 : 부품 파일은 뿌리가 왼쪽 아래(rig 가 flip) → 좌우 뒤집어 뿌리를 a = [0.15, 0.9] 자리에 · 폭 = 몸통 폭 × 1.55 (머리가 큰 아기 용이라 novart 1.3 보다 조금 크게)
 *  꼬리 : 뿌리(오른쪽 끝 세로 가운데)를 a = [0.9, 0.55] 자리에 · 폭 = 몸통 폭 × (novart 꼬리 폭 / novart 몸통 폭)
 * 크기 · 자리 이름은 tools/idg-rig-manual.json 의 files 로 → idg-rig-fix.mjs propose 가 ai/meta/rigfix.json 에 넣는다.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const G = 'C:/Users/ariancepc/Desktop/cowork/iandragon/docs/style_refs/gen/';
const AI = path.join(ROOT, 'public/assets/iandragon_game/ai');
const latest = (n) => fs.readdirSync(G).filter((f) => f.startsWith(n + '_') && /^\d+\.png$/.test(f.slice(n.length + 1))).sort().at(-1);
const isKey = (r, g, b) => (r > 150 && b > 150 && g < 110 && Math.abs(r - b) < 90) || ((r + b) / 2 - g > 70 && r > 120 && b > 110);
const meta = async (id, n) => sharp(path.join(AI, id, n + '.png')).metadata();
const nov = { torso: await meta('novart', 'torso'), tail: await meta('novart', 'tail') };

async function cutout(file, w) {
  const { data, info } = await sharp(G + file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, rgba = Buffer.alloc(W * H * 4), seen = new Uint8Array(W * H), st = [];
  for (let i = 0; i < W * H; i++) { rgba[i * 4] = data[i * 3]; rgba[i * 4 + 1] = data[i * 3 + 1]; rgba[i * 4 + 2] = data[i * 3 + 2]; rgba[i * 4 + 3] = data[i * 3] > 200 && data[i * 3 + 2] > 200 && data[i * 3 + 1] < 70 ? 0 : 255; }
  for (let x = 0; x < W; x++) st.push(x, (H - 1) * W + x); for (let y = 0; y < H; y++) st.push(y * W, y * W + W - 1);
  while (st.length) { const q = st.pop(); if (seen[q]) continue; seen[q] = 1; if (!isKey(data[q * 3], data[q * 3 + 1], data[q * 3 + 2])) continue; rgba[q * 4 + 3] = 0;
    const x = q % W, y = (q / W) | 0; if (x > 0) st.push(q - 1); if (x < W - 1) st.push(q + 1); if (y > 0) st.push(q - W); if (y < H - 1) st.push(q + W); }
  const t = await sharp(await sharp(rgba, { raw: { width: W, height: H, channels: 4 } }).trim({ threshold: 0 }).png().toBuffer()).resize({ width: w, kernel: 'lanczos3' }).raw().toBuffer({ resolveWithObject: true });
  const d = t.data; for (let i = 0; i < d.length; i += 4) { if (d[i + 3] < 128) d[i] = d[i + 1] = d[i + 2] = d[i + 3] = 0; else { const a = d[i + 3] / 255; for (let c = 0; c < 3; c++) d[i + c] = Math.min(255, Math.round(d[i + c] / a)); d[i + 3] = 255; } }
  return { d, w: t.info.width, h: t.info.height };
}
const place = async (p, W, H, left, top, flip) => {
  let img = sharp(p.d, { raw: { width: p.w, height: p.h, channels: 4 } }); if (flip) img = img.flop();
  return sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([{ input: await img.png().toBuffer(), left, top }]).png({ compressionLevel: 9 }).toBuffer();
};

const manualFile = path.join(ROOT, 'tools/idg-rig-manual.json');
const manual = fs.existsSync(manualFile) ? JSON.parse(fs.readFileSync(manualFile, 'utf8')) : {};
for (const id of process.argv.slice(2)) {
  const torso = await meta(id, 'torso'), files = {};
  if (latest('wing2_' + id)) {
    const p = await cutout(latest('wing2_' + id), Math.round(torso.width * 1.55));
    const W = Math.ceil(p.w / 0.85) + 1, H = Math.ceil(p.h / 0.9) + 1;               // 뿌리(뒤집은 뒤 왼쪽 아래) = (0.15W, 0.9H)
    fs.writeFileSync(path.join(AI, id, 'wing_v2.png'), await place(p, W, H, W - p.w, 0, true)); files.wing = 'wing_v2';
    console.log(`→ ai/${id}/wing_v2.png ${W}×${H}`);
  }
  if (latest('tail2_' + id)) {
    const p = await cutout(latest('tail2_' + id), Math.round(torso.width * 1.25 * nov.tail.width / nov.torso.width));
    let y0 = p.h, y1 = 0; const cx = p.w - 2;                                        // 뿌리 높이 = 오른쪽 끝 세로 가운데
    for (let y = 0; y < p.h; y++) if (p.d[(y * p.w + cx) * 4 + 3]) { y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    const yr = (y0 + y1) / 2, W = Math.ceil(p.w / 0.9), H = Math.max(p.h, Math.ceil(yr / 0.55), Math.ceil((p.h - yr) / 0.45)) + 1, top = Math.max(0, Math.round(0.55 * H - yr));
    fs.writeFileSync(path.join(AI, id, 'tail_v2.png'), await place(p, W, Math.max(H, top + p.h), 0, top, false)); files.tail = 'tail_v2';
    console.log(`→ ai/${id}/tail_v2.png ${W}×${Math.max(H, top + p.h)}`);
  }
  manual[id] = { ...(manual[id] || {}), files: { ...(manual[id]?.files || {}), ...files } };
}
fs.writeFileSync(manualFile, JSON.stringify(manual, null, 1) + '\n');
