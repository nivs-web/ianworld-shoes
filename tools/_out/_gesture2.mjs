import { chromium } from 'playwright';
const b = await chromium.launch({ channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required'] });
const pg = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const errs = [];
pg.on('pageerror', (e) => errs.push(String(e)));
const U = 'http://127.0.0.1:5311/tools/_jr/index.html';
await pg.goto(U, { waitUntil: 'networkidle' });
await pg.evaluate(() => localStorage.clear());
await pg.goto(U + '?all', { waitUntil: 'networkidle' });
await pg.waitForTimeout(500);
await pg.evaluate(async () => { const R = await import('/src/screens/JumpRopeGame.js'); window.__nav.reset(R.default, { mode: 'stage', stageNo: 4 }); });
await pg.waitForFunction(() => window.__rbDebug && window.__rbDebug()?.phase === 'ready');
const res = await pg.evaluate(async () => {
  const d0 = window.__rbDebug(); d0.start();
  const cv = document.querySelector('.rb-canvas');
  const r = cv.getBoundingClientRect();
  const X = r.left + r.width * 0.5, Y = r.top + r.height * 0.55;
  const fire = (type, x, id) => cv.dispatchEvent(new PointerEvent(type, { pointerId: id, bubbles: true, cancelable: true, clientX: x, clientY: Y, isPrimary: true, pointerType: 'touch' }));
  const out = []; const seen = new Set(); let id = 10;
  const t0 = performance.now();
  while (performance.now() - t0 < 60000 && out.length < 24) {
    await new Promise((ok) => setTimeout(ok, 2));
    const d = window.__rbDebug(); const nn = d.nextNote();
    if (!nn || seen.has(nn.id) || nn.dt > 0.012) continue;
    seen.add(nn.id); id++;
    const before = d.perfect + d.great + d.good, missB = d.miss;
    fire('pointerdown', X, id);
    if (nn.act === 'left' || nn.act === 'right') { fire('pointermove', X + (nn.act === 'left' ? -30 : 30), id); fire('pointerup', X + (nn.act === 'left' ? -30 : 30), id); }
    else if (nn.act === 'hold') { const n = window.__rbDebug(); await new Promise((ok) => setTimeout(ok, 450)); fire('pointerup', X, id); }
    else { await new Promise((ok) => setTimeout(ok, 30)); fire('pointerup', X, id); }
    await new Promise((ok) => setTimeout(ok, 20));
    const a = window.__rbDebug();
    out.push(`${nn.act}:${a.perfect + a.great + a.good > before ? 'ok' : a.miss > missB ? 'MISS' : '?'}`);
  }
  const f = window.__rbDebug();
  return { out: out.join(' '), p: f.perfect, g: f.great, o: f.good, m: f.miss };
});
console.log(res.out); console.log(JSON.stringify({ p: res.p, g: res.g, o: res.o, m: res.m }), 'errors', errs);
await b.close();
