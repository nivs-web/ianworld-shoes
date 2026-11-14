/**
 * 좀비와 드래곤 UI 키트 — DOM 도우미 (11/12 · 겜부장 보조)
 *
 *  모든 창 · 단추 · 토글 · 슬라이더 · 탭 · 목록 줄 · 재화 표시를 «한 가지 모양» 으로 만든다.
 *  규칙 = docs/IDG_DESIGN_STYLESHEET.md · 모양 = styles/idg-kit.css (.idg-k-*) · 그림 = ai/kit/* (+ ai/result · ai/lobby 재사용)
 *  재화 아이콘 + 숫자는 render/money.js(서브 창 보조가 만듦)를 그대로 가져다 쓴다 — 글자 «금화» «젬» 금지.
 *
 *  쓰는 법 : 키트 부품은 반드시 .idg-k 안에 둔다 (kitWin 은 스스로 .idg-k 를 붙인다).
 *    const w = kitWin({ title: '설정', onClose, body: [kitRow({ title: '효과음', right: kitToggle({ on: true, label: '효과음', onChange }) })], foot: [kitBtn({ kind: 'purple', text: '닫기', onClick: onClose })] });
 */
import '../styles/idg-kit.css';
import { el } from './ui.js';
import { moreDown } from './idgMore.js';   /* «아래로 더 있음» 화살표 공용 규칙 (11/13) */
import * as Sfx from '../audio/sfx.js';
import { money, moneyIcon, fmtMoney, UP_WORD } from '../games/iandragon_game/render/money.js';

const IMG = '/assets/iandragon_game/ai/';
const snd = (k) => { try { Sfx.play(k); } catch { /* 소리 없음 */ } };
let uid = 0;
const nid = (p) => `idgk-${p}-${++uid}`;
const icoImg = (src, cls = 'ico') => (src ? (typeof src === 'string' ? el(`img.${cls}`, { src, alt: '', draggable: 'false' }) : src) : null);

/** 키트 뿌리 — 창이 아닌 곳(로비 위 띠 등)에서 키트 부품을 쓸 때 감싼다 */
export function kitRoot(children, cls = '') {
  return el(`div.idg-k${cls ? '.' + cls : ''}`, null, [].concat(children));
}

/** 창 머리 현판 (빨간 리본 · 부화장 창과 같은 그림) */
export function kitTitle(text, id) {
  return el('h2.idg-k-title', { id: id || null, text });
}

/** 작은 닫기(X) 단추 */
export function kitClose(onClick, label = '닫기') {
  return el('button.idg-k-close', { type: 'button', 'aria-label': label, title: label, onclick: (e) => { snd('sfx_menu_back'); onClick?.(e); } });
}

/**
 * 창 : 호박 창 테(dialog9) → 현판 → 본문(스크롤) → 단추 줄
 * @param {{title?:string, body?:Array<Node>, foot?:Array<Node>, onClose?:Function, cls?:string, closeX?:boolean}} o
 *   closeX = 현판 오른쪽 작은 X (기본 : onClose 가 있고 foot 이 비었을 때만)
 */
export function kitWin(o = {}) {
  const tid = nid('title');
  const head = o.title ? el('div.idg-k-win-head', null, [kitTitle(o.title, tid)]) : null;
  const wantX = o.closeX ?? (!!o.onClose && !(o.foot && o.foot.length));
  if (head && wantX) head.append(kitClose(o.onClose));
  const win = el(`section.idg-k.idg-k-win${o.cls ? '.' + o.cls : ''}`, { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': o.title ? tid : null }, [
    head,
    el('div.idg-k-win-body', null, o.body || []),
    o.foot && o.foot.length ? el('div.idg-k-win-foot', null, o.foot) : null,
  ]);
  if (o.onClose) win.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); o.onClose(e); } });
  return win;
}

/**
 * 단추
 * @param {{kind?:'red'|'green'|'purple', icon?:string|Node, text?:string, onClick?:Function, size?:'sm', wide?:boolean, disabled?:boolean, label?:string, tag?:string, sfx?:string, cls?:string}} o
 *   red = 앞으로 가는 주 행동(전투 개시 · 시작) · green = 좋은 일(사기 · 강화 · 받기) · purple = 평범한 행동(다시 · 닫기 · 나가기)
 */
