import { chromium } from 'playwright';
const b = await chromium.launch({ channel: 'chrome' });
const p = await (await b.newContext({ viewport: { width: 844, height: 390 } })).newPage();
await p.goto('http://127.0.0.1:5397/tools/_uimock/' + process.argv[2] + '.html'); await p.waitForTimeout(800);
console.log(await p.evaluate((s) => { const e = document.querySelector(s); const c = getComputedStyle(e); const r = e.getBoundingClientRect(); return { w: r.width, h: r.height, bg: c.backgroundColor, cls: e.className, html: e.outerHTML.slice(0, 120) }; }, process.argv[3]));
await b.close();
