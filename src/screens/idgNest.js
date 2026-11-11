/**
 * 좀비와 드래곤 — «용 둥지» (훈련소 · B4 일부 · 2026-11-11 야간)
 * 연 용 목록 · 레벨 · 코인으로 레벨업 (기획서 10장 ECON.lvCost) · 레벨 상한(ECON.capAt — 깬 스테이지에 따라 10 → 15 → 20).
 * 전투는 «저장 레벨»과 «권장 레벨» 중 큰 값으로 나가므로(결정 D1) 훈련하면 권장보다 세게 나간다.
 */
import { el, button, presentOverlay, toast } from './ui.js';
import * as G from '../services/iandragonGame.js';
import * as Sfx from '../audio/sfx.js';
import { UNITS } from '../games/iandragon_game/data/units.js';
import { ECON } from '../games/iandragon_game/data/econ.js';
import { unlockedBefore, makeLoads, stageByNo } from '../games/iandragon_game/render/battleSetup.js';

const capOf = (cleared) => ECON.capAt.reduce((c, [g, cap]) => (cleared >= g ? cap : c), 10);
const fmt = (n) => n.toLocaleString('en-US');

export function showNest(onChange) {
  Sfx.play('sfx_menu_select');
  const list = el('div.idg-nest-list'), coins = el('div.idg-nest-coins'), deckInfo = el('div.idg-nest-deck');
  function draw() {
    const g = G.idg(), cap = capOf(g.cleared);
    const un = unlockedBefore(g.cleared + 1);
    const ids = [...un.dragons, ...Object.keys(g.units).filter((id) => UNITS[id] && UNITS[id].rar !== 'story')];
    /* 덱 : 아직 안 골랐으면 다음 스테이지의 기준 덱에서 시작 */
    const deck = g.deck.length >= 2 ? g.deck : makeLoads(stageByNo(Math.min(50, g.cleared + 1)), g).deck.map((d) => d.id);
    deckInfo.textContent = `출전 ${deck.filter((id) => ids.includes(id)).length} / ${un.deckCap}칸 — «출전»을 눌러 덱을 바꿔요`;
    coins.textContent = `코인 ${fmt(g.coins)} · 레벨 상한 ${cap}`;
    list.replaceChildren(...ids.map((id) => {
      const lv = g.units[id]?.[0] || 1, cost = ECON.lvCost(lv), max = lv >= cap, poor = g.coins < cost;
      return el('div.idg-nest-row', null, [
        el('img.idg-nest-face', { src: `/assets/iandragon_game/ai/${id}/head.png`, alt: '' }),
        el('div.idg-nest-name', null, [el('b', UNITS[id].name + (g.units[id]?.[1] ? ` +${g.units[id][1]} (힘 +${2 * Math.min(10, g.units[id][1])}%)` : '')), el('span', `Lv ${lv}${lv >= 10 && UNITS[id].forms?.[1] ? ` · ${UNITS[id].forms[1].name}` : ''}`)]),
        el('button.idg-nest-go' + (deck.includes(id) ? '.on' : ''), {
          type: 'button',
          onclick: () => {
            const cur = deck.slice(); const i = cur.indexOf(id);
            if (i >= 0) { if (cur.length <= 2) return; cur.splice(i, 1); } else { if (cur.length >= un.deckCap) return; cur.push(id); }
            G.saveIdg({ deck: cur }); draw(); onChange?.();
          },
        }, [deck.includes(id) ? '출전' : '대기']),
        el('button.idg-nest-up', {
          type: 'button', disabled: max || poor,
          onclick: () => {
            const cur = G.idg(), now = cur.units[id]?.[0] || 1, c = ECON.lvCost(now);
            if (cur.coins < c || now >= capOf(cur.cleared)) return;
            G.saveIdg({ coins: cur.coins - c, units: { ...cur.units, [id]: [now + 1, cur.units[id]?.[1] || 0] } });
            import('../games/iandragon_game/audio/index.js').then((A) => { A.init(); A.play(now + 1 === 10 || now + 1 === 20 ? 'evolve' : 'levelup'); }).catch(() => Sfx.play('sfx_menu_select'));   // 레벨업 소리 · Lv10/20 = 진화 소리
            if (now + 1 === 10 || now + 1 === 20) toast(`${UNITS[id].name} 진화! — ${UNITS[id].forms?.[now + 1 === 10 ? 1 : 2]?.name || '새 모습'}`, 2600);
            draw(); onChange?.();
          },
        }, [max ? 'MAX' : `레벨업 ${fmt(cost)}`]),
      ]);
    }));
  }
  draw();
  const box = el('div.dialog.idg-nest', { onclick: (e) => e.stopPropagation() }, [
    el('div.idg-how-title', '용 둥지 (훈련소)'), coins, deckInfo,
    el('p.idg-nest-help', '코인으로 용을 키워요. Lv10이 되면 모습이 바뀌어요!'),
    list, button('닫기', () => close()),
  ]);
  const overlay = el('div.dialog-overlay', { onclick: () => close() }, [box]);
  const close = presentOverlay(overlay);
}
