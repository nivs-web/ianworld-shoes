import { chromium } from 'playwright';
const b = await chromium.launch({ channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required'] });
const pg = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const errs = []; pg.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
const U = 'http://127.0.0.1:5311/tools/_jr/index.html';
await pg.goto(U, { waitUntil: 'networkidle' }); await pg.evaluate(() => localStorage.clear());
await pg.goto(U + '?all', { waitUntil: 'networkidle' });
const out = [];
for (const [ctrl, st, tag] of [['jump', 4, 'one'], ['both', 3, 'two']]) {
  await pg.evaluate((c) => { const p = JSON.parse(localStorage.getItem('sf_profile')); p.jr.opts = { ...(p.jr.opts || {}), ctrl: c }; localStorage.setItem('sf_profile', JSON.stringify(p)); }, ctrl);
  await pg.evaluate(async (s) => { const R = await import('/src/screens/JumpRopeGame.js'); window.__nav.reset(R.default, { mode: 'stage', stageNo: s }); }, st);
  await pg.waitForFunction(() => window.__rbDebug && window.__rbDebug()?.phase === 'ready');
  await pg.evaluate(() => { const d = window.__rbDebug(); d.setAuto('perfect'); d.start(); });
  for (let i = 0; i < 900; i++) { await pg.waitForTimeout(100); if ((await pg.evaluate(() => window.__rbDebug().songT)) > 14) break; }
  await pg.screenshot({ path: `tools/_out/piano-${tag}.png` });
  out.push(tag + ' ' + JSON.stringify(await pg.evaluate(() => { const d = window.__rbDebug(); return { p: d.perfect, m: d.miss, n: d.notes }; })));
}
console.log(out.join(' | '), 'errors', errs);
await b.close();
