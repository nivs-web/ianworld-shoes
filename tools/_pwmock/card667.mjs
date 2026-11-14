import { chromium } from 'playwright';
const OUT = 'C:/Users/ARIANC~1/AppData/Local/Temp/claude/C--Users-ariancepc-Desktop-cowork-iandragon/5339b06b-10e0-463d-b750-5be29792c438/scratchpad/shots_ca/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch({ channel: 'chrome' });
for (const [q, nm, w, h] of [['cl=0&seen=1&gifts=done', 'c11-667', 667, 375], ['cl=94&seen=1&gifts=done&diff=hard&lr=hard:95=3&bp=hard:95:1', 'chard-667', 667, 375]]) {
  const p = await (await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2 })).newPage(); const errs = []; p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
  await p.goto(`http://127.0.0.1:5391/tools/_pwmock/index.html?${q}`); await sleep(2500);
  await p.evaluate(() => [...document.querySelectorAll('button')].filter((y) => y.textContent.replace(/\s/g, '').startsWith('모험시작')).pop()?.click());
  await p.waitForFunction(() => window.__idgBattle?.S, null, { timeout: 60000 }).catch(() => console.log('no battle')); await sleep(2500);
  await p.screenshot({ path: OUT + nm + '.png' }); console.log(nm, errs); await p.context().close();
}
await b.close();
