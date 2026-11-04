/**
 * 드래곤 결투 "계속하기" — **진짜 화면 두 창**으로 3판 연속 (2026-11-04)
 *
 *   node tools/_rm/run.mjs
 *
 * 대기방 → 결투 → 결과 → 계속하기 → (자동으로) 다음 판, 을 세 번 돈다.
 * 서버만 가짜(`_sim/rtdb.mjs`, 진짜 규칙의 남의 칸 검증 포함)이고 화면·게임은 진짜다.
 */
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { join } from 'node:path';

const HERE = import.meta.dirname;
const OUT = join(HERE, '../_out');
const server = await createServer({ configFile: join(HERE, 'vite.config.mjs'), logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ channel: 'chrome', args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 840, height: 820 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('[console] ' + m.text()); });
await page.goto('http://127.0.0.1:5199/tools/_rm/index.html');

const fr = (k) => page.frames().find((f) => f.url().includes(`uid=${k}`));
const wait = async (fn, ms = 30000, label = '') => {
  const t0 = Date.now();
  for (;;) { try { if (await fn()) return true; } catch {} if (Date.now() - t0 > ms) { console.log('오류들:', errors.slice(0, 8).join(' || ')); console.log('거부:', await page.evaluate(() => JSON.stringify(window.__SIM.db.denyLog.slice(-5)))); console.log('방:', JSON.stringify(await room())); for (const k of ['A','B']) { try { console.log(k, (await fr(k).evaluate(() => (document.getElementById('ui')?.innerText || '').slice(0, 300) + ' | join=' + window.__join + ' code=' + window.__code))); } catch (e) { console.log(k, 'X', e.message); } } await page.screenshot({ path: join(OUT, 'rm-timeout.png') }); throw new Error('시간 초과: ' + label); } await page.waitForTimeout(150); }
};
await wait(async () => fr('A') && fr('B') && await fr('A').evaluate(() => !!window.__ready) && await fr('B').evaluate(() => !!window.__ready), 60000, '두 창 준비');

const uiText = (k) => fr(k).evaluate(() => document.getElementById('ui')?.innerText || '');
const inGame = (k) => fr(k).evaluate(() => !!document.querySelector('.dragon-stage'));
const click = (k, text) => fr(k).evaluate((t) => {
  const b = [...document.querySelectorAll('#ui button')].find((x) => x.innerText.trim() === t);
  if (!b) return false; b.click(); return true;
}, text);
const room = () => page.evaluate(() => { const c = window.__SIM.code; return c ? window.__SIM.db.read('rooms/' + c) : null; });
/** 지는 쪽을 죽인다 — 하트가 0 이 될 때까지 큰 피해를 넣는다 */
const kill = (k) => fr(k).evaluate(async () => {
  const m = await import('/src/games/dragon/dragon.js');
  const sc = m.__test.scene0();
  const p = sc && sc.p1;
  if (!p || typeof sc.hurtPlayer !== 'function') return false;
  p.lives = 1; p.out = false; p.deadT = 0; p.shieldT = 0; p.hurtT = 0; p.rollT = 0;
  sc.hurtPlayer(p, 99999);
  return true;
});

const DEAD = (await import('../../src/config/strings.ko.js')).default.duelDeadCell;
const log = [];
const ok = (label, v) => { log.push(`${v ? 'ok  ' : 'FAIL'} ${label}`); console.log(log[log.length - 1]); };

/* 1판은 처음 들어온 방 — B 레디, A 시작 */
await wait(async () => (await uiText('B')).includes('레디'), 20000, 'B 대기방');
await click('B', '레디');
await wait(async () => (await room())?.players?.B?.ready === true, 10000, 'B 레디');
await click('A', '시작하기');

const orders = [
  { name: '이긴 방장(A)이 먼저 계속하기', loser: 'B', first: 'A', second: 'B' },
  { name: '진 B 가 먼저 계속하기', loser: 'B', first: 'B', second: 'A' },
  { name: '방장 A 가 진 판, 이긴 B 가 먼저', loser: 'A', first: 'B', second: 'A' },
];
const seeds = [];
for (const [i, o] of orders.entries()) {
  const n = i + 1;
  console.log(`\n── ${n}판: ${o.name}`);
  await wait(async () => await inGame('A') && await inGame('B'), 30000, `${n}판 두 창 게임 진입`);
  ok(`${n}판: 두 창 모두 게임 화면`, true);
  const r0 = await room();
  seeds.push(r0.seed);
  ok(`${n}판: 방 상태 ${r0.state}, 두 사람 모두 참가`, ['A', 'B'].every((u) => r0.players[u] && !r0.players[u].waiting));
  await page.waitForTimeout(5500);           // 카운트다운 + 잠깐 놀기
  if (n === 1) await page.screenshot({ path: join(OUT, `rm-${n}-game.png`) });
  await wait(() => kill(o.loser), 20000, `${n}판 ${o.loser} 쓰러뜨리기`);
  await wait(async () => (await uiText('A')).includes('계속하기') && (await uiText('B')).includes('계속하기'), 30000, `${n}판 결과 화면`);
  ok(`${n}판: 두 창 모두 결과 화면`, true);
  await page.waitForTimeout(1500);
  const rr = await room();
  ok(`${n}판: 진 ${o.loser} 는 방에 '쓰러짐'으로 남는다`, rr.players[o.loser]?.alive === false);
  ok(`${n}판: 진 ${o.loser} 창은 패배, 이긴 쪽 창은 승리`, (await uiText(o.loser)).includes('졌습니다') && (await uiText(o.loser === 'A' ? 'B' : 'A')).includes('이겼습니다'));
  await page.screenshot({ path: join(OUT, `rm-${n}-result.png`) });
  await page.waitForTimeout(800);
  await click(o.first, '계속하기');
  await wait(async () => !(await uiText(o.first)).includes('계속하기'), 15000, `${n}판 ${o.first} 대기방으로`);
  const t1 = await uiText(o.first);
  ok(`${n}판: 먼저 누른 ${o.first} 가 대기방으로 (오류 안 뜸)`, !/네트워크|연결을 확인/.test(t1));
  await page.waitForTimeout(1200);
  ok(`${n}판: ${o.second} 가 아직 결과 화면인데 판이 먼저 시작되지 않는다`, !(await inGame(o.first)) && (await room()).state === 'waiting');
  ok(`${n}판: 아직 결과 화면인 ${o.second} 의 표는 방금 판 그대로 (쓰러진 사람 표시 유지)`, (await uiText(o.second)).includes(DEAD));
  if (n === 1) await page.screenshot({ path: join(OUT, `rm-${n}-half.png`) });
  await click(o.second, '계속하기');
  if (n === orders.length) {
    await wait(async () => await inGame('A') && await inGame('B'), 30000, '4판 자동 시작');
    const r = await room();
    ok(`${n}판 뒤: 둘 다 누르자 4판이 자동으로 시작 (새 씨앗)`, r.seed !== seeds[seeds.length - 1]);
  }
}

await page.screenshot({ path: join(OUT, 'rm-final.png') });
const real = errors.filter((e) => !/favicon|404|serviceWorker|sw\.js|manifest/i.test(e));
console.log('\n오류:', real.length ? real.slice(0, 10).join('\n') : '없음');
console.log(log.some((l) => l.startsWith('FAIL')) ? '결과: 실패 있음' : '결과: 3판 연속 통과');
await browser.close(); await server.close();
process.exit(0);
