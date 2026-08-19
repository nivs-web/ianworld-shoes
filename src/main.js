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
import { bindMenuNav } from './screens/menuNav.js';
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
   * ★ 키보드·게임패드로 메뉴를 움직인다 (2026-08-19 12차, 사용자 지정) —
   * *"터치 없이도 게임 가능하게끔"*. 방향키로 커서, 엔터로 선택, ESC 로 뒤로.
   */
  bindMenuNav();

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
    /**
     * ★ **접속 표시와 쪽지함을 켠다.** (2026-08-19 11차)
     *
     * §9-0-11 에서 "싱글만 하는 사람이 RTDB 192KB 를 받는" 회귀를 한 번 고쳤다.
     * 그런데 쪽지·대결신청은 **접속해 있는 모두**가 받아야 하는 기능이라, 이제는
     * 전원이 붙어야 한다 — 안 붙으면 그 사람은 현재접속자 목록에 아예 없다.
     *
     * 대신 **부팅을 막지 않는다.** 첫 화면이 그려지고 한참 뒤에 조용히 붙고
     * (`startLater`), 실패해도 게임은 그대로 돈다.
     */
    import('./services/presence.js').then((P) => P.startLater(() => {
      // 쪽지함은 **붙은 뒤에** 구독한다 — 먼저 부르면 RTDB 청크를 앞당겨 받는다
      import('./screens/inboxPopups.js').then((I) => I.start(nav)).catch(() => {});
    })).catch(() => {});
  };

  /**
   * ★ **첫 화면을 띄운 뒤에 부트 화면을 끈다.** (2026-08-19 8차)
   *
   * 예전에는 `hideBoot()` 가 `await initAuth()` **앞**에 있었다. 세션 확인은 최대
   * 3초를 기다리므로(`auth.AUTH_BOOT_TIMEOUT_MS`), 그동안 부트 화면은 이미 사라졌고
   * 첫 화면은 아직 없다 — **최대 3초짜리 빈 화면**이다. 회선이 느릴수록 길어진다.
   * "빠르게 접속되어야 한다"는 요구에서 제일 먼저 눈에 띄는 자리가 여기다.
   *
   * 순서만 바꾸면 그 구간이 통째로 사라진다. 기다리는 시간은 같지만 **기다리는 동안
   * 볼 것이 있다** — 사용자에게는 그게 곧 속도다.
   */
  const u = await initAuth();
  nav.reset(routeFor(u));
  hideBoot();
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
