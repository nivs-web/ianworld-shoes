/**
 * 뱃지 정의 — 로비 캐릭터 옆 진열대 2칸.
 *
 *   1칸 도감완성 : **지금 들고 있는 종류**가 130종 전부일 때. 신발을 써서 한 종류라도
 *                  0켤레가 되면 그 순간 빠진다 (다시 모으면 다시 달린다).
 *   2칸 계단     : 최고기록이 넘긴 단계 중 **가장 높은 하나**. 최고기록은 줄지 않으므로
 *                  한 번 달면 안 뺏긴다.
 *
 * 조건 판정은 전부 여기 순수 함수로 둔다 — 화면은 결과만 그린다.
 */

import S from '../config/strings.ko.js';
import { STAIR_BADGE_STEPS, DEX_BADGE_REQUIRED } from '../config/balance.js';

/** 뱃지 등급 — 색만 다르다. 오래 판 사람이 한눈에 구분되게. */
export const RANK = { BRONZE: 'bronze', SILVER: 'silver', GOLD: 'gold' };

/** @param {number} floors @returns {string} */
function rankOf(floors) {
  if (floors >= 4000) return RANK.GOLD;
  if (floors >= 2000) return RANK.SILVER;
  return RANK.BRONZE;
}

/**
 * 계단 뱃지 10종. `1,000` 처럼 세 자리마다 쉼표를 넣는다 —
 * 뱃지 안에서는 숫자가 짧을수록 읽기 쉬운데, 쉼표가 자릿수를 대신 읽어 준다.
 */
export const STAIR_BADGES = STAIR_BADGE_STEPS.map((floors) => ({
  id: `stairs_${floors}`,
  floors,
  top: floors.toLocaleString('en-US'), // 1,000
  bottom: S.badgeStairsUnit,
  rank: rankOf(floors),
}));

export const DEX_BADGE = {
  id: 'dex_complete',
  top: S.badgeDexTop,
  bottom: S.badgeDexBottom,
  rank: RANK.GOLD,
};

/**
 * 지금 달고 있는 뱃지 2칸. 없는 칸은 null (빈 진열대를 그린다).
 * @param {object} profile
 * @returns {[object|null, object|null]}
 */
export function badgeSlots(profile) {
  const heldTypes = Object.values(profile.shoesByIndex ?? {}).filter((n) => n > 0).length;
  const dex = heldTypes >= DEX_BADGE_REQUIRED ? DEX_BADGE : null;

  const best = profile.bestStairs ?? 0;
  let stairs = null;
  for (const b of STAIR_BADGES) if (best >= b.floors) stairs = b; // 오름차순이라 마지막이 최고

  return [dex, stairs];
}
