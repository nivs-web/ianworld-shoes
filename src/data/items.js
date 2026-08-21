/**
 * 아이템 쇼핑 명단 — 악세사리 7 · 날개 6 · 반려견 6. (2026-08-21 28차까지, 사용자 지정)
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
 *
 * ## 옆모습은 자리가 다를 수 있다 (`sideDx`·`sideDy`)
 *
 * 반려견이 그렇다. 정면에서는 옆에 서 있으면 되지만 **옆모습에서는 주인 뒤(= 바라보는
 * 반대쪽)에, 한 계단 아래**에 있어야 한다 — 앞에 서 있으면 주인이 반려견을 밟고 오르는
 * 그림이 된다(사용자 지적). 없으면 `dx`·`dy` 를 그대로 쓴다.
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
 * @property {number} dx,dy   착용 상자 안에서의 왼쪽 위 좌표 (정면 컷)
 * @property {number} [sideDx],[sideDy] 옆모습(=인게임 계단) 전용 좌표
 * @property {boolean} [behind] 캐릭터보다 **먼저** 그린다 (날개 · 반려견)
 * @property {boolean} [jumpCut] `_jump` 그림이 따로 있다 (계단 사이 상승 컷)
 */

/**
 * ★ **한 자리(`slot`)에 하나만.** 악세사리 둘을 동시에 쓸 수 없고, 악세사리·날개·반려견은
 * 자리가 달라 **각각 하나씩 셋을 다 착용할 수 있다**(사용자 지정). 그 규칙은 표가 아니라
 * `storageLocal.equipItem(slot, id)` 한 곳이 지킨다 — 같은 자리에 새 id 를 쓰면 덮인다.
 *
 * @type {Item[]}
 */
