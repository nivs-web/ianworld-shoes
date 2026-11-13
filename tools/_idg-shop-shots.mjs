/**
 * 아이템 샵 화면 찍기 (겜보조 1 · 11/13) — 머리 없는 크롬
 *   node tools/_idg-shop-shots.mjs <출력 폴더> [기기들=phone,p169,land] [포트=5364]
 * 로비 갤러리(로그인 없이 진짜 로비)에서 샵을 가짜 저장값으로 열어 큰 메뉴 · 하위 메뉴마다 찍는다.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const OUT = process.argv[2] || 'tools/_out/idg-shop';
const WANT = (process.argv[3] || 'phone,p169,land').split(',');
const PORT = process.argv[4] || '5364';
const DEV = { phone: { width: 390, height: 844, dpr: 2 }, p169: { width: 360, height: 640, dpr: 2 }, land: { width: 844, height: 390, dpr: 2 }, land169: { width: 640, height: 360, dpr: 2 } };
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const URL = `http://127.0.0.1:${PORT}/tools/idg-gallery/lobby.html`;

const browser = await chromium.launch({ channel: 'chrome' });
for (const name of WANT) {
  const d = DEV[name]; if (!d) continue;
  const ctx = await browser.newContext({ viewport: { width: d.width, height: d.height }, deviceScaleFactor: d.dpr });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e))); page.on('response', (r) => { if (r.status() >= 400) errs.push(r.status() + ' ' + r.url()); }); page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
  await page.goto(URL); await sleep(2000);
  await page.evaluate(async () => {
    const m = await import('/src/screens/idgShop.js');
    const st = { coins: 30000, gems: 120, owned: ['hat:pumpkin', 'neck:scarf'], look: 'h0.n0.b0.f0.r0.t0', cons: {}, cleared: 12 };
    window.__st = st;
    window.__shop = () => m.showShop({ idg: { ...st }, save: (p) => { Object.assign(st, p); return { ...st }; }, onClose: () => {} });
    window.__shop();
  });
  await sleep(900);
  const shot = async (tag) => { const f = path.join(OUT, `${name}-${tag}.png`); await page.screenshot({ path: f }); console.log('  ' + f); };
  const click = (t, root = '.idg-shop') => page.evaluate(([t, root]) => { const b = [...document.querySelectorAll(`${root} button`)].find((x) => x.textContent.trim() === t); if (b) b.click(); return !!b; }, [t, root]);
  await shot('0-dragon');
  for (const [big, subs] of [['드래곤', ['모자', '목 장식', '브레스 색', '오라']], ['드래곤캐슬', ['깃발', '지붕']], ['특가', []], ['편의품', []]]) {
    await click(big); await sleep(400);
    if (!subs.length) { await shot(`1-${big}`); continue; }
    for (const s of subs) { await click(s); await sleep(500); await shot(`1-${big}-${s}`); }
  }
  await click('드래곤'); await click('모자'); await sleep(300);
  /* 사기 : 첫 번째 값 단추 */
  await page.evaluate(() => document.querySelector('.idg-shop-card.buy .idg-k-btn.price')?.click()); await sleep(500); await shot('2-bought');
  await page.evaluate(() => [...document.querySelectorAll('.idg-shop-card .idg-k-btn.green')].find((b) => b.textContent.includes('바로 입기'))?.click()); await sleep(500); await shot('3-worn');
  console.log(`${name} 끝 · 오류 ${errs.length}${errs.length ? '\n   ' + errs.slice(0, 5).join('\n   ') : ''}`);
  await ctx.close();
}
await browser.close();
