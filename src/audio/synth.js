/**
 * 8비트 파형 프리미티브.
 *
 * OscillatorType 의 'square' / 'triangle' / 'sawtooth' 는 그대로 쓰고,
 * 펄스파(듀티 12.5% · 25%)는 PeriodicWave 를 직접 만든다 — NES 음색의 핵심이다.
 * 노이즈는 버퍼를 한 번만 만들어 재사용한다 (매번 만들면 GC가 튄다).
 */

import { audioCtx, now, sfxOut } from './audio.js';

/** MIDI 노트 → 주파수 */
export const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

/** @type {Map<number, PeriodicWave>} 듀티비별 펄스파 캐시 */
const pulseCache = new Map();
/** @type {AudioBuffer|null} */
let noiseBuf = null;

/**
 * 듀티비 펄스파. 사각파의 푸리에 계수를 듀티에 맞춰 만든다.
 * @param {number} duty 0~1 (0.125 = NES 12.5%)
 */
export function pulseWave(duty) {
  const ctx = audioCtx();
  if (!ctx) return null;
  const key = Math.round(duty * 1000);
  const hit = pulseCache.get(key);
  if (hit) return hit;

  const N = 32;
  const real = new Float32Array(N);
  const imag = new Float32Array(N);
  for (let n = 1; n < N; n++) {
    // 듀티 d 펄스의 n차 진폭: (2/(nπ)) · sin(nπd)
    imag[n] = (2 / (n * Math.PI)) * Math.sin(n * Math.PI * duty);
  }
  const w = ctx.createPeriodicWave(real, imag, { disableNormalization: false });
  pulseCache.set(key, w);
  return w;
}

/** 1초짜리 화이트 노이즈 버퍼 (캐시) */
export function noiseBuffer() {
  const ctx = audioCtx();
  if (!ctx) return null;
  if (noiseBuf) return noiseBuf;
  const len = ctx.sampleRate;
  noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  // 결정적 난수 — 매 실행 같은 소리가 나야 디버깅이 된다
  let seed = 0x2f6e2b1;
  for (let i = 0; i < len; i++) {
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
    d[i] = ((seed >>> 0) / 0xffffffff) * 2 - 1;
  }
  return noiseBuf;
}

/**
 * ADSR 대신 쓰는 간단 엔벨로프. 8비트 음원은 어택이 거의 0이고 끝을 뚝 자른다.
 * @param {GainNode} g
 * @param {number} t0 시작 시각
 * @param {{a?:number,d?:number,s?:number,r?:number,peak?:number,sustain?:number}} e
 * @param {number} dur 서스테인 구간 길이(초)
 */
export function envelope(g, t0, e, dur) {
  const a = e.a ?? 0.002;
  const d = e.d ?? 0.02;
  const peak = e.peak ?? 1;
  const sus = e.sustain ?? peak * 0.6;
  const r = e.r ?? 0.04;
  const p = g.gain;
  p.setValueAtTime(0.0001, t0);
  p.linearRampToValueAtTime(peak, t0 + a);
  p.linearRampToValueAtTime(sus, t0 + a + d);
  p.setValueAtTime(sus, t0 + Math.max(a + d, dur));
  p.linearRampToValueAtTime(0.0001, t0 + Math.max(a + d, dur) + r);
  return t0 + Math.max(a + d, dur) + r;
}

/**
 * 한 음 연주. 모든 SFX·BGM이 결국 이걸 부른다.
 *
 * @param {object} o
 * @param {number|number[]} o.freq  고정 주파수, 또는 [시작, 끝] 스윕
 * @param {'square'|'triangle'|'sawtooth'|'sine'|number} [o.wave] 숫자면 펄스 듀티비
 * @param {number} [o.at] 시작 시각 (기본 now)
 * @param {number} [o.dur] 서스테인 길이
 * @param {number} [o.gain] 음량
 * @param {AudioNode} [o.out] 출력 버스 (기본 SFX)
 * @param {object} [o.env] 엔벨로프
 * @param {number} [o.vibrato] 비브라토 Hz
 * @param {number} [o.vibratoCents] 비브라토 깊이(cent)
 * @param {[number,number][]} [o.formants] 밴드패스 [주파수, Q] 직렬
 * @param {[number,number]} [o.formantSweep] 두 번째 포먼트를 [시작,끝]으로 스윕
 */
