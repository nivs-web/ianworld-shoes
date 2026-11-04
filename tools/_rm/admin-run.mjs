/** 운영자 통계 화면 확인 — A 는 운영자(admins/A), B 는 손님. node tools/_rm/admin-run.mjs */
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { join } from 'node:path';
const HERE = import.meta.dirname;
const server = await createServer({ configFile: join(HERE, 'vite.config.mjs'), logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 830, height: 790 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto('http://127.0.0.1:5199/tools/_rm/admin.html');
const fr = (k) => page.frames().find((f) => f.url().includes(`uid=${k}`));
const t0 = Date.now();
while (Date.now() - t0 < 30000) { try { if (await fr('A').evaluate(() => window.__ready) && await fr('B').evaluate(() => window.__ready)) break; } catch {} await page.waitForTimeout(200); }
await page.waitForTimeout(5000);   // 첫 화면은 부팅 3.5초 뒤에 운영자인지 묻는다 (RTDB 를 부팅에 끼우지 않으려고)
const txt = (k) => fr(k).evaluate(() => document.getElementById('ui').innerText);
const ok = (l, v) => console.log(`${v ? 'ok  ' : 'FAIL'} ${l}`);
const hasBtn = (k, t) => fr(k).evaluate((t) => [...document.querySelectorAll('#ui button')].some((b) => b.innerText.trim() === t), t);
/* 2026-11-05: «통계» 는 오락실 첫 화면(게임 선택 카드) 아래쪽, 운영자에게만 */
ok('운영자 A 의 오락실 첫 화면에 [통계] 단추', await hasBtn('A', '통계'));
ok('손님 B 의 첫 화면에는 [통계] 단추 없음', !(await hasBtn('B', '통계')));
ok('[통계] 는 [로그아웃] 바로 위 (바로가기·전체화면 근처)', await fr('A').evaluate(() => {
  const t = [...document.querySelectorAll('#ui button')].map((b) => b.innerText.trim());
  return t.indexOf('통계') >= 0 && t.indexOf('통계') === t.indexOf('로그아웃') - 1;
}));
for (const k of ['A', 'B']) await fr(k).evaluate(() => { const u = document.getElementById('ui'); u.scrollTop = u.scrollHeight; window.scrollTo(0, document.body.scrollHeight); });
await page.waitForTimeout(400);
await page.screenshot({ path: join(HERE, '../_out/admin-portal.png') });
for (const [m, label] of [['/src/screens/Settings.js', '신발 설정'], ['/src/screens/DragonSettings.js', '드래곤 설정']]) {
  await fr('A').evaluate(async (m) => window.__rm.nav.push((await import(m)).default), m);
  await page.waitForTimeout(1500);
  ok(`${label} 에는 [통계] 없음 (한 곳으로 통일)`, !(await hasBtn('A', '통계')));
  await fr('A').evaluate(() => window.__rm.nav.back());
  await page.waitForTimeout(800);
}
await fr('A').evaluate(() => [...document.querySelectorAll('#ui button')].find((b) => b.innerText.trim() === '통계').click());
await page.waitForTimeout(2500);
const a = await txt('A');
console.log(a.split('\n').slice(0, 14).join(' | '));
ok('통계: 오늘 접속자 2명', /오늘 접속자\s+2명/.test(a));
ok('통계: 지금 동시접속 2명', /지금 동시접속\s+2명/.test(a));
await page.screenshot({ path: join(HERE, '../_out/admin-stats.png') });
console.log('오류:', errors.length ? errors.join(' || ') : '없음');
await browser.close(); await server.close(); process.exit(0);
