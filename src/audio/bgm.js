/**
 * BGM — 80~90년대 오락실 칩튠 10트랙. 100층마다 교체. (기획서 §9-7)
 *
 * 오디오 파일이 0개이므로 "재생"이 아니라 **연주**한다.
 * 16분음표 격자 위에서 리드(펄스) / 베이스(삼각) / 아르페지오 / 드럼(노이즈) 네 레이어를
 * 룩어헤드 스케줄러로 미리 예약한다. requestAnimationFrame 으로 음을 내면
 * 프레임이 밀릴 때 박자가 흔들리므로, 타이머는 깨우는 용도로만 쓰고
 * 실제 타이밍은 전부 AudioContext 시계에 맡긴다.
 */

import { AUDIO, BGM_BPM, bgmTrackAt } from '../config/balance.js';
import { audioCtx, now, bgmOut, ready } from './audio.js';
import { tone, noise, mtof } from './synth.js';

/** 자연단음계 — 칩튠 특유의 살짝 비장한 느낌 */
const SCALE = [0, 2, 3, 5, 7, 8, 10];
const deg = (d) => {
  const oct = Math.floor(d / 7);
  return SCALE[((d % 7) + 7) % 7] + oct * 12;
};

/**
 * 트랙 정의.
 *   root  : 조성(MIDI). 뒤로 갈수록 살짝 올려 긴장감을 준다
 *   prog  : 마디별 화음 이동(음계 도수)
 *   lead  : 16분음표 16칸 × 1마디 모티브. 숫자 = 음계 도수, null = 쉼표
 *   layers: 어떤 레이어를 켤지 — 기획서 표의 "성격"을 그대로 옮긴 것
 */
const TRACKS = [
  { root: 57, prog: [0, 3, 5, 4], lead: [0, null, 2, null, 4, null, 2, null, 0, null, null, 4, 2, null, null, null],
    layers: { bass: false, arp: false, kick: false, hat: true, snare: false } },
  { root: 57, prog: [0, 5, 3, 4], lead: [0, null, 0, 2, 4, null, 4, 2, 0, null, 2, null, 4, null, 5, null],
    layers: { bass: false, arp: false, kick: true, hat: true, snare: true } },
  { root: 57, prog: [0, 3, 4, 5], lead: [4, null, 2, 0, 2, null, 4, null, 5, null, 4, 2, 0, null, null, null],
    layers: { bass: true, arp: false, kick: true, hat: true, snare: true } },
  { root: 59, prog: [0, 4, 5, 3], lead: [0, 2, 4, null, 7, null, 4, null, 2, 4, null, 7, null, 5, null, null],
    layers: { bass: true, arp: true, kick: true, hat: true, snare: true } },
  { root: 59, prog: [0, 5, 3, 6], lead: [7, null, 5, 4, 2, null, 4, 5, 7, null, 8, null, 7, 5, null, null],
    layers: { bass: true, arp: true, kick: true, hat: true, snare: true } },
  { root: 60, prog: [0, 3, 5, 4], lead: [7, 5, 7, null, 9, null, 7, 5, 4, null, 5, 7, 9, null, 7, null],
    layers: { bass: true, arp: true, kick: true, hat: true, snare: true, leadOct: 1 } },
  { root: 60, prog: [0, 6, 5, 4], lead: [0, 4, 7, 4, 0, 4, 7, 9, 7, 4, 0, 4, 7, 9, 11, null],
    layers: { bass: true, arp: true, kick: true, hat: true, snare: true, bass8th: true } },
  { root: 62, prog: [0, 5, 6, 4], lead: [9, 7, 5, 7, 9, 11, 9, 7, 5, 4, 5, 7, 9, 11, 12, null],
    layers: { bass: true, arp: true, kick: true, hat: true, snare: true, bass8th: true, leadOct: 1 } },
  { root: 62, prog: [0, 3, 6, 5], lead: [12, 11, 9, 7, 9, 11, 12, 14, 12, 11, 9, 7, 5, 7, 9, 11],
    layers: { bass: true, arp: true, kick: true, hat: true, snare: true, bass8th: true } },
  { root: 64, prog: [0, 6, 4, 5], lead: [0, 7, 12, 7, 9, 12, 14, 12, 11, 7, 4, 7, 11, 14, 16, 14],
    layers: { bass: true, arp: true, kick: true, hat: true, snare: true, bass8th: true, leadOct: 1 } },
];

const BARS = 4;
const STEPS_PER_BAR = 16;
const TOTAL_STEPS = BARS * STEPS_PER_BAR;

