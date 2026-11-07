/**
 * 운영자 난이도 설정 확인 (2026-11-07) — A 는 운영자(admins/A), B 는 손님. `admin.html` 두 창을 그대로 쓴다.
 *   node tools/_rm/tuning-run.mjs
 * ① 통계 → [난이도 설정] → 서버 값이 보이는가 · [+]/[-] · 길게 누르기 · 50으로 되돌리기 · 떠날 때 저장
 * ② 손님은 저장 실패 · 값 되돌림
 * ③ 캐치볼 · 드래곤에 배율이 실제로 먹는가 (단계 1 · 50 · 99 에서 판정 수치)
 * 캡처: tools/_out/admin-tuning.png (운영자 화면 전체) · admin-tuning-guest.png
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
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404')) errors.push('console: ' + m.text()); });
page.on('response', (r) => { if (r.status() === 404) errors.push('404 ' + r.url()); });
await page.goto('http://127.0.0.1:5199/tools/_rm/admin.html');
/* 운영자가 예전에 바꿔 둔 값 — 화면을 열면 서버에서 읽어 와야 한다 */
await page.evaluate(() => { window.__SIM.db.write('config/tuning/catch/throw', 40); window.__SIM.db.write('config/tuning/dragon/hp', 62); });
const fr = (k) => page.frames().find((f) => f.url().includes(`uid=${k}`));
const t0 = Date.now();
while (Date.now() - t0 < 30000) { try { if (await fr('A').evaluate(() => window.__ready) && await fr('B').evaluate(() => window.__ready)) break; } catch {} await page.waitForTimeout(200); }
await page.waitForTimeout(5000);
let fails = 0;
const ok = (l, v, extra = '') => { if (!v) fails++; console.log(`${v ? 'ok  ' : 'FAIL'} ${l}${extra ? '  ' + extra : ''}`); };
const db = (p) => page.evaluate((p) => window.__SIM.db.read(p), p);
const clickText = (k, t) => fr(k).evaluate((t) => [...document.querySelectorAll('#ui button')].find((b) => b.innerText.trim() === t).click(), t);
const vals = (k) => fr(k).evaluate(() => [...document.querySelectorAll('.tune-val')].map((n) => +n.textContent));
const status = (k) => fr(k).evaluate(() => document.querySelector('.tune-status')?.textContent ?? '');
const btn = (k, row, plus) => fr(k).locator('.tune-row').nth(row).locator('.tune-btn').nth(plus ? 1 : 0);

/* ① 운영자 */
await clickText('A', '통계');
await page.waitForTimeout(1500);
ok('통계 화면에 [난이도 설정] 단추', await fr('A').evaluate(() => [...document.querySelectorAll('#ui button')].some((b) => b.innerText.trim() === '난이도 설정')));
await clickText('A', '난이도 설정');
await page.waitForTimeout(1500);
const txt = await fr('A').evaluate(() => document.getElementById('ui').innerText);
ok('게임별 묶음 — 캐치볼 · 드래곤 스트라이커 · 줄넘기 챔피언', ['캐치볼', '드래곤 스트라이커', '줄넘기 챔피언'].every((s) => txt.includes(s)));
ok('항목 10개 (캐치볼 3 · 드래곤 3 · 줄넘기 4)', (await vals('A')).length === 10);
let v = await vals('A');
ok('서버 값을 읽어 온다 — 던지기 40 · 적 체력 62 · 나머지 50', v[0] === 40 && v[4] === 62 && v.filter((x) => x === 50).length === 8, v.join(','));
ok('배율 글자 — 40 은 «쉽게 ×0.86»', txt.includes('쉽게 ×0.86'));

