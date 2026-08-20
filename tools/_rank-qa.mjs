/**
 * 순위표 원장 QA (진단 전용) — `node tools/_rank-qa.mjs`
 *
 * `scores` 를 "판마다 한 장"에서 "사람 × 난이도 × 기간마다 한 장"으로 바꾸면서
 * 정확성이 **문서 ID 한 줄**에 걸리게 됐다. ID가 틀리면 같은 사람이 순위표에
 * 여러 번 뜨고, 보안 규칙(`uid + '_' + difficulty + '_' + key` 대조)에도 막힌다.
 *
 * 브라우저를 띄울 일이 아니라 순수 계산이라 노드에서 직접 돌린다.
 * (leaderboard.js 자체는 firebase.js → import.meta.env 를 타서 노드에서 못 부른다.
 *  그래서 검증 대상을 periodKeys.js 로 떼어 놨다.)
 */

const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
};

const P = await import('../src/services/periodKeys.js');
const L = await import('../src/services/storageLocal.js');

let fails = 0;
const eq = (label, got, want) => {
  const a = JSON.stringify(got);
  const b = JSON.stringify(want);
  if (a === b) return console.log(`  ok   ${label}`);
  fails++;
  console.log(`  FAIL ${label}\n       got  ${a}\n       want ${b}`);
};

// ─────────────────────────────────────────────
/**
 * ★ 날짜를 **KST 문자열로 못 박아** 만든다. (2026-08-19 19차)
 *
 * 예전에는 `new Date(2026, 7, 15)` 처럼 **기기 로컬 시간**으로 만들었다. 키 계산이
 * KST 고정으로 바뀐 지금 그렇게 하면 검사가 **돌리는 기계의 시간대에 따라 달라진다**
 * (UTC+10 기기에서는 로컬 자정이 KST 로 전날 23시라 날짜가 하루 밀린다).
 * 검사가 환경에 따라 답이 달라지면 통과도 실패도 의미가 없다.
 */
const K = (s) => new Date(`${s}+09:00`);

console.log('1) 주차 키 — ISO 규칙 (목요일이 속한 해가 그 주의 해) · KST 고정');
eq('연중', P.weekKey(K('2026-08-15T12:00:00')), '2026-W33');
eq('월요일과 일요일은 같은 주', P.weekKey(K('2026-08-10T00:00:00')), P.weekKey(K('2026-08-16T12:00:00')));
// ★ 사용자 지정: 일요일 밤 11시 59분에 리셋 = 월요일 0시부터 새 주
eq('일요일 23:59 는 아직 지난주', P.weekKey(K('2026-08-16T23:59:59')), '2026-W33');
eq('월요일 00:00 부터 새 주', P.weekKey(K('2026-08-17T00:00:00')), '2026-W34');
// 2026-01-01은 목요일 → 그 주는 2026년 1주차
eq('새해 첫날', P.weekKey(K('2026-01-01T12:00:00')), '2026-W01');
// 2027-01-01은 금요일 → 그 주의 목요일은 2026-12-31 → 2026년 53주차
eq('연말은 앞 해로 붙는다', P.weekKey(K('2027-01-01T12:00:00')), '2026-W53');
// 시간대가 달라도 **같은 순간이면 같은 키** — 이게 KST 고정의 목적이다
eq('UTC 로 적어도 같은 답', P.weekKey(new Date('2026-08-16T15:00:00Z')), '2026-W34');

// ─────────────────────────────────────────────
console.log("2) 오늘·월 키 — 자릿수 고정 (문자열 정렬이 곧 시간 순서여야 한다)");
eq('한 자리 달', P.monthKey(K('2026-01-09T12:00:00')), '2026-01');
eq('두 자리 달', P.monthKey(K('2026-12-31T23:00:00')), '2026-12');
eq('달 경계 — 말일 23:59', P.monthKey(K('2026-08-31T23:59:59')), '2026-08');
eq('달 경계 — 1일 00:00', P.monthKey(K('2026-09-01T00:00:00')), '2026-09');
// ★ 사용자 지정: 오늘 순위는 당일 밤 11시 59분 기준으로 리셋 = KST 자정에 날짜가 바뀐다
eq('오늘 키', P.dayKey(K('2026-08-20T12:34:00')), '2026-08-20');
eq('23:59 는 아직 오늘', P.dayKey(K('2026-08-20T23:59:59')), '2026-08-20');
eq('자정 넘으면 다음 날', P.dayKey(K('2026-08-21T00:00:00')), '2026-08-21');
eq('한 자리 날짜도 두 자리로', P.dayKey(K('2026-03-05T09:00:00')), '2026-03-05');
// 연간은 19차에 없앴다 — 남아 있으면 화면에 없는 문서를 계속 쓰게 된다
eq('연간 기간은 더 이상 없다', P.PERIODS.map((x) => x.field), ['dy', 'wk', 'mo']);
eq('탭 이름도 셋', P.PERIODS.map((x) => x.tab), ['daily', 'weekly', 'monthly']);

