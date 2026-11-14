import { chromium } from 'playwright';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch({ channel: 'chrome' });
const p = await (await b.newContext({ viewport: { width: 844, height: 390 } })).newPage();
await p.goto('http://127.0.0.1:5391/tools/_pwmock/index.html?cl=94&seen=1&gifts=done'); await sleep(2500);
await p.evaluate(() => [...document.querySelectorAll('button')].filter((y) => y.textContent.replace(/\s/g, '').startsWith('모험시작')).pop()?.click());
await p.waitForFunction(() => window.__idgBattle?.S, null, { timeout: 60000 }); await sleep(2000);
await p.evaluate(() => [...document.querySelectorAll('button')].filter((y) => y.textContent.trim().startsWith('출격!')).pop()?.click()); await sleep(1500);
await p.evaluate(() => { const B = window.__idgBattle; B.S.paused = true; });
const bot = await p.evaluate(() => document.querySelector('.idg-bot').getBoundingClientRect().top);
const clip = { x: 0, y: 60, width: 844, height: 120 };
for (const y of [120, 200, 260, 280, 295, 310, Math.round(bot - 8)]) {
  await p.evaluate(() => window.__idgBattle.view.setCam(300)); await sleep(150);
  const a = await p.evaluate(() => window.__idgBattle.view.camX);
  await p.mouse.move(300, y); await p.mouse.down(); await p.mouse.move(650, y, { steps: 10 }); await sleep(50);
  const c = await p.evaluate(() => window.__idgBattle.view.camX); await p.mouse.up();
  console.log('y', y, a === c ? '안 움직임' : '움직임 ' + a + '→' + c);
}
console.log('단추 줄 위끝', bot);
await b.close();
