/**
 * 입은 모습 글자 — 샵(바로 입기) · 꾸미기 창이 같이 쓰는 읽기 · 쓰기 (겜보조 2 · 11/13 · IDG_UPGRADES_SPEC §1 · §9)
 *
 *  look  = 'h3.n1.b2.a4.p2.f4.r0.t7' — 드래곤 쪽(모자 · 목 · 브레스 · 오라 · 펫) + 깃발 + 테두리 · 칭호   (80자 안)
 *  clook = 'o2.g1.y3'               — 드래곤캐슬 꾸미기(지붕 · 정문 · 앞마당). 깃발은 옛 저장과 맞게 look 의 f.
 *  번호 = lookFx.SLOT_IDS[칸] 순서 + 1 (0 = 없음). 앞 26개는 옛 looks.js 와 같은 번호라 옛 저장 · 옛 그리기가 그대로 읽는다.
 *  테두리 · 칭호는 꾸미기 창이 건드리지 않는다 — 읽은 값을 그대로 다시 적는다(looks.js 번호).
 *  모르는 머리글 · 번호는 버린다(decodeWear).
 */
import { decodeWear, LETTER, SLOT_IDS } from '../../games/iandragon_game/data/lookFx.js';
import { decodeLook, encodeLook } from '../../games/iandragon_game/data/looks.js';

/** look 에 들어가는 칸 · clook 에 들어가는 칸 · 둘 합친 «입는 칸» */
export const LOOK_PARTS = ['hat', 'neck', 'breath', 'aura', 'pet', 'flag'];
export const CLOOK_PARTS = ['roof', 'gate', 'yard'];
export const WORN = [...LOOK_PARTS, ...CLOOK_PARTS];

const num = (slot, id) => (id ? SLOT_IDS[slot].indexOf(id) + 1 : 0);

/** 저장값 → { hat, neck, breath, aura, pet, flag, roof, gate, yard } (id | null) */
export function wearOf(g) {
  const w = { ...decodeWear(g?.look), ...decodeWear(g?.clook) };
  return Object.fromEntries(WORN.map((s) => [s, w[s] || null]));
}
/** 테두리 · 칭호 (그대로 두는 값) */
export const keepOf = (g) => { const d = decodeLook(g?.look); return { frame: d.frame, title: d.title }; };

/** 입은 모습 w + 그대로 둘 값 keep → 저장할 { look, clook } */
export function partsFor(w, keep = {}) {
  const rt = encodeLook({ frame: keep.frame, title: keep.title }).split('.').slice(4);   // ['r2', 't3']
  const look = [...LOOK_PARTS.map((s) => `${LETTER[s]}${num(s, w?.[s])}`), ...rt].join('.');
  const clook = CLOOK_PARTS.map((s) => `${LETTER[s]}${num(s, w?.[s])}`).join('.');
  return { look, clook };
}

/** 샵 «바로 입기» : 이 물건 하나만 바꿔 입은 모습 저장 part */
export const wearPart = (g, slot, id) => partsFor({ ...wearOf(g), [slot]: id }, keepOf(g));
/** 지금 입고 있나 */
export const isWornId = (g, slot, id) => wearOf(g)[slot] === id;
