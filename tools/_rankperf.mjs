/**
 * 순위표 한 장을 그리는 데 드는 비용. (2026-08-21 30차)
 *
 * 30차에 줄 그림이 캐릭터 png 한 장에서 **착용 모습**(최대 네 장)으로 바뀌었다.
 * 101줄이면 그림이 100장에서 300장이 넘는다 — 늘어난 값을 짐작하지 않고 잰다.
 *
 * 프레임마다 도는 비용이 아니라 **탭을 옮길 때 한 번** 드는 비용이다. 그래서
 * `perf:frame` 이 아니라 따로 있다. 재는 방법은 줄을 통째로 다시 만들고
 * **강제 레이아웃**까지 걸어 보는 것 — 만들기만 하고 안 재면 브라우저가 미룬다.
 *
 *   node tools/_rankperf.mjs
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
const PORT = 5299;
const vite = spawn('npx', ['vite', '--port', String(PORT), '--host', '127.0.0.1'], { stdio: 'ignore', detached: true });
const kill = () => { try { process.kill(-vite.pid, 'SIGKILL'); } catch {} };
process.on('uncaughtException', (e) => { console.error(e); kill(); process.exit(1); });
await sleep(4500);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => chromium.launch());
const p = await b.newPage({ viewport: { width: 390, height: 900 } });
await p.goto(`http://127.0.0.1:${PORT}/tools/_hofscreen-preview.html?rows=101&mine=55`, { waitUntil: 'networkidle' });
const r = await p.evaluate(() => {
  const list = document.querySelector('.rank-list');
  const html = list.innerHTML;
  // 줄을 통째로 다시 만들고 **강제 레이아웃**까지 재는 것이 실제 렌더 비용에 가깝다
  const t0 = performance.now();
  list.innerHTML = '';
  list.innerHTML = html;
  list.getBoundingClientRect();
  document.querySelectorAll('.rank-row').forEach((el) => el.scrollWidth);
  const t1 = performance.now();
  return {
    ms: +(t1 - t0).toFixed(2),
    rows: document.querySelectorAll('.rank-row').length,
    imgs: document.querySelectorAll('.rank-list img').length,
    nodes: document.querySelectorAll('*').length,
  };
});
// 견줄 값: 아이템 그림을 걷어 내고(=예전 모양) 같은 방법으로 다시 잰다
const base = await p.evaluate(() => {
  const list = document.querySelector('.rank-list');
  list.querySelectorAll('.rank-figure').forEach((f) => {
    const imgs = [...f.querySelectorAll('img')];
    imgs.slice(0, -1).forEach((i) => i.remove());
  });
  const html = list.innerHTML;
  const t0 = performance.now();
  list.innerHTML = '';
  list.innerHTML = html;
  list.getBoundingClientRect();
  document.querySelectorAll('.rank-row').forEach((el) => el.scrollWidth);
  return { ms: +(performance.now() - t0).toFixed(2), imgs: document.querySelectorAll('.rank-list img').length };
});
console.log(JSON.stringify(r), '  vs 아이템 없음', JSON.stringify(base));
await b.close(); kill();
