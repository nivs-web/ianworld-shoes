import { chromium } from 'playwright';
const b = await chromium.launch({ channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required'] });
const pg = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const errs = [];
pg.on('pageerror', (e) => errs.push(String(e)));
const U = 'http://127.0.0.1:5311/tools/_jr/index.html';
await pg.goto(U, { waitUntil: 'networkidle' });
await pg.evaluate(() => localStorage.clear());
await pg.goto(U + '?all', { waitUntil: 'networkidle' });
await pg.waitForTimeout(500);
await pg.evaluate(async () => { const R = await import('/src/screens/JumpRopeGame.js'); window.__nav.reset(R.default, { mode: 'stage', stageNo: 5 }); });
await pg.waitForFunction(() => window.__rbDebug && window.__rbDebug()?.phase === 'ready');
await pg.waitForTimeout(400);
await pg.screenshot({ path: 'tools/_out/tile-0.png' });
await pg.evaluate(() => { const d = window.__rbDebug(); d.setAuto('perfect'); d.start(); });
const shots = [8, 14, 20, 26];
let k = 0;
for (let i = 0; i < 900 && k < shots.length; i++) {
  await pg.waitForTimeout(100);
  const t = await pg.evaluate(() => window.__rbDebug().songT);
  if (t >= shots[k]) { await pg.screenshot({ path: `tools/_out/tile-${k + 1}.png` }); k++; }
}
console.log(JSON.stringify(await pg.evaluate(() => { const d = window.__rbDebug(); return { p: d.perfect, m: d.miss, n: d.notes, combo: d.combo }; })), 'errors', errs);
await b.close();
