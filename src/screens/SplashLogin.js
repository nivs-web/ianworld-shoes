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

/** 설치 프롬프트 — 크롬 계열은 beforeinstallprompt, iOS는 안내만 */
let deferredInstall = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstall = e;
});

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

export default function SplashLogin(nav) {
  let busy = false;

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
      toast(e?.code === 'app/popup-required' ? S.loginPopupBlocked : S.loginFailed, 3200);
      console.warn('[로그인] 실패', e?.code, e);
    } finally {
      busy = false;
    }
  }

  function onInstall() {
    if (deferredInstall) {
      deferredInstall.prompt();
      deferredInstall = null;
      return;
    }
    toast(isIos() ? S.installIosGuide : S.installDone, 2600);
  }

  return {
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
        !isStandalone() ? button(S.installShortcut, onInstall) : null,
        el('div.hint', blocked ? S.loginUnavailable : signedIn ? S.loginWhy : S.loginRequired)
      );
    },
  };
}
