/* node tools/_pwmock/pw.mjs <이름> "<쿼리>" <w> <h> <lobby|battle> <동작,...>  (커밋 안 함) */
import { chromium } from 'playwright';
const OUT = 'C:/Users/ARIANC~1/AppData/Local/Temp/claude/C--Users-ariancepc-Desktop-cowork-iandragon/5339b06b-10e0-463d-b750-5be29792c438/scratchpad/shots_ca/';
const [name, query, W, H, mode = 'lobby', acts = ''] = process.argv.slice(2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch({ channel: 'chrome' });
const p = await (await b.newContext({ viewport: { width: +W, height: +H }, deviceScaleFactor: 2 })).newPage();
const errs = []; p.on('pageerror', (e) => errs.push(String(e))); p.on('console', (m) => { if (m.type() === 'error' && !/AudioContext|firebase|404|Failed to load/.test(m.text())) errs.push(m.text().slice(0, 200)); });
await p.goto(`http://127.0.0.1:5391/tools/_pwmock/index.html?${query}`); await sleep(2500);
const click = (t, sel = 'button') => p.evaluate(([t, sel]) => { const bs = [...document.querySelectorAll(sel)].filter((y) => y.textContent.trim().startsWith(t)); const x = bs[bs.length - 1]; x?.click(); return !!x; }, [t, sel]);
if (mode === 'battle') {
  await click('모험시작');
  await p.waitForFunction(() => window.__idgBattle?.S, null, { timeout: 60000 }).catch(() => console.log('no battle'));
  await sleep(2500);
  await p.evaluate(() => { const B = window.__idgBattle; B.S.t = 30; B.S.over = { winner: 0 }; });
  await click('출격!'); await sleep(4500);
  console.log('pu', await click('파워업')); await sleep(1200);
} else { console.log('pu', await click('파워업')); await sleep(1200); }
let k = 0;
for (const a of acts.split(',').filter(Boolean)) {
  if (a.startsWith('click:')) { console.log(a, await click(a.slice(6))); await sleep(600); }
  else if (a.startsWith('sel:')) { console.log(a, await p.evaluate((s) => { const x = document.querySelector(s); x?.click(); return !!x; }, a.slice(4))); await sleep(600); }
  else if (a.startsWith('wait:')) await sleep(+a.slice(5));
  else if (a === 'shot') await p.screenshot({ path: `${OUT}${name}-${k++}.png` });
  else if (a === 'chk') console.log(JSON.stringify(await p.evaluate(() => { const r = []; document.querySelectorAll('.idg-pp-card').forEach((c) => { for (const q of ['.nm', '.lv', '.l1', '.cost', '.idg-pp-up', '.st']) { const e = c.querySelector(q); if (e && e.scrollWidth > e.clientWidth + 1) r.push(c.dataset.id + q + ' ' + e.scrollWidth + '>' + e.clientWidth); } }); const sb = document.querySelector('.idg-pp-sbody'); const sl = document.querySelector('.idg-pp-slot'); return { over: r, sb: sb ? [sb.scrollHeight, sb.clientHeight] : null, slot: sl ? [sl.offsetWidth, sl.offsetHeight] : null, ncard: document.querySelectorAll('.idg-pp-card').length }; })));
  else if (a.startsWith('eval:')) console.log(JSON.stringify(await p.evaluate(a.slice(5))));
}
if (errs.length) console.log('ERRS', errs.slice(0, 8));
await b.close();
