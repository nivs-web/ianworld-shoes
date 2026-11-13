/**
 * 좀비와 드래곤 «키보드만으로 하기» (대표님 11/13 밤 — 블루투스 키보드 · PC 를 큰 TV 에 연결해서)
 *
 * 한 곳에서 다 맡는다 (window keydown · 캡처 단계 하나) :
 *   1) 전투 키 — 기본값 + 기기에 저장한 바꾼 값(localStorage 'idg_keys') · hud.js 가 bindBattleKeys() 로 등록
 *   2) 로비 · 모든 창 — 화살표로 «포커스» 공간 이동(화면에서 그 방향으로 가장 가까운 단추) · Enter/Space = 누르기 · Esc = 창 닫기
 *   3) 키 바꾸기(설정 → 키보드) — captureKey()
 *
 * 규칙
 *  - 키는 e.code(물리 키)로 본다 : 한글 입력 상태에서도 Q 는 Q (e.key 는 'ㅂ' 이 된다)
 *  - 입력칸(input · textarea)에 글자를 칠 때는 건드리지 않는다 (Esc 만 창 닫기)
 *  - 포커스 표시 = 2px 딱딱한 금색 테 + 1px 검은 바깥 테 (흐린 그림자 · 글로우 없음) · 마우스 · 터치를 쓰면 숨김
 *  - 좀비와 드래곤 화면(html.idg-lobby-on · html.idg-wide)에서만 일한다 — 다른 게임 · 화면은 그대로
 *  - 계정 저장 · 서버 없음 : 읽기 · 쓰기는 모두 try/catch
 */
import '../styles/idg-keys.css';
import { closeTopOverlay } from './ui.js';
import { isPhone } from '../games/iandragon_game/render/rot.js';

/* ───────────────────────── 1) 키 설정 ───────────────────────── */
const STORE = 'idg_keys';
const DIGITS = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0'];
const NUMPADS = ['Numpad1', 'Numpad2', 'Numpad3', 'Numpad4', 'Numpad5', 'Numpad6', 'Numpad7', 'Numpad8', 'Numpad9', 'Numpad0'];   // 숫자패드가 있는 키보드 : 같은 칸 (88키처럼 없으면 위 숫자줄만)
/** 동작 목록 (설정 표가 이 순서로 보여 준다) — id · 이름 · 묶음 · 기본 키(1~2개) */
export const KEY_ACTIONS = [
  ...DIGITS.map((c, i) => ({ id: `spawn${i + 1}`, label: `출전 ${i + 1}번`, group: '출전 칸', def: [c, NUMPADS[i]] })),
  { id: 'wallet', label: '화로 레벨업', group: '싸움 도구', def: ['Backquote', 'KeyA'] },   // 대표님 11/13 : ` 와 A 둘 다
  { id: 'skill1', label: '필살기 1', group: '싸움 도구', def: ['KeyQ'] },
  { id: 'skill2', label: '필살기 2', group: '싸움 도구', def: ['KeyW'] },
  { id: 'skill3', label: '필살기 3', group: '싸움 도구', def: ['KeyE'] },
  { id: 'skill4', label: '필살기 4', group: '싸움 도구', def: ['KeyR'] },
  { id: 'rage', label: '으르렁', group: '싸움 도구', def: ['KeyT'] },
  { id: 'breath', label: '브레스 (누르고 있으면 사거리)', group: '싸움 도구', def: ['Space'] },
  { id: 'zoomIn', label: '맵 최대 확대', group: '화면 · 속도', def: ['NumpadAdd', 'Equal', 'ArrowUp'] },   // + 와 ↑ (전투 중 · 창이 없을 때)
  { id: 'zoomOut', label: '맵 최소 축소', group: '화면 · 속도', def: ['NumpadSubtract', 'Minus', 'ArrowDown'] },
  { id: 'panL', label: '화면 왼쪽으로 (누르고 있기)', group: '화면 · 속도', def: ['ArrowLeft'] },
  { id: 'panR', label: '화면 오른쪽으로 (누르고 있기)', group: '화면 · 속도', def: ['ArrowRight'] },
  { id: 'speed', label: '2배속 켜기 · 끄기', group: '화면 · 속도', def: ['Tab'] },
  { id: 'pause', label: '일시정지 · 이어하기', group: '화면 · 속도', def: ['KeyP'] },
  { id: 'fullscreen', label: '전체화면 켜기 · 끄기', group: '화면 · 속도', def: ['KeyF'] },
  { id: 'retry', label: '다시하기 (결과 창 · 파워업 창)', group: '창', def: ['KeyR'], ctx: 'panel' },   // 창이 떠 있을 때만 — 필살기 4(R)와 같은 키여도 겹치지 않는다
];
/** 바꿀 수 없는 키 (표 맨 아래에 «고정» 으로 보여 준다) */
export const FIXED_KEYS = [
  { keys: 'Esc', label: '전투 중 = 일시정지 · 창이 떠 있으면 = 그 창 닫기 (일시정지 창은 이어하기) · 전체화면에서는 브라우저가 먼저 써서 P 키가 더 확실해요' },
  { keys: 'Enter', label: '창이 떠 있으면 = 고른 단추 누르기 (처음엔 빨간 주 단추) · 싸움 중 = 전체화면 켜기 · 끄기 (F 와 같음)' },
  { keys: '↑ ↓ ← →', label: '로비 · 모든 창에서 단추 옮기기 (싸움 중에는 ↑ ↓ = 확대 · 축소 · ← → = 화면 옮기기)' },
];
/** 쓸 수 없는 키 : 창 · 단추 옮기기와 닫기용 + 브라우저 기능 */
const RESERVED = new Set(['Escape', 'Enter', 'NumpadEnter', 'F1', 'F3', 'F5', 'F6', 'F11', 'F12', 'ContextMenu']);
const MODS = new Set(['ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight', 'MetaLeft', 'MetaRight', 'CapsLock', 'NumLock', 'ScrollLock', 'Lang1', 'Lang2', 'HangulMode', 'HanjaMode']);

