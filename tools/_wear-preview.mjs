/**
 * 아이템 착용 미리보기 — `npm run preview:wear`
 *
 * 계단 위에서 아이템이 어디에 붙는지는 **실기기로 판을 돌려야** 보인다. 좌표는
 * 쇼핑 화면과 같은 표에서 나오지만 배율(1.5)과 좌우 반전이 끼므로, 표가 맞아도
 * 화면이 틀릴 수 있다 — 그래서 진짜 `Player` 를 불러 한 장씩 찍는다.
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const PORT = 5255;
/** ⚠ npx 아래의 vite 는 kill() 로 안 죽는다 — 그룹째, 터졌을 때도 (§9-0-53) */
const vite = spawn('npx', ['vite', '--port', String(PORT), '--host', '127.0.0.1'], { stdio: 'ignore', detached: true });
const killVite = () => { try { process.kill(-vite.pid, 'SIGKILL'); } catch { vite.kill('SIGKILL'); } };
process.on('uncaughtException', (e) => { console.error(e); killVite(); process.exit(1); });
process.on('unhandledRejection', (e) => { console.error(e); killVite(); process.exit(1); });
await sleep(4000);

const exe = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({ executablePath: exe }).catch(() => chromium.launch());
const page = await browser.newPage({ viewport: { width: 400, height: 700 }, deviceScaleFactor: 3 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { // favicon.ico 는 이 저장소에 없다 — 진짜 오류가 그 뒤에 묻히면 안 된다 (§9-0-41)
  if (m.type() === 'error' && !/favicon|status of 404/.test(m.text())) errors.push('console: ' + m.text()); });

const shots = [
  ['front', 'hat_crown,wing_angel,pet_dog', 'wear_front'],
  ['right', 'hat_crown,wing_angel,pet_dog', 'wear_right'],
  ['left', 'hat_crown,wing_angel,pet_dog', 'wear_left'],
  ['right', 'hat_ironman,wing_devil,pet_cat', 'wear_right2'],
  ['right', 'hat_batman,wing_dove,pet_star', 'wear_right3'],
  ['ghost', 'hat_crown,wing_angel,pet_dog', 'wear_ghost'],
  // 계단 사이 상승 컷 — 접힌 날개 + 파란 번개 (2026-08-21)
  ['jump', 'hat_crown,wing_angel,pet_dog', 'wear_jump'],
  ['jumpleft', 'hat_batman,wing_devil,pet_dog', 'wear_jump2'],
  // 아이템 없이 — **일반 상승 번개**만 보이는지 (아이템이 가리면 확인이 안 된다)
  ['jump', '', 'wear_jump_bare'],
];
for (const [cut, items, file] of shots) {
  await page.goto(`http://127.0.0.1:${PORT}/tools/_wear-preview.html?cut=${cut}&items=${items}`, { waitUntil: 'networkidle' });
  await page.waitForFunction('window.__ready === true', null, { timeout: 15000 }).catch(() => {});
  await (await page.$('canvas'))?.screenshot({ path: `tools/_out/${file}.png` });
}
await browser.close();
killVite();

console.log(errors.length ? `오류 ${errors.length}건: ${errors[0]}` : `미리보기 ${shots.length}장 저장: tools/_out/wear_*.png`);
process.exit(errors.length ? 1 : 0);
