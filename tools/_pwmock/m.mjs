import { chromium } from 'playwright';
const [W,H]=process.argv.slice(2);
const b = await chromium.launch({ channel: 'chrome' });
const p = await (await b.newContext({ viewport: { width: +W, height: +H } })).newPage();
await p.goto('http://127.0.0.1:5391/tools/_pwmock/index.html?cl=40&seen=1&gifts=done&coins=99999999&gems=99999'); await p.waitForTimeout(2500);
await p.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.textContent.trim().startsWith('파워업'))?.click()); await p.waitForTimeout(1000);
console.log(JSON.stringify(await p.evaluate(() => { const r = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.right), Math.round(b.width)]; }; return { box: r('.idg-pp.pp2'), head: r('.idg-pp-head'), band: r('.idg-pp-head .idg-pp-band'), slots: r('.idg-pp-slots'), logo: r('.idg-pp-logo'), gridcols: getComputedStyle(document.querySelector('.idg-pp-head')).gridTemplateColumns, js: getComputedStyle(document.querySelector('.idg-pp-head .idg-pp-band')).justifySelf }; })));
await b.close();
