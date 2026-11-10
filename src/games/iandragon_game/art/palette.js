/**
 * 이안 드래곤 게임 — 팔레트 (겜팀장 · 2026-11-10 · 기획서 12.1)
 * 캐릭터마다 밝음 · 보통 · 그림자 3단 + 1칸 외곽선(#14082a, 오락실 공통).
 * 아군 = 맑고 따뜻한 색 · 좀비 = 칙칙한 초록 · 보라 살색 → 섞여도 편이 보인다(12.7).
 */
export const OUT = '#14082a';

/** 3단 램프 [밝음, 보통, 그림자] */
export const RAMP = {
  // 용 (아군)
  leaf: ['#c8f27a', '#7fd34e', '#3f9a3a'],
  stone: ['#d9cbb2', '#a3917a', '#6b5c4d'],
  rock: ['#b7ab98', '#857766', '#54493e'],
  ember: ['#ffc27a', '#ff8a3a', '#c4521f'],
  lemon: ['#fff3a0', '#ffd23f', '#c99a1f'],
  sky: ['#bdeeff', '#5fc3f0', '#2f7fb8'],
  aqua: ['#a6d6ff', '#3f8cff', '#1f4fa8'],
  cloud: ['#f4ecff', '#c9b3f0', '#8f73c4'],
  mint: ['#cbfff1', '#6fe3c8', '#2f9e8a'],
  rose: ['#ffcadf', '#ff7fb0', '#c44a80'],
  bark: ['#d8a878', '#a06a3e', '#6a4026'],
  belly: ['#fff6dc', '#f5dfa8', '#d1b070'],
  // 좀비
  rot: ['#b9c78e', '#808f5a', '#4f5e3a'],
  bruise: ['#b8a0bd', '#7e6688', '#4f3d5c'],
  rag: ['#9c7d5c', '#6b5038', '#43311f'],
  cloth: ['#8f9bb3', '#5f6a85', '#3a4258'],
  bone: ['#efe7d2', '#bfb497', '#857a60'],
  // 속성 덮어쓰기 (좀비 몸)
  attrRed: ['#ff9a8a', '#e04a3a', '#8e2020'],
  attrIce: ['#d6f6ff', '#86cfe8', '#4a8fae'],
  attrMetal: ['#e3e6ee', '#9aa1b2', '#5c6274'],
  attrGhost: ['#e8f0ff', '#aab8e0', '#6c78a8'],
  attrGold: ['#fff1a0', '#f2c230', '#a8780e'],
};

/** 단색 */
export const C = {
  white: '#ffffff', pupil: OUT, blush: '#ff9ab0', mouth: '#8e2a3a', tongue: '#ff6a7a',
  tooth: '#fff6dc', spark: '#fff3a0', zEye: '#e9f27a', zPupil: '#5a1a2a', stitch: '#2a1c22',
};
