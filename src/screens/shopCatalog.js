/**
 * 좀비와 드래곤 — 꾸미기 물건 목록 어댑터 (샵 · 꾸미기 창이 같이 쓴다) (11/13 · 겜보조 1 틀 → 겜보조 2 가 data/catalog.js 로 바꿔 끼움)
 *
 * 화면(idgShopView.js · idgLook.js)은 물건을 **이 파일의 모양으로만** 본다. 자료 = data/catalog.js(184개 · 동적 import · 따로 묶음) +
 * data/lookFx.js(효과 · 저장 번호). 처음 한 번 `loadCatalog()` 를 기다린 뒤에 쓴다.
 *
 * 물건 한 개 = {
 *   slot    : 'hat' | 'neck' | 'breath' | 'aura' | 'pet' | 'flag' | 'roof' | 'gate' | 'yard'
 *   id · key('hat:crown' — 저장 owned 에 들어가는 글자) · name('???' = 신화 그림자)
 *   rarity  : 'common' | 'uncommon' | 'rare' | 'epic' | 'legend' | 'myth'   (보통 · 고급 · 희귀 · 영웅 · 전설 · 신화 = catalog 의 common · fine · rare · hero · legend · myth)
 *   star    : 1 ~ 6 (카드 별 수)
 *   price   : { coin?, gem? } | null     null = 팔지 않음 · 희귀는 둘 다 있다(코인 + 젬 둘 다 내야 산다)
 *   fx      : 효과 한 줄 (표시용 — 계산은 lookFx)
 *   lock    : { text } | null            null = 열려 있음(샵에 열렸거나 이미 가짐)
 *   art     : 그림 주소 (아직 없는 물건은 그림이 안 떠 글자로 대신 보인다)
 * }
 */
import { LOOKS, artOf, dealPrice } from '../games/iandragon_game/data/looks.js';
import { LOOK_FX, TIER_PCT } from '../games/iandragon_game/data/lookFx.js';
import { wearOf, isWornId } from './idgLookParts/wear.js';

/** 샵 칸 — 이름 · 어느 큰 메뉴에 속하나 (모든 칸이 look · clook 글자로 바로 입힐 수 있다) */
export const SHOP_SLOT = {
  hat: { name: '모자', big: 'dragon' }, neck: { name: '목 장식', big: 'dragon' }, breath: { name: '브레스 색', big: 'dragon' },
  aura: { name: '오라', big: 'dragon' }, pet: { name: '펫', big: 'dragon' },
  flag: { name: '깃발', big: 'castle' }, roof: { name: '지붕', big: 'castle' }, gate: { name: '정문', big: 'castle' }, yard: { name: '앞마당', big: 'castle' },
};
/** 등급 6단계 (테 색은 idg-shop.css 의 .r-<id> · stars = 카드 별 수 ★1 보통 ~ ★6 신화) */
export const RARITY = {
  common: { name: '보통', stars: 1 }, uncommon: { name: '고급', stars: 2 }, rare: { name: '희귀', stars: 3 },
  epic: { name: '영웅', stars: 4 }, legend: { name: '전설', stars: 5 }, myth: { name: '신화', stars: 6 },
};
const RID = { common: 'common', fine: 'uncommon', rare: 'rare', hero: 'epic', legend: 'legend', myth: 'myth' };

/** data/catalog.js — 처음 열 때 한 번 받는다(따로 묶음). 못 받으면 null */
let C = null, loading = null;
export const loadCatalog = () => loading || (loading = import('../games/iandragon_game/data/catalog.js').then((m) => (C = m)).catch(() => { loading = null; return null; }));
export const catalogReady = () => !!C;

/* ── 효과 한 줄 (lookFx 값에서 만든다) ── */
const pct = (v) => `${Math.round(v * 1000) / 10}`;
const KIND_TXT = { guard: '수호 불꽃 공격', charge: '브레스 충전', baseHp: '드래곤캐슬 체력' };
const BREATH_TXT = { slow: (v) => `느려짐 ${v}초`, vs: (v) => `유령 피해 +${pct(v)}%`, dmg: (v) => `브레스 피해 +${pct(v)}%`, bounty: (v) => `불씨 +${pct(v)}%` };
export function fxText(key) {
  const f = LOOK_FX[key];
  if (!f) return '기본 모양';
  const out = [];
  for (const k in f.fx) {
    if (k === 'range') out.push(`사거리 +${pct(f.fx[k])}%`);
    else if (BREATH_TXT[k]) out.push(BREATH_TXT[k](f.fx[k]));
    else out.push(`${KIND_TXT[k]} +${pct(f.fx[k])}%`);
  }
  return out.join(' · ');
}
/** 등급 번호 → 효과 크기(%) — 카드 설명용 */
export const tierPct = (star) => pct(TIER_PCT[star - 1] || 0);

