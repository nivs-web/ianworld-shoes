/* 날개 · 꼬리 표 점검 (11/11 밤) : 용 여럿(퉤퉤 포함)을 전투에 내보내 실제 모습 찍기 */
import { chromium } from 'playwright';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch({ channel: 'chrome' }); const p = await (await b.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1.5 })).newPage(); const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
await p.goto('http://127.0.0.1:5320/tools/idg-gallery/lobby.html'); await sleep(1200);
await p.evaluate(async () => { const L = await import('/src/services/storageLocal.js'); const q = L.loadProfile(); L.patchProfile({ idg: { ...(q.idg || {}), cleared: 14, coins: 50000, units: { twetwe: [12, 0], bulttong: [10, 0], doldeung: [5, 0], kkomul: [9, 0], ssaeng: [3, 0] }, deck: ['twetwe', 'bulttong', 'doldeung', 'kkomul', 'ssaeng'] } }); });
await p.reload(); await sleep(1800);
await p.evaluate(() => [...document.querySelectorAll('button')].find((x) => /모험/.test(x.textContent))?.click()); await sleep(4500);
await p.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.textContent.includes('출격'))?.click()); await sleep(2500);
await p.evaluate(() => { const B = window.__idgBattle; B.S.players[0].money = 99999; for (let i = 0; i < 5; i++) B.cmds.push({ p: 0, type: 'spawn', i }); });
await sleep(1800); await p.evaluate(() => { const B = window.__idgBattle; B.view.setCam(0); window.__idgFun?.setOff(window.__idgFun.ids); }); await sleep(800);
await p.screenshot({ path: 'tools/_out/rig-battle.png' }); console.log('오류', errs.length, errs[0] || ''); await b.close();
