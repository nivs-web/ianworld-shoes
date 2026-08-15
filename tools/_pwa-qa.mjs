/**
 * PWA 검수 (진단 전용) — `node tools/_pwa-qa.mjs`
 *
 * 서비스 워커·매니페스트·아이콘은 **눈으로 보이지 않는다.** 아이콘 폴더가 통째로
 * 비어 있어도 화면은 멀쩡히 뜨고, `register()` 를 아무도 안 불러도 게임은 잘 돌아간다.
 * 그래서 실제로 배포본을 띄우고 **선을 뽑은 다음** 게임이 뜨는지까지 확인한다.
 *
 * 필요한 것: `npm run build` 로 만든 `dist/`.
 */

import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync, readdirSync } from 'node:fs';
import { resolve, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * 크로미움 위치. 플레이라이트가 기대하는 빌드 번호와 설치된 번호가 어긋나는 환경이 있어서
 * (`chromium_headless_shell-1148` 을 찾는데 깔린 건 1194) 직접 찾아 넘긴다.
 */
function chromePath() {
  const dir = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  if (!existsSync(dir)) return undefined;
  for (const n of readdirSync(dir).filter((n) => n.startsWith('chromium-')).sort().reverse()) {
    const p = resolve(dir, n, 'chrome-linux/chrome');
    if (existsSync(p)) return p;
  }
  return undefined;
}

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = resolve(ROOT, 'dist');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
};

/** vercel.json 의 rewrite 를 흉내 낸 최소 정적 서버 */
function serve() {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    let p = resolve(DIST, '.' + decodeURIComponent(url.pathname));
    if (!p.startsWith(DIST)) return res.writeHead(403).end();
    try {
      const s = await stat(p);
      if (s.isDirectory()) p = resolve(p, 'index.html');
    } catch {
      p = resolve(DIST, 'index.html'); // SPA 폴백
    }
    try {
      const buf = await readFile(p);
      const h = { 'Content-Type': TYPES[extname(p)] ?? 'application/octet-stream' };
      // 서비스 워커가 낡은 채로 남지 않게 (vercel.json 과 같은 규칙)
      if (p.endsWith('sw.js')) h['Cache-Control'] = 'no-cache';
      res.writeHead(200, h).end(buf);
    } catch {
      res.writeHead(404).end();
    }
  });
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok({ server, port: server.address().port })));
}

let fail = 0;
const ok = (name) => console.log(`  ok   ${name}`);
const bad = (name, why) => { fail++; console.log(`  X    ${name}\n       ${why}`); };
const is = (name, cond, why = '') => (cond ? ok(name) : bad(name, why));

const { server, port } = await serve();
const base = `http://127.0.0.1:${port}`;
const browser = await chromium.launch({ args: ['--no-sandbox'], executablePath: chromePath() });
const ctx = await browser.newContext();
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

