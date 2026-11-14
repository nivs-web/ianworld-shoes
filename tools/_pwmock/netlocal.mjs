import { chromium } from 'playwright';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
const ctx = await b.newContext({ viewport: { width: 844, height: 390 } });
const p = await ctx.newPage();
const cdp = await ctx.newCDPSession(p); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
const reqs = []; let phase = 'boot';
p.on('requestfinished', async (rq) => { try { const sz = await rq.sizes(); const t = rq.timing(); reqs.push({ phase, url: rq.url(), type: rq.resourceType(), len: sz.responseBodySize, ms: Math.round(t.responseEnd) }); } catch {} });
const until = async (fn, ms = 60000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await p.evaluate(fn).catch(() => false)) return true; await sleep(50); } return false; };
await p.goto('http://127.0.0.1:5395/'); await p.waitForFunction('window.__dbg && window.__dbg.nav', null, { timeout: 60000 });
await p.evaluate(() => window.__dbg.nav.reset(window.__dbg.screens.Portal)); await until(() => [...document.querySelectorAll('img')].some((i) => i.alt === '좀비와 드래곤'));
phase = 'lobby'; let t = Date.now();
await p.evaluate(() => { const i = [...document.querySelectorAll('img')].find((x) => x.alt === '좀비와 드래곤'); (i.closest('.gc')?.querySelector('button') || i).click(); });
await until(() => !!document.querySelector('.l2-money, .l2-tile')); console.log('lobby ms', Date.now() - t); await sleep(1500);
phase = 'battle'; t = Date.now();
await p.evaluate(() => [...document.querySelectorAll('button')].find((x) => /모험/.test(x.textContent) && x.offsetParent)?.click());
await until(() => [...document.querySelectorAll('button')].some((x) => /출격!/.test(x.textContent) && x.offsetParent)); console.log('battle ready ms', Date.now() - t); await sleep(3000);
for (const ph of ['boot', 'lobby', 'battle']) {
  const a = reqs.filter((x) => x.phase === ph), by = {};
  for (const x of a) { const k = x.type; by[k] = by[k] || [0, 0]; by[k][0]++; by[k][1] += x.len; }
  console.log(`\n## ${ph} : ${a.length}개 ${Math.round(a.reduce((s, x) => s + x.len, 0) / 1024)}KB`, JSON.stringify(Object.fromEntries(Object.entries(by).map(([k, v]) => [k, `${v[0]}/${Math.round(v[1] / 1024)}KB`]))));
  console.log(a.sort((x, y) => y.len - x.len).slice(0, 14).map((x) => `  ${Math.round(x.len / 1024)}KB ${x.url.replace(/^https?:\/\/[^/]+/, '').slice(0, 90)}`).join('\n'));
}
await b.close();
