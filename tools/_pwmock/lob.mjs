import { chromium } from 'playwright';
const OUT = 'C:/Users/ARIANC~1/AppData/Local/Temp/claude/C--Users-ariancepc-Desktop-cowork-iandragon/5339b06b-10e0-463d-b750-5be29792c438/scratchpad/shots_ca/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch({ channel: 'chrome' });
const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
const errs = []; p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
await p.goto('http://127.0.0.1:5391/tools/_pwmock/index.html?cl=44&seen=1&gifts=done&coins=99999&gems=999'); await sleep(3000);
const tap = (t) => p.evaluate((t) => { const x = [...document.querySelectorAll('button')].filter((y) => y.textContent.replace(/\s/g, '').startsWith(t)).pop(); x?.click(); return !!x; }, t);
const close = () => p.evaluate(() => { const x = [...document.querySelectorAll('.idg-k-close, .dialog-overlay')].pop(); x?.click(); });
for (const t of ['연구소', '도감', '더보기', '스테이지', '아이템샵', '꾸미기']) { console.log(t, await tap(t)); await sleep(1200); await p.screenshot({ path: OUT + `lob-${t}.png` }); await close(); await sleep(600); await p.keyboard.press('Escape'); await sleep(400); }
console.log(errs); await b.close();
