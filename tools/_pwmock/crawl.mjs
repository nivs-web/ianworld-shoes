import { chromium } from 'playwright';
const OUT = 'C:/Users/ARIANC~1/AppData/Local/Temp/claude/C--Users-ariancepc-Desktop-cowork-iandragon/5339b06b-10e0-463d-b750-5be29792c438/scratchpad/shots_ga/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
const Q = 'cl=94&seen=1&gifts=done&coins=99999&gems=999';
const probe = () => [...document.querySelectorAll('body *')].filter((e) => e.offsetParent && e.childNodes.length && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())).map((e) => { const c = getComputedStyle(e); const fs = parseFloat(c.fontSize); const ts = c.textShadow; const big2 = /\b2px\b/.test(ts) ; return { t: e.textContent.trim().slice(0, 14), cls: (e.className + '').slice(0, 40), fs: +fs.toFixed(1), fw: c.fontWeight, o2: big2, frac: Math.abs(fs - Math.round(fs)) > 0.05 }; }).filter((x) => (x.o2 && x.fs < 17) );
for (const [w, h, tag] of [[844, 390, 'L'], [390, 844, 'P']]) {
  const p = await (await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2 })).newPage();
  await p.goto(`http://127.0.0.1:5397/tools/_pwmock/index.html?${Q}`); await sleep(3500);
  await p.screenshot({ path: OUT + `${tag}-lobby.png` });
  console.log(tag, 'lobby o2 small', JSON.stringify(await p.evaluate(probe)).slice(0, 900));
  for (const name of ['스테이지','연구소','꾸미기','더보기','부화장','멀티게임','좀비습격','도전과제','파워업','모험시작']) {
    const ok = await p.evaluate((n) => { const x = [...document.querySelectorAll('button,[role=button]')].find((y) => y.offsetParent && y.textContent.replace(/\s/g, '').includes(n)); x?.click(); return !!x; }, name);
    if (!ok) { console.log(tag, name, 'none'); continue; }
    await sleep(1200); await p.screenshot({ path: OUT + `${tag}-w-${name}.png` });
    console.log(tag, name, JSON.stringify(await p.evaluate(probe)).slice(0, 600));
    await p.keyboard.press('Escape'); await sleep(500);
    await p.goto(`http://127.0.0.1:5397/tools/_pwmock/index.html?${Q}`); await sleep(2500);
  }
  await p.context().close();
}
await b.close();
