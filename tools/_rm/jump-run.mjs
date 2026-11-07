/**
 * 줄넘기 멀티 서바이벌 — **진짜 화면 세 창** (2026-11-07)
 *
 *   node tools/_rm/jump-run.mjs
 *
 * 대기방(방장이 방식 고르기) → 레디 → 시작 → 세 창이 같은 줄로 동시에 → 둘이 손을 놓아 탈락 →
 * 마지막 한 명(A) 우승 → 세 창의 결과가 같다 → «같은 방에서 한 판 더» → 2판은 «로프+점프».
 * 서버만 가짜(`_sim/rtdb.mjs`, 남의 칸 검증 포함)이고 화면 · 게임 · 판정은 진짜다.
 */
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { join } from 'node:path';

const HERE = import.meta.dirname;
const OUT = join(HERE, '../_out');
const server = await createServer({ configFile: join(HERE, 'vite.config.mjs'), logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1110, height: 760 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('[console] ' + m.text()); });
await page.goto('http://127.0.0.1:5199/tools/_rm/jump.html');

const U = ['A', 'B', 'C'];
const fr = (k) => page.frames().find((f) => f.url().includes(`uid=${k}`));
const room = () => page.evaluate(() => { const c = window.__SIM.code; return c ? window.__SIM.db.read('rooms/' + c) : null; });
const uiText = (k) => fr(k).evaluate(() => document.getElementById('ui')?.innerText || '');
const click = (k, text) => fr(k).evaluate((t) => {
  const b = [...document.querySelectorAll('#ui button')].find((x) => x.innerText.trim() === t);
  if (!b) return false; b.click(); return true;
}, text);
const dbg = (k) => fr(k).evaluate(() => { const d = window.__rbDebug?.(); if (!d) return null; return { phase: d.phase, ctrl: d.ctrl, songT: d.songT, hearts: d.hearts, out: d.out, notes: d.notes, perfect: d.perfect, miss: d.miss, status: d.status, won: d.result?.r?.won, rank: d.result?.r?.rank }; });
const wait = async (fn, ms = 30000, label = '') => {
  const t0 = Date.now();
  for (;;) {
    try { if (await fn()) return true; } catch { /* 다시 */ }
    if (Date.now() - t0 > ms) {
      console.log('오류들:', errors.slice(0, 8).join(' || '));
      console.log('거부:', await page.evaluate(() => JSON.stringify(window.__SIM.db.denyLog.slice(-5))));
      console.log('방:', JSON.stringify(await room()).slice(0, 900));
      for (const k of U) { try { console.log(k, JSON.stringify(await dbg(k)), (await uiText(k)).slice(0, 200).replace(/\n/g, ' ')); } catch (e) { console.log(k, 'X', e.message); } }
      await page.screenshot({ path: join(OUT, 'rmj-timeout.png') });
      throw new Error('시간 초과: ' + label);
    }
    await page.waitForTimeout(200);
  }
};
const log = [];
const ok = (label, v) => { log.push(`${v ? 'ok  ' : 'FAIL'} ${label}`); console.log(log[log.length - 1]); };

await wait(async () => { for (const k of U) if (!fr(k) || !(await fr(k).evaluate(() => !!window.__ready))) return false; return true; }, 60000, '세 창 준비');
await wait(async () => Object.keys((await room())?.players || {}).length === 3, 15000, '세 명 입장');
ok('세 명이 한 방에 (정원 8)', (await room()).maxPlayers === 8);

