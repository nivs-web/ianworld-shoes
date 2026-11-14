import { chromium } from 'playwright';
const OUT = 'C:/Users/ARIANC~1/AppData/Local/Temp/claude/C--Users-ariancepc-Desktop-cowork-iandragon/5339b06b-10e0-463d-b750-5be29792c438/scratchpad/pack/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
for (const [w,h] of [[890,340],[972,495],[844,390],[1280,720]]) {
const p = await (await b.newContext({ viewport: { width: w, height: h } })).newPage();
await p.goto('http://127.0.0.1:5397/tools/_pwmock/index.html?cl=44&seen=1&gifts=done'); await sleep(9500);
await p.screenshot({ path: OUT + `NX-${w}x${h}.png` }); await p.context().close(); }
await b.close();
