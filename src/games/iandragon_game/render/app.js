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
export const MAX_W = 1240;   // 가장 짧은 전장(900 + 양쪽 170) 보다 넓으면 안 된다
/** 캔버스 촘촘함 상한 (논리 1칸 = 물리 픽셀 최대 2.5개) */
export const RES_MAX = 2.5;

TextureSource.defaultOptions.scaleMode = 'nearest';

/**
 * HUD 위 · 아래 띠가 덮어도 되는 칸 (2026-11-11 대표님 «폰에서 아래 단추 띠가 전장을 다 가린다 · 달도 땅도 잘린다»)
 * 띠가 있으면 캔버스를 띠 사이에 맞추되, 맨 위 하늘 SKY_CUT 칸과 맨 아래 흙 DIRT_CUT 칸만 띠 밑으로 들어가게 한다 → 전장(40~500)은 항상 다 보인다.
 */
export const SKY_CUT = 40, DIRT_CUT = 40;

/** 창 크기 → { w: 칸 가로, h: 칸 세로, k: 물리 픽셀 배율, css: CSS 크기 · 자리 } · ins = HUD 띠 높이 { t, b } (CSS px) */
export function fitView(cssW, cssH, dpr, ins = { t: 0, b: 0 }) {
  const pw = Math.max(1, Math.floor(cssW * dpr));
  const band = ins.t || ins.b ? BASE_H - SKY_CUT - DIRT_CUT : BASE_H;
  const ph = Math.max(1, Math.floor((cssH - ins.t - ins.b) * dpr));
  const kFit = Math.min(pw / BASE_W, ph / band);
  /*
   * 2026-11-11 대표님 «PC 에서 배경이 흐리다» : 예전엔 960×540 으로 그린 캔버스를 그대로 늘려서 제미나이 고해상도 그림이 뭉개졌다.
   * 이제 화면을 꽉 채우는 배율(kFit)로 맞추고, 캔버스 자체를 그 배율만큼 촘촘하게 그린다(res · 상한 RES_MAX — 태블릿 · 고밀도 폰 부담).
   */
  const k = kFit;
  const w = Math.max(BASE_W, Math.min(MAX_W, Math.floor(pw / k)));
  const res = Math.max(1, Math.min(RES_MAX, Math.round(k * 4) / 4));
  const cw = (w * k) / dpr, ch = (BASE_H * k) / dpr;
  const top = ins.t || ins.b ? ins.t - (SKY_CUT * k) / dpr + ((cssH - ins.t - ins.b) - (band * k) / dpr) / 2 : (cssH - ch) / 2;
  return { w, h: BASE_H, k, res, cssW: cw, cssH: ch, left: (cssW - cw) / 2, top };
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
  const ins = { t: 0, b: 0 };
  const apply = () => {
    const f = fitView(host.clientWidth || innerWidth, host.clientHeight || innerHeight, devicePixelRatio || 1, ins);
    const sized = f.w !== view.w || f.h !== view.h;
    if (sized || f.res !== app.renderer.resolution) {
      view.w = f.w; view.h = f.h;
      app.renderer.resize(f.w, f.h, f.res);
      if (sized) for (const fn of listeners) fn(view);
    }
    cv.style.width = `${f.cssW}px`;
    cv.style.height = `${f.cssH}px`;
    cv.style.left = `${f.left}px`;
    cv.style.top = `${f.top}px`;
  };
  /* HUD 가 자기 띠 높이를 알려 준다 (hud.js · 'idg-insets' { t, b }) */
  const onIns = (e) => { const d = e.detail || {}; if (Math.abs((d.t || 0) - ins.t) < 1 && Math.abs((d.b || 0) - ins.b) < 1) return; ins.t = d.t || 0; ins.b = d.b || 0; apply(); };
  host.addEventListener('idg-insets', onIns);
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
      host.removeEventListener('idg-insets', onIns);
      app.destroy({ removeView: true, releaseGlobalResources: true }, { children: true });
    },
  };
}
