/* 도감 캡처 (폰) : 목록 · 자세히 · 좀비 탭 · 배경 탭 */
import { chromium } from 'playwright';
const OUT = process.argv[2];
const b = await chromium.launch({ channel: 'chrome' }); const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
await p.goto('http://127.0.0.1:5320/tools/idg-gallery/lobby.html'); await new Promise((r) => setTimeout(r, 2500));
const click = (t, sel = 'button') => p.evaluate(([t, sel]) => [...document.querySelectorAll(sel)].reverse().find((x) => x.textContent.includes(t))?.click(), [t, sel]);
await click('더보기'); await new Promise((r) => setTimeout(r, 400)); await click('도감'); await new Promise((r) => setTimeout(r, 900));
await p.screenshot({ path: OUT + '/cx-list.png' });
await p.evaluate(() => document.querySelector('.idg-cx-card:not(.off)')?.click()); await new Promise((r) => setTimeout(r, 1200));
await p.screenshot({ path: OUT + '/cx-detail.png' });
await p.evaluate(() => [...document.querySelectorAll('.idg-cx-detail button')].find((x) => x.textContent.includes('닫기'))?.click()); await new Promise((r) => setTimeout(r, 300));
await click('배경', '.idg-cx-tab'); await new Promise((r) => setTimeout(r, 600)); await p.screenshot({ path: OUT + '/cx-world.png' });
await p.evaluate(() => document.querySelector('.idg-cx-world:not(.off)')?.click()); await new Promise((r) => setTimeout(r, 900)); await p.screenshot({ path: OUT + '/cx-wview.png' });
console.log('오류', errs.length, errs.slice(0, 3).join(' | '));
await b.close();
