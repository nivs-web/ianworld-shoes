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
import { el, button, backButton, segmented, screen, title, toast, presentOverlay } from '../ui.js';
import { characterById, characterSprite } from '../../data/characters.js';
import { MULTI } from '../../config/balance.js';
import { currentUser } from '../../services/auth.js';
import * as Room from '../../services/multiplayer.js';
import { slotIndex } from '../../services/matchRules.js';
import { SLOT_COLORS } from '../../game/palette.js';
import { hold } from '../../core/hold.js';
import { startMultiGame } from '../startMultiGame.js';
import Lobby from '../Lobby.js';

/** 되돌리기가 실패했을 때 다시 시도하기까지 */
const RESET_RETRY_MS = 2500;

/**
 * 참가자 이름을 누르면 뜨는 카드. (2026-08-19, §11 → §9 에서 캐릭터 그림 추가)
 * `p` 는 `players/$uid` 스냅샷 — nickname·characterId·shoesOwned·multiWins·multiLosses.
 *
 * 그림을 같이 보여 주는 이유: 인게임에는 아이디가 없고 **자리 색과 캐릭터 생김새**가
 * 신원의 전부다. 대기방에서 "이 사람이 저 캐릭터구나"를 붙여 둬야 판이 시작된 뒤에
 * 화면에서 상대를 찾을 수 있다.
 */
