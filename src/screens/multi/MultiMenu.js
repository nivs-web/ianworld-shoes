/**
 * S13 멀티 메뉴 — 기획서 §7 화면표.
 *
 *   [방 입장(자동 매칭)] [비밀방 만들기] [코드로 입장]
 *
 * '방 만들기'를 따로 두지 않은 이유: 자동 매칭이 **빈 방이 없으면 알아서 만든다.**
 * 버튼을 나누면 사용자가 "만들까 들어갈까"를 매번 골라야 하는데, 그 선택으로
 * 얻는 게 없다. 방을 고르고 싶은 사람은 어차피 친구랑 하는 비밀방이다.
 */

import S from '../../config/strings.ko.js';
import { el, button, backButton, screen, title, toast } from '../ui.js';
import { get as getProfile } from '../../services/profile.js';
import { canJoinMulti } from '../../services/matchRules.js';
import * as Room from '../../services/multiplayer.js';
import WaitingRoom from './WaitingRoom.js';
import CodeInput from './CodeInput.js';
import RoomList from './RoomList.js';
import OnlineUsers from './OnlineUsers.js';
import MultiRank from '../MultiRank.js';
import { crownImg } from '../crown.js';
import Lobby from '../Lobby.js';

export default function MultiMenu(nav) {
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
      if (code) nav.replace(WaitingRoom, { code });
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
      /**
       * 신발 1켤레 이하는 **눌러 보기 전에** 막는다 (기획서 §5-7).
       * 방까지 들어갔다가 정산 직전에 튕기면 남의 판까지 망친다.
       */
      const canPlay = canJoinMulti(p.shoesOwned);

      return screen(
        title(S.multiTitle),

        el('div.hint', S.multiBetHint),

        /**
         * 순서: **방 입장 → 방 목록 → 비밀방 만들기 → 비밀방 입장** (2026-08-19).
         * 위에서부터 "빠른 길 → 고르는 길 → 친구랑 하는 길" 순이다.
         * 자동 매칭이 실패해도 **직접 고를 길**(방 목록)이 바로 아래에 있어야 막히지 않는다.
         */
        button(busy ? S.loading : S.joinRoom, () => guard(() => Room.quickJoin({ difficulty: p.difficulty })), {
          primary: true, disabled: !canPlay || busy,
        }),
        button(S.roomListTitle, () => nav.push(RoomList), { disabled: !canPlay || busy }),
        button(S.createPrivateRoom, () => guard(() => Room.createRoom({ isPrivate: true, difficulty: p.difficulty })), {
          disabled: !canPlay || busy,
        }),
        button(S.enterByCode, () => nav.push(CodeInput), { disabled: !canPlay || busy }),

        /**
         * ★ **멀티게임순위** (2026-08-19 23차, 사용자 지정) — 양쪽에 금관, 화려한 버튼.
         *
         * *"다 노란색 버튼인데 이 버튼은 화려하게 누르고 싶은 디자인으로 바꿔"*
         *
         * 이 화면에서 **혼자만 다른 색**인 이유가 있다. 나머지 넷은 "지금 한 판 하러
         * 가는" 버튼이고 이건 "누가 잘하나 보러 가는" 버튼이다 — 하는 일이 다르면
         * 생김새도 달라야 한다. 신발이 부족해도 막지 않는다(구경은 판돈과 무관하다).
         */
        button(S.menuMultiRank, () => nav.push(MultiRank), {
          class: 'crown-btn', disabled: busy,
          icons: [crownImg(1, 'btn-crown'), crownImg(1, 'btn-crown')],
        }),
        /**
         * ★ **현재접속자** (2026-08-19 11차, 사용자 지정) — 방과 무관한 메뉴다.
         * 방이 하나도 없어도 여기서 사람을 찾아 말을 걸고 대결을 신청할 수 있다.
         * 신발이 부족해도 막지 않는다 — 쪽지는 판돈과 상관이 없다.
         */
        button(S.onlineUsers, () => nav.push(OnlineUsers), { disabled: busy }),

        !canPlay
          ? el('div.warn', null, [
              el('div', S.notEnoughShoesToPlay),
              el('div', S.notEnoughShoesGuide),
            ])
          : null,

        el('div.spacer'),
        /**
         * 깊이가 1이면 `nav.back()` 은 아무것도 안 한다(router.js). 결과 화면에서
         * 넘어온 경우가 그랬는데, 그 함정은 MultiResult 쪽에서 고쳤다. 여기서도
         * 한 겹 더 막아 둔다 — 뒤로가 안 먹는 화면은 사용자에게 그냥 고장이다.
         */
        backButton(S.back, () => (nav.depth() > 1 ? nav.back() : nav.reset(Lobby)))
      );
    },
  };
}
