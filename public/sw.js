/**
 * 서비스 워커 — 오프라인 셸 + 에셋 캐시.
 *
 * ## 캐시를 셋으로 나눈 이유
 *
 * 예전엔 `/assets/` 아래를 전부 한 덩어리로 캐시 우선 처리했다. 그런데 그 폴더에는
 * 성격이 정반대인 두 가지가 섞여 있다:
 *
 *   - `assets/index-a1b2c3.js` — **내용이 바뀌면 이름이 바뀐다.** 영원히 캐시해도 안전하고,
 *     오히려 지우면 안 된다. 배포 직후 예전 화면이 열려 있는 사람이 멀티 화면에 들어가면
 *     그때서야 `firebase-rtdb-…js` 를 받으러 가는데, 그 파일은 새 배포에 없다.
 *     지워 버렸다면 게임이 그 자리에서 멈춘다. 그래서 **버전을 안 붙인 캐시**에 쌓아 둔다.
 *   - `assets/shoes/shoes_game.png` — **이름은 그대로인 채 내용만 바뀐다.** (도트를 직접
 *     고쳐서 덮어쓰는 일이 잦다.) 캐시 우선으로 두면 새 그림이 영영 안 보인다.
 *     그래서 **먼저 캐시로 그리고 뒤에서 조용히 새로 받아 둔다** (stale-while-revalidate).
 *     다음 실행부터 새 그림이 뜬다 — 화면은 안 느려지고 그림은 안 굳는다.
 *
 * vercel.json 의 Cache-Control 규칙과 정확히 같은 경계다. 한쪽만 고치면 어긋난다.
 *
 * ## 버전
 *
 * 예전엔 `VERSION = 'v1'` 이 코드에 박혀 있어서 **배포를 해도 영원히 v1** 이었다.
 * 낡은 셸이 지워질 일이 없다는 뜻이다. 지금은 등록할 때 `sw.js?v=<빌드ID>` 로 붙여 주고
 * 여기서 그 값을 읽는다 (services/pwa.js).
 */

const V = new URL(self.location.href).searchParams.get('v') || 'dev';

const SHELL = `shell-${V}`; // 배포마다 새로 — HTML은 낡으면 안 된다
const BUILD = 'build'; // 이름에 해시가 붙는 것들 — 배포를 넘겨 살려 둔다
const ART = 'art'; // 이름이 고정된 그림 — 조용히 갱신한다
const KEEP = new Set([SHELL, BUILD, ART]);

const SHELL_FILES = ['/', '/index.html', '/manifest.webmanifest'];

/** 이름 고정 에셋 — 도트를 덮어쓰면 내용만 바뀐다 */
const IS_ART = (p) => /^\/(assets\/(characters|shoes|bg|ui)\/|icons\/)/.test(p);
/** 번들 산출물 — 내용이 바뀌면 파일 이름이 바뀐다 */
const IS_BUILD = (p) => p.startsWith('/assets/');

/** 캐시가 무한정 자라지 않게 오래된 것부터 덜어 낸다 (keys() 는 넣은 순서다) */
async function trim(name, max) {
  const c = await caches.open(name);
  const keys = await c.keys();
  if (keys.length <= max) return;
  await Promise.all(keys.slice(0, keys.length - max).map((k) => c.delete(k)));
}

/**
 * 첫 방문의 JS·CSS 는 **서비스 워커를 거치지 않는다.**
 * 워커가 설치되기 전에 브라우저가 이미 다 받아 버렸기 때문이다. 그래서 가만히 두면
 * "설치는 됐는데 캐시에는 아무것도 없는" 상태가 되고, 선을 뽑으면 브라우저 HTTP 캐시가
 * 살아 있을 때만 우연히 뜬다. index.html 을 한 번 읽어 거기 적힌 번들을 직접 담아 둔다.
 */
async function precacheBuild() {
  try {
    const c = await caches.open(BUILD);
    const html = await (await fetch('/index.html', { cache: 'no-cache' })).text();
    const urls = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+\.(?:js|css))"/g)].map((m) => m[1]);
    await Promise.all(urls.map(async (u) => ((await c.match(u)) ? null : c.add(u).catch(() => {}))));
  } catch { /* 다음 실행에 runtime 캐시가 채운다 */ }
}

self.addEventListener('install', (e) => {
  e.waitUntil(
    (async () => {
      const c = await caches.open(SHELL);
      // addAll 은 하나만 실패해도 설치 전체가 무산된다 — 한 장씩 넣고 실패는 넘긴다
      await Promise.all(SHELL_FILES.map((f) => c.add(f).catch(() => {})));
      await precacheBuild();
      await self.skipWaiting();
    })()
  );
});

/**
 * 앱이 "내가 이미 받은 것들"을 알려 주면 빠진 것만 담는다.
 * 파이어베이스 청크처럼 **나중에 불러오는 덩어리**는 index.html 에 안 적혀 있어서
 * precacheBuild 로는 안 잡힌다. 첫 방문에서 그걸 메우는 게 이 통로다. (services/pwa.js)
 */
