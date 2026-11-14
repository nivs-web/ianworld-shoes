import { chromium } from 'playwright';
const OUT = 'C:/Users/ARIANC~1/AppData/Local/Temp/claude/C--Users-ariancepc-Desktop-cowork-iandragon/5339b06b-10e0-463d-b750-5be29792c438/scratchpad/pack/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
for (const [w, h] of [[844, 390], [1280, 720]]) {
  const p = await (await b.newContext({ viewport: { width: w, height: h } })).newPage();
  await p.goto('http://127.0.0.1:5397/tools/_pwmock/index.html?cl=94&seen=1&gifts=done'); await sleep(2500);
  await p.evaluate(() => [...document.querySelectorAll('button')].filter((y) => y.offsetParent && y.textContent.replace(/\s/g, '').includes('모험시작')).pop()?.click()); await sleep(2500);
  await p.evaluate(() => document.querySelectorAll('.idg-cons')); await p.keyboard.press('Enter'); await sleep(1500);
  await p.keyboard.press('Escape'); await sleep(1200);
  const r = await p.evaluate(() => [...document.querySelectorAll('.dialog, .idg-panel, [class*=pause]')].filter((d) => d.offsetParent).map((d) => { const r = d.getBoundingClientRect(); return d.className.slice(0, 50) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height); }));
  console.log(w, r.slice(-6));
  await p.screenshot({ path: OUT + `PZ-${w}.png` });
  await p.context().close();
}
await b.close();