export const ITEMS = [
  // ── 악세사리 (머리) ─────────────
  { id: 'hat_fedora',  cat: 'acc',  slot: 'hat',  ko: '중절모',       cost: 1000,  w: 22, h: 10, dx: 18, dy: 5 },
  { id: 'hat_cap',     cat: 'acc',  slot: 'hat',  ko: '야구모자',     cost: 1000,  w: 22, h: 9,  dx: 18, dy: 6 },
  { id: 'hat_beret',   cat: 'acc',  slot: 'hat',  ko: '베레모',       cost: 2000,  w: 22, h: 9,  dx: 18, dy: 6 },
  { id: 'hat_dread',   cat: 'acc',  slot: 'hat',  ko: '레게머리가발', cost: 3000,  w: 24, h: 32, dx: 17, dy: 9 },
  { id: 'hat_crown',   cat: 'acc',  slot: 'hat',  ko: '왕관',         cost: 5000,  w: 22, h: 10, dx: 18, dy: 5 },
  /**
   * ★ 가면 둘은 **얼굴을 통째로 덮는다.** 그래서 크기가 머리 실루엣과 같은 24×24 이고
   * 자리도 머리에 딱 맞춰 뒀다 — 한 도트만 어긋나도 살색이 새어 나와 바로 티가 난다.
   * 배트맨은 **귀가 머리 위로 솟으므로** 시작 y 가 머리보다 7도트 위다(12 → 5).
   */
  { id: 'hat_ironman', cat: 'acc',  slot: 'hat',  ko: '아이언맨마스크', cost: 7000, w: 24, h: 24, dx: 17, dy: 12 },
  { id: 'hat_batman',  cat: 'acc',  slot: 'hat',  ko: '배트맨마스크',   cost: 7000, w: 24, h: 26, dx: 17, dy: 5 },

  // ── 날개 (등 뒤 — 캐릭터보다 먼저 그린다) ─────────────
  // `jumpCut` — 계단 사이 상승 컷에서는 **접힌 날개 + 번개**를 따로 굽는다
  { id: 'wing_dove',   cat: 'wing', slot: 'wing', ko: '비둘기날개',   cost: 3000,  w: 52, h: 26, dx: 4, dy: 26, behind: true, jumpCut: true },
  /**
   * ★ 색 날개 셋은 **비둘기날개 바로 아래**에 이어 붙인다(2026-08-21 사용자 지정).
   * 모양·값(3,000)이 비둘기와 같고 **색만 다르다** — 부챗살 생성기가 팔레트만 갈아
   * 끼우므로 좌우 대칭과 깃털 층이 저절로 따라온다. 색을 고를 수 있게 하는 것이
   * 이 셋의 존재 이유다(첫 날개는 대부분 싼 것을 사는데, 그게 회색 하나뿐이었다).
   */
  { id: 'wing_blue',   cat: 'wing', slot: 'wing', ko: '파랑날개',     cost: 3000,  w: 52, h: 26, dx: 4, dy: 26, behind: true, jumpCut: true },
  { id: 'wing_yellow', cat: 'wing', slot: 'wing', ko: '노랑날개',     cost: 3000,  w: 52, h: 26, dx: 4, dy: 26, behind: true, jumpCut: true },
  { id: 'wing_green',  cat: 'wing', slot: 'wing', ko: '초록날개',     cost: 3000,  w: 52, h: 26, dx: 4, dy: 26, behind: true, jumpCut: true },
  { id: 'wing_angel',  cat: 'wing', slot: 'wing', ko: '천사날개',     cost: 5000,  w: 52, h: 26, dx: 4, dy: 24, behind: true, jumpCut: true },
  { id: 'wing_devil',  cat: 'wing', slot: 'wing', ko: '악마날개',     cost: 10000, w: 52, h: 26, dx: 4, dy: 25, behind: true, jumpCut: true },

  /**
   * ── 반려견 ─────────────
   *
   * **주인보다 먼저 그린다**(`behind`) — 앞에 서면 주인이 반려견을 밟고 오르는 그림이
   * 된다(사용자 지적). 그리고 옆모습에서는 자리까지 다르다:
   *
   *   · 강아지·고양이·사자·호랑이 — 바라보는 **반대쪽으로 한 계단**(화면 가로 30 · 세로 20) 뒤.
   *     원본 도트로는 배율 1.5 를 나눠 가로 20 · 세로 13 이다. 그러면 발이 **바로 뒤
   *     계단 윗면**에 정확히 닿아 따라 올라오는 그림이 된다.
   *   · 정면은 반대로 **주인 옆에 딱 붙는다**(dx 42 → 38, 2026-08-21 사용자 지정).
   *     로비 상단 상태창처럼 좁은 칸에도 반려견이 함께 보여야 하기 때문이다 —
   *     멀리 떨어져 있으면 그 칸에서 제일 먼저 잘려 나간다.
   *   · 따라다니는별 — 예외로 **등 뒤 살짝 위**에 뜬다(사용자 지정). 별은 걷지 않는다.
   */
  { id: 'pet_dog',        cat: 'pet', slot: 'pet', ko: '강아지',       cost: 5000,  w: 14, h: 13, dx: 38, dy: 49, sideDx: 2, sideDy: 62, behind: true },
  { id: 'pet_cat',        cat: 'pet', slot: 'pet', ko: '고양이',       cost: 5000,  w: 14, h: 13, dx: 38, dy: 49, sideDx: 2, sideDy: 62, behind: true },
  { id: 'pet_lion',       cat: 'pet', slot: 'pet', ko: '귀여운사자',   cost: 7000,  w: 14, h: 13, dx: 38, dy: 49, sideDx: 2, sideDy: 62, behind: true },
  { id: 'pet_tiger',      cat: 'pet', slot: 'pet', ko: '귀여운호랑이', cost: 7000,  w: 14, h: 13, dx: 38, dy: 49, sideDx: 2, sideDy: 62, behind: true },
  { id: 'pet_star',       cat: 'pet', slot: 'pet', ko: '따라다니는별', cost: 10000, w: 14, h: 11, dx: 40, dy: 30, sideDx: 0, sideDy: 24, behind: true },
  /**
   * ★ **무서운호랑이는 캐릭터와 같은 크기(35×50)** 다(2026-08-21 사용자 지정).
   *
   * 그래서 자리 계산이 작은 반려견과 다르다.
   *   · 정면 — `dx 24`. 캐릭터가 12~47 을 쓰므로 24~59 는 **절반쯤 겹친다.**
   *     겹치는 쪽이 맞다("캐릭터랑 살짝 겹쳐서 뒤에"). 캐릭터 스프라이트는 머리가
   *     24도트 남짓이라 **위쪽 오른편이 비어 있고**, 호랑이 머리를 그 자리(그림의
   *     오른쪽 위)에 그려 두면 어깨 너머로 얼굴이 통째로 보인다.
   *   · 옆모습 — 작은 반려견과 **같은 규칙**(중심을 20도트 뒤, 발을 13도트 아래).
   *     35폭이라 `dx = 9.5 - 17.5 = -8`, `dy = 12 + 13 = 25` 가 그 값이다.
   *     음수여도 캔버스는 안 자른다 — 자르는 것은 쇼핑 화면의 상자뿐이다.
   */
  { id: 'pet_tiger_big',  cat: 'pet', slot: 'pet', ko: '무서운호랑이', cost: 10000, w: 35, h: 50, dx: 24, dy: 12, sideDx: -8, sideDy: 25, behind: true },
];

