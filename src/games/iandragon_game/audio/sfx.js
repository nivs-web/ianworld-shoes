/**
 * 좀비와 드래곤 (옛 이름 이안 드래곤) — 효과음 v2 (겜팀장). 대표님 2026-11-10: «효과음은 재밌어야 한다 — 더 과장되고 웃기게».
 * 만화 같은 소리(뿡 · 보잉 · 꽝 · 슬라이드 휘슬 · 실망 트롬본)로 웃음을, 경보 · 심장 · 좀비 신음 · 우르릉으로 긴장을.
 * 전부 파형 합성 · 새로 지은 소리. 위쪽 28개는 팀 계획서 2.2 의 약속 id, 아래는 대사와 같이 터지는 소리 · 긴장 소리.
 * v3 (2026-11-11): 소환(deploy_s/m/l = summon_s/m/l 별칭) 더 과장 · 새 id = summon_rare · hit_zombie_squish · breath_charge ·
 *   win_fanfare · lose_womp · button_back · button_deny.  맨 아래 FUN_SFX = 배경 «재미 요소» 작은 소리 후보 17종(기본 꺼 둠).
 * v4 (2026-11-11, 2차 월드 6~10): 새 id = ghost_revive · purify · poison_tick · poison_cloud · shield_block · shield_break · weaken_curse ·
 *   sandstorm · no_knockback · shadow_dash · gem_beam · hammer_quake · boss_cutin · boss_big_attack_warn · lord_roar · lord_shockwave · ending_sting.
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
  /* 소환 — 작을수록 앙증맞게 «뾰잉», 클수록 «쿵! 우르릉! 보잉!» (v3 더 과장) */
  deploy_s: () => { tone({ type: 'triangle', f0: 260, f1: 980, dur: 0.07, vol: 0.28 }); tone({ type: 'triangle', f0: 980, f1: 420, dur: 0.17, vol: 0.24, at: 0.06, vib: { rate: 26, depth: 160 } }); arp([96, 101, 105], 0.045, { type: 'triangle', vol: 0.1, at: 0.2, dur: 0.09 }); },
  deploy_m: () => { FX.boing(); FX.whoosh(0.02); FX.fire_pop(0.14); tone({ type: 'square', f0: 440, f1: 880, dur: 0.12, vol: 0.12, at: 0.1 }); arp([84, 88, 91], 0.05, { type: 'square', vol: 0.1, at: 0.3, dur: 0.1 }); },
  deploy_l: () => { FX.stomp(); FX.boing(0.12); tone({ type: 'sawtooth', f0: 190, f1: 70, dur: 0.55, vol: 0.2, at: 0.15, trem: { rate: 20, depth: 0.5 } }); noise({ dur: 0.7, vol: 0.3, f0: 600, f1: 80, at: 0.05 }); noise({ dur: 0.3, vol: 0.14, filter: 'highpass', f0: 3500, at: 0.35 }); arp([60, 64, 67, 72], 0.07, { vol: 0.12, at: 0.4, dur: 0.14 }); },   // 쿵 · 먼지 · 보잉 · 팡파르 꼬리
  summon_s: () => SFX.deploy_s(), summon_m: () => SFX.deploy_m(), summon_l: () => SFX.deploy_l(),   // 별칭 (소환 = deploy)
  summon_rare: () => {                                                                                // 반짝! 희귀 드래곤 — 올라가는 별가루 + 종소리
    arp([84, 88, 91, 96, 100, 103, 108], 0.05, { type: 'triangle', vol: 0.13, dur: 0.14 });
    tone({ type: 'sine', f0: midi(96), dur: 0.9, vol: 0.14, at: 0.3 }); tone({ type: 'sine', f0: midi(103), dur: 0.8, vol: 0.1, at: 0.33 }); tone({ type: 'sine', f0: midi(108), dur: 0.7, vol: 0.07, at: 0.36 });
    noise({ dur: 0.8, vol: 0.12, filter: 'highpass', f0: 6500, at: 0.25 }); FX.slide_up(0.05); FX.sparkle(0.45);
  },
  hit_light: () => { noise({ dur: 0.05, vol: 0.24, filter: 'bandpass', f0: 2600, q: 2 }); tone({ type: 'square', f0: 990, f1: 500, dur: 0.05, vol: 0.12 }); },
  hit_heavy: () => { FX.bonk(); FX.thud(0.02); },
  hit_crit: () => { FX.bonk(); tone({ type: 'square', f0: 1320, f1: 2200, dur: 0.1, vol: 0.16 }); noise({ dur: 0.12, vol: 0.28, filter: 'highpass', f0: 3200 }); FX.thud(0.03); },   // 콰광!
  hit_zombie_squish: () => {                                                                          // 찌걱·물컹! 코믹 질척 소리 (때마다 높낮이 조금씩 달라진다)
    const p = 0.9 + Math.random() * 0.25;
    tone({ type: 'sawtooth', f0: 260 * p, f1: 70 * p, dur: 0.28, vol: 0.26, vib: { rate: 30, depth: 220 } });
    noise({ dur: 0.22, vol: 0.3, filter: 'bandpass', f0: 1500, f1: 280, q: 3 });
    tone({ type: 'triangle', f0: 120 * p, f1: 50, dur: 0.16, vol: 0.3 });
    tone({ type: 'sine', f0: 180 * p, f1: 520 * p, dur: 0.1, vol: 0.22, at: 0.16 });                  // 뽀글 (공기 방울)
    tone({ type: 'sine', f0: 520 * p, f1: 260 * p, dur: 0.12, vol: 0.18, at: 0.25, vib: { rate: 20, depth: 100 } });
    noise({ dur: 0.1, vol: 0.2, filter: 'highpass', f0: 2600, at: 0.3 });                              // 튀는 물방울
  },
  knockback: () => { FX.slide_down(); noise({ dur: 0.1, vol: 0.12, f0: 1800, f1: 400 }); },
  die: () => { tone({ type: 'square', f0: 700, f1: 1700, dur: 0.08, vol: 0.18 }); noise({ dur: 0.16, vol: 0.16, filter: 'highpass', f0: 2500, at: 0.05 }); tone({ type: 'triangle', f0: 1700, f1: 400, dur: 0.2, vol: 0.1, at: 0.1, vib: { rate: 24, depth: 120 } }); },   // 뿅~
  ember: () => { tone({ type: 'triangle', f0: midi(84), dur: 0.06, vol: 0.12 }); tone({ type: 'triangle', f0: midi(91), dur: 0.08, vol: 0.1, at: 0.04 }); },
  wallet_up: () => { arp([72, 76, 79, 84], 0.06, { vol: 0.16 }); FX.coin_jingle(0.22); },
  ready: () => { tone({ type: 'sine', f0: midi(88), dur: 0.3, vol: 0.2 }); tone({ type: 'sine', f0: midi(95), dur: 0.22, vol: 0.09, at: 0.01 }); },   // 띵!
  breath_ready: () => { arp([67, 71, 74, 79, 83], 0.05, { type: 'triangle', vol: 0.15 }); FX.sparkle(0.25); },
  breath_fire: () => { noise({ dur: 0.9, vol: 0.38, f0: 600, f1: 2600, q: 0.7 }); tone({ type: 'sawtooth', f0: 120, f1: 60, dur: 0.8, vol: 0.24, trem: { rate: 18, depth: 0.4 } }); FX.rumble(0.1); },
  breath_charge: () => {                                                                              // 우우웅~ 점점 커지는 숨 모으기 (약 1초, breath_fire 직전에)
    tone({ type: 'sawtooth', f0: 70, f1: 460, dur: 1, vol: 0.2, attack: 0.9, trem: { rate: 14, depth: 0.5 } });
    tone({ type: 'triangle', f0: 140, f1: 920, dur: 1, vol: 0.12, attack: 0.9 });
    for (let i = 0; i < 6; i++) noise({ dur: 0.2, vol: 0.05 + i * 0.05, filter: 'bandpass', f0: 300 + i * 400, f1: 700 + i * 550, q: 2, at: i * 0.16 });
  },
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
  win_fanfare: () => {                                                                                // 빠빠빠 빠~아! 승리 팡파르 (약 2.5초, 뒤는 환호 꼬리)
    const brass = (n, d, a, v = 0.16) => { tone({ type: 'sawtooth', f0: midi(n), dur: d, vol: v, at: a, vib: { rate: 6, depth: 14 } }); tone({ type: 'square', f0: midi(n), dur: d * 0.9, vol: v * 0.5, at: a, detune: 7 }); };
    [0, 0.13, 0.26].forEach((a) => brass(67, 0.11, a)); brass(72, 0.42, 0.39); brass(71, 0.14, 0.86); brass(72, 0.14, 1);
    [60, 64, 67, 72, 76].forEach((n) => brass(n, 0.85, 1.14, 0.1));                                     // 으뜸화음 길게
    tone({ type: 'triangle', f0: 110, f1: 48, dur: 0.25, vol: 0.5, at: 1.14 }); noise({ dur: 0.9, vol: 0.2, filter: 'highpass', f0: 4500, at: 1.14 });
    FX.sparkle(1.3); FX.crowd(1.2);
  },
  lose_womp: () => {                                                                                  // 와~ㅁ 와~ㅁ 와아앙… 풀 죽은 소리 (약 1.8초)
    tone({ type: 'sawtooth', f0: 311, f1: 262, dur: 0.3, vol: 0.2, vib: { rate: 6, depth: 30 } });
    tone({ type: 'sawtooth', f0: 277, f1: 233, dur: 0.3, vol: 0.2, at: 0.34, vib: { rate: 6, depth: 30 } });
    tone({ type: 'sawtooth', f0: 247, f1: 80, dur: 1, vol: 0.22, at: 0.7, vib: { rate: 7, depth: 90 } });
    tone({ type: 'square', f0: 124, f1: 40, dur: 1, vol: 0.1, at: 0.7 }); FX.thud(1.65);
  },
  button: () => tone({ type: 'square', f0: 660, f1: 880, dur: 0.04, vol: 0.12 }),
  button_back: () => { tone({ type: 'square', f0: 660, f1: 520, dur: 0.05, vol: 0.12 }); tone({ type: 'square', f0: 520, f1: 330, dur: 0.07, vol: 0.12, at: 0.05 }); },   // 뾱↘ 뒤로
  button_deny: () => { for (let i = 0; i < 2; i++) { tone({ type: 'square', f0: 150, f1: 110, dur: 0.09, vol: 0.2, at: i * 0.12, trem: { rate: 40, depth: 0.5 } }); noise({ dur: 0.05, vol: 0.1, f0: 600, at: i * 0.12 }); } },   // 붑-붑 안 돼요
  /* 부화장 (알 깨기) — 흔들림 → 금 → 등급별 등장. 흔들림 · 금은 여러 번 불러도 되게 짧게 */
  egg_shake: () => { for (let i = 0; i < 3; i++) { tone({ type: 'triangle', f0: 340 + (i % 2) * 60, f1: 260, dur: 0.06, vol: 0.16, at: i * 0.09 }); noise({ dur: 0.04, vol: 0.08, filter: 'bandpass', f0: 1800, q: 4, at: i * 0.09 }); } },   // 달그락 달그락
  egg_crack: () => { noise({ dur: 0.05, vol: 0.3, filter: 'highpass', f0: 2600, at: 0 }); noise({ dur: 0.04, vol: 0.24, filter: 'bandpass', f0: 3800, q: 5, at: 0.06 }); noise({ dur: 0.07, vol: 0.2, filter: 'bandpass', f0: 2200, q: 3, at: 0.11 }); tone({ type: 'square', f0: 1500, f1: 900, dur: 0.05, vol: 0.08, at: 0.02 }); },   // 쩍 · 빠직
  hatch_reveal_rare: () => { noise({ dur: 0.18, vol: 0.28, filter: 'highpass', f0: 2000 }); FX.boing(0.05); arp([79, 84, 88], 0.08, { type: 'triangle', vol: 0.15, dur: 0.18, at: 0.2 }); },   // 뽕! 짜잔
  hatch_reveal_super: () => { noise({ dur: 0.22, vol: 0.3, filter: 'highpass', f0: 1800 }); FX.slide_up(0.02); arp([72, 76, 79, 84, 88, 91], 0.07, { vol: 0.15, dur: 0.18, at: 0.3 }); FX.sparkle(0.75); },
  hatch_reveal_legend: () => {   // 두구두구두구… 쾅! 전설!
    for (let i = 0; i < 14; i++) noise({ dur: 0.06, vol: 0.14 + i * 0.012, f0: 260, f1: 120, at: i * 0.09 });
    at(1.3, () => { FX.stomp(); noise({ dur: 0.5, vol: 0.32, filter: 'highpass', f0: 1500 }); arp([60, 67, 72, 76, 79, 84, 88, 91, 96], 0.06, { type: 'sawtooth', vol: 0.12, dur: 0.22, at: 0.1 }); FX.crowd(0.4); FX.sparkle(0.8); });
  },
  /* ───── v4 · 2차 효과음 (월드 6~10) — 유령 · 독 · 수정 방패 · 사막 · 그림자 · 보스 · 로드 · 엔딩 ───── */
  ghost_revive: () => {                                                                               // 우우웅~ 유령이 스르륵 떠오름 (약 1.2초)
    tone({ type: 'sine', f0: 150, f1: 430, dur: 1, vol: 0.2, attack: 0.5, vib: { rate: 6, depth: 50 } });
    tone({ type: 'triangle', f0: 300, f1: 860, dur: 1, vol: 0.09, attack: 0.6, vib: { rate: 7, depth: 70 } });
    noise({ dur: 0.9, vol: 0.07, filter: 'bandpass', f0: 400, f1: 1500, q: 3 });
    tone({ type: 'sine', f0: 1100, f1: 1500, dur: 0.25, vol: 0.06, at: 0.95, vib: { rate: 14, depth: 60 } });   // 스으
  },
  purify: () => {                                                                                     // 띠링~ 맑은 종소리 + 반짝이 (약 1.3초)
    tone({ type: 'sine', f0: midi(84), dur: 1.2, vol: 0.16 }); tone({ type: 'sine', f0: midi(91), dur: 1, vol: 0.1, at: 0.02 });
    tone({ type: 'sine', f0: midi(96), dur: 0.8, vol: 0.07, at: 0.04 });
    tone({ type: 'sine', f0: midi(88), dur: 0.9, vol: 0.12, at: 0.25 }); tone({ type: 'sine', f0: midi(95), dur: 0.7, vol: 0.07, at: 0.27 });
    noise({ dur: 0.6, vol: 0.05, filter: 'highpass', f0: 7000, at: 0.1 }); FX.sparkle(0.4);
  },
  poison_tick: () => {                                                                                // 보글 (0.15초 안 · 자주 울려도 작게 · 높낮이 조금씩)
    const p = 0.9 + Math.random() * 0.2;
    tone({ type: 'sine', f0: 200 * p, f1: 520 * p, dur: 0.07, vol: 0.08 });
    tone({ type: 'sine', f0: 320 * p, f1: 640 * p, dur: 0.06, vol: 0.06, at: 0.06 });
    noise({ dur: 0.05, vol: 0.035, filter: 'bandpass', f0: 700, q: 2 });
  },
  poison_cloud: () => {                                                                               // 푸쉬이~ 보글보글 독 구름 (약 1초)
    noise({ dur: 0.9, vol: 0.2, f0: 1100, f1: 300 }); noise({ dur: 0.5, vol: 0.06, filter: 'highpass', f0: 3000 });
    tone({ type: 'sawtooth', f0: 95, f1: 60, dur: 0.85, vol: 0.09, trem: { rate: 8, depth: 0.5 } });
    for (let i = 0; i < 7; i++) tone({ type: 'sine', f0: rnd(170, 300), f1: rnd(400, 650), dur: rnd(0.07, 0.1), vol: 0.07, at: 0.1 + i * 0.1 + rnd(0, 0.03) });
  },
  shield_block: () => {                                                                               // 챙! 방어막이 막았다 (약 0.3초)
    tone({ type: 'triangle', f0: 1800, f1: 1200, dur: 0.18, vol: 0.2 }); tone({ type: 'sine', f0: 2700, dur: 0.26, vol: 0.09 });
    noise({ dur: 0.05, vol: 0.2, filter: 'bandpass', f0: 4000, q: 4 }); tone({ type: 'square', f0: 900, f1: 600, dur: 0.07, vol: 0.09 });
  },
  shield_break: () => {                                                                               // 와장창! 유리 깨짐 (약 0.8초)
    noise({ dur: 0.14, vol: 0.28, filter: 'highpass', f0: 3000 }); tone({ type: 'triangle', f0: 220, f1: 60, dur: 0.2, vol: 0.28 });
    noise({ dur: 0.3, vol: 0.12, filter: 'bandpass', f0: 2200, f1: 900, q: 1.5, at: 0.05 });
    [3100, 2300, 3900, 2700, 3400, 2000, 3600, 2500].forEach((f, i) => tone({ type: 'sine', f0: f, f1: f * 0.8, dur: 0.08, vol: 0.05, at: 0.06 + i * 0.07 }));   // 파편 쨍그랑
    noise({ dur: 0.3, vol: 0.06, filter: 'highpass', f0: 5000, at: 0.35 });
  },
  weaken_curse: () => {                                                                               // 우웅~ 내려가는 저주 (약 1.6초)
    tone({ type: 'sawtooth', f0: 90, f1: 80, dur: 1.4, vol: 0.16, trem: { rate: 7, depth: 0.6 } });
    tone({ type: 'sine', f0: 440, f1: 110, dur: 1.2, vol: 0.14, at: 0.1, vib: { rate: 5, depth: 40 } });
    tone({ type: 'triangle', f0: 330, f1: 82, dur: 1.4, vol: 0.1, at: 0.2, detune: 18, vib: { rate: 6, depth: 50 } });
    noise({ dur: 1, vol: 0.08, f0: 300, f1: 120 });
  },
  sandstorm: () => {                                                                                  // 휘이이잉~ 모래바람 (1.5초 · 커졌다 작아짐)
    noise({ dur: 0.7, vol: 0.12, filter: 'bandpass', f0: 400, f1: 1200, q: 1.2 });
    noise({ dur: 0.7, vol: 0.2, filter: 'bandpass', f0: 600, f1: 1400, q: 1.5, at: 0.3 });
    noise({ dur: 0.6, vol: 0.1, filter: 'bandpass', f0: 1400, f1: 500, q: 1.2, at: 0.9 });
    noise({ dur: 1.5, vol: 0.04, filter: 'highpass', f0: 3500 });                                       // 모래알 사르르
    tone({ type: 'sine', f0: 520, f1: 900, dur: 0.7, vol: 0.025, at: 0.2, vib: { rate: 5, depth: 40 } });
  },
  no_knockback: () => {                                                                               // 쿵! 보잉~ 안 밀려요 (약 0.3초)
    tone({ type: 'triangle', f0: 130, f1: 50, dur: 0.16, vol: 0.45 }); noise({ dur: 0.08, vol: 0.18, f0: 600 });
    tone({ type: 'sine', f0: 200, f1: 420, dur: 0.08, vol: 0.14, at: 0.1 }); tone({ type: 'sine', f0: 420, f1: 240, dur: 0.12, vol: 0.12, at: 0.17, vib: { rate: 20, depth: 90 } });
  },
  shadow_dash: () => {                                                                                // 쉭! 그림자 돌진 (약 0.25초)
    noise({ dur: 0.22, vol: 0.24, filter: 'bandpass', f0: 3500, f1: 600, q: 3 });
    tone({ type: 'sawtooth', f0: 900, f1: 200, dur: 0.2, vol: 0.07 }); noise({ dur: 0.05, vol: 0.1, filter: 'highpass', f0: 4500 });
  },
  gem_beam: () => {                                                                                   // 지잉~ 반짝! 보석 빔 (약 0.55초)
    tone({ type: 'triangle', f0: 600, f1: 2400, dur: 0.3, vol: 0.14 }); tone({ type: 'sine', f0: 2400, f1: 1500, dur: 0.2, vol: 0.09, at: 0.3 });
    tone({ type: 'sawtooth', f0: 220, f1: 330, dur: 0.4, vol: 0.05, trem: { rate: 30, depth: 0.5 } });
    arp([100, 103, 107, 110], 0.04, { type: 'triangle', vol: 0.07, at: 0.1, dur: 0.08 }); noise({ dur: 0.3, vol: 0.04, filter: 'highpass', f0: 6000, at: 0.1 });
  },
  hammer_quake: () => {                                                                               // 쿠웅~ 드르르 땅 울림 (약 0.9초)
    FX.thud(); tone({ type: 'triangle', f0: 70, f1: 30, dur: 0.5, vol: 0.5 });
    tone({ type: 'sine', f0: 45, f1: 36, dur: 0.7, vol: 0.4, at: 0.1, trem: { rate: 14, depth: 0.7 } });
    noise({ dur: 0.8, vol: 0.28, f0: 300, f1: 70 });
    [0.3, 0.42, 0.5, 0.63, 0.72].forEach((a) => noise({ dur: 0.04, vol: 0.09, filter: 'bandpass', f0: rnd(900, 2200), q: 3, at: a }));   // 돌 부스러기
  },
  boss_cutin: () => {                                                                                 // 쾅! 빠빰 빠~밤! 보스 얼굴 컷인 (약 1.15초)
    const brass = (n, d, a, v = 0.13) => { tone({ type: 'sawtooth', f0: midi(n), dur: d, vol: v, at: a, vib: { rate: 6, depth: 14 } }); tone({ type: 'square', f0: midi(n), dur: d * 0.9, vol: v * 0.5, at: a, detune: 7 }); };
    FX.stomp(); noise({ dur: 0.3, vol: 0.22, filter: 'highpass', f0: 2500 });
    brass(60, 0.1, 0.15); brass(63, 0.1, 0.27); brass(67, 0.12, 0.39);
    [60, 63, 67, 72].forEach((n) => brass(n, 0.6, 0.55, 0.1));
    tone({ type: 'triangle', f0: 100, f1: 45, dur: 0.3, vol: 0.4, at: 0.55 });
  },
  boss_big_attack_warn: () => {                                                                       // 삐…삐…삐삐삐삐! 점점 빨라지는 경고 (0.9초)
    [0, 0.2, 0.36, 0.48, 0.58, 0.66, 0.73, 0.79, 0.84].forEach((a, i) => tone({ type: 'square', f0: 880 + i * 45, dur: 0.05, vol: 0.14, at: a }));
    tone({ type: 'sawtooth', f0: 60, f1: 130, dur: 0.88, vol: 0.08, attack: 0.8 });
  },
  lord_roar: () => {                                                                                  // 구오오오오! 좀비 드래곤 로드 — 가장 크고 긴 으르렁 (약 2.4초)
    FX.stomp();
    tone({ type: 'sawtooth', f0: 80, f1: 50, dur: 2.2, vol: 0.34, attack: 0.15, trem: { rate: 22, depth: 0.7 } });
    tone({ type: 'sawtooth', f0: 160, f1: 70, dur: 1.8, vol: 0.22, at: 0.05, trem: { rate: 18, depth: 0.6 } });
    tone({ type: 'square', f0: 55, f1: 35, dur: 2, vol: 0.14, at: 0.1 });
    tone({ type: 'sawtooth', f0: 240, f1: 100, dur: 0.9, vol: 0.26, at: 0.5, vib: { rate: 9, depth: 60 } });
    noise({ dur: 2.3, vol: 0.22, f0: 900, f1: 200 }); FX.rumble(0.3);
  },
  lord_shockwave: () => {                                                                             // 쿠콰아앙! 로드 충격파 (약 1.5초)
    FX.stomp(); tone({ type: 'triangle', f0: 120, f1: 25, dur: 1, vol: 0.5 });
    tone({ type: 'sine', f0: 300, f1: 50, dur: 0.8, vol: 0.2, at: 0.05 });
    noise({ dur: 1, vol: 0.34, f0: 700, f1: 60 }); noise({ dur: 0.5, vol: 0.2, filter: 'bandpass', f0: 200, f1: 2500, q: 1.5, at: 0.05 });
    FX.rumble(0.15);
  },
  ending_sting: () => {                                                                               // 빠밤~ 빠바바바~암! 승리 직후 웅장한 화음 (2초)
    const brass = (n, d, a, v = 0.12) => { tone({ type: 'sawtooth', f0: midi(n), dur: d, vol: v, at: a, vib: { rate: 6, depth: 14 } }); tone({ type: 'square', f0: midi(n), dur: d * 0.9, vol: v * 0.5, at: a, detune: 7 }); };
    brass(67, 0.15, 0); brass(72, 0.15, 0.16);
    [48, 60, 64, 67, 72, 76].forEach((n) => brass(n, 1.65, 0.35, 0.08));                                 // 으뜸화음 길게
    tone({ type: 'triangle', f0: 110, f1: 45, dur: 0.4, vol: 0.5, at: 0.35 }); noise({ dur: 1.2, vol: 0.1, filter: 'highpass', f0: 5000, at: 0.35 });
    FX.sparkle(0.5); tone({ type: 'sine', f0: midi(96), dur: 1.2, vol: 0.06, at: 0.6 });
  },
  /* 새 id — 긴장 · 웃음 연출 (겜부장에게 목록 전달) */
  ...Object.fromEntries(Object.entries(FX).map(([k, f]) => [k, () => f(0)])),
};

