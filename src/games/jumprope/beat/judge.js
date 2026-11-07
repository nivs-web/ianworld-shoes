/**
 * 줄넘기 챔피언 · ROPE BEAT — 판정 · 점수 · 콤보 · 체력 · 등급 · 별 (2026-11-07, 리듬 디자이너)
 *
 * 기획서 §4 · §5 그대로. 시간은 전부 «곡 시각(초)» — 본체(rhythm.js)가 입력 시각을 곡 시각으로 바꿔 넘긴다.
 * 순수 계산만(화면·소리 모름). 결과 객체를 돌려주면 본체가 그걸로 효과를 낸다.
 *
 *   press(lane, t)   lane 'L'(ROPE) | 'R'(JUMP). 그 레인(B 노트는 두 레인 모두)의 아직 안 친 가장 이른 노트가
 *                    |Δ| ≤ GOOD 창이면 판정, 아니면 null(빈 손 — 벌점 없음).
 *   release(lane, t) 꾹 노트를 떼었다. 끝(endT − GOOD 창) 전이면 BREAK.
 *   update(t)        창이 지난 노트 자동 MISS · 꾹 노트 완료. 곡이 끝나면 update(chart.duration + 0.2) 한 번.
 * 노트 객체에 note.done = true(판정 끝) · note.holding = true(꾹 누르는 중)를 적는다 — 화면이 지울 때 쓴다.
 * state 는 살아 있는 객체 하나 — 본체가 «하트 하나 더»로 state.alive = true; state.hp = 50 을 직접 고쳐도 된다.
 */
import { DIFFS } from './stages.js';
import { bpmAt, stepAtTime, STEPS_PER_BAR } from './timing.js';

export const POINTS = { perfect: 100, great: 70, good: 40 };
/** 콤보 배율 (§5) — 높은 것부터 */
export const COMBO_MULT = [
  { from: 100, x: 3.0 },
  { from: 50, x: 2.0 },
  { from: 20, x: 1.5 },
  { from: 10, x: 1.2 },
  { from: 0, x: 1.0 },
];
export function comboMult(combo) {
  for (const r of COMBO_MULT) if (combo >= r.from) return r.x;
  return 1;
}
/** 체력 (§5 · §8). MISS 피해는 × 난이도 dmg(무한의 ROPE MISS 34 는 그대로) */
/* endlessTrip: 무한에서 줄에 걸렸을 때 — 두 버튼(하드)은 100(바로 끝), JUMP 하나 모드는 본체가 25 로 낮춘다(네 번까지) */
export const HP = { max: 100, perfect: 1.5, great: 0.7, good: 0, ropeMiss: 6, jumpMiss: 14, endlessRopeMiss: 34, endlessTrip: 100 };
export const FEVER_AT = 50, LEGEND_AT = 100;
export const TECH_BONUS = 50;                                          // × 기술 레벨
export const RANKS = [['S', 95], ['A', 90], ['B', 80], ['C', 70], ['D', 0]];
export const rankFor = (acc) => RANKS.find(([, a]) => acc >= a)[0];
const WORSE = { perfect: 0, great: 1, good: 2 };

/**
 * @param chart buildChart 결과
 * @param diff  'easy' | 'normal' | 'hard' — 판정 창 · 피해 배율
 * @param opts  { endless = chart.kind === 'endless', hp: HP 일부 덮어쓰기(조율용), winScale: 판정 창 배율 }
 */
