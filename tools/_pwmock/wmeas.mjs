import { chromium } from 'playwright';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
const U = 'http://127.0.0.1:5397/tools/_pwmock/index.html?cl=94&seen=1&gifts=done&coins=99999&gems=999';
const click = (p, t, sel = 'button') => p.evaluate(([t, sel]) => { const x = [...document.querySelectorAll(sel)].filter((y) => y.offsetParent && y.textContent.replace(/\s/g, '').includes(t)).pop(); x?.click(); return !!x; }, [t, sel]);
const meas = (p) => p.evaluate(() => { const d = [...document.querySelectorAll('.dialog')].pop(); if (!d) return null; const r = d.getBoundingClientRect(); return { cls: d.className.replace(/dialog\s*/, '').slice(0, 40), w: Math.round(r.width), pct: Math.round(r.width / innerWidth * 100), h: Math.round(r.height) }; });
const W = process.argv[2] ? process.argv[2].split(',').map((s) => s.split('x').map(Number)) : [[844, 390], [1280, 720], [2340, 1080]];
for (const [w, h] of W) {
  const p = await (await b.newContext({ viewport: { width: w, height: h } })).newPage();
  const out = [];
  for (const path of [['연구소'], ['아이템샵'], ['꾸미기'], ['부화장'], ['도전과제'], ['멀티게임'], ['파워업'], ['더보기'], ['더보기', '스테이지'], ['더보기', '도감'], ['더보기', '설정'], ['더보기', '게임하는법'], ['더보기', '명예의전당'], ['더보기', '음악출처']]) {
    await p.goto(U); await sleep(2200);
    for (const t of path) { await click(p, t); await sleep(900); }
    out.push(path.join('>') + ' ' + JSON.stringify(await meas(p)));
  }
  console.log(`== ${w}x${h}\n` + out.join('\n'));
  await p.context().close();
}
await b.close();
