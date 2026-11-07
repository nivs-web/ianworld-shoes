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
await pg.evaluate(async () => { const R = await import('/src/screens/JumpRopeGame.js'); window.__nav.reset(R.default, { mode: 'stage', stageNo: 2 }); });
await pg.waitForFunction(() => window.__rbDebug && window.__rbDebug()?.phase === 'ready');
await pg.evaluate(() => { const d = window.__rbDebug(); d.setAuto('perfect'); d.start(); });
const wants = [0.3, 0.12, 0.0];
let k = 0, full = false;
for (let i = 0; i < 900 && k < wants.length; i++) {
  await pg.waitForTimeout(16);
  const s = await pg.evaluate(() => { const d = window.__rbDebug(); return { t: d.songT, n: d.next() }; });
  if (s.t > 8 && !full) { await pg.screenshot({ path: 'tools/_out/scroll-full.png' }); full = true; }
  if (s.t > 8 && s.n != null && Math.abs(s.n - wants[k]) < 0.05) { await pg.screenshot({ path: `tools/_out/scroll-ring-${k}.png`, clip: { x: 250, y: 560, width: 140, height: 160 } }); k++; }
}
console.log('rings', k, 'errors', errs);
await b.close();
