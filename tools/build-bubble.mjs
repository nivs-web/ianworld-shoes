/**
 * 1등 말풍선 · 승리 깃발 굽기 — `node tools/build-bubble.mjs`
 *
 * ## 말풍선
 * 사용자가 **글씨까지 그려서** 준 도트 이미지(`etc/bubble_first_new_font.png`, 68×34)를
 * 그대로 쓴다. 예전에는 배경만 받아 폰트를 얹어 구웠는데, 그 글씨체가 마음에 안 든다는
 * 지적을 받았다 — 그림은 그림쟁이가, 코드는 배치만.
 *
 * ## 승리 깃발
 * `etc/승리깃발.png` 는 1024×1536 렌더 이미지다. 결과 화면(DOM)에 쓰므로
 * **정수 비율로 줄이고**(1024÷6 = 170.67 → 168×252) CSS 는 `image-rendering: pixelated`.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import sharp from 'sharp';

mkdirSync('public/assets/ui', { recursive: true });

// ── 말풍선 (그대로 복사, 크기만 확인) ──
const SRC = 'etc/bubble_first_new_font.png';
const meta = await sharp(SRC).metadata();
if (meta.width !== 68 || meta.height !== 34) {
  console.error(`[!] 말풍선 크기가 68×34 가 아니다 (${meta.width}×${meta.height}) — multiHud.BUBBLE 도 같이 고칠 것`);
}
writeFileSync('public/assets/ui/bubble_first.png', readFileSync(SRC));
console.log(`말풍선: public/assets/ui/bubble_first.png (${meta.width}×${meta.height})`);

// ── 승리 깃발 ──
const FLAG_W = 168;
const FLAG_H = 252;
await sharp('etc/승리깃발.png')
  .resize(FLAG_W, FLAG_H, { kernel: 'lanczos3' })
  .png()
  .toFile('public/assets/ui/victory_flag.png');
console.log(`승리 깃발: public/assets/ui/victory_flag.png (${FLAG_W}×${FLAG_H})`);
