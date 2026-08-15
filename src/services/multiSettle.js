/**
 * 멀티 정산 실행 — 계산은 `matchRules.js`, 방 통신은 `multiplayer.js`, **여기는 집행**이다.
 *
 * ## 왜 각자 자기 것만 정산하나
 *
 * 승자가 패자의 신발을 가져오려면 **남의 계정 문서를 고쳐야** 하는데, 보안 규칙이
 * 본인 문서만 쓰게 막는다(그리고 그건 옳다). 서버(Cloud Functions)를 쓰면 되지만
 * 유료 요금제가 필요하다. 그래서 방향을 뒤집었다:
 *
 *   **패자가 자기 신발을 골라 내놓고**(`result.given/{uid}`),
 *   **승자가 그걸 읽어 자기 지갑에 넣는다.**
 *
 * 기획서의 정산표(2인 +1 / 3인 +2 / 4인 +3)는 결국 "패자가 1켤레씩 내고 1등이 다 가진다"와
 * 같으므로 결과가 정확히 일치한다. 남의 문서를 건드릴 필요가 사라진다.
 *
 * ## 두 번 먹지 않기
 *
 * 결과는 여러 경로로 도착한다 — 판 직후 결과 화면, 다음 접속의 미정산 청산,
 * 승자가 패자별로 나눠 받는 경우. 그래서 **방+상대 단위로 도장**을 찍고(`sf_settledMatches`),
 * 도장이 있으면 지갑을 건드리지 않는다.
 */

import * as L from './storageLocal.js';
import * as Room from './multiplayer.js';
import { currentUser } from './auth.js';
import { patch } from './profile.js';
import { pickPenaltyShoes, settlementCounts } from './matchRules.js';
import { MULTI } from '../config/balance.js';

/** 도장 이름 — 방 하나에서 "내가 낸 것"과 "누구한테서 받은 것"을 따로 센다 */
const payTag = (code) => `${code}:pay`;
const takeTag = (code, fromUid) => `${code}:take:${fromUid}`;

/** 프로필의 지갑 관련 값만 서버로 밀어 올린다 */
function pushWallet() {
  const p = L.loadProfile();
  patch({
    shoesOwned: p.shoesOwned,
    shoesByTier: p.shoesByTier,
    shoesByIndex: p.shoesByIndex,
    multiWins: p.multiWins ?? 0,
    multiLosses: p.multiLosses ?? 0,
  });
}

/**
 * 한 방을 정산한다. **여러 번 불러도 안전하다** (도장으로 막는다).
 *
 * @param {string} code
 * @param {object} [room] 이미 읽어 둔 방 (없으면 다시 읽는다)
 * @returns {Promise<{rank:number, won:boolean, paid:number[], took:number[], pending:number}|null>}
 *   pending = 아직 신발을 안 내놓은 패자 수 (그만큼 나중에 더 들어온다)
 */
export async function settleRoom(code, room = null) {
  const u = currentUser();
  if (!u || u.guest) return null;
  const r = room ?? await Room.readRoom(code);
  const rankings = r?.result?.rankings;
  if (!rankings?.length) return null;

  const myIndex = rankings.indexOf(u.uid);
  if (myIndex < 0) return null;
  const won = myIndex === 0;
  const counts = settlementCounts(rankings);

  let paid = [];
  let took = [];

  // ── 진 사람: 신발을 골라 내놓는다 ──────────────────
  if (!won && !L.isSettled(payTag(code))) {
    const wallet = L.loadProfile().shoesByIndex ?? {};
    const picked = pickPenaltyShoes(wallet, MULTI.loserPenalty);
    if (picked.length) {
      paid = L.removeShoesByIndex(picked);
      // **먼저 내 지갑에서 빼고 나서** 목록을 올린다. 반대로 하면 올린 뒤 앱이
      // 닫혔을 때 승자는 받는데 나는 안 빠진, 신발이 복제된 상태가 된다.
      const ok = await Room.publishGiven(code, paid);
      if (!ok) {
        // 못 올렸으면 되돌린다 — 아무도 못 받는 신발을 버릴 이유가 없다
        L.addShoes(paid);
        paid = [];
      }
    }
    if (paid.length || !picked.length) {
      L.recordMatch(false);
      L.markSettled(payTag(code));
    }
  }

  // ── 이긴 사람: 내놓인 신발을 걷는다 ────────────────
  let pending = 0;
  if (won) {
    const given = r?.result?.given ?? {};
    for (const loser of rankings.slice(1)) {
      const list = given[loser];
      if (!Array.isArray(list) || !list.length) { pending++; continue; }
      if (L.isSettled(takeTag(code, loser))) continue;
      L.addShoes(list);
      /**
       * 받은 신발이 내 도감에 없던 종류면 **도감에도 새로 등록된다** (기획서 §5-7).
       * 멀티 승리가 도감을 넓히는 유일한 경로라서 이게 빠지면 재미가 반으로 준다.
       */
      for (const i of list) L.recordShoe(i);
      took.push(...list);
      L.markSettled(takeTag(code, loser));
    }
    if (!L.isSettled(payTag(code))) {
      L.recordMatch(true);
      L.markSettled(payTag(code)); // 승자에게 payTag 는 '전적 기록함' 표시로 쓴다
    }
  }

  if (paid.length || took.length) pushWallet();

  return { rank: myIndex + 1, won, paid, took, pending, reward: counts[u.uid] ?? 0 };
}

/**
 * 미정산 청산 — 접속할 때 한 번.
 *
 * 지는 순간 앱을 꺼서 차감을 피하는 걸 막고, 승자가 나중에 올라온 신발을 마저 받게 한다.
 * 조용히 돌고 실패해도 게임을 막지 않는다.
 *
 * @returns {Promise<number>} 실제로 정산된 방 수
 */
export async function sweepUnsettled() {
  const u = currentUser();
  if (!u || u.guest) return 0;
  /**
   * **멀티를 해 본 적이 없으면 아예 붙지 않는다.**
   * 이 함수는 RTDB 를 건드리는데, 그 SDK 청크만 192KB 다. 싱글만 하는 사람에게까지
   * 접속할 때마다 받게 하면 로비가 뜨는 게 그만큼 늦어진다.
   * 방에 들어간 적이 있으면 로컬에 흔적(도장 또는 참가 기록)이 남아 있다.
   */
  if (!L.everPlayedMulti()) return 0;
  let n = 0;
  try {
    for (const code of await Room.myRoomCodes()) {
      // 승자는 패자가 늦게 올릴 수 있으니 payTag 가 찍혔어도 다시 훑는다
      const res = await settleRoom(code);
      if (res && (res.paid.length || res.took.length)) n++;
    }
  } catch { /* 다음 접속에 다시 시도한다 */ }
  return n;
}
