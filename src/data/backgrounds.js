/**
 * 배경 데이터. 실제 이미지는 tools/downscale-bg.mjs 가 만든다.
 * 근거: docs/GAME_DESIGN.md §9-5
 */

import { FLOOR_EVENTS } from '../config/balance.js';

/**
 * 건물 44종. 게임 시작 시 이 중 하나를 랜덤으로 고르고,
 * 싱글은 설정에서 하나로 고정할 수 있다(S08d).
 *
 * ## id 는 그림 파일 이름이다 — 절대 밀지 않는다
 *
 * `build_NN` 은 `public/assets/bg/build_NN_{road,floor1,tile}.png` 를 가리키고,
 * 사용자가 설정에 저장해 둔 배경도 이 문자열이다. 그래서 **중간에서 빼도 뒤가 안 당겨진다.**
 * 아래 `build_06`(동물의 집)·`build_15`(숲속의 별장 II)가 목록에서 빠졌는데, 그 자리를
 * 메우지 않은 것이 그 이유다 — 시즌2에 같은 느낌의 배경이 들어와 겹쳐서 뺐다(2026-08-19).
 * 뺀 그림 파일은 지우지 않았다: `downscale-bg.mjs` 가 폴더 정렬 순서로 번호를 매기므로
 * 원본을 치우면 build_07 이후가 통째로 밀린다. 79KB 를 남기는 편이 훨씬 싸다.
 *
 * 없는 id 가 설정에 남아 있어도 안전하다 — `GameScene` 이 `find` 실패를 랜덤으로 흘린다.
 */
export const BUILDINGS = [
  // ── 시즌1 (14종) ──
  { id: 'build_01', name: '카우보이' },
  { id: 'build_02', name: '미국 서부개척시대' },
  { id: 'build_03', name: '강남 2036' },
  { id: 'build_04', name: '미래 도쿄' },
  { id: 'build_05', name: '일본 헤이안 궁정' },
  { id: 'build_07', name: '조선' },
  { id: 'build_08', name: '고대국' },
  { id: 'build_09', name: '북미 부잣집' },
  // 원래 「조선총독부」. 이름과 함께 1층 간판의 한자도 바꿔 새겼다
  // (tools/build-museum-sign.mjs) — 이름만 갈면 화면과 메뉴가 다른 말을 한다. (2026-08-19)
  { id: 'build_10', name: '고대박물관' },
  { id: 'build_11', name: '고대 이집트' },
  { id: 'build_12', name: '폴란드' },
  { id: 'build_13', name: '숲속의 별장' },
  { id: 'build_14', name: '만물상' },
  { id: 'build_16', name: '고대 로마' },

  // ── 시즌2 (30종, 2026-08-19) ──
  // 이름·id 의 출처는 tools/bg-season2.json 이다. 그림을 다시 구워도 이 목록과 어긋나지
  // 않도록 QA(qa:bg)가 둘을 대조한다.
  { id: 'build_17', name: '도트게임 캐릭터집' },
  { id: 'build_18', name: '프로토스의 방' },
  { id: 'build_19', name: '동물들의 마을' },
  { id: 'build_20', name: '고대 도서관' },
  { id: 'build_21', name: '개미의 집' },
  { id: 'build_22', name: '고대 문명' },
  { id: 'build_23', name: '과학의 집' },
  { id: 'build_24', name: '오사카 성' },
  { id: 'build_25', name: '로마 콜로세움' },
  { id: 'build_26', name: '상하이' },
  { id: 'build_27', name: '90 오락실' },
  { id: 'build_28', name: '너의 이름은' },
  { id: 'build_29', name: '센과 치히로' },
  { id: 'build_30', name: '햄버거 가게' },
  { id: 'build_31', name: '중국 자금성' },
  { id: 'build_32', name: '멋진 숲속의 집' },
  { id: 'build_33', name: '지브리의 집' },
  { id: 'build_34', name: '게임 캐릭터 방' },
  { id: 'build_35', name: '유황온천 여관' },
  { id: 'build_36', name: '외계인 문명' },
  { id: 'build_37', name: '폐허' },
  { id: 'build_38', name: '요르단 페트라' },
  { id: 'build_39', name: '로봇 매니아' },
  { id: 'build_40', name: '상상의 집' },
  { id: 'build_41', name: '전차 매니아' },
  { id: 'build_42', name: '테라의 방' },
  { id: 'build_43', name: '헨젤과 그레텔' },
  { id: 'build_44', name: '신비로운 외계인의 집' },
  { id: 'build_45', name: '톰소여의 나무집' },
  { id: 'build_46', name: '초콜릿 공장' },
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