export function kitBtn(o = {}) {
  const kind = o.kind || 'purple';
  const b = el(`button.idg-k-btn.${kind}${o.size ? '.' + o.size : ''}${o.wide ? '.wide' : ''}${o.cls ? '.' + o.cls : ''}`, {
    type: 'button', disabled: !!o.disabled, 'aria-label': o.label || null,
    onclick: (e) => { if (b.disabled) return; snd(o.sfx || (kind === 'purple' ? 'sfx_menu_move' : 'sfx_menu_select')); o.onClick?.(e); },
  }, [icoImg(o.icon), o.text != null ? el('span.idg-k-btn-text', o.text) : null, o.tag ? el('i.idg-k-btn-tag', o.tag) : null]);
  return b;
}

/** 재화 : 금화 그림 + 숫자 (money.js) · opt = { sign:'+', pill:true } */
export const kitCoin = (n, opt) => money('coin', n, opt);
/** 재화 : 젬 그림 + 숫자 */
export const kitGem = (n, opt) => money('gem', n, opt);
export { moneyIcon as kitMoneyIcon, fmtMoney as kitFmt };

/**
 * 가격 단추 : 초록 고급 단추 + (작은 글씨) + 재화 아이콘 + 숫자
 * @param {{coin?:number, gem?:number, label?:string, onClick?:Function, poor?:boolean, disabled?:boolean, kind?:'green'|'red', tag?:string, size?:'sm', wide?:boolean}} o
 *   poor = 모자람(숫자 빨강 · 눌리지 않음). label 예 «사기» — 없으면 아이콘 + 숫자만
 */
export function kitPriceBtn(o = {}) {
  const cur = o.gem != null ? 'gem' : 'coin';
  const n = o.gem != null ? o.gem : o.coin;
  const name = cur === 'gem' ? '젬' : '금화';
  const b = el(`button.idg-k-btn.price.${o.kind || 'green'}${o.size ? '.' + o.size : ''}${o.wide ? '.wide' : ''}${o.poor ? '.poor' : ''}`, {
    type: 'button', disabled: !!(o.disabled || o.poor),
    'aria-label': `${o.label ? o.label + ' ' : ''}${name} ${fmtMoney(n)}${o.poor ? ` (${name}이 모자라요)` : ''}`,
    title: o.poor ? `${name}이 모자라요` : null,
    onclick: (e) => { if (b.disabled) return; snd('sfx_menu_select'); o.onClick?.(e); },
  }, [o.label ? el(`span.idg-k-btn-label${UP_WORD.test(o.label) ? '.up' : ''}`, o.label) : null, money(cur, n, { clean: (o.kind || 'green') === 'green' }), o.tag ? el('i.idg-k-btn-tag', o.tag) : null]);
  return b;
}

/**
 * «내 보유량» 지갑 판 (상점 맨 위) : 금화 그림+숫자 | 젬 그림+숫자
 * 반환 요소에 .update({coins, gems}) 가 붙는다.
 */
export function kitWallet({ coins = 0, gems = 0 } = {}) {
  const w = el('div.idg-k-wallet', { role: 'status', 'aria-label': '내 보유량' });
  w.update = (v = {}) => {
    if (v.coins != null) coins = v.coins;
    if (v.gems != null) gems = v.gems;
    w.replaceChildren(money('coin', coins), el('i.idg-k-wallet-sep', { 'aria-hidden': 'true' }), money('gem', gems));
  };
  w.update();
  return w;
}

/**
 * 토글 스위치 (role=switch)
 * @param {{on?:boolean, onChange?:(on:boolean)=>void, label:string, disabled?:boolean}} o
 * 반환 요소에 .set(on) 이 붙는다 (onChange 는 부르지 않음).
 */
