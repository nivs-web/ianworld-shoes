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
console.log('1) 순위 — 계단 높이가 1순위 (2026-08-18 역전 배틀)');
/**
 * 예전에는 주운 신발이 1순위였다. 부활이 생기면서 폐기했다 —
 * 20켤레를 걸면 **1위보다 20칸 앞**에서 되살아나므로 계단이 곧 승부다.
 */
eq('계단 높은 쪽이 1등 (신발은 안 본다)', M.rankPlayers([
  { uid: 'a', shoesFound: 5, stairs: 10 },
  { uid: 'b', shoesFound: 0, stairs: 900 },
]), ['b', 'a']);

console.log('2) 계단이 같으면 살아남은 쪽');
eq('죽은 사람보다 위', M.rankPlayers([
  { uid: 'a', shoesFound: 3, stairs: 40, alive: false, reachedAt: 1 },
  { uid: 'b', shoesFound: 0, stairs: 40, alive: true },
]), ['b', 'a']);

console.log('3) 둘 다 죽었으면 먼저 도달한 쪽');
eq('먼저 도달', M.rankPlayers([
  { uid: 'a', stairs: 7, alive: false, reachedAt: 2000 },
  { uid: 'b', stairs: 7, alive: false, reachedAt: 1000 },
]), ['b', 'a']);
eq('도달 시각도 없으면 uid 사전순(결정적)', M.rankPlayers([
  { uid: 'z', stairs: 0 },
  { uid: 'a', stairs: 0 },
]), ['a', 'z']);

console.log('4) 순위는 **누가 계산해도 같아야 한다** (각자 자기 화면에서 계산한다)');
{
  const players = [
    { uid: 'c', shoesFound: 1, stairs: 5, alive: false, reachedAt: 300 },
    { uid: 'a', shoesFound: 1, stairs: 5, alive: false, reachedAt: 300 },
    { uid: 'b', shoesFound: 4, stairs: 2, alive: false, reachedAt: 100 },
    { uid: 'd', shoesFound: 1, stairs: 9, alive: false, reachedAt: 900 },
  ];
  const truth = M.rankPlayers(players);
  // 입력 순서를 24가지로 섞어도 결과가 같아야 한다
  const perms = [];
  (function permute(arr, cur) {
    if (!arr.length) return perms.push(cur);
    arr.forEach((x, i) => permute([...arr.slice(0, i), ...arr.slice(i + 1)], [...cur, x]));
  })(players, []);
  eq('24가지 입력 순서 전부 동일', perms.every((p) => JSON.stringify(M.rankPlayers(p)) === JSON.stringify(truth)), true);
  eq('그 답 (계단 9 → 5·5 → 2)', truth, ['d', 'a', 'c', 'b']);
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


// ─────────────────────────────────────────────
console.log('15) 서버 도장 — 기기를 바꿔도 두 번 걷지 않는다 (2026-08-16)');
{
  /**
   * 예전 구조의 구멍을 그대로 재현한다.
   *
   * 정산 도장이 **localStorage 에만** 있었는데, 재정산의 입력인 `userRooms` 와
   * `result.given` 은 RTDB 에 영구히 남는다. 그래서 저장소를 지우거나 기기를 바꾸면
   * 승자가 같은 `given` 을 다시 걷어 **신발이 복제**됐고, 패자는 이미 낸 신발을 또 내
   * (그 신발은 아무도 못 받으므로) **증발**시켰다.
   *
   * 새 구조에서는 방 문서가 판정한다:
   *   · 패자 — `given[내uid]` 가 있으면 이미 낸 것이다
   *   · 승자 — `settled[내uid]` 비트마스크에 그 패자 비트가 서 있으면 이미 걷은 것이다
   * 둘 다 **서버에 있으므로** 기기를 바꿔도 그대로 남는다.
   */
  const room = { result: { rankings: ['u_win', 'u_a', 'u_b'], given: {}, settled: {} } };
  const R = room.result;

  // multiSettle.js 의 판정부만 그대로 옮겨 온 것 (파이어베이스를 안 타는 순수 로직)
  const payStep = (uid, wallet) => {
    if (Array.isArray(R.given[uid])) return [];          // 서버가 "이미 냈다"고 말한다
    const picked = M.pickPenaltyShoes(wallet, MULTI.loserPenalty, rng(uid.length * 11));
    if (!picked.length) return [];                        // 지갑이 안 내려왔다 — 다음에 다시
    R.given[uid] = picked;
    return picked;
  };
  const takeStep = (uid) => {
    const losers = R.rankings.slice(1);
    let mask = Number(R.settled[uid] ?? 0);
    const got = [];
    losers.forEach((loser, i) => {
      const bit = 1 << i;
      if (mask & bit) return;
      const list = R.given[loser];
      if (!Array.isArray(list) || !list.length) return;
      got.push(...list);
      mask |= bit;
    });
    R.settled[uid] = mask;
    return got;
  };

  const walletA = { 1: 2, 2: 1 };
  eq('패자 A 가 1켤레 낸다', payStep('u_a', walletA).length, 1);
  eq('같은 기기에서 또 불러도 안 낸다', payStep('u_a', walletA).length, 0);
  eq('저장소를 지운 새 기기에서도 안 낸다', payStep('u_a', walletA).length, 0);

  eq('패자 B 도 1켤레', payStep('u_b', { 5: 3 }).length, 1);
  eq('승자가 두 명분을 걷는다', takeStep('u_win').length, 2);
  eq('바로 또 걷어도 0개', takeStep('u_win').length, 0);
  eq('기기를 바꿔도 0개 (서버 마스크가 살아 있다)', takeStep('u_win').length, 0);
  eq('마스크는 패자 2명분 비트', R.settled.u_win, 0b11);

  // 늦게 낸 패자 — 순서가 뒤죽박죽이어도 정확히 한 번씩만
  const room2 = { result: { rankings: ['w', 'x', 'y', 'z'], given: {}, settled: {} } };
  const R2 = room2.result;
  const take2 = (uid) => {
    const losers = R2.rankings.slice(1);
    let mask = Number(R2.settled[uid] ?? 0);
    const got = [];
    losers.forEach((loser, i) => {
      const bit = 1 << i;
      if (mask & bit) return;
      const list = R2.given[loser];
      if (!Array.isArray(list) || !list.length) return;
      got.push(...list); mask |= bit;
    });
    R2.settled[uid] = mask;
    return got;
  };
  R2.given.y = [50];                       // 가운데 패자만 먼저 냈다
  eq('가운데 패자만 먼저 내도 그것만 걷는다', take2('w'), [50]);
  R2.given.x = [10]; R2.given.z = [90];    // 나머지가 나중에 냈다
  eq('나머지는 나중에 정확히 한 번', take2('w').sort(), [10, 90]);
  eq('또 걷으면 0개', take2('w').length, 0);
  eq('마스크는 패자 3명 전부', R2.settled.w, 0b111);

  // 지갑이 아직 안 내려온 상태에서 정산이 돌면 — 면제가 아니라 보류여야 한다
  const R3 = { rankings: ['a', 'b'], given: {}, settled: {} };
  const payEmpty = (uid, wallet) => {
    if (Array.isArray(R3.given[uid])) return [];
    const picked = M.pickPenaltyShoes(wallet, MULTI.loserPenalty, rng(5));
    if (!picked.length) return [];
    R3.given[uid] = picked;
    return picked;
  };
  eq('빈 지갑이면 아무것도 안 낸다', payEmpty('b', {}).length, 0);
  eq('도장도 안 찍힌다 (면제 아님)', R3.given.b === undefined, true);
  eq('지갑이 내려온 뒤 정상 차감', payEmpty('b', { 3: 1 }).length, 1);
}


// ─────────────────────────────────────────────
console.log('16) 자동 매칭 — 두 대가 반드시 같은 방으로 모인다 (2026-08-16)');
{
  /**
   * 실기기 두 대로 '방 입장'을 눌렀더니 **둘 다 방만 만들었다.** 원인은 둘이었다:
   *   (a) joinRoom 이 읽지 않은 방에 트랜잭션을 걸어 무조건 '없는 방'으로 판정 (코드에서 수정)
   *   (b) 동시에 누르면 둘 다 빈 목록을 보고 각자 방을 만든다 → 여기 정렬이 그걸 푼다
   *
   * (b) 를 풀려면 **양쪽이 같은 답**을 내야 한다. 한쪽만 옮겨야 만난다 —
   * 둘 다 옮기면 자리만 바꾸고, 둘 다 안 옮기면 영영 안 만난다.
   */
  const P = (n) => Object.fromEntries(Array.from({length:n},(_,i)=>['u'+i,{}]));
  const A = { code:'1111', state:'waiting', hostUid:'a', createdAt:1000, players:P(1) };
  const B = { code:'2222', state:'waiting', hostUid:'b', createdAt:2000, players:P(1) };

  eq('먼저 만든 방이 이긴다', [B,A].sort(M.byPreference)[0].code, '1111');
  eq('양쪽이 같은 답 (A 기준)', [A,B].sort(M.byPreference)[0].code, [B,A].sort(M.byPreference)[0].code);

  const empty = { code:'0000', state:'waiting', hostUid:'c', createdAt:1, players:{} };
  eq('사람 있는 방이 빈 방보다 먼저', [empty,A].sort(M.byPreference)[0].code, '1111');

  const same1 = { code:'9999', state:'waiting', hostUid:'x', createdAt:5000, players:{} };
  const same2 = { code:'3333', state:'waiting', hostUid:'y', createdAt:5000, players:{} };
  eq('시각이 같으면 코드 순', [same1,same2].sort(M.byPreference)[0].code, '3333');
  eq('순서를 바꿔도 같은 답', [same2,same1].sort(M.byPreference)[0].code, '3333');

  // joinable
  eq('내 방은 제외', M.joinable({...A, hostUid:'me'}, 'me'), false);
  eq('시작한 방은 제외', M.joinable({...A, state:'countdown'}, 'me'), false);
  eq('정원 찬 방은 제외', M.joinable({...A, players:P(4), maxPlayers:4}, 'me'), false);
  eq('빈 방도 들어갈 수 있다 (유령 방 재사용)', M.joinable(empty, 'me'), true);
  eq('코드 없는 방은 제외', M.joinable({...A, code:undefined}, 'me'), false);

  // 두 대 동시 생성 시나리오 — 한 명만 움직인다
  const 폰1 = { code:'5555', state:'waiting', hostUid:'p1', createdAt:1000, players:P(1) };
  const 폰2 = { code:'6666', state:'waiting', hostUid:'p2', createdAt:1200, players:P(1) };
  const 폰1이_옮길까 = [폰2].filter((r)=>M.joinable(r,'p1')).filter((r)=>M.byPreference(r,폰1)<0).length > 0;
  const 폰2가_옮길까 = [폰1].filter((r)=>M.joinable(r,'p2')).filter((r)=>M.byPreference(r,폰2)<0).length > 0;
  eq('먼저 만든 폰1 은 그대로', 폰1이_옮길까, false);
  eq('나중에 만든 폰2 만 옮긴다', 폰2가_옮길까, true);
}

// ─────────────────────────────────────────────
console.log('17) 방 목록 · 대기자 (2026-08-16)');
{
  const P = (n) => Object.fromEntries(Array.from({length:n},(_,i)=>['u'+i,{}]));
  const 대기중 = { code:'1111', state:'waiting', hostUid:'h', createdAt:1, players:P(2), maxPlayers:4 };
  const 게임중 = { code:'2222', state:'playing', hostUid:'h', createdAt:2, players:P(3), maxPlayers:4 };
  const 만원   = { code:'3333', state:'playing', hostUid:'h', createdAt:3, players:P(4), maxPlayers:4 };
  const 끝난방 = { code:'4444', state:'finished', hostUid:'h', createdAt:4, players:P(1), maxPlayers:4 };

  eq('대기중 방에는 들어간다', M.hasSeat(대기중, 'me'), true);
  eq('게임중이어도 자리 있으면 들어간다 (대기자)', M.hasSeat(게임중, 'me'), true);
  eq('4/4 는 못 들어간다', M.hasSeat(만원, 'me'), false);
  eq('끝난 방은 후보가 아니다', M.hasSeat(끝난방, 'me'), false);
  eq('내가 방장인 방은 제외', M.hasSeat({...대기중, hostUid:'me'}, 'me'), false);
  eq('이미 들어가 있으면 제외', M.hasSeat({...대기중, players:{me:{}}}, 'me'), false);

  // 대기자는 이번 판 사람이 아니다 — 순위·정산에서 통째로 빠져야 한다
  const players = {
    a: { stairs: 30, shoesFound: 2 },
    b: { stairs: 10, shoesFound: 1 },
    c: { stairs: 0, shoesFound: 0, waiting: true },   // 게임 중에 들어온 사람
  };
  const round = M.playersInRound(players);
  eq('대기자는 이번 판에서 빠진다', round.map((p) => p.uid).sort(), ['a', 'b']);
  eq('순위에도 안 들어간다', M.rankPlayers(round), ['a', 'b']);
  eq('정산 대상도 2명뿐', Object.keys(M.settlementCounts(M.rankPlayers(round))).length, 2);
  // 만약 대기자가 섞이면 — 뛰지도 않았는데 꼴찌가 되어 신발을 뺏긴다
  const 잘못 = M.rankPlayers(Object.entries(players).map(([uid, v]) => ({ uid, ...v })));
  eq('(대조) 안 걸러내면 대기자가 꼴찌로 낀다', 잘못.length, 3);
}

// ── 18) 결과 화면이 신발을 흘리지 않는가 · 목록 줄이 안 터지는가 (2026-08-18) ──
{
  console.log('\n18) 결과 화면 · 방 목록 (2026-08-18)');
  const fs = await import('node:fs');
  const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');

  /**
   * `resetRoom` 은 `result` 를 통째로 지운다 — 그 안에 패자가 내놓은 `given` 이 있다.
   * 승자가 그걸 걷기 전에 '방에 남기'를 누르면 **신발이 증발한다**(패자 지갑에서는 이미 빠졌다).
   */
  const mr = read('../src/screens/multi/MultiResult.js');
  const stay = mr.slice(mr.indexOf('S.stayInRoom'));
  const settleAt = stay.indexOf('settleRoom(');
  const resetAt = stay.indexOf('resetRoom(');
  eq("'방에 남기' 는 지우기 전에 정산을 한 번 더 돈다",
     settleAt >= 0 && settleAt < resetAt, true);

  /**
   * `.pbtn` 은 로비용이라 `width: 100%` 다. 목록 행에서 폭을 안 되돌리면 버튼이
   * 행 전체를 먹고, 이름이 한 글자씩 세로로 접히며 행이 화면 밖으로 나간다.
   */
  const css = read('../src/styles/screens.css');
  const rowBtn = (css.match(/\.room-row \.pbtn \{[^}]*\}/s) ?? [''])[0];
  const roomName = (css.match(/\.room-name \{[^}]*\}/s) ?? [''])[0];
  eq('목록 버튼이 width 를 되돌린다', /width:\s*auto/.test(rowBtn), true);
  eq('방 이름이 줄어들 수 있다 (min-width: 0)', /min-width:\s*0/.test(roomName), true);
}

