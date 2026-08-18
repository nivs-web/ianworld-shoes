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
  /** 방을 두 번 나가지 않게 (화면 버튼 → onLeave 로 연달아 불린다) */
  let left = false;

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
    /**
     * ★ **대기자는 이번 판에 안 들어간다.** (2026-08-16)
     * 게임 중인 방에 들어온 사람(`waiting: true`)은 다음 판부터 함께한다.
     * 여기서 같이 출발시키면 시작 시각이 지난 판에 혼자 뛰어들어 순식간에 끝난다.
     */
    const meNow = r.players?.[myUid];
    if (!launched && !meNow?.waiting && (r.state === 'countdown' || r.state === 'playing')) {
      launched = true;
      unsub();
      startMultiGame(nav, { code, room: r });
      return;
    }
    nav.refresh();
  });

  function leave(alsoLeaveRoom = true) {
    unsub();
    if (alsoLeaveRoom && !left) { left = true; Room.leaveRoom(code).catch(() => {}); }
    nav.reset(Lobby);
  }

  return {
    /**
     * 라우터가 화면을 버릴 때 불러 준다 — 구독을 여기서 반드시 끊는다.
     *
     * ★ **방에서도 나가야 한다.** (2026-08-16)
     * 예전에는 `unsub()` 만 했다. 화면의 `뒤로` 버튼은 `leave(true)` 라 괜찮았지만,
     * **안드로이드 하드웨어 뒤로가기**는 `nav.back()` → `mount()` → `onLeave()` 만 타서
     * 방에는 그대로 남았다. 남은 사람들 화면에는 영원히 `...`(레디 안 함)로 보이고,
     * 전원 레디가 안 되니 **방장이 시작을 눌러도 안 시작된다.** 4인 방이면 자리 하나가 죽는다.
     *
     * `launched` 일 때는 나가면 안 된다 — 그건 게임으로 들어간 것이지 이탈이 아니다.
     */
    onLeave() {
      unsub();
      if (!launched && !left) { left = true; Room.leaveRoom(code).catch(() => {}); }
    },

    render() {
      /**
       * 로딩 중에도 **나갈 길을 준다.** 방을 읽는 사이 연결이 끊기면
       * (`onValue` 는 오프라인이면 콜백 자체가 안 온다) 버튼이 하나도 없는 화면에 갇혔다.
       */
      if (!room) {
        return screen(
          title(S.roomCode),
          el('div.hint', S.loading),
          el('div.spacer'),
          backButton(S.back, () => leave(true))
        );
      }

      const players = Object.entries(room.players ?? {}).map(([uid, v]) => ({ uid, ...v }));
      const isHost = room.hostUid === myUid;
      const me = players.find((p) => p.uid === myUid);
      // 대기자는 인원수에도 레디 판정에도 넣지 않는다 — 이번 판 사람이 아니다
      const inRound = players.filter((p) => !p.waiting);
      const enough = inRound.length >= MULTI.minPlayers;
      const allReady = enough && inRound.every((p) => p.ready || p.uid === room.hostUid);

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
            el('div.tag-ready', { class: p.ready ? 'on' : '' },
              p.waiting ? S.roomStateWaiting : p.ready ? S.ready : '...'),
          ]);
        })),

        el('div.hint', S.roomSlots(players.length, room.maxPlayers ?? MULTI.maxPlayers)),

        el('div.diff-title', S.difficultyTitle),
        isHost
          ? segmented(DIFFS, room.difficulty, (v) => Room.setRoomDifficulty(code, v))
          : el('div.hint', `${DIFFS.find((d) => d.value === room.difficulty)?.label ?? ''} · ${S.hostOnlyDifficulty}`),

        // 게임이 도는 동안 들어온 대기자에게는 레디도 시작도 없다 — 기다리는 게 전부다
        me?.waiting
          ? el('div.warn', null, [
              el('div', S.waitingForNextRound),
              el('div', S.roomJoinedAsWaiter),
            ])
          : isHost
          ? button(S.startGame, () => {
              if (!enough) return toast(S.needMorePlayers);
              if (!allReady) return toast(S.notEveryoneReady);
              Room.startCountdown(code);
            }, { primary: true, class: allReady ? '' : 'dim' })
          : button(me?.ready ? S.cancelReady : S.ready, () => Room.setReady(code, !me?.ready), { primary: !me?.ready }),

        me?.waiting ? null : el('div.hint', isHost ? (enough ? S.waitingHostSelf : S.waitingPlayers) : S.waitingHost),

        el('div.spacer'),
        backButton(S.back, () => leave(true))
      );
    },
  };
}
