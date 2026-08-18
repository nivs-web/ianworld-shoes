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
 * 단 **아직 못 받은 신발이 있으면 남는다** — 방을 나가면 규칙상 그 신발을 영영 못 걷는다.
 */

import S from '../../config/strings.ko.js';
import { el, button, backButton, screen, title, toast } from '../ui.js';
import { characterById, characterSprite } from '../../data/characters.js';
import { currentUser } from '../../services/auth.js';
import { finishRun } from '../../services/profile.js';
import * as Room from '../../services/multiplayer.js';
import { settleRoom } from '../../services/multiSettle.js';
import MultiMenu from './MultiMenu.js';
import WaitingRoom from './WaitingRoom.js';
import Lobby from '../Lobby.js';

/** 패자가 신발을 올리는 데 걸리는 시간은 보통 1~2초다. 그 창만 덮으면 된다. */
const POLL_MS = 2000;
const POLL_MAX = 5;

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

  (async () => {
    /**
     * 판이 끝났으니 **자동 이탈 예약을 다시 켠다.** 게임 시작 때 `holdRoomSeat` 가
     * 껐는데 다시 켜는 곳이 없어서, 결과 화면에서 탭을 닫으면 그 방에 영원히 남았다.
     */
    Room.rearmRoomSeat(code).catch(() => {});
    room = await Room.readRoom(code);
    settle = await settleRoom(code, room).catch(() => null);
    /**
     * ★ **승자의 판 기록을 계정에 반영한다.** (2026-08-16)
     *
     * 예전에는 멀티 결과가 어디에도 안 들어갔다 — `finishRun()` 호출부가 싱글 한 곳뿐이라
     * 한 판에서 30층을 오르고 신발 5개를 주워도 **전부 버려졌고**, 정산으로 뺏어온
     * 1켤레만 남았다. 기획서 §5-9 는 "멀티 게임: 승자만 기록 반영(방장이 설정한 난이도의
     * 랭킹으로)" 이므로 승패를 아는 여기서 판단한다.
     *
     * 정산보다 **뒤에** 부르는 이유: `finishRun` 이 지갑을 서버로 밀어 올리므로,
     * 강탈분까지 반영된 뒤에 한 번만 올리는 게 맞다.
     */
    if (settle?.won && runResult) {
      try { finishRun(runResult); } catch (e) { console.warn('[multi] 결과 반영 실패', e); }
    }
    // 정산이 신발을 옮겼을 수 있으니 방을 다시 읽어 최신 given 을 반영한다
    if (settle?.pending) room = await Room.readRoom(code);
    done = true;
    if (!gone) nav.refresh();
    // 패자가 몇 초 늦게 올린다 — 그동안 몇 번 더 걷어 본다
    if (settle?.pending) poll();
  })();

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
      }
      if (!next || next.pending) poll();
    }, POLL_MS);
  }

  /**
   * 화면을 떠나며 방에서도 빠진다 — **단, 받을 게 남았으면 남는다.**
   * 방을 나가면 규칙상 `result/settled` 도장을 못 찍어 그 신발을 영영 못 걷는다.
   */
  function releaseSeat() {
    if (keepSeat) return;
    if (settle?.won && settle.pending) return;
    Room.leaveRoom(code).catch(() => {});
  }

  return {
    onLeave() {
      gone = true;
      clearTimeout(pollTimer);
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
          backButton(S.toLobby, () => nav.reset(Lobby))
        );
      }

      const rankings = room?.result?.rankings ?? [];
      const players = room?.players ?? {};
      const won = settle?.won;

      return screen(
        title(S.multiResultTitle),

        el('div.rank-list', null, rankings.map((uid, i) => {
          const v = players[uid] ?? {};
          const ch = characterById(v.characterId);
          return el('div.rank-row', { class: uid === myUid ? 'me' : '' }, [
            el('div.rank-no', String(i + 1)),
            ch ? el('img.rank-face', { src: characterSprite(ch.id, 'front'), alt: ch.ko }) : el('div.rank-face'),
            el('div.rank-name', v.nickname || '???'),
            el('div.rank-value', S.multiRowStat(v.shoesFound ?? 0, v.stairs ?? 0)),
          ]);
        })),

        // 기획서 문구는 토씨 그대로 (§5-7)
        settle
          ? el('div.settle', null, [
              el('div.settle-head', won ? S.won : S.lost),
              won && settle.took.length ? el('div', S.wonReward(settle.took.length)) : null,
              won && settle.pending ? el('div.hint', S.rewardPending(settle.pending)) : null,
            ])
          : el('div.hint', S.settleLater),

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
        button(S.playAgain, () => { nav.reset(Lobby); nav.push(MultiMenu); }),
        backButton(S.toLobby, () => nav.reset(Lobby))
      );
    },
  };
}
