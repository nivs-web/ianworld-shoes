/**
 * DOM 화면에서 **인게임과 똑같은 글자**를 쓰기 위한 도구.
 *
 * 로비·도감은 DOM이라 CSS 폰트를 쓰는데, 그러면 인게임 계단 수와 로비 최고기록이
 * 서로 다른 글꼴로 보인다. 최고기록처럼 "게임 화면과 같아야 하는" 숫자는
 * 작은 캔버스에 비트맵 폰트로 찍어서 그대로 DOM에 끼워 넣는다.
 *
 * 남용하지 말 것 — 본문 문구까지 이걸로 그리면 줄바꿈도 선택도 안 된다.
 * 숫자·짧은 라벨처럼 **모양이 중요한 곳**에만 쓴다.
 */

import { text, measure, GLYPH_H } from '../core/pixelfont.js';

/**
 * @param {string|number} str
 * @param {object} [opt]
 * @param {number} [opt.scale] 정수 배율 (기본 3 = 33px 높이)
 * @param {string} [opt.color]
 * @param {string} [opt.outline] 8방향 1도트 외곽선 — 인게임 계단 수와 같은 처리
 * @param {boolean} [opt.mono] 숫자 고정폭
 * @returns {HTMLCanvasElement}
 */
export function pixelText(str, opt = {}) {
  const s = Math.max(1, opt.scale | 0 || 3);
  const mono = !!opt.mono;
  const pad = opt.outline ? s : 0; // 외곽선이 잘리지 않게 사방 여백

  const cv = document.createElement('canvas');
  cv.width = Math.max(1, measure(str, s, mono) + pad * 2);
  cv.height = GLYPH_H * s + pad * 2;
  cv.className = 'px-text';
  // 뷰포트 배율과 무관하게 1캔버스px = 1CSS px (CSS 쪽에서 pixelated 유지)
  cv.style.width = `${cv.width}px`;
  cv.style.height = `${cv.height}px`;

  const ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  text(String(str), pad, pad, { ...opt, scale: s, mono, align: 'left', ctx });

  return cv;
}
