/**
 * 샵 칸 «드래곤» — 대장 드래곤 사기(코인 또는 젬) · 가진 드래곤 레벨업 Lv1 ~ 10 (기획서 §5.1 · 5.2)
 * 카드 순서 : 가진 것(레벨업이 여기 있다) → 살 수 있는 것 → 잠긴 것. 모양은 파워업 카드와 같다.
 * 저장 : lead = { own, lv } + coins · gems  (처음 살 때 «옛 계정이 열어 둔 드래곤»도 own 에 함께 적어 굳힌다)
 */
import { LEADERS } from '../../games/iandragon_game/data/leaders.js';
import { S, ICON, LEAD_SHOP, LEAD_ORDER, LEAD_MAX, LEAD_LV_COST, LEAD_FLAME_PER_LV, LEAD_AURA_PER_LV, leadOwn, leadLv, worldsCleared, canPay, pay, commit } from './_data.js';
import { panelRoot, note, card, list, line, buyBtn, plainBtn, statRow, lockLine, snd } from './_ui.js';

export default function render(box, ctx) {
  const done = () => { draw(); ctx.refresh?.(); };

  function buy(id, cur) {
    const g = ctx.g, own = leadOwn(g), cost = { [cur]: LEAD_SHOP[id][cur] };
    if (own.includes(id)) return;
    if (!canPay(g, cost)) { snd('sfx_denied'); ctx.toast?.(S.poor); return; }
    commit(ctx, { ...pay(g, cost), lead: { ...(g.lead || {}), own: [...own, id], lv: { ...(g.lead?.lv || {}) } } });
    snd('sfx_purchase'); done();
  }

  function levelUp(id) {
    const g = ctx.g, lv = leadLv(g, id), cost = LEAD_LV_COST[lv + 1];
    if (lv >= LEAD_MAX || !cost) return;
    if (!canPay(g, cost)) { snd('sfx_denied'); ctx.toast?.(S.poor); return; }
    commit(ctx, { ...pay(g, cost), lead: { ...(g.lead || {}), own: leadOwn(g), lv: { ...(g.lead?.lv || {}), [id]: lv + 1 } } });
    snd('sfx_purchase'); done();
  }

  function ownedCard(id, g) {
    const L = LEADERS[id], lv = leadLv(g, id), cost = LEAD_LV_COST[lv + 1], flame = LEAD_FLAME_PER_LV * (lv - 1), aura = LEAD_AURA_PER_LV * (lv - 1);
    return card({
      id, face: ICON.face(id), name: L.ko, l1: `Lv ${lv}`, tag: g.leader === id ? S.lead : null, on: g.leader === id,
      rows: [statRow(S.statFlame, flame, LEAD_FLAME_PER_LV * (LEAD_MAX - 1), 'orange', `+${flame}%`), statRow(S.statAura, aura, LEAD_AURA_PER_LV * (LEAD_MAX - 1), 'blue', `+${aura}%`)],
      foot: lv >= LEAD_MAX ? plainBtn(S.max) : buyBtn(cost, { label: S.lvUp, poor: !canPay(g, cost), onClick: () => levelUp(id) }),
    });
  }

  function shopCard(id, g, open) {
    const L = LEADERS[id], s = LEAD_SHOP[id];
    return card({
      id, face: ICON.face(id), name: L.ko, locked: !open,
      rows: [line(L.line)],
      foot: open
        ? [buyBtn({ coin: s.coin }, { label: S.buy, poor: g.coins < s.coin, onClick: () => buy(id, 'coin') }), buyBtn({ gem: s.gem }, { label: S.buy, poor: g.gems < s.gem, onClick: () => buy(id, 'gem') })]
        : lockLine(S.lockWorld(s.world)),
    });
  }

  function draw() {
    const g = ctx.g, own = leadOwn(g), open = worldsCleared(g);
    const owned = LEAD_ORDER.filter((id) => own.includes(id) && LEADERS[id]);
    const rest = LEAD_ORDER.filter((id) => !own.includes(id) && LEAD_SHOP[id] && LEADERS[id]);
    const buyable = rest.filter((id) => LEAD_SHOP[id].world <= open), locked = rest.filter((id) => LEAD_SHOP[id].world > open);
    panelRoot(box).append(
      note([S.leadNote, S.leadNote2]),
      list([...owned.map((id) => ownedCard(id, g)), ...buyable.map((id) => shopCard(id, g, true)), ...locked.map((id) => shopCard(id, g, false))]),
    );
  }
  draw();
}
