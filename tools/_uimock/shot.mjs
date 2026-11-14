// 시안 사진 찍기 : node tools/_uimock/shot.mjs shop_a shop_b ...  (화면 없는 크롬 · 소리 없음)
import { chromium } from 'playwright';
import fs from 'fs';
const OUT = 'C:/Users/ARIANC~1/AppData/Local/Temp/claude/C--Users-ariancepc-Desktop-cowork-iandragon/5339b06b-10e0-463d-b750-5be29792c438/scratchpad/uimock/';
fs.mkdirSync(OUT, { recursive: true });
const names = process.argv.slice(2);
const b = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
for (const [w, hh] of [[844, 390], [1280, 720]]) {
  const p = await (await b.newContext({ viewport: { width: w, height: hh }, deviceScaleFactor: 2 })).newPage();
  p.on('pageerror', (e) => console.log('ERR', n, String(e).slice(0, 120)));
  var n;
  for (n of names) { await p.goto(`http://127.0.0.1:5397/tools/_uimock/${n}.html`); await p.waitForTimeout(1300); await p.screenshot({ path: OUT + `${n}-${w}.png` }); }
  await p.context().close();
}
await b.close();
