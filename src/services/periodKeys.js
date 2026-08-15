/**
 * 순위표의 기간 키와 문서 ID — **Firebase 를 모르는 순수 계산만** 모아 둔다.
 *
 * leaderboard.js 안에 두면 노드에서 테스트할 수 없다. 그 파일은 firebase.js 를
 * 거쳐 `import.meta.env` 에 닿는데, 브라우저 밖에서는 그게 없어 불러오는 순간 죽는다.
 * 여기 있는 것들은 규칙(문서 ID 조합)과 직결되므로 반드시 검증되어야 한다.
 */

/** ISO 주차. 목요일이 속한 해를 그 주의 해로 본다(연말연시가 갈리지 않게). */
export function weekKey(d = new Date()) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t - yearStart) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export const monthKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

export const yearKey = (d = new Date()) => String(d.getFullYear());

/**
 * 기간 3종. `field` 는 문서에 실제로 박히는 이름이고, 한 문서에는 **하나만** 들어간다.
 * 셋을 다 넣으면 주간 색인이 연간·월간 문서까지 훑는다 — 안 넣으면 색인에 아예 안 실린다.
 */
export const PERIODS = [
  { tab: 'weekly', field: 'wk', keyOf: weekKey },
  { tab: 'monthly', field: 'mo', keyOf: monthKey },
  { tab: 'yearly', field: 'yr', keyOf: yearKey },
];

export const PERIOD_BY_TAB = Object.fromEntries(PERIODS.map((p) => [p.tab, p]));

/** 순위표가 다루는 난이도 (신발왕은 통합이라 여기 안 쓴다) */
export const DIFFICULTIES = ['easy', 'normal', 'hard'];

/**
 * 문서 ID.
 *
 * 이 조합이 곧 "한 사람은 한 기간에 한 줄"이라는 보장이다 —
 * 보안 규칙이 `uid + '_' + difficulty + '_' + key` 를 그대로 다시 계산해 대조하므로
 * **여기 형식을 바꾸면 `docs/FIREBASE_RULES.md` 의 `valid()` 도 같이 고쳐야 한다.**
 */
export const scoreDocId = (uid, difficulty, key) => `${uid}_${difficulty}_${key}`;

/** 지금 살아 있는 기간 키들 — 로컬 캐시를 솎아 낼 때 쓴다 */
export const currentKeys = (when = new Date()) => PERIODS.map((p) => p.keyOf(when));
