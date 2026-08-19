/**
 * 인게임 HUD — 전부 캔버스에 그린다. DOM 금지. (CLAUDE.md §6-3)
 * 한글 라벨은 아이콘+숫자로 대체 (한글 비트맵 폰트는 M5에서 DOM 화면과 함께).
 */

import { GAUGE_MAX } from '../config/balance.js';
import { HUD, CONTROLS } from '../config/layout.js';
import { rect, strokeRect, draw } from '../core/sprite.js';
// HUD 는 매 프레임 그린다 — 외곽선 글자는 반드시 캐시본을 쓴다 (pixelfont.js 주석)
import { textCached } from '../core/pixelfont.js';
import { isHeld, BTN } from '../core/input.js';
import { img } from '../core/assets.js';
import { PAL } from './palette.js';

/**
 * @param {object} s {gauge, floor, shoesFound, revives, controlMode}
 */
export function renderHud(s) {
  // ── 시간 게이지 ──
  // 프레임은 사용자 아트를 도트로 다시 찍은 스프라이트(gauge_frame.png),
  // 채움만 런타임 사각형 — 이래야 어떤 비율에서도 도트가 깨지지 않는다.
  const g = HUD.gauge;
  const f = HUD.gaugeFill;
  const ratio = Math.max(0, s.gauge) / GAUGE_MAX;
  const fillW = Math.round(f.w * ratio);
  const frame = img('gauge_frame');
  if (frame) {
    draw(frame, g.x, g.y);
  } else {
    rect(g.x, g.y, g.w, g.h, PAL.uiFace);
    strokeRect(g.x, g.y, g.w, g.h, PAL.uiOutline);
    rect(f.x, f.y, f.w, f.h, PAL.gaugeBg);
  }
  if (fillW > 0) rect(f.x, f.y, fillW, f.h, ratio < 0.3 ? PAL.gaugeWarn : PAL.gaugeFill);

  // ── 일시정지 버튼 ──
  const p = HUD.pause;
  const pauseImg = img('btn_pause');
  if (pauseImg) {
    draw(pauseImg, p.x, p.y);
  } else {
    rect(p.x, p.y, p.w, p.h, PAL.uiFace);
    strokeRect(p.x, p.y, p.w, p.h, PAL.uiOutline);
    rect(p.x + 4, p.y + 5, 4, 9, PAL.accent);
    rect(p.x + 10, p.y + 5, 4, 9, PAL.accent);
  }

  // ── 좌상단(아이콘 행): 신발 아이콘 + 찾은 수 ──
  const icon = img('shoe_icon');
  if (icon) draw(icon, HUD.shoesIcon.x, HUD.shoesIcon.y);
  textCached(`${s.shoesFound}`, HUD.shoesLabel.x, HUD.shoesLabel.y, {
    color: PAL.text, outline: PAL.textShadow, scale: HUD.shoesLabel.scale, mono: true,
  });

  // ── 우상단(같은 행): 부활 하트 + 수 ──
  if (s.revives > 0) {
    drawHeartIcon(HUD.reviveHeart.x, HUD.reviveHeart.y);
    textCached(`${s.revives}`, HUD.reviveLabel.x, HUD.reviveLabel.y, {
      color: PAL.text, outline: PAL.textShadow, scale: HUD.reviveLabel.scale,
      align: HUD.reviveLabel.align, mono: true,
    });
  }

  // ── 중앙(아래 행): 계단 수 ──
  // mono: 자릿수가 바뀌어도 가운데 정렬이 흔들리지 않게 고정폭으로 찍는다.
  textCached(String(s.floor), HUD.score.x, HUD.score.y, {
    color: PAL.text, outline: PAL.textShadow, scale: HUD.score.scale,
    align: HUD.score.align, mono: true,
  });

  // ── 조작 버튼 ──
  renderButtons(s.controlMode);
}

/**
 * 조작 버튼 — 원본 시트(etc/인터페이스 버튼.png)에서 자른 스프라이트를 쓴다.
 * 조작 모드별 아이콘 배치 (기획서 §4-2)
 *   1: 전환 · 상승   2: 상승 · 전환   3: 좌상승 · 우상승
 */
export const BTN_ICONS = {
  1: ['btn_turn', 'btn_up'],
  2: ['btn_up', 'btn_turn'],
  3: ['btn_left', 'btn_right'],
};

/**
 * 그 모드가 실제로 쓰는 버튼 그림만 — 네 장을 다 받을 이유가 없다.
 * (모드 3이면 `btn_turn`·`btn_up` 1,790B 가 통째로 낭비였다)
 */
export const buttonAssets = (mode) =>
  (BTN_ICONS[mode] ?? BTN_ICONS[1]).map((key) => ({ key, url: `/assets/ui/${key}.png` }));

function renderButtons(mode) {
  const icons = BTN_ICONS[mode] ?? BTN_ICONS[1];
  const defs = [
    { key: BTN.LEFT, r: CONTROLS.left, icon: icons[0] },
    { key: BTN.RIGHT, r: CONTROLS.right, icon: icons[1] },
  ];

  for (const { key, r, icon } of defs) {
    const pressed = isHeld(key);
    const y = r.y + (pressed ? CONTROLS.pressOffsetY : 0);
    const sprite = img(icon);
    if (sprite) {
      draw(sprite, r.x, y);
      continue;
    }
    // 에셋 로드 전 폴백
    rect(r.x, y, r.w, r.h, PAL.panel);
    rect(r.x, y + r.h - 5, r.w, 5, PAL.panelDark);
    strokeRect(r.x, y, r.w, r.h, PAL.line);
  }
}

function drawHeartIcon(x, y) {
  const c = '#E84A5C';
  rect(x + 1, y, 3, 2, c);
  rect(x + 6, y, 3, 2, c);
  rect(x, y + 2, 10, 3, c);
  rect(x + 2, y + 5, 6, 2, c);
  rect(x + 4, y + 7, 2, 1, c);
}

/**
 * 일시정지 버튼은 이제 **위치 안내용 그림**이다.
 * 판정은 상단 밴드 전체(layout.TOUCH.pauseBelowY)라 여기서 따로 히트 검사를 하지 않는다.
 */
