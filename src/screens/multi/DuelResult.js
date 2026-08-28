/**
 * S26 결투 결과 — 누가 이겼고 금화가 어디로 갔나.
 *
 * ★★ **신발 멀티 결과창의 뼈대를 그대로 쓴다.** (2026-08-27, 사용자 지정)
 *
 * *"결과창 '신발을 찾아서' 멀티게임의 결과창 디자인을 참고해서 최대한 적용해,
 *   보유한 금화 총 수량을 보여준다거나"*
 *
 *     깃발 → 큰 문구 → 작은 문구 → 숫자 줄 → 순위표 → 보유 금화 → [한 판 더][로비로]
 *
 * 승리창과 패배창이 **같은 자리에 같은 크기**로 놓인다 — 색만 반대다.
 * 그래야 승/패가 "같은 화면의 두 얼굴" 로 읽힌다 (`MultiResult.js` 의 기록).
 *
 * ★ **상대를 기다린다.** 300초는 각자 재는 시계라 몇 초쯤 어긋난다. 내가 먼저
 * 끝났는데 그 순간 판정하면 아직 뛰고 있는 상대가 진 것이 된다. 그래서 둘 다
 * 끝났다는 신호가 오거나 기다림이 한계를 넘을 때까지 기다렸다가 센다.
 *
 * 판정은 **양쪽이 각자 같은 규칙으로** 한다(`dragonSettle.duelRanking`).
 * 서버가 심판을 보지 않으므로 순서가 완전히 결정적이어야 둘이 같은 답을 낸다.
 */

import S from '../../config/strings.ko.js';
import { el, button, backButton, screen, title, toast } from '../ui.js';
import { currentUser } from '../../services/auth.js';
import { get as getProfile } from '../../services/profile.js';
import * as Room from '../../services/multiplayer.js';
import { duelRanking, settleDuel, refundDuel, DUEL_STAKE } from '../../services/dragonSettle.js';
import { loadDragon } from '../DragonGame.js';
import WaitingRoom from './WaitingRoom.js';
import DragonLobby from '../DragonLobby.js';

/** 상대를 이만큼까지 기다린다 — 넘으면 튕긴 것으로 보고 센다 */
const WAIT_MS = 20000;

