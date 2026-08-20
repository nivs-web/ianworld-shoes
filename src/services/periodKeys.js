/**
 * 순위표의 기간 키와 문서 ID — **Firebase 를 모르는 순수 계산만** 모아 둔다.
 *
 * leaderboard.js 안에 두면 노드에서 테스트할 수 없다. 그 파일은 firebase.js 를
 * 거쳐 `import.meta.env` 에 닿는데, 브라우저 밖에서는 그게 없어 불러오는 순간 죽는다.
 * 여기 있는 것들은 규칙(문서 ID 조합)과 직결되므로 반드시 검증되어야 한다.
 */

/**
 * ★ **모든 기간은 대한민국 시간(KST, UTC+9) 기준이다.** (2026-08-19 19차, 사용자 지정)
 *
 * *"주간 순위는 대한민국 시간 기준 일요일 밤 11시 59분에 리셋되도록 해"*
 *
 * 예전에는 **기기의 로컬 시간**으로 키를 만들었다. 그러면 두 가지가 깨진다:
 *
 *  1. **경계가 사람마다 다르다.** 월요일 0시 KST 에 새 주가 시작돼야 하는데, UTC 기기는
 *     그 시각이 아직 일요일 15시라 **지난주 키**를 쓴다. 같은 순간에 올린 두 기록이
 *     서로 다른 순위표로 흩어진다 — 실제로 UTC 로 재 보면
 *     `2026-08-17T00:00+09:00`(월요일 0시)가 `2026-W33`(지난주)으로 나온다.
 *  2. 해외에서 접속하거나 폰 시간대를 바꾸면 순위가 통째로 갈아엎어진다.
 *
 * 그래서 **시각을 +9시간 옮긴 뒤 UTC 부품을 읽는다.** 이러면 어느 기기에서 계산해도
 * 같은 답이 나온다. (서버에 시간대를 물어볼 방법이 없으므로 클라이언트가 같은 규칙을
 * 쓰는 것이 유일한 합의 방법이다 — 문서 ID 가 곧 규칙이라 어긋나면 규칙이 거부한다)
 */
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** 그 시각의 **KST 달력 날짜**를 UTC 부품으로 들고 있는 Date */
const kst = (d) => new Date(d.getTime() + KST_OFFSET_MS);

/**
 * 오늘 (KST). `2026-08-20` 형식.
 *
 * 사용자 지정: *"오늘 당일 밤 11시 59분을 기준으로 점수가 리셋"* — 즉 **자정에 날짜가
 * 바뀌면 새 판**이다. 날짜 문자열이 바뀌는 순간이 곧 리셋이라 따로 지우는 일이 없다.
 */
export function dayKey(d = new Date()) {
  const k = kst(d);
  return `${k.getUTCFullYear()}-${String(k.getUTCMonth() + 1).padStart(2, '0')}-${String(k.getUTCDate()).padStart(2, '0')}`;
}

/**
 * ISO 주차 (KST 기준). 목요일이 속한 해를 그 주의 해로 본다(연말연시가 갈리지 않게).
 * ISO 주는 **월요일에 시작**하므로 곧 "일요일 밤 11시 59분에 리셋"이다.
 */
export function weekKey(d = new Date()) {
  const k = kst(d);
  const t = new Date(Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t - yearStart) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export const monthKey = (d = new Date()) => {
  const k = kst(d);
  return `${k.getUTCFullYear()}-${String(k.getUTCMonth() + 1).padStart(2, '0')}`;
};

/**
 * 기간 3종. `field` 는 문서에 실제로 박히는 이름이고, 한 문서에는 **하나만** 들어간다.
 * 셋을 다 넣으면 주간 색인이 일간·월간 문서까지 훑는다 — 안 넣으면 색인에 아예 안 실린다.
 *
 * ★ **연간(`yr`)을 없애고 일간(`dy`)을 넣었다.** (19차, 사용자 지정)
 *   *"연간 순위를 없애자, 그리고 오늘 순위를 만들자 (…) 오늘 순위를 올리기 위해서
 *   매일 할 수 있을 듯"* — 1년짜리 판은 사실상 역대와 같아서 볼 이유가 적었다.
 *
 * > 이미 올라간 `yr` 문서는 **지우지 않았다.** 조회하는 화면이 없어졌을 뿐이고,
 * > 지우려면 사용자 수만큼 삭제 쓰기가 필요하다(규칙상 delete 는 아예 막혀 있다).
 */
export const PERIODS = [
  { tab: 'daily', field: 'dy', keyOf: dayKey },
  { tab: 'weekly', field: 'wk', keyOf: weekKey },
  { tab: 'monthly', field: 'mo', keyOf: monthKey },
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

/**
 * 지금 기간 키를 **필드 이름표를 붙여** 돌려준다 — `{ dy, wk, mo }`.
 * (2026-08-19 23차, 멀티게임순위의 기간별 승수)
 *
 * `currentKeys` 와 달리 순서에 기대지 않는다. 배열 순서로 짝을 맞추면 `PERIODS` 에
 * 한 줄만 끼워 넣어도 **엉뚱한 기간에 승수가 쌓인다** — 그 종류의 버그는 다음 주가
 * 되어서야 드러난다.
 */
export const currentKeyMap = (when = new Date()) =>
  Object.fromEntries(PERIODS.map((p) => [p.field, p.keyOf(when)]));

/**
 * 기간 순위표용 정렬 열쇠 — `"2026-08-20#9996"` (승수 4).
 *
 * ★ **복합 색인을 안 쓰려고 이렇게 한다.** `where(키) + orderBy(승수)` 는 Firestore 에서
 * 복합 색인을 요구하는데, 그건 콘솔에서 손으로 만들어야 하고 없으면 그 탭이 통째로
 * 빈 채로 뜬다. 키와 승수를 **한 필드에 담으면** 범위 조회 + 같은 필드 정렬이 되어
 * **자동 단일 필드 색인만으로** 돌아간다.
 *
 * 승수는 `9999 - n` 으로 뒤집어 넣는다 — 오름차순 정렬이 곧 '많이 이긴 순'이 된다.
 * 네 자리로 채워야 문자열 비교가 숫자 비교와 같아진다(`999` < `99` 같은 사고 방지).
 */
export const winSortKey = (key, wins) =>
  `${key}#${String(Math.max(0, 9999 - Math.min(9999, wins | 0))).padStart(4, '0')}`;

/** 위 열쇠에서 승수를 되읽는다 */
export const winsFromSortKey = (s) => {
  const n = Number(String(s ?? '').split('#')[1]);
  return Number.isFinite(n) ? 9999 - n : 0;
};
