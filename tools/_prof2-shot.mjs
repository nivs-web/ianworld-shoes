/* 프로필 넘침 점검 (11/11 밤) : 칭호 · 목도리 · 큰 숫자 · 받을 도전 과제(N 배지) — 412×915 */
import { chromium } from 'playwright';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch({ channel: 'chrome' });
for (const [nm, w, h, d] of [['p209', 412, 915, 2.6], ['p169', 360, 640, 3]]) {
  const p = await (await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: d })).newPage();
  await p.goto('http://127.0.0.1:5320/tools/idg-gallery/lobby.html'); await sleep(1200);
  await p.evaluate(async () => { const L = await import('/src/services/storageLocal.js'); const q = L.loadProfile(); L.patchProfile({ idg: { ...(q.idg || {}), look: 'n2', cleared: 8, coins: 3834, gems: 215, stars: '33333', title: 'brazier_master', tGot: ['brazier_master'], stat: { maxWl: 8, wins: 10, kills: 500 } } }); });
  await p.reload(); await sleep(2200); await p.screenshot({ path: `tools/_out/prof2-${nm}.png` });
}
await b.close();
