/**
 * 배경 데이터. 실제 이미지는 tools/downscale-bg.mjs 가 만든다.
 * 근거: docs/GAME_DESIGN.md §9-5
 */

import { FLOOR_EVENTS } from '../config/balance.js';

/** 건물 16종. 게임 시작 시 이 중 하나를 랜덤으로 고른다. */
export const BUILDINGS = [
  { id: 'build_01', name: '카우보이' },
  { id: 'build_02', name: '미국 서부개척시대' },
  { id: 'build_03', name: '강남 2036' },
  { id: 'build_04', name: '미래 도쿄' },
  { id: 'build_05', name: '일본 헤이안 궁정' },
  { id: 'build_06', name: '동물의 집' },
  { id: 'build_07', name: '조선' },
  { id: 'build_08', name: '고대국' },
  { id: 'build_09', name: '북미 부잣집' },
  { id: 'build_10', name: '조선총독부' },
  { id: 'build_11', name: '고대 이집트' },
  { id: 'build_12', name: '폴란드' },
  { id: 'build_13', name: '숲속의 별장' },
  { id: 'build_14', name: '만물상' },
  { id: 'build_15', name: '숲속의 별장 II' },
  { id: 'build_16', name: '고대 로마' },
];

/** 층수별 교체 배경. 180×320 풀스크린 (반복 타일이 아니다) */
export const FLOOR_BACKGROUNDS = FLOOR_EVENTS.bgSwap;

/** 한 건물이 쓰는 이미지 3장의 경로 */
export function buildingAssets(id) {
  return {
    road: `/assets/bg/${id}_road.png`,
    floor1: `/assets/bg/${id}_floor1.png`,
    tile: `/assets/bg/${id}_tile.png`,
  };
}

export function floorAsset(key) {
  return `/assets/bg/${key}.png`;
}

/**
 * 현재 층수에 맞는 교체 배경 키. 아직 교체 구간이 아니면 null.
 * @param {number} floor
 */
export function floorBackgroundAt(floor) {
  for (const e of FLOOR_BACKGROUNDS) {
    if (floor >= e.from) return e.key;
  }
  return null;
}

/** 구름 등장 여부 */
export function cloudsVisible(floor) {
  return floor >= FLOOR_EVENTS.cloudsFrom;
}
