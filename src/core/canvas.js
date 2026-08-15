/**
 * 캔버스 부트스트랩 — 픽셀 퍼펙트의 심장부.
 *
 * 규칙 (CLAUDE.md §3-1):
 *  · 논리 해상도는 정확히 180×320. 절대 바뀌지 않는다.
 *  · 화면 표시는 정수배 스케일만.
 *  · 모든 컨텍스트에 imageSmoothingEnabled = false.
 */

import { VIEW_W, VIEW_H } from '../config/layout.js';

/** @type {HTMLCanvasElement} */
let canvas;
/** @type {CanvasRenderingContext2D} */
let ctx;
let scale = 1;

/** 스무딩을 끈 컨텍스트를 만든다. 오프스크린 버퍼도 반드시 이 함수를 거친다. */
export function killSmoothing(context) {
  context.imageSmoothingEnabled = false;
  // 벤더 프리픽스 (구형 기기 대응)
  context.mozImageSmoothingEnabled = false;
  context.webkitImageSmoothingEnabled = false;
  context.msImageSmoothingEnabled = false;
  if ('imageSmoothingQuality' in context) context.imageSmoothingQuality = 'low';
  return context;
}

/**
 * 오프스크린 버퍼 생성. 게임 안에서 캔버스를 새로 만들 땐 항상 이걸 쓴다.
 * @param {number} w @param {number} h
 */
export function createBuffer(w, h) {
  const c = document.createElement('canvas');
  c.width = w | 0;
  c.height = h | 0;
  const cx = c.getContext('2d');
  killSmoothing(cx);
  return { canvas: c, ctx: cx };
}

/**
 * 화면 크기에 맞는 정수배 스케일을 계산한다.
 * 소수 배율은 픽셀을 뭉개므로 절대 쓰지 않는다.
 */
function computeScale() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const s = Math.floor(Math.min(vw / VIEW_W, vh / VIEW_H));
  return Math.max(1, s);
}

/** 리사이즈 시 CSS 크기만 갱신한다. 캔버스의 width/height 속성은 건드리지 않는다. */
function applyScale() {
  scale = computeScale();
  canvas.style.width = `${VIEW_W * scale}px`;
  canvas.style.height = `${VIEW_H * scale}px`;
  // 스무딩은 컨텍스트 상태 초기화 시 풀릴 수 있으므로 매번 다시 건다.
  killSmoothing(ctx);
}

/**
 * @returns {{canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D}}
 */
export function initCanvas() {
  canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('game'));
  if (!canvas) throw new Error('#game 캔버스를 찾을 수 없습니다');

  // 논리 해상도 고정. devicePixelRatio로 늘리지 않는다.
  canvas.width = VIEW_W;
  canvas.height = VIEW_H;

  ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
  killSmoothing(ctx);

  applyScale();
  window.addEventListener('resize', applyScale);
  window.addEventListener('orientationchange', applyScale);

  return { canvas, ctx };
}

export function getCtx() {
  return ctx;
}

export function getCanvas() {
  return canvas;
}

export function getScale() {
  return scale;
}

/**
 * 화면 좌표(clientX/Y) → 논리 캔버스 좌표(0~179, 0~319).
 * 터치 판정에 쓴다. 결과는 항상 정수다.
 */
export function toLogical(clientX, clientY) {
  const r = canvas.getBoundingClientRect();
  return {
    x: Math.floor((clientX - r.left) / scale),
    y: Math.floor((clientY - r.top) / scale),
  };
}

/** 화면 전체를 한 색으로 지운다. */
export function clear(color = '#000') {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
}
