/**
 * S03 포털 — 「오락실 이안월드」. 게임 카드 목록.
 * 지금은 「신발을 찾아서」 1종. 게임이 늘면 CARDS 에 추가한다.
 */

import S from '../config/strings.ko.js';
import { el, button, backButton, screen, confirmDialog } from './ui.js';
import { get as getProfile } from '../services/profile.js';
import { signOut } from '../services/auth.js';
import Lobby from './Lobby.js';
import SplashLogin from './SplashLogin.js';

const CARDS = [
  { id: 'find_shoes', title: S.gameTitle, screen: () => Lobby, ready: true },
];

export default function Portal(nav) {
  /**
   * 로그아웃은 여기(오락실 화면)에만 둔다.
   * 게임 안에 두면 판 도중에 눌릴 수 있고, 로비는 이미 버튼이 많다.
   * 계정 상태를 바꾸는 일이라 한 번 되묻는다.
   */
  async function onLogout() {
    if (!(await confirmDialog({ message: S.logoutConfirm, yes: S.yes, no: S.no }))) return;
    await signOut();
    nav.reset(SplashLogin);
  }

  return {
    render() {
      const p = getProfile();
      return screen(
        el('div.portal-head', null, [
          el('img.portal-logo', { src: '/assets/ui/logo_portal.png', alt: S.portalTitle }),
          el('div.portal-user', `${S.playerName} : ${p.nickname}`),
        ]),
        ...CARDS.map((c) =>
          el('div.game-card', null, [
            el('div.game-card-title', c.title),
            el('div.game-card-sub', S.totalShoesCount(p.shoesOwned)),
            button(S.touchToStart, () => nav.push(c.screen()), { primary: true }),
          ])
        ),
        el('div.spacer'),
        backButton(S.logout, onLogout)
      );
    },
  };
}
