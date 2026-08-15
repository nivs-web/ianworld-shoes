/**
 * 앱 아이콘 굽기 — `public/icons/` 3종.
 *
 * ## 왜 스크립트로 만드나
 *
 * manifest 와 index.html 은 `/icons/icon-192.png` 를 가리키고 있었는데 **그 폴더가
 * 아예 없었다.** 아이콘이 하나도 없으면 크롬은 설치 배너를 띄우지 않는다 —
 * `beforeinstallprompt` 가 영영 안 오니 스플래시의 '설치' 버튼도 항상 iOS 안내로
 * 빠진다. PWA 가 안 되던 진짜 이유가 이것이라, 손으로 그린 png 를 넣는 대신
 * 게임 에셋에서 매번 다시 구울 수 있게 스크립트로 만들었다.
 *
 * ## 배수만 쓴다
 *
 * 논리 아이콘은 **64×64** 다. 192 = 64×3, 512 = 64×8 — 둘 다 정수배라
 * nearest 확대로 픽셀이 하나도 안 뭉갠다. 64 가 아닌 크기(예: 180)를 넣으면
 * 도트가 밀리므로 새 크기가 필요하면 64 의 배수로 고른다.
 *
 * ## maskable 은 따로 그린다
 *
 * 안드로이드는 아이콘을 원·사각·물방울 등 제조사 모양으로 **잘라낸다**. 안전 영역은
 * 가운데 지름 80% 원(논리 좌표로 반지름 25.6)뿐이라, 네 귀퉁이까지 꽉 채운 그림을
 * 그대로 쓰면 테두리와 계단이 잘려 나간다. 그래서 maskable 은 테두리 없이
 * 신발만 작게 가운데 놓는다.
 */

import sharp from 'sharp';
import { readFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const P = (...p) => resolve(root, ...p);

const SHOES = JSON.parse(readFileSync(P('src/data/shoes.json'), 'utf8'));

/** 논리 아이콘 한 변 — 출력 크기는 전부 이 값의 정수배여야 한다 */
const N = 64;
/** 아이콘에 쓸 신발 번호. 0~4 가 MAXIMAL 등급이고 3번이 대비가 가장 세다 */
const SHOE = 3;

/** pixel-ui.css 의 색 토큰과 같은 값 — 아이콘만 따로 놀지 않게 */
const C = {
  bg: [13, 10, 8, 255], // --c-bg
  line: [107, 63, 29, 255], // --c-line
  cream: [245, 217, 160, 255], // --c-panel
  deep: [27, 20, 16, 255], // theme_color
};

/** 시트에서 신발 한 켤레를 오려 낸다 (셀마다 1px 여백이 있다) */
function shoeFrom(meta, index) {
  const cols = Math.floor(meta.w / meta.cellW);
  const col = index % cols;
  const row = Math.floor(index / cols);
  return sharp(P('public/assets/shoes', meta.file))
    .extract({ left: col * meta.cellW + 1, top: row * meta.cellH + 1, width: meta.shoeW, height: meta.shoeH })
    .png()
    .toBuffer();
}

/** 단색 캔버스 (RGBA 원시 버퍼) */
function canvas(w, h, rgba) {
  const buf = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) buf.set(rgba, i * 4);
  return sharp(buf, { raw: { width: w, height: h, channels: 4 } });
}

/** 사각형 하나짜리 합성 조각 */
const rect = (x, y, w, h, rgba) => ({
  input: { create: { width: w, height: h, channels: 4, background: { r: rgba[0], g: rgba[1], b: rgba[2], alpha: rgba[3] / 255 } } },
  left: x,
  top: y,
});

/** 테두리 — 그림 위에 덮어 그린다 */
function border(t, rgba) {
  return [
    rect(0, 0, N, t, rgba),
    rect(0, N - t, N, t, rgba),
    rect(0, 0, t, N, rgba),
    rect(N - t, 0, t, N, rgba),
  ];
}

/**
 * 일반 아이콘 — 계단 블록 위에 신발이 올라선 그림.
 * 게임 그대로의 돌계단(`ui/stair.png`, 32×13)을 두 장 이어 붙여 바닥을 만든다.
 */
async function iconAny() {
  const shoe = await shoeFrom(SHOES.master, SHOE); // 50×30
  const stair = await sharp(P('public/assets/ui/stair.png')).png().toBuffer(); // 32×13
  const floorY = N - 13; // 51 — 계단이 아래 변에 딱 맞는다

  return canvas(N, N, C.bg)
    .composite([
      // 별 몇 개. 배경이 완전히 비면 아이콘이 아니라 실수처럼 보인다
      rect(9, 9, 2, 2, C.cream),
      rect(52, 14, 2, 2, C.cream),
      rect(44, 6, 1, 1, C.cream),
      rect(16, 17, 1, 1, C.cream),
      { input: stair, left: 0, top: floorY },
      { input: stair, left: 32, top: floorY },
      // (64-50)/2 = 7 — 가운데. 밑창이 계단 윗면에 정확히 닿는다
      { input: shoe, left: 7, top: floorY - SHOES.master.shoeH },
      ...border(2, C.line),
    ])
    .png()
    .toBuffer();
}

/** maskable — 잘려 나가도 살아남게 신발만 가운데. 안전 반지름 25.6 안에 든다 */
async function iconMaskable() {
  const m = SHOES.game; // 40×24 — 반대각선 √(20²+12²)=23.3 < 25.6
  const shoe = await shoeFrom(m, SHOE);
  return canvas(N, N, C.deep)
    .composite([{ input: shoe, left: (N - m.shoeW) >> 1, top: (N - m.shoeH) >> 1 }])
    .png()
    .toBuffer();
}

/** 정수배 nearest 확대 — 여기서 배수가 아니면 도트가 밀린다 */
async function emit(buf, size, name) {
  if (size % N) throw new Error(`${size}는 ${N}의 배수가 아니다 — 도트가 뭉개진다`);
  await sharp(buf)
    .resize(size, size, { kernel: 'nearest' })
    .png({ compressionLevel: 9, palette: true })
    .toFile(P('public/icons', name));
  console.log(`  ${name}  ${size}×${size}  (×${size / N})`);
}

mkdirSync(P('public/icons'), { recursive: true });

const any = await iconAny();
const mask = await iconMaskable();

console.log('아이콘을 굽는다 (논리 64×64):');
await emit(any, 192, 'icon-192.png');
await emit(any, 512, 'icon-512.png');
await emit(mask, 512, 'icon-maskable-512.png');
console.log('완료 — public/icons/');
