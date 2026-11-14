import { chromium } from 'playwright';
const OUT = 'C:/Users/ARIANC~1/AppData/Local/Temp/claude/C--Users-ariancepc-Desktop-cowork-iandragon/5339b06b-10e0-463d-b750-5be29792c438/scratchpad/shots_ca/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch({ channel: 'chrome' });
const p = await (await b.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2 })).newPage();
const errs = []; p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
await p.goto('http://127.0.0.1:5391/tools/_pwmock/index.html?cl=44&seen=1&gifts=done&coins=99999'); await sleep(3000);
const tap = (t, sel = 'button') => p.evaluate(([t, sel]) => { const x = [...document.querySelectorAll(sel)].filter((y) => y.textContent.replace(/\s/g, '').startsWith(t)).pop(); x?.click(); return !!x; }, [t, sel]);
const idg = () => p.evaluate(() => JSON.parse(localStorage.getItem('sf_profile')).idg);
// 1) 편의품 2개 고르고 시작
await tap('모험시작'); await p.waitForFunction(() => window.__idgBattle?.S, null, { timeout: 60000 }); await sleep(2000);
console.log('pick', await tap('시작불씨', '.idg-cons'), await tap('화로1단계', '.idg-cons')); await sleep(300);
await p.screenshot({ path: OUT + 'cons-pick2.png' });
const m0 = await p.evaluate(() => [window.__idgBattle.S.players[0].money, window.__idgBattle.S.players[0].wl]);
await tap('출격!'); await sleep(500);
console.log('before', m0, 'after', await p.evaluate(() => [window.__idgBattle.S.players[0].money, window.__idgBattle.S.players[0].wl]), 'cons', (await idg()).cons);
// 2) 편의품 다 없애고 지고 다시하기 → 시작 창 + 아이템샵 안내
await p.evaluate(async () => { const L = await import('/src/services/storageLocal.js'); const q = L.loadProfile(); L.patchProfile({ idg: { ...q.idg, cons: {} } }); });
await p.evaluate(() => { window.__idgBattle.S.over = { winner: 1 }; }); await sleep(5500);
console.log('retry', await tap('다시하기')); await sleep(4500);
await p.screenshot({ path: OUT + 'cons-none.png' });
console.log('shop btn', await tap('아이템샵', '.idg-cons')); await sleep(1500);
await p.screenshot({ path: OUT + 'cons-shop.png' });
console.log(errs); await b.close();
