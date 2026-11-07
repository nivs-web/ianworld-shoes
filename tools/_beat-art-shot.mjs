/**
 * ROPE BEAT 그림 미리보기 캡처 — `node tools/_beat-art-shot.mjs`
 * tools/_beat/art.html(?still)의 1배 도트 버퍼를 꺼내 번짐 없이 4배로 키워 tools/_out/beat-art.png 로 저장한다.
 * 눈으로 보기 쉽게 구역별(폰 · 가로 · 부품 · 포즈)로 잘라 tools/_out/beat-art-<구역>.png 도 같이 만든다.
 * vite 는 5402 번(다른 직원 서버와 겹치지 않게) — 끝나면 반드시 taskkill 로 내린다.
 */
import { chromium } from 'playwright';
import { spawn, execSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import sharp from 'sharp';

const PORT = 5402;
const vite = spawn('npx', ['vite', '--port', String(PORT), '--host', '127.0.0.1', '--strictPort'], { stdio: 'ignore', shell: true });
const killVite = () => { try { execSync(`taskkill /pid ${vite.pid} /T /F`, { stdio: 'ignore' }); } catch { /* 이미 내려감 */ } };
process.on('exit', killVite);

let browser;
try {
  /* vite 가 뜰 때까지 기다린다 */
  for (let i = 0; i < 40; i++) {
    try { const r = await fetch(`http://127.0.0.1:${PORT}/tools/_beat/art.html`); if (r.ok) break; } catch { /* 아직 */ }
    await sleep(300);
  }
  browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`http://127.0.0.1:${PORT}/tools/_beat/art.html?still`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 20000 });
  const info = await page.evaluate(() => ({
    url: document.getElementById('cv').toDataURL('image/png'),
    sections: window.__sections, usedH: window.__usedH, mismatch: window.__handMismatch || 0, perf: window.__perf,
  }));
  const one = Buffer.from(info.url.split(',')[1], 'base64');
  const meta = await sharp(one).metadata();
  const H = Math.min(meta.height, info.usedH + 4);
  const Z = 4;
  await sharp(one).extract({ left: 0, top: 0, width: meta.width, height: H })
    .resize({ width: meta.width * Z, height: H * Z, kernel: 'nearest' }).png().toFile('tools/_out/beat-art.png');
  for (const s of info.sections) {
    const z = s.name.startsWith('poses3x') || s.name === 'phone' || s.name === 'land' ? 2 : 3;
    await sharp(one).extract({ left: s.x, top: s.y, width: Math.min(s.w, meta.width - s.x), height: Math.min(s.h, meta.height - s.y) })
      .resize({ width: Math.min(s.w, meta.width - s.x) * z, kernel: 'nearest' }).png().toFile(`tools/_out/beat-art-${s.name}.png`);
  }
  console.log(`✓ tools/_out/beat-art.png (${meta.width * Z}x${H * Z}) · 구역 ${info.sections.map((s) => s.name).join(', ')} · 손 불일치 ${info.mismatch}`);
  console.log(`한 프레임(ms, 대회장 0~4 피버 켬): ${info.perf?.join(' / ')}`);
  if (errors.length) console.log('오류:', errors.join(' / '));
} finally {
  await browser?.close();
  killVite();
}
