/**
 * 줄넘기 챔피언 — 진짜 화면 자동 시험 · 캡처. `node tools/_jumprope-qa.mjs`
 *
 * vite 로 진짜 화면(tools/_jr/index.html — 라우터만 작은 대역)을 띄우고 폰 크기(390x844)로:
 *   로비 → 스테이지 → 준비 → 게임(자동 플레이: 딱 맞게 / 늦게 / 흔들리게) → 결과 → 보상 반영
 *   줄넘기 고르기 · 꾸미기 · 상점(사기) · 명예의 전당(로그인 없음) · 만들기(코드 왕복) · 설정 · 오락실 카드
 * 화면은 tools/_out/jr-*.png 로 남긴다. 콘솔 오류가 하나라도 있으면 실패.
 */
import { chromium } from 'playwright';
import { spawn, execSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const PORT = 5197;
const vite = spawn('npx', ['vite', '--port', String(PORT), '--host', '127.0.0.1', '--strictPort'], { stdio: 'ignore', shell: true });
const killVite = () => { try { execSync(`taskkill /pid ${vite.pid} /T /F`, { stdio: 'ignore' }); } catch { try { vite.kill(); } catch { /* */ } } };
await sleep(4500);

const browser = await chromium.launch().catch(() => chromium.launch({ channel: 'chrome' }));
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/favicon|status of 404|firestore|firebase|Failed to load resource/i.test(m.text())) errors.push(m.text()); });

let fails = 0;
const check = (c, msg) => { console.log(`  ${c ? '✓' : '✗'} ${msg}`); if (!c) fails++; };
const shot = (name) => page.screenshot({ path: `tools/_out/jr-${name}.png` });
const clickText = async (text, exact = true) => { await page.getByRole('button', { name: text, exact }).first().click(); await sleep(250); };
const dbg = () => page.evaluate(async () => { const d = window.__jrDebug?.(); return d && { phase: d.phase, k: d.k, total: d.total, hearts: d.hearts, count: d.count, perfect: d.perfect, great: d.great, good: d.good, miss: d.miss, score: d.score, result: d.result }; });
const auto = (mode) => page.evaluate((mode) => { const d = window.__jrDebug(); d.setAuto(mode); d.start(); }, mode);
async function waitPhase(ph, ms = 200000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { const d = await dbg(); if (d && d.phase === ph) return d; await sleep(300); }
  return dbg();
}
const jr = () => page.evaluate(() => JSON.parse(localStorage.getItem('sf_profile') || '{}').jr || null);

