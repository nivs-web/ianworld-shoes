/**
 * PWA — 서비스 워커 등록과 설치 프롬프트.
 *
 * ## 왜 이 파일이 생겼나
 *
 * `public/sw.js` 는 처음부터 있었는데 **아무도 등록하지 않았다.** `serviceWorker.register`
 * 가 코드 어디에도 없었으니 캐시도, 오프라인도, 설치 배너도 전부 없던 셈이다.
 * (아이콘 폴더까지 비어 있어서 크롬이 설치 조건을 아예 못 맞췄다 — tools/build-icons.mjs)
 *
 * 설치 프롬프트를 여기서 잡는 이유도 같다. `beforeinstallprompt` 는 **부팅 직후 한 번**
 * 날아오고 다시 오지 않는다. 스플래시 화면 모듈에서 듣고 있으면 그 화면을 건너뛴
 * 사람(=이미 로그인된 재방문자)은 영영 못 잡는다. main.js 가 가장 먼저 부르는
 * 이 파일에서 잡아 두고, 화면은 필요할 때 꺼내 쓴다.
 */

/** 빌드마다 달라지는 값 — vite.config.js 의 define 에서 주입한다 */
const BUILD = typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : 'dev';

const isBrowser = typeof window !== 'undefined' && typeof navigator !== 'undefined';

export const isIos = () => isBrowser && /iphone|ipad|ipod/i.test(navigator.userAgent);

/** 홈 화면에서 실행 중인가 (안드로이드 display-mode / iOS 전용 플래그) */
export const isStandalone = () =>
  isBrowser &&
  (window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true);

// ── 설치 프롬프트 ────────────────────────────────────────────
let deferred = null;
let installed = false;
const listeners = new Set();
const emit = () => listeners.forEach((f) => { try { f(); } catch { /* 화면 하나가 죽어도 나머지는 산다 */ } });

/** 설치 가능 여부가 바뀌면 알려 준다. 반환값을 부르면 구독이 끊긴다 */
export function onInstallChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** 지금 이 브라우저에서 '설치' 버튼을 눌러 볼 수 있나 */
export const canInstall = () => !!deferred || (isIos() && !isStandalone() && !installed);

/**
 * 설치를 띄운다.
 * @returns {Promise<'accepted'|'dismissed'|'ios'|'unavailable'>}
 *   'ios' 는 프롬프트가 없는 사파리 — 화면이 안내 문구를 대신 띄워야 한다는 뜻이다.
 */
export async function promptInstall() {
  if (!deferred) return isIos() ? 'ios' : 'unavailable';
  const e = deferred;
  deferred = null; // 한 번 쓴 이벤트는 재사용할 수 없다
  emit();
  try {
    e.prompt();
    const { outcome } = await e.userChoice;
    return outcome;
  } catch {
    return 'dismissed';
  }
}

if (isBrowser) {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // 기본 배너를 막고 우리 버튼으로 넘긴다
    deferred = e;
    emit();
  });
  window.addEventListener('appinstalled', () => {
    installed = true;
    deferred = null;
    emit();
  });
}

// ── 서비스 워커 ──────────────────────────────────────────────

/** 30분에 한 번만 갱신을 확인한다 — 탭을 오래 켜 두는 사람 때문에 */
const UPDATE_EVERY = 30 * 60 * 1000;
let lastCheck = 0;

/**
 * **첫 방문에 이미 받아 버린 것들**을 워커에게 알려 준다.
 *
 * 워커가 통제를 잡기 전에 브라우저가 먼저 내려받은 파일은 캐시에 안 들어간다.
 * 특히 파이어베이스 청크(로그인하자마자 부른다)가 그렇다. 그대로 두면 두 번째
 * 방문까지는 오프라인이 반쪽짜리다. 받은 목록은 Performance API 가 갖고 있으니
 * 그걸 넘겨서 빠진 것만 담게 한다.
 */
function warmCache() {
  const send = () => {
    const sw = navigator.serviceWorker.controller;
    if (!sw) return;
    const urls = performance
      .getEntriesByType('resource')
      .map((e) => e.name)
      .filter((n) => n.startsWith(location.origin) && /\/(assets|icons)\//.test(n));
    if (urls.length) sw.postMessage({ type: 'warm', urls });
  };
  navigator.serviceWorker.ready
    .then(() => {
      if (navigator.serviceWorker.controller) send();
      else navigator.serviceWorker.addEventListener('controllerchange', send, { once: true });
    })
    .catch(() => {});
}

/**
 * 서비스 워커를 등록한다. **개발 서버에서는 등록하지 않는다** —
 * 캐시가 HMR 을 먹어서 고친 코드가 안 나온다. 예전에 실수로 켠 적이 있으면
 * 그 등록이 브라우저에 남아 있으므로 개발 모드에서는 오히려 지워 준다.
 */
export function initPwa() {
  if (!isBrowser || !('serviceWorker' in navigator)) return;

  if (!import.meta.env.PROD) {
    navigator.serviceWorker.getRegistrations?.().then((rs) => rs.forEach((r) => r.unregister()));
    return;
  }

  const register = () => {
    navigator.serviceWorker
      // 빌드 ID 를 붙여야 배포할 때마다 새 워커로 인식된다 (public/sw.js 주석)
      .register(`/sw.js?v=${BUILD}`, { scope: '/', updateViaCache: 'none' })
      .then((reg) => {
        lastCheck = Date.now();
        warmCache();
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState !== 'visible') return;
          if (Date.now() - lastCheck < UPDATE_EVERY) return;
          lastCheck = Date.now();
          reg.update().catch(() => {});
        });
      })
      .catch((e) => console.warn('[pwa] 서비스 워커 등록 실패 — 오프라인 없이 계속합니다', e));
  };

  // 첫 화면 그리는 대역폭을 뺏지 않는다
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });

  /**
   * 배포 직후, 열어 둔 옛 화면이 그제서야 청크를 받으러 가면 그 파일은 새 배포에 없다
   * (멀티·파이어베이스처럼 나중에 불러오는 덩어리들). 그럴 때 **한 번만** 새로고침해서
   * 새 판으로 갈아탄다. 서비스 워커가 옛 청크를 들고 있으면 여기까지 오지도 않는다.
   */
  window.addEventListener('vite:preloadError', () => {
    try {
      // 무한 새로고침만은 막는다 — 그건 고장보다 나쁘다
      if (sessionStorage.getItem('sf_reloaded') === BUILD) return;
      sessionStorage.setItem('sf_reloaded', BUILD);
    } catch { return; } // 저장이 막힌 브라우저면 아예 손대지 않는다
    location.reload();
  });
}
