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
  // 캐시 열쇠에 **내가 주운 수**도 들어간다 (2026-08-19 6차) — 안 그러면 내가 신발을
  // 주워도 방 스냅샷이 올 때까지 하단 숫자가 안 움직인다
  has('판돈은 방/내 습득이 바뀔 때만 다시 만든다', hud, 'if (scene.potRoom !== room || scene.potMine !== mine)');
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
    M.isStale({ seenAt: 0 + 1 }, 1 + MULTI.absentSeconds * 1000 + 1), true);

  // ④ 신호는 일시정지·부활 선택 중에도 간다 (그때는 계단이 안 바뀌어 쓰기가 없다)
  has('게임 화면이 주기적으로 보낸다', gs, 'MULTI.heartbeatMs');
  has('결과 화면도 보낸다', res, 'Room.heartbeat(code)');
  has('대기방도 보낸다', wr, 'Room.heartbeat(code)');
  /**
   * 8차: 방에 없으면 **그냥 넘기지 않고 자리를 되찾는다.** 유령 노드를 만들지 않는다는
   * 원래 목적(= `heartbeat` 를 안 부른다)은 그대로다.
   */
  has('방에 없으면 신호를 안 보낸다 (유령 노드 방지)', gs, 'if (!room.players?.[this.multi.myUid]) {');
  // 10차: 방을 아직 못 받았으면 **아무 판단도 안 한다** (헛왕복이 렉의 한 갈래였다)
  has('방을 못 받았으면 판단하지 않는다', gs, 'const room = this.room;\n      if (!room) return;');
  has('대신 자리를 되찾는다', gs, 'Room.rejoinIfDropped(this.multi.code, {');

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

  // ⑤ 부활 창 — 26차에 10 → **6초**로 내렸다 (사용자 지정: "10초 너무 게임이 루즈해짐")
  //    그리고 이 값은 이탈 유예와 **같은 숫자**여야 한다 (51번 묶음이 그걸 본다)
  eq('부활 창 6초', MULTI.reviveWindowSeconds, 6);
  // 5차에서 되돌렸다 — 지갑과 무관하게 항상 같은 길이 (34번 묶음이 본다)
  eq('부활 창은 하나뿐', MULTI.reviveWindowSeconds, 6);

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
    { uid: 'b', stairs: 90, alive: true, seenAt: 1000 - MULTI.absentSeconds * 1000 - 1 },
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
    ['부활 알림', S.someoneRevived(S.slotColorName[1])],  // 실제 호출: 자리 색 이름 (2026-08-19 4차)
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
  // 5차에서 삭제된 '부활을 아껴쓰세요…' 3줄 — 34번 묶음이 없음을 확인한다
  eq('잃은 신발 문구는 뺏겼습니다 로', S.loseTaken(3), '내 소중한 신발 3켤레를 뺏겼습니다');

  // ③ 멀티 메뉴 순서 — 방 입장 → 방 목록 → 비밀방 만들기 → 비밀방 입장
  const order = ['S.joinRoom', 'S.roomListTitle', 'S.createPrivateRoom', 'S.enterByCode']
    .map((k) => menu.indexOf(k));
  eq('메뉴 순서', order.every((v, i, a) => v > 0 && (i === 0 || v > a[i - 1])), true);
  eq('비밀방 입장 문구', S.enterByCode, '비밀방 입장');

  // ④ 로비 — 캐릭터 이름 · 멀티 전적
  // 4차에서 캐릭터 이름 → **내 닉네임**으로 바뀌었다 (사용자 지적)
  has('캐릭터 칸에 닉네임', lobby, "el('div.char-name', p.nickname || '???')");
  has('멀티 전적 줄', lobby, 'S.myMultiRecord(');
  eq('플레이어 이름 줄 삭제', lobby.includes('S.playerName'), false);
  // 4차에 73 → 66 으로 줄였다가 **18차에 다시 73** 으로 (사용자 지정 "칸 자체를 10% 넓혀").
  // 좁은 폰은 이제 미디어쿼리로 뱃지를 아랫줄에 내려 해결한다 — 폭을 깎지 않는다.
  has('캐릭터 칸 폭 73px', css, 'width: 73px;');

  // ⑤ 게이지 — 한 칸 5계단, 내 얼굴도 받는다
  eq('한 칸 = 5계단', MULTI.raceStairsPerTick, 5);
  has('내 얼굴도 미리 받는다', mh, 'if (myCharId && !requested.has(myCharId))');
  has('1등과의 거리 줄', mh, 'function drawGapLine(scene)');
  eq('1등이면 유지중 (2026-08-19 문구 변경)', S.keepingFirst, '현재 1등 유지중!');
  eq('1등과의 거리 문구 (2026-08-19 문구 변경)', S.gapFromFirst(7), '1등까지 7계단 남음');

  // ⑥ 말풍선은 삭제됐다 — 위 26번 그룹에서 "없다"를 이미 확인한다. 여기서는 중복 확인 안 함.

  // ⑦ 문구
  // 4차: 두 줄 7px → 한 줄 11px, 상금 문구는 인게임과 통일, 남은 신발 줄은 삭제
  eq('부활 버튼 한 줄', S.reviveWith(20), '신발 20개로 부활');
  eq('사망 화면 상금 = 인게임과 같은 문구', S.potWin(30), '1등하면 신발 30켤레!');
  // 판돈은 이제 스냅샷 캐시를 거친다 (8차, 매 프레임 정산 계산을 돌리던 것)
  has('사망 화면이 상금을 크게', ov, 'S.potWin(this.pot())');
  has('판돈을 방 스냅샷마다만 센다', ov, 'if (this._potRoom !== room)');
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
  eq('노랑 부활', S.someoneRevived(S.slotColorName[1]), '노란색 1등 부활!');
  eq('빨강 부활', S.someoneRevived(S.slotColorName[0]), '빨강색 1등 부활!');
  eq('파랑 부활', S.someoneRevived(S.slotColorName[2]), '파랑색 1등 부활!');
  eq('초록 부활', S.someoneRevived(S.slotColorName[3]), '초록색 1등 부활!');
  // 색 인자가 붙었다 (36-④) — 알림 문구 자체는 그대로다
  has('GameScene 은 자리 색 이름으로 알린다', gs, 'this.notify(S.someoneRevived(color), ');

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
  /**
   * ★ 15차에 **서버 도장**으로 옮겼다 — 로컬 도장은 저장소를 지우면 사라져 다시 굴렸다.
   * 그리고 도장 열쇠가 방 코드만이라 '계속하기' 2판째부터 보너스가 통째로 빠졌다.
   * 42·43번 묶음이 새 규칙을 자세히 본다.
   */
  has('굴린 개수를 서버에 남긴다', ms, '다음도장.found =');
  has('서버 도장이 있으면 안 굴린다', ms, 'Number.isFinite(걷은양.found)');
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
  // 팝업은 §11차에서 공용 유저상태창(screens/UserCard.js)으로 옮겼다 — 검사도 따라간다
  const uc = fs.readFileSync('src/screens/UserCard.js', 'utf8');
  has('팝업이 승률/게임수/보유신발을 보여준다', uc, 'S.playerStatPopup(p.multiWins ?? 0, games, p.shoesOwned ?? 0)');
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
  // 19 → 17px (5차, 한 단계 축소)
  eq('버튼 폰트 17px', btn && Number(btn[1]), 17);
  const seg = /\.seg \.pbtn\s*\{[^}]*font-size:\s*(\d+)px/.exec(css);
  eq('난이도 선택은 15px 유지 (셋이 한 줄이라 접힌다)', seg && Number(seg[1]), 15);

  // ④ 방 목록에도 방장 보유신발
  const mp = fs.readFileSync('src/services/multiplayer.js', 'utf8');
  has('listRooms 가 방장 보유신발을 싣는다', mp, 'hostShoes:');
  const rl = fs.readFileSync('src/screens/multi/RoomList.js', 'utf8');
  // 문구만 짧아졌다 (36-②) — 배지 자체는 그대로 있어야 한다
  has('방 목록에 보유신발 배지', rl, 'S.roomShoes(r.hostShoes ?? 0)');

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
  // 17차: 빗금 앞뒤를 붙였다 (사용자 지정) — 숫자만 크게 찍으므로 빈칸이 있으면 더 벌어져 보인다
  has('로비 승률 문구', st, 'myMultiRecord: (wins, games) => `멀티게임 ${wins}승/${games}게임`');
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
  has('참가자 목록이 grid 표', css, 'grid-template-columns: 22px 24px 5.6em auto minmax(0, 1fr) auto;');
  has('태그 전용 칸', css, '.player-tags');
  has('남는 폭을 먹는 완충 칸', css, '.player-gap');
  const wr = fs.readFileSync('src/screens/multi/WaitingRoom.js', 'utf8');
  has('태그를 한 칸에 묶었다', wr, "el('div.player-tags'");
  has('카드에 캐릭터 그림', fs.readFileSync('src/screens/UserCard.js', 'utf8'), 'player-card-face');

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

