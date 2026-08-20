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

import { text, measure, glyphH, smallReady } from '../core/pixelfont.js';

/**
 * @param {string|number} str
 * @param {object} [opt]
 * @param {number} [opt.scale] 정수 배율 (기본 3 = 33px 높이)
 * @param {string} [opt.color]
 * @param {string} [opt.outline] 8방향 1도트 외곽선 — 인게임 계단 수와 같은 처리
 * @param {boolean} [opt.mono] 숫자 고정폭
 * @param {boolean} [opt.mini] 9px **숫자 전용** 글꼴로 찍는다 (23차). 정적이라 기다릴 필요가
 *   없다 — `scale: 2` 면 정확히 18px 이다. 숫자가 아닌 글자는 이 글꼴에 없다.
 * @param {boolean} [opt.small] 7px 글꼴로 찍는다 — **`loadSmallFont()` 가 끝난 뒤에만**
 *   실제로 적용된다(아직이면 11px 로 그린다). 부르는 쪽이 기다렸다 그려야 한다.
 * @returns {HTMLCanvasElement}
 */
export function pixelText(str, opt = {}) {
  const s = Math.max(1, opt.scale | 0 || 3);
  const mono = !!opt.mono;
  /** 작은 글꼴은 아직 안 왔으면 없는 셈 친다 — 크기 계산과 그리기가 어긋나면 잘린다 */
  const small = !!opt.small && smallReady();
  const mini = !!opt.mini;
  const pad = opt.outline ? s : 0; // 외곽선이 잘리지 않게 사방 여백

  const cv = document.createElement('canvas');
  cv.width = Math.max(1, measure(str, s, mono, small, mini) + pad * 2);
  cv.height = glyphH(small, mini) * s + pad * 2;
  cv.className = 'px-text';
  /**
   * 그린 값을 DOM 에 남긴다 — 캔버스는 `textContent` 에 안 잡혀서, 이게 없으면
   * 검사·미리보기가 "무엇이 찍혔는지" 알 방법이 없다(18차에 로비 문구 검사가 막혔다).
   */
  cv.dataset.text = String(str);
  /**
   * 외곽선 여백(사방 `pad`)은 **투명한 빈 칸**이다. 문장 안에 끼워 넣으면 그만큼
   * 앞뒤 글자가 밀려 **띄어쓰기를 한 것처럼 보인다**(18차 사용자 신고: *"계단과 켤레가
   * 숫자 옆에 바로 붙어 있어야 하는데 한칸 띄어쓰기 한거 같다"*). 부르는 쪽이
   * 음수 여백으로 상쇄할 수 있게 값을 남긴다.
   */
  cv.dataset.pad = String(pad);
  // 뷰포트 배율과 무관하게 1캔버스px = 1CSS px (CSS 쪽에서 pixelated 유지)
  cv.style.width = `${cv.width}px`;
  cv.style.height = `${cv.height}px`;

  const ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  text(String(str), pad, pad, { ...opt, scale: s, mono, small, mini, align: 'left', ctx });

  return cv;
}
