/**
 * ROPE BEAT 음악 점검 (2026-11-07, 음악 감독 · 10곡)
 *   node tools/_beat-music-check.mjs              ← 순수 점검 + 가짜 AudioContext 로 예약 점검
 *   node tools/_beat-music-check.mjs --browser    ← + 진짜 크롬으로 music.html 재생(vite 가 5401 에 떠 있어야 한다)
 *        --full                                    ← 브라우저에서 10곡을 끝까지(병렬, 반복 곡은 70초)
 *   node tools/_beat-music-check.mjs --render     ← + 진짜 크롬 OfflineAudioContext 로 렌더링(서버 필요 없음):
 *        고르기 4곡 × BPM 100 · 150 · 200 (한 바퀴 34마디) + 기존 6곡 — 소리 · 클리핑 · 무음 · 킥 = 박(예약 · 실제 소리) · 곡 크기
 *        --wav <폴더>                               ← 렌더링한 소리를 wav 로 저장(들어 보기용)
 *
 * 1) 악보: 마디마다 16칸 · 음 이름 · 화음 · 곡 정보가 stages.js 와 같은지
 * 2) 작곡(stepEvents): 6곡 전 칸 — 이벤트 수 · 칸 시각 단조 증가 · 곡 길이 ≈ stages 길이 ·
 *    박마다 킥 / 엇박마다 오픈 하이햇 / 박 아닌 곳에 킥 없음 · 템포 변화 구간에서 킥 간격 = 60/bpm
 * 3) 예약(createMusic): 가짜 AudioContext + 흔들리는 시계 + 일시정지 + 멈칫(0.5초) 에서
 *    킥이 정확히 T0 + steps[박] 에 한 번씩 · 모든 음이 칸 위 · 과거 예약 없음 · 오류 0 · 노드 새지 않음
 */
import { STAGES, ENDLESS } from '../src/games/jumprope/beat/stages.js';
import { buildSteps, timeAtStep, bpmAt } from '../src/games/jumprope/beat/timing.js';
import { createMusic, SONG_IDS, SONG_LIST, planSong, stepEvents, barInfo, songProblems, songInfo } from '../src/games/jumprope/beat/music.js';
import { survivalTempo } from '../src/games/jumprope/beat/survival.js';

const args = process.argv.slice(2);
let fails = 0;
const ok = (cond, msg) => { if (!cond) { fails++; console.log('  ✗ ' + msg); } return !!cond; };
const head = (s) => console.log('\n■ ' + s);
const fmt = (x, d = 2) => Number(x).toFixed(d);
const VOICES = new Set(['lead', 'lead2', 'harm', 'fever', 'arp', 'spark', 'stab', 'brass', 'pad', 'bass', 'kick', 'snare', 'clap', 'hat', 'ohat', 'crash', 'tom', 'riser', 'shine',
  'canon', 'uke', 'clav', 'horn', 'shaker', 'bell', 'taiko', 'pfeif']);
const NEW_SONGS = ['sunny', 'funky', 'retro', 'festival'];
const fixed = (bpm) => [{ bar: 0, bpm }];

/* ---------------- 1) 악보 ---------------- */
head('1) 악보');
const probs = songProblems();
ok(probs.length === 0, '악보 오류: ' + probs.join(' / '));
ok(SONG_IDS.length === 10 && SONG_IDS.join() === 'training,arena,cross,double,world,endless,sunny,funky,retro,festival', 'SONG_IDS 10곡');
// 곡 고르기 목록: 10곡 · id 순서 = SONG_IDS · 제목/분위기 있음 · 제목 겹치지 않음 · 대회/무한 곡 제목 = stages.js
ok(Array.isArray(SONG_LIST) && SONG_LIST.length === 10 && SONG_LIST.map((x) => x.id).join() === SONG_IDS.join(), 'SONG_LIST 10곡 · SONG_IDS 순서');
ok(SONG_LIST.every((x) => Object.keys(x).join() === 'id,title,mood' && /^[\x20-\x7e]+$/.test(x.title) && /[가-힣]/.test(x.mood)), 'SONG_LIST 모양 { id, title(영문), mood(한국어) }');
ok(new Set(SONG_LIST.map((x) => x.title)).size === 10, 'SONG_LIST 제목이 겹친다');
for (const st of [...STAGES, ENDLESS]) ok(SONG_LIST.find((x) => x.id === st.id)?.title === st.song.title, `SONG_LIST ${st.id} 제목 ≠ stages.js «${st.song.title}»`);
for (const st of [...STAGES, ENDLESS]) {
  const inf = songInfo(st.id);
  ok(inf, `${st.id} 곡 정보`);
  if (!inf) continue;
  ok(inf.title === st.song.title && inf.style === st.song.style && inf.key === st.song.key && inf.mode === st.song.mode,
    `${st.id} 곡 정보가 stages.js 와 다름 (${inf.title}/${inf.style}/${inf.key}/${inf.mode})`);
}
console.log(`  악보 오류 ${probs.length}건 · 곡 ${SONG_IDS.length}개`);
for (const x of SONG_LIST) console.log(`  ${x.id.padEnd(9)} ${x.title.padEnd(21)} ${x.mood}`);