// ─────────────────────────────────────────────
console.log('3) 문서 ID — 보안 규칙이 다시 계산해 대조하는 그 조합');
eq('조합', P.scoreDocId('u1', 'hard', '2026-W33'), 'u1_hard_2026-W33');
{
  // 규칙 쪽 계산을 그대로 흉내 내 본다
  const doc = { uid: 'u1', difficulty: 'normal', key: '2026-08' };
  const idFromRule = doc.uid + '_' + doc.difficulty + '_' + doc.key;
  eq('규칙과 같은 값', P.scoreDocId(doc.uid, doc.difficulty, doc.key), idFromRule);
}
{
  const when = K('2026-08-15T12:00:00');
  const ids = P.PERIODS.map((p) => P.scoreDocId('u1', 'easy', p.keyOf(when)));
  eq('기간 3종이 서로 다른 문서', new Set(ids).size, 3);
  eq('세 장의 정체', ids, ['u1_easy_2026-08-15', 'u1_easy_2026-W33', 'u1_easy_2026-08']);
}

// ─────────────────────────────────────────────
console.log('4) 기간 필드 — 문서 한 장에 하나만');
{
  const when = K('2026-08-15T12:00:00');
  for (const p of P.PERIODS) {
    const doc = { period: p.field, key: p.keyOf(when), [p.field]: p.keyOf(when) };
    const others = P.PERIODS.filter((q) => q.field !== p.field).map((q) => q.field);
    eq(`${p.tab} 문서에 ${others.join('·')} 없음`, others.filter((f) => f in doc), []);
    // 규칙의 periodOk() 와 같은 판정
    eq(`${p.tab} periodOk`, doc[doc.period] === doc.key, true);
  }
}

// ─────────────────────────────────────────────
console.log('5) 난이도 목록 — 규칙의 화이트리스트와 같아야 한다');
eq('세 가지', P.DIFFICULTIES, ['easy', 'normal', 'hard']);

// ─────────────────────────────────────────────
console.log('6) 기간 최고기록 캐시 — 헛쓰기를 막는 하한선');
L.resetAll(); mem.clear();
{
  const id = P.scoreDocId('u1', 'hard', '2026-W33');
  eq('처음엔 없다', L.hasPeriodBest(id), false);
  eq('없으면 -1 (0점도 올려야 한다)', L.periodBest(id), -1);

  L.notePeriodBest(id, 120);
  eq('기록됨', L.periodBest(id), 120);
  eq('있다', L.hasPeriodBest(id), true);

  L.notePeriodBest(id, 80);
  eq('낮은 값은 하한을 못 내린다', L.periodBest(id), 120);

  L.notePeriodBest(id, 300);
  eq('높은 값은 올린다', L.periodBest(id), 300);
}

// ─────────────────────────────────────────────
console.log('7) 제출 여부 판정 — 같은 점수는 다시 안 쓴다');
{
  const id = P.scoreDocId('u1', 'hard', '2026-W33');   // 위에서 300
  const willWrite = (stairs) => stairs > L.periodBest(id);
  eq('더 높으면 쓴다', willWrite(301), true);
  eq('같으면 안 쓴다', willWrite(300), false);
  eq('낮으면 안 쓴다', willWrite(10), false);
}

// ─────────────────────────────────────────────
console.log('8) 캐시 솎기 — 지난 기간은 버린다 (어떤 화면에도 안 나온다)');
L.resetAll(); mem.clear();
{
  const now = K('2026-08-15T12:00:00');
  const keep = P.currentKeys(now);
  eq('살릴 키 3개', keep, ['2026-08-15', '2026-W33', '2026-08']);

  for (const d of P.DIFFICULTIES) {
    for (const k of keep) L.notePeriodBest(P.scoreDocId('u1', d, k), 100);
  }
  L.notePeriodBest(P.scoreDocId('u1', 'hard', '2026-W20'), 999);   // 지난 주
  L.notePeriodBest(P.scoreDocId('u1', 'hard', '2026-03'), 999);    // 지난 달
  eq('솎기 전', Object.keys(L.loadPeriodBest()).length, 11);

  L.notePeriodBest(P.scoreDocId('u1', 'hard', '2026-W33'), 101, keep);
  const left = Object.keys(L.loadPeriodBest());
  eq('솎기 후 = 난이도 3 × 기간 3', left.length, 9);
  eq('지난 주 사라짐', left.includes('u1_hard_2026-W20'), false);
  eq('오늘은 남음', left.includes('u1_hard_2026-08-15'), true);
  // 접미사가 겹치는 함정: `..._2026-08` 은 `..._2026-08-15` 의 접두사다.
  // `endsWith('_' + key)` 로 판정하므로 서로를 잡아먹지 않는다 — 9) 에서 다시 본다
  eq('이번 달도 남음', left.includes('u1_hard_2026-08'), true);
}

