/**
 * 성 · 배경 점검 (겜부장 11/11 · 대표님 기기 검토 3번) : 깃발 · 횃불 · 고양이 · 부엉이 · 센 보스 · 보스 · 성 무너짐 순서 캡처
 *   node tools/_castle-shot.mjs [출력 폴더] [lose]
 */
import { chromium } from 'playwright';
import fs from 'node:fs'; import path from 'node:path';
const OUT = process.argv[2] || 'tools/_out/castle'; const LOSE = process.argv[3] === 'lose';
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({ channel: 'chrome' });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
const shot = async (t) => { await page.screenshot({ path: path.join(OUT, t + '.png') }); console.log(' ' + t); };
const clickText = (t) => page.evaluate((t) => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes(t)); if (b) b.click(); return !!b; }, t);
await page.goto('http://127.0.0.1:5320/tools/idg-gallery/lobby.html'); await sleep(2500);
await page.evaluate(async () => { const L = await import('/src/services/storageLocal.js'); const p = L.loadProfile(); L.patchProfile({ idg: { ...(p.idg || {}), look: 'f2' } }); });   /* 깃발 꾸미기 */
await clickText('모험'); await sleep(4000); await clickText('출격'); await sleep(8000);   /* 확대 끝날 때까지 */
await page.evaluate(() => { const f = window.__idgFun; if (f) { f.setOff(f.ids); f.trigger('owl'); f.trigger('cat'); } });
await sleep(1500); await shot('01-castle-flag-cat-owl');
/* 고양이 (울타리 = 오른쪽) */ await page.evaluate(() => { const V = window.__idgBattle?.view; if (V) V.setCam(700); const f = window.__idgFun; if (f) f.trigger('window'); }); await sleep(1500); await shot('01b-cat');
await page.evaluate(() => { const B = window.__idgBattle; B.S.lines.push({ id: 'chubby', count: 1, left: 1, next: 0, armed: true, boss: true, every: 999 }, { id: 'walker', count: 2, left: 2, next: 0, armed: true, every: 0.4 }); });
await sleep(1200); await page.evaluate(() => { const B = window.__idgBattle; for (const u of B.S.units) if (u.side === 1) { u.x = Math.min(u.x, B.S.L * 0.75); } });
await sleep(1500); await shot('02-midboss');
await page.evaluate(() => { const B = window.__idgBattle; B.S.lines.push({ id: 'bossFat', count: 1, left: 1, next: 0, armed: true, boss: true, every: 999 }); });
await sleep(1500); await page.evaluate(() => { const B = window.__idgBattle; for (const u of B.S.units) if (u.boss && u.def.boss) u.x = B.S.L * 0.7; });
await sleep(2500); await shot('03-boss');
await page.evaluate((lose) => { const B = window.__idgBattle; B.S.base[lose ? 0 : 1].hp = 0; }, LOSE);
for (const [ms, t] of [[600, '10-boom'], [250, '11-blink'], [300, '12-blink2'], [450, '13-crumble'], [450, '14-crumble2'], [700, '15-rubble']]) { await sleep(ms); await shot(t); }
console.log('오류', errs.length, errs.slice(0, 3).join('\n'));
await browser.close();
