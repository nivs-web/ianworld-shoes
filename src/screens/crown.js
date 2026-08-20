/**
 * 왕관 — 1·2·3위 표시. (2026-08-19 23차, 사용자 지정)
 *
 * *"1위,2위,3위 3개의 경우 왼쪽에 왕관 마크가 있었으면 좋겠어 (…) 그래야 1위 하고
 *   싶어서 서로 경쟁하지"*
 *
 * 그림은 `tools/build-crowns.mjs` 가 굽는다(금·은·동 + 1도트 그림자). 여기서는
 * **어디에 붙일지**만 정한다 — 명예의 전당·멀티게임순위의 줄, 내 순위 줄,
 * 그리고 멀티 메뉴의 [멀티게임순위] 버튼 양쪽.
 *
 * 화면마다 `<img>` 를 따로 만들지 않는 이유는 늘 같다: 세 화면이 각자 만들면
 * 언젠가 크기·경로가 갈라진다(§9-0-41 의 유저상태창과 같은 실수를 막는다).
 */

import { el } from './ui.js';

/** 왕관이 붙는 등수 — 4위부터는 없다 */
export const CROWN_MAX = 3;

export const hasCrown = (rank) => Number.isFinite(rank) && rank >= 1 && rank <= CROWN_MAX;

/**
 * 순위표 줄의 왕관 자리. **왕관이 없어도 칸은 남는다** —
 * 안 그러면 1~3위 줄만 등수 숫자가 옆으로 밀려 **목록 전체가 삐뚤어진다**
 * (`qa:hoffit` 이 등수 숫자의 왼쪽 끝이 줄마다 같은지 잰다).
 */
export function crownSlot(rank) {
  return el('span.crown-slot', null, [crownImg(rank)].filter(Boolean));
}

/**
 * @param {number} rank 1·2·3 (그 밖이면 null)
 * @param {string} [cls] 덧붙일 클래스
 * @returns {HTMLImageElement|null}
 */
export function crownImg(rank, cls = '') {
  if (!hasCrown(rank)) return null;
  return el(`img.crown${cls ? `.${cls}` : ''}`, {
    // 절대 경로다 — 상대 경로면 /tools/… 같은 하위 경로에서 열었을 때 404 가 된다
    src: `/assets/ui/crown_${rank}.png`,
    alt: '',
    // 순위표는 100줄까지 나온다 — 화면 밖 왕관까지 미리 받을 이유가 없다
    loading: 'lazy',
    decoding: 'async',
    'aria-hidden': 'true',
  });
}
