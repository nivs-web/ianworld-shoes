import { chromium } from 'playwright';
const OUT = 'C:/Users/ARIANC~1/AppData/Local/Temp/claude/C--Users-ariancepc-Desktop-cowork-iandragon/5339b06b-10e0-463d-b750-5be29792c438/scratchpad/shots_ga/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
for (const [w,h,t] of [[844,390,'L'],[390,844,'P'],[970,645,'D']]) {
const p = await (await b.newContext({ viewport: { width: w, height: h } })).newPage();
p.on('pageerror', (e) => console.log('ERR', String(e).slice(0, 150)));
await p.goto('http://127.0.0.1:5397/tools/_pwmock/index.html?cl=94&seen=1&gifts=done&coins=99999'); await sleep(2500);
await p.evaluate(() => [...document.querySelectorAll('button')].find((y) => y.offsetParent && y.textContent.includes('아이템샵'))?.click()); await sleep(1200);
await p.screenshot({ path: OUT + `SW-${t}-shop.png` });
await p.evaluate(() => document.querySelector('.idg-title-sw')?.click()); await sleep(1500);
console.log(t, await p.evaluate(() => [document.querySelector('.dialog .idg-how-title')?.textContent, document.querySelectorAll('.dialog').length]));
await p.screenshot({ path: OUT + `SW-${t}-look.png` });
await p.evaluate(() => document.querySelector('.idg-title-sw')?.click()); await sleep(1500);
console.log(t, 'back', await p.evaluate(() => [document.querySelector('.dialog .idg-how-title')?.textContent, document.querySelectorAll('.dialog').length]));
await p.context().close(); }
await b.close();
