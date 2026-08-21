/**
 * 아이템 쇼핑 명단 — 악세사리 5 · 날개 3 · 반려견 3. (2026-08-21 26차, 사용자 지정)
 *
 * *"신발이 3000~5000켤레 있는 사람들은 신발이 남아 돌아서, 재미가 없으니, 신발을 소진할
 *   수 있는 아이템 구매 쇼핑 항목을 추가하고 싶어, 좀 비싼 아이템만 파는거야"*
 *
 * ## 값과 이름은 사용자가 준 것 그대로다 — 임의로 조정하지 않는다
 *
 * 가장 싼 것이 1,000켤레다. 한 판에 오가는 신발이 최대 121켤레(§9-0-55)이므로
 * **멀티를 여러 번 이겨야 하나 산다** — 그게 이 메뉴의 목적이다.
 *
 * ## 착용 자리는 셋이고 서로 안 겹친다
 *
 * `slot` 하나에 하나만 착용한다(모자 하나 · 날개 하나 · 반려견 하나). 캐릭터처럼
 * "고르면 곧 착용"이고, 같은 것을 다시 누르면 벗는다.
 *
 * ## 좌표는 **착용 상자(WEAR)** 기준이다
 *
 * 캐릭터 그림은 35×50 인데 모자는 머리 **위**에, 날개는 **양옆**에, 반려견은 **옆**에
 * 서야 하므로 그 상자만으로는 자리가 없다. 그래서 60×66 짜리 상자를 두고 캐릭터를
 * (12, 12) 에 놓는다 — 위로 12·좌우로 12·아래로 4도트의 여유가 생긴다.
 *
 * `dx`·`dy` 는 그 상자의 왼쪽 위 기준이고, **`tools/build-items.mjs` 가 굽는 그림의
 * 크기(`w`·`h`)와 반드시 같아야 한다** — 다르면 빌드가 그 자리에서 멈춘다.
 * 사용자가 나중에 직접 그린 png 로 갈아 끼울 때도 이 표만 맞추면 된다.
 */

/** 착용 미리보기 상자 — 캐릭터(35×50)를 (12,12) 에 놓는다 */
export const WEAR = { w: 60, h: 66, charX: 12, charY: 12 };

/** 카테고리 탭 — 순서도 사용자 지정 그대로 */
export const ITEM_CATS = [
  { id: 'acc', slot: 'hat' },
  { id: 'wing', slot: 'wing' },
  { id: 'pet', slot: 'pet' },
];

/**
 * @typedef {object} Item
 * @property {string} id      에셋 파일 이름의 뿌리 (`items/{id}_front.png`)
 * @property {string} cat     'acc' | 'wing' | 'pet'
 * @property {string} slot    착용 자리 — 같은 자리에는 하나만
 * @property {string} ko      화면에 쓰는 이름
 * @property {number} cost    신발 켤레
 * @property {number} w,h     그림 크기 (빌드가 대조한다)
 * @property {number} dx,dy   착용 상자 안에서의 왼쪽 위 좌표
 * @property {boolean} [behind] 캐릭터보다 **먼저** 그린다 (날개)
 */

/** @type {Item[]} */
export const ITEMS = [
  // ── 악세사리 (머리) ─────────────
  { id: 'hat_fedora',  cat: 'acc',  slot: 'hat',  ko: '중절모',       cost: 1000,  w: 22, h: 10, dx: 18, dy: 5 },
  { id: 'hat_cap',     cat: 'acc',  slot: 'hat',  ko: '야구모자',     cost: 1000,  w: 22, h: 9,  dx: 18, dy: 6 },
  { id: 'hat_beret',   cat: 'acc',  slot: 'hat',  ko: '베레모',       cost: 2000,  w: 22, h: 9,  dx: 18, dy: 6 },
  { id: 'hat_dread',   cat: 'acc',  slot: 'hat',  ko: '레게머리가발', cost: 3000,  w: 24, h: 32, dx: 17, dy: 9 },
  { id: 'hat_crown',   cat: 'acc',  slot: 'hat',  ko: '왕관',         cost: 4000,  w: 22, h: 10, dx: 18, dy: 5 },

  // ── 날개 (등 뒤 — 캐릭터보다 먼저 그린다) ─────────────
  { id: 'wing_dove',   cat: 'wing', slot: 'wing', ko: '비둘기날개',   cost: 3000,  w: 52, h: 26, dx: 4, dy: 26, behind: true },
  { id: 'wing_angel',  cat: 'wing', slot: 'wing', ko: '천사날개',     cost: 5000,  w: 52, h: 26, dx: 4, dy: 24, behind: true },
  { id: 'wing_devil',  cat: 'wing', slot: 'wing', ko: '악마날개',     cost: 10000, w: 52, h: 26, dx: 4, dy: 25, behind: true },

  // ── 반려견 (옆에 선다) ─────────────
  { id: 'pet_dog',     cat: 'pet',  slot: 'pet',  ko: '강아지',       cost: 5000,  w: 14, h: 13, dx: 40, dy: 49 },
  { id: 'pet_cat',     cat: 'pet',  slot: 'pet',  ko: '고양이',       cost: 5000,  w: 14, h: 13, dx: 40, dy: 49 },
  { id: 'pet_star',    cat: 'pet',  slot: 'pet',  ko: '따라다니는별', cost: 5000,  w: 14, h: 11, dx: 41, dy: 30 },
];

export const itemById = (id) => ITEMS.find((it) => it.id === id) ?? null;
export const itemsOf = (cat) => ITEMS.filter((it) => it.cat === cat);
/** `items/{id}_{cut}.png` — 옆모습의 반대편은 캐릭터처럼 **런타임에 뒤집는다** (§5) */
export const itemSprite = (id, cut = 'front') => `/assets/items/${id}_${cut}.png`;
