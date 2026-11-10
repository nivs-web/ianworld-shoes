/**
 * 이안 드래곤 게임 — 곡 4개 (겜팀장 · 칩튠 · 전부 새로 지은 곡). 파일 없이 파형 합성.
 * 한 마디 = 8칸(8분음표). 칸: 음 이름(C5 · F#4 …) · '.' 쉼 · '-' 앞 음을 늘림. 드럼: k 킥 · s 스네어 · h 하이햇.
 * bgm(id, {rate}) — rate 1.15 = 불꽃 타임(같은 곡을 빠르게).
 */
import { audio, tone, noise, midi } from './synth.js';

const TRACKS = {
  lobby: { bpm: 112, loop: true,
    lead: ['C5 E5 G5 E5 F5 A5 G5 -', 'E5 G5 C6 G5 A5 G5 E5 -', 'F5 A5 C6 A5 G5 E5 D5 -', 'E5 D5 C5 D5 E5 - C5 -'],
    bass: ['C3 . G3 . C3 . G3 .', 'A2 . E3 . A2 . E3 .', 'F2 . C3 . G2 . D3 .', 'C3 . G2 . C3 - . .'],
    drum: ['k . h . s . h .', 'k . h . s . h h', 'k . h . s . h .', 'k . h . s s h .'] },
  battleA: { bpm: 140, loop: true,
    lead: ['G4 G4 B4 D5 G5 - D5 B4', 'C5 C5 E5 G5 E5 - C5 -', 'D5 D5 F#5 A5 D6 - A5 F#5', 'G5 F#5 E5 D5 B4 - G4 -',
      'B4 D5 G5 D5 E5 G5 C6 -', 'A5 G5 F#5 E5 D5 - B4 -', 'C5 E5 A5 E5 D5 F#5 A5 -', 'G5 - D5 - G4 - . .'],
    bass: ['G2 . D3 . G2 . D3 .', 'C3 . G3 . C3 . G3 .', 'D3 . A3 . D3 . A3 .', 'G2 . D3 . G2 B2 D3 .',
      'G2 . D3 . C3 . G3 .', 'D3 . A3 . G2 . D3 .', 'A2 . E3 . D3 . A3 .', 'G2 . D3 . G2 . . .'],
    drum: ['k h s h k k s h', 'k h s h k k s h', 'k h s h k k s h', 'k h s h k s s s'] },
  boss: { bpm: 152, loop: true,
    lead: ['A4 . C5 A4 E5 . D5 C5', 'B4 . D5 B4 F5 . E5 D5', 'C5 . E5 C5 A5 . G5 F5', 'E5 F5 E5 D5 C5 B4 G#4 -'],
    bass: ['A2 A2 A3 A2 A2 A2 A3 A2', 'G2 G2 G3 G2 G2 G2 G3 G2', 'F2 F2 F3 F2 F2 F2 F3 F2', 'E2 E2 E3 E2 E2 E2 G#2 E2'],
    drum: ['k h s h k h s s', 'k h s h k k s h', 'k h s h k h s s', 'k k s k k s s s'] },
  win: { bpm: 150, loop: false,
    lead: ['G4 C5 E5 G5 - E5 G5 -', 'C6 - - - . . . .'],
    bass: ['C3 . G3 . E3 . G3 .', 'C3 - - - . . . .'],
    drum: ['k . s . k . s .', 'k . . . . . . .'] },
};

const NOTE = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
const toMidi = (s) => { const m = /^([A-G]#?)(\d)$/.exec(s); return m ? 12 * (+m[2] + 1) + NOTE[m[1]] : null; };

/** 마디 문자열들 → [{step, note, len}] */
function parse(bars) {
  const toks = bars.join(' ').split(/\s+/).filter(Boolean), out = [];
  toks.forEach((t, i) => {
    if (t === '.' || t === '-') return;
    let len = 1; while (toks[i + len] === '-') len++;
    out.push({ step: i, v: t, len });
  });
  return { notes: out, steps: toks.length };
}
const COMPILED = Object.fromEntries(Object.entries(TRACKS).map(([id, t]) => {
  const L = parse(t.lead), B = parse(t.bass), D = parse(t.drum.length < t.lead.length ? [...t.drum, ...t.drum].slice(0, t.lead.length) : t.drum);
  return [id, { ...t, L, B, D, steps: Math.max(L.steps, B.steps) }];
}));

let cur = null, timer = 0;

function playNote(kind, v, len, stepDur, at) {
  const A = audio(); if (!A) return;
  const bus = A.musicBus;
  if (kind === 'L') { const n = toMidi(v); if (n) { tone({ type: 'square', f0: midi(n), dur: len * stepDur * 0.92, vol: 0.16, at, bus }); tone({ type: 'square', f0: midi(n), dur: len * stepDur * 0.9, vol: 0.05, at, bus, detune: 9 }); } }
  else if (kind === 'B') { const n = toMidi(v); if (n) tone({ type: 'triangle', f0: midi(n), dur: len * stepDur * 0.95, vol: 0.32, at, bus }); }
  else if (v === 'k') { tone({ type: 'triangle', f0: 160, f1: 45, dur: 0.14, vol: 0.5, at, bus }); }
  else if (v === 's') { noise({ dur: 0.11, vol: 0.22, filter: 'bandpass', f0: 1900, q: 1.2, at, bus }); }
  else if (v === 'h') { noise({ dur: 0.03, vol: 0.08, filter: 'highpass', f0: 7000, at, bus }); }
}

/** 곡 시작 (같은 곡이 돌고 있으면 빠르기만 바꾼다) */
export function startTrack(id, rate = 1) {
  const T = COMPILED[id]; if (!T) return;
  const A = audio(); if (!A) return;
  if (cur && cur.id === id) { cur.rate = rate; return; }
  stopTrack();
  cur = { id, T, rate, step: 0, next: A.ctx.currentTime + 0.05 };
  const tick = () => {
    if (!cur) return;
    const stepDur = 60 / (cur.T.bpm * cur.rate) / 2;
    while (cur.next < A.ctx.currentTime + 0.15) {
      const s = cur.step % cur.T.steps, at = cur.next - A.ctx.currentTime;
      for (const [kind, seq] of [['L', cur.T.L], ['B', cur.T.B], ['D', cur.T.D]]) for (const n of seq.notes) if (n.step === s) playNote(kind, n.v, n.len, stepDur, at);
      cur.step++; cur.next += stepDur;
      if (!cur.T.loop && cur.step >= cur.T.steps) { stopTrack(); return; }
    }
  };
  tick(); timer = setInterval(tick, 25);
}
export function stopTrack() { clearInterval(timer); timer = 0; cur = null; }
export const TRACK_IDS = Object.keys(TRACKS);
