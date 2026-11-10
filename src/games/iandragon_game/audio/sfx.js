/**
 * 이안 드래곤 게임 — 효과음 v2 (겜팀장). 대표님 2026-11-10: «효과음은 재밌어야 한다 — 더 과장되고 웃기게».
 * 만화 같은 소리(뿡 · 보잉 · 꽝 · 슬라이드 휘슬 · 실망 트롬본)로 웃음을, 경보 · 심장 · 좀비 신음 · 우르릉으로 긴장을.
 * 전부 파형 합성 · 새로 지은 소리. 위쪽 28개는 팀 계획서 2.2 의 약속 id, 아래는 대사와 같이 터지는 소리 · 긴장 소리.
 */
import { tone, noise, midi } from './synth.js';

const arp = (notes, step, o = {}) => notes.forEach((n, i) => tone({ type: o.type ?? 'square', f0: midi(n), dur: o.dur ?? step * 1.4, vol: o.vol ?? 0.18, at: (o.at ?? 0) + i * step }));
const at = (t, f) => setTimeout(f, t * 1000);

/* ───── 웃긴 소리 · 긴장 소리 (대사 · 연출용) ───── */
export const FX = {
  toot: (a = 0) => { tone({ type: 'square', f0: 240, f1: 150, dur: 0.22, vol: 0.26, at: a, vib: { rate: 28, depth: 60 } }); noise({ dur: 0.12, vol: 0.08, f0: 500, at: a }); },             // 뿡!
  boing: (a = 0) => { tone({ type: 'triangle', f0: 180, f1: 720, dur: 0.09, vol: 0.28, at: a }); tone({ type: 'triangle', f0: 720, f1: 260, dur: 0.22, vol: 0.24, at: a + 0.08, vib: { rate: 22, depth: 140 } }); },
  bonk: (a = 0) => { tone({ type: 'triangle', f0: 700, f1: 160, dur: 0.09, vol: 0.34, at: a }); noise({ dur: 0.05, vol: 0.22, filter: 'bandpass', f0: 1400, q: 3, at: a }); },            // 꽝
  slide_up: (a = 0) => tone({ type: 'sine', f0: 320, f1: 1400, dur: 0.38, vol: 0.24, at: a, vib: { rate: 9, depth: 30 } }),
  slide_down: (a = 0) => tone({ type: 'sine', f0: 1400, f1: 260, dur: 0.45, vol: 0.24, at: a, vib: { rate: 9, depth: 30 } }),
  thud: (a = 0) => { tone({ type: 'triangle', f0: 110, f1: 38, dur: 0.24, vol: 0.5, at: a }); noise({ dur: 0.16, vol: 0.22, f0: 500, f1: 120, at: a }); },
  fire_pop: (a = 0) => { noise({ dur: 0.18, vol: 0.32, filter: 'bandpass', f0: 900, f1: 2600, q: 1.5, at: a }); tone({ type: 'square', f0: 380, f1: 900, dur: 0.1, vol: 0.14, at: a }); },
  whoosh: (a = 0) => noise({ dur: 0.38, vol: 0.32, filter: 'bandpass', f0: 280, f1: 3200, q: 2.2, at: a }),
  spit: (a = 0) => { noise({ dur: 0.06, vol: 0.2, filter: 'highpass', f0: 3000, at: a }); tone({ type: 'square', f0: 520, f1: 180, dur: 0.12, vol: 0.2, at: a + 0.03 }); },             // 퉤
  zoom: (a = 0) => tone({ type: 'sawtooth', f0: 220, f1: 1800, dur: 0.26, vol: 0.18, at: a }),
  splash: (a = 0) => { noise({ dur: 0.32, vol: 0.28, f0: 4200, f1: 500, at: a }); for (let i = 0; i < 4; i++) tone({ type: 'sine', f0: 1100 + i * 260, f1: 700 + i * 200, dur: 0.06, vol: 0.12, at: a + 0.04 + i * 0.05 }); },
  freeze: (a = 0) => { arp([96, 100, 103, 108], 0.04, { type: 'triangle', vol: 0.12, at: a, dur: 0.1 }); noise({ dur: 0.3, vol: 0.12, filter: 'highpass', f0: 6000, at: a }); },
  zap: (a = 0) => { for (let i = 0; i < 6; i++) tone({ type: 'square', f0: 900 + ((i * 397) % 900), dur: 0.03, vol: 0.16, at: a + i * 0.035 }); noise({ dur: 0.2, vol: 0.14, filter: 'highpass', f0: 4000, at: a }); },
  coin_jingle: (a = 0) => arp([95, 100, 104], 0.05, { type: 'square', vol: 0.13, at: a, dur: 0.1 }),
  growl: (a = 0) => { tone({ type: 'sawtooth', f0: 95, f1: 70, dur: 0.7, vol: 0.32, at: a, trem: { rate: 26, depth: 0.7 } }); noise({ dur: 0.7, vol: 0.16, f0: 600, f1: 250, at: a }); },
  stomp: (a = 0) => { tone({ type: 'triangle', f0: 90, f1: 30, dur: 0.35, vol: 0.6, at: a }); noise({ dur: 0.4, vol: 0.3, f0: 400, f1: 80, at: a }); },
  sad_trombone: (a = 0) => { [67, 66, 65].forEach((n, i) => tone({ type: 'sawtooth', f0: midi(n), dur: 0.3, vol: 0.16, at: a + i * 0.32 })); tone({ type: 'sawtooth', f0: midi(64), f1: midi(63), dur: 0.9, vol: 0.18, at: a + 0.96, vib: { rate: 6, depth: 40 } }); },   // 뿌 뿌 뿌 뿌우~
  fart: (a = 0) => { tone({ type: 'square', f0: 95, f1: 62, dur: 0.5, vol: 0.3, at: a, trem: { rate: 34, depth: 0.85 } }); noise({ dur: 0.45, vol: 0.12, f0: 320, at: a }); },
  rumble: (a = 0) => { noise({ dur: 1.3, vol: 0.38, f0: 220, f1: 90, at: a }); tone({ type: 'triangle', f0: 52, f1: 38, dur: 1.3, vol: 0.4, at: a, trem: { rate: 9, depth: 0.5 } }); },
  steam: (a = 0) => noise({ dur: 0.7, vol: 0.22, filter: 'highpass', f0: 2800, at: a }),
  screech: (a = 0) => { tone({ type: 'sawtooth', f0: 1200, f1: 1900, dur: 0.18, vol: 0.16, at: a }); tone({ type: 'sawtooth', f0: 1900, f1: 1000, dur: 0.3, vol: 0.16, at: a + 0.17, vib: { rate: 18, depth: 80 } }); },
  alarm: (a = 0) => { for (let i = 0; i < 4; i++) tone({ type: 'square', f0: i % 2 ? 660 : 880, dur: 0.14, vol: 0.18, at: a + i * 0.15 }); },
  servo: (a = 0) => { tone({ type: 'square', f0: 300, f1: 520, dur: 0.14, vol: 0.12, at: a }); tone({ type: 'square', f0: 520, f1: 300, dur: 0.14, vol: 0.12, at: a + 0.16 }); },
  power_down: (a = 0) => tone({ type: 'sawtooth', f0: 900, f1: 50, dur: 1.2, vol: 0.2, at: a }),
  sparkle: (a = 0) => arp([88, 95, 91, 100, 96, 103], 0.045, { type: 'triangle', vol: 0.12, at: a, dur: 0.12 }),
  crowd: (a = 0) => { noise({ dur: 1.4, vol: 0.2, filter: 'bandpass', f0: 700, f1: 1100, q: 0.8, at: a }); noise({ dur: 1.2, vol: 0.1, filter: 'bandpass', f0: 2400, q: 1, at: a + 0.1 }); },   // 와아아
  heartbeat: (a = 0) => { tone({ type: 'sine', f0: 62, f1: 40, dur: 0.16, vol: 0.6, at: a }); tone({ type: 'sine', f0: 58, f1: 38, dur: 0.18, vol: 0.5, at: a + 0.22 }); },              // 쿵-쿵
  groan: (a = 0) => { tone({ type: 'sawtooth', f0: 120, f1: 88, dur: 0.9, vol: 0.18, at: a, vib: { rate: 5, depth: 60 } }); noise({ dur: 0.9, vol: 0.08, f0: 500, at: a }); },             // 으어어 (좀비)
  organ: (a = 0) => { [[81, 0.12], [79, 0.12], [81, 0.5], [79, 0.1], [77, 0.1], [76, 0.1], [74, 0.1], [73, 0.3], [74, 0.7]].reduce((t, [n, d]) => { for (const o of [0, -12, 7]) tone({ type: 'sawtooth', f0: midi(n + o), dur: d * 0.95, vol: 0.07, at: a + t }); return t + d; }, 0); },   // 바흐 토카타 첫 마디 (보스 경고)
};

