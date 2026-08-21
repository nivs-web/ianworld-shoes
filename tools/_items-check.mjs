import sharp from 'sharp';
import { ITEMS, WEAR, itemOffset } from '../src/data/items.js';

const S = 5;
// 옆모습의 반려견은 한 계단 아래에 서므로 상자보다 아래로 나간다 — 여유를 준다
/**
 * ★ 옆모습 좌표는 **상자 밖으로 나갈 수 있다** — 무서운호랑이의 `sideDx` 는 -8 이다
 * (캔버스는 안 자르고, 자르는 것은 쇼핑 화면의 상자뿐이다). 그대로 합성하면 sharp 가
 * 음수 좌표에서 터지므로 칸마다 왼쪽에 여유를 둔다.
 */
const PAD = 12;
const W = (WEAR.w + PAD) * S, H = (WEAR.h + 16) * S;
const cols = ITEMS.length;
const canvasW = cols * W, canvasH = H * 2;
const comps = [];
for (let i = 0; i < cols; i++) {
  const it = ITEMS[i];
  for (const [ci, cut] of ['front', 'side'].entries()) {
    const ch = { input: await sharp(`public/assets/characters/ian_${cut}.png`).resize({ width: 35 * S, height: 50 * S, kernel: 'nearest' }).toBuffer(), left: i * W + (PAD + WEAR.charX) * S, top: ci * H + WEAR.charY * S };
    const off = itemOffset(it, cut);
    const item = { input: await sharp(`public/assets/items/${it.id}_${cut}.png`).resize({ width: it.w * S, height: it.h * S, kernel: 'nearest' }).toBuffer(), left: i * W + (PAD + off.x) * S, top: ci * H + off.y * S };
    if (it.behind) comps.push(item, ch); else comps.push(ch, item);
  }
}
await sharp({ create: { width: canvasW, height: canvasH, channels: 4, background: { r: 20, g: 16, b: 12, alpha: 1 } } })
  .composite(comps).png().toFile('tools/_out/items_check.png');
console.log('ok', canvasW, canvasH);
