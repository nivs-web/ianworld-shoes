/**
 * 입력 추상화 — 터치/마우스/키보드를 LEFT / RIGHT 두 신호로 정규화한다.
 * 선입력 버퍼 2개. 연타해도 "착·착·착" 리듬이 끊기지 않게 하는 핵심. (기획서 §4-3)
 */

import { INPUT } from '../config/balance.js';
import { TOUCH } from '../config/layout.js';
import { toLogical, getCanvas } from './canvas.js';
import { unlock } from '../audio/audio.js';
import { markActive } from './activity.js';

export const BTN = { LEFT: 'L', RIGHT: 'R' };

/** @type {string[]} 선입력 큐 */
const queue = [];
/** 현재 눌려 있는 버튼 (렌더에서 눌림 표현용) */
const held = { L: false, R: false };
let lastPushAt = 0;
let enabled = false;

/**
 * 임의 콜백 — 오버레이 메뉴처럼 화면을 직접 해석해야 하는 씬이 등록한다.
 * `exclusive` 면 처리하지 못한 탭도 좌우 입력으로 흘려보내지 않는다 —
 * 일시정지 메뉴에서 빈 곳을 눌렀다고 캐릭터가 움직이면 안 된다.
 */
let tapHandler = null;
let tapExclusive = false;

/** 키보드 ESC·게임패드 Start 처럼 "일시정지"라는 뜻이 분명한 입력용 */
let pauseHandler = null;

/**
 * 게임이 아니라 **DOM 화면(로비·도감 등)에 있을 때** ESC/게임패드 메뉴 버튼이 할 일.
 * `pauseHandler` 가 있으면(=인게임) 그쪽이 우선이고, 없을 때만(=DOM 화면) 이걸 부른다.
 * router.js 가 "팝업부터 닫고, 없으면 뒤로가기"로 등록한다. (2026-08-19, §7)
 */
let domBackHandler = null;
export function setDomBackHandler(fn) {
  domBackHandler = fn;
}

/**
 * DOM 화면에서 **게임패드 방향키·확인 버튼**이 할 일. (2026-08-19 12차)
 *
 * 게임패드는 이벤트가 없어 매 프레임 폴링해야 하는데, 그 폴링은 여기(엔진)에만 있다.
 * 화면 쪽(`screens/menuNav.js`)이 커서를 옮기므로 콜백으로 넘긴다 —
 * 엔진이 DOM 을 직접 만지면 §6-3 의 경계가 무너진다.
 * @type {((dir:'up'|'down'|'left'|'right'|'ok') => void) | null}
 */
let domNavHandler = null;
export function setDomNavHandler(fn) {
  domNavHandler = fn;
}

/**
 * 브라우저는 사용자 제스처 없이는 소리를 내지 않는다.
 * 어떤 입력이든 들어오면 그 자리에서 오디오를 깨운다. (제스처 핸들러 안이어야 한다)
 */
function wakeAudio() {
  if (unlock()) onFirstGesture.forEach((f) => f());
}

/** @type {Function[]} 오디오가 처음 열릴 때 한 번 부를 콜백 (BGM 시작 등) */
const onFirstGesture = [];
export function onAudioReady(fn) {
  onFirstGesture.push(fn);
}

function push(btn) {
  /**
   * ★ **입력은 곧 활동이다.** (2026-08-19 19차) 여기서 찍어 두면 캔버스 터치·키보드·
   * 게임패드가 전부 한 곳으로 모인다 — 접속자 목록이 "60초 무활동이면 나간 것"을
   * 판정할 때 이 값을 본다(`core/activity.js`). 게임패드는 DOM 이벤트를 아예
   * 만들지 않으므로 window 리스너만으로는 못 잡는다.
   */
  markActive();
  const now = performance.now();
  if (now - lastPushAt < INPUT.debounceMs) return;
  lastPushAt = now;
  if (queue.length >= INPUT.bufferSize) return; // 버퍼 초과분은 버린다
  queue.push(btn);
}

