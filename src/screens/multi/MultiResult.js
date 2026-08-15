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
import { el, button, backButton, screen, title } from '../ui.js';
import { characterById, characterSprite } from '../../data/characters.js';
import { currentUser } from '../../services/auth.js';
import * as Room from '../../services/multiplayer.js';
import { settleRoom } from '../../services/multiSettle.js';
import MultiMenu from './MultiMenu.js';
import Lobby from '../Lobby.js';

export default function MultiResult(nav, params = {}) {
  const code = params.code;
  const myUid = currentUser()?.uid;
  let room = null;
  let settle = null;
  let done = false;

  (async () => {
    room = await Room.readRoom(code);
    settle = await settleRoom(code, room).catch(() => null);
    // 정산이 신발을 옮겼을 수 있으니 방을 다시 읽어 최신 given 을 반영한다
    if (settle?.pending) room = await Room.readRoom(code);
    done = true;
    nav.refresh();
  })();

  return {
    render() {
      if (!done) return screen(title(S.multiResultTitle), el('div.hint', S.loading));

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
        button(S.playAgain, () => nav.reset(MultiMenu), { primary: true }),
        backButton(S.toLobby, () => nav.reset(Lobby))
      );
    },
  };
}