await btn('A', 0, true).click(); await btn('A', 0, true).click(); await btn('A', 0, true).click();
ok('[+] 세 번 → 43 (화면엔 곧바로)', (await vals('A'))[0] === 43);
ok('누르는 중에는 «저장 중...»', (await status('A')).includes('저장 중'));
await page.waitForTimeout(1200);
ok('손을 멈추면 저장 → 서버 43 · «저장됨»', (await db('config/tuning/catch/throw')) === 43 && (await status('A')) === '저장됨');
ok('운영자 기기 캐시도 곧바로 43 (다음 판부터 먹는다)', await fr('A').evaluate(async () => (await import('/src/services/tuning.js')).level('catch', 'throw')) === 43);
ok('캐치볼 화면이 넘기는 tune.throw = 1.015^-7', await fr('A').evaluate(async () => {
  const { lookOpts } = await import('/src/screens/CatchGame.js');
  const P = await import('/src/services/profile.js');
  return Math.abs(lookOpts(P.get()).tune.throw - Math.pow(1.015, -7)) < 1e-9;
}));

/* 길게 누르기 — 적 속도·공격 [+] 를 1.6초 */
await btn('A', 3, true).scrollIntoViewIfNeeded();
const b = await btn('A', 3, true).boundingBox();
await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
await page.mouse.down(); await page.waitForTimeout(1600); await page.mouse.up();
const held = (await vals('A'))[3];
ok('길게 누르면 빨리 오른다 (1.6초에 +10 넘게)', held > 60, `50 → ${held}`);
await page.waitForTimeout(400);
const after = (await vals('A'))[3];
ok('손을 떼면 멈춘다', after === held);
await page.waitForTimeout(900);
ok('길게 누른 값도 한 번에 저장', (await db('config/tuning/dragon/enemy')) === held);

/* 끝에서 멈춘다 — 줄넘기 피해 [-] 를 오래 */
await btn('A', 9, false).scrollIntoViewIfNeeded();
const c = await btn('A', 9, false).boundingBox();
await page.mouse.move(c.x + c.width / 2, c.y + c.height / 2);
await page.mouse.down(); await page.waitForTimeout(3400); await page.mouse.up();
ok('1 아래로는 안 내려간다', (await vals('A'))[9] === 1);
await page.waitForTimeout(900);
ok('서버 jump.damage = 1', (await db('config/tuning/jump/damage')) === 1);

/* 캡처 — 화면 전체가 보이게 창을 늘린다 */
await page.setViewportSize({ width: 830, height: 2000 });
await page.evaluate(() => { document.getElementById('A').style.height = '1960px'; });
await page.waitForTimeout(500);
await fr('A').locator('#ui').evaluate((n) => { n.scrollTop = 0; });
await page.locator('#A').screenshot({ path: join(OUT, 'admin-tuning.png') });
/* 좁은 폰(360px)에서도 가로로 넘치지 않는가 */
await page.evaluate(() => { document.getElementById('A').style.width = '360px'; });
await page.waitForTimeout(400);
ok('360px 폭에서도 가로로 안 넘친다', await fr('A').evaluate(() => {
  const ui = document.getElementById('ui');
  return ui.scrollWidth <= ui.clientWidth && [...document.querySelectorAll('.tune-row')].every((r) => r.scrollWidth <= r.clientWidth + 1);
}));
await page.locator('#A').screenshot({ path: join(OUT, 'admin-tuning-360.png') });
await page.evaluate(() => { const a = document.getElementById('A'); a.style.height = ''; a.style.width = ''; });
await page.setViewportSize({ width: 830, height: 790 });

/* 50으로 되돌리기 (드래곤 묶음) */
await fr('A').locator('.tune-game').nth(1).locator('.tune-reset').click();
v = await vals('A');
ok('드래곤 «50으로 되돌리기» → 셋 다 50', v[3] === 50 && v[4] === 50 && v[5] === 50);
await page.waitForTimeout(1000);
/* 원래 50 이던 칸(spawn)은 안 쓴다 — 서버에 없음 = 50 */
ok('서버도 50 (원래 50 이던 출현은 안 쓴다 = 없음)', (await db('config/tuning/dragon/enemy')) === 50 && (await db('config/tuning/dragon/hp')) === 50 && ((await db('config/tuning/dragon/spawn')) ?? 50) === 50);

