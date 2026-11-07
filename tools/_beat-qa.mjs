/**
 * 줄넘기 챔피언 · ROPE BEAT — 진짜 화면 자동 시험 · 캡처. `node tools/_beat-qa.mjs [--quick]`
 *
 * vite 로 진짜 화면(tools/_jr/index.html — 라우터만 작은 대역)을 띄우고 폰 크기(390x844)로:
 *   로비 → 챔피언십 → 대회 1 준비 → 게임(자동 연주: 완벽 / ROPE 안 치기 / 흔들기) → 결과 → 저장
 *   일시정지·계속 · 대회 5(보통·어려움) 완주 · 무한(흔들다 손 떼기) · 가로 화면 · 타이밍 맞추기 화면
 * 자동 연주는 노트의 «곡 시각»에 정확히 누른다 — 프레임이 느려도 판정은 정확하다(리듬게임 원칙).
 * 화면은 tools/_out/rb-*.png. 콘솔 오류가 하나라도 있으면 실패.
 */
import { chromium } from 'playwright';
import { spawn, execSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const QUICK = process.argv.includes('--quick');
const PORT = 5198;
const vite = spawn('npx', ['vite', '--port', String(PORT), '--host', '127.0.0.1', '--strictPort'], { stdio: 'ignore', shell: true });
const killVite = () => { try { execSync(`taskkill /pid ${vite.pid} /T /F`, { stdio: 'ignore' }); } catch { /* */ } };
await sleep(4500);

const browser = await chromium.launch({ channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/favicon|status of 404|firestore|firebase|Failed to load resource|pretendard/i.test(m.text())) errors.push(m.text()); });

let fails = 0;
const check = (c, msg) => { console.log(`  ${c ? '✓' : '✗'} ${msg}`); if (!c) fails++; };
const shot = (name) => page.screenshot({ path: `tools/_out/rb-${name}.png` });
const dbg = () => page.evaluate(() => { const d = window.__rbDebug?.(); if (!d) return null; const { setAuto, start, ...rest } = d; return JSON.parse(JSON.stringify(rest)); });
const jr = () => page.evaluate(() => JSON.parse(localStorage.getItem('sf_profile') || '{}').jr || null);
async function waitFor(fn, ms) { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = await fn(); if (v) return v; await sleep(300); } return null; }

/** 대회/무한 한 판 — 게임 화면을 바로 열고 자동 연주 */
async function play(params, auto, { shotAt = [], until = 'result', timeout = 150000 } = {}) {
  await page.evaluate(async (p) => { const R = await import('/src/screens/JumpRopeGame.js'); window.__nav.reset(R.default, p); }, params);
  await waitFor(async () => (await dbg())?.phase === 'ready', 20000);
  await page.evaluate((a) => { const d = window.__rbDebug(); d.setAuto(a); d.start(); }, auto);
  const t0 = Date.now();
  const taken = new Set();
  while (Date.now() - t0 < timeout) {
    const d = await dbg();
    if (!d) break;
    for (const s of shotAt) if (!taken.has(s.name) && d.songT >= s.t) { taken.add(s.name); await shot(s.name); }
    if (d.phase === until || d.phase === 'result') return d;
    await sleep(250);
  }
  return dbg();
}

