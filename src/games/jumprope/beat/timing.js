/**
 * 줄넘기 챔피언 · ROPE BEAT — 템포 지도 → 시간 (2026-11-07)
 *
 * 음악(music.js)과 채보(chart.js)와 판정이 **같은 시간표**를 쓴다 — 템포가 빨라지고 느려져도
 * 노트는 언제나 음악의 16분음표 칸 위에 있다. 모든 시간은 «곡 시작으로부터 초».
 *
 * 템포 지도: [{ bar, bpm }, …] — bar 는 마디(0부터, 소수 가능). 점과 점 사이는 **선형으로 이어진다**(빨라지기 · 느려지기).
 *   같은 bar 에 점이 두 개면 그 자리에서 **갑자기** 바뀐다(뒤의 값). 첫 점 앞 = 첫 bpm, 마지막 점 뒤 = 마지막 bpm.
 */

export const STEPS_PER_BEAT = 4;
export const STEPS_PER_BAR = 16;

/** 마디 위치 bar 의 BPM */
export function bpmAt(tempo, bar) {
  if (!tempo?.length) return 120;
  if (bar <= tempo[0].bar) return tempo[0].bpm;
  for (let i = tempo.length - 1; i >= 0; i--) {
    const a = tempo[i];
    if (bar >= a.bar) {
      const b = tempo[i + 1];
      if (!b) return a.bpm;
      if (b.bar <= a.bar) return b.bpm;
      return a.bpm + ((b.bpm - a.bpm) * (bar - a.bar)) / (b.bar - a.bar);
    }
  }
  return tempo[0].bpm;
}

/** 16분음표 칸마다 시작 시각(초). 길이 = bars*16+1 (마지막 칸 = 곡 끝) */
export function buildSteps(tempo, bars) {
  const n = Math.max(1, Math.round(bars * STEPS_PER_BAR));
  const t = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) t[i + 1] = t[i] + 60 / (bpmAt(tempo, (i + 0.5) / STEPS_PER_BAR) * STEPS_PER_BEAT);
  return t;
}

/** 칸(소수 가능) → 초 */
export function timeAtStep(steps, s) {
  const n = steps.length - 1;
  if (s <= 0) return steps[1] ? (s * (steps[1] - steps[0])) : 0;
  if (s >= n) return steps[n] + (s - n) * (steps[n] - steps[n - 1]);
  const i = Math.floor(s);
  return steps[i] + (s - i) * (steps[i + 1] - steps[i]);
}

/** 초 → 칸(소수). 곡 앞(음수 시간)도 첫 칸 길이로 늘여 잰다 */
export function stepAtTime(steps, t) {
  const n = steps.length - 1;
  if (t <= 0) return t / (steps[1] - steps[0] || 0.125);
  if (t >= steps[n]) return n + (t - steps[n]) / (steps[n] - steps[n - 1] || 0.125);
  let lo = 0, hi = n;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (steps[m] <= t) lo = m; else hi = m; }
  return lo + (t - steps[lo]) / (steps[lo + 1] - steps[lo]);
}

/** 목표 길이(초)에 가장 가까운 마디 수 (multiple 의 배수) */
export function barsForDuration(tempo, targetSec, multiple = 2) {
  let best = multiple, bestErr = Infinity;
  for (let bars = multiple; bars <= 200; bars += multiple) {
    const s = buildSteps(tempo, bars);
    const err = Math.abs(s[s.length - 1] - targetSec);
    if (err < bestErr) { bestErr = err; best = bars; }
    if (s[s.length - 1] > targetSec + 20) break;
  }
  return best;
}
