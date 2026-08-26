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
import { openUserCard } from '../UserCard.js';
import * as Presence from '../../services/presence.js';
import { characterById, characterSprite } from '../../data/characters.js';
import { MULTI } from '../../config/balance.js';
import { currentUser } from '../../services/auth.js';
import * as Room from '../../services/multiplayer.js';
import { slotIndex } from '../../services/matchRules.js';
import { SLOT_COLORS } from '../../game/palette.js';
import { hold } from '../../core/hold.js';
import { startMultiGame } from '../startMultiGame.js';
import Lobby from '../Lobby.js';
import { roomChat } from './roomChat.js';

/** 되돌리기가 실패했을 때 다시 시도하기까지 */
const RESET_RETRY_MS = 2500;

/**
 * 참가자 이름을 누르면 뜨는 카드 — **공용 유저상태창**을 쓴다. (2026-08-19 11차)
 *
 * 예전에는 이 파일이 팝업을 직접 만들었다. 명예의 전당·현재접속자에서도 같은 창을
 * 요구받으면서 `screens/UserCard.js` 로 떼어냈다 — 세 화면이 각자 만들면 언젠가
 * 셋이 서로 다른 말을 한다.
 *
 * `p` 는 `players/$uid` 스냅샷 — nickname·characterId·shoesOwned·multiWins·multiLosses.
 * 자리 색 테두리를 그대로 둘러 인게임 레이스 게이지와 같은 신호를 쓴다.
 */
function playerStatPopup(p, slot) {
  /**
   * ★ **대기방에서도 쪽지는 보낸다.** (2026-08-19 12차, 사용자 지정)
   *
   * *"방에서 레디 누르고 대기하는 화면에서 (…) 다른 유저에게 아이디 클릭해서 메세지
   * 보낼 수 있고 (…) 실시간으로 상대방은 그 메세지를 읽을 수 있어"*
   *
   * 대기방은 DOM 화면이라 팝업이 그대로 뜬다 — 서로 바로바로 주고받는다.
   * **대결신청만 뺀다**(`challenge: false`): 이미 같은 방에 앉아 있는 사람에게
   * 신청하면 방이 하나 더 생기고, 수락한 사람은 앞 방에 유령으로 남는다.
   */
  openUserCard(p, { slot, challenge: false });
}

const DIFFS = [
  { value: 'easy', label: S.difficultyEasy },
  { value: 'normal', label: S.difficultyNormal },
  { value: 'hard', label: S.difficultyHard },
];

