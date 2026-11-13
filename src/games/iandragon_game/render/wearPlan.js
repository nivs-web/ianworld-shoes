/**
 * 좀비와 드래곤 — 꾸미기 착용 «계획» (표 읽기 · 폭 · 자리 계산) — Pixi 없이 쓰는 부분 (겜보조 1 · 2026-11-13)
 * 그리는 쪽 : 전투 · 로비 · 꾸미기 창(Pixi) = wearKit.js · 2D 그림(idgDressed) = 이 계획을 그대로 캔버스에 그린다.
 * 표 : ai/meta/wear_anchor.json (드래곤별 head · neck · back 점 + size) · ai/meta/wear_items.json (물건별 w · anchor · layer · cover)
 */

const BASE = '/assets/iandragon_game/';
let tabP = null;
/** 표 두 장 { A: 드래곤 표, I: 물건 표 } — 한 번만 받는다 (실패하면 null · 다음에 다시) */
export function wearTables() {
  if (!tabP) {
    tabP = Promise.all([fetch(`${BASE}ai/meta/wear_anchor.json`).then((r) => r.json()), fetch(`${BASE}ai/meta/wear_items.json`).then((r) => r.json())]).then(([A, I]) => ({ A, I }));
    tabP.catch(() => { tabP = null; });
  }
  return tabP.catch(() => null);
}

/** 물건 폭(칸) — tools/idg-wear-bake.mjs 와 같은 식 */
export function wearWidth(it, D, sizes) {
  const base = it.slot === 'hat' ? (D.head.w ?? sizes[D.size].head) : it.layer === 'back' ? D.back.w : D.neck.w;
  return Math.max(2, Math.round(it.w * base));
}

/**
 * 이 드래곤이 이 꾸미기(lk = decodeLook 결과)를 쓴 모습 계획
 *  hat  = { file, ax, ay, x, y, heads }  x · y = 머리 부품 기준 붙는 점 · ax · ay = 그림 안 붙는 점 비율 · heads = 덮는 모자일 때 «모자용 머리» 그림 {부품이름: 주소}
 *  neck = { file, ax, ay, x, y, layer } x · y = 몸통 부품 기준 · layer 'front'(몸통 앞) | 'back'(몸통 뒤)
 */
export function wearPlan(art, lk, T) {
  const D = T?.A?.dragons?.[art], out = {};
  if (!D || !lk) return out;
  const part = (it, id, pt) => ({ file: `ai/meta/wear/fit/${id}_${wearWidth(it, D, T.A.sizes)}.png`, ax: it.anchor[0], ay: it.anchor[1], x: pt.x + (it.dx || 0), y: pt.y + (it.dy || 0) });
  const hid = lk.hat && 'hat_' + lk.hat, hi = hid && T.I.items[hid];
  if (hi) {
    out.hat = part(hi, hid, D.head);
    out.hat.heads = hi.cover && D.cover ? { head: `${D.cover}.png`, head_blink: `${D.cover}_blink.png`, head_breath: `${D.cover}_breath.png` } : null;
  }
  const nid = lk.neck && 'neck_' + lk.neck, ni = nid && T.I.items[nid];
  if (ni) { out.neck = part(ni, nid, ni.layer === 'back' ? D.back : D.neck); out.neck.layer = ni.layer === 'back' ? 'back' : 'front'; }
  return out;
}
