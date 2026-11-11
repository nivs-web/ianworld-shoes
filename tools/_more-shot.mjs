/* 로비 «더보기» · «음향 설정» 창 캡처 (폰) */
import { chromium } from 'playwright';
const OUT = process.argv[2];
const b = await chromium.launch({ channel: 'chrome' }); const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
await p.goto('http://127.0.0.1:5320/tools/idg-gallery/lobby.html'); await new Promise((r) => setTimeout(r, 2500));
const click = (t) => p.evaluate((t) => [...document.querySelectorAll('button')].find((x) => x.textContent.includes(t))?.click(), t);
await click('더보기'); await new Promise((r) => setTimeout(r, 500)); await p.screenshot({ path: OUT + '/more.png' });
await click('음향 설정'); await new Promise((r) => setTimeout(r, 500)); await p.screenshot({ path: OUT + '/soundset.png' });
console.log('오류', errs.length, errs.slice(0, 2).join(' | '));
await b.close();
