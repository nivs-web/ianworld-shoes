import { chromium } from 'playwright';
const [query, winner] = process.argv.slice(2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch({ channel: 'chrome' });
const p = await (await b.newContext({ viewport: { width: 844, height: 390 } })).newPage();
const errs = []; p.on('pageerror', (e) => errs.push(String(e.stack || e).slice(0, 300)));
await p.goto(`http://127.0.0.1:5391/tools/_pwmock/index.html?${query}`); await sleep(2500);
const click = (t) => p.evaluate((t) => { const bs = [...document.querySelectorAll('button')].filter((y) => y.textContent.trim().startsWith(t)); const x = bs[bs.length - 1]; x?.click(); return !!x; }, t);
const idg = () => p.evaluate(() => { const i = JSON.parse(localStorage.getItem('sf_profile')).idg; return { lossRun: i.lossRun, lossAt: i.lossAt, bpUp: i.bpUp }; });
await click('모험시작'); await p.waitForFunction(() => window.__idgBattle?.S, null, { timeout: 60000 }); await sleep(2000);
await click('출격!'); await sleep(300);
if (winner === 'exit') { await click('나가기'); await sleep(500); } else { await p.evaluate((w) => { window.__idgBattle.S.over = { winner: +w }; }, winner); await sleep(5500); }
console.log(winner, await idg(), errs);
await b.close();
