import { chromium } from 'playwright';
const OUT = 'C:/Users/ARIANC~1/AppData/Local/Temp/claude/C--Users-ariancepc-Desktop-cowork-iandragon/5339b06b-10e0-463d-b750-5be29792c438/scratchpad/shots_ga/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
const scan = () => { const bad = {}; for (const e of document.querySelectorAll('body *')) { if (!e.offsetParent && getComputedStyle(e).position !== 'fixed') continue; if (![...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue; const f = getComputedStyle(e).fontFamily; if (!f.startsWith('Galmuri11') && !f.startsWith('"Galmuri11"')) { const k = f.slice(0, 40); (bad[k] = bad[k] || []).push((e.className + '|' + e.textContent.trim().slice(0, 12)).slice(0, 40)); } } return Object.fromEntries(Object.entries(bad).map(([k, v]) => [k, v.slice(0, 5)])); };
const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
await p.goto('http://127.0.0.1:5397/'); await p.waitForFunction('window.__dbg && window.__dbg.nav', null, { timeout: 60000 });
await p.evaluate(() => window.__dbg.nav.reset(window.__dbg.screens.Portal)); await sleep(3500);
await p.screenshot({ path: OUT + 'F-portal.png' });
console.log('portal', JSON.stringify(await p.evaluate(scan)));
const Q = 'cl=94&seen=1&gifts=done&coins=99999&gems=999';
await p.goto(`http://127.0.0.1:5397/tools/_pwmock/index.html?${Q}`); await sleep(3000);
console.log('lobby', JSON.stringify(await p.evaluate(scan)));
for (const n of ['스테이지','더보기','파워업','모험시작']) { await p.goto(`http://127.0.0.1:5397/tools/_pwmock/index.html?${Q}`); await sleep(2500); await p.evaluate((n) => [...document.querySelectorAll('button')].find((y) => y.offsetParent && y.textContent.replace(/\s/g,'').includes(n))?.click(), n); await sleep(1500); console.log(n, JSON.stringify(await p.evaluate(scan))); }
await b.close();
