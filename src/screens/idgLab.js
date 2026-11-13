/**
 * 좀비와 드래곤 — «연구소 · 보물 · 리더» (B4 · 2026-11-11 야간 · 기획서 10장)
 * 연구소 : 7항목, Lv n→n+1 코인 300×(n+1), 최대 Lv9, 상한 = 깬 월드 수.
 * 보물 : 월드마다 별 10 · 20 · 30 → 1 · 2 · 3단계 (저절로).
 * 리더 : «자동(월드 추천)» 또는 연 리더 중 하나 (결정 D8).
 * 전투 보너스 = 항목마다 «계산기 기준»과 «내 연구소 + 보물» 중 큰 값 (결정 D7 · battleSetup.bonusFor).
 */
import { el, button, presentOverlay } from './ui.js';
import * as G from '../services/iandragonGame.js';
import * as Sfx from '../audio/sfx.js';
import { LEADERS } from '../games/iandragon_game/data/leaders.js';
import { ECON } from '../games/iandragon_game/data/econ.js';
import { kitWallet, kitRow, kitPriceBtn, kitBtn, kitSection } from './idgKit.js';
import { xTitle } from './idgXwin.js';   /* UI 키트 (11/12 · docs/IDG_DESIGN_STYLESHEET.md) */
import { LAB, TREASURE, treasureLv, LAST_STAGE } from '../games/iandragon_game/render/battleSetup.js';

const AI = '/assets/iandragon_game/ai/';
const eff = (x, n, flat) => (flat || !x.pct && !x.per.toString().startsWith('0') ? `+${x.per * n}` : `+${Math.round(x.per * n * 100)}%`);

export function showLab(onChange) {
  Sfx.play('sfx_menu_select');
  const body = el('div.idg-lab-body'), wallet = kitWallet({});   /* «내 보유량» 지갑 판 */
  function draw() {
    const g = G.idg(), worlds = Math.floor(g.cleared / 10), cap = Math.min(ECON.labMax, worlds);
    wallet.update({ coins: g.coins, gems: g.gems });
    const lab = el('div.idg-lab-sec', null, [kitSection(`연구소 — 최대 Lv${cap} (깬 월드 수)`)]);
    LAB.forEach((L, i) => {
      const n = g.lab[i] || 0, cost = ECON.labCost(n), max = n >= cap;
      lab.appendChild(kitRow({ title: `${L.name} Lv${n}`, sub: n ? eff(L, n, !L.pct) : '아직 0',
        right: max ? kitBtn({ kind: 'purple', text: cap ? 'MAX' : '월드 1을 깬 뒤', size: 'sm', disabled: true }) : kitPriceBtn({
          coin: cost, label: '올리기', size: 'sm', poor: g.coins < cost,
          onClick: () => {
            const cur = G.idg(), now = cur.lab[i] || 0, c = ECON.labCost(now);
            if (cur.coins < c || now >= Math.min(ECON.labMax, Math.floor(cur.cleared / 10))) return;
            const next = cur.lab.slice(); next[i] = now + 1;
            G.saveIdg({ coins: cur.coins - c, lab: next }); Sfx.play('sfx_menu_select'); draw(); onChange?.();
          },
        }) }));
    });
    const tre = el('div.idg-lab-sec', null, [kitSection('보물 — 월드마다 별 10 · 20 · 30개')]);
    for (let w = 1; w <= LAST_STAGE / 10; w++) {
      let st = 0; for (let i = (w - 1) * 10; i < w * 10; i++) st += Number(g.stars[i]) || 0;
      const T = TREASURE[w - 1], n = treasureLv(g.stars, w);
      tre.appendChild(kitRow({ title: `월드 ${w} 보물`, hi: n >= 3, sub: `별 ${st}/30 · ${T.name} ${n ? eff(T, n, T.flat) : '+0'}`,
        right: el('span.idg-tre-steps', null, [10, 20, 30].map((t, i) => el('i' + (i < n ? '.on' : ''), null, [el('img', { src: '/assets/iandragon_game/ai/result/star_on.webp', alt: '별' }), String(t)]))) }));   /* ★ 글자 → 별 그림 */
    }
    const ld = el('div.idg-lab-sec', null, [kitSection('리더 (드래곤캐슬 위에서 브레스를 뿜어요)')]);
    const row = el('div.idg-leader-row');
    const pick = (id) => { G.saveIdg({ leader: id }); Sfx.play('sfx_menu_select'); draw(); onChange?.(); };
    row.appendChild(el('button.idg-leader' + (g.leader === 'auto' ? '.on' : ''), { type: 'button', onclick: () => pick('auto') }, [el('b', '자동'), el('span', '월드 추천')]));
    for (const [id, L] of Object.entries(LEADERS)) {
      if (L.unlock > worlds) continue;
      row.appendChild(el('button.idg-leader' + (g.leader === id ? '.on' : ''), { type: 'button', onclick: () => pick(id) }, [
        el('img', { src: `${AI}${id}/head.png`, alt: '' }), el('b', L.ko), el('span', L.line.slice(0, 14)),
      ]));
    }
    ld.appendChild(row);
    body.replaceChildren(lab, tre, ld);
  }
  draw();
  const box = el('div.dialog.idg-lab.idg-xw', { onclick: (e) => e.stopPropagation() }, [xTitle('연구소 · 보물 · 리더', () => close()), wallet, body]);
  const overlay = el('div.dialog-overlay', { onclick: () => close() }, [box]);
  const close = presentOverlay(overlay);
}
