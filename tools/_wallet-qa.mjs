/**
 * 지갑 로직 QA (진단 전용) — `node tools/_wallet-qa.mjs`
 *
 * 신발별 보유량(shoesByIndex)이 생기면서 규칙이 늘었다:
 *   · 합계·티어별은 신발별 보유량에서 파생된다 (셋이 어긋나면 안 된다)
 *   · 소비는 높은 티어부터, 같은 티어 안에서는 많이 가진 신발부터
 *   · 예전 프로필(신발별 보유량 없음)은 도감에서 복원한다
 *
 * 브라우저를 띄울 일이 아니라 순수 계산이라 노드에서 직접 돌린다.
 */

// storageLocal 은 localStorage 만 있으면 노드에서도 그대로 돈다
const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
};

const L = await import('../src/services/storageLocal.js');

let fails = 0;
const eq = (label, got, want) => {
  const a = JSON.stringify(got);
  const b = JSON.stringify(want);
  if (a === b) return console.log(`  ok   ${label}`);
  fails++;
  console.log(`  FAIL ${label}\n       got  ${a}\n       want ${b}`);
};

/** 티어 경계: 1티어 0~4 / 2티어 5~14 / 3티어 15~29 / 4티어 30~69 / 5티어 70~129 */
const T1 = 0, T2 = 5, T4 = 30, T5 = 70;

// ─────────────────────────────────────────────
console.log('1) 획득 — 세 숫자가 함께 움직인다');
L.resetAll(); mem.clear();
L.addShoes([T5, T5, T5, T4, T1]);
{
  const p = L.loadProfile();
  eq('신발별', p.shoesByIndex, { [T1]: 1, [T4]: 1, [T5]: 3 });
  eq('티어별', p.shoesByTier, { t1: 1, t2: 0, t3: 0, t4: 1, t5: 3 });
  eq('합계', p.shoesOwned, 5);
}

// ─────────────────────────────────────────────
console.log('2) 소비 — 높은 티어부터, 같은 티어 안에서는 많이 가진 것부터');
L.resetAll(); mem.clear();
// 2티어에 두 종류: 5번을 3켤레, 6번을 1켤레
L.addShoes([T2, T2, T2, T2 + 1, T5, T5]);
eq('소비 성공', L.consumeShoes(2), true);
{
  const p = L.loadProfile();
  // 2티어(더 높은 티어)부터 빠지고, 그 안에서 3켤레짜리부터 깎인다
  eq('신발별', p.shoesByIndex, { [T2]: 1, [T2 + 1]: 1, [T5]: 2 });
  eq('합계', p.shoesOwned, 4);
  eq('티어별', p.shoesByTier, { t1: 0, t2: 2, t3: 0, t4: 0, t5: 2 });
}

console.log('3) 한 티어를 비우면 다음 티어로 넘어간다');
eq('소비 성공', L.consumeShoes(3), true);
{
  const p = L.loadProfile();
  eq('2티어 전부 소진 + 5티어 1켤레', p.shoesByIndex, { [T5]: 1 });
  eq('합계', p.shoesOwned, 1);
}

console.log('4) 모자라면 아무것도 건드리지 않는다');
{
  const before = JSON.stringify(L.loadProfile().shoesByIndex);
  eq('소비 실패', L.consumeShoes(5), false);
  eq('변화 없음', JSON.stringify(L.loadProfile().shoesByIndex), before);
}

// ─────────────────────────────────────────────
console.log('5) 예전 프로필 복원 — 도감에서 지갑을 되살린다');
L.resetAll(); mem.clear();
// 신발별 보유량이 없던 시절의 저장 상태를 손으로 만든다.
// 도감: 5티어 70번 4회, 71번 1회 / 4티어 30번 3회  → 누적 8회
// 지갑: 5티어 3켤레, 4티어 1켤레만 남음 (캐릭터를 사서 4켤레 썼다)
localStorage.setItem('sf_collection', JSON.stringify({
  [T5]: { count: 4, firstFoundAt: 1 },
  [T5 + 1]: { count: 1, firstFoundAt: 2 },
  [T4]: { count: 3, firstFoundAt: 3 },
}));
localStorage.setItem('sf_profile', JSON.stringify({
  nickname: '이안',
  shoesOwned: 4,
  shoesByTier: { t1: 0, t2: 0, t3: 0, t4: 1, t5: 3 },
}));
{
  const p = L.loadProfile();
  // 5티어는 4+1=5켤레 주웠는데 3켤레만 남았다 → 많이 가진 70번부터 2켤레 깎여 2:1
  // 4티어는 3켤레 주웠는데 1켤레만 남았다 → 30번이 1켤레로
  eq('복원된 신발별', p.shoesByIndex, { [T4]: 1, [T5]: 2, [T5 + 1]: 1 });
  eq('합계 유지', p.shoesOwned, 4);
  eq('티어별 유지', p.shoesByTier, { t1: 0, t2: 0, t3: 0, t4: 1, t5: 3 });
  eq('도감은 그대로', L.loadCollection()[String(T5)].count, 4);
}

