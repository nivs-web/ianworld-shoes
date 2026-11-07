/**
 * 줄넘기 챔피언 — 스테이지 10개 배경 · 가로 화면을 한 장씩 찍어 한 장으로 모은다. `node tools/_jumprope-shots.mjs`
 * (규칙 확인용: 픽셀아트 · 정수배 · 글자 겹침). 결과: tools/_out/jr-themes.png · jr-landscape.png
 */
import { chromium } from 'playwright';
import { spawn, execSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import sharp from 'sharp';

const PORT = 5196;
const vite = spawn('npx', ['vite', '--port', String(PORT), '--host', '127.0.0.1', '--strictPort'], { stdio: 'ignore', shell: true });
const killVite = () => { try { execSync(`taskkill /pid ${vite.pid} /T /F`, { stdio: 'ignore' }); } catch { /* */ } };
await sleep(4500);
const browser = await chromium.launch().catch(() => chromium.launch({ channel: 'chrome' }));
const errors = [];

async function shot(page, stageNo, name) {
  await page.evaluate(async (no) => {
    const R = await import('/src/screens/JumpRopeGame.js');
    window.__nav.reset(R.default, { mode: no ? 'stage' : 'endless', stageNo: no || 1 });
  }, stageNo);
  await page.waitForFunction(() => window.__jrDebug?.()?.phase === 'intro', null, { timeout: 20000 });
  await page.evaluate(() => { const d = window.__jrDebug(); d.setAuto('perfect'); d.start(); d.skipCount(); });
  await page.waitForFunction(() => (window.__jrDebug?.()?.k || 0) >= 3, null, { timeout: 60000 });
  await page.screenshot({ path: `tools/_out/${name}.png` });
}

const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`http://127.0.0.1:${PORT}/tools/_jr/index.html`, { waitUntil: 'networkidle' });
await page.evaluate(() => { localStorage.clear(); const one = Array(10).fill(1); localStorage.setItem('sf_profile', JSON.stringify({ nickname: '이안', jr: { xp: 2000, candy: 999, stars: { easy: one, normal: one, hard: one }, look: 'j1230732' + '50', rope: 'rainbow' } })); });
await page.reload({ waitUntil: 'networkidle' });
const files = [];
for (let no = 1; no <= 10; no++) { await shot(page, no, `jr-th-${no}`); files.push(`tools/_out/jr-th-${no}.png`); }
await shot(page, 0, 'jr-th-endless'); files.push('tools/_out/jr-th-endless.png');
await page.setViewportSize({ width: 844, height: 390 });
await shot(page, 6, 'jr-landscape');
await browser.close();
killVite();

const bufs = await Promise.all(files.map((f) => sharp(f).resize({ height: 600 }).png().toBuffer()));
const ms = await Promise.all(bufs.map((b) => sharp(b).metadata()));
const cols = 6, cw = ms[0].width, rows = Math.ceil(bufs.length / cols);
await sharp({ create: { width: cols * (cw + 4), height: rows * 604, channels: 3, background: '#000' } })
  .composite(bufs.map((b, i) => ({ input: b, left: (i % cols) * (cw + 4), top: Math.floor(i / cols) * 604 })))
  .png().toFile('tools/_out/jr-themes.png');
console.log(errors.length ? `오류: ${errors.join(' / ')}` : '✓ 캡처 완료: tools/_out/jr-themes.png · jr-landscape.png');