const defaults = () => Object.fromEntries(KEY_ACTIONS.map((a) => [a.id, a.def.slice()]));
let map = load();
let rev = null;   // code → action id
const listeners = new Set();

function load() {
  const d = defaults();
  try {
    const raw = localStorage.getItem(STORE); if (!raw) return d;
    const o = JSON.parse(raw), out = {}, seen = new Set();
    for (const a of KEY_ACTIONS) {
      const v = o?.[a.id];
      const list = Array.isArray(v) ? v.filter((c) => typeof c === 'string' && /^[A-Za-z0-9]{1,20}$/.test(c) && !RESERVED.has(c) && !MODS.has(c)).slice(0, 3) : null;
      out[a.id] = list && list.length ? list : d[a.id];
      if (!a.ctx) for (const c of out[a.id]) { if (seen.has(c)) return d; seen.add(c); }   // 창 전용(ctx) 키는 전투 키와 겹쳐도 됨   // 겹치면 저장값 통째로 버리고 처음대로
    }
    return out;
  } catch { return d; }
}
function save() {
  try { localStorage.setItem(STORE, JSON.stringify(map)); } catch { /* 저장 실패는 이번 접속에서만 적용 */ }
  rev = null; listeners.forEach((f) => { try { f(); } catch { /* */ } });
}
export const keysOf = (id) => map[id] || [];
export function actionOf(code) {
  if (!rev) { rev = new Map(); const ctx = new Set(KEY_ACTIONS.filter((a) => a.ctx).map((a) => a.id)); for (const [id, list] of Object.entries(map)) if (!ctx.has(id)) for (const c of list) rev.set(c, id); }
  return rev.get(code) || null;
}
export const isDefaultKeys = () => KEY_ACTIONS.every((a) => map[a.id].length === a.def.length && map[a.id].every((c, i) => c === a.def[i]));
export function resetKeys() { map = defaults(); save(); }
export const onKeysChange = (f) => { listeners.add(f); return () => listeners.delete(f); };
export const keyUsable = (code) => !RESERVED.has(code) && !MODS.has(code);
/**
 * id 동작의 키를 code 하나로 바꾼다. 같은 키가 이미 다른 동작에 쓰이면 두 동작의 키를 서로 맞바꾼다.
 * @returns {{ok:boolean, swapped?:string, error?:string}}
 */
