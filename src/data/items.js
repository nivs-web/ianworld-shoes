/**
 * 아이템 쇼핑 명단 — 악세사리 7 · 날개 7 · 반려견 7. (2026-08-21 29차까지, 사용자 지정)
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
  /**
   * ★ **박쥐날개는 날개 중 제일 싸다**(1,000켤레, 2026-08-21 29차 사용자 지정).
   * *"약간 앙상한 박쥐 날개 모양으로"* — 깃털이 아니라 **살(rib)과 파인 막**이라
   * 악마날개와 같은 생성기를 쓰되 색을 회보라로 낮췄다. 첫 날개로 사기 쉬운 값이라
   * 목록 맨 위에 둔다 — 값 순서가 곧 목록 순서다.
   */
  { id: 'wing_bat',    cat: 'wing', slot: 'wing', ko: '박쥐날개',     cost: 1000,  w: 52, h: 26, dx: 4, dy: 25, behind: true, jumpCut: true },
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
  /**
   * ★ **다람쥐는 반려견 중 제일 싸다**(2,000켤레, 2026-08-21 29차 사용자 지정).
   * 강아지·고양이와 같은 14×13 뼈대에 **큰 꼬리**를 얹었다 — 14도트 안에서
   * 다람쥐를 다람쥐로 읽히게 하는 것은 얼굴이 아니라 등 뒤로 말린 꼬리다.
   */
  { id: 'pet_squirrel',   cat: 'pet', slot: 'pet', ko: '다람쥐',       cost: 2000,  w: 14, h: 13, dx: 38, dy: 49, sideDx: 2, sideDy: 62, behind: true },
  { id: 'pet_dog',        cat: 'pet', slot: 'pet', ko: '강아지',       cost: 5000,  w: 14, h: 13, dx: 38, dy: 49, sideDx: 2, sideDy: 62, behind: true },
  { id: 'pet_cat',        cat: 'pet', slot: 'pet', ko: '고양이',       cost: 5000,  w: 14, h: 13, dx: 38, dy: 49, sideDx: 2, sideDy: 62, behind: true },
  { id: 'pet_lion',       cat: 'pet', slot: 'pet', ko: '귀여운사자',   cost: 7000,  w: 14, h: 13, dx: 38, dy: 49, sideDx: 2, sideDy: 62, behind: true },
  { id: 'pet_tiger',      cat: 'pet', slot: 'pet', ko: '귀여운호랑이', cost: 7000,  w: 14, h: 13, dx: 38, dy: 49, sideDx: 2, sideDy: 62, behind: true },
  { id: 'pet_star',       cat: 'pet', slot: 'pet', ko: '따라다니는별', cost: 10000, w: 14, h: 11, dx: 40, dy: 30, sideDx: 0, sideDy: 24, behind: true },
  /**
   * ★ **무서운호랑이는 캐릭터와 같은 크기(35×50)** 다(2026-08-21 사용자 지정).
   *
   * 그래서 자리 계산이 작은 반려견과 다르다.
   *   · 정면 — `dx 21`. 캐릭터가 12~47 을 쓰므로 **절반쯤 겹친다.** 겹치는 쪽이
   *     맞다("캐릭터랑 살짝 겹쳐서 뒤에"). 캐릭터 스프라이트는 머리가 24도트
   *     남짓이라 **위쪽 오른편이 비어 있고**, 호랑이 머리를 그 자리(그림의 오른쪽
   *     위)에 그려 두면 어깨 너머로 얼굴이 통째로 보인다.
   *
   *     ★ 30차에 24 → **21** 로 3도트 당겼다. 로비 상단 그림틀은 착용 상자를 x4~55
   *     구간만 잘라 쓰는데(`wearFigure.LOBBY_FIG`), 24 면 그림 오른쪽이 **3도트
   *     잘려 나갔다** — 값 만 켤레짜리가 로비에서만 옆구리가 잘린 채 보였다.
   *     그림틀을 넓히는 방법도 있었지만 그러면 좁은 폰(360px)에서 통계 줄이 밀린다.
   *     실제로 칠해진 범위를 재 보면(**표가 아니라 png 를 재야 한다**) 전체 아이템의
   *     오른쪽 끝이 정확히 55 가 되어 크롭과 딱 맞는다.
   *   · 옆모습 — 발 높이는 작은 반려견과 같다(13도트 아래 = `dy 25`). 가로는 **더 뒤**다:
   *     한 계단 뒤(20도트)에 두면 35폭짜리 몸의 앞쪽이 캐릭터 몸통까지 밀고 들어와
   *     **주인의 윤곽이 주황색에 묻혔다**(사용자 지적). 27도트 뒤(`sideDx -15`)면
   *     한 칸 아래 계단의 **정중앙보다 살짝 뒤**에 서고, 캐릭터 왼쪽 실루엣이 산다.
   *     음수여도 캔버스는 안 자른다 — 자르는 것은 쇼핑 화면의 상자뿐이다.
   */
  { id: 'pet_tiger_big',  cat: 'pet', slot: 'pet', ko: '무서운호랑이', cost: 10000, w: 35, h: 50, dx: 21, dy: 12, sideDx: -15, sideDy: 25, behind: true },
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
 * ★ **뒤 겹 안에서의 앞뒤 — 반려견이 날개보다 앞이다.** (2026-08-21 29차, 사용자 지정)
 *
 * `behind` 는 "캐릭터보다 뒤"라는 것만 말한다. 그 안에서도 순서가 있다:
 *
 * *"따라다니는 별이나 호랑이나, 날개가 있으면, 날개 뒤에 있으면 안될거 같아 (…)
 *   뒤 캐릭터가 선명하게 보여야 하는데 날개에 가려서 안보이면 안되니깐"*
 *
 * 28차에는 이걸 **컷마다 반대로** 뒀다(정면은 반려견이 앞, 옆모습은 날개가 앞).
 * 옆모습에서는 반려견이 한 계단 뒤에 있으니 더 멀다는 논리였는데, 실제 화면에서는
 * 값 만 켤레짜리 무서운호랑이가 날개 뒤로 들어가 **얼굴이 통째로 지워졌다.**
 * 원근을 지키는 것보다 **산 물건이 보이는 것**이 먼저다 — 두 컷 다 반려견을 앞에 둔다.
 *
 * 숫자가 작을수록 멀다. 정렬은 **안정 정렬**이라 같은 값끼리는 표 순서를 지킨다.
 */
export const BACK_DEPTH = { wing: 0, pet: 1 };
export const backFirst = (a, b) => (BACK_DEPTH[a.cat] ?? 0) - (BACK_DEPTH[b.cat] ?? 0);

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
