/**
 * S18 멀티 결과 — 순위표 + 신발 강탈/상납 메시지. (기획서 §5-7)
 *
 * 정산은 화면이 뜨는 즉시 한 번 돈다. **화면을 안 보면 정산이 안 되는 구조는
 * 위험하다** — 그래서 접속할 때 도는 청산(`sweepUnsettled`)이 따로 있고,
 * 여기서 실패해도 다음 접속에 맞춰진다.
 *
 * 패자가 아직 신발을 안 내놨으면(앱을 껐거나 느림) 승자 화면에 "나중에 들어온다"고
 * 적는다. 0켤레라고 써 놓고 조용히 나중에 채우면 속은 기분이 든다.
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

  (async () => {
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
  })();

  return {
    onLeave() { gone = true; },
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
           *
           * `resetRoom` 은 `result` 를 통째로 지운다 — 그 안에 패자가 내놓은
           * `given` 이 들어 있다. 화면이 뜬 **직후**에 정산이 한 번 돌지만, 패자가
           * 그 뒤에 신발을 올리면(보통 몇 초 늦는다) 승자가 '방에 남기'를 누르는
           * 순간 **아직 아무도 안 받은 신발이 지워진다.** 패자 지갑에서는 이미
           * 빠져나갔으므로 그 신발은 게임에서 증발한다. 실제로 재현했다:
           * `given=[9]` 를 올린 직후 '방에 남기' → 승자 보유량 987 그대로, `result` 는 null.
           *
           * 지우기 직전에 다시 걷으면 이 창이 닫힌다. 리셋 뒤에 올라오는 신발은
           * `settleRoom` 이 `rankings` 없이는 아무것도 하지 않으므로 패자도 안 낸다.
           */
          try { await settleRoom(code); } catch { /* 못 걷어도 리셋은 진행한다 */ }
          const ok = await Room.resetRoom(code).catch(() => false);
          staying = false;
          if (gone) return;
          if (ok) return nav.replace(WaitingRoom, { code });
          toast(S.networkError);
          nav.refresh();
        }, { primary: true, disabled: staying }),
        button(S.playAgain, () => { nav.reset(Lobby); nav.push(MultiMenu); }),
        backButton(S.toLobby, () => nav.reset(Lobby))
      );
    },
  };
}
