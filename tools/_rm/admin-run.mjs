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
await page.waitForTimeout(2500);
const txt = (k) => fr(k).evaluate(() => document.getElementById('ui').innerText);
const ok = (l, v) => console.log(`${v ? 'ok  ' : 'FAIL'} ${l}`);
ok('운영자 A 의 설정에 «통계»', (await txt('A')).includes('통계'));
ok('손님 B 의 설정에는 «통계» 없음', !(await txt('B')).includes('통계'));
await fr('A').evaluate(() => [...document.querySelectorAll('#ui button')].find((b) => b.innerText.trim() === '통계').click());
await page.waitForTimeout(2500);
const a = await txt('A');
console.log(a.split('\n').slice(0, 14).join(' | '));
ok('통계: 오늘 접속자 2명', /오늘 접속자\s+2명/.test(a));
ok('통계: 지금 동시접속 2명', /지금 동시접속\s+2명/.test(a));
await page.screenshot({ path: join(HERE, '../_out/admin-stats.png') });
console.log('오류:', errors.length ? errors.join(' || ') : '없음');
await browser.close(); await server.close(); process.exit(0);