console.log('6) 복원 후에도 소비가 정상 동작한다');
// 지갑 {30:1, 70:2, 71:1} 에서 2켤레 소비
//   4티어(30번) 1켤레 → 5티어에서 많이 가진 70번 1켤레
//   같은 티어에서 많은 쪽부터 깎으므로 한 종류가 통째로 사라지지 않는다
eq('소비 성공', L.consumeShoes(2), true);
{
  const p = L.loadProfile();
  eq('4티어 먼저, 그 다음 많이 가진 것', p.shoesByIndex, { [T5]: 1, [T5 + 1]: 1 });
  eq('합계', p.shoesOwned, 2);
}

// ─────────────────────────────────────────────
console.log('7) 판 종료 반영 — 도감은 늘고 지갑도 늘어난다');
L.resetAll(); mem.clear();
L.commitRun({ floor: 42, difficulty: 'hard', shoeIndices: [T1, T1, T5] });
{
  const p = L.loadProfile();
  eq('도감 종류', L.dexUnique(), 2);
  eq('도감 누적', L.loadCollection()[String(T1)].count, 2);
  eq('지갑', p.shoesByIndex, { [T1]: 2, [T5]: 1 });
  eq('최고기록', p.bestStairs, 42);
}

// ─────────────────────────────────────────────
console.log('8) 복원은 딱 한 번만 — 신발을 다 써서 지갑이 빈 사람도 다시 계산하지 않는다');
L.resetAll(); mem.clear();
L.commitRun({ floor: 1, difficulty: 'easy', shoeIndices: [T1, T5] }); // 도감 + 지갑
L.consumeShoes(2);                       // 지갑만 정상적으로 비운다
{
  const raw = JSON.parse(localStorage.getItem('sf_profile'));
  eq('지갑 비었음', raw.shoesByIndex, {});
  eq('버전 기록됨', raw.walletVersion, 1);
  // 도감에는 2켤레가 남아 있다. 여기서 복원이 또 돌면 없던 신발이 되살아난다.
  const p = L.loadProfile();
  eq('되살아나지 않는다', p.shoesOwned, 0);
  eq('도감은 그대로', L.dexUnique(), 2);
}

// ─────────────────────────────────────────────
console.log('9) 밖에서 들어온 프로필 — 신발별 보유량만 있어도 합계가 맞는다');
L.resetAll(); mem.clear();
// 원격 문서를 그대로 받아 저장한 상황: 지갑은 있는데 합계·티어별이 비어 있다
localStorage.setItem('sf_profile', JSON.stringify({
  nickname: '이안', walletVersion: 1,
  shoesByIndex: { [T1]: 2, [T4]: 1, [T5]: 5 },
}));
{
  const p = L.loadProfile();
  eq('합계 복구', p.shoesOwned, 8);
  eq('티어별 복구', p.shoesByTier, { t1: 2, t2: 0, t3: 0, t4: 1, t5: 5 });
}

// ─────────────────────────────────────────────
console.log('10) 뱃지 — 도감완성은 "지금 들고 있는 종류"로 판정한다');
const { badgeSlots } = await import('../src/data/badges.js');
{
  const full = {}; for (let i = 0; i < 130; i++) full[i] = 1;
  const [dex1, stair1] = badgeSlots({ shoesByIndex: full, bestStairs: 0 });
  eq('130종 보유 → 도감완성', dex1?.id, 'dex_complete');
  eq('최고기록 0 → 계단 뱃지 없음', stair1, null);

  // 한 종류를 캐릭터 구매로 써서 0켤레가 되면 그 순간 빠진다
  const spent = { ...full }; delete spent[7];
  eq('129종 → 뱃지 뺏김', badgeSlots({ shoesByIndex: spent, bestStairs: 0 })[0], null);

  // 여러 켤레가 있으면 한 켤레 써도 유지된다
  const spare = { ...full, 7: 2 };
  const spareUsed = { ...spare, 7: 1 };
  eq('2켤레 중 1켤레 사용 → 유지', badgeSlots({ shoesByIndex: spareUsed, bestStairs: 0 })[0]?.id, 'dex_complete');
}

console.log('11) 계단 뱃지 — 넘긴 것 중 가장 높은 하나만');
{
  const at = (best) => badgeSlots({ shoesByIndex: {}, bestStairs: best })[1];
  eq('499 → 없음', at(499), null);
  eq('500 → 500계단', at(500)?.top, '500');
  eq('1499 → 1,000계단', at(1499)?.top, '1,000');
  eq('5200 → 5,000계단(최고)', at(5200)?.top, '5,000');
  eq('5,000은 금색', at(5200)?.rank, 'gold');
  eq('500은 동색', at(500)?.rank, 'bronze');
}

console.log(fails ? `\n실패 ${fails}건` : '\n지갑 로직 이상 없음');
process.exit(fails ? 1 : 0);