export default function WaitingRoom(nav, params = {}) {
  /**
   * ★ **어느 게임의 방인가.** (2026-08-26 F단계)
   * 대기방 화면은 두 게임이 그대로 나눠 쓴다 — 사람이 모이고 레디를 누르는 일은
   * 게임이 달라도 똑같기 때문이다. 갈리는 것은 **시작할 때 어느 다리로 가느냐** 뿐이다.
   */
  const game = params.game === 'dragon' ? 'dragon' : 'shoes';
  const code = params.code;
  /**
   * ★ 대기방은 **'게임중'** 으로 표시한다. (2026-08-19 11차)
   * 이미 한 방에 앉아 있는 사람이 다른 방 초대를 수락하면 앞 방에 유령으로 남는다 —
   * 그 경로를 아예 만들지 않는다. 방을 나가면 다음 화면이 뜨면서 `router.mount` 가
   * 다시 '대기중' 으로 되돌린다.
   */
  Presence.setState('playing');
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
   * ★ **채팅 패널은 화면당 한 번만 만든다.** (2026-08-21 26차)
   *
   * 대기방은 방 스냅샷이 올 때마다 `nav.refresh()` 로 화면을 통째로 다시 세운다.
   * 채팅을 `render()` 안에서 만들면 그때마다 노드가 새로 만들어져 **치던 글자와
   * 스크롤 위치가 사라진다.** 같은 노드를 다시 붙이기만 하면 둘 다 살아남는다
   * (`innerHTML = ''` 는 자식을 떼어낼 뿐 없애지 않는다).
   */
  const chat = roomChat(code);
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

  /**
   * ★ **대기방에서도 30초 규칙을 지킨다.** (2026-08-19 10차, 사용자 지정)
   *
   * 창을 내려두면 브라우저가 타이머를 얼려 신호가 끊긴다. 그동안 남들은 나를
   * 유령으로 보고 치우므로(`purgeAbsent`), 30초를 넘겨 돌아왔다면 **이미 방에 없다.**
   * 그 사실을 모르고 대기방 화면에 앉아 있으면 시작 버튼을 눌러도 아무 일이 안 난다 —
   * 돌아오는 즉시 확인해서 로비로 보낸다.
   */
  let hiddenAt = 0;
  const onVisible = () => {
    if (document.hidden) { hiddenAt = Date.now(); return; }
    const 비운시간 = hiddenAt ? Date.now() - hiddenAt : 0;
    hiddenAt = 0;
    if (비운시간 > MULTI.absentSeconds * 1000) {
      toast(S.kickedAbsent(MULTI.absentSeconds), 3200);
      leave(true);
      return;
    }
    Room.heartbeat(code).catch(() => {});
  };
  document.addEventListener('visibilitychange', onVisible);

  /**
   * ★ **유령 치우기와 내 카드 갱신은 방 스냅샷이 올 때만.** (2026-08-19 10차)
   * 둘 다 서버 왕복이라 타이머로 돌리면 헛왕복이 쌓인다. 방이 바뀌었다는 건
   * 무언가 실제로 일어났다는 뜻이므로 그때만 확인하면 충분하다.
   */
  let 마지막청소 = 0;
  const 청소 = (r) => {
    if (Date.now() - 마지막청소 < MULTI.heartbeatMs) return;
    마지막청소 = Date.now();
    Room.purgeAbsent(code, r).catch(() => {});
    Room.refreshMyCard(code, r).catch(() => {});
  };

  /**
   * ★ **보이는 것이 안 바뀌었으면 다시 그리지 않는다.** (2026-08-19 15차, 속도)
   *
   * 방 스냅샷은 **생존 신호(`seenAt`)만으로도** 계속 온다 — 사람마다 5초에 한 번이니
   * 4인 방이면 **1.2초에 한 번**이다. 그때마다 `nav.refresh()` 가 화면을 통째로
   * 헐고 다시 세웠다(`innerHTML = ''` → 전체 render). 참가자 줄의 `<img>` 까지 매번
   * 새로 만들어지므로 얼굴이 깜빡이고, 그 사이 눌린 입력은 새 노드로 넘어가지 못한다.
   * 사용자가 말한 "버퍼링"의 한 갈래가 여기다.
   *
   * 그래서 **화면이 실제로 읽는 값만** 뽑아 비교한다. `seenAt`·`offAt`·`stairs`·
   * `alive`·`revives`·`result` 는 이 화면에 한 글자도 안 나오므로 열쇠에 없다.
   * 정렬은 `slotIndex` 와 같은 기준(joinedAt → uid)이라 자리 색이 바뀌면 열쇠도 바뀐다.
   */
  function viewKey(r) {
    if (!r) return '';
    const ps = Object.entries(r.players ?? {})
      .sort((a, b) => (a[1]?.joinedAt ?? 0) - (b[1]?.joinedAt ?? 0) || (a[0] < b[0] ? -1 : 1))
      .map(([uid, p]) => [uid, p?.nickname ?? '', p?.characterId ?? '', p?.shoesOwned ?? 0,
        p?.multiWins ?? 0, p?.multiLosses ?? 0, p?.ready ? 1 : 0, p?.waiting ? 1 : 0].join(':'))
      .join('|');
    return [r.state, r.hostUid, r.difficulty, r.maxPlayers, r.isPrivate ? 1 : 0, ps].join('/');
  }
  let lastView = null;

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
    청소(r);
    if (r.state === 'finished') tryReset(r);
    if (!launched && !meNow?.waiting && (r.state === 'countdown' || r.state === 'playing')) {
      launched = true;
      unsub();
      /**
       * ★ **실패를 잡는다.** (2026-08-19 15차)
       * `startMultiGame` 은 인게임 청크를 동적으로 받는다 — PWA 캐시가 낡았거나
       * 그 순간 회선이 끊기면 **거부(reject)** 된다. 예전에는 아무도 안 받아서
       * `nav.toCanvas()` 도 `Scene.reset()` 도 안 돌고, 구독은 이미 끊긴 뒤라
       * **대기방이 그대로 얼어붙었다.** 게다가 `launched` 가 참이라 나갈 때
       * 방에서 빠지지도 않아 남들의 판까지 30초 붙잡는다.
       */
      const bridge = game === 'dragon'
        ? import('../startDuel.js').then((m) => m.startDuel(nav, { code, room: r }))
        : startMultiGame(nav, { code, room: r });
      bridge.catch((e) => {
        console.warn('[multi] 판 시작 실패', e);
        launched = false;
        toast(S.networkError, 2400);
        leave(true);
      });
      return;
    }
    // 보이는 값이 그대로면 다시 그리지 않는다 (생존 신호만 온 경우)
    const key = viewKey(r);
    if (key === lastView) return;
    lastView = key;
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
    chat.stop();
    clearInterval(beat);
    clearTimeout(resetTimer);
    document.removeEventListener('visibilitychange', onVisible);
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
      chat.stop();
      clearInterval(beat);
      clearTimeout(resetTimer);
      document.removeEventListener('visibilitychange', onVisible);
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

        /**
         * ★ **방 채팅.** (2026-08-21 26차, 사용자 지정)
         * 비밀방이든 일반 방이든 **모든 방**에 붙는다. 대기자도 함께 쓴다 —
         * 다음 판을 기다리는 사람에게 말을 걸 방법이 이것뿐이다.
         */
        chat.node,

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
