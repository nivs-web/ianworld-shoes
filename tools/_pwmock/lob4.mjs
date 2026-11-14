import { chromium } from 'playwright';
const OUT = 'C:/Users/ARIANC~1/AppData/Local/Temp/claude/C--Users-ariancepc-Desktop-cowork-iandragon/5339b06b-10e0-463d-b750-5be29792c438/scratchpad/pack/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
const sizes = (process.argv[2] || '844x390,1280x720,2340x1080,1024x768').split(',').map((s) => s.split('x').map(Number));
for (const [w, h] of sizes) {
  const p = await (await b.newContext({ viewport: { width: w, height: h } })).newPage();
  p.on('pageerror', (e) => console.log('ERR', String(e).slice(0, 140)));
  await p.goto('http://127.0.0.1:5397/tools/_pwmock/index.html?cl=44&seen=1&gifts=done&coins=12345&gems=678'); await sleep(5000);
  await p.screenshot({ path: OUT + `LB-${w}x${h}-d.png` });
  await p.evaluate(() => document.querySelector('.l2-switch')?.click()); await sleep(1800);
  await p.screenshot({ path: OUT + `LB-${w}x${h}-c.png` });
  console.log(w, h, JSON.stringify(await p.evaluate(() => { const g = (s) => { const r = document.querySelector(s)?.getBoundingClientRect(); return r ? [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)] : null; }; return { next: g('.l2-nextwrap'), sw: g('.l2-switch'), btns: g('.l2-btns'), castle: g('.l2-castle'), side: g('.l2-side'), bot: g('.l2-bottom') }; })));
  await p.evaluate(() => document.querySelector('.l2-switch')?.click()); await sleep(1500);
  await p.context().close();
}
await b.close();
