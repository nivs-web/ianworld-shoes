/**
 * 줄넘기 챔피언 · ROPE BEAT — 세계 줄넘기 챔피언십 5단계 + 무한 (공용 표). (2026-11-07)
 *
 * 음악 감독(music.js) · 리듬 디자이너(chart.js) · 게임 본체(rhythm.js)가 **이 표 하나를 같이 본다**.
 *   tempo    : 템포 지도 (timing.js) — 곡과 채보가 같은 시간표를 쓴다
 *   sections : 마디 구간 [from, to) · 이름 · 세기(energy 0~3) · 템포 표시(SPEED UP / SLOW DOWN 예고에 쓴다)
 *   bars     : 전체 마디 수 — 곡 길이 약 60초 (tools/_beat-sim.mjs 가 잰다)
 * 노트는 sections 의 intro/outro 에는 거의 없고, 기술은 «새 기술(newTechs)»이 그 단계에서 처음 나온다.
 */

export const STAGES = [
  {
    no: 1, id: 'training', name: '동네 예선', en: 'TRAINING GROUND', arena: 0, tier: 'ROOKIE',
    song: { title: 'First Bounce', style: 'chiptune-pop', key: 'C', mode: 'major' },
    tempo: [{ bar: 0, bpm: 92 }, { bar: 16, bpm: 96 }, { bar: 24, bpm: 100 }],
    bars: 24,
    sections: [
      { from: 0, to: 2, label: 'intro', energy: 0 },
      { from: 2, to: 10, label: 'A', energy: 1 },
      { from: 10, to: 18, label: 'B', energy: 2 },
      { from: 18, to: 22, label: 'A2', energy: 2, cue: 'SPEED UP' },
      { from: 22, to: 24, label: 'outro', energy: 1 },
    ],
    newTechs: ['basic', 'double_bounce', 'side_swing'],
    goals: { combo: 15, perfect: 20 },
  },
  {
    no: 2, id: 'arena', name: '지역 대회', en: 'SPEED ARENA', arena: 1, tier: 'BEGINNER',
    song: { title: 'Speed Arena', style: 'funk', key: 'A', mode: 'minor' },
    tempo: [{ bar: 0, bpm: 108 }, { bar: 10, bpm: 108 }, { bar: 14, bpm: 124 }, { bar: 20, bpm: 124 }, { bar: 20, bpm: 100 }, { bar: 24, bpm: 100 }, { bar: 28, bpm: 128 }],
    bars: 30,
    sections: [
      { from: 0, to: 2, label: 'intro', energy: 0 },
      { from: 2, to: 10, label: 'A', energy: 1 },
      { from: 10, to: 14, label: 'build', energy: 2, cue: 'SPEED UP' },
      { from: 14, to: 20, label: 'chorus', energy: 3 },
      { from: 20, to: 24, label: 'break', energy: 1, cue: 'SLOW DOWN' },
      { from: 24, to: 30, label: 'final', energy: 3, cue: 'SPEED UP' },
    ],
    newTechs: ['alternate', 'criss_cross'],
    goals: { combo: 25, perfect: 35 },
  },
  {
    no: 3, id: 'cross', name: '전국 대회', en: 'CROSS CHALLENGE', arena: 2, tier: 'PRO',
    song: { title: 'Cross Fire', style: 'edm', key: 'D', mode: 'minor' },
    tempo: [{ bar: 0, bpm: 124 }, { bar: 10, bpm: 124 }, { bar: 18, bpm: 132 }, { bar: 18, bpm: 112 }, { bar: 22, bpm: 112 }, { bar: 22, bpm: 138 }],
    bars: 32,
    sections: [
      { from: 0, to: 2, label: 'intro', energy: 0 },
      { from: 2, to: 10, label: 'A', energy: 2 },
      { from: 10, to: 18, label: 'B', energy: 2, cue: 'SPEED UP' },
      { from: 18, to: 22, label: 'break', energy: 1, cue: 'SLOW DOWN' },
      { from: 22, to: 30, label: 'C', energy: 3, cue: 'SPEED UP' },
      { from: 30, to: 32, label: 'outro', energy: 1 },
    ],
    newTechs: ['double_under', 'release', 'turn180'],
    goals: { combo: 40, perfect: 60 },
  },
  {
    no: 4, id: 'double', name: '아시아 대회', en: 'DOUBLE UNDER', arena: 3, tier: 'MASTER',
    song: { title: 'Neon Double', style: 'synthwave', key: 'E', mode: 'minor' },
    tempo: [{ bar: 0, bpm: 140 }, { bar: 10, bpm: 140 }, { bar: 18, bpm: 148 }, { bar: 22, bpm: 126 }, { bar: 24, bpm: 126 }, { bar: 32, bpm: 158 }],
    bars: 36,
    sections: [
      { from: 0, to: 2, label: 'intro', energy: 0 },
      { from: 2, to: 10, label: 'A', energy: 2 },
      { from: 10, to: 18, label: 'B', energy: 3, cue: 'SPEED UP' },
      { from: 18, to: 24, label: 'bridge', energy: 1, cue: 'SLOW DOWN' },
      { from: 24, to: 32, label: 'C', energy: 3, cue: 'SPEED UP' },
      { from: 32, to: 36, label: 'final', energy: 3 },
    ],
    newTechs: ['high_knees', 'cross_double'],
    goals: { combo: 60, perfect: 90 },
  },
  {
    no: 5, id: 'world', name: '세계 선수권', en: 'WORLD CHAMPIONSHIP', arena: 4, tier: 'LEGEND',
    song: { title: 'Champion of the Rope', style: 'arcade-electro', key: 'F', mode: 'minor' },
    tempo: [{ bar: 0, bpm: 150 }, { bar: 10, bpm: 150 }, { bar: 18, bpm: 160 }, { bar: 18, bpm: 120 }, { bar: 22, bpm: 120 }, { bar: 30, bpm: 172 }, { bar: 30, bpm: 182 }],
    bars: 40,
    sections: [
      { from: 0, to: 2, label: 'intro', energy: 0 },
      { from: 2, to: 10, label: 'A', energy: 2 },
      { from: 10, to: 18, label: 'B', energy: 3, cue: 'SPEED UP' },
      { from: 18, to: 22, label: 'break', energy: 1, cue: 'SLOW DOWN' },
      { from: 22, to: 30, label: 'C', energy: 3, cue: 'SPEED UP' },
      { from: 30, to: 38, label: 'final', energy: 3, cue: 'MAX SPEED' },
      { from: 38, to: 40, label: 'outro', energy: 1 },
    ],
    newTechs: ['triple_under', 'turn360', 'combo_finale'],
    goals: { combo: 80, perfect: 130 },
  },
];

