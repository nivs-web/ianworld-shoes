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
import { pickPenaltyShoes, owedBy } from './matchRules.js';
import { MULTI } from '../config/balance.js';

/** 도장 이름 — 방 하나에서 "내가 낸 것"과 "누구한테서 받은 것"을 따로 센다 */
const payTag = (code) => `${code}:pay`;
/**
 * (예전에 있던 `takeTag` 는 없앴다 — 승자가 무엇을 걷었는지는 이제 **서버**가
 *  `result/settled/{uid}` 비트마스크로 들고 있다. 로컬 도장은 저장소를 지우거나
 *  기기를 바꾸면 사라져서 같은 신발을 다시 걷게 만들었다.)
 */

/**
 * 프로필의 지갑 관련 값만 서버로 밀어 올린다.
 * 부활로 신발을 걸 때도 **즉시** 불러야 한다 — 안 그러면 다음 접속의 max 병합이
 * 서버의 옛 값으로 되돌려 놓아 판돈과 지갑에 같은 신발이 동시에 존재하게 된다.
 */
export function syncWallet() { pushWallet(); }

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
  /**
   * ★ **순위가 없는 방 = 끝나지 않은 판.** 여기 내 판돈이 있으면 **되돌려받는다.** (2026-08-19)
   *
   * 부활 비용은 판이 끝나야 승자에게 간다. 상대가 튕기거나 앱을 꺼서 순위가 영영 안
   * 박히면 그 신발은 아무에게도 안 가고 방에만 남는다 — 신발 100켤레를 걸고 그 판이
   * 안 끝나면 **100켤레가 통째로 묶이거나 방과 함께 사라졌다.** (실제 신고 사례)
   *
   * 판이 아직 도는 중일 수도 있으므로 **살아 있는 참가자가 하나도 없을 때만** 회수한다.
   */
  if (!rankings?.length) {
    const 살아있는사람 = Object.values(r?.players ?? {}).some((p) => !p?.waiting && p?.alive !== false);
    if (r && !살아있는사람) {
      const back = await Room.reclaimStake(code).catch(() => null);
      if (back?.length) {
        L.addShoes(back);
        for (const i of back) L.recordShoe(i);
        pushWallet();
        return { rank: 0, won: false, paid: [], took: back, pending: 0, lost: 0, refunded: back.length };
      }
    }
    return null;
  }

  const myIndex = rankings.indexOf(u.uid);
  if (myIndex < 0) return null;
  const won = myIndex === 0;
  const given = r?.result?.given ?? {};
  const me = r?.players?.[u.uid] ?? {};

  let paid = [];
  let took = [];

  /**
   * ── 진 사람: **모자란 만큼만** 낸다 ────────────────────────
   *
   * 역전 배틀에서는 부활할 때마다 이미 20켤레씩 항아리에 넣었다. 그래서 "냈나 안 냈나"의
   * 이분법이 아니라 **얼마를 내야 하는데 얼마를 냈나**로 계산한다.
   *
   *   내야 할 양 = 기본 1켤레 + 20 × 부활 횟수  (`owedBy`)
   *   이미 낸 양 = `given[내uid].length`
   *
   * 이 뺄셈이라 여러 번 불려도 두 번 내지 않는다 — 서버에 남은 목록이 진실이기 때문이다.
   */
  const owed = owedBy(me);
  const already = Array.isArray(given[u.uid]) ? given[u.uid] : [];
  const short = Math.max(0, owed - already.length);
  if (!won && short) {
    const wallet = L.loadProfile().shoesByIndex ?? {};
    const picked = pickPenaltyShoes(wallet, short);
    /**
     * **지갑이 비어 보이면 아무것도 하지 않는다.** 새 기기 첫 실행처럼 서버에서
     * 아직 안 내려온 상태일 수 있다. 그때 "낼 게 없다"로 넘기면 그게 곧 면제다.
     */
    if (picked.length) {
      paid = L.removeShoesByIndex(picked);
      // **먼저 내 지갑에서 빼고 나서** 목록을 올린다 (반대면 신발이 복제된다)
      const ok = await Room.publishGiven(code, [...already, ...paid]);
      if (!ok) {
        L.addShoes(paid);
        paid = [];
      } else if (!L.isSettled(payTag(code))) {
        L.recordMatch(false);
        L.markSettled(payTag(code));
      }
    }
  }

  /**
   * ── 이긴 사람: **항아리를 통째로 가져간다** ──────────────────
   *
   * 역전 배틀의 규칙이다 — 부활 비용까지 전부 승자 몫이다. 내가 건 것도 되돌아온다.
   * 그래서 비트마스크를 **패자 목록이 아니라 순위 전체**(0번 = 나 자신 포함)에 매긴다.
   */
  let pending = 0;
  if (won) {
    let mask = Number(r?.result?.settled?.[u.uid] ?? 0);
    const pickUp = [];
    let claiming = 0;

    rankings.forEach((uid, i) => {
      const bit = 1 << i;
      if (mask & bit) return;                       // 이미 걷었다 (서버 기록)
      const list = given[uid];
      const 낼사람 = uid === u.uid ? (me.revives ?? 0) > 0 : true;
      if (!Array.isArray(list) || !list.length) { if (낼사람) pending++; return; }
      pickUp.push(...list);
      mask |= bit;
      claiming++;
    });

    /**
     * ★ **순위에 없는 사람이 건 신발도 걷는다.** (2026-08-19)
     * 판 도중 튕겨서 방에서 빠진 사람은 `rankings` 에 못 들어가는데(규칙이 참가자만
     * 허용한다) 그 사람이 부활에 건 신발은 항아리에 남는다. 안 걷으면 영원히 묶인다.
     */
    if (!(mask & Room.ORPHAN_BIT)) {
      const 남은것 = Object.entries(given)
        .filter(([uid, v]) => !rankings.includes(uid) && Array.isArray(v) && v.length)
        .flatMap(([, v]) => v);
      if (남은것.length) { pickUp.push(...남은것); mask |= Room.ORPHAN_BIT; claiming++; }
    }

    /**
     * **도장을 먼저 서버에 남기고 나서 지갑에 넣는다.** 순서가 반대면 도장 쓰기가
     * 실패했을 때 다음 접속에 같은 신발을 또 걷어 **복제**된다.
     */
    if (claiming) {
      if (await Room.markSettledRemote(code, mask)) {
        L.addShoes(pickUp);
        for (const i of pickUp) L.recordShoe(i);
        took = pickUp;
      } else {
        pending += claiming;
      }
    }

    if (!L.isSettled(payTag(code))) {
      L.recordMatch(true);
      L.markSettled(payTag(code));
    }
  }

  if (paid.length || took.length) pushWallet();

  return {
    rank: myIndex + 1,
    won,
    paid,
    took,
    pending,
    /** 이 판에서 내가 잃은 총량 (기본 + 부활 비용) — 결과 화면 문구용 */
    lost: won ? 0 : Math.max(owed, already.length + paid.length),
  };
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
      /**
       * ★ **볼일이 끝난 방에서는 빠져나온다.** (2026-08-18)
       *
       * 판을 끝낸 사람이 방에 남아 있으면 그 방은 아무도 못 지우고, 매칭이 훑는
       * `open == true` 앞 12칸을 시체가 차지한다.
       *
       * 아직 받을 신발이 남아도 **나가도 된다** — 규칙에 `result/settled/$uid` 쓰기를
       * 따로 열어 둬서 방 밖에서도 걷을 수 있고(2026-08-18), 신발이 걸린 방은
       * `leaveRoom`·`tidyRoom` 이 지우지 않는다(`mustKeepRoom`).
       */
      await Room.leaveRoom(code).catch(() => {});

      /**
       * ★ **기록을 언제 지우나.** (2026-08-18)
       * 이 목록은 접속할 때마다 훑는다. 지울 조건이 "정산 완료"뿐이면, **영영 정산될 수
       * 없는 항목**(방이 사라졌거나, 순위에 내가 없는 대기자였거나, 결과가 지워진 방)이
       * 20칸을 채워 정작 정산할 방을 밀어낸다. 그래서 **더 볼 일이 없는 방**도 지운다.
       */
      const room = await Room.readRoom(code).catch(() => null);
      const 볼일없음 =
        !room ||                                   // 방이 사라졌다
        (room.result?.rankings && !res) ||          // 순위는 있는데 나와 무관하다 (대기자였다)
        (res && !res.pending);                      // 다 걷었다
      if (볼일없음) {
        await Room.tidyRoom(code).catch(() => {});
        await Room.forgetRoom(code).catch(() => {});
      }
    }
  } catch { /* 다음 접속에 다시 시도한다 */ }
  return n;
}
