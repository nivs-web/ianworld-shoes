/**
 * 레이스 게이지 미리보기 (진단 전용) — `npm run preview:hud`
 *
 * 인게임 HUD 는 **실기기 두 대로 판을 돌려야** 보이는 화면이라, 눈금 위치나
 * 테두리 칸 같은 건 매번 눈으로 확인할 수가 없다. 그래서 가짜 방 상태를 넣고
 * 캔버스만 따로 찍는다 — 실제로 이걸로 두 가지를 잡았다:
 *   · 6칸 테두리에 구분선이 없어 **몇 칸 남았는지 셀 수 없었다**
 *   · 알림 글자가 게이지 눈금·얼굴 위로 올라탔다
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const PORT = 5199;
/**
 * ⚠ vite 는 `npx` 아래에서 돌아 `kill()` 이 껍데기만 죽인다 — 서버가 살아남아 다음
 *   실행에서 포트를 빼앗고, 그러면 검사가 **엉뚱한 이유로 실패한다**(2026-08-19 16차에
 *   qa:hoffit 이 '줄이 0개' 로 실패했다 — 코드는 멀쩡했다). 프로세스 **그룹째** 죽인다.
 */
const vite = spawn('npx', ['vite', '--port', String(PORT), '--host', '127.0.0.1'], { stdio: 'ignore', detached: true });
await sleep(4000);

const exe = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({ executablePath: exe }).catch(() => chromium.launch());
const page = await browser.newPage({ viewport: { width: 400, height: 700 }, deviceScaleFactor: 3 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
/** 기본 화면 + 26차의 세 상태 — 한 장씩 남긴다 */
for (const [state, file] of [['', 'hud'], ['exit', 'hud_exit'], ['pause', 'hud_pause'], ['menu', 'hud_menu']]) {
  await page.goto(`http://127.0.0.1:${PORT}/tools/_hud-preview.html?state=${state}`, { waitUntil: 'networkidle' });
  await page.waitForFunction('window.__ready === true', null, { timeout: 15000 }).catch(() => {});
  await (await page.$('canvas'))?.screenshot({ path: `tools/_out/${file}.png` });
}
await browser.close();
(() => { try { process.kill(-vite.pid); } catch { vite.kill(); } })();

console.log(errors.length ? `오류 ${errors.length}건: ${errors[0]}` : '미리보기 저장: tools/_out/hud.png');
process.exit(errors.length ? 1 : 0);