/* ---------------- 2) 작곡 ---------------- */
head('2) 작곡 (stepEvents) — 전 칸');
const rows = [];
function checkPlan(id, tempo, bars, sections, upto, extra) {
  const plan = planSong(id, { tempo, bars, ...(sections ? { sections } : {}), ...(extra || {}) });
  const ref = buildSteps(tempo, bars);
  ok(plan.steps.length === ref.length && plan.steps.every((v, i) => v === ref[i]), `${id}: steps 가 buildSteps(tempo, bars) 와 다름`);
  const last = upto ?? plan.n;
  let events = 0, kicks = 0, ohats = 0, bad = 0, offKick = 0, missKick = 0, missHat = 0, kickDtErr = 0;
  let prevT = -Infinity, prevKick = null;
  const perSec = {};
  for (let s = 0; s <= last; s++) {
    const t = timeAtStep(plan.steps, s);
    if (!(t > prevT)) bad++;
    prevT = t;
    const ev = stepEvents(plan, s);
    events += ev.length;
    let k = 0, h = 0;
    for (const e of [...ev, ...stepEvents(plan, s, { fever: true })]) {
      if (!VOICES.has(e.v) || !(e.vel > 0 && e.vel <= 1.2)) bad++;
      if (e.m != null && !(e.m >= 28 && e.m <= 110)) bad++;
      if (e.ms && !e.ms.every((m) => m >= 28 && m <= 110)) bad++;
      if (e.len != null && !(e.len > 0 && timeAtStep(plan.steps, s + e.len) > t)) bad++;
    }
    for (const e of ev) { if (e.v === 'kick') k++; if (e.v === 'ohat') h++; }
    kicks += k; ohats += h;
    if (k > 1) bad++;
    if (k && s % 4 !== 0) offKick++;
    if (s < plan.n || plan.endless) {
      const B = barInfo(plan, Math.floor(s / 16));
      const needs = B.E >= 1 || B.kind === 'intro' || B.kind === 'break';
      if (needs && s % 4 === 0 && !k) missKick++;
      if (needs && s % 4 === 2 && !h) missHat++;
      const key = `${B.label}(${B.E})`;
      const r = (perSec[key] ||= { ev: 0, steps: 0 });
      r.ev += ev.length; r.steps++;
      // 템포 변화를 따라가는지: 킥 간격 = 그 박의 4칸 길이 ≈ 60/bpm
      if (k) {
        if (prevKick != null && s - prevKick === 4) {
          const dt = t - timeAtStep(plan.steps, prevKick);
          const want = 60 / bpmAt(tempo, (prevKick + 2) / 16);
          if (Math.abs(dt - want) > 0.004) kickDtErr++;
        }
        prevKick = s;
      }
    }
  }
  ok(bad === 0, `${id}: 잘못된 이벤트/시각 ${bad}건`);
  ok(offKick === 0, `${id}: 박이 아닌 칸의 킥 ${offKick}건`);
  ok(missKick === 0, `${id}: 킥이 빠진 박 ${missKick}건`);
  ok(missHat === 0, `${id}: 하이햇이 빠진 엇박 ${missHat}건`);
  ok(kickDtErr === 0, `${id}: 킥 간격 ≠ 60/bpm ${kickDtErr}건`);
  return { plan, events, kicks, ohats, perSec };
}
for (const st of STAGES) {
  const r = checkPlan(st.id, st.tempo, st.bars, st.sections);
  const dur = r.plan.duration;
  ok(dur > 50 && dur < 70, `${st.id}: 곡 길이 ${fmt(dur)}초 (약 60초여야)`);
  ok(r.kicks >= st.bars * 4, `${st.id}: 킥 ${r.kicks} < 박 수 ${st.bars * 4}`);
  // 편곡 세기: 인트로 < 세기 3, 브레이크(세기 1)가 앞뒤보다 비어 있다
  const dens = Object.entries(r.perSec).map(([k, v]) => [k, v.ev / v.steps * 16]);
  const d = Object.fromEntries(dens);
  const intro = dens.find(([k]) => k.startsWith('intro'));
  const top = Math.max(...dens.map(([, v]) => v));
  if (intro) ok(intro[1] < top * 0.6, `${st.id}: 인트로가 가볍지 않다 (${fmt(intro[1], 0)} vs ${fmt(top, 0)})`);
  const brk = dens.find(([k]) => /^(break|bridge)/.test(k));
  if (brk) ok(brk[1] < top * 0.6, `${st.id}: 브레이크가 비지 않았다 (${fmt(brk[1], 0)} vs ${fmt(top, 0)})`);
  const fin = dens.find(([k]) => /^final\(3\)/.test(k)) || dens.find(([k]) => /^C\(3\)/.test(k));
  if (fin) ok(fin[1] >= top * 0.9, `${st.id}: 마지막 고조 구간이 가장 꽉 차지 않았다`);
  rows.push([st.id, st.bars, fmt(dur), r.events, r.kicks, r.ohats, dens.map(([k, v]) => `${k}:${fmt(v, 0)}`).join(' ')]);
  void d;
}
{ // 무한 — 400마디 앞부분 전부 + 끝
  const bars = 400;
  const tempo = ENDLESS.tempoUntil(bars);
  const r = checkPlan('endless', tempo, bars, null, bars * 16 + 64); // 400마디를 넘어서도(4마디) 이어진다
  rows.push(['endless', bars, fmt(r.plan.duration), r.events, r.kicks, r.ohats, `bpm ${bpmAt(tempo, 0)}→${bpmAt(tempo, 200)}→${bpmAt(tempo, 400)}`]);
  // 반복마다 변주: 한 바퀴(8마디)의 리드 음 지문이 바퀴마다 다르다(연속 두 바퀴가 같은 곳이 없어야)
  const sig = (L) => {
    const a = [];
    for (let s = L * 128; s < (L + 1) * 128; s++) for (const e of stepEvents(r.plan, s)) if (e.v === 'lead' || e.v === 'stab' || e.v === 'arp') a.push(e.v[0] + e.m + (e.ms || ''));
    return a.join(',');
  };
  const sigs = Array.from({ length: 17 }, (_, L) => sig(L));
  let same = 0;
  for (let L = 1; L < sigs.length; L++) if (sigs[L] === sigs[L - 1]) same++;
  ok(same === 0, `endless: 연속 두 바퀴가 똑같은 곳 ${same}군데`);
  console.log(`  무한 변주: 17바퀴 중 서로 다른 바퀴 ${new Set(sigs).size}종 · 연속 같음 ${same}`);
  ok(Math.abs(bpmAt(tempo, 400) - 200) < 1e-9 && bpmAt(tempo, 0) === 100, 'endless: 100 → 200 BPM');
}
// 고르기 4곡 — 어떤 템포 지도 · 길이에도: 무한(100→200, 400마디 + 넘어서), 서바이벌(라운드마다 툭 빨라짐), 고정 100 · 150 · 200,
// 대회 템포 + 대회 구간(구간 편곡 → bars 에서 마침 화음)
const sig8 = (plan, L) => { // 8마디 묶음의 음 지문(리드 · 화음 · 아르페지오 · 메아리 · 베이스)
  const a = [];
  for (let s = 2 * 16 + L * 128; s < 2 * 16 + (L + 1) * 128; s++) for (const e of stepEvents(plan, s)) if (e.m != null || e.ms) a.push(e.v + (e.m ?? e.ms.join('.')));
  return a.join(',');
};
for (const id of NEW_SONGS) {
  const bars = 400, tempo = ENDLESS.tempoUntil(bars);
  const r = checkPlan(id, tempo, bars, null, bars * 16 + 64);
  ok(r.plan.endless && r.plan.laps && !r.plan.secs, `${id}: 무한 템포에서 바퀴 편곡 · 끝없이`);
  rows.push([id, bars, fmt(r.plan.duration), r.events, r.kicks, r.ohats, Object.entries(r.perSec).map(([k, v]) => `${k}:${fmt(v.ev / v.steps * 16, 0)}`).join(' ')]);
  const sigs = Array.from({ length: 16 }, (_, L) => sig8(r.plan, L));
  let same = 0;
  for (let L = 1; L < sigs.length; L++) if (sigs[L] === sigs[L - 1]) same++;
  ok(same === 0, `${id}: 연속 두 구간(8마디)이 똑같은 곳 ${same}군데`);
  // 구간 경계 = 2 + 8k 마디 (무한 채보 16마디 단계 2 · 18 · 34 … 와 맞물림)
  let misalign = 0, rawHigh = 0, lowest = 999, highest = 0;
  for (let bar = 0; bar < 200; bar++) {
    const B = barInfo(r.plan, bar);
    if (B.first !== (bar === 0 || (bar - 2) % 8 === 0)) misalign++;
    if (B.mel) for (const n of B.mel) if (n) { const m = n.m + B.tr; if (m > 98) rawHigh++; lowest = Math.min(lowest, m); highest = Math.max(highest, m); }
  }
  ok(misalign === 0, `${id}: 구간 경계가 2+8k 마디가 아님 ${misalign}`);
  ok(rawHigh === 0, `${id}: 조를 옮긴 선율이 D7 위로 넘어 옥타브로 꺾이는 음 ${rawHigh}개`);
  for (const bpm of [100, 150, 200]) {
    const q = checkPlan(id, fixed(bpm), 64, null, 64 * 16 + 32);
    ok(Math.abs(q.plan.steps[16] - 4 * 60 / bpm) < 1e-9, `${id}: ${bpm}BPM 마디 길이`);
  }
  const sv = checkPlan(id, survivalTempo(200), 200, null, 200 * 16 + 32);
  void sv;
  const st = STAGES[4]; // 대회 템포 + 구간을 넘기면 구간 편곡, bars 에서 끝난다
  const sc = checkPlan(id, st.tempo, st.bars, st.sections);
  ok(!sc.plan.endless && sc.plan.secs && stepEvents(sc.plan, sc.plan.n).some((e) => e.v === 'kick') && stepEvents(sc.plan, sc.plan.n + 4).length === 0,
    `${id}: 구간을 주면 구간 편곡 + bars 에서 마침 화음 후 끝`);
  const fin = checkPlan(id, fixed(140), 40, null, 40 * 16, { endless: false }); // 바퀴 곡을 bars 에서 끝내기
  ok(!fin.plan.endless && stepEvents(fin.plan, fin.plan.n).some((e) => e.v === 'lead'), `${id}: endless:false 면 bars 에서 마침 화음`);
  console.log(`  ${id.padEnd(9)} 무한 400마디 · 서바이벌 · 고정 100/150/200 · 대회 구간 · endless:false 통과 · 선율 MIDI ${lowest}~${highest} · 연속 같은 구간 ${same}`);
}
// 대회 곡을 무한 · 서바이벌 템포로 골라도(대회 길이가 아니면) 바퀴로 돈다 — 아웃트로만 수백 마디 반복하지 않는다
for (const st of STAGES) {
  const r = checkPlan(st.id, ENDLESS.tempoUntil(400), 400, null, 400 * 16 + 64);
  const labels = new Set();
  for (let bar = 0; bar < 400; bar++) labels.add(barInfo(r.plan, bar).kind);
  ok(r.plan.laps && r.plan.endless && !labels.has('outro'), `${st.id}: 무한 템포에서 바퀴 편곡(아웃트로 없이)`);
  checkPlan(st.id, survivalTempo(200), 200, null, 200 * 16 + 32);
}
console.log('  대회 5곡 × 무한(400마디) · 서바이벌 템포 — 바퀴 편곡 통과');
console.log('  곡        마디  길이(초)  이벤트  킥   엇박햇  구간별 마디당 이벤트');
for (const r of rows) console.log(`  ${r[0].padEnd(9)} ${String(r[1]).padStart(4)}  ${String(r[2]).padStart(7)}  ${String(r[3]).padStart(6)}  ${String(r[4]).padStart(4)}  ${String(r[5]).padStart(5)}   ${r[6]}`);

