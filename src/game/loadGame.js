/**
 * 인게임 코드를 **필요할 때** 받는다. (2026-08-19 13차, 속도)
 *
 * ## 왜 나눴나 — 재 보고 알았다
 *
 * `npm run build` 의 청크를 갈라 재 보니 `src/game/**` 이 **158KB(gzip 49KB)** 였다.
 * 나머지 전부(화면·서비스·설정)를 합쳐도 19KB gzip 이다 — 즉 **부팅에 필요한 자바스크립트의
 * 3/4 가 아직 시작하지도 않은 게임 코드**였다. 계단·신발 130종·배경 44종·멀티 HUD 가
 * 전부 여기 딸려 있다.
 *
 * 첫 화면(로비)에는 그중 한 줄도 필요 없다. 그래서 동적으로 받고, **한가할 때 미리**
 * 받아 둔다(`prefetchGame`) — 버튼을 누를 때는 이미 손에 있다.
 *
 * ## 한 번만 받는다
 *
 * 프라미스를 기억해 둔다. 두 번째부터는 모듈 캐시라 `await` 가 마이크로태스크 하나다 —
 * '다시하기'가 느려지지 않는다.
 */

/** @type {Promise<typeof import('./GameScene.js')>|null} */
let loading = null;

export function loadGameModule() {
  if (!loading) loading = import('./GameScene.js');
  return loading;
}

/** 이미 받아 뒀나 (검사·진단용) */
export const gameLoaded = () => !!loading;

/**
 * 한가한 틈에 미리 받아 둔다. 부팅 직후에 부르면 첫 화면과 회선을 다투므로
 * **반드시 `requestIdleCallback`** 을 거친다 (없는 브라우저는 타이머).
 */
export function prefetchGame(timeout = 2500) {
  const go = () => { loadGameModule().catch(() => { loading = null; }); };
  if (typeof requestIdleCallback === 'function') requestIdleCallback(go, { timeout });
  else setTimeout(go, timeout);
}