/* 떠날 때 기다리던 저장을 보낸다 — [+] 누르고 0.5초 안에 [뒤로] */
await btn('A', 6, true).click();
await clickText('A', '뒤로');
await page.waitForTimeout(800);
ok('0.5초 안에 [뒤로] 눌러도 저장된다 (jump.timing 51)', (await db('config/tuning/jump/timing')) === 51);

/* ② 손님 — 화면을 몰래 열어도 저장이 안 된다 */
await fr('B').evaluate(async () => window.__rm.nav.push((await import('/src/screens/AdminTuning.js')).default));
await page.waitForTimeout(1500);
const bv = await vals('B');
ok('손님도 읽기는 된다 (규칙: 로그인하면 읽기) — 던지기 43', bv[0] === 43, bv.join(','));
await btn('B', 2, true).click();
await page.waitForTimeout(1200);
ok('손님 [+] → «저장 실패»', (await status('B')).includes('저장 실패'));
ok('손님 화면 값은 되돌아간다 (50)', (await vals('B'))[2] === 50);
ok('서버 catch.speed 그대로 (없음)', (await db('config/tuning/catch/speed')) === null);
ok('손님 기기 캐시도 50 그대로', await fr('B').evaluate(async () => (await import('/src/services/tuning.js')).level('catch', 'speed')) === 50);
await page.locator('#B').screenshot({ path: join(OUT, 'admin-tuning-guest.png') });

/* ③ 게임에 배율이 먹는가 — 운영자 창에서 게임 모듈을 직접 띄워 판정 수치를 읽는다 */
const catchRows = await fr('A').evaluate(async () => {
  const CB = await import('/src/games/catch/catchball.js');
  const T = await import('/src/services/tuning.js');
  const out = {};
  for (const lv of [1, 50, 99, null]) {
    const host = document.createElement('div'); host.style.cssText = 'position:fixed;left:-9999px;width:400px;height:700px';
    document.body.append(host);
    const f = lv == null ? undefined : T.factor(lv);
    CB.mount(host, { mode: 'solo', tune: f == null ? undefined : { throw: f, catch: f, speed: f } });
    const d = CB._debug();
    const row = {};
    for (const diff of ['easy', 'normal', 'hard']) {
      d.G.diff = diff;
      const x = d.DF();
      row[diff] = { dirG: x.dirG, dirO: x.dirO, relTol: x.relTol, sideG: x.sideG, vMin: x.vMin, R: x.R, early: x.early, spread: x.spread, T: x.T, minT: x.minT, sweep: x.sweep };
    }
    d.G.diff = 'normal';
    row.zone025 = d.dirZone(0.25);
    row.late = d.late;
    CB.unmount(); host.remove();
    out[lv ?? 'none'] = row;
  }
  return out;
});
const N = (lv) => catchRows[lv].normal;
console.log('캐치볼 보통 — 단계 1 / 50 / 99');
for (const k of ['dirG', 'relTol', 'sideG', 'vMin', 'R', 'early', 'spread', 'T', 'sweep']) {
  console.log(`   ${k.padEnd(7)} ${N(1)[k].toFixed(3)} / ${N(50)[k].toFixed(3)} / ${N(99)[k].toFixed(3)}`);
}
const orig = { easy: { dirG: 0.26, relTol: 0.2, R: 1.22, T: 1.25 }, normal: { dirG: 0.2, relTol: 0.14, R: 1.0, T: 1.0 }, hard: { dirG: 0.15, relTol: 0.1, R: 0.84, T: 0.82 } };
ok('캐치볼 50 = 고치기 전 표 그대로 (쉬움 · 보통 · 어려움)', ['easy', 'normal', 'hard'].every((d) => Object.entries(orig[d]).every(([k, x]) => Math.abs(catchRows[50][d][k] - x) < 1e-9)));
ok('캐치볼 tune 없이 띄워도 50 과 같다', JSON.stringify(catchRows.none) === JSON.stringify(catchRows[50]));
ok('던지기 99 → 초록 폭 ÷2.07 (어렵게)', Math.abs(N(99).dirG - 0.2 / 2.0741) < 1e-3 && N(99).vMin > N(50).vMin);
ok('던지기 1 → 초록 폭 넓어진다 (쉽게)', N(1).dirG > N(50).dirG && N(1).relTol > N(50).relTol);
ok('받기 99 → 글러브 반경 줄고 공 퍼짐 늘어난다', N(99).R < N(50).R && N(99).spread > N(50).spread && N(99).early < N(50).early);
ok('스피드 99 → 비행시간 · 화살표 왕복 짧아진다', N(99).T < N(50).T && N(99).sweep < N(50).sweep);
ok('쉬움 · 어려움에도 같은 비율 (보통과 같은 배율)', ['easy', 'hard'].every((d) => Math.abs(catchRows[99][d].T / catchRows[50][d].T - catchRows[99].normal.T / catchRows[50].normal.T) < 1e-9));
ok('실제 판정: 화살표 0.25 자리 — 1 초록 · 50 주황 · 99 주황', catchRows[1].zone025 === 'g' && catchRows[50].zone025 === 'o' && catchRows[99].zone025 === 'o');
ok('넓혀도 그림이 안 깨진다 (주황 < 0.97, 초록 < 주황)', ['easy', 'normal', 'hard'].every((d) => catchRows[1][d].dirO <= 0.97 && catchRows[1][d].dirG < catchRows[1][d].dirO));

