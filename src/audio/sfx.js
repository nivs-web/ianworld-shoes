/**
 * 효과음 17종 — 기획서 §9-7 표 그대로. 오디오 파일 0개.
 *
 * 각 항목은 "지금부터 t초 뒤에 이런 음을 낸다"를 그리는 순수 함수다.
 * 상태를 갖는 건 함성 쿨다운 하나뿐 (연발 방지).
 */

import { AUDIO } from '../config/balance.js';
import { ready, now, sfxOut } from './audio.js';
import { tone, noise, mtof } from './synth.js';

/** 계단 밟는 소리를 번갈아 내기 위한 토글 (기획서: 연속 상승 시 교차) */
let stepAlt = false;
let lastShoutAt = -1e9;

/**
 * @param {string} id
 * @param {object} [opt]
 * @param {string} [opt.charId] 함성 피치용
 */
export function play(id, opt = {}) {
  if (!ready()) return;
  const fn = TABLE[id];
  if (fn) fn(now(), opt);
}

/** 상승 소리 — 부를 때마다 피치가 ±2반음 교차해 "착착착" 리듬이 산다 */
export function playStep() {
  if (!ready()) return;
  stepAlt = !stepAlt;
  TABLE[stepAlt ? 'sfx_step' : 'sfx_step_alt'](now(), {});
}

/**
 * 함성 — 연발 방지 게이트를 통과할 때만 실제로 낸다.
 * @returns {boolean} 실제로 울렸는가
 */
export function playShout(charId) {
  if (!ready()) return false;
  const t = performance.now();
  if (t - lastShoutAt < AUDIO.shout.minGapMs) return false;
  lastShoutAt = t;
  TABLE.sfx_shout(now(), { charId });
  return true;
}

export function resetShoutGate() {
  lastShoutAt = -1e9;
}

// ─────────────────────────────────────────────
// 정의 표
// ─────────────────────────────────────────────

/** 짧게 끊어 치는 "착!" — square 어택 + 노이즈 한 톨 */
function step(t, semitoneShift) {
  const f = mtof(76 + semitoneShift);
  tone({ at: t, freq: [f, f * 0.86], wave: 0.25, dur: 0.015, gain: 0.34, env: { a: 0.001, d: 0.008, sustain: 0.05, r: 0.02 } });
  noise({ at: t, dur: 0.012, gain: 0.16, filter: 'highpass', cutoff: 3200, env: { a: 0.001, d: 0.006, sustain: 0.02, r: 0.015 } });
}

/** 3음 아르페지오 */
function arp(t, notes, wave, step_ = 0.055, gain = 0.28, dur = 0.07) {
  notes.forEach((n, i) => {
    tone({ at: t + i * step_, freq: mtof(n), wave, dur, gain, env: { a: 0.002, d: 0.02, sustain: gain * 0.7, r: 0.05 } });
  });
}

