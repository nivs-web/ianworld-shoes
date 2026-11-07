/**
 * 줄넘기 챔피언 소리 — 오디오 파일 0개, 전부 Web Audio 로 합성한다. (2026-11-07)
 *
 *   const au = createAudio();   au.init()  ← 첫 터치 안에서 (자동재생 규칙)
 *   au.play('swish', { pitch }) · au.setOn(false)
 *
 * 게임 중에는 배경음악을 틀지 않는다 — 박자가 랜덤으로 바뀌는 게임이라 고정 박자 음악이
 * 오히려 박자를 헷갈리게 한다. 대신 **줄이 땅을 스치는 «휙» 소리**가 박자 역할을 한다.
 */

export function createAudio() {
  let ctx = null, master = null, noiseBuf = null;
  let on = true;

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume().catch(() => {}); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.7;
      const comp = ctx.createDynamicsCompressor();
      master.connect(comp);
      comp.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch { ctx = null; }
  }

  function tone(freq, t0, dur, { type = 'square', vol = 0.18, slide = 0, attack = 0.005 } = {}) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(master);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }
  function noise(t0, dur, { freq = 2000, q = 1, vol = 0.25, type = 'bandpass', sweep = 0 } = {}) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type; f.frequency.setValueAtTime(freq, t0); f.Q.value = q;
    if (sweep) f.frequency.exponentialRampToValueAtTime(freq * sweep, t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + dur * 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t0); src.stop(t0 + dur + 0.02);
  }

  const SND = {
    /* 줄이 땅을 스친다 — 박자 소리 */
    swish(t, o) { const p = o?.pitch || 1; noise(t, 0.11, { freq: 2600 * p, q: 2.5, vol: 0.32, sweep: 0.5 }); noise(t + 0.02, 0.05, { freq: 900 * p, q: 4, vol: 0.12 }); },
    jump(t) { tone(330, t, 0.1, { type: 'square', vol: 0.08, slide: 2 }); },
    high(t) { tone(300, t, 0.2, { type: 'square', vol: 0.09, slide: 3 }); },
    land(t) { tone(110, t, 0.08, { type: 'sine', vol: 0.25, slide: 0.6 }); noise(t, 0.05, { freq: 400, vol: 0.1, type: 'lowpass' }); },
    perfect(t) { tone(1046, t, 0.12, { type: 'triangle', vol: 0.2 }); tone(1568, t + 0.06, 0.18, { type: 'triangle', vol: 0.18 }); },
    great(t) { tone(880, t, 0.14, { type: 'triangle', vol: 0.18 }); },
    good(t) { tone(660, t, 0.12, { type: 'triangle', vol: 0.14 }); },
    trip(t) { tone(420, t, 0.35, { type: 'sawtooth', vol: 0.12, slide: 0.35 }); tone(90, t + 0.05, 0.25, { type: 'sine', vol: 0.35, slide: 0.5 }); noise(t + 0.05, 0.2, { freq: 300, vol: 0.2, type: 'lowpass' }); },
    shield(t) { tone(700, t, 0.25, { type: 'sine', vol: 0.2, slide: 1.6 }); tone(1050, t + 0.05, 0.25, { type: 'sine', vol: 0.12, slide: 1.6 }); },
    combo(t) { [784, 988, 1175, 1568].forEach((f, i) => tone(f, t + i * 0.06, 0.12, { type: 'square', vol: 0.09 })); },
    cue(t) { tone(1318, t, 0.09, { type: 'square', vol: 0.08 }); tone(1318, t + 0.12, 0.09, { type: 'square', vol: 0.08 }); },
    tick(t) { tone(660, t, 0.08, { type: 'square', vol: 0.1 }); },
    go(t) { tone(1320, t, 0.22, { type: 'square', vol: 0.12 }); },
    clear(t) { [523, 659, 784, 1046, 784, 1046].forEach((f, i) => tone(f, t + i * 0.1, i === 5 ? 0.4 : 0.12, { type: 'square', vol: 0.1 })); },
    fail(t) { [392, 370, 349, 311].forEach((f, i) => tone(f, t + i * 0.18, i === 3 ? 0.5 : 0.16, { type: 'triangle', vol: 0.16 })); },
    best(t) { [784, 1046, 1318, 1568, 2093].forEach((f, i) => tone(f, t + i * 0.07, 0.15, { type: 'triangle', vol: 0.12 })); },
    star(t, o) { tone(988 + (o?.n || 0) * 220, t, 0.18, { type: 'triangle', vol: 0.16 }); },
  };

  return {
    init,
    setOn(v) { on = !!v; },
    play(name, opt) {
      if (!on || !ctx || !SND[name]) return;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      try { SND[name](ctx.currentTime + 0.005, opt); } catch { /* 소리는 없어도 게임은 돈다 */ }
    },
    close() { try { ctx?.close(); } catch { /* */ } ctx = null; },
  };
}
