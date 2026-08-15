/**
 * 사운드 QA (진단 전용) — 실제 오디오 그래프에 애널라이저를 물려 피크를 측정한다.
 * 무음(합성 실패)과 클리핑(음량 과다)을 한 번에 잡는다.
 *   node tools/_audio-qa.mjs
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
await p.mouse.click(270, 880); // 제스처로 오디오 열기
await p.waitForTimeout(600);

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

const ids = ['sfx_step', 'sfx_step_alt', 'sfx_shoe_get', 'sfx_shoe_rare', 'sfx_turn', 'sfx_fall',
  'sfx_death', 'sfx_revive', 'sfx_menu_move', 'sfx_menu_select', 'sfx_menu_back', 'sfx_purchase',
  'sfx_denied', 'sfx_countdown', 'sfx_go', 'sfx_win', 'sfx_lose'];

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
