/**
 * 꾸미기 창의 «물건 목록 · 코디 글자» (겜보조 2 · 11/13)
 *
 *  물건 목록 = shopCatalog.js(샵과 같은 어댑터 → data/catalog.js 184개 · 못 보는 계정은 신화 빠짐). 이 파일은 꾸미기 창용 모양과 코디 글자만 맡는다.
 *  입은 모습 글자(look · clook) = idgLookParts/wear.js. 코디 3칸 저장 = fits [{ look, clook } × 3] (IDG_UPGRADES_SPEC §1.2) —
 *  캐슬 모습(skin)은 코디 한 칸의 clook 끝에 's3' 으로 붙인다(모르는 머리글이라 다른 곳은 버리고 읽음).
 */
import { itemsOf, isOwned } from '../shopCatalog.js';
import { WORN, partsFor, wearOf } from './wear.js';
import { decodeWear } from '../../games/iandragon_game/data/lookFx.js';

export { WORN, wearOf };

/** 등급 6단계 : 색 테 + 별 수 (catalog.TIER_COLOR · 신화는 무지개 대신 분홍 + 이중 테 — idg-look2.css .r6) */
export const RARITY = [
  { n: '보통', c: '#9aa0a8' }, { n: '고급', c: '#5ac85a' }, { n: '희귀', c: '#4a9cff' },
  { n: '영웅', c: '#a86cff' }, { n: '전설', c: '#ff9a2e' }, { n: '신화', c: '#ff7ad0' },
];
export const stars = (r) => '★'.repeat(r);

/** 큰 칸 → 작은 칸 (id · 이름) */
export const DRAGON_TABS = [['dragon', '대장 드래곤'], ['hat', '모자'], ['neck', '목 장식'], ['breath', '브레스 색'], ['aura', '오라'], ['pet', '펫']];
export const CASTLE_TABS = [['skin', '캐슬 모습'], ['flag', '깃발'], ['roof', '지붕'], ['gate', '정문'], ['yard', '앞마당'], ['gear', '장비']];

/** 가졌나 */
export const owns = (g, slot, id) => isOwned(g, { slot, id, key: `${slot}:${id}` });

/** 이 칸의 물건 전부 — 격자 모양 { id, name, rarity(별 수), fx, lock, art, owned } · 살 수 있는 것 → 잠긴 것 순서(가진 것은 격자가 앞으로 뺀다) */
export function catalogFor(slot, g) {
  const rank = (it) => (it.view === 'open' || it.view === 'owned' ? 0 : 1);
  return itemsOf(slot, g).map((it, i) => [it, i]).sort((a, b) => rank(a[0]) - rank(b[0]) || a[1] - b[1])
    .map(([it]) => ({ slot, id: it.id, name: it.name, rarity: it.star, fx: it.fx, lock: it.lock?.text || '', art: it.art, owned: isOwned(g, it) }));
}

/* ── 코디 한 칸 ── */
const skinOf = (s) => { const m = /(?:^|\.)s(\d{1,2})(?:\.|$)/.exec(String(s || '')); return m ? Number(m[1]) : 0; };
/** 입은 모습 w + 그대로 둘 테두리 · 칭호 keep → { look, clook } (clook 끝에 캐슬 모습 번호) */
export function encodeOutfit(w, keep) {
  const p = partsFor(w, keep);
  return { look: p.look, clook: `${p.clook}.s${Number(w?.skin) || 0}` };
}
/** 코디 한 칸 → 입은 모습 · 가진 것만 남긴다(없는 것은 벗음). 비었거나 읽을 수 없으면 null */
export function decodeOutfit(fit, g, castleLv) {
  if (!fit || typeof fit !== 'object' || (!fit.look && !fit.clook)) return null;
  const raw = { ...decodeWear(fit.look), ...decodeWear(fit.clook) };
  const w = Object.fromEntries(WORN.map((s) => [s, raw[s] && owns(g, s, raw[s]) ? raw[s] : null]));
  const n = skinOf(fit.clook);
  w.skin = n >= 1 && n <= castleLv ? n : 0;
  return w;
}