/**
 * ★ **메뉴 판정 영역을 좁힐 수 있다.** (2026-08-21 26차)
 *
 * 기본은 화면 위 1/5 전체(`TOUCH.pauseBelowY`)다 — 싱글에서는 엄지가 빗나가도
 * 일시정지가 열릴 뿐이라 손해가 없다. 그런데 멀티에서는 그 한 번이 **1회뿐인
 * 일시정지**를 날리거나 기권 확인창을 띄운다. 그래서 멀티는 버튼 사각형만 받고,
 * 남는 상단은 통째로 좌우 조작이 된다(조작 영역이 오히려 넓어진다).
 *
 * @param {{x:number,y:number,w:number,h:number}|null} r `null` 이면 기본(상단 밴드)
 */
let pauseZone = null;
export function setPauseZone(r) {
  pauseZone = r ?? null;
}

/** 논리 좌표 → 어느 영역인가 (layout.TOUCH) */
function zoneOf(lx, ly) {
  if (pauseZone) {
    const { x, y, w, h } = pauseZone;
    if (lx >= x && lx <= x + w && ly >= y && ly <= y + h) return 'pause';
  } else if (ly < TOUCH.pauseBelowY) return 'pause';
  return lx < TOUCH.splitX ? BTN.LEFT : BTN.RIGHT;
}

function handlePointerDown(lx, ly) {
  wakeAudio();

  // 오버레이가 떠 있으면 그쪽이 화면 전체를 해석한다
  if (tapHandler && tapHandler(lx, ly)) return true;
  if (tapExclusive) return true;

  const z = zoneOf(lx, ly);
  if (z === 'pause') {
    pauseHandler?.();
    return true;
  }
  held[z] = true;
  push(z);
  return true;
}

function onTouchStart(e) {
  if (!enabled) return;
  e.preventDefault();
  for (const t of e.changedTouches) {
    const p = toLogical(t.clientX, t.clientY);
    handlePointerDown(p.x, p.y);
  }
}

function onTouchEnd(e) {
  if (!enabled) return;
  e.preventDefault();
  // 남아 있는 터치가 없는 쪽만 해제
  const still = { L: false, R: false };
  for (const t of e.touches) {
    const p = toLogical(t.clientX, t.clientY);
    const z = zoneOf(p.x, p.y);
    if (z === BTN.LEFT || z === BTN.RIGHT) still[z] = true;
  }
  held.L = still.L;
  held.R = still.R;
}

function onMouseDown(e) {
  if (!enabled) return;
  const p = toLogical(e.clientX, e.clientY);
  handlePointerDown(p.x, p.y);
}

function onMouseUp() {
  held.L = false;
  held.R = false;
}

/** 키 → 신호. 왼손(AD)·오른손(방향키)·한 손(JK) 어느 쪽으로도 잡을 수 있게 넉넉히 둔다. */
const KEY_LEFT = ['ArrowLeft', 'KeyA', 'KeyJ', 'Numpad4'];
const KEY_RIGHT = ['ArrowRight', 'KeyD', 'KeyK', 'Space', 'Numpad6'];
const KEY_PAUSE = ['Escape', 'KeyP', 'Enter'];

function onKeyDown(e) {
  if (!enabled || e.repeat) return;
  wakeAudio();
  if (KEY_PAUSE.includes(e.code)) {
    pauseHandler?.();
    e.preventDefault();
    return;
  }
  if (KEY_LEFT.includes(e.code)) {
    held.L = true;
    push(BTN.LEFT);
    e.preventDefault();
  } else if (KEY_RIGHT.includes(e.code)) {
    held.R = true;
    push(BTN.RIGHT);
    e.preventDefault();
  }
}

function onKeyUp(e) {
  if (KEY_LEFT.includes(e.code)) held.L = false;
  if (KEY_RIGHT.includes(e.code)) held.R = false;
}

