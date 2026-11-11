/* 아래 띠만 크게 찍기 (카드 · 화로 칸 점검) */
import { chromium } from 'playwright';
const [out, w, h, dpr] = [process.argv[2], +process.argv[3] || 1280, +process.argv[4] || 800, +process.argv[5] || 2];
const b = await chromium.launch({ channel: 'chrome' }); const p = await (await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr })).newPage();
await p.goto('http://127.0.0.1:5320/tools/idg-gallery/lobby.html'); await new Promise((r) => setTimeout(r, 2500));
await p.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.textContent.includes('모험 시작')).click()); await p.waitForFunction(() => [...document.querySelectorAll('button')].some((x) => x.textContent.includes('출격')), null, { timeout: 20000 });
await p.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.textContent.includes('출격')).click()); await new Promise((r) => setTimeout(r, 2000));
await (await p.$('.idg-bot')).screenshot({ path: out + '-bot.png' });
await p.screenshot({ path: out + '-full.png' });
await b.close();
