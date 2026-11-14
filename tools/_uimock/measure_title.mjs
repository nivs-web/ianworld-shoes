import { chromium } from 'playwright';
const b = await chromium.launch({ channel: 'chrome' });
for (const [w, h] of [[844, 390], [1280, 720]]) {
  const p = await (await b.newContext({ viewport: { width: w, height: h } })).newPage();
  await p.goto('http://127.0.0.1:5397/tools/_uimock/' + (process.argv[2] || 'shop_a2') + '.html'); await p.waitForTimeout(900);
  console.log(w, JSON.stringify(await p.evaluate(() => {
    const win = document.querySelector('.win.v2').getBoundingClientRect(), t = document.querySelector('.win.v2 .tt b').getBoundingClientRect(), tt = document.querySelector('.win.v2 .tt').getBoundingClientRect();
    const x = document.querySelector('.win.v2 .xk').getBoundingClientRect(), c = document.querySelector('.win.v2 .head > :first-child').getBoundingClientRect();
    const goldTop = win.top + 73 / 104 * 30, goldIn = win.top + 82 / 104 * 30, band = win.top + 55 / 104 * 30;
    const gl = win.left + 51 / 100 * 28, gr = win.right - 51 / 100 * 28;
    const r = (v) => Math.round(v * 10) / 10;
    return { split_minus_gold: r(t.top + t.height * .52 - goldTop), ttCenter_minus_band: r((tt.top + tt.bottom) / 2 - band), ttCenterX_minus_mid: r((tt.left + tt.right) / 2 - (win.left + win.right) / 2), xTop_minus_goldIn: r(x.top - goldIn), xRight_gap: r(gr - x.right), cashTop_minus_goldIn: r(c.top - goldIn), cashLeft_gap: r(c.left - gl) };
  })));
  await p.context().close();
}
await b.close();