// 템포가 확 바뀌는 칸(arena 20마디 124→100, world 30마디 172→182)에서 앞뒤 칸 길이가 bpm 그대로
for (const [id, bar, a, b] of [['arena', 20, 124, 100], ['world', 30, 172, 182], ['cross', 22, 112, 138]]) {
  const st = STAGES.find((x) => x.id === id);
  const p = planSong(id, { tempo: st.tempo, bars: st.bars });
  const s = bar * 16;
  const before = p.steps[s] - p.steps[s - 1], after = p.steps[s + 1] - p.steps[s];
  ok(Math.abs(before - 15 / a) < 2e-3 && Math.abs(after - 15 / b) < 1e-9, `${id}: ${bar}마디 템포 변화 칸 길이 ${fmt(before * 1000, 1)}→${fmt(after * 1000, 1)}ms`);
  const kick = stepEvents(p, s).some((e) => e.v === 'kick');
  ok(kick, `${id}: 템포가 바뀌는 칸(${s})에 킥`);
  console.log(`  ${id} ${bar}마디: 16분 ${fmt(before * 1000, 1)}ms(${a}) → ${fmt(after * 1000, 1)}ms(${b}) · 킥 ${kick ? '있음' : '없음'}`);
}

/* ---------------- 3) 예약 — 가짜 AudioContext ---------------- */
head('3) 예약 (createMusic + 가짜 AudioContext)');
const ERR = [];
let live = 0; // 연결된 채 남아 있는 노드 수 (새는지 본다)
let clockNow = 0;
let LOG = null; // 예약 기록: { kind, t, at, f0, type }
class FParam {
  constructor(v = 0) { this.value = v; this.ev = []; }
  _chk(name, v, t) { if (!Number.isFinite(v) || !Number.isFinite(t) || t < 0) { ERR.push(`${name}(${v}, ${t})`); throw new TypeError(name); } }
  setValueAtTime(v, t) { this._chk('setValueAtTime', v, t); this.ev.push(['set', v, t]); if (this.ev.length === 1) this.v0 = v; return this; }
  linearRampToValueAtTime(v, t) { this._chk('linearRamp', v, t); this.ev.push(['lin', v, t]); return this; }
  exponentialRampToValueAtTime(v, t) { this._chk('expRamp', v, t); if (v === 0) { ERR.push('expRamp 0'); throw new RangeError('exp 0'); } this.ev.push(['exp', v, t]); return this; }
  setTargetAtTime(v, t, tc) { this._chk('setTarget', v, t); if (!(tc > 0)) { ERR.push('setTarget tc'); throw new RangeError('tc'); } this.ev.push(['tgt', v, t]); return this; }
  setValueCurveAtTime(c, t, d) {
    this._chk('curve', d, t);
    if (!(d > 0) || !(c.length >= 2)) { ERR.push('curve d'); throw new RangeError('curve'); }
    if (this.ev.some((e) => e[2] > t && e[2] < t + d)) { ERR.push('curve overlap'); throw new Error('curve overlap'); }
    this.ev.push(['curve', c[0], t]); return this;
  }
  cancelScheduledValues(t) { this.ev = this.ev.filter((e) => e[2] < t); return this; }
  cancelAndHoldAtTime(t) { return this.cancelScheduledValues(t); }
}
class FNode {
  constructor(ctx) { this.context = ctx; this.outs = new Set(); }
  connect(d) { if (!d) { ERR.push('connect(undefined)'); throw new TypeError('connect'); } if (!this.outs.size) live++; this.outs.add(d); return d; }
  disconnect() { if (this.outs.size) live--; this.outs.clear(); }
}
class FSource extends FNode {
  constructor(ctx, kind) { super(ctx); this.kind = kind; this.started = false; this.stopAt = Infinity; this.onended = null; ctx._srcs.add(this); }
  start(t = 0) {
    if (this.started) { ERR.push('start twice'); throw new Error('start twice'); }
    if (!Number.isFinite(t)) { ERR.push('start NaN'); throw new TypeError('start'); }
    this.started = true; this.t = t;
    if (LOG) LOG.push({ kind: this.kind, t, at: this.context.currentTime, f0: this.frequency ? this.frequency.v0 : null, type: this.type });
  }
  stop(t = 0) { if (!this.started) { ERR.push('stop before start'); throw new Error('stop'); } this.stopAt = t; }
}
class FOsc extends FSource {
  constructor(c) { super(c, 'osc'); this.type = 'sine'; this.frequency = new FParam(440); this.detune = new FParam(0); }
  setPeriodicWave(w) { if (!w || !w.__wave) { ERR.push('bad wave'); throw new TypeError('wave'); } this.type = 'custom'; }
}
class FBuf extends FSource { constructor(c) { super(c, 'buf'); this.buffer = null; this.loop = false; this.playbackRate = new FParam(1); } }
class FAC {
  constructor() {
    this.currentTime = 0; this.state = 'suspended'; this.sampleRate = 48000; this.outputLatency = 0.02; this.baseLatency = 0.005;
    this.destination = new FNode(this); this._srcs = new Set(); this.onstatechange = null; FAC.last = this;
  }
  createGain() { const n = new FNode(this); n.gain = new FParam(1); return n; }
  createOscillator() { return new FOsc(this); }
  createBufferSource() { return new FBuf(this); }
  createBiquadFilter() { const n = new FNode(this); n.type = 'lowpass'; n.frequency = new FParam(350); n.Q = new FParam(1); n.gain = new FParam(0); return n; }
  createDelay() { const n = new FNode(this); n.delayTime = new FParam(0); return n; }
  createDynamicsCompressor() { const n = new FNode(this); for (const k of ['threshold', 'knee', 'ratio', 'attack', 'release']) n[k] = new FParam(0); return n; }
  createPeriodicWave(re, im) { if (re.length !== im.length) throw new Error('wave len'); return { __wave: true }; }
  createBuffer(ch, len) { const d = new Float32Array(len); return { length: len, getChannelData: () => d }; }
  resume() { this.state = 'running'; return Promise.resolve(); }
  suspend() { this.state = 'suspended'; return Promise.resolve(); }
  close() { this.state = 'closed'; return Promise.resolve(); }
  getOutputTimestamp() { return { contextTime: this.currentTime - 0.02, performanceTime: clockNow }; }
  // 시계를 dt 만큼 — 끝난 소스는 onended
  _adv(dt) {
    if (this.state === 'running') this.currentTime += dt;
    for (const s of this._srcs) if (s.started && s.stopAt <= this.currentTime) { this._srcs.delete(s); if (s.onended) s.onended(); }
  }
}
globalThis.window = { AudioContext: FAC };
Object.defineProperty(globalThis, 'performance', { value: { now: () => clockNow }, configurable: true, writable: true });
let tickFn = null;
globalThis.setInterval = (fn) => { tickFn = fn; return 1; };
globalThis.clearInterval = () => { tickFn = null; };

