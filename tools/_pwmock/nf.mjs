import { chromium } from 'playwright';
const b = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
const f = []; p.on('requestfinished', (r) => { if (r.resourceType() === 'font') f.push(r.url().split('/').pop()); });
await p.goto('http://127.0.0.1:5397/'); await p.waitForFunction('window.__dbg && window.__dbg.nav'); await new Promise((r) => setTimeout(r, 4000));
console.log(f); await b.close();
