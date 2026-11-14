import { chromium } from 'playwright';
const OUT = 'C:/Users/ARIANC~1/AppData/Local/Temp/claude/C--Users-ariancepc-Desktop-cowork-iandragon/5339b06b-10e0-463d-b750-5be29792c438/scratchpad/pack/';
import fs from 'fs'; fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
const U = 'http://127.0.0.1:5397/tools/_pwmock/index.html?cl=94&seen=1&gifts=done&coins=99999&gems=999&lr=normal:95=4';
const clickT = (p, t) => p.evaluate((t) => { const x = [...document.querySelectorAll('button')].filter((y) => y.offsetParent && y.textContent.replace(/\s/g, '').includes(t)).pop(); x?.click(); return !!x; }, t);
for (const [w, h, tag] of [[844, 390, 'L'], [1280, 720, 'D']]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2 }); const p = await ctx.newPage();
  p.on('pageerror', (e) => console.log('ERR', String(e).slice(0, 120)));
  await p.goto(U); await sleep(9000); await p.screenshot({ path: OUT + `${tag}-1lobby.png` });
  await clickT(p, '파워업'); await sleep(1500); await p.screenshot({ path: OUT + `${tag}-2powerup.png` });
  await p.evaluate(() => document.querySelector('.idg-pp-sortb.deckb')?.click()); await sleep(500); await p.screenshot({ path: OUT + `${tag}-2powerup-deck.png` });
  await p.evaluate(() => [...document.querySelectorAll('.idg-pp-subs button')].find((x) => x.textContent.includes('아이템샵'))?.click()); await sleep(1500); await p.screenshot({ path: OUT + `${tag}-3shop-from-powerup.png` });
  await p.evaluate(() => document.querySelector('.idg-title-sw')?.click()); await sleep(1500); await p.screenshot({ path: OUT + `${tag}-4look-from-shop.png` });
  await p.goto(U); await sleep(2500);
  await clickT(p, '아이템샵'); await sleep(1300); await p.evaluate(() => [...document.querySelectorAll('.idg-shop-big .idg-k-tab')].find((x) => x.textContent.includes('편의품'))?.click()); await sleep(700); await p.screenshot({ path: OUT + `${tag}-5shop-cons.png` });
  await p.goto(U); await sleep(2500); await clickT(p, '모험시작'); await sleep(2500); await p.evaluate(() => document.querySelectorAll('.idg-cons')[1]?.click()); await sleep(400); await p.screenshot({ path: OUT + `${tag}-6startcard.png` });
  await p.evaluate(() => window.__idgHud.showPanel('win', { t: 98, coins: 1850, gems: 12, stars: 3, diff: 'normal', hasNext: true, unlocks: ['리더 솔라리스'] })); await sleep(2200); await p.screenshot({ path: OUT + `${tag}-7win.png` });
  await p.evaluate(() => window.__idgHud.showPanel('lose', { t: 50 })); await sleep(2200); await p.screenshot({ path: OUT + `${tag}-8lose.png` });
  await ctx.close();
}
await b.close();