export function createJudge(chart, diff = 'normal', opts = {}) {
  const D = DIFFS[diff] || DIFFS.normal;
  /* opts.winScale — JUMP 하나 모드는 판정 창을 넓힌다(권반장 «너무 어려워») */
  const ws = Math.max(0.5, Math.min(2, +opts.winScale || 1));
  const W = { perfect: D.win.perfect * ws, great: D.win.great * ws, good: D.win.good * ws }, GOOD = W.good;
  const endless = opts.endless ?? chart.kind === 'endless';
  const hpT = { ...HP, ...(opts.hp || {}) };
  const notes = chart.notes, N = notes.length;
  for (const n of notes) { n.done = false; n.holding = false; }        // 같은 채보로 다시 하기
  // 노트별 판정 상태 — res: 0 아직 · 1 성공(끝) · 2 MISS · 3 꾹 누르는 중
  const S = notes.map(() => ({ res: 0, pL: null, pR: null, grade: null, add: 0, heal: 0 }));
  const lane = { L: [], R: [] };
  for (const n of notes) { if (n.lane !== 'R') lane.L.push(n.id); if (n.lane !== 'L') lane.R.push(n.id); }
  const ptr = { L: 0, R: 0 };
  const active = { L: -1, R: -1 };                                     // 꾹 누르는 중인 노트 번호
  let missPtr = 0, resolved = 0;
  const techLeft = chart.techs.map((x) => x.noteIds.length), techFail = chart.techs.map(() => false);

  const state = {
    score: 0, combo: 0, maxCombo: 0, hp: hpT.max, perfect: 0, great: 0, good: 0, miss: 0, accuracy: 100,
    fever: false, legend: false, alive: true, techCleared: 0, techTotal: chart.techs.length,
    breaks: 0, trips: 0, jumps: 0, finished: N === 0, lastT: 0,
  };

  const gradeOf = (d) => { const a = Math.abs(d); return a <= W.perfect ? 'perfect' : a <= W.great ? 'great' : 'good'; };
  const doneFor = (id, l) => { const s = S[id]; return s.res !== 0 || (notes[id].lane === 'B' && (l === 'L' ? s.pL : s.pR)); };
  const judgedCount = () => state.perfect + state.great + state.good + state.miss;
  function updAcc() {
    const c = judgedCount();
    state.accuracy = c ? (state.perfect * 100 + state.great * 70 + state.good * 40) / c : 100;
  }
  function feverCheck(r) {
    const f = state.combo >= FEVER_AT, l = state.combo >= LEGEND_AT;
    if (f && !state.fever) r.feverStart = true;
    if (l && !state.legend) r.legendStart = true;
    state.fever = f; state.legend = l;
  }
  function comboBreak() { state.combo = 0; state.fever = false; state.legend = false; }
  /** trip = 줄에 걸림(JUMP 를 놓침). 무한은 걸리면 바로 끝 */
  function damage(trip) {
    if (trip) state.trips++;
    if (endless) state.hp -= trip ? hpT.endlessTrip : hpT.endlessRopeMiss;
    else state.hp -= (trip ? hpT.jumpMiss : hpT.ropeMiss) * D.dmg;
    if (state.hp <= 0) { state.hp = 0; state.alive = false; }
  }
  /** 노트 하나 끝 — 기술 인스턴스 정산(그 기술 노트가 MISS 없이 다 끝나면 보너스) */
  function finish(n, ok, r, t) {
    const s = S[n.id];
    s.res = ok ? 1 : 2;
    n.done = true; n.holding = false;
    resolved++;
    state.lastT = Math.max(state.lastT, t);
    if (ok && n.lane !== 'L') state.jumps++;
    if (n.tech >= 0) {
      if (!ok) techFail[n.tech] = true;
      if (--techLeft[n.tech] === 0 && !techFail[n.tech]) {
        const x = chart.techs[n.tech], bonus = x.level * TECH_BONUS;
        state.techCleared++;
        state.score += bonus;
        r.scoreAdd += bonus;
        r.techClear = { i: x.i, id: x.id, name: x.name, en: x.en, bonus };
      }
    }
    if (resolved === N) state.finished = true;
    updAcc();
  }
  function applyHit(n, g, d, l, t) {
    const s = S[n.id];
    if (g === 'perfect') { state.combo++; state.perfect++; } else state[g]++;
    if (state.combo > state.maxCombo) state.maxCombo = state.combo;
    const add = Math.round(POINTS[g] * comboMult(state.combo));
    state.score += add;
    const before = state.hp;
    state.hp = Math.min(hpT.max, state.hp + hpT[g]);
    s.grade = g; s.add = add; s.heal = state.hp - before;
    const r = { kind: 'hit', note: n, lane: l, grade: g, delta: d, scoreAdd: add, combo: state.combo };
    feverCheck(r);
    if (n.kind === 'hold') {
      s.res = 3; n.holding = true; active[n.lane] = n.id; r.hold = true;
      state.lastT = Math.max(state.lastT, t);
      updAcc();
    } else finish(n, true, r, t);
    return r;
  }
  function applyMiss(n, t) {
    const s = S[n.id];
    state.miss++;
    comboBreak();
    const trip = n.lane === 'R' || (n.lane === 'B' && !s.pR);           // B 는 R 이 빠졌으면 줄에 걸림
    damage(trip);
    const r = { kind: 'miss', note: n, lane: n.lane, grade: 'miss', delta: null, scoreAdd: 0, combo: 0, trip };
    finish(n, false, r, n.t);
    return r;
  }
  function holdOk(n, t) {
    const s = S[n.id];
    active[n.lane] = -1;
    const r = { kind: 'hold_ok', note: n, lane: n.lane, grade: s.grade, delta: t - n.endT, scoreAdd: 0, combo: state.combo };
    finish(n, true, r, t);
    return r;
  }

  /* 빈 손 (2026-11-07 대표님 «막 누르면 콤보가 올라가는 버그»): 노트가 없는 곳을 누르면 콤보가 끊긴다.
     노트 바로 앞(판정 창의 2배 안)은 조금 일찍 누른 것으로 보고 봐준다 — 연타하면 그 밖의 누름이 끊는다 */
  function emptyPress(l) {
    if (state.combo > 0) comboBreak();
    state.empty = (state.empty | 0) + 1;
    return { kind: 'empty', lane: l, grade: null, scoreAdd: 0, combo: 0 };
  }
  function press(l, t) {
    if (!state.alive || (l !== 'L' && l !== 'R') || active[l] >= 0) return null;  // 꾹 누르는 중인 버튼은 또 못 누른다
    const list = lane[l];
    while (ptr[l] < list.length && doneFor(list[ptr[l]], l)) ptr[l]++;
    for (let j = ptr[l]; j < list.length; j++) {
      const id = list[j];
      if (doneFor(id, l)) continue;
      const n = notes[id], d = t - n.t;
      if (d > GOOD) continue;                                          // 이미 지난 노트 — update 가 MISS 로 센다
      if (d < -GOOD) return d < -GOOD * 2 ? emptyPress(l) : null;     // 가장 이른 노트도 아직 멀다 = 빈 손(바로 앞이면 봐준다)
      const g = gradeOf(d);
      if (n.lane !== 'B') return applyHit(n, g, d, l, t);
      const s = S[id];
      if (l === 'L') s.pL = { d, g }; else s.pR = { d, g };
      if (!(s.pL && s.pR)) return { kind: 'half', note: n, lane: l, grade: null, delta: d, scoreAdd: 0, combo: state.combo };
      const w = WORSE[s.pL.g] >= WORSE[s.pR.g] ? s.pL : s.pR;            // 둘 중 나쁜 등급
      return applyHit(n, w.g, w.d, 'B', t);
    }
    return emptyPress(l);                                              // 남은 노트가 없다
  }

  function release(l, t) {
    const id = active[l];
    if (id < 0 || !state.alive) return null;
    const n = notes[id], s = S[id];
    if (t >= n.endT - GOOD) return holdOk(n, t);
    // BREAK — 그 노트를 MISS 로 바꿔 센다(점수 · 회복도 되돌림). JUMP 꾹 = 줄에 걸림, ROPE 꾹(릴리스) = ROPE MISS 피해
    active[l] = -1;
    state[s.grade]--; state.miss++; state.breaks++;
    state.score -= s.add;
    state.hp -= s.heal;
    comboBreak();
    const trip = n.lane === 'R';
    damage(trip);
    const r = { kind: 'break', note: n, lane: l, grade: 'miss', delta: t - n.endT, scoreAdd: -s.add, combo: 0, trip };
    finish(n, false, r, t);
    return r;
  }

  function update(t) {
    if (!state.alive) return [];
    const out = [];
    for (const l of ['L', 'R']) {
      const id = active[l];
      if (id >= 0 && t >= notes[id].endT - GOOD) out.push(holdOk(notes[id], t));
    }
    while (missPtr < N && notes[missPtr].t + GOOD < t) {
      const n = notes[missPtr];
      missPtr++;
      if (S[n.id].res === 0) { out.push(applyMiss(n, t)); if (!state.alive) break; }
    }
    return out;
  }

  function result() {
    const step = stepAtTime(chart.steps, state.lastT);
    return {
      score: state.score, perfect: state.perfect, great: state.great, good: state.good, miss: state.miss,
      maxCombo: state.maxCombo, accuracy: Math.round(state.accuracy * 100) / 100, rank: rankFor(state.accuracy),
      techCleared: state.techCleared, techTotal: chart.techs.length,
      cleared: state.alive && state.finished, hp: state.hp, total: N, judged: judgedCount(),
      breaks: state.breaks, trips: state.trips, jumps: state.jumps, endless,
      bpm: Math.round(bpmAt(chart.tempo, step / STEPS_PER_BAR)), lastT: state.lastT, goalScale: chart.goalScale ?? 1,
    };
  }

  /** 화면용: 노트 상태 'pending' | 'half' | 'holding' | 'hit' | 'miss' */
  function noteStatus(id) {
    const s = S[id];
    if (!s) return null;
    return s.res === 1 ? 'hit' : s.res === 2 ? 'miss' : s.res === 3 ? 'holding' : s.pL || s.pR ? 'half' : 'pending';
  }

  return { press, release, update, result, noteStatus, state, windows: W, endless };
}

