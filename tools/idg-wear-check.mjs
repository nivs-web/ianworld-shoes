/**
 * 착용 점검표 찍기 (겜보조 1 · 11/13) — 머리 없는 크롬 하나
 *   node tools/idg-wear-check.mjs <출력 폴더> [hat,neck,body] [포트=5366] [only=a,b] [d=novart,...]
 * 대장 드래곤 10마리 × 모자 30 / 목 장식 24 를 실제 게임 그리기 규칙(tools/idg-gallery/wear-check.html)으로 입혀 한 장씩 찍는다.
 * 파일 : <출력 폴더>/착용점검_모자.png · 착용점검_목.png · 착용점검_전신.png(body = 실제 로비 크기 전신 · 드래곤 3 × 모자 6) · 칸 번호가 필요하면 only= 로 일부만.
 * vite 는 따로 켜 둔다 (npx vite --port 5366 --host 127.0.0.1)
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const OUT = process.argv[2] || 'tools/_out/wear';
const KINDS = (process.argv[3] || 'hat,neck,body').split(',');
const PORT = process.argv[4] || '5366';
const extra = process.argv.slice(5).filter((a) => /^(only|d|scale)=/.test(a)).join('&');
const NAME = { hat: '모자', neck: '목', body: '전신' };
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] });
for (const kind of KINDS) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  const errs = []; page.on('pageerror', (e) => errs.push(String(e))); page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
  await page.goto(`http://127.0.0.1:${PORT}/tools/idg-gallery/wear-check.html?kind=${kind}${extra ? '&' + extra : ''}`);
  await page.waitForFunction(() => window.__ready, null, { timeout: 120000 });
  const f = path.join(OUT, `착용점검_${NAME[kind]}${extra.includes('only=') || extra.includes('d=') ? '_일부' : ''}.png`);
  await page.locator('#wrap').screenshot({ path: f });
  console.log(f, errs.length ? '오류 ' + errs.join(' | ') : '오류 0');
  await page.close();
}
await browser.close();
