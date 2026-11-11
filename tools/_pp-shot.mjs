/* 한 페이지 파워업 점검 (11/11) : 코인 · 용 여러 마리 넣고 로비 파워업 · 전투 승리 → 파워업 (세로 · 가로 폰 · 태블릿) */
import { chromium } from 'playwright';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch({ channel: 'chrome' });
const DEV = { p209: [412, 915, 2.6], p209L: [915, 412, 2.6], t43L: [1024, 768, 2], p169: [360, 640, 3] };
for (const nm of (process.argv[2] || 'p209,p209L,t43L,p169').split(',')) {
  const [w, h, d] = DEV[nm]; const p = await (await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: d })).newPage(); const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  const click = (t) => p.evaluate((t) => { const x = [...document.querySelectorAll('button')].find((y) => y.textContent.includes(t)); x?.click(); return !!x; }, t);
  await p.goto('http://127.0.0.1:5320/tools/idg-gallery/lobby.html'); await sleep(1500);
  await p.evaluate(async () => { const L = await import('/src/services/storageLocal.js'); const q = L.loadProfile(); L.patchProfile({ idg: { ...(q.idg || {}), coins: 20000, gems: 300, cleared: 14, units: { kkomul: [9, 0], dungdungi: [3, 0], bulttong: [5, 0], twetwe: [2, 0] } } }); });
  await p.reload(); await sleep(1800);
  await click('파워업'); await sleep(800); await p.screenshot({ path: `tools/_out/pp/${nm}-lobby.png` });
  await p.evaluate(() => document.querySelector('.idg-pp-card .idg-pp-pick')?.click()); await sleep(300);
  await p.evaluate(() => [...document.querySelectorAll('.idg-pp-up')].find((x) => !x.disabled)?.click()); await sleep(400); await p.screenshot({ path: `tools/_out/pp/${nm}-lobby2.png` });
  await p.evaluate(() => document.querySelector('.dialog-overlay:last-of-type')?.click()); await sleep(300);
  await click('모험 시작'); await sleep(4500); await click('출격'); await sleep(3000);
  await p.evaluate(() => { window.__idgBattle.S.base[1].hp = 0; }); await sleep(4200);
  await click('파워 업'); await sleep(700); await p.screenshot({ path: `tools/_out/pp/${nm}-game.png` });
  console.log(nm, '오류', errs.length, errs[0] || '');
}
await b.close();
