/**
 * 아이템 도트 51장 — 악세사리 7 · 날개 7 · 반려견 7, 각각 정면/옆(+날개는 상승 컷). (29차)
 *
 * *"그림은 너가 도트로 그려 (…) 너가 일단 도트로 그려두면, 추후에 내가 img 만들어서
 *   매칭 요청할게, 가급적 천천히 예쁘게 그려"*
 *
 * ## 손으로 png 를 그리지 않고 코드로 굽는 이유
 *
 * 왕관 세 벌을 코드로 구운 것과 같다(§9-0-52) — **크기와 자리가 표(`src/data/items.js`)와
 * 어긋나면 안 되기** 때문이다. 여기서 굽는 그림의 크기는 그 표의 `w`·`h` 와 한 도트라도
 * 다르면 **빌드가 그 자리에서 멈춘다.** 나중에 사용자가 직접 그린 png 로 갈아 끼울 때도
 * 그 표만 맞추면 자리가 저절로 맞는다.
 *
 * ## 그리는 방식이 둘이다
 *
 *   · 모자·반려견 — **도면 문자열**. 작고 모양이 분명해서 한 도트씩 적는 쪽이 정확하다.
 *   · 날개        — **곡선 표 + 깃털 규칙**. 좌우가 완벽히 대칭이어야 하는데 손으로
 *                    적으면 반드시 어긋나고, 한쪽을 고치면 반대쪽을 잊는다.
 *
 * 색은 도면에 안 적는다. 글자는 **역할**(`K` 외곽선 · `B` 바탕 · `H` 빛 · `S` 그늘 ·
 * `A` 강조 · `J` 보석)이고 팔레트가 그 역할에 색을 준다 — 모양을 고쳐도 명암이 안 어긋난다.
 */

import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ITEMS, itemById } from '../src/data/items.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(root, 'public/assets/items');

// ─────────────────────────────────────────────
// 모자 — 도면 문자열 (22 또는 24 폭)
// ─────────────────────────────────────────────

const HAT = {
  hat_fedora: {
    pal: { K: [42, 26, 16], B: [107, 74, 42], H: [138, 98, 56], S: [74, 50, 32], A: [59, 42, 24] },
    front: [
      '.......KKKKKKKK.......',
      '......KHHBBBBBHK......',
      '......KHBBBBBBBK......',
      '......KHBBBBBBBK......',
      '......KAAAAAAAAK......',
      '......KAAAAAAAAK......',
      '..KKKKKBBBBBBBBKKKKK..',
      '.KHHHHHHHHHHHHHHHHHHK.',
      '.KSSSSSSSSSSSSSSSSSSK.',
      '..KKKKKKKKKKKKKKKKKK..',
    ],
    // 옆모습은 챙이 **앞쪽(오른쪽)으로 더 나온다** — 그게 중절모의 옆얼굴이다
    side: [
      '.......KKKKKKKK.......',
      '......KHHBBBBBHK......',
      '......KHBBBBBBBK......',
      '......KHBBBBBBBK......',
      '......KAAAAAAAAK......',
      '......KAAAAAAAAK......',
      '...KKKKBBBBBBBBKKKKKK.',
      '..KHHHHHHHHHHHHHHHHHHK',
      '..KSSSSSSSSSSSSSSSSSSK',
      '...KKKKKKKKKKKKKKKKKKK',
    ],
  },

  hat_cap: {
    pal: { K: [22, 32, 46], B: [47, 95, 168], H: [74, 134, 216], S: [26, 50, 82], A: [34, 64, 110] },
    front: [
      '.......KKKKKKKK.......',
      '......KHHBBBBBBK......',
      '.....KHBBBBBBBBBK.....',
      '.....KHBBBBBBBBBK.....',
      '.....KBBBBBBBBBBK.....',
      '..KKKKKKKKKKKKKKKKKK..',
      '..KAAAAAAAAAAAAAAAAK..',
      '..KSSSSSSSSSSSSSSSSK..',
      '...KKKKKKKKKKKKKKKK...',
    ],
    // 챙은 **보는 방향(오른쪽)으로만** 나온다
    side: [
      '.....KKKKKKKK.........',
      '....KHHBBBBBBK........',
      '...KHBBBBBBBBBK.......',
      '...KHBBBBBBBBBK.......',
      '...KBBBBBBBBBBK.......',
      '...KKKKKKKKKKKKKKKKKK.',
      '...KAAAAAAAAAAAAAAAAK.',
      '...KSSSSSSSSSSSSSSSSK.',
      '....KKKKKKKKKKKKKKKK..',
    ],
  },

  hat_beret: {
    pal: { K: [27, 18, 32], B: [123, 47, 78], H: [168, 70, 108], S: [84, 32, 58], A: [84, 32, 58] },
    front: [
      '............KK........',
      '...........KAAK.......',
      '.....KKKKKKKAAKKK.....',
      '...KKHHHBBBBBBBBBKK...',
      '..KHHHBBBBBBBBBBBBBK..',
      '..KHBBBBBBBBBBBBBBSK..',
      '..KBBBBBBBBBBBBBBSSK..',
      '...KKSSSSSSSSSSSSKK...',
      '.....KKKKKKKKKKKK.....',
    ],
    // 옆에서 보면 **뒤로 흘러내린다** — 베레모의 성격이 그 기울기에 있다
    side: [
      '..........KK..........',
      '.........KAAK.........',
      '....KKKKKKAAKKKK......',
      '..KKHHHBBBBBBBBKK.....',
      '.KHHHBBBBBBBBBBBK.....',
      '.KHBBBBBBBBBBBBSK.....',
      '.KBBBBBBBBBBBBBSSK....',
      '..KKSSSSSSSSSSSKK.....',
      '....KKKKKKKKKKK.......',
    ],
  },

  hat_dread: {
    pal: { K: [22, 13, 7], B: [74, 47, 28], H: [110, 74, 44], S: [43, 26, 16], A: [74, 47, 28] },
    /**
     * ★ 도면을 안 쓰고 **가닥을 코드로 내린다.** (다시 그림)
     *
     * 처음에는 도면으로 짧게 그렸더니 화면에서 그냥 **갈색 단발머리**로 보였다 —
     * 레게머리를 레게머리로 읽히게 하는 것은 길이가 아니라 **가닥의 분리와 매듭**이다.
     * 그래서 ① 가닥마다 사이를 비우고 ② 네 줄마다 어두운 매듭을 넣고 ③ 어깨 아래까지
     * 내린다. 셋 중 하나만 빠져도 다시 단발머리가 된다.
     */
    make: (w, h, pal, side) => dreads(w, h, pal, side),
  },

  hat_crown: {
    // 명예의 전당 왕관(`build-crowns.mjs`)과 **같은 금색**이라 한 세계로 읽힌다
    pal: { K: [90, 58, 8], B: [242, 178, 51], H: [255, 239, 170], S: [166, 106, 18], A: [138, 90, 16], J: [255, 255, 255] },
    front: [
      '...KJK.....KJK....KJK.',
      '...KJK.....KJK....KJK.',
      '..KHJJK...KHJJK..KHJJK',
      '..KHBBBKKKHBBBKKKHBBBK',
      '..KHBBBBBBBBBBBBBBBBK.',
      '..KHBBBBBJJBBBBBBBBSK.',
      '..KHBBBBBJJBBBBBBBBSK.',
      '..KAAAAAAAAAAAAAAAASK.',
      '..KSSSSSSSSSSSSSSSSSK.',
      '..KKKKKKKKKKKKKKKKKKK.',
    ],
    side: null,   // 왕관은 어느 쪽에서 봐도 같다 — 정면을 그대로 쓴다
  },
};