let seed = 12345;
const rnd = () => { seed = (seed * 1103515245 + 12345) >>> 0; return seed / 4294967296; };
async function runFake(id, opts) {
  const mu = createMusic();
  mu.init();
  const ctx = FAC.last;
  await Promise.resolve();
  const plan = planSong(id, opts.plan);
  const prep = mu.prepare(id, opts.plan);
  LOG = [];
  const T0 = mu.start(1.6);
  const beat = 60 / bpmAt(plan.tempo, 0);
  const endT = T0 + (opts.until ?? prep.duration) + 3.5;
  let pausedAt = null, stalls = [];
  let pauseWall = 0;
  const songTimes = [];
  while (ctx.currentTime < endT) {
    let dt = 0.003 + rnd() * 0.037; // 3~40ms 흔들리는 타이머
    if (opts.stall && ctx.currentTime > T0 + opts.stall && !stalls.length) { dt = 0.5; stalls.push([ctx.currentTime, ctx.currentTime + dt]); }
    clockNow += dt * 1000;
    ctx._adv(dt);
    if (opts.pauseAt != null && pausedAt == null && ctx.currentTime > T0 + opts.pauseAt) { pausedAt = ctx.currentTime; await mu.pause(); songTimes.push(mu.songTime()); }
    if (pausedAt != null && ctx.state === 'suspended' && (pauseWall += dt) > 0.8) { songTimes.push(mu.songTime()); await mu.resume(); }
    if (opts.fever && Math.floor(ctx.currentTime / 3) % 2 === 1) mu.setFever(true); else if (opts.fever) mu.setFever(false);
    if (tickFn) tickFn();
  }
  const log = LOG; LOG = null;
  return { mu, ctx, plan, T0, beat, log, stalls, songTimes, prep };
}
const near = (a, b) => Math.abs(a - b) < 1e-9;

for (const st of [...STAGES, { id: 'endless' }, ...NEW_SONGS.map((id) => ({ id, loop: true })), { id: 'retro', loop: true, bpm: 200 }]) {
  const endless = st.id === 'endless' || st.loop;
  const optsPlan = st.bpm ? { tempo: fixed(st.bpm), bars: 400 } : endless ? { tempo: ENDLESS.tempoUntil(400), bars: 400 } : { tempo: st.tempo, bars: st.bars };
  const until = st.bpm ? 40 : st.loop ? 90 : endless ? 150 : undefined; // 무한은 150초(≈ 100→124 BPM)만 · 고르기 곡은 90초 · 200BPM 은 40초
  const errs0 = ERR.length;
  const R = await runFake(st.id, { plan: optsPlan, pauseAt: 20, fever: true, until });
  const { log, T0, plan, beat } = R;
  // 기대 킥 = 순수 작곡의 킥 칸 (곡 끝 칸 포함)
  const lastS = endless ? Math.floor(timeAtStepInv(plan, until)) : plan.n;
  const want = [];
  for (let s = 0; s <= lastS; s++) if (stepEvents(plan, s).some((e) => e.v === 'kick')) want.push(T0 + timeAtStep(plan.steps, s));
  const kicks = log.filter((x) => x.kind === 'osc' && x.type === 'sine' && x.f0 === 150).map((x) => x.t).sort((a, b) => a - b);
  const kicksIn = kicks.filter((t) => t <= T0 + timeAtStep(plan.steps, lastS) + 1e-9);
  let mism = 0;
  if (kicksIn.length !== want.length) mism = Math.abs(kicksIn.length - want.length);
  else for (let i = 0; i < want.length; i++) if (!near(kicksIn[i], want[i])) mism++;
  ok(mism === 0, `${st.id}: 킥 예약 ${kicksIn.length}개 / 기대 ${want.length}개 · 어긋남 ${mism}`);
  // 모든 곡 음(카운트 제외)이 칸 위에 — 시각 집합 = { T0 + steps[s] }
  const grid = new Set();
  for (let s = 0; s <= lastS + 64; s++) grid.add((T0 + timeAtStep(plan.steps, s)).toFixed(9));
  const counts = [4, 3, 2, 1].map((k) => (T0 - k * beat).toFixed(9));
  const offGrid = log.filter((x) => !grid.has(x.t.toFixed(9)) && !counts.includes(x.t.toFixed(9)));
  ok(offGrid.length === 0, `${st.id}: 칸 밖 음 ${offGrid.length}개 (예: ${offGrid.slice(0, 3).map((x) => fmt(x.t - T0, 4)).join(', ')})`);
  // 과거 예약 없음 · 0.15초보다 멀리 예약 없음 (카운트는 start 때 미리)
  const past = log.filter((x) => x.t < x.at - 0.03 - 1e-9).length;
  const far = log.filter((x) => !counts.includes(x.t.toFixed(9)) && x.t > x.at + 0.15 + 1e-9).length;
  ok(past === 0, `${st.id}: 과거로 예약된 음 ${past}개`);
  ok(far === 0, `${st.id}: 0.15초보다 멀리 예약된 음 ${far}개`);
  // 카운트 4번
  const cnt = log.filter((x) => counts.includes(x.t.toFixed(9)));
  ok(cnt.length >= 4 && counts.every((c) => cnt.some((x) => x.t.toFixed(9) === c)), `${st.id}: 리드인 카운트 4박`);
  // 일시정지 동안 곡 시계가 멈췄다
  const [sa, sb] = R.songTimes;
  ok(sa != null && sb != null && near(sa, sb), `${st.id}: 일시정지 동안 곡 시계 ${sa != null ? fmt(sa, 3) : '-'} → ${sb != null ? fmt(sb, 3) : '-'}`);
  ok(ERR.length === errs0, `${st.id}: Web Audio 호출 오류 ${ERR.length - errs0}건 (${ERR.slice(errs0, errs0 + 3).join(' / ')})`);
  const nodes = log.length;
  const dur = endless ? until : plan.duration;
  console.log(`  ${(st.id + (st.bpm ? '@' + st.bpm : '')).padEnd(9)} T0=${fmt(T0, 3)} 킥 ${kicksIn.length}/${want.length} · 음 ${nodes}개(${fmt(nodes / dur, 0)}/초) · 칸 밖 ${offGrid.length} · 과거 ${past} · 오류 ${ERR.length - errs0}`);
  R.mu.close();
}
function timeAtStepInv(plan, sec) { let s = 0; while (timeAtStep(plan.steps, s) < sec) s++; return s; }