async function round(n, ctrl) {
  console.log(`\n── ${n}판: ${ctrl === 'both' ? '두 손' : '한 손'}`);
  await wait(async () => (await uiText('B')).includes('레디') && (await uiText('A')).includes('방식'), 20000, `${n}판 대기방`);
  /* 방장이 방식을 고른다 → 다른 창에도 보인다 */
  await click('A', ctrl === 'both' ? '두 손' : '한 손');
  await wait(async () => (await room()).ctrl === ctrl, 8000, `${n}판 방식 저장`);
  await wait(async () => (await uiText('B')).includes(`${ctrl === 'both' ? '두 손' : '한 손'} · 방장이 골라요`), 8000, `${n}판 B 화면에 방식`);
  ok(`${n}판: 방장이 고른 방식이 방과 다른 창에 보인다 (${ctrl})`, true);
  if (n === 1) await page.screenshot({ path: join(OUT, 'rmj-1-wait.png') });
  for (const k of ['B', 'C']) { if (!(await room()).players[k]?.ready) await click(k, '레디'); }
  await wait(async () => { const r = await room(); return r.players.B?.ready && r.players.C?.ready; }, 10000, `${n}판 레디`);
  await click('A', '시작하기');
  await wait(async () => { for (const k of U) { const d = await dbg(k); if (!d || d.phase !== 'play') return false; } return true; }, 40000, `${n}판 세 창 게임 시작`);
  const ds = await Promise.all(U.map(dbg));
  ok(`${n}판: 세 창 모두 같은 방식 · 같은 노트 수 (${ds.map((d) => `${d.ctrl}/${d.notes}`).join(', ')})`, ds.every((d) => d.ctrl === ctrl && d.notes === ds[0].notes));
  /* A 는 완벽하게, B · C 는 손을 놓는다 → 줄에 걸려 하트를 잃고 탈락 */
  await fr('A').evaluate(() => window.__rbDebug().setAuto('perfect'));
  for (const k of ['B', 'C']) await fr(k).evaluate(() => window.__rbDebug().setAuto('none'));
  await wait(async () => (await dbg('A')).songT > 2.5, 40000, `${n}판 곡 진행`);
  await page.screenshot({ path: join(OUT, `rmj-${n}-play.png`) });
  await wait(async () => { const d = await dbg('B'); return d.out; }, 90000, `${n}판 B 탈락`);
  await wait(async () => { const d = await dbg('C'); return d.out; }, 60000, `${n}판 C 탈락`);
  await wait(async () => { for (const k of U) { const d = await dbg(k); if (d.phase !== 'end' && d.phase !== 'result') return false; } return true; }, 40000, `${n}판 세 창 끝`);
  await page.waitForTimeout(2500);
  const fin = await Promise.all(U.map(dbg));
  ok(`${n}판: A 우승 · B · C 탈락 (${fin.map((d, i) => `${U[i]}=${d.won ? '우승' : d.rank + '등'}`).join(', ')})`, fin[0].won === true && fin[1].won === false && fin[2].won === false);
  ok(`${n}판: 세 창의 순위가 같다`, new Set(fin.map((d) => JSON.stringify(d.status?.ranking))).size === 1 && fin[0].status?.ranking?.[0] === 'A');
  const r = await room();
  ok(`${n}판: 방 판 끝(${r.state}) · A 하트 남음 · B · C 0`, r.state === 'finished' && (r.players.A.lives | 0) > 0 && (r.players.B.lives | 0) === 0 && (r.players.C.lives | 0) === 0);
  await page.screenshot({ path: join(OUT, `rmj-${n}-result.png`) });
  /* 같은 방에서 한 판 더 — 셋 모두 */
  for (const k of U) await wait(() => click(k, '같은 방에서 한 판 더'), 30000, k + ' 한 판 더 단추');
}

await round(1, 'jump');
await round(2, 'both');
const deny = await page.evaluate(() => window.__SIM.db.denyLog.length);
ok('거부된 쓰기 없음', deny === 0);
const real = errors.filter((e) => !/favicon|404|serviceWorker|sw\.js|manifest|pretendard|Failed to load resource/i.test(e));
console.log('\n오류:', real.length ? real.slice(0, 10).join('\n') : '없음');
console.log(log.some((l) => l.startsWith('FAIL')) ? '결과: 실패 있음' : '결과: 세 창 서바이벌 두 판 통과');
await browser.close(); await server.close();
process.exit(0);
