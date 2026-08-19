/**
 * DOM 화면의 **키보드·게임패드 커서**. (2026-08-19 12차, 사용자 지정)
 *
 * *"로비에서 싱글게임 멀티게임 등등 키보드로 방향 움직이면 각각 활성화가 되고 엔터
 * 누르면 해당 메뉴로 들어가게 (…) 콘트롤러와 키보드로 터치 없이도 게임 가능하게"*
 *
 * ## 브라우저 기본 포커스를 그대로 쓴다
 *
 * 직접 "선택된 항목" 상태를 들고 있으면 화면이 다시 그려질 때마다(라우터는 `innerHTML`
 * 을 통째로 갈아 끼운다) 그 상태가 실제 DOM 과 어긋난다. 대신 **`element.focus()`** 만
 * 부르고 나머지는 브라우저에 맡긴다 — 포커스된 버튼은 **Enter·Space 로 저절로 눌린다.**
 * 우리가 할 일은 방향키로 포커스를 옮기는 것뿐이다.
 *
 * ## 화면이 바뀌면 다시 훑는다
 *
 * 라우터의 `draw()`·팝업 열기/닫기 등 다시 훑어야 하는 순간이 여럿이라, 호출부마다
 * 심는 대신 `MutationObserver` 로 **DOM 이 바뀌면** 알아서 맞춘다. 한 곳을 빠뜨려
 * "이 화면에서만 키보드가 안 먹는" 상태가 생기는 걸 막는다.
 */

import { setDomNavHandler } from '../core/input.js';

/** 팝업이 떠 있으면 그 안에서만 움직인다 — 뒤 화면 버튼으로 새면 안 된다 */
const scopeRoot = () => {
  const dialogs = document.querySelectorAll('.dialog-overlay');
  return dialogs.length ? dialogs[dialogs.length - 1] : document.getElementById('ui');
};

function items() {
  const root = scopeRoot();
  if (!root) return [];
  return [...root.querySelectorAll('button, [tabindex]:not([tabindex="-1"])')]
    .filter((el) => !el.disabled && el.offsetParent !== null);
}

/** 지금 글자를 입력 중인가 — 그러면 방향키는 입력칸의 것이다 */
const typing = () => {
  const a = document.activeElement;
  return !!a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.isContentEditable);
};

const uiMode = () => document.body.classList.contains('ui-mode');

export function move(step) {
  if (!uiMode() || typing()) return;
  const list = items();
  if (!list.length) return;
  const i = list.indexOf(document.activeElement);
  // 아직 아무것도 안 잡혔으면 **첫 항목부터** — 갑자기 가운데서 시작하면 어리둥절하다
  const next = i < 0 ? 0 : (i + step + list.length) % list.length;
  list[next].focus();
}

/** 지금 잡힌 것을 누른다 (게임패드 A 처럼 click 이 저절로 안 오는 입력용) */
export function activate() {
  if (!uiMode() || typing()) return;
  const a = document.activeElement;
  if (a && items().includes(a)) { a.click(); return; }
  items()[0]?.focus();
}

/**
 * 화면이 바뀌면 **포커스를 잃는다**(그 버튼이 통째로 사라졌으니까). 그대로 두면
 * 다음 방향키 한 번이 "첫 항목으로 이동"에 쓰여서 한 칸을 손해 본다. 새 화면의
 * 첫 항목을 미리 잡아 두면 방향키·엔터가 곧바로 이어진다.
 *
 * 단 **마우스·터치로 쓰는 사람에게 테두리가 튀어나오면 안 된다.** 그래서 키보드나
 * 게임패드를 한 번이라도 쓴 뒤에만 자동으로 잡는다.
 */
let padUsed = false;
let queued = false;
function resync() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    if (!padUsed || !uiMode() || typing()) return;
    const list = items();
    if (!list.length) return;
    if (!list.includes(document.activeElement)) list[0].focus();
  });
}

export function bindMenuNav() {
  window.addEventListener('keydown', (e) => {
    if (!uiMode() || typing()) return;
    let step = 0;
    if (e.code === 'ArrowDown' || e.code === 'ArrowRight') step = 1;
    else if (e.code === 'ArrowUp' || e.code === 'ArrowLeft') step = -1;
    else return;
    e.preventDefault();
    padUsed = true;
    move(step);
  });

  // 게임패드는 이벤트가 없다 — `core/input.js` 의 매 프레임 폴링이 이걸 부른다
  setDomNavHandler((dir) => {
    padUsed = true;
    if (dir === 'ok') return activate();
    move(dir === 'down' || dir === 'right' ? 1 : -1);
  });

  /**
   * ★ **훑는 범위를 좁힌다.** (2026-08-19 13차, 속도)
   *
   * 처음엔 `document.body` 를 `subtree: true` 로 봤는데, 그러면 **토스트 하나가
   * 뜨고 지는 것까지** 콜백을 깨운다. 실제로 필요한 신호는 둘뿐이다 —
   * 화면이 통째로 갈리는 것(`#ui` 의 자식 교체)과 팝업이 열리고 닫히는 것(body 직계).
   */
  const ui = document.getElementById('ui');
  const mo = new MutationObserver(resync);
  if (ui) mo.observe(ui, { childList: true });
  mo.observe(document.body, { childList: true });
}
