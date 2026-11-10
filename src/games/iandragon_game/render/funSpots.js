/**
 * 자리표 (기획서 IAN_DRAGON_FUN.md §8 «배경 자리 규칙»)
 * 배경 그림마다 «어디에 무엇이 있나»를 사람이 재서 적는다(tools/idg-fun-spots.mjs 로 겹쳐 보고 확인).
 * 요소는 자기가 필요한 자리(needs)가 그 월드 자리표에 있을 때만 나온다 — 없으면 그 월드에서는 저절로 꺼진다.
 * 그래서 나무가 없는 배경에 부엉이가 허공에 앉거나, 울타리가 없는 곳을 고양이가 걷는 일이 없다.
 *  moon{x,y,d} 큰 달 · moonFace 달 얼굴을 덮어도 되나(달 색이 크림색일 때만) · ground 풀 윗줄 y · graves[x] 땅 위 소품 자리
 *  fence{x0,x1,y} 울타리 윗줄 · owl{x,y} 나뭇가지 위 · pumpkin{x,y} 길가 · window{x,y} 먼 성 창문 · wisps[{x,y}] 도깨비불 · dirtY 앞쪽 흙 띠
 *  sky[y0,y1] 하늘 띠 · safe[x0,x1] 땅 위 요소가 나와도 되는 x 범위(양쪽 성 앞은 금지 — 성 · 유닛 출발점과 겹친다)
 */
/** 월드 1 «달밤 초록 언덕» 배경(대표님 그림)의 자리 — 배경과 같은 좌표(배경이 카메라와 1:1 로 움직인다) */
export const W1_SPOTS = {
  safe: [260, 1000],
  moonFace: true,
  moon: { x: 790, y: 110, d: 240 },
  ground: 437,                                   // 풀 윗줄
  graves: [255, 330, 470, 560, 670, 735, 1000, 1150],
  fence: { x0: 770, x1: 1100, y: 384 },
  owl: { x: 262, y: 88 },                       // 왼쪽 마른 나무 오른쪽 가지 (성 뒤에 가리지 않게)
  pumpkin: { x: 452, y: 436 },
  window: { x: 1156, y: 262 },
  wisps: [{ x: 620, y: 372 }, { x: 300, y: 382 }, { x: 1060, y: 376 }, { x: 860, y: 360 }],
  dirtY: 494,                                    // 앞쪽 흙 띠
  sky: [50, 200],
};

/** 월드 2 «화산» (제미나이 배경 bg_w02 · 1273×540) — 2026-11-11 야간에 잼 */
export const W2_SPOTS = {
  safe: [260, 1000],
  wispTint: 0xff9a5a,                            // 화산 도깨비불은 붉은 불
  moonFace: true,
  moon: { x: 734, y: 91, d: 88 },
  ground: 437,
  graves: [274, 356, 445, 600, 820, 960],
  fence: { x0: 745, x1: 1180, y: 312 },
  owl: { x: 300, y: 207 },
  pumpkin: { x: 520, y: 437 },
  window: { x: 963, y: 166 },
  wisps: [{ x: 316, y: 350 }, { x: 484, y: 350 }, { x: 840, y: 350 }],
  dirtY: 494,
  sky: [40, 200],
};

/** 월드 3 «하늘섬» (제미나이 배경 bg_w03 · 높이 540 · 땅 줄을 437 로 맞춰 1.34배 키워 위쪽만 남김) */
export const W3_SPOTS = {
  safe: [260, 1000],
  wispTint: 0xcfe8ff,
  moonFace: true,
  moon: { x: 692, y: 112, d: 145 },
  ground: 437,
  graves: [270, 325, 442, 590, 640, 750, 850, 950],
  fence: { x0: 1015, x1: 1250, y: 374 },
  owl: { x: 300, y: 180 },
  pumpkin: { x: 540, y: 437 },
  window: { x: 1128, y: 235 },
  wisps: [{ x: 380, y: 372 }, { x: 560, y: 380 }, { x: 780, y: 372 }],
  dirtY: 494,
  sky: [40, 200],
};

/** 월드 4 «얼음골» (제미나이 배경 bg_w04 · 높이 540 그대로) */
export const W4_SPOTS = {
  safe: [260, 1000],
  wispTint: 0x9ff0ff,
  moonFace: false,                               // 달이 푸른 흰색이라 얼굴 X
  moon: { x: 714, y: 106, d: 118 },
  ground: 437,
  graves: [280, 360, 440, 560, 640, 780, 880, 960],
  fence: { x0: 745, x1: 1250, y: 352 },
  owl: { x: 230, y: 214 },
  pumpkin: { x: 600, y: 437 },
  window: { x: 942, y: 226 },
  wisps: [{ x: 530, y: 383 }, { x: 710, y: 383 }, { x: 1215, y: 383 }],
  dirtY: 494,
  sky: [40, 200],
};

/** 월드 5 «고철 광산» (제미나이 배경 bg_w05 · 보도 윗줄이 456 이라 위 19칸을 잘라 437 로 맞추고 아래는 거울로 채움) */
export const W5_SPOTS = {
  safe: [260, 1000],
  wispTint: 0xc8ff6a,
  moonFace: true,
  moon: { x: 662, y: 76, d: 122 },
  ground: 437,
  graves: [275, 345, 460, 590, 650, 760, 850, 960],
  fence: { x0: 605, x1: 1200, y: 327 },
  owl: { x: 520, y: 188 },
  pumpkin: { x: 535, y: 437 },
  window: { x: 925, y: 238 },
  wisps: [{ x: 195, y: 372 }, { x: 470, y: 400 }, { x: 1035, y: 418 }],
  dirtY: 494,
  sky: [40, 200],
};

/** 월드 번호 → 자리표 · 배경 그림 (배경을 새로 만들면 여기에 재서 적고 tools/idg-fun-spots.mjs 로 확인) */
export const SPOTS = { 1: W1_SPOTS, 2: W2_SPOTS, 3: W3_SPOTS, 4: W4_SPOTS, 5: W5_SPOTS };
