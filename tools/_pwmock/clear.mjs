import { chromium } from 'playwright';
const OUT = 'C:/Users/ARIANC~1/AppData/Local/Temp/claude/C--Users-ariancepc-Desktop-cowork-iandragon/5339b06b-10e0-463d-b750-5be29792c438/scratchpad/shots_ca/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch({ channel: 'chrome' });
const tap = (p, t, sel = 'button') => p.evaluate(([t, sel]) => { const x = [...document.querySelectorAll(sel)].filter((y) => y.textContent.replace(/\s/g, '').startsWith(t) && y.offsetParent).pop(); x?.click(); return !!x; }, [t, sel]);
// 가로 : 전투 → 패배 → 파워업 → 비우기
{ const p = await (await b.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2 })).newPage(); const errs = []; p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
  await p.goto('http://127.0.0.1:5391/tools/_pwmock/index.html?cl=44&seen=1&gifts=done'); await sleep(3000);
  await tap(p, '모험시작'); await p.waitForFunction(() => window.__idgBattle?.S, null, { timeout: 60000 }); await sleep(2000);
  await tap(p, '출격!'); await sleep(500); await p.evaluate(() => { window.__idgBattle.S.over = { winner: 1 }; }); await sleep(5500);
  await tap(p, '파워업'); await sleep(1200); await p.screenshot({ path: OUT + 'clear-land-0.png' });
  console.log('clear', await tap(p, '비우기', '.idg-pp-clear')); await sleep(600); await p.screenshot({ path: OUT + 'clear-land-1.png' });
  console.log('slots filled', await p.evaluate(() => document.querySelectorAll('.idg-pp-slot:not(.empty)').length), errs); await p.context().close(); }
// 세로 : 로비 파워업
{ const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
  await p.goto('http://127.0.0.1:5391/tools/_pwmock/index.html?cl=44&seen=1&gifts=done'); await sleep(3000);
  await tap(p, '파워업'); await sleep(1200); await p.screenshot({ path: OUT + 'clear-port-0.png' }); await p.context().close(); }
await b.close();