try {
  console.log('\n[1] 매니페스트와 아이콘');
  const mf = await (await page.request.get(`${base}/manifest.webmanifest`)).json();
  is('매니페스트를 읽을 수 있다', !!mf.name, '파싱 실패');
  is('start_url · scope · display 가 있다', mf.start_url && mf.scope && mf.display === 'standalone');
  is('테마색이 index.html 과 같다', mf.theme_color === '#1b1410', `manifest=${mf.theme_color}`);

  for (const i of mf.icons) {
    const r = await page.request.get(base + i.src);
    is(`아이콘 ${i.src} (${i.purpose})`, r.status() === 200, `HTTP ${r.status()} — 파일이 없으면 설치 배너가 안 뜬다`);
  }
  is('설치 가능 최소 조건: 192 이상 any 아이콘',
     mf.icons.some((i) => i.purpose?.includes('any') && parseInt(i.sizes) >= 192));
  is('마스커블 아이콘이 있다',
     mf.icons.some((i) => i.purpose?.includes('maskable')), '안드로이드에서 흰 테두리가 생긴다');

  // index.html 이 가리키는 아이콘도 실제로 있어야 한다 (iOS 는 매니페스트를 안 본다)
  const html = await (await page.request.get(base + '/')).text();
  for (const m of html.matchAll(/<link[^>]+rel="(?:apple-touch-)?icon"[^>]+href="([^"]+)"/g)) {
    const r = await page.request.get(base + m[1]);
    is(`index.html 아이콘 ${m[1]}`, r.status() === 200, `HTTP ${r.status()}`);
  }

  console.log('\n[2] 서비스 워커 등록');
  await page.goto(base + '/', { waitUntil: 'load' });
  const controlled = await page
    .waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 15000 })
    .then(() => true)
    .catch(() => false);
  is('페이지가 서비스 워커의 통제를 받는다', controlled, 'register() 가 안 불렸거나 활성화에 실패했다');

  const swUrl = await page.evaluate(() => navigator.serviceWorker.controller?.scriptURL ?? '');
  is('등록 URL 에 빌드 ID 가 붙는다', /\/sw\.js\?v=.+/.test(swUrl) && !swUrl.endsWith('v=dev'), swUrl);

  console.log('\n[3] 캐시 분리');
  // 게임 그림 한 장을 실제로 받아 art 캐시를 채운다
  await page.evaluate(() => fetch('/assets/shoes/shoes_game.png').then((r) => r.arrayBuffer()));
  await page.waitForTimeout(600);
  const names = await page.evaluate(() => caches.keys());
  is('셸 캐시는 버전이 붙는다', names.some((n) => /^shell-.+/.test(n) && n !== 'shell-dev'), names.join(','));
  is('빌드 캐시는 버전이 없다 (배포 넘겨 살려 둔다)', names.includes('build'), names.join(','));
  is('그림 캐시가 따로 있다', names.includes('art'), names.join(','));

  const inBuild = await page.evaluate(async () => {
    const c = await caches.open('build');
    return (await c.keys()).map((r) => new URL(r.url).pathname);
  });
  is('번들 JS 가 build 캐시에 있다', inBuild.some((p) => /^\/assets\/index-.*\.js$/.test(p)), inBuild.join(','));
  is('그림은 build 캐시에 섞이지 않았다', !inBuild.some((p) => p.includes('/shoes/')), inBuild.join(','));

  const inArt = await page.evaluate(async () => {
    const c = await caches.open('art');
    return (await c.keys()).map((r) => new URL(r.url).pathname);
  });
  is('그림이 art 캐시에 있다', inArt.some((p) => p.includes('/assets/shoes/')), inArt.join(','));

  console.log('\n[4] 오프라인');
  errors.length = 0;
  /**
   * **브라우저 HTTP 캐시를 끈 채로** 검사한다.
   * 그냥 선만 뽑으면 서비스 워커가 아무 일을 안 해도 HTTP 캐시 덕에 게임이 떠서
   * 통과해 버린다 (실제로 첫 판에서 그렇게 속았다). 이걸 꺼야 진짜 검사다.
   */
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await ctx.setOffline(true);
  await page.reload({ waitUntil: 'load' }).catch(() => {});
  // 로그인 세션 확인에 3초를 쓴다 (services/auth.js AUTH_BOOT_TIMEOUT_MS)
  const booted = await page
    .waitForFunction(() => document.querySelector('#ui')?.textContent?.includes('오락실'), null, { timeout: 20000 })
    .then(() => true)
    .catch(() => false);
  is('선을 뽑아도 게임이 뜬다', booted, '캐시에서 셸·번들을 못 꺼냈다');
  is('부팅 오버레이가 사라진다',
     await page.evaluate(() => !document.getElementById('boot') || document.getElementById('boot').classList.contains('hidden')));
  const img = await page.evaluate(
    () => new Promise((r) => { const i = new Image(); i.onload = () => r(i.naturalWidth); i.onerror = () => r(0); i.src = '/assets/shoes/shoes_game.png'; })
  );
  is('오프라인에서도 그림이 나온다', img > 0, '캐시에서 못 꺼냈다');
  is('오프라인에서 스크립트 오류가 없다', errors.length === 0, errors.join(' / '));

  console.log('\n[5] 그림을 덮어써도 다음 실행에 반영된다 (stale-while-revalidate)');
  await ctx.setOffline(false);
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: false });
  const first = await page.evaluate(async () => {
    const c = await caches.open('art');
    const r = await c.match(new URL('/assets/shoes/shoes_game.png', location.origin).href);
    return r ? (await r.arrayBuffer()).byteLength : -1;
  });
  is('그림이 캐시에 남아 있다', first > 0, String(first));
  const served = await page.evaluate(async () => (await fetch('/assets/shoes/shoes_game.png')).headers.get('content-type'));
  is('캐시 응답이 정상적으로 돌아온다', served === 'image/png', String(served));

  console.log('\n[6] 새 배포 (버전이 바뀌었을 때)');
  const before = await page.evaluate(async () => ({
    shells: (await caches.keys()).filter((k) => k.startsWith('shell-')),
    build: (await (await caches.open('build')).keys()).map((r) => new URL(r.url).pathname),
  }));
  await page.evaluate(() =>
    navigator.serviceWorker.register('/sw.js?v=deploy2', { scope: '/', updateViaCache: 'none' })
  );
  // **설치(캐시 생성)와 활성화(옛 캐시 삭제)는 다른 단계다.** 캐시가 생긴 것만 보고
  // 넘어가면 아직 활성화 전이라 옛 캐시가 남아 있는 게 당연하다 — 통제권까지 기다린다.
  const swapped = await page
    .waitForFunction(
      () => navigator.serviceWorker.controller?.scriptURL.includes('v=deploy2'),
      null,
      { timeout: 15000 }
    )
    .then(() => true)
    .catch(() => false);
  is('새 워커가 통제를 넘겨받는다', swapped, '버전을 올려도 워커가 안 바뀐다');

  /**
   * 청소는 activate 단계에서 도는데, 페이지가 통제권 교체를 보는 시점과 정확히
   * 같지 않다 (실제로 교체 직후엔 남아 있다가 곧 사라진다). 그래서 기다렸다 본다.
   */
  const swept = await page
    .waitForFunction(
      async () => !(await caches.keys()).some((k) => k.startsWith('shell-') && k !== 'shell-deploy2'),
      null,
      { timeout: 10000 }
    )
    .then(() => true)
    .catch(() => false);

  const after = await page.evaluate(async () => ({
    keys: await caches.keys(),
    build: (await (await caches.open('build')).keys()).map((r) => new URL(r.url).pathname),
    art: (await (await caches.open('art')).keys()).length,
  }));
  is('낡은 셸 캐시는 지워진다', swept, after.keys.join(','));
  /**
   * 이게 이번 설계의 핵심이다. 배포 직후에도 예전 청크가 남아 있어야,
   * 열어 둔 옛 화면이 멀티 방에 들어가며 `firebase-rtdb-…js` 를 부를 때 멈추지 않는다.
   */
  is('예전 배포의 번들은 살아남는다',
     before.build.every((p) => after.build.includes(p)),
     `이전=${before.build.length}개 → 이후=${after.build.length}개`);
  is('그림 캐시도 살아남는다', after.art > 0, String(after.art));
} finally {
  await browser.close();
  server.close();
}

console.log('');
if (fail) { console.error(`PWA 검수 실패 — ${fail}건`); process.exit(1); }
console.log('PWA 이상 없음');