self.addEventListener('message', (e) => {
  const d = e.data;
  if (!d || d.type !== 'warm' || !Array.isArray(d.urls)) return;
  e.waitUntil(
    (async () => {
      for (const raw of d.urls.slice(0, 300)) {
        let url;
        try { url = new URL(raw, self.location.origin); } catch { continue; }
        if (url.origin !== self.location.origin) continue;
        const name = IS_ART(url.pathname) ? ART : IS_BUILD(url.pathname) ? BUILD : null;
        if (!name) continue;
        const c = await caches.open(name);
        if (await c.match(url.href)) continue;
        await c.add(url.href).catch(() => {});
      }
    })()
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => !KEEP.has(k)).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

/** 응답이 없으면 respondWith 가 그대로 거절된다 — 마지막 방어선 */
const dead = () => new Response('', { status: 504, statusText: 'offline' });

/**
 * 캐시에 넣어도 되는 응답인가.
 * 206(부분 응답)과 리다이렉트는 `cache.put` 이 **예외를 던진다.** 그 예외가
 * 응답 경로 안에서 터지면 그림 한 장 때문에 화면 전체가 안 뜬다.
 */
const cacheable = (res) => res && res.ok && res.status !== 206 && !res.redirected;
const put = (c, k, res) => { try { return c.put(k, res).catch(() => {}); } catch { return Promise.resolve(); } };

/** 캐시 우선. 없을 때만 받아 오고, 못 받으면 조용히 실패한다 */
async function cacheFirst(req, name, max) {
  const c = await caches.open(name);
  const hit = await c.match(req);
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (cacheable(res)) {
      await put(c, req, res.clone());
      trim(name, max);
    }
    return res;
  } catch {
    return dead();
  }
}

/**
 * 캐시로 즉시 그리고, 뒤에서 새로 받아 다음을 준비한다.
 * 캐시에 없으면 어쩔 수 없이 기다린다 (첫 실행).
 */
async function staleWhileRevalidate(req, name, max, event) {
  const c = await caches.open(name);
  const hit = await c.match(req);
  const fresh = fetch(req)
    .then((res) => {
      if (cacheable(res)) put(c, req, res.clone()).then(() => trim(name, max));
      return res;
    })
    .catch(() => null);
  /**
   * ★ **뒤에서 도는 갱신을 `waitUntil` 로 붙잡아 둔다.** (2026-08-16)
   * 캐시가 맞으면 `respondWith` 가 곧바로 끝나고, 그 순간부터 브라우저는 서비스
   * 워커를 **언제든 죽일 수 있다.** 붙잡아 두지 않으면 `cache.put` 전에 워커가 죽어
   * 갱신이 유실된다 — 도트를 고쳐 배포해도 특정 그림만 옛 것으로 남는 이유가 이거다.
   */
  event?.waitUntil?.(fresh);
  if (hit) return hit; // fresh 는 백그라운드에서 계속 돈다
  return (await fresh) || dead();
}

/** 네트워크 우선 + 시간 제한. 캐시가 있으면 오래 기다릴 이유가 없다 */
async function docFirst(req) {
  const c = await caches.open(SHELL);
  const cached = (await c.match('/index.html')) || (await c.match('/'));
  try {
    const res = await Promise.race([
      fetch(req),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), cached ? 3500 : 20000)),
    ]);
    if (cacheable(res)) await put(c, '/index.html', res.clone());
    return res;
  } catch {
    return cached || offlinePage();
  }
}

/** 캐시조차 없을 때 — 브라우저 기본 오류 화면보다는 낫다 */
function offlinePage() {
  return new Response(
    '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<body style="background:#0d0a08;color:#fff4d6;font-family:sans-serif;display:grid;place-items:center;height:100vh;margin:0;text-align:center">' +
      '<div><p>오프라인입니다</p><p style="opacity:.6;font-size:14px">연결된 뒤 다시 열어 주세요</p></div>',
    { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // 파이어베이스·구글 로그인 등 바깥 요청은 절대 건드리지 않는다
  if (url.origin !== self.location.origin) return;

  const p = url.pathname;

  /**
   * ★ **드래곤 스트라이커는 제 문서다 — 앱 셸과 절대 섞지 않는다.**
   *
   * iframe 로드는 `mode === 'navigate'` 로 온다. 그대로 두면 `docFirst()` 가
   * 이 응답을 **`/index.html` 로 캐시해 버린다** — 오락실 앱 껍데기가 드래곤
   * 게임 HTML 로 바뀌어서, 다음 방문에 로비 대신 게임이 통째로 뜬다.
   * 반대로 네트워크가 느리면 iframe 안에 오락실 앱이 뜨는 무한 중첩도 된다.
   * 브라우저에 그냥 맡긴다.
   */
  if (p.startsWith('/dragon/')) return;

  if (req.mode === 'navigate') return e.respondWith(docFirst(req));
  if (IS_ART(p)) return e.respondWith(staleWhileRevalidate(req, ART, 400, e));
  if (IS_BUILD(p)) return e.respondWith(cacheFirst(req, BUILD, 120));
  if (p === '/manifest.webmanifest') return e.respondWith(staleWhileRevalidate(req, SHELL, 20, e));
  // 나머지(/sw.js 등)는 브라우저에 맡긴다
});
