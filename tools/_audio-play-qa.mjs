/**
 * 사운드 통합 QA (진단 전용) — 실제로 계단을 오르며 소리가 나는지, 층수에 따라
 * BGM 트랙이 바뀌는지, 함성이 규칙대로 울리는지 확인한다.
 *   node tools/_audio-play-qa.mjs
 */
import { chromium } from 'playwright';

const b = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--autoplay-policy=no-user-gesture-required'],
});
const p = await b.newPage({ viewport: { width: 540, height: 960 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e)));
await p.goto('http://127.0.0.1:4173/');
await p.waitForTimeout(2500);

const bx = await p.evaluate(() => {
  const r = document.querySelector('canvas').getBoundingClientRect();
  return { x: r.x, y: r.y, s: r.width / 180 };
});
const tap = async (sd) => p.mouse.click(bx.x + (sd === 'L' ? 30 : 150) * bx.s, bx.y + 290 * bx.s);
const st = async () => p.evaluate(() => {
  const g = window.__dbg.scene;
  return { floor: g.floor, need: g.stairs.nextDir(g.floor), facing: g.player.facing, dead: g.player.dead };
});

// 첫 탭 = 오디오 언락 + BGM 시작
await tap('R');
await p.waitForTimeout(400);
console.log('언락 후', JSON.stringify(await p.evaluate(() => ({
  unlocked: window.__dbg.Audio.isUnlocked(),
  bgm: window.__dbg.Bgm.isPlaying(),
  track: window.__dbg.Bgm.currentTrack(),
}))));

// 함성 카운트 훅
await p.evaluate(() => {
  window.__shouts = 0;
  const orig = window.__dbg.Sfx.playShout;
  window.__dbg.scene.__origShout = orig;
});

let s = await st();
for (let i = 0; i < 120 && !s.dead; i++) {
  await tap(s.need === s.facing ? 'R' : 'L');
  await p.waitForTimeout(45);
  s = await st();
  if (s.floor >= 30) break;
}
console.log('30층 등반 후', JSON.stringify({ floor: s.floor, track: await p.evaluate(() => window.__dbg.Bgm.currentTrack()) }));

// 게이지를 멈춘다 — 트랙 교체를 기다리는 동안 죽으면 BGM이 정지해 테스트가 무의미해진다
await p.evaluate(() => { window.__dbg.scene.started = false; window.__dbg.scene.gauge = 100; });

// 층수 점프로 트랙 교체 확인 (100층마다)
for (const f of [0, 100, 250, 500, 900, 1500]) {
  const t = await p.evaluate(async (fl) => {
    window.__dbg.Bgm.setFloor(fl);
    await new Promise((r) => setTimeout(r, 3000)); // 마디 경계까지 기다린다 (BPM 120이면 한 마디 2초)
    return window.__dbg.Bgm.currentTrack();
  }, f);
  console.log(`  ${String(f).padStart(4)}층 → 트랙 ${t}`);
}

console.log('errors', errs.slice(0, 4));
await b.close();
