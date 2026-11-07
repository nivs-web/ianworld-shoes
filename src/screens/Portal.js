/**
 * S03 포털 — 「이안오락실」(2026-11-04 이름 변경 · 옛 이름 오락실 이안월드). 게임 카드 목록.
 * 지금은 「신발을 찾아서」 1종. 게임이 늘면 CARDS 에 추가한다.
 */

import S from '../config/strings.ko.js';
import { el, button, backButton, screen, confirmDialog, toast, goOraksilHome } from './ui.js';
import { get as getProfile } from '../services/profile.js';
import { signOut, onUserChanged, currentUser } from '../services/auth.js';
import Lobby from './Lobby.js';
import SplashLogin from './SplashLogin.js';
import { canInstall, promptInstall, isStandalone, onInstallChange } from '../services/pwa.js';
import { enterFullscreen, exitFullscreen, isFullscreen } from '../core/fullscreen.js';
import { lazyScreen } from './lazyScreen.js';
import { arcadeHero, startArcade, stopArcade } from './arcadeHero.js';
import * as Sfx from '../audio/sfx.js';

/**
 * ★ **2번째 게임은 누를 때 받는다.** (드래곤 스트라이커)
 * 신발게임만 하는 사람에게 드래곤 로비 코드를 부팅 번들로 내려보낼 이유가 없다.
 * 카드에 보이는 건 제목과 최고 점수뿐이고 그 둘은 프로필에 이미 있다.
 */
const DragonLobby = lazyScreen(() => import('./DragonLobby.js'), S.dragonTitle);
const AdminStats = lazyScreen(() => import('./AdminStats.js'), S.adminStatsTitle);

/**
 * ★ **운영자 «통계» 는 오락실 첫 화면에 둔다.** (2026-11-05, 대표님 — 권반장 전달)
 * *"통계 위치를 어차피 운영자 아이디 1개만 그 메뉴가 보이는 거니깐 로비 진입 전 게임 선택창
 *   아래쪽에서 누르게 만들어"* — 예전에는 신발·드래곤 설정 안에 있었다(한 곳으로 통일).
 *
 * 운영자 판별은 서버의 `admins/{내uid}` 한 칸이다(`stats.isAdmin`). 그걸 읽으려면 RTDB 를
 * 붙여야 하는데, 첫 화면이 뜨자마자 붙이면 **모든 사람의 부팅**에 RTDB 청크가 끼어든다.
 * 그래서 접속 표시가 원래 붙는 시점(부팅 2.5초 뒤 한가할 때, `presence.startLater`) 이후로
 * 미뤄 확인한다. 한 번 확인한 답은 기억해 두고, 다른 계정으로 바뀌면 다시 묻는다.
 */
const ADMIN_CHECK_DELAY_MS = 3500;
let adminFor = { uid: null, yes: false };
/** 3번째 게임 캐치볼도 누를 때 받는다 (2026-10-28). 카드를 누르면 곧바로 게임 타이틀이다 */
const CatchGame = lazyScreen(() => import('./CatchGame.js'), S.catchTitle);
/** 4번째 게임 3D캐치볼 (2026-10-29) — three.js 를 쓰므로 더더욱 누를 때 받는다 */
const Catch3DGame = lazyScreen(() => import('./Catch3DGame.js'), S.catch3dTitle);
/** 5번째 게임 줄넘기 챔피언 (2026-11-07) — 드래곤처럼 **로비**로 들어간다(권반장 지시: 캐치볼처럼 바로 게임 X) */
const JumpRopeLobby = lazyScreen(() => import('./JumpRopeLobby.js'), S.jumpTitle);
/** 6번째 게임 점프 피아노 (2026-11-07) — 줄넘기 챔피언과 따로 가는 «타일 피아노» 게임 */
const JumpPianoLobby = lazyScreen(() => import('./JumpPianoLobby.js'), S.pianoTitle);
const jrBest = (p) => { const e = p.jr?.endless || {}; return Math.max(e.easy | 0, e.normal | 0, e.hard | 0); };

/**
 * 게임 카드.  `sub` 는 카드 제목 아래 한 줄 — 게임마다 자랑할 숫자가 다르다
 * (신발은 모은 켤레, 드래곤은 최고 점수).
 */
