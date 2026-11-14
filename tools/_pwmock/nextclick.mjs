import { chromium } from 'playwright';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
for (const [w,h] of [[844,390],[390,844],[1280,720]]) {
const p = await (await b.newContext({ viewport: { width: w, height: h } })).newPage();
await p.goto('http://127.0.0.1:5397/tools/_pwmock/index.html?cl=94&seen=1&gifts=done'); await sleep(3000);
const r = await p.evaluate(() => { const e = document.querySelector('.l2-next'); const bb = e.getBoundingClientRect(); const t = document.elementFromPoint(bb.x + bb.width / 2, bb.y + bb.height / 2); return { box: [bb.x, bb.y, bb.width, bb.height].map(Math.round), top: t.className + '|' + t.tagName }; });
console.log(w, JSON.stringify(r));
const bb = await p.locator('.l2-next').boundingBox(); await p.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2); await sleep(1200);
console.log('title', await p.evaluate(() => document.querySelector('.idg-how-title')?.textContent));
await p.context().close(); }
await b.close();
