import { chromium } from 'playwright';
const OUT = 'C:/Users/ARIANC~1/AppData/Local/Temp/claude/C--Users-ariancepc-Desktop-cowork-iandragon/5339b06b-10e0-463d-b750-5be29792c438/scratchpad/shots_ga/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
for (const [w,h] of [[844,390],[1280,720],[390,844]]) {
const p = await (await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 })).newPage();
await p.goto('http://127.0.0.1:5397/tools/_pwmock/index.html?cl=94&seen=1&gifts=done&coins=99999'); await sleep(2500);
await p.evaluate(() => [...document.querySelectorAll('button')].find((y) => y.offsetParent && y.textContent.includes('좀비습격'))?.click()); await sleep(2500);
console.log(w, await p.evaluate(() => { const g = (s) => { const e = document.querySelector(s); return e && parseFloat(getComputedStyle(e).fontSize).toFixed(1); }; return { line: g('.idg-int-line span'), goal: g('.idg-int-goal'), best: g('.idg-int-best'), card: !!document.querySelector('.idg-int') }; }));
await p.screenshot({ path: OUT + `R-${w}.png` }); await p.context().close(); }
await b.close();