/* ───── 게임 약속 id 28개 (더 과장 · 코믹하게) ───── */
export const SFX = {
  deploy_s: () => { FX.boing(); tone({ type: 'square', f0: 900, f1: 1400, dur: 0.06, vol: 0.12, at: 0.05 }); },
  deploy_m: () => { FX.boing(); FX.whoosh(0.02); },
  deploy_l: () => { FX.thud(); FX.boing(0.1); },
  hit_light: () => { noise({ dur: 0.05, vol: 0.24, filter: 'bandpass', f0: 2600, q: 2 }); tone({ type: 'square', f0: 990, f1: 500, dur: 0.05, vol: 0.12 }); },
  hit_heavy: () => { FX.bonk(); FX.thud(0.02); },
  hit_crit: () => { FX.bonk(); tone({ type: 'square', f0: 1320, f1: 2200, dur: 0.1, vol: 0.16 }); noise({ dur: 0.12, vol: 0.28, filter: 'highpass', f0: 3200 }); FX.thud(0.03); },   // 콰광!
  knockback: () => { FX.slide_down(); noise({ dur: 0.1, vol: 0.12, f0: 1800, f1: 400 }); },
  die: () => { tone({ type: 'square', f0: 700, f1: 1700, dur: 0.08, vol: 0.18 }); noise({ dur: 0.16, vol: 0.16, filter: 'highpass', f0: 2500, at: 0.05 }); tone({ type: 'triangle', f0: 1700, f1: 400, dur: 0.2, vol: 0.1, at: 0.1, vib: { rate: 24, depth: 120 } }); },   // 뿅~
  ember: () => { tone({ type: 'triangle', f0: midi(84), dur: 0.06, vol: 0.12 }); tone({ type: 'triangle', f0: midi(91), dur: 0.08, vol: 0.1, at: 0.04 }); },
  wallet_up: () => { arp([72, 76, 79, 84], 0.06, { vol: 0.16 }); FX.coin_jingle(0.22); },
  ready: () => { tone({ type: 'sine', f0: midi(88), dur: 0.3, vol: 0.2 }); tone({ type: 'sine', f0: midi(95), dur: 0.22, vol: 0.09, at: 0.01 }); },   // 띵!
  breath_ready: () => { arp([67, 71, 74, 79, 83], 0.05, { type: 'triangle', vol: 0.15 }); FX.sparkle(0.25); },
  breath_fire: () => { noise({ dur: 0.9, vol: 0.38, f0: 600, f1: 2600, q: 0.7 }); tone({ type: 'sawtooth', f0: 120, f1: 60, dur: 0.8, vol: 0.24, trem: { rate: 18, depth: 0.4 } }); FX.rumble(0.1); },
  skill_meteor: () => { tone({ type: 'sawtooth', f0: 1600, f1: 120, dur: 0.6, vol: 0.18 }); at(0.55, () => { FX.stomp(); noise({ dur: 0.6, vol: 0.4, f0: 900, f1: 100 }); }); },
  skill_gust: () => { FX.whoosh(); noise({ dur: 0.5, vol: 0.2, filter: 'bandpass', f0: 2600, f1: 600, q: 3, at: 0.3 }); FX.slide_up(0.1); },
  skill_frost: () => { FX.freeze(); arp([100, 96, 103, 98, 107], 0.05, { type: 'triangle', vol: 0.12, dur: 0.14, at: 0.15 }); },
  roar: () => { FX.growl(); tone({ type: 'sawtooth', f0: 220, f1: 90, dur: 0.6, vol: 0.32, at: 0.2 }); FX.rumble(0.25); },
  boss_warn: () => { FX.organ(); FX.alarm(1.8); },                                                         // 띠로리~ (토카타) + 경보
  shockwave: () => { FX.stomp(); tone({ type: 'triangle', f0: 140, f1: 30, dur: 0.7, vol: 0.45 }); noise({ dur: 0.6, vol: 0.34, f0: 500, f1: 70 }); },
  base_hit: () => { FX.thud(); noise({ dur: 0.12, vol: 0.14, filter: 'highpass', f0: 3000 }); },
  base_break: () => { for (let i = 0; i < 5; i++) noise({ dur: 0.4, vol: 0.34, f0: 1000 - i * 150, f1: 90, at: i * 0.11 }); FX.stomp(0.05); FX.rumble(0.3); },
  star: () => { arp([79, 84, 88], 0.09, { type: 'square', vol: 0.16, dur: 0.2 }); FX.sparkle(0.25); },
  levelup: () => { arp([72, 76, 79, 84, 88, 91], 0.06, { vol: 0.15 }); FX.crowd(0.3); },
  evolve: () => { arp([60, 64, 67, 72, 76, 79, 84, 88, 91, 96], 0.06, { type: 'triangle', vol: 0.16 }); FX.sparkle(0.5); noise({ dur: 0.9, vol: 0.12, filter: 'highpass', f0: 4000, at: 0.3 }); },
  hatch_r: () => { FX.bonk(); arp([76, 79], 0.08, { vol: 0.14, dur: 0.15, at: 0.1 }); },
  hatch_sr: () => { FX.bonk(); arp([76, 79, 83, 88], 0.07, { vol: 0.15, dur: 0.16, at: 0.1 }); FX.sparkle(0.4); },
  hatch_ur: () => { FX.organ(); at(1.4, () => { arp([72, 76, 79, 84, 88, 91, 96], 0.07, { vol: 0.17, dur: 0.2 }); FX.crowd(0.3); }); },   // 두구두구… 전설!
  fail: () => FX.sad_trombone(),                                                                          // 뿌 뿌 뿌 뿌우~
  button: () => tone({ type: 'square', f0: 660, f1: 880, dur: 0.04, vol: 0.12 }),
  /* 새 id — 긴장 · 웃음 연출 (겜부장에게 목록 전달) */
  ...Object.fromEntries(Object.entries(FX).map(([k, f]) => [k, () => f(0)])),
};