// ─────────────────────────────────────────────
// 게임패드
// ─────────────────────────────────────────────
/**
 * 게임패드는 이벤트가 없고 폴링만 있다. 루프에서 매 프레임 불러 준다.
 * 눌린 **순간**에만 신호를 넣는다 — 누르고 있는 동안 계속 들어가면
 * 선입력 버퍼가 순식간에 차서 조작이 밀린다.
 */
const padWas = { L: false, R: false, pause: false };
/** DOM 메뉴 커서용 게임패드 이전 상태 (눌린 순간만 보내려고 기억한다) */
const padNav = { up: false, down: false, left: false, right: false, ok: false };

/**
 * ★ **패드가 없으면 매 프레임 훑지 않는다.** (2026-08-19 13차, 속도)
 *
 * `navigator.getGamepads()` 는 **호출할 때마다 배열을 새로 만든다.** 게임 루프는
 * 로비에서도 60fps 로 도므로 아무도 패드를 안 꽂았는데 초당 60개의 배열이 생겼다 —
 * 폰에서는 그게 곧 GC 부담이다. 브라우저가 `gamepadconnected` 로 알려 주므로
 * **연결된 뒤에만** 훑는다. 이벤트를 놓치는 브라우저를 위해 2초에 한 번은 확인한다.
 */
let padCount = 0;
let padProbeAt = 0;
const PAD_PROBE_MS = 2000;
if (typeof window !== 'undefined') {
  window.addEventListener('gamepadconnected', () => { padCount++; });
  window.addEventListener('gamepaddisconnected', () => { padCount = Math.max(0, padCount - 1); });
}

export function pollGamepads() {
  if (typeof navigator.getGamepads !== 'function') return;
  if (!padCount) {
    const now = performance.now();
    if (now - padProbeAt < PAD_PROBE_MS) return;
    padProbeAt = now;
    let any = false;
    for (const gp of navigator.getGamepads()) if (gp) { any = true; break; }
    if (!any) return;
    padCount = 1;
  }
  let L = false, R = false, pause = false;
  let navUp = false, navDown = false, navLeft = false, navRight = false, navOk = false;

  /**
   * 표준 게임패드 매핑(W3C) 기준 버튼 인덱스.
   * - Y(3)·B(1) 는 X(2)·A(0) 와 **완전히 같은 동작**(왼쪽/오른쪽)을 하게 한다 —
   *   손가락이 어느 버튼에 있든 좌우 두 개만 구분하면 되는 조작이라 굳이 갈라둘 이유가 없다.
   * - RB/R1(5)·RT/R2(7) 는 전부 "left" 로, LB/L1(4)·LT/L2(6) 는 전부 "right" 로 묶는다
   *   (2026-08-19 사용자 지정). 트리거까지 왼쪽/오른쪽 조작에 물려 두 손가락 아무거나 써도 된다.
   */
  for (const gp of navigator.getGamepads()) {
    if (!gp) continue;
    const ax = gp.axes?.[0] ?? 0;
    const ay = gp.axes?.[1] ?? 0;
    const b = gp.buttons ?? [];
    const on = (i) => !!b[i]?.pressed;
    pause = pause || on(9) || on(8);             // Start/Menu(≡) · Select/View(hamburger)
    if (!enabled) {
      // DOM 화면 — 십자키·왼쪽 스틱은 메뉴 커서, A 는 선택
      navUp = navUp || ay < -0.5 || on(12);
      navDown = navDown || ay > 0.5 || on(13);
      navLeft = navLeft || ax < -0.5 || on(14);
      navRight = navRight || ax > 0.5 || on(15);
      navOk = navOk || on(0);
      continue;
    }
    L = L || ax < -0.5 || on(14) || on(2) || on(3) || on(5) || on(7);   // 십자키←, X, Y, RB/R1, RT/R2
    R = R || ax > 0.5 || on(15) || on(0) || on(1) || on(4) || on(6);    // 십자키→, A, B, LB/L1, LT/L2
  }

  /**
   * 메뉴 버튼은 `enabled` 와 무관하게 항상 살핀다 — DOM 화면(로비·도감)에서는
   * 게임 입력이 꺼져 있어도(§7) ESC 와 같은 뜻으로 팝업을 닫거나 뒤로가야 한다.
   * `pauseHandler` 가 있으면(=인게임) 그게 우선, 없으면 `domBackHandler` 가 대신한다.
   */
  if (pause && !padWas.pause) {
    if (pauseHandler) pauseHandler();
    else domBackHandler?.();
  }
  padWas.pause = pause;

  /**
   * ★ **DOM 화면에서는 방향키가 메뉴 커서다.** (2026-08-19 12차, 사용자 지정)
   * 게임 입력이 꺼져 있을 때(`enabled === false`)만 돈다 — 인게임에서는 같은 십자키가
   * 좌우 조작이라 겹치면 안 된다. 눌린 **순간에만** 한 번 보낸다(누르고 있는 동안
   * 매 프레임 보내면 목록이 주르륵 흘러간다).
   */
  if (!enabled) {
    padWas.L = false; padWas.R = false;
    // 객체·배열을 만들지 않는다 — 이 함수는 초당 60번 돈다
    if (navUp && !padNav.up) domNavHandler?.('up');
    if (navDown && !padNav.down) domNavHandler?.('down');
    if (navLeft && !padNav.left) domNavHandler?.('left');
    if (navRight && !padNav.right) domNavHandler?.('right');
    if (navOk && !padNav.ok) domNavHandler?.('ok');
    padNav.up = navUp; padNav.down = navDown; padNav.left = navLeft;
    padNav.right = navRight; padNav.ok = navOk;
    return;
  }
  padNav.up = false; padNav.down = false; padNav.left = false;
  padNav.right = false; padNav.ok = false;

  if (L && !padWas.L) { wakeAudio(); push(BTN.LEFT); }
  if (R && !padWas.R) { wakeAudio(); push(BTN.RIGHT); }

  // 누르는 동안만 눌림 표시. 뗀 순간만 되돌린다 — 터치·키보드가 잡고 있는 상태를 뺏지 않게.
  if (L) held.L = true; else if (padWas.L) held.L = false;
  if (R) held.R = true; else if (padWas.R) held.R = false;

  padWas.L = L; padWas.R = R;
}

