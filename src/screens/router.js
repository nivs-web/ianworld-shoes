/**
 * DOM 화면 라우터.
 *
 * 인게임은 Canvas 씬 스택(core/scene.js), 로비·메뉴는 이 DOM 라우터가 맡는다.
 * 둘을 한 화면에 섞지 않는다 (CLAUDE.md §6-3) — 그래서 전환은 "둘 중 하나만 보인다"로
 * 단순화했다. `body.ui-mode` 가 붙으면 캔버스가 통째로 숨는다.
 */

import { setInputEnabled } from '../core/input.js';
import { closeTopOverlay, closeAllOverlays } from './ui.js';

/** @typedef {{render:(nav:object)=>HTMLElement, onLeave?:()=>void}} Screen */

const root = () => document.getElementById('ui');

/** @type {{factory:Function, params:object}[]} */
const stack = [];
/** @type {Screen|null} */
let live = null;

/** 캔버스(게임)로 완전히 넘어간다 */
export function toCanvas() {
  if (live?.onLeave) live.onLeave();
  live = null;
  stack.length = 0;
  const r = root();
  if (r) { r.innerHTML = ''; r.classList.remove('active'); }
  document.body.classList.remove('ui-mode');
  setInputEnabled(true);
}

/** 지금 살아 있는 화면 인스턴스를 다시 그리기만 한다 */
function draw(keepScroll = false) {
  const r = root();
  if (!r || !live) return;
  // 다시 그리기 전에 떠 있는 팝업을 치운다 — 남으면 새 화면 위에 얹혀 버린다
  closeAllOverlays();
  const y = r.scrollTop;
  r.innerHTML = '';
  r.append(live.render(nav));
  r.scrollTop = keepScroll ? y : 0;
}

/**
 * 스택 맨 위 화면을 새로 만들어 그린다.
 *
 * 주의: **refresh는 이걸 부르면 안 된다.** 화면 인스턴스를 다시 만들면
 * 도감의 선택된 티어, 캐릭터 선택의 현재 index 처럼 화면이 들고 있는 상태가
 * 전부 초기화된다. refresh는 render만 다시 돌린다.
 */
function mount() {
  const r = root();
  if (!r) return;
  if (live?.onLeave) live.onLeave();

  const top = stack[stack.length - 1];
  if (!top) return toCanvas();

  // 게임 입력이 메뉴 클릭까지 먹어버리지 않게 꺼 둔다
  setInputEnabled(false);
  document.body.classList.add('ui-mode');
  r.classList.add('active');

  live = top.factory(nav, top.params);
  draw();
}

export const nav = {
  /** 새 화면을 쌓는다 */
  push(factory, params = {}) {
    stack.push({ factory, params });
    mount();
  },
  /** 현재 화면을 교체한다 (뒤로가기 대상에서 제외) */
  replace(factory, params = {}) {
    stack.pop();
    stack.push({ factory, params });
    mount();
  },
  /** 처음부터 다시 */
  reset(factory, params = {}) {
    stack.length = 0;
    stack.push({ factory, params });
    mount();
  },
  back() {
    if (stack.length <= 1) return;
    stack.pop();
    mount();
  },
  /**
   * 현재 화면을 **다시 그리기만** 한다 (구매·설정 변경 후).
   * 화면 인스턴스는 그대로라 선택된 탭·index 같은 화면 상태가 유지된다.
   */
  refresh() {
    draw(true);
  },
  toCanvas,
  depth: () => stack.length,
};

/** 안드로이드 뒤로가기 / 브라우저 뒤로가기 */
export function bindHardwareBack() {
  history.pushState({ sf: true }, '');
  window.addEventListener('popstate', () => {
    /**
     * ★ **팝업이 떠 있으면 뒤로가기는 팝업부터 닫는다.** (2026-08-16)
     * 팝업은 `document.body` 에 붙어 라우터 바깥에 있었다. 그래서 도감에서 신발
     * 팝업을 열고 뒤로가기를 누르면 **뒤의 화면만 바뀌고 팝업은 로비 위에 남았고**,
     * 구매 확인 다이얼로그는 떠난 화면의 구매를 끝까지 실행했다. (screens/ui.js)
     */
    if (!closeTopOverlay() && stack.length > 1) nav.back();
    history.pushState({ sf: true }, '');
  });
}
