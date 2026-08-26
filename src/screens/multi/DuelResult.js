/**
 * S26 결투 결과 — 누가 이겼고 금화가 어디로 갔나.
 *
 * ★ **상대를 기다린다.** 300초는 각자 재는 시계라 몇 초쯤 어긋난다. 내가 먼저
 * 끝났는데 그 순간 판정하면 아직 뛰고 있는 상대가 진 것이 된다. 그래서 둘 다
 * 끝났다는 신호가 오거나 기다림이 한계를 넘을 때까지 기다렸다가 센다.
 *
 * 판정은 **양쪽이 각자 같은 규칙으로** 한다(`dragonSettle.duelRanking`).
 * 서버가 심판을 보지 않으므로 순서가 완전히 결정적이어야 둘이 같은 답을 낸다.
 */

import S from '../../config/strings.ko.js';
import { el, button, backButton, screen, title } from '../ui.js';
import { currentUser } from '../../services/auth.js';
import * as Room from '../../services/multiplayer.js';
import { duelRanking, settleDuel, DUEL_STAKE } from '../../services/dragonSettle.js';
import { loadDragon } from '../DragonGame.js';

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

  loadDragon().then((m) => { mod = m; if (live) nav.refresh(); }).catch(() => {});

  /** 방을 지켜보다가 둘 다 끝나면 센다 */
  const unsub = Room.subscribeRoom(code, (r) => {
    if (!live || !r) return;
    room = r;
    if (!outcome) {
      const players = Object.values(r.players ?? {}).filter((p) => p && !p.waiting);
      const 모두끝 = players.length >= 2 && players.every((p) => p.done === true);
      const 오래기다림 = Date.now() - waitedFrom > WAIT_MS;
      if (players.length >= 2 && (모두끝 || 오래기다림)) {
        outcome = settleDuel(r);
        /* 자리를 놓아 준다 — 안 그러면 방이 다음 판으로 못 넘어간다 */
        Room.rearmRoomSeat(code).catch(() => {});
      }
    }
    nav.refresh();
  });

  function rows() {
    const order = duelRanking(room?.players);
    return order.map((uid, i) => {
      const p = room.players[uid] ?? {};
      const mine = uid === me;
      return el('div.rank-row', {
        class: [mine ? 'me' : '', i === 0 ? 'crowned c1' : ''].filter(Boolean).join(' '),
      }, [
        el('div.rank-place', null, [el('span.rank-no', S.rankPlace(i + 1))]),
        el('div.rank-face', null,
          [mod ? mod.dragonPortrait(p.dragonCharacter | 0, 2) : null].filter(Boolean)),
        el('div.rank-name', p.nickname || '???'),
        el('div.duel-cell', S.duelBossCount(p.bosses | 0)),
        el('div.rank-value', `${Number(p.score || 0).toLocaleString('en-US')}점`),
      ]);
    });
  }

  return {
    onLeave() {
      live = false;
      unsub?.();
      /* 결과를 보고 나갔으니 방에서 빠진다 — 남아 있으면 다음 판이 안 열린다 */
      Room.leaveRoom(code).catch(() => {});
    },

    render() {
      if (!room) return screen(title(S.duelTitle), el('div.hint', S.loading));
      if (!outcome) return screen(title(S.duelTitle), el('div.hint', S.duelWaiting), ...rows());

      const won = outcome.won;
      return screen(
        title(won ? S.duelWon : S.duelLost),

        el('div.duel-prize', { class: won ? 'win' : 'lose' },
          won ? S.duelPrize(outcome.gain) : S.duelPenalty(DUEL_STAKE)),
        el('div.hint', won ? S.duelPrizeHow : S.duelPenaltyHow),

        el('div.rank-list', null, rows()),

        el('div.spacer'),
        button(S.duelAgain, () => nav.back(), { primary: true }),
        backButton(S.backToGameLobby, () => nav.reset(null))
      );
    },
  };
}
