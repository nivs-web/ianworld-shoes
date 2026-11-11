/**
 * PixiJS 앱 — 촘촘한 도트 화면 (기획서 12.1).
 *
 * - 화면 바탕은 **960 × 540칸** (1080p 의 1/2 · 2026-11-10 대표님 결정). 그 크기로 그린 뒤 캔버스를 기기 물리 픽셀의
 *   **정수배**로 키운다 (CSS 크기 = 칸 × 배율 ÷ devicePixelRatio, `image-rendering: pixelated`).
 * - 화면이 더 긴 폰(19.5:9)은 위아래 540 을 지키고 가로를 최대 1170칸까지 넓혀 전장을 더 보여 준다.
 * - 번짐 없음 : 텍스처 `nearest` · 안티에일리어싱 끔 · `roundPixels`.
 * - 다시 들어올 때 새 앱을 만들므로 나갈 때 `releaseGlobalResources` 로 비운다 (pixijs-application 스킬).
 */

import { Application, TextureSource } from 'pixi.js';

export const BASE_W = 960;
export const BASE_H = 540;
export const MAX_W = 1170;
/** 캔버스 촘촘함 상한 (논리 1칸 = 물리 픽셀 최대 2.5개) */
export const RES_MAX = 2.5;

TextureSource.defaultOptions.scaleMode = 'nearest';

/** 창 크기 → { w: 칸 가로, h: 칸 세로, k: 물리 픽셀 배율, css: CSS 크기 } */
export function fitView(cssW, cssH, dpr) {
  const pw = Math.max(1, Math.floor(cssW * dpr));
  const ph = Math.max(1, Math.floor(cssH * dpr));
  const kFit = Math.min(pw / BASE_W, ph / BASE_H);
  /*
   * 2026-11-11 대표님 «PC 에서 배경이 흐리다» : 예전엔 960×540 으로 그린 캔버스를 그대로 늘려서 제미나이 고해상도 그림이 뭉개졌다.
   * 이제 화면을 꽉 채우는 배율(kFit)로 맞추고, 캔버스 자체를 그 배율만큼 촘촘하게 그린다(res · 상한 RES_MAX — 태블릿 · 고밀도 폰 부담).
   */
  const k = kFit;
  const w = Math.max(BASE_W, Math.min(MAX_W, Math.floor(pw / k)));
  const res = Math.max(1, Math.min(RES_MAX, Math.round(k * 4) / 4));
  return { w, h: BASE_H, k, res, cssW: (w * k) / dpr, cssH: (BASE_H * k) / dpr };
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
    resolution: first.res,
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
    const sized = f.w !== view.w || f.h !== view.h;
    if (sized || f.res !== app.renderer.resolution) {
      view.w = f.w; view.h = f.h;
      app.renderer.resize(f.w, f.h, f.res);
      if (sized) for (const fn of listeners) fn(view);
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
