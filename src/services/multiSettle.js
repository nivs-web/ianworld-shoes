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
import { pickPenaltyShoes, owedBy, outOfRound, foundShoesTotal, foundOf, rollFoundShoe } from './matchRules.js';
import { MULTI } from '../config/balance.js';

/**
 * 도장 이름 — "이 판에서 내 몫을 처리했다".
 *
 * ★ **판(round) 단위여야 한다.** (2026-08-19 15차)
 *
 * 예전에는 `` `${code}:pay` `` 였다. 그런데 결과 화면의 `계속하기` 는 **같은 방 코드로**
 * 다음 판을 돈다(`resetRoom`). 그래서 2판째부터는 도장이 이미 찍혀 있어
 *   · 승자가 **남들이 주운 신발 보너스를 못 받고**
 *   · 승패 기록(`recordMatch`)이 아예 안 쌓였다 — 로비 승률이 첫 판에서 멈춘다.
 * 한 방에서 계속 이어 하는 것이 가장 흔한 플레이인데 그 경로가 통째로 새고 있었다.
 *
 * 판을 가르는 열쇠는 **둘을 겹쳐** 쓴다 — `result.endedAt`(판마다 서버가 새로 찍는 종료
 * 시각)과 `seed`(`resetRoom` 이 다음 판마다 다시 뽑는 계단 시드). 하나만 쓰면 두 판이
 * 같은 밀리초에 끝나거나 시드가 우연히 겹칠 때 도장이 충돌한다.
 */
const payTag = (code, r) => `${code}:${r?.seed ?? 0}:${r?.result?.endedAt ?? 0}:pay`;
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
/**
 * 승리 기록은 **판마다 한 번만.** 로컬 통계(로비 승률)라 서버 도장이 없으므로
 * 판 단위 로컬 도장으로 막는다 — 정산은 여러 번 불릴 수 있다(결과 화면 + 재시도 + 청산).
 */
function markWin(code, r) {
  if (L.isSettled(payTag(code, r))) return;
  L.recordMatch(true);
  L.markSettled(payTag(code, r));
}

/**
 * ★ **같은 방을 동시에 정산하지 않는다.** (2026-08-19 15차)
 *
 * `settleRoom` 은 ① 서버에서 걷은 양을 읽고 ② 얼마를 더 걷을지 정하고 ③ 도장을 쓰고
 * ④ 지갑에 넣는다. ①~③ 사이에 **똑같은 호출이 하나 더** 들어오면 둘 다 같은 답을
 * 계산해서 **같은 판돈을 두 번 지갑에 넣는다** — 서버 `claims` 는 두 쓰기가 같은 값이라
 * 아무것도 못 막는다.
 *
 * 그 창은 실제로 열려 있었다: 결과 화면은 미수령이 있으면 2초마다 다시 걷는데
 * (`poll`), 그 왕복 도중에 사용자가 `계속하기` 를 누르면 그쪽도 `settleRoom` 을 부른다.
 *
 * 이미 도는 게 있으면 **그 프라미스를 그대로 돌려준다** — 두 호출자가 같은 결과를 보고,
 * 계산은 한 번만 돈다.
 */
const inflight = new Map();

export async function settleRoom(code, room = null) {
  const running = inflight.get(code);
  if (running) return running;
  const p = settleOnce(code, room).finally(() => inflight.delete(code));
  inflight.set(code, p);
  return p;
}