/* ---------- 별 ---------- */
/**
 * ★★★ 목표(최대 콤보 · PERFECT 수)를 그 채보에서 달성할 만한 값으로 조정한다.
 *   규칙: 목표 × scale. scale = 그 채보 노트 수 ÷ 같은 대회 «보통» 노트 수(1 을 넘지 않음 — 어려움은 그대로, 쉬움만 낮춘다).
 *         chart.goalScale(= judge.result().goalScale)로 넘어온다. 없으면 쉬움 0.7 · 보통/어려움 1.
 *   그리고 노트 수의 80% 를 넘지 않게(아주 짧은 내 스테이지 등), 최소 5.
 */
const DIFF_SCALE = { easy: 0.7, normal: 1, hard: 1 };
export function goalsFor(goals, diff = 'normal', scale, total) {
  if (!goals) return null;
  const k = Math.min(1, Math.max(0.3, scale ?? DIFF_SCALE[diff] ?? 1));
  const cap = total ? Math.max(5, Math.floor(total * 0.8)) : Infinity;
  const f = (v) => Math.max(5, Math.min(cap, Math.round(v * k)));
  return { combo: f(goals.combo), perfect: f(goals.perfect) };
}
/** 0~3. ★ 완주 · ★★ 정확도 85%+ · ★★★ 거기에 조정된 목표(최대 콤보 · PERFECT) 달성. 목표가 없으면(무한 · 내 스테이지) S 등급 */
export function starsFor(result, goals, diff = 'normal') {
  if (!result?.cleared) return 0;
  if (!(result.accuracy >= 85)) return 1;
  if (!goals) return result.accuracy >= 95 ? 3 : 2;
  const g = goalsFor(goals, diff, result.goalScale, result.total);
  return result.maxCombo >= g.combo && result.perfect >= g.perfect ? 3 : 2;
}
