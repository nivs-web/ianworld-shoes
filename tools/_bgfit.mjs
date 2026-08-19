/**
 * 배경 큰 그림 팝업 실측 — `npm run qa:bgfit`
 *
 * 이 화면의 규칙은 하나다: **확대는 정수배여야 한다**(§3-1). 눈으로는 1.978배와 2배를
 * 구분할 수 없는데, 실제로 그 차이로 도트가 뭉갠다 — `.bg-cut-stack` 의 테두리가
 * `border-box` 때문에 폭 4px 를 먹어서 356/180 = 1.978 이 나오고 있었다(2026-08-19).
 * 그래서 눈이 아니라 **자로 잰다.** 폰부터 PC 까지 네 폭에서 확인한다.
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { BG } from '../src/config/layout.js';

const CUT_W = BG.tileW;
const CUT_H = BG.tileH + BG.floor1H + BG.roadH;
const PORT = 5196;
const vite = spawn('npx', ['vite', '--port', String(PORT), '--host', '127.0.0.1'], { stdio: 'ignore' });
await sleep(4000);

const exe = process.env.CHROME_PATH || '/opt/pw-browsers/chromium';
const browser = await chromium.launch({ executablePath: exe }).catch(() => chromium.launch());
let fails = 0;
const eq = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : `  (${JSON.stringify(got)} ≠ ${JSON.stringify(want)})`}`);
};

for (const [w, h] of [[320, 568], [390, 844], [412, 915], [1200, 1000]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.goto(`http://127.0.0.1:${PORT}/tools/_bgsettings-preview.html`, { waitUntil: 'networkidle' });
  await page.waitForFunction('window.__ready === true', null, { timeout: 20000 }).catch(() => {});
  const m = await page.evaluate(() => {
    const st = document.querySelector('.bg-cut-stack');
    return [...st.querySelectorAll('img')].map((i) => {
      const r = i.getBoundingClientRect();
      return { nat: [i.naturalWidth, i.naturalHeight], box: [Math.round(r.width), Math.round(r.height)] };
    });
  });
  console.log(`\n${w}×${h}`);
  eq('세 장이 다 있다', m.length, 3);
  for (const im of m) {
    const kx = im.box[0] / im.nat[0];
    const ky = im.box[1] / im.nat[1];
    eq(`${im.nat.join('×')} 배율 ${kx}`, [Number.isInteger(kx), kx === ky, kx >= 1], [true, true, true]);
  }
  // 세 장의 합이 한 컷 높이 × 배율이어야 한다 — 한 장이 빠지면 여기서 걸린다
  const k = m[0].box[0] / CUT_W;
  eq('세 장 높이 합', m.reduce((s, i) => s + i.box[1], 0), CUT_H * k);
  await page.close();
}

await browser.close();
vite.kill();
console.log(fails ? `\n실패 ${fails}건` : '\n큰 그림 배율 이상 없음');
process.exit(fails ? 1 : 0);
