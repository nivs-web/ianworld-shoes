import { chromium } from 'playwright';
const b = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
for (const [w,h] of [[390,844],[844,390],[1280,720]]) {
const p = await (await b.newContext({ viewport: { width: w, height: h } })).newPage();
await p.goto('http://127.0.0.1:5397/tools/_pwmock/index.html?cl=94&seen=1&gifts=done'); await new Promise(r=>setTimeout(r,2500));
await p.evaluate(() => [...document.querySelectorAll('button')].find((y) => y.offsetParent && y.textContent.includes('부화장'))?.click()); await new Promise(r=>setTimeout(r,1200));
console.log(w, await p.evaluate(() => { const d = document.querySelector('.dialog.idg-framed, .dialog[class*=idg-]'); const c = getComputedStyle(d); return [d.className, c.paddingLeft, c.paddingRight, c.borderLeftWidth, d.getBoundingClientRect().width, d.clientWidth, getComputedStyle(d).boxSizing]; }));
await p.context().close(); }
await b.close();