const strip = (p) => (p && (p.coin > 0 || p.gem > 0) ? { ...(p.coin > 0 ? { coin: p.coin } : {}), ...(p.gem > 0 ? { gem: p.gem } : {}) } : null);
function toItem(row, g) {
  const view = C.itemView(row, g), shadow = view === 'shadow';
  const open = view === 'open' || view === 'owned';
  return {
    slot: row.slot, id: row.id, key: row.key, name: shadow ? '???' : row.name, rarity: RID[row.tier], star: row.star, view,
    price: strip(row.price), fx: shadow ? '' : fxText(row.key),
    lock: open ? null : { text: C.lockText(row, g) || '지금은 팔지 않아요' }, art: shadow ? '' : artOf(row.slot, row.id),
  };
}
/** 브레스 «기본 불꽃» — 목록에 없지만(늘 가짐) 칸에는 보인다 */
const basicBreath = () => ({ slot: 'breath', id: 'basic', key: 'breath:basic', name: LOOKS.breath[0].name, rarity: 'common', star: 1, view: 'owned', price: null, fx: '기본 모양', lock: null, art: artOf('breath', 'basic') });

/** 이 칸의 물건들 (이 계정에 보이는 것만 · 카탈로그 순서) */
export function itemsOf(slot, g) {
  if (!C) return [];
  const rows = C.visibleLooks(g).filter((r) => r.slot === slot).map((r) => toItem(r, g));
  return slot === 'breath' ? [basicBreath(), ...rows] : rows;
}
/** 이 열쇠의 물건 (없으면 null) */
export function itemByKey(key, g) { const r = C?.itemOf(key); return r ? toItem(r, g) : null; }

/** 가졌나 — 브레스 기본 불꽃은 늘 가짐 */
export const isOwned = (g, it) => (it.slot === 'breath' && it.id === 'basic') || (Array.isArray(g?.owned) && g.owned.includes(it.key));
export const owns = (g, slot, id) => isOwned(g, { slot, id, key: `${slot}:${id}` });
/** 지금 입고 있나 (look · clook 글자 기준) */
export const isWorn = (g, it) => isWornId(g, it.slot, it.id);
export { wearOf };

/**
 * 오늘의 특가 3개 — 열린 것 중 안 가진 것(dealCandidates)에서 «날짜 + 열쇠» 점수가 낮은 3개.
 * 같은 날이면 누구나 같은 순서로 고르고, 하나를 사도 나머지 둘은 그대로(빈 자리에 다음 것이 들어온다).
 */
export function dealsOf(day, g) {
  if (!C) return [];
  const score = (key) => { let h = 2166136261; for (const c of `idg-deal:${day}:${key}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
  return C.dealCandidates(g).map((k) => [k, score(k)]).sort((a, b) => a[1] - b[1] || (a[0] < b[0] ? -1 : 1)).slice(0, 3).map(([k]) => itemByKey(k, g)).filter(Boolean);
}
export { dealPrice };

/** 샵에서 살 수 있나 : 'buy'(살 수 있음) · 'locked'(조건 · 판매 안 함) · 'owned'(가짐) */
export function stateOf(g, it) {
  if (isOwned(g, it)) return 'owned';
  if (it.lock || !it.price) return 'locked';
  return 'buy';
}
/** 값을 낼 수 있나 (price: {coin, gem} — 둘 다 있으면 둘 다) */
export const canPay = (g, price) => (!price?.coin || (g?.coins || 0) >= price.coin) && (!price?.gem || (g?.gems || 0) >= price.gem);
/** 잠긴 카드 안내 한 줄 */
export const lockText = (it) => it.lock?.text || '지금은 팔지 않아요';
