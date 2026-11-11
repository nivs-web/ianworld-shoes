/* 로비 프로필 꾸민 드래곤 점검 (11/11) : 꾸미기 h?·n? 넣고 세로 폰 · 가로 태블릿 로비 */
import { chromium } from 'playwright';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const look = process.argv[2] || 'h1.n1';
const b = await chromium.launch({ channel: 'chrome' });
for (const [nm, w, h, d] of [['p209', 412, 915, 2.6], ['t43L', 1024, 768, 2], ['p169L', 640, 360, 3]]) {
  const p = await (await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: d })).newPage(); const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('http://127.0.0.1:5320/tools/idg-gallery/lobby.html'); await sleep(1200);
  await p.evaluate(async (look) => { const L = await import('/src/services/storageLocal.js'); const q = L.loadProfile(); L.patchProfile({ idg: { ...(q.idg || {}), look, cleared: 6 } }); }, look);
  await p.reload(); await sleep(2200); await p.screenshot({ path: `tools/_out/prof/${nm}.png` }); console.log(nm, '오류', errs.length, errs[0] || '');
}
await b.close();