// ─────────────────────────────────────────────
// 반려견 — 도면 문자열 (14 폭)
// ─────────────────────────────────────────────

const PET = {
  /**
   * ★ **다람쥐** (2026-08-21 29차, 사용자 지정 — *"최대한 귀엽게"*).
   *
   * 강아지·고양이와 **같은 14×13 뼈대**를 쓰되 두 가지가 다르다:
   *   · 귀가 **동그랗고 작다** — 강아지의 뾰족귀를 그대로 두면 여우가 된다
   *   · 등 뒤로 **큰 꼬리**가 말려 올라간다 — 14도트 안에서 다람쥐를 다람쥐로
   *     읽히게 하는 것은 얼굴이 아니라 이 실루엣이다
   *
   * 그래서 몸을 오른쪽으로 한 칸 몰고 왼쪽 세 칸을 꼬리에 내줬다. 볼에 도토리색
   * 홍조(`A`)를 찍은 것도 "귀엽게"를 위한 것이다 — 눈만으로는 표정이 안 산다.
   */
  pet_squirrel: {
    pal: {
      K: [62, 36, 18], B: [214, 138, 66], H: [246, 190, 128], S: [166, 98, 40],
      T: [238, 176, 108], W: [255, 248, 236], E: [40, 24, 12], A: [226, 132, 118],
    },
    front: [
      '.KK..KK.......',
      'KBAKKABK......',
      'KBBBBBBBK.....',
      'KBEBBBBEBK.KKK',
      'KBBWEEWBBKKTTK',
      'KABWWWWBAKSTTK',
      '.KBBBBBBK.STTK',
      '..KBBWWBKKSTTK',
      '..KBBWWWBKSTTK',
      '...KBWWWBKSTK.',
      '...KBWWBBKKK..',
      '...KBBBBBK....',
      '...KBK.KBK....',
    ],
    side: null,
  },
  pet_dog: {
    pal: { K: [58, 36, 20], B: [201, 138, 74], H: [230, 178, 118], S: [140, 92, 46], W: [26, 15, 8] },
    front: [
      '.KK.......KK..',
      '.KBK.....KBK..',
      '.KBBKKKKKBBK..',
      '.KBHBBBBBBBBK.',
      '.KBBWBBBBWBBK.',
      '.KBBBBWWBBBBK.',
      '..KBBBBBBBBK..',
      '..KKBBBBBBKK..',
      '...KBBBBBBK...',
      '...KBHBBBBK...',
      '...KBBBBBBK...',
      '..KBK....KBK..',
      '..KKK....KKK..',
    ],
    side: null,
  },
  pet_cat: {
    pal: { K: [36, 26, 46], B: [138, 143, 158], H: [186, 190, 202], S: [90, 95, 110], W: [245, 245, 245] },
    front: [
      '.KK.......KK..',
      '.KBK.....KBK..',
      '.KBBKKKKKBBK..',
      '.KBHBBBBBBBBK.',
      '.KBWBBSSBBWBK.',
      '.KBBBBSSBBBBK.',
      '..KBSBBBBSBK..',
      '..KKBBBBBBKK..',
      '...KBSBBSBK...',
      '...KBBBBBBK...',
      '...KBSBBSBK...',
      '..KBK....KBK..',
      '..KKK....KKK..',
    ],
    side: null,
  },
  /**
   * ★ 귀여운사자 — 강아지·고양이와 **같은 뼈대(14×13)** 에 갈기만 두른다.
   * *"강아지랑 고양이처럼 작은 사이즈로 그려"* (2026-08-21 사용자 지정)
   *
   * 14도트 안에서 사자를 사자로 읽히게 하는 것은 **얼굴을 감싼 한 겹의 테두리**다.
   * 갈기를 두껍게 두르면 얼굴이 남지 않아 그냥 동그란 덩어리가 된다.
   */
  pet_lion: {
    pal: {
      K: [58, 32, 10], B: [252, 224, 158], H: [255, 244, 200], S: [212, 172, 90],
      M: [186, 96, 22], W: [255, 250, 234], E: [40, 24, 10],
    },
    front: [
      '.KK.......KK..',
      '.KBK.....KBK..',
      '.KMMKKKKKMMK..',
      '.KMBBBBBBBMK..',
      '.KMBEBBBEBMK..',
      '.KMBBWWWBBMK..',
      '.KMMBBBBBMMK..',
      '..KMMMMMMMK...',
      '...KBBBBBBK...',
      '...KBHBBBBK...',
      '...KBBBBBBK...',
      '..KBK....KBK..',
      '..KKK....KKK..',
    ],
    side: null,
  },
  /**
   * ★ 귀여운호랑이 — 같은 뼈대에 **줄무늬**. 줄은 좌우 대칭으로만 넣는다.
   * 한쪽에만 넣으면 14도트에서는 무늬가 아니라 얼룩으로 보인다.
   */
  pet_tiger: {
    pal: {
      K: [58, 30, 10], B: [246, 166, 62], H: [255, 208, 130], S: [198, 118, 34],
      D: [40, 24, 12], W: [252, 246, 236], E: [30, 18, 8], N: [148, 60, 52],
    },
    front: [
      '.KK.......KK..',
      '.KBK.....KBK..',
      '.KBDKKKKKDBK..',
      '.KDBBBDBBBDBK.',
      '.KBBEBBBEBBBK.',
      '.KDBBWNNWBBDK.',
      '..KBBWWWWBBK..',
      '..KKBBBBBBKK..',
      '...KDBBBBDK...',
      '...KBBHBBBK...',
      '...KDBBBBDK...',
      '..KBK....KBK..',
      '..KKK....KKK..',
    ],
    side: null,
  },
  pet_star: {
    pal: { K: [168, 114, 10], B: [255, 224, 102], H: [255, 250, 214], S: [214, 160, 30], W: [255, 255, 255] },
    front: [
      '......KK......',
      '.....KHHK.....',
      '.....KHHK.....',
      '....KHBBBK....',
      '..KKHBBBBBKK..',
      '.KHBBBBBBBBSK.',
      '..KBBBBBBBSK..',
      '....KBBBBSK...',
      '...KBBKKBBK...',
      '...KBK..KSK...',
      '...KK....KK...',
    ],
    side: null,
  },
};

