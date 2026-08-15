/**
 * 부트스트랩 — 로그인 → 포털 → 로비 → 인게임.
 *
 * 게임 루프는 항상 돌고 있고, 화면(DOM)이 떠 있을 때는 캔버스가 숨는다.
 * 그래서 로비에서 게임으로 넘어갈 때 다시 초기화할 게 없다. (screens/router.js)
 */

import { initCanvas } from './core/canvas.js';
import { initInput, setInputEnabled, onAudioReady, pollGamepads } from './core/input.js';
import { startLoop, stopLoop, bindVisibility } from './core/loop.js';
import * as Scene from './core/scene.js';
import * as Audio from './audio/audio.js';
import * as Sfx from './audio/sfx.js';
import * as Bgm from './audio/bgm.js';

import { GameScene } from './game/GameScene.js';
import { nav, bindHardwareBack } from './screens/router.js';
import SplashLogin from './screens/SplashLogin.js';
import Lobby from './screens/Lobby.js';
import { initAuth, onUserChanged } from './services/auth.js';
import { get as getProfile, pullAll } from './services/profile.js';
import { selftest } from './services/diagnose.js';

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
  // 게임패드는 이벤트가 없다 — 매 프레임 직접 읽어야 한다
  const update = (dt) => { pollGamepads(); Scene.updateCurrent(dt); };
  const render = () => Scene.renderAll();
  startLoop(update, render);
  bindVisibility(
    () => { stopLoop(); Audio.suspendAudio(); },
    () => { startLoop(update, render); Audio.resumeAudio(); }
  );
  bindHardwareBack();

  /**
   * 진단용 훅. QA 스크립트가 로그인을 건너뛰고 화면을 직접 열 때 쓴다.
   * `selftest()` 는 원격 저장이 어디서 막히는지 콘솔에 찍어 준다 —
   * 모든 원격 쓰기가 실패를 삼키기 때문에 이게 없으면 원인을 알 길이 없다.
   */
  window.__dbg = { Scene, Audio, Sfx, Bgm, nav, profile: getProfile, screens: { Lobby, SplashLogin }, selftest };

  hideBoot();

  /**
   * 저장된 세션이 있으면 로그인 화면을 건너뛴다.
   * 닉네임만으로는 안 된다 — 로그인이 게임의 전제이므로 **계정이 있어야** 통과시킨다.
   * 세션 확인이 늦게 끝나면 일단 로그인 화면을 띄우고, 확인되는 순간 넘어간다.
   */
  const routeFor = (u) => (u && getProfile().nickname ? Lobby : SplashLogin);

  /**
   * **세션이 복원됐을 때도 서버와 한 번 맞춘다.**
   *
   * 예전에는 `pullAll()` 이 SplashLogin 의 구글 버튼을 **직접 누른 경우에만** 돌았다.
   * 그런데 두 번째 방문부터는 세션이 남아 있어 로그인 화면을 건너뛰고 로비로 직행한다 —
   * 즉 그 뒤로는 영영 안 돌았다. 그 사이 오프라인이었거나 첫 시도가 실패해서 큐에 남은
   * 기록은 다시 올라갈 기회를 잃고, 계정 문서도 만들어지지 않는다.
   * 명예의 전당이 계속 비어 있던 경로 중 하나가 이것이다.
   *
   * 화면을 막지 않으려고 기다리지 않는다 — 실패해도 로컬은 그대로다.
   */
  let synced = false;
  const syncOnce = () => {
    if (synced) return;
    synced = true;
    pullAll().catch((e) => console.warn('[sync] 서버 동기화 실패 — 로컬로 계속합니다', e));
  };

  const u = await initAuth();
  nav.reset(routeFor(u));
  if (u && !u.guest) syncOnce();
  onUserChanged((next) => {
    // 부팅 타임아웃 뒤에 세션이 확인된 경우 — 로그인 화면에 머물러 있으면 밀어 넣는다
    if (next && nav.depth() === 1 && routeFor(next) === Lobby) nav.reset(Lobby);
    if (next && !next.guest) syncOnce();
  });
}

boot().catch((err) => {
  console.error(err);
  const boot = document.getElementById('boot');
  if (boot) boot.textContent = '실행에 실패했습니다';
});
