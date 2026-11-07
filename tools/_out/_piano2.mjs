import { chromium } from 'playwright';
const b = await chromium.launch({ channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required'] });
const pg = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const errs = []; pg.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
const U = 'http://127.0.0.1:5311/tools/_jr/index.html';
await pg.goto(U, { waitUntil: 'networkidle' }); await pg.evaluate(() => localStorage.clear());
await pg.goto(U + '?all', { waitUntil: 'networkidle' });
const out = [];
for (const [ctrl, st] of [['jump', 2], ['both', 3]]) {
  await pg.evaluate((c) => localStorage.setItem('jp.v1', JSON.stringify({ ctrl: c, diff: 'normal' })), ctrl);
  await pg.evaluate(async (s) => { const R = await import('/src/screens/JumpPianoGame.js'); window.__nav.reset(R.default, { mode: 'stage', stageNo: s }); }, st);
  await pg.waitForFunction(() => window.__rbDebug && window.__rbDebug()?.phase === 'ready');
  await pg.evaluate(() => { const d = window.__rbDebug(); d.setAuto('perfect'); d.start(); });
  for (let i = 0; i < 1500; i++) { await pg.waitForTimeout(100); const ph = await pg.evaluate(() => window.__rbDebug().phase); if (ph === 'result' || ph === 'end') break; }
  out.push(ctrl + ' ' + JSON.stringify(await pg.evaluate(() => { const d = window.__rbDebug(); return { ph: d.phase, p: d.perfect, m: d.miss, n: d.notes }; })));
}
// 로비 · 오락실 카드
await pg.evaluate(async () => { const R = await import('/src/screens/JumpPianoLobby.js'); window.__nav.reset(R.default, {}); });
await pg.waitForTimeout(500);
out.push('lobby ' + (await pg.evaluate(() => document.body.innerText.includes('무한 피아노'))));
console.log(out.join(' | '), 'errors', errs);
await b.close();