// ─────────────────────────────────────────────
// 가면 — **머리 실루엣**을 그대로 덮는다 (2026-08-21 사용자 지정)
// ─────────────────────────────────────────────

/**
 * ★ 가면은 모자와 달리 **얼굴이 한 도트도 새면 안 된다.** 그래서 도면을 손으로 적지 않고
 * **캐릭터 스프라이트에서 실측한 머리 실루엣**을 채운다 — 손으로 적으면 어느 줄 하나가
 * 반드시 한 도트 좁아지고, 거기서 살색이 비친다.
 *
 * 값은 `public/assets/characters/ian_{front,side}.png` 의 불투명 범위를 재서 옮긴 것이고,
 * **원점은 스프라이트 x=5** 다(표의 `dx: 17` = 캐릭터 왼쪽 12 + 5). 캐릭터 아트를 다시
 * 구우면 이 표도 같이 재야 한다.
 */
const HEAD_F = [
  [7, 16], [5, 18], [4, 19], [3, 20], [2, 21], [1, 22], [1, 22], [0, 23],
  [0, 23], [0, 23], [0, 23], [0, 23], [0, 23], [1, 22], [1, 22], [1, 22],
  [1, 22], [2, 21], [3, 20], [4, 19], [5, 18], [5, 18], [4, 19], [4, 19],
];
/** 옆모습 — **오른쪽이 얼굴 앞**이다 (캐릭터 옆컷이 오른쪽을 본다) */
const HEAD_S = [
  [9, 16], [6, 18], [4, 20], [3, 21], [2, 21], [1, 22], [1, 22], [1, 23],
  [0, 23], [0, 23], [0, 23], [0, 22], [0, 22], [0, 21], [1, 21], [1, 21],
  [2, 21], [2, 21], [4, 21], [6, 21], [6, 20], [5, 19], [4, 18], [3, 17],
];

/** 실루엣 바깥인가 — 테두리를 칠할 자리를 찾는 데 쓴다 */
const outside = (sil, x, y) => y < 0 || y >= sil.length || x < sil[y][0] || x > sil[y][1];
const rim = (sil, x, y) =>
  outside(sil, x - 1, y) || outside(sil, x + 1, y) || outside(sil, x, y - 1) || outside(sil, x, y + 1);

/**
 * 아이언맨 — 붉은 헬멧 + **가운데 금색 얼굴판** + 빛나는 눈.
 *
 * 눈은 캐릭터의 실제 눈 높이(원본 14~15행)에 맞춘다. 안 맞추면 헬멧이 아니라
 * 얼굴에 붙인 판때기로 보인다.
 */