try {
  await page.goto(`http://127.0.0.1:${PORT}/tools/_jr/index.html`, { waitUntil: 'networkidle' });
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('sf_profile', JSON.stringify({ nickname: '이안' })); });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction('window.__ready === true', null, { timeout: 20000 });
  await sleep(800);

  console.log('1) 로비');
  await shot('01-lobby');
  const lobbyText = await page.locator('#ui').innerText();
  check(lobbyText.includes('캐릭터 꾸미기') && lobbyText.includes('명예의 전당') && lobbyText.includes('상점') && lobbyText.includes('무한 줄넘기'), '로비 버튼들');
  check(/레벨/.test(lobbyText) && /모은 줄넘기/.test(lobbyText) && /총 넘은 횟수/.test(lobbyText), '상태창: 레벨 · 모은 줄넘기 · 총 넘은 횟수');
  check(await page.locator('.char-cell.jr canvas').count() === 1, '상태창 캐릭터(움직이는 그림)');

  console.log('2) 스테이지 1 — 딱 맞게 자동 플레이');
  await clickText('스테이지');
  await sleep(500);
  await shot('02-stages');
  check((await page.locator('.jr-stage').count()) === 10, '스테이지 10개');
  check((await page.locator('.jr-stage.locked').count()) === 9, '처음엔 1번만 열림');
  await page.locator('.jr-stage').first().click();
  await sleep(600);
  await shot('03-ready');
  await clickText('시작!');
  await sleep(1200);
  await shot('04-intro');
  await auto('perfect');
  await sleep(4200);
  await shot('05-play');
  let d = await waitPhase('result');
  await sleep(1500);
  await shot('06-result');
  check(d.phase === 'result' && d.miss === 0 && d.perfect === 20, `스테이지 1 결과: PERFECT ${d.perfect}/20 · 걸림 ${d.miss}`);
  check(d.result?.sum?.stars === 3, `별 ${d.result?.sum?.stars}개`);
  let j = await jr();
  check(j && j.stars.normal[0] === 3 && j.xp > 0 && j.candy > 0 && j.plays === 1 && j.jumps === 20, `저장: 별 3 · 경험치 ${j?.xp} · 별사탕 ${j?.candy} · 넘은 수 ${j?.jumps}`);
  check(d.result?.sum?.lvAfter >= 2 && d.result.sum.newRopes.some((r) => r.id === 'yellow'), `레벨 업 → Lv.${d.result?.sum?.lvAfter} · 새 줄넘기 ${d.result?.sum?.newRopes.map((r) => r.name).join(',')}`);

  console.log('3) 다음 스테이지 → 2번 늦게 눌러 실패');
  await clickText('다음 스테이지');
  await sleep(700);
  check((await page.locator('#ui').innerText()).includes('2. 놀이터'), '다음 스테이지 준비 화면');
  await clickText('시작!');
  await sleep(900);
  await auto('late');
  await sleep(3000);
  await shot('07-trip');
  d = await waitPhase('result', 120000);
  await sleep(1200);
  await shot('08-fail');
  check(d.phase === 'result' && d.hearts === 0 && !d.result?.r?.cleared, `늦게 누르면 걸려 넘어지고 실패 (하트 ${d.hearts} · 걸림 ${d.miss})`);
  j = await jr();
  check(j.stars.normal[1] === 0, '실패한 스테이지는 별 0');

  console.log('4) 스테이지 6 (2단 뛰기) — 열어 두고 딱 맞게');
  await page.evaluate(() => { const p = JSON.parse(localStorage.getItem('sf_profile')); p.jr.stars.normal = [3, 2, 2, 1, 1, 0, 0, 0, 0, 0]; localStorage.setItem('sf_profile', JSON.stringify(p)); });
  await clickText('로비로');
  await sleep(400);
  await page.locator('.jr-stage').nth(5).click();
  await sleep(500);
  await clickText('시작!');
  await sleep(900);
  await auto('perfect');
  /* 2단 뛰기 순간을 잡는다 */
  for (let i = 0; i < 80; i++) {
    const s = await page.evaluate(() => window.__jrDebug?.()?.k);
    if (s >= 9) break;
    await sleep(150);
  }
  await sleep(250);
  await shot('09-double');
  d = await waitPhase('result');
  await sleep(1000);
  await shot('10-result6');
  check(d.miss === 0 && d.perfect === d.total, `스테이지 6 (2단 뛰기 포함) PERFECT ${d.perfect}/${d.total}`);

  console.log('5) 무한 줄넘기 — 흔들리게 30번쯤 → 늦게 눌러 끝');
  await clickText('로비로');
  await sleep(300);
  await page.getByRole('button', { name: '게임 로비로' }).click();
  await sleep(500);
  await clickText('무한 줄넘기');
  await sleep(600);
  await shot('11-endless-ready');
  await clickText('시작!');
  await sleep(900);
  await auto('sloppy');
  for (let i = 0; i < 600; i++) { const s = await dbg(); if (s.count >= 32) break; await sleep(250); }
  await shot('12-endless');
  await auto('late');
  d = await waitPhase('result', 120000);
  await sleep(1200);
  await shot('13-endless-result');
  j = await jr();
  check(d.phase === 'result' && j.endless.normal >= 30, `무한 줄넘기 기록 ${j.endless.normal}개 저장`);

  console.log('6) 줄넘기 고르기 · 꾸미기 · 상점');
  await clickText('로비로');
  await sleep(500);
  await shot('14-lobby-after');
  await clickText('줄넘기 고르기');
  await sleep(500);
  await shot('15-ropes');
  check((await page.locator('.jr-card').count()) === 27, '줄넘기 27개 진열');
  await page.locator('.jr-card', { hasText: '노랑 줄넘기' }).click();
  await sleep(300);
  j = await jr();
  check(j.rope === 'yellow', '얻은 줄넘기(노랑)로 바꾸기');
  await page.getByRole('button', { name: '게임 로비로' }).click();
  await sleep(300);
  await clickText('캐릭터 꾸미기');
  await sleep(500);
  await page.locator('.jr-chip', { hasText: '양갈래' }).click();
  await sleep(300);
  await page.locator('.jr-chip', { hasText: '모자' }).first().click();
  await sleep(300);
  await page.locator('.jr-chip', { hasText: '리본' }).click();
  await sleep(300);
  await shot('16-closet');
  j = await jr();
  check(/^j0230..3/.test(j.look) || j.look.length === 10, `꾸미기 저장 (${j.look})`);
  await page.getByRole('button', { name: '게임 로비로' }).click();
  await sleep(300);
  await page.evaluate(() => { const p = JSON.parse(localStorage.getItem('sf_profile')); p.jr.candy = 2000; localStorage.setItem('sf_profile', JSON.stringify(p)); });
  await clickText('상점');
  await sleep(400);
  await page.locator('.jr-item', { hasText: '보호막' }).getByRole('button').click();
  await sleep(300);
  await shot('17-shop-items');
  await clickText('줄넘기');
  await sleep(300);
  await page.locator('.jr-item', { hasText: '레몬 줄넘기' }).getByRole('button').click();
  await sleep(300);
  await page.locator('.dialog').getByRole('button', { name: '살래요' }).click();
  await sleep(400);
  await shot('18-shop-ropes');
  j = await jr();
  check(j.items.shield === 1 && j.owned.includes('rope:lemon') && j.rope === 'lemon' && j.candy === 2000 - 30 - 150, `상점: 보호막 1 · 레몬 줄넘기 · 남은 별사탕 ${j.candy}`);
  await clickText('옷 · 모자');
  await sleep(300);
  await shot('19-shop-wear');
  await page.getByRole('button', { name: '뒤로' }).click();
  await sleep(300);

  console.log('7) 보호막 쓰고 스테이지 1 — 한 번 늦게 눌러도 하트 그대로');
  await clickText('스테이지');
  await sleep(300);
  await page.locator('.jr-stage').first().click();
  await sleep(400);
  await page.locator('.jr-item', { hasText: '보호막' }).getByRole('button').click();
  await sleep(200);
  await clickText('시작!');
  await sleep(900);
  await auto('late');
  for (let i = 0; i < 40; i++) { const s = await dbg(); if (s.k >= 1) break; await sleep(150); }
  d = await dbg();
  check(d.hearts === 3 && d.count === 1, `보호막: 첫 번째 걸림을 막음 (하트 ${d.hearts})`);
  await page.evaluate(() => window.__jrDebug().setAuto('perfect'));
  d = await waitPhase('result');
  check(d.result?.r?.cleared && (await jr()).items.shield === 0, '보호막은 한 번 쓰면 없어짐');
  await clickText('로비로');
  await sleep(300);
  await page.getByRole('button', { name: '게임 로비로' }).click();
  await sleep(300);

  console.log('8) 명예의 전당 · 설정');
  await clickText('명예의 전당');
  await sleep(1500);
  await shot('20-ranking');
  check((await page.locator('#ui').innerText()).includes('내 기록'), '명예의 전당: 내 기록 칸 (로그인 없음 → 순위 대신 안내)');
  await page.getByRole('button', { name: '게임 로비로' }).click();
  await sleep(300);
  await clickText('설정 · 하는 법');
  await sleep(400);
  await shot('21-settings');
  await page.getByRole('button', { name: '게임 로비로' }).click();
  await sleep(300);

  console.log('9) 스테이지 만들기 — 새로 만들기 · 조각 추가 · 코드 · 가져오기 · 시험');
  await clickText('스테이지 만들기');
  await sleep(400);
  await clickText('새로 만들기');
  await sleep(400);
  await clickText('+ 조각 추가');
  await sleep(200);
  await page.locator('.jr-box .jr-chip', { hasText: '2단 뛰기' }).click();
  await sleep(200);
  await shot('22-editor');
  const code = await page.evaluate(async () => {
    const J = await import('/src/services/jumprope.js');
    const E = await import('/src/games/jumprope/engine.js');
    return E.encodeStage(J.myStages()[0]);
  });
  check(code.startsWith('JR1-'), `코드 ${code.length}자`);
  await page.getByRole('button', { name: '목록으로' }).click();
  await sleep(300);
  await page.locator('textarea.jr-code').fill(`이거 해봐 ${code}`);
  await clickText('가져오기');
  await sleep(400);
  await shot('23-editor-list');
  const mine = await page.evaluate(async () => (await import('/src/services/jumprope.js')).myStages().length);
  check(mine === 2, `코드로 가져와 내 스테이지 ${mine}개`);
  await page.locator('.jr-stage').first().click();
  await sleep(300);
  await clickText('시험해 보기');
  await sleep(900);
  await auto('perfect');
  d = await waitPhase('result');
  check(d.result?.r?.cleared && d.result?.r?.mode === 'test', `만든 스테이지 시험 클리어 (${d.total}박)`);
  await clickText('만들기로 돌아가기');
  await sleep(300);
  check((await page.locator('#ui').innerText()).includes('스테이지 고치기'), '시험 뒤 만들기 화면으로 돌아옴');

  console.log('10) 일시정지 · 가로 화면 · 오락실 카드');
  await page.getByRole('button', { name: '목록으로' }).click();
  await page.getByRole('button', { name: '게임 로비로' }).click();
  await sleep(300);
  await page.setViewportSize({ width: 844, height: 390 });
  await clickText('스테이지');
  await page.locator('.jr-stage').nth(2).click();
  await sleep(300);
  await clickText('시작!');
  await sleep(900);
  await auto('perfect');
  await sleep(3500);
  await shot('24-landscape');
  await page.keyboard.press('Escape');
  await sleep(400);
  await shot('25-pause');
  check((await dbg()).phase === 'pause', 'ESC = 일시정지');
  await clickText('계속하기');
  let resumed = false;
  for (let i = 0; i < 40 && !resumed; i++) { await sleep(200); resumed = ['play', 'trip', 'end', 'result'].includes((await dbg()).phase); }
  check(resumed, '계속하기 → «준비» 뒤 다시 돈다');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`http://127.0.0.1:${PORT}/tools/_jr/index.html?start=portal`, { waitUntil: 'networkidle' });
  await sleep(1500);
  await page.locator('.gc', { hasText: '무한 줄넘기 최고' }).scrollIntoViewIfNeeded();
  await sleep(500);
  await shot('26-portal');
  check(await page.locator('img.gc-art[alt="줄넘기 챔피언"]').count() === 1, '오락실 첫 화면 5번째 카드');
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
