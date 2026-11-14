import { chromium } from 'playwright';
const OUT = 'C:/Users/ARIANC~1/AppData/Local/Temp/claude/C--Users-ariancepc-Desktop-cowork-iandragon/5339b06b-10e0-463d-b750-5be29792c438/scratchpad/uimock/';
const b = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
const p = await (await b.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1.5 })).newPage();
await p.goto('http://127.0.0.1:5397/tools/_uimock/rules.html'); await p.waitForTimeout(1400);
const n = await p.locator('.box').count();
for (let i = 0; i < n; i++) await p.locator('.box').nth(i).screenshot({ path: OUT + `bx${String(i).padStart(2, '0')}.png` });
console.log(n);
await b.close();
