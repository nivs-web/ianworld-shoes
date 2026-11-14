import { chromium } from 'playwright';
const b = await chromium.launch({ channel: 'chrome' });
const p = await (await b.newContext({ viewport: { width: 844, height: 390 } })).newPage();
await p.goto('http://127.0.0.1:5391/tools/_pwmock/index.html?cl=40&seen=1'); await p.waitForTimeout(2500);
console.log(await p.evaluate(() => [...document.querySelectorAll('button')].map((x) => x.className + '|' + x.textContent.trim().slice(0, 12)).join('\n')));
await p.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.textContent.trim().startsWith('모험시작'))?.click()); await p.waitForTimeout(1500);
console.log('---'); console.log(await p.evaluate(() => [...document.querySelectorAll('button')].map((x) => x.className + '|' + x.textContent.trim().slice(0, 12)).join('\n')));
await b.close();
