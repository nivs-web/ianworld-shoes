/**
 * 드래곤 결투 정산. (2026-08-26 F단계)
 *
 * ★ **신발 정산(`multiSettle.js`)을 안 건드린다.**
 * 그쪽은 티어별 신발 한 켤레씩을 항아리에 걸고 골라 가져가는, 오래 다듬은 물건이다.
 * 결투 규칙은 훨씬 단순해서(금화 한 종류) 거기에 끼워 넣으면 양쪽 다 복잡해진다.
 *
 * ## 규칙 (사용자 지정)
 *
 *   · 둘 다 **1,000 금화**를 걸고 시작한다
 *   · 이긴 사람이 **판돈 2,000 전부** + **둘이 판에서 주운 금화 전부**를 가져간다
 *   · 진 사람은 건 1,000 을 잃는다. 자기가 주운 금화도 승자에게 간다
 *
 * 그래서 이기면 평소 한 판보다 훨씬 빨리 모이고, 지면 한 판 값을 날린다.
 *
 * ## 왜 승패를 여기서 다시 세는가
 *
 * 방에는 두 사람이 1초마다 올린 숫자만 있다. 서버가 판정해 주지 않으므로
 * **양쪽이 같은 규칙으로 각자 세고 같은 답을 낸다.** 순서가 정해져 있어야
 * (보스 → 점수 → 금화 → uid) 둘이 서로 다른 승자를 내는 일이 없다.
 */

import { currentUser } from './auth.js';
import * as L from './storageLocal.js';
import { get as getProfile, patch } from './profile.js';
import * as Room from './multiplayer.js';

/** 한 사람이 거는 금화 */
export const DUEL_STAKE = 1000;

/**
 * 결투 승패를 가른다.
 *
 * ★ **순서가 곧 규칙이다.** 보스를 많이 무너뜨린 사람이 이긴다 — 그게 이 결투가
 * 겨루자고 만든 값이다. 같으면 점수, 그것도 같으면 금화, 마지막은 uid 다.
 * uid 까지 가는 일은 사실상 없지만, **비기는 경우를 남겨 두면** 양쪽이
 * 서로 다른 답을 낼 수 있어서 반드시 끝까지 갈라야 한다.
 *
 * @param {object} players 방의 players 노드
 * @returns {string[]} 이긴 순서대로의 uid
 */
export function duelRanking(players) {
  return Object.entries(players ?? {})
    .filter(([, p]) => p && !p.waiting)
    .map(([uid, p]) => ({
      uid,
      bosses: p.bosses | 0,
      score: p.score | 0,
      coins: p.coins | 0,
    }))
    .sort((a, b) =>
      (b.bosses - a.bosses) ||
      (b.score - a.score) ||
      (b.coins - a.coins) ||
      (a.uid < b.uid ? -1 : 1))
    .map((r) => r.uid);
}

/**
 * 한 판이 끝났다 — 내 지갑에 반영한다.
 *
 * @param {object} room 끝난 방
 * @returns {{won:boolean, gain:number, lost:number, rank:number, players:number}|null}
 */
export function settleDuel(room) {
  const u = currentUser();
  if (!u || u.guest || !room) return null;

  const order = duelRanking(room.players);
  if (order.length < 2) return null;              // 혼자면 겨룰 일이 없다
  const rank = order.indexOf(u.uid);
  if (rank < 0) return null;                      // 이 판에 안 뛰었다

  const won = rank === 0;
  const pot = DUEL_STAKE * order.length;
  /* 둘이 판에서 주운 금화를 모두 더한다 — 승자가 그것까지 가져간다 */
  const picked = order.reduce((sum, uid) => sum + ((room.players?.[uid]?.coins) | 0), 0);

  const before = getProfile();
  if (won) {
    /**
     * 이겼다 — 판돈 전부 + 둘이 주운 금화 전부.
     * 내가 건 1,000 은 시작할 때 이미 빠져나갔으므로 여기서는 **받는 것만** 더한다.
     * 누적(`dragonCoinsTotal`)에도 넣는다 — 금화왕 순위는 "지금까지 번 것" 이다.
     */
    const gain = pot + picked;
    patch({
      dragonCoins: (before.dragonCoins || 0) + gain,
      dragonCoinsTotal: (before.dragonCoinsTotal || 0) + gain,
      dragonMultiWins: (before.dragonMultiWins || 0) + 1,
    });
    return { won: true, gain, lost: 0, rank: rank + 1, players: order.length };
  }

  /* 졌다 — 건 것은 이미 빠져나갔고, 주운 금화도 승자에게 갔다. 여기서 더 뺄 것은 없다 */
  patch({ dragonMultiLosses: (before.dragonMultiLosses || 0) + 1 });
  return { won: false, gain: 0, lost: DUEL_STAKE, rank: rank + 1, players: order.length };
}

/**
 * 판돈을 건다 — 판이 **시작될 때** 지갑에서 뺀다.
 *
 * 대기방에 앉을 때가 아니라 시작할 때인 이유: 앉았다가 그냥 나가는 사람이 많은데,
 * 그때마다 걸고 돌려주려면 되돌리는 길이 하나 더 생기고 거기서 사고가 난다.
 * 시작 직전에 빼면 되돌릴 일 자체가 없다.
 *
 * @returns {boolean} 걸 수 있었나
 */
export function stakeDuel() {
  const p = getProfile();
  if ((p.dragonCoins || 0) < DUEL_STAKE) return false;
  patch({ dragonCoins: (p.dragonCoins || 0) - DUEL_STAKE });
  return true;
}

/** 판돈을 되돌려준다 — 시작하자마자 방이 깨졌을 때 */
export function refundDuel() {
  const p = getProfile();
  patch({ dragonCoins: (p.dragonCoins || 0) + DUEL_STAKE });
}

/** 결투에 낄 수 있나 */
export const canDuel = (profile) => (profile?.dragonCoins || 0) >= DUEL_STAKE;
