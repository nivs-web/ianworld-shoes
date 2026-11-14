import { chromium } from 'playwright';
const OUT = 'C:/Users/ARIANC~1/AppData/Local/Temp/claude/C--Users-ariancepc-Desktop-cowork-iandragon/5339b06b-10e0-463d-b750-5be29792c438/scratchpad/shots_ca/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch({ channel: 'chrome' });
const p = await (await b.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2 })).newPage();
const errs = []; p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
await p.goto('http://127.0.0.1:5391/tools/_pwmock/index.html?cl=94&seen=1&gifts=done'); await sleep(2500);
await p.evaluate(() => [...document.querySelectorAll('button')].filter((y) => y.textContent.replace(/\s/g, '').startsWith('모험시작')).pop()?.click());
await p.waitForFunction(() => window.__idgBattle?.S, null, { timeout: 60000 }); await sleep(2000);
await p.evaluate(() => [...document.querySelectorAll('button')].filter((y) => y.textContent.trim().startsWith('출격!')).pop()?.click()); await sleep(1500);
for (const [nm, act, wait] of [['peek-roar', 'rage', 400]]) {
  await p.evaluate(() => { const B = window.__idgBattle; B.view.setCam(500); const P = B.S.players[0]; P.breathT = P.breathCharge; P.rage = 9999; });
  await sleep(300);
  await p.evaluate((a) => { const B = window.__idgBattle; if (a === 'breath') document.querySelector('.idg-breath')?.click(); else { const r = document.querySelector('.idg-rage'); r?.click(); } }, act);
  await sleep(wait); await p.evaluate(() => window.__idgBattle.view.setCam(500));
  await p.screenshot({ path: OUT + nm + '.png' });
  await sleep(2500);
}
console.log(errs);
await b.close();
