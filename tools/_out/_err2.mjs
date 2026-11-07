import { chromium } from 'playwright';
const b = await chromium.launch({ channel: 'chrome' });
const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
pg.on('pageerror', (e) => console.log('pageerror', String(e.stack || e).slice(0, 500)));
pg.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log(m.type(), m.text().slice(0, 300)); });
await pg.goto('http://127.0.0.1:5311/tools/_jr/index.html?all', { waitUntil: 'networkidle' });
await pg.evaluate(async () => { const R = await import('/src/screens/JumpRopeGame.js'); window.__nav.reset(R.default, { mode: 'stage', stageNo: 4 }); });
await pg.waitForTimeout(3000);
await b.close();
