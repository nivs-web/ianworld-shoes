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

/**
 * 싸움 줄은 언제나 단추 줄 위 (2026-11-12 대표님 «확대하든 축소하든 · 가로든 세로든 단추 영역 아래로 좀비와 드래곤이 싸우는 영역이 내려가지 않게 · 월드 1~10 모두»)
 * 규정 : 가장 아래 줄 발(그 월드 lanes spawnY[1] + 보스 6칸 = foot) 의 화면 y ≤ 카드 줄 위끝 − FOOT_GAP(css px).
 *  1) 넘치면 먼저 캔버스를 올린다 — 캔버스 아래 끝이 보이는 바닥(가로 = 화면 아래 끝 · 세로 = 단추 줄 위끝) 밑으로 남는 만큼만 (빈 곳이 안 보이게).
 *  2) 그래도 넘치면 전장을 캔버스 안에서 lift 칸 올린다(battleView root.y) — 앞 겹 아래 끝 밑은 앞 겹을 위아래로 뒤집어 이어 그려 빈 곳이 없다.
 *  3) lift 는 LIFT_MAX 칸 · 화면 높이의 LIFT_VH 중 작은 쪽까지만(하늘이 너무 잘리지 않게). 넘는 만큼(squeeze 칸)은 세 줄 범위를 위로 눌러 담는다(battleView laneMap).
 * 하늘 위쪽이 그만큼 더 잘린다(대표님 11/11 «달 윗부분까지 다 나올 필요 없다»). 확대(z) · 화면 비율이 바뀌어도 apply 마다 다시 맞춘다. 그리기 전용 — 코어 판정과 무관.
 */
export const FOOT_GAP = 8, LIFT_MAX = 30, LIFT_VH = 0.08;
function footFit(top, k, dpr, cssH, bar, foot, floorCss) {
  if (!foot || !bar) return { top, lift: 0, squeeze: 0 };
  const kc = k / dpr, over = top + foot * kc - (cssH - bar - FOOT_GAP - 1);   /* 1px = HUD 가 알려 주는 띠 높이 반올림 몫 */
  if (over <= 0) return { top, lift: 0, squeeze: 0 };
  const mv = Math.min(over, Math.max(0, top + BASE_H * kc - floorCss));
  const need = Math.ceil((over - mv) / kc), cap = Math.floor(Math.min(LIFT_MAX, (cssH * LIFT_VH) / kc)), lift = Math.min(need, cap);
  return { top: top - mv, lift, squeeze: need - lift };
}

