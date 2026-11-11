/* 판 사이 파워 업 · 브레스 사거리 · 초강력 브레스 점검 (겜부장 11/11) */
import { chromium } from 'playwright';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch({ channel: 'chrome' });
for (const [name, vp, dpr] of [['pc', { width: 1280, height: 800 }, 1], ['phone', { width: 800, height: 369 }, 2.5], ['port', { width: 390, height: 844 }, 3]]) {
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: dpr }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  const click = (t) => p.evaluate((t) => { const x = [...document.querySelectorAll('button')].find((y) => y.textContent.includes(t)); x?.click(); return !!x; }, t);
  const shot = (t) => p.screenshot({ path: `tools/_out/pu/${name}-${t}.png` });
  await p.goto('http://127.0.0.1:5320/tools/idg-gallery/lobby.html'); await sleep(2000);
  await p.evaluate(async () => { const L = await import('/src/services/storageLocal.js'); const q = L.loadProfile(); L.patchProfile({ idg: { ...(q.idg || {}), coins: 9000 } }); });
  await click('모험 시작'); await sleep(4000); await click('출격'); await sleep(7000);
  await p.evaluate(() => { const B = window.__idgBattle; const P = B.S.players[0]; P.breathT = P.breathCharge; B.S.lines.push({ id: 'walker', count: 8, left: 8, next: 0, armed: true, every: 0.3 }); });
  await sleep(2500); await shot('1-ready');
  await p.evaluate(() => window.__idgBattle.cmds.push({ p: 0, type: 'breath' })); await sleep(250); await shot('2-breath'); await sleep(250); await shot('3-breath2');
  await p.evaluate(() => { const B = window.__idgBattle; B.S.base[1].hp = 0; }); await sleep(4200); await shot('4-result');
  await click('파워 업'); await sleep(500); await shot('5-powerup');
  await click('▶'); await sleep(300); await shot('6-card');
  await click('파워 업!!'); await sleep(500); await shot('7-after');
  console.log(name, '오류', errs.length, errs.slice(0, 2).join(' | ')); await ctx.close();
}
await b.close();
