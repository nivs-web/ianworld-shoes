/**
 * M5 화면 QA (진단 전용) — 로그인부터 로비 복귀까지 전 흐름을 걸어보고 스크린샷을 남긴다.
 *   node tools/_screens-qa.mjs
 */
import { chromium } from 'playwright';

const URL = 'http://127.0.0.1:4173/';
const b = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--autoplay-policy=no-user-gesture-required'],
});
const p = await b.newPage({ viewport: { width: 420, height: 820 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e)));
p.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });

await p.goto(URL);
await p.evaluate(() => localStorage.clear());
await p.reload();
await p.waitForTimeout(1200);

const shot = async (name) => p.screenshot({ path: `/tmp/s_${name}.png` });
const clickText = async (t) => {
  const el = p.locator(`button:has-text("${t}")`).first();
  await el.click();
  await p.waitForTimeout(450);
};
/** Firebase 설정 유무에 따라 첫 화면 버튼 문구가 달라진다 — 있는 쪽을 누른다 */
const clickAny = async (...texts) => {
  for (const t of texts) {
    const el = p.locator(`button:has-text("${t}")`).first();
    if (await el.count() && await el.isVisible()) { await el.click(); await p.waitForTimeout(450); return t; }
  }
  throw new Error(`버튼을 찾지 못했다: ${texts.join(' / ')}`);
};
const text = () => p.locator('#ui').innerText();

await shot('01_splash');
console.log('S01', JSON.stringify((await text()).split('\n').slice(0, 5)));

// 닉네임 — 게스트로 진입 (설정이 있으면 '로그인 없이 시작')
console.log('첫 화면 진입 버튼:', await clickAny('로그인 없이 시작', '터치해서 시작'));
await shot('02_nickname');
await p.fill('.nick-input', 'ㄱ');           // 잘못된 입력
await clickText('확인');
console.log('닉네임 오류 문구:', (await p.locator('.hint').first().innerText()).trim());
await p.fill('.nick-input', '이안');
await clickText('확인');
await p.waitForTimeout(400);

await shot('03_portal');
console.log('S03', JSON.stringify((await text()).split('\n').slice(0, 3)));

await clickText('터치해서 시작');
await shot('04_lobby');
console.log('S04', JSON.stringify((await text()).split('\n').filter(Boolean).slice(0, 6)));

// 난이도 바꾸기
await clickText('어려움');
console.log('난이도 저장:', await p.evaluate(() => JSON.parse(localStorage.getItem('sf_profile')).difficulty));

// 도감
await clickText('나의 신발 컬렉션');
await shot('05_collection');
const cells = await p.locator('.dex-cell').count();
console.log('도감 1티어 칸 수:', cells, '/ 총합 문구:', (await p.locator('.dex-total').innerText()).trim());
await clickText('3티어');
console.log('3티어 칸 수:', await p.locator('.dex-cell').count());
await clickText('뒤로');

// 캐릭터
await clickText('캐릭터 바꾸기');
await shot('06_character');
console.log('캐릭터:', (await p.locator('.char-name').innerText()).trim(), (await p.locator('.char-count').innerText()).trim());
for (let i = 0; i < 5; i++) { await p.locator('.arrow').nth(1).click(); await p.waitForTimeout(120); }
await shot('07_character_locked');
console.log('6번째 캐릭터:', (await p.locator('.char-name').innerText()).trim(),
  '| 구매버튼:', await p.locator('button:has-text("캐릭터 구매하기")').count());
await clickText('뒤로');

// 조작법
await clickText('조작법 변경');
await shot('08_controls');
console.log('조작 카드 수:', await p.locator('.ctrl-card').count());
await clickText('뒤로');

// 게임 시작 → 몇 칸 오르고 죽이기
await clickText('싱글게임');
await p.waitForTimeout(2600);
await shot('09_ingame');
const canvasShown = await p.evaluate(() => !document.body.classList.contains('ui-mode'));
console.log('캔버스 전환:', canvasShown);

const bx = await p.evaluate(() => {
  const r = document.querySelector('canvas').getBoundingClientRect();
  return { x: r.x, y: r.y, s: r.width / 180 };
});
const tap = async (sd) => p.mouse.click(bx.x + (sd === 'L' ? 30 : 150) * bx.s, bx.y + 290 * bx.s);
const st = async () => p.evaluate(() => {
  const g = window.__dbg.Scene.current();
  return g && g.stairs ? { floor: g.floor, need: g.stairs.nextDir(g.floor), facing: g.player.facing, shoes: g.shoesFound, dead: g.player.dead } : null;
});
let s = await st();
for (let i = 0; i < 90 && s && !s.dead; i++) {
  await tap(s.need === s.facing ? 'R' : 'L');
  await p.waitForTimeout(50);
  s = await st();
  if (s.floor >= 12 && s.shoes >= 1) break;
}
console.log('등반 결과:', JSON.stringify(s));

// 일부러 틀려서 죽기
for (let i = 0; i < 6; i++) {
  const t = await st();
  if (!t || t.dead) break;
  await tap(t.need === t.facing ? 'L' : 'R');
  await p.waitForTimeout(200);
}
await p.waitForTimeout(2600);
await shot('10_gameover');

// HOME → 로비 복귀 + 결과 반영
await p.mouse.click(bx.x + 58 * bx.s, bx.y + 204 * bx.s);
await p.waitForTimeout(900);
await shot('11_back_to_lobby');
const prof = await p.evaluate(() => JSON.parse(localStorage.getItem('sf_profile')));
const dex = await p.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('sf_collection') ?? '{}')).length);
console.log('로비 복귀:', (await text()).split('\n').filter(Boolean).slice(0, 4).join(' / '));
console.log('저장된 프로필: best=%d shoes=%d plays=%d 도감=%d', prof.bestStairs, prof.shoesOwned, prof.totalPlays, dex);

console.log('errors', errs.slice(0, 6));
await b.close();