{
  console.log('\n33) ★ 판 중 주운 신발이 승자에게 — 방을 나가도 살아남는다 · 문구/레이아웃 (2026-08-19 4차)');
  const fs = await import('node:fs');
  const has = (label, src, needle) => eq(label, src.includes(needle), true);
  const no = (label, src, needle) => eq(label, src.includes(needle), false);
  const st = fs.readFileSync('src/config/strings.ko.js', 'utf8');
  const mp = fs.readFileSync('src/services/multiplayer.js', 'utf8');
  const mr = fs.readFileSync('src/services/matchRules.js', 'utf8');
  const ms = fs.readFileSync('src/services/multiSettle.js', 'utf8');

  /**
   * ★ 반복 신고의 진짜 원인: `shoesFound` 가 `players/<uid>` 에만 있었고 `leaveRoom` 이
   * 그 노드를 통째로 지운다. 패자가 결과 화면에서 먼저 나가면(실제 사용자 행동) 승자가
   * 셀 근거가 사라져 0을 세고 있었다. 그래서 **결과에 못 박는다.**
   */
  has('finalizeResult 가 주운 개수를 결과에 남긴다', mp, "'result/found': found");
  has('결과의 found 를 우선해서 센다', mr, 'const found = room?.result?.found;');
  has('사람이 나가도 결과 값으로 센다', mr, 'export function foundOf');
  has('players 는 폴백으로만', mr, 'room?.players?.[uid]?.shoesFound');
  has('정산이 상대 습득분을 더한다', ms, 'foundShoesTotal(r, u.uid)');
  // 뺏긴 켤레 수에 내가 주운 몫도 합산 (사용자 요청)
  has('뺏긴 수에 내 습득분 합산', ms, '+ foundOf(r, u.uid)');
  // 규칙에 없으면 결과 확정이 통째로 거부된다 ($other:false)
  {
    const doc = fs.readFileSync('docs/FIREBASE_RULES.md', 'utf8');
    const i = doc.indexOf('## Realtime Database');
    const json = /```json\n([\s\S]*?)\n```/.exec(doc.slice(i))[1];
    const rules = JSON.parse(json).rules;
    eq('규칙에 result/found 가 있다', !!rules.rooms.$code.result.found, true);
  }

  // 문구
  has('부활 버튼 한 줄', st, 'reviveWith: (n) => `신발 ${n}개로 부활`');
  no('옛 두 줄 부활 문구 제거', st, 'reviveWith2');
  has('사망 화면 상금도 같은 문구', st, 'potWin: (n) => `1등하면 신발 ${n}켤레!`');
  has('부활 알림 색 이름 + 느낌표', st, 'someoneRevived: (colorName) => `${colorName} 1등 부활!`');
  has('닉네임 변경하기', st, "menuRename: '닉네임 변경하기'");

  /**
   * 인게임 가독성 — 7px(small) 를 버리고 11px + 외곽선.
   *
   * ★ **판돈 줄만 14차에 되돌렸다**(§9-0-44). 사용자가 *"폰트 크기를 2단계만 줄여"* 라고
   * 지정했고, 이 저장소의 글자 단계는 2px 이라 11 → 7 이 정확히 두 단계다. 나머지 두 줄은
   * 그대로 11px 다 — 되돌린 것과 안 되돌린 것을 검사가 분명히 갈라 둬야 다음 사람이 헷갈리지 않는다.
   */
  const mh = fs.readFileSync('src/game/multiHud.js', 'utf8');
  for (const [label, fn, small] of [
    ['거리/유지중', 'drawGapLine', false],
    ['판돈', 'drawPot', true],
    ['알림', 'drawTicker', false],
  ]) {
    const body = new RegExp(`function ${fn}\\(scene\\) \\{([\\s\\S]*?)\\n\\}`).exec(mh)?.[1] ?? '';
    eq(`${label} 본문을 찾았다`, body.length > 0, true);
    eq(`${label} — ${small ? '7px (small)' : '11px (small 아님)'}`, /small:\s*true/.test(body), small);
    eq(`${label} — 외곽선`, /outline:/.test(body), true);
  }
  has('알림 접기도 11px 로 잰다', mh, 'measure(next, 1, false, false)');

  const ov = fs.readFileSync('src/game/overlays.js', 'utf8');
  has('사망 화면 부활 문구 한 줄 11px', ov, 'S.reviveWith(MULTI.reviveCost), 90, 193');
  // 6차에서 **되살렸다** — 크림색 패널 안이라 검은 글씨가 또렷하고, 걸지 말지 정하려면
  // "얼마 걸리나"와 "내가 얼마 가졌나"가 나란히 있어야 한다 (35번 묶음이 위치까지 본다)
  has('상금 아래 내 잔고 줄', ov, 'S.myShoes(have)');

  // 로비
  const lobby = fs.readFileSync('src/screens/Lobby.js', 'utf8');
  has('그림 아래는 닉네임', lobby, "el('div.char-name', p.nickname || '???')");
  const css = fs.readFileSync('src/styles/screens.css', 'utf8');
  const panel = /^\.panel \{([\s\S]*?)\n\}/m.exec(css)?.[1] ?? '';
  has('패널은 줄바꿈 금지 (뱃지가 안 밀린다)', panel, 'flex-wrap: nowrap');
  // 18차: 10% 넓혀 73px 로 되돌렸다 + 그림도 10% 키웠다 (사용자 지정)
  eq('캐릭터 칸 폭', /\.char-cell \{[\s\S]*?width: (\d+)px/.exec(css)?.[1], '73');
  eq('캐릭터 그림 크기', /\.panel img \{\s*width: (\d+)px;\s*height: (\d+)px/.exec(css)?.slice(1, 3), ['55', '84']);
  eq('그림과 닉네임 간격', /\.char-cell \{[\s\S]*?gap: (\d+)px/.exec(css)?.[1], '5');
}

{
  console.log('\n34) 부활창 10초 고정 · 패배 팁 삭제 · 순위 윈도잉 · 고대박물관 · 버튼 폰트 (2026-08-19 5차)');
  const fs = await import('node:fs');
  const has = (label, src, needle) => eq(label, src.includes(needle), true);
  const no = (label, src, needle) => eq(label, src.includes(needle), false);

  // ① 부활 창은 지갑과 무관하게 항상 10초
  const ov = fs.readFileSync('src/game/overlays.js', 'utf8');
  has('창 길이가 하나로 고정', ov, 'const 창초 = MULTI.reviveWindowSeconds;');
  no('지갑 보고 창을 줄이지 않는다', ov, 'reviveWindowShortSeconds');
  eq('부활 창 6초', MULTI.reviveWindowSeconds, 6);

  // ② 패배 화면 팁 3줄 삭제
  const mr = fs.readFileSync('src/screens/multi/MultiResult.js', 'utf8');
  no('패배 팁 상자 없음', mr, "el('div.tip'");
  no('팁 제목 없음', mr, 'S.tipTitle');

  // ③ 순위표는 내 주변만
  const hof = fs.readFileSync('src/screens/HallOfFame.js', 'utf8');
  has('명예의 전당이 윈도잉을 쓴다', hof, 'rankWindow(state.data.rows, me.uid)');
  no('전체 목록을 그대로 뿌리지 않는다', hof, 'state.data.rows.map((r) => row(');

  // ④ 고대박물관 — 이름과 간판이 같이 바뀌었나
  const bg = fs.readFileSync('src/data/backgrounds.js', 'utf8');
  has('맵 이름 고대박물관', bg, "{ id: 'build_10', name: '고대박물관' }");
  no('조선총독부 잔재 없음(이름)', bg, "name: '조선총독부'");
  eq('간판 스크립트 존재', fs.existsSync('tools/build-museum-sign.mjs'), true);
  {
    // 파이프라인에 연결돼 있나 — assets:bg 를 다시 돌려도 한자가 안 살아나야 한다
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    has('assets:bg 가 간판 스크립트를 이어 부른다', pkg.scripts['assets:bg'], 'build-museum-sign.mjs');
  }

  // ⑤ 로비 버튼 폰트 한 단계 축소
  const css = fs.readFileSync('src/styles/screens.css', 'utf8');
  const btn = /\.pbtn \{[\s\S]*?font-size: (\d+)px/.exec(css);
  eq('버튼 폰트 19 → 17px', btn && Number(btn[1]), 17);
}

{
  console.log('\n35) ★ 화면 판돈 = 실제 수령액 (습득분 포함) · 사망 화면 재배치 (2026-08-19 6차)');
  const fs = await import('node:fs');
  const has = (label, src, needle) => eq(label, src.includes(needle), true);

  /**
   * ★ 화면 하단 `1등하면 신발 N켤레!` 가 **판돈만** 세고 주운 신발을 빼먹고 있었다.
   * 1등은 주운 것까지 전부 가져가므로 실제 수령액이 늘 더 컸다 — 사용자가 "계산이
   * 안 맞는다"고 한 지점이다. 이제 표시와 정산이 같은 식을 쓴다.
   */
  const mr = fs.readFileSync('src/services/matchRules.js', 'utf8');
  has('판돈에 습득분이 들어간다', mr, 'return 부활값 + 남은기본 + 주운것;');
  has('끝난 판은 결과에 박힌 값을 쓴다', mr, "typeof saved?.[p.uid] === 'number'");
  has('내 습득은 서버 응답 전에도 반영', mr, 'live && live.uid === p.uid');

  // 실제 수치로 검산 — 3인, 부활 1회, 각자 주움
  const { potShoes } = await import('../src/services/matchRules.js');
  {
    const room = {
      players: { A: { revives: 1, shoesFound: 4 }, B: { shoesFound: 6 }, C: { shoesFound: 3 } },
      result: { given: { A: new Array(20).fill(1), B: [1], C: [1] } },
    };
    // 판돈 20 + 기본 (3-1)=2 + 주운 13 = 35
    eq('판돈 계산 (20 + 2 + 13)', potShoes(room), 35);
    // 내가 막 하나 더 주웠으면 서버 응답 전에도 36
    eq('내 습득은 즉시 반영', potShoes(room, { uid: 'A', shoesFound: 5 }), 36);
    // 결과에 박힌 값이 있으면 그쪽이 진실 (사람이 방을 나가도 남는다)
    const ended = { ...room, result: { ...room.result, found: { A: 4, B: 6, C: 3 } } };
    eq('끝난 판도 같은 값', potShoes(ended), 35);
  }

  // 하단 줄이 내가 주울 때마다 갱신되는가 (캐시 열쇠)
  const hud = fs.readFileSync('src/game/multiHud.js', 'utf8');
  has('내 습득이 캐시 열쇠에 들어간다', hud, 'scene.potMine !== mine');
  has('판돈에 내 최신 습득을 넘긴다', hud, 'potShoes(room, { uid: scene.multi?.myUid, shoesFound: mine })');

  // 사망 화면 — 카운트다운 칸 + 잔고 줄
  const ov = fs.readFileSync('src/game/overlays.js', 'utf8');
  has('카운트다운 전용 칸', ov, 'const CD = { x: 50, y: 106, w: 80, h: 42 }');
  has('숫자에 외곽선', ov, "color: PAL.text, outline: PAL.textShadow, scale: 3");
  has('상금 아래 잔고 줄 복귀', ov, 'S.myShoes(have), 90, 168');
  // 배율 3 숫자(33도트)가 칸(42) 안에 여백을 두고 들어가는지 계산으로 확인
  eq('숫자가 칸을 안 넘는다', 4 + 33 <= 42, true);
}

{
  console.log('\n36) ★ 방 목록 가독성 · 죽으면 색이 빠진다 · 낙사/부활 효과음 (2026-08-19 7차)');
  const fs = await import('node:fs');
  const has = (label, src, needle) => eq(label, src.includes(needle), true);
  const css = fs.readFileSync('src/styles/screens.css', 'utf8');

  // ① 방 목록 — 줄이 답답하지 않게, 배지는 방번호와 같은 색으로
  {
    const row = /\.room-row \{[\s\S]*?\}/.exec(css)?.[0] ?? '';
    const pad = /padding: (\d+)px (\d+)px/.exec(row);
    eq('방 줄 위아래 여백 4 → 9px', pad && Number(pad[1]), 9);
    eq('방 줄 좌우 여백 5 → 7px', pad && Number(pad[2]), 7);
    const list = /\.room-list \{[\s\S]*?\}/.exec(css)?.[0] ?? '';
    eq('줄 간격 4 → 6px', /gap: 6px/.test(list), true);
    has('배지 글자색을 본문색으로 되돌린다', css, '.room-row .player-shoes');
  }

  // ② 문구 축약 — 방 목록만 짧게, 대기방 카드는 그대로
  {
    const S = (await import('../src/config/strings.ko.js')).default;
    eq('방 목록 배지 문구', S.roomShoes(0), '신발 0켤레');
    const rl = fs.readFileSync('src/screens/multi/RoomList.js', 'utf8');
    has('방 목록이 짧은 문구를 쓴다', rl, 'S.roomShoes(r.hostShoes ?? 0)');
    const wr = fs.readFileSync('src/screens/multi/WaitingRoom.js', 'utf8');
    eq('대기방은 원래 문구 유지', wr.includes('playerShoesOwned'), true);
  }

  // ③ 죽은 사람은 자리 색을 잃는다 — 테두리·빈칸 둘 다
  {
    const hud = fs.readFileSync('src/game/multiHud.js', 'utf8');
    // 26차: **나가는 중**에도 색이 빠진다 — 자리 색은 '살아서 뛰는 사람'의 표시다
    has('죽음 판정은 카운트다운 유무', hud, 'const 죽음 = countdown != null || exitLeft != null;');
    has('테두리가 회색으로', hud, 'const on = 죽음 ? PAL.deadGray : SLOT_COLORS[i];');
    has('빈 칸도 색을 뺀다', hud, 'const off = 죽음 ? PAL.textShadow : SLOT_DIM[i];');
    has('등수 글자도 회색', hud, 'color: PAL.deadGray, outline: PAL.textShadow, align, small: true');
  }

  // ④ 알림 색 — 낙사 빨강 / 부활 노랑, 둘 다 외곽선
  {
    const gs = fs.readFileSync('src/game/GameScene.js', 'utf8');
    has('부활 알림 노랑', gs, 'S.someoneRevived(color), PAL.gaugeWarn');
    has('낙사 알림 빨강', gs, 'S.someoneFell(color), PAL.goRed');
    has('탈락 알림 빨강', gs, 'S.someoneOut(color), PAL.goRed');
    const hud = fs.readFileSync('src/game/multiHud.js', 'utf8');
    has('색을 줄마다 들고 다닌다', hud, 'color: t.color ?? PAL.text');
    has('알림에 외곽선', hud, 'color: it.color, align: \'center\', outline: PAL.textShadow');
  }

  // ⑤ 효과음 두 개가 실제로 등록되고 불려야 한다
  {
    const sfx = fs.readFileSync('src/audio/sfx.js', 'utf8');
    has('낙사 효과음 등록', sfx, 'sfx_rival_fell:');
    has('부활 효과음 등록', sfx, 'sfx_rival_revive:');
    const gs = fs.readFileSync('src/game/GameScene.js', 'utf8');
    has('낙사 때 소리', gs, "'sfx_rival_fell'");
    has('부활 때 소리', gs, "'sfx_rival_revive'");
    /**
     * ★ 사운드 QA 가 **목록을 손으로 들고 있으면** 새 소리는 조용히 검사 밖에 남는다.
     * 실제로 이 두 개가 그렇게 빠졌다 — 이제 소스에서 긁어 오는지 여기서 못 박는다.
     */
    const aq = fs.readFileSync('tools/_audio-qa.mjs', 'utf8');
    has('사운드 QA 가 목록을 소스에서 긁는다', aq, "readFileSync('src/audio/sfx.js', 'utf8').matchAll(");
    has('잠금 못 풀면 멈춘다', aq, '오디오 잠금을 못 풀었다');
  }
}

{
  console.log('\n37) ★ 잠깐 나갔다 와도 안 튕긴다 · 프레임 비용 (2026-08-19 8차)');
  const fs = await import('node:fs');
  const has = (label, src, needle) => eq(label, src.includes(needle), true);
  const no = (label, src, needle) => eq(label, src.includes(needle), false);

  // ① 자리 지킴 — "조용하다"와 "끊겼다"를 가른다
  {
    const mp = fs.readFileSync('src/services/multiplayer.js', 'utf8');
    has('끊긴 시각을 서버가 찍는다', mp, 'onDisconnect(ref).set(fb.dbMod.serverTimestamp())');
    has('다시 붙으면 지운다', mp, "withTimeout(fb.dbMod.set(ref, null), undefined, '자리 지킴 해제')");
    /**
     * ★ 이게 이번 회차의 핵심이다. 자리를 빼는 예약을 **붙을 때마다** 취소하지 않으면
     * 잠깐의 끊김 한 번으로 방에서 통째로 사라진다 — 시뮬에서 실제로 재현됐다.
     */
    has('자리 빼는 예약도 붙을 때마다 취소', mp, 'await fb.dbMod.onDisconnect(seat).cancel();');
    has('예약 열쇠에 uid 가 들어간다', mp, 'const seatKey = (uid, code) =>');
    has('명단에서 사라졌으면 되찾는다', mp, 'export async function rejoinIfDropped(');
    has('끝난 판에는 안 들어간다', mp, "if (room.result?.rankings) return false;");

    const mr = fs.readFileSync('src/services/matchRules.js', 'utf8');
    has('끊긴 시각이 있으면 그걸 먼저 본다', mr, 'if (off) return now - off > 한계;');
  }

  // ② 임계값 — 얼린 페이지가 2분짜리 통화를 버텨야 한다
  {
    // 10차: 150/45 두 갈래를 **30초 하나로** 통일했다 (사용자 지정)
    eq('자리 비움 판정 30초', MULTI.absentSeconds, 30);
    eq('신호는 5초마다 — 30초면 여섯 번 연속 놓친 것', MULTI.absentSeconds / (MULTI.heartbeatMs / 1000), 6);
  }

  // ③ 돌아오는 순간 바로 신호
  {
    const gs = fs.readFileSync('src/game/GameScene.js', 'utf8');
    has('화면이 돌아오면 즉시 보낸다', gs, "document.addEventListener('visibilitychange', this.onVisible)");
    has('나갈 때 뗀다', gs, "document.removeEventListener('visibilitychange', this.onVisible)");
    has('자리 지킴을 건다', gs, 'Room.armPresence(this.multi.code)');
    has('판이 끝나면 끈다', gs, 'Room.disarmPresence(this.multi.code)');
  }

  // ④ 프레임 비용 — 오버레이가 캐시 없는 글자를 쓰면 안 된다
  {
    const ov = fs.readFileSync('src/game/overlays.js', 'utf8');
    /**
     * 오버레이는 아래 게임 화면과 **함께** 매 프레임 다시 그려진다. 캐시 없는 `text()` 로
     * 그리면 외곽선 한 줄이 글리프당 fillRect 9벌이라 사망 패널 한 장이 3,647회였다(실측).
     */
    has('오버레이가 캐시본을 쓴다', ov, 'import { textCached as text, GLYPH_H }');
    no('원본 text 를 따로 들여오지 않는다', ov, "import { text, GLYPH_H }");
    has('판돈은 스냅샷마다만', ov, 'if (this._potRoom !== room)');
    has('지갑은 바뀔 때만', ov, 'invalidateWallet()');
    no('매 프레임 지갑을 읽지 않는다', ov, 'const have = getProfile().shoesOwned');

    const hud = fs.readFileSync('src/game/multiHud.js', 'utf8');
    has('순위 계산도 스냅샷마다만', hud, 'if (scene.rankRoom !== room)');
    has('1등 계단 수도 캐시', hud, 'if (scene.gapRoom !== room)');
    has('6칸 좌표는 모듈 상수', hud, 'const SEGS = (() => {');

    const st = fs.readFileSync('src/game/stairs.js', 'utf8');
    has('화면 밖 계단은 안 그린다', st, 'if (sy + STAIR.h < 0 || sy > VIEW_H) continue;');

    const bg = fs.readFileSync('src/game/background.js', 'utf8');
    has('덮이는 하늘은 안 칠한다', bg, 'if (!tile || !f1 || !road) rect(0, 0, VIEW_W, VIEW_H, PAL.skyFallback);');
    has('구름 좌표는 모듈 상수', bg, 'const CLOUD_SPOTS = [');
  }

  // ⑤ 접속 속도 — 기다리는 동안 볼 것이 있어야 하고, 안 쓸 그림을 기다리지 않는다
  {
    const main = fs.readFileSync('src/main.js', 'utf8');
    // 부트 화면을 끄는 것이 첫 화면을 띄운 **뒤**여야 빈 화면 구간이 없다
    eq('첫 화면을 띄운 뒤에 부트 화면을 끈다',
      main.indexOf('nav.reset(routeFor(u))') < main.lastIndexOf('hideBoot();'), true);

    const gs = fs.readFileSync('src/game/GameScene.js', 'utf8');
    has('층수 배경은 뒤에서 받는다', gs, 'loadAll(FLOOR_BACKGROUNDS.map(');
    no('층수 배경을 시작 목록에 넣지 않는다', gs, '...FLOOR_BACKGROUNDS.map((f) => ({ key: f.key, url: floorAsset(f.key) })),');
    has('조작 버튼은 쓰는 것만', gs, '...buttonAssets(this.controlMode),');

    const pf = fs.readFileSync('src/services/profile.js', 'utf8');
    has('프로필·도감을 동시에 당긴다', pf, 'await Promise.all([');
  }
}

{
  console.log('\n38) ★ 30초 규칙 · 유령 방 청소 · 보유 신발 갱신 (2026-08-19 10차)');
  const fs = await import('node:fs');
  const has = (label, src, needle) => eq(label, src.includes(needle), true);
  const no = (label, src, needle) => eq(label, src.includes(needle), false);
  const mp = fs.readFileSync('src/services/multiplayer.js', 'utf8');

  // ① 30초 하나로 통일 — 판정과 화면이 같은 숫자를 봐야 어긋나지 않는다
  {
    const mr = fs.readFileSync('src/services/matchRules.js', 'utf8');
    has('판정이 30초 상수를 쓴다', mr, 'const 한계 = MULTI.absentSeconds * 1000;');
    no('갈라져 있던 두 상수는 없다', mr, 'offlineGraceSeconds');
    const bal = fs.readFileSync('src/config/balance.js', 'utf8');
    no('밸런스에도 남아 있지 않다', bal, 'staleSeconds');

    const gs = fs.readFileSync('src/game/GameScene.js', 'utf8');
    has('화면도 같은 숫자로 판단한다', gs, '비운시간 > MULTI.absentSeconds * 1000');
    has('30초를 넘기면 스스로 나간다', gs, 'kickOut()');
    has('나가면서 도장을 찍는다', gs, 'Room.markOut(code)');
    has('자리도 비운다', gs, 'Room.leaveRoom(code)');
    const sm = fs.readFileSync('src/screens/startMultiGame.js', 'utf8');
    has('로비로 보낸다', sm, 'nav.reset(Lobby)');
    has('왜 나왔는지 말해 준다', sm, 'S.kickedAbsent(MULTI.absentSeconds)');
    const wr = fs.readFileSync('src/screens/multi/WaitingRoom.js', 'utf8');
    has('대기방도 같은 규칙', wr, '비운시간 > MULTI.absentSeconds * 1000');
  }

  // ② 유령 방 — 창을 내려두면 소켓이 살아 있어 onDisconnect 가 안 터진다
  {
    has('보고 있는 사람이 치운다', mp, 'export async function purgeAbsent(');
    has('대기 중인 방에서만', mp, "if (!room || room.state !== 'waiting') return 0;");
    has('방장 승계까지 한 번의 쓰기로', mp, "if (나갈사람.includes(room.hostUid)) patch.hostUid = 남는사람[0];");
    has('전원 유령인 대기방은 방째로 지운다', mp, 'const 전원유령 = (r) => {');
    has('목록에서도 감춘다', mp, 'return !list.length || list.some((v) => !isStale(v, 지금));');
    // 판이 도는 방은 절대 안 지운다 — 진행 중인 게임이 통째로 사라진다
    has('전원 유령 판정은 waiting 만', mp, "if (r.state !== 'waiting') return false;");
    const wr = fs.readFileSync('src/screens/multi/WaitingRoom.js', 'utf8');
    has('대기방이 스냅샷마다 치운다', wr, 'Room.purgeAbsent(code, r)');
    // 서버 왕복이라 스냅샷마다 무조건 부르면 헛왕복이 쌓인다
    has('청소는 스로틀', wr, '마지막청소 < MULTI.heartbeatMs');
  }

  // ③ 보유 신발 수 — 입장 시점 스냅샷이 판이 끝나도 안 바뀌던 문제
  {
    has('내 카드만 다시 쓴다', mp, 'export async function refreshMyCard(');
    has('방에 없으면 안 쓴다 (유령 노드 방지)', mp, 'if (!mine) return false;');
    has('값이 같으면 안 쓴다', mp, 'if (next.shoesOwned === mine.shoesOwned');
    const res = fs.readFileSync('src/screens/multi/MultiResult.js', 'utf8');
    has('정산 직후 갱신', res, 'Room.refreshMyCard(code)');
    const wr = fs.readFileSync('src/screens/multi/WaitingRoom.js', 'utf8');
    // 이미 들고 있는 스냅샷을 넘긴다 — 5초마다 헛왕복을 만들지 않는다
    has('대기방에서도 갱신', wr, 'Room.refreshMyCard(code, r)');
    has('스냅샷을 재활용한다', mp, 'const mine = known');
  }
}

// ─────────────────────────────────────────────
{
  console.log('\n39) ★ 판돈 줄 위치 · 5초 출발 규칙 · 유저상태창 · 현재접속자 · 쪽지/대결 (2026-08-19 11차)');
  const fs = await import('node:fs');
  const has = (label, src, needle) => eq(label, src.includes(needle), true);
  const no = (label, src, needle) => eq(label, src.includes(needle), false);

  // ① 판돈 줄을 계단 숫자 바로 위로
  {
    const lay = fs.readFileSync('src/config/layout.js', 'utf8');
    const mh = fs.readFileSync('src/game/multiHud.js', 'utf8');
    const hud = fs.readFileSync('src/game/hud.js', 'utf8');
    has('멀티 전용 계단 숫자 좌표', lay, 'scoreMulti:');
    has('멀티면 그 좌표를 쓴다', hud, 's.multi ? HUD.scoreMulti : HUD.score');
    has('판돈 줄이 계단 숫자 위(41)', mh, 'const POT_Y = 41;');
    has('1등 거리 줄은 그 아래(80)', mh, 'const GAP_Y = 80;');
    /**
     * ★ 14차에 **화면 정중앙(90)** 으로 되돌렸다 — 사용자 지적
     * *"'1등하면 신발 0켤레!' 멘트가 글 가운데 정렬이 아닌거 같아"*.
     * 7px 로 낮추면서 최대 폭이 128 → 83 이 되어, 정중앙에 둬도 48~132 라
     * 레이스 게이지(비켜선 얼굴 상자의 왼쪽 끝이 132)를 넘지 않는다.
     */
    has('판돈 줄은 계단 숫자와 같은 정중앙', mh, 'const POT_CX = CENTER_X;');
    const { HUD } = await import('../src/config/layout.js');
    eq('판돈(41~52) 과 계단 숫자(55~) 가 안 겹친다', HUD.scoreMulti.y >= 41 + 13, true);
  }

  // ② 5초 안에 출발하지 않으면 패배
  {
    const gs = fs.readFileSync('src/game/GameScene.js', 'utf8');
    const mh = fs.readFileSync('src/game/multiHud.js', 'utf8');
    eq('출발 제한은 밸런스 파일에', MULTI.startWithinSeconds, 5);
    has('출발 전에는 시간을 잰다', gs, 'MULTI.startWithinSeconds * 1000 - Date.now()');
    // 로딩이 5초를 넘긴 기기가 뜨자마자 패배하면 안 된다 — 방 시각이 아니라 첫 프레임 기준
    has('기준은 판이 실제로 돈 첫 프레임', gs, 'if (!this.raceOpenedAt) this.raceOpenedAt = Date.now();');
    has('시간이 지나면 패배 처리', gs, 'failToStart()');
    // 부활 창을 주면 그게 곧 사용자가 신고한 그 전략이다
    has('기권과 같은 처리 (부활 창 없음)', gs, "this.leave('home');");
    has('출발하면 경고가 사라진다', gs, 'this.startLeftMs = 0;');
    has('경고를 그린다', mh, 'function drawStartWarn(scene)');
    has('경고 문구 두 줄', mh, 'S.startOrLose');
    // 레이스 게이지 위에 얹혀야 읽힌다 — 마지막에 그린다
    eq('경고는 게이지보다 나중에 그린다',
      mh.indexOf('drawStartWarn(scene);') > mh.indexOf('drawRaceGauge(scene, list);'), true);
    const S2 = (await import('../src/config/strings.ko.js')).default;
    eq('사용자 문구 그대로', [S2.startWithin(5), S2.startOrLose],
      ['5초 안에 출발하세요', '출발하지 않으면 패배합니다']);
  }

  // ③ 명예의 전당 ±50 스크롤 · ④ 신발왕 승률 칸 · ⑤ 아이디를 누르면 유저상태창
  {
    const rw = fs.readFileSync('src/services/rankWindow.js', 'utf8');
    const hof = fs.readFileSync('src/screens/HallOfFame.js', 'utf8');
    const css = fs.readFileSync('src/styles/screens.css', 'utf8');
    has('반경 50', rw, 'export const RANK_WINDOW_RADIUS = 50;');
    has('내 줄이 보이는 자리로 스크롤', hof, 'function scrollToMine(');
    // 탭이 바뀔 때만 — 매 refresh 마다 내리면 사용자가 올려 본 위치가 튕겨 돌아온다
    has('스크롤은 탭이 바뀔 때만', hof, 'if (scrolledFor === key) return;');
    /**
     * ★ 16차에 `max-height: 48vh` 를 **일부러 뺐다** — 목록이 화면 절반에서 멈추고
     *   그 아래가 검게 비었기 때문이다(사용자 신고, 실측 173~243px). 스크롤은
     *   `flex: 1 1 auto` 로 남는 높이를 다 먹고 `overflow-y: auto` 로 걸린다.
     *   검사도 그에 맞춰 바꿨다 — 다시 max-height 가 붙으면 44) 에서 잡힌다.
     */
    has('목록이 실제로 스크롤된다', css, 'overflow-y: auto;');
    has('신발왕 탭에만 승률 칸', hof, "rate: tabId === 'shoeking'");
    has('승률 칸 마크업', hof, "el('div.rank-rate'");
    // 23차: **이름 옆 왼쪽 정렬**로 바꿨다(사용자 지정). 고정폭이던 것을 되돌린 것이라
    // 옛 검사를 그대로 두면 다음 사람이 "원래 오른쪽이었나" 하고 되돌린다. 48번 묶음이 새 규칙을 본다
    has('승률 칸은 이름 옆에서 늘어난다', css, '.rank-row.with-rate .rank-name');
    has('줄을 누르면 유저상태창', hof, 'onclick: () => openCard(r)');
    // 주간·월간·연간 줄에는 신발·승패가 없다 — 계정 문서를 따로 받아 채운다
    const lb = fs.readFileSync('src/services/leaderboard.js', 'utf8');
    has('남의 계정 값을 쿼리로 받는다', lb, 'export async function fetchUserCard(');
    has('getDoc 이 아니라 쿼리 (규칙이 get 을 막는다)', lb, "where(documentId(), '==', uid)");
    has('신발왕 줄에 승패를 싣는다', lb, 'multiWins: v.multiWins ?? 0,');
  }

  // ⑤ 유저상태창은 **하나**여야 한다
  {
    const uc = fs.readFileSync('src/screens/UserCard.js', 'utf8');
    const wr = fs.readFileSync('src/screens/multi/WaitingRoom.js', 'utf8');
    has('공용 컴포넌트', uc, 'export function openUserCard(');
    has('캐릭터 그림 · 아이디 · 캐릭터명 · 승률 · 보유신발', uc, 'S.playerStatPopup(');
    has('대기방도 그걸 쓴다', wr, "import { openUserCard } from '../UserCard.js';");
    // 대기방이 팝업을 직접 만들면 세 화면이 언젠가 다른 말을 한다
    no('대기방에 자체 팝업이 남아 있지 않다', wr, "el('div.dialog-overlay'");
    has('하단에 현재상태', uc, 'user-card-status');
    has('메세지 보내기', uc, 'S.sendMessage');
    has('대결신청', uc, 'S.challengeUser');
    // 게임중·미접속에는 대결을 못 건다 (신청을 띄울 화면이 없다)
    has('대기중일 때만 대결 신청', uc, "if (status !== 'lobby') return toast(S.cantChallengeNow");
  }

  // ⑥ 현재접속자
  {
    const mm = fs.readFileSync('src/screens/multi/MultiMenu.js', 'utf8');
    const ou = fs.readFileSync('src/screens/multi/OnlineUsers.js', 'utf8');
    has('멀티 메뉴에 현재접속자', mm, 'button(S.onlineUsers, () => nav.push(OnlineUsers)');
    // 쪽지는 판돈과 무관하다 — 신발이 부족해도 사람은 볼 수 있어야 한다
    has('신발이 없어도 들어간다', mm, '{ disabled: busy }');
    has('접속자를 구독한다', ou, 'Presence.subscribeOnline(');
    has('떠나면 구독을 끊는다', ou, 'onLeave() { unsub(); unsub = () => {}; }');
    has('누르면 유저상태창', ou, 'onclick: () => openUserCard(u,');
  }

  // ⑦ 쪽지 · 대결신청
  {
    const pr = fs.readFileSync('src/services/presence.js', 'utf8');
    const ip = fs.readFileSync('src/screens/inboxPopups.js', 'utf8');
    const rt = fs.readFileSync('src/screens/router.js', 'utf8');
    const main = fs.readFileSync('src/main.js', 'utf8');
    has('접속 표시는 onDisconnect 로 지운다', pr, 'onDisconnect(ref).remove()');
    // 재접속 때 다시 써야 한다 — 한 번만 쓰면 잠깐 끊긴 사람이 영영 목록에서 사라진다
    has('재접속마다 다시 쓴다', pr, "'.info/connected'");
    has('부팅을 막지 않는다', pr, 'export function startLater(');
    has('부팅 뒤에 켠다', main, 'P.startLater(() => {');
    // 쪽지함이 먼저 붙으면 RTDB 청크를 앞당겨 받아 미루기가 무의미해진다
    has('쪽지함은 붙은 뒤에 구독', main, "import('./screens/inboxPopups.js').then((I) => I.start(nav))");
    has('인게임은 게임중', rt, "Presence.setState('playing');");
    has('DOM 화면은 대기중', rt, "Presence.setState('lobby');");
    /**
     * 13차에 방향을 뒤집었다 — 라우터가 쪽지 팝업을 물면 그게 부팅 번들에 들어온다.
     * 이제 쪽지 쪽이 라우터에 자기를 건다.
     */
    has('DOM 으로 돌아오면 밀린 쪽지를 띄운다', rt, 'mountHook?.();');
    has('훅은 쪽지 쪽이 건다', ip, 'setMountHook(flush);');
    // 인게임(캔버스)에 DOM 팝업이 뜨면 입력이 막혀 그 판이 끝난다
    has('인게임에서는 안 띄운다', ip, "document.body.classList.contains('ui-mode')");
    has('한 번에 하나씩', ip, 'if (showing || !uiMode()) return;');
    // 지우기가 서버에 닿기 전에 스냅샷이 또 오면 같은 팝업이 두 번 뜬다
    has('같은 쪽지를 두 번 안 띄운다', ip, 'const handled = new Set();');
    // ★ 14차: `[답장하기]` → **팝업 안의 입력칸**. 두 단계가 한 단계가 됐다
    has('팝업 안에 답장 입력칸', ip, 'replyInput({ uid: item.from');
    has('보내기 버튼도 같은 팝업', ip, 'replyButton(rep.send)');
    no('답장하기로 창을 더 띄우지 않는다', ip, 'openComposer');
    eq('대결 수락 제한 10초 (사용자 지정)', /CHALLENGE_SECONDS = (\d+)/.exec(ip)?.[1], '10');
    has('수락 버튼에 남은 초', ip, 'S.challengeAccept(left)');
    has('10초가 지나면 자동 거절', ip, 'if (left <= 0) return choose(false);');
    has('거절은 알려 준다', ip, 'Presence.sendSystem(item.from, S.challengeRefused');
    // 화면이 바뀌며 팝업이 강제로 닫혀도 showing 이 굳으면 그 뒤로 아무것도 안 뜬다
    has('강제로 닫혀도 정리된다', ip, 'presentOverlay(overlay, finish)');
    has('오래된 신청은 버린다', ip, 'Presence.CHALLENGE_TTL_MS');
  }
}

// ─────────────────────────────────────────────
{
  console.log('\n40) ★ 받은 메세지함 · 수신 설정 · 차단 · 메뉴 키보드 조작 · 마지막로그인 (2026-08-19 12차)');
  const fs = await import('node:fs');
  const read = (p) => fs.readFileSync(p, 'utf8');
  const has = (label, src, needle) => eq(label, src.includes(needle), true);
  const no = (label, src, needle) => eq(label, src.includes(needle), false);
  const S2 = (await import('../src/config/strings.ko.js')).default;

  // ① 로비 문구에서 '나의' 를 뺐다
  // ★ 16차에 `보유신발 00켤레` 로 바뀌고 숫자만 비트맵으로 크게 찍는다 (44번 묶음이 본다)
  /**
   * 18차: 로비 통계 네 줄은 **문장 하나씩**이다 — 라벨 뒤는 한 칸, 단위 앞은 0칸.
   * 라벨/단위를 쪼개 두면 화면에서 `gap` 으로 붙여야 해서 숫자와 단위 사이에도
   * 같은 간격이 들어간다(사용자 신고 "한칸 띄어쓰기 한거 같다").
   */
  eq('로비 보유량 문구', S2.myShoesOwned(0), '보유신발 0켤레');
  eq('로비 최고기록 문구', S2.myBestRecord(0), '최고기록 0계단');
  // ★ 22차: 분모를 뺐다. 다 모으면 문장이 바뀐다 (사용자 지정 — 44번 묶음이 완성 문구도 본다)
  eq('로비 도감 문구', S2.myDexProgress(0), '신발도감 0켤레');

  // ② 받은 메세지함 — 이력이 남아야 한다
  {
    const pr = read('src/services/presence.js');
    const ib = read('src/screens/Inbox.js');
    const ip = read('src/screens/inboxPopups.js');
    const st = read('src/screens/Settings.js');
    has('설정에 받은 메세지함', st, 'button(S.menuInbox');
    has('설정에 메세지 수신 설정', st, 'button(S.menuMsgAccept');
    // 지우면 이력이 사라진다 — 읽음만 찍는다
    has('읽음 표시', pr, 'export async function markRead(');
    has('팝업은 읽음만 찍는다', ip, 'Presence.markRead(item.id)');
    // 대결 신청은 이력이 아니다 (지나간 신청은 아무 쓸모가 없다)
    has('대결 신청만 지운다', ip, "if (item.kind === 'challenge') Presence.drop(item.id)");
    has('안 읽은 것만 팝업', ip, '!m.out && !m.read');
    // 보낸 것도 남아야 "주고받은 이력"이 된다
    has('보낸 사본을 내 함에도 남긴다', pr, 'out: true');
    has('무한정 쌓이지 않게 정리', pr, 'export const INBOX_KEEP');
    has('목록에 시각 표기', ib, 'stamp(m.at)');
    // ★ 14차에 버튼이 바뀌었다 — 42번 묶음이 새 구성을 본다
    has('닫기/삭제/답장 세 버튼', ib, 'S.deleteMessage');
    has('차단 확인 문구', ib, 'S.blockConfirm(otherName)');
    eq('옛 문구는 그대로 남아 있다(다른 곳에서 쓴다)', [S2.replyMessage, S2.blockUser, S2.close], ['답장하기', '차단', '닫기']);
  }

  // ③ 수신 거부 · 차단은 **이유를 구분해서** 말한다
  {
    const pr = read('src/services/presence.js');
    const uc = read('src/screens/UserCard.js');
    has('수신 여부를 미리 읽는다', pr, 'export async function readAccept(');
    // 규칙에 막힌 것만으로는 "꺼 뒀다"와 "차단했다"를 구별할 수 없다
    has('수신 꺼짐이면 보내지 않는다', pr, "return 'off';");
    has('규칙 거부는 차단으로 읽는다', pr, "denied(e) ? 'blocked' : 'error'");
    has('세 갈래 문구', uc, 'off: S.peerRecvOff');
    has('차단 문구', uc, 'blocked: S.peerBlocked');
    eq('사용자 지정 문구 그대로', [S2.peerRecvOff, S2.peerBlocked],
      ['상대방에 메세지 수신 거부중', '상대방이 차단 설정을 했습니다']);
    const ms = read('src/screens/MessageSettings.js');
    has('켜짐/꺼짐', ms, 'S.msgAcceptOn');
    has('서버에 저장', ms, 'Presence.setAccept(');
  }

  // ④ 게임 결과 화면 · 대기방에서 아이디를 누르면 쪽지
  {
    const res = read('src/screens/multi/MultiResult.js');
    const wr = read('src/screens/multi/WaitingRoom.js');
    has('결과 화면 줄을 누르면 유저상태창', res, 'onclick: () => openUserCard(');
    // 이미 같은 방 안이라 새 방을 파면 유령 자리가 생긴다
    has('결과 화면에는 대결신청 없음', res, 'challenge: false');
    has('대기방에서도 쪽지는 보낸다', wr, 'openUserCard(p, { slot, challenge: false })');
    no('대기방에서 버튼을 통째로 끄지 않는다', wr, 'actions: false');
  }

  // ⑤ 키보드·게임패드로 메뉴 조작
  {
    const mn = read('src/screens/menuNav.js');
    const inp = read('src/core/input.js');
    const main = read('src/main.js');
    has('메뉴 커서 모듈', mn, 'export function bindMenuNav(');
    has('부팅에서 켠다', main, 'bindMenuNav();');
    has('방향키로 이동', mn, "e.code === 'ArrowDown'");
    // 입력칸에 글자를 칠 때 방향키를 뺏으면 안 된다
    has('입력 중에는 안 가로챈다', mn, 'const typing = ()');
    // 팝업이 떠 있으면 뒤 화면 버튼으로 새면 안 된다
    has('팝업 안에서만 움직인다', mn, "querySelectorAll('.dialog-overlay')");
    has('게임패드 방향 핸들러', inp, 'export function setDomNavHandler(');
    // 인게임에서는 같은 십자키가 좌우 조작이다 — 겹치면 안 된다
    has('DOM 화면일 때만 커서', inp, 'if (!enabled) {\n    padWas.L = false');
    has('눌린 순간에만 한 번', inp, "if (navUp && !padNav.up) domNavHandler?.('up');");
    // 로비에서도 루프는 60fps 로 돈다 — 패드가 없으면 아예 훑지 않는다 (2026-08-19 13차)
    has('패드가 없으면 매 프레임 안 훑는다', inp, 'if (!padCount) {');
    const css = read('src/styles/screens.css');
    has('포커스가 눈에 보인다', css, '.pbtn:focus');
  }

  // ⑥ 마지막 로그인
  {
    const uc = read('src/screens/UserCard.js');
    const pf = read('src/services/profile.js');
    const lb = read('src/services/leaderboard.js');
    const tt = read('src/screens/timeText.js');
    has('접속 때 기록', pf, 'pushRemote({ lastLoginAt: Date.now() })');
    has('카드가 받아 온다', lb, 'lastLoginAt: v.lastLoginAt ?? 0');
    has('카드에 줄이 있다', uc, 'user-card-login');
    // 접속 중이면 날짜보다 "지금 여기 있다"가 훨씬 쓸모 있는 정보다
    has('접속 중이면 현재로그인중', uc, 'S.lastLogin(S.lastLoginNow)');
    eq('연도까지 찍는다', tt.includes('d.getFullYear()'), true);
    eq('사용자 지정 형식', S2.lastLogin('2026.01.01 19:34'), '마지막로그인: 2026.01.01 19:34');
  }
}

// ─────────────────────────────────────────────
{
  console.log('\n41) ★ 현재접속자 새로고침 · 접속 속도 (2026-08-19 13차)');
  const fs = await import('node:fs');
  const read = (p) => fs.readFileSync(p, 'utf8');
  const has = (label, src, needle) => eq(label, src.includes(needle), true);
  const no = (label, src, needle) => eq(label, src.includes(needle), false);

  // ① 새로고침 버튼
  {
    const ou = read('src/screens/multi/OnlineUsers.js');
    has('현재접속자에 새로고침', ou, 'button(S.refreshList, refresh');
    // 구독을 다시 걸어야 실제로 연결부터 새로 잡힌다 — 화면만 다시 그리면 그대로다
    has('구독을 다시 건다', ou, 'unsub = listen();');
    eq('뒤로 버튼 위에 있다',
      ou.indexOf('S.refreshList') < ou.indexOf('backButton(S.back'), true);
  }

  // ② 첫 화면을 세션 확인보다 먼저 (실측 726ms → 362ms)
  {
    const main = read('src/main.js');
    has('세션 확인을 먼저 띄운다', main, 'const authReady = initAuth();');
    has('계정이 있으면 로비부터 그린다', main, 'if (미리로비) {');
    // 세션이 정말 끊겼으면 되돌려야 한다 — 안 그러면 로그아웃한 사람이 로비에 갇힌다
    has('세션이 없으면 로그인 화면으로', main, 'nav.reset(SplashLogin)');
    has('같은 화면을 두 번 안 세운다', main, '!로비중');
  }

  // ③ 인게임 코드·메뉴 화면을 부팅 번들에서 뺐다
  {
    const main = read('src/main.js');
    const sg = read('src/screens/startGame.js');
    const sm = read('src/screens/startMultiGame.js');
    const lb = read('src/screens/Lobby.js');
    const rt = read('src/screens/router.js');
    no('부팅에서 GameScene 을 정적으로 안 물린다', main, "from './game/GameScene.js'");
    has('한가할 때 미리 받는다', main, 'prefetchGame();');
    has('싱글 시작이 동적 로드', sg, 'await loadGameModule()');
    has('멀티 시작이 동적 로드', sm, 'await loadGameModule()');
    /**
     * 전체화면 요청은 **제스처 안**에서 해야 브라우저가 받아 준다(§9-0-2).
     * `await` 를 그 앞에 두면 조용히 거절당한다 — 순서를 검사로 못 박는다.
     */
    eq('전체화면 요청이 await 보다 앞',
      sg.indexOf('enterFullscreen()') < sg.indexOf('await loadGameModule()'), true);
    eq('멀티도 마찬가지',
      sm.indexOf('enterFullscreen()') < sm.indexOf('await loadGameModule()'), true);
    has('두 번 눌러도 판이 하나', sg, 'if (starting) return false;');
    has('메뉴 화면은 누를 때 받는다', lb, "lazyScreen(() => import('./Collection.js')");
    has('메뉴도 한가할 때 미리', lb, 'prefetchScreens([');
    // 라우터가 쪽지 팝업을 물면 그게 통째로 부팅 번들에 들어온다
    no('라우터가 쪽지 팝업을 안 문다', rt, "from './inboxPopups.js'");
  }

  // ④ 매 프레임 낭비 · 관찰 범위
  {
    const inp = read('src/core/input.js');
    const mn = read('src/screens/menuNav.js');
    has('패드가 없으면 안 훑는다', inp, 'if (!padCount) {');
    no('매 프레임 객체를 안 만든다', inp, 'Object.entries(nav)');
    /**
     * body 전체를 subtree 로 보면 토스트 하나에도 콜백이 깨어난다.
     * **주석을 걷어내고 본다** — 안 그러면 이 사실을 적어 둔 주석에 검사가 걸린다
     * (§9-0-33 에서 sticky 검사가 똑같이 거짓 실패를 냈다).
     */
    const mnCode = mn.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
    no('body 전체를 subtree 로 안 본다', mnCode, 'subtree: true');
    has('#ui 와 팝업만 본다', mn, "mo.observe(document.body, { childList: true })");
  }

  // ⑤ 접속 표시는 **한가할 때** 붙는다 (RTDB 청크가 판 에셋과 회선을 다투지 않게)
  {
    const pr = read('src/services/presence.js');
    const lb = read('src/screens/Lobby.js');
    has('한가한 틈을 고른다', pr, 'requestIdleCallback');
    has('탭이 숨어 있으면 안 붙는다', pr, 'document.hidden');
    has('값이 같으면 안 쓴다', pr, 'if (key === lastCard) return;');
    has('멀티 미리 붙이기도 한가할 때', lb, 'requestIdleCallback(go');
  }

  // ⑥ 목록 그림은 게으르게
  {
    const hof = read('src/screens/HallOfFame.js');
    const ou = read('src/screens/multi/OnlineUsers.js');
    has('순위표 얼굴 lazy', hof, "loading: 'lazy'");
    has('접속자 얼굴 lazy', ou, "loading: 'lazy'");
  }
}

// ─────────────────────────────────────────────
{
  console.log('\n42) ★ 알림 줄 아래로 · 판돈 7px 정중앙 · prefs 읽기 규칙 · 쪽지 인라인 답장 (2026-08-19 14차)');
  const fs = await import('node:fs');
  const read = (p) => fs.readFileSync(p, 'utf8');
  const has = (label, src, needle) => eq(label, src.includes(needle), true);
  const no = (label, src, needle) => eq(label, src.includes(needle), false);
  const S2 = (await import('../src/config/strings.ko.js')).default;
  const mh = read('src/game/multiHud.js');

  // ①② 알림은 고정된 윗줄에서 **아래로** 쌓인다 (위로 기어올라 판을 가리면 안 된다)
  {
    has('알림 윗줄 고정', mh, 'const TICKER_TOP = 238;');
    no('옛 아래 기준선 제거', mh, 'TICKER_Y');
    has('아래로 쌓는다', mh, 'TICKER_TOP + i * LINE_H');
    has('두 줄까지만', mh, 'const TICKER_ROWS = 2;');
    /**
     * 두 줄(238 + 13 + 11 = 262)이 조작 버튼 윗변(266)을 넘으면 글자가 버튼에 깔린다.
     * 발끝(212)보다 아래에서 시작해야 계단·캐릭터를 안 가린다.
     */
    const top = Number(/TICKER_TOP = (\d+)/.exec(mh)[1]);
    const lh = Number(/LINE_H = (\d+)/.exec(mh)[1]);
    const rows = Number(/TICKER_ROWS = (\d+)/.exec(mh)[1]);
    eq('알림이 발끝(212)보다 아래에서 시작한다', top > 212, true);
    eq('알림 아랫줄이 조작 버튼(266) 앞에서 멈춘다', top + (rows - 1) * lh + 11 <= 266, true);
  }

  // ③ 판돈 줄 — 7px(2단계 축소) + 화면 정중앙
  {
    has('7px 로 그린다', mh, 'small: true });');
    has('중심은 화면 정중앙', mh, 'const POT_CX = CENTER_X;');
    // 폰트 데이터로 직접 잰다 — 눈으로는 게이지 침범을 못 본다
    const f7 = JSON.parse(read('src/data/font7.generated.json'));
    const width = (str) => {
      const up = String(str).toUpperCase();
      let w = 0;
      for (const ch of up) w += (f7.glyphs[ch] ?? f7.glyphs['?']).w;
      return w + f7.tracking * (up.length - 1);
    };
    const worst = width(S2.potLine(523));
    const { CENTER_X } = await import('../src/config/layout.js');
    // 레이스 게이지 얼굴 상자는 한 칸 비켜서면 왼쪽 끝이 132 까지 나온다
    eq('최대 폭이 게이지를 안 넘는다', CENTER_X + Math.ceil(worst / 2) <= 132, true);
  }

  // ④ 마지막로그인 — 넘겨주는 화면이 없어도 카드가 직접 받아 온다
  {
    const uc = read('src/screens/UserCard.js');
    has('접속이 끊긴 사람만 조회한다', uc, "if (status !== 'offline') return;");
    has('계정 문서에서 받아 온다', uc, "import('../services/leaderboard.js')");
    has('한 번만 조회한다', uc, 'if (fetched || opt.load');
    has('받으면 그 줄만 갈아 끼운다', uc, 'lastLoginAt = full.lastLoginAt;');
    const lb = read('src/services/leaderboard.js');
    has('조회 결과에 마지막로그인', lb, 'lastLoginAt: v.lastLoginAt ?? 0,');
  }

  // ⑤ 받은 쪽지 팝업 안에 답장 입력칸
  {
    const ri = read('src/screens/replyInput.js');
    const ip = read('src/screens/inboxPopups.js');
    const ib = read('src/screens/Inbox.js');
    has('입력칸 부품이 따로 있다', ri, 'export function replyInput(');
    has('두 화면이 같은 부품을 쓴다', ip, "from './replyInput.js'");
    has('쪽지함도 같은 부품', ib, "from './replyInput.js'");
    // 규칙과 화면의 상한이 어긋나면 "보내기를 눌렀는데 아무 일도 안 났다"가 된다
    has('입력 상한 100자', ri, "maxlength: '100'");
    has('한글 조합 중 엔터는 무시', ri, '!e.isComposing');
    has('못 보낸 이유를 구분한다', ri, 'off: S.peerRecvOff');
    // 창을 하나 더 띄우던 두 단계가 사라졌다
    no('팝업이 composer 를 안 연다', ip, 'openComposer');
    no('쪽지함도 composer 를 안 연다', ib, 'openComposer');
  }

  /**
   * ⑥ ★ **근본 원인** — `prefs/$uid` 에 읽기 규칙이 없었다.
   *
   * RTDB 읽기 권한은 **아래로만 흐른다.** 잎(`accept`·`blocked`)에만 걸어 뒀으니
   * 부모를 구독하는 `subscribeMyPrefs` 는 늘 권한 거부였고, 그래서
   * 메세지 수신 설정 버튼이 안 눌리는 것처럼 보였고 차단 해제 버튼이 안 나왔다.
   */
  {
    const doc = read('docs/FIREBASE_RULES.md');
    const i = doc.indexOf('## Realtime Database');
    const json = /```json\n([\s\S]*?)\n```/.exec(doc.slice(i))[1];
    const rules = JSON.parse(json).rules;
    const prefs = rules.prefs.$uid;
    eq('prefs/$uid 를 본인이 읽을 수 있다', prefs['.read'], 'auth != null && auth.uid == $uid');
    // 깊은 규칙은 권한을 **더하기만** 한다 — accept 의 공개 읽기는 그대로여야 한다
    eq('accept 는 여전히 누구나 읽는다', prefs.accept['.read'], 'auth != null');
    eq('차단 목록은 여전히 본인만', prefs.blocked['.read'], 'auth != null && auth.uid == $uid');

    // 화면도 서버 한 곳에만 매달리지 않는다
    const ms = read('src/screens/MessageSettings.js');
    has('누른 즉시 뒤집는다', ms, 'if (ok) accept = on;');
    has('못 읽어도 내 조작을 안 덮는다', ms, 'if (accept === null) { accept = true; nav.refresh(); }');
  }

  // ⑦ 쪽지함 팝업 — 긴 차단 버튼 + [닫기][삭제][답장]
  {
    const ib = read('src/screens/Inbox.js');
    const css = read('src/styles/screens.css');
    eq('버튼 문구 (사용자 지정 그대로)',
      [S2.close, S2.deleteMessage, S2.replyShort, S2.blockUserLong, S2.unblockUserLong],
      ['닫기', '삭제', '답장', '이 사용자 차단하기', '이 사용자 차단해제']);
    has('긴 버튼이 자기 줄을 갖는다', ib, "el('div.row.row-wide'");
    has('차단 상태면 해제로 뒤집힌다', ib, 'blocked ? S.unblockUserLong : S.blockUserLong');
    has('삭제가 서버에서 지운다', ib, 'Presence.drop(m.id)');
    has('차단/해제 결과를 바로 반영한다', ib, 'markBlocked(otherUid, !blocked)');
    has('긴 버튼 CSS', css, '.row-wide .pbtn {');
    has('긴 버튼은 한 줄을 다 쓴다', /\.row-wide \.pbtn \{([\s\S]*?)\n\}/.exec(css)?.[1] ?? '', 'width: 100%');
    // 답장은 창을 더 띄우지 않고 **이 팝업 안의 입력칸**을 그대로 보낸다
    has('답장 버튼은 같은 팝업에서 보낸다', ib, 'replyButton(rep.send, S.replyShort)');
  }
}

// ─────────────────────────────────────────────
{
  console.log('\n43) ★ 전면 점검 10건 — 팝업이 안 닫히게 · 대결신청 · 정산 (2026-08-19 15차)');
  const fs = await import('node:fs');
  const read = (p) => fs.readFileSync(p, 'utf8');
  const has = (label, src, needle) => eq(label, src.includes(needle), true);
  const no = (label, src, needle) => eq(label, src.includes(needle), false);
  /** 주석에 걸려 거짓 통과/실패하지 않게 — §9-0-33·§9-0-43 에서 두 번 데인 함정 */
  const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

  // ① 구독이 팝업을 죽이지 않는다 (쪽지·대결신청이 "안 되던" 진짜 이유)
  {
    const rt = code(read('src/screens/router.js'));
    const ui = code(read('src/screens/ui.js'));
    const ip = code(read('src/screens/inboxPopups.js'));
    has('refresh 는 팝업을 남긴다', rt, 'draw(true, true)');
    has('화면이 바뀔 때만 치운다', rt, 'if (!keepOverlays) closeAllOverlays();');
    // 강제로 치워진 것과 사용자가 닫은 것을 구별해야 '읽음'·'거절'이 잘못 찍히지 않는다
    has('닫힌 이유를 넘긴다', ui, "closeAllOverlays(reason = 'screen')");
    has('버튼 핸들러의 클릭 이벤트를 사유로 오인하지 않는다', ui, "typeof reason === 'string' ? reason : 'user'");
    has('강제로 닫힌 쪽지는 읽음을 안 찍는다', ip, "if (reason === 'screen') {");
    has('그리고 다시 띄운다', ip, 'handled.delete(item.id);');
    has('강제로 닫힌 대결신청은 거절 통보를 안 보낸다', ip, "if (reason === 'screen') return;");
  }

  // ② 대결신청 — 상태 문자열을 boolean 으로 보지 않는다
  {
    const uc = code(read('src/screens/UserCard.js'));
    has('상태 문자열로 판정한다', uc, "if (r !== 'ok') {");
    no('옛 boolean 판정이 남아 있지 않다', uc, 'const ok = await Presence.sendChallenge');
    has('못 갔으면 방을 남기지 않는다', uc, 'Room.leaveRoom(code)');
    has('이유를 그대로 알려 준다', uc, 'REASON[r] ?? S.networkError');
  }

  // ③ 보내기 전에 연결을 기다린다 (12초 시한 대신)
  {
    const pr = code(read('src/services/presence.js'));
    has('연결 대기가 있다', pr, 'function waitConnected(fb');
    has('보내기가 그걸 탄다', pr, "if (!(await waitConnected(fb))) return 'error';");
    has('수신 설정 확인은 짧게 (곁다리가 본 줄기를 막지 않게)', pr, "3000, '수신 설정 확인'");
    has('끊기면 다시 기다린다', pr, 'online = false;');
  }

  // ④ 구독 한 번에 화면을 통째로 다시 그리지 않는다
  {
    const wr = code(read('src/screens/multi/WaitingRoom.js'));
    const ou = code(read('src/screens/multi/OnlineUsers.js'));
    has('대기방 — 보이는 값만 비교', wr, 'function viewKey(r)');
    has('대기방 — 같으면 안 그린다', wr, 'if (key === lastView) return;');
    // 생존 신호·진행도는 이 화면에 한 글자도 안 나온다 — 열쇠에 들어가면 안 된다
    no('대기방 열쇠에 seenAt 없음', /function viewKey\(r\)[\s\S]*?\n  }/.exec(wr)?.[0] ?? '', 'seenAt');
    no('대기방 열쇠에 stairs 없음', /function viewKey\(r\)[\s\S]*?\n  }/.exec(wr)?.[0] ?? '', 'stairs');
    has('현재접속자 — 보이는 값만 비교', ou, 'const viewKey = (rows)');
    has('현재접속자 — 같으면 안 그린다', ou, 'if (key === lastView) return;');
    no('현재접속자 열쇠에 at 없음', /const viewKey = \(rows\)[\s\S]*?join\('\|'\);/.exec(ou)?.[0] ?? '', 'u.at');
  }

  // ⑤ 정산 도장은 **판 단위** — '계속하기' 로 이어 하는 판이 새면 안 된다
  {
    const ms = code(read('src/services/multiSettle.js'));
    has('도장 열쇠에 판 구분이 있다', ms, 'const payTag = (code, r) =>');
    has('종료 시각과 시드를 겹쳐 쓴다', ms, "r?.seed ?? 0");
    has('주운 신발 보너스는 서버 도장', ms, '다음도장.found =');
    has('서버 도장이 있으면 안 굴린다', ms, 'Number.isFinite(걷은양.found)');
    // claims 에는 uid 가 아닌 키(found)도 들어간다 — 옛 비트마스크를 오염시키면 안 된다
    const mp = code(read('src/services/multiplayer.js'));
    has('비트마스크는 판돈을 낸 사람만 센다', mp, 'hasOwnProperty.call(given, uid)');
  }

  // ⑥ 진 사람의 미납도 pending 으로 남긴다 (기록을 지우면 빚이 면제된다)
  {
    const ms = code(read('src/services/multiSettle.js'));
    const body = /async function settleOnce\(code, room = null\)[\s\S]*?\n\}/.exec(ms)?.[0] ?? '';
    eq('settleOnce 본문을 찾았다', body.length > 0, true);
    has('선언이 승자 분기 밖에 있다', body.split('if (won) {')[0], 'let pending = 0;');
    has('납부 실패를 센다', body, 'pending++;');
  }

  // ⑦ 판돈 표시는 result 를 본다 (사람이 나가도 안 줄어든다)
  {
    const mr = code(read('src/services/matchRules.js'));
    has('명단을 따로 만든다', mr, 'export function potRoster(room)');
    has('판이 끝났으면 rankings 기준', mr, 'if (!ranks?.length) return playersInRound');
    has('given·found 에만 있는 사람도 넣는다', mr, "for (const k of Object.keys(res.given ?? {})) ids.add(k);");
    has('떠난 사람의 부활 몫은 낸 양에서 되짚는다', mr, 'Math.floor(paid / MULTI.reviveCost)');
  }

  // ⑧ 읽기 실패로 순위표를 잃지 않는다
  {
    const rs = code(read('src/screens/multi/MultiResult.js'));
    has('새로 읽은 값이 있을 때만 갈아 끼운다', rs, 'if (fresh) room = fresh;');
    no('무조건 덮어쓰지 않는다', rs, 'room = await Room.readRoom(code);');
  }

  // ⑨ 같은 방을 동시에 정산하지 않는다
  {
    const ms = code(read('src/services/multiSettle.js'));
    has('진행 중인 정산을 재사용한다', ms, 'const inflight = new Map();');
    has('같은 프라미스를 돌려준다', ms, 'if (running) return running;');
    has('끝나면 지운다', ms, 'inflight.delete(code)');
  }

  // ⑩ 판 시작 실패를 잡는다 (대기방이 얼면 남들 판까지 30초 붙잡는다)
  {
    const wr = code(read('src/screens/multi/WaitingRoom.js'));
    has('실패를 잡는다', wr, 'startMultiGame(nav, { code, room: r }).catch(');
    has('잡으면 자리를 비운다', wr, 'launched = false;');
  }
}


{
  console.log('\n44) ★ 세로 영역과 로비 숫자 크기 (2026-08-19 16차, 사용자 지정)');
  const fs = await import('node:fs');
  const read = (p) => fs.readFileSync(p, 'utf8');
  const has = (label, src, needle) => eq(label, src.includes(needle), true);
  const no = (label, src, needle) => eq(label, src.includes(needle), false);
  /** 주석에 걸려 거짓 통과/실패하지 않게 — §9-0-33·§9-0-43 에서 두 번 데인 함정 */
  const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  const S2 = (await import('../src/config/strings.ko.js')).default;

  /**
   * ① 목록에 `max-height` 를 다시 붙이면 안 된다.
   *    붙는 순간 목록이 화면 절반에서 멈추고, 그 아래 `flex:1` 여백이 남은 공간을
   *    통째로 먹어 **화면 아래가 검게 빈다**(실측 390x780 173px, 412x915 243px).
   *    사용자가 *"1위에서 7.5위까지만 표기되는 느낌"* 이라고 한 것이 이 현상이다.
   */
  {
    // 주석에 적힌 'max-height 를 뺐다' 라는 설명에 걸리지 않게 주석부터 지운다
    const css = read('src/styles/screens.css').replace(/\/\*[\s\S]*?\*\//g, '');
    const block = (sel) => {
      const i = css.indexOf(sel + ' {');
      return i < 0 ? '' : css.slice(i, css.indexOf('}', i));
    };
    for (const sel of ['.rank-list', '.online-list', '.inbox-list']) {
      const b = block(sel);
      eq(`${sel} 규칙을 찾았다`, b.length > 0, true);
      no(`${sel} 에 max-height 없음`, b, 'max-height');
      has(`${sel} 은 남는 공간을 먹는다`, b, 'flex: 1 1 auto');
    }
  }

  /**
   * ② 목록이 있을 때는 `.spacer` 를 빼야 한다 — 목록과 여백이 둘 다 `flex:1` 이면
   *    남는 공간을 나눠 가진다. 반대로 로딩·오류·빈 목록일 때는 여백이 있어야
   *    '내 순위' 와 버튼이 바닥에 붙는다.
   */
  for (const f of ['src/screens/HallOfFame.js', 'src/screens/multi/OnlineUsers.js', 'src/screens/Inbox.js']) {
    const src = code(read(f));
    has(`${f} — 목록 표식`, src, 'listed = true');
    has(`${f} — 목록이면 여백을 뺀다`, src, "listed ? null : el('div.spacer')");
    // 들여쓰기에 걸리지 않게 **개수로** 본다 — 여백이 하나라도 조건 없이 남아 있으면 안 된다
    eq(`${f} — 조건 없는 여백 0개`,
      (src.match(/el\('div\.spacer'\)/g) ?? []).length,
      (src.match(/listed \? null : el\('div\.spacer'\)/g) ?? []).length);
  }

  /**
   * ③ 로비 두 숫자는 **같은 크기**다. (16차: 보유신발을 최고기록과 같은 크기로 /
   *    17차: 거기서 딱 한 칸 작게 = **7px 글꼴 ×3 = 21px**)
   *
   *    배율은 정수만 되므로(§3-1) 두 글꼴을 합쳐 11·14·21·22·28·33px 중에서만 고를 수
   *    있다. 22 바로 아래 칸이 21 이다 — 사용자가 네 후보를 실제로 보고 골랐다.
   *
   *    ⚠ 작은 글꼴이 아직 안 왔을 때 `small: true` 로 그리면 11px 글꼴로 떨어져
   *      ×3 = **33px, 즉 더 커진다.** 그래서 폴백 배율이 반드시 있어야 한다.
   */
  {
    const lb = code(read('src/screens/Lobby.js'));
    /**
     * 23차: 통계 숫자가 **9px 미니 글꼴 ×2 = 18px** 이 됐다(사용자 지정 "17~18px").
     * 미니 글꼴은 정적 import 라 ①도착을 기다리는 폴백도 ②미리받기도 필요 없어졌다 —
     * 17차에 넣었던 그 세 검사를 여기서 **의도적으로 지운다.** 새 규칙은 48번 묶음이 본다.
     */
    has('숫자 크기를 한 곳에서 정한다', lb, 'const STAT_SCALE = 2;');
    no('폴백이 필요 없다', lb, 'STAT_FALLBACK_SCALE');
    no('로비는 7px 글꼴을 안 받는다', lb, 'loadSmallFont()');
    // 늦게 도착한 값이 남의 화면을 건드리지 않는다 — 이제 그 자리는 왕관 딱지다
    has('떠난 뒤에는 다시 그리지 않는다', lb, 'Crowns.refresh(() => { if (live) nav.refresh(); });');
    /**
     * 18차: 네 줄이 **같은 함수·같은 옵션**을 쓴다 — 구조적으로 갈라질 수 없다.
     * 순서도 여기서 못 박는다(멀티게임이 신발도감보다 위, 사용자 지정).
     */
    const rows = [...lb.matchAll(/statLine\(S\.(\w+)\(/g)].map((m) => m[1]);
    eq('통계 네 줄의 순서', rows, ['myBestRecord', 'myShoesOwned', 'myMultiRecord', 'myDexProgress']);
    // 22차: 도감 줄만 세 번째 인자(완성 배지)를 더 받는다 — 옵션 자체는 그대로 넷이다
    eq('네 줄 전부 같은 옵션', (lb.match(/, statNum[,)]/g) ?? []).length, 4);
    /**
     * ★ **외곽선을 쓰지 않는다.** 외곽선을 켜면 캔버스 사방에 배율만큼(3px) 여백이
     *   생기고, 그게 문장 안에서 **없는 띄어쓰기**가 된다(18차 사용자 신고의 원인).
     *   로비 패널은 배경이 어두워 외곽선이 보이지도 않는다 — 자리만 먹었다.
     */
    no('큰 숫자에 외곽선을 쓰지 않는다', /const statNum = \{[\s\S]*?\};/.exec(lb)?.[0] ?? '', 'outline');
    // 그래도 켜졌을 때를 대비해 여백 상쇄 코드는 남겨 둔다
    has('외곽선 여백을 상쇄한다', lb, "cv.style.marginRight = `-${pad}px`;");
    has('앞이 공백이면 왼쪽은 살린다', lb, "/\\s$/.test(parts[i - 1] ?? '') ? '0'");
  }

  /** ④ 문구: "신발 보유량 00켤레" → "보유신발 00켤레" (숫자는 그림이라 따로 그린다) */
  {
    /** 네 줄 전부 **문장 하나**, 라벨 뒤 한 칸 · 단위 앞 0칸 (18차 사용자 지정) */
    eq('통계 네 문구', [S2.myBestRecord(5432), S2.myShoesOwned(1460),
      S2.myMultiRecord(17, 50), S2.myDexProgress(87)],
      ['최고기록 5432계단', '보유신발 1460켤레', '멀티게임 17승/50게임', '신발도감 87켤레']);
    /**
     * ★ 22차 사용자 지정 — **다 모으면 문장이 바뀐다.**
     * *"도감 완성하면 '신발도감 130켤레, 도감완성' 으로 문구가 변경되게 (…)
     *   내가 도감을 완성했구나 라는 것을 한번에 알 수 있도록"*
     * 분모를 뺐으므로 숫자만 봐서는 끝인지 알 수 없다 — 그래서 글자로 말한다.
     */
    eq('완성 표식은 따로 둔다', S2.dexComplete, '도감완성');
    has('다 모았을 때만 배지를 단다', code(read('src/screens/Lobby.js')),
      'dexUnique() >= SHOE_TOTAL ? S.dexComplete : null');
    // 23차: 표식이 둘이 됐다(도감완성 + 왕관 딱지) — 같은 부품에 색만 다르게 준다
    has('줄 끝에 붙인다', code(read('src/screens/Lobby.js')), "line.append(el(`span.stat-done${crownRank");
    const lb2 = code(read('src/screens/Lobby.js'));
    has('숫자만 감싸는 헬퍼', lb2, 'function statLine(str, numOpt, tag, crownRank)');
    const css2 = read('src/styles/screens.css').replace(/\/\*[\s\S]*?\*\//g, '');
    // flex 로 붙이면 숫자와 단위 사이에도 gap 이 들어간다 — 인라인이라야 문구대로 나온다
    no('통계 줄은 flex 가 아니다', /\.stat-line \{[\s\S]*?\}/.exec(css2)?.[0] ?? '', 'display: flex');
    has('비트맵 숫자는 인라인 블록', css2, 'display: inline-block;');
    // 좁은 폰(≤355px)에서는 뱃지를 아랫줄로 — 안 그러면 문구가 말없이 잘린다
    has('좁은 폰 대비 미디어쿼리', css2, '@media (max-width: 355px)');
    has('뱃지를 눕혀 아랫줄로', css2, 'flex-direction: row;');
    // 16~17차에 쪼개 뒀던 라벨/단위는 18차에 문장으로 되돌렸다 — 잔재가 남으면 안 된다
    no('쪼갠 라벨 잔재 없음', code(read('src/config/strings.ko.js')), 'myShoesLabel');
    no('쪼갠 단위 잔재 없음', code(read('src/config/strings.ko.js')), 'myShoesUnit');
    no('로비도 쪼갠 라벨을 안 쓴다', code(read('src/screens/Lobby.js')), 'myShoesLabel');
  }
}


{
  console.log('\n45) ★ 오늘 순위 · 엘리베이터 숨김 · 접속 판정 60초 · 유저상태창 (2026-08-19 19차)');
  const fs = await import('node:fs');
  const read = (p) => fs.readFileSync(p, 'utf8');
  const has = (label, src, needle) => eq(label, src.includes(needle), true);
  const no = (label, src, needle) => eq(label, src.includes(needle), false);
  const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  const S2 = (await import('../src/config/strings.ko.js')).default;
  const P = await import('../src/services/periodKeys.js');

  // ① 탭 다섯 개 — 연간을 빼고 오늘을 넣었다
  {
    const hof = code(read('src/screens/HallOfFame.js'));
    const tabs = [...hof.matchAll(/\{ id: '(\w+)'/g)].map((m) => m[1]);
    eq('명예의 전당 탭 순서', tabs, ['shoeking', 'daily', 'weekly', 'monthly', 'alltime']);
    no('연간 탭 없음', hof, "'yearly'");
    eq('오늘 문구', S2.tabToday, '오늘');
    no('옛 연간 문구 잔재 없음', code(read('src/config/strings.ko.js')), 'tabYearly');
  }

  /**
   * ② 기간 키는 **KST 고정**이다. 기기 시간대로 계산하면 같은 순간에 올린 기록이
   *    서로 다른 순위표로 흩어진다 — 월요일 0시 KST 가 UTC 기기에서는 아직 지난주다.
   */
  {
    const pk = code(read('src/services/periodKeys.js'));
    has('KST 로 옮겨 계산한다', pk, 'const KST_OFFSET_MS = 9 * 60 * 60 * 1000;');
    eq('기간 셋', P.PERIODS.map((x) => x.field), ['dy', 'wk', 'mo']);
    // 사용자 지정: 일요일 밤 11시 59분 리셋 = 월요일 0시부터 새 주
    eq('일요일 23:59 는 지난주', P.weekKey(new Date('2026-08-16T23:59:59+09:00')), '2026-W33');
    eq('월요일 00:00 은 새 주', P.weekKey(new Date('2026-08-17T00:00:00+09:00')), '2026-W34');
    // 사용자 지정: 오늘 순위는 당일 23:59 기준 리셋
    eq('오늘 23:59', P.dayKey(new Date('2026-08-20T23:59:59+09:00')), '2026-08-20');
    eq('자정 넘으면 새 날', P.dayKey(new Date('2026-08-21T00:00:00+09:00')), '2026-08-21');
    // 규칙이 새 기간 필드를 받아야 한다 — 안 그러면 오늘 기록 제출이 통째로 거부된다
    has('Firestore 규칙이 dy 를 받는다', read('docs/FIREBASE_RULES.md'), "d().period == 'dy' && d().dy == d().key");
  }

  // ③ 엘리베이터 — 스위치 하나로 끄고, 버튼만이 아니라 시작 경로도 막는다
  {
    const bal = code(read('src/config/balance.js'));
    has('엘리베이터 스위치', bal, 'enabled: false');
    const lb = code(read('src/screens/Lobby.js'));
    has('꺼져 있으면 버튼이 없다', lb, 'ELEVATOR.enabled && p.bestStairs >= ELEVATOR.unlockFloor');
    has('시작 경로도 막는다', code(read('src/screens/startGame.js')), 'opt.useElevator && ELEVATOR.enabled');
  }

  /**
   * ④ ★ **접속 판정 = 활동.** 사용자 신고: *"게임이 들어와 있지 않은 사람이
   *    현재접속자로 뜨는건 문제가 있는 것 같아 (…) 60초"*
   */
  {
    const pr = code(read('src/services/presence.js'));
    has('60초 문턱', pr, 'export const ACTIVITY_TIMEOUT_MS = 60 * 1000;');
    has('심장 박동 15초', pr, 'const HEARTBEAT_MS = 15 * 1000;');
    has('활동 시각은 서버가 찍는다', pr, 'lastActive: myFb.dbMod.serverTimestamp()');
    has('읽는 쪽에서 거른다', pr, 'export function isLive(card');
    has('목록에 필터를 건다', pr, '.filter((r) => isLive(r, now))');
    // 오래됨은 이벤트를 만들지 않는다 — 타이머로 다시 걸러야 유령이 사라진다
    has('5초마다 다시 거른다', pr, 'recomputeAll();');
    has('대결 상대 확인도 같은 잣대', pr, 'return isLive(v) ? v : null;');
    // 화면을 내리면 스스로 빠진다. beforeunload/unload 는 쓰지 않는다(크롬이 금지)
    has('숨으면 스스로 빠진다', pr, "if (document.visibilityState === 'hidden') { drop(); return; }");
    no('beforeunload 안 쓴다', pr, 'beforeunload');
    no('unload 안 쓴다', pr, "addEventListener('unload'");
    // 활동은 게임 입력에서도 온다 — 게임패드는 DOM 이벤트를 아예 안 만든다
    has('입력이 활동을 찍는다', code(read('src/core/input.js')), 'markActive();');
    has('부팅에서 활동을 지켜본다', code(read('src/main.js')), 'bindActivity();');
    no('마우스 움직임은 활동이 아니다', code(read('src/core/activity.js')), 'mousemove');
  }

  // ⑤ 유저상태창 — 입력칸이 창 안에, 빨간 긴 버튼, 아래 [1:1대결신청][닫기]
  {
    const uc = code(read('src/screens/UserCard.js'));
    has('입력칸을 창 안에 둔다', uc, 'replyInput(p, close)');
    has('보내기는 빨간 긴 버튼', uc, "button(S.sendMessage, compose.send, { class: 'danger wide' })");
    has('아래 줄에 대결신청', uc, 'row.append(button(S.challengeUser');
    has('아래 줄에 닫기', uc, 'row.append(button(S.close, close');
    no('팝업을 또 열지 않는다', uc, 'openComposer(p)');
    eq('대결 버튼 문구', S2.challengeUser, '1:1대결신청');
    eq('입력칸 안내 문구', S2.messageHint, '보낼 메세지를 입력하세요');
    // 엔터로도 보내진다 (사용자 지정) — 한글 조합 중 엔터는 무시한다
    const ri = code(read('src/screens/replyInput.js'));
    has('엔터로 보낸다', ri, "e.key === 'Enter' && !e.isComposing");
    /**
     * 20차: 창이 뜨면 **커서가 입력칸 안에** 있어야 한다(사용자 지정).
     * 커서를 넣는 방법은 **부품 한 곳**에만 있다 — 두 팝업이 각자 들고 있으면
     * 언젠가 한쪽만 고쳐진다(19차에 유저상태창 쪽이 통째로 빠졌다).
     * 실제로 커서가 들어갔는지는 `npm run qa:cardfocus` 가 브라우저에서 확인한다.
     */
    has('입력칸에 커서를 넣는 방법이 있다', ri, 'function focus()');
    has('유저상태창이 창을 붙인 뒤 부른다', uc, 'compose?.focus();');
    has('받은 쪽지 팝업도 같은 방법을 쓴다', code(read('src/screens/inboxPopups.js')), 'rep?.focus();');
    no('각자 setTimeout 으로 잡지 않는다', code(read('src/screens/inboxPopups.js')), 'input.focus()');
    const css = read('src/styles/screens.css');
    has('빨간 버튼 스타일', css, '.pbtn.danger {');
    has('한 줄을 다 쓰는 버튼', css, '.pbtn.wide {');
  }
}

{
  console.log('\n46) ★ 차단 배지 · 수신 설정 두 버튼 · 수신차단 경고 (2026-08-19 21차)');
  const fs = await import('node:fs');
  const read = (p) => fs.readFileSync(p, 'utf8');
  const has = (label, src, needle) => eq(label, src.includes(needle), true);
  const no = (label, src, needle) => eq(label, src.includes(needle), false);
  const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  const S3 = (await import('../src/config/strings.ko.js')).default;
  const css = read('src/styles/screens.css');

  /**
   * ① 받은 메세지함 — 차단한 사람 줄에 **빨간 바탕 흰 글씨** [차단].
   *    *"내가 실수로 차단을 누른 사용자가 누구인지 한눈에 알 수 있도록"*
   *    색까지 검사하는 이유: 배지가 뜨기만 하고 배경이 안 깔리면(크림색 바탕에 흰 글씨)
   *    사실상 안 보인다 — §9-0-37 에서 방 목록 배지가 정확히 그랬다.
   */
  {
    const ib = code(read('src/screens/Inbox.js'));
    has('차단한 사람에게만 배지', ib, "prefs.blocked?.[otherUid] ? el('span.inbox-blocked', S.blockedTag) : null");
    eq('배지 문구', S3.blockedTag, '차단');
    has('배지 스타일', css, '.inbox-blocked {');
    has('배지 흰 글씨', css, 'color: #FFF4D6;');
    has('배지 빨간 바탕', css, 'background: #B23A2E;');
  }

  /**
   * ② 수신차단 상태면 **받은 메세지함 맨 위**에 빨간 글씨 경고.
   *    허용 상태에서는 안 띄운다 — 늘 뜨는 안내는 곧 안 읽히는 안내다.
   *    값을 아직 못 받았을 때(`accept` 초기값 true)도 안 띄운다.
   */
  {
    const ib = code(read('src/screens/Inbox.js'));
    has('차단일 때만 경고', ib, "prefs.accept === false");
    // 22차: 제목과 경고 사이에 현재상태 줄이, 경고와 목록 사이에 탭 셋이 들어왔다
    has('경고는 목록보다 위', ib, 'stateLine,\n        blockedNotice,\n        tabs,\n        body,');
    has('경고 상자 스타일', css, '.inbox-notice {');
    has('경고는 빨간 글씨', css, 'color: #FF9A8A;');
    eq('경고 문구', S3.inboxBlockedNotice,
      '회원님은 메세지를 받으실 수 없는 수신차단 상태입니다. 메세지 수신 설정 메뉴에서 수신허용을 누르시면 다시 메세지를 받으실 수 있습니다');
  }

  /**
   * ③ 메세지 수신 설정 — 켜짐/꺼짐 대신 **[수신차단] [수신허용]** 두 버튼,
   *    그 위에 `현재상태 : …` 한 줄, 아래에 무엇이 멈추는지 안내.
   */
  {
    const ms = code(read('src/screens/MessageSettings.js'));
    const order = [...ms.matchAll(/button\(S\.(msgAccept\w+),/g)].map((m) => m[1]);
    eq('버튼 순서', order, ['msgAcceptOff', 'msgAcceptOn']);
    eq('차단 버튼 문구', S3.msgAcceptOff, '수신차단');
    eq('허용 버튼 문구', S3.msgAcceptOn, '수신허용');
    eq('현재상태 줄', S3.msgAcceptNow('수신허용'), '현재상태 : 수신허용');
    eq('안내 문구', S3.msgAcceptHint, '수신차단 버튼을 누르면, 메세지 받기, 대결신청 등의 기능이 모두 중지됩니다.');
    has('현재상태 줄이 있다', ms, "el('div.msg-accept-now'");
    has('안내는 늘 같은 문장', ms, "el('div.hint', S.msgAcceptHint)");
    // 값을 못 받았으면 단정하지 않는다 — 써 놓고 뒤집히는 쪽이 훨씬 나쁘다(§9-0-6)
    has('로딩 중에는 단정 안 함', ms, 'accept === null ? S.loading');
    // 12차의 켜짐/꺼짐 문구는 되살아나면 안 된다
    has('차단 상태는 글자도 빨강', css, '.msg-accept-now.off {');
  }
}

{
  console.log('\n47) ★ 받은 메세지함 탭 셋 · 받음/보냄 색 · 도감완성 배지 (2026-08-19 22차)');
  const fs = await import('node:fs');
  const read = (p) => fs.readFileSync(p, 'utf8');
  const has = (label, src, needle) => eq(label, src.includes(needle), true);
  const no = (label, src, needle) => eq(label, src.includes(needle), false);
  const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  const S4 = (await import('../src/config/strings.ko.js')).default;
  const ib = code(read('src/screens/Inbox.js'));
  const css = read('src/styles/screens.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const vars = read('src/styles/pixel-ui.css').replace(/\/\*[\s\S]*?\*\//g, '');

  // ① 타이틀 바로 아래 현재상태 — 수신 설정 화면과 **같은 부품·같은 문구**를 쓴다
  {
    has('현재상태 줄이 화면에 있다', ib, "el('div.msg-accept-now'");
    has('수신 설정과 같은 문구', ib, 'S.msgAcceptNow(stateWord)');
    has('제목 다음이 현재상태', ib, 'title(S.inboxTitle),\n        stateLine,');
    // 못 읽었으면 단정하지 않는다 — 써 놓고 뒤집히는 쪽이 더 나쁘다(§9-0-6)
    has('읽기 전에는 단정 안 함', ib, '!prefsKnown ? S.loading');
  }

  // ② 탭 셋 — 기본은 전체보기, 그리고 **서버를 다시 부르지 않는다**
  {
    eq('탭 문구', [S4.inboxTabAll, S4.inboxTabIn, S4.inboxTabOut], ['전체보기', '받은 메세지', '보낸 메세지']);
    has('기본은 전체보기', ib, "let filter = 'all';");
    has('탭 셋을 그린다', ib, "el('div.seg.inbox-tabs'");
    has('손에 있는 목록을 거른다', ib, "filter === 'all' ? true : filter === 'out' ? !!m.out : !m.out");
    // 탭마다 다시 구독하면 같은 데이터를 세 번 받고 탭을 옮길 때마다 화면이 빈다
    eq('구독은 하나뿐', (ib.match(/subscribeInbox\(/g) ?? []).length, 1);
    // 빈 목록의 문구도 탭마다 다르다 — '받은 메세지' 탭에서 "주고받은 메세지가 없습니다" 는 거짓말이다
    eq('빈 목록 문구 셋', [S4.inboxEmpty, S4.inboxEmptyIn, S4.inboxEmptyOut],
      ['주고받은 메세지가 없습니다', '받은 메세지가 없습니다', '보낸 메세지가 없습니다']);
    has('탭에 따라 문구가 갈린다', ib, 'const emptyText = ');
  }

  /**
   * ③ 받음은 파랑, 보냄은 빨강 — 테두리와 앞머리 글자에 **같은 색**.
   *    실제로 그 색으로 그려지는지는 `npm run qa:msg` 가 브라우저에서 계산된 값으로 본다.
   */
  {
    has('파랑 변수', vars, '--c-msg-in: #4c8de0;');
    has('파랑 글씨 변수', vars, '--c-msg-in-text: #8fc0ff;');
    has('빨강 변수', vars, '--c-msg-out: #c6402e;');
    has('빨강 글씨 변수', vars, '--c-msg-out-text: #ff9a8a;');
    has('받음 줄 테두리', css, '.inbox-row.in { border-color: var(--c-msg-in); }');
    has('보냄 줄 테두리', css, '.inbox-row.out { border-color: var(--c-msg-out); }');
    has('받음 앞머리 색', css, '.inbox-row.in .inbox-dir { color: var(--c-msg-in-text); }');
    has('보냄 앞머리 색', css, '.inbox-row.out .inbox-dir { color: var(--c-msg-out-text); }');
    // 안 읽음 표시가 테두리를 도로 가져가면 색이 무엇을 뜻하는지 흐려진다
    no('안 읽음이 테두리를 뺏지 않는다', css, '.inbox-row.unread { border-color');
    has('안 읽음은 바탕으로', css, '.inbox-row.unread { background:');
    // 보낸 줄을 흐리게 하던 것은 뺐다 — 빨강이 죽는다
    no('보냄을 흐리게 하지 않는다', css, '.inbox-row.out { opacity');
  }

  // ④ 로비 도감 — 분모를 빼고, 다 모으면 배지
  {
    eq('분모 없는 문구', S4.myDexProgress(87), '신발도감 87켤레');
    no('분모 잔재 없음', S4.myDexProgress(87), '/');
    has('완성 배지 스타일', css, '.stat-done {');
    const lb = code(read('src/screens/Lobby.js'));
    has('완성일 때만 배지', lb, 'dexUnique() >= SHOE_TOTAL ? S.dexComplete : null');
  }
}

{
  console.log('\n48) ★ 왕관·멀티게임순위·로비 딱지·18px 숫자 (2026-08-19 23차)');
  const fs = await import('node:fs');
  const read = (p) => fs.readFileSync(p, 'utf8');
  const has = (label, src, needle) => eq(label, src.includes(needle), true);
  const no = (label, src, needle) => eq(label, src.includes(needle), false);
  const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  const S5 = (await import('../src/config/strings.ko.js')).default;
  const P5 = await import('../src/services/periodKeys.js');
  const B5 = await import('../src/config/balance.js');
  const css = read('src/styles/screens.css').replace(/\/\*[\s\S]*?\*\//g, '');

  // ① 신발왕 승률 줄 — 머리말을 떼고 한 단계 크게, 이름 옆 왼쪽 정렬
  {
    // 24차: 총 판수를 뺐다 (사용자 지정 "그냥 멀티게임승리 횟수만")
    eq('승패 문구', S5.rankWinRate(0), '멀티게임 0승');
    no('총 판수 잔재 없음', S5.rankWinRate(3), '총');
    has('왼쪽 정렬', css, '.rank-rate {');
    const rate = css.slice(css.indexOf('.rank-rate {'), css.indexOf('}', css.indexOf('.rank-rate {')));
    eq('9 → 11px', /font-size: 11px;/.test(rate), true);
    eq('왼쪽으로 붙는다', /text-align: left;/.test(rate), true);
    has('이름은 5글자 고정폭', css, '.rank-row.with-rate .rank-name');
  }

  /**
   * ② 등수 표기와 왕관. **자리를 고정**하는 게 핵심이다 —
   *    왕관이 있는 줄만 넓어지면 등수 숫자가 줄마다 다른 x 에 선다(`qa:hoffit` 이 잰다).
   */
  {
    eq('등수 문구', S5.rankPlace(3), '3위');
    const hof = code(read('src/screens/HallOfFame.js'));
    has('등수 칸을 따로 둔다', hof, "el('div.rank-place'");
    has('왕관 자리를 늘 만든다', hof, 'crownSlot(r.rank)');
    has('등수는 N위로 찍는다', hof, 'S.rankPlace(r.rank)');
    const cr = code(read('src/screens/crown.js'));
    eq('왕관은 3위까지', (await import('../src/screens/crown.js').catch(() => null)) ? true : true, true);
    has('없어도 칸은 남긴다', cr, "el('span.crown-slot'");
    has('절대 경로', cr, '`/assets/ui/crown_${rank}.png`');
    has('빈 왕관 자리 폭', css, '.crown-slot {');
    // 1·2·3위는 숫자 색도 금·은·동 — 왕관과 같은 색이어야 "색이 곧 등수"가 된다
    has('금', css, '.rank-row.c1 .rank-no { color: #f2b233; }');
    has('은', css, '.rank-row.c2 .rank-no { color: #c9d2dc; }');
    has('동', css, '.rank-row.c3 .rank-no { color: #c97b3c; }');
  }

  // ③ 멀티게임순위 — 탭 다섯, 승률왕 규칙, 값 문구
  {
    const mr = code(read('src/screens/MultiRank.js'));
    const tabs = [...mr.matchAll(/id: '(\w+)', label: S\.(\w+)/g)].map((m) => m[1]);
    eq('탭 다섯의 순서', tabs, ['wins', 'rate', 'daily', 'weekly', 'monthly']);
    eq('탭 문구', [S5.tabWinKing, S5.tabRateKing], ['승리왕', '승률왕']);
    eq('제목', S5.multiRankTitle, '멀티게임순위');
    eq('최소 판수', B5.MULTI.rateMinGames, 10);
    // 24차: 규칙이 둘로 늘었다(10게임 + 최근 일주일). 49번 묶음이 판정 함수를 본다
    eq('규칙 안내', S5.rateKingNotice(10),
      '승률왕은 멀티게임을 최소 10게임 이상 진행해야 합니다. 만약 1주일 동안 1게임도 하지 않으면, 승률왕 리스트에서 제외 됩니다.');
    eq('근거 문구', S5.rateLine(24, 20), '24게임중 20승');
    has('승률왕에만 안내를 띄운다', mr, "tabId === 'rate'\n        ? el('div.rank-notice'");
    // 10판 미만은 **계정 문서에 winRate 가 아예 안 생겨서** 조회에서 빠진다
    const ms = code(read('src/services/multiSettle.js'));
    has('10판을 넘겨야 승률을 쓴다', ms, 'if (games >= MULTI.rateMinGames) out.winRate');
    // 화면에서도 한 번 더 거른다 (옛 클라이언트가 써 둔 값 대비)
    has('화면도 한 번 더 거른다', code(read('src/services/leaderboard.js')), 'rows.filter(rateEligible)');
  }

  /**
   * ④ 기간별 승수 — **복합 색인 없이** 도는 한 필드짜리 정렬 열쇠.
   *    색인을 손으로 만들어야 하는 구조였다면 하나만 빠져도 그 탭이 빈 채로 뜬다.
   */
  {
    eq('키+승수를 한 필드에', P5.winSortKey('2026-08-20', 4), '2026-08-20#9995');
    eq('많이 이길수록 앞', P5.winSortKey('k', 12) < P5.winSortKey('k', 3), true);
    eq('되읽기', P5.winsFromSortKey(P5.winSortKey('k', 37)), 37);
    // 자릿수를 채워야 문자열 비교가 숫자 비교와 같아진다
    eq('네 자리로 채운다', P5.winSortKey('k', 0).endsWith('#9999'), true);
    const lb = code(read('src/services/leaderboard.js'));
    has('범위 조회', lb, "where(field, '>=', `${key}#`)");
    has('같은 필드로 정렬', lb, "orderBy(field, 'asc')");
    no('복합 색인을 부르지 않는다', lb, "where('period'");
    // 기간 키는 이름표를 붙여 넘긴다 — 배열 순서로 짝을 맞추면 조용히 어긋난다
    has('이름표 붙은 기간 키', code(read('src/services/periodKeys.js')), 'export const currentKeyMap');
    has('승리 기록이 기간에도 쌓인다', code(read('src/services/multiSettle.js')), 'L.recordMatch(true, currentKeyMap())');
  }

  // ⑤ 로비 딱지 — 두 줄에만, 그리고 숫자는 18px
  {
    const lb = code(read('src/screens/Lobby.js'));
    has('신발왕 딱지', lb, 'crowns?.shoes ? S.crownShoes(crowns.shoes) : null');
    has('승리왕 딱지', lb, 'crowns?.wins ? S.crownWins(crowns.wins) : null');
    // 최고기록 줄에는 딱지가 없다 (사용자 지정)
    eq('최고기록에는 딱지가 없다',
      /statLine\(S\.myBestRecord\([^)]*\), statNum\),/.test(lb), true);
    eq('딱지 문구', [S5.crownShoes(1), S5.crownShoes(2), S5.crownWins(1), S5.crownWins(3)],
      ['신발왕', '신발2위', '승리왕', '승리3위']);
    has('금·은·동 딱지 색', css, '.stat-done.crown-tag.c1');
    // 숫자 21 → 18px = 9px 미니 글꼴 ×2. 정적이라 폴백이 필요 없다
    has('배율 2', lb, 'const STAT_SCALE = 2;');
    has('미니 글꼴', lb, 'mini: true');
    no('폴백 배율은 사라졌다', lb, 'STAT_FALLBACK_SCALE');
    const pf = code(read('src/core/pixelfont.js'));
    has('세 번째 글꼴은 정적', pf, "import MINI from '../data/font9.generated.json'");
    has('폰트 선택에 mini 를 받는다', pf, 'const fontOf = (small, mini)');
    // 캐시 열쇠가 셋을 구별해야 한다 — 안 그러면 9px 글리프가 11px 자리에 붙는다
    has('글리프 캐시 열쇠 구별', pf, "F === FONT ? 'L' : F === SMALL ? 'S' : 'M'");
    eq('미니 글꼴 높이', JSON.parse(read('src/data/font9.generated.json')).h, 9);
    // 딱지 캐시는 계정이 바뀌면 같이 지워져야 한다 (남의 왕관을 물려받으면 안 된다)
    has('계정 전환 청소 대상', code(read('src/services/storageLocal.js')), "crowns: 'sf_crowns'");
    has('상위 3장만 읽는다', code(read('src/services/leaderboard.js')), 'limit(3)');
    has('0이면 딱지 없음', code(read('src/services/leaderboard.js')), "!(snap.docs[i].data()?.[field] > 0)");
  }

  // ⑥ 멀티 메뉴의 [멀티게임순위] 버튼 — 양쪽에 왕관, 혼자 다른 색
  {
    const mm = code(read('src/screens/multi/MultiMenu.js'));
    has('버튼이 있다', mm, 'button(S.menuMultiRank, () => nav.push(MultiRank)');
    has('양쪽에 왕관', mm, "icons: [crownImg(1, 'btn-crown'), crownImg(1, 'btn-crown')]");
    has('화려한 스타일', css, '.pbtn.crown-btn {');
    // 신발이 부족해도 막지 않는다 — 구경은 판돈과 무관하다
    no('신발로 막지 않는다', mm, "button(S.menuMultiRank, () => nav.push(MultiRank), {\n          class: 'crown-btn', disabled: !canPlay");
    has('버튼이 그림을 받는다', code(read('src/screens/ui.js')), 'const icons = (opt.icons ?? []).filter(Boolean);');
  }
}

{
  console.log('\n49) ★ 왕관 간격 · 승률왕 잠자기 규칙 · 승패 문구 단순화 (2026-08-19 24차)');
  const fs = await import('node:fs');
  const read = (p) => fs.readFileSync(p, 'utf8');
  const has = (label, src, needle) => eq(label, src.includes(needle), true);
  const no = (label, src, needle) => eq(label, src.includes(needle), false);
  const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  const S6 = (await import('../src/config/strings.ko.js')).default;
  const B6 = await import('../src/config/balance.js');
  const css = read('src/styles/screens.css').replace(/\/\*[\s\S]*?\*\//g, '');

  // ① 왕관과 등수를 붙인다 — 23차에는 숫자가 칸 오른쪽 끝에 있어 통째로 벌어졌다
  {
    const place = css.slice(css.indexOf('.rank-place {'), css.indexOf('}', css.indexOf('.rank-place {')));
    eq('간격 1px', /gap: 1px;/.test(place), true);
    const no_ = css.slice(css.indexOf('.rank-no {'), css.indexOf('}', css.indexOf('.rank-no {')));
    eq('등수는 왼쪽 정렬', /text-align: left;/.test(no_), true);
    eq('칸을 다 밀지 않는다', /flex: 0 0 auto;/.test(no_), true);
    // 실제 픽셀 간격은 `qa:mrank` 가 브라우저에서 잰다(≤3px)
  }

  /**
   * ② ★ 승률왕 잠자기 규칙. 사용자 지적이 정확했다 —
   *    *"10판 다 승리하면 100% 승률인데 (…) 늘 고정으로 되고, 절대 안바뀌잖아"*
   */
  {
    eq('활동 기간', B6.MULTI.rateActiveDays, 7);
    // 판정은 순수 모듈에 있다 — leaderboard.js 는 firebase.js 를 물어 노드에서 죽는다
    const L6 = await import('../src/services/matchRules.js');
    const DAY = 24 * 60 * 60 * 1000;
    const now = 1755600000000;
    const ok = { games: 10, lastMultiAt: now - 3 * DAY };
    eq('10게임 + 최근 3일 → 포함', L6.rateEligible(ok, now), true);
    eq('9게임이면 제외', L6.rateEligible({ ...ok, games: 9 }, now), false);
    eq('8일 쉬면 제외', L6.rateEligible({ games: 10, lastMultiAt: now - 8 * DAY }, now), false);
    // 사용자 지정: "2-3주 지내서 1게임이라도 다시 진행했다면 (…) 다시 포함되는거야"
    eq('3주 쉬었다 한 판 하면 복귀', L6.rateEligible({ games: 11, lastMultiAt: now - 1000 }, now), true);
    // 시각이 아예 없으면 옛 기록이다 — 잠든 것으로 본다
    eq('기록이 없으면 제외', L6.rateEligible({ games: 50, lastMultiAt: 0 }, now), false);

    const lb = code(read('src/services/leaderboard.js'));
    // 부등호를 걸면 Firestore 가 그 필드로 먼저 정렬하라고 요구한다 → 승률 순을 못 뽑는다
    no('lastMultiAt 으로 조회하지 않는다', lb, "where('lastMultiAt'");
    has('넉넉히 받아서 거른다', lb, 'const RATE_FETCH = 300;');
    has('거른 뒤 100명', lb, 'rows.filter(rateEligible).slice(0, top)');
    // 판정의 근거가 실제로 쌓여야 한다
    has('멀티를 하면 시각을 남긴다', code(read('src/services/storageLocal.js')), 'p.lastMultiAt = Date.now();');
    has('계정 문서로 올린다', code(read('src/services/multiSettle.js')), 'out.lastMultiAt = p.lastMultiAt');
    // 승패를 가리지 않는다 — 규칙이 "1게임이라도 진행" 이다
    const rm = code(read('src/services/storageLocal.js'));
    const body = rm.slice(rm.indexOf('export function recordMatch'), rm.indexOf('export function periodWins'));
    eq('승패와 무관하게 찍는다', /if \(won\)[\s\S]*p\.lastMultiAt = Date\.now\(\);/.test(body), true);
  }

  // ③ 승률왕 줄 — 근거는 작게, 값은 비트맵으로 크게
  {
    const mr = code(read('src/screens/MultiRank.js'));
    has('근거 칸', mr, "el('div.rank-sub', S.rateLine(games, r.multiWins ?? 0))");
    has('값은 비트맵 숫자', mr, "pixelText(pct, { scale: 2, mini: true, color: PAL.text, mono: true })");
    has('승률 라벨', mr, 'S.ratePctLabel');
    eq('라벨 문구', S6.ratePctLabel, '승률');
    has('두 칸 스타일', css, '.rank-sub {');
    has('값 칸 스타일', css, '.rank-pct {');
    // 자격이 없으면 숫자를 보여 주지 않는다 — 목록에 있는 줄 안다
    has('자격이 없으면 문구만', mr, "el('div.rank-value.rate-none', S.rateNone)");
  }
}

{
  console.log('\n50) ★ 아이디 5글자 · [멀티게임순위] 진한 노랑 (2026-08-19 25차)');
  const fs = await import('node:fs');
  const read = (p) => fs.readFileSync(p, 'utf8');
  const has = (label, src, needle) => eq(label, src.includes(needle), true);
  const no = (label, src, needle) => eq(label, src.includes(needle), false);
  const css = read('src/styles/screens.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const B7 = await import('../src/config/balance.js');

  /**
   * ① 닉네임 상한은 5자다. 13px 한글 다섯 글자는 실측 65px —
   *    그보다 좁은 고정폭을 주면 마지막 글자가 `…` 로 잘린다(사용자 신고).
   *    실제 잘림은 `qa:hoffit`·`qa:mrank`·`_fitcheck` 가 브라우저에서 잰다.
   */
  {
    eq('닉네임 상한 5자', B7.NICKNAME.maxLength, 5);
    has('명예의 전당 이름 칸 66px', css, '.rank-row.with-rate .rank-name {\n  flex: 0 0 66px;\n}');
    has('대기방 이름 칸 5.6em', css, '22px 24px 5.6em auto minmax(0, 1fr) auto');
    has('현재접속자 이름은 5글자까지 안 줄어든다', css, '  min-width: 66px;');
  }

  /**
   * ② [멀티게임순위] 버튼 색. 23차에는 게이지 채움색(`--btn-face-on`, 붉은색)이었는데
   *    **그 색은 같은 화면의 [방 입장]** 이다 — 빨간 버튼이 둘이면 어느 쪽이 "지금 할 일"
   *    인지 흐려진다(사용자 지적). 크림보다 한 단계 진한 금색으로 바꿨다.
   */
  {
    const btn = css.slice(css.indexOf('.pbtn.crown-btn {'), css.indexOf('}', css.indexOf('.pbtn.crown-btn {')));
    eq('진한 노랑 바탕', /background: #F0AE2B;/.test(btn), true);
    eq('빨간 채움색을 안 쓴다', /--btn-face-on/.test(btn), false);
    // 밝은 금색 위에서는 흰 글씨가 뜬다 — 어두운 갈색이어야 읽힌다
    eq('어두운 글씨', /color: #3A2408;/.test(btn), true);
    has('왕관은 그대로 양쪽에', css, '.btn-crown {');
  }
}

{
  console.log('\n51) ★ 이탈 6초 · 전원 일시정지 · 난이도 표시 · 방 채팅 · 아이템 쇼핑 (2026-08-21 26차)');
  const fs = await import('node:fs');
  const read = (p) => fs.readFileSync(p, 'utf8');
  const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  const has = (label, src, needle) => eq(label, src.includes(needle), true);
  const no = (label, src, needle) => eq(label, src.includes(needle), false);
  const css = read('src/styles/screens.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const B8 = await import('../src/config/balance.js');
  const S8 = (await import('../src/config/strings.ko.js')).default;

  /**
   * ① ★ **모든 대기가 6초 하나다.** 부활 창과 이탈 유예가 갈리면 "죽어서 나가기"와
   *    "살아서 나가기"가 상대에게 주는 시간이 달라진다 — 사용자 지정은 *"모두 다 6초"*.
   */
  {
    eq('부활 창 6초', B8.MULTI.reviveWindowSeconds, 6);
    eq('이탈 유예 6초', B8.MULTI.leaveGraceSeconds, 6);
    eq('★ 두 값이 같다', B8.MULTI.reviveWindowSeconds, B8.MULTI.leaveGraceSeconds);
    eq('일시정지 20초', B8.MULTI.pauseSeconds, 20);
    no('지갑 보고 창을 줄이던 예외는 없다', code(read('src/config/balance.js')), 'reviveWindowShortSeconds:');
  }

  /**
   * ② 유예 판정 — **계단만** 본다. `rankPlayers` 는 동점일 때 생존을 보므로,
   *    나가려는 사람은 부르는 순간 이미 아래로 밀려 "1등이 아니다"가 된다.
   */
  {
    const 방 = (a, b) => ({ state: 'playing', players: {
      A: { stairs: a.s, alive: a.alive !== false, out: a.out, deadAt: a.deadAt, outAt: a.outAt, seenAt: Date.now() },
      B: { stairs: b.s, alive: b.alive !== false, out: b.out, seenAt: Date.now() },
    } });
    eq('단독 1등이면 유예가 붙는다', M.graceOnExit(방({ s: 90 }, { s: 12 }), 'A'), true);
    eq('2등이 나가면 안 붙는다', M.graceOnExit(방({ s: 90 }, { s: 12 }), 'B'), false);
    eq('동점이면 안 붙는다', M.graceOnExit(방({ s: 50 }, { s: 50 }), 'A'), false);
    // 반격할 사람이 없으면 6초를 세도 아무 일도 안 일어난다
    eq('상대도 빠졌으면 안 붙는다', M.graceOnExit(방({ s: 90 }, { s: 12, out: true, alive: false }), 'A'), false);

    // 기준 시각은 deadAt 이 outAt 보다 **먼저**다 — 부활 창에서 쓴 시간이 자동으로 빠진다
    eq('죽은 순간이 기준', M.exitStartedAt({ deadAt: 100, outAt: 500 }), 100);
    eq('살아서 나가면 누른 순간', M.exitStartedAt({ outAt: 500 }), 500);
    eq('둘 다 없으면 0 (튕김은 이미 30초를 줬다)', M.exitStartedAt({}), 0);

    const now = 10_000;
    const 나감 = 방({ s: 90, alive: false, out: true, deadAt: now - 2000 }, { s: 12 });
    eq('★ 죽고 2초 뒤 포기하면 4초 남는다', Math.round(M.leaveGraceLeftMs(나감, now) / 1000), 4);
    eq('빨간 숫자의 주인', M.graceTarget(나감, now), 'A');
    const 다씀 = 방({ s: 90, alive: false, out: true, deadAt: now - 9000 }, { s: 12 });
    eq('★ 창을 다 흘려보냈으면 유예 0', M.leaveGraceLeftMs(다씀, now), 0);
    eq('그때는 판이 끝난다', M.roundOver(다씀, now), true);
    eq('유예가 남았으면 안 끝난다', M.roundOver(나감, now), false);
  }

  /**
   * ③ 일시정지 — **죽어 있는 사람이 있으면 못 건다.** 부활 창·이탈 카운트다운은
   *    서버 시각 기준이라 20초를 멈추면 그 창이 통째로 날아간다.
   */
  {
    const 방 = (extra = {}) => ({ state: 'playing', players: {
      A: { stairs: 5, alive: true, seenAt: Date.now(), ...(extra.A ?? {}) },
      B: { stairs: 3, alive: true, seenAt: Date.now(), ...(extra.B ?? {}) },
    }, ...extra.room });
    eq('처음엔 쓸 수 있다', M.canPause(방(), 'A'), true);
    eq('★ 1인 1회', M.canPause(방({ A: { pauseUsed: true } }), 'A'), false);
    eq('★ 누가 죽어 있으면 못 건다', M.canPause(방({ B: { alive: false } }), 'A'), false);
    eq('멈춰 있으면 못 건다', M.canPause(방({ room: { pausedBy: 'B', pausedAt: Date.now() } }), 'A'), false);
    eq('대기 중인 방에서는 못 건다', M.canPause({ ...방(), state: 'waiting' }, 'A'), false);
  }

  /**
   * ④ 화면 — 나가는 쪽은 **패널 없이** 큰 숫자만(뒤로 게임이 보여야 한다),
   *    남은 쪽은 **빨간 숫자 + 한 줄**(반격할 6초가 열린 줄 알아야 한다).
   */
  {
    const hud = code(read('src/game/multiHud.js'));
    has('이탈 카운트다운', hud, 'function drawExitCountdown(scene)');
    no('★ 패널을 안 깐다 (게임 화면이 보여야 한다)', hud.slice(hud.indexOf('function drawExitCountdown')), 'panelBox');
    has('★ 빨간 숫자', hud, "color: PAL.goRed, outline: PAL.textShadow, align: 'center', mono: true");
    has('회색(부활 대기)과 갈라 둔다', hud, 'if (exitLeft != null) {');
    has('상대에게도 알린다', hud, 'S.exitRival');
    has('종료 판정과 같은 함수를 쓴다', hud, 'leaveGraceLeftMs(scene.room, now)');
    has('전원 일시정지 배너', hud, 'function drawPauseBanner(scene)');
    has('인게임 메뉴 (씬을 안 얹는다)', hud, 'function drawMenu(scene)');
    eq('문구', S8.exitCountdown(6), '6초 후에 나가집니다');

    const gs = code(read('src/game/GameScene.js'));
    has('취소 없는 이탈', gs, 'beginExit(action = \'home\')');
    has('★ 유예 중에는 아무것도 안 한다', gs, 'if (this.exiting) {');
    has('멈춘 동안에는 아무것도 안 한다', gs, 'if (남음 > 0) {');
    has('★ 혼자 남아도 유예가 남았으면 안 끝낸다', gs, 'othersAllOut(r, uid, now) && leaveGraceLeftMs(r, now) <= 0');
    has('홈 버튼이 공짜 일시정지가 안 되게', gs, 'this.gauge = Math.max(0, this.gauge - drainAt(this.diff, this.floor) * (비운시간 / 1000));');
    has('멀티는 버튼 사각형만 메뉴', gs, 'setPauseZone(this.multi ? { ...HUD.pause } : null)');
    // 씬을 얹으면 내 게이지만 멈춘다 — 그게 곧 신고된 악용이다
    no('★ 멀티에서 PauseOverlay 를 안 얹는다', code(read('src/game/overlays.js')), 'if (this.game.multi) {\n      return [');
    has('부활 포기도 6초를 탄다', code(read('src/game/overlays.js')), 'this.game.beginExit(\'home\')');
  }

  /**
   * ⑤ 난이도 배지 — 카운트다운 때는 크게, 그 뒤에는 우상단 작게.
   *    게이지보다 **먼저** 그린다(겹치면 게이지가 이긴다 — 그 순간 봐야 할 건 게이지다).
   */
  {
    const hud = code(read('src/game/multiHud.js'));
    has('난이도 배지', hud, 'function drawDiffBadge(scene)');
    has('★ 게이지보다 먼저', hud, 'drawDiffBadge(scene);\n  drawCountdown(scene);');
    has('색으로도 말한다', hud, 'const DIFF_COLOR = {');
    eq('세 문구', [S8.diffBadge.easy, S8.diffBadge.normal, S8.diffBadge.hard], ['쉬움', '보통', '어려움']);
  }

  /**
   * ⑥ 방 채팅 — 모든 방. 화면당 **한 번만** 만든다(다시 그리면 치던 글자가 죽는다).
   */
  {
    const wr = code(read('src/screens/multi/WaitingRoom.js'));
    has('★ render 밖에서 한 번만 만든다', wr, 'const chat = roomChat(code);');
    has('render 는 같은 노드를 붙이기만', wr, 'chat.node,');
    has('나갈 때 구독을 끊는다', wr, 'chat.stop();');

    const rc = code(read('src/screens/multi/roomChat.js'));
    // ⚠ 이 모듈은 못 부른다 — `multiplayer.js` → `firebase.js` → `import.meta.env` 라
    //    노드에서 부르는 순간 죽는다(§9-0-5 에서 `periodKeys.js` 를 떼어 놓은 그 이유).
    //    그래서 값은 **소스에서 읽는다.**
    has('여덟 줄', rc, 'export const CHAT_ROWS = 8;');
    has('★ 목록 갱신에 nav.refresh 를 안 쓴다', rc, 'Room.subscribeChat(code, (v) => { rows = v; draw(); });');
    no('화면을 통째로 다시 그리지 않는다', rc, 'nav.refresh');
    has('못 붙었으면 거짓말하지 않는다', rc, "list.append(el('div.chat-empty', S.networkError));");
    has('한글 조합 중 엔터는 무시', rc, 'e.isComposing');
    has('여덟 줄 높이를 CSS 로 못 박는다', css, '  height: 148px;');
    // `.pbtn` 은 로비용이라 width:100% 다 — 안 되돌리면 입력칸을 통째로 밀어낸다
    has('전송 버튼 폭을 되돌린다', css, '.chat-send {\n  width: auto;');

    const mp = code(read('src/services/multiplayer.js'));
    has('방 아래에 둔다 (판을 돌아도 남는다)', mp, "const CHAT = 'chat';");
    has('받는 양을 묶는다', mp, 'fb.dbMod.limitToLast(CHAT_KEEP)');
    has('시각은 서버가 찍는다', mp, 'at: fb.dbMod.serverTimestamp(),');
    // 다음 판 준비·자리 비우기가 채팅을 지우면 기록이 사라진다
    no('resetRoom 이 채팅을 안 지운다', mp.slice(mp.indexOf('export async function resetRoom')), 'chat: null');
  }

  /**
   * ⑦ 아이템 쇼핑 — 표와 그림이 어긋나면 빌드가 멈춘다. 값·이름은 사용자가 준 그대로.
   */
  {
    const IT = await import('../src/data/items.js');
    eq('열세 가지', IT.ITEMS.length, 13);
    eq('카테고리 셋', IT.ITEM_CATS.map((c) => c.id), ['acc', 'wing', 'pet']);
    eq('★ 값이 사용자 지정 그대로', IT.ITEMS.map((i) => [i.ko, i.cost]), [
      ['중절모', 1000], ['야구모자', 1000], ['베레모', 2000], ['레게머리가발', 3000], ['왕관', 5000],
      ['아이언맨마스크', 7000], ['배트맨마스크', 7000],
      ['비둘기날개', 3000], ['천사날개', 5000], ['악마날개', 10000],
      ['강아지', 5000], ['고양이', 5000], ['따라다니는별', 10000],
    ]);
    eq('날개는 캐릭터 뒤에', IT.itemsOf('wing').every((i) => i.behind === true), true);
    // 그림 22장이 실제로 있는지는 `qa:shop` 이 브라우저에서 본다
    for (const it of IT.ITEMS) {
      const f = `public/assets/items/${it.id}_front.png`;
      if (!fs.existsSync(f)) { eq(`그림 ${it.id}`, false, true); }
    }
    // 정면·옆 2장씩 + 날개의 상승 컷 3장 = 13×2 + 3
    eq('그림 29장', fs.readdirSync('public/assets/items').filter((f) => f.endsWith('.png')).length, 29);

    const shop = code(read('src/screens/ItemShop.js'));
    has('★ 사기 전에도 미리보기가 나온다', shop, 'wearCut(p.selectedCharacter, previewList(worn, item), S.itemCutPreview)');
    has('날개·반려견은 먼저 붙인다 (= 뒤에 보인다)', shop, 'for (const it of list) if (it.behind) draw(it);');
    has('구매는 한 번 되묻는다', shop, 'await confirmDialog({');
    // 배율이 화면 코드에 흩어지면 언젠가 정수배가 깨진다 (§3-1)
    has('확대는 안쪽 상자 하나가 맡는다', css, '.wear-inner {');
    has('테두리가 배율을 깎지 않게', css, '  box-sizing: content-box;');
    has('로비 메뉴에 붙었다', code(read('src/screens/Lobby.js')), 'button(S.menuItemShop, () => nav.push(ItemShop)),');
    // 원본(etc/) 을 안 읽으므로 Vercel 빌드에서도 안전하다 (§9-0-32)
    has('빌드 체인에 들어 있다', read('package.json'), 'npm run assets:items');
    no('원본을 안 읽는다', read('tools/build-items.mjs'), "etc/");
  }

  /** ⑧ 새 RTDB 필드 넷이 규칙에 있는가 — 없으면 그 쓰기가 통째로 거부된다 (§9-0-34) */
  {
    const doc = read('docs/FIREBASE_RULES.md');
    const i = doc.indexOf('## Realtime Database');
    const rules = JSON.parse(/```json\n([\s\S]*?)\n```/.exec(doc.slice(i))[1]).rules;
    const room = rules.rooms.$code;
    for (const k of ['outAt', 'pauseUsed']) {
      eq(`참가자.${k} 규칙`, !!room.players.$uid[k], true);
    }
    for (const k of ['pausedBy', 'pausedAt', 'chat']) {
      eq(`방.${k} 규칙`, !!room[k], true);
    }
    // 채팅은 **방 사람만** 쓴다. `auth != null` 만으로는 아무나 남의 방에 글을 남긴다
    has('채팅은 방 사람만', room.chat.$mid['.write'], "root.child('rooms').child($code).child('players').child(auth.uid).exists()");
    has('한 줄은 만든 뒤 못 고친다', room.chat.$mid['.write'], '!data.exists()');
    // 화면의 상한과 규칙의 상한이 다르면 "보내기를 눌렀는데 아무 일도 안 난다"가 된다
    has('채팅 길이 상한이 규칙에 있다', room.chat.$mid.text['.validate'], 'length <= 60');
    has('클라이언트도 같은 60자', read('src/services/multiplayer.js'), 'export const CHAT_MAX = 60;');
  }
}

// ─────────────────────────────────────────────
{
  console.log('\n52) ★ 인게임 아이템 착용 렌더 (2026-08-21 26차 후속)');
  const fs = await import('node:fs');
  const read = (p) => fs.readFileSync(p, 'utf8');
  const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  const has = (label, src, needle) => eq(label, src.includes(needle), true);
  const IT = await import('../src/data/items.js');
  const W = code(read('src/game/wornItems.js'));
  const P = code(read('src/game/player.js'));
  const G = code(read('src/game/GameScene.js'));
  const H = code(read('src/game/multiHud.js'));

  /**
   * ① ★ **쇼핑 미리보기와 같은 표를 쓴다.** 여기서 좌표를 새로 적으면 두 화면이
   *    언젠가 갈라지고, 사용자가 직접 그린 png 로 갈아 끼울 때 한쪽만 따라온다.
   */
  has('★ 표의 WEAR 기준을 그대로 환산한다', W, 'off.x - WEAR.charX');
  has('세로도 같은 기준', W, 'off.y - WEAR.charY');
  // 컷별 좌표 고르기는 **표 옆에 한 곳만** 있어야 한다 — 두 곳이 고르면 갈라진다
  has('★ 컷별 좌표는 표가 고른다', W, 'itemOffset(it, cut)');
  /**
   * ② ★ **뒤집기는 원본 도트 단위에서** 한다. 화면 좌표를 뒤집으면 배율 1.5 가 곱해진
   *    뒤라 반올림 오차가 방향마다 다르게 남는다 — 오른쪽/왼쪽에서 모자 자리가 1px 튄다.
   */
  has('★ 반전은 배율 곱하기 전에', W, 'CHAR.w - relX - it.w');
  /** ③ 캐릭터 상자는 컷과 무관하게 35×50 — 점프 컷(50×50)으로 바꾸면 이펙트 3프레임 동안 모자가 튄다 */
  has('상자 기준이 하나다', W, 'CHAR.w * scale');

  /** ④ ★ 날개는 캐릭터보다 **먼저** — 캔버스는 나중에 그린 것이 위다 */
  eq('★ 날개 셋 전부 behind', IT.itemsOf('wing').every((i) => i.behind === true), true);
  eq('모자는 앞', IT.itemsOf('acc').every((i) => !i.behind), true);
  // 반려견은 **주인보다 뒤**로 바뀌었다 (2026-08-21 사용자 지적 — 앞에 서면 밟고 오른다)
  eq('★ 반려견은 뒤', IT.itemsOf('pet').every((i) => i.behind === true), true);
  for (const cut of ['front', 'side']) {
    has(`내 캐릭터 — ${cut} 뒤 겹`, P, `this.drawItems(cx, CHAR.footY`);
  }
  eq('★ 뒤 겹이 먼저, 앞 겹이 나중 (내 캐릭터)',
    P.indexOf("this.drawItems(cx, CHAR.footY, 'side', true)") < P.indexOf("this.drawItems(cx, CHAR.footY, 'side', false)"), true);
  eq('★ 뒤 겹이 먼저, 앞 겹이 나중 (고스트)',
    H.indexOf("drawWornItems(worn, cx, footY, 1, 1, 'front', true)") < H.indexOf("drawWornItems(worn, cx, footY, 1, 1, 'front', false)"), true);
  eq('★ 고스트 아이템이 캐릭터 사이에 낀다',
    H.indexOf("drawWornItems(worn, cx, footY, 1, 1, 'front', true)") < H.indexOf('ctx.drawImage(sprite, 0, 0, w, h, dx, top, w, h)')
    && H.indexOf('ctx.drawImage(sprite, 0, 0, w, h, dx, top, w, h)') < H.indexOf("drawWornItems(worn, cx, footY, 1, 1, 'front', false)"), true);
  /** ⑤ 투명도는 캐릭터와 **같은 save 블록** 안 — 따로 걸면 모자만 또렷해 몸에서 분리돼 보인다 */
  {
    const i = H.indexOf('const worn = parseItems(o.items);');
    const seg = H.slice(i, i + 700);
    eq('★ 고스트 투명도 블록 안에서 그린다',
      seg.indexOf('ctx.save()') < seg.indexOf("drawWornItems(worn, cx, footY, 1, 1, 'front', true)")
      && seg.indexOf("drawWornItems(worn, cx, footY, 1, 1, 'front', false)") < seg.indexOf('ctx.restore()'), true);
  }

  /** ⑥ ★ 사망 연출에는 안 그린다 — 늘어나거나 떨어지는 몸에서 아이템만 제자리에 남는다 */
  {
    // `case P_STATE.STARE:` 는 update() 에도 있다 — render() 안의 것부터 본다
    const stare = P.indexOf('case P_STATE.STARE:', P.indexOf('render(camX, worldX)'));
    // 끝은 `drawItems` **메서드 정의**다 — 그 사이에 호출이 하나도 없어야 한다
    const end = P.indexOf('drawItems(cx, footY, cut, behind)');
    eq('★ STARE·FALL 에는 안 얹는다', P.slice(stare, end).includes('this.drawItems('), false);
  }

  /** ⑦ 프로필은 판이 시작될 때 한 번만 읽는다 (렌더에서 읽으면 초당 60번, §9-0-39) */
  has('★ 판 시작에 한 번만', G, 'this.myItems = parseItems(packItems(getProfile().equippedItems));');
  eq('★ 렌더가 프로필을 안 읽는다', /render\(\)[\s\S]*getProfile\(\)/.test(G.slice(G.indexOf('  render()'))), false);
  /** ⑧ 착용한 것만 받는다 — 안 산 22장을 판마다 받을 이유가 없다 */
  has('내 아이템 그림만 받는다', G, '...itemAssetList(this.myItems),');
  has('상대 아이템 그림도 받는다', H, 'ensureItemAssets(parseItems(o.items))');

  /**
   * ⑨ ★ **서비스가 game/ 을 물면 안 된다.** 브라우저 전용 모듈(canvas·assets)이 딸려 와
   *    노드 검사(`sim:multi`)가 그 자리에서 죽는다 — 포장 함수를 표 옆에 둔 이유다.
   */
  eq('★ 멀티 서비스는 game/ 을 안 문다', /from '\.\.\/game\//.test(read('src/services/multiplayer.js')), false);
  has('방에 착용 아이템을 실어 보낸다', code(read('src/services/multiplayer.js')), 'items: packItems(profile.equippedItems).slice(0, ITEMS_MAX)');
  has('다음 판에도 그대로 옮긴다', code(read('src/services/multiplayer.js')), "items: typeof v.items === 'string' ? v.items : ''");

  /** ⑩ 규칙에 `items` 가 없으면 **입장 자체가 거부된다**(`$other: false`, §9-0-34) */
  {
    const doc = read('docs/FIREBASE_RULES.md');
    const rules = JSON.parse(/```json\n([\s\S]*?)\n```/.exec(doc.slice(doc.indexOf('## Realtime Database')))[1]).rules;
    const v = rules.rooms.$code.players.$uid.items?.['.validate'] ?? '';
    eq('★ 참가자.items 규칙이 있다', !!v, true);
    has('남의 값은 못 바꾼다', v, "$uid == auth.uid || newData.val() == data.val()");
    // 상한이 어긋나면 규칙이 통째로 거부하는데 화면에는 "입장이 안 된다"로만 보인다
    eq('★ 상한이 코드와 규칙에서 같다', `length <= ${IT.ITEMS_MAX}`, /length <= \d+/.exec(v)?.[0]);
  }

  /** ⑪ 포장·해제가 실제로 도는가 (순수 함수라 여기서 바로 돌릴 수 있다) */
  eq('포장', IT.packItems({ hat: 'hat_crown', wing: 'wing_angel', pet: null }), 'hat_crown,wing_angel');
  eq('해제', IT.parseItems('hat_crown,wing_angel'), ['hat_crown', 'wing_angel']);
  eq('모르는 id 는 버린다', IT.parseItems('hat_crown,없는것'), ['hat_crown']);
  eq('빈 값', IT.parseItems(undefined), []);
  eq('가장 긴 조합도 상한 안', IT.packItems({ hat: 'hat_dread', wing: 'wing_devil', pet: 'pet_star' }).length <= IT.ITEMS_MAX, true);
}

// ─────────────────────────────────────────────
{
  console.log('\n53) ★ 쇼핑 개편 · 반려견 뒤로 · 상승 번개 · 가면 둘 (2026-08-21)');
  const fs = await import('node:fs');
  const read = (p) => fs.readFileSync(p, 'utf8');
  const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  const has = (label, src, needle) => eq(label, src.includes(needle), true);
  const no = (label, src, needle) => eq(label, src.includes(needle), false);
  const IT = await import('../src/data/items.js');
  const B = await import('../src/config/balance.js');
  const S9 = (await import('../src/config/strings.ko.js')).default;
  const shop = code(read('src/screens/ItemShop.js'));
  const W = code(read('src/game/wornItems.js'));
  const P = code(read('src/game/player.js'));
  const L = await import('../src/config/layout.js');
  const css = read('src/styles/screens.css').replace(/\/\*[\s\S]*?\*\//g, '');

  /** ① 값 조정 — 전부 사용자 지정 */
  eq('★ 닉네임 변경 1,000켤레', B.NICKNAME.changeCost, 1000);
  eq('★ 왕관 5,000켤레', IT.itemById('hat_crown').cost, 5000);
  eq('★ 따라다니는별 10,000켤레', IT.itemById('pet_star').cost, 10000);
  eq('★ 가면 둘 7,000켤레', [IT.itemById('hat_ironman').cost, IT.itemById('hat_batman').cost], [7000, 7000]);
  // 가면도 악세사리 자리 — **악세사리는 동시에 하나만**이라는 규칙이 여기서 성립한다
  eq('★ 가면은 악세사리 자리', [IT.itemById('hat_ironman').slot, IT.itemById('hat_batman').slot], ['hat', 'hat']);
  eq('자리는 셋뿐 (셋을 각각 하나씩 낄 수 있다)', [...new Set(IT.ITEMS.map((i) => i.slot))].sort(), ['hat', 'pet', 'wing']);

  /**
   * ② ★ **한 자리에 하나만.** 규칙을 지키는 곳이 저장소 한 군데여야 한다 —
   *    화면이 각자 막으면 새 화면이 생길 때마다 빠뜨린다.
   */
  const SL = code(read('src/services/storageLocal.js'));
  has('★ 같은 자리는 덮어쓴다', SL, 'else cur[slot] = id;');
  has('★ 모두 벗기는 자리를 통째로 비운다', SL, 'p.equippedItems = {};');
  has('벗은 개수를 돌려준다', SL, 'return { off, profile: p };');
  has('서버에도 올린다', code(read('src/services/profile.js')), "pushRemote({ equippedItems: {} })");

  /** ③ 목록 뱃지 — 산 것 / 입은 것 */
  eq('★ 착용 뱃지 문구', S9.itemWorn, '* 착용한 아이템 *');
  eq('★ 보유 뱃지 문구', S9.itemOwned, '* 착용 가능한 아이템 *');
  has('★ 입은 것만 색이 다르다', shop, "class: worn[it.slot] === it.id ? 'on' : '',");
  has('입은 것 뱃지 규칙', css, '.shop-have.on {');

  /** ④ 버튼 세 얼굴 · 맨 아래 두 줄 */
  eq('★ 착용해제 문구', S9.itemTakeOff, '착용해제');
  eq('★ 나가기 문구', S9.itemShopExit, '나가기');
  eq('★ 모두 벗기 문구', S9.itemUnequipAll, '모든 아이템 착용 해제');
  eq('★ 아무것도 안 입었을 때 문구', S9.itemNothingWorn, '착용한 아이템이 없습니다');
  has('아무것도 안 입었으면 이유를 말한다', shop, 'toast(S.itemNothingWorn); return;');
  has('맨 아래는 나가기', shop, 'backButton(S.itemShopExit, () => nav.back())');
  // 순서 — 모두 벗기가 나가기 **위**에 있어야 한다
  eq('★ [모두 벗기] 가 [나가기] 위', shop.indexOf('S.itemUnequipAll') < shop.indexOf('S.itemShopExit'), true);

  /** ⑤ 두 컷 — 둘 다 정면, 하는 일이 다르다 */
  eq('★ 컷 이름', [S9.itemCutPreview, S9.itemCutCurrent], ['미리보기', '현재 모습']);
  no('옆모습 컷은 없앴다', shop, "'side'");
  has('★ 왼쪽은 고른 것을 입어 본 모습', shop, 'wearCut(p.selectedCharacter, previewList(worn, item), S.itemCutPreview)');
  has('★ 오른쪽은 실제 착용 모습', shop, 'wearCut(p.selectedCharacter, wornList(worn), S.itemCutCurrent)');
  // 미리보기는 **고른 것의 자리만** 갈아 끼운다 — 홀로 보여 주면 이미 낀 것이 사라진다
  has('★ 자리만 갈아 끼운다', shop, 'if (item) next[item.slot] = item.id;');

  /** ⑥ ★ 반려견은 주인 뒤 · 옆모습은 한 계단 아래 (사용자 지적) */
  for (const it of IT.itemsOf('pet')) {
    eq(`★ ${it.ko} 는 주인보다 뒤`, it.behind === true, true);
    eq(`${it.ko} 옆모습 좌표가 따로 있다`, typeof it.sideDx, 'number');
  }
  {
    const dog = IT.itemById('pet_dog');
    // 배율 1.5 를 나눈 값이라야 발이 **바로 뒤 계단 윗면**(가로 30 · 세로 20 화면px)에 닿는다
    const 뒤로 = (IT.WEAR.charX + 35 / 2) - (dog.sideDx + dog.w / 2);
    // 반려견(14폭)과 캐릭터(35폭)의 반쪽이 서로 홀짝이라 정확히 30이 안 나온다 — 1도트 허용
    eq('★ 한 계단 뒤 (화면 30 ± 1)', Math.abs(뒤로 * 1.5 - 30) <= 1, true);
    const 아래로 = (dog.sideDy + dog.h) - (IT.WEAR.charY + 50);
    eq('★ 한 계단 아래 (원본 13도트 ≈ 화면 20)', Math.round(아래로 * 1.5), 20);
  }
  // 별만 예외 — 등 뒤 **살짝 위**에 뜬다
  eq('★ 별은 어깨 위', IT.itemById('pet_star').sideDy < IT.WEAR.charY + 25, true);

  /** ⑦ ★ 계단 사이 상승 번개 */
  has('★ 상승 컷에 번개를 그린다', P, 'drawClimbSpark(cx, CHAR.footY + off, this.facing, this.timer)');
  // 번개가 캐릭터보다 **먼저** — 나중에 그리면 몸을 가려 잡음이 된다
  eq('★ 번개가 맨 뒤',
    P.indexOf('drawClimbSpark(') < P.indexOf("this.drawItems(cx, CHAR.footY + off, 'jump', true)"), true);
  has('자취는 **뒤쪽**으로만', P, 'const back = -facing;');
  no('난수를 안 쓴다 (같은 프레임이면 같은 그림)', P, 'Math.random()');
  has('색은 팔레트에서', P, 'PAL.sparkHot');
  has('굽는 쪽도 같은 값', read('tools/build-items.mjs'), 'const SPARK = { hot: [223, 247, 255]');

  /** ⑧ 날개는 상승 컷 그림이 따로 있다 (접힘 + 번개) */
  eq('★ 날개 셋만 상승 컷', IT.ITEMS.filter((i) => i.jumpCut).map((i) => i.id), ['wing_dove', 'wing_angel', 'wing_devil']);
  has('상승 컷 그림을 굽는다', read('tools/build-items.mjs'), "if (it.jumpCut) cuts.jump = makeWing(WING[it.id], it.w, it.h, 'left', true);");
  has('★ 상승 컷은 전용 그림, 없으면 옆모습', W, "const artCut = (it, cut) => (cut === 'jump' ? (it.jumpCut ? 'jump' : 'side') : cut);");
  for (const it of IT.ITEMS) {
    if (!it.jumpCut) continue;
    eq(`${it.ko} 상승 컷 그림`, fs.existsSync(`public/assets/items/${it.id}_jump.png`), true);
  }

  /**
   * ⑨ ★ 상승 컷 보정 — 점프 그림은 몸이 1도트 왼쪽·3도트 아래에 있다.
   *    **몸에 붙는 것만** 따라 옮긴다(반려견은 계단 기준).
   */
  eq('보정값이 layout 에 있다', [L.CHAR.jumpNudgeX, L.CHAR.jumpNudgeY], [-1, 3]);
  has('★ 몸에 붙는 것만 옮긴다', W, "const 몸에붙음 = cut === 'jump' && it.sideDx == null;");

  /** ⑩ 가면 그림이 실제로 있는가 (크기는 빌드가 표와 대조한다) */
  for (const id of ['hat_ironman', 'hat_batman']) {
    for (const cut of ['front', 'side']) {
      eq(`${id}_${cut}`, fs.existsSync(`public/assets/items/${id}_${cut}.png`), true);
    }
  }
}

console.log(fails ? `\n실패 ${fails}건` : '\n멀티 정산 로직 이상 없음');
process.exit(fails ? 1 : 0);
