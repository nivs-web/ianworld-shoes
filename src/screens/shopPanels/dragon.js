/**
 * 샵 칸 «드래곤» — 대장 드래곤 사기(코인 또는 젬) · 가진 드래곤 레벨업 Lv1 ~ 10 (기획서 §5.1 · 5.2)
 * 카드 순서 : 가진 것(레벨업이 여기 있다) → 살 수 있는 것 → 잠긴 것. 모양은 파워업 카드와 같다.
 * 저장 : lead = { own, lv } + coins · gems  (처음 살 때 «옛 계정이 열어 둔 드래곤»도 own 에 함께 적어 굳힌다)
 */
import { LEADERS } from '../../games/iandragon_game/data/leaders.js';
import { S, ICON, LEAD_SHOP, LEAD_ORDER, LEAD_MAX, leadUpCost, LEAD_FLAME_PER_LV, LEAD_AURA_PER_LV, leadOwn, leadLv, leadSave, worldsCleared, canPay, pay, commit, stepOf } from './_data.js';
import { kitBtn } from '../idgKit.js';
import { el } from '../ui.js';
import { formsOf } from '../shopCatalog.js';
import { panelRoot, note, row, list, line, buyBtn, plainBtn, statRow, lockLine, snd } from './_ui.js';

/**
 * @param {{look?:boolean, want?:()=>string, autoId?:()=>string, pick?:(id:string)=>void, goShop?:()=>void}} [opts]
 *   look = 꾸미기 창에서 쓰는 모습 : 사기 단추 대신 «대장 고르기»(가진 것 · 자동) + 안 가진 것은 «아이템샵에서 팔아요» + 샵 가기. 레벨업 단추는 그대로.
 *   want() = 지금 고른 대장('auto' 또는 id) · pick(id) = 고름(저장은 부르는 쪽) · 반환값 .redraw() = 부르는 쪽이 고른 뒤 다시 그릴 때
 */
export default function render(box, ctx, opts = {}) {
  const look = !!opts.look;
  const done = () => { draw(); ctx.refresh?.(); };

  function buy(id, cur) {
    const g = ctx.g, own = leadOwn(g), cost = { [cur]: LEAD_SHOP[id][cur] };
    if (own.includes(id)) return;
    if (!canPay(g, cost)) { snd('sfx_denied'); ctx.toast?.(S.poor); return; }
    commit(ctx, { ...pay(g, cost), lead: { ...leadSave(g), own: [...own, id] } });
    snd('sfx_purchase'); done();
  }

  function levelUp(id) {
    const g = ctx.g, st = stepOf(g, 'lead', id);
    if (!st) return;
    if (!canPay(g, st.cost)) { snd('sfx_denied'); ctx.toast?.(S.poor); return; }
    commit(ctx, { ...pay(g, st.cost), ...st.part });
    snd('sfx_purchase'); done();
  }

  const isLead = (id, g) => (look ? opts.want() === id : g.leader === id);
  const pickable = (c, id) => {   /* 꾸미기 창 : 카드를 누르면 대장으로 (레벨업 단추는 stopPropagation) */
    c.classList.add('pick'); c.tabIndex = 0; c.setAttribute('role', 'button');
    const go = () => { snd('sfx_menu_select'); opts.pick?.(id); };
    c.onclick = go; c.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } };
    return c;
  };

  function autoCard(g) {
    const on = opts.want() === 'auto', id = opts.autoId?.() || 'novart';
    return pickable(row({ id: 'auto', face: ICON.face(id), name: S.auto, l1: S.autoSub, tag: on ? S.lead : null, on, rows: [line(`${S.autoNow} ${LEADERS[id]?.ko || id}`)] }), 'auto');
  }

  /* 꾸미기 «대장» 줄 : 변신 모습 고르기 — 기본 · 붉은 · 보라 동그라미 (그림이 오기 전 색 점) · 안 가진 것은 자물쇠 */
  function formDots(id, g) {
    const fs = formsOf(id, g);
    if (!fs.length) return null;
    const cur = g?.lead?.form?.[id] || '';
    const pick = (kind) => {
      const lead = leadSave(g), form = { ...lead.form };
      if (kind) form[id] = kind; else delete form[id];
      snd('sfx_menu_select'); commit(ctx, { lead: { ...lead, form } }); draw();
    };
    const dot = (kind, name, own) => el(`button.idg-sp-form.${kind || 'base'}${(cur || '') === (kind || '') ? '.on' : ''}${own ? '' : '.off'}`, {
      type: 'button', disabled: !own, 'aria-label': name, 'aria-pressed': (cur || '') === (kind || '') ? 'true' : 'false', title: own ? name : `${name} (잠김)`,
      onclick: (e) => { e.stopPropagation(); if (own) pick(kind); },
    }, [own ? null : el('img', { src: ICON.lock, alt: '', draggable: 'false' })]);
    return el('div.idg-sp-forms', null, [el('span', S.form), dot('', S.formBase, true), ...fs.map((f) => dot(f.kind, f.name, f.own))]);
  }

  function ownedCard(id, g) {
    const L = LEADERS[id], lv = leadLv(g, id), cost = leadUpCost(lv), flame = LEAD_FLAME_PER_LV * (lv - 1), aura = LEAD_AURA_PER_LV * (lv - 1);
    const c = row({
      id, face: ICON.face(id), name: L.ko, l1: `Lv ${lv}`, tag: isLead(id, g) ? S.lead : null, on: isLead(id, g),
      rows: [statRow(S.statFlame, flame, LEAD_FLAME_PER_LV * (LEAD_MAX - 1), 'orange', `+${flame}%`), statRow(S.statAura, aura, LEAD_AURA_PER_LV * (LEAD_MAX - 1), 'blue', `+${aura}%`)],
      foot: [lv >= LEAD_MAX ? plainBtn(S.max) : buyBtn(cost, { label: S.lvUp, poor: !canPay(g, cost), onClick: () => levelUp(id) }), look ? formDots(id, g) : null].filter(Boolean),
    });
    return look ? pickable(c, id) : c;
  }

  function shopCard(id, g, open) {
    const L = LEADERS[id], s = LEAD_SHOP[id];
    return row({
      id, face: ICON.face(id), name: L.ko, locked: look || !open,
      rows: open && !look ? [line(L.line)] : [],
      foot: look ? [lockLine(S.sells), kitBtn({ kind: 'purple', size: 'sm', text: S.goShop, onClick: (e) => { e.stopPropagation(); opts.goShop?.(); } })]
        : open
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
      ...(look ? [] : [note([S.leadNote, S.leadNote2])]),
      list([...(look ? [autoCard(g)] : []), ...owned.map((id) => ownedCard(id, g)), ...buyable.map((id) => shopCard(id, g, true)), ...locked.map((id) => shopCard(id, g, false))]),
    );
  }
  draw();
  return { redraw: draw };
}
