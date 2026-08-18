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
import { nav, bindHardwareBack, bindEscBack } from './screens/router.js';
import SplashLogin from './screens/SplashLogin.js';
import Lobby from './screens/Lobby.js';
import { initAuth, onUserChanged } from './services/auth.js';
import { get as getProfile, pullAll } from './services/profile.js';
import { selftest } from './services/diagnose.js';
import { sweepUnsettled } from './services/multiSettle.js';
import { initPwa } from './services/pwa.js';

// 오버레이/로비에서 새 판을 열 때 순환 import를 피하기 위한 전역 훅
window.__gameModule = { GameScene };

function hideBoot() {
  const boot = document.getElementById('boot');
  if (!boot) return;
  boot.classList.add('hidden');
  setTimeout(() => boot.remove(), 300);
}

async function boot() {
  /**
   * 서비스 워커·설치 프롬프트. **가장 먼저** 부른다 —
   * `beforeinstallprompt` 는 부팅 직후 한 번 오고 다시 오지 않아서,
   * 늦게 듣기 시작하면 그 판에서는 설치 버튼을 못 띄운다. (services/pwa.js)
   */
  initPwa();

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
  bindEscBack();

  /**
   * 진단용 훅. QA 스크립트가 로그인을 건너뛰고 화면을 직접 열 때 쓴다.
   * `selftest()` 는 원격 저장이 어디서 막히는지 콘솔에 찍어 준다 —
   * 모든 원격 쓰기가 실패를 삼키기 때문에 이게 없으면 원인을 알 길이 없다.
   */
  /**
   * 멀티는 실패가 **조용하다** — 방이 없는 건지, 연결이 안 된 건지, 규칙에 막힌 건지
   * 화면만 봐서는 구별이 안 된다. 실제로 그 구별이 안 돼서 며칠을 헤맸다.
   * 그래서 콘솔에서 직접 찔러 볼 수 있게 열어 둔다: `await __dbg.multi.diagnose()`
   */
  window.__dbg = {
    Scene, Audio, Sfx, Bgm, nav, profile: getProfile, screens: { Lobby, SplashLogin }, selftest,
    multi: {
      raw: () => import('./services/multiplayer.js'),
      async diagnose(code) {
        const M = await import('./services/multiplayer.js');
        const fb = await (await import('./services/firebase.js')).getRtdb();
        const out = { rtdb: !!fb };
        if (!fb) return out;
        out.연결 = await M.waitConnected({ ...fb, uid: '' });
        out.방목록 = (await M.scanRooms()).map((r) => ({
          code: r.code, state: r.state, open: r.open,
          인원: Object.keys(r.players ?? {}).length, host: String(r.hostUid).slice(0, 8),
        }));
        if (code) {
          out.방읽기 = await M.readRoom(code);
          out.입장결과 = await M.joinRoom(code);
        }
        return out;
      },
    },
  };

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
    /**
     * ★ **순서가 중요하다 — 당겨온 다음에 청산한다.** (2026-08-18)
     *
     * 둘을 동시에 띄우면 `pullAll` 이 **청산 전에 뜬 스냅샷**으로 지갑을 병합해 저장하므로,
     * 그 사이에 끝난 정산(신발 차감·수령)이 로컬에서 조용히 되돌아간다. 지갑 병합은
     * 신발별 **max** 라 서버의 옛 값이 이기고, 항아리에는 그 신발이 그대로 있어
     * **같은 신발이 두 곳에 존재**하게 된다.
     */
    pullAll()
      .catch((e) => console.warn('[sync] 서버 동기화 실패 — 로컬로 계속합니다', e))
      .then(() => sweepUnsettled().catch(() => {}));
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
