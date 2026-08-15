/**
 * 오버레이 QA (진단 전용) — 일시정지·게임오버 패널을 실제로 띄워 스크린샷을 남긴다.
 *   node tools/_overlay-qa.mjs
 *
 * 화면 QA(_screens-qa)는 로비까지만 걷는다. 한글 비트맵 폰트로 바꾼 뒤로는
 * "글자가 아예 안 그려지는" 실패가 가능해져서 눈으로 볼 그림이 필요하다.
 */
import { chromium } from 'playwright';

const URL = 'http://127.0.0.1:4173/';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport: { width: 420, height: 820 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e)));
p.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });

await p.goto(URL);
await p.evaluate(() => {
  localStorage.clear();
  // 도감(누적 획득)과 지갑(현재 보유)을 따로 만든다 — 둘은 다른 숫자다.
  // 1켤레만 가진 신발에는 배지가 안 붙어야 한다.
  const dex = {};
  const wallet = {};
  for (let i = 0; i < 12; i++) {
    const held = (i % 4) + 1;              // 1,2,3,4 반복
    dex[String(i)] = { count: held + 2, firstFoundAt: Date.now() };  // 주웠다가 쓴 만큼 더 많다
    wallet[String(i)] = held;
  }
  localStorage.setItem('sf_collection', JSON.stringify(dex));
  localStorage.setItem('sf_profile', JSON.stringify({
    nickname: '이안', uid: 'tester', bestStairs: 1234,
    shoesByIndex: wallet, walletVersion: 1,
    selectedCharacter: 'ian', unlockedCharacters: ['ian'], difficulty: 'hard', controlMode: 1,
  }));
});
await p.reload();
await p.waitForTimeout(1500);
// 로그인은 자동화로 통과할 수 없다 — 로비를 직접 연다 (진단 훅)
await p.evaluate(() => window.__dbg.nav.reset(window.__dbg.screens.Lobby));
await p.waitForTimeout(400);

const shot = (n) => p.screenshot({ path: `/tmp/o_${n}.png` });
const click = async (t) => { await p.locator(`button:has-text("${t}")`).first().click(); await p.waitForTimeout(500); };

await shot('01_lobby');
console.log('로비:', (await p.locator('.panel .stats').innerText()).replace(/\n/g, ' / '));

await click('나의 신발 컬렉션');
await p.waitForTimeout(400);
await shot('02_dex');
console.log('도감 합계:', (await p.locator('.dex-total').innerText()).trim(),
  '| 고유:', (await p.locator('.dex-unique').innerText()).trim(),
  '| 켤레배지:', await p.locator('.dex-count').count(),
  '|', await p.locator('.dex-count').allInnerTexts());
await click('뒤로');

// 인게임 → 일시정지
await click('싱글게임');
await p.waitForTimeout(2600);
const box = await p.evaluate(() => {
  const r = document.querySelector('canvas').getBoundingClientRect();
  return { x: r.x, y: r.y, s: r.width / 180 };
});
const tapAt = async (lx, ly) => {
  await p.mouse.click(box.x + lx * box.s, box.y + ly * box.s);
  await p.waitForTimeout(220);
};
const st = () => p.evaluate(() => {
  const g = window.__dbg.Scene.current();
  return g.stairs ? { floor: g.floor, need: g.stairs.nextDir(g.floor), facing: g.player.facing } : null;
});

/**
 * 터치 영역 — 버튼 그림이 아니라 **화면 절반**이 판정이어야 한다.
 * 버튼(y266~314)에서 한참 떨어진 화면 한가운데 높이(y=180)를 눌러 확인한다.
 */
{
  const before = await st();
  await tapAt(before.need === before.facing ? 150 : 30, 180);
  const after = await st();
  console.log('버튼 밖(y180) 탭 → 층', before.floor, '→', after.floor,
    after.floor > before.floor ? '✅ 반쪽 판정 동작' : '❌ 안 먹음');
}

// 상단 밴드는 어디를 눌러도 일시정지 — 버튼과 한참 떨어진 가운데를 눌러 확인한다
await tapAt(90, 50);
await shot('03_pause');
console.log('일시정지 씬:', await p.evaluate(() => window.__dbg.Scene.current().constructor.name));

// 커서 이동 확인 (좌=이동, 우=선택)
await p.keyboard.press('ArrowLeft');
await p.waitForTimeout(200);
await shot('04_pause_sel2');

// 사망 → 게임오버. 신발이 없으면 부활 없이 바로 게임오버 패널이 뜬다.
// 게이지는 **첫 입력 뒤에만** 줄어든다(GameScene.started) — 그래서 한 칸 올라간 뒤에 죽인다.
await p.evaluate(() => window.__dbg.Scene.pop());   // 일시정지 닫기
await p.keyboard.press('ArrowRight');
await p.waitForTimeout(400);
await p.evaluate(() => { window.__dbg.Scene.current().gauge = 0.01; });
await p.waitForTimeout(1800);
await shot('05_gameover');
console.log('게임오버:', await p.evaluate(() => {
  const s = window.__dbg.Scene.current();
  return `${s.constructor.name} best=${s.best} floor=${s.game?.floor} 버튼표시=${s.delay <= 0}`;
}));

// 로비로나가기 (좌) — 예전에 먹통이던 경로
await p.keyboard.press('ArrowLeft');
await p.waitForTimeout(900);
console.log('로비 복귀:', (await p.locator('#ui').innerText()).split('\n').filter(Boolean)[0] ?? '(실패)');
await shot('06_back_to_lobby');

/**
 * 사용자가 신고한 그 순서 — 일시정지 → 게임재개 → 사망 → 로비로나가기.
 * 예전에는 '게임재개'가 onFinish 없는 새 GameScene 을 만들어서, 그 뒤로는
 * 죽어도 로비로 나갈 방법이 사라졌다.
 */
console.log('— 일시정지 → 게임재개 → 사망 → 로비 —');
await p.locator('button:has-text("싱글게임")').click();
await p.waitForTimeout(2600);
await tapAt(90, 50);                       // 일시정지
await p.waitForTimeout(300);
// 입력 디바운스(16ms)와 프레임당 1개 소비 때문에 연타하면 씹힌다 — 사이를 띄운다
await p.keyboard.press('ArrowLeft');       // 커서: 재개 → 게임재개
await p.waitForTimeout(250);
await p.keyboard.press('ArrowRight');      // 선택
await p.waitForTimeout(2600);
console.log('맵바꾼 뒤:', await p.evaluate(() => {
  const s = window.__dbg.Scene.current();
  return `${s.constructor.name} onFinish=${!!s.onFinish}`;
}));
await p.keyboard.press('ArrowRight');
await p.waitForTimeout(400);
await p.evaluate(() => { window.__dbg.Scene.current().gauge = 0.01; });
await p.waitForTimeout(1800);
await p.keyboard.press('ArrowLeft');       // 로비로나가기
await p.waitForTimeout(900);
console.log('로비 복귀:', (await p.locator('#ui').innerText()).split('\n').filter(Boolean)[0] ?? '(실패)');

console.log('errors', errs);
await b.close();
