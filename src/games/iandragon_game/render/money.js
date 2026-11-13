/**
 * 재화 표시 도우미 (11/12 대표님 «금화 100 · 젬 390 처럼 글자로 쓴 재화는 전부 아이콘 + 숫자로 — 읽기 쉽고 빠르고 직관적으로»)
 *
 *  money('coin' | 'gem', 숫자)        → [금화 그림][14,799]  (span.idg-cash)
 *  money(..., { pill: true })          → 보상 알약 모양(어두운 판 + 금테) — 창 위쪽 «내 재화» 줄에
 *  buyButton({ label, kind, price, ...}) → 결과 창 양식 고급 단추(btn_green3 / btn_red3 테) 안에 «글씨 + 아이콘 + 숫자»
 *
 *  아이콘 = 도트 SVG (ai/ui/coin.svg 정원 금화 · ai/ui/gem.svg 우리 젬 icon_gem_v3 를 tools/_png2svg.py 로 옮김) — 아무리 키워도 또렷.
 *  글씨 외곽선은 1px 8방향(흐린 그림자 · 글로우 없음) · 모양은 styles/idg-subwin.css.
 *  el() 없이 맨 DOM 만 쓴다 → 로비 창(src/screens)과 전투 안 파워업(powerPage.js) 둘 다 쓴다.
 */
import '../../../styles/idg-kit.css';      /* 키트 먼저 → 서브 창 다듬기(키트를 옛 창에 입힘)가 뒤에 와서 이긴다 */
import '../../../styles/idg-subwin.css';
import '../../../styles/idg-titlebar.css';

export const COIN_ICON = '/assets/iandragon_game/ai/ui/coin.svg';
export const GEM_ICON = '/assets/iandragon_game/ai/ui/gem.svg';
const NAME = { coin: '금화', gem: '젬' };
export const fmtMoney = (n) => Math.round(Number(n) || 0).toLocaleString('en-US');

function node(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

/** 아이콘 하나 (글자 대신) — 화면 읽기 프로그램에는 «금화» «젬» 으로 읽힌다 */
export function moneyIcon(kind) {
  const im = node('img', 'idg-cash-ico');
  im.src = kind === 'gem' ? GEM_ICON : COIN_ICON; im.alt = NAME[kind] || ''; im.draggable = false;
  return im;
}

/** 아이콘 + 숫자. opt.pill = 알약 판 · opt.sign = '+' 등 앞 글자 · opt.cls = 덧붙일 class */
export function money(kind, n, opt = {}) {
  const w = node('span', `idg-cash ${kind}${opt.pill ? ' pill' : ''}${opt.cls ? ` ${opt.cls}` : ''}`);
  w.title = `${NAME[kind] || ''} ${fmtMoney(n)}`;
  w.append(moneyIcon(kind), node('b', null, `${opt.sign || ''}${fmtMoney(n)}`));
  return w;
}

/**
 * 고급 단추 : 결과 창 단추 테(btn_green3 · btn_red3) / 평범한 보라(plain).
 * @param {{ label?:string, kind?:'coin'|'gem', price?:number, tone?:'green'|'red'|'plain', onClick?:Function, disabled?:boolean, poor?:boolean, tag?:string, cls?:string, title?:string, stop?:boolean }} o
 *   poor = 재화가 모자람(숫자가 빨갛고 단추가 흐려짐 · 눌리지 않음) · tag = 단추 위 작은 딱지(예 «10% 할인») · stop = 누를 때 부모로 안 퍼지게
 */
export function buyButton(o) {
  const tone = o.tone || 'green';
  const b = node('button', `idg-buy ${tone}${o.poor ? ' poor' : ''}${o.cls ? ` ${o.cls}` : ''}`);
  b.type = 'button';
  if (o.label) b.append(node('span', 'idg-buy-label', o.label));
  if (o.kind && o.price != null) b.append(money(o.kind, o.price));
  if (o.tag) b.append(node('i', 'idg-buy-tag', o.tag));
  if (o.poor) b.title = o.kind === 'gem' ? '젬이 모자라요' : '금화가 모자라요'; else if (o.title) b.title = o.title;
  if (o.disabled || o.poor) b.disabled = true;
  if (o.onClick) b.addEventListener('click', (e) => { if (o.stop) e.stopPropagation(); if (!b.disabled) o.onClick(e); });
  return b;
}