// ── 19) 2026-08-18 검수에서 고친 10건이 되돌아가지 않았는가 ──
{
  console.log('\n19) 재발 방지 (2026-08-18)');
  const fs = await import('node:fs');
  const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
  const has = (label, src, needle) => eq(label, src.includes(needle), true);

  const mp = read('../src/services/multiplayer.js');
  const mr = read('../src/screens/multi/MultiResult.js');
  const ms = read('../src/services/multiSettle.js');
  const gs = read('../src/game/GameScene.js');
  const ov = read('../src/game/overlays.js');
  const ci = read('../src/screens/multi/CodeInput.js');
  const sg = read('../src/screens/startGame.js');
  const sl = read('../src/services/storageLocal.js');
  const pw = read('../src/services/pwa.js');

  // 1) 나가기는 한 번의 멀티패스 업데이트여야 한다 (지운 뒤에 쓰면 규칙이 401 을 준다)
  const leave = mp.slice(mp.indexOf('export async function leaveRoom'), mp.indexOf('export async function forgetRoom'));
  eq('나가기 — 삭제와 뒷정리를 한 번에 쓴다', /\[path\('players', fb\.uid\)\]: null/.test(leave), true);
  eq('나가기 — 방장 승계를 같은 patch 에 싣는다', /patch\.hostUid/.test(leave), true);

  // 2) 판이 끝나면 매칭 창에서 내려가고, 자동 이탈이 다시 켜진다
  has('결과 확정 시 open:false', mp, 'open: false');
  has('자동 이탈 재무장 함수', mp, 'export async function rearmRoomSeat');
  has('결과 화면이 재무장을 부른다', mr, 'rearmRoomSeat');
  has('결과 화면이 방에서 빠진다', mr, 'Room.leaveRoom(code)');
  has('접속 청산이 볼일 끝난 방에서 빠진다', ms, 'Room.leaveRoom(code)');

  // 3) 안 걷힌 신발이 있으면 방을 되돌리지 않는다
  has("리셋이 'pending' 을 돌려준다", mp, "return 'pending'");
  has('결과 화면이 pending 을 안내한다', mr, 'S.resetPending');

  // 4) 판이 끝나는 즉시 계정에 반영
  has('게임이 즉시 반영 콜백을 부른다', gs, 'this.commitRun();');
  has('싱글이 onCommit 을 넘긴다', sg, 'onCommit:');

  // 5) 종료 재진입 방지
  has('끝난 판은 update 를 멈춘다', gs, 'if (this.over) return;');
  has('나가기 재진입 방지', gs, 'if (this.leaving || this.over) return;');

  // 6) 멀티 일시정지에는 다시하기가 없다
  has('멀티 일시정지 — 기권 확인 단계', ov, 'confirmExit');

  // 7) 코드 입장도 대기자를 안다
  has('코드 입장이 waiting 을 처리한다', ci, "r === 'waiting'");

  // 8) 동점이면 살아남은 쪽이 위
  eq('동점 — 나간 사람이 1등이 될 수 없다',
     M.rankPlayers([
       { uid: 'quit', stairs: 0, shoesFound: 0, alive: false, reachedAt: 100 },
       { uid: 'stay', stairs: 0, shoesFound: 0, alive: true },
     ]), ['stay', 'quit']);
  eq('둘 다 죽었으면 먼저 도달한 쪽이 위',
     M.rankPlayers([
       { uid: 'a', stairs: 3, alive: false, reachedAt: 200 },
       { uid: 'b', stairs: 3, alive: false, reachedAt: 100 },
     ]), ['b', 'a']);
  // 시계가 제각각인 폰들 사이에서는 '내가 잰 보정값'조차 못 믿는다 (§9-0-25).
  // 이제 서버가 직접 찍는다.
  has('사망 보고가 서버 시각을 쓴다', mp, 'const at = fb.dbMod.serverTimestamp();');

  // 9) 새 배포 감지
  has('배포 감지 루틴', pw, 'async function checkDeploy');
  has('게임 중에는 새로고침하지 않는다', pw, 'Scene.depth() > 0');

  // 10) 깨진 저장값 백업
  has('깨진 저장값을 .bak 으로 남긴다', sl, '.bak');
}

