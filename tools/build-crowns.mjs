/**
 * 왕관 3종 — 금·은·동. (2026-08-19 23차, 사용자 지정)
 *
 * *"1위,2위,3위 3개의 경우 왼쪽에 왕관 마크가 있었으면 좋겠어, 왕관은 금색 은색 동색으로
 *   해주고, 약간 1도트로 그림자효과를 넣어 왕관을 멋있게 (…) 그래야 1위 하고 싶어서
 *   서로 경쟁하지"*
 *
 * ## 손으로 그리지 않고 코드로 굽는 이유
 *
 * 세 벌이 **완전히 같은 모양이고 색만 달라야** 한다. 손으로 그리면 셋의 도트가 미묘하게
 * 어긋나고, 한 벌을 고치면 나머지 둘을 잊는다. 여기서는 도면 한 장(`SHAPE`)에 팔레트
 * 셋을 곱한다 — 모양을 고치면 세 벌이 같이 바뀐다.
 *
 * ## 그림자는 '1도트 아래오른쪽'이다
 *
 * 흐린 그림자(blur)는 도트 화면에서 지저분해진다(§3-1). 실루엣을 그대로 한 칸
 * 아래·오른쪽으로 옮겨 어두운 색으로 먼저 깔고 그 위에 왕관을 얹는다 — 도트 게임에서
 * 입체감을 내는 정석이고, 배경이 밝든 어둡든 왕관이 떠 보인다.
 *
 * ## 크기
 *
 * 논리 11×9 → **×2 = 22×18** 로 굽는다. 명예의 전당 줄 높이(약 44px)에 맞고,
 * 정수배라 nearest 확대에서 도트가 안 뭉갠다. DOM 에서는 이 크기 그대로 놓는다.
 */

import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(root, 'public/assets/ui');

const W = 11;
const H = 9;
const SCALE = 2;

/**
 * 실루엣만 도면으로 둔다 (`X` = 있음, `.` = 없음). **색은 코드가 규칙으로 칠한다** —
 * 손으로 도트마다 색을 적어 두면 모양을 조금만 고쳐도 명암이 어긋난다.
 *
 * 세 뿔 + 아래 띠. 뿔 끝에는 보석알이 박히고, 띠 가운데에도 한 알.
 */
const SHAPE = [
  'X....X....X',
  'X....X....X',
  'XX..XXX..XX',
  'XXX.XXX.XXX',
  'XXXXXXXXXXX',
  'XXXXXXXXXXX',
  'XXXXXXXXXXX',
  'XXXXXXXXXXX',
  'XXXXXXXXXXX',
];

/** 띠(아래 두 줄)의 경계 — 여기부터는 왕관 몸통이 아니라 머리에 닿는 테다 */
const BAND_Y = 7;

/**
 * 도트 하나의 역할을 규칙으로 정한다.
 *   · 뿔 끝 두 줄의 꼭대기      → 보석알(J)
 *   · 띠 가운데                 → 보석알(J)
 *   · 그 줄에서 제일 왼쪽       → 빛(H)     ← 빛은 왼쪽 위에서 온다
 *   · 그 줄에서 제일 오른쪽·맨 아래 줄·띠 경계선 → 그늘(S)
 *   · 나머지                    → 바탕(B)
 */
function roleAt(x, y, row) {
  if (SHAPE[y][x] !== 'X') return null;
  const first = row.indexOf('X');
  const last = row.lastIndexOf('X');
  if (y === 0) return 'J';                       // 뿔 끝 보석
  if (y === BAND_Y && x === 5) return 'J';       // 띠 가운데 보석
  if (y === H - 1 || y === BAND_Y - 1) return 'S';
  if (x === first) return 'H';
  if (x === last) return 'S';
  // 골짜기(뿔 사이)의 안쪽 모서리도 깎아 준다 — 평평한 덩어리로 안 보이게
  if (SHAPE[y][x - 1] === '.') return 'H';
  if (SHAPE[y][x + 1] === '.') return 'S';
  return 'B';
}

/** 팔레트 — [빛, 바탕, 그늘, 보석] */
const PALETTES = {
  1: { H: [255, 240, 170], B: [242, 178, 51], S: [166, 106, 18], J: [255, 255, 235] },   // 금
  2: { H: [255, 255, 255], B: [201, 210, 220], S: [124, 135, 148], J: [245, 250, 255] }, // 은
  3: { H: [242, 199, 154], B: [201, 123, 60], S: [126, 68, 24], J: [255, 235, 210] },    // 동
};

/** 그림자 — 배경(#0d0a08)보다 진하지 않으면 어두운 화면에서 안 보인다 */
const SHADOW = [10, 6, 4, 210];

function bake(rank) {
  const pal = PALETTES[rank];
  const w = (W + 1) * SCALE;      // 그림자가 오른쪽으로 1도트 삐져나온다
  const h = (H + 1) * SCALE;
  const buf = Buffer.alloc(w * h * 4, 0);

  const put = (x, y, [r, g, b, a]) => {
    for (let dy = 0; dy < SCALE; dy++) {
      for (let dx = 0; dx < SCALE; dx++) {
        const i = ((y * SCALE + dy) * w + (x * SCALE + dx)) * 4;
        buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = a;
      }
    }
  };

  // ① 그림자 먼저 (실루엣을 한 도트 아래·오른쪽으로)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (SHAPE[y][x] !== '.') put(x + 1, y + 1, SHADOW);
    }
  }
  // ② 그 위에 왕관
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const role = roleAt(x, y, SHAPE[y]);
      if (!role) continue;
      put(x, y, [...(pal[role] ?? pal.B), 255]);
    }
  }
  return { buf, w, h };
}

mkdirSync(OUT, { recursive: true });
for (const rank of [1, 2, 3]) {
  const { buf, w, h } = bake(rank);
  await sharp(buf, { raw: { width: w, height: h, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toFile(resolve(OUT, `crown_${rank}.png`));
}
console.log(`왕관 3종 → ${(W + 1) * SCALE}×${(H + 1) * SCALE} (금·은·동, 1도트 그림자)`);
