/**
 * S18 멀티 결과 — 순위표 + 신발 강탈/상납 메시지. (기획서 §5-7)
 *
 * 정산은 화면이 뜨는 즉시 한 번 돈다. **화면을 안 보면 정산이 안 되는 구조는
 * 위험하다** — 그래서 접속할 때 도는 청산(`sweepUnsettled`)이 따로 있고,
 * 여기서 실패해도 다음 접속에 맞춰진다.
 *
 * 패자가 아직 신발을 안 내놨으면(앱을 껐거나 느림) 승자 화면에 "나중에 들어온다"고
 * 적는다. 0켤레라고 써 놓고 조용히 나중에 채우면 속은 기분이 든다.
 *
 * ## 이 화면은 **방을 정리하는 자리**이기도 하다 (2026-08-18)
 *
 * 예전에는 여기서 나가도 방에 그대로 남았다. `leaveRoom` 호출부가 대기방 하나뿐이라
 * 판을 끝낸 사람들이 전부 시체로 쌓였고, 매칭은 `open == true` 인 방 앞 12개만
 * 훑으므로 **시체 12개면 모두가 새 방만 파게 된다.** 그래서 나갈 때 방에서도 빠지고,
 * 탭을 그냥 닫는 경우를 위해 자동 이탈 예약도 다시 켠다(`rearmRoomSeat`).
 * 받을 신발이 남아 있어도 나간다 — 방 밖에서도 걷을 수 있게 규칙을 열었고
 * (`result/settled/$uid`), 신발이 남은 방은 아무도 못 지운다(`hasUnclaimed`).
 */

import S from '../../config/strings.ko.js';
import { el, button, backButton, screen, title, toast } from '../ui.js';
import { characterById, characterSprite } from '../../data/characters.js';
import { slotIndex } from '../../services/matchRules.js';
import { SLOT_COLORS, SLOT_DIM } from '../../game/palette.js';
import { MULTI } from '../../config/balance.js';
import { currentUser } from '../../services/auth.js';
import { finishRun } from '../../services/profile.js';
import * as Room from '../../services/multiplayer.js';
import { roundOver, potShoes, owedBy } from '../../services/matchRules.js';
import { settleRoom } from '../../services/multiSettle.js';
import { hold } from '../../core/hold.js';
import WaitingRoom from './WaitingRoom.js';
import Lobby from '../Lobby.js';

/** 패자가 신발을 올리는 데 걸리는 시간은 보통 1~2초다. 그 창만 덮으면 된다. */
const POLL_MS = 2000;
const POLL_MAX = 5;


/**
 * ★ **순위 한 줄.** (2026-08-19)
 *
 * 왼쪽 숫자는 예전엔 그냥 목록 번호였다 — 아무 의미가 없어서 **등수**로 바꿨다(1등·2등…).
 * 얼굴은 **자리 색 3도트 테두리**로 감싸고, 그 테두리를 **6칸**으로 나눠 부활을 몇 번
 * 썼는지 보여 준다(안 쓰면 꽉 참, 6번 다 쓰면 전부 꺼짐). 인게임 레이스 게이지와
 * **같은 그림**이라 "저 사람이 부활을 몇 개 써서 이겼는지"가 결과 화면에서도 그대로 읽힌다.
 */
function rankRow({ uid, v, i, myUid, players, label }) {
  const ch = characterById(v.characterId);
  const slot = Math.max(0, Math.min(SLOT_COLORS.length - 1, slotIndex(players, uid)));
  const 남은칸 = Math.max(0, MULTI.maxRevives - (v.revives ?? 0));
  return el('div.rank-row', { class: uid === myUid ? 'me' : '' }, [
    el('div.rank-no', label ?? S.rankTag(i + 1)),
    el('div.face-frame', { style: { '--slot': SLOT_COLORS[slot], '--dim': SLOT_DIM[slot] } }, [
      ch ? el('img.rank-face', { src: characterSprite(ch.id, 'front'), alt: ch.ko }) : el('div.rank-face'),
      // 6칸 테두리 — 순서는 인게임과 같다(위 왼쪽 → 시계 방향)
      el('div.rev-ring', null, Array.from({ length: MULTI.maxRevives }, (_, k) =>
        el(`div.rev-seg.s${k}`, { class: k < 남은칸 ? 'on' : 'off' }))),
    ]),
    el('div.rank-name', v.nickname || '???'),
    el('div.rank-value', S.multiRowStat(v.shoesFound ?? 0, v.stairs ?? 0)),
    v.revives ? el('div.tag-bet', `+${v.revives * MULTI.reviveCost}`) : null,
  ]);
}

