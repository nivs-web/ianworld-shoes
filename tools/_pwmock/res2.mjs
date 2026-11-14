import { chromium } from 'playwright';
const OUT = 'C:/Users/ARIANC~1/AppData/Local/Temp/claude/C--Users-ariancepc-Desktop-cowork-iandragon/5339b06b-10e0-463d-b750-5be29792c438/scratchpad/shots_ca/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch({ channel: 'chrome' });
for (const [w, hh] of [[844, 390], [1280, 720]]) for (const kind of ['win', 'win2', 'lose']) {
  const p = await (await b.newContext({ viewport: { width: w, height: hh }, deviceScaleFactor: 2 })).newPage();
  await p.goto('http://127.0.0.1:5391/tools/_pwmock/index.html?cl=44&seen=1&gifts=done'); await sleep(3000);
  await p.evaluate(() => [...document.querySelectorAll('button')].filter((y) => y.textContent.replace(/\s/g, '').startsWith('모험시작')).pop()?.click());
  await p.waitForFunction(() => window.__idgBattle?.S, null, { timeout: 60000 }); await sleep(2000);
  if (kind === 'lose') await p.evaluate(() => window.__idgHud.showPanel('lose', { t: 7, coins: 0, gems: 0, hint: '화로를 올리면 불씨가 더 빨리 모여요!' }));
  else await p.evaluate((k) => window.__idgHud.showPanel('win', { t: 98, coins: 1850, gems: 12, stars: 3, diff: 'normal', hasNext: true, unlocks: k === 'win2' ? ['리더 솔라리스', '덱 칸 +1', '어려움 열림', '월드 6 열림', '새 드래곤 슬롯 열림', '새 칭호 «불꽃 기사»'] : ['리더 솔라리스', '덱 칸 +1'] }), kind);
  await sleep(2200); await p.screenshot({ path: OUT + `res2-${kind}-${w}.png` }); await p.context().close();
}
await b.close();
