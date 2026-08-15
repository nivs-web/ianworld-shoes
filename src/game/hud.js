/**
 * 인게임 HUD — 전부 캔버스에 그린다. DOM 금지. (CLAUDE.md §6-3)
 * 한글 라벨은 아이콘+숫자로 대체 (한글 비트맵 폰트는 M5에서 DOM 화면과 함께).
 */

import { GAUGE_MAX } from '../config/balance.js';
import { HUD, CONTROLS } from '../config/layout.js';
import { rect, strokeRect, draw } from '../core/sprite.js';
import { text } from '../core/pixelfont.js';
import { isHeld, BTN } from '../core/input.js';
import { img } from '../core/assets.js';
import { PAL } from './palette.js';

/**
 * @param {object} s {gauge, floor, shoesFound, revives, controlMode}
 */
export function renderHud(s) {
  // ── 시간 게이지 ──
  const g = HUD.gauge;
  const f = HUD.gaugeFill;
  rect(g.x, g.y, g.w, g.h, PAL.gaugeBg);
  strokeRect(g.x, g.y, g.w, g.h, PAL.panelDark);
  strokeRect(g.x + 1, g.y + 1, g.w - 2, g.h - 2, PAL.line);
  const ratio = Math.max(0, s.gauge) / GAUGE_MAX;
  const fillW = Math.round(f.w * ratio);
  rect(f.x, f.y, fillW, f.h, ratio < 0.3 ? PAL.gaugeWarn : PAL.gaugeFill);

  // ── 일시정지 버튼 ──
  const p = HUD.pause;
  rect(p.x, p.y, p.w, p.h, PAL.panel);
  strokeRect(p.x, p.y, p.w, p.h, PAL.line);
  rect(p.x + 5, p.y + 4, 3, 10, PAL.accent);
  rect(p.x + 10, p.y + 4, 3, 10, PAL.accent);

  // ── 좌상단: 신발 아이콘 + 찾은 수 ──
  const icon = img('shoe_icon');
  if (icon) draw(icon, HUD.shoesIcon.x, HUD.shoesIcon.y);
  text(`${s.shoesFound}`, HUD.shoesLabel.x, HUD.shoesLabel.y, {
    color: PAL.text, outline: PAL.textShadow, scale: 2,
  });

  // ── 우상단: 부활 하트 + 수 ──
  if (s.revives > 0) {
    drawHeartIcon(HUD.reviveLabel.x - 22, HUD.reviveLabel.y);
    text(`${s.revives}`, HUD.reviveLabel.x, HUD.reviveLabel.y, {
      color: PAL.text, shadow: PAL.textShadow, align: 'right',
    });
  }

  // ── 중앙: 계단 수 (대형) ──
  text(String(s.floor), HUD.score.x, HUD.score.y, {
    color: PAL.text, outline: PAL.textShadow, scale: HUD.score.scale, align: 'center',
  });

  // ── 조작 버튼 ──
  renderButtons(s.controlMode);
}

/**
 * 조작 버튼 — 원본 시트(etc/인터페이스 버튼.png)에서 자른 스프라이트를 쓴다.
 * 조작 모드별 아이콘 배치 (기획서 §4-2)
 *   1: 전환 · 상승   2: 상승 · 전환   3: 좌상승 · 우상승
 */
const BTN_ICONS = {
  1: ['btn_turn', 'btn_up'],
  2: ['btn_up', 'btn_turn'],
  3: ['btn_left', 'btn_right'],
};

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

/** 일시정지 버튼 히트 판정 */
export function hitPause(x, y) {
  const p = HUD.pause;
  return x >= p.x - 4 && x <= p.x + p.w + 4 && y >= p.y - 4 && y <= p.y + p.h + 4;
}
