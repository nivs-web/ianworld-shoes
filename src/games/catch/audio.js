/**
 * 캐치볼 소리 — 효과음 + 배경음악. 오디오 파일 0개, 전부 Web Audio 로 합성한다.
 *
 *   const audio = createAudio(store);        // store = { get(key, def), set(key, val) }
 *   버튼·터치마다 audio.init()                // 자동재생 규칙(iOS·크롬): 제스처 안에서 깨운다
 *   audio.play('catch', { grade: 'perfect' });
 *   audio.bgm('game');
 *
 * 가져올 때는 브라우저 객체를 건드리지 않는다 — window/document 접근은 전부 함수 안에서만.
 * 신호 흐름: 효과음 버스(0.8) + 음악 버스(0.22) → 컴프레서(부드러운 리미터) → 마스터 → 스피커
 */

const SFX_VOL = 0.8;
const BGM_VOL = 0.22;
const MASTER_VOL = 0.9;
const LOOKAHEAD = 0.12; // 이만큼만 미리 예약한다 (초)
const TICK_MS = 25;
const FADE = 0.6; // 분위기 바꿀 때 크로스페이드 (초)
const MOODS = ['title', 'game', 'duel'];

/* ---------- 배경음악 악보 ---------- */
// 마디 = 16칸(16분음표). 'C5:4' = C5 를 4칸, 길이를 빼면 2칸. '.' = 쉼표.
// 화음은 마디마다 '|' 로 나누고, 한 마디에 둘이면 'Dm G7' 처럼 반씩.
// 베이스 [칸, 근음에서 반음, 길이] · 반주 [칸, 길이] · 드럼 x 보통 X 강 o 약 . 없음
const SONGS = {
  // 타이틀 — 느긋한 셔플, 야구장 오르간 '쿵-짝'
  title: {
    bpm: 100, swing: 0.5, trem: 4.6, tremDepth: 0.14, cut: 2000, echo: 0.2, snare: 'rim', fillSnare: 'rim',
    order: 'AABA',
    parts: {
      A: {
        ch: 'C|Am|F|G7|C|Am|Dm G7|C',
        mel: [
          'E5:4 G5:2 E5:2 C5:4 G4:4',
          'A4:4 C5:2 E5:2 A5:6 .:2',
          'F5:2 E5:2 D5:2 C5:2 A4:4 C5:4',
          'D5:6 B4:2 G4:6 .:2',
          'E5:4 G5:2 E5:2 C6:4 G5:4',
          'A5:2 G5:2 E5:2 C5:2 A4:6 .:2',
          'F5:4 A5:4 G5:2 F5:2 D5:4',
          'E5:2 D5:2 C5:10 .:2',
        ],
      },
      B: {
        ch: 'F|C|Dm|C|F|E7|Am D7|G7',
        mel: [
          'A5:4 A5:2 G5:2 F5:4 C5:4',
          'G5:4 G5:2 F5:2 E5:4 C5:4',
          'F5:2 E5:2 F5:2 A5:2 D6:6 .:2',
          'C6:4 B5:2 A5:2 G5:8',
          'A5:2 G5:2 F5:2 E5:2 F5:4 A5:4',
          'G#5:4 B5:4 E5:4 G#5:4',
          'A5:4 C6:4 F#5:4 A5:4',
          'G5:4 F5:2 E5:2 D5:4 B4:4',
        ],
      },
    },
    bass: [[0, 0, 7], [8, 7, 6]],
    comp: [[4, 3], [12, 3]],
    drums: { k: 'x.......x.......', s: '....x.......x...', h: '..o...o...o...o.' },
    fill: { k: 'x.......x.......', s: '....x.......o.oo', h: '..o...o...o.....' },
    vol: { kick: 0.55, hat: 0.08 },
  },
  // 경기 — 신나는 응원 오르간 + 칩튠 반짝이
  game: {
    bpm: 120, swing: 0, trem: 6.4, tremDepth: 0.18, cut: 2800, echo: 0.18, snare: 'clap', fillSnare: 'snare',
    order: 'ABAC',
    parts: {
      A: {
        ch: 'G|G|C|D|G|Em|C D|G',
        mel: [
          'G4:2 B4:2 D5:2 G5:4 D5:2 B4:2 D5:2',
          'E5:3 D5:3 B4:2 G4:4 .:4',
          'C5:2 E5:2 G5:2 E5:4 C5:2 E5:2 G5:2',
          'F#5:4 E5:2 D5:2 A4:6 .:2',
          'G4:2 B4:2 D5:2 G5:4 A5:2 B5:4',
          'G5:3 E5:3 B4:2 E5:6 .:2',
          'E5:2 G5:2 C6:4 A5:2 F#5:2 D5:4',
          'G5:4 D5:2 B4:2 G4:4 .:4',
        ],
      },
      B: {
        arp: true,
        ch: 'C|G|C|D|Em|C|A7|D7',
        mel: [
          'C5:2 C5:2 .:2 C5:2 E5:4 G5:4',
          'B4:2 B4:2 .:2 B4:2 D5:4 G5:4',
          'E5:2 D5:2 E5:2 G5:2 C6:4 G5:4',
          'F#5:2 G5:2 A5:4 D5:8',
          'B4:2 E5:2 G5:2 B5:4 A5:2 G5:4',
          'E5:2 G5:2 C6:4 B5:2 A5:2 G5:4',
          'A5:2 G5:2 E5:2 C#5:2 E5:4 A5:4',
          'F#5:4 A5:4 C6:2 A5:2 F#5:2 D5:2',
        ],
      },
      C: {
        ch: 'G|G|C|C|Am|D|G|G D7',
        mel: [
          'D4:2 G4:2 B4:2 D5:4 B4:2 D5:4',
          '.:4 G5:2 .:2 G5:2 .:2 G5:4',
          'E4:2 G4:2 C5:2 E5:4 C5:2 E5:4',
          '.:4 E5:2 .:2 E5:2 .:2 G5:4',
          'A4:2 C5:2 E5:2 A5:2 G5:2 E5:2 C5:4',
          'D5:2 F#5:2 A5:2 D6:2 C6:2 A5:2 F#5:4',
          'G5:2 F#5:2 G5:2 A5:2 B5:4 G5:4',
          'D5:4 G5:2 .:2 A5:2 F#5:2 D5:4',
        ],
      },
    },
    bass: [[0, 0, 3], [4, 12, 2], [6, 0, 2], [8, 7, 3], [12, 12, 2], [14, 7, 2]],
    comp: [[2, 2], [6, 2], [10, 2], [14, 2]],
    drums: { k: 'x.....x.x.......', s: '....x.......x...', h: 'o.x.o.x.o.x.o.x.' },
    fill: { k: 'x.....x.x.......', s: '....x...x.x.xxXX', h: 'o.x.o.x.........' },
    vol: {},
  },
  // 대결 — 단조, 몰아치는 베이스와 엇박 화음
  duel: {
    bpm: 132, swing: 0, trem: 7, tremDepth: 0.2, cut: 3000, echo: 0.15, snare: 'snare', fillSnare: 'snare',
    order: 'ABAB',
    parts: {
      A: {
        ch: 'Am|F|G|E|Am|F|Dm|E7',
        mel: [
          'A4:2 C5:2 E5:2 A5:2 G#5:2 A5:2 E5:4',
          'F5:2 E5:2 C5:2 A4:2 C5:4 F5:4',
          'G5:2 F5:2 D5:2 B4:2 D5:4 G5:4',
          'G#5:4 B5:2 G#5:2 E5:6 .:2',
          'A5:2 .:1 A5:1 C6:2 A5:2 E5:4 A5:4',
          'F5:2 A5:2 C6:2 A5:2 F5:4 C5:4',
          'D5:2 F5:2 A5:2 D6:2 C6:2 A5:2 F5:4',
          'E5:2 G#5:2 B5:2 D6:2 E6:4 .:4',
        ],
      },
      B: {
        arp: true,
        ch: 'Dm|Am|Dm|E|F|G|Am|E7',
        mel: [
          'D5:1 E5:1 F5:2 A5:2 F5:2 D5:2 F5:2 A5:4',
          'C6:2 B5:2 A5:2 E5:2 C5:4 E5:4',
          'D5:1 E5:1 F5:2 A5:2 D6:2 C6:2 A5:2 F5:4',
          'E5:4 G#5:4 B5:4 G#5:4',
          'A5:2 G5:2 F5:2 E5:2 F5:2 A5:2 C6:4',
          'B5:2 A5:2 G5:2 F5:2 G5:2 B5:2 D6:4',
          'C6:2 B5:2 A5:2 G5:2 A5:2 E5:2 C5:2 A4:2',
          'B4:2 C5:2 D5:2 E5:2 G#5:4 B5:4',
        ],
      },
    },
    bass: [[0, 0, 2], [2, 0, 2], [4, 12, 2], [6, 0, 2], [8, 0, 2], [10, 0, 2], [12, 12, 2], [14, 7, 2]],
    comp: [[0, 2], [3, 2], [6, 2], [10, 2], [12, 2]],
    drums: { k: 'x...x...x...x..x', s: '....x.......x...', h: 'xoxoxoxoxoxoxoxo' },
    fill: { k: 'x...x...x...x...', s: '....x...xoxoXxXX', h: 'xoxoxoxo........' },
    vol: { lead: 0.28, comp: 0.07 },
  },
};
/* ---------- 악보 끝 ---------- */