/**
 * 컷에 맞는 좌표. 정면은 `dx`·`dy`, 그 밖(옆·상승 컷)은 `sideDx`·`sideDy` 가 있으면 그것.
 *
 * **쇼핑 화면과 인게임이 같은 함수를 쓴다** — 두 곳이 각자 고르면 언젠가 한쪽만 고쳐진다.
 */
export function itemOffset(it, cut = 'front') {
  if (cut === 'front' || it.sideDx == null) return { x: it.dx, y: it.dy };
  return { x: it.sideDx, y: it.sideDy ?? it.dy };
}

/**
 * ★ **뒤 겹 안에서의 앞뒤 — 컷마다 다르다.** (2026-08-21 28차)
 *
 * `behind` 는 "캐릭터보다 뒤"라는 것만 말한다. 그 안에서도 순서가 있고, **정면과
 * 옆모습이 서로 반대다.**
 *
 *   · 정면 — 반려견은 **주인 옆**에 서 있다. 등에 붙은 날개보다 **가깝다.**
 *   · 옆모습 — 반려견은 **한 계단 뒤**에서 따라온다. 날개보다 **멀다.**
 *
 * 작은 강아지는 겹치는 자리가 없어 이 차이가 안 보였다. 무서운호랑이(35×50)를 넣자마자
 * 두 컷에서 **번갈아 가며 한쪽이 통째로 가려졌다** — 옆모습에서는 호랑이가 날개를 덮고,
 * 순서를 뒤집자 정면에서는 날개가 호랑이 얼굴을 덮었다. 값을 만 켤레씩 주고 산 물건
 * 둘 중 하나가 안 보이면 그건 고장이다.
 *
 * 숫자가 작을수록 멀다. 정렬은 **안정 정렬**이라 같은 값끼리는 표 순서를 지킨다.
 */
export const BACK_DEPTH = {
  front: { wing: 0, pet: 1 },
  side: { pet: 0, wing: 1 },
};
export function backFirst(cut = 'front') {
  const d = cut === 'front' ? BACK_DEPTH.front : BACK_DEPTH.side;
  return (a, b) => (d[a.cat] ?? 0) - (d[b.cat] ?? 0);
}

export const itemById = (id) => ITEMS.find((it) => it.id === id) ?? null;
export const itemsOf = (cat) => ITEMS.filter((it) => it.cat === cat);
/** `items/{id}_{cut}.png` — 옆모습의 반대편은 캐릭터처럼 **런타임에 뒤집는다** (§5) */
export const itemSprite = (id, cut = 'front') => `/assets/items/${id}_${cut}.png`;

/**
 * 착용 목록을 **한 줄 문자열**로 주고받는다 — `"hat_crown,wing_angel"`.
 * (2026-08-21 26차 후속)
 *
 * RTDB 에 객체로 넣으면 잎마다 `.validate` 를 새로 써야 하고 **슬롯이 늘 때마다 규칙을
 * 다시 게시**해야 한다(규칙에 없는 필드는 그 update 를 통째로 막는다, §9-0-34).
 * 문자열 하나면 슬롯이 늘어도 규칙이 그대로다.
 *
 * 이 두 함수가 화면이 아니라 **표 옆에** 있는 이유: 멀티 서비스(`multiplayer.js`)와
 * 인게임 렌더(`game/wornItems.js`)가 둘 다 쓴다. 서비스가 `game/` 을 물면 브라우저
 * 전용 모듈(canvas·assets)이 딸려 와 **노드 검사에서 그 자리에서 죽는다**.
 */
export function packItems(equipped) {
  if (!equipped) return '';
  return Object.values(equipped).filter(Boolean).join(',');
}

/** 문자열 → id 배열. 표에 없는 id 는 버린다(옛 클라이언트가 보낸 값일 수 있다) */
export function parseItems(v) {
  if (!v || typeof v !== 'string') return [];
  return v.split(',').map((s) => s.trim()).filter((s) => !!itemById(s));
}

/**
 * 방에 실어 보내는 문자열의 최대 길이 — **규칙의 `items` 상한과 같은 숫자여야 한다.**
 * 지금 가장 긴 조합은 `hat_dread,wing_devil,pet_star`(31자)이고, 슬롯이 더 늘어도
 * 버틸 만큼 여유를 뒀다.
 */
export const ITEMS_MAX = 64;