function playerStatPopup(p, slot) {
  let dismiss = () => {};
  const close = () => dismiss();
  const games = (p.multiWins ?? 0) + (p.multiLosses ?? 0);
  const ch = characterById(p.characterId);
  const overlay = el('div.dialog-overlay', { onclick: close }, [
    el('div.dialog', { onclick: (e) => e.stopPropagation() }, [
      // 자리 색 테두리를 그대로 둘러 — 인게임 레이스 게이지와 같은 신호를 쓴다
      el('div.player-card-face', { style: { '--slot': SLOT_COLORS[slot] ?? SLOT_COLORS[0] } },
        ch ? [el('img', { src: characterSprite(ch.id, 'front'), alt: ch.ko })] : []),
      el('div.dialog-msg', p.nickname || '???'),
      ch ? el('div.player-card-char', ch.ko) : null,
      el('div.dialog-detail', S.playerStatPopup(p.multiWins ?? 0, games, p.shoesOwned ?? 0)),
      button(S.close, close, { sfx: 'sfx_menu_back' }),
    ]),
  ]);
  dismiss = presentOverlay(overlay);
}

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
  /** 끝난 방 되돌리기를 겹쳐 부르지 않게 */
  let resetting = false;
  let resetTimer = null;
  /** 이 화면이 떠 있는 동안은 자동 새로고침 금지 — 자리를 잃는다 */
  const release = hold();
  /** 방을 두 번 나가지 않게 (화면 버튼 → onLeave 로 연달아 불린다) */
  let left = false;
  /**
   * ★ **대기방에서도 "여기 있다"를 계속 보낸다.** (2026-08-19)
   * `resetRoom`(다음 판 준비)은 신호가 살아 있는 사람만 데려가고, 종료 판정도 이 신호로
   * "튕긴 사람"을 가린다. 자리에 앉아 있는 동안 신호가 끊기면 안 된다.
   */
  const beat = setInterval(() => {
    // 방에 내가 남아 있을 때만 — 아니면 유령 노드를 만든다
    if (!room?.players?.[myUid]) return;
    Room.heartbeat(code).catch(() => {});
  }, MULTI.heartbeatMs);

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
    /**
     * ★ **끝난 방을 여기서도 되돌린다 — 단, 이번 판 사람이 모두 나간 뒤에만.** (2026-08-18)
     *
     * 대기자는 결과 화면을 못 본다(그 판을 안 뛰었으니까). 그런데 방을 `waiting` 으로
     * 되돌리는 버튼('방에 남기')은 **결과 화면에만** 있다. 그래서 이번 판 사람들이
     * 전부 로비로 나가면 대기자는 "다음 판을 기다리는 중"에 **영원히** 갇혔다.
     *
     * 그렇다고 `finished` 를 보자마자 되돌리면 **훨씬 나쁘다.** `resetRoom` 은
     * `result` 를 통째로 지우는데, 그 순간 다른 사람들은 아직 결과 화면에서 정산 중이다 —
     * 순위가 사라져 승자는 못 받고, 이미 지갑에서 신발을 뺀 패자는 **그 신발을 잃는다.**
     * 그래서 **순위표에 있는 사람이 방에 한 명도 안 남았을 때만** 되돌린다.
     * 그들이 방에서 빠졌다는 건 결과 화면을 떠났다는 뜻이다(`MultiResult.releaseSeat`).
     *
     * 실패하면(다른 사람이 같은 순간에 나가 규칙이 거부하는 등) 몇 초 뒤 다시 시도한다 —
     * 한 번 실패하고 멈추면 대기자는 그대로 갇힌다.
     */
    if (r.state === 'finished') tryReset(r);
    if (!launched && !meNow?.waiting && (r.state === 'countdown' || r.state === 'playing')) {
      launched = true;
      unsub();
      startMultiGame(nav, { code, room: r });
      return;
    }
    nav.refresh();
  });

  /**
   * 끝난 방을 다음 판 준비 상태로 되돌린다. **이번 판 사람이 모두 나간 뒤에만.**
   * 실패하면(아직 안 걷힌 신발이 있거나 규칙이 거부하면) 잠시 뒤 스스로 다시 시도한다 —
   * 방 변화가 더 안 오면 구독은 다시 안 불리므로, 재시도는 여기서 직접 걸어야 한다.
   */
  function tryReset(r) {
    if (resetting || left || launched) return;
    const rank = r.result?.rankings ?? [];
    if (rank.some((uid) => r.players?.[uid])) return;   // 아직 결과 화면에 있는 사람이 있다
    resetting = true;
    Room.resetRoom(code).catch(() => false).then((res) => {
      resetting = false;
      if (res === 'ok' || left) return;
      resetTimer = setTimeout(() => { if (room?.state === 'finished') tryReset(room); }, RESET_RETRY_MS);
    });
  }

  function leave(alsoLeaveRoom = true) {
    unsub();
    clearInterval(beat);
    clearTimeout(resetTimer);
    release();
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
      clearInterval(beat);
      clearTimeout(resetTimer);
      release();
      if (!launched && !left) { left = true; Room.leaveRoom(code).catch(() => {}); }
    },

    render() {
      /**
       * 로딩 중에도 **나갈 길을 준다.** 방을 읽는 사이 연결이 끊기면
       * (`onValue` 는 오프라인이면 콜백 자체가 안 온다) 버튼이 하나도 없는 화면에 갇혔다.
       */
      if (!room) {
        return screen(
          title(S.multiRoomTitle(code)),
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
        title(S.multiRoomTitle(code)),

        // 비밀방은 코드가 커야 한다 — 친구한테 불러 줘야 하니까
        room.isPrivate
          ? el('div.room-code', code)
          : el('div.hint', S.publicRoomHint),

        /**
         * ★ **자리 번호 상자.** (2026-08-19)
         * 들어온 순서대로 1번 빨강 · 2번 노랑 · 3번 파랑 · 4번 초록.
         * 인게임에는 아이디를 아예 안 쓰기 때문에(레이스 게이지의 얼굴 테두리 색이
         * 전부다) **여기서 자기 색을 외우는 것**이 게임 중 신원 확인의 유일한 통로다.
         */
        el('div.player-list', null, players.map((p) => {
          const ch = characterById(p.characterId);
          const slot = slotIndex(room.players, p.uid);
          /**
           * ★ **표(grid) 로 고정한다.** (2026-08-19, §9·§10)
           * 예전엔 flex 라서 `레디` 태그가 `...` ↔ `레디` 로 바뀔 때마다 폭이 달라졌고,
           * 그만큼 **보유신발 배지가 좌우로 밀렸다**(사용자 신고). 이제 앞쪽 칸은 전부
           * 고정폭이고 남는 폭은 이름 뒤의 빈 칸이 먹으므로, 태그가 어떻게 바뀌든
           * 신발 배지는 **항상 같은 자리**에 있다.
           */
          return el('div.player-row', { class: p.uid === myUid ? 'me' : '' }, [
            el('div.slot-box', {
              text: String(slot + 1),
              // 노랑 위의 흰 글씨는 안 보인다 — 밝은 자리 색만 글씨를 어둡게
              style: { background: SLOT_COLORS[slot] ?? SLOT_COLORS[0], color: slot === 1 ? '#3A1F0C' : '#FFF4D6' },
            }),
            ch ? el('img.rank-face', { src: characterSprite(ch.id, 'front'), alt: ch.ko }) : el('div.rank-face'),
            // 이름을 누르면 캐릭터 그림 + 승률/보유신발 카드 (§9·§11)
            el('div.player-name', { text: p.nickname || '???', onclick: () => playerStatPopup(p, slot) }),
            el('div.player-shoes', null, [
              el('img', { src: '/assets/shoes/shoe_icon.png', alt: '' }),
              el('span', S.playerShoesOwned(p.shoesOwned ?? 0)),
            ]),
            el('div.player-gap'),
            // 태그는 **마지막 칸 안에서만** 늘었다 줄었다 한다 — 앞칸을 밀지 않는다
            el('div.player-tags', null, [
              p.uid === room.hostUid ? el('div.tag-host', S.host) : null,
              el('div.tag-ready', { class: p.ready ? 'on' : '' },
                p.waiting ? S.roomStateWaiting : p.ready ? S.ready : '...'),
            ]),
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
