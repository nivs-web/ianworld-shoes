import { chromium } from 'playwright';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
for (const [w,h] of [[390,844],[844,390],[1280,720]]) {
const p = await (await b.newContext({ viewport: { width: w, height: h } })).newPage();
await p.goto('http://127.0.0.1:5397/tools/_pwmock/index.html?cl=94&seen=1&gifts=done&coins=99999'); await sleep(2500);
await p.evaluate(() => [...document.querySelectorAll('button')].find((y) => y.offsetParent && y.textContent.includes('아이템샵'))?.click()); await sleep(1200);
await p.evaluate(() => [...document.querySelectorAll('.idg-shop-big .idg-k-tab')].find((x) => x.textContent.includes('특가'))?.click()); await sleep(800);
console.log(w, await p.evaluate(() => { const e = document.querySelector('.idg-shop-help .idg-k-paper, .idg-k-paper'); const t = [...document.querySelectorAll('.idg-k-paper')].find((x) => x.textContent.includes('오늘의 특가')); const c = t && getComputedStyle(t); return c && [c.fontSize, c.fontWeight, c.lineHeight, c.letterSpacing]; }));
await p.context().close(); }
await b.close();