// ─────────────────────────────────────────────
console.log('9) 솎기가 달(月)을 잡아먹지 않는다 — 접미사가 겹치기 쉽다');
{
  /**
   * `'2026-08'` 은 `'2026-08-15'` 의 **접두사**다. 단순 포함 검사(`includes`)로 짰다면
   * 이번 달 키가 지난 달 15일 문서까지 살려 낸다. `endsWith('_' + key)` 라야 한다.
   * (19차 전에는 `'2026'`(연간)이 같은 함정이었다 — 기간이 바뀌어도 함정은 남는다)
   */
  const m = {
    'u1_hard_2026-08': 1,
    'u1_hard_2026-08-15': 2,
    'u1_hard_2026-W33': 3,
    'u1_hard_2026-07': 4,
    'u1_hard_2026-08-14': 5,
  };
  const out = L.prunePeriodBest(m, ['2026-08-15', '2026-W33', '2026-08']);
  eq('오늘 것만 셋', Object.keys(out).sort(),
    ['u1_hard_2026-08', 'u1_hard_2026-08-15', 'u1_hard_2026-W33']);
}

// ─────────────────────────────────────────────
console.log('10) 닉네임 동기화 대상 — 지금 기간 것만, 올린 적 있는 것만');
L.resetAll(); mem.clear();
{
  const now = K('2026-08-15T12:00:00');
  // 어려움만 세 기간 다 올렸고, 보통은 주간만 올렸다고 치자
  for (const p of P.PERIODS) L.notePeriodBest(P.scoreDocId('u1', 'hard', p.keyOf(now)), 500);
  L.notePeriodBest(P.scoreDocId('u1', 'normal', P.weekKey(now)), 30);

  const targets = [];
  for (const d of P.DIFFICULTIES) {
    for (const p of P.PERIODS) {
      const id = P.scoreDocId('u1', d, p.keyOf(now));
      if (L.hasPeriodBest(id)) targets.push(id);
    }
  }
  eq('고칠 문서 4장', targets.length, 4);
  eq('안 올린 쉬움은 건드리지 않는다', targets.some((t) => t.includes('_easy_')), false);
  eq('최대치는 난이도 3 × 기간 3', P.DIFFICULTIES.length * P.PERIODS.length, 9);
}

// ─────────────────────────────────────────────

// ─────────────────────────────────────────────
console.log('\n11) 순위표를 내 주변만 잘라서 보여 준다 (2026-08-19)');
{
  const { rankWindow, RANK_WINDOW_RADIUS } = await import('../src/services/rankWindow.js');
  const rows = Array.from({ length: 200 }, (_, i) => ({ uid: `u${i + 1}`, rank: i + 1 }));
  const size = RANK_WINDOW_RADIUS * 2 + 1;

  const w200 = rankWindow(rows, 'u200');
  eq('200등이면 끝자락이 보인다', [w200[0].rank, w200[w200.length - 1].rank], [200 - size + 1, 200]);

  // 가운데 놓기는 **양쪽으로 다 뻗을 수 있을 때** 성립한다 (반경보다 위아래가 넉넉할 때)
  const mid = RANK_WINDOW_RADIUS + 30;
  const wMid = rankWindow(rows, `u${mid}`);
  eq('가운데쯤이면 내가 한가운데', wMid[RANK_WINDOW_RADIUS].rank, mid);
  eq('창의 범위', [wMid[0].rank, wMid[wMid.length - 1].rank], [mid - RANK_WINDOW_RADIUS, mid + RANK_WINDOW_RADIUS]);

  /**
   * ★ **11등이면 1등이 보여야 한다.** (2026-08-19 11차, 사용자 지정)
   * *"11위 12위 인데 1위가 안보이는것도 이상하다"* — 반경 5 시절에는 6등부터 시작했다.
   * 반경 50 이면 위로 못 뻗는 만큼 아래로 채우므로 창은 1~101 이 된다.
   */
  const w11 = rankWindow(rows, 'u11');
  eq('11등이면 1등이 보인다', w11[0].rank, 1);
  eq('11등 창의 범위', [w11[0].rank, w11[w11.length - 1].rank], [1, size]);
  eq('반경은 50 (사용자 지정)', RANK_WINDOW_RADIUS, 50);

  const w1 = rankWindow(rows, 'u1');
  eq('1등이면 위로 못 뻗으니 아래로 채운다', [w1[0].rank, w1[w1.length - 1].rank], [1, size]);

  eq('길이는 언제나 같다', [w1.length, w11.length, w200.length], [size, size, size]);
  // 순위 밖(내가 목록에 없다)이면 예전처럼 위에서부터 — 하단 '내 순위' 줄이 따로 있다
  eq('목록에 없으면 상위부터', rankWindow(rows, 'nobody')[0].rank, 1);
  eq('짧은 목록은 그대로', rankWindow(rows.slice(0, 4), 'u3').length, 4);
}

console.log(fails ? `\n실패 ${fails}건` : '\n순위표 원장 이상 없음');
process.exit(fails ? 1 : 0);