function ironMask(w, h, pal, side) {
  const sil = side === 'side' ? HEAD_S : HEAD_F;
  const img = blank(w, h);
  const cx = side === 'side' ? 13.5 : 11.5;      // 옆모습은 얼굴이 오른쪽에 있다
  /** 금색 얼굴판의 반폭 — 위아래로 좁아진다(턱이 뾰족해 보여야 한다) */
  const panel = [-1, -1, 4, 4, 5, 6, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 6, 5, 4, 3, 2, 2];

  /** 금색 판인가 — 판 **둘레에 테두리**를 두르려면 이웃도 물어봐야 한다 */
  const gold = (x, y) =>
    !outside(sil, x, y) && panel[y] >= 0 && Math.abs(x - cx) <= panel[y];

  for (let y = 0; y < sil.length; y++) {
    const [L, R] = sil[y];
    for (let x = L; x <= R; x++) {
      let role;
      if (rim(sil, x, y)) role = 'K';
      else if (gold(x, y)) {
        /**
         * ★ 금색 판 **둘레에 어두운 선**을 두른다. 없으면 붉은 헬멧과 금색 얼굴이
         * 한 덩어리로 뭉개져서 "노란 달걀"로 보인다 — 실제로 첫 판이 그랬다.
         */
        const 경계 = !gold(x - 1, y) || !gold(x + 1, y) || !gold(x, y - 1) || !gold(x, y + 1);
        if (경계) role = 'D';
        else role = x < cx - panel[y] + 2 ? 'G' : (x > cx + panel[y] - 2 ? 'D' : 'A');
      } else {
        role = x <= L + 1 ? 'H' : (x >= R - 1 ? 'S' : 'B');
      }
      put(img, x, y, pal[role]);
    }
  }

  /**
   * 눈 — 캐릭터 눈(원본 14~15행)에 맞춘 발광 슬릿.
   * **바깥쪽이 한 도트 높다**(`tilt`) — 수평으로 두면 순한 얼굴이 된다.
   */
  const eyes = side === 'side' ? [[14, 20, 1]] : [[4, 9, -1], [14, 19, 1]];
  for (const [a, b, dir] of eyes) {
    for (let x = a; x <= b; x++) {
      // dir -1 = 바깥이 왼쪽, +1 = 바깥이 오른쪽
      const 바깥쪽 = dir < 0 ? x <= a + 2 : x >= b - 2;
      const t = 바깥쪽 ? -1 : 0;
      for (let y = 13; y <= 15; y++) {
        if (outside(sil, x, y + t)) continue;
        put(img, x, y + t, y === 13 ? pal.K : (y === 15 ? pal.E : pal.W));
      }
    }
  }

  /** 입 — 가로 통풍구. 세로 줄이 하나 걸러 들어가야 통풍구로 읽힌다 */
  const [ml, mr] = side === 'side' ? [12, 19] : [7, 16];
  for (let x = ml; x <= mr; x++) {
    if (!outside(sil, x, 18)) put(img, x, 18, pal.K);
    if (!outside(sil, x, 19)) put(img, x, 19, (x - ml) % 2 === 0 ? pal.K : pal.D);
    if (!outside(sil, x, 20)) put(img, x, 20, pal.K);
  }
  return img;
}

/**
 * 배트맨 — 어두운 카울 + **머리 위로 솟은 귀** + 흰 눈구멍, 입·턱은 드러난다.
 *
 * 카울이 원본 16행까지만 덮는 이유: 그 아래(코·입·턱)를 가리면 배트맨이 아니라
 * 복면강도가 된다. 대신 양옆 볼 조각을 두 줄 더 내려 얼굴선을 잡아 준다.
 */
function batMask(w, h, pal, side) {
  const sil = side === 'side' ? HEAD_S : HEAD_F;
  const img = blank(w, h);
  const EAR = 7;                       // 귀가 머리 위로 솟는 높이
  const COWL = 17;                     // 카울이 덮는 머리 줄 수 (원본 0~16행)

  /**
   * 귀 — **꼭짓점이 바깥쪽**인 삼각형이라 밖으로 눕는다. 좌우 대칭 삼각형으로 그리면
   * 배트맨이 아니라 도깨비 뿔이 된다(첫 판이 그랬다).
   * 옆모습은 한 짝만 보인다.
   */
  // 옆모습의 귀는 **뒤로 눕는다**(apex 가 왼쪽) — 앞으로 세우면 안테나로 보인다
  const ears = side === 'side' ? [[4, 14, -1]] : [[6, 11, -1], [12, 17, 1]];
  for (const [a, b, dir] of ears) {
    for (let y = 0; y < EAR; y++) {
      // 꼭짓점도 최소 두 도트 — 한 도트짜리 끝은 화면에서 안테나로 보인다
      const 폭 = Math.max(1, Math.round(((y + 1) / EAR) * (b - a)));
      const x0 = dir < 0 ? a : b - 폭;
      const x1 = dir < 0 ? a + 폭 : b;
      for (let x = x0; x <= x1; x++) {
        const 끝 = x === x0 || x === x1 || y === 0;
        put(img, x, y, 끝 ? pal.K : (x <= x0 + 1 ? pal.H : pal.B));
      }
    }
  }

  for (let y = 0; y < COWL; y++) {
    const [L, R] = sil[y];
    for (let x = L; x <= R; x++) {
      // 카울 아랫변은 테두리로 닫는다 — 안 닫으면 얼굴과 경계가 없어 흐물거린다
      const 아래끝 = y === COWL - 1;
      const role = rim(sil, x, y) || 아래끝 ? 'K' : (x <= L + 1 ? 'H' : (x >= R - 1 ? 'S' : 'B'));
      put(img, x, y + EAR, pal[role]);
    }
  }

  /** 볼 조각 — 카울 아래로 두 줄, 양옆만 */
  for (let y = COWL; y < COWL + 2; y++) {
    const [L, R] = sil[y];
    for (let x = L; x <= R; x++) {
      const 옆 = x <= L + 3 || x >= R - 3;
      if (!옆) continue;
      const 끝 = x === L || x === R || y === COWL + 1;
      put(img, x, y + EAR, 끝 ? pal.K : (x <= L + 1 ? pal.H : pal.S));
    }
  }

  /** 눈구멍 — 캐릭터 눈(원본 14~15행)에 정확히 얹는다 */
  const eyes = side === 'side' ? [[13, 19]] : [[5, 9], [14, 18]];
  for (const [a, b] of eyes) {
    for (let x = a; x <= b; x++) {
      for (let y = 14; y <= 15; y++) {
        if (outside(sil, x, y)) continue;
        put(img, x, y + EAR, pal.W);
      }
      if (!outside(sil, x, 13)) put(img, x, 13 + EAR, pal.K);
      if (!outside(sil, x, 16)) put(img, x, 16 + EAR, pal.K);
    }
  }
  return img;
}

const MASK = {
  hat_ironman: {
    make: ironMask,
    pal: {
      K: [40, 8, 10], B: [176, 34, 34], H: [214, 66, 58], S: [116, 18, 22],
      A: [240, 176, 44], G: [255, 214, 108], D: [176, 116, 18],
      W: [223, 247, 255], E: [122, 206, 240],
    },
  },
  hat_batman: {
    make: batMask,
    pal: {
      K: [10, 12, 20], B: [52, 58, 76], H: [78, 86, 108], S: [28, 32, 46],
      A: [52, 58, 76], G: [78, 86, 108], D: [28, 32, 46],
      W: [236, 246, 255], E: [180, 196, 220],
    },
  },
};