export function kitToggle(o = {}) {
  let on = !!o.on;
  const t = el('button.idg-k-toggle', { type: 'button', role: 'switch', 'aria-checked': String(on), 'aria-label': o.label || null, title: o.label || null, disabled: !!o.disabled,
    onclick: () => { if (t.disabled) return; on = !on; t.setAttribute('aria-checked', String(on)); snd('sfx_menu_move'); o.onChange?.(on); } });
  t.set = (v) => { on = !!v; t.setAttribute('aria-checked', String(on)); };
  return t;
}

/**
 * 체크 상자 (role=checkbox) — label 을 주면 [상자 글씨] 줄로 감싸서 돌려준다 (줄 전체를 눌러도 바뀜)
 * @param {{on?:boolean, onChange?:(on:boolean)=>void, label:string, text?:boolean}} o  text=false 면 상자만
 */
export function kitCheck(o = {}) {
  let on = !!o.on;
  const box = el('button.idg-k-check', { type: 'button', role: 'checkbox', 'aria-checked': String(on), 'aria-label': o.label || null });
  const flip = () => { on = !on; box.setAttribute('aria-checked', String(on)); snd('sfx_menu_move'); o.onChange?.(on); };
  box.set = (v) => { on = !!v; box.setAttribute('aria-checked', String(on)); };
  if (o.text === false || !o.label) { box.addEventListener('click', flip); return box; }
  const line = el('div.idg-k-checkline', null, [box, el('span.idg-k-t3', o.label)]);
  line.addEventListener('click', (e) => { e.preventDefault(); flip(); });
  line.set = box.set;
  return line;
}

/**
 * 슬라이더 (진짜 input[type=range] · 키보드 · 화면 읽기 그대로)
 * @param {{value?:number, min?:number, max?:number, step?:number, onInput?:(v:number)=>void, onChange?:(v:number)=>void, label:string, disabled?:boolean}} o
 */
export function kitSlider(o = {}) {
  const min = o.min ?? 0, max = o.max ?? 100;
  const wrap = el('div.idg-k-slider');
  const input = el('input', { type: 'range', min, max, step: o.step ?? 1, value: o.value ?? min, 'aria-label': o.label || null, disabled: !!o.disabled });
  const paint = () => wrap.style.setProperty('--v', String((Number(input.value) - min) / ((max - min) || 1)));
  input.addEventListener('input', () => { paint(); o.onInput?.(Number(input.value)); });
  input.addEventListener('change', () => o.onChange?.(Number(input.value)));
  wrap.append(el('i.idg-k-slider-groove', { 'aria-hidden': 'true' }), el('i.idg-k-slider-fill', { 'aria-hidden': 'true' }), input);
  wrap.set = (v) => { input.value = v; paint(); };
  wrap.input = input;
  paint();
  return wrap;
}

/**
 * 탭 (role=tablist · 화살표 키로 옮김)
 * @param {{tabs:Array<{id:string,label:string,icon?:string}>, value?:string, onPick?:(id:string)=>void, old?:boolean, label?:string}} o
 *   old = 고풍스러운 상점 탭(빨간 비단 + 금 장식) — «꾸미기 · 오늘의 특가 · 편의품»
 * 반환 요소에 .set(id) 가 붙는다.
 */
export function kitTabs(o = {}) {
  let cur = o.value ?? o.tabs?.[0]?.id;
  const list = el(`div.idg-k-tabs${o.old ? '.old' : ''}`, { role: 'tablist', 'aria-label': o.label || null });
  const btns = (o.tabs || []).map((t) => el('button.idg-k-tab', { type: 'button', role: 'tab', id: nid('tab'), 'data-id': t.id,
    onclick: () => pick(t.id, true) }, [icoImg(t.icon), el('span', t.label)]));
  const paint = () => btns.forEach((b) => { const on = b.dataset.id === cur; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; });
  function pick(id, user) { if (id === cur) return; cur = id; paint(); if (user) { snd('sfx_menu_move'); o.onPick?.(id); } }
  list.addEventListener('keydown', (e) => {
    const i = btns.findIndex((b) => b.dataset.id === cur);
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!d || i < 0) return;
    e.preventDefault(); const nb = btns[(i + d + btns.length) % btns.length]; pick(nb.dataset.id, true); nb.focus();
  });
  list.append(...btns); paint();
  list.set = (id) => pick(id, false);
  return list;
}

