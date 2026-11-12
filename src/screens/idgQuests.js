/**
 * 좀비와 드래곤 — «도전 과제» 화면 (B6 · 2026-11-11 야간). 계산은 services/iandragonQuests.js.
 *
 * 11/12 서브창2 (대표님 «받기를 누르면 목록이 맨 위로 올라가서 또 내려야 한다 — 무한 반복»)
 *  - 받기 뒤 창을 통째로 다시 그리지 않는다 : 그 줄만 «받음» 줄로 바꿔 목록 맨 아래로 옮기고, 스크롤 칸의 scrollTop 은 그대로 (kitKeepScroll)
 *    → 받을 과제가 위에 모여 있으니 다음 «받기» 가 같은 자리로 올라온다
 *  - 정렬 : 받을 수 있음 → 진행 중 → 받음 (같은 묶음 안은 원래 순서)
 *  - 받을 게 2개 이상이면 위에 «모두 받기 (젬 그림 + 합계)» 초록 단추
 *  - 진행 막대 = 키트 픽셀 게이지 (kitGauge)
 */
import { el, button, presentOverlay } from './ui.js';
import * as G from '../services/iandragonGame.js';
import * as Sfx from '../audio/sfx.js';
import { kitWallet, kitRow, kitPriceBtn, kitBtn, kitGem, kitGauge, kitKeepScroll } from './idgKit.js';   /* UI 키트 (11/12 · docs/IDG_DESIGN_STYLESHEET.md) */
import { QUESTS, questState, claim } from '../services/iandragonQuests.js';

const fmt = (n) => n.toLocaleString('en-US');
const rank = (s) => (s.done && !s.got ? 0 : s.got ? 2 : 1);

export function showQuests(onChange) {
  Sfx.play('sfx_menu_select');
  const list = el('div.idg-nest-list.idg-q-list'), head = kitWallet({}), done = el('p.idg-q-count'), allBox = el('div.idg-q-all');

  /* 한 줄 : 이름 / 진행 숫자 · 보상(젬 그림+숫자) · 게이지 — 받기 = 초록 가격 단추 · 진행 중 / 받음 = 보라 */
  function makeRow(q, s) {
    const can = s.done && !s.got;
    const row = kitRow({ title: q.name, hi: can,
      sub: el('span.idg-q-sub', null, [`${fmt(s.now)} / ${fmt(q.need)} · 보상 `, kitGem(q.gems), kitGauge({ value: s.now, max: q.need, color: s.done ? 'green' : 'gold', size: 'sm', label: `${q.name} 진행` })]),
      right: can ? kitPriceBtn({ gem: q.gems, label: '받기', size: 'sm', onClick: () => takeOne(q) })
        : kitBtn({ kind: 'purple', text: s.got ? '받음' : '진행 중', size: 'sm', disabled: true }) });
    row.dataset.q = String(q.i);
    if (s.got) row.classList.add('got');
    return row;
  }
  /* 위 머리 : 지갑 · 받은 수 · «모두 받기» */
  function drawHead() {
    const g = G.idg();
    head.update({ coins: g.coins, gems: g.gems });
    done.textContent = `받은 과제 ${QUESTS.filter((q) => questState(g, q).got).length} / ${QUESTS.length}`;
    const can = QUESTS.filter((q) => { const s = questState(g, q); return s.done && !s.got; });
    allBox.replaceChildren(...(can.length >= 2 ? [kitPriceBtn({ gem: can.reduce((a, q) => a + q.gems, 0), label: `모두 받기 (${can.length}개)`, wide: true, onClick: takeAll })] : []));
    allBox.hidden = can.length < 2;
  }
  /* 받은 줄들만 바꾼다 : 옛 줄을 빼고 «받음» 줄을 맨 아래에 (스크롤 그대로) */
  function afterTake(qs) {
    kitKeepScroll(list, () => {
      const g = G.idg();
      for (const q of qs) { list.querySelector(`[data-q="${q.i}"]`)?.remove(); list.append(makeRow(q, questState(g, q))); }
      drawHead();
    });
    Sfx.play('sfx_purchase');
    onChange?.();
  }
  function takeOne(q) {
    const part = claim(G.idg(), q.i); if (!part) return;
    G.saveIdg(part); afterTake([q]);
  }
  function takeAll() {
    let g = G.idg(); const got = [];
    for (const q of QUESTS) { const part = claim(g, q.i); if (part) { g = { ...g, ...part }; got.push(q); } }
    if (!got.length) return;
    G.saveIdg({ gems: g.gems, quests: g.quests }); afterTake(got);
  }
  function drawAll() {
    const g = G.idg();
    const rows = QUESTS.map((q) => [q, questState(g, q)]).sort((a, b) => rank(a[1]) - rank(b[1]) || a[0].i - b[0].i);
    list.replaceChildren(...rows.map(([q, s]) => makeRow(q, s)));
    drawHead();
  }
  drawAll();
  const box = el('div.dialog.idg-nest.idg-quests', { onclick: (e) => e.stopPropagation() }, [el('div.idg-how-title', '도전과제'), el('div.idg-q-head', null, [head, done, allBox]), list, button('닫기', () => close())]);
  const overlay = el('div.dialog-overlay', { onclick: () => close() }, [box]);
  const close = presentOverlay(overlay);
}
