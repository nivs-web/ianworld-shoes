/**
 * 인게임 캔버스 팔레트. 좌표는 layout.js, 숫자는 balance.js, 문구는 strings.ko.js —
 * 색만 여기 모은다.
 */

export const PAL = {
  // 계단 블록 (에셋 로드 전 폴백용)
  boxFace: '#B4B4B4',
  boxSide: '#7A7A86',
  boxLid: '#D0D0D0',
  boxTape: '#5A5A66',
  boxLine: '#2A2A34',

  /**
   * 계단 가독성 보강 (2026-08-14).
   * 배경 색과 계단 색이 비슷하면 계단이 묻혀버린다 →
   * 어두운 외곽선 1px + 오른쪽아래 드롭섀도로 항상 떠 보이게 한다.
   */
  stairOutline: '#141019',
  stairShadow: 'rgba(10, 6, 14, 0.45)',

  // HUD — 색은 사용자 원본(etc/게이지바.png, etc/일시정지.png)에서 뽑았다 (2026-08-15)
  gaugeFill: '#CD4421',
  gaugeWarn: '#F2C23C',
  gaugeBg: '#554334',
  uiOutline: '#600F09',
  uiFace: '#FFDD8E',
  uiShade: '#CCA977',
  panel: '#F5D9A0',
  panelDark: '#C99A52',
  line: '#6B3F1D',
  text: '#FFF4D6',
  textShadow: '#3A1F0C',
  accent: '#D94F2B',

  // 이펙트
  bolt: '#7FD8FF',
  boltCore: '#FFFFFF',
  pop: '#FFE86B',

  // 배경 보조
  skyFallback: '#7FB2D9',
  cloud: '#FFFFFF',
  cloudShade: '#D9E4F0',

  // 오버레이
  dim: 'rgba(20, 12, 8, 0.55)',
  goRed: '#D42B2B',
};

/**
 * ★ **자리 색 — 들어온 순서대로 빨강·노랑·파랑·초록.** (2026-08-19)
 *
 * 대기방의 번호 상자, 인게임 레이스 게이지의 얼굴 테두리, 두 곳이 **같은 색**을 쓴다.
 * 인게임에서는 아이디를 아예 안 쓰기 때문에(글자를 지웠다) 색이 유일한 신원이다 —
 * 로비에서 "나는 2번 노랑"을 본 사람이 게임에서 노랑 테두리를 보고 자기를 찾는다.
 */
export const SLOT_COLORS = ['#E2413C', '#F2C23C', '#3D8FE0', '#3FB958'];
/** 자리 색의 어두운 짝 — 테두리 빈 칸(쓴 부활)에 쓴다 */
export const SLOT_DIM = ['#5E1B19', '#5E4A14', '#173A5C', '#164A24'];
