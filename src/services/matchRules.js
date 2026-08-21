/**
 * 멀티 정산 규칙 — **Firebase 를 모르는 순수 계산만** 모아 둔다. (기획서 §5-7)
 *
 * 여기 있는 게 전부 남의 재산을 움직이는 계산이라, 브라우저를 띄우지 않고
 * 노드에서 전수 검증할 수 있어야 한다. 그래서 RTDB 접근은 multiplayer.js 에 두고
 * 판정만 떼어 놨다. (periodKeys.js 를 떼어 놓은 것과 같은 이유)
 */

import { MULTI, SHOE_TIERS } from '../config/balance.js';

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
export function rankPlayers(players, now = Date.now()) {
  /**
   * ★ **계단이 높은 사람이 이긴다.** (2026-08-19 재확정)
   *
   * 한동안 "판에 남아 있는 사람"을 1순위로 뒀다 — 1:1 에서 먼저 포기하면 지도록.
   * 그런데 사용자가 두 번에 걸쳐 못 박았다: *"방이 사라지던 튕기던 무조건, 걸린 신발은
   * 게임이 종료된 시점에서 **더 높은 계단에 있던 사람**이 가져간다"*, *"계단 최상위에
   * 위치한 사람이 승리"*. 그래서 **계단 수가 다시 1순위**다.
   *
   * 생존은 **동점일 때만** 본다 — 같은 층에서 끝났으면 아직 판에 붙어 있던 쪽이 위다.
   * 그 뒤는 먼저 도달한 순, 마지막은 uid 사전순(누가 계산해도 같은 답이 나와야 한다).
   */
  const 남아있다 = (p) => (outOfRound(p, now) ? 0 : 1);
  return [...players]
    .sort((a, b) =>
      (b.stairs ?? 0) - (a.stairs ?? 0) ||
      남아있다(b) - 남아있다(a) ||
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

// ─────────────────────────────────────────────
// 역전 배틀 — 판돈과 종료 판정 (2026-08-18)
// ─────────────────────────────────────────────

/**
 * **판돈은 항아리에 실제로 들어 있는 것만 센다.**
 *
 * `revives` 숫자로 계산하면 조작된 클라이언트가 화면의 판돈만 부풀릴 수 있다.
 * `result.given` 은 그 사람이 **자기 지갑에서 실제로 뺀** 신발 목록이므로 이걸 세면
 * 표시와 실물이 항상 일치한다. 아직 안 낸 기본 1켤레는 사람 수로 더해 준다.
 */
/**
 * 이 판에 걸린 신발 — 화면 하단 `1등하면 신발 N켤레!` 와 사망 화면이 쓰는 수.
 *
 * ★ **판돈 + 모두가 주운 신발**이다. (2026-08-19, 사용자 요청으로 습득분 포함)
 *
 * 예전에는 판돈(기본 참가비 + 부활 비용)만 셌다. 그런데 1등은 **주운 신발까지 전부**
 * 가져가므로(`foundShoesTotal` + 승자 자신의 `runResult`), 화면의 숫자가 실제 수령액보다
 * 늘 작았다 — 사용자가 "계산이 안 맞는다"고 한 게 이것이다.
 *
 * 이제 둘이 정확히 같은 식을 쓴다:
 *
 *   화면 = (인원−1)×기본 + Σ부활비용 + Σ모두가 주운 것
 *   수령 = 걷은 판돈             + 남이 주운 것 + 내가 주운 것(runResult)
 *
 * 덤으로 **누가 신발을 줍든 숫자가 곧바로 올라간다** — 판이 커지는 게 눈에 보여야
 * 끝까지 오를 이유가 생긴다.
 *
 * @param {object} room
 * @param {{uid:string, shoesFound:number}} [live] 내 최신 습득 수. 서버가 되돌려주기
 *   전(진행도 전송은 300ms 간격)에도 **내가 주운 순간 바로** 반영되게 한다.
 */
/**
 * 판돈을 셀 **명단**.
 *
 * ★ (2026-08-19 15차) 예전에는 `players` 만 봤다. 그런데 `leaveRoom` 은 `players/<uid>`
 * 를 **통째로 지운다**(시체 방이 매칭을 막지 않게). 진 사람은 결과 화면에서 곧장 나가는
 * 게 정상 동작이라, 그 순간 승자 화면의 `1등하면 신발 N켤레!` 가 **폭삭 줄었다** —
 * 실제 수령액은 그대로인데 표시만 틀리니 §9-0-36 에서 고친 "계산이 안 맞는다"가 재발한다.
 *
 * 정산은 이미 `result`(rankings·given·found)를 진실로 쓴다(§9-0-34). 표시도 같은 곳을
 * 봐야 한다 — **판이 끝났으면 `result` 에서, 도는 중이면 `players` 에서** 명단을 만든다.
 */
export function potRoster(room) {
  const res = room?.result ?? {};
  const ranks = Array.isArray(res.rankings) ? res.rankings : null;
  if (!ranks?.length) return playersInRound(room?.players);
  const ids = new Set(ranks);
  for (const k of Object.keys(res.given ?? {})) ids.add(k);
  for (const k of Object.keys(res.found ?? {})) ids.add(k);
  // 남아 있는 사람은 실제 기록을, 떠난 사람은 uid 만 (아래 계산이 result 로 메운다)
  return [...ids].map((uid) => ({ uid, ...(room?.players?.[uid] ?? {}) }));
}

export function potShoes(room, live) {
  const res = room?.result ?? {};
  const given = res.given ?? {};
  const saved = res.found;
  const list = potRoster(room);
  if (!list.length) return 0;

  let 부활값 = 0;
  let 기본낸사람 = 0;
  let 주운것 = 0;
  for (const p of list) {
    const paid = Array.isArray(given[p.uid]) ? given[p.uid].length : 0;
    /**
     * ★ 방을 떠난 사람은 `revives` 를 모른다 — **낸 양에서 되짚는다.** (15차)
     * 내는 양은 `기본 1 + 20 × 부활` 이므로 20으로 내림하면 부활 몫이 정확히 나온다
     * (21 → 20, 20 → 20, 1 → 0). 이 값이 있어야 아래 `기본낸사람` 판정이 맞는다.
     */
    const 부활비 = p.revives != null
      ? p.revives * MULTI.reviveCost
      : Math.floor(paid / MULTI.reviveCost) * MULTI.reviveCost;
    // 부활 비용은 **이미 낸 것**이 진실이다. 아직 안 올라온 건 없는 셈 친다
    부활값 += Math.max(paid, 부활비);
    /**
     * ★ 이 사람이 **기본 1켤레까지 이미 냈는지**를 따로 센다. (2026-08-19)
     * 기본 판돈은 판이 끝난 뒤에 내므로, 판 도중에는 `given` 에 부활비만 들어 있다.
     * 그런데 정산이 끝나면 거기에 기본 1켤레가 더해진다 — 그걸 안 가리고 아래에서
     * `(인원−1)` 을 통째로 더하면 **결과 화면에서만 판돈이 부풀어 보인다**(실측 37 vs 35).
     */
    if (paid > 부활비) 기본낸사람++;

    // 판이 끝났으면 결과에 박힌 값이 진실이다 (사람이 방을 나가도 남는다)
    const fromRoom = typeof saved?.[p.uid] === 'number' ? saved[p.uid] : (p.shoesFound ?? 0);
    주운것 += live && live.uid === p.uid ? Math.max(fromRoom, live.shoesFound ?? 0) : fromRoom;
  }
  /**
   * 기본 판돈은 **인원 − 1** 이다. 1등은 기본 1켤레를 내지 않으므로(`settleRoom` 은
   * `!won` 일 때만 낸다) 전원 몫을 더하면 실제 수령액보다 항상 1 많다.
   * 누가 이길지는 몰라도 "한 명은 안 낸다"는 건 확실하므로 이렇게 세면 정확하다.
   * **이미 낸 사람 몫은 위에서 셌으므로 남은 것만** 더한다.
   */
  const 남은기본 = Math.max(0, (list.length - 1) - 기본낸사람) * MULTI.loserPenalty;
  return 부활값 + 남은기본 + 주운것;
}

export function owedBy(player) {
  return MULTI.loserPenalty + (player?.revives ?? 0) * MULTI.reviveCost;
}

/** 부활을 더 할 수 있나 (상한 10회 — 시간 제한이 없으므로 이게 유일한 종료 보장이다) */
export const canRevive = (player) => (player?.revives ?? 0) < MULTI.maxRevives;

/** 이 사람의 부활 창이 끝났나 */
export function reviveExpired(player, now) {
  if (player?.out) return true;
  if (!canRevive(player)) return true;
  return now - (player?.deadAt ?? 0) > MULTI.reviveWindowSeconds * 1000;
}

/**
 * ★ **이 사람은 이 판에서 손을 뗐나.** (2026-08-18 재수정)
 *
 * 처음에는 "죽었고 부활 창이 지났나"만 봤다. 그런데 **마지막까지 살아남은 사람**은
 * 죽지 않고 판을 끝낸다(다른 사람이 전부 빠지면 혼자 뛸 이유가 없다). 그 사람은
 * `alive: true` 로 남으므로 종료 판정이 **영원히 false** 였다 — 전원이 결과 화면에서
 * "다른 사람들이 아직 오르고 있습니다"만 보며 굳는다. 실제로 그 상태를 만들 수 있었다.
 *
 * 그래서 `out` 을 "부활 포기"가 아니라 **"이 판에서 빠졌다"**로 넓힌다. 살아서 끝낸
 * 사람도 나갈 때 이 도장을 찍는다. 순위 계산은 여전히 `alive` 를 보므로
 * **살아서 끝낸 사람이 동점에서 위**라는 성질은 그대로다.
 */
export function outOfRound(player, now) {
  if (player?.out) return true;
  if (player?.alive === false) return reviveExpired(player, now);
  return isStale(player, now);
}

/**
 * ★ **신호가 끊긴 사람은 판에서 빠진 것으로 본다.** (2026-08-19)
 *
 * 렉으로 튕긴 사람은 `alive: true` 인 채로 남는다. 그러면 `roundOver` 가 영원히
 * 거짓이고 → 순위가 안 박히고 → **아무도 정산을 못 한다.** 남은 사람들은 결과 화면에서
 * "다른 사람들이 아직 오르고 있습니다"만 보고, 항아리에 걸린 신발은 주인을 잃는다.
 * 사용자가 신고한 "튕기면 신발이 사라진다"가 정확히 이 경로다.
 *
 * 판단 근거는 **서버가 찍는 `seenAt`** 이다(5초마다 갱신). 폰 시계가 아니라 서버
 * 시각이라 시계가 어긋난 기기도 같은 답을 낸다. `seenAt` 이 아예 없으면(옛 클라이언트)
 * 판정하지 않는다 — 모르는 것을 근거로 남을 판에서 빼면 안 된다.
 */
export function isStale(player, now) {
  /**
   * ★ **명시적인 신호가 있으면 그걸 먼저 본다.** (2026-08-19 8차 · 2026-08-21 31차)
   *
   * 두 가지가 있고 **둘 다 짐작이 아니다.**
   *
   *   · `offAt`  — **서버가** 소켓이 끊긴 순간에 찍는다(`multiplayer.armPresence`).
   *   · `awayAt` — **본인이** 홈 버튼을 누른 순간에 찍는다(`multiplayer.markAway`).
   *
   * 그래서 유예가 짧다(`MULTI.awaySeconds` 6초 = 나가기 버튼의 유예와 같은 값).
   * 사용자에게는 홈 버튼도 나가기다 — 두 길이 다른 시간을 주면 그쪽이 요령이 된다.
   *
   * 값이 **없다는 것**은 "아직 붙어 있다"는 뜻이다. 탭이 뒤로 가서 조용할 뿐인 사람을
   * 판에서 빼면 안 된다 — 그게 바로 "잠깐 나갔다 오면 튕긴다"였다(§9-0-39).
   * 그래서 아래 `seenAt` 판정은 **자리 지킴이 없는 옛 클라이언트를 위한 안전망**이고,
   * 그만큼 넉넉하게(30초) 잡는다.
   *
   * 돌아오면 `awayAt` 이 지워지므로 판정이 **저절로 원상 복구된다** — 도장이 아니라
   * 살아 있는 값이라 그렇다.
   */
  const 짧은유예 = MULTI.awaySeconds * 1000;
  const 긴유예 = MULTI.absentSeconds * 1000;

  const off = player?.offAt ?? 0;
  const away = player?.awayAt ?? 0;
  // 둘 다 있으면 **늦게 찍힌 쪽**이 지금 상태다 (끊겼다 붙은 뒤 홈 버튼 등)
  const 떠난시각 = Math.max(off, away);
  if (떠난시각) return now - 떠난시각 > 짧은유예;

  const seen = player?.seenAt ?? 0;
  if (!seen) return false;
  return now - seen > 긴유예;
}

// ─────────────────────────────────────────────
// 이탈 유예 — **1등은 판을 뜨기 전에 6초를 준다** (2026-08-21 26차, 사용자 지정)
// ─────────────────────────────────────────────

/**
 * 이 사람이 **판을 뜨기 시작한 서버 시각.** 0이면 아직 뜨는 중이 아니다.
 *
 * ★ `deadAt` 이 `outAt` 보다 **먼저**다. 죽어서 부활 창을 흘려보낸 시간이 곧 상대의
 * 반격 시간이므로, 죽은 순간부터 세야 "죽어서 나가기"와 "살아서 나가기"가 상대에게
 * 같은 6초를 준다. 둘을 따로 세면 죽고 나서 포기한 사람만 12초를 붙잡힌다.
 *
 * 부활하면 `reviveMe` 가 `deadAt: 0` 으로 지우므로 값은 **마지막 죽음**을 가리킨다.
 */
export function exitStartedAt(p) {
  return (p?.deadAt || 0) || (p?.outAt || 0) || 0;
}

/** 계단이 가장 높은 사람 (동점은 뒤에서 따로 본다) */
function topByStairs(list) {
  let top = null;
  for (const p of list) if (!top || (p.stairs ?? 0) > (top.stairs ?? 0)) top = p;
  return top;
}

/**
 * `uid` 가 지금 판을 뜨면 **남은 사람에게 유예를 줘야 하는가.**
 *
 * 세 조건을 전부 만족해야 한다.
 *   ① 판에 둘 이상이 뛰고 있다 (혼자면 줄 사람이 없다)
 *   ② 내가 **단독 1등**이다 — 동점자가 있으면 내가 나가도 그 사람이 이긴다(생존 우선,
 *      `rankPlayers`). 이미 지고 있는 사람의 기권을 붙잡을 이유는 없다.
 *   ③ 아직 판에 남아 **반격할 수 있는 사람**이 있다. 전원이 빠진 뒤라면 6초를 세도
 *      아무 일도 일어나지 않는다.
 *
 * 순위 판정에 `rankPlayers` 를 쓰지 않는 이유: 그쪽은 동점일 때 **생존**을 보므로,
 * 나가려는 사람은 부르는 순간 이미 아래로 밀려 "1등이 아니다"가 된다. 여기서 보고 싶은
 * 것은 **계단** 하나뿐이다.
 */
export function graceOnExit(room, uid, now = Date.now()) {
  const list = playersInRound(room?.players);
  if (list.length < 2) return false;
  if (room?.result?.rankings || room?.state === 'finished') return false;
  const me = list.find((p) => p.uid === uid);
  if (!me) return false;
  const my = me.stairs ?? 0;
  if (list.some((p) => p.uid !== uid && (p.stairs ?? 0) >= my)) return false;
  return list.some((p) => p.uid !== uid && !outOfRound(p, now));
}

/**
 * 지금 판이 끝나기까지 **남은 유예(ms).** 0이면 붙잡을 이유가 없다.
 *
 * 모두가 같은 답을 내야 한다 — 나가는 사람의 화면에 뜨는 카운트다운, 남은 사람의
 * 레이스 게이지에 뜨는 **빨간 숫자**, 그리고 종료 판정이 전부 이 하나를 본다.
 */
export function leaveGraceLeftMs(room, now = Date.now()) {
  const list = playersInRound(room?.players);
  const top = topByStairs(list);
  if (!top || !outOfRound(top, now)) return 0;
  if (!graceOnExit(room, top.uid, now)) return 0;
  const at = exitStartedAt(top);
  if (!at) return 0;                       // 튕김은 이미 30초를 줬다 (`isStale`)
  return Math.max(0, at + MULTI.leaveGraceSeconds * 1000 - now);
}

/** 유예를 받고 있는 사람 (레이스 게이지가 빨간 숫자를 그릴 대상) */
export function graceTarget(room, now = Date.now()) {
  if (leaveGraceLeftMs(room, now) <= 0) return null;
  return topByStairs(playersInRound(room?.players))?.uid ?? null;
}

// ─────────────────────────────────────────────
// 일시정지 — 1인 1회, 전원 동시 (2026-08-21 26차, 사용자 지정)
// ─────────────────────────────────────────────

/** 지금 판이 멈춰 있나 (남은 ms, 0이면 안 멈춰 있다) */
export function pauseLeftMs(room, now = Date.now()) {
  const at = room?.pausedAt ?? 0;
  if (!at || !room?.pausedBy) return 0;
  return Math.max(0, at + MULTI.pauseSeconds * 1000 - now);
}

/**
 * ★ **판이 도는 중인가.** (2026-08-21 31차)
 *
 * `startRound` 는 `state` 를 `'countdown'` 으로 쓰고 **그 뒤로 아무도 안 바꾼다** —
 * 즉 판이 끝날 때까지 계속 `'countdown'` 이다. `'playing'` 만 보면 실제 게임에서는
 * 한 번도 참이 되지 않는다(시뮬레이터가 손으로 써 넣어서 그동안 안 보였다).
 * 그래서 **끝난 것도 대기 중인 것도 아니면 도는 중**으로 본다.
 */
export const roundRunning = (room) => room?.state === 'countdown' || room?.state === 'playing';

/**
 * `uid` 가 지금 일시정지를 걸 수 있나.
 *
 * ★ **죽어 있는 사람이 하나라도 있으면 못 건다.** 부활 창과 이탈 카운트다운은 서버가
 * 찍은 시각 기준이라 멈출 방법이 없다 — 20초를 멈추면 그 창이 통째로 날아간다.
 * 아무도 죽지 않은 순간에만 열어 두면 **멈춰야 할 시계가 게이지 하나로 줄어든다.**
 */
export function canPause(room, uid, now = Date.now()) {
  /**
   * ★ 31차: `state !== 'playing'` 이었다. 그런데 `startRound` 는 `'countdown'` 을 쓰고
   * **그 뒤로 아무도 안 바꾼다** — 실제 게임에서는 이 조건이 한 번도 참이 아니라
   * **일시정지가 통째로 죽어 있었다.** 시뮬레이터가 `'playing'` 을 손으로 써 넣어서
   * 검사만 통과하고 있었다(§9-0-44 의 "미리보기가 거짓말을 한다"와 같은 모양이다).
   */
  if (!roundRunning(room)) return false;
  if (room.result?.rankings) return false;
  if (pauseLeftMs(room, now) > 0) return false;
  const list = playersInRound(room.players);
  const me = list.find((p) => p.uid === uid);
  if (!me || me.pauseUsed) return false;
  return !list.some((p) => p.alive === false || p.out);
}

/**
 * 판이 끝났나 — **살아 있는 사람이 없고, 죽은 사람이 전부 부활 창을 넘겼거나 포기했을 때.**
 *
 * 예전 대전제("한 명이 죽으면 즉시 종료")를 대체한다. 판정을 순수 함수로 둔 이유는
 * **모두가 같은 답을 내야** 하기 때문이다 — 먼저 관측한 클라이언트가 순위를 못 박는다.
 */
export function roundOver(room, now) {
  const list = playersInRound(room?.players);
  if (!list.length) return false;
  /**
   * ★ **1:1 은 한 명이 빠지는 순간 끝난다.** (2026-08-19)
   *
   * 둘뿐인 판에서 상대가 나가거나 부활을 포기하면 남은 사람은 **혼자 뛰는 것**이다.
   * 그걸 계속 시키면 "나가기를 눌렀는데 결과가 안 뜬다"가 되고, 상대가 튕긴 경우에는
   * 생존 신호가 끊길 때까지(90초) 둘 다 묶인다. 이겼는지 졌는지는 이미 정해져 있다.
   *
   * 셋 이상은 다르다 — 한 명이 빠져도 **남은 사람들끼리 판이 계속돼야** 한다.
   */
  const 끝났다 = (list.length < MULTI.minPlayers && roundRunning(room))
    /**
     * ★ **자리가 통째로 사라진 경우.** (2026-08-21 31차)
     *
     * `leaveRoom` 은 `players/<uid>` 를 통째로 지운다. 그러면 남은 사람은 목록에
     * **혼자**가 되는데, 예전 코드는 그 하나를 `every` 로 훑어 "내가 살아 있으니 아직
     * 안 끝났다"는 답을 냈다 — 겨룰 사람이 없는데 **판이 영영 안 끝난다.**
     * `othersAllOut` 도 `others.length === 0` 이면 false 를 돌려줘서 같은 구멍이었다.
     *
     * 혼자 남았으면 이미 승부가 났다. `finalizeResult` 는 한 명만 있어도 순위를
     * 박을 수 있게 되어 있다(§9-0-25).
     *
     * **판이 도는 중일 때만** 그렇게 본다(`roundRunning`) — 대기방은 참가자가 하나뿐인
     * 순간이 흔하고, 그걸 종료로 읽으면 시작도 안 한 판의 순위가 박힌다(§9-0-26).
     */
    ? true
    : list.length === 2
      ? list.some((p) => outOfRound(p, now))
      : list.every((p) => outOfRound(p, now));
  if (!끝났다) return false;
  /**
   * ★ **1등이 빠져서 끝나는 판은 6초를 더 기다린다.** (2026-08-21 26차)
   *
   * 그 6초가 없으면 나가기 버튼이 곧 **순위 확정 버튼**이 된다(§9-0-55).
   * 전원이 빠진 뒤라면 `leaveGraceLeftMs` 가 0을 주므로 여기서 바로 끝난다.
   */
  return leaveGraceLeftMs(room, now) <= 0;
}

/**
 * 나 말고 전원이 판에서 빠졌나 — 마지막 한 명이 혼자 계속 뛸 이유는 없다.
 *
 * ★ 31차: **자리가 통째로 사라진 것도 "빠진 것"이다.** 예전에는 `others.length === 0`
 * 이면 false 를 돌려줬는데, 그게 곧 "상대가 방에서 나가면 내 판이 안 끝난다"였다.
 * 단 **판이 도는 중일 때만**(`roundRunning`) 그렇게 본다 — 대기방에서는 참가자가
 * 하나뿐인 순간이 흔하고, 그걸 종료로 읽으면 시작도 안 한 판의 순위가 박힌다(§9-0-26).
 */
export function othersAllOut(room, myUid, now) {
  const others = playersInRound(room?.players).filter((p) => p.uid !== myUid);
  if (!others.length) return roundRunning(room);
  return others.every((p) => outOfRound(p, now));
}

/** 부활 위치 — **무조건 1위보다 `reviveAhead` 칸 앞** */
export function reviveFloor(room) {
  const top = playersInRound(room?.players).reduce((m, p) => Math.max(m, p.stairs ?? 0), 0);
  return top + MULTI.reviveAhead;
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
/**
 * ★ **자리 번호 — 들어온 순서.** (2026-08-19)
 *
 * 1번 빨강 · 2번 노랑 · 3번 파랑 · 4번 초록. 대기방의 번호 상자와 인게임 레이스
 * 게이지의 얼굴 테두리가 **같은 번호·같은 색**을 써야 "로비의 나"와 "게임 속의 나"가
 * 이어진다. 그래서 판정은 **누가 계산해도 같아야** 한다 — 들어온 시각(같으면 uid)으로
 * 줄을 세운다. 대기자도 자리를 차지한다(다음 판에는 정식 참가자가 되므로).
 *
 * @returns {number} 0~3 (모르는 사람이면 -1)
 */
export function slotIndex(players, uid) {
  const order = Object.entries(players ?? {})
    .sort((a, b) => (a[1]?.joinedAt ?? 0) - (b[1]?.joinedAt ?? 0) || a[0].localeCompare(b[0]))
    .map(([id]) => id);
  return order.indexOf(uid);
}

export function playersInRound(players) {
  return Object.entries(players ?? {})
    .filter(([, v]) => !v?.waiting)
    .map(([uid, v]) => ({ uid, ...v }));
}

// ─────────────────────────────────────────────
// 판 중 획득한 신발도 1등이 가져간다 (2026-08-19, 사용자 신고)
// ─────────────────────────────────────────────

/**
 * **다른 사람들이 이 판에서 주운 신발 총량.**
 *
 * `shoesFound` 는 진행도로 계속 올라오는 **개수**뿐이다(어떤 신발인지는 각자 화면에만
 * 있고 방으로 넘어오지 않는다). 그래서 패자가 주운 신발을 승자에게 "그대로" 옮길 수는
 * 없다 — 대신 **개수만큼 승자 지갑에 새로 굴려 준다**(`rollFoundShoe`).
 *
 * 승자 자신의 몫은 뺀다 — 승자는 이미 자기 `runResult.shoeIndices` 로 정확한 신발을
 * 받는다(`finishRun`). 여기서 또 세면 자기 것을 두 번 받는다.
 */
/**
 * 이 판에서 **한 사람이** 계단에서 주운 신발 수.
 *
 * `result.found` 를 **먼저** 본다. `players` 는 그 사람이 방을 나가면 통째로 사라지므로
 * (`leaveRoom`) 정산 시점에는 못 믿는다 — 그것 때문에 "주운 신발이 승자에게 안 간다"는
 * 신고가 반복됐다. `found` 는 `finalizeResult` 가 순위와 함께 박아 두므로 남는다.
 *
 * `players` 폴백은 **이 기능 이전에 끝난 방**과 옛 클라이언트가 확정한 방을 위한 것이다.
 */
export function foundOf(room, uid) {
  const saved = room?.result?.found?.[uid];
  if (typeof saved === 'number') return Math.max(0, saved);
  return Math.max(0, room?.players?.[uid]?.shoesFound ?? 0);
}

/** 나(=`excludeUid`)를 뺀 나머지가 이 판에서 주운 신발 총합 — 1등이 가져갈 몫 */
export function foundShoesTotal(room, excludeUid) {
  const found = room?.result?.found;
  // 결과에 박혀 있으면 그것이 진실이다. 사람이 방을 나갔어도 값이 남는다.
  if (found && typeof found === 'object') {
    return Object.entries(found)
      .reduce((sum, [uid, n]) => sum + (uid === excludeUid ? 0 : Math.max(0, n ?? 0)), 0);
  }
  return playersInRound(room?.players).reduce(
    (sum, p) => sum + (p.uid === excludeUid ? 0 : (p.shoesFound ?? 0)),
    0
  );
}

/** 티어 확률로 신발 하나를 굴린다 — 인게임 `Stairs.rollShoe` 와 같은 분포, 시드 없이. */
export function rollFoundShoe(rand = Math.random) {
  let r = rand() * SHOE_TIERS.reduce((s, t) => s + t.prob, 0);
  for (const t of SHOE_TIERS) {
    if (r < t.prob) return t.offset + Math.floor(rand() * t.count);
    r -= t.prob;
  }
  const last = SHOE_TIERS[SHOE_TIERS.length - 1];
  return last.offset + Math.floor(rand() * last.count);
}

/**
 * ★ **승률왕 자격.** (2026-08-19 24차, 사용자 지정)
 *
 *   ① 멀티게임 `MULTI.rateMinGames` 판 이상
 *   ② 최근 `MULTI.rateActiveDays` 일 안에 **한 판이라도** (승패 무관)
 *
 * ②가 없으면 *"10판 다 승리하면 100% 승률인데 (…) 늘 고정으로 되고, 절대 안바뀌잖아"*
 * 라는 사용자 지적 그대로, 10전 10승이 영원히 1위로 굳는다.
 *
 * **제명이 아니라 잠자기다** — 3주 쉬었어도 한 판 하면 그 즉시 목록으로 돌아온다.
 * 그게 이 규칙의 목적이다(다시 하게 만드는 것).
 *
 * 시각이 아예 없으면(옛 기록) 잠든 것으로 본다. 있다고 쳐 주면 판정이 무의미해진다.
 */
export function rateEligible(r, now = Date.now()) {
  if ((r?.games ?? 0) < MULTI.rateMinGames) return false;
  const last = r?.lastMultiAt ?? 0;
  return last > 0 && now - last <= MULTI.rateActiveDays * 24 * 60 * 60 * 1000;
}
