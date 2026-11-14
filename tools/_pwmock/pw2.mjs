import { chromium } from 'playwright';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch({ channel: 'chrome' });
const p = await (await b.newContext({ viewport: { width: 844, height: 390 } })).newPage();
const tap = (t, sel = 'button') => p.evaluate(([t, sel]) => { const x = [...document.querySelectorAll(sel)].filter((y) => y.textContent.replace(/\s/g, '').startsWith(t) && y.offsetParent).pop(); x?.click(); return !!x; }, [t, sel]);
await p.goto('http://127.0.0.1:5391/tools/_pwmock/index.html?cl=44&seen=1&gifts=done'); await sleep(3000);
await tap('모험시작'); await p.waitForFunction(() => window.__idgBattle?.S, null, { timeout: 60000 }); await sleep(2000);
await tap('출격!'); await sleep(800); await p.keyboard.press('KeyP'); await sleep(800);
for (const t of ['음향', '화면', '키보드']) { await tap(t, '.idg-pause-tab'); await sleep(700); console.log(t, await p.evaluate(() => { const c = document.querySelector('.idg-pause-card'); const cs = getComputedStyle(c); return [c.getBoundingClientRect().width, cs.width, cs.minWidth, cs.maxWidth, cs.boxSizing, c.parentElement.className, getComputedStyle(c.parentElement).display]; })); }
await b.close();
