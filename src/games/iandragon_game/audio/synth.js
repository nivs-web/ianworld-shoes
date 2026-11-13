/**
 * 좀비와 드래곤 (옛 이름 이안 드래곤) — 소리 합성 바탕 (겜팀장). 파일 없이 Web Audio 파형만으로 (오락실 규칙).
 * 효과음 한 개 = tone() / noise() 몇 개를 겹친 것.
 */
let ctx = null, master = null, sfxBus = null, musicBus = null, voiceBus = null;

export function audio() {
  if (ctx) return { ctx, master, sfxBus, musicBus, voiceBus };
  const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = 0.8;
  /* 11/11 대표님 «귀가 아프다» — 쨍한 고음(네모파 · 쇳소리)을 6kHz 위로 5dB 깎고, 끝에 한 번 더 눌러 튀는 소리를 막는다 */
  const soft = ctx.createBiquadFilter(); soft.type = 'highshelf'; soft.frequency.value = 6000; soft.gain.value = -5;
  const lim = ctx.createDynamicsCompressor(); lim.threshold.value = -10; lim.knee.value = 6; lim.ratio.value = 12; lim.attack.value = 0.003; lim.release.value = 0.2;
  master.connect(soft); soft.connect(lim); lim.connect(ctx.destination);
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.connect(master);
  sfxBus = ctx.createGain(); sfxBus.gain.value = 0.55; sfxBus.connect(comp);
  musicBus = ctx.createGain(); musicBus.gain.value = 0.37; musicBus.connect(comp);
  voiceBus = ctx.createGain(); voiceBus.gain.value = 0.95; voiceBus.connect(master);
  return { ctx, master, sfxBus, musicBus, voiceBus };
}

let noiseBuf = null;
function noiseBuffer(c) {
  if (noiseBuf) return noiseBuf;
  noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
  const d = noiseBuf.getChannelData(0);
  let s = 12345;
  for (let i = 0; i < d.length; i++) { s = (s * 1103515245 + 12345) & 0x7fffffff; d[i] = (s / 0x3fffffff) - 1; }
  return noiseBuf;
}

/** pan = -1(왼쪽)~1(오른쪽) 또는 [시작, 끝] (지나가는 소리) — 11/12 필살기 회오리 */
function out(A, g, bus, pan, t, dur) {
  const dst = bus ?? A.sfxBus;
  if (pan == null || !A.ctx.createStereoPanner) { g.connect(dst); return; }
  const p = A.ctx.createStereoPanner(), [p0, p1] = Array.isArray(pan) ? pan : [pan, pan];
  p.pan.setValueAtTime(p0, t); if (p1 !== p0) p.pan.linearRampToValueAtTime(p1, t + dur);
  g.connect(p); p.connect(dst);
}

/** 음 하나: type · f0→f1(Hz) · dur(초) · vol · at(시작 지연) · bus */
export function tone({ type = 'square', f0 = 440, f1 = f0, dur = 0.12, vol = 0.3, at = 0, attack = 0.005, bus, detune = 0, vib, trem, pan, hold = false }) {   // hold = 끝 직전까지 크기 유지(길게 이어지는 소리)
  const A = audio(); if (!A) return;
  const t = A.ctx.currentTime + at;
  const o = A.ctx.createOscillator(), g = A.ctx.createGain();
  o.type = type; o.detune.value = detune;
  o.frequency.setValueAtTime(Math.max(20, f0), t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  if (hold) g.gain.setValueAtTime(vol, t + Math.max(attack, dur - Math.min(0.2, dur * 0.3)));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); out(A, g, bus, pan, t, dur);
  /* vib = { rate, depth(센트) } 떨림 · trem = { rate, depth(0~1) } 소리 크기 떨림 (방귀 · 으르렁 · 트롬본) */
  const lfos = [];
  if (vib) { const l = A.ctx.createOscillator(), lg = A.ctx.createGain(); l.frequency.value = vib.rate; lg.gain.value = vib.depth; l.connect(lg); lg.connect(o.detune); lfos.push(l); }
  if (trem) { const l = A.ctx.createOscillator(), lg = A.ctx.createGain(), tg = A.ctx.createGain(); l.type = 'square'; l.frequency.value = trem.rate; lg.gain.value = trem.depth * 0.5; tg.gain.value = 1 - trem.depth * 0.5; l.connect(lg); lg.connect(tg.gain); g.disconnect(); g.connect(tg); out(A, tg, bus, pan, t, dur); lfos.push(l); }
  o.start(t); o.stop(t + dur + 0.02);
  for (const l of lfos) { l.start(t); l.stop(t + dur + 0.02); }
}

/** 잡음 하나: dur · vol · 필터(lp/hp/bp 주파수 f0→f1) */
export function noise({ dur = 0.15, vol = 0.3, at = 0, filter = 'lowpass', f0 = 3000, f1 = f0, q = 1, bus, pan, swell = 0 }) {   // swell = 커지는 시간(초)
  const A = audio(); if (!A) return;
  const t = A.ctx.currentTime + at;
  const s = A.ctx.createBufferSource(); s.buffer = noiseBuffer(A.ctx);
  const fl = A.ctx.createBiquadFilter(); fl.type = filter; fl.Q.value = q;
  fl.frequency.setValueAtTime(f0, t); if (f1 !== f0) fl.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
  const g = A.ctx.createGain();
  /* swell > 0 이면 서서히 커져서 끝 직전까지 유지한 뒤 사라진다(휘이이잉 · 화르르르 같은 이어지는 소리) */
  if (swell > 0) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + swell); g.gain.setValueAtTime(vol, t + Math.max(swell, dur - Math.min(0.2, dur * 0.3))); } else g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(fl); fl.connect(g); out(A, g, bus, pan, t, dur);
  s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
}

export const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
