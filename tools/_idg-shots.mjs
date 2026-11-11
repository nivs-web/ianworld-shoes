/**
 * 좀비와 드래곤 화면 캡처 점검 (겜부장 · 2026-11-11 대표님 «게임을 해 보고 캡처하면서 고칠 곳을 찾아라»)
 *   node tools/_idg-shots.mjs [출력 폴더] [기기들=pc,tab,phone]
 * 개발 서버(127.0.0.1:5320)의 로비 갤러리(로그인 없이 진짜 로비)를 열어 기기 크기마다 찍는다 :
 *   로비 · 하는 법 · 음악 출처 · 스테이지 고르기 · 연구소 · 시작 카드 · 전투(HUD) · 재미 요소 · 일시정지 · 승리 카드 · 패배 카드
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const OUT = process.argv[2] || 'tools/_out/idg-shots';
const WANT = (process.argv[3] || 'pc,tab,phone').split(',');
const DEV = {
  pc: { lobby: { width: 1280, height: 800 }, game: { width: 1280, height: 800 }, dpr: 1 },
  pcfhd: { lobby: { width: 1920, height: 1080 }, game: { width: 1920, height: 1080 }, dpr: 1 },
  tab: { lobby: { width: 820, height: 1180 }, game: { width: 1180, height: 820 }, dpr: 2 },
  phone: { lobby: { width: 390, height: 844 }, game: { width: 844, height: 390 }, dpr: 3 },
};
fs.mkdirSync(OUT, { recursive: true });
const URL = 'http://127.0.0.1:5320/tools/idg-gallery/lobby.html';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ channel: 'chrome' });   // 이 컴퓨터 크롬 (Playwright 브라우저를 따로 받지 않음)
for (const name of WANT) {
  const d = DEV[name]; if (!d) continue;
  const ctx = await browser.newContext({ viewport: d.lobby, deviceScaleFactor: d.dpr });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
  const shot = async (tag) => { const f = path.join(OUT, `${name}-${tag}.png`); await page.screenshot({ path: f }); console.log('  ' + f); };
  const clickText = (t) => page.evaluate((t) => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes(t)); if (b) b.click(); return !!b; }, t);
  const closeTop = () => page.evaluate(() => document.querySelector('.dialog-overlay:last-of-type')?.click());
  await page.goto(URL); await sleep(2500);
  await shot('lobby');
  await page.evaluate(() => window.scrollTo(0, 99999)); await sleep(300); await shot('lobby-bottom');
  await page.evaluate(() => window.scrollTo(0, 0));
  if (await clickText('하는 법')) { await sleep(500); await shot('how'); }
  if (await clickText('음악 출처')) { await sleep(500); await shot('credits'); await page.evaluate(() => { const l = document.querySelector('.idg-credits-list'); if (l) l.scrollTop = 9999; }); await sleep(200); await shot('credits-scrolled'); await closeTop(); }
  if (await clickText('스테이지 고르기')) { await sleep(500); await shot('stages'); await closeTop(); }
  if (await clickText('연구소')) { await sleep(700); await shot('lab'); await page.evaluate(() => { const l = document.querySelector('.idg-lab'); if (l) l.scrollTop = 400; }); await sleep(200); await shot('lab-scrolled'); await closeTop(); }
  /* 전투 */
  await page.setViewportSize(d.game); await sleep(300);
  await clickText('모험 시작'); await sleep(4000);
  await shot('intro');
  await clickText('출격'); await sleep(2500);
  await page.evaluate(() => { const f = window.__idgFun; if (f) { f.setOff(f.ids); f.trigger('owl'); f.trigger('moon'); f.trigger('spider'); f.trigger('cat'); } });
  await sleep(1600); await shot('battle');
  await page.evaluate(() => { const B = window.__idgBattle; if (B) { B.S.players[0].money = 99999; B.S.players[0].breathT = B.S.players[0].breathCharge; } });
  await sleep(500); await shot('battle-ready');
  await page.keyboard.press('p'); await sleep(500); await shot('pause'); await page.keyboard.press('p'); await sleep(300);
  await page.evaluate(() => { const B = window.__idgBattle; if (B) B.S.base[1].hp = 0; });
  await sleep(1200); await shot('win-anim');
  await sleep(2500); await shot('win');
  console.log(`${name} 끝 · 오류 ${errs.length}${errs.length ? '\n   ' + errs.slice(0, 5).join('\n   ') : ''}`);
  await ctx.close();
}
await browser.close();