export function setKey(id, code) {
  if (!keyUsable(code)) return { ok: false, error: '이 키는 쓸 수 없어요' };
  if (KEY_ACTIONS.find((a) => a.id === id)?.ctx) { map[id] = [code]; save(); return { ok: true }; }   // 창 전용 키는 맞바꾸지 않음
  const other = actionOf(code);
  if (other === id) { map[id] = [code]; save(); return { ok: true }; }
  const mine = map[id];
  if (other) { map[other] = map[other].filter((c) => c !== code); map[other] = [...map[other], ...mine].slice(0, 3); if (!map[other].length) map[other] = mine.slice(0, 1); }
  map[id] = [code];
  save();
  return { ok: true, swapped: other || undefined };
}
const NAMES = { Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Backslash: '\\', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Space: 'Space', Tab: 'Tab', ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', NumpadAdd: 'Num +', NumpadSubtract: 'Num −', NumpadMultiply: 'Num ×', NumpadDivide: 'Num ÷', NumpadDecimal: 'Num .', NumpadEnter: 'Num Enter', Escape: 'Esc', Backspace: 'Backspace', Delete: 'Delete', Insert: 'Insert', Home: 'Home', End: 'End', PageUp: 'PageUp', PageDown: 'PageDown', IntlBackslash: '\\', IntlRo: '\\' };
export function keyName(code) {
  if (NAMES[code]) return NAMES[code];
  let m = /^Key([A-Z])$/.exec(code); if (m) return m[1];
  m = /^Digit(\d)$/.exec(code); if (m) return m[1];
  m = /^Numpad(\d)$/.exec(code); if (m) return `Num ${m[1]}`;
  return code;
}
export const keyLabel = (id) => keysOf(id).map(keyName).join(' / ');

/** 키 바꾸기 : 다음에 누른 키 하나를 받는다. cb(code) → true 면 끝(받은 것으로 확정) · false 면 계속 기다림. Esc = 취소 → cb(null). node 가 사라지면 저절로 취소 */
let capture = null;
export function captureKey(node, cb) { capture = { node, cb }; }
export function cancelCapture() { if (capture) { const c = capture; capture = null; c.cb(null); } }
export const capturing = () => !!capture;
/** 전투 판의 내용이 통째로 바뀌었다 (일시정지 → 파워업 …) : 옛 포커스 기억을 버리고 새 판의 주 단추부터 */
export function resetKeyFocus() { if (battle) saved.delete(battle.panelNode); }

/* ───────────────────────── 2) 전투 등록 ───────────────────────── */
/** @type {null | { run:(id:string, down:boolean)=>void, esc:()=>void, fs:()=>void, panel:()=>(HTMLElement|null), panelNode:HTMLElement, release:()=>void }} */
let battle = null;
const HOLD = new Set(['panL', 'panR', 'breath']);   // 누르고 있는 동안 의미가 있는 동작 (keyup 도 알려 준다 · 반복 입력 허용)
const HELD_ONLY = new Set(['panL', 'panR']);
export function bindBattleKeys(api) {
  battle = api; syncEscLock(); watchBattle(); schedule();
  return () => { if (battle === api) { battle = null; syncEscLock(); schedule(); } };
}

/* ───────────────────────── 3) 공통 도우미 ───────────────────────── */
const root = document.documentElement;
const inIdg = () => root.classList.contains('idg-lobby-on') || root.classList.contains('idg-wide');
const TEXT_TYPES = /^(text|search|number|email|tel|url|password|date|time)$/;
const isTyping = (t) => !!t && t.nodeType === 1 && (t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable || (t.tagName === 'INPUT' && TEXT_TYPES.test(t.type || 'text')));
const isRange = (t) => !!t && t.tagName === 'INPUT' && t.type === 'range';

/** 지금 키보드 주인 창 : 맨 위 팝업 → (전투) 열린 판 → (로비) 로비 본판 → 없으면 null */
function topScope() {
  let ov = null;
  for (const n of document.body.children) if (n.nodeType === 1 && n.isConnected && (n.classList.contains('dialog-overlay') || n.classList.contains('idg-cx-big'))) ov = n;
  if (ov) return ov;
  if (battle) return battle.panel() || null;
  if (root.classList.contains('idg-lobby-on')) return document.querySelector('.idg-lobby2') || document.getElementById('ui');
  return null;
}
const isWindow = (sc) => !!sc && (sc.classList.contains('dialog-overlay') || (battle && sc === battle.panelNode));

/* 누를 수 있는 것 찾기 */
const NATIVE = 'button, [role="button"], [role="tab"], [role="switch"], [role="checkbox"], [role="radio"], a[href], input:not([type="hidden"]), select, textarea, [tabindex]';
const POINTER_TAGS = new Set(['DIV', 'LI', 'SPAN', 'IMG', 'LABEL', 'SECTION', 'ARTICLE', 'FIGURE', 'P', 'B', 'I', 'EM']);
function usable(el) {
  if (el.disabled || el.hidden || el.closest('[inert]')) return false;
  const r = el.getBoundingClientRect(); if (r.width < 4 || r.height < 4) return false;
  const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none') return false;
  if (cs.pointerEvents === 'none' && !el.matches('[role="button"][tabindex], [tabindex="0"]')) return false;   // 손이 안 닿는 장식은 뺀다 (스스로 «누르는 칸»이라 밝힌 것은 둔다)
  return true;
}
function candidates(scope) {
  const native = [...scope.querySelectorAll(NATIVE)].filter((el) => {
    const ti = el.getAttribute('tabindex'), role = el.getAttribute('role') || '';
    const nat = /^(BUTTON|A|INPUT|SELECT|TEXTAREA)$/.test(el.tagName);
    if (!nat && ti === '-1' && !/^(button|tab|switch|checkbox|radio)$/.test(role)) return false;
    return usable(el);
  });
  const set = new Set(native);
  /* 손으로 누르는 칸인데 단추가 아닌 것(카드 · 줄) : 마우스 손 모양(cursor:pointer)의 맨 바깥 칸 */
  const ptr = [];
  for (const el of scope.querySelectorAll('div, li, label, section, article, figure')) {
    if (set.has(el) || !POINTER_TAGS.has(el.tagName)) continue;
    const cs = getComputedStyle(el); if (cs.cursor !== 'pointer') continue;
    const par = el.parentElement; if (par && par !== scope && getComputedStyle(par).cursor === 'pointer') continue;
    if (el.closest('button, [role="button"], a[href]')) continue;
    if (usable(el)) { ptr.push(el); }
  }
  const all = [...native, ...ptr];
  /* 안에 다른 누를 것이 든 «단추 아닌 바깥 칸»은 뺀다 (스크롤 목록 · 줄) · 손 모양 카드는 안의 단추와 둘 다 둔다 */
  const ptrSet = new Set(ptr);
  const out = all.filter((c) => {
    if (ptrSet.has(c)) return true;
    if (c.getAttribute('role') === 'button' || c.tagName === 'BUTTON' || c.tagName === 'A') return true;
    return !all.some((d) => d !== c && c.contains(d));
  });
  /* 누를 수 있는 바깥 칸(role=button) 안에 든 것은 바깥 칸 하나로 */
  return out.filter((c) => { for (let p = c.parentElement; p && p !== scope; p = p.parentElement) if (p.getAttribute('role') === 'button' && out.includes(p) && p !== c) return false; return true; });
}

/* 처음 잡을 단추 : 주 단추(빨강) → 그 창의 대표 칸 → 닫기(X)가 아닌 첫 단추 → 닫기 */
const DEFAULTS = ['[data-kdef]', '.idg-res-btn.red', '.idg-k-btn.red', '.l2-btn.red.go', '.idg-btn.main.big', '.idg-btn.main', '.idg-k-btn.green', '.idg-pp-x'];
const SPEND = '.price, .idg-sp-buy, .idg-buy, .idg-pp-up';   // 돈이 나가는 단추는 «처음 자리»로 잡지 않는다 (창을 열자마자 Enter 로 사 버리지 않게)
function defaultOf(scope, list0) {
  const safe = list0.filter((el) => !el.matches(SPEND));
  const list = safe.some((el) => !el.classList.contains('idg-k-close')) ? safe : list0;
  const has = (el) => list.includes(el);
  for (const s of DEFAULTS) { const el = [...scope.querySelectorAll(s)].find(has); if (el) return el; }
  const stages = [...scope.querySelectorAll('.idg-stage-btn')].filter(has); if (stages.length) return stages[stages.length - 1];   // 스테이지 고르기 : 열린 마지막 판
  const first = list.find((el) => !el.classList.contains('idg-k-close') && !isRange(el));
  return first || list[0] || null;
}

/* 공간 이동 : 그 방향으로 가장 가까운 것
 *  1차 = 그 방향 «옆» 에 완전히 놓인 것(가장자리가 겹치지 않음) 중 · 가장자리 간격 + 어긋난 정도가 작은 것
 *  2차(1차가 비면) = 가운데 점이 그 방향에 있는 것 (큰 칸 안의 작은 칸 · 겹친 칸) */
function pickDir(cur, list, dir) {
  const c = cur.getBoundingClientRect(), ccx = c.left + c.width / 2, ccy = c.top + c.height / 2, horiz = dir === 'left' || dir === 'right';
  /* 카드(바깥 칸) ↔ 그 안의 단추 : 아래로 = 카드 안 단추 · 위로 = 단추가 든 카드 */
  if (dir === 'down') { const inner = list.filter((e) => e !== cur && cur.contains(e) && e.getBoundingClientRect().top >= ccy - 2).sort((p, q) => p.getBoundingClientRect().top - q.getBoundingClientRect().top)[0]; if (inner) return inner; }
  if (dir === 'up') { const par = list.find((e) => e !== cur && e.contains(cur)); if (par) return par; }
  let best = null, bs = Infinity, best2 = null, bs2 = Infinity;
  for (const el of list) {
    if (el === cur || el.contains(cur) || cur.contains(el)) continue;
    const r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const edge = dir === 'right' ? r.left - c.right : dir === 'left' ? c.left - r.right : dir === 'down' ? r.top - c.bottom : c.top - r.bottom;
    const center = dir === 'right' ? cx - ccx : dir === 'left' ? ccx - cx : dir === 'down' ? cy - ccy : ccy - cy;
    if (center <= 2) continue;
    const gap = horiz ? Math.max(0, Math.max(r.top - c.bottom, c.top - r.bottom)) : Math.max(0, Math.max(r.left - c.right, c.left - r.right));   // 가로로 갈 때 위아래 어긋남(겹치면 0)
    const off = horiz ? Math.abs(cy - ccy) : Math.abs(cx - ccx);
    if (edge >= -4) { const s = Math.max(0, edge) + off * 1.5 + gap * 4; if (s < bs) { bs = s; best = el; } }
    const s2 = center + off * 2.2 + gap * 6; if (s2 < bs2) { bs2 = s2; best2 = el; }
  }
  return best || best2;
}
const sigOf = (el) => `${el.tagName}.${(el.className && el.className.baseVal === undefined ? el.className : '').toString().replace(/\b(on|sel|focus|hover|active|pop)\b/g, '').trim()}|${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 14)}`;
/** 다시 그려져 사라진 것의 «닮은 것» : 같은 서명 중 옛 자리에 가장 가까운 것 → 없으면 옛 자리에 가장 가까운 것 */
function findLike(list, saved) {
  const near = (arr) => arr.map((el) => { const r = el.getBoundingClientRect(); return [el, Math.hypot(r.left + r.width / 2 - saved.x, r.top + r.height / 2 - saved.y)]; }).sort((a, b) => a[1] - b[1])[0]?.[0] || null;
  const same = list.filter((el) => sigOf(el) === saved.sig);
  return near(same.length ? same : list);
}

/** 가려지지 않게 스크롤 칸 안으로 (칸 가장자리에서 여유를 둔다) */
function reveal(el) {
  for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
    if (p.scrollHeight - p.clientHeight <= 2) continue;
    const oy = getComputedStyle(p).overflowY; if (oy !== 'auto' && oy !== 'scroll') continue;
    const pr = p.getBoundingClientRect(), r = el.getBoundingClientRect(), m = Math.min(28, pr.height * 0.2);
    if (r.top < pr.top + m) p.scrollTop -= pr.top + m - r.top;
    else if (r.bottom > pr.bottom - m) p.scrollTop += r.bottom - (pr.bottom - m);
  }
}
function scrollNear(el, scope, dy) {
  for (let p = el?.parentElement || null; p && p !== document.body; p = p.parentElement) {
    if (p.scrollHeight - p.clientHeight > 2) { const oy = getComputedStyle(p).overflowY; if (oy === 'auto' || oy === 'scroll') { const b = p.scrollTop; p.scrollTop += dy; if (p.scrollTop !== b) return true; } }
    if (p === scope) break;
  }
  const body = scope.querySelector('.idg-dlg-body, .idg-res-body, .idg-k-win-body'); if (body && body.scrollHeight - body.clientHeight > 2) { const b = body.scrollTop; body.scrollTop += dy; return body.scrollTop !== b; }
  return false;
}

