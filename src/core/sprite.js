/**
 * 스프라이트 드로잉 — 좌표를 정수로 강제하는 유일한 통로.
 * 게임 코드는 ctx.drawImage를 직접 호출하지 않는다. (CLAUDE.md §3-2)
 */

import { getCtx } from './canvas.js';

/** 소수점이 들어와도 여기서 잘린다. 음수도 안전하게 내림. */
const I = (n) => Math.floor(n);

/**
 * 이미지 전체를 그린다.
 * @param {CanvasImageSource} img
 * @param {number} x @param {number} y
 */
export function draw(img, x, y) {
  getCtx().drawImage(img, I(x), I(y));
}

/**
 * 좌우 반전해서 그린다. 왼쪽 보기 컷을 따로 만들지 않고 이걸 쓴다. (CLAUDE.md §5)
 * @param {CanvasImageSource} img
 * @param {number} x 반전 전 기준 좌상단 x
 * @param {number} y
 * @param {number} w 이미지 폭
 */
export function drawFlipped(img, x, y, w) {
  const ctx = getCtx();
  ctx.save();
  ctx.translate(I(x) + I(w), I(y));
  ctx.scale(-1, 1);
  ctx.drawImage(img, 0, 0);
  ctx.restore();
}

/**
 * 아틀라스에서 잘라 그린다.
 * @param {CanvasImageSource} img
 * @param {number} sx @param {number} sy @param {number} sw @param {number} sh
 * @param {number} dx @param {number} dy
 */
export function drawFrame(img, sx, sy, sw, sh, dx, dy) {
  getCtx().drawImage(img, I(sx), I(sy), I(sw), I(sh), I(dx), I(dy), I(sw), I(sh));
}

/**
 * 아틀라스에서 잘라 정수배로 확대해 그린다.
 * 신발 획득 팝 연출에 쓴다. 배율은 정수 픽셀로 반올림되므로 뭉개지지 않는다.
 * @param {number} scale 1.0 = 원본
 */
export function drawFrameScaled(img, sx, sy, sw, sh, dx, dy, scale) {
  const w = Math.round(sw * scale);
  const h = Math.round(sh * scale);
  // 중심을 유지한 채 커지도록 보정
  const ox = I(dx) - ((w - sw) >> 1);
  const oy = I(dy) - ((h - sh) >> 1);
  getCtx().drawImage(img, I(sx), I(sy), I(sw), I(sh), ox, oy, w, h);
}

/**
 * 이미지 전체를 배율만큼 확대해 좌상단 기준으로 그린다.
 *
 * 배율은 정수가 이상적이지만 1.5처럼 반정수도 허용한다 —
 * 목적지 크기를 정수로 반올림하고 스무딩이 꺼져 있어 nearest 확대가 된다.
 * (레퍼런스 「무한의 계단」의 캐릭터 비율을 맞추려면 1.5가 필요하다)
 */
export function drawScaled(img, x, y, w, h, scale) {
  const dw = Math.round(I(w) * scale);
  const dh = Math.round(I(h) * scale);
  getCtx().drawImage(img, 0, 0, I(w), I(h), I(x), I(y), dw, dh);
}

/** drawScaled 의 좌우 반전판 */
export function drawScaledFlipped(img, x, y, w, h, scale) {
  const dw = Math.round(I(w) * scale);
  const dh = Math.round(I(h) * scale);
  const ctx = getCtx();
  ctx.save();
  ctx.translate(I(x) + dw, I(y));
  ctx.scale(-1, 1);
  ctx.drawImage(img, 0, 0, I(w), I(h), 0, 0, dw, dh);
  ctx.restore();
}

/** 아틀라스 프레임을 배율만큼 확대해 좌상단 기준으로 그린다. */
export function drawFrameAt(img, sx, sy, sw, sh, dx, dy, scale = 1) {
  const dw = Math.round(I(sw) * scale);
  const dh = Math.round(I(sh) * scale);
  getCtx().drawImage(img, I(sx), I(sy), I(sw), I(sh), I(dx), I(dy), dw, dh);
}

/** drawFrameAt 의 좌우 반전판 */
export function drawFrameAtFlipped(img, sx, sy, sw, sh, dx, dy, scale = 1) {
  const dw = Math.round(I(sw) * scale);
  const dh = Math.round(I(sh) * scale);
  const ctx = getCtx();
  ctx.save();
  ctx.translate(I(dx) + dw, I(dy));
  ctx.scale(-1, 1);
  ctx.drawImage(img, I(sx), I(sy), I(sw), I(sh), 0, 0, dw, dh);
  ctx.restore();
}

/** 아틀라스에서 잘라 좌우 반전해 그린다. */
export function drawFrameFlipped(img, sx, sy, sw, sh, dx, dy) {
  const ctx = getCtx();
  ctx.save();
  ctx.translate(I(dx) + I(sw), I(dy));
  ctx.scale(-1, 1);
  ctx.drawImage(img, I(sx), I(sy), I(sw), I(sh), 0, 0, I(sw), I(sh));
  ctx.restore();
}

/** 단색 사각형. 픽셀 UI용. */
export function rect(x, y, w, h, color) {
  const ctx = getCtx();
  ctx.fillStyle = color;
  ctx.fillRect(I(x), I(y), I(w), I(h));
}

/** 1px 테두리 사각형. */
export function strokeRect(x, y, w, h, color) {
  const ctx = getCtx();
  ctx.fillStyle = color;
  const ix = I(x);
  const iy = I(y);
  const iw = I(w);
  const ih = I(h);
  ctx.fillRect(ix, iy, iw, 1);
  ctx.fillRect(ix, iy + ih - 1, iw, 1);
  ctx.fillRect(ix, iy, 1, ih);
  ctx.fillRect(ix + iw - 1, iy, 1, ih);
}

/**
 * 세로로 무한 반복되는 타일을 그린다. 배경 스크롤 전용.
 * @param {CanvasImageSource} img 타일 이미지
 * @param {number} tileH 타일 높이
 * @param {number} offsetY 스크롤 오프셋 (정수)
 * @param {number} viewH 화면 높이
 */
export function drawTiledY(img, tileH, offsetY, viewH) {
  const ctx = getCtx();
  // offsetY를 tileH로 나눈 나머지에서 시작해 화면을 덮을 때까지 반복
  let y = I(offsetY) % I(tileH);
  if (y > 0) y -= I(tileH);
  while (y < viewH) {
    ctx.drawImage(img, 0, y);
    y += I(tileH);
  }
}
