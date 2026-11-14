import { chromium } from 'playwright';
const OUT = 'C:/Users/ARIANC~1/AppData/Local/Temp/claude/C--Users-ariancepc-Desktop-cowork-iandragon/5339b06b-10e0-463d-b750-5be29792c438/scratchpad/shots_ga/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
for (const [w, h, name] of [[650, 660, '꾸미기'], [900, 420, '아이템샵'], [1100, 560, '아이템샵']]) {
  for (const off of [false]) {
    const p = await (await b.newContext({ viewport: { width: w, height: h } })).newPage();
    await p.goto('http://127.0.0.1:5397/tools/_pwmock/index.html?cl=94&seen=1&gifts=done&coins=99999'); await sleep(2500);
    await p.evaluate((n) => [...document.querySelectorAll('button')].find((y) => y.offsetParent && y.textContent.replace(/\s/g, '').includes(n))?.click(), name); await sleep(1300);
    if (off) await p.evaluate(() => { for (const s of document.querySelectorAll('style')) if (s.textContent.includes('50%') && s.textContent.includes('--tp')) s.remove(); });
    await sleep(300); await p.screenshot({ path: OUT + `C-${w}-${name}-new.png` }); await p.context().close();
  }
}
await b.close();
