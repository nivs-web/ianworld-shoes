import sharp from 'sharp';
import { ITEMS, WEAR } from '../src/data/items.js';

const S = 5;
const W = WEAR.w * S, H = WEAR.h * S;
const cols = ITEMS.length;
const canvasW = cols * W, canvasH = H * 2;
const comps = [];
for (let i = 0; i < cols; i++) {
  const it = ITEMS[i];
  for (const [ci, cut] of ['front', 'side'].entries()) {
    const ch = { input: await sharp(`public/assets/characters/ian_${cut}.png`).resize({ width: 35 * S, height: 50 * S, kernel: 'nearest' }).toBuffer(), left: i * W + WEAR.charX * S, top: ci * H + WEAR.charY * S };
    const item = { input: await sharp(`public/assets/items/${it.id}_${cut}.png`).resize({ width: it.w * S, height: it.h * S, kernel: 'nearest' }).toBuffer(), left: i * W + it.dx * S, top: ci * H + it.dy * S };
    if (it.behind) comps.push(item, ch); else comps.push(ch, item);
  }
}
await sharp({ create: { width: canvasW, height: canvasH, channels: 4, background: { r: 20, g: 16, b: 12, alpha: 1 } } })
  .composite(comps).png().toFile('tools/_out/items_check.png');
console.log('ok', canvasW, canvasH);
