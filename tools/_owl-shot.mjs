/* 부엉이 가지 점검 (11/11) : 1-1 에서 카메라 0 · 300 · 500 일 때 부엉이 (가로 PC · 세로 폰) */
import { chromium } from 'playwright';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch({ channel: 'chrome' });
for (const [nm, vp] of [['pc', { width: 1280, height: 800 }], ['port', { width: 412, height: 915 }]]) {
  const p = await (await b.newContext({ viewport: vp, deviceScaleFactor: 2 })).newPage();
  await p.goto('http://127.0.0.1:5320/tools/idg-gallery/lobby.html'); await sleep(2000);
  await p.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.textContent.includes('모험 시작'))?.click()); await sleep(4500);
  await p.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.textContent.includes('출격'))?.click()); await sleep(7000);
  for (const c of [0, 300, 500]) { await p.evaluate((c) => { window.__idgBattle.view.setCam(c); window.__idgFun?.setOff(window.__idgFun.ids); }, c); await sleep(900); await p.screenshot({ path: `tools/_out/owl/${nm}-${c}.png` }); }
}
await b.close();
