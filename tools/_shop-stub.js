/**
 * `services/profile.js` 대역 — 아이템 쇼핑 미리보기·검사용. (2026-08-21 26차)
 *
 * 진짜 `ItemShop.js` 를 한 줄도 안 바꾸고 띄우기 위한 것이다.
 * `?shoes=N` 으로 지갑을, `?own=a,b` 로 이미 산 것을, `?wear=a` 로 입은 것을 만든다.
 */
import { itemById } from '/src/data/items.js';
import { priceOf } from '/src/config/easterEgg.js';

const q = new URLSearchParams(location.search);
const own = {};
for (const id of (q.get('own') ?? '').split(',').filter(Boolean)) own[id] = true;
const wear = {};
for (const id of (q.get('wear') ?? '').split(',').filter(Boolean)) {
  wear[id.startsWith('wing') ? 'wing' : id.startsWith('pet') ? 'pet' : 'hat'] = id;
}

let P = {
  uid: 'me', nickname: '이안', selectedCharacter: q.get('char') ?? 'ian',
  shoesOwned: Number(q.get('shoes') ?? 12000),
  ownedItems: own, equippedItems: wear,
};

export function get() { return P; }
/**
 * ★ **값은 화면이 넘기지 않는다** (2026-08-21 32차). 진짜 `storageLocal.buyItem` 과 똑같이
 * id 만 받아 표(`priceOf`)에게 값을 묻는다 — 대역이 옛 서명을 들고 있으면 화면을 고쳐
 * 놓고도 검사만 통과하는 상태가 된다.
 */
export function buyItem(id) {
  const item = itemById(id);
  if (!item) return { ok: false, profile: P, cost: 0 };
  const cost = priceOf(item);
  if (P.shoesOwned < cost) return { ok: false, profile: P, cost };
  P = { ...P, shoesOwned: P.shoesOwned - cost, ownedItems: { ...P.ownedItems, [id]: true } };
  return { ok: true, profile: P, cost };
}
export function equipItem(slot, id) {
  const cur = { ...P.equippedItems };
  if (!id || cur[slot] === id) delete cur[slot]; else cur[slot] = id;
  P = { ...P, equippedItems: cur };
  return P;
}

/** 모두 벗기 — 벗은 개수를 돌려준다(0이면 화면이 "착용한 아이템이 없습니다"를 띄운다) */
export function unequipAll() {
  const off = Object.values(P.equippedItems).filter(Boolean).length;
  if (off) P = { ...P, equippedItems: {} };
  return { off, profile: P };
}