export function tone(o) {
  const ctx = audioCtx();
  if (!ctx) return 0;
  const t0 = o.at ?? now();
  const dur = o.dur ?? 0.1;
  const osc = ctx.createOscillator();

  if (typeof o.wave === 'number') {
    const w = pulseWave(o.wave);
    if (w) osc.setPeriodicWave(w);
  } else {
    osc.type = o.wave ?? 'square';
  }

  if (Array.isArray(o.freq)) {
    osc.frequency.setValueAtTime(o.freq[0], t0);
    // 지수 스윕이 사람 귀에 선형으로 들린다
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.freq[1]), t0 + dur);
  } else {
    osc.frequency.setValueAtTime(o.freq, t0);
  }

  // 비브라토 — 사람 목소리 흉내에 쓴다 (기획서 §9-7-1 ④)
  if (o.vibrato) {
    const lfo = ctx.createOscillator();
    const depth = ctx.createGain();
    const base = Array.isArray(o.freq) ? o.freq[0] : o.freq;
    lfo.frequency.value = o.vibrato;
    depth.gain.value = base * (Math.pow(2, (o.vibratoCents ?? 12) / 1200) - 1);
    lfo.connect(depth).connect(osc.frequency);
    lfo.start(t0);
    lfo.stop(t0 + dur + 0.2);
  }

  const g = ctx.createGain();
  const end = envelope(g, t0, { peak: o.gain ?? 0.3, ...(o.env ?? {}) }, dur);

  /** @type {AudioNode} */
  let node = osc;
  node.connect(g);
  /** @type {AudioNode} */
  let tail = g;

  if (o.formants) {
    o.formants.forEach(([f, q], i) => {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(f, t0);
      bp.Q.value = q;
      if (i === 1 && o.formantSweep) {
        bp.frequency.setValueAtTime(o.formantSweep[0], t0);
        bp.frequency.linearRampToValueAtTime(o.formantSweep[1], t0 + dur);
      }
      tail = tail.connect(bp);
    });
  }

  tail.connect(o.out ?? sfxOut());
  osc.start(t0);
  osc.stop(end + 0.02);
  return end;
}

/**
 * 노이즈 한 방. 타격음·숨소리·추락에 쓴다.
 * @param {object} o
 * @param {number} [o.at] @param {number} [o.dur] @param {number} [o.gain]
 * @param {'lowpass'|'highpass'|'bandpass'} [o.filter]
 * @param {number|number[]} [o.cutoff] 고정 또는 [시작,끝] 스윕
 * @param {AudioNode} [o.out] @param {object} [o.env]
 */
export function noise(o) {
  const ctx = audioCtx();
  const buf = noiseBuffer();
  if (!ctx || !buf) return 0;
  const t0 = o.at ?? now();
  const dur = o.dur ?? 0.05;

  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;

  /** @type {AudioNode} */
  let node = src;
  if (o.filter) {
    const f = ctx.createBiquadFilter();
    f.type = o.filter;
    if (Array.isArray(o.cutoff)) {
      f.frequency.setValueAtTime(o.cutoff[0], t0);
      f.frequency.exponentialRampToValueAtTime(Math.max(20, o.cutoff[1]), t0 + dur);
    } else {
      f.frequency.value = o.cutoff ?? 1000;
    }
    f.Q.value = 1;
    node = node.connect(f);
  }

  const g = ctx.createGain();
  const end = envelope(g, t0, { peak: o.gain ?? 0.2, d: 0.01, sustain: (o.gain ?? 0.2) * 0.5, ...(o.env ?? {}) }, dur);
  node.connect(g).connect(o.out ?? sfxOut());
  src.start(t0);
  src.stop(end + 0.02);
  return end;
}
