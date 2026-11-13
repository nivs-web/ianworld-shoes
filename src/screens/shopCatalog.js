/**
 * 좀비와 드래곤 — 아이템 샵 «물건 목록 어댑터» (11/13 · 겜보조 1)
 *
 * 샵 화면(idgShopView.js)은 물건을 **이 파일의 모양으로만** 본다. 지금은 data/looks.js 의 LOOKS 에서 채우고,
 * 핵심 보조가 새 목록 data/catalog.js(184개)를 만들면 아래 «catalogItems()» 한 곳만 바꾸면 된다.
 *
 * 물건 한 개 = {
 *   slot    : 'hat' | 'neck' | 'breath' | 'aura' | 'pet' | 'flag' | 'roof' | 'gate' | 'yard'   (샵 칸)
 *   id      : 칸 안 이름표                        key : 'hat:crown' (저장 owned 배열에 들어가는 글자)
 *   name    : 보이는 이름
 *   rarity  : 'common' | 'uncommon' | 'rare' | 'epic' | 'legend' | 'myth'   (보통 · 고급 · 희귀 · 영웅 · 전설 · 신화)
 *   price   : { coin?, gem? } | null              null = 팔지 않음 (전설 · 신화 · 기본 지급)
 *   fx      : '공격 +1%'                           효과 한 줄 (표시용 — 실제 계산은 전투 코어)
 *   lock    : { text } | null                      잠김 이유 한 줄 («어려움 3-5 를 깨면 열려요»). null = 열려 있음
 *   art     : 그림 주소
 *   hide?   : (g) => boolean                       true 면 이 계정에는 목록 · 개수에서 빠진다 (초고수 신화 등)
 * }
 */
import { LOOKS, SLOT_NAME, artOf, hasItem, keyOf, dealsFor, parseKey, priceOf, dealPrice, decodeLook, SELLABLE } from '../games/iandragon_game/data/looks.js';

/** 샵 칸 — 이름 · 어느 큰 메뉴에 속하나 · 꾸미기 저장 글자에 들어가는 칸인가(look 에 바로 입힐 수 있나) */
export const SHOP_SLOT = {
  hat: { name: '모자', big: 'dragon', look: true },
  neck: { name: '목 장식', big: 'dragon', look: true },
  breath: { name: '브레스 색', big: 'dragon', look: true },
  aura: { name: '오라', big: 'dragon', look: false },
  pet: { name: '펫', big: 'dragon', look: false },
  flag: { name: '깃발', big: 'castle', look: true },
  roof: { name: '지붕', big: 'castle', look: false },
  gate: { name: '성문', big: 'castle', look: false },
  yard: { name: '앞마당', big: 'castle', look: false },
};

/** 등급 6단계 (테 색은 idg-shop.css 의 .r-<id> · stars = 카드에 보이는 별 수 ★1 보통 ~ ★6 신화) */
export const RARITY = {
  common: { name: '보통', pct: 0.5, stars: 1 },
  uncommon: { name: '고급', pct: 1, stars: 2 },
  rare: { name: '희귀', pct: 1.5, stars: 3 },
  epic: { name: '영웅', pct: 2, stars: 4 },
  legend: { name: '전설', pct: 2.5, stars: 5 },
  myth: { name: '신화', pct: 3, stars: 6 },
};

/** 꾸미기 효과 한 줄 (IDG_COLLECTION_PLAN §3.3 표 — 기획값의 1/5) */
const FX_LABEL = { hat: '공격', pet: '공격', neck: '브레스 충전', aura: '브레스 충전', flag: '캐슬 체력', roof: '캐슬 체력', gate: '캐슬 체력', yard: '캐슬 체력' };
const fxOf = (slot, rarity) => (slot === 'breath' ? '브레스 사거리 +5%' : `${FX_LABEL[slot]} +${RARITY[rarity].pct}%`);

/** 지금 LOOKS 의 값으로 등급을 매긴다 — 젬으로만 팔던 4개 = 영웅 (기획 §1) · 코인은 값 띠로 (보통 ≤ 6,000 · 고급 ≤ 20,000 · 그 위 희귀) */
function rarityOfLook(x) {
  if (x.gem) return 'epic';
  return x.price <= 6000 ? 'common' : x.price <= 20000 ? 'uncommon' : 'rare';
}

/** ── 여기만 나중에 catalog.js 로 바꾼다 ── */
function catalogItems() {
  const out = [];
  for (const slot of ['hat', 'neck', 'breath', 'flag']) {
    for (const x of LOOKS[slot]) {
      const sold = x.price > 0, rarity = sold ? rarityOfLook(x) : 'common';
      out.push({
        slot, id: x.id, key: keyOf(slot, x.id), name: x.name, rarity,
        price: sold ? (x.gem ? { gem: x.price } : { coin: x.price }) : null,
        fx: sold ? fxOf(slot, rarity) : '기본 모양', lock: null, art: artOf(slot, x.id),
      });
    }
  }
  return out;
}

let cache = null;
const all = () => cache || (cache = catalogItems());

/** 이 칸의 물건들 (이 계정에 보이는 것만 · 카탈로그 순서) */
export const itemsOf = (slot, g) => all().filter((it) => it.slot === slot && !(it.hide && it.hide(g)));
/** 이 열쇠의 물건 */
export const itemByKey = (key) => all().find((it) => it.key === key) || null;
/** 가졌나 — 기본 지급(브레스 기본 불꽃)도 가진 것으로 센다 */
export const isOwned = (g, it) => hasItem(g, it.slot, it.id) || (Array.isArray(g?.owned) && g.owned.includes(it.key));
/** 지금 입고 있나 (꾸미기 저장 글자 look 기준 — 새 칸(오라 · 펫 · 지붕 …)은 아직 저장 자리가 없어 false) */
export const isWorn = (g, it) => SHOP_SLOT[it.slot].look && decodeLook(g?.look)[it.slot] === it.id;
/** 오늘의 특가 3개 (지금 그대로 · 같은 날이면 누구나 같은 3개) */
export const dealsOf = (day) => dealsFor(day).map((k) => itemByKey(k)).filter(Boolean);
export { dealPrice, SELLABLE, parseKey, priceOf, SLOT_NAME };

/** 샵에서 살 수 있나 : 'buy'(살 수 있음) · 'locked'(조건 · 판매 안 함) · 'owned'(가짐) */
export function stateOf(g, it) {
  if (isOwned(g, it)) return 'owned';
  if (it.lock || !it.price) return 'locked';
  return 'buy';
}
/** 값을 낼 수 있나 (price: {coin, gem}) */
export const canPay = (g, price) => (!price?.coin || (g?.coins || 0) >= price.coin) && (!price?.gem || (g?.gems || 0) >= price.gem);
/** 잠긴 카드 안내 한 줄 */
export const lockText = (it) => it.lock?.text || (it.rarity === 'legend' || it.rarity === 'myth' ? '보스에게서 나와요' : '지금은 팔지 않아요');