/* ───────────────────────── 4) 포커스 · 테두리 ───────────────────────── */
let kb = false;                 // 키보드로 쓰는 중 (포커스 테두리를 보인다)
let curScope = null;
const saved = new Map();        // 창(또는 'base' = 로비 본판 — 다시 그려도 같은 칸) → { sig, x, y }  (닫았다 돌아올 때 · 다시 그려졌을 때)
const BASE = 'base';
const skey = (sc) => (sc && (sc.classList.contains('dialog-overlay') || (battle && sc === battle.panelNode)) ? sc : BASE);
let lastFocus = null;
function setKb(on) { if (kb === on) return; kb = on; root.classList.toggle('idg-kb', on); ring(); }
function remember(el, sc) { const r = el.getBoundingClientRect(); saved.set(skey(sc || curScope), { sig: sigOf(el), x: r.left + r.width / 2, y: r.top + r.height / 2 }); lastFocus = el; }
function focusEl(el, sc) {
  if (!el) return;
  if (!el.hasAttribute('tabindex') && !/^(BUTTON|A|INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) el.setAttribute('tabindex', '-1');   // 손 모양 카드(div)도 포커스를 받게
  try { el.focus({ preventScroll: true }); } catch { /* */ }
  reveal(el); remember(el, sc || curScope); ring();
}

let ringEl = null, ringRaf = 0;
function ring() {
  const a = document.activeElement;
  const show = kb && inIdg() && curScope && a && a !== document.body && a !== document.documentElement && a.isConnected && curScope.contains(a);
  if (!show) { if (ringEl) ringEl.classList.remove('on'); ringRaf = 0; return; }
  if (!ringEl) { ringEl = document.createElement('div'); ringEl.className = 'idg-kring'; ringEl.setAttribute('aria-hidden', 'true'); document.body.appendChild(ringEl); }
  const r = a.getBoundingClientRect();
  if (!r.width || !r.height) { ringEl.classList.remove('on'); ringRaf = 0; return; }
  const x = Math.round(r.left) - 2, y = Math.round(r.top) - 2, w = Math.round(r.width) + 4, h = Math.round(r.height) + 4;
  ringEl.style.cssText = `transform:translate(${x}px,${y}px);width:${w}px;height:${h}px;border-radius:${getComputedStyle(a).borderTopLeftRadius || 0}`;
  ringEl.classList.add('on');
  if (!ringRaf) ringRaf = requestAnimationFrame(() => { ringRaf = 0; ring(); });
}

/* 맨 위 창이 바뀌면 포커스를 옮긴다 · 다시 그려져 포커스를 잃으면 닮은 것으로 */
let queued = false, mo = null, moScope = null, moPanel = null;
function schedule() { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; sync(); }); }
function lost(sc) { const a = document.activeElement; return !a || a === document.body || a === document.documentElement || !sc.contains(a) || !a.isConnected; }
function sync() {
  if (!inIdg()) { curScope = null; ring(); return; }
  const sc = topScope();
  if (sc !== curScope) {
    if (curScope && !lost(curScope)) remember(document.activeElement, curScope);
    if (battle && curScope === battle.panelNode) saved.delete(curScope);   // 판은 같은 상자에 다른 내용이 들어온다 — 닫으면 기억을 버린다
    for (const k of saved.keys()) if (k !== BASE && !k.isConnected) saved.delete(k);   // 닫힌 창의 기억은 버린다
    curScope = sc;
    if (moScope !== sc) { mo?.disconnect(); moScope = sc; if (sc) mo.observe(sc, { childList: true, subtree: true }); }
    if (sc && sc.classList.contains('idg-cx-big')) { ring(); return; }
    if (sc && (isWindow(sc) || kb)) enterScope(sc);
    ring(); return;
  }
  if (sc && lost(sc) && (kb || isWindow(sc))) { if (!isTyping(document.activeElement)) enterScope(sc); }
  else if (settle && settle.sc === sc && performance.now() < settle.until) { const list = candidates(sc), d = list.length ? defaultOf(sc, list) : null; if (d && d !== document.activeElement) focusEl(d, sc); }
  ring();
}
/** 창이 막 열렸을 때 : 내용이 늦게 채워지는 창이 있어서, 0.7초 안에는 사람이 아직 안 움직였으면 «주 단추»를 다시 고른다 */
let settle = null;
function enterScope(sc) {
  const list = candidates(sc); if (!list.length) return;
  const s = saved.get(skey(sc));
  const el = s ? findLike(list, s) : defaultOf(sc, list);
  focusEl(el, sc);
  settle = s || !isWindow(sc) ? null : { sc, until: performance.now() + 700 };
}
function watchBattle() { moPanel?.disconnect(); if (!battle) return; moPanel = new MutationObserver(schedule); moPanel.observe(battle.panelNode, { attributes: true, attributeFilter: ['class'], childList: true }); }
function installObservers() {
  mo = new MutationObserver(schedule);
  new MutationObserver(schedule).observe(document.body, { childList: true });
  new MutationObserver(schedule).observe(root, { attributes: true, attributeFilter: ['class'] });
  const ui = document.getElementById('ui'); if (ui) new MutationObserver(schedule).observe(ui, { childList: true });
  schedule();
}

