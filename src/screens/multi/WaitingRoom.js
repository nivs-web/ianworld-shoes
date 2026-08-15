/**
 * S14 멀티 대기방 — 참가자 2~4명, 레디 토글, 방장만 난이도 + 시작하기.
 *
 * 방 상태는 **구독**한다(RTDB onValue). 폴링하면 남이 들어온 걸 늦게 알아
 * "레디했는데 왜 안 시작해?"가 된다.
 *
 * 화면을 벗어날 때 구독을 반드시 끊는다 — 안 끊으면 로비로 나간 뒤에도
 * 방 변화 때마다 없는 화면을 다시 그리려 든다.
 */

import S from '../../config/strings.ko.js';
import { el, button, backButton, segmented, screen, title, toast } from '../ui.js';
import { characterById, characterSprite } from '../../data/characters.js';
import { MULTI } from '../../config/balance.js';
import { currentUser } from '../../services/auth.js';
import * as Room from '../../services/multiplayer.js';
import { startMultiGame } from '../startMultiGame.js';
import Lobby from '../Lobby.js';

const DIFFS = [
  { value: 'easy', label: S.difficultyEasy },
  { value: 'normal', label: S.difficultyNormal },
  { value: 'hard', label: S.difficultyHard },
];

export default function WaitingRoom(nav, params = {}) {
  const code = params.code;
  const myUid = currentUser()?.uid;
  let room = null;
  let unsub = () => {};
  let launched = false;

  unsub = Room.subscribeRoom(code, (r) => {
    room = r;
    if (!r) {
      // 방장이 나가서 방이 사라진 경우
      toast(S.roomClosed);
      leave(false);
      return;
    }
    /**
     * 카운트다운이 걸리는 **순간 전원이 같이 넘어간다.** 방장만 시작 버튼을 누르지만
     * 출발 시각은 방에 적힌 절대 시각이라, 여기서 각자 자기 화면에서 게임으로 들어간다.
     */
    if (!launched && (r.state === 'countdown' || r.state === 'playing')) {
      launched = true;
      unsub();
      startMultiGame(nav, { code, room: r });
      return;
    }
    nav.refresh();
  });

  function leave(alsoLeaveRoom = true) {
    unsub();
    if (alsoLeaveRoom) Room.leaveRoom(code).catch(() => {});
    nav.reset(Lobby);
  }

  return {
    /** 라우터가 화면을 버릴 때 불러 준다 — 구독을 여기서 반드시 끊는다 */
    onLeave() { unsub(); },

    render() {
      if (!room) return screen(title(S.roomCode), el('div.hint', S.loading));

      const players = Object.entries(room.players ?? {}).map(([uid, v]) => ({ uid, ...v }));
      const isHost = room.hostUid === myUid;
      const me = players.find((p) => p.uid === myUid);
      const enough = players.length >= MULTI.minPlayers;
      const allReady = enough && players.every((p) => p.ready || p.uid === room.hostUid);

      return screen(
        title(S.roomCode),

        // 비밀방은 코드가 커야 한다 — 친구한테 불러 줘야 하니까
        room.isPrivate
          ? el('div.room-code', code)
          : el('div.hint', S.publicRoomHint),

        el('div.player-list', null, players.map((p) => {
          const ch = characterById(p.characterId);
          return el('div.player-row', { class: p.uid === myUid ? 'me' : '' }, [
            ch ? el('img.rank-face', { src: characterSprite(ch.id, 'front'), alt: ch.ko }) : el('div.rank-face'),
            el('div.player-name', p.nickname || '???'),
            p.uid === room.hostUid ? el('div.tag-host', S.host) : null,
            el('div.tag-ready', { class: p.ready ? 'on' : '' }, p.ready ? S.ready : '...'),
          ]);
        })),

        el('div.hint', S.roomSlots(players.length, room.maxPlayers ?? MULTI.maxPlayers)),

        el('div.diff-title', S.difficultyTitle),
        isHost
          ? segmented(DIFFS, room.difficulty, (v) => Room.setRoomDifficulty(code, v))
          : el('div.hint', `${DIFFS.find((d) => d.value === room.difficulty)?.label ?? ''} · ${S.hostOnlyDifficulty}`),

        // 방장은 레디 대신 시작 버튼을 갖는다 — 자기가 자기를 기다릴 이유가 없다
        isHost
          ? button(S.startGame, () => {
              if (!enough) return toast(S.needMorePlayers);
              if (!allReady) return toast(S.notEveryoneReady);
              Room.startCountdown(code);
            }, { primary: true, class: allReady ? '' : 'dim' })
          : button(me?.ready ? S.cancelReady : S.ready, () => Room.setReady(code, !me?.ready), { primary: !me?.ready }),

        el('div.hint', isHost ? (enough ? S.waitingHostSelf : S.waitingPlayers) : S.waitingHost),

        el('div.spacer'),
        backButton(S.back, () => leave(true))
      );
    },
  };
}
