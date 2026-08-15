/**
 * 부트스트랩 — 로그인 → 포털 → 로비 → 인게임.
 *
 * 게임 루프는 항상 돌고 있고, 화면(DOM)이 떠 있을 때는 캔버스가 숨는다.
 * 그래서 로비에서 게임으로 넘어갈 때 다시 초기화할 게 없다. (screens/router.js)
 */

import { initCanvas } from './core/canvas.js';
import { initInput, setInputEnabled, onAudioReady } from './core/input.js';
import { startLoop, stopLoop, bindVisibility } from './core/loop.js';
import * as Scene from './core/scene.js';
import * as Audio from './audio/audio.js';
import * as Sfx from './audio/sfx.js';
import * as Bgm from './audio/bgm.js';

import { GameScene } from './game/GameScene.js';
import { nav, bindHardwareBack } from './screens/router.js';
import SplashLogin from './screens/SplashLogin.js';
import Lobby from './screens/Lobby.js';
import { initAuth } from './services/auth.js';
import { get as getProfile } from './services/profile.js';

// 오버레이/로비에서 새 판을 열 때 순환 import를 피하기 위한 전역 훅
window.__gameModule = { GameScene };

function hideBoot() {
  const boot = document.getElementById('boot');
  if (!boot) return;
  boot.classList.add('hidden');
  setTimeout(() => boot.remove(), 300);
}

async function boot() {
  initCanvas();
  initInput();
  setInputEnabled(false); // 첫 화면은 DOM이다 — 게임 입력은 인게임에서만 켠다
  Audio.initAudio();
  onAudioReady(() => Bgm.startBgm());

  // 게임 루프는 처음부터 돌려둔다. 인게임 씬이 없으면 아무것도 그리지 않는다.
  const update = (dt) => Scene.updateCurrent(dt);
  const render = () => Scene.renderAll();
  startLoop(update, render);
  bindVisibility(
    () => { stopLoop(); Audio.suspendAudio(); },
    () => { startLoop(update, render); Audio.resumeAudio(); }
  );
  bindHardwareBack();

  window.__dbg = { Scene, Audio, Sfx, Bgm, nav, profile: getProfile };

  hideBoot();

  // 저장된 세션이 있으면 로그인 화면을 건너뛴다
  await initAuth();
  const p = getProfile();
  nav.reset(p.nickname ? Lobby : SplashLogin);
}

boot().catch((err) => {
  console.error(err);
  const boot = document.getElementById('boot');
  if (boot) boot.textContent = '실행에 실패했습니다';
});
