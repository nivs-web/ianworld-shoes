/**
 * 멀티 정산 규칙 — **Firebase 를 모르는 순수 계산만** 모아 둔다. (기획서 §5-7)
 *
 * 여기 있는 게 전부 남의 재산을 움직이는 계산이라, 브라우저를 띄우지 않고
 * 노드에서 전수 검증할 수 있어야 한다. 그래서 RTDB 접근은 multiplayer.js 에 두고
 * 판정만 떼어 놨다. (periodKeys.js 를 떼어 놓은 것과 같은 이유)
 */

import { MULTI } from '../config/balance.js';

/**
 * 순위 정렬 — 기획서 §5-7.
 *
 *   1순위 획득 신발 수(많을수록) → 2순위 계단 수(높을수록) → 3순위 먼저 도달한 사람
 *
 * 3순위가 필요한 이유: 둘 다 같으면 순위를 못 정하는데, 멀티는 **누구든 죽는 즉시
 * 전원 종료**라 동률이 흔하다(신발 0개끼리 같은 층에서 끝나는 판). 그때는
 * 그 기록에 **먼저 도달한 쪽**이 이긴다 — 같은 성적이면 빨리 해낸 쪽이 낫다.
 * 그마저 같으면 uid 사전순으로 못 박는다. 판정이 사람마다 달라지면 안 된다
 * (각자 자기 화면에서 계산하므로 **모두 같은 답이 나와야 한다**).
 *
 * @param {Array<{uid:string, shoesFound?:number, stairs?:number, reachedAt?:number}>} players
 * @returns {string[]} 1등부터 uid 목록
 */
export function rankPlayers(players) {
  /**
   * ★ **동점이면 살아남은 쪽이 위다.** (2026-08-18)
   *
   * 예전에는 성적이 같으면 `reachedAt` 이 이른 쪽이 이겼는데, 그 값은 **죽은 사람만**
   * 찍힌다(`reportDeath`). 살아 있는 사람은 `Infinity` 라 항상 뒤로 밀렸다.
   * 그래서 이런 게 성립했다: 카운트다운이 끝나자마자 일시정지 → 나가기.
   * 전원이 0계단·0신발인 그 순간에 **나간 사람만** `reachedAt` 을 갖게 되어
   * **1등이 되고 남은 사람들의 신발을 한 켤레씩 걷어 갔다.**
   *
   * 이 판의 승부는 "누가 먼저 떨어지느냐"다. 성적이 같다면 떨어진 사람이 아래로 간다.
   */
  const survived = (p) => (p.alive === false ? 0 : 1);
  return [...players]
    .sort((a, b) =>
      (b.shoesFound ?? 0) - (a.shoesFound ?? 0) ||
      (b.stairs ?? 0) - (a.stairs ?? 0) ||
      survived(b) - survived(a) ||
      (a.reachedAt ?? Infinity) - (b.reachedAt ?? Infinity) ||
      String(a.uid).localeCompare(String(b.uid))
    )
    .map((p) => p.uid);
}

/**
 * 정산표 — 인원별로 1등이 가져가고 나머지는 1켤레씩 낸다.
 *
 * 기획서 표(2인 +1 / 3인 +2 / 4인 +3)는 결국 **"진 사람들이 1켤레씩 내고
 * 1등이 그걸 전부 가져간다"** 와 같다. 그래서 상수표를 따로 믿지 않고
 * 패자 수로 계산한 뒤, 표와 어긋나면 개발 중에 바로 알 수 있게 검증한다.
 *
 * @param {string[]} rankings 1등부터
 * @returns {Record<string, number>} uid → 증감 (+N / -1)
 */
export function settlementCounts(rankings) {
  const out = {};
  if (rankings.length < MULTI.minPlayers) return out;
  const losers = rankings.slice(1);
  out[rankings[0]] = losers.length * MULTI.loserPenalty;
  for (const uid of losers) out[uid] = -MULTI.loserPenalty;
  return out;
}

/** 기획서 표와 계산이 맞는지 (개발 중 자기검증용) */
export function rewardMatchesSpec(playerCount) {
  return (playerCount - 1) * MULTI.loserPenalty === MULTI.winnerReward[playerCount];
}

/**
 * 패자가 내놓을 신발 고르기 — **보유 수량 기준 균등 추첨, 티어 무관.** (기획서 §5-7)
 *
 * 티어 순으로 뺏지 않는 게 핵심이다. 캐릭터 구매는 "높은 티어부터"지만
 * 멀티 패배는 **운**이어야 한다 — 좋은 신발을 지키려고 멀티를 안 하게 되면
 * 베팅이 성립하지 않는다.
 *
 * "수량 기준"이라 3켤레 가진 신발은 1켤레 가진 신발보다 3배 잘 뽑힌다.
 * 도감(종류)은 줄지 않는다 — 수량만 옮겨간다.
 *
 * @param {Record<string,number>} shoesByIndex 신발별 보유 켤레
 * @param {number} n 내놓을 켤레 수
 * @param {() => number} rand 0~1 난수 (테스트에서 고정 가능)
 * @returns {number[]} 내놓는 신발 index 목록 (n개, 부족하면 있는 만큼)
 */
