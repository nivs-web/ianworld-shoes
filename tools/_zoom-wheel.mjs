/* 맵 확대 · 축소 점검 (겜부장 11/11) : 휠로 최대 확대 · 최소(전체) 찍기 · 폰 크기는 두 손가락 대신 휠 */
import { chromium } from 'playwright';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch({ channel: 'chrome' });
for (const [name, vp, dpr] of [['pc', { width: 1280, height: 800 }, 1], ['phone', { width: 800, height: 369 }, 2.5]]) {
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: dpr }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  const click = (t) => p.evaluate((t) => { const x = [...document.querySelectorAll('button')].find((y) => y.textContent.includes(t)); x?.click(); return !!x; }, t);
  await p.goto('http://127.0.0.1:5320/tools/idg-gallery/lobby.html'); await sleep(2500); await click('모험 시작'); await sleep(4000); await click('출격'); await sleep(8000);
  await p.screenshot({ path: `tools/_out/zoom/${name}-default.png` });
  await p.mouse.move(vp.width / 2, vp.height / 2);
  for (let i = 0; i < 12; i++) { await p.mouse.wheel(0, -120); await sleep(60); } await sleep(700); await p.screenshot({ path: `tools/_out/zoom/${name}-max.png` });
  for (let i = 0; i < 20; i++) { await p.mouse.wheel(0, 120); await sleep(60); } await sleep(700); await p.screenshot({ path: `tools/_out/zoom/${name}-min.png` });
  console.log(name, '오류', errs.length, errs[0] || ''); await ctx.close();
}
await b.close();
