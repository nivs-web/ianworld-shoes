import { chromium } from 'playwright';
const OUT = 'C:/Users/ARIANC~1/AppData/Local/Temp/claude/C--Users-ariancepc-Desktop-cowork-iandragon/5339b06b-10e0-463d-b750-5be29792c438/scratchpad/shots_ga/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
const Q = 'cl=94&seen=1&gifts=done&coins=99999&gems=999';
for (const [w, h, tag] of [[844, 390, 'L'], [390, 844, 'P']]) {
  const p = await (await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2 })).newPage();
  p.on('pageerror', (e) => console.log('ERR', String(e).slice(0, 150)));
  await p.goto(`http://127.0.0.1:5397/tools/_pwmock/index.html?${Q}`); await sleep(3500);
  await p.evaluate(() => [...document.querySelectorAll('button')].find((x) => /아이템샵/.test(x.textContent) && x.offsetParent)?.click()); await sleep(1500);
  for (const s of ['대장 드래곤', '브레스 강화', '모자', '목 장식', '브레스 색', '오라', '펫']) {
    const ok = await p.evaluate((s) => { const x = [...document.querySelectorAll('.idg-shop-sub .idg-k-tab')].find((x) => x.textContent.trim() === s); x?.click(); return !!x; }, s);
    await sleep(700); await p.screenshot({ path: OUT + `${tag}-${s.replace(/\s/g, '')}.png` }); console.log(tag, s, ok);
  }
  await p.context().close();
}
await b.close();
