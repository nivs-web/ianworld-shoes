/**
 * 좀비와 드래곤 — 아이템샵 입구 (11/13 · 겜보조 1)
 * 샵 화면 본체(idgShopView.js · shopCatalog.js · 패널들)는 **처음 열 때만** 받는다 — 로비 첫 묶음에 붙지 않게 얇은 문만 둔다.
 * showShop({ idg, save, onClose }) — idg = 지금 저장값(G.idg() 결과), save(part) = 저장 후 새 idg 를 돌려주는 함수(G.saveIdg).
 */
export function showShop(opts) {
  return import('./idgShopView.js').then((m) => m.showShop(opts));
}
