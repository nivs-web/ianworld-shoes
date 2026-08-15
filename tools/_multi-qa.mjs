/**
 * 멀티 정산 QA (진단 전용) — `node tools/_multi-qa.mjs`
 *
 * 여기 계산은 **남의 재산을 움직인다.** 순위가 사람마다 다르게 나오거나
 * 정산이 두 번 먹으면 신발이 사라지거나 복제된다. 각자 자기 것만 정산하는
 * 구조라 **모두가 같은 답을 내는 것**이 유일한 안전장치다 — 그래서 전수로 본다.
 */

const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
};

const M = await import('../src/services/matchRules.js');
const L = await import('../src/services/storageLocal.js');
const { MULTI } = await import('../src/config/balance.js');

let fails = 0;
const eq = (label, got, want) => {
  const a = JSON.stringify(got), b = JSON.stringify(want);
  if (a === b) return console.log(`  ok   ${label}`);
  fails++;
  console.log(`  FAIL ${label}\n       got  ${a}\n       want ${b}`);
};

/** 재현 가능한 난수 (mulberry32) — 무작위를 테스트하려면 고정할 수 있어야 한다 */
function rng(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

// ─────────────────────────────────────────────
console.log('1) 순위 — 신발 수가 1순위');
eq('신발 많은 쪽이 1등', M.rankPlayers([
  { uid: 'a', shoesFound: 2, stairs: 900 },
  { uid: 'b', shoesFound: 5, stairs: 10 },
]), ['b', 'a']);

console.log('2) 신발 동률이면 계단 수');
eq('계단 높은 쪽', M.rankPlayers([
  { uid: 'a', shoesFound: 3, stairs: 40 },
  { uid: 'b', shoesFound: 3, stairs: 41 },
]), ['b', 'a']);

console.log('3) 둘 다 동률이면 먼저 도달한 쪽');
eq('먼저 도달', M.rankPlayers([
  { uid: 'a', shoesFound: 0, stairs: 7, reachedAt: 2000 },
  { uid: 'b', shoesFound: 0, stairs: 7, reachedAt: 1000 },
]), ['b', 'a']);
eq('도달 시각도 없으면 uid 사전순(결정적)', M.rankPlayers([
  { uid: 'z', shoesFound: 0, stairs: 0 },
  { uid: 'a', shoesFound: 0, stairs: 0 },
]), ['a', 'z']);

console.log('4) 순위는 **누가 계산해도 같아야 한다** (각자 자기 화면에서 계산한다)');
{
  const players = [
    { uid: 'c', shoesFound: 1, stairs: 5, reachedAt: 300 },
    { uid: 'a', shoesFound: 1, stairs: 5, reachedAt: 300 },
    { uid: 'b', shoesFound: 4, stairs: 2, reachedAt: 100 },
    { uid: 'd', shoesFound: 1, stairs: 9, reachedAt: 900 },
  ];
  const truth = M.rankPlayers(players);
  // 입력 순서를 24가지로 섞어도 결과가 같아야 한다
  const perms = [];
  (function permute(arr, cur) {
    if (!arr.length) return perms.push(cur);
    arr.forEach((x, i) => permute([...arr.slice(0, i), ...arr.slice(i + 1)], [...cur, x]));
  })(players, []);
  eq('24가지 입력 순서 전부 동일', perms.every((p) => JSON.stringify(M.rankPlayers(p)) === JSON.stringify(truth)), true);
  eq('그 답', truth, ['b', 'd', 'a', 'c']);
}

// ─────────────────────────────────────────────
console.log('5) 정산 — 기획서 표와 계산이 일치하는가');
for (const n of [2, 3, 4]) {
  eq(`${n}인 표 일치 (1등 +${MULTI.winnerReward[n]})`, M.rewardMatchesSpec(n), true);
  const rankings = Array.from({ length: n }, (_, i) => 'u' + i);
  const s = M.settlementCounts(rankings);
  eq(`${n}인 1등 몫`, s.u0, MULTI.winnerReward[n]);
  eq(`${n}인 패자 몫`, rankings.slice(1).map((u) => s[u]), rankings.slice(1).map(() => -1));
  eq(`${n}인 합계 0 (신발이 생기거나 사라지지 않는다)`,
    Object.values(s).reduce((a, b) => a + b, 0), 0);
}
eq('1인은 정산 없음', M.settlementCounts(['solo']), {});

// ─────────────────────────────────────────────
console.log('6) 참가 조건 — 1켤레 이하는 못 들어간다');
eq('0켤레', M.canJoinMulti(0), false);
eq('1켤레', M.canJoinMulti(1), false);
eq('2켤레', M.canJoinMulti(2), true);

// ─────────────────────────────────────────────
console.log('7) 패널티 신발 뽑기 — 수량 기준 균등, 티어 무관');
{
  const wallet = { 0: 1, 129: 3 };  // 1티어 1켤레 + 5티어 3켤레
  const counts = { 0: 0, 129: 0 };
  for (let s = 0; s < 4000; s++) counts[M.pickPenaltyShoes(wallet, 1, rng(s))[0]]++;
  const ratio = counts[129] / counts[0];
  eq('3배 많이 가진 쪽이 약 3배 뽑힌다', ratio > 2.4 && ratio < 3.6, true);
  eq('고티어를 우선하지 않는다(1티어도 뽑힌다)', counts[0] > 0, true);
}
{
  eq('없으면 빈 배열', M.pickPenaltyShoes({}, 1, rng(1)), []);
  eq('보유보다 많이 요구해도 있는 만큼만', M.pickPenaltyShoes({ 5: 2 }, 5, rng(1)).length, 2);
  eq('같은 켤레를 두 번 뽑지 않는다', M.pickPenaltyShoes({ 5: 2 }, 2, rng(7)), [5, 5]);
}

// ─────────────────────────────────────────────
console.log('8) 지갑 반영 — 뽑힌 신발만 정확히 빠진다 (도감은 유지)');
L.resetAll(); mem.clear();
{
  // 도감은 지갑과 별개 장부다 — 판이 끝날 때 commitRun 이 함께 기록한다
  L.commitRun({ floor: 12, difficulty: 'normal', shoeIndices: [0, 0, 40, 129] });
  eq('시작', L.loadProfile().shoesByIndex, { 0: 2, 40: 1, 129: 1 });
  eq('도감은 종류 수라 3종', L.dexUnique(), 3);

  const gone = L.removeShoesByIndex([0, 129]);
  eq('빠진 것', gone, [0, 129]);
  eq('지갑', L.loadProfile().shoesByIndex, { 0: 1, 40: 1 });
  eq('합계도 따라 준다', L.loadProfile().shoesOwned, 2);
  eq('**도감은 그대로**', L.dexUnique(), 3);

  eq('없는 신발은 조용히 넘어간다', L.removeShoesByIndex([99]), []);
}

// ─────────────────────────────────────────────
console.log('9) 두 번 정산 방지 — 도장은 방+상대 단위');
L.resetAll(); mem.clear();
{
  const tag = 'room1234:loserUid';
  eq('처음엔 안 찍힘', L.isSettled(tag), false);
  L.markSettled(tag);
  eq('찍힘', L.isSettled(tag), true);
  eq('다른 상대는 별개', L.isSettled('room1234:otherUid'), false);
  eq('다른 방도 별개', L.isSettled('room9999:loserUid'), false);
}

// ─────────────────────────────────────────────
console.log('10) 정산을 두 번 돌려도 지갑이 한 번만 움직인다');
L.resetAll(); mem.clear();
{
  L.addShoes([3, 3, 3]);
  const tag = 'roomAAAA:me';
  const settleOnce = () => {
    if (L.isSettled(tag)) return 'skip';
    L.removeShoesByIndex([3]);
    L.markSettled(tag);
    return 'done';
  };
  eq('1회차', settleOnce(), 'done');
  eq('2회차는 건너뜀', settleOnce(), 'skip');
  eq('3회차도 건너뜀', settleOnce(), 'skip');
  eq('결국 1켤레만 빠졌다', L.loadProfile().shoesByIndex, { 3: 2 });
}

// ─────────────────────────────────────────────
console.log('11) 방 코드 — 4자리, 앞자리 0 허용');
{
  eq('형식', M.isRoomCode('0042'), true);
  eq('3자리 거부', M.isRoomCode('123'), false);
  eq('문자 거부', M.isRoomCode('12a4'), false);
  const codes = new Set();
  for (let s = 0; s < 500; s++) codes.add(M.makeRoomCode(rng(s)));
  eq('전부 4자리', [...codes].every(M.isRoomCode), true);
  eq('충분히 흩어진다', codes.size > 400, true);
}

// ─────────────────────────────────────────────
console.log('12) 전적');
L.resetAll(); mem.clear();
{
  L.recordMatch(true); L.recordMatch(true); L.recordMatch(false);
  const p = L.loadProfile();
  eq('승', p.multiWins, 2);
  eq('패', p.multiLosses, 1);
}

// ─────────────────────────────────────────────
console.log('13) 정산 흐름 전체 시뮬레이션 — 신발이 생기지도 사라지지도 않는다');
{
  /**
   * multiSettle.js 는 firebase 를 타서 노드에서 못 부른다. 그래서 **같은 순서**로
   * 지갑 원시연산과 규칙을 조합해 돌린다. 검증 대상은 "누가 뭘 몇 개 주고받나"다.
   *
   * 각 플레이어를 독립된 로컬 저장소로 흉내 낸다 — 실제로도 각자 자기 기기에서
   * 자기 것만 정산하기 때문이다.
   */
  const worlds = new Map();
  const use = (who) => {
    if (!worlds.has(who)) worlds.set(who, new Map());
    mem.clear();
    for (const [k, v] of worlds.get(who)) mem.set(k, v);
    return () => { const m = new Map(); for (const [k, v] of mem) m.set(k, v); worlds.set(who, m); };
  };

  const players = ['u_win', 'u_a', 'u_b', 'u_c'];
  // 넷 다 같은 신발 6켤레로 시작
  for (const who of players) {
    const save = use(who);
    L.resetAll(); mem.clear();
    // 빈 상태에서 한 번 읽어 지갑 구조 마이그레이션을 먼저 끝낸다.
    // 실제 앱도 부팅 때 loadProfile 이 먼저 돌아서 판을 시작할 땐 이미 끝나 있다.
    L.loadProfile();
    L.commitRun({ floor: 10, difficulty: 'normal', shoeIndices: [1, 1, 2, 3, 4, 5] });
    save();
  }
  const totalBefore = players.reduce((sum, who) => { use(who); return sum + L.loadProfile().shoesOwned; }, 0);
  eq('시작 총량 (4명 × 6켤레)', totalBefore, 24);

  const rankings = players;                       // u_win 이 1등
  const counts = M.settlementCounts(rankings);
  const room = 'r0001';
  const given = {};

  // ── 패자 3명이 각자 자기 것만 정산 ──
  for (const loser of rankings.slice(1)) {
    const save = use(loser);
    if (!L.isSettled(room + ':pay')) {
      const picked = M.pickPenaltyShoes(L.loadProfile().shoesByIndex, 1, rng(loser.length * 7));
      given[loser] = L.removeShoesByIndex(picked);
      L.recordMatch(false);
      L.markSettled(room + ':pay');
    }
    save();
  }
  eq('패자 3명이 각각 1켤레씩 내놓음', Object.values(given).map((g) => g.length), [1, 1, 1]);

  // ── 승자가 걷는다 ──
  {
    const save = use('u_win');
    for (const loser of rankings.slice(1)) {
      if (L.isSettled(`${room}:take:${loser}`)) continue;
      L.addShoes(given[loser]);
      for (const i of given[loser]) L.recordShoe(i);
      L.markSettled(`${room}:take:${loser}`);
    }
    L.recordMatch(true);
    eq('승자 몫이 표와 일치', L.loadProfile().shoesOwned - 6, MULTI.winnerReward[4]);
    eq('승자 몫이 계산과 일치', L.loadProfile().shoesOwned - 6, counts.u_win);
    save();
  }

  // ── 총량 보존 ──
  const totalAfter = players.reduce((sum, who) => { use(who); return sum + L.loadProfile().shoesOwned; }, 0);
  eq('정산 후 총량 그대로 (이동만 일어난다)', totalAfter, totalBefore);
  { use('u_a'); eq('패자는 1켤레 줄었다', L.loadProfile().shoesOwned, 5); }
  { use('u_win'); eq('승자는 3켤레 늘었다', L.loadProfile().shoesOwned, 9); }

  // ── 같은 정산을 두 번 돌려도 변화 없음 ──
  for (const loser of rankings.slice(1)) {
    const save = use(loser);
    if (!L.isSettled(room + ':pay')) { L.removeShoesByIndex([1]); L.markSettled(room + ':pay'); }
    save();
  }
  {
    const save = use('u_win');
    for (const loser of rankings.slice(1)) {
      if (L.isSettled(`${room}:take:${loser}`)) continue;
      L.addShoes(given[loser]);
    }
    save();
  }
  const totalTwice = players.reduce((sum, who) => { use(who); return sum + L.loadProfile().shoesOwned; }, 0);
  eq('두 번 돌려도 총량 동일', totalTwice, totalBefore);
  { use('u_win'); eq('승자 지갑도 그대로', L.loadProfile().shoesOwned, 9); }
  { use('u_b'); eq('패자 지갑도 그대로', L.loadProfile().shoesOwned, 5); }

  // ── 승자 도감: 없던 종류를 받으면 새로 등록된다 ──
  {
    const save = use('u_win');
    const before = L.dexUnique();
    L.addShoes([99]); L.recordShoe(99);
    eq('받은 신발이 도감에 새로 오른다', L.dexUnique(), before + 1);
    save();
  }
}

// ─────────────────────────────────────────────
console.log('14) 미정산 회피 — 패자가 앱을 꺼도 승자는 받고, 패자는 다음에 청산된다');
{
  mem.clear(); L.resetAll();
  L.loadProfile();   // 위와 같은 이유 — 마이그레이션 먼저
  L.commitRun({ floor: 5, difficulty: 'easy', shoeIndices: [7, 7, 8] });
  const room = 'r0002';
  // 1차: 정산 전에 앱이 꺼졌다고 치면 도장이 없다
  eq('도장 없음', L.isSettled(room + ':pay'), false);
  eq('지갑 그대로', L.loadProfile().shoesOwned, 3);
  // 2차 접속: 청산이 돈다
  const picked = M.pickPenaltyShoes(L.loadProfile().shoesByIndex, 1, rng(3));
  L.removeShoesByIndex(picked);
  L.markSettled(room + ':pay');
  eq('뒤늦게 차감됨', L.loadProfile().shoesOwned, 2);
  eq('그 뒤로는 다시 안 깎인다', (() => {
    if (!L.isSettled(room + ':pay')) L.removeShoesByIndex([7]);
    return L.loadProfile().shoesOwned;
  })(), 2);
}

console.log(fails ? `\n실패 ${fails}건` : '\n멀티 정산 로직 이상 없음');
process.exit(fails ? 1 : 0);
