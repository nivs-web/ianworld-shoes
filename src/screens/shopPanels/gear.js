/**
 * 샵 칸 «장비» — 드래곤캐슬 장비 4종 Lv1 ~ 5 (처음 사기 = Lv1 · 이후 강화 · 기획서 §6.2)
 * 칸 수만큼 끼우기는 꾸미기 창 몫 → 여기는 사기 · 강화만, 끼우러 가는 단추는 ctx.openLook('gear').
 * 저장 : castle.gear = { cannon: n, … } + coins · gems  (castle 의 다른 값은 그대로 둔다)
 */
import { el } from '../ui.js';
import { kitBtn } from '../idgKit.js';
import { S, ICON, GEAR, GEAR_MAX, GEAR_COST, CASTLE_LV, castleOf, gearLv, canPay, pay, commit, stepOf } from './_data.js';
import { panelRoot, note, row, list, line, buyBtn, plainBtn, stepBar, snd } from './_ui.js';

export default function render(box, ctx) {
  const done = () => { draw(); ctx.refresh?.(); };

  function buy(id) {
    const g = ctx.g, st = stepOf(g, 'gear', id);
    if (!st) return;
    if (!canPay(g, st.cost)) { snd('sfx_denied'); ctx.toast?.(S.poor); return; }
    commit(ctx, { ...pay(g, st.cost), ...st.part });
    snd('sfx_purchase'); done();
  }

  function gearCard(def, g) {
    const lv = gearLv(g, def.id), cost = lv < GEAR_MAX ? GEAR_COST[lv] : null;
    const now = line([lv ? el('b', def.line(lv)) : def.line(1)]);   /* 줄 높이를 아끼려고 «다음 단계» 글은 뺐다 */
    return row({
      id: def.id, face: ICON.gear[def.id], name: def.name, l1: S.gearLv(lv), l2: def.place, on: lv > 0,
      rows: [stepBar(GEAR_MAX, lv, def.name), now],
      foot: cost ? buyBtn(cost, { label: lv ? S.enhance : S.buy, poor: !canPay(g, cost), onClick: () => buy(def.id) }) : plainBtn(S.maxed),
    });
  }

  function draw() {
    const g = ctx.g, slots = CASTLE_LV[castleOf(g).lv - 1].slots;
    const go = kitBtn({ kind: 'purple', size: 'sm', text: S.gearGo, cls: 'idg-sp-go', onClick: () => ctx.openLook?.('gear') });
    panelRoot(box).append(note([S.gearNote(slots)]), go, list(GEAR.map((d) => gearCard(d, g))));
  }
  draw();
}
