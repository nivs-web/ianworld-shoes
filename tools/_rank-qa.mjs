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
console.log('1) 주차 키 — ISO 규칙 (목요일이 속한 해가 그 주의 해)');
eq('연중', P.weekKey(new Date(2026, 7, 15)), '2026-W33');
eq('월요일과 일요일은 같은 주', P.weekKey(new Date(2026, 7, 10)), P.weekKey(new Date(2026, 7, 16)));
eq('일요일 다음날은 다른 주', P.weekKey(new Date(2026, 7, 17)), '2026-W34');
// 2026-01-01은 목요일 → 그 주는 2026년 1주차
eq('새해 첫날', P.weekKey(new Date(2026, 0, 1)), '2026-W01');
// 2027-01-01은 금요일 → 그 주의 목요일은 2026-12-31 → 2026년 53주차
eq('연말은 앞 해로 붙는다', P.weekKey(new Date(2027, 0, 1)), '2026-W53');

// ─────────────────────────────────────────────
console.log('2) 월·연 키 — 자릿수 고정 (문자열 정렬이 곧 시간 순서여야 한다)');
eq('한 자리 달', P.monthKey(new Date(2026, 0, 9)), '2026-01');
eq('두 자리 달', P.monthKey(new Date(2026, 11, 31)), '2026-12');
eq('연', P.yearKey(new Date(2026, 5, 1)), '2026');

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
  const when = new Date(2026, 7, 15);
  const ids = P.PERIODS.map((p) => P.scoreDocId('u1', 'easy', p.keyOf(when)));
  eq('기간 3종이 서로 다른 문서', new Set(ids).size, 3);
  eq('세 장의 정체', ids, ['u1_easy_2026-W33', 'u1_easy_2026-08', 'u1_easy_2026']);
}

// ─────────────────────────────────────────────
console.log('4) 기간 필드 — 문서 한 장에 하나만');
{
  const when = new Date(2026, 7, 15);
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
  const now = new Date(2026, 7, 15);
  const keep = P.currentKeys(now);
  eq('살릴 키 3개', keep, ['2026-W33', '2026-08', '2026']);

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
  eq('올해는 남음', left.includes('u1_hard_2026'), true);
}

// ─────────────────────────────────────────────
console.log('9) 솎기가 연(年)을 잡아먹지 않는다 — 접미사가 겹치기 쉽다');
{
  // '2026' 은 '2026-W33' 의 접두사라, 단순 포함 검사면 서로를 살려 버린다
  const m = {
    'u1_hard_2026': 1,
    'u1_hard_2026-08': 2,
    'u1_hard_2026-W33': 3,
    'u1_hard_2025': 4,
    'u1_hard_2025-W33': 5,
  };
  const out = L.prunePeriodBest(m, ['2026-W33', '2026-08', '2026']);
  eq('올해 것만 셋', Object.keys(out).sort(), ['u1_hard_2026', 'u1_hard_2026-08', 'u1_hard_2026-W33']);
}

// ─────────────────────────────────────────────
console.log('10) 닉네임 동기화 대상 — 지금 기간 것만, 올린 적 있는 것만');
L.resetAll(); mem.clear();
{
  const now = new Date(2026, 7, 15);
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
console.log(fails ? `\n실패 ${fails}건` : '\n순위표 원장 이상 없음');
process.exit(fails ? 1 : 0);
