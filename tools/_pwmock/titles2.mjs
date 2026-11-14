import { chromium } from 'playwright';
const OUT = 'C:/Users/ARIANC~1/AppData/Local/Temp/claude/C--Users-ariancepc-Desktop-cowork-iandragon/5339b06b-10e0-463d-b750-5be29792c438/scratchpad/pack/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
const Q = 'cl=94&seen=1&gifts=done&coins=99999&gems=999';
for (const [w, h, tag] of [[844, 390, 'L'], [1280, 720, 'D']]) {
  const p = await (await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 })).newPage();
  for (const name of ['스테이지', '연구소', '꾸미기', '더보기', '부화장', '도전과제', '아이템샵', '멀티게임', '좀비습격', '설정']) {
    await p.goto(`http://127.0.0.1:5397/tools/_pwmock/index.html?${Q}`); await sleep(2500);
    await p.evaluate((n) => [...document.querySelectorAll('button')].find((y) => y.offsetParent && y.textContent.replace(/\s/g, '').includes(n))?.click(), name); await sleep(1300);
    await p.screenshot({ path: OUT + `T-${tag}-${name}.png` });
    console.log(tag, name, JSON.stringify(await p.evaluate(() => { const t = document.querySelector('.dialog > .idg-how-title'); const d = t?.closest('.dialog'); const x = t?.querySelector('.idg-k-close'); if (!t) return null; const a = d.getBoundingClientRect(), tb = t.getBoundingClientRect(), xb = x?.getBoundingClientRect(); return { tw: Math.round(tb.width / a.width * 100), xr: xb ? Math.round(a.right - xb.right) : null, xt: xb ? Math.round(xb.top - a.top) : null, xs: xb && Math.round(xb.width) }; })));
  }
  await p.context().close();
}
await b.close();