// ── 20) 2026-08-18 2차 — 고치다 만든 구멍까지 막았는가 ──
{
  console.log('\n20) 2차 검수 재발 방지 (2026-08-18)');
  const fs = await import('node:fs');
  const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
  const has = (label, src, needle) => eq(label, src.includes(needle), true);
  const mp = read('../src/services/multiplayer.js');
  const wr = read('../src/screens/multi/WaitingRoom.js');
  const mr = read('../src/screens/multi/MultiResult.js');
  const ms = read('../src/services/multiSettle.js');
  const gs = read('../src/game/GameScene.js');
  const pw = read('../src/services/pwa.js');
  const rules = JSON.parse(read('../docs/rtdb-rules.json'));

  // 대기자의 되돌리기가 남의 정산을 지우면 안 된다
  has('되돌리기는 이번 판 사람이 다 나간 뒤에만', wr, "rank.some((uid) => r.players?.[uid])");
  has('되돌리기 실패 시 재시도', wr, 'RESET_RETRY_MS');

  // 종료 대기 중 일시정지로 두 번 끝내는 경로
  has('끝난 판에서는 일시정지가 안 열린다', gs, 'if (this.over || this.leaving) return;');

  // 신발이 걸린 방은 못 지운다 (미수령 + 미납부)
  has('미납부 판정', mp, 'export function hasUnpaid');
  has('방 보존 판정', mp, 'export function mustKeepRoom');
  eq('빈 방이어도 패자가 안 냈으면 남긴다',
     [mp.includes('!rest.length && !mustKeepRoom(room)'), mp.includes('if (mustKeepRoom(room)) return;')],
     [true, true]);

  // 접속 청산이 죽은 기록을 지운다
  has('볼일 없는 방 기록 정리', ms, '볼일없음');

  // 서버 시각은 한 번만 잰다 (사망 보고가 순위 확정에 밀리면 안 된다)
  has('서버 오프셋 캐시', mp, 'offsetCache');

  // 자동 새로고침 금지 구역
  has('대기방·결과 화면은 새로고침 금지', pw, 'canReload()');
  eq('두 화면 모두 hold 를 잡는다', [wr.includes('hold()'), mr.includes('hold()')], [true, true]);

  // 규칙: 초기화 허용은 result 까지 지울 때만 / 도장은 진짜 방에만
  const st = rules.rules.rooms.$code.players.$uid.stairs['.validate'];
  eq('초기화 허용에 result 조건이 붙었다', st.includes("child('result').exists()"), true);
  const settled = rules.rules.rooms.$code.result.settled.$uid['.write'];
  eq('도장은 순위가 있는 방에만', settled.includes("child('rankings').exists()"), true);
}

// ── 21) 역전 배틀 (2026-08-18) ──────────────────
{
  console.log('\n21) 역전 배틀 — 부활 베팅');
  const fs = await import('node:fs');
  const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
  const has = (label, src, needle) => eq(label, src.includes(needle), true);
  const W = MULTI.reviveWindowSeconds * 1000;

  // 순위는 계단만 본다 (신발 기준 폐지)
  eq('신발이 많아도 계단이 낮으면 진다',
     M.rankPlayers([{ uid: 'a', stairs: 10, shoesFound: 9, alive: false, reachedAt: 1 },
                    { uid: 'b', stairs: 30, shoesFound: 0, alive: false, reachedAt: 2 }]), ['b', 'a']);
  eq('같은 계단이면 살아남은 쪽이 위',
     M.rankPlayers([{ uid: 'dead', stairs: 5, alive: false, reachedAt: 1 },
                    { uid: 'live', stairs: 5, alive: true }]), ['live', 'dead']);

  // 부활 위치는 **무조건 1위보다 20칸 앞**
  eq('부활 위치 = 1위 + 20', M.reviveFloor({ players: { a: { stairs: 37 }, b: { stairs: 12 } } }), 57);
  eq('내가 꼴찌여도 1위 기준', M.reviveFloor({ players: { a: { stairs: 0 }, b: { stairs: 100 } } }), 120);

  // 내야 할 양 = 기본 1 + 20 × 부활
  eq('부활 0회 → 1켤레', M.owedBy({}), 1);
  eq('부활 3회 → 61켤레', M.owedBy({ revives: 3 }), 1 + 3 * MULTI.reviveCost);
  // 상한은 밸런스 값에서 끌어온다 — 10회에서 6회로 줄였다 (2026-08-19)
  eq('상한에 닿으면 못 쓴다', M.canRevive({ revives: MULTI.maxRevives }), false);
  eq('한 번 남았으면 쓸 수 있다', M.canRevive({ revives: MULTI.maxRevives - 1 }), true);

  // 판돈은 **항아리에 실제로 든 것**으로 센다 (조작 방지)
  const 방 = {
    players: { a: { revives: 1 }, b: {} },
    result: { given: { a: new Array(20).fill(3) } },
  };
  // 1등은 기본 1켤레를 안 내므로 기본 몫은 **인원 − 1** 이다
  eq('판돈 = 건 20 + 기본 (2−1)', M.potShoes(방), 21);
  eq('부활 횟수만 부풀려도 판돈은 안 커진다',
     M.potShoes({ players: { a: { revives: 9 }, b: {} }, result: { given: {} } }) >= 2, true);

  // 종료 판정
  const now = 100000;
  // 1:1 은 한 명만 빠져도 끝난다 (2026-08-19). 셋 이상이어야 "아직 뛰는 사람"이 의미가 있다
  eq('셋 중 한 명이라도 뛰고 있으면 안 끝난다',
     M.roundOver({ players: { a: { alive: true }, b: { alive: false, out: true }, c: { alive: false, out: true } } }, now), false);
  eq('1:1 은 한 명이 빠지면 끝난다',
     M.roundOver({ players: { a: { alive: true }, b: { alive: false, out: true } } }, now), true);
  eq('창이 안 지났으면 기다린다',
     M.roundOver({ players: { a: { alive: false, deadAt: now - 1000 } } }, now), false);
  eq('창을 넘기면 끝난다',
     M.roundOver({ players: { a: { alive: false, deadAt: now - W - 1 } } }, now), true);
  eq('포기하면 즉시 끝난다',
     M.roundOver({ players: { a: { alive: false, out: true } } }, now), true);
  eq('부활을 다 썼으면 기다리지 않는다',
     M.roundOver({ players: { a: { alive: false, deadAt: now, revives: MULTI.maxRevives } } }, now), true);
  eq('대기자는 판정에서 빠진다',
     M.roundOver({ players: { a: { alive: false, out: true }, w: { waiting: true, alive: true } } }, now), true);
  eq('나 말고 다 빠졌다',
     M.othersAllOut({ players: { me: { alive: true }, b: { alive: false, out: true } } }, 'me', now), true);

  // 클라이언트 연결
  const gs = read('../src/game/GameScene.js');
  const ov = read('../src/game/overlays.js');
  const mh = read('../src/game/multiHud.js');
  const mp = read('../src/services/multiplayer.js');
  const ms = read('../src/services/multiSettle.js');
  const rules = JSON.parse(read('../docs/rtdb-rules.json')).rules.rooms.$code;

  has('죽으면 부활 오버레이', gs, 'new MultiDeathOverlay(this)');
  has('부활 위치로 되살린다', gs, 'reviveAt(floor)');
  has('종료는 roundOver 가 정한다', gs, 'roundOver(r, now)');
  has('순위 확정도 roundOver 를 본다', mp, 'if (!roundOver(room, Date.now() + serverOffsetSync())) return room;');
  eq('사망 보고가 판을 끝내지 않는다',
     mp.slice(mp.indexOf('export async function reportDeath'), mp.indexOf('export async function declineRevive'))
       .includes("'방 종료'"), false);
  has('부활은 판돈과 되살아나기를 한 번에 쓴다', mp, "path('result', 'given', fb.uid)]: merged");
  has('포기 알림', mp, 'export async function declineRevive');
  has('승자가 항아리를 통째로 걷는다', ms, 'for (const [uid, list] of Object.entries(given))');
  has('패자는 모자란 만큼만 낸다', ms, 'const short = Math.max(0, owed - already.length)');
  has('고스트 렌더', mh, 'function drawGhosts');
  has('레이스 게이지', mh, 'function drawRaceGauge');
  has('판돈 표시', mh, 'S.potLine');
  has('작은 폰트 사용', mh, 'small: true');
  has('매 프레임 글자는 캐시본', mh, 'textCached(');
  eq('규칙에 revives·deadAt·out 이 있다',
     ['revives', 'deadAt', 'out'].every((k) => !!rules.players.$uid[k]), true);
  eq('판돈 상한 220', rules.result.given.$uid['.validate'].includes('220'), true);
}

