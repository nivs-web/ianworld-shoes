/**
 * S01 스플래시 / 로그인.
 *
 * **이 게임은 멀티플레이라 로그인이 전제다.** (2026-08-15)
 * 게스트는 uid 가 전부 'guest' 라 서버에서 두 사람이 한 사람으로 취급되고,
 * 방·랭킹 보안 규칙도 전부 `auth != null` 기준이다. 그래서 게스트 진입로를 없앴다.
 */

import S from '../config/strings.ko.js';
import { el, button, screen } from './ui.js';
import { canSignIn, signInGoogle, currentUser } from '../services/auth.js';
import { pullAll, get as getProfile } from '../services/profile.js';
import { toast } from './ui.js';
import NicknameSetup from './NicknameSetup.js';
import Portal from './Portal.js';
import { canInstall, promptInstall, isStandalone, onInstallChange, isMobile } from '../services/pwa.js';

export default function SplashLogin(nav) {
  let busy = false;

  /**
   * 설치 가능 신호는 **화면을 그린 뒤에** 온다 (브라우저가 조건을 다 확인한 다음이라
   * 보통 1초쯤 늦다). 그래서 구독해 두고 도착하면 버튼을 다시 그린다.
   */
  const off = onInstallChange(() => nav.refresh());

  /** 로그인 후 닉네임 유무에 따라 분기 */
  function enter() {
    const p = getProfile();
    if (!p.nickname) nav.replace(NicknameSetup);
    else nav.replace(Portal);
  }

  async function onGoogle() {
    if (busy) return;
    busy = true;
    try {
      const u = await signInGoogle();
      if (!u) return; // 리다이렉트 진행 중
      await pullAll();
      enter();
    } catch (e) {
      // 왜 안 됐는지 말해 준다. '로그인 실패' 한 줄로는 사용자가 할 수 있는 게 없다
      toast(
        e?.code === 'app/popup-required' ? S.loginPopupBlocked
        : e?.code === 'app/domain-blocked' ? S.loginDomainBlocked(location.host)
        : S.loginFailed,
        e?.code === 'app/domain-blocked' ? 5200 : 3200
      );
      console.warn('[로그인] 실패', e?.code, e);
    } finally {
      busy = false;
    }
  }

  async function onInstall() {
    const r = await promptInstall();
    // 프롬프트가 없는 환경에는 **그 기기에 맞는** 방법을 알려 준다 (2026-08-19)
    if (r === 'accepted') toast(S.installDone, 2600);
    else if (r === 'ios') toast(S.installIosGuide, 3600);
    else if (r === 'android') toast(S.installAndroidGuide, 3600);
    else if (r === 'unavailable') toast(S.installBookmarkGuide, 3200);
  }

  return {
    onLeave() { off(); },
    render() {
      const signedIn = !!currentUser();
      /**
       * Firebase 설정이 없으면 로그인 자체가 불가능하다. 예전에는 이 경우 게스트로
       * 흘려보냈지만 이제는 들어갈 길이 없으므로, 빈 화면 대신 이유를 적어 준다.
       */
      const blocked = !canSignIn();

      return screen(
        el('div.splash', null, [
          el('div.splash-logo', S.portalTitle),
          el('div.splash-sub', S.gameTitle),
        ]),
        el('div.spacer'),
        signedIn
          ? button(S.touchToStart, enter, { primary: true })
          : button(S.loginGoogle, onGoogle, { primary: true, disabled: blocked }),
        /**
         * 이미 홈 화면 앱으로 돌고 있으면 감춘다.
         * **모바일에서는 프롬프트가 아직 안 왔어도 보여 준다** (2026-08-19) —
         * 그 경우 눌러도 아무 일 없는 게 아니라 "메뉴 → 홈 화면에 추가" 를 알려 주므로
         * 버튼이 제 역할을 한다. 예전엔 `canInstall()` 로 막아서, 정작 홈 화면 추가가
         * 가장 필요한 안드로이드 사용자에게 버튼이 아예 안 보이는 경우가 있었다.
         */
        !isStandalone() && (canInstall() || isMobile()) ? button(S.installShortcut, onInstall) : null,
        el('div.hint', blocked ? S.loginUnavailable : signedIn ? S.loginWhy : S.loginRequired)
      );
    },
  };
}
