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
      else if (k === 'style') {
        /**
         * 문자열도 받는다 — `style: 'width:360px'`. 예전엔 객체만 받아서 문자열을 주면
         * `Object.assign` 이 **글자 하나씩** 넣으려다 "Indexed property setter is not
         * supported" 로 터졌다(무엇이 잘못됐는지 알 수 없는 메시지다).
         */
        if (typeof v === 'string') { node.style.cssText = v; continue; }
        /**
         * ★ **CSS 변수(`--x`)는 `Object.assign` 으로 안 들어간다.** (2026-08-19)
         * 자리 색을 `--slot` 으로 넘겼는데 조용히 무시돼서 결과 화면의 부활 테두리가
         * 통째로 안 보였다(미리보기로 확인). 사용자 정의 속성은 `setProperty` 로 넣는다.
         */
        for (const [ck, cv] of Object.entries(v)) {
          if (ck.startsWith('--')) node.style.setProperty(ck, cv);
          else node.style[ck] = cv;
        }
      }
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
 * @param {{primary?:boolean, disabled?:boolean, sfx?:string, class?:string,
 *           icons?:Array<Node|null>}} [opt]
 *   `icons` 는 글자 **양옆**에 놓을 그림 둘 (2026-08-19 23차 — [멀티게임순위] 의 왕관).
 *   버튼마다 마크업을 따로 짜지 않으려고 여기 한 곳에서만 만든다.
 */
export function button(label, onClick, opt = {}) {
  const cls = ['pbtn', opt.primary && 'primary', opt.class].filter(Boolean).join(' ');
  const icons = (opt.icons ?? []).filter(Boolean);
  const node = el('button', {
    class: cls,
    // 그림이 있으면 글자를 span 으로 감싼다 — textContent 를 쓰면 그림이 지워진다
    text: icons.length ? undefined : label,
    disabled: !!opt.disabled,
    type: 'button',
    onclick: (e) => {
      if (opt.disabled) return;
      Sfx.play(opt.sfx ?? 'sfx_menu_select');
      onClick(e);
    },
  });
  if (icons.length) {
    node.append(icons[0], el('span.btn-label', label), icons[1] ?? icons[0].cloneNode(true));
  }
  return node;
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

/**
 * ★ **떠 있는 팝업을 라우터가 알 수 있게 등록한다.** (2026-08-16)
 *
 * 팝업은 `#ui` 가 아니라 `document.body` 에 붙는다(화면 전체를 덮어야 하니까).
 * 그래서 라우터는 존재를 몰랐고 두 가지 사고가 났다:
 *
 *   1. 도감에서 신발 팝업을 열고 **안드로이드 뒤로가기**를 누르면, 팝업이 닫히는 게 아니라
 *      뒤에서 화면만 로비로 바뀌고 **팝업은 로비 위에 그대로 남았다**(화면 전체를 덮은 채).
 *   2. 캐릭터 구매 확인 다이얼로그에서 뒤로가기 → 로비 → 거기서 `확인` 을 누르면
 *      이미 떠난 화면의 구매가 끝까지 실행됐다. **취소한 줄 알았는데 신발이 빠져 있다.**
 *
 * 그래서 열려 있는 팝업을 여기 모아 두고, `router.js` 가 뒤로가기와 화면 전환에서 처리한다.
 */
const openOverlays = [];

/** 지금 떠 있는 팝업이 있으면 맨 위 하나를 닫는다. @returns {boolean} 닫았는가 */
export function closeTopOverlay() {
  const top = openOverlays[openOverlays.length - 1];
  if (!top) return false;
  top.close();
  return true;
}

/**
 * 화면이 **바뀔 때** 남아 있는 팝업을 전부 치운다.
 *
 * ★ `reason` 을 넘기는 이유. (2026-08-19 15차)
 * 팝업 중에는 닫히는 것 자체가 **결정**인 것이 있다 — 받은 쪽지는 닫히면 '읽음'이 찍히고,
 * 대결 신청은 닫히면 '거절'로 통보된다. 그런데 화면이 바뀌어 **강제로** 치워진 것은
 * 사용자가 내린 결정이 아니다. 그걸 구별하지 않아서 **읽지도 않은 쪽지가 읽음으로 사라지고
 * 받지도 못한 대결 신청이 거절로 나갔다.**
 */
export function closeAllOverlays(reason = 'screen') {
  while (openOverlays.length) openOverlays.pop().close(reason);
}

/**
 * 팝업을 띄우고 등록한다. `close` 는 여러 번 불려도 안전해야 한다.
 *
 * `onClose(reason)` — `'user'`(직접 닫음) 또는 `'screen'`(화면이 바뀌어 강제로 치워짐).
 * 돌려주는 `close` 는 **버튼 핸들러로 그대로 쓰인다** — 그때 첫 인자는 클릭 이벤트다.
 * 그래서 문자열일 때만 사유로 읽는다.
 */
export function presentOverlay(node, onClose) {
  const entry = {
    close(reason) {
      const i = openOverlays.indexOf(entry);
      if (i >= 0) openOverlays.splice(i, 1);
      node.remove();
      onClose?.(typeof reason === 'string' ? reason : 'user');
    },
  };
  openOverlays.push(entry);
  document.body.append(node);
  return entry.close;
}

/** 간단한 확인 다이얼로그. Promise<boolean> */
export function confirmDialog({ message, detail, yes, no }) {
  return new Promise((resolve) => {
    let settled = false;
    // 뒤로가기로 닫히면 '취소' 로 본다 — 확인은 사용자가 직접 눌러야 한다
    const finish = (v) => { if (settled) return; settled = true; resolve(v); };
    const close = (v) => { finish(v); dismiss(); };
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
    const dismiss = presentOverlay(overlay, () => finish(false));
  });
}

/** 잠깐 떴다 사라지는 알림 */
export function toast(message, ms = 1600) {
  const t = el('div.toast', message);
  document.body.append(t);
  setTimeout(() => t.remove(), ms);
}
