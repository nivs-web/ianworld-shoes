import { chromium } from 'playwright';
const OUT = 'C:/Users/ARIANC~1/AppData/Local/Temp/claude/C--Users-ariancepc-Desktop-cowork-iandragon/5339b06b-10e0-463d-b750-5be29792c438/scratchpad/uimock/';
const b = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
for (const [w, hh] of [[844, 390], [1280, 720]]) {
  const p = await (await b.newContext({ viewport: { width: w, height: hh }, deviceScaleFactor: 2 })).newPage();
  for (const v of (process.argv[2] || '1,2,3,4,5').split(',')) { await p.goto(`http://127.0.0.1:5397/tools/_uimock/title.html?v=${v}`); await p.waitForTimeout(1000); await p.screenshot({ path: OUT + `title${v}-${w}.png` }); }
  await p.context().close();
}
await b.close();