/* ───────────────────────── 5) 키 처리 ───────────────────────── */
const DIRS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
const stop = (e) => { e.preventDefault(); e.stopImmediatePropagation(); };

function onKeyDown(e) {
  if (inIdg() && !MODS.has(e.code)) setHint(true);   // 키보드를 한 번이라도 쓰면 단추 귀퉁이에 키 글자
  if (!inIdg() || (e.isComposing && isTyping(e.target))) return;   // 한글 조합은 글자 입력칸에서만 — 칸이 없으면 한/영 상태와 상관없이 e.code 로 본다
  if (capture) { handleCapture(e); return; }
  if (e.ctrlKey || e.altKey || e.metaKey) return;
  const t = e.target, typing = isTyping(t);
  const sc = topScope();
  if (sc && sc.classList.contains('idg-cx-big')) return;   // 도감 큰 그림 보기는 자기 키를 쓴다
  const code = e.code;
  if (sc) {
    sync();   // 창이 막 열렸으면 먼저 맞춘다
    if (code === 'Escape') { stop(e); if (!e.repeat) escScope(sc); return; }
    if (typing) return;
    if (battle && sc === battle.panelNode) {   // 전투 판(일시정지 · 시작 · 결과)이 떠 있어도 P(이어하기) · F(전체화면)는 먹는다
      const a = actionOf(code);
      if (a === 'pause' || a === 'fullscreen') { stop(e); if (!e.repeat) { if (a === 'pause') battle.run('pause', true); else battle.fs(); } return; }
    }
    if ((map.retry || []).includes(code) && !typing) {   /* 다시하기 (대표님 11/13 «Enter 그대로 + R») — 창 안에 «다시하기» 단추가 있으면 누른다 */
      const rb = [...sc.querySelectorAll('button')].find((x) => x.offsetParent && /다시하기/.test(x.textContent));
      if (rb) { stop(e); if (!e.repeat) rb.click(); return; }
    }
    if (code in DIRS) {
      if (isRange(t) && (code === 'ArrowLeft' || code === 'ArrowRight')) return;   // 슬라이더는 좌우로 값 바꾸기
      stop(e); setKb(true); moveDir(sc, DIRS[code]); return;
    }
    if (code === 'Tab') { stop(e); setKb(true); moveSeq(sc, e.shiftKey ? -1 : 1); return; }
    if (code === 'Enter' || code === 'NumpadEnter' || code === 'Space') {
      if (isRange(t)) { if (code === 'Space') return; stop(e); return; }
      stop(e); if (e.repeat) return; setKb(true); press(sc); return;
    }
    return;
  }
  if (battle && !typing) {
    if (code === 'Escape') { stop(e); if (!e.repeat) battle.esc(); return; }
    if (code === 'Enter' || code === 'NumpadEnter') { stop(e); if (!e.repeat) battle.fs(); return; }
    const id = actionOf(code);
    if (id) {
      stop(e);   // 브라우저 기본 동작(Tab 포커스 이동 · Space 페이지 스크롤 · 화살표 스크롤) 막기
      if (e.repeat && !HELD_ONLY.has(id)) return;   // 꾹 눌러도 한 번만 (← → 화면 옮기기만 누르는 동안 계속)
      if (id === 'fullscreen') battle.fs(); else battle.run(id, true);
      return;
    }
    /* 안 쓰는 화살표 · Tab · Space(페이지 스크롤) 가 브라우저로 새지 않게 */
    if (code === 'ArrowUp' || code === 'ArrowDown' || code === 'ArrowLeft' || code === 'ArrowRight' || code === 'Tab' || code === 'Space') stop(e);
  }
}
function onKeyUp(e) {
  if (!inIdg()) return;
  if (capture) { stop(e); return; }
  if (!battle || topScope() || isTyping(e.target)) return;
  const id = actionOf(e.code);
  if (id) { stop(e); if (HOLD.has(id)) battle.run(id, false); }
  else if (e.code === 'Enter' || e.code === 'Space') stop(e);
}
function handleCapture(e) {
  if (!capture.node.isConnected) { capture = null; return; }
  stop(e);
  if (e.repeat || MODS.has(e.code)) return;
  const c = capture;
  if (e.code === 'Escape') { capture = null; c.cb(null); return; }
  if (c.cb(e.code) !== false) capture = null;
}