// ── 22) 역전 배틀 2차 — 적대적 검토에서 나온 구멍 ──
{
  console.log('\n22) 역전 배틀 — 되돌아가면 안 되는 것들');
  const fs = await import('node:fs');
  const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
  const has = (label, src, needle) => eq(label, src.includes(needle), true);
  const mp = read('../src/services/multiplayer.js');
  const gs = read('../src/game/GameScene.js');
  const ov = read('../src/game/overlays.js');

  // ① 마지막 생존자가 판을 끝내도 종료 판정이 성립해야 한다
  eq('살아서 끝낸 사람도 판정에 포함',
     M.roundOver({ players: { a: { alive: true, out: true }, b: { alive: false, out: true } } }, 1), true);
  eq('아직 뛰는 사람이 있으면 아니다 (3인)',
     M.roundOver({ players: { a: { alive: true }, b: { alive: false, out: true }, c: { alive: true } } }, 1), false);
  has('끝낼 때 out 도장을 찍는다', gs, 'Room.markOut(this.multi.code)');

  // ② 판돈과 부활은 한 번의 쓰기 (실패해도 복제되지 않는다)
  const revive = mp.slice(mp.indexOf('export async function reviveMe'), mp.indexOf('export async function finalizeResult'));
  eq('부활은 멀티패스 업데이트 하나', revive.includes('dbMod.update') && !revive.includes('dbMod.set'), true);
  has('끝난 판에는 못 건다', mp, "if (room.result?.rankings || room.state === 'finished') return null;");
  has('실패해도 서버를 다시 확인한다', mp, 'after?.alive === true');

  // ③ 도장 비트 색인이 정산과 같아야 한다
  has('미수령 판정도 켤레 수로 센다', mp, 'v.length > (걷은양[uid] ?? 0)');
  eq('slice(1) 로 세지 않는다', mp.includes("rank.slice(1).some((uid, i) => Array.isArray(given[uid]) && !(mask"), false);

  // ④ 판돈 표시가 실제 수령액과 맞는다 (1등은 기본을 안 낸다)
  eq('2인 · 아무도 안 걸었으면 1켤레', M.potShoes({ players: { a: {}, b: {} }, result: {} }), 1);
  eq('2인 · 한 명이 20 걸었으면 21', M.potShoes({
    players: { a: { revives: 1 }, b: {} }, result: { given: { a: new Array(20).fill(1) } },
  }), 21);

  // ⑤ 부활 창은 서버 시각 기준
  has('창을 deadAt 기준으로 잡는다', ov, 'serverOffsetSync()');
  // ⑥ 지갑을 즉시 밀어 올린다 (max 병합이 되돌리지 못하게)
  has('부활 직후 지갑 동기화', ov, 'syncWallet()');
  // ⑦ 안 낸 패자가 있으면 잠깐 기다렸다 되돌린다
  has('미납부도 리셋을 잠시 막는다', mp, 'hasUnpaid(room) && 끝난지 < RESET_WAIT_MS');
}

