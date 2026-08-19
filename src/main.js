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

import { nav, bindHardwareBack, bindEscBack } from './screens/router.js';
import { bindMenuNav } from './screens/menuNav.js';
import SplashLogin from './screens/SplashLogin.js';
import Lobby from './screens/Lobby.js';
import { initAuth, onUserChanged } from './services/auth.js';
import { get as getProfile, pullAll } from './services/profile.js';
import { selftest } from './services/diagnose.js';
import { sweepUnsettled } from './services/multiSettle.js';
import { initPwa } from './services/pwa.js';
import { prefetchGame } from './game/loadGame.js';

/**
 * ★ **인게임 코드는 이제 따로 받는다.** (2026-08-19 13차)
 * 예전에는 여기서 정적으로 import 해서 **부팅 번들에 49KB(gzip)** 가 들어 있었다 —
 * 첫 화면에는 한 줄도 안 쓰는 코드다. 자세한 계측은 `game/loadGame.js` 주석.
 */

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

  /**
   * ★ **세션 확인을 제일 먼저 띄운다.** (2026-08-19 13차, 속도)
   *
   * `initAuth()` 는 첫 호출에서 **firebase 청크(71KB)를 내려받는다.** 예전에는 캔버스·
   * 입력·오디오·루프를 다 세운 **뒤에** 불러서, 그 준비 시간만큼 요청이 늦게 나갔다.
   * 실측(4G, `npm run perf:boot`)에서 firebase 청크가 **+703ms** 에야 끝나고
   * 첫 화면이 그 직후였다 — 네트워크가 놀고 있는 구간이 앞에 있었다는 뜻이다.
   *
   * 프라미스만 먼저 띄우고 기다리기는 아래에서 한다. 그 사이에 초기화가 돈다.
   */
  const authReady = initAuth();

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
   * ★ 인게임 코드(49KB gzip)를 **한가할 때 미리** 받아 둔다. (2026-08-19 13차)
   * 첫 화면을 그리는 데는 필요 없지만, 버튼을 누를 때는 이미 있어야 한다.
   */
  prefetchGame();

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
  /**
   * ★ **계정이 이미 있으면 세션 확인을 기다리지 않고 로비를 띄운다.** (2026-08-19 13차)
   *
   * 실측: 첫 화면까지 726ms 중 **firebase 청크 + 세션 확인이 400ms 넘게** 차지했다.
   * 그런데 이 게임은 **로컬이 원본**이다(§M5) — 로컬에 `uid` 와 닉네임이 있다는 건
   * 예전에 **실제로 로그인에 성공했다**는 뜻이고, 그 화면은 어차피 로비다.
   *
   * 그래서 먼저 그리고 나중에 맞춘다. 세션이 정말 끊겼으면(`!u`) 그때 로그인 화면으로
   * 돌린다 — 그 경우는 드물고, 그 대가로 **모든 재방문자의 첫 화면이 그만큼 빨라진다.**
   * 그 사이에 싱글게임을 시작해도 문제가 없다(기록은 로컬에 남고 다음 접속에 올라간다).
   */
  const 로컬 = getProfile();
  const 미리로비 = !!(로컬.nickname && 로컬.uid && 로컬.uid !== 'guest');
  if (미리로비) {
    nav.reset(Lobby);
    hideBoot();
  }

  /** 지금 로비를 띄워 뒀나 — 같은 화면을 두 번 세우지 않으려고 기억한다 */
  let 로비중 = 미리로비;

  const u = await authReady;
  if (미리로비) {
    // 세션이 끝났다 — 그제야 로그인 화면으로 되돌린다
    if (!u) { nav.reset(SplashLogin); 로비중 = false; }
  } else {
    const 첫화면 = routeFor(u);
    nav.reset(첫화면);
    로비중 = 첫화면 === Lobby;
    hideBoot();
  }
  if (u && !u.guest) syncOnce();
  onUserChanged((next) => {
    /**
     * 부팅 타임아웃 뒤에 세션이 확인된 경우 — 로그인 화면에 머물러 있으면 밀어 넣는다.
     * **이미 로비면 다시 세우지 않는다**: `reset` 은 화면 인스턴스를 새로 만들어
     * 로비의 미리받기·접속 표시가 한 번 더 돈다(2026-08-19 13차, '미리 로비' 이후).
     */
    if (next && !로비중 && nav.depth() === 1 && routeFor(next) === Lobby) {
      nav.reset(Lobby);
      로비중 = true;
    }
    if (next && !next.guest) syncOnce();
  });
}

boot().catch((err) => {
  console.error(err);
  const boot = document.getElementById('boot');
  if (boot) boot.textContent = '실행에 실패했습니다';
});
