/**
 * 좀비와 드래곤 — «연구소» 창 (연구소 · 보물 · 리더 탭) — 11/14 대표님 «연구소 A» 채택 (tools/_uimock/lab_a2.html · 규칙표 ⑥ ⑰ ⑲)
 *  왼쪽 메뉴 = 연구소 · 보물 · 리더 (+ 올릴 수 있는 수 배지) · 오른쪽 = 고른 탭 내용 (이 칸만 스크롤)
 * 연구소 : 7항목, Lv n→n+1 코인 300×(n+1), 최대 Lv9, 상한 = 깬 월드 수.
 * 보물 : 월드마다 별 10 · 20 · 30 → 1 · 2 · 3단계 (저절로).
 * 리더 : «자동(월드 추천)» 또는 연 리더 중 하나 (결정 D8).
 * 전투 보너스 = 항목마다 «계산기 기준»과 «내 연구소 + 보물» 중 큰 값 (결정 D7 · battleSetup.bonusFor).
 */
import { el, presentOverlay } from './ui.js';
import * as G from '../services/iandragonGame.js';
import * as Sfx from '../audio/sfx.js';
import { LEADERS } from '../games/iandragon_game/data/leaders.js';
import { ECON } from '../games/iandragon_game/data/econ.js';
import { xTitle, v2Cash } from './idgXwin.js';   /* 창 틀 2판 머리 (재화 알약 = 왼쪽) */
import { scrollHint } from './idgMore.js';      /* 아래로 더 있음 금 화살표 (오른쪽 칸 스크롤) */
import { LAB, TREASURE, treasureLv, LAST_STAGE } from '../games/iandragon_game/render/battleSetup.js';
import '../styles/idg-v2-lab.css';

const AI = '/assets/iandragon_game/ai/';
const COIN = `${AI}ui/coin.svg`, STAR_ON = `${AI}result/star_on.webp`, STAR_OFF = `${AI}result/star_off.webp`;
const eff = (x, n, flat) => (flat || !x.pct && !x.per.toString().startsWith('0') ? `+${x.per * n}` : `+${Math.round(x.per * n * 100)}%`);
const fmt = (n) => Number(n || 0).toLocaleString('en-US');
const panel = (w) => `${AI}bg/w${String(w).padStart(2, '0')}_panel.png`;
let lastTab = 'lab';   /* 다시 열면 마지막 탭 */

