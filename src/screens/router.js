/**
 * DOM 화면 라우터.
 *
 * 인게임은 Canvas 씬 스택(core/scene.js), 로비·메뉴는 이 DOM 라우터가 맡는다.
 * 둘을 한 화면에 섞지 않는다 (CLAUDE.md §6-3) — 그래서 전환은 "둘 중 하나만 보인다"로
 * 단순화했다. `body.ui-mode` 가 붙으면 캔버스가 통째로 숨는다.
 */

import { setInputEnabled, setDomBackHandler } from '../core/input.js';
import { closeTopOverlay, closeAllOverlays } from './ui.js';
import * as Presence from '../services/presence.js';

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
  /**
   * ★ **여기가 '게임중'의 경계다.** (2026-08-19 11차)
   * 캔버스로 넘어가면 DOM 팝업을 띄울 수 없으므로(§6-3) 대결 신청을 받을 수 없다.
   * 화면 하나하나가 각자 알리게 두면 언젠가 한 곳을 빠뜨린다 — 전환 지점은 여기 둘뿐이다.
   */
  Presence.setState('playing', 'shoes');
}

/**
 * 지금 살아 있는 화면 인스턴스를 다시 그리기만 한다.
 *
 * ★ **`refresh()` 는 팝업을 건드리면 안 된다.** (2026-08-19 15차, 사용자 신고)
 *
 * 예전에는 여기서 무조건 `closeAllOverlays()` 를 불렀다. 화면이 **바뀔 때**는 맞는
 * 처리다(남으면 새 화면 위에 얹힌다). 그런데 `refresh()` 는 **같은 화면을 다시 그리는
 * 것**이라 그 화면이 띄운 팝업은 살아 있어야 한다. 그리고 `refresh()` 를 부르는 것은
 * 대부분 **구독 콜백**이다:
 *
 *   · 대기방  — 5초마다 오는 생존 신호(`seenAt`)로 방 스냅샷이 바뀐다
 *   · 현재접속자 — 누가 들어오고 나갈 때마다
 *   · 쪽지함  — 쪽지가 하나 올 때마다, 설정이 바뀔 때마다
 *
 * 즉 **아무 일도 안 해도 몇 초 안에 팝업이 저절로 닫혔다.** 증상이 셋이었다 —
 * 쪽지를 쓰려고 입력칸을 띄우면 타이핑 중에 창이 사라지고, 받은 쪽지는 뜨자마자 닫히면서
 * `읽음` 이 찍혀 **영영 다시 안 뜨고**, 대결 신청은 **자동 거절**로 처리돼 신청자에게
 * 거절 통보가 갔다. 사용자가 말한 "메세지 보내는 것이 안된다 / 대결신청이 안된다"가 이것이다.
 */
function draw(keepScroll = false, keepOverlays = false) {
  const r = root();
  if (!r || !live) return;
  if (!keepOverlays) closeAllOverlays();
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
  // DOM 화면으로 돌아왔다 — 밀린 쪽지를 지금 띄운다 (인게임 동안은 서버에 그대로 뒀다)
  Presence.setState('lobby');
  mountHook?.();
}

/**
 * ★ **화면이 라우터를 물게 하지, 라우터가 화면을 물게 하지 않는다.** (2026-08-19 13차)
 *
 * 예전에는 라우터가 `inboxPopups` 를 정적으로 import 해서, **쪽지 팝업과 그것이 끌고 오는
 * 유저상태창까지 부팅 번들**에 들어왔다. 쪽지함은 접속 2.5초 뒤에나 켜지는 기능이다.
 * 훅으로 뒤집으면 라우터는 아무것도 모르고, 쪽지 쪽이 준비되면 자기를 등록한다.
 * @type {(() => void) | null}
 */
let mountHook = null;
export function setMountHook(fn) { mountHook = fn; }

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
    // 팝업은 그대로 둔다 — 구독 한 번에 사용자가 열어 둔 창이 닫히면 안 된다
    draw(true, true);
  },
  toCanvas,
  depth: () => stack.length,
};

/**
 * ★ **게임이 떠 있는 동안은 게임이 먼저 받는다.** (2026-08-26)
 *
 * 신발게임은 캔버스로 넘어가면서 `body.ui-mode` 가 빠지므로 여기 오지 않는다.
 * 그런데 드래곤 스트라이커는 **DOM 화면 위에 제 캔버스를 얹는 방식**이라
 * `ui-mode` 가 그대로 붙어 있다 — 그래서 게임 도중 ESC 를 누르면
 * **일시정지가 아니라 곧바로 로비로 튕겨 나갔다.** 안드로이드 뒤로가기도 같았다.
 *
 * 화면이 이걸 등록하면 뒤로가기·ESC·게임패드 메뉴가 전부 그 함수로 간다.
 */
let gameGuard = null;
export function setGameGuard(fn) { gameGuard = fn || null; }

/** 팝업이 있으면 그것부터, 게임 중이면 게임에게, 아니면 뒤로가기. */
function backOrCloseOverlay() {
  if (closeTopOverlay()) return;
  if (gameGuard) { gameGuard(); return; }
  if (stack.length > 1) nav.back();
}

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
    backOrCloseOverlay();
    history.pushState({ sf: true }, '');
  });
}

/**
 * ESC 키 — **DOM 화면(로비·도감 등)에서만** 여기서 처리한다. 인게임(캔버스)에서는
 * `core/input.js` 의 `pauseHandler` 가 이미 ESC 를 일시정지로 받고 있으므로,
 * 여기서 또 반응하면 두 번 처리된다. `body.ui-mode` 유무로 어느 쪽인지 가른다. (§7, 2026-08-19)
 */
export function bindEscBack() {
  window.addEventListener('keydown', (e) => {
    if (e.code !== 'Escape') return;
    if (!document.body.classList.contains('ui-mode')) return; // 신발 인게임 — pauseHandler 몫
    /**
     * ★ **드래곤이 떠 있으면 ESC 는 게임이 받는다.** (2026-08-26, 버그 수정)
     *
     * 드래곤은 DOM 화면 위에 캔버스를 얹으므로 `ui-mode` 가 붙어 있다. 그래서 여기와
     * 게임의 키 처리가 **둘 다** ESC 를 잡았다 — 하나가 일시정지를 켜면 다른 하나가
     * 곧바로 껐다. 화면에는 아무 일도 안 일어나는 것처럼 보였다.
     * 뒤로가기(popstate)·게임패드는 키 이벤트가 아니라 여전히 가드로 간다.
     */
    if (gameGuard) return;
    e.preventDefault();
    backOrCloseOverlay();
  });
}

/**
 * 게임패드 메뉴 버튼(View/Menu) — DOM 화면에서 눌렸을 때. `core/input.js` 의
 * `pollGamepads()` 가 매 프레임 이 핸들러를 부른다(인게임 중에는 `pauseHandler` 가 우선이라
 * 여기까지 안 온다). 등록은 라우터가 살아 있는 한 항상 유효하다.
 */
setDomBackHandler(backOrCloseOverlay);
