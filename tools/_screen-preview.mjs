/**
 * 인게임 캔버스 화면 미리보기 (진단 전용) — `npm run preview:screens`
 * 폰트를 바꾸면 모든 줄의 자리가 틀어진다. 한 장에 모아 놓고 눈으로 확인한다.
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const PORT = 5198;
const vite = spawn('npx', ['vite', '--port', String(PORT), '--host', '127.0.0.1'], { stdio: 'ignore' });
await sleep(4000);
const exe = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({ executablePath: exe }).catch(() => chromium.launch());
const page = await browser.newPage({ viewport: { width: 780, height: 1100 }, deviceScaleFactor: 2 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(`http://127.0.0.1:${PORT}/tools/_screen-preview.html`, { waitUntil: 'networkidle' });
await page.waitForFunction('window.__ready === true', null, { timeout: 20000 }).catch(() => {});
await page.screenshot({ path: 'tools/_out/screens.png', fullPage: true });
await browser.close();
vite.kill();
console.log(errors.length ? `오류 ${errors.length}건: ${errors[0]}` : '미리보기 저장: tools/_out/screens.png');