let timer = null;
let step = 0;
let nextTime = 0;
let trackIdx = 0;
/** 마디 경계에서만 갈아탄다 — 곡 중간에 튀면 귀에 거슬린다 */
let pendingTrack = null;
let running = false;

/** 현재 트랙의 16분음표 한 칸 길이(초) */
function stepDur() {
  return 60 / BGM_BPM[trackIdx] / 4;
}

/** 한 스텝치 음을 예약한다 */
function scheduleStep(s, t) {
  const T = TRACKS[trackIdx];
  const L = T.layers;
  const out = bgmOut();
  const bar = (s / STEPS_PER_BAR) | 0;
  const i = s % STEPS_PER_BAR;
  const chord = T.prog[bar % T.prog.length];
  const sd = stepDur();

  // ── 리드 (펄스 25%) ──
  const d = T.lead[i];
  if (d !== null && d !== undefined) {
    const n = T.root + deg(d + chord) + (L.leadOct ?? 0) * 12;
    tone({ at: t, freq: mtof(n), wave: 0.25, dur: sd * 1.6, gain: 0.16, out,
      env: { a: 0.003, d: 0.03, sustain: 0.1, r: 0.05 } });
  }

  // ── 베이스 (삼각파) ──
  if (L.bass && (L.bass8th ? i % 2 === 0 : i % 4 === 0)) {
    const n = T.root - 12 + deg(chord);
    tone({ at: t, freq: mtof(n), wave: 'triangle', dur: sd * (L.bass8th ? 1.4 : 2.6), gain: 0.22, out,
      env: { a: 0.004, d: 0.04, sustain: 0.16, r: 0.05 } });
  }

  // ── 아르페지오 (펄스 12.5%, 화음을 빠르게 훑는다) ──
  if (L.arp && i % 2 === 1) {
    const tones = [0, 2, 4];
    const n = T.root + 12 + deg(tones[((i / 2) | 0) % 3] + chord);
    tone({ at: t, freq: mtof(n), wave: 0.125, dur: sd * 0.7, gain: 0.07, out,
      env: { a: 0.002, d: 0.015, sustain: 0.04, r: 0.02 } });
  }

  // ── 드럼 ──
  if (L.kick && (i === 0 || i === 8 || (bar % 2 === 1 && i === 14))) {
    tone({ at: t, freq: [150, 45], wave: 'sine', dur: 0.07, gain: 0.3, out,
      env: { a: 0.001, d: 0.03, sustain: 0.12, r: 0.04 } });
  }
  if (L.snare && (i === 4 || i === 12)) {
    noise({ at: t, dur: 0.05, gain: 0.14, filter: 'highpass', cutoff: 1400, out,
      env: { a: 0.001, d: 0.02, sustain: 0.05, r: 0.04 } });
  }
  if (L.hat && i % 2 === 0) {
    noise({ at: t, dur: 0.018, gain: i % 4 === 0 ? 0.06 : 0.035, filter: 'highpass', cutoff: 7000, out,
      env: { a: 0.001, d: 0.006, sustain: 0.01, r: 0.012 } });
  }
}

function tick() {
  const ctx = audioCtx();
  if (!ctx || !running) return;
  const horizon = ctx.currentTime + AUDIO.scheduleAheadSec;
  while (nextTime < horizon) {
    scheduleStep(step, nextTime);
    nextTime += stepDur();
    step = (step + 1) % TOTAL_STEPS;
    // 마디 머리에서 예약해 둔 트랙 교체를 반영한다
    if (step % STEPS_PER_BAR === 0 && pendingTrack !== null) {
      trackIdx = pendingTrack;
      pendingTrack = null;
    }
  }
}

/** 재생 시작 (이미 돌고 있으면 무시) */
export function startBgm() {
  if (running || !ready()) return;
  running = true;
  step = 0;
  nextTime = now() + 0.06;
  timer = setInterval(tick, AUDIO.schedulerTickMs);
  tick();
}

export function stopBgm() {
  running = false;
  if (timer) clearInterval(timer);
  timer = null;
}

/** 층수에 맞는 트랙으로 (다음 마디부터 적용) */
export function setFloor(floor) {
  const idx = bgmTrackAt(floor);
  if (idx === trackIdx || idx === pendingTrack) return;
  pendingTrack = idx;
}

/** 지금 연주 중인 트랙 번호 (1-based, 디버그·테스트용) */
export function currentTrack() {
  return trackIdx + 1;
}

export function isPlaying() {
  return running;
}

/** 트랙을 강제로 바꾼다 (사운드 테스트 전용) */
export function forceTrack(idx1based) {
  trackIdx = Math.max(0, Math.min(AUDIO.bgmTrackCount - 1, idx1based - 1));
  pendingTrack = null;
}
