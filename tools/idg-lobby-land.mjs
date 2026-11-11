/**
 * 그림 담당 — 가로 로비 그림 (2026-11-11 · 겜팀장 기획 IAN_DRAGON_LOBBY_ORIENTATION_PLAN.md §6 · 화면 = 겜부장)
 *
 *   node tools/idg-lobby-land.mjs
 *
 *  ai/lobby/banner_wide.webp        가로용 짧은 배너 (로고 «좀비와 드래곤» · ZOMBIE & DRAGON 그대로 · 약 4:1) — 대표님 «가로 모드에선 타이틀 배너를 작게»
 *  ai/lobby/banner_wide_plate.webp  같은 판의 빈 판 (로고를 따로 얹고 싶을 때 · 글자 없음)
 *  ai/lobby/stage_land.webp         가로 로비 왼쪽 무대 (달밤 + 둥지 성 · 꼭대기 둥지는 비워 둠 = 리더 드래곤 자리) 1:1
 *  ai/lobby/btn_wide.webp           가로 2×2 큰 버튼 판 (btn_menu 와 같은 보라 돌 · 금테 가족 · 약 2:1 · 속은 비움)
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const G = 'C:/Users/ariancepc/Desktop/cowork/iandragon/docs/style_refs/gen/';
const L = path.join(ROOT, 'public/assets/iandragon_game/ai/lobby');
const latest = (n) => fs.readdirSync(G).filter((f) => f.startsWith(n + '_') && /^\d+\.png$/.test(f.slice(n.length + 1))).sort().at(-1);
const isKey = (r, g, b) => (r > 150 && b > 150 && g < 110 && Math.abs(r - b) < 90) || ((r + b) / 2 - g > 70 && r > 120 && b > 110);
const made = [];

/** 분홍 바탕 → 바깥에서 이어진 분홍만 투명 · 잘라내기 · 가로 W 로 */
async function cut(name, W, out) {
  const { data, info } = await sharp(G + latest(name)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height, rgba = Buffer.alloc(w * h * 4), seen = new Uint8Array(w * h), st = [];
  for (let i = 0; i < w * h; i++) { rgba[i * 4] = data[i * 3]; rgba[i * 4 + 1] = data[i * 3 + 1]; rgba[i * 4 + 2] = data[i * 3 + 2]; rgba[i * 4 + 3] = 255; }
  for (let x = 0; x < w; x++) st.push(x, (h - 1) * w + x); for (let y = 0; y < h; y++) st.push(y * w, y * w + w - 1);
  while (st.length) { const q = st.pop(); if (seen[q]) continue; seen[q] = 1; if (!isKey(data[q * 3], data[q * 3 + 1], data[q * 3 + 2])) continue; rgba[q * 4 + 3] = 0;
    const x = q % w, y = (q / w) | 0; if (x > 0) st.push(q - 1); if (x < w - 1) st.push(q + 1); if (y > 0) st.push(q - w); if (y < h - 1) st.push(q + w); }
  const t = await sharp(await sharp(rgba, { raw: { width: w, height: h, channels: 4 } }).trim({ threshold: 0 }).png().toBuffer()).resize({ width: W, kernel: 'lanczos3' }).raw().toBuffer({ resolveWithObject: true });
  const d = t.data; for (let i = 0; i < d.length; i += 4) { if (d[i + 3] < 128) d[i] = d[i + 1] = d[i + 2] = d[i + 3] = 0; else { const a = d[i + 3] / 255; for (let c = 0; c < 3; c++) d[i + c] = Math.min(255, Math.round(d[i + c] / a)); d[i + 3] = 255; } }
  await sharp(d, { raw: { width: t.info.width, height: t.info.height, channels: 4 } }).webp({ lossless: true }).toFile(path.join(L, out));
  made.push(`ai/lobby/${out} ${t.info.width}×${t.info.height}`);
}
await cut('lw_banner', 1200, 'banner_wide.webp');
await cut('lw_plate', 1200, 'banner_wide_plate.webp');
await cut('lw_button', 600, 'btn_wide.webp');
await sharp(G + latest('lw_stage')).resize(900, 900, { kernel: 'lanczos3' }).webp({ quality: 90 }).toFile(path.join(L, 'stage_land.webp'));
made.push('ai/lobby/stage_land.webp 900×900');
console.log(made.map((m) => '→ ' + m).join('\n'));