// ── 23) 랙 · 신발 증발 (2026-08-19) ──
/**
 * 사용자 신고 두 건이 출발점이다.
 *   ① "랙이 있어 튕긴다"
 *   ② "신발 100개를 20개씩 5번 걸었는데 그 신발이 사라졌다"
 * ②는 재산이 실제로 없어지는 사고라 **증상이 아니라 경로**를 못 박아 둔다.
 */
{
  console.log('\n23) 랙 · 판돈 증발 (2026-08-19)');
  const fs = await import('node:fs');
  const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
  const has = (label, src, needle) => eq(label, src.includes(needle), true);
  const mp = read('../src/services/multiplayer.js');
  const ms = read('../src/services/multiSettle.js');
  const hud = read('../src/game/multiHud.js');
  const pf = read('../src/core/pixelfont.js');

  // ① 판돈이 걸린 방은 순위가 없어도 못 지운다 (100켤레 증발의 직접 원인)
  eq('순위 없이 판돈만 있어도 지키다', M.potShoes({
    players: { a: { revives: 5 }, b: {} },
    result: { given: { a: new Array(100).fill(1) } },
  }), 101);
  has('항아리가 비지 않았으면 방을 남긴다', mp, 'if (!room?.result?.rankings) return 항아리에있다;');

  // ② 끝나지 않은 판의 내 판돈은 되돌려받는다 — 서버에서 먼저 지우고 지갑에 넣는다
  has('판돈 회수 경로', mp, 'export async function reclaimStake(code)');
  has('순위가 있으면 회수하지 않는다', mp, 'if (room.result?.rankings) return null;');
  has('정산이 회수를 부른다', ms, 'Room.reclaimStake(code)');
  eq('서버에서 지운 뒤에 지갑에 넣는다',
    ms.indexOf('Room.reclaimStake(code)') < ms.indexOf('L.addShoes(back)'), true);
  has('아직 뛰는 사람이 있으면 회수하지 않는다', ms, '!outOfRound(p, now)');

  // ③ 방에서 빠진 사람의 판돈(순위에 못 들어간다)도 승자가 걷는다
  // 순위에 없는 사람(중도 이탈자)의 판돈도 걷는다 — 이제는 `given` 을 통째로 훑으므로 저절로 포함된다
  has('옛 비트 도장도 읽는다', mp, 'export const ORPHAN_BIT');
  has('걷을 대상은 순위가 아니라 항아리', ms, 'Object.entries(given)');

  // ④ 혼자 남아도 순위를 박는다 — 아니면 결과 화면에서 영원히 갇힌다
  eq('minPlayers 미만이면 포기하지 않는다', mp.includes('players.length < MULTI.minPlayers) return'), false);

  // ⑤ 시각은 서버가 찍는다 (폰 시계가 빠르면 부활 창이 안 닫히고, 느리면 고르는 중에 끝난다)
  has('사망 시각을 서버가 찍는다', mp, 'const at = fb.dbMod.serverTimestamp();');
  has('부활 시각도 서버가 찍는다', mp, "'reachedAt')]: fb.dbMod.serverTimestamp()");

  // ⑥ 랙 — 멀티 HUD 의 매 프레임 문자열이 전부 캐시를 탄다
  eq('HUD 에 캐시 없는 text() 호출이 없다', /[^dC]text\(/.test(hud.replace(/textCached\(/g, 'X(')), false);
  has('판돈은 방이 바뀔 때만 다시 만든다', hud, 'if (scene.potRoom !== room)');
  has('알림 줄바꿈은 한 번만 잰다', hud, 'if (!t.lines) t.lines = wrap(');
  has('글리프 캐시를 늘렸다', pf, 'GLYPH_CACHE_MAX = 320');
}

// ── 24) 둘 다 나가기 · 튕김 (2026-08-19) ──
/**
 * 사용자 신고: **"두 명이 게임 중에 나가기를 눌렀는데 신발이 안 넘어가고 튕긴다."**
 * 원인은 하나로 모였다 — **판이 안 끝나거나, 끝나기 전에 방을 나가면 순위에서 사라진다.**
 * 순위(`rankings`)는 방에 남아 있는 사람만 담을 수 있으므로(규칙), 먼저 나간 사람은
 * 낼 것도 없고 받을 것도 없어진다. 여기서 그 경로들을 못 박는다.
 * (동작 자체는 `npm run sim:multi` 가 가짜 서버로 12판 넘게 재생하며 검사한다)
 */
{
  console.log('\n24) 둘 다 나가기 · 튕김 (2026-08-19)');
  const fs = await import('node:fs');
  const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
  const has = (label, src, needle) => eq(label, src.includes(needle), true);
  const mp = read('../src/services/multiplayer.js');
  const ms = read('../src/services/multiSettle.js');
  const mr = read('../src/services/matchRules.js');
  const gs = read('../src/game/GameScene.js');
  const res = read('../src/screens/multi/MultiResult.js');
  const wr = read('../src/screens/multi/WaitingRoom.js');

  // ① 판이 안 끝났으면 자리를 비우지 않는다 (순위에서 사라지면 정산이 통째로 증발한다)
  has('나가기 전에 판을 끝내 본다', mp, 'if (이번판참가자 && 판진행중)');
  has('못 끝내면 자리를 지킨다', mp, "if (!room.result?.rankings) return 'kept';");

  // ② 정산이 시작될 때마다 "끝낼 수 있는 판인지" 본다 — 접속만 해도 밀린 판이 풀린다
  has('정산이 판을 끝낸다', ms, 'Room.roundOverNow(r)');
  has('대기 중인 방은 끝난 판이 아니다', mp, "if (!room || room.state === 'waiting') return false;");
  has('대기 중인 방에는 순위를 못 박는다', mp, "if (room.state === 'waiting') return null;");

  // ③ 튕긴 사람 — 신호가 끊기면 판에서 빠진 것으로 본다
  has('생존 신호', mp, 'export async function heartbeat(code)');
  has('진행도에도 신호를 싣는다', mp, 'seenAt: fb.dbMod.serverTimestamp()');
  has('들어올 때부터 기준 시각이 있다', mp, 'function meRecord(profile, fb)');
  has('끊김 판정', mr, 'export function isStale(player, now)');
  has('종료 판정이 끊김을 본다', mr, 'return isStale(player, now);');
  eq('모르는 사람은 빼지 않는다 (seenAt 이 없으면 판정 안 함)',
    M.isStale({}, Date.now() + 10 ** 9), false);
  eq('신호가 살아 있으면 안 뺀다', M.isStale({ seenAt: Date.now() }, Date.now() + 1000), false);
  eq('오래 끊기면 뺀다',
    M.isStale({ seenAt: 0 + 1 }, 1 + MULTI.staleSeconds * 1000 + 1), true);

  // ④ 신호는 일시정지·부활 선택 중에도 간다 (그때는 계단이 안 바뀌어 쓰기가 없다)
  has('게임 화면이 주기적으로 보낸다', gs, 'MULTI.heartbeatMs');
  has('결과 화면도 보낸다', res, 'Room.heartbeat(code)');
  has('대기방도 보낸다', wr, 'Room.heartbeat(code)');
  has('방에 없으면 안 보낸다 (유령 노드 방지)', gs, 'if (!this.room?.players?.[this.multi.myUid]) return;');

  // ⑤ 다음 판 — 낡은 신호를 새로 찍고, 자리에 없는 사람은 데려가지 않는다
  has('되돌릴 때 신호를 새로 찍는다', mp, 'seenAt: fb.dbMod.serverTimestamp(),');
  has('자리에 없는 사람은 다음 판에 안 태운다', mp, 'if (!자리에있다(uid, v)) continue;');

  // ⑥ 나눠 낸 신발 — 켤레 수 도장(새) + 비트 도장(옛 클라이언트 보호)을 한 번에 쓴다
  has('켤레 수 도장', mp, 'export function claimedCounts(room, winnerUid)');
  has('옛 비트도 함께', mp, "[path('settled', fb.uid)]: mask | 0,");
  has('한 번의 쓰기로', mp, "[path('claims', fb.uid)]: counts,");

  // ⑦ 이미 끝난 판이면 화면도 즉시 끝낸다
  has('순위가 박히면 게임을 끝낸다', gs, "if (r.result?.rankings || r.state === 'finished') this.endMulti();");
}

// ── 25) 자리 색 · 레이스 게이지 · 부활 6회 (2026-08-19) ──
{
  console.log('\n25) 자리 색 · 레이스 게이지 (2026-08-19)');
  const fs = await import('node:fs');
  const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
  const has = (label, src, needle) => eq(label, src.includes(needle), true);
  const mh = read('../src/game/multiHud.js');
  const mp = read('../src/services/multiplayer.js');
  const wr = read('../src/screens/multi/WaitingRoom.js');
  const ov = read('../src/game/overlays.js');
  const pal = read('../src/game/palette.js');

  // ① 자리 번호 — 들어온 순서, 누가 계산해도 같아야 한다
  const 방 = { a: { joinedAt: 30 }, b: { joinedAt: 10 }, c: { joinedAt: 20 } };
  eq('먼저 들어온 사람이 1번', [M.slotIndex(방, 'b'), M.slotIndex(방, 'c'), M.slotIndex(방, 'a')], [0, 1, 2]);
  eq('같은 시각이면 uid 순(결정적)',
    M.slotIndex({ z: { joinedAt: 1 }, a: { joinedAt: 1 } }, 'a'), 0);
  eq('모르는 사람은 -1', M.slotIndex(방, 'zz'), -1);
  has('색은 빨강·노랑·파랑·초록 네 개', pal, "export const SLOT_COLORS = ['#E2413C', '#F2C23C', '#3D8FE0', '#3FB958']");
  has('대기방에 번호 상자', wr, "el('div.slot-box'");
  has('대기방도 같은 자리 계산을 쓴다', wr, 'slotIndex(room.players, p.uid)');

  // ② 인게임에는 아이디를 쓰지 않는다
  eq('이름표 함수가 없다', mh.includes('function nameTag'), false);
  eq('상대 이름을 그리지 않는다', mh.includes('o.nickname'), false);
  eq('상대 층수 글자도 없다', mh.includes('multiOpponentStat'), false);

  // ③ 레이스 게이지 — 나는 정중앙 고정, 한 칸 = 계단 10칸
  has('내 자리는 상수 (움직이지 않는다)', mh, 'cy: RACE_CY, alive: true, rank: rank[scene.multi?.myUid], isMe: true');
  has('눈금은 나와의 차이', mh, 'const 칸 = Math.round((floor - 나) / MULTI.raceStairsPerTick);');
  has('끝을 넘으면 붙는다', mh, 'Math.max(-MULTI.raceTicks, Math.min(MULTI.raceTicks, 칸))');
  eq('위아래 10칸', MULTI.raceTicks, 10);
  eq('한 칸 = 계단 5칸', MULTI.raceStairsPerTick, 5);

  // ④ 테두리 6칸 = 남은 부활
  eq('부활 상한 6회', MULTI.maxRevives, 6);
  has('남은 칸 = 상한 − 쓴 횟수', mh, 'const 남은칸 = Math.max(0, MULTI.maxRevives - revives);');
  has('칸 구분선', mh, 'const cut = PAL.textShadow;');

  // ⑤ 부활 창 10초, 걸 신발이 없으면 5초
  eq('부활 창 10초', MULTI.reviveWindowSeconds, 10);
  eq('못 걸면 5초', MULTI.reviveWindowShortSeconds, 5);
  has('지갑을 보고 창을 정한다', ov, 'const 창초 = 걸수있다 ? MULTI.reviveWindowSeconds : MULTI.reviveWindowShortSeconds;');

  // ⑥ 이긴 사람이 방장
  has('순위 1등을 방장으로', mp, 'hostUid: ranked[0] ?? room.hostUid,');

  // ⑦ 끝나면 화면부터 넘긴다 (결과 확정을 기다리지 않는다)
  const sm = read('../src/screens/startMultiGame.js');
  eq('결과 확정을 기다리지 않는다', sm.includes('await Room.finalizeResult'), false);
  has('화면을 먼저 바꾼다', sm, 'nav.reset(MultiResult, { code, result });\n      Room.finalizeResult(code)');
  const mres = read('../src/screens/multi/MultiResult.js');
  has('방을 못 읽어도 화면은 뜬다', mres, 'const 안전망 = setTimeout(');
}

// ── 26) 결과 화면 강제 · 1:1 즉시 종료 · 1등 표시 (2026-08-19) ──
{
  console.log('\n26) 결과 화면 · 1:1 · 1등 표시 (2026-08-19)');
  const fs = await import('node:fs');
  const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
  const has = (label, src, needle) => eq(label, src.includes(needle), true);
  const mh = read('../src/game/multiHud.js');
  const mres = read('../src/screens/multi/MultiResult.js');
  const sm = read('../src/screens/startMultiGame.js');
  const gs = read('../src/game/GameScene.js');

  // ① 판이 끝나면 무조건 결과 화면 — 인게임 '나가기'도 로비로 못 간다
  has('끝나면 결과 화면으로', sm, 'nav.reset(MultiResult, { code, result })');
  eq('인게임에서 로비로 직행하는 길이 없다', gs.includes('Lobby'), false);
  eq('결과 화면에 로비 버튼은 하나뿐',
    (mres.match(/nav\.reset\(Lobby\)/g) ?? []).length, 3);   // 로딩·대기·결과 각 화면의 '나가기'
  has('나가기 문구', mres, 'S.leaveToLobby');
  eq('한 판 더 버튼은 없앴다', mres.includes('S.playAgain'), false);

  // ② 1:1 은 한 명이 빠지면 즉시 끝난다 (부활을 안 하면 그 자리에서 패배)
  eq('1:1 한 명 빠지면 종료',
    M.roundOver({ players: { a: { alive: false, out: true }, b: { alive: true } } }, 1), true);
  eq('부활 창 동안은 아직',
    M.roundOver({ players: { a: { alive: false, deadAt: 1000 }, b: { alive: true } } }, 1500), false);
  eq('셋이면 한 명 빠져도 계속',
    M.roundOver({ players: { a: { alive: false, out: true }, b: { alive: true }, c: { alive: true } } }, 1), false);

  /**
   * ③ **계단이 높은 사람이 이긴다** (2026-08-19 재확정).
   * 기권했든 튕겼든 상관없다 — 사용자가 두 번 못 박은 규칙이다.
   * 생존은 **동점일 때만** 본다.
   */
  eq('기권해도 계단이 높으면 이긴다', M.rankPlayers([
    { uid: 'a', stairs: 90, alive: false, out: true },
    { uid: 'b', stairs: 12, alive: true },
  ], 1), ['a', 'b']);
  eq('튕겨도 계단이 높으면 이긴다', M.rankPlayers([
    { uid: 'a', stairs: 70, alive: true, seenAt: 1000 },
    { uid: 'b', stairs: 90, alive: true, seenAt: 1000 - MULTI.staleSeconds * 1000 - 1 },
  ], 1000), ['b', 'a']);
  eq('동점이면 판에 남아 있던 쪽', M.rankPlayers([
    { uid: 'a', stairs: 40, alive: false, out: true },
    { uid: 'b', stairs: 40, alive: true },
  ], 1), ['b', 'a']);

  // ④ 1등이면 승리 문구가 반드시 뜬다 (정산이 늦어도)
  has('순위로 승패를 판단한다', mres, "rankings.length ? rankings[0] === myUid : undefined");
  has('가져온 신발은 항아리 전체', mres, 'S.wonPotShoes(potShoes(room))');

  // ⑤ 게이지 — 죽은 사람은 회색 + 카운트다운, 남은 사람은 검은 테두리
  has('죽으면 회색', mh, 'if (!alive) fadeRect(');
  has('남은 초 계산', mh, 'function reviveLeft(p, now)');
  has('상대 상자에 검은 테두리', mh, 'if (!isMe) {');
  has('등수는 얼굴을 다 그린 뒤', mh, 'for (const t of tags) drawRankTag(');
  has('1등 왕관', mh, 'function crown(x, y)');
  has('1등만 흰색', mh, "color: '#FFFFFF'");

  // ⑥ 1등 말풍선 — **2026-08-19 삭제됐다** (사용자 요청, "흰 말풍선 없애").
  //    남기는 검사는 "확실히 없다"뿐이다 — 지웠다가 리팩터로 슬쩍 되돌아오는 걸 잡는다.
  eq('말풍선 그리기 함수가 없다', mh.includes('function drawFirstBubble'), false);
  eq('말풍선 에셋을 안 받는다', mh.includes("url: '/assets/ui/bubble_first.png'"), false);
}

// ── 27) 폰트 (2026-08-19, 되돌림) ──
/**
 * Neo둥근모 16px 한 벌로 바꿨다가 **인게임만 갈무리로 되돌렸다** — 또렷하긴 한데
 * 도트 게임의 아기자기함이 사라졌다는 판단. 로비 등 DOM 화면은 Neo둥근모를 유지한다.
 * 되돌린 상태가 다시 흔들리지 않게 양쪽을 못 박는다.
 */
{
  console.log('\n27) 폰트 — 인게임 갈무리 / DOM Neo둥근모');
  const fs = await import('node:fs');
  const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
  const has = (label, src, needle) => eq(label, src.includes(needle), true);
  const F = JSON.parse(read('../src/data/font.generated.json'));
  const F7 = JSON.parse(read('../src/data/font7.generated.json'));
  const S = (await import('../src/config/strings.ko.js')).default;
  const mh = read('../src/game/multiHud.js');
  const css = read('../src/styles/reset.css');

  eq('인게임 큰 폰트는 갈무리11', [F.h, F.source.includes('Galmuri11')], [11, true]);
  eq('인게임 작은 폰트는 갈무리7 + 상용한글', [F7.h, Object.keys(F7.glyphs).length > 2000], [7, true]);
  has('작은 폰트를 멀티에서 받는다', mh, 'if (!smallReady()) loadSmallFont();');
  has('판돈·알림은 작은 폰트', mh, 'small: true');
  has('DOM 화면은 Neo둥근모', css, "font-family: 'Neo둥근모'");

  /** 7px 폰트 기준 글자 폭 — 인게임 한 줄(180)에 들어가는지 */
  const width7 = (t) =>
    [...String(t).toUpperCase()].reduce((a, c) => a + ((F7.glyphs[c]?.w ?? F7.glyphs['?'].w) + F7.tracking), 0);
  for (const [name, t] of [
    ['판돈', S.potLine(484)],
    ['부활 알림', S.someoneRevived(S.slotColorShort[1])],  // 실제 호출: 짧은 색 이름 (2026-08-19)
    ['낙사 알림', S.someoneFell('빨강색')],
    ['포기 알림', S.someoneOut('초록색')],
  ]) {
    const w = width7(t);
    eq(`${name} 한 줄에 들어간다 (${w}px)`, w <= 180, true);
  }
}

// ── 28) 결과 화면 · 로비 · 게이지 개편 (2026-08-19) ──
{
  console.log('\n28) 결과 화면 · 로비 · 게이지 (2026-08-19)');
  const fs = await import('node:fs');
  const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
  const has = (label, src, needle) => eq(label, src.includes(needle), true);
  const S = (await import('../src/config/strings.ko.js')).default;
  const mres = read('../src/screens/multi/MultiResult.js');
  const menu = read('../src/screens/multi/MultiMenu.js');
  const lobby = read('../src/screens/Lobby.js');
  const css = read('../src/styles/screens.css');
  const mh = read('../src/game/multiHud.js');
  const ov = read('../src/game/overlays.js');
  const ui = read('../src/screens/ui.js');

  // ① 결과 화면 — 등수 · 부활 테두리 · 버튼
  has('순위는 1등·2등으로', mres, 'label ?? S.rankTag(i + 1)');
  has('얼굴에 자리 색 테두리', mres, "el('div.face-frame'");
  has('테두리는 6칸', mres, 'Array.from({ length: MULTI.maxRevives }');
  has('6칸 CSS', css, '.rev-seg.s5');
  eq('한 판 더 버튼 없음', mres.includes('S.playAgain'), false);
  eq('계속하기 문구', S.stayInRoom, '계속하기');
  has('CSS 변수를 el() 이 넣어 준다', ui, "ck.startsWith('--')");

  // ② 승리 / 패배 연출
  for (const [k, v] of [['승리 큰 글씨', S.winBig], ['승리 부제', S.winSub], ['패배 큰 글씨', S.loseBig]]) {
    eq(`${k} 있음`, typeof v === 'string' && v.length > 0, true);
  }
  has('승리 깃발', mres, "src: '/assets/ui/victory_flag.png'");
  eq('깃발 파일', fs.existsSync(new URL('../public/assets/ui/victory_flag.png', import.meta.url)), true);
  has('가져온 신발만 강조', mres, "el('span.pot-num'");
  has('패배 팁', mres, 'S.tipBody2');
  eq('잃은 신발 문구는 뺏겼습니다 로', S.loseTaken(3), '내 소중한 신발 3켤레를 뺏겼습니다');

  // ③ 멀티 메뉴 순서 — 방 입장 → 방 목록 → 비밀방 만들기 → 비밀방 입장
  const order = ['S.joinRoom', 'S.roomListTitle', 'S.createPrivateRoom', 'S.enterByCode']
    .map((k) => menu.indexOf(k));
  eq('메뉴 순서', order.every((v, i, a) => v > 0 && (i === 0 || v > a[i - 1])), true);
  eq('비밀방 입장 문구', S.enterByCode, '비밀방 입장');

  // ④ 로비 — 캐릭터 이름 · 멀티 전적
  has('캐릭터 칸에 이름', lobby, "el('div.char-name', ch.ko)");
  has('멀티 전적 줄', lobby, 'S.myMultiRecord(');
  eq('플레이어 이름 줄 삭제', lobby.includes('S.playerName'), false);
  has('캐릭터 칸 폭 73px (이전 56 대비 +30%)', css, 'width: 73px;');

  // ⑤ 게이지 — 한 칸 5계단, 내 얼굴도 받는다
  eq('한 칸 = 5계단', MULTI.raceStairsPerTick, 5);
  has('내 얼굴도 미리 받는다', mh, 'if (myCharId && !requested.has(myCharId))');
  has('1등과의 거리 줄', mh, 'function drawGapLine(scene)');
  eq('1등이면 유지중 (2026-08-19 문구 변경)', S.keepingFirst, '현재 1등 유지중!');
  eq('1등과의 거리 문구 (2026-08-19 문구 변경)', S.gapFromFirst(7), '1등까지 7계단 남음');

  // ⑥ 말풍선은 삭제됐다 — 위 26번 그룹에서 "없다"를 이미 확인한다. 여기서는 중복 확인 안 함.

  // ⑦ 문구
  eq('부활 버튼 1줄', S.reviveWith1(20), '신발 20개 써서');
  eq('부활 버튼 2줄', S.reviveWith2(), '1위로 부활');
  eq('사망 화면 상금', S.potWin(30), '승리시 신발 30켤레 !');
  eq('사망 화면 내 지갑', S.myShoes(4), '나의 남은 신발 4켤레');
  has('사망 화면이 상금을 크게', ov, 'S.potWin(potShoes(this.game.room))');
}

// ── 29) 2026-08-19 배치 — 부활 알림 문구 · 죽은 등수 · 부활 원가 · 신발 이름 · 판중 습득 정산 ──
{
  console.log('\n29) 부활 알림 · 죽은 등수 회색 · 부활 30개 · 130종 이름 · 판중 습득 정산');
  const fs = await import('node:fs');
  const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
  const has = (label, src, needle) => eq(label, src.includes(needle), true);
  const S = (await import('../src/config/strings.ko.js')).default;
  const { REVIVE } = await import('../src/config/balance.js');
  const mh = read('../src/game/multiHud.js');
  const gs = read('../src/game/GameScene.js');
  const shoesData = JSON.parse(read('../src/data/shoes.json'));
  const ms = read('../src/services/multiSettle.js');

  // ① 부활 알림 — 색 이름만 짧게, "이" 조사와 "!" 를 뗐다
  eq('노랑 부활', S.someoneRevived(S.slotColorShort[1]), '노랑, 1등 부활');
  eq('빨강 부활', S.someoneRevived(S.slotColorShort[0]), '빨강, 1등 부활');
  eq('파랑 부활', S.someoneRevived(S.slotColorShort[2]), '파랑, 1등 부활');
  eq('초록 부활', S.someoneRevived(S.slotColorShort[3]), '초록, 1등 부활');
  has('GameScene 은 짧은 색으로 알린다', gs, 'S.someoneRevived(colorShort)');

  // ② 죽어서 카운트다운 중이면 등수 글자도 회색 + 작게
  has('죽으면 등수도 dead 플래그를 받는다', mh, 'dead: countdown != null');
  has('dead 면 회색 + 7px', mh, "color: PAL.deadGray, outline: PAL.textShadow, align, small: true");
  has('죽으면 1등 왕관 서식도 포기한다', mh, '일등 = rank === 1 && !dead');

  // ③ 싱글 부활 원가 50 → 30
  eq('부활 30개', REVIVE.shoesPerRevive, 30);

  // ④ 130종 이름 — "스페셜 01" 류를 전부 사용자 지정 이름으로 교체
  eq('130개 전부', shoesData.shoes.length, 130);
  eq('옛 이름 잔재 없음', shoesData.shoes.some((s) => /^(스페셜|레어|트라이|투톤|베이식) \d/.test(s.name)), false);
  eq('중복 이름 없음', new Set(shoesData.shoes.map((s) => s.name)).size, 130);
  eq('1티어 첫 신발 = 스피카', shoesData.shoes.find((s) => s.index === 0).name, '스피카');

  // ⑤ 판 도중 습득한 신발도 1등이 가져간다 (승자 자신의 몫은 제외)
  has('정산이 상대가 주운 개수를 센다', ms, 'foundShoesTotal(r, u.uid)');
  has('개수만큼 새로 굴린다', ms, 'rollFoundShoe()');
  has('판돈 도장과 같은 회차에서만 한 번', ms, 'if (!L.isSettled(payTag(code))) {');
}

{
  console.log('\n30) 계단이 조작 버튼 틈에서 사라지던 버그 · PWA 바로가기 버튼 (2026-08-19)');
  const { STAIR, CHAR, CONTROLS } = await import('../src/config/layout.js');
  const fs = await import('node:fs');
  const has = (label, src, needle) => eq(label, src.includes(needle), true);

  // ① drawBelow=2 였을 때는 마지막 계단 바닥(sy=265)이 버튼 윗변(y266)과 맞아
  //    버튼 사이 틈(x54~126)이 항상 비어 보였다. 버튼 영역을 실제로 덮는지 계산으로 확인한다.
  const rows = [];
  for (let k = STAIR.drawAbove; k >= -STAIR.drawBelow; k--) {
    const sy = CHAR.footY - k * STAIR.gapY;
    if (sy < -STAIR.h - 40 || sy > 340) continue;
    rows.push({ sy, bottom: sy + STAIR.h });
  }
  const coversButtonBand = rows.some(
    (r) => r.sy <= CONTROLS.left.y + CONTROLS.left.h && r.bottom >= CONTROLS.left.y
  );
  eq('버튼 틈(y266~314)까지 계단이 그려진다', coversButtonBand, true);
  eq('drawBelow 가 충분히 늘었다', STAIR.drawBelow >= 6, true);

  // ② PWA 바로가기 버튼 — 포털(로그아웃) 화면 위에, 설치/iOS안내/PC북마크 세 경로 모두 처리
  const portal = fs.readFileSync('src/screens/Portal.js', 'utf8');
  has('포털에 앱 바로가기 버튼', portal, 'S.installShortcut, onInstall');
  has('설치 불가 브라우저는 북마크 안내로', portal, "installBookmarkGuide");
  const idxInstall = portal.indexOf('S.installShortcut');
  const idxLogout = portal.indexOf('S.logout, onLogout');
  eq('바로가기 버튼이 로그아웃 위에 있다', idxInstall > 0 && idxInstall < idxLogout, true);

  // ③ ESC/게임패드 리매핑 — Y/B = X/A, RB·RT = left, LB·LT = right, 메뉴버튼 = ESC
  const input = fs.readFileSync('src/core/input.js', 'utf8');
  has('ESC 키가 일시정지', input, "['Escape', 'KeyP', 'Enter']");
  has('Y(3) 도 left', input, 'on(2) || on(3)');
  has('RB/R1(5)·RT/R2(7) 도 left', input, 'on(5) || on(7)');
  has('B(1) 도 right', input, 'on(0) || on(1)');
  has('LB/L1(4)·LT/L2(6) 도 right', input, 'on(4) || on(6)');
  has('메뉴/뷰 버튼이 곧 ESC(pause)', input, 'on(9) || on(8)');
  has('DOM 화면에서는 pauseHandler 대신 domBackHandler', input, 'else domBackHandler?.()');

  // ④ ESC/게임패드 메뉴가 도감 등 DOM 화면에서 뒤로가기/팝업닫기로 동작 (§7)
  const router = fs.readFileSync('src/screens/router.js', 'utf8');
  has('팝업부터 닫고 없으면 뒤로가기로 통일', router, 'function backOrCloseOverlay()');
  has('ESC 바인딩 존재', router, 'export function bindEscBack()');
  has('게임 중에는 ui-mode 가 아니므로 건너뛴다', router, "classList.contains('ui-mode')");
  has('게임패드 메뉴 → domBackHandler 등록', router, 'setDomBackHandler(backOrCloseOverlay)');
  const mainJs = fs.readFileSync('src/main.js', 'utf8');
  has('main.js 가 ESC 바인딩을 켠다', mainJs, 'bindEscBack()');

  // ⑤ [조작법 변경] → [설정], 안에 조작법 변경 + 음향 설정(BGM/SFX on/off) (§4)
  const lobby = fs.readFileSync('src/screens/Lobby.js', 'utf8');
  has('로비 메뉴가 설정으로 바뀌었다', lobby, 'S.menuSettings, () => nav.push(Settings)');
  const settingsScreen = fs.readFileSync('src/screens/Settings.js', 'utf8');
  has('설정 화면 안에 조작법 변경이 남아 있다', settingsScreen, 'S.menuControls, () => nav.push(Controls)');
  // 음향 토글은 2026-08-19 3차에서 [사운드 설정] 하위 화면으로 옮겼다 (사용자 요청)
  const soundScreen = fs.readFileSync('src/screens/SoundSettings.js', 'utf8');
  has('사운드 화면이 BGM on/off', soundScreen, "Audio.setEnabled('bgm', v)");
  has('사운드 화면이 SFX on/off', soundScreen, "Audio.setEnabled('sfx', v)");

  // ⑥ 로비/메뉴 화면 타이틀 폰트 2단계(+4px) 확대 (§9) — title() 헬퍼 하나로 전체 화면에 적용
  const css = fs.readFileSync('src/styles/screens.css', 'utf8');
  const m = /\.screen-title\s*\{[^}]*font-size:\s*(\d+)px/.exec(css);
  eq('타이틀 폰트 20px → 24px', m && Number(m[1]), 24);

  // ⑦ 대기방 참가자 카드 — 보유신발 배지 + 클릭 시 승률 팝업 (§11)
  const mp = fs.readFileSync('src/services/multiplayer.js', 'utf8');
  has('meRecord 가 보유신발/승패를 스냅샷으로 담는다', mp, 'shoesOwned: profile.shoesOwned ?? 0');
  has('meRecord 가 승수를 담는다', mp, 'multiWins: profile.multiWins ?? 0');
  has('meRecord 가 패수를 담는다', mp, 'multiLosses: profile.multiLosses ?? 0');
  has('resetRoom 이 다음 판에도 스냅샷을 옮긴다', mp, 'shoesOwned: v.shoesOwned ?? 0');
  const wr = fs.readFileSync('src/screens/multi/WaitingRoom.js', 'utf8');
  has('대기방에 보유신발 배지', wr, 'S.playerShoesOwned(p.shoesOwned ?? 0)');
  has('이름을 누르면 팝업', wr, 'onclick: () => playerStatPopup(p, slot)');
  has('팝업이 승률/게임수/보유신발을 보여준다', wr, 'S.playerStatPopup(p.multiWins ?? 0, games, p.shoesOwned ?? 0)');
}

{
  console.log('\n31) 배포가 죽던 원인 · 층 배경 9종 · 버튼 폰트 · 방 목록 보유신발 (2026-08-19 2차)');
  const fs = await import('node:fs');
  const has = (label, src, needle) => eq(label, src.includes(needle), true);
  const { FLOOR_EVENTS } = await import('../src/config/balance.js');

  /**
   * ★ **배포가 조용히 죽던 진짜 원인.** `npm run build` 체인의 `build-bubble.mjs` 가
   * `etc/` 를 읽는데 `etc/` 는 .gitignore 대상이라 Vercel 에 없다 → sharp 예외 →
   * 빌드 종료코드 1. 커밋·푸시는 멀쩡한데 **배포만 안 되어서** 고친 게 하나도 반영이
   * 안 된 것처럼 보였다. 원본이 없으면 커밋된 산출물을 쓰고 넘어가야 한다.
   */
  const bubble = fs.readFileSync('tools/build-bubble.mjs', 'utf8');
  has('빌드 스크립트가 원본 없음을 견딘다', bubble, 'if (!existsSync(src))');
  has('산출물이 있으면 그대로 쓴다', bubble, 'existsSync(out)');
  eq('원본 없다고 곧장 죽지 않는다', /^\s*await sharp\(src\)/m.test(bubble.split('if (!existsSync(src))')[0]), false);
  // build 체인이 etc/ 를 읽는 스크립트는 반드시 이 가드를 갖는다
  const buildChain = JSON.parse(fs.readFileSync('package.json', 'utf8')).scripts.build;
  for (const m of buildChain.matchAll(/npm run (assets:\w+)/g)) {
    const script = JSON.parse(fs.readFileSync('package.json', 'utf8')).scripts[m[1]] ?? '';
    for (const f of script.matchAll(/tools\/([\w-]+\.mjs)/g)) {
      const src = fs.readFileSync(`tools/${f[1]}`, 'utf8');
      if (!src.includes('etc/')) continue;          // etc/ 를 안 읽으면 해당 없음
      eq(`${f[1]} — etc/ 없이도 견딘다`, src.includes('existsSync'), true);
    }
  }

  // ② 층 배경 200~1000 (9종) — 표는 내림차순이어야 한다
  eq('층 배경 9종', FLOOR_EVENTS.bgSwap.length, 9);
  eq('내림차순 (아니면 200층 배경이 1000층까지 나온다)',
    FLOOR_EVENTS.bgSwap.every((e, i, a) => i === 0 || a[i - 1].from > e.from), true);
  eq('1000층까지', FLOOR_EVENTS.bgSwap[0].from, 1000);
  for (const e of FLOOR_EVENTS.bgSwap) {
    eq(`${e.key}.png 존재`, fs.existsSync(`public/assets/bg/${e.key}.png`), true);
  }
  const floorTool = fs.readFileSync('tools/build-floor-bg.mjs', 'utf8');
  has('만들 목록을 밸런스 표에서 읽는다 (숫자 이중 관리 금지)', floorTool, 'FLOOR_EVENTS.bgSwap.map');
  has('이미 도트인 그림은 재양자화하지 않는다', floorTool, 'colors <= COLORS && sized');

  // ③ 로비 메뉴 버튼도 2단계 키웠다 — 사용자가 든 예시가 전부 버튼 라벨이었다
  const css = fs.readFileSync('src/styles/screens.css', 'utf8');
  const btn = /\.pbtn\s*\{[\s\S]*?font-size:\s*(\d+)px/.exec(css);
  eq('버튼 폰트 15px → 19px', btn && Number(btn[1]), 19);
  const seg = /\.seg \.pbtn\s*\{[^}]*font-size:\s*(\d+)px/.exec(css);
  eq('난이도 선택은 15px 유지 (셋이 한 줄이라 접힌다)', seg && Number(seg[1]), 15);

  // ④ 방 목록에도 방장 보유신발
  const mp = fs.readFileSync('src/services/multiplayer.js', 'utf8');
  has('listRooms 가 방장 보유신발을 싣는다', mp, 'hostShoes:');
  const rl = fs.readFileSync('src/screens/multi/RoomList.js', 'utf8');
  has('방 목록에 보유신발 배지', rl, 'S.playerShoesOwned(r.hostShoes ?? 0)');

  // ⑤ 말풍선은 문자열까지 완전히 제거 (폰트에 헛글자를 굽지 않게)
  const st = fs.readFileSync('src/config/strings.ko.js', 'utf8');
  eq('말풍선 문자열 잔재 없음', st.includes('1등이닷'), false);
}

{
  console.log('\n32) 13건 배치 — 문구·설치안내·명예의전당 sticky·입장속도·표·렌더순서·깃발 (2026-08-19 3차)');
  const fs = await import('node:fs');
  const has = (label, src, needle) => eq(label, src.includes(needle), true);
  const no = (label, src, needle) => eq(label, src.includes(needle), false);
  const st = fs.readFileSync('src/config/strings.ko.js', 'utf8');
  const css = fs.readFileSync('src/styles/screens.css', 'utf8');

  // ① 문구
  has('로비 승률 문구', st, 'myMultiRecord: (wins, games) => `멀티게임 ${wins}승 / ${games}게임`');
  has('캐릭터 변경', st, "menuCharacter: '캐릭터 변경'");
  has('멀티 안내 문구', st, "multiBetHint: '멀티 게임을 위해서는, 신발 1켤레가 필요합니다'");
  has('비밀방 생성', st, "createPrivateRoom: '비밀방 생성'");
  has('사운드 설정 메뉴명', st, "menuSound: '사운드 설정'");

  // ② 모바일 설치 안내 — 안드로이드에 Ctrl+D 가 나가면 안 된다
  const pwa = fs.readFileSync('src/services/pwa.js', 'utf8');
  has('안드로이드 판별', pwa, 'export const isAndroid');
  has('모바일 판별', pwa, 'export const isMobile');
  has('프롬프트 없으면 플랫폼별로 갈린다', pwa, "isIos() ? 'ios' : isMobile() ? 'android' : 'unavailable'");
  const portal = fs.readFileSync('src/screens/Portal.js', 'utf8');
  has('포털이 안드로이드 안내를 쓴다', portal, "r === 'android'");
  has('안드로이드 안내 문구', st, 'installAndroidGuide');

  /**
   * ③ ★ 명예의 전당 11위 겹침 — 원인은 **중복 정의된 옛 `.rank-row.me` 의
   * `position: sticky`** 였다. 뒤 규칙이 색만 덮고 position 은 안 덮어서 살아남았다.
   * 같은 클래스를 쓰는 멀티 결과 화면도 같이 앓았다.
   */
  /**
   * 주석을 걷어내고 본다 — 이 파일에는 **고친 내력을 적은 주석**에 `position: sticky` 와
   * `.rank-row.me {` 가 그대로 인용돼 있다. 원문 그대로 훑으면 그 설명글이 걸려서
   * "아직 안 고쳐졌다"는 거짓 실패가 난다(처음에 실제로 그랬다).
   */
  const cssCode = css.replace(/\/\*[\s\S]*?\*\//g, '');
  no('내 순위 줄에 sticky 가 없다', cssCode, 'position: sticky');
  eq('.rank-row.me 정의는 하나뿐', (cssCode.match(/\.rank-row\.me\s*\{/g) ?? []).length, 1);
  eq('.rank-row 정의는 하나뿐', (cssCode.match(/^\.rank-row\s*\{/gm) ?? []).length, 1);

  // ④ 방 입장 속도 — 왕복·대기 줄이기
  const mp = fs.readFileSync('src/services/multiplayer.js', 'utf8');
  has('스캔한 방을 재사용해 왕복을 줄인다', mp, 'export async function joinRoom(code, known)');
  has('후보마다 스캔값을 넘긴다', mp, 'joinRoom(r.code, r)');
  has('연결이 따뜻하면 재스캔 대기를 건너뛴다', mp, 'Date.now() - connectedAt < CONNECTION_WARM_MS');
  eq('동시생성 확인 대기 단축', /RETRY_SCAN_MS = (\d+)/.exec(mp)?.[1], '700');
  const lobby = fs.readFileSync('src/screens/Lobby.js', 'utf8');
  has('로비에서 미리 붙인다', lobby, 'prewarmMultiIfReturning()');
  has('싱글만 하는 사람에겐 안 붙인다 (192KB 회귀 방지)', lobby, 'if (!everPlayedMulti()) return;');

  // ⑤ 대기방 표 + 캐릭터 카드
  has('참가자 목록이 grid 표', css, 'grid-template-columns: 22px 24px 5.2em auto minmax(0, 1fr) auto;');
  has('태그 전용 칸', css, '.player-tags');
  has('남는 폭을 먹는 완충 칸', css, '.player-gap');
  const wr = fs.readFileSync('src/screens/multi/WaitingRoom.js', 'utf8');
  has('태그를 한 칸에 묶었다', wr, "el('div.player-tags'");
  has('카드에 캐릭터 그림', wr, 'player-card-face');

  // ⑥ 렌더 순서 — 고스트가 내 캐릭터 뒤로
  const gs = fs.readFileSync('src/game/GameScene.js', 'utf8');
  const iGhost = gs.indexOf('multiGhosts(this)');
  const iPlayer = gs.indexOf('this.player.render(');
  const iHud = gs.indexOf('multiHud(this)');
  eq('고스트 → 내 캐릭터 → HUD 순서', iGhost > 0 && iGhost < iPlayer && iPlayer < iHud, true);
  const mh = fs.readFileSync('src/game/multiHud.js', 'utf8');
  has('고스트가 별도 진입점으로 분리됐다', mh, 'export function multiGhosts');
  // multiHud **함수 본문만** 잘라서 본다 — 파일 뒤쪽의 `function drawGhosts` 정의가
  // 같이 걸리면 거짓 실패가 난다
  const hudBody = /export function multiHud\(scene\) \{([\s\S]*?)\n\}/.exec(mh)?.[1] ?? '';
  eq('multiHud 본문을 찾았다', hudBody.length > 0, true);
  no('multiHud 는 더 이상 고스트를 안 그린다', hudBody, 'drawGhosts');
  has('multiGhosts 가 고스트를 그린다', /export function multiGhosts\(scene\) \{([\s\S]*?)\n\}/.exec(mh)?.[1] ?? '', 'drawGhosts');

  // ⑦ 게이지 겹침 최대 2
  has('겹침 상한 상수', mh, 'const MAX_STACK = 2');
  has('상한을 넘으면 안 그린다', mh, 'if (dx === null) continue;');

  // ⑧ 패배 깃발 — 승리와 같은 규격
  eq('패배 깃발 파일', fs.existsSync('public/assets/ui/defeat_flag.png'), true);
  const mr = fs.readFileSync('src/screens/multi/MultiResult.js', 'utf8');
  has('패배 화면에 깃발', mr, 'defeat_flag.png');
  has('승리창과 짝을 이루는 줄', mr, 'S.loseSub');
  for (const k of ['.defeat-flag', '.defeat-lost']) has(`${k} 스타일`, css, k);
  const bubble = fs.readFileSync('tools/build-bubble.mjs', 'utf8');
  has('두 깃발을 같은 규격으로 굽는다', bubble, "label: '패배 깃발'");

  // ⑨ 설정 하위 구조 + 싱글 배경
  const settings = fs.readFileSync('src/screens/Settings.js', 'utf8');
  for (const m of ['S.menuControls', 'S.menuSound', 'S.menuSingleBg']) has(`설정에 ${m}`, settings, m);
  const bg = fs.readFileSync('src/screens/BgSettings.js', 'utf8');
  has('배경 16종 + 랜덤', bg, 'BUILDINGS.map');
  has('멀티에는 적용 안 함(주석으로 못 박음)', bg, '멀티는');
  has('싱글에서만 강제 배경', gs, '!this.multi && this.forcedBuilding');
  has('startGame 이 설정을 전달', fs.readFileSync('src/screens/startGame.js', 'utf8'), 'buildingId: p.singleBg');

  // ⑩ 숫자패드 엔터 — 기호는 숫자보다 커야 엔터처럼 보인다
  has('엔터/지우기 전용 클래스', fs.readFileSync('src/screens/multi/CodeInput.js', 'utf8'), 'key-enter');
  has('기호 키를 키웠다', css, '.keypad .key-enter');
}

console.log(fails ? `\n실패 ${fails}건` : '\n멀티 정산 로직 이상 없음');
process.exit(fails ? 1 : 0);
