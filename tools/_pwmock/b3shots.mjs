/* 배포 전 점검 사진 (커밋 안 함) : node tools/_pwmock/b3shots.mjs */
import { chromium } from 'playwright';
const OUT = 'C:/Users/ARIANC~1/AppData/Local/Temp/claude/C--Users-ariancepc-Desktop-cowork-iandragon/5339b06b-10e0-463d-b750-5be29792c438/scratchpad/shots_ca/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch({ channel: 'chrome' });
const Q = 'cl=94&seen=1&gifts=done&coins=99999&gems=999';
async function page(w, h, q) { const p = await (await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2 })).newPage(); const errs = []; p.on('pageerror', (e) => errs.push(String(e).slice(0, 200))); p.errs = errs; await p.goto(`http://127.0.0.1:5391/tools/_pwmock/index.html?${q}`); await sleep(2500); return p; }
const click = (p, t) => p.evaluate((t) => { const bs = [...document.querySelectorAll('button')].filter((y) => y.textContent.replace(/\s/g, '').startsWith(t.replace(/\s/g, ''))); const x = bs[bs.length - 1]; x?.click(); return !!x; }, t);
// 1. 시작 카드 (별 알약 + 브레스40%UP)
{ const p = await page(844, 390, `${Q}&lr=normal:95=5&bp=normal:95:3`); await click(p, '모험시작'); await p.waitForFunction(() => window.__idgBattle?.S, null, { timeout: 60000 }); await sleep(2500); await p.screenshot({ path: OUT + '1-card.png' }); console.log('1', p.errs); await p.context().close(); }
// 2. 아이템샵 편의품 3 · 4 · 5연패 (가로) + 세로
for (const [n, w, h] of [[3, 844, 390], [4, 844, 390], [5, 844, 390], [5, 390, 844]]) { const p = await page(w, h, `${Q}&lr=normal:95=${n}`); console.log('shop', await click(p, '아이템샵')); await sleep(900); await p.evaluate(() => [...document.querySelectorAll('button,[role=tab]')].find((x) => x.textContent.trim() === '편의품')?.click()); await sleep(700); await p.screenshot({ path: OUT + `2-shop${n}-${w}.png` }); console.log('2', n, w, p.errs); await p.context().close(); }
// 3. 진 뒤 «파워업 먼저» (2연패 → 지면 3연패 · 카드 레벨 낮음)
{ const p = await page(844, 390, `${Q}&lr=normal:95=2&lv=10`); await click(p, '모험시작'); await p.waitForFunction(() => window.__idgBattle?.S, null, { timeout: 60000 }); await sleep(2000); await click(p, '출격!'); await sleep(400); await p.evaluate(() => { window.__idgBattle.S.over = { winner: 1 }; }); await sleep(5500); await p.screenshot({ path: OUT + '3-lose.png' }); console.log('3', await p.evaluate(() => JSON.parse(localStorage.getItem('sf_profile')).idg.lossRun), p.errs);
  // 3b. 패배 → 파워업 → 띠
  console.log('pu', await click(p, '파워업')); await sleep(1200); await p.screenshot({ path: OUT + '4-power.png' });
  console.log('shopbtn', await click(p, '아이템샵')); await sleep(1500); await p.screenshot({ path: OUT + '5-power-shop.png' }); console.log('3b', p.errs); await p.context().close(); }
await b.close();