async function settleOnce(code, room = null) {
  const u = currentUser();
  if (!u || u.guest) return null;
  let r = room ?? await Room.readRoom(code);
  /**
   * ★ **끝날 수 있는 판이면 여기서 끝낸다.** (2026-08-19)
   *
   * 순위를 박는 건 지금까지 **화면**의 일이었다. 그래서 둘 다 앱이 죽거나 튕기면
   * 판이 영영 안 끝나고 — 순위가 없으니 아무도 정산을 못 하고 — 항아리에 걸린
   * 신발이 주인을 잃었다. 정산이 시작될 때마다 한 번 확인하면, 접속만 해도
   * (`sweepUnsettled`) 밀린 판이 스스로 정리된다.
   */
  if (!r?.result?.rankings && r && Room.roundOverNow(r)) {
    const after = await Room.finalizeResult(code).catch(() => null);
    if (after) r = after;
  }
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
    // "아직 뛰는 사람"의 기준은 종료 판정과 **글자 그대로 같아야** 한다 —
    // 여기만 `alive` 를 보면 튕겨서 신호가 끊긴 사람이 영원히 회수를 막는다
    const now = Date.now() + Room.serverOffsetSync();
    const 살아있는사람 = Object.values(r?.players ?? {}).some((p) => !p?.waiting && !outOfRound(p, now));
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
   * ★ **아직 처리 못 한 것이 있으면 그 수를 남긴다.** (2026-08-19 15차)
   *
   * 예전에는 `pending` 을 **승자 쪽에서만** 셌다. 그래서 진 사람은 언제나 0 이었고,
   * `sweepUnsettled` 의 "볼일없음" 판정(`res && !res.pending`)이 **무조건 참**이 되어
   * 다음 접속 때 재시도할 기록(`userRooms`)을 지워 버렸다. 납부가 한 번 실패하면
   * (12초 시한 초과 등) 그 빚은 **영구 면제**되고 승자는 영영 못 받는다.
   */
  let pending = 0;

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
        pending++;                       // 다음 접속에 다시 낸다 — 기록을 지우면 안 된다
      } else if (!L.isSettled(payTag(code, r))) {
        L.recordMatch(false);
        L.markSettled(payTag(code, r));
      }
    } else {
      /**
       * 지갑이 비어 보인다 — 서버에서 아직 안 내려왔을 수 있다(바로 위 주석).
       * 그렇다면 **다음 접속에 다시 시도해야 하므로** 볼일이 끝난 게 아니다.
       */
      pending++;
    }
  }

  /**
   * ── 이긴 사람: **항아리를 통째로 가져간다** ──────────────────
   *
   * 역전 배틀의 규칙이다 — 부활 비용까지 전부 승자 몫이다. 내가 건 것도 되돌아온다.
   * 그래서 비트마스크를 **패자 목록이 아니라 순위 전체**(0번 = 나 자신 포함)에 매긴다.
   */
  if (won) {
    /**
     * ★ **얼마를 걷었는지 사람별로 센다.** (2026-08-19)
     *
     * 예전에는 사람마다 비트 하나였다. 그런데 한 사람이 **두 번에 나눠 낸다** —
     * 부활 때 20켤레를 먼저 걸고, 판이 끝난 뒤 기본 1켤레를 마저 낸다. 비트를 먼저
     * 찍어 버리면 나중에 올라온 1켤레는 **영영 아무에게도 안 간다.** 시뮬레이터가
     * 그 1켤레가 사라지는 것을 재현했다(`_multi-sim.mjs` S10).
     *
     * 이제 "목록 길이 − 이미 걷은 수" 만큼만 더 걷는다. 몇 번에 나눠 내든 정확히 한 번씩.
     */
    const 걷은양 = Room.claimedCounts(r, u.uid);
    const pickUp = [];
    const 다음도장 = {};

    for (const [uid, list] of Object.entries(given)) {
      if (!Array.isArray(list) || !list.length) continue;
      const 이미 = 걷은양[uid] ?? 0;
      const 남은것 = list.slice(이미);
      if (남은것.length) pickUp.push(...남은것);
      // 옛 비트 도장을 켤레 수로 옮겨 적는다 — 안 그러면 다음 번에 다시 걷어 복제된다
      다음도장[uid] = list.length;
    }

    /** 아직 다 안 낸 사람이 몇 명인가 — 결과 화면이 "잠시 후 들어옵니다"를 쓸 때 쓴다 */
    for (const uid of rankings) {
      const p = r?.players?.[uid] ?? {};
      const 낼양 = uid === u.uid ? (p.revives ?? 0) * MULTI.reviveCost : owedBy(p);
      const 낸양 = Array.isArray(given[uid]) ? given[uid].length : 0;
      if (낸양 < 낼양) pending++;
    }

    /**
     * ★ **주운 신발 보너스에도 서버 도장을 찍는다.** (2026-08-19 15차)
     *
     * 판돈은 `claims` 로 서버가 세고 있었는데, **주운 신발 보너스만 로컬 도장**에 기대고
     * 있었다. 로컬 도장은 저장소를 지우거나 기기를 바꾸면 사라진다 — 그러면 **없던
     * 신발이 다시 굴려져** 총량이 늘어난다(§9-0-14 에서 판돈 쪽은 같은 이유로 서버로 옮겼다).
     *
     * `claims/<나>/found` 에 굴린 개수를 남긴다. `result` 는 다음 판에 통째로 지워지므로
     * **판마다 새로 굴린다** — '계속하기' 로 이어 하는 판이 그대로 정산된다.
     *
     * 15차 이전 클라이언트가 찍은 도장은 `found` 키가 없다. 그 경우는 **이미 굴린 것**으로
     * 본다(그쪽은 로컬 도장으로 처리했다) — 배포 직후 한 판이 두 번 굴려지는 걸 막는다.
     */
    const 옛도장 = 걷은양 && typeof 걷은양 === 'object'
      && Object.keys(걷은양).length > 0 && !Number.isFinite(걷은양.found);
    const 굴림완료 = Number.isFinite(걷은양.found) || 옛도장;
    const bonusN = 굴림완료 ? 0 : foundShoesTotal(r, u.uid);
    /**
     * 도장은 **항상** 실어 보낸다. `markSettledRemote` 는 `claims/<나>` 를 통째로
     * 덮어쓰므로, 안 실으면 다음 쓰기 한 번에 `found` 가 지워져 또 굴리게 된다.
     */
    다음도장.found = 굴림완료 ? (걷은양.found ?? 0) : Math.min(220, bonusN);

    /**
     * **도장을 먼저 서버에 남기고 나서 지갑에 넣는다.** 순서가 반대면 도장 쓰기가
     * 실패했을 때 다음 접속에 같은 신발을 또 걷어 **복제**된다.
     */
    if (pickUp.length || !굴림완료) {
      if (await Room.markSettledRemote(code, 다음도장, Room.claimMask(r, 다음도장))) {
        if (pickUp.length) {
          L.addShoes(pickUp);
          for (const i of pickUp) L.recordShoe(i);
          took = pickUp;
        }
        /**
         * ★ **판 도중 다들 주운 신발도 전부 1등이 가져간다.** (2026-08-19, 사용자 신고)
         *
         * 어떤 신발인지는 상대 화면에만 있어(개수만 방으로 온다) 그대로 옮길 수 없으므로
         * **개수만큼 새로 굴려** 승자 지갑에 넣는다.
         */
        if (bonusN > 0) {
          const bonus = Array.from({ length: bonusN }, () => rollFoundShoe());
          L.addShoes(bonus);
          for (const i of bonus) L.recordShoe(i);
          took = [...took, ...bonus];
        }
        markWin(code, r);
      } else {
        pending++;
      }
    } else {
      markWin(code, r);   // 걷을 것도 굴릴 것도 없다 — 승패 기록만 남긴다
    }
  }

  if (paid.length || took.length) pushWallet();

  return {
    rank: myIndex + 1,
    won,
    paid,
    took,
    pending,
    /**
     * 이 판에서 내가 잃은 총량 — 결과 화면의 `내 소중한 신발 N켤레를 뺏겼습니다` 용.
     *
     * 판돈(기본 1 + 부활 20×N)**에 더해, 판 중에 내가 주운 신발도 센다** (2026-08-19).
     * 진 사람의 습득분은 지갑에 들어오지 않고 그대로 승자에게 가므로(`foundShoesTotal`),
     * 사용자 입장에서는 그것도 똑같이 뺏긴 것이다 — 안 세면 숫자가 실제보다 작게 보인다.
     */
    lost: won ? 0 : Math.max(owed, already.length + paid.length) + foundOf(r, u.uid),
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
