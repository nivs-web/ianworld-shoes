/**
 * 친구 두 창 시험 (2026-11-04) — node tools/_rm/friends-run.mjs
 * 대기방에서 이름 → 친구 추가 → «친구» 화면에 접속 상태 → 같이 하기(1:1 대결신청) → 상대 수락 → 같은 비밀방.
 */
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { join } from 'node:path';

const HERE = import.meta.dirname;
const OUT = join(HERE, '../_out');
const server = await createServer({ configFile: join(HERE, 'vite.config.mjs'), logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 830, height: 790 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto('http://127.0.0.1:5199/tools/_rm/friends.html');

const fr = (k) => page.frames().find((f) => f.url().includes(`uid=${k}`));
const wait = async (fn, ms, label) => {
  const t0 = Date.now();
  for (;;) {
    try { if (await fn()) return; } catch { /* 아직 */ }
    if (Date.now() - t0 > ms) {
      await page.screenshot({ path: join(OUT, 'fr-timeout.png') });
      console.log('B 화면:', (await txt('B')).replace(/\s+/g,' ').slice(0,300), '| overlay', await fr('B').evaluate(() => document.querySelectorAll('.dialog-overlay').length), '| uiMode', await fr('B').evaluate(() => document.body.className));
      console.log('inbox/B:', JSON.stringify(await db('inbox/B')).slice(0, 600));
      throw new Error(`시간 초과: ${label} | ${errors.join(' || ')}`);
    }
    await page.waitForTimeout(200);
  }
};
const txt = (k) => fr(k).evaluate(() => document.body.innerText);
const clickText = (k, t, sel = 'button') => fr(k).evaluate(([t, sel]) => {
  const b = [...document.querySelectorAll(sel)].reverse()
    .find((x) => x.innerText.trim() === t || x.innerText.trim().startsWith(t));
  if (!b) return false;
  b.click();
  return true;
}, [t, sel]);
const db = (p) => page.evaluate((p) => window.__SIM.db.read(p), p);
const res = [];
const ok = (l, v) => { res.push(v); console.log(`${v ? 'ok  ' : 'FAIL'} ${l}`); };

await wait(async () => await fr('A').evaluate(() => window.__ready) && await fr('B').evaluate(() => window.__ready), 40000, '준비');
await wait(async () => (await txt('A')).includes('친구B'), 15000, 'A 대기방에 B');
await clickText('A', '친구B', '.player-name');
await wait(async () => (await txt('A')).includes('친구 추가'), 10000, '카드에 친구 추가');
await page.screenshot({ path: join(OUT, 'fr-1-card.png') });
await clickText('A', '친구 추가');
await wait(async () => !!(await db('friends/A/B')), 10000, '친구 저장');
ok('대기방 이름 → 카드 → 친구 추가 → friends/A/B 저장', (await db('friends/A/B'))?.n === '친구B');
ok('B 에게 «친구로 추가했어요» 쪽지',
  Object.values((await db('inbox/B')) ?? {}).some((m) => m.kind === 'system' && /친구로 추가/.test(m.text)));
await page.waitForTimeout(600);
console.log('B 화면(친구추가 직후):', (await txt('B')).replace(/\s+/g,' ').slice(0,300));
ok('카드 단추가 «친구 삭제» 로 바뀐다', (await txt('A')).includes('친구 삭제'));
await clickText('A', '닫기');
/* B 쪽에는 «친구로 추가했어요» 팝업이 떠 있다 — 확인하고 닫는다 (팝업은 한 번에 하나) */
await wait(async () => /친구로 추가했어요/.test(await txt('B')), 10000, 'B 알림 팝업');
ok('B 화면에 «친구로 추가했어요» 팝업', true);
await clickText('B', '닫기');

/* 둘 다 대기방을 나와 로비 상태로 — A 는 «친구» 화면, B 는 설정(로비) */
await fr('A').evaluate(async () => {
  const F = (await import('/src/screens/Friends.js')).default;
  window.__rm.nav.reset(F, { game: 'dragon' });
});
await fr('B').evaluate(async () => {
  const S = (await import('/src/screens/Settings.js')).default;
  window.__rm.nav.reset(S);
});
await page.waitForTimeout(1500);
await clickText('A', '새로고침');
await wait(async () => /대기중/.test(await txt('A')), 10000, '친구 화면에 B 대기중');
ok('«친구» 화면: B 가 «대기중» · 접속 1명', /접속 중 1명 · 친구 1명/.test(await txt('A')));
await page.screenshot({ path: join(OUT, 'fr-2-list.png') });

/* 같이 하기 = 1:1 대결신청 → 비밀방 + 초대 → B 수락 */
await fr('A').evaluate(() => document.querySelector('#ui .online-row').click());
await wait(async () => (await txt('A')).includes('1:1대결신청'), 10000, '카드 열림');
await clickText('A', '1:1대결신청');
/* B 가 신발 설정 화면(=신발 로비)에 있어 "다른 게임 중인데 신청할까요?" 를 먼저 묻는다 — 기존 동작 */
await page.waitForTimeout(800);
if ((await txt('A')).includes('그래도 대결신청')) await clickText('A', '예');
await wait(async () => /수락\(/.test(await txt('B')), 15000, 'B 초대 팝업');
ok('B 에게 초대 팝업이 뜬다', true);
await page.screenshot({ path: join(OUT, 'fr-3-invite.png') });
await clickText('B', '수락(');
await wait(async () => {
  const rooms = (await db('rooms')) ?? {};
  return Object.values(rooms).some((r) => r.isPrivate && r.players?.A && r.players?.B);
}, 15000, '같은 비밀방');
ok('★ 수락하면 A·B 가 같은 비밀방 (친구와 같이 하기)', true);
await page.waitForTimeout(1500);
ok('B 화면이 대기방', /레디|시작하기/.test(await txt('B')));
await page.screenshot({ path: join(OUT, 'fr-4-room.png') });

/* 친구 삭제 */
await fr('A').evaluate(async () => (await import('/src/services/friends.js')).remove('B'));
ok('친구 삭제 → friends/A/B 없음', !(await db('friends/A/B')));

console.log('오류:', errors.length ? errors.join(' || ') : '없음');
console.log(res.every(Boolean) ? '결과: 친구 시험 통과' : '결과: 실패 있음');
await browser.close();
await server.close();
process.exit(0);