function moveDir(sc, dir) {
  settle = null;
  const list = candidates(sc); if (!list.length) return;
  const a = document.activeElement;
  if (!a || !list.includes(a)) {   // 포커스가 없으면 먼저 «처음 자리»를 잡는다 (갑자기 옮기지 않는다)
    const s = saved.get(skey(sc)); focusEl(s ? findLike(list, s) : defaultOf(sc, list), sc); return;
  }
  const next = pickDir(a, list, dir);
  if (next) { focusEl(next, sc); return; }
  if (dir === 'up' || dir === 'down') scrollNear(a, sc, dir === 'down' ? 90 : -90);   // 더 갈 곳이 없으면 글만 있는 칸을 내린다
}
function moveSeq(sc, step) {
  settle = null;
  const list = candidates(sc).sort((p, q) => (p.compareDocumentPosition(q) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1)); if (!list.length) return;
  const i = list.indexOf(document.activeElement);
  focusEl(i < 0 ? defaultOf(sc, list) : list[(i + step + list.length) % list.length], sc);
}
function press(sc) {
  const list = candidates(sc), a = document.activeElement;
  if (a && list.includes(a)) { if (a.tagName === 'SELECT') return; a.click(); return; }
  const s = saved.get(skey(sc)); focusEl(s ? findLike(list, s) : defaultOf(sc, list), sc);   // 잃었으면 잡기만
}
function escScope(sc) {
  if (battle && sc === battle.panelNode) { battle.esc(); return; }
  if (sc.classList.contains('dialog-overlay')) {
    const x = [...sc.querySelectorAll('.idg-k-close')].find(usable);
    if (x) x.click(); else closeTopOverlay();
  }
  /* 로비 본판 : 아무것도 안 함 (오락실로 나가기는 «이안오락실로» 단추) */
}

