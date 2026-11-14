import { chromium } from 'playwright';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
const p = await (await b.newContext({ viewport: { width: 844, height: 390 } })).newPage();
await p.goto('http://127.0.0.1:5397/tools/_pwmock/index.html?cl=94&seen=1&gifts=done&coins=99999'); await sleep(2500);
await p.evaluate(() => [...document.querySelectorAll('button')].find((y) => y.offsetParent && y.textContent.includes('아이템샵'))?.click()); await sleep(1200);
for (const t of ['드래곤', '편의품']) { await p.evaluate((t) => [...document.querySelectorAll('.idg-shop-big .idg-k-tab')].find((x) => x.textContent.trim() === t)?.click(), t); await sleep(600);
console.log(t, await p.evaluate(() => ['.dialog.idg-shop', '.idg-shop-wrap', '.idg-shop-main', '.idg-shop-big', '.idg-shop-scroll', '.idg-shop-side'].map((s) => s + ':' + Math.round(document.querySelector(s)?.getBoundingClientRect().width)).join(' '))); }
await b.close();
