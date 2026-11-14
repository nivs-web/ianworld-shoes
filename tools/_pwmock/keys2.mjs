import { chromium } from 'playwright';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch({ channel: 'chrome' });
const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
await p.goto('http://127.0.0.1:5391/tools/_pwmock/index.html?cl=44&seen=1&gifts=done&coins=99999'); await sleep(3000);
await p.evaluate(() => [...document.querySelectorAll('button')].filter((y) => y.textContent.replace(/\s/g, '').startsWith('모험시작')).pop()?.click());
await p.waitForFunction(() => window.__idgBattle?.S, null, { timeout: 60000 }); await sleep(2000);
await p.keyboard.press('Enter'); await sleep(800);   // 시작 창 출격!
await p.evaluate(() => { window.__idgBattle.S.players[0].money = 5000; });
const wl = () => p.evaluate(() => window.__idgBattle.S.players[0].wl);
console.log('wl0', await wl()); await p.keyboard.press('KeyA'); await sleep(300); console.log('A →', await wl()); await p.keyboard.press('Backquote'); await sleep(300); console.log('` →', await wl());
const cam = () => p.evaluate(() => window.__idgBattle.view.w);
const w0 = await cam(); await p.keyboard.press('ArrowUp'); await sleep(500); const w1 = await cam(); await p.keyboard.press('ArrowDown'); await sleep(500); console.log('zoom view.w', w0, '↑', w1, '↓', await cam());
await p.evaluate(() => { window.__idgBattle.S.over = { winner: 1 }; }); await sleep(5500);
await p.keyboard.press('KeyR'); await sleep(4000);
console.log('after R: start card?', await p.evaluate(() => !![...document.querySelectorAll('button')].find((x) => x.textContent.trim().startsWith('출격!') && x.offsetParent)));
console.log(errs); await b.close();
