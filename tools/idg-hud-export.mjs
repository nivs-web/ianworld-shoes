/**
 * 이안 드래곤 게임 — 전투 HUD 아이콘 내보내기 (겜팀장 보조)   node tools/idg-hud-export.mjs
 * art/ui_hud.js 의 그림을 3배(최근접) PNG 로 public/assets/iandragon_game/ui/hud_<이름>.png + hud_icons.json,
 * 미리보기 시트 tools/_out/hud_icons_preview.png (1차 아이콘) · hud_icons2_preview.png (2차 새 아이콘) — 밤색 바탕, 3배.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { HUD_ICONS, HUD_ICONS2 } from '../src/games/iandragon_game/art/ui_hud.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const DIR = path.join(ROOT, 'public/assets/iandragon_game/ui');
const SC = 3;
fs.mkdirSync(DIR, { recursive: true });
fs.mkdirSync(path.join(ROOT, 'tools/_out'), { recursive: true });

const up = (p, s) => {
  const W = p.w * s, H = p.h * s, b = Buffer.alloc(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (Math.floor(y / s) * p.w + Math.floor(x / s)) * 4, o = (y * W + x) * 4;
    b[o] = p.d[i]; b[o + 1] = p.d[i + 1]; b[o + 2] = p.d[i + 2]; b[o + 3] = p.d[i + 3];
  }
  return { b, W, H };
};

const list = {}, tiles = [], tiles2 = [];
for (const [name, def] of Object.entries(HUD_ICONS)) {
  const p = def.draw();
  for (let i = 3; i < p.d.length; i += 4) if (p.d[i] !== 0 && p.d[i] !== 255) throw new Error(`반투명 칸 ${name}`);
  const { b, W, H } = up(p, SC);
  const file = `hud_${name.replace('ui/hud/', '')}.png`;
  await sharp(b, { raw: { width: W, height: H, channels: 4 } }).png({ compressionLevel: 9 }).toFile(path.join(DIR, file));
  list[name] = { file: `ui/${file}`, w: W, h: H, srcW: p.w, srcH: p.h, scale: SC };
  (name in HUD_ICONS2 ? tiles2 : tiles).push({ b, W, H });
}
fs.writeFileSync(path.join(DIR, 'hud_icons.json'), JSON.stringify(list, null, 1) + '\n');

/* 미리보기: 한 줄 8개, 밤색 바탕 + 칸마다 살짝 밝은 판 */
async function sheet(tl, file) {
  const COLS = 8, CELL = 32 * SC + 16;
  const rows = Math.ceil(tl.length / COLS), W = COLS * CELL + 16, H = rows * CELL + 16;
  const bg = Buffer.alloc(W * H * 4);
  for (let i = 0; i < W * H; i++) { bg[i * 4] = 0x0d; bg[i * 4 + 1] = 0x12; bg[i * 4 + 2] = 0x30; bg[i * 4 + 3] = 255; }
  const put = (t, ox, oy) => { for (let y = 0; y < t.H; y++) for (let x = 0; x < t.W; x++) { const s = (y * t.W + x) * 4; if (!t.b[s + 3]) continue; const o = ((oy + y) * W + ox + x) * 4; bg[o] = t.b[s]; bg[o + 1] = t.b[s + 1]; bg[o + 2] = t.b[s + 2]; } };
  tl.forEach((t, i) => {
    const cx = 16 + (i % COLS) * CELL, cy = 16 + Math.floor(i / COLS) * CELL;
    for (let y = 0; y < CELL - 8; y++) for (let x = 0; x < CELL - 8; x++) { const o = ((cy - 4 + y) * W + cx - 4 + x) * 4; bg[o] = 0x16; bg[o + 1] = 0x1c; bg[o + 2] = 0x42; }
    put(t, cx + Math.floor((32 * SC - t.W) / 2), cy + Math.floor((32 * SC - t.H) / 2));
  });
  await sharp(bg, { raw: { width: W, height: H, channels: 4 } }).png().toFile(path.join(ROOT, 'tools/_out', file));
  return `${W}×${H}`;
}
const s1 = await sheet(tiles, 'hud_icons_preview.png'), s2 = await sheet(tiles2, 'hud_icons2_preview.png');
console.log(`HUD 아이콘 ${tiles.length + tiles2.length}장 (1차 ${tiles.length} · 2차 ${tiles2.length}) → public/assets/iandragon_game/ui/ · 미리보기 ${s1} · 2차 ${s2}`);
console.log(Object.keys(HUD_ICONS).join(' '));
