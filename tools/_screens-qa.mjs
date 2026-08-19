/**
 * M5 화면 QA (진단 전용) — 로그인부터 로비 복귀까지 전 흐름을 걸어보고 스크린샷을 남긴다.
 *   node tools/_screens-qa.mjs
 */
import { chromium } from 'playwright';
import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * 크로미움 위치. 예전엔 `/opt/pw-browsers/chromium` 을 그대로 박아 뒀는데
 * 그 경로는 환경이 바뀌면 사라진다(실제로 사라졌다). 찾아보고, 없으면
 * 플레이라이트 기본값에 맡긴다 — 윈도우에서도 그대로 돌아간다.
 */
function chromePath() {
  const dir = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  if (!existsSync(dir)) return undefined;
  for (const n of readdirSync(dir).filter((n) => n.startsWith('chromium-')).sort().reverse()) {
    const p = resolve(dir, n, 'chrome-linux/chrome');
    if (existsSync(p)) return p;
  }
  return existsSync(resolve(dir, 'chromium')) ? resolve(dir, 'chromium') : undefined;
}

const URL = 'http://127.0.0.1:4173/';
const b = await chromium.launch({
  executablePath: chromePath(),
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
const text = () => p.locator('#ui').innerText();

await shot('01_splash');
console.log('S01', JSON.stringify((await text()).split('\n').slice(0, 5)));

/**
 * 로그인은 구글 계정이 필요해 자동화로 통과할 수 없다 (게스트 모드는 없앴다).
 * 그래서 프로필만 심고 __dbg 훅으로 로비를 직접 연다 — 이 QA가 보려는 건
 * 로그인 자체가 아니라 그 뒤의 화면들이다.
 */
await p.evaluate(() => {
  localStorage.setItem('sf_profile', JSON.stringify({
    nickname: '이안', uid: 'tester', selectedCharacter: 'ian',
    unlockedCharacters: ['ian', 'denny', 'lisa', 'ipo', 'charles'],
    difficulty: 'easy', controlMode: 1, walletVersion: 1, shoesByIndex: {},
  }));
  window.__dbg.nav.reset(window.__dbg.screens.Lobby);
});
await p.waitForTimeout(500);
await shot('04_lobby');
console.log('S04', JSON.stringify((await text()).split('\n').filter(Boolean).slice(0, 6)));

// 난이도 바꾸기
await clickText('어려움');
console.log('난이도 저장:', await p.evaluate(() => JSON.parse(localStorage.getItem('sf_profile')).difficulty));

// 도감
await clickText('신발 도감');
await shot('05_collection');
const cells = await p.locator('.dex-cell').count();
console.log('도감 1티어 칸 수:', cells, '/ 총합 문구:', (await p.locator('.dex-total').innerText()).trim());
await clickText('3티어');
console.log('3티어 칸 수:', await p.locator('.dex-cell').count());
await clickText('뒤로');

// 캐릭터
await clickText('캐릭터 변경');
await shot('06_character');
console.log('캐릭터:', (await p.locator('.char-name').innerText()).trim(), (await p.locator('.char-count').innerText()).trim());
for (let i = 0; i < 5; i++) { await p.locator('.arrow').nth(1).click(); await p.waitForTimeout(120); }
await shot('07_character_locked');
console.log('6번째 캐릭터:', (await p.locator('.char-name').innerText()).trim(),
  '| 구매버튼:', await p.locator('button:has-text("캐릭터 구매하기")').count());
await clickText('뒤로');

// 설정 → 조작법
await clickText('설정');
await clickText('조작법 변경');
await shot('08_controls');
console.log('조작 카드 수:', await p.locator('.ctrl-card').count());
await clickText('뒤로');
await clickText('뒤로');

/**
 * 명예의 전당 · 멀티 메뉴 · 현재접속자 (2026-08-19 11차).
 * 로그인이 없는 환경이라 목록은 비어 있지만, **화면이 뜨고 콘솔 오류가 없는지**를 본다 —
 * 새 화면이 조용히 터지면 그 경로는 아무도 안 밟아 본 채 배포된다.
 */
await clickText('명예의 전당');
await shot('08b_hall');
console.log('명예의 전당 탭 수:', await p.locator('.hof-tabs .pbtn').count());
await clickText('뒤로');
await clickText('멀티게임');
await shot('08c_multi');
console.log('멀티 메뉴에 현재접속자:', await p.locator('button:has-text("현재접속자")').count());
await clickText('현재접속자');
await p.waitForTimeout(600);
await shot('08d_online');
console.log('현재접속자 화면:', (await text()).split('\n').filter(Boolean).slice(0, 3).join(' / '));
await clickText('뒤로');
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