/** 무한 줄넘기 — 8마디마다 BPM +4 (100 → 200), 같은 8마디 곡이 갈수록 빨라지며 반복된다 */
export const ENDLESS = {
  id: 'endless', name: '무한 줄넘기', en: 'ENDLESS', arena: 4,
  song: { title: 'Infinite Loop', style: 'chiptune-drive', key: 'G', mode: 'minor' },
  startBpm: 100, stepBpm: 4, everyBars: 8, maxBpm: 200,
  tempoUntil(bars) {
    const t = [];
    for (let b = 0; b <= bars; b += this.everyBars) t.push({ bar: b, bpm: Math.min(this.maxBpm, this.startBpm + (b / this.everyBars) * this.stepBpm) });
    return t;
  },
};

/** 난이도 (스테이지 · 무한 · 멀티 공통) — 판정 창(초) · 노트 간격(도트/박) · 체력 피해 배율 */
export const DIFFS = {
  easy: { label: '쉬움', en: 'EASY', win: { perfect: 0.06, great: 0.11, good: 0.16 }, pxPerBeat: 30, dmg: 0.6 },
  normal: { label: '보통', en: 'NORMAL', win: { perfect: 0.045, great: 0.09, good: 0.135 }, pxPerBeat: 26, dmg: 1 },
  hard: { label: '어려움', en: 'HARD', win: { perfect: 0.032, great: 0.068, good: 0.105 }, pxPerBeat: 22, dmg: 1.3 },
};