/* ───── 배경 «재미 요소» 작은 소리 후보 17종 (2026-11-11) — 기본 꺼 둠 ─────
 * 화면 배경에서 가끔 튀어나오는 아주 작은 소리(0.6초 이하 · 작은 볼륨). 한 요소에 변형 2개씩, 부를 때마다 아무거나 하나.
 * 대표님이 마음에 드는 것만 고른 뒤 setFunSfx(true) 로 켠다. 꺼져 있으면 playFun 은 아무것도 하지 않는다.
 * 미리듣기 쪽에서만 playFun(id, { force: true, variant: 0 | 1 }) 로 꺼진 채 들어 볼 수 있다. */
const rnd = (a, b) => a + Math.random() * (b - a);
export const FUN_SFX = {
  thunder: [                                                                                          // 번개 우르릉
    () => { noise({ dur: 0.55, vol: 0.1, f0: 360, f1: 70 }); tone({ type: 'triangle', f0: 62, f1: 38, dur: 0.55, vol: 0.12, trem: { rate: 11, depth: 0.5 } }); },
    () => { noise({ dur: 0.06, vol: 0.08, filter: 'highpass', f0: 3500 }); noise({ dur: 0.48, vol: 0.1, f0: 300, f1: 60, at: 0.07 }); tone({ type: 'sine', f0: 48, f1: 34, dur: 0.48, vol: 0.13, at: 0.07 }); },
  ],
  ghost_pop: [                                                                                        // 유령 까꿍 뿅
    () => { tone({ type: 'sine', f0: 420, f1: 1100, dur: 0.12, vol: 0.1 }); tone({ type: 'sine', f0: 1100, f1: 700, dur: 0.1, vol: 0.07, at: 0.1 }); },
    () => { tone({ type: 'triangle', f0: 600, f1: 700, dur: 0.08, vol: 0.09 }); tone({ type: 'triangle', f0: 900, f1: 1250, dur: 0.15, vol: 0.1, at: 0.16, vib: { rate: 18, depth: 60 } }); },
  ],
  bones: [                                                                                            // 뼈 와르르
    () => { for (let i = 0; i < 9; i++) { const a = i * 0.05 + rnd(0, 0.02); noise({ dur: 0.04, vol: 0.07, filter: 'bandpass', f0: rnd(1800, 4200), q: 4, at: a }); tone({ type: 'square', f0: rnd(500, 900), f1: 200, dur: 0.03, vol: 0.035, at: a }); } },
    () => { [0, 0.12, 0.2, 0.26, 0.31, 0.35, 0.38, 0.4, 0.42].forEach((a) => noise({ dur: 0.035, vol: 0.07, filter: 'bandpass', f0: rnd(1500, 3800), q: 4, at: a })); tone({ type: 'triangle', f0: 130, f1: 70, dur: 0.12, vol: 0.08 }); },
  ],
  owl: [                                                                                              // 부엉이 부엉
    () => { tone({ type: 'sine', f0: 330, f1: 300, dur: 0.16, vol: 0.11 }); tone({ type: 'sine', f0: 280, f1: 240, dur: 0.28, vol: 0.11, at: 0.2, vib: { rate: 6, depth: 20 } }); },
    () => { tone({ type: 'sine', f0: 260, f1: 220, dur: 0.14, vol: 0.1 }); tone({ type: 'sine', f0: 260, f1: 215, dur: 0.14, vol: 0.1, at: 0.2 }); tone({ type: 'sine', f0: 250, f1: 190, dur: 0.2, vol: 0.1, at: 0.38, vib: { rate: 7, depth: 25 } }); },
  ],
  bat: [                                                                                              // 박쥐 푸드덕
    () => { for (let i = 0; i < 5; i++) noise({ dur: 0.06, vol: 0.05, filter: 'bandpass', f0: 2800, f1: 1800, q: 1.5, at: i * 0.07 }); tone({ type: 'sine', f0: 4200, f1: 5200, dur: 0.05, vol: 0.04, at: 0.3 }); },
    () => { tone({ type: 'sine', f0: 4800, f1: 3600, dur: 0.06, vol: 0.04 }); for (let i = 0; i < 4; i++) noise({ dur: 0.06, vol: 0.05, filter: 'bandpass', f0: 2400, q: 1.5, at: 0.08 + i * 0.07 }); tone({ type: 'sine', f0: 3900, f1: 5000, dur: 0.05, vol: 0.04, at: 0.4 }); },
  ],
  witch: [                                                                                            // 마녀 짧은 웃음
    () => { for (let i = 0; i < 5; i++) tone({ type: 'sawtooth', f0: 700 + (i % 2 ? 120 : 0) - i * 20, f1: 900 - i * 30, dur: 0.07, vol: 0.06, at: i * 0.09, vib: { rate: 30, depth: 200 } }); },
    () => { for (let i = 0; i < 3; i++) tone({ type: 'sawtooth', f0: 450 + i * 40, f1: 620 + i * 30, dur: 0.12, vol: 0.06, at: i * 0.15, vib: { rate: 26, depth: 260 } }); },
  ],
  ghost_cat: [                                                                                        // 유령 고양이 야옹
    () => { tone({ type: 'sine', f0: 650, f1: 1000, dur: 0.15, vol: 0.08, vib: { rate: 12, depth: 40 } }); tone({ type: 'sine', f0: 1000, f1: 520, dur: 0.3, vol: 0.08, at: 0.14, vib: { rate: 14, depth: 80 } }); },
    () => { tone({ type: 'triangle', f0: 800, f1: 1300, dur: 0.12, vol: 0.08 }); tone({ type: 'triangle', f0: 1300, f1: 700, dur: 0.26, vol: 0.08, at: 0.12, vib: { rate: 16, depth: 70 } }); },
  ],
  firefly: [                                                                                          // 반딧불 반짝
    () => { [0, 0.12, 0.24].forEach((a) => tone({ type: 'sine', f0: rnd(2000, 3200), dur: 0.08, vol: 0.04, at: a })); },
    () => { [3200, 2700, 2300].forEach((f, i) => tone({ type: 'triangle', f0: f, dur: 0.1, vol: 0.04, at: i * 0.1 })); noise({ dur: 0.2, vol: 0.03, filter: 'highpass', f0: 7000, at: 0.05 }); },
  ],
  grave_creak: [                                                                                      // 묘비 끼이익
    () => { tone({ type: 'sawtooth', f0: 110, f1: 170, dur: 0.3, vol: 0.06, trem: { rate: 24, depth: 0.6 } }); tone({ type: 'sawtooth', f0: 170, f1: 90, dur: 0.25, vol: 0.06, at: 0.3, trem: { rate: 20, depth: 0.6 } }); noise({ dur: 0.5, vol: 0.04, filter: 'bandpass', f0: 500, q: 2 }); },
    () => { tone({ type: 'sawtooth', f0: 200, f1: 420, dur: 0.45, vol: 0.05, vib: { rate: 12, depth: 60 } }); noise({ dur: 0.45, vol: 0.03, filter: 'bandpass', f0: 900, q: 3 }); },
  ],
  cauldron: [                                                                                         // 가마솥 보글보글
    () => { for (let i = 0; i < 6; i++) tone({ type: 'sine', f0: rnd(180, 320), f1: rnd(400, 700), dur: rnd(0.06, 0.09), vol: 0.06, at: i * 0.08 + rnd(0, 0.03) }); noise({ dur: 0.5, vol: 0.04, f0: 400 }); },
    () => { for (let i = 0; i < 4; i++) tone({ type: 'sine', f0: rnd(140, 220), f1: rnd(380, 520), dur: 0.11, vol: 0.07, at: i * 0.13 + rnd(0, 0.03) }); noise({ dur: 0.5, vol: 0.035, f0: 300 }); },
  ],
  crow: [                                                                                             // 까마귀 까악
    () => { tone({ type: 'sawtooth', f0: 520, f1: 380, dur: 0.16, vol: 0.07, trem: { rate: 40, depth: 0.6 } }); tone({ type: 'sawtooth', f0: 500, f1: 330, dur: 0.2, vol: 0.07, at: 0.22, trem: { rate: 40, depth: 0.6 } }); },
    () => { tone({ type: 'sawtooth', f0: 600, f1: 300, dur: 0.35, vol: 0.07, trem: { rate: 30, depth: 0.5 } }); },
  ],
  wind: [                                                                                             // 바람 휘이이
    () => { noise({ dur: 0.3, vol: 0.05, filter: 'bandpass', f0: 400, f1: 1100, q: 6 }); noise({ dur: 0.28, vol: 0.05, filter: 'bandpass', f0: 1100, f1: 500, q: 6, at: 0.3 }); },
    () => { tone({ type: 'sine', f0: 700, f1: 900, dur: 0.3, vol: 0.04, vib: { rate: 5, depth: 30 } }); tone({ type: 'sine', f0: 900, f1: 600, dur: 0.28, vol: 0.04, at: 0.3, vib: { rate: 5, depth: 30 } }); noise({ dur: 0.55, vol: 0.03, filter: 'bandpass', f0: 800, q: 4 }); },
  ],
  chain: [                                                                                            // 쇠사슬 짤랑
    () => { for (let i = 0; i < 7; i++) { const a = i * 0.06 + rnd(0, 0.02); noise({ dur: 0.03, vol: 0.05, filter: 'highpass', f0: 5000, at: a }); tone({ type: 'triangle', f0: rnd(2500, 4000), dur: 0.04, vol: 0.03, at: a }); } },
    () => { for (let i = 0; i < 4; i++) noise({ dur: 0.1, vol: 0.05, filter: 'bandpass', f0: 3500, q: 2, at: i * 0.12 }); tone({ type: 'triangle', f0: 100, f1: 60, dur: 0.1, vol: 0.08, at: 0.45 }); },
  ],
  bike_bell: [                                                                                        // 자전거 따르릉
    () => { for (let i = 0; i < 8; i++) { tone({ type: 'sine', f0: i % 2 ? 2900 : 2400, dur: 0.05, vol: 0.05, at: i * 0.05 }); tone({ type: 'triangle', f0: 4800, dur: 0.04, vol: 0.015, at: i * 0.05 }); } },
    () => { tone({ type: 'sine', f0: 2600, dur: 0.25, vol: 0.07 }); tone({ type: 'sine', f0: 3100, dur: 0.3, vol: 0.06, at: 0.12 }); },
  ],
  moon_yawn: [                                                                                        // 달님 하품 아함~
    () => { tone({ type: 'sine', f0: 320, f1: 520, dur: 0.25, vol: 0.06, vib: { rate: 5, depth: 30 } }); tone({ type: 'sine', f0: 520, f1: 200, dur: 0.3, vol: 0.06, at: 0.22 }); noise({ dur: 0.5, vol: 0.02, f0: 700 }); },
    () => { tone({ type: 'triangle', f0: 280, f1: 400, dur: 0.2, vol: 0.06 }); tone({ type: 'triangle', f0: 400, f1: 170, dur: 0.35, vol: 0.06, at: 0.2, vib: { rate: 6, depth: 40 } }); },
  ],
  skull_chatter: [                                                                                    // 해골 구름 딱딱딱
    () => { for (let i = 0; i < 8; i++) { noise({ dur: 0.025, vol: 0.07, filter: 'bandpass', f0: rnd(1500, 2500), q: 5, at: i * 0.055 }); tone({ type: 'square', f0: 160, dur: 0.02, vol: 0.035, at: i * 0.055 }); } },
    () => { for (let i = 0; i < 10; i++) noise({ dur: 0.02, vol: 0.06, filter: 'bandpass', f0: rnd(1800, 3000), q: 5, at: i * 0.04 + (i > 4 ? 0.06 : 0) }); },
  ],
  grave_hand: [                                                                                       // 무덤에서 손이 쓱
    () => { noise({ dur: 0.35, vol: 0.08, filter: 'bandpass', f0: 700, f1: 250, q: 2 }); tone({ type: 'triangle', f0: 90, f1: 50, dur: 0.2, vol: 0.1, at: 0.35 }); },
    () => { for (let i = 0; i < 5; i++) noise({ dur: 0.07, vol: 0.07 - i * 0.01, f0: 900 - i * 100, at: i * 0.07 }); tone({ type: 'triangle', f0: 100, f1: 55, dur: 0.15, vol: 0.1, at: 0.4 }); },
  ],
};
export const FUN_IDS = Object.keys(FUN_SFX);
export let FUN_SFX_ENABLED = false;                    // 꺼 둠 — 대표님이 고른 뒤 setFunSfx(true)
export function setFunSfx(on) { FUN_SFX_ENABLED = !!on; }
/** 재미 요소 소리 한 번. 꺼져 있으면 아무것도 안 한다 (opt.force = 미리듣기 전용) */
export function playFun(id, opt = {}) {
  if (!FUN_SFX_ENABLED && !opt.force) return;
  const v = FUN_SFX[id]; if (!v) return;
  try { (v[opt.variant ?? Math.floor(Math.random() * v.length)] ?? v[0])(); } catch { /* 소리 실패는 게임과 무관 */ }
}