const CARDS = [
  { id: 'find_shoes', banner: '/assets/ui/banner_find_shoes.webp', title: S.gameTitle, sub: (p) => S.totalShoesCount(p.shoesOwned), screen: () => Lobby, ready: true },
  { id: 'dragon_striker', banner: '/assets/ui/banner_dragon_striker.webp', title: S.dragonTitle, sub: (p) => S.dragonTotalCoins(p.dragonCoins || 0), screen: () => DragonLobby, ready: true },
  { id: 'catchball', banner: '/assets/ui/banner_catchball.webp', title: S.catchTitle, sub: (p) => S.catchBestLine(p.catchBestEasy | 0, Math.max(p.catchBestNormal | 0, p.catchBest | 0), p.catchBestHard | 0), screen: () => CatchGame, ready: true },
  { id: 'catchball3d', banner: '/assets/ui/banner_catchball3d.webp', title: S.catch3dTitle, sub: (p) => S.catchBestLine(p.catch3dBestEasy | 0, p.catch3dBestNormal | 0, p.catch3dBestHard | 0), screen: () => Catch3DGame, ready: true },
  { id: 'jumprope', banner: '/assets/ui/banner_jumprope.webp', title: S.jumpTitle, sub: (p) => S.jumpCardLine(jrBest(p), p.jr?.jumps), screen: () => JumpRopeLobby, ready: true },
  { id: 'jumppiano', banner: '/assets/ui/banner_jumppiano.webp', title: S.pianoTitle, sub: () => '3칸 · 6칸 타일을 두드려 점프!', screen: () => JumpPianoLobby, ready: true },
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
   * 방향은 잠그지 않는다 — 신발은 세로 전용이고 드래곤은 양쪽 다 되므로
   * **게임이 정한다** (`core/fullscreen.js` 의 `lockPortrait` 주석).
   */
  function onFullscreen() {
    if (isFullscreen()) { exitFullscreen(); return; }
    enterFullscreen().then((ok) => { if (!ok) toast(S.fullscreenFailed, 2600); });
  }

  // 설치 가능 신호는 화면이 그려진 뒤에 온다 — 도착하면 버튼을 다시 그린다
  const off = onInstallChange(() => nav.refresh());
  /* 운영자인지 — 확인되면 «통계» 단추를 그린다 (손님에게는 단추가 아예 없다) */
  let live = true;
  let adminTimer = null;
  const offUser = onUserChanged((u) => {
    clearTimeout(adminTimer);
    const uid = u && !u.guest ? u.uid : null;
    if (!uid) { if (adminFor.yes) { adminFor = { uid: null, yes: false }; nav.refresh(); } return; }
    if (adminFor.uid === uid) return;                 // 이미 안다
    adminTimer = setTimeout(() => {
      import('../services/stats.js').then((St) => St.isAdmin()).then((yes) => {
        adminFor = { uid, yes: !!yes };
        if (live && yes) nav.refresh();
      }).catch(() => {});
    }, ADMIN_CHECK_DELAY_MS);
  });
  startArcade(); // 첫 화면 폭죽(2026-11-04)
  // 전체화면이 켜지고 꺼질 때 버튼 글자를 바꿔야 한다 (사용자가 F11 로 껐을 수도 있다)
  const onFsChange = () => nav.refresh();
  for (const ev of ['fullscreenchange', 'webkitfullscreenchange']) {
    document.addEventListener(ev, onFsChange);
  }

  return {
    onLeave() {
      off();
      live = false;
      offUser();
      clearTimeout(adminTimer);
      stopArcade();
      for (const ev of ['fullscreenchange', 'webkitfullscreenchange']) {
        document.removeEventListener(ev, onFsChange);
      }
    },
    render() {
      const p = getProfile();
      const sc = screen(
        /* 2026-11-04 대표님: 처음 화면 = 이안오락실 홈페이지 모바일 첫 화면 느낌(움직임) + 가운데 엠블럼·로고 */
        arcadeHero(),
        /* 플레이어 이름 — 아케이드 하이스코어 등록창(대표님 11/4 밤 1번) */
        el('div.oh-player', null, [el('span.oh-player-label', 'PLAYER 1'), el('span.oh-player-name', null, [p.nickname, el('span.oh-player-cur', '▌')])]),
        /* 게임 목록 — 왼쪽 위 타이틀 그림 · 오른쪽 위 정사각 PLAY(높이 = 그림 높이 · 대표님 11/4 밤 1번) · 아래 기록 한 줄 */
        ...CARDS.map((c) =>
          el('div.gc', null, [
            el('img.gc-art', { src: c.banner, alt: c.title, loading: 'lazy' }),
            el('button.gc-play', {
              type: 'button', 'aria-label': `${c.title} 게임 플레이`,
              onclick: () => { Sfx.play('sfx_menu_select'); nav.push(c.screen()); },
            }, ['PLAY']),
            el('div.gc-sub', c.sub(p)),
          ])
        ),
        /* 6번째 자리 — 준비 중 (5번째 줄넘기 챔피언가 들어왔다, 2026-11-07) */
        el('div.gc-soon', null, ['6번째 게임 준비 중',el('span.dots', null, [el('i', '.'), el('i', '.'), el('i', '.')])]),
        el('div.spacer'),
        // 이미 홈 화면 앱으로 돌고 있으면 바로가기가 무의미하므로 감춘다
        !isStandalone() ? button(S.installShortcut, onInstall) : null,
        button(S.goOraksilHome, goOraksilHome),
        /**
         * 홈 화면 앱(standalone)은 이미 주소창이 없다 — 그 상태에서 전체화면 버튼은
         * 아무것도 바꾸지 못하면서 자리만 차지한다.
         */
        !isStandalone() ? button(isFullscreen() ? S.fullscreenOff : S.fullscreenOn, onFullscreen) : null,
        /* 운영자(admins/{uid} = true)에게만 — 오늘 접속자·동시접속 숫자 (2026-11-05) */
        adminFor.yes && adminFor.uid === currentUser()?.uid ? button(S.adminStatsTitle, () => nav.push(AdminStats)) : null,
        backButton(S.logout, onLogout)
      );
      sc.classList.add('oh-screen');
      return sc;
    },
  };
}
