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
  if (!enabled || typeof navigator.getGamepads !== 'function') return;
  let L = false, R = false, pause = false;

  for (const gp of navigator.getGamepads()) {
    if (!gp) continue;
    const ax = gp.axes?.[0] ?? 0;
    const b = gp.buttons ?? [];
    const on = (i) => !!b[i]?.pressed;
    L = L || ax < -0.5 || on(14) || on(2);       // 왼쪽 스틱/십자키 ←, □(X)
    R = R || ax > 0.5 || on(15) || on(0);        // 오른쪽 스틱/십자키 →, ✕(A)
    pause = pause || on(9) || on(8);             // Start / Select
  }

  if (L && !padWas.L) { wakeAudio(); push(BTN.LEFT); }
  if (R && !padWas.R) { wakeAudio(); push(BTN.RIGHT); }
  if (pause && !padWas.pause) pauseHandler?.();

  // 누르는 동안만 눌림 표시. 뗀 순간만 되돌린다 — 터치·키보드가 잡고 있는 상태를 뺏지 않게.
  if (L) held.L = true; else if (padWas.L) held.L = false;
  if (R) held.R = true; else if (padWas.R) held.R = false;

  padWas.L = L; padWas.R = R; padWas.pause = pause;
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
