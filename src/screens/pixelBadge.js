/**
 * 뱃지 — 로비 진열대에 놓이는 동그란 도트 뱃지.
 *
 * DOM 화면이지만 CSS `border-radius` 로 그리면 가장자리가 안티앨리어싱된다.
 * 게임 화면과 같은 도트 질감을 유지해야 하므로 작은 캔버스에 **원을 한 도트씩 채운다**.
 *
 * 빈 칸은 회색 원 + **안쪽 엠보싱**(왼쪽 위 그늘 / 오른쪽 아래 하이라이트)으로
 * "파여 있는 자리"처럼 보이게 한다. 채워지면 테두리가 서고 가운데 글씨가 들어간다.
 */

import { text, measure, GLYPH_H } from '../core/pixelfont.js';
import { RANK } from '../data/badges.js';

/**
 * 뱃지 한 변(도트 = CSS px).
 *
 * 52는 계산해서 나온 값이다. 글자 두 줄(11px×2 + 간격)이 중앙에 놓이면 각 줄의
 * 바깥쪽 끝이 중심에서 약 10.5도트 떨어지는데, 그 높이에서 원 안쪽 면의 폭은
 * `2·√(r² − 10.5²)` 다. 가장 긴 문구인 `1,000`(36도트)이 들어가려면 r ≥ 22,
 * 즉 테두리·엠보싱 4도트를 더해 한 변 52가 필요하다.
 * 더 줄이면 숫자가 테두리를 뚫고 나간다.
 */
export const BADGE_SIZE = 52;

/** 비어 있는 자리 — 안쪽으로 **파인** 느낌 (왼쪽 위가 그늘) */
const EMPTY = {
  rim: '#241F1B',
  shade: '#2E2924',
  light: '#6E6459',
  face: '#4A423A',
};

/** 채워진 뱃지 — 반대로 **볼록하게** (왼쪽 위가 빛) */
const FILLED = {
  [RANK.BRONZE]: { rim: '#4A2810', face: '#C77B45', light: '#F0B584', shade: '#7A4520', text: '#3A1D08' },
  [RANK.SILVER]: { rim: '#3D444C', face: '#B9C0C9', light: '#EFF3F7', shade: '#7C848D', text: '#262A2F' },
  [RANK.GOLD]: { rim: '#6B4708', face: '#E7B33C', light: '#FFEBA8', shade: '#A87A16', text: '#3F2A05' },
};

/** 원 안쪽인지 — 도트 중심 기준이라 계단이 고르게 나온다 */
const inDisc = (x, y, c, r) => (x - c + 0.5) ** 2 + (y - c + 0.5) ** 2 <= r * r;

/**
 * @param {object|null} badge data/badges.js 항목. null 이면 빈 진열대.
 * @returns {HTMLCanvasElement}
 */
export function pixelBadge(badge) {
  const S = BADGE_SIZE;
  const cv = document.createElement('canvas');
  cv.width = S;
  cv.height = S;
  cv.className = 'px-badge';
  cv.style.width = `${S}px`;
  cv.style.height = `${S}px`;

  const ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const c = S / 2;
  const rOuter = c - 1;
  const pal = badge ? FILLED[badge.rank] ?? FILLED[RANK.BRONZE] : EMPTY;

  /**
   * 바깥부터 세 겹: 테두리 2도트 → 엠보싱 링 2도트 → 안쪽 면.
   * 엠보싱 링은 대각선(왼쪽 위 / 오른쪽 아래)으로 색을 갈라 입체감을 만든다.
   * 빈 칸은 왼쪽 위가 어둡고(파임), 채운 칸은 왼쪽 위가 밝다(볼록).
   */
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      if (!inDisc(x, y, c, rOuter)) continue;
      let color;
      if (!inDisc(x, y, c, rOuter - 2)) color = pal.rim;
      else if (!inDisc(x, y, c, rOuter - 4)) {
        const upperLeft = (x - c) + (y - c) < 0;
        color = badge
          ? (upperLeft ? pal.light : pal.shade)
          : (upperLeft ? EMPTY.shade : EMPTY.light);
      } else color = pal.face;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    }
  }

  if (badge) {
    // 두 줄로 나눠 넣는다 — 한 줄로는 '1,000계단'이 원 안에 절대 안 들어간다
    const lines = [badge.top, badge.bottom];
    const totalH = lines.length * GLYPH_H + 1;
    let y = Math.round(c - totalH / 2);
    for (const line of lines) {
      const w = measure(line, 1);
      text(line, Math.round(c - w / 2), y, { color: pal.text, ctx });
      y += GLYPH_H + 1;
    }
  }

  return cv;
}
