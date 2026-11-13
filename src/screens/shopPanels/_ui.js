/**
 * 샵 칸 4개가 같이 쓰는 DOM 부품 (겜보조 2 · 11/13) — 파워업 카드(.idg-pp-card)와 같은 모양
 *  카드 = 얼굴 · 이름 · Lv 줄 · 막대 줄 · 아래 단추 / 단추 = 결과 창 초록 · 빨강 단추 테(btn_green3 · btn_red3) + «글씨 · 재화 아이콘 + 숫자»
 *  재화는 idgKit(money.js) 그대로 — 글자 «금화» «젬» 없음. 모양은 styles/idg-shop-panels.css.
 */
import '../../styles/idg-shop-panels.css';
import { el } from '../ui.js';
import * as Sfx from '../../audio/sfx.js';
import { kitGauge, kitPaper, kitCoin, kitGem } from '../idgKit.js';
import { ICON, S } from './_data.js';

export const snd = (k) => { try { Sfx.play(k); } catch { /* 소리 없음 */ } };

/** 칸 뿌리 : 키트 부품이 .idg-k 안에서만 그려지므로 늘 붙인다 */
export const panelRoot = (box) => { box.classList.add('idg-k', 'idg-sp'); box.replaceChildren(); return box; };

/** 위 종이 안내 (한두 줄) */
export const note = (lines) => kitPaper([].concat(lines).map((t, i) => (typeof t === 'string' ? (i ? el('small', t) : t) : t)));

/**
 * 값 단추 : [글씨] + 코인 + 젬(있는 것만). 둘 다 있으면 둘 다 들어야 한다.
 * @param {{coin?:number, gem?:number}} cost  @param {{label?:string, kind?:'green'|'red', poor?:boolean, onClick?:Function}} o
 */
export function buyBtn(cost, o = {}) {
  const b = el(`button.idg-sp-buy.${o.kind || 'green'}${o.poor ? '.poor' : ''}`, {
    type: 'button', disabled: !!o.poor,
    'aria-label': `${o.label || ''} ${cost.coin ? `금화 ${cost.coin} ` : ''}${cost.gem ? `젬 ${cost.gem}` : ''}${o.poor ? ` (${S.poor})` : ''}`.trim(),
    title: o.poor ? S.poor : null,
    onclick: (e) => { e.stopPropagation(); if (b.disabled) return; snd('sfx_menu_select'); o.onClick?.(e); },
  }, [o.label ? el('span.idg-buy-label', o.label) : null, cost.coin ? kitCoin(cost.coin) : null, cost.gem ? kitGem(cost.gem) : null]);
  return b;
}

/** 못 하는 단추(최고 · 가졌어요) : 평범한 보라 */
export const plainBtn = (text) => el('button.idg-sp-buy.plain', { type: 'button', disabled: true }, [el('span.idg-buy-label', text)]);

/** 막대 줄 : 이름 · 게이지 · 값 */
export function statRow(label, value, max, color, text) {
  return el('div.st', null, [el('span', label), kitGauge({ value, max, color, floor: 0.04, size: 'sm', label }), el('em', text != null ? text : String(value))]);
}

/** 잠긴 카드 아래 한 줄 : 자물쇠 + 조건 */
export const lockLine = (text) => el('div.idg-sp-lock', null, [el('img', { src: ICON.lock, alt: '', draggable: 'false' }), el('span', text)]);

/**
 * 카드 하나
 * @param {{id?:string, face?:string, name:string, l1?:string, l2?:string|Node, tag?:string, on?:boolean, locked?:boolean, rows?:Node[], foot?:Node|Node[]}} o
 */
export function card(o) {
  const c = el(`div.idg-sp-card${o.on ? '.on' : ''}${o.locked ? '.locked' : ''}`, { 'data-id': o.id || null, role: 'group', 'aria-label': o.name });
  const img = o.face && typeof o.face !== 'string' ? o.face : el('img', { src: o.face || '', alt: '', draggable: 'false' });
  if (img.tagName === 'IMG') img.onerror = () => { img.onerror = null; img.style.visibility = 'hidden'; };
  /* 이름표(대장)는 Lv 줄 끝에 — 좁은 세로 칸에서 이름이 한 글자씩 꺾이지 않게 */
  const lv = el('span.lv', null, [(o.l1 || o.tag) ? el('span.l1', null, [o.l1 || '', o.tag ? el('em.tag', o.tag) : null]) : null, o.l2 ? (typeof o.l2 === 'string' ? el('span.l2', o.l2) : o.l2) : null]);
  const foot = [].concat(o.foot || []);
  c.append(el('div.idg-sp-top', null, [img, el('b.nm', o.name), lv]), ...(o.rows || []), el(`div.idg-sp-foot${foot.length > 1 ? '.two' : ''}`, null, foot));
  return c;
}

/** 불꽃 얼굴(브레스 카드) : 기존 불꽃 시트(fx/fire_*.png)의 첫 칸 — 새 그림이 오기 전 임시 */
export const fireFace = (color = 'orange') => el(`span.idg-sp-fire.${color}`, { 'aria-hidden': 'true' }, [el('i')]);

/** 카드 안 설명 줄 (글 또는 노드 여러 개) */
export const line = (kids) => el('p.idg-sp-line', null, [].concat(kids).map((k) => (typeof k === 'string' ? document.createTextNode(k) : k)));

/** 카드 격자 */
export const list = (cards) => el('div.idg-sp-list', null, cards);

/** 단계 막대 : N 칸 중 have 칸이 찼다 (픽셀 칸 · 보간 없음) */
export function stepBar(n, have, label) {
  const bar = el('div.idg-sp-steps', { role: 'img', 'aria-label': `${label} ${have}/${n}` });
  for (let i = 0; i < n; i++) bar.append(el(`i${i < have ? '.on' : ''}`));
  return bar;
}
