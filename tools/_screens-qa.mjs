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

// 설정 → 조작법 · 받은 메세지함 · 메세지 수신 설정
await clickText('설정');
await clickText('조작법 변경');
await shot('08_controls');
console.log('조작 카드 수:', await p.locator('.ctrl-card').count());
await clickText('뒤로');

/**
 * 쪽지 관련 두 화면 (2026-08-19 12차). 로그인이 없어 목록은 비지만,
 * **화면이 뜨고 콘솔 오류가 없는지**가 핵심이다 — 새 화면이 조용히 터지면
 * 그 경로는 아무도 안 밟아 본 채 배포된다.
 */
await clickText('받은 메세지함');
await p.waitForTimeout(500);
await shot('08e_inbox');
console.log('받은 메세지함:', (await text()).split('\n').filter(Boolean).slice(0, 2).join(' / '));
await clickText('뒤로');
await clickText('메세지 수신 설정');
await p.waitForTimeout(500);
await shot('08f_msgsettings');
/**
 * 21차: 켜짐/꺼짐 두 버튼을 **[수신차단] [수신허용]** 으로 바꿨다(사용자 지정).
 * 옛 이름을 그대로 세면 화면이 멀쩡해도 늘 0/0 이라 아무것도 확인하지 못한다.
 */
console.log('수신 설정 버튼:', await p.locator('button:has-text("수신차단")').count(),
  '/', await p.locator('button:has-text("수신허용")').count(),
  '| 현재상태 줄:', await p.locator('.msg-accept-now').count(),
  '| 안내:', (await p.locator('.hint').first().innerText()).slice(0, 12));
await clickText('뒤로');
await clickText('뒤로');

/**
 * 키보드로 메뉴를 움직인다 (2026-08-19 12차). 방향키 두 번이면 두 번째 버튼이
 * 잡혀야 하고, 그 상태에서 Enter 가 곧바로 눌러야 한다(브라우저 기본 동작).
 */
await p.keyboard.press('ArrowDown');
await p.keyboard.press('ArrowDown');
const focused = await p.evaluate(() => {
  const a = document.activeElement;
  return a && a.classList.contains('pbtn') ? a.textContent.trim() : null;
});
console.log('키보드 커서:', JSON.stringify(focused));

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

/**
 * ★ **팝업이 `refresh()` 한 번에 사라지지 않는지** 실제 브라우저에서 확인한다.
 * (2026-08-19 15차 — 쪽지·대결신청이 "안 되던" 진짜 원인이 이것이었다)
 *
 * 소스 검사만으로는 부족하다. `nav.refresh()` 는 구독 콜백이 부르는데, 그때 열려 있던
 * 유저상태창·메세지 입력칸이 통째로 날아갔다. 여기서는 그 두 가지를 직접 재현한다 —
 *   · `refresh()` → 팝업이 **남아 있어야** 한다 (같은 화면을 다시 그리는 것뿐이다)
 *   · 화면을 옮기면 → 팝업이 **사라져야** 한다 (새 화면 위에 얹히면 안 된다)
 */
const overlays = () => p.locator('.dialog-overlay').count();
await clickText('신발 도감');
await p.waitForTimeout(300);
await p.locator('.dex-cell').first().click();
await p.waitForTimeout(200);
const 팝업생김 = await overlays();
await p.evaluate(() => window.__dbg.nav.refresh());
await p.waitForTimeout(150);
const 리프레시후 = await overlays();
await p.evaluate(() => window.__dbg.nav.reset(window.__dbg.screens.Lobby));
await p.waitForTimeout(250);
const 화면바꾼뒤 = await overlays();
console.log('팝업 생존: 열림 %d → refresh 후 %d (남아야 함) → 화면 이동 후 %d (0이어야 함)',
  팝업생김, 리프레시후, 화면바꾼뒤);

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