/**
 * 목록 줄 (설정 · 상점 한 줄) : [아이콘] 이름 / 설명 ……… [오른쪽 조작]
 * @param {{icon?:string|Node, title:string, sub?:string|Node, right?:Node|Array<Node>, hi?:boolean, locked?:boolean, onClick?:Function}} o
 *   onClick 이 있으면 줄 전체가 단추(button) · locked = 잠김(자물쇠 + 흐림)
 */
export function kitRow(o = {}) {
  const right = [].concat(o.right || []);
  if (o.locked) right.unshift(kitLock());
  const kids = [
    o.icon ? icoImg(o.icon, 'idg-k-row-ico') : null,
    el('div.idg-k-row-txt', null, [el('b', o.title), o.sub != null ? (typeof o.sub === 'string' ? el('span', o.sub) : o.sub) : null]),
    right.length ? el('div.idg-k-row-end', null, right) : null,
  ];
  const cls = `${o.hi ? '.hi' : ''}${o.locked ? '.locked' : ''}`;
  if (o.onClick) return el(`button.idg-k-row${cls}`, { type: 'button', onclick: (e) => { snd('sfx_menu_select'); o.onClick(e); } }, kids);
  return el(`div.idg-k-row${cls}`, { role: 'group', 'aria-label': o.title }, kids);
}

/** 목록 소제목 («모자» 처럼 줄 묶음 위) */
export const kitSection = (text) => el('h3.idg-k-sec', text);

/** 옛날 종이(양피지) 안내 판 — 안내 · 도움말 글은 항상 여기에. 글씨는 짙은 갈색(외곽선 없음) */
export function kitPaper(children) {
  return el('div.idg-k-paper', { role: 'note' }, [].concat(children));
}

/**
 * 스크롤 목록 상자 : 위아래 도트 금 테 + 아래로 더 있으면 «더 있음» 화살표
 * @param {Array<Node>} children  @param {{height?:string}} [opt]  height 예 '18em' (기본 16em)
 * 반환 요소의 .inner 에 줄을 더 넣을 수 있다 (넣은 뒤 .refresh()).
 */
export function kitScroll(children, opt = {}) {
  const inner = el('div.idg-k-scroll-in', { tabindex: '0', role: 'list' }, [].concat(children || []));
  const box = el('div.idg-k-scroll', { style: opt.height ? { '--k-scroll-h': opt.height } : null }, [inner, el('i.idg-k-more', { 'aria-hidden': 'true' })]);
  const refresh = () => box.classList.toggle('more', moreDown(inner));
  inner.addEventListener('scroll', refresh, { passive: true });
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(refresh).observe(inner);
  requestAnimationFrame(refresh);
  box.inner = inner; box.refresh = refresh;
  return box;
}

/**
 * 픽셀 게이지 (11/12 서브창2 · 대표님 «게이지 끝이 잘려 보인다 → 금테 홈 + 양 끝 마감 + 채움 끝도 딱 떨어지게»)
 *  홈 = kit/gauge.webp (금테 · 양 끝 금 마감 · 9-slice) · 채움 = 색 3단(밝음 · 본색 · 어두움) + 끝 1px 마감선
 * @param {{value:number, max?:number, color?:'green'|'orange'|'gold'|'red'|'blue'|'purple'|string, label?:string, size?:'sm'|'lg', floor?:number}} o
 *   color = 이름(미리 정한 색) 또는 CSS 색(#5fd35f 처럼 — 밝음 · 어두움은 저절로) · floor = 값이 있으면 최소로 보일 비율(예 .05)
 * 반환 요소에 .set(value, max?) 가 붙는다. role=progressbar · aria-valuenow/max.
 */
