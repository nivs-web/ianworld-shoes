import { chromium } from 'playwright';
const OUT = 'C:/Users/ARIANC~1/AppData/Local/Temp/claude/C--Users-ariancepc-Desktop-cowork-iandragon/5339b06b-10e0-463d-b750-5be29792c438/scratchpad/shots_ga/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
for (const [w,h] of [[844,390],[1280,720],[660,612]]) {
const p = await (await b.newContext({ viewport: { width: w, height: h } })).newPage();
await p.goto('http://127.0.0.1:5397/tools/_pwmock/index.html?cl=94&seen=1&gifts=done'); await sleep(9000);
await p.screenshot({ path: OUT + `LB-${w}.png` }); await p.context().close(); }
await b.close();
