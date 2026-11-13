/**
 * 그림 담당 — 조립 점검 자세 사진 (2026-11-12) : 점검 화면(rigcheck.html)을 실제로 띄워 자세마다 원래 / 고친 것을 찍는다.
 * 게임 rig.js 의 움직임 그대로 (쉬기 · 걷기 두 박자 · 공격 · 맞음).
 *
 *   (개발 서버 5330 이 떠 있어야 한다)  node tools/idg-rigcheck-poses.mjs [id …] [--out public/admin/idg-gallery-review]
 *   → <out>/boss_<id>_before.png · boss_<id>_after.png  (보스가 아니면 rig_<id>_…)
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const OUT = args.includes('--out') ? args[args.indexOf('--out') + 1] : 'public/admin/idg-gallery-review';
const BEFORE = args.includes('--before') ? args[args.indexOf('--before') + 1] : 'raw';   // prev = 용 표(rigfix_dragon) 전의 게임 모습
const ids = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--out' && args[i - 1] !== '--before');
const URL0 = process.env.RIGCHECK_URL || 'http://127.0.0.1:5330/tools/idg-gallery/rigcheck.html';
/* 걷기 박자 : 좀비 ph = t·5.5 → sin(ph) = ±1 인 때 · 공격 = 다 휘두른 때 · 맞음 = 뒤로 젖힌 때 */
const POSES = [['쉬기', 'idle', 0], ['걷기 1', 'walk', Math.PI / 2 / 5.5], ['걷기 2', 'walk', Math.PI * 1.5 / 5.5], ['공격', 'fore', 0.35], ['맞음', 'hit', 0.2]];
const W = 360, H = 400;

const label = (t, w) => Buffer.from(`<svg width="${w}" height="34" xmlns="http://www.w3.org/2000/svg"><text x="10" y="24" font-size="20" font-family="Malgun Gothic,Arial" fill="#fff">${t}</text></svg>`);

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1600, height: 1100 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.error('페이지 오류', e.message));
await page.goto(`${URL0}#${ids[0] || 'bossLord'}`);
await page.waitForFunction(() => window.__rigcheck?.ready, null, { timeout: 30000 });
await page.evaluate((m) => window.__rigcheck.setBefore(m), BEFORE);
await page.evaluate(() => { localStorage.removeItem('idg_rigcheck_draft_v1'); const s = document.querySelector('#scale'); s.value = '2'; s.dispatchEvent(new Event('input')); const b = document.querySelector('#boxes'); b.checked = false; b.dispatchEvent(new Event('change')); });
fs.mkdirSync(OUT, { recursive: true });

for (const id of ids.length ? ids : ['bossLord']) {
  await page.evaluate((x) => window.__rigcheck.pick(x), id);
  await page.waitForTimeout(400);
  const shots = { before: [], after: [] };
  for (const [name, st, t] of POSES) {
    await page.evaluate(([s, tt]) => window.__rigcheck.pose(s, 10 + tt, tt), [st, t]);
    await page.waitForTimeout(80);
    for (const key of ['before', 'after']) {
      const box = await page.locator(key === 'before' ? '#stBefore canvas' : '#stAfter canvas').boundingBox();
      const buf = await page.screenshot({ clip: { x: box.x + box.width / 2 - W / 2, y: box.y + box.height - H, width: W, height: H } });
      shots[key].push({ name, buf });
    }
  }
  for (const key of ['before', 'after']) {
    const comp = [{ input: label(`${id} · ${key === 'before' ? (BEFORE === 'prev' ? '고치기 전 (지금 게임)' : '고치기 전 (rig.json 그대로)') : (/^boss/.test(id) ? '고친 뒤 (rigfix_boss.json)' : BEFORE === 'prev' ? '고친 뒤 (rigfix_dragon_v2.json)' : '고친 뒤 (rigfix_zombie.json)')}`, W * POSES.length), left: 0, top: 0 }];
    shots[key].forEach((s, i) => { comp.push({ input: s.buf, left: i * W, top: 34 + 30 }, { input: label(s.name, W), left: i * W, top: 34 }); });
    const file = path.join(OUT, `${/^boss/.test(id) ? 'boss' : 'rig'}_${id}_${key}.png`);
    await sharp({ create: { width: W * POSES.length, height: H + 64, channels: 3, background: '#120c22' } }).composite(comp).png().toFile(file);
    console.log('→', file);
  }
}
await browser.close();