export function showLab(onChange) {
  Sfx.play('sfx_menu_select');
  let tab = lastTab;
  const cash = v2Cash(0, 0);
  const rail = el('div.v2lab-rail'), sec = el('div.v2lab-sec'), list = el('div.v2lab-list'), main = el('div.v2lab-main', null, [sec, list]);
  const capOf = (g) => Math.min(ECON.labMax, Math.floor(g.cleared / 10));
  /* 연구소에서 지금 올릴 수 있는 항목 수 (배지 숫자) */
  const canUp = (g) => { const cap = capOf(g); return LAB.filter((_, i) => { const n = g.lab[i] || 0; return n < cap && g.coins >= ECON.labCost(n); }).length; };
  const go = (t) => { if (t === tab) return; Sfx.play('sfx_menu_select'); tab = lastTab = t; list.scrollTop = 0; draw(); list.scrollTop = 0; };

  function railBtn(t, icon, label, badge) {
    return el('button.v2lab-rb' + (tab === t ? '.on' : ''), { type: 'button', 'aria-pressed': tab === t ? 'true' : 'false', 'data-kdef': tab === t ? '1' : null, onclick: () => go(t) }, [
      el('img', { src: icon, alt: '' }), el('span', label), ...(badge ? [el('i.v2lab-badge', String(badge))] : []),
    ]);
  }
  function labRows(g) {
    const cap = capOf(g);
    return LAB.map((L, i) => {
      const n = g.lab[i] || 0, cost = ECON.labCost(n), max = n >= cap, poor = g.coins < cost;
      const pips = el('span.v2lab-pips', { 'aria-hidden': 'true' }, Array.from({ length: ECON.labMax }, (_, k) => el('i' + (k < n ? '.on' : k >= cap ? '.lk' : ''))));
      const btn = max
        ? el('button.v2lab-btn.x0', { type: 'button', disabled: true }, [cap ? 'MAX' : '월드 1을 깬 뒤'])
        : el('button.v2lab-btn.g' + (poor ? '.poor' : ''), { type: 'button', 'aria-label': `${L.name} 올리기 · 코인 ${fmt(cost)}`, onclick: () => {
          const cur = G.idg(), now = cur.lab[i] || 0, c = ECON.labCost(now);
          if (cur.coins < c || now >= capOf(cur)) { Sfx.play('sfx_menu_select'); return; }
          const next = cur.lab.slice(); next[i] = now + 1;
          G.saveIdg({ coins: cur.coins - c, lab: next }); Sfx.play('sfx_menu_select'); draw(); onChange?.();
        } }, [el('img', { src: COIN, alt: '' }), el('b', fmt(cost))]);
      return el('div.v2lab-row', null, [
        el('span.v2lab-lv' + (n ? '' : '.z'), `Lv${n}`),
        el('span.v2lab-t', null, [el('b', L.name), el('small', n ? eff(L, n, !L.pct) + (max ? '' : ` → ${eff(L, n + 1, !L.pct)}`) : `아직 0 → ${eff(L, 1, !L.pct)}`)]),
        pips, btn,
      ]);
    });
  }
  function treRows(g) {
    const out = [];
    for (let w = 1; w <= LAST_STAGE / 10; w++) {
      let st = 0; for (let i = (w - 1) * 10; i < w * 10; i++) st += Number(g.stars[i]) || 0;
      const T = TREASURE[w - 1], n = treasureLv(g.stars, w);
      out.push(el('div.v2lab-tc' + (n >= 3 ? '.full' : '') + (n ? '' : '.off'), null, [
        el('span.th', null, [el('img', { src: panel(w), alt: '', loading: 'lazy' }), el('b', `월드 ${w}`), el('i.st', null, [el('img', { src: STAR_ON, alt: '별' }), `${st}/30`])]),
        el('span.ef', null, [el('small', T.name), el('b', n ? eff(T, n, T.flat) : '+0')]),
        el('span.sc', null, [10, 20, 30].map((t, i) => el('span' + (i < n ? '.on' : ''), null, [el('img', { src: i < n ? STAR_ON : STAR_OFF, alt: i < n ? '★' : '☆' }), el('em', String(t))]))),
      ]));
    }
    return [el('div.v2lab-tgrid', null, out)];
  }
  function leaderRows(g) {
    const worlds = Math.floor(g.cleared / 10);
    const pick = (id) => { G.saveIdg({ leader: id }); Sfx.play('sfx_menu_select'); draw(); onChange?.(); };
    const card = (id, on, art, name, line) => el('button.v2lab-ld' + (on ? '.on' : ''), { type: 'button', 'aria-pressed': on ? 'true' : 'false', onclick: () => pick(id) }, [
      ...(on ? [el('i.ck', '선택')] : []), el('span.a' + (id === 'auto' ? '.auto' : ''), null, [art]), el('b', name), el('small', line),
    ]);
    const cards = [card('auto', g.leader === 'auto', '자동', '자동', '월드 추천')];
    for (const [id, L] of Object.entries(LEADERS)) {
      if (L.unlock > worlds) continue;
      cards.push(card(id, g.leader === id, el('img', { src: `${AI}${id}/head.png`, alt: '' }), L.ko, L.line.slice(0, 14)));
    }
    return [el('div.v2lab-lgrid', null, cards)];
  }
  function draw() {
    const g = G.idg(), worlds = Math.floor(g.cleared / 10), cap = capOf(g), top = list.scrollTop;
    cash.replaceChildren(...v2Cash(g.coins, g.gems).childNodes);
    const ldId = g.leader && LEADERS[g.leader] ? g.leader : 'novart';
    rail.replaceChildren(
      railBtn('lab', `${AI}lobby/ico_lab.png`, '연구소', canUp(g)),
      railBtn('tre', STAR_ON, '보물'),
      railBtn('ld', `${AI}${ldId}/head.png`, '리더'),
      el('div.v2lab-gap'),
      el('div.v2lab-paper', null, tab === 'lab' ? ['깬 월드 ', el('b', `${worlds}개`), el('br'), '연구소는 ', el('b', `최대 Lv${cap}`), '까지']
        : tab === 'tre' ? ['월드마다 별을', el('br'), el('b', '10 · 20 · 30개'), ' 모으면', el('br'), '저절로 올라요']
          : ['리더는 드래곤캐슬', el('br'), '위에서 ', el('b', '브레스'), '를 뿜어요']),
    );
    sec.textContent = tab === 'lab' ? `연구소 — 최대 Lv${cap} (깬 월드 수)` : tab === 'tre' ? '보물 — 월드마다 별 10 · 20 · 30개' : '리더 (드래곤캐슬 위에서 브레스를 뿜어요)';
    main.dataset.tab = tab;
    list.replaceChildren(...(tab === 'lab' ? labRows(g) : tab === 'tre' ? treRows(g) : leaderRows(g)));
    list.scrollTop = top;   /* 올리기 · 고르기를 눌러도 목록 자리 그대로 */
  }
  draw();
  const box = el('div.dialog.idg-lab.idg-labv2.idg-xw', { onclick: (e) => e.stopPropagation() }, [xTitle('연구소', () => close(), { left: [cash] }), el('div.v2lab', null, [rail, main])]);
  const overlay = el('div.dialog-overlay', { onclick: () => close() }, [box]);
  const close = presentOverlay(overlay);
  requestAnimationFrame(() => scrollHint(list, { host: main }));
}
