/**
 * S01 스플래시 / 로그인.
 *
 * Firebase가 설정돼 있으면 구글 로그인을, 없으면 바로 시작을 보여준다.
 * 어느 쪽이든 **여기서 막히지 않는다** — 로그인은 기기 간 이어하기 수단이지
 * 플레이의 전제가 아니다.
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
  /** 로그인/게스트 진입 후 닉네임 유무에 따라 분기 */
  function enter() {
    const p = getProfile();
    if (!p.nickname) nav.replace(NicknameSetup);
    else nav.replace(Portal);
  }

  async function onGoogle() {
    try {
      const u = await signInGoogle();
      if (!u) return; // 리다이렉트 진행 중
      await pullAll();
      enter();
    } catch {
      toast(S.loginFailed);
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
       * Firebase가 켜져 있어도 **로그인을 강제하지 않는다.**
       * 구글 로그인만 내걸면 팝업이 막힌 브라우저·오프라인·계정 없는 사람이
       * 그대로 막힌다. 로그인은 기기 간 이어하기 수단일 뿐이다.
       */
      const needsLogin = canSignIn() && !signedIn;
      return screen(
        el('div.splash', null, [
          el('div.splash-logo', S.portalTitle),
          el('div.splash-sub', S.gameTitle),
        ]),
        el('div.spacer'),
        needsLogin ? button(S.loginGoogle, onGoogle, { primary: true }) : null,
        needsLogin
          ? button(S.loginGuest, enter)
          : button(S.touchToStart, enter, { primary: true }),
        !isStandalone() ? button(S.installShortcut, onInstall) : null,
        el('div.hint', needsLogin ? S.loginWhy : S.loginNone)
      );
    },
  };
}
