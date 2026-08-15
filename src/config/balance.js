/**
 * 밸런스 수치 — 게임의 모든 "숫자"는 이 파일에만 존재한다.
 * 로직 파일에 리터럴 숫자를 쓰지 않는다. (CLAUDE.md §3-5)
 * 근거: docs/GAME_DESIGN.md §5, §6
 */

// ─────────────────────────────────────────────
// 시간 게이지
// ─────────────────────────────────────────────
export const GAUGE_MAX = 100;

/**
 * 난이도별 게이지 파라미터.
 * 튜닝 방향: 「무한의 계단」보다 살짝 빡세게. (기획서 §5-3)
 *
 *   drain(floor) = min(base + growth * floor, cap)   [게이지/초]
 *
 * capFloor = 캡에 도달하는 층수 = (cap - base) / growth
 */
export const DIFFICULTY = {
  easy: {
    id: 'easy',
    drainBase: 11.0,
    drainGrowth: 0.035,
    drainCap: 24.0,
    stepReward: 7.0,
    shoeReward: 8,
    shoeGapMin: 10, // 신발 등장 간격(칸) — 희귀
    shoeGapMax: 20,
  },
  normal: {
    id: 'normal',
    drainBase: 16.0,
    drainGrowth: 0.06,
    drainCap: 31.0,
    stepReward: 6.0,
    shoeReward: 8,
    shoeGapMin: 4, // 보통
    shoeGapMax: 9,
  },
  hard: {
    id: 'hard',
    drainBase: 20.0,
    drainGrowth: 0.095,
    drainCap: 36.0,
    stepReward: 5.5,
    shoeReward: 8,
    shoeGapMin: 3, // 흔함
    shoeGapMax: 6,
  },
};

export const DEFAULT_DIFFICULTY = 'normal';

/** 멀티플레이 방장이 고르는 신발 빈도 (게이지 난이도와 분리) */
export const SHOE_RARITY = {
  common: { id: 'common', gapMin: 3, gapMax: 6 },
  normal: { id: 'normal', gapMin: 4, gapMax: 9 },
  rare: { id: 'rare', gapMin: 10, gapMax: 20 },
};

/**
 * 층수에 따른 게이지 감소량. 항상 이 함수만 쓴다.
 * @param {object} diff DIFFICULTY 항목
 * @param {number} floor 현재 계단 수
 * @returns {number} 초당 감소량
 */
export function drainAt(diff, floor) {
  return Math.min(diff.drainBase + diff.drainGrowth * floor, diff.drainCap);
}

// ─────────────────────────────────────────────
// 신발
// ─────────────────────────────────────────────

/**
 * 티어 정의. count 합 = 130, prob 합 = 1.0
 * 아틀라스 인덱스는 [offset, offset+count) 구간.
 */
export const SHOE_TIERS = [
  { tier: 1, name: 'MAXIMAL CHROMA', count: 5, prob: 0.05, offset: 0 },
  { tier: 2, name: 'BLOCKED COLOUR', count: 10, prob: 0.1, offset: 5 },
  { tier: 3, name: 'PATTERN + CONTRAST', count: 15, prob: 0.15, offset: 15 },
  { tier: 4, name: 'TWO-TONE CLASSIC', count: 40, prob: 0.2, offset: 30 },
  { tier: 5, name: 'SINGLE PIGMENT', count: 60, prob: 0.5, offset: 70 },
];

export const SHOE_TOTAL = 130;

/** 1·2티어 획득 시 특별 연출/함성 발동 */
export const SHOE_RARE_TIER_MAX = 2;

/** 신발 획득 시 스프라이트가 잠깐 커지는 연출 (정수 픽셀만, 이징 없음) */
export const SHOE_POP = {
  /** 프레임마다의 배율. 1 = 원본. 정수 픽셀로 반올림해서 그린다. */
  scaleSteps: [1.4, 1.2, 1.0],
  /** 각 단계가 유지되는 게임 프레임 수 (60fps 기준) */
  holdFrames: 3,
};

// ─────────────────────────────────────────────
// 부활 (싱글 전용)
// ─────────────────────────────────────────────
export const REVIVE = {
  /** 이번 판 신발 N개마다 부활 +1 */
  shoesPerRevive: 20,
  /** 부활 시 회복되는 게이지 */
  gaugeOnRevive: GAUGE_MAX,
  /** 부활 선택 제한 시간(초) — 3초는 하트를 누를 틈이 없어 10초로 늘렸다 (2026-08-14) */
  decisionSeconds: 10,
  /** 멀티에서는 부활 없음 */
  enabledInMulti: false,
};

// ─────────────────────────────────────────────
// 엘리베이터 (500층 스킵) — 기획서 §5-8-1
// ─────────────────────────────────────────────
export const ELEVATOR = {
  /** 이 층을 한 번이라도 밟아 본 계정에게 열린다 (난이도 무관, 영구) */
  unlockFloor: 500,
  /** 1회 사용 비용 (신발 켤레). 고티어부터 차감 */
  cost: 50,
  /** 시작 층수 */
  startFloor: 500,
  /** 멀티는 항상 1층에서 동시 출발한다 */
  enabledInMulti: false,
};

// ─────────────────────────────────────────────
// 멀티플레이
// ─────────────────────────────────────────────
export const MULTI = {
  minPlayers: 2,
  maxPlayers: 4,
  /** 참가 최소 보유 신발. 1켤레 이하는 참가 불가 → 즉 2 이상 필요 */
  minShoesToJoin: 2,
  /** 인원수 → 1등이 가져가는 신발 수 (= 인원 - 1) */
  winnerReward: { 2: 1, 3: 2, 4: 3 },
  /** 패자가 잃는 신발 수 */
  loserPenalty: 1,
  /** 패널티 신발 선택 방식: 보유 수량 기준 균등 랜덤 (티어 무관) */
  penaltyPick: 'random',
  /** 비밀방 코드 자릿수 */
  codeLength: 4,
  countdownSeconds: 3,
};