const VOL = { lead: 0.3, comp: 0.075, bass: 0.36, kick: 0.72, snare: 0.32, hat: 0.1, arp: 0.045 };
const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const QUAL = { '': [0, 4, 7], m: [0, 3, 7], 7: [0, 4, 7, 10], m7: [0, 3, 7, 10], maj7: [0, 4, 7, 11], dim: [0, 3, 6] };
const BUILT = {};
const VIB = [];

const pcOf = (s) => PC[s[0]] + (s[1] === '#' ? 1 : s[1] === 'b' ? -1 : 0);
const midiOf = (s) => 12 * (Number(s[s.length - 1]) + 1) + pcOf(s);
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
const wrap = (p, lo) => lo + ((((p - lo) % 12) + 12) % 12); // lo 이상 한 옥타브 안으로

function chordOf(sym) {
  const r = /^([A-G][#b]?)(.*)$/.exec(sym) || ['', 'C', ''];
  const root = pcOf(r[1]);
  const iv = QUAL[r[2]] || QUAL[''];
  const pick = iv.length > 3 ? iv.slice(1) : iv; // 7화음은 근음을 베이스에 맡긴다
  return {
    bass: wrap(root, 40), // E2~D#3 (폰 스피커에서도 배음이 들리게)
    voices: pick.map((i) => wrap(root + i, 55)).sort((a, b) => a - b), // G3~F#4
    arp: iv.map((i) => wrap(root + i, 84)).sort((a, b) => a - b), // C6 위 반짝이
  };
}

function barOf(str) {
  const mel = new Array(16).fill(null);
  let s = 0;
  for (const tok of str.trim().split(/\s+/)) {
    const [n, l] = tok.split(':');
    const len = l ? Number(l) : 2;
    if (n !== '.' && s < 16) mel[s] = { m: midiOf(n), l: len };
    s += len;
  }
  return mel;
}

const grid = (str) => Array.from({ length: 16 }, (_, i) => (str && str[i]) || '.');

function songOf(id) {
  if (BUILT[id]) return BUILT[id];
  const D = SONGS[id];
  const bars = [];
  for (const key of D.order) {
    const P = D.parts[key];
    const chs = P.ch.split('|');
    P.mel.forEach((b, i) => {
      const cs = (chs[i] || 'C').trim().split(/\s+/);
      const c0 = chordOf(cs[0]);
      bars.push({ mel: barOf(b), c0, c1: cs[1] ? chordOf(cs[1]) : c0, split: !!cs[1], fill: i === P.mel.length - 1, arp: !!P.arp });
    });
  }
  const bass = new Array(16).fill(null);
  D.bass.forEach(([s, semi, len]) => { bass[s] = [semi, len]; });
  const comp = new Array(16).fill(0);
  D.comp.forEach(([s, len]) => { comp[s] = len; });
  const kit = (k) => ({ k: grid(k.k), s: grid(k.s), h: grid(k.h) });
  return (BUILT[id] = {
    bars, bass, comp,
    sd: 60 / D.bpm / 4,
    swing: D.swing || 0,
    trem: D.trem, tremDepth: D.tremDepth, cut: D.cut, echo: D.echo,
    snare: D.snare, fillSnare: D.fillSnare,
    drums: kit(D.drums), fill: kit(D.fill),
    vol: Object.assign({}, VOL, D.vol),
  });
}

// k번 흔들리는 비브라토 곡선 (센트) — 노드 없이 detune 자동화로 건다
function vibCurve(k) {
  if (VIB[k]) return VIB[k];
  const n = k * 16 + 1;
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) c[i] = 9 * Math.sin((2 * Math.PI * k * i) / (n - 1)) * Math.min(1, i / 16);
  return (VIB[k] = c);
}

const off = (n) => { try { n.disconnect(); } catch (e) { /* 이미 끊김 */ } };
const quiet = (p) => { if (p && typeof p.then === 'function') p.then(null, () => {}); return p; }; // 옛 사파리는 약속을 안 돌려준다
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function createAudio(store) {
  const sget = (k, d) => {
    try {
      const v = store && typeof store.get === 'function' ? store.get(k, d) : d;
      return v === undefined || v === null ? d : v;
    } catch (e) { return d; }
  };
  const sset = (k, v) => { try { if (store && typeof store.set === 'function') store.set(k, v); } catch (e) { /* 저장 실패해도 소리는 난다 */ } };

  let muted = !!sget('muted', false);
  let bgmOn = sget('bgm', true) !== false;

  let ac = null, sfx = null, bgm = null, comp = null, master = null, nbuf = null;
  let W = {}; // 오르간 파형
  let tracks = [];
  let desired = null; // 지금 원하는 음악 분위기
  let paused = false, hidden = false, selfSuspended = false;
  let timer = 0, susTimer = 0;
  let voice = null;
  const last = {};

  /* ---------- 공용 부품 ---------- */
  function filt(type, f, q, t) {
    const b = ac.createBiquadFilter();
    b.type = type;
    b.frequency.setValueAtTime(f, t || ac.currentTime);
    if (q != null) b.Q.value = q;
    return b;
  }

  // 부드러운 목표값 이동 (페이드)
  function ramp(p, v, tc) {
    const t = ac.currentTime;
    try {
      if (p.cancelAndHoldAtTime) p.cancelAndHoldAtTime(t);
      else { const cur = p.value; p.cancelScheduledValues(t); p.setValueAtTime(cur, t); }
    } catch (e) { /* 무시 */ }
    p.setTargetAtTime(v, t, tc);
  }

  // 0.0001 → 최고 → (유지) → 0.0001 : 딸깍 소리 없는 엔벨로프
  function env(p, t, a, v, hold, dur) {
    v = Math.max(v, 0.0002);
    p.setValueAtTime(0.0001, t);
    p.exponentialRampToValueAtTime(v, t + a);
    if (hold > 0) p.setValueAtTime(v, t + a + hold);
    p.exponentialRampToValueAtTime(0.0001, t + Math.max(dur, a + hold + 0.005));
  }

  // 소리 묶음 출구(필터·패너) — 묶인 소리가 다 끝나면 같이 끊긴다
  function group(...nodes) {
    for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]);
    nodes[nodes.length - 1].connect(sfx);
    const g = { input: nodes[0], n: 0, free() { if (--g.n <= 0) nodes.forEach(off); } };
    return g;
  }
  function route(node, dest) {
    if (dest && dest.input) { node.connect(dest.input); dest.n++; return dest; }
    node.connect(dest || sfx);
    return null;
  }

  // 저주파 흔들기 (비브라토·트레몰로·패닝) — 서서히 깊어진다
  function mod(t, dur, rate, depth, param) {
    if (dur <= 0) return;
    const l = ac.createOscillator(), g = ac.createGain();
    l.frequency.value = rate;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(depth, t + Math.min(0.12, dur * 0.3));
    l.connect(g); g.connect(param);
    l.start(t); l.stop(t + dur + 0.03);
    l.onended = () => { off(l); off(g); };
  }

  // 음 하나: { f, f2, g0, glide, type, wave, dur, a, hold, vol, vib:[Hz,센트,지연], trem:[Hz,깊이], out }
  function tone(t, o) {
    const osc = ac.createOscillator();
    if (o.wave) osc.setPeriodicWave(o.wave); else osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.f, t);
    if (o.f2) {
      const g0 = t + (o.g0 || 0);
      if (o.g0) osc.frequency.setValueAtTime(o.f, g0);
      osc.frequency.exponentialRampToValueAtTime(o.f2, g0 + (o.glide || o.dur));
    }
    const g = ac.createGain();
    const dur = o.dur;
    env(g.gain, t, o.a || 0.004, o.vol, o.hold || 0, dur);
    const nodes = [osc, g];
    let head = osc;
    if (o.trem) {
      const tg = ac.createGain();
      tg.gain.value = 1 - o.trem[1];
      osc.connect(tg); head = tg; nodes.push(tg);
      mod(t, dur, o.trem[0], o.trem[1], tg.gain);
    }
    head.connect(g);
    if (o.vib) { const d = o.vib[2] || 0; mod(t + d, dur - d, o.vib[0], o.vib[1], osc.detune); }
    const grp = route(g, o.out);
    osc.start(t); osc.stop(t + dur + 0.03);
    osc.onended = () => { nodes.forEach(off); if (grp) grp.free(); };
    return osc;
  }

  // 필터를 지나면 잡음 세기가 크게 줄어든다 — 대역폭만큼 되돌려 준다
  function ncomp(type, f, q) {
    const ny = ac.sampleRate / 2;
    const bw = type === 'bandpass' ? f / Math.max(q, 0.05) : type === 'lowpass' ? f : type === 'highpass' ? ny - f : ny;
    return Math.min(8, Math.sqrt(ny / clamp(bw, 30, ny)));
  }

  // 공용 1초 잡음 버퍼에서 한 조각 (시작점 무작위)
  function nsrc(t, dur, dest) {
    const s = ac.createBufferSource();
    s.buffer = nbuf;
    const loop = dur > 0.9;
    s.loop = loop;
    s.connect(dest);
    s.start(t, Math.random() * (loop ? 0.9 : Math.max(0, 0.96 - dur)));
    s.stop(t + dur + 0.03);
    return s;
  }

  // 걸러진 잡음: { type, f, f2, glide, q, fc, dur, a, hold, vol, out } → 필터 반환(추가 자동화용)
  function noise(t, o) {
    const type = o.type || 'bandpass';
    const q = o.q == null ? (type === 'bandpass' ? 1 : 0.7) : o.q;
    const fl = filt(type, o.f, q, t);
    if (o.f2) fl.frequency.exponentialRampToValueAtTime(o.f2, t + (o.glide || o.dur));
    const g = ac.createGain();
    env(g.gain, t, o.a || 0.002, o.vol * ncomp(type, o.fc || o.f, q), o.hold || 0, o.dur);
    fl.connect(g);
    const grp = route(g, o.out);
    const s = nsrc(t, o.dur, fl);
    s.onended = () => { off(s); off(fl); off(g); if (grp) grp.free(); };
    return fl;
  }

  function panner(a, b, t, d) {
    if (!ac.createStereoPanner) return null;
    const p = ac.createStereoPanner();
    p.pan.setValueAtTime(a, t);
    p.pan.linearRampToValueAtTime(b, t + d);
    return group(p);
  }

  /* ---------- 효과음 재료 ---------- */
  function bell(t, f, dur, vol, out) {
    tone(t, { f, dur, a: 0.002, vol, out });
    tone(t, { f: f * 2.76, dur: dur * 0.3, a: 0.001, vol: vol * 0.22, out }); // 종소리 배음
  }
  function brass(t, f, dur, vol, out, vib) {
    const h = dur * 0.45, v = vib ? [5.5, 14, 0.15] : null;
    tone(t, { type: 'sawtooth', f, dur, a: 0.012, hold: h, vol: vol * 0.45, out, vib: v });
    tone(t, { type: 'triangle', f: f * 1.002, dur, a: 0.008, hold: h, vol, out, vib: v });
  }
  function thump(t, v) { tone(t, { f: 150, f2: 50, glide: 0.1, dur: 0.18, a: 0.002, vol: v }); }
  function cym(t, d, v) {
    noise(t, { type: 'highpass', f: 6000, dur: d, a: 0.003, vol: v });
    noise(t, { f: 9500, q: 0.8, dur: d * 0.5, a: 0.002, vol: v * 0.6 });
  }
  function snr(t, v) {
    noise(t, { f: 1900, q: 0.7, dur: 0.12, a: 0.001, vol: v });
    tone(t, { type: 'triangle', f: 200, f2: 160, dur: 0.06, a: 0.001, vol: v * 0.5 });
  }
  function clapS(t, v, out) {
    const fl = filt('bandpass', 1150, 1.1, t), g = ac.createGain(), p = g.gain;
    v *= 4.5;
    p.setValueAtTime(0.0001, t);
    for (let i = 0; i < 3; i++) {
      const s = t + i * 0.011;
      p.exponentialRampToValueAtTime(v, s + 0.0015);
      p.exponentialRampToValueAtTime(v * 0.12, s + 0.01);
    }
    p.exponentialRampToValueAtTime(v * 0.6, t + 0.036);
    p.exponentialRampToValueAtTime(0.0001, t + 0.15);
    fl.connect(g);
    const grp = route(g, out);
    const s = nsrc(t, 0.16, fl);
    s.onended = () => { off(s); off(fl); off(g); if (grp) grp.free(); };
  }
  function pluck(t, f, k) {
    tone(t, { f, f2: f * 0.94, glide: 0.05, dur: 0.075, a: 0.0015, vol: 0.22 * k }); // 나무 몸통
    tone(t, { f: f * 3.93, dur: 0.022, a: 0.001, vol: 0.05 * k }); // 나무 배음
    noise(t, { f: 2600, q: 1.5, dur: 0.008, a: 0.0006, vol: 0.12 * k }); // 톡
  }

  // 글러브 포구 — 착(가죽 터짐) + 퍽(주머니 몸통) + 끽(가죽 자리잡기)
  function glove(t, grade, k, out) {
    const amp = k * ({ perfect: 1, great: 0.93, nice: 0.86, late: 0.76 }[grade] || 0.86);
    noise(t, { f: grade === 'late' ? 1700 : 2200, q: 0.8, dur: 0.018, a: 0.0008, vol: 0.55 * amp, out });
    noise(t, { f: 950, q: 1.1, dur: 0.035, a: 0.001, vol: 0.42 * amp, out });
    tone(t + 0.002, { f: 155, f2: 58, glide: 0.09, dur: 0.14, a: 0.002, vol: 0.9 * amp, out });
    tone(t + 0.002, { type: 'triangle', f: 310, f2: 120, glide: 0.07, dur: 0.08, a: 0.002, vol: 0.3 * amp, out });
    tone(t + 0.001, { f: 560, f2: 330, glide: 0.03, dur: 0.045, a: 0.001, vol: 0.2 * amp, out }); // 톡 (폰 스피커용 가죽 울림)
    noise(t + 0.003, { type: 'lowpass', f: 520, f2: 220, q: 0.9, dur: 0.09, a: 0.002, vol: 0.45 * amp, out });
    const cr = (grade === 'late' ? 0.05 : 0.08) * amp;
    noise(t + 0.115, { f: 720, q: 6, dur: 0.012, a: 0.001, vol: cr, out });
    noise(t + 0.128, { f: 860, q: 7, dur: 0.01, a: 0.001, vol: cr * 0.8, out });
    noise(t + 0.14, { f: 640, q: 6, dur: 0.014, a: 0.001, vol: cr * 0.6, out });
    if (grade === 'perfect') { bell(t + 0.03, 1568, 0.38, 0.15, out); bell(t + 0.085, 2349, 0.42, 0.12, out); }
    else if (grade === 'great') { bell(t + 0.03, 1568, 0.26, 0.09, out); bell(t + 0.075, 2349, 0.22, 0.05, out); }
  }

  /* ---------- 효과음 목록 ---------- */
  const SFX = {
    catch(t, o) { glove(t, o.grade || 'nice', 1, null); },
    catchSoft(t) { glove(t, 'nice', 0.42, group(filt('lowpass', 1300, 0.5, t))); },

    throw(t, o) {
      const s = clamp(Math.round(Number(o.speed ?? 1)) || 0, 0, 2);
      const P = [
        { f: 260, f2: 1100, dur: 0.34, a: 0.16, q: 1.1, vol: 0.26 },
        { f: 380, f2: 1900, dur: 0.25, a: 0.11, q: 1.3, vol: 0.3 },
        { f: 560, f2: 3600, dur: 0.17, a: 0.07, q: 1.6, vol: 0.32 },
      ][s];
      noise(t, { f: P.f, f2: P.f2, q: P.q, dur: P.dur, a: P.a, vol: P.vol }); // 팔 휘두름
      const r = t + P.a * 0.9; // 공이 손을 떠나는 순간
      noise(r, { type: 'highpass', f: 2500, dur: 0.012, a: 0.0008, vol: 0.14 + 0.05 * s });
      tone(r, { f: 900 + 200 * s, f2: 380, dur: 0.03, a: 0.001, vol: 0.07 });
      if (s === 2) noise(r, { f: 2600, f2: 6500, q: 2.5, dur: 0.09, a: 0.004, vol: 0.15 }); // 쌩
    },

    pitchSelect(t, o) {
      const k = o.kind;
      if (k === 'curve') { // 빙글 휘감아 오르기
        const p = ac.createStereoPanner ? ac.createStereoPanner() : null;
        const c = p ? group(p) : null;
        if (p) mod(t, 0.55, 3.2, 0.6, p.pan);
        tone(t, { type: 'triangle', f: 420, f2: 1680, glide: 0.42, dur: 0.5, a: 0.03, hold: 0.25, vol: 0.2, vib: [9, 90, 0], trem: [13, 0.35], out: c });
        noise(t, { f: 900, f2: 3400, glide: 0.42, q: 2.5, dur: 0.48, a: 0.08, hold: 0.15, vol: 0.16, out: c });
        [2093, 2637, 3136].forEach((f, i) => bell(t + 0.36 + i * 0.06, f, 0.35, 0.1, c));
      } else if (k === 'slider') { // 왼쪽에서 오른쪽으로 쓩
        const c = panner(-0.85, 0.85, t, 0.32);
        tone(t, { type: 'triangle', f: 760, f2: 1520, glide: 0.16, dur: 0.36, a: 0.01, hold: 0.14, vol: 0.2, trem: [16, 0.3], out: c });
        noise(t, { f: 1600, f2: 4600, glide: 0.25, q: 3, dur: 0.32, a: 0.02, hold: 0.1, vol: 0.2, out: c });
        bell(t + 0.26, 2349, 0.3, 0.1, c); bell(t + 0.31, 3136, 0.3, 0.08, c);
      } else if (k === 'fork') { // 올라갔다 뚝 떨어짐
        tone(t, { type: 'triangle', f: 620, f2: 1240, glide: 0.12, dur: 0.16, a: 0.01, hold: 0.06, vol: 0.18, trem: [12, 0.3] });
        tone(t + 0.13, { type: 'triangle', f: 1240, f2: 250, glide: 0.26, dur: 0.3, a: 0.004, hold: 0.12, vol: 0.2, trem: [12, 0.3] });
        noise(t + 0.1, { f: 3000, f2: 600, glide: 0.3, q: 2, dur: 0.32, a: 0.02, hold: 0.1, vol: 0.16 });
        tone(t + 0.4, { f: 210, f2: 80, glide: 0.1, dur: 0.14, a: 0.002, vol: 0.32 });
        bell(t + 0.06, 2637, 0.3, 0.09); bell(t + 0.13, 1760, 0.3, 0.08);
      } else { // 직구 — 딸깍 + 휙
        noise(t, { type: 'highpass', f: 3000, dur: 0.012, a: 0.0008, vol: 0.18 });
        tone(t, { type: 'triangle', f: 1400, f2: 900, dur: 0.05, a: 0.002, vol: 0.12 });
        noise(t + 0.02, { f: 700, f2: 2600, q: 1.4, dur: 0.18, a: 0.06, vol: 0.28 });
      }
    },

    select(t) { pluck(t, 880, 1); },
    tab(t) { pluck(t, 1175, 0.55); },

    whiff(t) { // 빈 글러브 닫힘 — 퍽(먹먹)
      noise(t, { f: 520, f2: 300, q: 0.9, dur: 0.1, a: 0.012, vol: 0.4 });
      tone(t + 0.01, { f: 170, f2: 105, dur: 0.07, a: 0.004, vol: 0.18 });
      noise(t + 0.07, { f: 1300, q: 3, dur: 0.012, a: 0.001, vol: 0.12 });
    },

    bounce(t) { // 잔디에 툭
      tone(t, { f: 115, f2: 55, glide: 0.09, dur: 0.13, a: 0.002, vol: 0.6 });
      tone(t, { type: 'triangle', f: 230, f2: 120, dur: 0.06, a: 0.002, vol: 0.14 });
      noise(t, { type: 'lowpass', f: 380, f2: 200, q: 0.8, dur: 0.07, a: 0.002, vol: 0.4 });
      noise(t + 0.004, { type: 'highpass', f: 4500, dur: 0.05, a: 0.004, vol: 0.05 }); // 풀잎
    },

    deflect(t) { // 글러브 끝에 맞고 튕김 — 딱 + 팅
      noise(t, { f: 2600, q: 1.4, dur: 0.014, a: 0.0006, vol: 0.42 });
      tone(t, { f: 160, f2: 85, dur: 0.05, a: 0.002, vol: 0.28 });
      tone(t + 0.008, { type: 'triangle', f: 2637, f2: 2480, dur: 0.16, a: 0.001, vol: 0.1 });
      tone(t + 0.008, { f: 3951, dur: 0.07, a: 0.001, vol: 0.04 });
    },

    miss(t) { // 아이고~ (부드러운 두 음 내림)
      [[392, 0, 0.2, 0], [330, 0.2, 0.5, 300]].forEach(([f, s, d, f2]) => {
        tone(t + s, { type: 'triangle', f, f2: f2 || null, g0: 0.2, glide: 0.3, dur: d, a: 0.02, hold: d * 0.5, vol: 0.3, vib: [5.5, 12, 0.08] });
        tone(t + s, { f: f * 2, dur: d * 0.8, a: 0.02, vol: 0.04 });
      });
    },

    strike(t) { // 스트라이크! 세 음 오르기 + 심벌
      const c = group(filt('lowpass', 3400, 0.7, t));
      thump(t, 0.4);
      [659, 784, 1047].forEach((f, i) => brass(t + i * 0.065, f, i === 2 ? 0.42 : 0.14, 0.17, c));
      cym(t + 0.13, 0.65, 0.16);
    },

    ball(t) { // 볼 — 담담한 두 음
      [[587, 0], [440, 0.12]].forEach(([f, s]) => {
        tone(t + s, { type: 'triangle', f, dur: 0.12, a: 0.004, hold: 0.03, vol: 0.21 });
        tone(t + s, { f: f * 2, dur: 0.06, a: 0.003, vol: 0.03 });
      });
    },

    error(t) { // 악송구 — 통! 뾰로롱
      tone(t, { f: 430, f2: 300, glide: 0.1, dur: 0.14, a: 0.001, vol: 0.42 });
      tone(t, { type: 'triangle', f: 1020, f2: 900, dur: 0.05, a: 0.001, vol: 0.12 });
      noise(t, { f: 1600, q: 1.4, dur: 0.012, a: 0.0006, vol: 0.32 });
      tone(t + 0.08, { type: 'triangle', f: 780, f2: 210, glide: 0.5, dur: 0.56, a: 0.01, hold: 0.22, vol: 0.2, vib: [15, 70, 0] });
      tone(t + 0.08, { type: 'square', f: 780, f2: 210, glide: 0.5, dur: 0.5, a: 0.01, hold: 0.2, vol: 0.03, vib: [15, 70, 0] });
    },

    out(t) { // 아웃 — 트롬본 와와와와~
      const lp = filt('lowpass', 380, 6, t);
      const c = group(lp);
      const N = [[233, 0, 0.3], [220, 0.34, 0.3], [208, 0.68, 0.3], [196, 1.02, 0.95]];
      N.forEach(([f, s, d], i) => {
        const lastNote = i === 3, ts = t + s;
        tone(ts, { type: 'sawtooth', f, f2: lastNote ? f * 0.95 : null, g0: 0.4, glide: 0.5, dur: d, a: 0.03, hold: d * 0.55, vol: 0.3, out: c, vib: lastNote ? [5.5, 30, 0.2] : null });
        tone(ts, { type: 'triangle', f: f / 2, dur: d, a: 0.03, hold: d * 0.55, vol: 0.12, out: c });
        const p = lp.frequency;
        p.setValueAtTime(380, ts);
        p.linearRampToValueAtTime(1500, ts + 0.1);
        p.exponentialRampToValueAtTime(520, ts + 0.3);
      });
      mod(t + 1.32, 0.62, 4.5, 400, lp.frequency);
    },

    levelUp(t) { // 빰빠밤~
      const c = group(filt('lowpass', 3400, 0.7, t));
      [392, 523, 659, 784].forEach((f, i) => brass(t + i * 0.075, f, 0.16, 0.15, c));
      [523, 659, 784, 1047].forEach((f) => brass(t + 0.34, f, 0.85, 0.085, c, true));
      thump(t + 0.34, 0.4);
      cym(t + 0.34, 0.8, 0.12);
      [2093, 2637, 3136].forEach((f, i) => bell(t + 0.45 + i * 0.07, f, 0.5, 0.06));
    },

    unlock(t) { // 보물 상자 — 종소리 미끄럼틀
      [1047, 1175, 1319, 1568, 1760, 2093, 2349, 2637].forEach((f, i) => bell(t + i * 0.045, f, 0.55, 0.14));
      [2093, 2637, 3136].forEach((f) => bell(t + 0.42, f, 0.9, 0.09));
      noise(t + 0.1, { type: 'highpass', f: 7000, dur: 0.9, a: 0.3, vol: 0.05 });
    },

    gameOver(t) { // 차분한 마무리
      const seq = [[659, 0, 0.16], [587, 0.15, 0.16], [523, 0.3, 0.16], [392, 0.45, 0.2], [523, 0.62, 0.6]];
      seq.forEach(([f, s, d], i) => {
        const end = i === seq.length - 1;
        tone(t + s, { type: 'triangle', f, dur: d + 0.1, a: 0.01, hold: d * 0.5, vol: 0.22, vib: end ? [5, 10, 0.15] : null });
        tone(t + s, { f: f * 2, dur: d, a: 0.01, vol: 0.04 });
      });
      [262, 330, 392].forEach((f) => tone(t + 0.62, { f, dur: 0.7, a: 0.04, hold: 0.2, vol: 0.06 }));
    },

    win(t) { // 승리 팡파르
      const c = group(filt('lowpass', 3600, 0.7, t));
      [[392, 0, 0.1], [523, 0.12, 0.1], [659, 0.24, 0.1], [784, 0.36, 0.34], [659, 0.74, 0.1], [784, 0.86, 0.1]]
        .forEach(([f, s, d]) => brass(t + s, f, d + 0.06, 0.15, c));
      [523, 659, 784, 1047].forEach((f) => brass(t + 1.0, f, 0.85, 0.085, c, true));
      thump(t, 0.4); thump(t + 0.36, 0.4); thump(t + 1.0, 0.5);
      [0.74, 0.8, 0.86, 0.92].forEach((s, i) => snr(t + s, 0.12 + i * 0.03));
      cym(t + 1.0, 0.8, 0.14);
      [2093, 2637, 3136, 4186].forEach((f, i) => bell(t + 1.1 + i * 0.06, f, 0.5, 0.05));
    },

    lose(t) { // 괜찮아~ 단조로 내려와 밝게 끝남
      [[659, 0], [587, 0.2], [523, 0.4], [494, 0.6]].forEach(([f, s]) => {
        tone(t + s, { type: 'triangle', f, dur: 0.24, a: 0.015, hold: 0.1, vol: 0.2 });
        tone(t + s, { f: f * 2, dur: 0.18, a: 0.015, vol: 0.03 });
      });
      tone(t + 0.8, { type: 'triangle', f: 440, dur: 0.75, a: 0.02, hold: 0.25, vol: 0.2, vib: [5, 10, 0.2] });
      [220, 277, 330].forEach((f) => tone(t + 0.8, { f, dur: 0.8, a: 0.05, hold: 0.25, vol: 0.06 }));
    },

    countdown(t) {
      tone(t, { type: 'triangle', f: 880, dur: 0.16, a: 0.003, hold: 0.04, vol: 0.26 });
      tone(t, { f: 1760, dur: 0.08, a: 0.002, vol: 0.06 });
    },
    go(t) { // 플레이 볼!
      const c = group(filt('lowpass', 4200, 0.7, t));
      [1047, 1319, 1568].forEach((f) => brass(t, f, 0.42, 0.12, c));
      tone(t, { type: 'triangle', f: 2093, dur: 0.35, a: 0.003, vol: 0.08 });
      thump(t, 0.45);
      cym(t, 0.4, 0.1);
    },

    wind(t, o) { // 바람 — 세기만큼 크게
      const s = clamp(Number(o.strength ?? 0.5) || 0, 0, 1);
      const d = 0.75 + 0.2 * s;
      const fl = noise(t, { type: 'lowpass', f: 320, q: 7, fc: 650, dur: d, a: 0.32, hold: 0.12, vol: 0.03 + 0.1 * s });
      fl.frequency.linearRampToValueAtTime(650 + 600 * s, t + 0.42);
      fl.frequency.linearRampToValueAtTime(380, t + d);
      noise(t + 0.05, { f: 1800, q: 0.8, dur: d * 0.9, a: 0.35, vol: 0.02 + 0.05 * s });
    },

    cheer(t) { // 와아~ 관중 함성 + 박수
      const d = 1.25;
      [[480, 1.2, 0.16], [900, 1.5, 0.13], [1500, 1.8, 0.1], [2600, 2, 0.06]].forEach(([f, q, v], i) => {
        noise(t + i * 0.02, { f, f2: f * 1.12, glide: d, q, dur: d, a: 0.28, hold: 0.35, vol: v * 1.2 });
      });
      const c = group(filt('bandpass', 950, 1.1, t), filt('lowpass', 2600, 0.7, t)); // '아' 모음
      for (let i = 0; i < 5; i++) {
        const f = 210 + Math.random() * 210;
        tone(t + Math.random() * 0.12, { type: 'sawtooth', f, f2: f * 1.25, glide: 0.4, dur: 1.1, a: 0.25, hold: 0.35, vol: 0.06, vib: [5 + Math.random() * 2, 25, 0.1], out: c });
      }
      tone(t + 0.15, { type: 'triangle', f: 950, f2: 1500, glide: 0.25, dur: 0.45, a: 0.04, hold: 0.15, vol: 0.05, vib: [7, 30, 0.1] }); // 휘파람
      tone(t + 0.35, { f: 1200, f2: 1750, glide: 0.2, dur: 0.4, a: 0.03, hold: 0.1, vol: 0.04, vib: [6, 25, 0.1] });
      for (let i = 0; i < 7; i++) clapS(t + 0.08 + Math.random() * 0.95, 0.1 + Math.random() * 0.08);
    },
  };

  /* ---------- 배경음악 ---------- */
  function makeWaves() {
    W = {};
    try {
      const mk = (amps) => {
        const re = new Float32Array(amps.length + 1), im = new Float32Array(amps.length + 1);
        amps.forEach((a, i) => { im[i + 1] = a; });
        return ac.createPeriodicWave(re, im);
      };
      W.lead = mk([1, 0.8, 0.5, 0.6, 0, 0.3, 0, 0.35]); // 8' 4' 2⅔' 2' 1⅓' 1' 드로바
      W.comp = mk([1, 0.5, 0.3, 0.2]);
    } catch (e) { W = {}; }
  }
  const setWave = (o, w, fb) => { if (w) o.setPeriodicWave(w); else o.type = fb; };

  function makeTrack(mood) {
    const S = songOf(mood), t = ac.currentTime;
    const T = { mood, S, bar: 0, step: 0, nextTime: t + 0.06, dieAt: 0, nodes: [] };
    const N = (n) => { T.nodes.push(n); return n; };
    T.out = N(ac.createGain());
    T.out.gain.setValueAtTime(0.0001, t);
    T.out.gain.setTargetAtTime(1, t, FADE / 4);
    T.out.connect(bgm);
    // 오르간 버스: 트레몰로(레슬리 흉내) → 저역통과
    T.organ = N(ac.createGain());
    T.organ.gain.value = 1 - S.tremDepth;
    T.lfo = N(ac.createOscillator());
    T.lfo.frequency.value = S.trem;
    const lg = N(ac.createGain());
    lg.gain.value = S.tremDepth;
    T.lfo.connect(lg); lg.connect(T.organ.gain);
    T.lfo.start(t);
    const olp = N(filt('lowpass', S.cut, 0.5, t));
    T.organ.connect(olp); olp.connect(T.out);
    T.bass = N(filt('lowpass', 720, 3, t)); T.bass.connect(T.out);
    T.hat = N(filt('highpass', 7000, 0.7, t)); T.hat.connect(T.out);
    T.sn = N(filt('bandpass', 1900, 0.8, t)); T.sn.connect(T.out);
    // 싼 메아리: 되먹임 딜레이 (점8분)
    T.echo = N(ac.createGain()); T.echo.gain.value = S.echo;
    const dl = N(ac.createDelay(1));
    dl.delayTime.value = Math.min(0.9, S.sd * 3);
    const fb = N(ac.createGain()); fb.gain.value = 0.28;
    const dlp = N(filt('lowpass', 2300, 0.5, t));
    T.echo.connect(dl); dl.connect(dlp); dlp.connect(fb); fb.connect(dl); dlp.connect(T.out);
    return T;
  }

  function dispose(T) {
    try { T.lfo.stop(); } catch (e) { /* 이미 멈춤 */ }
    T.nodes.forEach(off);
    tracks = tracks.filter((x) => x !== T);
  }

  function fadeOut(T) {
    if (T.dieAt) return;
    T.dieAt = ac.currentTime + FADE + 0.12;
    ramp(T.out.gain, 0, FADE / 5);
  }

  // 오르간 멜로디: 드로바 파형 두 개(살짝 어긋나 코러스) + 타건 느낌
  function lead(T, t, m, dur, v) {
    const f = hz(m), g = ac.createGain(), p = g.gain, end = t + dur;
    const d1 = Math.min(0.1, dur * 0.6);
    p.setValueAtTime(0.0001, t);
    p.exponentialRampToValueAtTime(v, t + 0.012);
    p.exponentialRampToValueAtTime(v * 0.72, t + d1);
    p.setValueAtTime(v * 0.72, Math.max(t + d1, end - 0.005));
    p.exponentialRampToValueAtTime(0.0001, end + 0.07);
    const o1 = ac.createOscillator(), o2 = ac.createOscillator();
    setWave(o1, W.lead, 'square'); setWave(o2, W.lead, 'triangle');
    o1.frequency.value = f; o2.frequency.value = f * 1.0035;
    if (dur > 0.32) {
      const k = Math.min(24, Math.floor((dur - 0.16) * 5.6));
      if (k >= 1) { const c = vibCurve(k); o1.detune.setValueCurveAtTime(c, t + 0.16, k / 5.6); o2.detune.setValueCurveAtTime(c, t + 0.16, k / 5.6); }
    }
    o1.connect(g); o2.connect(g);
    g.connect(T.organ); g.connect(T.echo);
    o1.start(t); o2.start(t); o1.stop(end + 0.09); o2.stop(end + 0.09);
    o1.onended = () => { off(o1); off(o2); off(g); };
  }

  function stab(T, t, m, dur, v) { // 반주 화음 한 음
    const o = ac.createOscillator(), g = ac.createGain(), p = g.gain;
    setWave(o, W.comp, 'square');
    o.frequency.value = hz(m);
    p.setValueAtTime(0.0001, t);
    p.exponentialRampToValueAtTime(v, t + 0.006);
    p.exponentialRampToValueAtTime(v * 0.6, t + Math.min(0.06, dur * 0.7));
    p.exponentialRampToValueAtTime(0.0001, t + dur + 0.05);
    o.connect(g); g.connect(T.organ);
    o.start(t); o.stop(t + dur + 0.07);
    o.onended = () => { off(o); off(g); };
  }

  function bassNote(T, t, m, dur, v) {
    const o = ac.createOscillator(), g = ac.createGain(), p = g.gain;
    o.type = 'sawtooth';
    o.frequency.value = hz(m);
    p.setValueAtTime(0.0001, t);
    p.exponentialRampToValueAtTime(v, t + 0.005);
    p.exponentialRampToValueAtTime(v * 0.55, t + Math.min(0.12, dur * 0.8));
    p.exponentialRampToValueAtTime(0.0001, t + dur + 0.04);
    o.connect(g); g.connect(T.bass);
    o.start(t); o.stop(t + dur + 0.06);
    o.onended = () => { off(o); off(g); };
  }

  function chip(T, t, m, dur, v) { // 칩튠 반짝이 아르페지오
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = 'triangle';
    o.frequency.value = hz(m);
    env(g.gain, t, 0.002, v, 0, dur);
    o.connect(g); g.connect(T.out);
    o.start(t); o.stop(t + dur + 0.02);
    o.onended = () => { off(o); off(g); };
  }

  function kick(T, t, v) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.frequency.setValueAtTime(165, t);
    o.frequency.exponentialRampToValueAtTime(48, t + 0.11);
    env(g.gain, t, 0.003, v, 0, 0.22);
    o.connect(g); g.connect(T.out);
    o.start(t); o.stop(t + 0.24);
    o.onended = () => { off(o); off(g); };
  }

  function hitN(t, v, dur, dest) { // 잡음 타악기 한 번 (공용 필터로)
    const g = ac.createGain();
    env(g.gain, t, 0.001, v, 0, dur);
    g.connect(dest);
    const s = nsrc(t, dur, g);
    s.onended = () => { off(s); off(g); };
  }

  function drum(T, t, kind, ch) {
    const v = ch === 'X' ? 1 : ch === 'o' ? 0.5 : 0.8, V = T.S.vol;
    if (kind === 'clap') clapS(t, V.snare * v * 0.7, T.out);
    else if (kind === 'rim') {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = 'triangle'; o.frequency.value = 1750;
      env(g.gain, t, 0.001, V.snare * v * 0.45, 0, 0.03);
      o.connect(g); g.connect(T.out);
      o.start(t); o.stop(t + 0.05);
      o.onended = () => { off(o); off(g); };
      hitN(t, V.snare * v * 1.4, 0.05, T.sn);
    } else {
      hitN(t, V.snare * v * 3, 0.13, T.sn);
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = 'triangle';
      o.frequency.setValueAtTime(195, t); o.frequency.exponentialRampToValueAtTime(150, t + 0.06);
      env(g.gain, t, 0.001, V.snare * v * 0.5, 0, 0.07);
      o.connect(g); g.connect(T.out);
      o.start(t); o.stop(t + 0.09);
      o.onended = () => { off(o); off(g); };
    }
  }

  // 16분음표 한 칸 예약
  function stepAt(T, t) {
    const S = T.S, B = S.bars[T.bar], st = T.step, sd = S.sd, V = S.vol;
    const tt = S.swing && (st & 3) === 2 ? t + S.swing * sd : t; // 셔플
    const ch = st < 8 ? B.c0 : B.c1;
    const n = B.mel[st];
    if (n) lead(T, tt, n.m, n.l * sd * 0.92, V.lead);
    const bp = S.bass[st];
    if (bp) bassNote(T, tt, ch.bass + (st === 8 && B.split ? 0 : bp[0]), bp[1] * sd * 0.9, V.bass);
    const cl = S.comp[st];
    if (cl) for (const m of ch.voices) stab(T, tt, m, cl * sd * 0.85, V.comp);
    if (B.arp) chip(T, tt, ch.arp[st % ch.arp.length], sd * 0.7, V.arp);
    const D = B.fill ? S.fill : S.drums;
    if (D.k[st] !== '.') kick(T, tt, V.kick * (D.k[st] === 'X' ? 1 : D.k[st] === 'o' ? 0.55 : 0.85));
    if (D.s[st] !== '.') drum(T, tt, B.fill ? S.fillSnare : S.snare, D.s[st]);
    if (D.h[st] !== '.') { const h = D.h[st]; hitN(tt, V.hat * (h === 'X' ? 1 : h === 'o' ? 0.5 : 0.8) * 1.2, h === 'X' ? 0.07 : 0.035, T.hat); }
  }

  function advance(T) {
    T.nextTime += T.S.sd;
    if (++T.step >= 16) { T.step = 0; if (++T.bar >= T.S.bars.length) T.bar = 0; }
  }

  const live = () => !!ac && ac.state === 'running' && !paused && !hidden;

  function tick() {
    timer = 0;
    if (!live() || !tracks.length) return; // 멈추면 예약도 멈춘다 (나중에 몰아서 울리지 않게)
    const now = ac.currentTime, horizon = now + LOOKAHEAD;
    for (const T of tracks.slice()) {
      if (T.dieAt && now >= T.dieAt) { dispose(T); continue; }
      if (T.nextTime < now - 0.04) T.nextTime = now + 0.02; // 늦었으면 건너뛰지 않고 다시 맞춘다
      let guard = 0;
      while (T.nextTime < horizon && guard++ < 32) {
        try { stepAt(T, T.nextTime); } catch (e) { /* 한 칸 실패해도 계속 */ }
        advance(T);
      }
    }
    if (tracks.length) timer = setTimeout(tick, TICK_MS);
  }
  function startTimer() { if (!timer && tracks.length && live()) timer = setTimeout(tick, 0); }
  function stopTimer() { if (timer) clearTimeout(timer); timer = 0; }

  // 원하는 분위기와 지금 나오는 음악을 맞춘다
  function syncBgm() {
    if (!ac) return;
    const want = bgmOn ? desired : null;
    const cur = tracks.find((T) => !T.dieAt) || null;
    if ((cur ? cur.mood : null) === want) return;
    if (!live()) { // 멈춘 동안엔 페이드가 안 되니 바로 정리 — 다시 켜질 때 새로 시작
      tracks.slice().forEach((T) => { if (T.mood !== want || T.dieAt) dispose(T); });
      return;
    }
    if (cur) fadeOut(cur);
    if (want) tracks.push(makeTrack(want));
    startTimer();
  }

  /* ---------- 멈춤 · 깨우기 ---------- */
  function armSuspend(ms) {
    clearTimeout(susTimer);
    susTimer = setTimeout(() => {
      susTimer = 0;
      if ((paused || hidden) && ac && ac.state === 'running') {
        selfSuspended = true;
        quiet(ac.suspend());
      }
    }, ms);
  }

  function halt() {
    stopTimer();
    if (!ac) return;
    ramp(bgm.gain, 0, 0.03);
    armSuspend(160);
  }

  function onRunning() {
    if (!ac || ac.state !== 'running') return;
    selfSuspended = false;
    if (paused || hidden) return;
    clearTimeout(susTimer); susTimer = 0;
    ramp(bgm.gain, BGM_VOL, 0.1);
    const now = ac.currentTime;
    for (const T of tracks) if (T.nextTime < now + 0.05) T.nextTime = now + 0.05;
    syncBgm();
    startTimer();
  }

  function wake() {
    if (!ac || paused || hidden) return;
    clearTimeout(susTimer); susTimer = 0;
    if (ac.state !== 'running') { const p = ac.resume(); if (p && p.then) p.then(onRunning, () => {}); }
    else onRunning();
  }

  function onVis() {
    try {
      const h = document.visibilityState === 'hidden';
      if (h === hidden) return;
      hidden = h;
      if (hidden) halt(); else wake();
    } catch (e) { /* 무시 */ }
  }

  function build() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try { ac = new AC({ latencyHint: 'interactive' }); } catch (e) { ac = new AC(); }
    comp = ac.createDynamicsCompressor(); // 부드러운 리미터
    comp.threshold.value = -6;
    comp.knee.value = 6;
    comp.ratio.value = 8;
    comp.attack.value = 0.002;
    comp.release.value = 0.12;
    master = ac.createGain();
    master.gain.value = MASTER_VOL;
    comp.connect(master); master.connect(ac.destination);
    sfx = ac.createGain();
    sfx.gain.value = muted ? 0 : SFX_VOL;
    sfx.connect(comp);
    bgm = ac.createGain();
    bgm.gain.value = BGM_VOL;
    bgm.connect(comp);
    const len = ac.sampleRate; // 1초 백색잡음 (한 번만)
    nbuf = ac.createBuffer(1, len, ac.sampleRate);
    const d = nbuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    makeWaves();
    ac.onstatechange = () => { try { if (ac && ac.state === 'running') onRunning(); } catch (e) { /* 무시 */ } };
    try {
      hidden = document.visibilityState === 'hidden';
      document.addEventListener('visibilitychange', onVis);
    } catch (e) { /* 문서 없음 */ }
    // 예전 iOS: 제스처 안에서 소리를 한 번 틀어야 풀린다
    try {
      const b = ac.createBufferSource();
      b.buffer = ac.createBuffer(1, 1, ac.sampleRate);
      b.connect(ac.destination);
      b.start(0);
      b.onended = () => off(b);
    } catch (e) { /* 무시 */ }
    return true;
  }

  function pickVoice(ss) {
    if (voice) return voice;
    try {
      const vs = ss.getVoices() || [];
      voice = vs.find((v) => /^ko/i.test(v.lang)) || null;
    } catch (e) { voice = null; }
    return voice;
  }

  /* ---------- 바깥 API ---------- */
  const api = {
    get muted() { return muted; },
    set muted(v) { api.setMuted(v); },
    get bgmOn() { return bgmOn; },
    set bgmOn(v) { api.setBgm(v); },

    init() {
      try {
        if (!ac && !build()) return;
        if (ac.state !== 'running') {
          const p = ac.resume();
          if (p && p.then) p.then(onRunning, () => {});
        }
        if (paused) armSuspend(2000); // 멈춤 화면 버튼 소리용으로 잠깐만 깨운다
      } catch (e) { /* 소리 없이도 게임은 돈다 */ }
    },

    setMuted(v) {
      try {
        muted = !!v;
        sset('muted', muted);
        if (ac) ramp(sfx.gain, muted ? 0 : SFX_VOL, 0.02);
        if (muted && typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel();
      } catch (e) { /* 무시 */ }
    },

    setBgm(v) {
      try {
        bgmOn = !!v;
        sset('bgm', bgmOn);
        syncBgm();
      } catch (e) { /* 무시 */ }
    },

    play(name, opt = {}) {
      try {
        if (muted || !ac) return;
        const fn = SFX[name];
        if (!fn) return;
        if (ac.state !== 'running') {
          if (!selfSuspended || hidden) return; // 아직 잠금 전이면 조용히
          quiet(ac.resume()); // 우리가 재운 것(멈춤 화면)이면 깨워서 낸다
          armSuspend(1500);
        }
        const now = ac.currentTime;
        if (last[name] && now - last[name] < 0.03 && now >= last[name]) return; // 같은 소리 겹침 방지
        last[name] = now;
        fn(now + 0.004, opt || {});
      } catch (e) { /* 소리는 절대 게임을 멈추지 않는다 */ }
    },

    say(text) {
      try {
        if (muted || !text || typeof window === 'undefined') return;
        const ss = window.speechSynthesis;
        if (!ss || typeof window.SpeechSynthesisUtterance !== 'function') return;
        ss.cancel();
        const u = new window.SpeechSynthesisUtterance(String(text));
        u.lang = 'ko-KR';
        u.rate = 1.1;
        u.pitch = 1.2;
        u.volume = 1;
        const v = pickVoice(ss);
        if (v) u.voice = v;
        ss.speak(u);
      } catch (e) { /* 음성 미지원 */ }
    },

    bgm(mood) {
      try {
        desired = MOODS.includes(mood) ? mood : null;
        syncBgm();
      } catch (e) { /* 무시 */ }
    },

    pause() {
      try {
        if (paused) return;
        paused = true;
        halt();
      } catch (e) { /* 무시 */ }
    },

    resume() {
      try {
        if (!paused) return;
        paused = false;
        wake();
      } catch (e) { /* 무시 */ }
    },

    close() {
      try {
        stopTimer();
        clearTimeout(susTimer); susTimer = 0;
        tracks.slice().forEach(dispose);
        tracks = [];
        try { document.removeEventListener('visibilitychange', onVis); } catch (e) { /* 무시 */ }
        try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) { /* 무시 */ }
        if (ac) {
          ac.onstatechange = null;
          [sfx, bgm, comp, master].forEach(off);
          quiet(ac.close());
        }
      } catch (e) { /* 무시 */ }
      ac = sfx = bgm = comp = master = nbuf = null;
      W = {};
      selfSuspended = false;
    },
  };
  return api;
}
