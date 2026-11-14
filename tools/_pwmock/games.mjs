import { chromium } from 'playwright';
const OUT = 'C:/Users/ARIANC~1/AppData/Local/Temp/claude/C--Users-ariancepc-Desktop-cowork-iandragon/5339b06b-10e0-463d-b750-5be29792c438/scratchpad/shots_ga/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
p.on('pageerror', (e) => console.log('ERR', String(e).slice(0, 150)));
await p.goto('http://127.0.0.1:5397/'); await p.waitForFunction('window.__dbg && window.__dbg.nav', null, { timeout: 60000 });
console.log(await p.evaluate(() => Object.keys(window.__dbg.screens)));
await p.evaluate(() => window.__dbg.nav.reset(window.__dbg.screens.Portal)); await sleep(3500);
await p.screenshot({ path: OUT + 'G-portal.png' });
console.log(await p.evaluate(() => [...document.querySelectorAll('.gc img')].map((i) => i.alt)));
for (const alt of ['줄넘기 챔피언', '점프 피아노']) {
  await p.evaluate(() => window.__dbg.nav.reset(window.__dbg.screens.Portal)); await sleep(2500);
  await p.evaluate((alt) => { const i = [...document.querySelectorAll('img')].find((x) => x.alt.includes(alt.slice(0, 3))); (i?.closest('.gc')?.querySelector('button') || i)?.click(); }, alt); await sleep(3500);
  await p.screenshot({ path: OUT + `G-${alt.slice(0, 2)}-1.png` });
  console.log(alt, await p.evaluate(() => [...document.querySelectorAll('button')].filter((x) => x.offsetParent).map((x) => x.textContent.trim().slice(0, 10))));
}
await b.close();
