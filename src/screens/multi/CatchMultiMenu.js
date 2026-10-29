/**
 * S31 캐치볼 1:1 대결 — 멀티 메뉴. (2026-10-28)
 *
 * 신발게임 `MultiMenu`·드래곤 `DragonMultiMenu` 와 **같은 자리, 같은 순서**다.
 * 다른 것은 셋뿐이다:
 *   · 방을 `game: 'catch'` 로, **2인 방**으로 판다 (공은 하나라 1:1 만 된다)
 *   · 걸린 것이 없다 — 지갑 검사가 없다
 *   · 순위표 버튼이 없다 (전적은 게임 타이틀에 뜬다)
 *
 * 3D캐치볼(2026-10-29)도 이 메뉴를 `{ view3d: true }` 로 연다. 방은 **같은 'catch' 방**이고
 * 대결 화면에서 내 쪽만 3D 로 그린다 — 주고받는 값은 2D 와 같아서 2D 친구와도 붙고,
 * RTDB 규칙의 게임 이름 검사(shoes/dragon/catch)를 건드리지 않는다.
 */

import S from '../../config/strings.ko.js';
import { el, button, backButton, screen, title, toast } from '../ui.js';
import * as Room from '../../services/multiplayer.js';
import { get as getProfile } from '../../services/profile.js';
import { lazyScreen } from '../lazyScreen.js';

const DIFF_LABEL = { easy: S.difficultyEasy, normal: S.difficultyNormal, hard: S.difficultyHard };

const WaitingRoom = lazyScreen(() => import('./WaitingRoom.js'), S.multiTitle);
const RoomList = lazyScreen(() => import('./RoomList.js'), S.roomListTitle);
const CodeInput = lazyScreen(() => import('./CodeInput.js'), S.enterByCode);

const GAME = Room.GAME_CATCH;
const SEATS = 2;

/** @param {{view3d?:boolean}} params */
export default function CatchMultiMenu(nav, params = {}) {
  const view3d = !!params.view3d;
  let busy = false;

  /* 누를 때 붙기 시작하면 스캔이 빈 목록을 보고 새 방을 판다 (multiplayer.js prewarm 주석) */
  Room.prewarm();

  /** 방을 잡는 동안 두 번 눌리면 방이 두 개 생긴다 */
  async function guard(fn) {
    if (busy) return;
    busy = true;
    nav.refresh();
    try {
      const code = await fn();
      if (code) nav.replace(WaitingRoom, { code, game: GAME, view3d });
      else toast(S.networkError);
    } catch {
      toast(S.networkError);
    } finally {
      busy = false;
      nav.refresh();
    }
  }

  return {
    render() {
      /* 새로 파는 방은 혼자 하기에서 고른 난이도로 — 대기방에서 방장이 바꿀 수 있다 */
      const pd = view3d ? getProfile().catch3dDifficulty : getProfile().catchDifficulty;
      const diff = DIFF_LABEL[pd] ? pd : 'normal';
      return screen(
        title(view3d ? S.catch3dDuelTitle : S.catchDuelTitle),
        el('div.hint', S.catchDuelHint),
        el('div.hint', S.catchDuelHint2),
        el('div.hint', S.catchNewRoomDiff(DIFF_LABEL[diff])),
        view3d ? el('div.hint', S.catch3dDuelHint3) : null,

        button(busy ? S.loading : S.joinRoom,
          () => guard(() => Room.quickJoin({ game: GAME, maxPlayers: SEATS, difficulty: diff })),
          { primary: true, disabled: busy }),
        button(S.roomListTitle, () => nav.push(RoomList, { game: GAME, view3d }), { disabled: busy }),
        button(S.createPrivateRoom,
          () => guard(() => Room.createRoom({ isPrivate: true, game: GAME, maxPlayers: SEATS, difficulty: diff })),
          { disabled: busy }),
        button(S.enterByCode, () => nav.push(CodeInput, { game: GAME, view3d }), { disabled: busy }),

        el('div.spacer'),
        backButton(S.back, () => nav.back())
      );
    },
  };
}
