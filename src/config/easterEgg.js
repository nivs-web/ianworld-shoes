/**
 * ★ **이스터 에그 — 하루 5분만 열리는 할인.** (2026-08-21 32차, 사용자 지정)
 *
 * *"매일 오후 7시 30분부터 35분 사이에 배트맨 마스크 신발 500개에 파는
 *   이스터 에그를 넣어줘"*
 *
 * ## 왜 KST 로 못 박나
 *
 * 기기의 로컬 시간으로 재면 **사람마다 열리는 순간이 다르다.** 이스터 에그는
 * "지금이야!" 하고 같이 몰려드는 재미인데, 각자 다른 시각에 열리면 그 재미가 통째로
 * 사라진다. 순위표 기간 키를 KST 로 못 박은 것과 **같은 이유**다(§9-0-49) —
 * 서버에 시간대를 물어볼 방법이 없으므로 **모두가 같은 규칙을 쓰는 것**이 유일한 합의다.
 *
 * ## 값은 여기 한 곳에만 있다
 *
 * `data/items.js` 의 정가(7,000)는 그대로 두고 **이 표가 그때만 덮어쓴다.** 표를
 * 고치면 목록의 값·큰 버튼·실제 차감이 함께 따라온다 — 화면이 값을 따로 계산하면
 * "화면에는 500인데 7,000이 빠지는" 사고가 난다.
 *
 * ## 알아 둘 것 — 기기 시계를 바꾸면 아무 때나 살 수 있다
 *
 * 막을 방법이 없다. 이 게임의 지갑은 **로컬이 원본**이고(§9-0-5 계열) 구매는 서버가
 * 검증하지 않는다 — 애초에 `localStorage` 를 고치면 신발을 얼마든지 만들 수 있으므로
 * 시계를 속이는 것이 새로 여는 구멍은 아니다. 무료 게임이고 아이템은 치장이라
 * 여기에 서버 검증을 붙일 이유가 없다.
 */

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** 그 시각의 **KST 벽시계**를 UTC 부품으로 들고 있는 Date (`periodKeys.kst` 와 같은 수법) */
const kst = (ms) => new Date(ms + KST_OFFSET_MS);

/** 자정부터 몇 분이 지났나 (KST) */
const minuteOfDay = (ms) => {
  const k = kst(ms);
  return k.getUTCHours() * 60 + k.getUTCMinutes();
};

/**
 * 열리는 시각과 값. **분 단위**로 적는다 — 시/분을 따로 두면 경계 계산이 두 벌이 된다.
 *
 * `to` 는 **미포함**이다(19:35:00 이 되는 순간 닫힌다). 그래야 "30분부터 35분 사이"가
 * 정확히 5분이고, 다음 창까지의 남은 시간 계산도 한 식으로 떨어진다.
 */
export const EASTER_EGG = {
  /** 이 아이템만 싸진다 (사용자 지정) */
  itemId: 'hat_batman',
  /** 그때의 값 (켤레) */
  price: 500,
  /** 19:30 (KST) */
  from: 19 * 60 + 30,
  /** 19:35 (KST, 미포함) */
  to: 19 * 60 + 35,
};

/** 지금 창이 열려 있나 */
export function eggOpen(now = Date.now()) {
  const m = minuteOfDay(now);
  return m >= EASTER_EGG.from && m < EASTER_EGG.to;
}

/**
 * 이 아이템의 **지금 값.** 화면도 실제 차감도 이 함수 하나만 부른다.
 * @param {{id:string, cost:number}} item
 */
export function priceOf(item, now = Date.now()) {
  if (!item) return 0;
  if (item.id !== EASTER_EGG.itemId) return item.cost;
  return eggOpen(now) ? EASTER_EGG.price : item.cost;
}

/** 이 아이템이 **지금 할인 중인가** (뱃지를 붙일지 판단) */
export const eggSale = (item, now = Date.now()) =>
  !!item && item.id === EASTER_EGG.itemId && eggOpen(now);

/**
 * 창이 **열리거나 닫히기까지** 남은 ms.
 *
 * 화면이 1초마다 다시 그릴 이유가 없다 — 바뀌는 순간이 하루에 딱 두 번이므로
 * 그때 한 번만 다시 그리면 된다(`ItemShop` 이 이 값으로 타이머를 건다).
 * 쇼핑을 열어 둔 채 19:30 이 지나면 값이 저절로 500으로 바뀐다.
 */
export function msUntilEggChange(now = Date.now()) {
  const k = kst(now);
  const 자정 = Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate());
  const 지난 = k.getTime() - 자정;                 // 오늘(KST) 자정부터 흐른 ms
  const 여는때 = EASTER_EGG.from * 60000;
  const 닫는때 = EASTER_EGG.to * 60000;
  const 하루 = 24 * 60 * 60000;
  for (const 경계 of [여는때, 닫는때, 하루 + 여는때]) {
    if (지난 < 경계) return 경계 - 지난;
  }
  return 하루 - 지난;                              // 도달할 일이 없다 (마지막 경계가 내일이라)
}
