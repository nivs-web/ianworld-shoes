/**
 * 샵 칸 «브레스» — 브레스 힘 8단계 · 브레스 사거리 5단계 (기획서 §5.5)
 * 계정에 한 번 사면 모든 대장 드래곤에 적용. 사거리는 처음 60%에서 시작해 단계마다 +5%.
 * 저장 : breathUp = { pow, rng, old } + coins · gems
 */
import { el } from '../ui.js';
import { S, BREATH_POWER, BREATH_RANGE, breathUp, canPay, pay, commit, stepOf } from './_data.js';
import { panelRoot, note, row, list, line, fireFace, buyBtn, plainBtn, stepBar, snd } from './_ui.js';

const KINDS = [
  { key: 'pow', name: S.power, T: BREATH_POWER, icon: () => fireFace('orange'), pre: '지금 ',
    now: (n) => (n ? `+${BREATH_POWER.pct[n - 1]}%` : '지금 그대로'), nx: (n) => `+${BREATH_POWER.pct[n]}%` },
  { key: 'rng', name: S.range, T: BREATH_RANGE, icon: () => fireFace('green'), pre: '지금 ',
    now: (n) => `${BREATH_RANGE.base + (n ? BREATH_RANGE.pct[n - 1] : 0)}%`, nx: (n) => `${BREATH_RANGE.base + BREATH_RANGE.pct[n]}%` },
];

export default function render(box, ctx) {
  const done = () => { draw(); ctx.refresh?.(); };

  function buy(k) {
    const g = ctx.g, st = stepOf(g, k.key);
    if (!st) return;
    if (!canPay(g, st.cost)) { snd('sfx_denied'); ctx.toast?.(S.poor); return; }
    commit(ctx, { ...pay(g, st.cost), ...st.part });
    snd('sfx_purchase'); done();
  }

  function kindCard(k, g) {
    const n = breathUp(g)[k.key], max = k.T.pct.length, cost = n < max ? { coin: k.T.coin[n], gem: k.T.gem[n] } : null;
    const now = line([k.pre, el('b', k.now(n)), cost ? el('br') : null, cost ? el('span.nx', `${S.next} ${k.nx(n)}`) : null].filter(Boolean));
    return row({
      id: k.key, face: k.icon(), name: k.name, l1: `${n} / ${max} ${S.step}`, on: n > 0,
      rows: [stepBar(max, n, k.name), now, k.key === 'rng' ? line(S.rangeFoot) : null].filter(Boolean),
      foot: cost ? buyBtn(cost, { label: S.up, poor: !canPay(g, cost), onClick: () => buy(k) }) : plainBtn(S.maxed),
    });
  }

  function draw() {
    const g = ctx.g;
    panelRoot(box).append(note([S.breathNote]), list(KINDS.map((k) => kindCard(k, g))));
  }
  draw();
}
