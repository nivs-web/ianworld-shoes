import { chromium } from 'playwright';
const OUT = 'C:/Users/ARIANC~1/AppData/Local/Temp/claude/C--Users-ariancepc-Desktop-cowork-iandragon/5339b06b-10e0-463d-b750-5be29792c438/scratchpad/shots_ga/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
for (const [w, h] of [[844, 390], [1280, 720]]) {
  const p = await (await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2 })).newPage();
  p.on('pageerror', (e) => console.log('ERR', String(e).slice(0, 150)));
  await p.goto('http://127.0.0.1:5397/tools/_pwmock/index.html?cl=94&seen=1&gifts=done&coins=99999'); await sleep(3000);
  await p.evaluate(() => [...document.querySelectorAll('button')].find((y) => y.offsetParent && y.textContent.includes('파워업'))?.click()); await sleep(1500);
  const names = () => p.evaluate(() => [...document.querySelectorAll('.idg-pp-list .idg-pp-card, .idg-pp-list > *')].slice(0, 12).map((e) => (e.querySelector('.nm')?.textContent || '') + ':' + (e.querySelector('.tag')?.textContent || '')));
  console.log(w, 'before', await names());
  await p.evaluate(() => document.querySelector('.idg-pp-sortb.deckb')?.click()); await sleep(600);
  console.log(w, 'after', await names());
  await p.screenshot({ path: OUT + `D-${w}.png` }); await p.context().close();
}
await b.close();
