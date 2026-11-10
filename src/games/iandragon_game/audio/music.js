/**
 * 이안 드래곤 게임 — 배경 음악 (겜팀장 · 2026-11-10 대표님 «저작권 끝난 유명 클래식을 빠르고 박진감 있게»)
 * 전부 작곡가 사후 70년이 지난 곡의 «선율»만 쓰고, 연주(소리)는 여기서 직접 합성한 새 편곡이다(녹음 음원 0).
 *   lobby   — 모차르트 「터키 행진곡」 (1783)            : 장난스럽게
 *   battleA — 오펜바흐 「지옥의 갤럽(캉캉)」 (1858)       : 신나는 전투 (월드 1~5)
 *   battleB — 림스키코르사코프 「왕벌의 비행」 (1900)     : 정신없는 전투 (월드 6~10 · 2차)
 *   boss    — 그리그 「산왕의 궁전에서」 (1875)           : 반복할수록 빨라지는 긴장 (loop 마다 accel)
 *   win     — 베토벤 「환희의 송가」 (1824)              : 승리 징글
 * 칸: 음 이름 · '.' 쉼 · '-' 늘림 · div = 한 박에 칸 수(2 = 8분, 4 = 16분). 드럼: k 팀파니 킥 · s 스네어 · h 하이햇 · c 심벌.
 * 소리 결: 리드 = 톱니 + 사각 겹침(현 · 금관 느낌) · 베이스 = 삼각 + 낮은 톱니 · 팀파니 · 심벌 → «오케스트라풍 칩튠».
 */
import { audio, tone, noise, midi } from './synth.js';

const TRACKS = {
  lobby: { bpm: 126, div: 4, loop: true,
    lead: ['B4 A4 G#4 A4 C5 - - - D5 C5 B4 C5 E5 - - -', 'F5 E5 D#5 E5 B5 A5 G#5 A5 B5 A5 G#5 A5 C6 - - -',
      'A5 - C6 - B5 A5 G5 A5 B5 A5 G5 A5 B5 A5 G5 F#5', 'E5 - - - E4 - - - A4 - - - . . . .'],
    bass: ['A2 . . . E3 . . . A2 . . . E3 . . .', 'A2 . . . E3 . . . A2 . . . E3 . . .', 'A2 . . . E3 . . . E2 . . . B2 . . .', 'E2 . . . E2 . . . A2 . . . . . . .'],
    drum: ['k . h . s . h . k . h . s . h .', 'k . h . s . h . k . h . s . h .', 'k . h . s . h . k . h . s . h .', 'k . . . s . . . k . . . c . . .'] },
  battleA: { bpm: 176, div: 2, loop: true,
    lead: ['C5 - C5 D5 F5 E5 D5 G5', '- G5 G5 A5 E5 F5 D5 -', 'D5 D5 F5 E5 D5 C5 C6 B5', 'A5 G5 F5 E5 D5 C5 B4 G4',
      'C5 - C5 D5 F5 E5 D5 G5', '- G5 G5 A5 E5 F5 D5 -', 'D5 D5 F5 E5 D5 C5 G5 B4', 'C5 - E5 - G5 - C6 -'],
    bass: ['C3 G3 C3 G3 C3 G3 C3 G3', 'G2 D3 G2 D3 G2 D3 G2 D3', 'G2 D3 G2 D3 C3 G3 C3 G3', 'F2 C3 F2 C3 G2 D3 G2 D3',
      'C3 G3 C3 G3 C3 G3 C3 G3', 'G2 D3 G2 D3 G2 D3 G2 D3', 'G2 D3 G2 D3 G2 D3 G2 D3', 'C3 G3 C3 G3 C3 . C2 .'],
    drum: ['k h s h k h s h', 'k h s h k h s h', 'k h s h k h s h', 'k h s h k s s c'] },
  battleB: { bpm: 144, div: 4, loop: true,
    lead: ['E6 D#6 D6 C#6 D6 C#6 C6 B5 C6 C#6 D6 C#6 C6 B5 A#5 A5', 'A#5 B5 C6 B5 A#5 A5 G#5 G5 F#5 F5 E5 F5 F#5 G5 G#5 A5',
      'E6 D#6 D6 C#6 D6 C#6 C6 B5 C6 C#6 D6 C#6 C6 B5 A#5 A5', 'A#5 B5 C6 B5 A#5 A5 G#5 G5 A5 - - - E5 - - -'],
    bass: ['A2 . A2 . E3 . A2 . A2 . A2 . E3 . A2 .', 'A2 . A2 . E3 . A2 . E2 . E2 . B2 . E2 .', 'A2 . A2 . E3 . A2 . A2 . A2 . E3 . A2 .', 'E2 . E2 . B2 . E2 . A2 . . . A2 . . .'],
    drum: ['k . h . s . h . k . h . s . h h', 'k . h . s . h . k . h . s . h h', 'k . h . s . h . k . h . s . h h', 'k . h . s . h . k . s . s s c .'] },
  boss: { bpm: 132, div: 2, loop: true, accel: 0.08, maxRate: 1.6,
    lead: ['A4 B4 C5 D5 E5 C5 E5 -', 'D#5 B4 D#5 - D5 A#4 D5 -', 'A4 B4 C5 D5 E5 C5 E5 A5', 'G5 E5 C5 E5 G5 - - -',
      'A5 B5 C6 D6 E6 C6 E6 -', 'D#6 B5 D#6 - D6 A#5 D6 -', 'A5 B5 C6 D6 E6 C6 E6 A6', 'G6 E6 C6 E6 A5 - A4 -'],
    bass: ['A2 A2 A2 A2 A2 A2 A2 A2', 'B2 B2 B2 B2 A#2 A#2 A#2 A#2', 'A2 A2 A2 A2 A2 A2 A2 A2', 'E2 E2 E2 E2 E2 E2 E2 E2',
      'A2 A2 A2 A2 A2 A2 A2 A2', 'B2 B2 B2 B2 A#2 A#2 A#2 A#2', 'A2 A2 A2 A2 A2 A2 A2 A2', 'E2 E2 E2 E2 A1 . A1 .'],
    drum: ['k h k h k h k h', 'k h k h k h k h', 'k h k h k h k h', 'k h k h s s s c'] },
  win: { bpm: 168, div: 2, loop: false,
    lead: ['E5 E5 F5 G5 G5 F5 E5 D5', 'C5 C5 D5 E5 E5 - D5 D5', 'C5 E5 G5 C6 - - - -'],
    bass: ['C3 . G3 . C3 . G3 .', 'C3 . G3 . G2 . G2 .', 'C3 . G3 . C2 - - -'],
    drum: ['k . s . k . s .', 'k . s . k . s s', 'c . . . . . . .'] },
};

