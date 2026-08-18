/**
 * 입력 추상화 — 터치/마우스/키보드를 LEFT / RIGHT 두 신호로 정규화한다.
 * 선입력 버퍼 2개. 연타해도 "착·착·착" 리듬이 끊기지 않게 하는 핵심. (기획서 §4-3)
 */

import { INPUT } from '../config/balance.js';
import { TOUCH } from '../config/layout.js';
import { toLogical, getCanvas } from './canvas.js';
import { unlock } from '../audio/audio.js';

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
  const now = performance.now();
  if (now - lastPushAt < INPUT.debounceMs) return;
  lastPushAt = now;
  if (queue.length >= INPUT.bufferSize) return; // 버퍼 초과분은 버린다
  queue.push(btn);
}

/** 논리 좌표 → 어느 영역인가 (layout.TOUCH) */
function zoneOf(lx, ly) {
  if (ly < TOUCH.pauseBelowY) return 'pause';
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

export function pollGamepads() {
  if (typeof navigator.getGamepads !== 'function') return;
  let L = false, R = false, pause = false;

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
    const b = gp.buttons ?? [];
    const on = (i) => !!b[i]?.pressed;
    pause = pause || on(9) || on(8);             // Start/Menu(≡) · Select/View(hamburger)
    if (!enabled) continue;                      // 방향 조작은 게임 중일 때만 본다
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

  if (!enabled) { padWas.L = false; padWas.R = false; return; }

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
