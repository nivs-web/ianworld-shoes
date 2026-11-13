/**
 * 드래곤캐슬 연출 점검 (⑤ 핵심 보조 · 11/13) : 수호 불꽃 · 대포 · 경보 종 — 가로 844×390
 *   node tools/_guard-shot.mjs [포트=5367] [출력 폴더]
 */
import { chromium } from 'playwright';
import fs from 'node:fs'; import path from 'node:path';
const PORT = process.argv[2] || '5367', OUT = process.argv[3] || 'tools/_out/guard';
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({ channel: 'chrome' });
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
const shot = async (t) => { await page.screenshot({ path: path.join(OUT, t + '.png') }); console.log(' ' + t); };
const clickText = (t) => page.evaluate((t) => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes(t)); if (b) b.click(); return !!b; }, t);
await page.goto(`http://127.0.0.1:${PORT}/tools/idg-gallery/lobby.html`); await sleep(3000);
await page.evaluate(async () => { const L = await import('/src/services/storageLocal.js'); const p = L.loadProfile(); L.patchProfile({ idg: { ...(p.idg || {}), cleared: Math.max(30, p.idg?.cleared || 0) } }); });
await clickText('모험'); await sleep(4000); await clickText('출격'); await sleep(6000); await clickText('시작하기'); await sleep(2500);
const ok = await page.evaluate(() => !!window.__idgBattle);
if (!ok) { console.log('전투 없음', errs); await shot('00-fail'); await browser.close(); process.exit(1); }
/* 대포 Lv5 · 종 Lv5 를 끼운 것처럼 (저장 정리 코드가 합쳐지기 전이라 화면 점검용으로 상태에 직접) */
await page.evaluate(() => { const B = window.__idgBattle, S = B.S; S.players[0].cannon = { dmg: 200, every: 6, range: 600, splash: 80, kb: 0.3 }; S.players[0].cannonT = 5.5; S.base[0].bell = { freeze: 4, at: [0.5, 0.25] }; S.castle = true; S.players[0].money = 0; B.view.setCam(0); });
await page.evaluate(() => { const S = window.__idgBattle.S; S.lines.push({ id: 'walker', count: 8, left: 8, next: 0, armed: true, every: 0.3 }); });
await sleep(1200);
await page.evaluate(() => { const S = window.__idgBattle.S; for (const u of S.units) if (u.side === 1) u.x = Math.min(u.x, 300 + (u.id % 5) * 30); S.players[0].guardT = 2.4; });
for (let i = 0; i < 10; i++) { await sleep(110); await shot('guard-' + i); }
await page.evaluate(() => { const S = window.__idgBattle.S; S.lines.push({ id: 'walker', count: 6, left: 6, next: 0, armed: true, every: 0.2 }); });
await sleep(1500);
await page.evaluate(() => { const S = window.__idgBattle.S; S.players[0].cannonT = 6; S.players[0].guardT = 0; for (const u of S.units) if (u.side === 1) u.x = Math.min(u.x, 420); });
for (let i = 0; i < 8; i++) { await sleep(70); await shot('cannon-' + i); }
await page.evaluate(() => { const S = window.__idgBattle.S; for (const u of S.units) if (u.side === 1) u.x = Math.min(u.x, 200); S.base[0].hp = S.base[0].maxHp * 0.45; });
for (let i = 0; i < 8; i++) { await sleep(110); await shot('bell-' + i); }
console.log('오류', errs.length ? errs : '없음');
await browser.close();
