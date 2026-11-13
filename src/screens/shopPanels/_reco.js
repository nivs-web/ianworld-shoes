/**
 * 샵 맨 위 «추천 강화» 한 장 (겜보조 2 · 11/13 · IDG_UPGRADES_SPEC §14 — upgrades.recommendNext)
 *  지금 진행에서 권장표에 모자란 것 중 맨 앞 하나 → [그림] 추천 강화 / 이름 · 단계 / [올리기 + 값]. 누르면 바로 올린다.
 *  살 수 없는 것(월드 조건 · 장비 칸 없음)은 recommendNext 가 건너뛴다. 다 갖췄으면 null(카드 없음).
 */
import { el } from '../ui.js';
import { LEADERS } from '../../games/iandragon_game/data/leaders.js';
import { recommendNext } from '../../games/iandragon_game/data/upgrades.js';
import { S, ICON, GEAR, CASTLE_LV, canPay, pay, commit, stepOf } from './_data.js';
import { buyBtn, fireFace, snd } from './_ui.js';

function describe(r) {
  if (r.kind === 'rng') return { name: S.range, sub: `${r.to}${S.step}`, face: fireFace('green') };
  if (r.kind === 'pow') return { name: S.power, sub: `${r.to}${S.step}`, face: fireFace('orange') };
  if (r.kind === 'castle') return { name: CASTLE_LV[r.to - 1].name, sub: `${r.to}${S.step}`, face: el('img', { src: ICON.castle, alt: '', draggable: 'false' }) };
  if (r.kind === 'lead') return { name: LEADERS[r.id]?.ko || r.id, sub: `Lv ${r.to}`, face: el('img', { src: ICON.face(r.id), alt: '', draggable: 'false' }) };
  const d = GEAR.find((x) => x.id === r.id);
  return { name: d?.name || r.id, sub: `Lv ${r.to}`, face: el('img', { src: ICON.gear[r.id], alt: '', draggable: 'false' }) };
}

/** @param {{g:any, save:Function, toast?:Function}} ctx  @param {{onBought?:()=>void}} [o] @returns {HTMLElement|null} */
export function recoCard(ctx, o = {}) {
  const g = ctx.g, r = recommendNext(g, g.leader && g.leader !== 'auto' ? g.leader : undefined);
  if (!r || !r.cost) return null;
  const d = describe(r), poor = !canPay(g, r.cost);
  const buy = () => {
    const st = stepOf(ctx.g, r.kind, r.id);
    if (!st || !canPay(ctx.g, st.cost)) { snd('sfx_denied'); ctx.toast?.(S.poor); return; }
    commit(ctx, { ...pay(ctx.g, st.cost), ...st.part });
    snd('sfx_purchase'); o.onBought?.();
  };
  d.face.classList.add('idg-sp-reco-face');
  return el('div.idg-sp-reco', { role: 'group', 'aria-label': `${S.reco} ${d.name} ${d.sub}` }, [
    d.face,
    el('div.idg-sp-reco-txt', null, [el('small', S.reco), el('b', d.name), el('span', d.sub)]),
    buyBtn(r.cost, { label: S.up, poor, onClick: buy }),
  ]);
}
