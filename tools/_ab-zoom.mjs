/* 확대 A/B/C 비교 (대표님 폰 2000×923) : 같은 장면을 하늘 자르기 0 · 80 · 150 으로 찍는다 */
import { chromium } from 'playwright';
const OUT = process.argv[2];
const b = await chromium.launch({ channel: 'chrome' });
for (const [tag, crop, cam] of [['A', 0, 0], ['B', 80, 0], ['C', 150, 0], ['A-mid', 0, 400], ['B-mid', 80, 400], ['C-mid', 150, 400]]) {
  const p = await (await b.newContext({ viewport: { width: 800, height: 369 }, deviceScaleFactor: 2.5 })).newPage();
  await p.addInitScript((c) => { window.__idgCropTop = c; }, crop);
  await p.goto('http://127.0.0.1:5320/tools/idg-gallery/lobby.html'); await new Promise((r) => setTimeout(r, 2500));
  await p.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.textContent.includes('모험')).click());
  await p.waitForFunction(() => [...document.querySelectorAll('button')].some((x) => x.textContent.includes('출격')), null, { timeout: 20000 });
  await p.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.textContent.includes('출격')).click());
  await new Promise((r) => setTimeout(r, 1500));
  /* 용 몇 마리 내보내고 잠시 싸우게 → 전투가 보이는 장면 */
  await p.evaluate(() => { const B = window.__idgBattle; B.S.players[0].money = 9999; });
  for (let i = 0; i < 4; i++) { await p.keyboard.press('1'); await new Promise((r) => setTimeout(r, 900)); }
  await new Promise((r) => setTimeout(r, 4000));
  if (cam) await p.evaluate((x) => window.__idgBattle.view.setCam(x), cam);
  await new Promise((r) => setTimeout(r, 400));
  await p.screenshot({ path: `${OUT}/zoom-${tag}.png` });
  await p.context().close();
  console.log(tag);
}
await b.close();
