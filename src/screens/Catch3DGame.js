/**
 * S32 3D캐치볼 — 오락실 4번째 게임. (2026-10-29, 사용자 지정)
 *
 * > *"원래 2d 게임은 이안월드 3번째 게임이고 이건 '3D캐치볼' 이라는 이름으로 4번째 게임으로 개발해서 넣어.
 * >  둘다 이안월드에 넣자"*
 *
 * 게임은 2D 캐치볼과 **같은 모듈**(`games/catch/catchball.js`)이다. 여기서 3D 화면(`world3d.js`,
 * three.js 포함)을 같이 받아 `opts.world3d` 로 넘기면 경기장 · 인형 · 공이 3D 로 그려진다.
 * 규칙 · 조작 · 꾸미기 · 선물함 · 소리는 2D 와 같다.
 *
 *   · 기록은 2D 와 **따로** 센다 (`catch3dBest*` · `catch3dCombo*` · `catch3dPlays`).
 *   · 꾸미기 · 최고 레벨 · 연속 스트라이크 · 받은 모자/야구공은 **같은 캐릭터**라 2D 와 같이 쓴다.
 *   · 1:1 대결은 2D 와 **같은 캐치볼 방**을 쓴다 (`CatchMultiMenu` 를 `view3d` 로 연다 — 내 화면만 3D).
 *     승패도 2D 와 같은 칸(`catchWins/catchLosses`)에 센다.
 *   · 명예의 전당은 2D 순위표의 '3D' 탭으로 연다 (`CatchRanking` 을 `view3d` 로).
 *   · 접속 상태는 'catch' 로 쓴다 — RTDB 규칙이 게임 이름을 shoes/dragon/catch 로만 받는다.
 *
 * WebGL 을 못 켜는 기기에서는 게임이 스스로 2D 로 돈다(`catchball.js` 의 `fail3d`).
 */

import S from '../config/strings.ko.js';
import { el, toast } from './ui.js';
import { get as getProfile, finishCatch3dRun, catch3dBests, catch3dCombos, setCatch3dDifficulty } from '../services/profile.js';
import { unlockOrientation } from '../core/fullscreen.js';
import { setGameGuard } from './router.js';
import { stopLoop, startLoop, isRunning } from '../core/loop.js';
import * as Scene from '../core/scene.js';
import * as Presence from '../services/presence.js';
import { lookOpts } from './CatchGame.js';
import { lazyScreen } from './lazyScreen.js';

const CatchMultiMenu = lazyScreen(() => import('./multi/CatchMultiMenu.js'), S.catch3dDuelTitle);
const CatchRanking = lazyScreen(() => import('./CatchRanking.js'), S.catchRankTitle);

let mods = null;
/** 게임 모듈과 3D 화면을 같이 받는다 — 3D 는 three.js 가 들어 있어 크다 */
export async function loadCatch3D() {
  if (!mods) {
    const [game, world] = await Promise.all([import('../games/catch/catchball.js'), import('../games/catch/world3d.js')]);
    mods = { game, world };
  }
  return mods;
}

export default function Catch3DGame(nav) {
  let live = true;
  let stoppedArcadeLoop = false;

  return {
    onLeave() {
      live = false;
      setGameGuard(null);
      unlockOrientation();
      if (mods) mods.game.unmount();
      Presence.setState('lobby', 'catch');
      if (stoppedArcadeLoop) { startLoop(Scene.updateCurrent, Scene.renderAll); stoppedArcadeLoop = false; }
    },

    render() {
      const host = el('div.dg-host');

      loadCatch3D().then(({ game, world }) => {
        if (!live) return;
        /* 제 rAF 루프를 돈다 — 오락실 루프는 잠깐 멈춘다 (DragonGame · CatchGame 과 같은 이유) */
        if (isRunning()) { stopLoop(); stoppedArcadeLoop = true; }
        Presence.setState('playing', 'catch');
        setGameGuard(() => game.requestPause());

        const p = getProfile();
        game.mount(host, {
          mode: 'solo',
          world3d: world.createWorld3D,
          titleLogo: S.catch3dTitle,
          titleKicker: '진짜처럼 움직이는 3D 야구',
          ...lookOpts(p),
          difficulty: p.catch3dDifficulty || 'normal',
          bests: catch3dBests(p),
          combos: catch3dCombos(p),
          duelRecord: { wins: p.catchWins | 0, losses: p.catchLosses | 0 },
          onFinish(r) { finishCatch3dRun(r); },
          onDifficulty(d) { setCatch3dDifficulty(d); },
          onDuel() { if (live) nav.push(CatchMultiMenu, { view3d: true }); },
          onRanking() { if (live) nav.push(CatchRanking, { view3d: true, diff: getProfile().catch3dDifficulty }); },
          onExit() { if (live) nav.back(); },
        });
      }).catch((e) => {
        console.warn('[3D캐치볼] 게임을 받지 못했다', e);
        if (live) { toast(S.catch3dLoadFailed, 3200); nav.back(); }
      });

      return el('div.dragon-stage', null, [
        el('div.dragon-loading', S.catch3dLoading),
        host,
      ]);
    },
  };
}