const dragonRows = await fr('A').evaluate(async () => {
  const DG = await import('/src/games/dragon/dragon.js');
  const T = await import('/src/services/tuning.js');
  const out = {};
  for (const lv of [1, 50, 99]) {
    const host = document.createElement('div'); host.style.cssText = 'position:fixed;left:-9999px;width:400px;height:700px';
    document.body.append(host);
    const f = T.factor(lv);
    const row = {};
    for (const difficulty of ['easy', 'normal', 'hard']) {
      DG.mount(host, { mode: 'play', difficulty, tune: { enemy: f, hp: f, spawn: f } });
      row[difficulty] = DG.__test.diff;
      DG.unmount();
    }
    host.remove();
    out[lv] = row;
  }
  return out;
});
const D = (lv) => dragonRows[lv].normal;
console.log('드래곤 보통 — 단계 1 / 50 / 99');
for (const k of ['speed', 'atk', 'hp', 'boss', 'count', 'pace', 'zombieHp', 'midBossHp']) {
  console.log(`   ${k.padEnd(9)} ${(+D(1)[k]).toFixed(3)} / ${(+D(50)[k]).toFixed(3)} / ${(+D(99)[k]).toFixed(3)}`);
}
ok('드래곤 50 = 고치기 전 표 그대로', D(50).speed === 1 && D(50).atk === 1 && D(50).hp === 1 && dragonRows[50].hard.boss === 1.44 && dragonRows[50].easy.pace === 0.65);
ok('드래곤 99 → 적 속도 · 공격 · 체력 · 출현 ×2.07', ['speed', 'atk', 'hp', 'boss', 'count', 'pace'].every((k) => Math.abs(D(99)[k] / D(50)[k] - 2.0741) < 1e-3));
ok('드래곤 1 → 전부 ×0.48', ['speed', 'atk', 'hp', 'count'].every((k) => Math.abs(D(1)[k] / D(50)[k] - 0.4821) < 1e-3));
ok('드래곤 어려움에도 같은 배율 (1.18 × 2.07)', Math.abs(dragonRows[99].hard.speed - 1.18 * 2.0741) < 1e-3);
ok('드래곤 실제 체력 — 날개좀비 단계 99 > 50 > 1', D(99).zombieHp > D(50).zombieHp && D(50).zombieHp > D(1).zombieHp);

console.log('오류:', errors.length ? errors.join(' || ') : '없음');
console.log(fails ? `실패 ${fails}건` : '전부 통과');
await browser.close(); await server.close(); process.exit(fails ? 1 : 0);
