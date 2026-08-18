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
import Lobby from '../Lobby.js';

export default function MultiMenu(nav) {
  let busy = false;

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

        button(busy ? S.loading : S.joinRoom, () => guard(() => Room.quickJoin({ difficulty: p.difficulty })), {
          primary: true, disabled: !canPlay || busy,
        }),
        button(S.createPrivateRoom, () => guard(() => Room.createRoom({ isPrivate: true, difficulty: p.difficulty })), {
          disabled: !canPlay || busy,
        }),
        button(S.enterByCode, () => nav.push(CodeInput), { disabled: !canPlay || busy }),

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
