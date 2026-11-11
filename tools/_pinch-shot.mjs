/* 두 손가락 확대 · 축소 점검 (11/11 대표님 «세로에서 최소 축소 안 되게 · 가운데 기준») : 캔버스에 포인터 두 개를 흉내 낸다 */
import { chromium } from 'playwright';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch({ channel: 'chrome' });
for (const [nm, w, h, d] of (process.argv[2] === 'p' ? [['p209', 412, 915, 2.6]] : [['p209', 412, 915, 2.6], ['p169', 360, 640, 3], ['p209L', 915, 412, 2.6]])) {
  const p = await (await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: d })).newPage(); const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  const click = (t) => p.evaluate((t) => { [...document.querySelectorAll('button')].find((y) => y.textContent.includes(t))?.click(); }, t);
  await p.goto('http://127.0.0.1:5320/tools/idg-gallery/lobby.html'); await sleep(1500); await click('모험 시작'); await sleep(4500); await click('출격'); await sleep(7500);
  await p.evaluate(() => window.__idgFun?.setOff(window.__idgFun.ids));
  const pinch = (cx, cy, from, to) => p.evaluate(async ([cx, cy, from, to]) => {
    const cv = document.querySelector('canvas.idg-canvas'), ev = (type, id, x, y, tgt) => tgt.dispatchEvent(new PointerEvent(type, { pointerId: id, clientX: x, clientY: y, bubbles: true }));
    ev('pointerdown', 11, cx - from, cy, cv); ev('pointerdown', 12, cx + from, cy, cv);
    for (let i = 1; i <= 12; i++) { const g = from + ((to - from) * i) / 12; ev('pointermove', 11, cx - g, cy, window); ev('pointermove', 12, cx + g, cy, window); await new Promise((r) => setTimeout(r, 30)); }
    ev('pointerup', 11, cx - to, cy, window); ev('pointerup', 12, cx + to, cy, window);
  }, [cx, cy, from, to]);
  const shot = async (t) => { await sleep(700); await p.screenshot({ path: `tools/_out/pinch/${nm}-${t}.png` }); };
  await shot('0-start');
  await pinch(w * 0.5, h * 0.4, 120, 30); await shot('1-zoomout-try');   /* 세로 : 더 작아지면 안 됨 */
  await pinch(w * 0.7, h * 0.4, 40, 160); await shot('2-zoomin-right');
  await pinch(w * 0.7, h * 0.4, 160, 40); await shot('3-zoomout-back');
  console.log(nm, '오류', errs.length, errs[0] || '');
}
await b.close();