// ─────────────────────────────────────────────
// 날개 — 곡선 표 + 깃털 규칙 (좌우 대칭을 코드가 보장한다)
// ─────────────────────────────────────────────

/**
 * ★ **날개는 부채꼴로 편다.** (다시 그림)
 *
 * 처음에는 실루엣 표를 그려 채웠더니 화면에서 **쿠션**으로 보였다. 날개를 날개로
 * 읽히게 하는 것은 전체 윤곽이 아니라 **깃털이 갈라진 바깥 가장자리**다. 그래서
 * 어깨 한 점에서 부챗살처럼 뻗는 구간을 나누고, 구간마다 길이를 달리해서
 * **계단처럼 층진 가장자리**를 만든다 — 그게 깃털 층이다.
 *
 * 좌우는 코드가 뒤집는다. 손으로 양쪽을 적으면 반드시 한 도트 어긋나고, 한쪽을
 * 고칠 때 반대쪽을 잊는다(왕관 세 벌을 도면 한 장으로 구운 것과 같은 이유, §9-0-52).
 *
 * θ 는 **어깨에서 바깥쪽(수평)** 을 0 으로 잰다. 음수가 위, 양수가 아래다.
 */
const WING_A0 = -1.02;
const WING_A1 = 1.16;
/** 구간 경계마다의 길이 — 가운데가 제일 길다(주 깃털), 위아래로 짧아진다 */
const WING_LEN = [10, 17, 22, 25, 26, 24, 21, 17];
/**
 * ★ 박쥐 날개는 **살이 적고 막이 크다.** 깃털 날개와 같은 일곱 구간으로 파면 가장자리가
 * 누더기가 되어 "붉은 낙서"로 보인다(실제로 한 번 그렇게 나왔다). 구간을 넷으로 줄이고
 * 대신 깊게 파야 박쥐의 부채꼴이 된다.
 */
const BAT_LEN = [11, 24, 26, 24, 18];

/**
 * @param {object} spec 팔레트와 성격(깃털 간격·박쥐 여부)
 * @param {'left'|'right'|null} only 옆모습은 몸에 가려 **한 장만** 보인다
 * @param {boolean} fold 계단 사이 상승 컷 — **접은 날개 + 번개** (2026-08-21 사용자 지정)
 */
function makeWing(spec, w, h, only = null, fold = false) {
  const img = blank(w, h);
  const { pal } = spec;
  const half = w >> 1;                 // 26
  const px = half - 1;                 // 어깨 — 반쪽의 몸통 쪽 끝
  const py = 3;
  const LEN = spec.bat ? BAT_LEN : WING_LEN;
  const segs = LEN.length - 1;

  /** θ 에서의 바깥 반지름. 구간 안에서는 **거의 평평**해서 층이 눈에 보인다 */
  const radiusAt = (t) => {
    const u = ((t - WING_A0) / (WING_A1 - WING_A0)) * segs;
    const j = Math.max(0, Math.min(segs - 1, Math.floor(u)));
    const f = u - j;
    // 구간 안 기울기를 0.35 로 눌러 두면 경계에서 **턱**이 생긴다 = 깃털 끝
    let base = LEN[j] + (LEN[j + 1] - LEN[j]) * (f * 0.15);
    /**
     * ★ **상승 컷은 날개를 접는다.** 계단 사이를 튀어 오르는 3프레임인데 날개가
     * 활짝 펴져 있으면 "떠 있다"로 읽혀서 오히려 속도감이 죽는다. 62%로 줄이고
     * 위쪽(음수 θ)을 더 접어 뒤로 눕힌다 — 그래야 위로 쏘아 올라가는 모양이 된다.
     */
    if (fold) base *= t < 0 ? 0.52 : 0.68;
    if (!spec.bat) return base;
    /**
     * 박쥐는 살 사이가 **오목하게 파인다** — 그게 막(膜)의 성격이다.
     * 단 **맨 위 구간은 파지 않는다.** 어깨에 붙는 자리까지 파면 윗변이 톱니처럼
     * 흩어져서 날개가 아니라 붉은 낙서로 보인다(실제로 그렇게 나왔다).
     */
    if (j === 0) return base;
    return base - 8 * Math.sin(Math.PI * f);
  };

  const drawHalf = (mirror) => {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < half; x++) {
        const dx = px - x;            // 바깥쪽이 양수
        const dy = y - py;
        if (dx < 0) continue;
        const d = Math.hypot(dx, dy);
        if (d < 1) continue;
        const t = Math.atan2(dy, dx);
        if (t < WING_A0 || t > WING_A1) continue;
        const R = radiusAt(t);
        if (d > R) continue;

        // 구간 경계까지의 거리 — 여기가 깃털이 갈라지는 자리다
        const u = ((t - WING_A0) / (WING_A1 - WING_A0)) * segs;
        const edge = Math.min(u - Math.floor(u), Math.ceil(u) - u);

        let role = 'B';
        if (d > R - 1.2) role = 'K';                       // 바깥 테두리
        else if (edge < (spec.bat ? 0.05 : 0.09) && d > 4) role = 'K';   // 깃털이 갈라지는 자리 / 박쥐의 살
        else if (d > R - 3.5) role = 'S';                  // 끝쪽 그늘
        else if (dy < 0 && d < R * 0.55) role = 'H';       // 어깨 위쪽 빛
        else if (!spec.bat && edge > 0.34 && d < R - 5) role = spec.glow ? 'H' : 'B';  // 깃털 한가운데
        const sx = mirror ? half + (half - 1 - x) : x;
        put(img, sx, y, pal[role]);
      }
    }
    // 어깨 이음매 — 없으면 날개가 몸에서 떠 보인다
    for (let k = 0; k < 5; k++) {
      const sx = mirror ? half + (half - 1 - (px - k)) : px - k;
      put(img, sx, py, pal.K);
      put(img, sx, py + 1, pal.B);
    }
  };

  if (only !== 'right') drawHalf(false);
  if (only !== 'left') drawHalf(true);

  /**
   * ★ **번개는 접힌 날개에만.** 상승 컷은 3프레임이라 크게 그리면 깜빡임으로 보인다 —
   * 날개 끝을 따라 **파란 점 몇 개**만 얹는다. 자리를 난수로 뿌리지 않고 각도로 정해서
   * 날개 모양이 바뀌어도 끝을 따라가게 했다(난수면 다시 구울 때마다 그림이 달라진다).
   */
  if (fold) {
    const half = w >> 1;
    const px = half - 1;
    const py = 3;
    for (const t of [-0.72, -0.28, 0.18, 0.62]) {
      const R = 9 + Math.round(6 * Math.cos(t));
      for (let k = 0; k < 3; k++) {
        const r = R + k * 2;
        const x = px - Math.round(r * Math.cos(t));
        const y = py + Math.round(r * Math.sin(t)) + (k % 2 ? 1 : 0);
        const c = k === 0 ? SPARK.hot : (k === 1 ? SPARK.mid : SPARK.cold);
        if (only !== 'right') put(img, x, y, c);
        if (only !== 'left') put(img, half + (half - 1 - x), y, c);
      }
    }
  }
  return img;
}

