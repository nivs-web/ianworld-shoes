/**
 * DOM 화면용 최소 헬퍼. 프레임워크를 안 쓰기로 했으므로(CLAUDE.md §2)
 * innerHTML 문자열 조립 대신 이 몇 개로 트리를 만든다.
 * 문자열 조립은 이벤트 연결이 지저분해지고 XSS 사고가 나기 쉽다.
 */

import * as Sfx from '../audio/sfx.js';

/**
 * @param {string} tag  'div.klass.klass2' 형태 허용
 * @param {object|string} [props] 문자열이면 textContent
 * @param {Array<Node|string|null|false>} [children]
 */
export function el(tag, props, children) {
  const [name, ...classes] = tag.split('.');
  const node = document.createElement(name || 'div');
  if (classes.length) node.className = classes.join(' ');

  if (typeof props === 'string') {
    node.textContent = props;
  } else if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'text') node.textContent = v;
      else if (k === 'html') node.innerHTML = v;
      else if (k === 'class') node.className = [node.className, v].filter(Boolean).join(' ');
      else if (k === 'style') Object.assign(node.style, v);
      else if (k.startsWith('on')) node.addEventListener(k.slice(2).toLowerCase(), v);
      else node.setAttribute(k, v === true ? '' : String(v));
    }
  }
  for (const c of children ?? []) {
    if (c === null || c === undefined || c === false) continue;
    node.append(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return node;
}

/**
 * 픽셀 버튼. 클릭음이 자동으로 붙는다 — 화면마다 따로 부르면 빠뜨린다.
 * @param {string} label
 * @param {() => void} onClick
 * @param {{primary?:boolean, disabled?:boolean, sfx?:string, class?:string}} [opt]
 */
export function button(label, onClick, opt = {}) {
  const cls = ['pbtn', opt.primary && 'primary', opt.class].filter(Boolean).join(' ');
  return el('button', {
    class: cls,
    text: label,
    disabled: !!opt.disabled,
    type: 'button',
    onclick: (e) => {
      if (opt.disabled) return;
      Sfx.play(opt.sfx ?? 'sfx_menu_select');
      onClick(e);
    },
  });
}

/** 뒤로 가기 버튼 — 소리만 다르다 */
export function backButton(label, onClick) {
  return button(label, onClick, { sfx: 'sfx_menu_back' });
}

/** 가로로 나열되는 선택지 (난이도·조작법 등). value 가 바뀌면 onPick 호출 */
export function segmented(options, value, onPick) {
  const wrap = el('div.seg');
  for (const o of options) {
    wrap.append(
      button(o.label, () => onPick(o.value), {
        class: o.value === value ? 'on' : '',
        sfx: 'sfx_menu_move',
      })
    );
  }
  return wrap;
}

export function title(text) {
  return el('div.screen-title', text);
}

/** 화면 전체를 감싸는 컨테이너 */
export function screen(...children) {
  return el('div.screen', null, children.flat());
}

/** 간단한 확인 다이얼로그. Promise<boolean> */
export function confirmDialog({ message, detail, yes, no }) {
  return new Promise((resolve) => {
    const close = (v) => { overlay.remove(); resolve(v); };
    const overlay = el('div.dialog-overlay', null, [
      el('div.dialog', null, [
        el('div.dialog-msg', message),
        detail ? el('div.dialog-detail', detail) : null,
        el('div.row', null, [
          button(no ?? '취소', () => close(false), { sfx: 'sfx_menu_back' }),
          button(yes ?? '확인', () => close(true), { primary: true }),
        ]),
      ]),
    ]);
    document.body.append(overlay);
  });
}

/** 잠깐 떴다 사라지는 알림 */
export function toast(message, ms = 1600) {
  const t = el('div.toast', message);
  document.body.append(t);
  setTimeout(() => t.remove(), ms);
}