export default function MultiResult(nav, params = {}) {
  const code = params.code;
  /** 이번 판의 성과 (계단·주운 신발). 승자만 계정에 반영한다 — 기획서 §5-9 */
  const runResult = params.result ?? null;
  const myUid = currentUser()?.uid;
  let room = null;
  let settle = null;
  let done = false;
  let gone = false;
  /** '방에 남기'를 두 번 누르지 않게 */
  let staying = false;
  /** 방에 남기로 했으면 화면을 떠날 때 방에서 빠지면 안 된다 */
  let keepSeat = false;
  let pollTimer = null;
  let polls = 0;
  let unsub = () => {};
  let settled = false;
  let finalizing = false;
  /** 정산 중에 자동 새로고침이 끼어들면 신발이 공중에 뜬다 */
  const release = hold();
  /**
   * ★ **결과 화면에서도 "여기 있다"를 계속 보낸다.** (2026-08-19)
   * `resetRoom`(방에 남기)은 신호가 살아 있는 사람만 다음 판에 데려간다. 이게 없으면
   * 결과를 보고 있는 사이에 상대가 '방에 남기'를 눌러 **나만 방에서 빠진다.**
   */
  const beat = setInterval(() => {
    // 방에 내가 남아 있을 때만 — 아니면 유령 노드를 만든다
    if (!room?.players?.[myUid]) return;
    Room.heartbeat(code).catch(() => {});
  }, MULTI.heartbeatMs);

  /**
   * ★ **판이 아직 안 끝났을 수 있다.** (2026-08-18 역전 배틀)
   *
   * 예전에는 "누가 죽으면 즉시 종료"라 이 화면이 뜰 때 순위가 이미 확정돼 있었다.
   * 이제는 내가 먼저 포기하고 나와도 **남은 사람들은 계속 오르고 있다.** 그래서
   * 방을 **구독**하고, 순위가 박히는 순간 정산으로 넘어간다. 그때까지는
   * "다른 사람들이 아직 오르고 있습니다" 를 보여 준다 — 빈 순위표보다 정직하다.
   *
   * 그리고 **아무도 안 끝냈으면 내가 끝낸다** — 마지막까지 남은 사람이 나갈 때
   * 순위를 박을 사람이 없으면 판이 영영 안 끝난다(`roundOver` 는 순수 함수라
   * 누가 계산해도 같은 답이 나온다).
   */
  /**
   * ★ **어떤 경우에도 화면이 뜬다.** (2026-08-19)
   *
   * 방을 못 읽거나(오프라인) 방이 이미 지워졌으면 구독 콜백이 아예 안 온다 —
   * 그러면 "로딩" 한 줄만 남은 화면에 갇힌다. 사용자에게는 그게 "튕김"이다.
   * 정산은 다음 접속의 청산이 마저 하므로, 여기서는 **로비로 나갈 길**만 보장하면 된다.
   */
  const 안전망 = setTimeout(() => {
    if (gone || done) return;
    done = true;
    nav.refresh();
  }, 8000);

  unsub = Room.subscribeRoom(code, async (r) => {
    if (gone) return;
    if (!r) {
      // 방이 사라졌다 = 여기서 할 일이 없다. 결과는 다음 접속에 맞춰진다
      done = true;
      nav.refresh();
      return;
    }
    room = r;
    if (!r.result?.rankings) {
      const now = Date.now() + Room.serverOffsetSync();
      if (!finalizing && roundOver(r, now)) {
        finalizing = true;
        Room.finalizeResult(code).catch(() => {}).then(() => { finalizing = false; });
      }
      done = true;                       // 화면은 그린다 (대기 안내)
      nav.refresh();
      return;
    }
    if (settled) { nav.refresh(); return; }
    settled = true;
    unsub();
    unsub = () => {};
    await runSettle();
  });

  async function runSettle() {
    /**
     * 판이 끝났으니 **자동 이탈 예약을 다시 켠다.** 게임 시작 때 `holdRoomSeat` 가
     * 껐는데 다시 켜는 곳이 없어서, 결과 화면에서 탭을 닫으면 그 방에 영원히 남았다.
     */
    Room.rearmRoomSeat(code).catch(() => {});
    settle = await settleRoom(code, room).catch(() => null);
    /**
     * ★ **승자의 판 기록을 계정에 반영한다.** (2026-08-16)
     * `finishRun()` 호출부가 싱글 한 곳뿐이라 멀티 한 판의 계단·신발이 통째로 버려졌다.
     * 기획서 §5-9 는 "멀티 게임: 승자만 기록 반영" 이므로 승패를 아는 여기서 판단한다.
     */
    if (settle?.won && runResult) {
      try { finishRun(runResult); } catch (e) { console.warn('[multi] 결과 반영 실패', e); }
    }
    if (settle?.pending) room = await Room.readRoom(code);
    done = true;
    if (!gone) nav.refresh();
    if (settle?.pending) poll();
  }

  /**
   * ★ **못 받은 신발을 몇 초 동안 다시 걷어 본다.** (2026-08-18)
   *
   * 예전에는 화면이 뜰 때 딱 한 번만 걷었다. 패자는 보통 1~2초 뒤에 올리므로
   * 거의 항상 "잠시 후 들어옵니다"가 뜨고, 그 상태로 '방에 남기'를 누르면
   * `result` 가 지워져 **그 신발이 증발했다.** 여기서 미리 걷어 두면 그 창이 닫힌다.
   */
  function poll() {
    if (gone || polls >= POLL_MAX) return;
    polls++;
    pollTimer = setTimeout(async () => {
      const next = await settleRoom(code).catch(() => null);
      if (gone) return;
      if (next) {
        settle = {
          ...next,
          took: [...(settle?.took ?? []), ...next.took],
          won: settle?.won ?? next.won,
        };
        room = await Room.readRoom(code);
        if (gone) return;
        nav.refresh();
        if (next.pending) poll();
        return;
      }
      /**
       * ★ **`null` 은 "아직"이 아니라 "이제 없다"일 수 있다.** (2026-08-18)
       * 방이 지워졌거나 결과가 초기화되면 `settleRoom` 이 `null` 을 준다. 그걸
       * "아직 안 왔다"로 취급하면 **오지 않을 신발을 계속 기다린다고 써 놓게 된다.**
       * 방을 다시 읽어 순위가 살아 있을 때만 기다린다.
       */
      const still = await Room.readRoom(code).catch(() => null);
      if (gone) return;
      if (still?.result?.rankings) { poll(); return; }
      settle = settle ? { ...settle, pending: 0 } : null;
      nav.refresh();
    }, POLL_MS);
  }

  /**
   * 화면을 떠나며 방에서도 빠진다.
   *
   * ★ **받을 게 남아도 나간다.** (2026-08-18 재수정)
   * 처음에는 "미수령이면 방에 남는다"로 뒀는데, 그러면 결과 화면에서 새로고침하거나
   * 탭을 닫는 순간 **다시 켜 둔 `onDisconnect` 가 나를 방에서 빼 버린다.** 실측으로
   * 그 상태를 재현했다 — 방 밖이라 `settled` 도장을 못 찍어 패자가 낸 신발이
   * 영영 안 들어왔다. 그래서 방향을 뒤집었다: **방 밖에서도 걷을 수 있게** 규칙을 열고
   * (`result/settled/$uid`), 신발이 남은 방은 아무도 못 지우게 막았다(`hasUnclaimed`).
   * 이제 나가는 게 항상 안전하고, 방도 시체로 남지 않는다.
   */
  /** 정산 결과가 아직 없을 때 "얼마 잃었나"를 순위·부활 횟수로 계산한다 */
  function myOwed() {
    return owedBy(room?.players?.[myUid] ?? {});
  }

  function releaseSeat() {
    if (keepSeat) return;
    Room.leaveRoom(code).catch(() => {});
  }

  return {
    onLeave() {
      gone = true;
      unsub();
      clearTimeout(안전망);
      clearInterval(beat);
      clearTimeout(pollTimer);
      release();
      releaseSeat();
    },
    render() {
      /**
       * 로딩 중에도 **나갈 길을 준다.** 예전에는 "로딩 중" 한 줄만 있는 화면을 돌려줘서,
       * 방을 읽는 사이 연결이 끊기면(지하철·엘리베이터) 버튼이 0개인 화면에 갇혔다.
       * 이 화면은 `nav.reset` 으로 들어와 깊이가 1이라 하드웨어 뒤로도 안 먹는다.
       */
      if (!done) {
        return screen(
          title(S.multiResultTitle),
          el('div.hint', S.loading),
          el('div.spacer'),
          backButton(S.leaveToLobby, () => nav.reset(Lobby))
        );
      }

      const rankings = room?.result?.rankings ?? [];
      const players = room?.players ?? {};
      /**
       * ★ **1등이면 메시지는 무조건 뜬다.** (2026-08-19)
       *
       * 예전에는 `settle` 이 있을 때만 승패 문구를 띄웠다. 그런데 정산은 여러 이유로
       * 늦거나 `null` 이 된다(방을 이미 나갔다·순위가 방금 박혔다·네트워크). 그러면
       * **이긴 사람이 아무 말도 못 듣는다** — 사용자가 신고한 "간혹 안 뜬다"가 이것이다.
       * 순위표만 있으면 승패는 확정이므로, 문구는 순위로 판단한다.
       */
      const won = settle?.won ?? (rankings.length ? rankings[0] === myUid : undefined);

      /**
       * 순위가 아직 없다 = 남은 사람들이 계속 오르고 있다 (역전 배틀).
       *
       * ★ **그냥 기다리라고만 하면 답답하다.** 내가 먼저 나온 판이 어떻게 흘러가는지
       * 보이는 편이 낫다 — 지금 누가 몇 계단인지, 걸린 신발이 얼마인지 실시간으로 보여 준다.
       * (방을 구독하고 있으므로 값은 저절로 갱신된다)
       */
      if (!rankings.length) {
        const live = Object.entries(players)
          .filter(([, v]) => !v.waiting)
          .sort((a, b) => (b[1].stairs ?? 0) - (a[1].stairs ?? 0));
        return screen(
          title(S.multiResultTitle),
          el('div.warn', null, [el('div', S.waitingOthers)]),
          el('div.hint', S.potLine(potShoes(room))),
          el('div.rank-list', null, live.map(([uid, v], i) =>
            rankRow({ uid, v, i, myUid, players }))),
          el('div.spacer'),
          backButton(S.leaveToLobby, () => nav.reset(Lobby))
        );
      }

      return screen(
        title(S.multiResultTitle),

        /**
         * ★ **승패를 먼저, 크게.** (2026-08-19)
         * 예전에는 순위표부터 나오고 승패 문구가 작게 붙었다. 이 게임에서 사람이 제일
         * 먼저 알고 싶은 건 "내가 이겼나"다. 이긴 사람에게는 깃발까지 보여 준다.
         */
        won === undefined
          ? el('div.hint', S.settleLater)
          : won
          ? el('div.victory', null, [
              el('img.victory-flag', { src: '/assets/ui/victory_flag.png', alt: S.winBig }),
              el('div.victory-big', S.winBig),
              el('div.victory-sub', S.winSub),
              el('div.victory-pot', null, [
                el('span', S.wonPotPre + ' '),
                el('span.pot-num', S.wonPotShoes(potShoes(room))),
                el('span', S.wonPotPost),
              ]),
              settle?.pending ? el('div.hint', S.rewardPending(settle.pending)) : null,
            ])
          : /**
             * 패배창도 **승리창과 같은 뼈대**로 짠다 (2026-08-19, 사용자 요청):
             *   깃발 → 큰 문구 → 작은 문구 → 숫자 줄 → (패배만) 팁 상자
             * 같은 자리에 같은 크기로 놓여야 승/패가 "같은 화면의 두 얼굴"로 읽힌다.
             * 색만 반대다 — 승리는 노랑/초록, 패배는 붉은 계열.
             */
            el('div.defeat', null, [
              el('img.defeat-flag', { src: '/assets/ui/defeat_flag.png', alt: S.loseBig }),
              el('div.defeat-big', S.loseBig),
              el('div.defeat-sub', S.loseSub),
              // 기획서에 못 박힌 문구라 토씨를 바꾸지 않는다 (§6-2)
              el('div.defeat-lost', S.loseTaken(settle?.lost ?? myOwed())),
              el('div.tip', null, [
                el('div.tip-head', S.tipTitle),
                el('div', S.tipBody1),
                el('div', S.tipBody2),
              ]),
            ]),

        el('div.rank-list', null, rankings.map((uid, i) =>
          rankRow({ uid, v: players[uid] ?? {}, i, myUid, players }))),

        el('div.spacer'),
        /**
         * ★ **로비를 스택 바닥에 깔고 그 위에 멀티 메뉴를 얹는다.** (2026-08-16)
         * 예전에는 `nav.reset(MultiMenu)` 라 스택에 멀티 메뉴 하나만 남았고,
         * 거기서 `뒤로` 를 누르면 `router.js` 가 깊이 1에서는 아무것도 안 해서
         * **로비로 돌아갈 길이 사라졌다.** 신발이 2켤레 미만이면 방 입장 버튼도
         * 전부 비활성이라 완전히 갇혔다. (`Lobby.js` 에 같은 함정 기록이 있다)
         */
        /**
         * ★ **방에 남아 다음 판을 한다.** (2026-08-16)
         * 게임 중에 들어온 대기자는 이 버튼이 눌려 방이 `waiting` 으로 돌아와야
         * 비로소 자기 판을 할 수 있다. 누가 눌러도 결과가 같다(이미 대기중이면 무시).
         */
        button(S.stayInRoom, async () => {
          if (staying) return;
          staying = true;
          nav.refresh();
          /**
           * ★ **되돌리기 전에 한 번 더 걷는다.** (2026-08-18)
           * `resetRoom` 은 `result` 를 통째로 지운다 — 그 안에 패자가 내놓은 `given` 이
           * 들어 있다. 승자가 걷기 전에 지우면 그 신발은 게임에서 증발한다.
           * (서버도 안 걷힌 신발이 있으면 `'pending'` 을 돌려주고 리셋을 거부한다)
           */
          try { await settleRoom(code); } catch { /* 못 걷어도 아래에서 막힌다 */ }
          const r = await Room.resetRoom(code).catch(() => false);
          staying = false;
          if (gone) return;
          if (r === 'ok') {
            keepSeat = true;            // 다음 판을 하려고 남는 것이다 — 나가면 안 된다
            return nav.replace(WaitingRoom, { code });
          }
          toast(r === 'pending' ? S.resetPending : S.networkError);
          if (r === 'pending') setTimeout(() => { if (!gone) nav.refresh(); }, 400);
          nav.refresh();
        }, { primary: true, disabled: staying }),
        /**
         * ★ **로비로 나가는 길은 여기 하나뿐이다.** (2026-08-19)
         * 인게임 '기권하고 나가기'도 로비가 아니라 이 화면으로 온다. 판이 끝나면
         * 무조건 결과를 보고, 나가려면 여기서 한 번 더 눌러야 한다 —
         * 그래야 "졌는지 이겼는지 모르고 로비에 와 있는" 일이 없다.
         */
        backButton(S.leaveToLobby, () => nav.reset(Lobby))
      );
    },
  };
}
