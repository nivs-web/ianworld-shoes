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
  phone2k: { lobby: { width: 369, height: 800 }, game: { width: 800, height: 369 }, dpr: 2.5 },   // 대표님 폰 캡처 2000×923 과 같은 비율 · 크기
  phoneport: { lobby: { width: 390, height: 844 }, game: { width: 390, height: 844 }, dpr: 3 },   // 폰 세로로 게임
  tab16: { lobby: { width: 800, height: 1280 }, game: { width: 1280, height: 800 }, dpr: 2 },   // 16:10 태블릿 가로
  phonebar: { lobby: { width: 360, height: 780 }, game: { width: 780, height: 340 }, dpr: 3 },   // 주소창이 보이는 폰 가로 (대표님 캡처 비율)
  /* 11/11 대표님 3차 점검표 : 세로 · 가로 × 폰 20:9 · 16:9 · 태블릿 4:3 · 16:10 (로비 · 전투 같은 방향) */
  p209: { lobby: { width: 412, height: 915 }, game: { width: 412, height: 915 }, dpr: 2.6 },
  p209L: { lobby: { width: 915, height: 412 }, game: { width: 915, height: 412 }, dpr: 2.6 },
  p169: { lobby: { width: 360, height: 640 }, game: { width: 360, height: 640 }, dpr: 3 },
  p169L: { lobby: { width: 640, height: 360 }, game: { width: 640, height: 360 }, dpr: 3 },
  t43: { lobby: { width: 768, height: 1024 }, game: { width: 768, height: 1024 }, dpr: 2 },
  t43L: { lobby: { width: 1024, height: 768 }, game: { width: 1024, height: 768 }, dpr: 2 },
  t1610: { lobby: { width: 800, height: 1280 }, game: { width: 800, height: 1280 }, dpr: 2 },
  t1610L: { lobby: { width: 1280, height: 800 }, game: { width: 1280, height: 800 }, dpr: 2 },
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
  if (await clickText('명예의 전당')) { await sleep(1500); await shot('hall'); await closeTop(); }
  /* 로비 창 전부 (창 공통 규칙 점검) */
  if (process.env.WINDOWS) for (const t of ['파워업', '부화장', '멀티게임', '좀비습격', '도전과제', '드래곤샵', '꾸미기', '스테이지']) { if (await clickText(t)) { await sleep(700); await shot('win-' + t.replace(/s/g, '')); await closeTop(); await sleep(200); } }
  if (process.env.WINDOWS && await clickText('더보기')) { await sleep(500); await shot('win-더보기'); for (const t of ['도감', '음향 설정', '명예의 전당', '게임하는 법']) { if (await clickText(t)) { await sleep(800); await shot('win-' + t.replace(/s/g, '')); await closeTop(); await sleep(200); } } await closeTop(); }
  if (process.env.LOBBY_ONLY) { await ctx.close(); continue; }
  /* 전투 */
  await page.setViewportSize(d.game); await sleep(300);
  await clickText('모험'); await sleep(4000);
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
  if (await clickText('파워 업')) { await sleep(500); await shot('powerup'); }
  console.log(`${name} 끝 · 오류 ${errs.length}${errs.length ? '\n   ' + errs.slice(0, 5).join('\n   ') : ''}`);
  await ctx.close();
}
await browser.close();
