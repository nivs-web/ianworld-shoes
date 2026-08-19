/**
 * 사운드 QA (진단 전용) — 실제 오디오 그래프에 애널라이저를 물려 피크를 측정한다.
 * 무음(합성 실패)과 클리핑(음량 과다)을 한 번에 잡는다.
 *   node tools/_audio-qa.mjs
 */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const b = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--autoplay-policy=no-user-gesture-required'],
});
const p = await b.newPage({ viewport: { width: 540, height: 960 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e)));
await p.goto('http://127.0.0.1:4173/');
await p.waitForTimeout(2500);
await p.mouse.click(270, 880); // 제스처로 오디오 열기
await p.waitForTimeout(600);
/**
 * ★ 클릭 좌표에만 기대지 않는다 (2026-08-19).
 * 로비 배치가 바뀌자 (270,880) 이 빈 곳이 되면서 **32건 전부 "무음"** 으로 나왔다 —
 * 소리가 죽은 게 아니라 검사가 잠금을 못 푼 것이었다. `--autoplay-policy` 로 이미
 * 컨텍스트는 돌고 있으니, 안 풀렸으면 직접 열고 그래도 안 되면 **거기서 멈춘다.**
 */
if (!(await p.evaluate(() => window.__dbg.Audio.isUnlocked()))) {
  await p.evaluate(() => window.__dbg.Audio.unlock());
  await p.waitForTimeout(200);
}
if (!(await p.evaluate(() => window.__dbg.Audio.isUnlocked()))) {
  console.error('오디오 잠금을 못 풀었다 — 아래 피크는 믿을 수 없다');
  process.exit(1);
}

const state = await p.evaluate(() => {
  const A = window.__dbg.Audio;
  const c = A.audioCtx();
  return { has: !!c, state: c && c.state, unlocked: A.isUnlocked(), sr: c && c.sampleRate };
});
console.log('AudioContext', JSON.stringify(state));

await p.evaluate(() => {
  const A = window.__dbg.Audio;
  const c = A.audioCtx();
  const an = c.createAnalyser();
  an.fftSize = 2048;
  A.masterOut().connect(an);
  window.__an = an;
  window.__buf = new Float32Array(an.fftSize);
});

async function peakOf(code, ms) {
  return p.evaluate(async ([src, dur]) => {
    const an = window.__an;
    const buf = window.__buf;
    let peak = 0;
    new Function('d', src)(window.__dbg);
    const t0 = performance.now();
    while (performance.now() - t0 < dur) {
      an.getFloatTimeDomainData(buf);
      for (let i = 0; i < buf.length; i++) {
        const v = Math.abs(buf[i]);
        if (v > peak) peak = v;
      }
      await new Promise((r) => setTimeout(r, 8));
    }
    return peak;
  }, [code, ms]);
}

const verdict = (pk) => (pk < 0.001 ? '무음 X' : pk > 0.99 ? '클리핑 !' : 'ok');

/**
 * ★ 목록을 **손으로 적지 않는다** (2026-08-19).
 * 효과음을 새로 만들 때마다 여기에 옮겨 적는 걸 잊어서, 새 소리는 늘 검사 밖에 있었다
 * (실제로 `sfx_rival_fell`·`sfx_rival_revive` 두 개가 그렇게 빠졌다).
 * 소스에서 키를 직접 긁으면 **새로 만든 소리는 자동으로 검사 대상이 된다.**
 */
const ids = [...readFileSync('src/audio/sfx.js', 'utf8').matchAll(/^\s{2}(sfx_[a-z_]+):/gm)]
  .map((m) => m[1])
  .filter((k) => k !== 'sfx_shout');   // 캐릭터 인자가 필요해서 아래 playShout 로 따로 잰다
if (ids.length < 17) { console.error(`효과음 목록을 못 긁었다 (${ids.length}개)`); process.exit(1); }
console.log(`효과음 ${ids.length}개 검사`);

await p.evaluate(() => window.__dbg.Bgm.stopBgm());
await p.waitForTimeout(300);

console.log('--- SFX 피크');
let bad = 0;
for (const id of ids) {
  const pk = await peakOf(`d.Sfx.play('${id}');`, 700);
  const v = verdict(pk);
  if (v !== 'ok') bad++;
  console.log('  ' + id.padEnd(18), pk.toFixed(4), v);
}
for (const c of ['ian', 'lisa', 'ipo']) {
  const pk = await peakOf(`d.Sfx.resetShoutGate(); d.Sfx.playShout('${c}');`, 500);
  const v = verdict(pk);
  if (v !== 'ok') bad++;
  console.log('  ' + ('sfx_shout:' + c).padEnd(18), pk.toFixed(4), v);
}

console.log('--- BGM 10트랙 피크');
for (let t = 1; t <= 10; t++) {
  const pk = await peakOf(`d.Bgm.forceTrack(${t}); d.Bgm.startBgm();`, 1500);
  const v = verdict(pk);
  if (v !== 'ok') bad++;
  console.log('  트랙' + String(t).padStart(2), pk.toFixed(4), v);
  await p.evaluate(() => window.__dbg.Bgm.stopBgm());
  await p.waitForTimeout(120);
}

console.log(bad === 0 ? '전부 통과' : `문제 ${bad}건`);
console.log('errors', errs.slice(0, 4));
await b.close();