/** 창 크기 → { w: 칸 가로, h: 칸 세로, k: 물리 픽셀 배율, css: CSS 크기 · 자리, lift: 전장을 올릴 칸 } · ins = HUD 띠 높이 { t, b } (CSS px) · foot = 가장 아래 발 y(칸) */
export function fitView(cssW, cssH, dpr, ins = { t: 0, b: 0 }, foot = 0) {
  const pw = Math.max(1, Math.floor(cssW * dpr));
  /* 떠 있는 HUD (ins.f = { top, bottom } 잘라 낼 칸) : 대표님 «달 윗부분까지 다 나올 필요 없다 · 더 확대» → 하늘 위를 잘라 그만큼 크게 */
  const crop = ins.f || null;
  const band = crop ? BASE_H - crop.top - crop.bottom : ins.t || ins.b ? BASE_H - SKY_CUT - DIRT_CUT : BASE_H;
  const ph = Math.max(1, Math.floor((cssH - ins.t - ins.b) * dpr));
  const portrait = cssH > cssW * 1.05;
  /*
   * 세로 전투 (11/11 대표님 3차 «냥코처럼 훨씬 확대 · 아래 단추 줄 뒤까지는 안 돼도 나머지는 크게») :
   * 확대 끝(z ≥ 1)이면 전장 띠가 화면 위 끝 ~ 아래 단추 줄 바로 위를 꽉 채운다. 두 손가락으로 줄이면(z → 0) 가로 760칸까지 넓게.
   * 땅 줄은 언제나 단추 줄 바로 위에 붙인다 (줄이면 위쪽이 빈다).
   */
  if (crop && portrait) {
    const bar = (crop.bar || 90) + 6, availPh = Math.max(1, (cssH - bar - (crop.hudTop || 0)) * dpr);   /* 위 = 성 체력 게이지 아래 여백까지 (그 위는 하늘이 HUD 뒤로 이어짐) */
    const kFill = availPh / band, kWide = pw / 760, t = Math.max(0, Math.min(1, crop.z ?? 1));
    const k = Math.max(kWide, kWide + (kFill - kWide) * t);
    const w = Math.max(180, Math.min(MAX_W, Math.floor(pw / k)));
    const res = Math.max(1, Math.min(RES_MAX, Math.round(k * 4) / 4));
    const cw = (w * k) / dpr, ch = (BASE_H * k) / dpr;
    const ff = footFit(cssH - bar - ((BASE_H - crop.bottom) * k) / dpr, k, dpr, cssH, crop.bar || 90, foot, cssH - bar), topP = ff.top;
    /* 아래 용 카드 줄 뒤로는 전장을 그리지 않는다 (대표님 11/11 «아래 버튼까지는 침범하지 않게») — 캔버스 아랫부분을 잘라 낸다 */
    return { w, h: BASE_H, k, res, cssW: cw, cssH: ch, left: (cssW - cw) / 2, top: topP, clipB: Math.max(0, topP + ch - (cssH - bar)), lift: ff.lift, squeeze: ff.squeeze };
  }
  const minW = crop ? (portrait ? 420 : 760) / Math.max(1, crop.z || 0) ** 0.9 : BASE_W;   /* 손으로 더 확대(z > 1)하면 보이는 칸을 그만큼 줄인다 */   /* 떠 있는 HUD : 어느 기기든 화면을 꽉 채운다(태블릿 · PC 처럼 덜 긴 화면은 화면 너비를 760칸까지 줄여 위아래 검은 띠 없이) */
  const kFit = Math.min(pw / minW, ph / band);
  /*
   * 2026-11-11 대표님 «PC 에서 배경이 흐리다» : 예전엔 960×540 으로 그린 캔버스를 그대로 늘려서 제미나이 고해상도 그림이 뭉개졌다.
   * 이제 화면을 꽉 채우는 배율(kFit)로 맞추고, 캔버스 자체를 그 배율만큼 촘촘하게 그린다(res · 상한 RES_MAX — 태블릿 · 고밀도 폰 부담).
   */
  /* 띠가 있을 때 : 좌우 빈칸이 생기면 안 된다(대표님 «양끝 여백 없이 · 확대된 듯한 화면이 좋다») → 가로를 꽉 채우는 배율보다 작아지지 않게 */
  const k = crop || ins.t || ins.b ? Math.max(kFit, pw / MAX_W) : kFit;
  const w = Math.max(minW, Math.min(MAX_W, Math.floor(pw / k)));
  const res = Math.max(1, Math.min(RES_MAX, Math.round(k * 4) / 4));
  const cw = (w * k) / dpr, ch = (BASE_H * k) / dpr;
  const avail = cssH - ins.t - ins.b, bandCss = (band * k) / dpr;
  /* 띠 사이에 다 들어가면 가운데 · 모자라면 땅 줄(흙 위)을 아래 띠 바로 위에 붙이고 하늘 위쪽을 더 자른다 (땅 · 유닛은 항상 보이게) */
  const top = crop ? (bandCss <= cssH ? (cssH - bandCss) / 2 - (crop.top * k) / dpr : cssH - ((BASE_H - crop.bottom) * k) / dpr) :   /* 넘치면 땅 쪽(아래)을 맞추고 하늘을 더 자른다 */ !(ins.t || ins.b) ? (cssH - ch) / 2 : bandCss <= avail ? ins.t + (avail - bandCss) / 2 - (SKY_CUT * k) / dpr : cssH - ins.b - ((BASE_H - DIRT_CUT) * k) / dpr;
  /* 캔버스가 화면보다 크면 위 · 아래 끝에 빈칸이 생기지 않게 */
  /* 세로 : 캔버스를 화면 위 18% 아래에 붙이고(위 HUD 자리) 아래는 단추 자리로 비운다 */
  const topC = crop && portrait && ch < cssH ? Math.max(0, Math.min(cssH * 0.09, cssH - ch - 150)) - (crop.top * k) / dpr * 0 : ch >= cssH ? Math.min(0, Math.max(cssH - ch, top)) : top;
  const ff = crop ? footFit(topC, k, dpr, cssH, crop.bar, foot, cssH) : { top: topC, lift: 0, squeeze: 0 };   /* 가로 : 카드는 캔버스 위에 떠 있다 → 보이는 바닥 = 화면 아래 끝 */
  return { w, h: BASE_H, k, res, cssW: cw, cssH: ch, left: (cssW - cw) / 2, top: ff.top, lift: ff.lift, squeeze: ff.squeeze };
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

  const view = { w: first.w, h: first.h, lift: 0, squeeze: 0 };
  const listeners = [];
  const ins = { t: 0, b: 0 };
  let foot = 0;   /* 가장 아래 줄 발 y (칸) — 전투가 월드 lanes 를 읽고 setFoot 로 알려 준다 */
  const apply = () => {
    const f = fitView(host.clientWidth || innerWidth, host.clientHeight || innerHeight, devicePixelRatio || 1, ins, foot);
    view.lift = f.lift || 0; view.squeeze = f.squeeze || 0;
    view.topRow = (-f.top * (devicePixelRatio || 1)) / f.k + view.lift;   /* 화면 위 끝에 오는 전장 칸 (하늘 재미 요소가 위 HUD 뒤로 숨지 않게 · battleView) */
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
    cv.style.clipPath = f.clipB ? `inset(0 0 ${f.clipB}px 0)` : '';
  };
  /* HUD 가 자기 띠 높이를 알려 준다 (hud.js · 'idg-insets' { t, b }) */
  const onIns = (e) => { const d = e.detail || {}; if (Math.abs((d.t || 0) - ins.t) < 1 && Math.abs((d.b || 0) - ins.b) < 1 && JSON.stringify(d.f || null) === JSON.stringify(ins.f || null)) return; ins.t = d.t || 0; ins.b = d.b || 0; ins.f = d.f || null; apply(); };
  host.addEventListener('idg-insets', onIns);
  apply();
  const onWin = () => apply();
  addEventListener('resize', onWin);
  addEventListener('orientationchange', onWin);

  return {
    app,
    view,
    onResize(fn) { listeners.push(fn); },
    /** 싸움 줄 아래 끝(칸) — 이 줄이 늘 단추 줄 위에 오게 화면을 맞춘다 (fitView footFit) · 0 = 끔 */
    setFoot(y) { const v = Math.max(0, Math.min(BASE_H, Number(y) || 0)); if (v !== foot) { foot = v; apply(); } },
    destroy() {
      removeEventListener('resize', onWin);
      removeEventListener('orientationchange', onWin);
      host.removeEventListener('idg-insets', onIns);
      app.destroy({ removeView: true, releaseGlobalResources: true }, { children: true });
    },
  };
}
