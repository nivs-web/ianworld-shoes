import { chromium } from 'playwright';
const b = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
const p = await (await b.newContext({ viewport: { width: 972, height: 495 } })).newPage();
await p.goto('http://127.0.0.1:5397/tools/_pwmock/index.html?cl=44&seen=1&gifts=done'); await new Promise(r=>setTimeout(r,9000));
console.log(await p.evaluate(() => { const n = document.querySelector('.l2-nextwrap'), c = getComputedStyle(n), s = document.querySelector('.l2-switch').getBoundingClientRect(); const r = n.getBoundingClientRect(); const sc = document.querySelector('.screen.idg-lobby2'); const cs = getComputedStyle(sc); return { r: [r.x, r.y, r.width, r.height], top: c.top, sw: [s.y, s.height], vars: ['--sty', '--foot', '--sc', '--fs'].map((v) => v + '=' + cs.getPropertyValue(v)) }; }));
await b.close();
