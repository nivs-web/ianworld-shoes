import { chromium } from 'playwright';
const OUT = 'C:/Users/ARIANC~1/AppData/Local/Temp/claude/C--Users-ariancepc-Desktop-cowork-iandragon/5339b06b-10e0-463d-b750-5be29792c438/scratchpad/pack/';
const b = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
for (const [w, h] of [[844, 390], [1280, 720]]) {
  const p = await (await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1.5 })).newPage();
  await p.goto('http://127.0.0.1:5397/tools/_pwmock/index.html?cl=94&seen=1&gifts=done&lr=normal:95=4'); await p.waitForTimeout(3000);
  await p.evaluate(() => [...document.querySelectorAll('button')].filter((y) => y.offsetParent && y.textContent.replace(/\s/g, '').includes('모험시작')).pop()?.click()); await p.waitForTimeout(2500);
  await p.evaluate(() => window.__idgHud.showPanel('win', { t: 98, coins: 1850, gems: 12, stars: 3, diff: 'normal', hasNext: true, unlocks: ['리더 솔라리스'] })); await p.waitForTimeout(2000);
  await p.screenshot({ path: OUT + `WIN-${w}.png` });
  await p.context().close();
}
await b.close();