/** 상승 번개 색 — 인게임 캔버스(`palette.SPARK`)와 **같은 값**이어야 한 덩어리로 보인다 */
const SPARK = { hot: [223, 247, 255], mid: [63, 169, 245], cold: [27, 79, 160] };

/**
 * 레게머리 — 돔 위에 **가닥을 내린다.**
 * @param {'front'|'side'} side 옆모습은 뒤통수(왼쪽)로만 늘어진다
 */
function dreads(w, h, pal, side) {
  const img = blank(w, h);
  /**
   * 돔은 **도면**이다 — 머리 위 곡선은 계산보다 손으로 적는 쪽이 정확하다.
   * 가닥만 코드로 내린다(길이·매듭을 규칙으로 두면 여섯 가닥이 저절로 어울린다).
   */
  const CAP = [
    '.......KKKKKKKKKK.......',
    '.....KKBBBBBBBBBBKK.....',
    '....KBHHBBBBBBBBBBBK....',
    '...KBHHBBBBBBBBBBBBBK...',
    '..KBHBBBBBBBBBBBBBBBBK..',
    '..KBBBBBBBBBBBBBBBBBBK..',
    '.KBBBBBBBBBBBBBBBBBBBBK.',
  ];
  for (let y = 0; y < CAP.length; y++) {
    for (let x = 0; x < w; x++) {
      const c = CAP[y][x];
      if (c !== '.') put(img, x, y, pal[c]);
    }
  }

  /**
   * ★ 가닥은 **얼굴을 비켜 바깥에만** 내린다. 가운데로 내리면 캐릭터 표정이 통째로
   * 가려져서, 아이템을 샀는데 내 얼굴이 안 보이는 상태가 된다.
   * 길이를 조금씩 달리하는 게 중요하다 — 가지런하면 가발이 아니라 커튼으로 보인다.
   */
  const 왼쪽 = [[0, h - 1], [4, h - 5]];
  const 오른쪽 = [[17, h - 4], [21, h - 8]];
  // 옆모습은 뒤통수(왼쪽)로만 늘어진다
  const 가닥 = side === 'side' ? [...왼쪽, [8, h - 3]] : [...왼쪽, ...오른쪽];

  for (const [x0, 끝] of 가닥) {
    for (let y = CAP.length - 2; y <= 끝; y++) {
      const 매듭 = (y - CAP.length) % 4 === 0;
      const 좁힘 = y >= 끝 - 1 ? 1 : 0;
      for (let x = x0 + 좁힘; x <= x0 + 2 - 좁힘; x++) {
        if (매듭) { put(img, x, y, pal.K); continue; }
        // 왼쪽 한 줄은 빛, 오른쪽 한 줄은 그늘 — 납작한 막대가 아니라 둥근 가닥이 된다
        put(img, x, y, x === x0 ? pal.H : (x === x0 + 2 ? pal.S : pal.B));
      }
    }
  }
  return img;
}

/**
 * ★ **무서운호랑이 — 캐릭터와 같은 35×50 도면.** (2026-08-21 28차, 사용자 지정)
 *
 * *"무서운호랑이, 이건 신발 10,000개, 호랑이 인데 반려견 사이즈를 캐릭터 크기와
 *   동일한 크기로 그려, 정성껏 그려줘"*
 *
 * ## 타원 생성기를 버리고 도면으로 돌아왔다
 *
 * 처음엔 다른 큰 그림처럼 타원·삼각형을 숫자로 두고 굽게 짰다. 결과는 **"뚱뚱한 주황
 * 고양이"** 였다 — 네 발 짐승은 실루엣이 곧 종(種)인데, 타원 몇 개를 겹치면 어느
 * 각도에서도 덩어리가 되고 줄무늬를 아무리 얹어도 호랑이가 되지 않는다.
 * 35×50 이면 도면으로 적을 수 있는 크기다. 적었다.
 *
 * ## 앉은 자세인 이유
 *
 * 네 발로 선 호랑이는 **가로로 길다** — 35폭 안에 넣으면 머리가 손톱만 해진다.
 * 앉으면 머리가 크고 몸이 아래로 넓어져 세로 상자에 꼭 맞고, 무엇보다 **얼굴이
 * 화면 위쪽**에 온다.
 *
 * ## 얼굴이 **오른쪽 위**에 몰려 있는 것이 이 도면의 핵심이다
 *
 * 정면 컷에서 이 호랑이는 캐릭터 뒤에 절반쯤 가린다(표의 `dx 24` 주석). 가려지는 것은
 * **왼쪽 절반**이므로, 얼굴을 그림 한가운데에 두면 코까지 잘려 주황색 덩어리만 남는다.
 * 머리 중심을 오른쪽(24열)으로 밀어 두면 어깨 너머로 **얼굴이 통째로** 보인다.
 *
 * 테두리(`K`)는 손으로 안 적었다 — 실루엣 가장자리를 한 번에 두른 결과를 그대로
 * 옮겼으므로, 모양을 고칠 때는 도면의 몸통만 고치고 가장자리는 다시 두르면 된다.
 */
