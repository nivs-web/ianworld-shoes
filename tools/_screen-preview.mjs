/**
 * 인게임 캔버스 화면 미리보기 (진단 전용) — `npm run preview:screens`
 * 폰트를 바꾸면 모든 줄의 자리가 틀어진다. 한 장에 모아 놓고 눈으로 확인한다.
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const PORT = 5198;
/**
 * ⚠ vite 는 `npx` 아래에서 돌아 `kill()` 이 껍데기만 죽인다 — 서버가 살아남아 다음
 *   실행에서 포트를 빼앗고, 그러면 검사가 **엉뚱한 이유로 실패한다**(2026-08-19 16차에
 *   qa:hoffit 이 '줄이 0개' 로 실패했다 — 코드는 멀쩡했다). 프로세스 **그룹째** 죽인다.
 */
const vite = spawn('npx', ['vite', '--port', String(PORT), '--host', '127.0.0.1'], { stdio: 'ignore', detached: true });
await sleep(4000);
const exe = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({ executablePath: exe }).catch(() => chromium.launch());
const page = await browser.newPage({ viewport: { width: 1200, height: 1100 }, deviceScaleFactor: 2 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
/**
 * 파비콘 404 는 늘 뜬다(이 저장소에는 favicon.ico 가 없다). 그걸 오류로 세면
 * 미리보기가 **항상 실패로 보여서** 진짜 오류가 묻힌다 — 실제로 한동안 그랬다.
 */
page.on('console', (m) => {
  if (m.type() !== 'error') return;
  const t = m.text();
  if (/favicon|status of 404/.test(t)) return;
  errors.push(t);
});
const TARGETS = { result: '_result-preview', room: '_room-preview', rooms: '_roomlist-preview', bg: '_bgsettings-preview', hof: '_hof-preview', msg: '_msg-preview' };
const target = TARGETS[process.argv[2]] ?? '_screen-preview';
await page.goto(`http://127.0.0.1:${PORT}/tools/${target}.html`, { waitUntil: 'networkidle' });
await page.waitForFunction('window.__ready === true', null, { timeout: 20000 }).catch(() => {});
const out = `tools/_out/${process.argv[2] && TARGETS[process.argv[2]] ? process.argv[2] : 'screens'}.png`;
await page.screenshot({ path: out, fullPage: true });
await browser.close();
(() => { try { process.kill(-vite.pid); } catch { vite.kill(); } })();
console.log(errors.length ? `오류 ${errors.length}건:\n${errors.join('\n')}` : `미리보기 저장: ${out}`);
