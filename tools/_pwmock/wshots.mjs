import { chromium } from 'playwright';
const OUT = 'C:/Users/ARIANC~1/AppData/Local/Temp/claude/C--Users-ariancepc-Desktop-cowork-iandragon/5339b06b-10e0-463d-b750-5be29792c438/scratchpad/pack/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
const U = 'http://127.0.0.1:5397/tools/_pwmock/index.html?cl=94&seen=1&gifts=done&coins=99999&gems=999';
const click = (p, t, sel = 'button') => p.evaluate(([t, sel]) => { const x = [...document.querySelectorAll(sel)].filter((y) => y.offsetParent && y.textContent.replace(/\s/g, '').includes(t)).pop(); x?.click(); return !!x; }, [t, sel]);
const p = await (await b.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2 })).newPage();
const shots = [['shop-dragon', ['아이템샵']], ['shop-castle', ['아이템샵', '드래곤캐슬']], ['shop-deal', ['아이템샵', '특가']], ['shop-cons', ['아이템샵', '편의품']], ['lab', ['연구소']], ['look', ['꾸미기']], ['hatch', ['부화장']], ['multi', ['멀티게임']], ['more', ['더보기']], ['stage', ['더보기', '스테이지']], ['codex', ['더보기', '도감']], ['settings', ['더보기', '설정', '화면']], ['powerup', ['파워업']], ['quest', ['도전과제']]];
for (const [n, path] of shots) {
  await p.goto(U); await sleep(2300);
  for (const t of path) { await click(p, t); await sleep(900); }
  await p.screenshot({ path: OUT + `W-${n}.png` });
}
await b.close();