const TIGER_BIG = {
  pal: {
    K: [40, 20, 8],       // 테두리
    B: [242, 152, 46],    // 본색
    H: [255, 200, 112],   // 빛
    S: [190, 104, 26],    // 그늘
    D: [32, 18, 10],      // 줄무늬
    W: [250, 244, 232],   // 가슴털 · 주둥이 · 송곳니
    Y: [255, 214, 76],    // 눈
    N: [148, 60, 52],     // 코
  },
  front: [
      '.................KK...........KK...',
      '................KBBK.........KBBK..',
      '................KSSK.........KSSK..',
      '...............KSSSSK.......KSSSSK.',
      '...............KSSSSK.......KSSSSK.',
      '...............KBSSSK..KKK..KSSSBK.',
      '...............KBBBBK.KBBBK.KBBBBK.',
      '................KBBBBKBBDDBKBBBBK..',
      '...............KBHHHDDBBDDBBDDBBBK.',
      '..............KBHHHBDDBBDDBBDDBBBBK',
      '..............KDDDBBDDBBDDBBDDBDDDK',
      '..............KHHDDDDDBBBBBBDDDDBBK',
      '..............KBBYKYBBBBBBBBBYKYBBK',
      '..............KDDYKYBBBBBBBBBYKYDDK',
      '..............KDDYKYBBBBBBBBBYKYDDK',
      '..............KBBBBBBBBBBBBBBBBBBBK',
      '..............KBBBBBBBBNNNBBBBBBBBK',
      '...............KDDBBWWWNNNWWWBBDDK.',
      '...............KDDBWWWWWNWWWWWBDDK.',
      '...............KBBWWWWWWWWWWWWWBBK.',
      '................KBWWWWKKKKKWWWWBK..',
      '................KDWWWWKKKKKWWWWDK..',
      '.................KDWWKWKKKWKWWDK...',
      '..................KBWWKKKKKWWBK....',
      '...................KBWWKKKWWBK.....',
      '....................KBWWWWWBK......',
      '.....................KBBBBBK.......',
      '................KKKKKBBBBBBBKKKKK..',
      '..............KKBBBBBBWWWWWWWBBBDKK',
      '............KKHHHBBBBWWWWWWWWWBBDDK',
      '...........KDDHHHBBBBWWWWWWWWWBBDDK',
      '..........KHDDHHBBBBBWWWWWWWWWBBDDK',
      '........KKBBDDBBBBBBBWWWWWWWWWBBDDK',
      '........KBBBDDBBBBBBBBWWWWWWWBBBDDK',
      '........KBBBDDBBBBBBBBBKKWWWBBBBDDK',
      '........KDBBDDBBBBBBBBK..KBBBBBBDDK',
      '........KDBBDDBBBBBBBBK..KBBBBBBBBK',
      '........KDBBDDBBBBBBBBK..KBBBBBBBBK',
      '........KDBBBBBBBBBBBBK..KBBBBBBBBK',
      '........KDBBBBBBBBDDDDK..KDDDDBBBBK',
      '......KKDDBBBBBBBBBBBBK..KBBBBBBBBK',
      '......KBDDBBBBBBBBBBBBK..KBBBBBBBBK',
      '......KBDDBBBBBBBBBBBBK..KBBBBBBBBK',
      '......KBBBBBBBBBBBDDDDK..KDDDDBBBBK',
      '......KBBBBBBBBBBBBBBBK..KBBBBBBBBK',
      '......KBBBBBBBBBBBBBBBK..KBBBBBBBBK',
      '......KBBBBBBBBBBBBBBBK..KBBBBBBBSK',
      '......KBBBBBBBBBSBSBSBK..KSBSBSBBSK',
      '......KBBBBBBBBBBBBBBBK..KBBBBBBSSK',
      '......KKKKKKKKKKKKKKKKK..KKKKKKKKKK',
  ],
};

/**
 * 날개 세 종 — 모양은 같고 **성격**이 다르다.
 *   비둘기 : 회색 깃털, 층이 넉넉하다
 *   천사   : 흰색, 깃털 한가운데가 밝다(`glow`)
 *   악마   : 깃털이 없다 — 살(rib)과 **오목하게 파인 막**(`bat`)
 */
