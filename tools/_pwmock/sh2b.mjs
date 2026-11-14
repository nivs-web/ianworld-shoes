import { chromium } from 'playwright';
const OUT = 'C:/Users/ARIANC~1/AppData/Local/Temp/claude/C--Users-ariancepc-Desktop-cowork-iandragon/5339b06b-10e0-463d-b750-5be29792c438/scratchpad/shots_ga/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
const p = await (await b.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2 })).newPage();
await p.goto('http://127.0.0.1:5398/tools/_pwmock/index.html?cl=94&seen=1&gifts=done&coins=99999'); await sleep(2500);
await p.evaluate(() => [...document.querySelectorAll('button')].find((y) => y.offsetParent && y.textContent.includes('아이템샵'))?.click()); await sleep(1200);
for (const t of ['편의품', '특가']) { await p.evaluate((t) => [...document.querySelectorAll('.idg-shop-big .idg-k-tab')].find((x) => x.textContent.includes(t))?.click(), t); await sleep(700); await p.screenshot({ path: OUT + `S2old-${t}.png` }); }
await b.close();