/* ───────────────────────── 6) 전체화면 · Esc 잠금 ───────────────────────── */
/** 전투 중 전체화면이면 Esc 도 게임이 받게 (크롬 키보드 잠금 — 길게 누르면 전체화면 풀림). 안 되는 브라우저는 그대로 */
function syncEscLock() {
  try {
    const k = navigator.keyboard; if (!k) return;
    if (battle && document.fullscreenElement) k.lock?.(['Escape'])?.catch?.(() => {}); else k.unlock?.();
  } catch { /* */ }
}

/* ───────────────────────── 7) 단추 귀퉁이 키 글자 ───────────────────────── */
/** 키보드를 쓰면(또는 폰이 아닌 기기면) 보이고, 터치를 쓰면 숨는다 — html.idg-kh-on · 글씨는 도트 1px 외곽선(CSS) */
let hint = null;
function setHint(on) { if (hint === on) return; hint = on; root.classList.toggle('idg-kh-on', on); }
/** map = { 동작 id : 단추 } — 단추 안에 키 글자 칸(i.idg-khint)을 넣고, 키를 바꾸면 글자도 바뀐다. 돌려주는 함수 = 해제 */
export function hintKeys(map) {
  if (hint === null) { let ph = false; try { ph = isPhone(); } catch { /* */ } setHint(!ph); }
  const tags = [];
  for (const [id, b] of Object.entries(map)) { if (!b) continue; const t = document.createElement('i'); t.className = 'idg-khint'; t.setAttribute('aria-hidden', 'true'); b.appendChild(t); tags.push([id, t]); }
  const paint = () => { for (const [id, t] of tags) { const c = keysOf(id)[0] || ''; t.textContent = keyName(c); t.classList.toggle('sym', /^(Backquote|Minus|Equal|Comma|Period|Quote|Semicolon)$/.test(c)); } };   // 점 같은 기호 글자는 작아서 크게
  paint();
  const un = onKeysChange(paint);
  return () => { un(); for (const [, t] of tags) t.remove(); };
}

