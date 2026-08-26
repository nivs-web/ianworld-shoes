/**
 * S23 드래곤 스트라이커 설정 — 메뉴 세 개.
 *
 * ★ **하나였던 설정을 셋으로 갈랐다.** (2026-08-26, 사용자 지정)
 *
 *   조작키 설정 / 사운드 설정 / 닉네임 변경
 *
 * 예전에는 [조작 · 소리 설정] 하나가 게임 안 캔버스 화면으로 데려갔다.
 * 그 화면은 **가로로 돌려야** 보이는데, 소리를 끄러 들어간 사람에게까지
 * 화면을 돌리라고 하는 건 과하다. 그리고 닉네임 변경이 아래에 딸려 있어서
 * "설정 = 조작" 인지 "설정 = 계정" 인지도 흐렸다.
 *
 * 셋 다 로비와 같은 세로 화면이다. 조작키만은 스틱·버튼 미리보기가 도트로만
 * 있어서 아직 캔버스 화면으로 넘긴다 — 그 문만 여기서 연다.
 */

import S from '../config/strings.ko.js';
import { el, button, backButton, screen, title } from './ui.js';
import { get as getProfile } from '../services/profile.js';
import { lazyScreen } from './lazyScreen.js';

const DragonKeys = lazyScreen(() => import('./DragonKeys.js'), S.dragonMenuControls);
const DragonSound = lazyScreen(() => import('./DragonSound.js'), S.dragonMenuSound);
const DragonNickname = lazyScreen(() => import('./DragonNickname.js'), S.dragonRename);
/**
 * ★ **쪽지 기능은 오락실 공용이다.** (2026-08-26, 사용자 지정)
 * 신발게임에 이미 다 만들어 둔 것을 그대로 쓴다 — 계정이 하나니 쪽지함도 하나다.
 * 두 게임이 각자 쪽지함을 가지면 어디로 온 쪽지인지 사람이 외워야 한다.
 */
const Inbox = lazyScreen(() => import('./Inbox.js'), S.menuInbox);
const MessageSettings = lazyScreen(() => import('./MessageSettings.js'), S.menuMsgAccept);
const OnlineUsers = lazyScreen(() => import('./multi/OnlineUsers.js'), S.onlineUsers);

export default function DragonSettings(nav) {
  return {
    render() {
      const p = getProfile();
      return screen(
        title(S.dragonMenuSettings),
        el('div.dg-wallet', S.dragonWallet((p.dragonCoins || 0).toLocaleString('en-US'))),

        button(S.dragonMenuControls, () => nav.push(DragonKeys)),
        button(S.dragonMenuSound, () => nav.push(DragonSound)),
        button(S.dragonRename, () => nav.push(DragonNickname)),

        /* 오락실 공용 — 신발게임 설정과 같은 것을 부른다 */
        button(S.menuInbox, () => nav.push(Inbox)),
        button(S.menuMsgAccept, () => nav.push(MessageSettings)),
        button(S.onlineUsers, () => nav.push(OnlineUsers, { game: 'dragon' })),

        el('div.spacer'),
        backButton(S.backToGameLobby, () => nav.back())
      );
    },
  };
}
