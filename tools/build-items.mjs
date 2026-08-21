/**
 * 아이템 도트 22장 — 악세사리 5 · 날개 3 · 반려견 3, 각각 정면/옆. (2026-08-21 26차)
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
 */
function makeWing(spec, w, h, only = null) {
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
    const base = LEN[j] + (LEN[j + 1] - LEN[j]) * (f * 0.15);
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
  return img;
}

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
 * 날개 세 종 — 모양은 같고 **성격**이 다르다.
 *   비둘기 : 회색 깃털, 층이 넉넉하다
 *   천사   : 흰색, 깃털 한가운데가 밝다(`glow`)
 *   악마   : 깃털이 없다 — 살(rib)과 **오목하게 파인 막**(`bat`)
 */
const WING = {
  wing_dove:  { pal: { K: [70, 78, 92],   B: [186, 196, 210], H: [240, 246, 255], S: [130, 142, 162] } },
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
  if (HAT[it.id]) {
    const spec = HAT[it.id];
    if (spec.make) {
      cuts.front = spec.make(it.w, it.h, spec.pal, 'front');
      cuts.side = spec.make(it.w, it.h, spec.pal, 'side');
    } else {
      cuts.front = fromRows(spec.front, spec.pal);
      cuts.side = spec.side ? fromRows(spec.side, spec.pal) : cuts.front;
    }
  } else if (PET[it.id]) {
    cuts.front = fromRows(PET[it.id].front, PET[it.id].pal);
    cuts.side = PET[it.id].side ? fromRows(PET[it.id].side, PET[it.id].pal) : cuts.front;
  } else if (WING[it.id]) {
    cuts.front = makeWing(WING[it.id], it.w, it.h);
    // 옆에서는 몸에 가려 **뒤쪽 한 장만** 보인다
    cuts.side = makeWing(WING[it.id], it.w, it.h, 'left');
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
for (const id of [...Object.keys(HAT), ...Object.keys(PET), ...Object.keys(WING)]) {
  if (!itemById(id)) throw new Error(`도면은 있는데 표에 없는 아이템: ${id}`);
}

console.log(`아이템 도트 ${made}장 → public/assets/items/ (악세사리 5 · 날개 3 · 반려견 3)`);
