import { chromium } from 'playwright';
const OUT = 'C:/Users/ARIANC~1/AppData/Local/Temp/claude/C--Users-ariancepc-Desktop-cowork-iandragon/5339b06b-10e0-463d-b750-5be29792c438/scratchpad/uimock/';
const n = process.argv[2];
const b = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
const p = await (await b.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1.5 })).newPage();
p.on('pageerror', (e) => console.log('ERR', String(e).slice(0, 140)));
await p.goto(`http://127.0.0.1:5397/tools/_uimock/${n}.html`); await p.waitForTimeout(1500);
await p.screenshot({ path: OUT + `${n}-full.png`, fullPage: true });
await b.close();
