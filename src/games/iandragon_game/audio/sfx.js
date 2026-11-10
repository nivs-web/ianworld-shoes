/**
 * 이안 드래곤 게임 — 효과음 28개 (겜팀장 · 팀 계획서 2.2 id 그대로). 전부 파형 합성 · 새로 지은 소리.
 */
import { tone, noise, midi } from './synth.js';

const arp = (notes, step, o = {}) => notes.forEach((n, i) => tone({ type: o.type ?? 'square', f0: midi(n), dur: o.dur ?? step * 1.4, vol: o.vol ?? 0.18, at: i * step }));

export const SFX = {
  /* 출격 (크기별) */
  deploy_s: () => { tone({ type: 'square', f0: 520, f1: 980, dur: 0.09, vol: 0.2 }); tone({ type: 'triangle', f0: 1200, dur: 0.06, vol: 0.12, at: 0.06 }); },
  deploy_m: () => { tone({ type: 'square', f0: 330, f1: 720, dur: 0.12, vol: 0.22 }); noise({ dur: 0.08, vol: 0.12, f0: 2500, at: 0.02 }); },
  deploy_l: () => { tone({ type: 'sawtooth', f0: 160, f1: 420, dur: 0.18, vol: 0.24 }); noise({ dur: 0.16, vol: 0.2, f0: 900, f1: 200 }); },
  /* 타격 */
  hit_light: () => { noise({ dur: 0.05, vol: 0.22, filter: 'bandpass', f0: 2600, q: 2 }); tone({ type: 'square', f0: 880, f1: 440, dur: 0.04, vol: 0.12 }); },
  hit_heavy: () => { noise({ dur: 0.12, vol: 0.32, f0: 1400, f1: 240 }); tone({ type: 'triangle', f0: 180, f1: 60, dur: 0.14, vol: 0.32 }); },
  hit_crit: () => { noise({ dur: 0.1, vol: 0.3, filter: 'highpass', f0: 3000 }); tone({ type: 'square', f0: 1320, f1: 1760, dur: 0.08, vol: 0.16 }); tone({ type: 'triangle', f0: 220, f1: 70, dur: 0.16, vol: 0.32, at: 0.02 }); },
  knockback: () => { tone({ type: 'triangle', f0: 600, f1: 180, dur: 0.16, vol: 0.2 }); noise({ dur: 0.1, vol: 0.12, f0: 1800, f1: 400 }); },
  die: () => { tone({ type: 'square', f0: 900, f1: 1600, dur: 0.07, vol: 0.16 }); noise({ dur: 0.14, vol: 0.14, filter: 'highpass', f0: 2500, at: 0.04 }); },   // 뿅
  /* 불씨 · 화로 · 준비 */
  ember: () => { tone({ type: 'triangle', f0: midi(84), dur: 0.06, vol: 0.12 }); tone({ type: 'triangle', f0: midi(91), dur: 0.08, vol: 0.1, at: 0.04 }); },
  wallet_up: () => arp([72, 76, 79, 84], 0.06, { vol: 0.16 }),
  ready: () => { tone({ type: 'sine', f0: midi(88), dur: 0.25, vol: 0.18 }); tone({ type: 'sine', f0: midi(95), dur: 0.2, vol: 0.08, at: 0.01 }); },   // 띵
  breath_ready: () => arp([67, 71, 74, 79, 83], 0.05, { type: 'triangle', vol: 0.15 }),
  breath_fire: () => { noise({ dur: 0.7, vol: 0.34, f0: 600, f1: 2400, q: 0.7 }); tone({ type: 'sawtooth', f0: 110, f1: 70, dur: 0.6, vol: 0.22 }); },
  /* 스킬 */
  skill_meteor: () => { tone({ type: 'sawtooth', f0: 1400, f1: 120, dur: 0.5, vol: 0.18 }); noise({ dur: 0.45, vol: 0.38, f0: 900, f1: 120, at: 0.45 }); tone({ type: 'triangle', f0: 90, f1: 40, dur: 0.4, vol: 0.4, at: 0.45 }); },
  skill_gust: () => { noise({ dur: 0.6, vol: 0.3, filter: 'bandpass', f0: 400, f1: 2400, q: 3 }); noise({ dur: 0.4, vol: 0.18, filter: 'bandpass', f0: 2400, f1: 700, q: 3, at: 0.3 }); },
  skill_frost: () => { arp([96, 91, 98, 93, 100], 0.04, { type: 'triangle', vol: 0.12, dur: 0.12 }); noise({ dur: 0.4, vol: 0.16, filter: 'highpass', f0: 5000, at: 0.05 }); },
  /* 포효 · 보스 */
  roar: () => { tone({ type: 'sawtooth', f0: 140, f1: 220, dur: 0.25, vol: 0.3 }); tone({ type: 'sawtooth', f0: 220, f1: 90, dur: 0.55, vol: 0.32, at: 0.22 }); noise({ dur: 0.7, vol: 0.2, f0: 700, f1: 200 }); },
  boss_warn: () => { for (let i = 0; i < 3; i++) { tone({ type: 'square', f0: 440, dur: 0.16, vol: 0.2, at: i * 0.36 }); tone({ type: 'square', f0: 330, dur: 0.16, vol: 0.2, at: i * 0.36 + 0.18 }); } },
  shockwave: () => { tone({ type: 'triangle', f0: 120, f1: 35, dur: 0.6, vol: 0.45 }); noise({ dur: 0.5, vol: 0.32, f0: 500, f1: 80 }); },
  /* 기지 */
  base_hit: () => { noise({ dur: 0.18, vol: 0.3, f0: 800, f1: 150 }); tone({ type: 'triangle', f0: 140, f1: 70, dur: 0.18, vol: 0.28 }); },
  base_break: () => { for (let i = 0; i < 4; i++) noise({ dur: 0.35, vol: 0.32, f0: 900 - i * 150, f1: 90, at: i * 0.12 }); tone({ type: 'triangle', f0: 100, f1: 30, dur: 0.9, vol: 0.42 }); },
  /* 보상 · 성장 */
  star: () => arp([79, 84, 88], 0.08, { type: 'square', vol: 0.15, dur: 0.18 }),
  levelup: () => arp([72, 76, 79, 84, 88, 91], 0.06, { vol: 0.15 }),
  evolve: () => { arp([60, 64, 67, 72, 76, 79, 84, 88], 0.07, { type: 'triangle', vol: 0.16 }); noise({ dur: 0.8, vol: 0.12, filter: 'highpass', f0: 4000, at: 0.3 }); },
  hatch_r: () => { noise({ dur: 0.1, vol: 0.2, filter: 'bandpass', f0: 1800, q: 4 }); arp([76, 79], 0.08, { vol: 0.14, dur: 0.15 }); },
  hatch_sr: () => { noise({ dur: 0.12, vol: 0.22, filter: 'bandpass', f0: 1800, q: 4 }); arp([76, 79, 83, 88], 0.07, { vol: 0.15, dur: 0.16 }); },
  hatch_ur: () => { noise({ dur: 0.14, vol: 0.24, filter: 'bandpass', f0: 1800, q: 4 }); arp([72, 76, 79, 84, 88, 91, 96], 0.07, { vol: 0.16, dur: 0.2 }); tone({ type: 'sine', f0: midi(100), dur: 0.8, vol: 0.08, at: 0.5 }); },
  fail: () => arp([67, 63, 60, 55], 0.14, { type: 'triangle', vol: 0.18, dur: 0.22 }),
  button: () => tone({ type: 'square', f0: 660, f1: 880, dur: 0.04, vol: 0.12 }),
};