/* ───────────────────────── 설치 ───────────────────────── */
let installed = false;
export function installIdgKeys() {
  if (installed || typeof window === 'undefined') return; installed = true;
  window.addEventListener('keydown', onKeyDown, true);
  window.addEventListener('keyup', onKeyUp, true);
  window.addEventListener('blur', () => battle?.release());
  /* 마우스 · 터치를 쓰면 포커스 테두리를 숨긴다 (마우스가 «실제로» 움직였을 때만 · 화면이 바뀌며 생긴 가짜 움직임은 무시) */
  const off = () => setKb(false);
  window.addEventListener('pointerdown', (e) => { off(); if (e.pointerType === 'touch') setHint(false); }, true);
  window.addEventListener('touchstart', () => { off(); setHint(false); }, { capture: true, passive: true });
  window.addEventListener('mousemove', (e) => { if (e.movementX || e.movementY) off(); }, { capture: true, passive: true });
  document.addEventListener('focusin', () => ring());
  document.addEventListener('fullscreenchange', syncEscLock);
  window.addEventListener('resize', () => ring());
  if (document.body) installObservers(); else document.addEventListener('DOMContentLoaded', installObservers, { once: true });
}
installIdgKeys();
/* 점검용 (개발 서버에서만) : 누를 수 있는 것 목록 · 이웃 계산 */
if (import.meta.env?.DEV) window.__idgKeysDbg = { topScope, candidates, pickDir, defaultOf, sigOf };
