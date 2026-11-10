/**
 * 좀비와 드래곤 — «도전 과제» 화면 (B6 · 2026-11-11 야간). 계산은 services/iandragonQuests.js.
 */
import { el, button, presentOverlay } from './ui.js';
import * as G from '../services/iandragonGame.js';
import * as Sfx from '../audio/sfx.js';
import { QUESTS, questState, claim } from '../services/iandragonQuests.js';

export function showQuests(onChange) {
  Sfx.play('sfx_menu_select');
  const list = el('div.idg-nest-list'), head = el('div.idg-nest-coins');
  function draw() {
    const g = G.idg();
    head.textContent = `젬 ${g.gems.toLocaleString('en-US')} · 받은 과제 ${QUESTS.filter((q) => questState(g, q).got).length} / ${QUESTS.length}`;
    list.replaceChildren(...QUESTS.map((q) => {
      const s = questState(g, q);
      return el('div.idg-nest-row' + (s.got ? '.got' : ''), null, [
        el('div.idg-nest-name', null, [el('b', q.name), el('span', `${s.now.toLocaleString('en-US')} / ${q.need.toLocaleString('en-US')} · 젬 ${q.gems}`),
          el('i.idg-q-bar', { style: `--p:${s.now / q.need}` })]),
        el('button.idg-nest-up', {
          type: 'button', disabled: !s.done || s.got,
          onclick: () => { const part = claim(G.idg(), q.i); if (!part) return; G.saveIdg(part); Sfx.play('sfx_menu_select'); draw(); onChange?.(); },
        }, [s.got ? '받음' : s.done ? `받기 +${q.gems}` : '진행 중']),
      ]);
    }));
  }
  draw();
  const box = el('div.dialog.idg-nest', { onclick: (e) => e.stopPropagation() }, [el('div.idg-how-title', '도전 과제'), head, list, button('닫기', () => close())]);
  const overlay = el('div.dialog-overlay', { onclick: () => close() }, [box]);
  const close = presentOverlay(overlay);
}