const TABLE = {
  // ── 인게임 ──
  sfx_step: (t) => step(t, 0),
  sfx_step_alt: (t) => step(t, 2),

  /** "삐용↑" 200 → 900Hz 상승 스윕 */
  sfx_shoe_get: (t) => {
    tone({ at: t, freq: [200, 900], wave: 0.25, dur: 0.13, gain: 0.3, env: { a: 0.002, d: 0.03, sustain: 0.22, r: 0.05 } });
    tone({ at: t + 0.02, freq: [400, 1800], wave: 'square', dur: 0.1, gain: 0.1, env: { a: 0.002, d: 0.02, sustain: 0.06, r: 0.04 } });
  },

  /** "삐로롱↑↑" 1·2티어 — 3음 아르페지오 + 위쪽 반짝임 */
  sfx_shoe_rare: (t) => {
    arp(t, [76, 83, 88], 0.125, 0.06, 0.3, 0.09);
    arp(t + 0.2, [93, 95], 'square', 0.05, 0.16, 0.12);
    // 반짝임 — 고역 노이즈를 아주 짧게
    noise({ at: t + 0.2, dur: 0.09, gain: 0.07, filter: 'highpass', cutoff: [6000, 9000] });
  },

  /** "틱" */
  sfx_turn: (t) => {
    tone({ at: t, freq: mtof(84), wave: 0.125, dur: 0.012, gain: 0.14, env: { a: 0.001, d: 0.006, sustain: 0.03, r: 0.012 } });
  },

  /** "쿠당탕탕↓" 노이즈 + 900 → 80Hz 하강 */
  sfx_fall: (t) => {
    noise({ at: t, dur: 0.42, gain: 0.26, filter: 'lowpass', cutoff: [4000, 250], env: { a: 0.003, d: 0.08, sustain: 0.14, r: 0.14 } });
    tone({ at: t, freq: [900, 80], wave: 'sawtooth', dur: 0.4, gain: 0.2, env: { a: 0.003, d: 0.06, sustain: 0.12, r: 0.12 } });
  },

  /** 좌절 3음 하강 (triangle) */
  sfx_death: (t) => {
    [72, 67, 60].forEach((n, i) => {
      tone({ at: t + i * 0.16, freq: mtof(n), wave: 'triangle', dur: 0.14, gain: 0.3, env: { a: 0.004, d: 0.04, sustain: 0.2, r: 0.1 } });
    });
    tone({ at: t + 0.48, freq: [mtof(55), mtof(48)], wave: 'triangle', dur: 0.35, gain: 0.26, env: { a: 0.005, d: 0.08, sustain: 0.16, r: 0.2 } });
  },

  /** 상승 팡파레 */
  sfx_revive: (t) => {
    arp(t, [72, 76, 79, 84], 0.25, 0.07, 0.3, 0.1);
    tone({ at: t + 0.28, freq: mtof(88), wave: 0.25, dur: 0.24, gain: 0.28, env: { a: 0.004, d: 0.05, sustain: 0.2, r: 0.16 } });
  },

  // ── 메뉴 ──
  sfx_menu_move: (t) => {
    tone({ at: t, freq: mtof(81), wave: 0.125, dur: 0.014, gain: 0.16, env: { a: 0.001, d: 0.008, sustain: 0.04, r: 0.014 } });
  },
  sfx_menu_select: (t) => {
    tone({ at: t, freq: mtof(81), wave: 0.25, dur: 0.04, gain: 0.24 });
    tone({ at: t + 0.05, freq: mtof(88), wave: 0.25, dur: 0.09, gain: 0.24 });
  },
  sfx_menu_back: (t) => {
    tone({ at: t, freq: mtof(74), wave: 0.25, dur: 0.04, gain: 0.2 });
    tone({ at: t + 0.05, freq: mtof(67), wave: 0.25, dur: 0.1, gain: 0.2 });
  },

  /** 코인 사운드 — 두 음을 아주 빠르게 (마리오 코인과 같은 구조) */
  sfx_purchase: (t) => {
    tone({ at: t, freq: mtof(83), wave: 0.25, dur: 0.035, gain: 0.26 });
    tone({ at: t + 0.045, freq: mtof(90), wave: 0.25, dur: 0.32, gain: 0.26, env: { a: 0.002, d: 0.05, sustain: 0.18, r: 0.16 } });
  },

  /** "부-" 낮은 square */
  sfx_denied: (t) => {
    tone({ at: t, freq: mtof(43), wave: 0.5, dur: 0.16, gain: 0.24, env: { a: 0.002, d: 0.03, sustain: 0.2, r: 0.06 } });
    tone({ at: t, freq: mtof(44), wave: 0.5, dur: 0.16, gain: 0.16 }); // 반음 겹쳐 불협화
  },

  // ── 멀티 ──
  sfx_countdown: (t) => {
    tone({ at: t, freq: mtof(76), wave: 0.25, dur: 0.11, gain: 0.28, env: { a: 0.002, d: 0.02, sustain: 0.22, r: 0.05 } });
  },
  sfx_go: (t) => {
    tone({ at: t, freq: [mtof(76), mtof(93)], wave: 0.25, dur: 0.2, gain: 0.32, env: { a: 0.002, d: 0.03, sustain: 0.26, r: 0.1 } });
  },
  sfx_win: (t) => arp(t, [72, 76, 79, 84], 0.25, 0.1, 0.3, 0.16),
  sfx_lose: (t) => arp(t, [72, 68, 65, 60], 'triangle', 0.13, 0.28, 0.2),

  /**
   * 함성 — 80~90년대 기판의 "가짜 목소리" 기법 (기획서 §9-7-1).
   *
   *   ① 노이즈 어택 20ms + 하이패스 2kHz  → 숨 들어가는 "츠"
   *   ② square 피치 벤드 440 → 300 → 360  → "어–어–엇" 모음 굴곡
   *   ③ 밴드패스 2단 F1 700(Q5) / F2 1200→1800(Q8)  → "아→에" 포먼트
   *   ④ 비브라토 6Hz ±12 cent
   *   ⑤ 끝을 뚝 자른다
   */
  sfx_shout: (t, opt) => {
    const p = AUDIO.voicePitch[opt.charId] ?? 1;
    const out = sfxOut();

    // ① 숨 들어가는 "츠"
    noise({ at: t, dur: 0.02, gain: 0.16, filter: 'highpass', cutoff: 2000, out, env: { a: 0.001, d: 0.006, sustain: 0.05, r: 0.012 } });

    // ②~④ 본체를 두 구간으로 나눠 "하강 후 살짝 상승" 굴곡을 만든다.
    //     밴드패스 2단을 지나면 20dB 가까이 깎이므로 gain을 크게 잡는다.
    const body = (at, f0, f1, f2a, f2b, dur, env) => {
      tone({ at, freq: [f0 * p, f1 * p], wave: 0.5, dur, gain: 0.95, out,
        vibrato: 6, vibratoCents: 12,
        formants: [[700 * p, 5], [f2a * p, 8]], formantSweep: [f2a * p, f2b * p], env });
      // 포먼트를 안 거친 드라이 성분을 살짝 섞어야 목소리에 심이 생긴다
      tone({ at, freq: [f0 * p, f1 * p], wave: 0.25, dur, gain: 0.09, out,
        vibrato: 6, vibratoCents: 12, env });
    };
    body(t + 0.012, 440, 300, 1200, 1500, 0.055, { a: 0.005, d: 0.03, sustain: 0.8, r: 0.01 });
    body(t + 0.067, 300, 360, 1500, 1800, 0.045, { a: 0.002, d: 0.02, sustain: 0.7, r: 0.06 });
  },
};

export const SFX_IDS = Object.keys(TABLE);
