/* 명예의 전당 점검 (11/11) : 더보기 → 명예의 전당 · 탭 5개 · 설명 · 뒤 비침 (서버 없이 «여는 중» 상태) */
import { chromium } from 'playwright';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch({ channel: 'chrome' });
for (const [nm, w, h, d] of [['p209', 412, 915, 2.6], ['p169', 360, 640, 3], ['t1610L', 1280, 800, 2]]) {
  const p = await (await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: d })).newPage();
  const click = (t) => p.evaluate((t) => { [...document.querySelectorAll('button')].find((y) => y.textContent.includes(t))?.click(); }, t);
  await p.goto('http://127.0.0.1:5320/tools/idg-gallery/lobby.html'); await sleep(1800); await click('더보기'); await sleep(500); await click('명예의 전당'); await sleep(1500);
  await p.screenshot({ path: `tools/_out/hall-${nm}.png` });
}
await b.close();