// 멈칫(메인 스레드 0.5초 멈춤): 그 사이 칸은 건너뛰고(몰아 울리지 않음) 다음 칸부터 다시 정확히
{
  const st = STAGES[3];
  const errs0 = ERR.length;
  const R = await runFake(st.id, { plan: { tempo: st.tempo, bars: st.bars }, stall: 12, until: 20 });
  const [a, b] = R.stalls[0] || [0, 0];
  const late = R.log.filter((x) => x.t < x.at - 0.03 - 1e-9).length;
  const inside = R.log.filter((x) => x.t > a + 0.15 + 1e-9 && x.t < b - 0.03 - 1e-9).length;
  const after = R.log.filter((x) => x.t > b + 0.2).length;
  ok(R.stalls.length === 1 && late === 0 && inside === 0 && after > 0, `멈칫 0.5초: 늦은 예약 ${late} · 멈춘 사이 음 ${inside} · 뒤 음 ${after}`);
  ok(ERR.length === errs0, '멈칫: 오류');
  console.log(`  멈칫 0.5초(${st.id} 12초): 늦게 울린 음 ${late} · 건너뛴 칸은 조용히 · 뒤로 ${after}개 정상`);
  R.mu.close();
}

// 효과음 · 메트로놈 · 곡 시계 · 입력 시각 변환
{
  const mu = createMusic();
  mu.init();
  const ctx = FAC.last;
  await Promise.resolve();
  const names = ['rope', 'jump', 'both', 'hold', 'perfect', 'great', 'good', 'miss', 'trip', 'combo', 'combo30', 'fever', 'tech', 'count', 'count3', 'go', 'clear', 'fail', 'ui'];
  const errs0 = ERR.length;
  const made = {};
  for (const n of names) {
    LOG = [];
    ctx._adv(0.05);
    mu.hit(n, n === 'combo' ? { n: 50 } : n === 'count' ? { n: 2 } : {});
    made[n] = LOG.length;
    const lag = LOG.length ? Math.min(...LOG.map((x) => x.t - x.at)) : NaN;
    ok(LOG.length > 0, `효과음 ${n}: 소리 없음`);
    ok(lag >= 0 && lag <= 0.0021, `효과음 ${n}: 지연 ${fmt(lag * 1000, 1)}ms (즉시여야)`);
  }
  LOG = []; mu.hit('nope'); ok(LOG.length === 0, '모르는 효과음은 조용히');
  mu.setEnabled(false); LOG = []; mu.hit('jump'); ok(LOG.length === 0, '소리 끔이면 효과음 없음'); mu.setEnabled(true);
  await mu.pause(); LOG = []; mu.hit('ui'); mu.hit('jump'); ok(LOG.length === 0, '일시정지 중 효과음은 쌓이지 않는다(재개 때 한꺼번에 터짐 방지)'); await mu.resume();
  LOG = []; mu.hit('combo', { at: ctx.currentTime + 0.5 }); ok(LOG.length > 0 && LOG.every((x) => x.t >= ctx.currentTime + 0.5 - 1e-9), 'hit(name, { at }) 예약');
  ok(ERR.length === errs0, `효과음 오류 ${ERR.length - errs0}건 ${ERR.slice(errs0).join(' / ')}`);
  console.log('  효과음 노드 수: ' + Object.entries(made).map(([k, v]) => `${k}:${v}`).join(' '));
  // 메트로놈: 120bpm 8박 → T0 + i·0.5
  LOG = [];
  const T0 = mu.metronome(120, 8);
  const lows = LOG.filter((x) => x.f0 === 160).map((x) => x.t - T0);
  ok(lows.length === 8 && lows.every((t, i) => near(t, i * 0.5)), `메트로놈 8박 = T0 + i·0.5 (${lows.map((t) => fmt(t, 2)).join(',')})`);
  // 곡 시계 · 입력 시각
  ctx._adv(1.234);
  const st = mu.songTime();
  ok(near(st, ctx.currentTime - T0 - ctx.outputLatency), 'songTime = currentTime − T0 − outputLatency');
  const ev = mu.eventSongTime(clockNow - 100);
  ok(Math.abs(ev - (ctx.currentTime - 0.02 - T0 - 0.1)) < 1e-9, `eventSongTime(지금−100ms) = 들리던 시각 − 0.1 (${fmt(ev, 4)})`);
  ctx.getOutputTimestamp = () => ({ contextTime: 0, performanceTime: 0 }); // 값이 없는 브라우저 → 대체 식
  const ev2 = mu.eventSongTime(clockNow - 50);
  ok(Math.abs(ev2 - (st - 0.05)) < 1e-9, '대체 식 eventSongTime = songTime − 경과');
  // 노드가 새지 않는지: 곡 하나를 끝까지 돌리고 stop → 꼬리 끝나면 연결 수가 처음으로
  mu.stop();
  await new Promise((r) => setTimeout(r, 200));
  for (let i = 0; i < 300; i++) ctx._adv(0.02);
  const base = live;
  mu.prepare('cross');
  mu.start(0.5);
  let mid = 0;
  for (let i = 0; i < 3000; i++) { clockNow += 25; ctx._adv(0.025); if (tickFn) tickFn(); if (i === 1200) mid = live; }
  mu.stop();
  await new Promise((r) => setTimeout(r, 220));
  for (let i = 0; i < 300; i++) ctx._adv(0.02);
  ok(live <= base + 2, `노드 새는지: 시작 전 ${base} · 곡 중 ${mid} · 끝난 뒤 ${live}`);
  console.log(`  연결 노드: 시작 전 ${base} · 곡 중(30초째) ${mid} · stop 뒤 ${live}`);
  mu.close();
}

