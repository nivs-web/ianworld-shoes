import { chromium } from 'playwright';
const OUT = 'C:/Users/ARIANC~1/AppData/Local/Temp/claude/C--Users-ariancepc-Desktop-cowork-iandragon/5339b06b-10e0-463d-b750-5be29792c438/scratchpad/shots_ca/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch({ channel: 'chrome' });
for (const [w, hh] of [[800, 345], [740, 330], [844, 390]]) {
  const p = await (await b.newContext({ viewport: { width: w, height: hh }, deviceScaleFactor: 2 })).newPage();
  await p.goto('http://127.0.0.1:5391/tools/_pwmock/index.html?cl=44&seen=1&gifts=done'); await sleep(3000);
  const tap = (t) => p.evaluate((t) => { const x = [...document.querySelectorAll('button')].filter((y) => y.textContent.replace(/\s/g, '').startsWith(t)).pop(); x?.click(); return !!x; }, t);
  await tap('모험시작'); await p.waitForFunction(() => window.__idgBattle?.S, null, { timeout: 60000 }); await sleep(2000);
  await tap('출격!'); await sleep(600); await p.evaluate(() => { window.__idgBattle.S.over = { winner: 1 }; }); await sleep(5500);
  await tap('파워업'); await sleep(1200); await p.screenshot({ path: OUT + `pp-${w}x${hh}.png` }); await p.context().close();
}
await b.close();
