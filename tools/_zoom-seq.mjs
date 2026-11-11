/* 시작 → 확대 순서 캡처 (대표님 폰 2000×923) : 출격 1초(전체 화면) · 9초(1.1배 확대 뒤 · 용 몇 마리 · 하늘 요소) */
import { chromium } from 'playwright';
const OUT = process.argv[2];
const b = await chromium.launch({ channel: 'chrome' });
const p = await (await b.newContext({ viewport: { width: 800, height: 369 }, deviceScaleFactor: 2.5 })).newPage();
const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
await p.goto('http://127.0.0.1:5320/tools/idg-gallery/lobby.html'); await new Promise((r) => setTimeout(r, 2500));
await p.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.textContent.includes('모험')).click());
await p.waitForFunction(() => [...document.querySelectorAll('button')].some((x) => x.textContent.includes('출격')), null, { timeout: 20000 });
await p.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.textContent.includes('출격')).click());
await new Promise((r) => setTimeout(r, 1000));
await p.screenshot({ path: `${OUT}/seq-1-start.png` });
await p.evaluate(() => { window.__idgBattle.S.players[0].money = 9999; const f = window.__idgFun; f.setOff(f.ids); });
for (let i = 0; i < 4; i++) { await p.keyboard.press('1'); await new Promise((r) => setTimeout(r, 700)); }
await new Promise((r) => setTimeout(r, 3500));
await p.evaluate(() => { const f = window.__idgFun; f.trigger('witch'); f.trigger('swarm'); f.trigger('owl'); });
await new Promise((r) => setTimeout(r, 1600));
await p.screenshot({ path: `${OUT}/seq-2-zoomed.png` });
console.log('끝 · 오류', errs.length, errs.slice(0, 3).join(' | '));
await b.close();