export function pickPenaltyShoes(shoesByIndex = {}, n = 1, rand = Math.random) {
  const pool = [];
  for (const [k, held] of Object.entries(shoesByIndex)) {
    for (let i = 0; i < (held | 0); i++) pool.push(Number(k));
  }
  const picked = [];
  for (let i = 0; i < n && pool.length; i++) {
    const at = Math.min(pool.length - 1, Math.floor(rand() * pool.length));
    picked.push(pool[at]);
    pool.splice(at, 1); // 같은 켤레를 두 번 뽑지 않는다
  }
  return picked;
}

/**
 * 멀티에 들어갈 수 있는가. (기획서 §5-7)
 * 1켤레 이하는 낼 게 없으므로 참가 자체를 막는다 — 눌러 보고 막히는 것보다 낫다.
 */
export const canJoinMulti = (shoesOwned) => (shoesOwned ?? 0) >= MULTI.minShoesToJoin;

/** 방 코드 — 4자리 숫자 문자열. 앞자리 0도 허용해 1만 개를 다 쓴다. */
export function makeRoomCode(rand = Math.random) {
  const max = 10 ** MULTI.codeLength;
  return String(Math.floor(rand() * max)).padStart(MULTI.codeLength, '0');
}

export const isRoomCode = (v) => new RegExp(`^\\d{${MULTI.codeLength}}$`).test(String(v ?? ''));

// ─────────────────────────────────────────────
// 자동 매칭 (2026-08-16)
// ─────────────────────────────────────────────

/**
 * 자동 매칭이 고를 수 있는 방인가.
 * `state` 를 안 보면 이미 시작한 판에 들어가려다 실패하고, 그 실패가 "방이 없다"로
 * 흘러가 결국 새 방을 판다.
 */
export function joinable(room, myUid, maxPlayers = 4) {
  if (!room || !room.code) return false;
  if (room.state !== 'waiting') return false;
  if (room.hostUid === myUid) return false;
  return Object.keys(room.players ?? {}).length < (room.maxPlayers ?? maxPlayers);
}

/**
 * 후보 정렬 — **모두가 같은 순서를 보는 것**이 핵심이다.
 *
 * 두 사람이 동시에 '방 입장'을 누르면 각자 방을 만들어 버리는데(둘 다 빈 목록을 본다),
 * 그때 서로를 찾아 한쪽만 옮겨 가려면 **판정이 결정적**이어야 한다. 양쪽이 다른
 * 답을 내면 둘 다 옮겨서 자리만 바꾸거나, 둘 다 안 옮겨서 영영 안 만난다.
 *
 *   1순위 사람이 있는 방 — 빨리 찰수록 빨리 시작한다
 *   2순위 먼저 만들어진 방 — 오래 기다린 사람이 먼저 만난다
 *   3순위 코드 오름차순 — 시각까지 같을 때의 최후 판정 (동점이 없어야 한다)
 */
export function byPreference(a, b) {
  const has = (r) => (Object.keys(r.players ?? {}).length ? 1 : 0);
  return (
    has(b) - has(a) ||
    (a.createdAt ?? 0) - (b.createdAt ?? 0) ||
    String(a.code).localeCompare(String(b.code))
  );
}

/**
 * 자리가 남아 있는가 — **상태는 보지 않는다.** (2026-08-16)
 *
 * 게임 중인 방에도 자리가 있으면 **대기자로** 들어간다. 보통의 온라인 게임처럼
 * 다음 판을 기다리는 것이다. 예전에는 `state !== 'waiting'` 이면 후보에서 빼 버려서,
 * 먼저 시작한 방이 있어도 "들어갈 데가 없다"며 새 방을 팠다 — 그래서 다들 방장이 됐다.
 */
export function hasSeat(room, myUid, maxPlayers = 4) {
  if (!room || !room.code) return false;
  if (room.state === 'finished') return false;
  if (room.hostUid === myUid) return false;
  if (room.players?.[myUid]) return false;
  return Object.keys(room.players ?? {}).length < (room.maxPlayers ?? maxPlayers);
}

/**
 * **이번 판에 실제로 뛴 사람들.**
 *
 * 게임 중에 들어온 대기자(`waiting: true`)는 순위에도 정산에도 들어가면 안 된다.
 * 뛰지도 않은 판에서 꼴찌가 되어 신발을 뺏기면 그건 그냥 사고다.
 */
export function playersInRound(players) {
  return Object.entries(players ?? {})
    .filter(([, v]) => !v?.waiting)
    .map(([uid, v]) => ({ uid, ...v }));
}