export function initInput() {
  const c = getCanvas();
  c.addEventListener('touchstart', onTouchStart, { passive: false });
  c.addEventListener('touchend', onTouchEnd, { passive: false });
  c.addEventListener('touchcancel', onTouchEnd, { passive: false });
  c.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  // 더블탭 확대 / 길게 눌러 선택 방지
  c.addEventListener('contextmenu', (e) => e.preventDefault());
  c.addEventListener('dblclick', (e) => e.preventDefault());
}

export function setInputEnabled(v) {
  enabled = !!v;
  if (!enabled) {
    queue.length = 0;
    held.L = held.R = false;
  }
}

/**
 * 캔버스 내 임의 좌표 탭 핸들러 등록. 처리했으면 true 를 반환한다.
 * @param {((x:number, y:number)=>boolean)|null} fn
 * @param {boolean} [exclusive] true 면 처리 못 한 탭도 좌우 입력으로 넘기지 않는다 (오버레이용)
 */
export function setTapHandler(fn, exclusive = false) {
  tapHandler = fn;
  tapExclusive = !!exclusive;
}

/** 일시정지 요청 핸들러 — 화면 상단 탭 / ESC / 게임패드 Start 가 모두 여기로 온다 */
export function setPauseHandler(fn) {
  pauseHandler = fn;
}

/** 큐에서 입력 하나를 꺼낸다. 없으면 null. */
export function consumeInput() {
  return queue.length ? queue.shift() : null;
}

export function isHeld(btn) {
  return btn === BTN.LEFT ? held.L : held.R;
}

export function clearInput() {
  queue.length = 0;
}