// ─────────────────────────────────────────────
// 캐릭터 해금 비용 (신발 켤레)
// ─────────────────────────────────────────────
export const UNLOCK_COST = {
  ian: 0,
  denny: 0,
  lisa: 0,
  ipo: 0,
  charles: 0,
  kyungtae: 10,
  maho: 20,
  tony: 50,
  jenny: 100,
  rose: 130,
};

/** 캐릭터 구매 시 신발 차감 순서 — 높은 티어부터 소진 */
export const PURCHASE_CONSUME_ORDER = [1, 2, 3, 4, 5];

// ─────────────────────────────────────────────
// 배경 / 층수 이벤트
// ─────────────────────────────────────────────
export const FLOOR_EVENTS = {
  /** 이 층부터 구름 오브젝트 등장 */
  cloudsFrom: 100,
  /** 층수 → 반복 배경 교체 (내림차순으로 평가) */
  bgSwap: [
    { from: 500, key: 'floor500' },
    { from: 400, key: 'floor400' },
    { from: 300, key: 'floor300' },
    { from: 200, key: 'floor200' },
  ],
};

// ─────────────────────────────────────────────
// BGM (100층마다 교체, 뒤로 갈수록 빠름)
// ─────────────────────────────────────────────
export const BGM_FLOORS_PER_TRACK = 100;
export const BGM_TRACK_COUNT = 10;
export const BGM_BPM = [120, 132, 144, 152, 160, 168, 176, 184, 192, 200];

/**
 * 현재 층수에 해당하는 BGM 트랙 인덱스 (0-based). 마지막 트랙 이후는 유지.
 * @param {number} floor
 */
export function bgmTrackAt(floor) {
  return Math.min(Math.floor(floor / BGM_FLOORS_PER_TRACK), BGM_TRACK_COUNT - 1);
}

// ─────────────────────────────────────────────
// 입력 / 애니메이션 타이밍
// ─────────────────────────────────────────────
export const INPUT = {
  /** 선입력 버퍼 크기. 이보다 많이 눌러도 버린다. */
  bufferSize: 2,
  /** 같은 입력이 이 시간(ms) 안에 중복 들어오면 무시 (채터링 방지) */
  debounceMs: 16,
};

export const ANIM = {
  /** 캐릭터 애니메이션 프레임레이트 (게임 루프 60fps와 분리) */
  fps: 10,
  /**
   * 상승 시 이펙트(번개) 컷이 유지되는 게임 프레임 수.
   * 이 게임의 핵심은 **빠르게 착착착 올라가는 리듬**이다.
   * 길게 잡으면(12프레임 시도) 한 칸 오를 때마다 걸리적거려서 리듬이 죽는다 → 3프레임 유지.
   */
  effectFrames: 3,
  /** 추락 낙하 속도 (픽셀/프레임, 정수) */
  fallSpeed: 12,
  /** 사망 시 정면 컷을 보여주는 프레임 수 */
  deathStareFrames: 24,
  /** 사망 시 신발이 좌우로 튕겨나가는 속도 (픽셀/프레임, 정수) */
  shoeFlySpeedX: 4,
  shoeFlySpeedY: -6,
};

// ─────────────────────────────────────────────
// 랭킹
// ─────────────────────────────────────────────
export const LEADERBOARD = {
  /** 상위 N명 표시 + 하단에 내 순위 고정 */
  topN: 100,
  /** 계단 랭킹 기간 */
  periods: ['weekly', 'monthly', 'yearly', 'alltime'],
  /** 계단 랭킹은 난이도별로 분리. 신발왕은 통합. */
  splitByDifficulty: true,
};

// ─────────────────────────────────────────────
// 닉네임 규칙
// ─────────────────────────────────────────────
export const NICKNAME = {
  minLength: 2,
  maxLength: 4,
  /** 완성형 한글만 허용 */
  pattern: /^[가-힣]{2,4}$/,
};

// ─────────────────────────────────────────────
// 사운드 (기획서 §9-7) — 오디오 파일 0개, 전부 Web Audio 합성
// ─────────────────────────────────────────────
export const AUDIO = {
  masterVolume: 0.85,
  /** BGM은 SFX보다 확실히 낮게 — 계단 밟는 "착!" 이 리듬의 기준이다 */
  bgmVolume: 0.30,
  sfxVolume: 0.55,

  /** BGM 트랙 교체 — 100층마다 다음 트랙, 10번 이후로는 유지 */
  bgmFloorsPerTrack: 100,
  bgmTrackCount: 10,
  /** 스케줄러: 이 간격으로 깨어나 이만큼 앞을 미리 예약한다 */
  schedulerTickMs: 25,
  scheduleAheadSec: 0.12,

  /** 함성(sfx_shout) 발동 규칙 — 매 칸마다 지르면 시끄럽다 (기획서 §9-7-1) */
  shout: {
    /** N연속 무실수 상승마다 1회 */
    streak: 3,
    /** 이 티어 이하(=희귀)면 연속 수와 무관하게 무조건 */
    tierAlways: 2,
    /** 연발 방지 최소 간격(ms) */
    minGapMs: 250,
  },

  /** 캐릭터별 함성 기본 피치 배수 — 10명이 각자 다른 목소리로 들린다 */
  voicePitch: {
    ian: 0.85, denny: 0.85, kyungtae: 0.85, charles: 0.85, tony: 0.85,
    lisa: 1.2, maho: 1.2, jenny: 1.2, rose: 1.2,
    ipo: 1.35,
  },
};
