/**
 * 샵 칸 «드래곤캐슬» — 10단계 (차례대로만 · 코인 + 젬 둘 다 · 기획서 §6.1)
 * 맨 위 = 내 드래곤캐슬 요약(체력 · 가호 · 장비 칸) · 아래 = 단계 카드. 모습 고르기는 꾸미기 창 몫.
 * 저장 : castle = { lv, skin, gear, slots } + coins · gems  (샀으면 skin 도 새 단계로 올려 바로 그 모습이 되게 한다)
 */
import { S, ICON, CASTLE_LV, CASTLE_GUARD_PER_LV, castleOf, worldsCleared, canPay, pay, commit, stepOf } from './_data.js';
import { panelRoot, note, row, list, buyBtn, plainBtn, statRow, lockLine, snd } from './_ui.js';

const MAX_HP = CASTLE_LV[CASTLE_LV.length - 1].hp, MAX_GUARD = CASTLE_GUARD_PER_LV * (CASTLE_LV.length - 1);

export default function render(box, ctx) {
  const done = () => { draw(); ctx.refresh?.(); };

  function buy(def) {
    const g = ctx.g, c = castleOf(g), st = stepOf(g, 'castle');
    if (!st || def.lv !== c.lv + 1) return;
    if (!canPay(g, st.cost)) { snd('sfx_denied'); ctx.toast?.(S.poor); return; }
    commit(ctx, { ...pay(g, st.cost), ...st.part });
    snd('sfx_purchase'); done();
  }

  const guard = (def) => CASTLE_GUARD_PER_LV * (def.lv - 1);
  const rows = (def) => [statRow(S.statHp, def.hp, MAX_HP, 'green', `+${def.hp}%`), statRow(S.statGuard, guard(def), MAX_GUARD, 'blue', `+${guard(def)}%`)];

  function stepCard(def, g, c) {
    const have = def.lv <= c.lv, next = def.lv === c.lv + 1, open = worldsCleared(g) >= def.world;
    let foot;
    if (have) foot = plainBtn(S.owned);
    else if (!next) foot = lockLine(S.lockPrev(def.lv - 1));
    else if (!open) foot = lockLine(S.lockWorld(def.world));
    else foot = buyBtn(def, { label: S.up, poor: !canPay(g, def), onClick: () => buy(def) });
    return row({ id: `c${def.lv}`, face: ICON.castle, name: def.name, l1: `${def.lv}단계`, l2: S.slots(def.slots), on: def.lv === c.lv, locked: !have && !(next && open), rows: rows(def), foot });
  }

  function draw() {
    const g = ctx.g, c = castleOf(g), cur = CASTLE_LV[c.lv - 1];
    const sum = list([row({ id: 'now', face: ICON.castle, name: S.curCastle, l1: `${c.lv}단계 · ${cur.name}`, l2: S.slots(cur.slots), on: true, rows: rows(cur) })]);
    sum.classList.add('one');
    panelRoot(box).append(note([S.castleNote]), sum, list(CASTLE_LV.slice(1).map((d) => stepCard(d, g, c))));
  }
  draw();
}
