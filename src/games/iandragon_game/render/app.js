/**
 * PixiJS 앱 — 촘촘한 도트 화면 (기획서 12.1).
 *
 * - 화면 바탕은 **640 × 360칸** (1080p 의 1/3). 그 크기로 그린 뒤 캔버스를 기기 물리 픽셀의
 *   **정수배**로 키운다 (CSS 크기 = 칸 × 배율 ÷ devicePixelRatio, `image-rendering: pixelated`).
 * - 화면이 더 긴 폰(19.5:9)은 위아래 360 을 지키고 가로를 최대 780칸까지 넓혀 전장을 더 보여 준다.
 * - 번짐 없음 : 텍스처 `nearest` · 안티에일리어싱 끔 · `roundPixels`.
 * - 다시 들어올 때 새 앱을 만들므로 나갈 때 `releaseGlobalResources` 로 비운다 (pixijs-application 스킬).
 */

import { Application, TextureSource } from 'pixi.js';

export const BASE_W = 640;
export const BASE_H = 360;
export const MAX_W = 780;

TextureSource.defaultOptions.scaleMode = 'nearest';

/** 창 크기 → { w: 칸 가로, h: 칸 세로, k: 물리 픽셀 배율, css: CSS 크기 } */
export function fitView(cssW, cssH, dpr) {
  const pw = Math.max(1, Math.floor(cssW * dpr));
  const ph = Math.max(1, Math.floor(cssH * dpr));
  /*
   * 배율 : PC 같은 저밀도 화면은 **정수배**(칸 크기가 고르게). 폰 같은 고밀도 화면(dpr 2 이상)에서
   * 한 칸이 물리 픽셀 2개 이상이면 **화면을 꽉 채우는 배율** — 정수만 고집하면 위아래가 25% 넘게 비는데,
   * 이 밀도에서는 칸 크기 1픽셀 차이가 눈에 보이지 않는다 (번짐은 여전히 없음 — nearest).
   */
  const kFit = Math.min(pw / BASE_W, ph / BASE_H);
  const kInt = Math.floor(kFit);
  const k = dpr >= 2 && kFit >= 2 ? kFit : kInt >= 1 ? kInt : kFit;
  const w = Math.max(BASE_W, Math.min(MAX_W, Math.floor(pw / k)));
  return { w, h: BASE_H, k, cssW: (w * k) / dpr, cssH: (BASE_H * k) / dpr };
}

/**
 * @param {HTMLElement} host 캔버스를 넣을 곳 (가운데 정렬은 CSS `.idg-host`)
 * @returns {Promise<{app: Application, view: {w:number,h:number}, onResize:(fn:Function)=>void, destroy:()=>void}>}
 */
export async function createApp(host) {
  const app = new Application();
  const first = fitView(host.clientWidth || innerWidth, host.clientHeight || innerHeight, devicePixelRatio || 1);
  await app.init({
    width: first.w,
    height: first.h,
    resolution: 1,
    autoDensity: false,
    antialias: false,
    roundPixels: true,
    background: '#120a24',
    preference: 'webgl',
  });
  if (import.meta.env?.DEV) window.__idgApp = app;     // 개발 서버에서만 — 미리보기 점검용
  const cv = app.canvas;
  cv.classList.add('idg-canvas');
  host.appendChild(cv);

  const view = { w: first.w, h: first.h };
  const listeners = [];
  const apply = () => {
    const f = fitView(host.clientWidth || innerWidth, host.clientHeight || innerHeight, devicePixelRatio || 1);
    if (f.w !== view.w || f.h !== view.h) {
      view.w = f.w; view.h = f.h;
      app.renderer.resize(f.w, f.h);
      for (const fn of listeners) fn(view);
    }
    cv.style.width = `${f.cssW}px`;
    cv.style.height = `${f.cssH}px`;
  };
  apply();
  const onWin = () => apply();
  addEventListener('resize', onWin);
  addEventListener('orientationchange', onWin);

  return {
    app,
    view,
    onResize(fn) { listeners.push(fn); },
    destroy() {
      removeEventListener('resize', onWin);
      removeEventListener('orientationchange', onWin);
      app.destroy({ removeView: true, releaseGlobalResources: true }, { children: true });
    },
  };
}
