/**
 * 좀비와 드래곤 — «도전 과제» 화면 (B6 · 2026-11-11 야간). 계산은 services/iandragonQuests.js.
 */
import { el, button, presentOverlay } from './ui.js';
import * as G from '../services/iandragonGame.js';
import * as Sfx from '../audio/sfx.js';
import { kitWallet, kitRow, kitPriceBtn, kitBtn, kitGem } from './idgKit.js';   /* UI 키트 (11/12 · docs/IDG_DESIGN_STYLESHEET.md) */
import { QUESTS, questState, claim } from '../services/iandragonQuests.js';

export function showQuests(onChange) {
  Sfx.play('sfx_menu_select');
  const list = el('div.idg-nest-list'), head = kitWallet({}), done = el('p.idg-q-count');
  function draw() {
    const g = G.idg();
    head.update({ coins: g.coins, gems: g.gems });
    done.textContent = `받은 과제 ${QUESTS.filter((q) => questState(g, q).got).length} / ${QUESTS.length}`;
    list.replaceChildren(...QUESTS.map((q) => {
      const s = questState(g, q);
      /* 키트 목록 줄 : 이름 / 진행 숫자 · 보상(젬 그림+숫자) · 진행 막대 — 받기 = 초록 가격 단추 · 진행 중 / 받음 = 보라 */
      const row = kitRow({ title: q.name, hi: s.done && !s.got,
        sub: el('span.idg-q-sub', null, [`${s.now.toLocaleString('en-US')} / ${q.need.toLocaleString('en-US')} · 보상 `, kitGem(q.gems), el('i.idg-q-bar', { style: `--p:${Math.min(1, s.now / q.need)}` })]),
        right: s.done && !s.got ? kitPriceBtn({ gem: q.gems, label: '받기', size: 'sm', onClick: () => { const part = claim(G.idg(), q.i); if (!part) return; G.saveIdg(part); Sfx.play('sfx_menu_select'); draw(); onChange?.(); } })
          : kitBtn({ kind: 'purple', text: s.got ? '받음' : '진행 중', size: 'sm', disabled: true }) });
      if (s.got) row.classList.add('got');
      return row;
    }));
  }
  draw();
  const box = el('div.dialog.idg-nest', { onclick: (e) => e.stopPropagation() }, [el('div.idg-how-title', '도전과제'), el('div.idg-q-head', null, [head, done]), list, button('닫기', () => close())]);
  const overlay = el('div.dialog-overlay', { onclick: () => close() }, [box]);
  const close = presentOverlay(overlay);
}