/* ---------------- 4) 진짜 브라우저 (선택) ---------------- */
if (args.includes('--browser')) {
  head('4) 진짜 크롬 — tools/_beat/music.html');
  const url = process.env.BEAT_URL || 'http://127.0.0.1:5401/tools/_beat/music.html';
  delete globalThis.window;
  Object.defineProperty(globalThis, 'performance', { value: (await import('node:perf_hooks')).performance, configurable: true, writable: true });
  globalThis.setInterval = (await import('node:timers')).setInterval;
  globalThis.clearInterval = (await import('node:timers')).clearInterval;
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required'] });
  const full = args.includes('--full');
  const ids = SONG_IDS;
  const run = async (id) => {
    const page = await browser.newPage();
    const errs = [];
    page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
    page.on('pageerror', (e) => errs.push(String(e)));
    // 마스터 출구에 애널라이저를 몰래 단다 + 소스 시작 시각 기록
    await page.addInitScript(() => {
      const oc = AudioNode.prototype.connect;
      window.__an = null; window.__starts = [];
      AudioNode.prototype.connect = function (d, ...r) {
        if (d instanceof AudioDestinationNode && this instanceof GainNode && !window.__an) {
          const an = this.context.createAnalyser(); an.fftSize = 2048; oc.call(this, an); window.__an = an;
        }
        return oc.call(this, d, ...r);
      };
      for (const C of [AudioScheduledSourceNode, AudioBufferSourceNode]) {
        const os = C.prototype.start;
        C.prototype.start = function (t, ...r) { window.__starts.push(t || 0); return os.call(this, t, ...r); };
      }
    });
    await page.goto(url);
    await page.waitForFunction(() => !!window.__music);
    const secs = full ? 0 : 9;
    const res = await page.evaluate(async ([id, secs]) => {
      const mu = window.__music;
      mu.init();
      window.__pick(id);
      await new Promise((r) => setTimeout(r, 100));
      const T0 = mu.start(0.6);
      const plan = window.__plan();
      const ctx = mu.ctx;
      const dur = secs || (plan.endless ? 70 : plan.duration + 2);
      const buf = new Float32Array(2048);
      let peak = 0, sum = 0, cnt = 0, silentMs = 0, run = 0;
      const t0 = performance.now();
      const st = [];
      let paused = null, resumedAt = 0;
      while (performance.now() - t0 < (dur + 0.6) * 1000) {
        await new Promise((r) => setTimeout(r, 30));
        if (!window.__an) continue;
        window.__an.getFloatTimeDomainData(buf);
        let p = 0, s2 = 0;
        for (let i = 0; i < buf.length; i++) { const v = Math.abs(buf[i]); if (v > p) p = v; s2 += v * v; }
        const songT = mu.songTime();
        if (songT > 0.2 && songT < plan.duration - 0.5) { run = p < 0.003 ? run + 30 : 0; if (run > silentMs) silentMs = run; sum += s2 / buf.length; cnt++; } // silentMs = 가장 긴 연속 무음
        if (p > peak) peak = p;
        st.push([performance.now() - t0, songT]);
        if (!paused && songT > 3 && songT < 3.2 && secs) { // 일시정지 시험 한 번
          await mu.pause(); const a = mu.songTime(); await new Promise((r) => setTimeout(r, 400)); const b = mu.songTime(); await mu.resume(); paused = [a, b]; resumedAt = performance.now() - t0;
        }
      }
      // 이벤트 시각 ↔ 곡 시각 차 (getOutputTimestamp 와 currentTime 식이 얼마나 다른가)
      const dEv = (mu.eventSongTime(performance.now()) - mu.songTime()) * 1000;
      // 시작된 소스 시각이 칸 위인지 (카운트 제외)
      const steps = plan.steps;
      const grid = new Set();
      for (let s = 0; s < steps.length; s++) grid.add((T0 + steps[s]).toFixed(6));
      const music = window.__starts.filter((t) => t >= T0 - 1e-6);
      const off = music.filter((t) => !grid.has(t.toFixed(6))).length;
      const sp = st.filter((x) => x[1] > 0.5 && x[0] > resumedAt + 50);
      const rate = sp.length > 2 ? (sp[sp.length - 1][1] - sp[0][1]) / ((sp[sp.length - 1][0] - sp[0][0]) / 1000) : 0;
      mu.stop();
      return { peak, rms: Math.sqrt(sum / Math.max(1, cnt)), silentMs, paused, dEv, off, n: music.length, rate, lat: [ctx.outputLatency, ctx.baseLatency], state: ctx.state, dur: plan.duration };
    }, [id, secs]);
    await page.close();
    return { id, errs, ...res };
  };
  const results = full ? await Promise.all(ids.map(run)) : [];
  if (!full) for (const id of ids) results.push(await run(id));
  for (const r of results) {
    ok(r.errs.length === 0, `${r.id}: 콘솔 오류 ${r.errs.length} ${r.errs.slice(0, 2).join(' / ')}`);
    ok(r.peak > 0.05 && r.peak < 0.99, `${r.id}: 피크 ${fmt(r.peak, 3)} (무음/클리핑)`);
    ok(r.silentMs < 250, `${r.id}: 곡 중 연속 무음 ${r.silentMs}ms`);
    ok(r.off === 0, `${r.id}: 칸 밖에서 시작된 소스 ${r.off}/${r.n}`);
    ok(Math.abs(r.rate - 1) < 0.02, `${r.id}: 곡 시계 속도 ${fmt(r.rate, 4)}`);
    if (r.paused) ok(Math.abs(r.paused[1] - r.paused[0]) < 0.03, `${r.id}: 일시정지 중 곡 시계 ${fmt(r.paused[0], 3)} → ${fmt(r.paused[1], 3)}`);
    console.log(`  ${r.id.padEnd(9)} 피크 ${fmt(r.peak, 3)} · RMS ${fmt(r.rms, 3)} · 최장 무음 ${r.silentMs}ms · 소스 ${r.n}개 칸 밖 ${r.off} · 시계 ×${fmt(r.rate, 4)} · 정지 ${r.paused ? fmt(r.paused[0], 3) + '→' + fmt(r.paused[1], 3) : '-'} · ev−song ${fmt(r.dEv, 1)}ms · 지연 ${fmt(r.lat[0] * 1000, 1)}/${fmt((r.lat[1] || 0) * 1000, 1)}ms · 오류 ${r.errs.length}`);
  }
  await browser.close();
}

/* ---------------- 5) 오프라인 렌더링 (선택) — 진짜 크롬 OfflineAudioContext ----------------
 * createMusic 을 그대로 쓴다: AudioContext 자리에 OfflineAudioContext(«돌고 있음» 으로 보이게 감싼 것)를 넣고,
 * 0.04초마다 렌더링을 멈춰 곡의 예약(tick)을 한 번씩 돌린다 → 게임에서와 똑같은 예약 · 똑같은 소리.
 * 잰다: 피크(클리핑) · RMS(곡 크기) · 곡 중 최장 무음 · 킥 예약 시각 = T0 + steps[박] · 모든 소스가 칸 위 ·
 *       실제 소리에서 박마다 «쿵» 이 시작되는 시각(120Hz 아래 포락선) − 박 시각. */
