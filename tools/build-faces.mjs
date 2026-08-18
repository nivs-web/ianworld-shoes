/**
 * 캐릭터 얼굴 아이콘 — `<id>_front.png`(35×50) 의 머리 부분을 **1:1로 잘라** 16×16 PNG.
 *
 * 멀티 인게임에서 상대를 이름만으로 구분하려면 글자를 키워야 하는데, 180×320 안에서
 * 그럴 자리가 없다. 얼굴 아이콘 하나면 이름은 7px 로 줄여도 누군지 바로 안다.
 *
 * **축소하지 않는다.** 35×50 캐릭터의 머리는 이미 16px 안팎이라 그대로 잘라 쓰면
 * 무손실이다. 리샘플하면 도트가 뭉개진다(CLAUDE.md §5).
 */

import sharp from 'sharp';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = resolve(ROOT, 'public/assets/characters');
const META = resolve(ROOT, 'src/data/characters.generated.json');
const SIZE = 16;

const chars = JSON.parse(readFileSync(META, 'utf8'));
const ids = Array.isArray(chars) ? chars.map((c) => c.id) : Object.keys(chars);

let made = 0;
for (const id of ids) {
  const src = resolve(DIR, `${id}_front.png`);
  if (!existsSync(src)) { console.warn(`[얼굴] ${id}_front.png 없음 — 건너뜀`); continue; }

  const img = sharp(src);
  const { width, height } = await img.metadata();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });

  // 알파가 있는 픽셀들의 경계 상자 — 머리 꼭대기와 가로 중심을 찾는다
  let top = height, left = width, right = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * info.channels + 3] > 8) {
        if (y < top) top = y;
        if (x < left) left = x;
        if (x > right) right = x;
      }
    }
  }
  if (right < 0) { console.warn(`[얼굴] ${id} 비어 있음 — 건너뜀`); continue; }

  // 머리 위로 1도트 여백, 가로는 몸통 중심
  const cx = (left + right) >> 1;
  const sx = Math.max(0, Math.min(width - SIZE, cx - (SIZE >> 1)));
  // 머리 꼭대기부터 16줄을 자르면 머리카락만 나온다 — 눈이 들어오게 3도트 내려서 자른다
  const sy = Math.max(0, Math.min(height - SIZE, top + 3));

  const out = await sharp(src)
    .extract({ left: sx, top: sy, width: Math.min(SIZE, width - sx), height: Math.min(SIZE, height - sy) })
    .png({ compressionLevel: 9, palette: true })
    .toBuffer();

  mkdirSync(DIR, { recursive: true });
  writeFileSync(resolve(DIR, `${id}_face.png`), out);
  made++;
}
console.log(`얼굴 아이콘 ${made}종 → public/assets/characters/<id>_face.png (${SIZE}×${SIZE})`);