export default function DuelResult(nav, params = {}) {
  const code = params.code;
  const me = currentUser()?.uid;

  let live = true;
  let room = null;
  let outcome = null;        // 정산 결과 (한 번만)
  let mod = null;
  let waitedFrom = Date.now();
  /** 상대가 안 와서 되돌려받은 금화 (0이면 정상적으로 겨뤘다) */
  let refunded = 0;
  /**
   * ★★ **한 판 더는 방에 남는다.** (2026-08-27, 사용자 신고)
   *
   * *"한판더 누르면 로비로 튕겨"*
   *
   * 예전에는 `onLeave` 가 **무조건** `leaveRoom` 을 불렀고 단추는 `nav.back()`
   * 이었다. 그래서 한 판 더를 누르면 방에서 빠지면서 스택도 같이 빠져
   * 로비까지 밀려났다. 신발 쪽은 이미 답을 갖고 있다 — 남으려고 나가는
   * 것이므로 **자리를 지킨다**고 표시하고 대기방으로 `replace` 한다.
   */
  let keepSeat = false;
  let staying = false;

  loadDragon().then((m) => { mod = m; if (live) nav.refresh(); }).catch(() => {});

  /** 방을 지켜보다가 둘 다 끝나면 센다 */
  const unsub = Room.subscribeRoom(code, (r) => {
    if (!live || !r) return;
    room = r;
    if (!outcome) {
      const players = Object.values(r.players ?? {}).filter((p) => p && !p.waiting);
      const 모두끝 = players.length >= 2 && players.every((p) => p.done === true);
      /**
       * ★★ **최후의 생존자 하나만 남으면 그 자리에서 센다.** (2026-08-27,
       *   사용자 지정 — 최대 4인으로 확장)
       *
       * *"각자 맵에서 각자 알아서 생존하는거고... 끝까지 살아남아야 이기는건데"*
       *
       * 예전 1대1은 "한 명이 죽으면 그 자리에서 센다"로 충분했다 — 둘 중
       * 하나가 죽으면 남는 사람이 정확히 하나였기 때문이다. N인이면 다르다.
       * 넷 중 하나가 죽었다고 그 자리에서 판을 끊으면, 아직 셋이나 겨루고
       * 있는데 순위가 미리 굳어 버린다. **살아 있는 사람이 하나 이하로
       * 줄었을 때만** 더 볼 것이 없다.
       */
      const 살아있는수 = players.filter((p) => p.alive !== false).length;
      const 최후생존 = players.length >= 2 && 살아있는수 <= 1;
      const 오래기다림 = Date.now() - waitedFrom > WAIT_MS;
      if (players.length >= 2 && (모두끝 || 최후생존 || 오래기다림)) {
        outcome = settleDuel(r);
        /* 자리를 놓아 준다 — 안 그러면 방이 다음 판으로 못 넘어간다 */
        Room.rearmRoomSeat(code).catch(() => {});
      } else if (오래기다림 && players.length < 2) {
        /**
         * ★ **상대가 안 왔다 — 판돈을 돌려준다.** (2026-08-26, 사용자 지정)
         *
         * 예전에는 여기서 아무것도 안 했다. `settleDuel` 은 둘이 안 모이면 `null` 을
         * 돌려주는데 그 뒤가 없어서, 건 금화가 **아무에게도 안 가고 사라졌다.**
         * 겨룰 상대가 없었으면 진 것도 이긴 것도 아니다 — 건 것을 그대로 되돌린다.
         */
        refunded = refundDuel(code);
        Room.rearmRoomSeat(code).catch(() => {});
      }
    }
    nav.refresh();
  });

  /** 이 판에서 두 사람이 주운 금화를 모두 더한 값 — 승자가 가져간 몫이다 */
  function pot() {
    const players = Object.values(room?.players ?? {}).filter((p) => p && !p.waiting);
    const picked = players.reduce((n, p) => n + (p.coins | 0), 0);
    return DUEL_STAKE * Math.max(2, players.length) + picked;
  }

  function rows() {
    const order = duelRanking(room?.players);
    return order.map((uid, i) => {
      const p = room.players[uid] ?? {};
      const mine = uid === me;
      const dead = p.alive === false;
      return el('div.rank-row', {
        class: [mine ? 'me' : '', i === 0 ? 'crowned c1' : ''].filter(Boolean).join(' '),
      }, [
        el('div.rank-place', null, [el('span.rank-no', S.rankPlace(i + 1))]),
        el('div.rank-face', null,
          [mod ? mod.dragonPortrait(p.dragonCharacter | 0, 2) : null].filter(Boolean)),
        el('div.rank-name', p.nickname || '???'),
        /* 겨루는 값이 금화로 바뀌었으므로 표에도 금화가 먼저 온다 */
        el('div.duel-cell', { class: dead ? 'dead' : '' },
          dead ? S.duelDeadCell : S.duelAliveCell),
        el('div.rank-value', S.duelCoinCell(p.coins | 0)),
      ]);
    });
  }

  /**
   * 계속하기 — 방을 되돌리고 **대기방**으로.
   *
   * ★ (2026-08-27, 사용자 지정)
   * *"이걸 누르면 멀티게임 방에서 로비로 탈출하는게 아니라 방 입장 누르면
   *   뜨는 그 창이 계속 뜨게 만들어"*
   *
   * 방 입장을 누르면 뜨는 그 창이 `WaitingRoom` 이다. 자리를 지킨 채
   * 거기로 `replace` 하므로 상대와 계속 이어서 붙을 수 있다.
   */
  async function again() {
    if (staying) return;
    staying = true; nav.refresh();
    const r = await Room.resetRoom(code).catch(() => false);
    staying = false;
    if (!live) return;
    if (r === 'ok') {
      keepSeat = true;              // 다음 판을 하려고 남는 것이다 — 나가면 안 된다
      /**
       * ★★ **`game: 'dragon'` 을 안 넘겼었다.** (2026-08-28, 사용자 신고 —
       *   "멀티 방입장, 방목록 왔다갔다 하다보면 신발을 찾아서가 뜨는데
       *   왜 그런거야? (...) 절대로 신발을 찾아서랑 섞이면 안됨")
       *
       * `WaitingRoom` 은 두 게임이 같이 쓰는 화면이라 `params.game` 이
       * `'dragon'` 이 아니면 **조용히 신발 모드로** 그린다(그 파일의
       * `const game = params.game === 'dragon' ? 'dragon' : 'shoes';`).
       * 이 화면은 결투(드래곤) 전용인데 여기서 넘긴 적이 없었다 — 그래서
       * "계속하기" 를 누르면 방은 그대로 드래곤 방인데 **화면만 신발
       * 대기방으로** 바뀌었다.
       */
      return nav.replace(WaitingRoom, { code, game: 'dragon' });
    }
    toast(S.networkError);
    nav.refresh();
  }

  return {
    onLeave() {
      live = false;
      unsub?.();
      /* 결과를 보고 나갔으니 방에서 빠진다 — 남아 있으면 다음 판이 안 열린다.
         단, **한 판 더**로 나가는 길이면 자리를 지킨다 */
      if (!keepSeat) Room.leaveRoom(code).catch(() => {});
    },

    render() {
      if (!room) return screen(title(S.duelTitle), el('div.hint', S.loading));
      if (!outcome) {
        /* 상대가 안 와서 돌려받았으면 기다리는 화면이 아니라 그 사실을 말한다 */
        if (refunded) {
          return screen(
            title(S.duelTitle),
            el('div.duel-prize', S.duelRefunded(refunded)),
            el('div.hint', S.duelRefundedWhy),
            el('div.spacer'),
            backButton(S.backToGameLobby, () => nav.reset(DragonLobby))
          );
        }
        return screen(title(S.duelTitle), el('div.hint', S.duelWaiting), ...rows());
      }

      const won = outcome.won;
      return screen(
        title(won ? S.duelWon : S.duelLost),

        /* ── 깃발 · 큰 문구 · 작은 문구 · 숫자 줄 (신발 결과창과 같은 뼈대) ── */
        won
          ? el('div.victory', null, [
              el('img.victory-flag', { src: '/assets/ui/victory_flag.png', alt: S.duelWinBig }),
              el('div.victory-big', S.duelWinBig),
              el('div.victory-sub', S.duelWinSub),
              el('div.victory-pot', null, [
                el('span', S.duelWonPotPre),
                el('span.pot-num', S.duelWonPotCoins(pot())),
                el('span', S.duelWonPotPost),
              ]),
            ])
          : el('div.defeat', null, [
              el('img.defeat-flag', { src: '/assets/ui/defeat_flag.png', alt: S.duelLoseBig }),
              el('div.defeat-big', S.duelLoseBig),
              el('div.defeat-sub', S.duelLoseSub),
              el('div.defeat-lost',
                S.duelLostCoins(DUEL_STAKE + ((room.players?.[me]?.coins) | 0))),
            ]),

        el('div.rank-list', null, rows()),

        /**
         * ★ **그래서 지금 얼마인가.** (2026-08-27, 사용자 지정)
         * *"보유한 금화 총 수량을 보여준다거나"*
         * 정산이 이미 지갑에 반영된 뒤라 이 값이 곧 결과다.
         */
        el('div.duel-wallet', S.duelWalletNow(getProfile().dragonCoins || 0)),

        el('div.spacer'),
        button(S.duelAgain, again, { primary: true, disabled: staying }),
        backButton(S.backToGameLobby, () => nav.reset(DragonLobby))
      );
    },
  };
}
