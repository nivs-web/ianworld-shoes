/**
 * 프레임 비용 측정 (진단 전용) — `npm run perf:frame`
 * 결과를 표로 찍고 `tools/_out/frameperf.json` 에 남긴다(고치기 전/후 비교용).
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { writeFileSync, existsSync, readFileSync } from 'node:fs';

const PORT = 5195;
/**
 * ⚠ vite 는 `npx` 아래에서 돌아 `kill()` 이 껍데기만 죽인다 — 서버가 살아남아 다음
 *   실행에서 포트를 빼앗고, 그러면 검사가 **엉뚱한 이유로 실패한다**(2026-08-19 16차에
 *   qa:hoffit 이 '줄이 0개' 로 실패했다 — 코드는 멀쩡했다). 프로세스 **그룹째** 죽인다.
 */
const vite = spawn('npx', ['vite', '--port', String(PORT), '--host', '127.0.0.1'], { stdio: 'ignore', detached: true });
await sleep(4000);
const exe = process.env.CHROME_PATH || '/opt/pw-browsers/chromium';
const browser = await chromium.launch({ executablePath: exe }).catch(() => chromium.launch());
const page = await browser.newPage({ viewport: { width: 400, height: 700 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`http://127.0.0.1:${PORT}/tools/_frameperf.html`, { waitUntil: 'networkidle' });
await page.waitForFunction('window.__ready === true', null, { timeout: 30000 }).catch(() => {});
const rows = await page.evaluate(() => window.__perf ?? null);
const g = await page.evaluate(() => window.__glyphs ?? null);
await browser.close();
(() => { try { process.kill(-vite.pid); } catch { vite.kill(); } })();

if (!rows) { console.error('측정 실패', errors.slice(0, 3)); process.exit(1); }

const OUT = 'tools/_out/frameperf.json';
const prev = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : null;
const before = new Map((prev?.rows ?? []).map((r) => [r.label, r]));

console.log('항목                       ms/프레임   fillRect  drawImage');
for (const r of rows) {
  const b = before.get(r.label);
  const d = b ? `   (이전 ${b.ms}ms · fillRect ${b.fillRect})` : '';
  console.log(`${r.label.padEnd(24)} ${String(r.ms).padStart(7)}  ${String(r.fillRect).padStart(8)}  ${String(r.drawImage).padStart(8)}${d}`);
}
/** 16.7ms 를 넘으면 그 화면은 60fps 를 못 낸다 — 그게 곧 "버벅임"이다 */
if (g) {
  const 빡빡 = g.used > g.max * 0.85;
  console.log(`\n글리프 캐시 ${g.used}/${g.max}${빡빡 ? '  ★ 상한에 가깝다 — 넘치면 캐시가 손해가 된다' : ''}`);
}
const 느린것 = rows.filter((r) => r.ms > 16.7);
writeFileSync(OUT, JSON.stringify({ rows }, null, 2) + '\n');
console.log(느린것.length ? `\n★ 16.7ms(60fps) 초과: ${느린것.map((r) => r.label).join(', ')}` : '\n전부 60fps 예산 안');
console.log(errors.length ? `오류 ${errors.length}건: ${errors[0]}` : '');
