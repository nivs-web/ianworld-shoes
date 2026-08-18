/**
 * S03 포털 — 「오락실 이안월드」. 게임 카드 목록.
 * 지금은 「신발을 찾아서」 1종. 게임이 늘면 CARDS 에 추가한다.
 */

import S from '../config/strings.ko.js';
import { el, button, backButton, screen, confirmDialog, toast } from './ui.js';
import { get as getProfile } from '../services/profile.js';
import { signOut } from '../services/auth.js';
import Lobby from './Lobby.js';
import SplashLogin from './SplashLogin.js';
import { canInstall, promptInstall, isStandalone, onInstallChange } from '../services/pwa.js';

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

  /**
   * '앱 바로가기 만들기' — 안드로이드/데스크톱 크롬은 `beforeinstallprompt` 를 받아
   * 진짜 설치 대화상자를 띄운다. iOS 사파리는 그 이벤트가 없어 안내 문구로 대신한다.
   * 그 둘 다 아닌 PC 브라우저(파이어폭스 등)는 설치 자체가 불가능하므로 **북마크 안내**로
   * 같은 목적(바로가기)을 이룬다 — `promptInstall()` 이 'unavailable' 을 돌려주는 경우다.
   */
  async function onInstall() {
    const r = await promptInstall();
    if (r === 'accepted') toast(S.installDone, 2600);
    else if (r === 'ios') toast(S.installIosGuide, 3600);
    // 안드로이드에서 프롬프트가 아직 안 왔을 때 — PC용 Ctrl+D 안내가 나가면 안 된다
    else if (r === 'android') toast(S.installAndroidGuide, 3600);
    else if (r === 'unavailable') toast(S.installBookmarkGuide, 3200);
  }

  // 설치 가능 신호는 화면이 그려진 뒤에 온다 — 도착하면 버튼을 다시 그린다
  const off = onInstallChange(() => nav.refresh());

  return {
    onLeave() { off(); },
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
        // 이미 홈 화면 앱으로 돌고 있으면 바로가기가 무의미하므로 감춘다
        !isStandalone() ? button(S.installShortcut, onInstall) : null,
        backButton(S.logout, onLogout)
      );
    },
  };
}