try {
  await page.goto(`http://127.0.0.1:${PORT}/tools/_jr/index.html`, { waitUntil: 'networkidle' });
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('sf_profile', JSON.stringify({ nickname: '이안' })); });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction('window.__ready === true', null, { timeout: 20000 });
  await sleep(800);

  console.log('1) 로비 · 챔피언십 · 준비');
  await shot('01-lobby');
  await page.getByRole('button', { name: '챔피언십', exact: true }).click();
  await sleep(500);
  check((await page.locator('.jr-guide').count()) === 1, '처음 누르면 모드 설명 팝업');
  await shot('01b-guide');
  await page.getByRole('button', { name: '시작하기' }).click();
  await sleep(700);
  await shot('02-stages');
  check((await page.locator('.jr-stage').count()) === 5, '대회 5개');
  check((await page.locator('.jr-stage.locked').count()) === 4, '처음엔 대회 1만 열림');
  await page.locator('.jr-stage').first().click();
  await sleep(700);
  await shot('03-ready');
  check((await page.locator('#ui').innerText()).includes('First Bounce'), '준비 화면: 곡 이름');

  console.log('2) 대회 1 (보통) — 완벽 자동 연주');
  let d = await play({ mode: 'stage', stageNo: 1 }, 'perfect', { shotAt: [{ name: '04-play', t: 14 }, { name: '05-play-b', t: 30 }] });
  await sleep(2200);
  await shot('06-result');
  const r1 = d?.result?.r;
  check(r1 && r1.cleared && r1.miss === 0 && r1.perfect === d.notes, `완주 · PERFECT ${r1?.perfect}/${d?.notes} · MISS ${r1?.miss}`);
  check(r1?.rank === 'S' && r1?.stars === 3, `등급 ${r1?.rank} · 별 ${r1?.stars}`);
  check(r1 && r1.maxCombo === r1.perfect, `콤보 = PERFECT 수 (${r1?.maxCombo})`);
  check(d?.ctrl === 'jump' && r1?.ctrl === 'jump', `기본은 점프만 (${d?.ctrl})`);
  const j1 = await jr();
  check(j1 && j1.stars.normal[0] === 3 && j1.xp > 0 && j1.candy > 0, `저장: 별 ${j1?.stars?.normal?.[0]} · 경험치 ${j1?.xp} · 별사탕 ${j1?.candy}`);

  console.log('3) 로프+점프 — ROPE 를 안 치면 ROPE MISS 로 탈락');
  await page.evaluate(() => { const p = JSON.parse(localStorage.getItem('sf_profile')); p.jr.opts = { ...(p.jr.opts || {}), ctrl: 'both' }; localStorage.setItem('sf_profile', JSON.stringify(p)); });
  d = await play({ mode: 'stage', stageNo: 1 }, 'ropeless', { timeout: 90000 });
  check(d?.ctrl === 'both', `로프+점프 고름 → 두 버튼 (${d?.ctrl})`);
  check(d?.result?.r && !d.result.r.cleared && d.result.r.miss > 0, `ROPE 없이 JUMP 만 → 실패 (MISS ${d?.result?.r?.miss})`);
  await sleep(1500);
  await shot('07-fail');
  await page.evaluate(() => { const p = JSON.parse(localStorage.getItem('sf_profile')); p.jr.opts.ctrl = 'jump'; localStorage.setItem('sf_profile', JSON.stringify(p)); });

  console.log('4) 일시정지 → 계속');
  await play({ mode: 'stage', stageNo: 2 }, 'perfect', { until: 'never', timeout: 9000 });
  await page.keyboard.press('Escape');
  await sleep(500);
  const p1 = await dbg();
  await shot('08-pause');
  await sleep(1500);
  const p2 = await dbg();
  check(p1?.phase === 'pause' && Math.abs((p2?.songT ?? 0) - (p1?.songT ?? 0)) < 0.05, `일시정지 동안 곡 시계 멈춤 (${p1?.songT?.toFixed(2)} → ${p2?.songT?.toFixed(2)})`);
  await page.getByRole('button', { name: '계속하기' }).click();
  const back = await waitFor(async () => { const x = await dbg(); return x?.phase === 'play' && x.songT > (p2?.songT ?? 0) + 0.3 ? x : null; }, 8000);
  check(!!back, '계속하기 → 3·2·1 뒤 이어서 진행');

  if (!QUICK) {
    console.log('5) 대회 5 (보통 · 어려움) 완벽 자동 연주 — 템포 변화 구간 포함');
    for (const diff of ['normal', 'hard']) {
      await page.evaluate((df) => { const p = JSON.parse(localStorage.getItem('sf_profile')); p.jr.diff = df; localStorage.setItem('sf_profile', JSON.stringify(p)); }, diff);
      d = await play({ mode: 'stage', stageNo: 5 }, 'perfect', { shotAt: diff === 'hard' ? [{ name: '09-world-hard', t: 20 }, { name: '10-world-slow', t: 41 }, { name: '11-world-final', t: 52 }] : [] });
      const r = d?.result?.r;
      check(r && r.cleared && r.miss === 0 && r.perfect === d.notes, `대회 5 ${diff}: PERFECT ${r?.perfect}/${d?.notes} · 점수 ${r?.score}`);
    }
    console.log('6) 무한 — 흔들다가 손을 떼면 끝');
    d = await play({ mode: 'endless' }, 'sloppy', { until: 'never', timeout: 25000 });
    await shot('12-endless');
    await page.evaluate(() => window.__rbDebug().setAuto('none'));
    d = await waitFor(async () => { const x = await dbg(); return x?.phase === 'result' ? x : null; }, 30000);
    check(d?.result?.r && d.result.r.count > 10, `무한 끝 · 넘은 수 ${d?.result?.r?.count}`);
  }

  console.log('7) 가로 화면 · 타이밍 맞추기');
  await page.setViewportSize({ width: 844, height: 390 });
  await play({ mode: 'stage', stageNo: 1 }, 'perfect', { shotAt: [{ name: '13-landscape', t: 16 }], until: 'never', timeout: 24000 });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(async () => { const R = await import('/src/screens/jumprope/JrCalibrate.js'); window.__nav.reset(R.default); });
  await sleep(800);
  await shot('14-calibrate');
  check((await page.locator('#ui').innerText()).includes('타이밍 맞추기'), '타이밍 맞추기 화면');
} catch (e) {
  fails++;
  console.log('✗ 시험 중단:', e.message);
  await shot('zz-error').catch(() => {});
}

await browser.close();
killVite();
if (errors.length) { console.log(`콘솔 오류 ${errors.length}건:\n  ${[...new Set(errors)].slice(0, 12).join('\n  ')}`); fails++; }
console.log(fails ? `\n✗ 실패 ${fails}건` : '\n✓ 전부 통과');
process.exit(fails ? 1 : 0);