if (args.includes('--render')) {
  head('5) 오프라인 렌더링 (크롬 OfflineAudioContext) — 고르기 4곡 × BPM 100 · 150 · 200 + 기존 6곡');
  delete globalThis.window;
  Object.defineProperty(globalThis, 'performance', { value: (await import('node:perf_hooks')).performance, configurable: true, writable: true });
  globalThis.setInterval = (await import('node:timers')).setInterval;
  globalThis.clearInterval = (await import('node:timers')).clearInterval;
  const fs = await import('node:fs/promises');
  const path = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const wi = args.indexOf('--wav');
  const wavDir = wi >= 0 ? args[wi + 1] : null;
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  // 저장소 파일을 그대로 내준다(서버 없이) — /__render 는 빈 페이지
  await page.route('http://beat.test/**', async (route) => {
    const p = decodeURIComponent(new URL(route.request().url()).pathname);
    if (p === '/__render') return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><meta charset="utf-8"><link rel="icon" href="data:,"><title>render</title>' });
    const file = path.join(root, p);
    if (!file.startsWith(root)) return route.fulfill({ status: 403, body: '' });
    try { await route.fulfill({ status: 200, body: await fs.readFile(file), contentType: /\.m?js$/.test(p) ? 'text/javascript' : 'application/octet-stream' }); } catch { await route.fulfill({ status: 404, body: '' }); }
  });
  await page.goto('http://beat.test/__render');
  const render = (job) => page.evaluate(async ({ id, tempo, bars, renderBars, sr, wav }) => {
    const M = await import('/src/games/jumprope/beat/music.js');
    const T = await import('/src/games/jumprope/beat/timing.js');
    if (!window.__patched) { // 소스 시작 기록 — 첫 setValueAtTime 값(주파수)으로 킥을 알아본다
      window.__patched = true;
      const sv = AudioParam.prototype.setValueAtTime;
      AudioParam.prototype.setValueAtTime = function (v, t) { if (this.__v0 === undefined) this.__v0 = v; return sv.call(this, v, t); };
      for (const C of [OscillatorNode, AudioBufferSourceNode]) {
        const st = C.prototype.start;
        C.prototype.start = function (t, ...r) { if (window.__log) window.__log.push([t || 0, this instanceof OscillatorNode ? this.type : 'buf', this.frequency ? this.frequency.__v0 : null]); return st.call(this, t, ...r); };
      }
    }
    const plan = M.planSong(id, { tempo, bars });
    const T0want = Math.max(0.6, 4 * (60 / T.bpmAt(plan.tempo, 0)) + 0.05);
    const tEnd = T.timeAtStep(plan.steps, renderBars * 16);
    const total = T0want + tEnd + (plan.endless ? 0.3 : 2.5);
    const off = new OfflineAudioContext(2, Math.ceil(total * sr), sr);
    const proxy = new Proxy(off, {
      get(tg, k) {
        if (k === 'state') return 'running';
        if (k === 'resume' || k === 'suspend' || k === 'close') return () => Promise.resolve();
        const v = Reflect.get(tg, k);
        return typeof v === 'function' ? v.bind(tg) : v;
      },
    });
    const keep = [window.AudioContext, window.setInterval, window.clearInterval];
    let tick = null;
    window.AudioContext = function () { return proxy; };
    window.setInterval = (fn) => { tick = fn; return 1; };
    window.clearInterval = () => {};
    const mu = M.createMusic();
    mu.init();
    mu.prepare(id, { tempo, bars });
    window.__log = [];
    const T0 = mu.start(0.6);
    [window.AudioContext, window.setInterval, window.clearInterval] = keep;
    for (let t = 0.04; t < total - 0.02; t += 0.04) off.suspend(t).then(() => { if (tick) tick(); off.resume(); });
    const buf = await off.startRendering();
    const log = window.__log; window.__log = null;
    tick = null;
    const L = buf.getChannelData(0), R = buf.getChannelData(1), N = L.length;
    const i0 = Math.floor(T0 * sr), i1 = Math.min(N, Math.floor((T0 + tEnd) * sr));
    let peak = 0, clip = 0, sum = 0;
    for (let i = 0; i < N; i++) { const a = Math.max(Math.abs(L[i]), Math.abs(R[i])); if (a > peak) peak = a; if (a >= 0.999) clip++; }
    for (let i = i0; i < i1; i++) { const m = (L[i] + R[i]) * 0.5; sum += m * m; }
    const blk = Math.floor(sr * 0.005);
    let run = 0, longest = 0, longestAt = 0;
    for (let i = i0; i < i1; i += blk) { let p = 0; for (let j = i; j < Math.min(i1, i + blk); j++) p = Math.max(p, Math.abs(L[j]), Math.abs(R[j])); run = p < 0.003 ? run + 5 : 0; if (run > longest) { longest = run; longestAt = T.stepAtTime(plan.steps, i / sr - T0) / 16; } }
    // 킥 예약: sine 150Hz 로 시작한 소스 = 킥
    const beats = [];
    for (let s = 0; s < renderBars * 16; s += 4) beats.push(T0 + T.timeAtStep(plan.steps, s));
    const kicks = log.filter((x) => x[1] === 'sine' && x[2] === 150 && x[0] < T0 + tEnd - 1e-6).map((x) => x[0]).sort((a, b) => a - b);
    let kickBad = kicks.length === beats.length ? 0 : Math.abs(kicks.length - beats.length);
    if (!kickBad) for (let i = 0; i < beats.length; i++) if (Math.abs(kicks[i] - beats[i]) > 1e-9) kickBad++;
    // 모든 곡 소스가 칸 위 (리드인 카운트 제외)
    const grid = new Set();
    for (let s = 0; s <= renderBars * 16 + 64; s++) grid.add((T0 + T.timeAtStep(plan.steps, s)).toFixed(6));
    const music = log.filter((x) => x[0] >= T0 - 1e-6);
    const offGrid = music.filter((x) => !grid.has(x[0].toFixed(6))).length;
    // 실제 소리: 120Hz 2단 저역 → 순간 포락선, 박마다 «쿵» 이 50% 솟은 시각. 이 측정 자체의 늦음(저역 필터 ·
    // 사인 스윕)은 킥 하나만 따로 렌더링한 기준값으로 잰다 → 곡 안의 킥이 기준과 같은 때 솟으면 박 위에 있는 것
    const lowEnv = (chs, n) => {
      const a = 1 - Math.exp(-2 * Math.PI * 120 / sr), rel = Math.exp(-1 / (0.02 * sr)), env = new Float32Array(n);
      let y1 = 0, y2 = 0, e = 0;
      for (let i = 0; i < n; i++) { let x = 0; for (const c of chs) x += c[i]; x /= chs.length; y1 += a * (x - y1); y2 += a * (y1 - y2); const v = Math.abs(y2); e = v > e ? v : e * rel; env[i] = e; }
      return env;
    };
    const onset = (env, tb) => {
      const ib = Math.round(tb * sr), n = env.length;
      const base = env[Math.max(0, ib - Math.round(0.002 * sr))];
      let pk = 0;
      for (let i = ib; i < Math.min(n, ib + Math.round(0.03 * sr)); i++) pk = Math.max(pk, env[i]);
      if (pk < base * 1.5 || pk < 0.01) return null;
      const th = base + 0.5 * (pk - base);
      let io = ib - Math.round(0.02 * sr);
      while (io < ib + Math.round(0.03 * sr) && env[io] < th) io++;
      return { err: (io / sr - tb) * 1000, pk, base };
    };
    if (window.__refErr == null) { // 킥만: music.js 의 킥과 같은 조리법(150→44Hz 사인 + 딸깍) → 같은 컴프레서(앞보기 지연 포함) → 출구
      const rc = new OfflineAudioContext(1, sr * 3, sr), v = 0.5;
      const cp = rc.createDynamicsCompressor();
      cp.threshold.value = -10; cp.knee.value = 8; cp.ratio.value = 6; cp.attack.value = 0.002; cp.release.value = 0.14;
      cp.connect(rc.destination);
      for (let k = 0; k < 4; k++) {
        const t = 0.5 + k * 0.5;
        const o = rc.createOscillator(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(44, t + 0.11);
        const g = rc.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.002); g.gain.setValueAtTime(v, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
        o.connect(g); g.connect(cp); o.start(t); o.stop(t + 0.27);
        const c = rc.createOscillator(); c.type = 'triangle'; c.frequency.setValueAtTime(1100, t); c.frequency.exponentialRampToValueAtTime(380, t + 0.016);
        const cg = rc.createGain(); cg.gain.setValueAtTime(0.0001, t); cg.gain.exponentialRampToValueAtTime(v * 0.16, t + 0.0006); cg.gain.exponentialRampToValueAtTime(0.0001, t + 0.016);
        c.connect(cg); cg.connect(cp); c.start(t); c.stop(t + 0.05);
      }
      const rb = await rc.startRendering(), renv = lowEnv([rb.getChannelData(0)], rb.length);
      const rs = [0, 1, 2, 3].map((k) => onset(renv, 0.5 + k * 0.5).err);
      window.__refErr = rs.reduce((x, y) => x + y, 0) / rs.length;
    }
    const env = lowEnv([L, R], N);
    const errsMs = [], ratios = [], weakAt = [];
    let weak = 0;
    const timeOf = (s) => T0 + T.timeAtStep(plan.steps, s);
    for (let k = 0; k < beats.length; k++) {
      const tb = beats[k], o = onset(env, tb);
      if (!o) { // 인트로 킥은 일부러 여리게(0.45) — 이어지는 베이스 밑에 묻힐 수 있어 따로 센다(알림만)
        if (M.barInfo(plan, Math.floor(k / 4)).kind === 'intro') weakAt.push(`인트로 ${Math.floor(k / 4)}.${k % 4}`);
        else { weak++; weakAt.push(`${Math.floor(k / 4)}.${k % 4}`); }
        continue;
      }
      const { pk, base } = o;
      errsMs.push(o.err - window.__refErr);
      // 같은 박의 엇박(+2칸) 낮은 대역 솟음과 비교 — «쿵» 이 박에 몰려 있는지
      const io2 = Math.round(timeOf(k * 4 + 2) * sr);
      let pk2 = 0;
      for (let i = io2; i < Math.min(N, io2 + Math.round(0.06 * sr)); i++) pk2 = Math.max(pk2, env[i] - env[io2]);
      ratios.push((pk - base) / Math.max(1e-4, pk2));
    }
    const med = (arr) => { const b = [...arr].sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : NaN; };
    let pcm = null;
    if (wav) { // 16비트 스테레오
      const n = Math.min(N, Math.ceil((T0 + tEnd + 1) * sr)), u = new Int16Array(n * 2);
      for (let i = 0; i < n; i++) { u[2 * i] = Math.max(-32767, Math.min(32767, L[i] * 32767)); u[2 * i + 1] = Math.max(-32767, Math.min(32767, R[i] * 32767)); }
      const by = new Uint8Array(u.buffer);
      let str = '';
      for (let i = 0; i < by.length; i += 0x8000) str += String.fromCharCode.apply(null, by.subarray(i, i + 0x8000));
      pcm = btoa(str);
    }
    mu.close();
    return {
      T0, sec: tEnd, peak, clip, rms: Math.sqrt(sum / Math.max(1, i1 - i0)), longest, longestAt, refErr: window.__refErr, kicks: kicks.length, beats: beats.length, kickBad,
      sources: music.length, offGrid, weak, errMed: med(errsMs), errMax: errsMs.length ? Math.max(...errsMs.map(Math.abs)) : NaN,
      ratioMed: med(ratios), endless: plan.endless, pcm, weakAt,
    };
  }, job);
  const writeWav = async (file, b64, sr) => {
    const data = Buffer.from(b64, 'base64');
    const h = Buffer.alloc(44);
    h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8); h.write('fmt ', 12);
    h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(2, 22); h.writeUInt32LE(sr, 24); h.writeUInt32LE(sr * 4, 28);
    h.writeUInt16LE(4, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(data.length, 40);
    await fs.mkdir(wavDir, { recursive: true });
    await fs.writeFile(path.join(wavDir, file), Buffer.concat([h, data]));
  };
  const SR = 44100;
  const jobs = [];
  for (const id of NEW_SONGS) for (const bpm of [100, 150, 200]) jobs.push({ id, label: `${id}@${bpm}`, tempo: fixed(bpm), bars: 400, renderBars: 34, sr: SR, wav: !!wavDir && bpm === 150 });
  for (const st of STAGES) jobs.push({ id: st.id, label: st.id, tempo: st.tempo, bars: st.bars, renderBars: st.bars, sr: SR, wav: false });
  jobs.push({ id: 'endless', label: 'endless', tempo: ENDLESS.tempoUntil(400), bars: 400, renderBars: 34, sr: SR, wav: false });
  // 기존 6곡도 «아무 템포»(고정 150 · 400마디 → 바퀴 편곡)로 — 곡 고르기에서 무한 · 서바이벌에 골라도 되는지
  for (const id of [...STAGES.map((x) => x.id), 'endless']) jobs.push({ id, label: `${id}@150`, tempo: fixed(150), bars: 400, renderBars: 34, sr: SR, wav: !!wavDir });
  const res = [];
  for (const j of jobs) {
    const t0 = Date.now();
    const r = await render(j);
    res.push({ ...j, ...r, pcm: null });
    if (r.pcm) await writeWav(`${j.label}.wav`, r.pcm, SR);
    const isNew = NEW_SONGS.includes(j.id);
    ok(r.peak > 0.05 && r.clip === 0 && r.peak < 0.99, `${j.label}: 피크 ${fmt(r.peak, 3)} · 클리핑 ${r.clip}표본 (무음/찢어짐)`);
    ok(r.longest < 250, `${j.label}: 곡 중 연속 무음 ${r.longest}ms`);
    ok(r.kickBad === 0, `${j.label}: 킥 예약 ${r.kicks}/${r.beats}박 · 어긋남 ${r.kickBad}`);
    ok(r.offGrid === 0, `${j.label}: 칸 밖에서 시작된 소스 ${r.offGrid}/${r.sources}`);
    ok(r.weak === 0 && Math.abs(r.errMed) < 1.5, `${j.label}: 실제 소리의 «쿵» — 약한 박 ${r.weak} · 킥만 기준과 차 중앙 ${fmt(r.errMed, 2)}ms`);
    console.log(`  ${j.label.padEnd(13)} ${fmt(r.sec, 1).padStart(5)}초 · 피크 ${fmt(r.peak, 3)} · RMS ${fmt(r.rms, 3)} · 최장 무음 ${r.longest}ms(${fmt(r.longestAt, 1)}마디) · 킥 ${r.kicks}/${r.beats}(어긋남 ${r.kickBad}) · 소스 ${r.sources}(칸 밖 ${r.offGrid}) · 쿵 솟음−기준 중앙 ${fmt(r.errMed, 2)}ms 최대 ${fmt(r.errMax, 1)}ms · 박/엇박 저음 ×${fmt(r.ratioMed, 1)} · 약한 박 ${r.weak}${r.weakAt.length ? '(' + r.weakAt.slice(0, 4).join(' ') + ' 마디.박)' : ''} · ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  }
  // 곡 크기: 고르기 곡(150BPM) RMS 가 기존 6곡 RMS 범위 ±20% 안
  const old = res.filter((r) => !NEW_SONGS.includes(r.id) && !r.label.includes('@')).map((r) => r.rms);
  const lo = Math.min(...old), hi = Math.max(...old);
  for (const id of NEW_SONGS) {
    const r = res.find((x) => x.label === `${id}@150`);
    ok(r.rms >= lo * 0.8 && r.rms <= hi * 1.2, `${id}: 곡 크기 RMS ${fmt(r.rms, 3)} — 기존 ${fmt(lo, 3)}~${fmt(hi, 3)} 에서 벗어남`);
  }
  console.log(`  측정 기준(킥만 · 같은 컴프레서로 렌더링): 쿵 50% 솟음 = 박 + ${fmt(res[0].refErr, 2)}ms (저역 필터 · 사인 스윕 · 컴프레서 앞보기 늦음 — 10곡 모두 같다)`);
  console.log(`  곡 크기(RMS): 기존 6곡 ${fmt(lo, 3)}~${fmt(hi, 3)} · 고르기 곡@150 ${NEW_SONGS.map((id) => `${id} ${fmt(res.find((x) => x.label === `${id}@150`).rms, 3)}`).join(' · ')}`);
  ok(errs.length === 0, `렌더링 페이지 오류 ${errs.length}: ${errs.slice(0, 2).join(' / ')}`);
  if (wavDir) console.log(`  wav 저장: ${wavDir} (${NEW_SONGS.map((id) => id + '@150.wav').join(', ')})`);
  await browser.close();
}

console.log(fails ? `\n✗ 실패 ${fails}건` : '\n✓ 전부 통과');
process.exit(fails ? 1 : 0);