const NOTE = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
const toMidi = (s) => { const m = /^([A-G]#?)(\d)$/.exec(s); return m ? 12 * (+m[2] + 1) + NOTE[m[1]] : null; };
function parse(bars) {
  const toks = bars.join(' ').split(/\s+/).filter(Boolean), out = [];
  toks.forEach((t, i) => { if (t === '.' || t === '-') return; let len = 1; while (toks[i + len] === '-') len++; out.push({ step: i, v: t, len }); });
  return { notes: out, steps: toks.length };
}
const COMPILED = Object.fromEntries(Object.entries(TRACKS).map(([id, t]) => {
  const rep = (d) => Array.from({ length: t.lead.length }, (_, i) => d[i % d.length]);
  const L = parse(t.lead), B = parse(rep(t.bass)), D = parse(rep(t.drum));
  const by = (seq) => { const m = new Map(); for (const n of seq.notes) (m.get(n.step) ?? m.set(n.step, []).get(n.step)).push(n); return m; };
  return [id, { ...t, div: t.div ?? 2, L: by(L), B: by(B), D: by(D), steps: L.steps }];
}));

function playNote(kind, v, len, stepDur, at) {
  const A = audio(); if (!A) return;
  const bus = A.musicBus, d = len * stepDur;
  if (kind === 'L') {
    const n = toMidi(v); if (!n) return;
    tone({ type: 'sawtooth', f0: midi(n), dur: d * 0.95, vol: 0.09, at, bus });                 // 현 · 금관
    tone({ type: 'square', f0: midi(n), dur: d * 0.9, vol: 0.06, at, bus, detune: 8 });
    tone({ type: 'triangle', f0: midi(n + 12), dur: Math.min(d, 0.18), vol: 0.04, at, bus });   // 반짝임
  } else if (kind === 'B') {
    const n = toMidi(v); if (!n) return;
    tone({ type: 'triangle', f0: midi(n), dur: d * 0.9, vol: 0.3, at, bus });
    tone({ type: 'sawtooth', f0: midi(n), dur: Math.min(d * 0.6, 0.12), vol: 0.06, at, bus });
  } else if (v === 'k') { tone({ type: 'triangle', f0: 110, f1: 48, dur: 0.22, vol: 0.5, at, bus }); }   // 팀파니
  else if (v === 's') { noise({ dur: 0.12, vol: 0.2, filter: 'bandpass', f0: 1900, q: 1.1, at, bus }); }
  else if (v === 'h') { noise({ dur: 0.03, vol: 0.07, filter: 'highpass', f0: 7000, at, bus }); }
  else if (v === 'c') { noise({ dur: 0.9, vol: 0.16, filter: 'highpass', f0: 4500, at, bus }); }        // 심벌
}

let cur = null, timer = 0;
/** 곡 시작 (같은 곡이 돌고 있으면 빠르기만 바꾼다) */
export function startTrack(id, rate = 1) {
  const T = COMPILED[id]; if (!T) return;
  const A = audio(); if (!A) return;
  if (cur && cur.id === id) { cur.base = rate; return; }
  stopTrack();
  cur = { id, T, base: rate, accel: 0, step: 0, next: A.ctx.currentTime + 0.05 };
  const tick = () => {
    if (!cur) return;
    while (cur.next < A.ctx.currentTime + 0.15) {
      const rate = Math.min(cur.T.maxRate ?? 9, cur.base * (1 + cur.accel));
      const stepDur = 60 / (cur.T.bpm * rate) / cur.T.div;
      const s = cur.step % cur.T.steps, at = cur.next - A.ctx.currentTime;
      for (const [kind, map] of [['L', cur.T.L], ['B', cur.T.B], ['D', cur.T.D]]) for (const n of map.get(s) ?? []) playNote(kind, n.v, n.len, stepDur, at);
      cur.step++; cur.next += stepDur;
      if (cur.step % cur.T.steps === 0) {
        if (!cur.T.loop) { stopTrack(); return; }
        if (cur.T.accel) cur.accel += cur.T.accel;                                              // 산왕의 궁전: 돌 때마다 빨라진다
      }
    }
  };
  tick(); timer = setInterval(tick, 25);
}
export function stopTrack() { clearInterval(timer); timer = 0; cur = null; }
export const TRACK_IDS = Object.keys(TRACKS);
