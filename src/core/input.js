/**
 * 입력 추상화 — 터치/마우스/키보드를 LEFT / RIGHT 두 신호로 정규화한다.
 * 선입력 버퍼 2개. 연타해도 "착·착·착" 리듬이 끊기지 않게 하는 핵심. (기획서 §4-3)
 */

import { INPUT } from '../config/balance.js';
import { CONTROLS } from '../config/layout.js';
import { toLogical, getCanvas } from './canvas.js';
import { unlock } from '../audio/audio.js';

export const BTN = { LEFT: 'L', RIGHT: 'R' };

/** @type {string[]} 선입력 큐 */
const queue = [];
/** 현재 눌려 있는 버튼 (렌더에서 눌림 표현용) */
const held = { L: false, R: false };
let lastPushAt = 0;
let enabled = false;

/** 임의 콜백 — HUD의 일시정지 버튼 등 캔버스 안 버튼을 처리한다. */
let tapHandler = null;

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

/** 사각형 히트 판정 (여유 패딩 포함) */
function hit(rect, x, y) {
  const p = CONTROLS.hitPadding;
  return (
    x >= rect.x - p && x <= rect.x + rect.w + p && y >= rect.y - p && y <= rect.y + rect.h + p
  );
}

function handlePointerDown(lx, ly) {
  wakeAudio();
  if (hit(CONTROLS.left, lx, ly)) {
    held.L = true;
    push(BTN.LEFT);
    return true;
  }
  if (hit(CONTROLS.right, lx, ly)) {
    held.R = true;
    push(BTN.RIGHT);
    return true;
  }
  return tapHandler ? tapHandler(lx, ly) : false;
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
    if (hit(CONTROLS.left, p.x, p.y)) still.L = true;
    if (hit(CONTROLS.right, p.x, p.y)) still.R = true;
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

function onKeyDown(e) {
  if (!enabled || e.repeat) return;
  wakeAudio();
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
    held.L = true;
    push(BTN.LEFT);
  } else if (e.code === 'ArrowRight' || e.code === 'KeyD' || e.code === 'Space') {
    held.R = true;
    push(BTN.RIGHT);
    e.preventDefault();
  }
}

function onKeyUp(e) {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') held.L = false;
  if (e.code === 'ArrowRight' || e.code === 'KeyD' || e.code === 'Space') held.R = false;
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

/** 캔버스 내 임의 좌표 탭 핸들러 등록 (일시정지 버튼 등). 처리했으면 true 반환. */
export function setTapHandler(fn) {
  tapHandler = fn;
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