const GAUGE_COLORS = ['green', 'orange', 'gold', 'red', 'blue', 'purple'];
export function kitGauge(o = {}) {
  let max = o.max ?? 100;
  const col = o.color || 'green', named = GAUGE_COLORS.includes(col);
  const g = el(`div.idg-k-gauge${named ? '.' + col : '.custom'}${o.size ? '.' + o.size : ''}`, { role: 'progressbar', 'aria-label': o.label || null, 'aria-valuemin': '0' }, [el('i.idg-k-gauge-fill', { 'aria-hidden': 'true' })]);
  if (!named) g.style.setProperty('--g-c', col);
  g.set = (v, m) => {
    if (m != null) max = m;
    let p = max > 0 ? Math.max(0, Math.min(1, (Number(v) || 0) / max)) : 0;
    if (p > 0 && o.floor) p = Math.max(p, o.floor);
    g.style.setProperty('--v', p.toFixed(4));
    g.classList.toggle('empty', p <= 0); g.classList.toggle('full', p >= 1);
    g.setAttribute('aria-valuenow', String(Math.round(Number(v) || 0))); g.setAttribute('aria-valuemax', String(Math.round(max)));
  };
  g.set(o.value ?? 0, max);
  return g;
}

/**
 * 스크롤 위치 지키기 (11/12 서브창2 · 대표님 «받기를 누르면 목록이 맨 위로 올라간다»)
 *  fn() 이 창 안 내용을 바꾸어도 node 를 감싼 스크롤 칸의 scrollTop 을 그대로 되살린다 (바로 · 다음 그림 직전 rAF).
 */
export function kitKeepScroll(node, fn) {
  let sc = node;
  while (sc && sc !== document.body) { const s = getComputedStyle(sc); if (/(auto|scroll)/.test(s.overflowY) && sc.scrollHeight > sc.clientHeight) break; sc = sc.parentElement; }
  if (!sc || sc === document.body) { fn(); return; }
  const top = sc.scrollTop;
  fn();
  sc.scrollTop = top;
  requestAnimationFrame(() => { sc.scrollTop = top; });
}

/** 잠금 자물쇠 아이콘 */
export const kitLock = () => el('i.idg-k-lock', { role: 'img', 'aria-label': '잠김' });

/** 작은 «!» 알림 점 — target 에 붙인다 (target 은 position 이 잡혀 있어야 함 → .idg-k-has-badge 를 붙여 줌). on=false 면 뗀다 */
export function kitBadge(target, on = true) {
  const old = target.querySelector(':scope > .idg-k-badge');
  if (!on) { old?.remove(); return target; }
  target.classList.add('idg-k-has-badge');
  if (!old) target.append(el('i.idg-k-badge', { role: 'img', 'aria-label': '새 소식' }));
  return target;
}

/** 키트 그림 경로 (다른 화면이 같은 그림을 쓸 때) */
export const KIT_IMG = {
  toggleOn: IMG + 'kit/toggle_on.webp', toggleOff: IMG + 'kit/toggle_off.webp', checkOn: IMG + 'kit/check_on.webp', checkOff: IMG + 'kit/check_off.webp',
  close: IMG + 'kit/btn_close.webp', tabOn: IMG + 'kit/tab_on.webp', tabOff: IMG + 'kit/tab_off.webp', tab2On: IMG + 'kit/tab2_on.webp', tab2Off: IMG + 'kit/tab2_off.webp',
  groove: IMG + 'kit/slider_groove.webp', fill: IMG + 'kit/slider_fill.webp', knob: IMG + 'kit/slider_knob.webp', row: IMG + 'kit/row2.webp', rowHi: IMG + 'kit/row2_hi.webp',
  gauge: IMG + 'kit/gauge.webp', cxCard: IMG + 'kit/cx_card.webp', cxCardOff: IMG + 'kit/cx_card_off.webp',
  paper: IMG + 'kit/paper.webp', wallet: IMG + 'kit/wallet.webp', scrollEdge: IMG + 'kit/scroll_edge.webp', more: IMG + 'kit/more_arrow.webp',
  ribbon: IMG + 'lobby/ribbon.webp', dialog: IMG + 'lobby/dialog9.webp', btnRed: IMG + 'result/btn_red3.webp', btnGreen: IMG + 'result/btn_green3.webp',
  lock: IMG + 'lobby/ico_lock.png', alert: IMG + 'lobby2/alert.webp',
};
