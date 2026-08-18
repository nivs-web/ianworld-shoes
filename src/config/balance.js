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
  /**
   * 2026-08-15: 「너무 쉽다」는 피드백을 받아 체감 2배로 올렸다. 쉬움·보통은 그대로다.
   *
   * 한 칸 오르는 데 필요한 속도 = drain / stepReward [칸/초]
   *   이전: 시작 3.6칸/초 → 캡 6.5칸/초, 캡 도달 168층
   *   지금: 시작 5.6칸/초 → 캡 8.4칸/초, 캡 도달  67층
   *
   * 캡 자체를 두 배로 올리면 사람 손으로 불가능해진다(13칸/초). 그래서 **벽에 부딪히는
   * 시점**을 절반 이하로 당기는 쪽으로 2배를 만들었다 — 같은 실력이면 점수가 대략 반이 된다.
   */
  hard: {
    id: 'hard',
    drainBase: 28.0,
    drainGrowth: 0.21,
    drainCap: 42.0,
    stepReward: 5.0,
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

/**
 * 도감 후반 난이도 (2026-08-15).
 *
 * 조금만 플레이해도 도감이 다 차 버린다는 피드백. 앞부분은 지금처럼 술술 채워지되
 * **막바지만** 어렵게 만들고 싶었다. 그래서 확률을 처음부터 낮추지 않고,
 * 종류를 `afterUniqueTypes` 만큼 모은 뒤부터 1·2티어 등장 확률에 `factor` 를 곱한다.
 *
 * 왜 1·2티어인가: 그 15종이 가장 희귀해서 마지막까지 남는 칸이다.
 * 초반에는 이 보정이 걸리지 않으므로 100종까지는 체감이 그대로다.
 */
export const DEX_LATE_GAME = {
  afterUniqueTypes: 100,
  tiers: [1, 2],
  factor: 0.2, // 5분의 1
};

/**
 * 이번 판에 쓸 티어별 등장 가중치.
 * 정규화하지 않는다 — rng.weighted 가 합으로 나눠 쓰므로 비율만 맞으면 된다.
 *
 * @param {number} dexUnique 지금까지 모은 **종류** 수
 * @returns {number[]} SHOE_TIERS 순서의 가중치
 */
export function tierWeights(dexUnique) {
  const late = dexUnique >= DEX_LATE_GAME.afterUniqueTypes;
  return SHOE_TIERS.map((t) =>
    late && DEX_LATE_GAME.tiers.includes(t.tier) ? t.prob * DEX_LATE_GAME.factor : t.prob
  );
}

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
  /**
   * 이번 판 신발 N개마다 부활 +1.
   *
   * 20 → **50** (2026-08-15). 20개는 조금만 오르면 부활이 붙어 판이 잘 안 끝났다.
   * 부활은 잘 달린 판에 주는 보상이지 기본 수명이 아니다.
   */
  shoesPerRevive: 50,
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

  // ── 역전 배틀 (2026-08-18) ─────────────────────
  /**
   * 죽어도 바로 끝나지 않는다. 신발을 걸고 **1위보다 앞에서** 되살아나 다시 뒤집는다.
   * 이 네 값이 판의 성격을 통째로 정한다 — 여기 말고 다른 곳에 숫자를 적지 않는다.
   */
  /** 부활 한 번에 거는 신발 (켤레) */
  reviveCost: 20,
  /** 부활하면 **1위보다** 이만큼 앞 계단에서 시작한다 */
  reviveAhead: 20,
  /**
   * 죽은 뒤 부활을 고를 수 있는 시간(초).
   *
   * 20초는 너무 길었다 — 남은 사람들이 그동안 멀뚱히 기다린다. (2026-08-19)
   */
  reviveWindowSeconds: 10,
  /**
   * **걸 신발이 없으면** 더 짧게 (초). 고를 수 있는 게 '나가기' 하나뿐인데
   * 10초를 세는 건 의미가 없다. 남들의 판정 기준은 여전히 위의 10초다 —
   * 남은 사람은 내 지갑을 모르기 때문이다. 이쪽이 먼저 닫히고 `out` 도장을 찍는다.
   */
  reviveWindowShortSeconds: 5,
  /**
   * 1인당 부활 상한. 시간 제한이 없으므로 이게 유일한 종료 보장이다 —
   * 신발이 아무리 많아도 6번이면 끝난다(최대 판돈 = 인원 × (1 + 20×6)).
   *
   * **6인 이유**는 화면이다 (2026-08-19): 오른쪽 레이스 게이지에서 얼굴을 둘러싼
   * 테두리를 6칸으로 나눠, 부활할 때마다 한 칸씩 지운다. 남은 칸이 곧 남은 목숨이라
   * "쟤는 아직 4번 남았다"가 한눈에 보인다.
   */
  maxRevives: 6,
  /**
   * ── 오른쪽 레이스 게이지 (2026-08-19) ──
   * **나는 항상 정중앙**이고 상대만 위아래로 움직인다. 절대 층수가 아니라
   * **나와의 차이**를 보여 주는 자리이기 때문이다.
   */
  raceTicks: 10,
  /**
   * 눈금 한 칸 = 계단 몇 칸.
   * 10칸이면 웬만한 접전이 전부 가운데 한 칸에 뭉쳐서 **차이가 안 보였다** →
   * **5계단**으로 촘촘하게. 위아래 끝(±10칸)은 "50계단 이상 벌어졌다"는 뜻으로 고정된다.
   */
  raceStairsPerTick: 5,
  /**
   * ★ **살아 있다는 신호가 이 시간 넘게 끊기면 판에서 빠진 것으로 본다.** (2026-08-19)
   *
   * 이게 없으면 렉으로 튕긴 사람이 `alive: true` 로 영원히 남아 **판이 끝나지 않는다.**
   * 순위가 안 박히면 아무도 정산을 못 하고, 항아리에 걸린 신발도 주인을 잃는다
   * (사용자가 신고한 "신발 100켤레 증발"의 마지막 조각이다).
   *
   * 신호는 5초마다 보낸다(`MULTI.heartbeatMs`). 90초면 18번을 연달아 놓친 것이다 —
   * 잠깐 끊긴 정도로는 절대 안 걸린다. 60초가 아니라 90초인 이유는 **탭이 가려지면
   * 브라우저가 타이머를 1분에 한 번으로 조인다** — 60초로 두면 잠깐 다른 앱을 봤다
   * 돌아온 사람이 억울하게 판에서 빠진다.
   */
  staleSeconds: 90,
  /** 살아 있다는 신호를 보내는 간격(ms) — 일시정지 중에도 보낸다 */
  heartbeatMs: 5000,
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
  maxLength: 5,
  /** 완성형 한글만 허용 */
  pattern: /^[가-힣]{2,5}$/,
  /** 최초 설정은 무료, **변경**은 유료 (신발 켤레) */
  changeCost: 200,
};

// ─────────────────────────────────────────────
// 뱃지 (로비 캐릭터 옆 진열대, 최대 2칸)
// ─────────────────────────────────────────────
/**
 * 계단 뱃지 — 최고기록이 이 숫자를 넘으면 획득. 넘은 것 중 **가장 높은 하나**만 단다.
 * 최고기록은 줄지 않으므로 이 뱃지는 한 번 달면 안 뺏긴다.
 */
export const STAIR_BADGE_STEPS = [500, 1000, 1500, 2000, 2500, 3000, 3500, 4000, 4500, 5000];

/**
 * 도감완성 뱃지는 **지금 들고 있는 종류**가 130종 전부일 때만 달린다.
 * 캐릭터를 사거나 엘리베이터를 타서 한 종류라도 0켤레가 되면 그 순간 빠진다 —
 * 그래서 조건을 도감 기록이 아니라 지갑(shoesByIndex)에서 센다.
 */
export const DEX_BADGE_REQUIRED = SHOE_TOTAL;

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
