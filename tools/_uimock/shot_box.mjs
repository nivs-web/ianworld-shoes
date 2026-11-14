import { chromium } from 'playwright';
const OUT = 'C:/Users/ARIANC~1/AppData/Local/Temp/claude/C--Users-ariancepc-Desktop-cowork-iandragon/5339b06b-10e0-463d-b750-5be29792c438/scratchpad/uimock/';
const [n, idx, out] = process.argv.slice(2);
const b = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
const p = await (await b.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 })).newPage();
await p.goto(`http://127.0.0.1:5397/tools/_uimock/${n}.html`); await p.waitForTimeout(1300);
await p.locator('.box').nth(Number(idx)).screenshot({ path: OUT + out });
await b.close();