const WING = {
  /**
   * ★ **박쥐날개** (2026-08-21 29차, 사용자 지정 — *"약간 앙상한 박쥐 날개 모양으로"*).
   *
   * 악마날개와 **같은 생성기**(`bat: true`)를 쓴다. 살이 적고 막이 깊게 파이는 그 모양이
   * 곧 박쥐다 — 깃털 생성기로는 아무리 색을 낮춰도 새가 된다. 다른 것은 색뿐이라
   * 붉은 악마날개와 나란히 둬도 **같은 손에서 나온 그림**으로 보인다.
   * 값이 제일 싸므로(1,000) 색도 제일 수수하게 — 회보라에 밝기 차만 준다.
   */
  wing_bat:   { pal: { K: [24, 20, 32],   B: [92, 84, 112],   H: [140, 132, 164], S: [56, 50, 72] },     bat: true },
  wing_dove:  { pal: { K: [70, 78, 92],   B: [186, 196, 210], H: [240, 246, 255], S: [130, 142, 162] } },
  /**
   * ★ 색 날개 셋(2026-08-21 사용자 지정) — **팔레트만 다르다.**
   *
   * 모양을 따로 그리지 않은 것이 설계다. 부챗살 생성기가 좌우 대칭과 깃털 층을
   * 보장하므로, 색만 갈아 끼우면 여섯 벌이 **한 벌처럼 같은 품질**로 나온다.
   * 손으로 세 벌을 더 그렸으면 어느 하나는 반드시 깃털 수가 어긋났을 것이다.
   *
   * 네 값은 같은 규칙으로 골랐다 — `K` 는 가장 어두운 테두리, `B` 는 본색,
   * `H` 는 본색보다 두 단계 밝게(깃털 윗면), `S` 는 두 단계 어둡게(깃털 아랫면).
   * 밝기 차가 이만큼 벌어져야 도트 넷으로도 깃털이 층져 보인다.
   */
  wing_blue:   { pal: { K: [26, 52, 100],  B: [78, 140, 214],  H: [158, 208, 255], S: [44, 92, 158] } },
  wing_yellow: { pal: { K: [122, 84, 12],  B: [246, 200, 60],  H: [255, 240, 158], S: [196, 146, 24] } },
  wing_green:  { pal: { K: [22, 72, 44],   B: [78, 178, 106],  H: [156, 234, 176], S: [42, 118, 68] } },
  wing_angel: { pal: { K: [176, 150, 96], B: [252, 250, 240], H: [255, 255, 255], S: [214, 202, 168] }, glow: true },
  wing_devil: { pal: { K: [38, 12, 16],   B: [150, 34, 40],   H: [198, 62, 58],   S: [92, 18, 24] },    bat: true },
};

// ─────────────────────────────────────────────
// 굽기
// ─────────────────────────────────────────────

function blank(w, h) {
  return { w, h, buf: Buffer.alloc(w * h * 4, 0) };
}
function put(img, x, y, rgb) {
  if (x < 0 || y < 0 || x >= img.w || y >= img.h || !rgb) return;
  const i = (y * img.w + x) * 4;
  img.buf[i] = rgb[0]; img.buf[i + 1] = rgb[1]; img.buf[i + 2] = rgb[2]; img.buf[i + 3] = 255;
}

/** 도면 문자열 → 그림 */
function fromRows(rows, pal) {
  const h = rows.length;
  const w = rows[0].length;
  for (const r of rows) {
    if (r.length !== w) throw new Error(`도면 줄 길이가 다르다: ${w} vs ${r.length} — "${r}"`);
  }
  const img = blank(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = rows[y][x];
      if (c === '.') continue;
      const rgb = pal[c];
      if (!rgb) throw new Error(`도면에 팔레트에 없는 글자: '${c}'`);
      put(img, x, y, rgb);
    }
  }
  return img;
}

async function write(img, name) {
  await sharp(img.buf, { raw: { width: img.w, height: img.h, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toFile(resolve(OUT, `${name}.png`));
}

mkdirSync(OUT, { recursive: true });

let made = 0;
for (const it of ITEMS) {
  const cuts = {};
  if (MASK[it.id]) {
    const spec = MASK[it.id];
    cuts.front = spec.make(it.w, it.h, spec.pal, 'front');
    cuts.side = spec.make(it.w, it.h, spec.pal, 'side');
  } else if (HAT[it.id]) {
    const spec = HAT[it.id];
    if (spec.make) {
      cuts.front = spec.make(it.w, it.h, spec.pal, 'front');
      cuts.side = spec.make(it.w, it.h, spec.pal, 'side');
    } else {
      cuts.front = fromRows(spec.front, spec.pal);
      cuts.side = spec.side ? fromRows(spec.side, spec.pal) : cuts.front;
    }
  } else if (it.id === 'pet_tiger_big') {
    // 강아지·고양이처럼 **옆모습도 같은 그림**을 쓴다 — 정면을 보고 뒤따라오는 쪽이
    // 오히려 더 무섭고, 컷을 둘로 나누면 도면이 둘 다 어중간해진다
    cuts.front = fromRows(TIGER_BIG.front, TIGER_BIG.pal);
    cuts.side = cuts.front;
  } else if (PET[it.id]) {
    cuts.front = fromRows(PET[it.id].front, PET[it.id].pal);
    cuts.side = PET[it.id].side ? fromRows(PET[it.id].side, PET[it.id].pal) : cuts.front;
  } else if (WING[it.id]) {
    cuts.front = makeWing(WING[it.id], it.w, it.h);
    // 옆에서는 몸에 가려 **뒤쪽 한 장만** 보인다
    cuts.side = makeWing(WING[it.id], it.w, it.h, 'left');
    // 계단 사이 상승 컷 — 접은 날개 + 번개 (표의 `jumpCut` 이 켜진 것만)
    if (it.jumpCut) cuts.jump = makeWing(WING[it.id], it.w, it.h, 'left', true);
  } else {
    throw new Error(`그림 도면이 없는 아이템: ${it.id}`);
  }

  /**
   * ★ **표와 그림이 어긋나면 여기서 멈춘다.** 크기가 1도트만 달라도 착용 미리보기의
   * 자리(`dx`·`dy`)가 통째로 어긋나는데, 그건 화면을 봐야만 드러난다 — 빌드에서 잡는다.
   */
  for (const [cut, img] of Object.entries(cuts)) {
    if (img.w !== it.w || img.h !== it.h) {
      throw new Error(`${it.id}_${cut} 크기가 표와 다르다: 그림 ${img.w}×${img.h} · 표 ${it.w}×${it.h}`);
    }
    await write(img, `${it.id}_${cut}`);
    made++;
  }
}

// 표에 없는 그림을 굽지 않았는지 되짚는다 (오타로 남는 파일을 막는다)
for (const id of [...Object.keys(HAT), ...Object.keys(MASK), ...Object.keys(PET), ...Object.keys(WING)]) {
  if (!itemById(id)) throw new Error(`도면은 있는데 표에 없는 아이템: ${id}`);
}

console.log(`아이템 도트 ${made}장 → public/assets/items/ (악세사리 7 · 날개 7 · 반려견 7 · 상승 컷 7)`);
