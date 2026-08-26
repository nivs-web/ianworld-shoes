/**
 * S25 드래곤 결투 — 멀티 메뉴.
 *
 * 신발게임의 `MultiMenu` 와 **같은 자리, 같은 순서**다. 오락실 안에서 두 게임이
 * 서로 다른 길로 방을 잡으면 손이 헤맨다. 다른 것은 셋뿐이다:
 *
 *   · 방을 `game: 'dragon'` 으로 판다 (신발 하러 온 사람과 안 섞인다)
 *   · 판돈이 신발이 아니라 **금화 1,000** 이다
 *   · 순위는 드래곤 순위표로 간다
 */

import S from '../../config/strings.ko.js';
import { el, button, backButton, screen, title, toast } from '../ui.js';
import { get as getProfile } from '../../services/profile.js';
import * as Room from '../../services/multiplayer.js';
import { DUEL_STAKE, canDuel } from '../../services/dragonSettle.js';
import { lazyScreen } from '../lazyScreen.js';

const WaitingRoom = lazyScreen(() => import('./WaitingRoom.js'), S.multiTitle);
const RoomList = lazyScreen(() => import('./RoomList.js'), S.roomListTitle);
const CodeInput = lazyScreen(() => import('./CodeInput.js'), S.enterByCode);
const OnlineUsers = lazyScreen(() => import('./OnlineUsers.js'), S.onlineUsers);
const DragonRanking = lazyScreen(() => import('../DragonRanking.js'), S.dragonRankCoin);

export default function DragonMultiMenu(nav) {
  let busy = false;

  /**
   * 화면을 여는 순간 RTDB 연결을 미리 잡아 둔다. 누를 때 붙기 시작하면
   * 스캔이 빈 목록을 보고 새 방을 파 버린다 (multiplayer.js prewarm 주석).
   */
  Room.prewarm();

  /** 방을 잡는 동안 두 번 눌리면 방이 두 개 생긴다 */
  async function guard(fn) {
    if (busy) return;
    busy = true;
    nav.refresh();
    try {
      const code = await fn();
      if (code) nav.replace(WaitingRoom, { code, game: 'dragon' });
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
      const p = getProfile();
      const ok = canDuel(p);

      return screen(
        title(S.duelTitle),

        el('div.hint', S.duelStakeHint(DUEL_STAKE)),
        el('div.shop-wallet', S.dragonWallet((p.dragonCoins || 0).toLocaleString('en-US'))),

        button(busy ? S.loading : S.joinRoom,
          () => guard(() => Room.quickJoin({ game: 'dragon' })),
          { primary: true, disabled: !ok || busy }),
        button(S.roomListTitle, () => nav.push(RoomList, { game: 'dragon' }),
          { disabled: !ok || busy }),
        button(S.createPrivateRoom,
          () => guard(() => Room.createRoom({ isPrivate: true, game: 'dragon' })),
          { disabled: !ok || busy }),
        button(S.enterByCode, () => nav.push(CodeInput, { game: 'dragon' }),
          { disabled: !ok || busy }),

        /* 순위와 사람 찾기는 판돈과 무관하다 — 금화가 모자라도 막지 않는다 */
        button(S.dragonRankCoin, () => nav.push(DragonRanking, { kind: 'coin' }), { disabled: busy }),
        button(S.onlineUsers, () => nav.push(OnlineUsers, { game: 'dragon' }), { disabled: busy }),

        !ok
          ? el('div.warn', null, [
              el('div', S.duelNeedCoins(DUEL_STAKE)),
              el('div.hint', S.duelNeedCoinsHow),
            ])
          : null,

        el('div.spacer'),
        backButton(S.backToGameLobby, () => nav.back())
      );
    },
  };
}
