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
import { enterFullscreen, exitFullscreen, isFullscreen } from '../core/fullscreen.js';
import { lazyScreen } from './lazyScreen.js';

/**
 * ★ **2번째 게임은 누를 때 받는다.** (드래곤 스트라이커)
 * 신발게임만 하는 사람에게 드래곤 로비 코드를 부팅 번들로 내려보낼 이유가 없다.
 * 카드에 보이는 건 제목과 최고 점수뿐이고 그 둘은 프로필에 이미 있다.
 */
const DragonLobby = lazyScreen(() => import('./DragonLobby.js'), S.dragonTitle);

/**
 * 게임 카드.  `sub` 는 카드 제목 아래 한 줄 — 게임마다 자랑할 숫자가 다르다
 * (신발은 모은 켤레, 드래곤은 최고 점수).
 */
const CARDS = [
  { id: 'find_shoes', title: S.gameTitle, sub: (p) => S.totalShoesCount(p.shoesOwned), screen: () => Lobby, ready: true },
  { id: 'dragon_striker', title: S.dragonTitle, sub: (p) => S.dragonBestScore(p.dragonBest || 0), screen: () => DragonLobby, ready: true },
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

  /**
   * ★ **전체화면은 여기서 켠다.** (2026-08-26, 사용자 지정)
   *
   * 예전에는 게임을 시작할 때 켜고 판이 끝나면 껐다(`startGame.js` 의 `handleFinish`).
   * 그래서 **한 판 끝날 때마다 풀렸고**, 중간에 도감이나 설정을 들렀다 오면 다시
   * 안 켜졌다 — 사용자가 말한 "간혹 전체화면이 안 됨" 이 이것이다.
   *
   * 오락실에서 한 번 켜면 세션 내내 유지된다. `document.documentElement` 를 통째로
   * 전체화면으로 만들기 때문에 화면을 옮겨 다녀도 그대로다.
   *
   * ⚠ **`await` 를 먼저 하면 안 된다.** 전체화면 요청은 클릭 핸들러 안에서 곧바로
   * 나가야 브라우저가 받아 준다. 기다렸다 부르면 제스처 컨텍스트를 벗어나 거절당한다.
   *
   * 방향은 잠그지 않는다 — 신발은 세로, 드래곤은 가로라 **게임이 정한다**
   * (`core/fullscreen.js` 의 `lockPortrait` / `lockLandscape` 주석).
   */
  function onFullscreen() {
    if (isFullscreen()) { exitFullscreen(); return; }
    enterFullscreen().then((ok) => { if (!ok) toast(S.fullscreenFailed, 2600); });
  }

  // 설치 가능 신호는 화면이 그려진 뒤에 온다 — 도착하면 버튼을 다시 그린다
  const off = onInstallChange(() => nav.refresh());
  // 전체화면이 켜지고 꺼질 때 버튼 글자를 바꿔야 한다 (사용자가 F11 로 껐을 수도 있다)
  const onFsChange = () => nav.refresh();
  for (const ev of ['fullscreenchange', 'webkitfullscreenchange']) {
    document.addEventListener(ev, onFsChange);
  }

  return {
    onLeave() {
      off();
      for (const ev of ['fullscreenchange', 'webkitfullscreenchange']) {
        document.removeEventListener(ev, onFsChange);
      }
    },
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
            el('div.game-card-sub', c.sub(p)),
            button(S.touchToStart, () => nav.push(c.screen()), { primary: true }),
          ])
        ),
        el('div.spacer'),
        // 이미 홈 화면 앱으로 돌고 있으면 바로가기가 무의미하므로 감춘다
        !isStandalone() ? button(S.installShortcut, onInstall) : null,
        /**
         * 홈 화면 앱(standalone)은 이미 주소창이 없다 — 그 상태에서 전체화면 버튼은
         * 아무것도 바꾸지 못하면서 자리만 차지한다.
         */
        !isStandalone() ? button(isFullscreen() ? S.fullscreenOff : S.fullscreenOn, onFullscreen) : null,
        backButton(S.logout, onLogout)
      );
    },
  };
}
