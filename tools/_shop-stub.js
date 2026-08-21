/**
 * `services/profile.js` 대역 — 아이템 쇼핑 미리보기·검사용. (2026-08-21 26차)
 *
 * 진짜 `ItemShop.js` 를 한 줄도 안 바꾸고 띄우기 위한 것이다.
 * `?shoes=N` 으로 지갑을, `?own=a,b` 로 이미 산 것을, `?wear=a` 로 입은 것을 만든다.
 */
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
export function buyItem(id, cost) {
  if (P.shoesOwned < cost) return { ok: false, profile: P };
  P = { ...P, shoesOwned: P.shoesOwned - cost, ownedItems: { ...P.ownedItems, [id]: true } };
  return { ok: true, profile: P };
}
export function equipItem(slot, id) {
  const cur = { ...P.equippedItems };
  if (!id || cur[slot] === id) delete cur[slot]; else cur[slot] = id;
  P = { ...P, equippedItems: cur };
  return P;
}
