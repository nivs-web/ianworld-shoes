/**
 * 캐릭터 10명 메타. 스프라이트 규격·발 좌표는 빌드 산출물
 * `characters.generated.json` 에 있고, 여기에는 **기획 데이터**만 둔다.
 * 해금 비용은 balance.js(UNLOCK_COST)가 진실이다. (CLAUDE.md §3-5)
 */

import { UNLOCK_COST } from '../config/balance.js';
import meta from './characters.generated.json';

/** 노출 순서 = 기획서 §5-8 표 순서 (무료 5명 먼저) */
export const CHARACTER_ORDER = [
  'ian', 'denny', 'lisa', 'ipo', 'charles',
  'kyungtae', 'maho', 'tony', 'jenny', 'rose',
];

export const DEFAULT_CHARACTER = 'ian';

/** 처음부터 열려 있는 캐릭터 */
export const FREE_CHARACTERS = CHARACTER_ORDER.filter((id) => (UNLOCK_COST[id] ?? 0) === 0);

/**
 * @typedef {object} CharacterInfo
 * @property {string} id
 * @property {string} ko 한글 이름
 * @property {number} cost 해금에 필요한 신발 수 (0 = 무료)
 * @property {number} order 노출 순서
 */

/** @type {CharacterInfo[]} */
export const CHARACTERS = CHARACTER_ORDER.map((id, i) => ({
  id,
  ko: meta[id]?.ko ?? id,
  cost: UNLOCK_COST[id] ?? 0,
  order: i,
}));

/** @param {string} id */
export function characterById(id) {
  return CHARACTERS.find((c) => c.id === id) ?? CHARACTERS[0];
}

/** 스프라이트 경로 — 잠금 캐릭터는 화면에서 실루엣으로 덮는다 (기획서 §5-8) */
export function characterSprite(id, cut = 'front') {
  return `/assets/characters/${id}_${cut}.png`;
}
