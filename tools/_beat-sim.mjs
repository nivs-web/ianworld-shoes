/**
 * ROPE BEAT 채보 · 판정 시험 (화면 없이 node 로). `node tools/_beat-sim.mjs` — 실패가 하나라도 있으면 exit 1.
 *
 *  1) 5대회 × 3난이도 채보 표: 곡 길이 · 노트 수 · 초당 노트(평균·최대) · 레인별 최소 간격 · 규칙(칸 위 · 꾹 겹침 · B 앞뒤 · 16분 연타)
 *  2) 완벽 자동 연주 → 전부 PERFECT · MISS 0 · combo = PERFECT 수 · 별 3 · S
 *  3) 흔들기(±30ms · ±70ms) 등급 분포
 *  4) ROPE 안 누르기 → ROPE MISS 로 체력이 줄고 탈락하나 · 꾹 일찍 떼기 → BREAK · 무한 JUMP 한 번 놓치면 끝
 *  5) 줄 각도 키 단조 증가 · 같은 seed 같은 채보 · 내 스테이지 조각 변환
 */
import { buildChart, ropeAngleAt, TECHS, ROUTINES, parseRoutine, runBeats, FAST_BPM } from '../src/games/jumprope/beat/chart.js';
import { createJudge, starsFor, goalsFor, comboMult } from '../src/games/jumprope/beat/judge.js';
import { STAGES, DIFFS } from '../src/games/jumprope/beat/stages.js';
import { bpmAt } from '../src/games/jumprope/beat/timing.js';
import { STAGES as OLD_STAGES } from '../src/games/jumprope/data.js';
import { seeded } from '../src/games/jumprope/engine.js';

let fails = 0;
const warns = [];
const ok = (cond, msg) => { if (!cond) { fails++; console.log('  ✗', msg); } return cond; };
const DK = ['easy', 'normal', 'hard'];
const f1 = (v) => (Math.round(v * 10) / 10).toFixed(1);
const pad = (s, n) => String(s).padEnd(n);
const lpad = (s, n) => String(s).padStart(n);
const bpmStep = (chart, s) => bpmAt(chart.tempo, (s + 0.5) / 16);
const lanesOf = (n) => (n.lane === 'B' ? ['L', 'R'] : [n.lane]);

/** 채보 규칙 검사 + 통계 */
function inspect(chart) {
  const N = chart.notes, st = chart.steps;
  const v = { offGrid: 0, odd: 0, holdClash: 0, bClash: 0, fast16: 0, easyHold: 0, sameStep: 0 };
  const byLane = { L: [], R: [] };
  for (const n of N) {
    if (!Number.isInteger(n.step) || n.t !== st[n.step]) v.offGrid++;
    if (n.kind === 'hold' && (!Number.isInteger(n.endStep) || Math.abs(n.endT - st[n.endStep]) > 1e-9)) v.offGrid++;
    if (chart.diff !== 'hard' && n.step % 2) v.odd++;
    if (chart.diff === 'easy' && (n.kind === 'hold' || n.lane === 'B')) v.easyHold++;
    for (const l of lanesOf(n)) byLane[l].push(n);
  }
  for (let i = 1; i < N.length; i++) if (N[i].step === N[i - 1].step) v.sameStep++;
  // B 앞뒤 1칸
  for (const n of N) if (n.lane === 'B') for (const m of N) if (m !== n && Math.abs(m.step - n.step) <= 1) v.bClash++;
  const minGap = { L: 9, R: 9 }, minRel = { L: 9, R: 9 };
  for (const l of ['L', 'R']) {
    const a = byLane[l];
    for (let i = 1; i < a.length; i++) {
      const p = a[i - 1], c = a[i];
      if (p.kind === 'hold') {
        if (c.step <= p.endStep) v.holdClash++;
        minRel[l] = Math.min(minRel[l], c.t - p.endT);
      }
      const gap = c.t - p.t;
      minGap[l] = Math.min(minGap[l], gap);
      if (c.step - p.step < 2 && Math.max(bpmStep(chart, p.step), bpmStep(chart, c.step)) > FAST_BPM) v.fast16++;
    }
  }
  let minAny = 9;
  for (let i = 1; i < N.length; i++) minAny = Math.min(minAny, N[i].t - N[i - 1].t);
  const span = chart.lastT - chart.firstT;
  let npsMax = 0;
  for (let i = 0, j = 0; i < N.length; i++) { while (j < N.length && N[j].t < N[i].t + 1) j++; npsMax = Math.max(npsMax, j - i); }
  const holds = N.filter((n) => n.kind === 'hold').length, bs = N.filter((n) => n.lane === 'B').length;
  return { v, minGap, minRel, minAny, nps: N.length / span, npsMax, holds, bs };
}

/**
 * 자동 연주. jitter() = 누름 오차(초), skipL = ROPE 를 안 누름, early = 꾹을 (endT−t) × early 만큼만 누름,
 * skipNote = 이 번호 노트는 안 누름. → { judge, res, log, deathT }
 */
function play(chart, diff, o = {}) {
  const J = createJudge(chart, diff, { endless: o.endless, hp: o.hp });
  const jit = o.jitter || (() => 0);
  const ev = [];
  for (const n of chart.notes) {
    if (o.skipNote != null && n.id === o.skipNote) continue;
    if (o.stopAt != null && n.t > o.stopAt) continue;
    const ls = n.lane === 'B' ? ['L', 'R'] : [n.lane];
    for (const l of ls) {
      if (o.skipL && l === 'L') continue;
      const tp = n.t + jit();
      ev.push({ t: tp, type: 'p', l, n });
      if (n.kind === 'hold') {
        const rt = o.early ? n.t + (n.endT - n.t) * o.early : n.endT + (o.jitter ? jit() * 0.5 : 0);
        ev.push({ t: Math.max(tp + 0.001, rt), type: 'r', l, n });
      }
    }
  }
  // 같은 레인: 꾹을 떼기 전에 그 버튼을 또 누를 수는 없다(손가락은 하나) → 다음 누름 직전에 뗀다
  for (const l of ['L', 'R']) {
    const ps = ev.filter((e) => e.l === l && e.type === 'p').sort((a, b) => a.t - b.t);
    for (const r of ev.filter((e) => e.l === l && e.type === 'r')) {
      const own = ps.find((e) => e.n === r.n);
      const nx = ps.find((e) => e !== own && e.t > own.t);
      if (nx && r.t >= nx.t) r.t = nx.t - 0.002;
    }
  }
  ev.sort((a, b) => a.t - b.t || (a.type === 'r' ? -1 : 1));
  const log = [];
  let deathT = null;
  const note = (rs, t) => { for (const r of [].concat(rs || [])) if (r) log.push(r); if (deathT == null && !J.state.alive) deathT = t; };
  for (const e of ev) {
    note(J.update(e.t), e.t);
    if (!J.state.alive) break;
    note(e.type === 'p' ? J.press(e.l, e.t) : J.release(e.l, e.t), e.t);
  }
  note(J.update(chart.duration + 0.5), chart.duration + 0.5);
  return { J, res: J.result(), log, deathT };
}

/* ============ 1) 채보 표 ============ */
console.log('\n[1] 대회 × 난이도 채보');
console.log(pad('대회', 12) + pad('난도', 7) + lpad('길이', 6) + lpad('노트', 6) + lpad('꾹', 4) + lpad('B', 4) + lpad('초당', 6) + lpad('최대', 5)
  + lpad('L최소', 7) + lpad('R최소', 7) + lpad('전체', 6) + lpad('꾹뒤', 6) + lpad('첫노트', 7) + lpad('기술', 5) + lpad('뺌', 4) + '  BPM');
const charts = {};
for (const st of STAGES) {
  for (const d of DK) {
    const c = buildChart(st.no, d);
    charts[st.no + d] = c;
    const s = inspect(c);
    const ms = (x) => (x >= 9 ? '-' : Math.round(x * 1000));
    const bpms = c.tempo.map((p) => p.bpm);
    console.log(pad(`${st.no} ${st.id}`, 12) + pad(d, 7) + lpad(f1(c.duration) + 's', 6) + lpad(c.total, 6) + lpad(s.holds, 4) + lpad(s.bs, 4)
      + lpad(f1(s.nps), 6) + lpad(s.npsMax, 5) + lpad(ms(s.minGap.L), 7) + lpad(ms(s.minGap.R), 7) + lpad(ms(s.minAny), 6) + lpad(ms(Math.min(s.minRel.L, s.minRel.R)), 6)
      + lpad(f1(c.firstT) + 's', 7) + lpad(c.techs.length, 5) + lpad(c.dropped, 4) + `  ${Math.min(...bpms)}~${Math.max(...bpms)}`);
    const tag = `${st.id}/${d}`;
    ok(s.v.offGrid === 0, `${tag} 칸 밖 노트 ${s.v.offGrid}`);
    ok(s.v.odd === 0, `${tag} 쉬움·보통인데 16분 칸 ${s.v.odd}`);
    ok(s.v.easyHold === 0, `${tag} 쉬움에 꾹/크로스 ${s.v.easyHold}`);
    ok(s.v.holdClash === 0, `${tag} 꾹 동안 같은 레인 노트 ${s.v.holdClash}`);
    ok(s.v.bClash === 0, `${tag} B 앞뒤 1칸 노트 ${s.v.bClash}`);
    ok(s.v.fast16 === 0, `${tag} BPM150 넘는 곳 한 레인 16분 ${s.v.fast16}`);
    ok(s.v.sameStep === 0, `${tag} 같은 칸 두 노트 ${s.v.sameStep}`);
    ok(c.firstT >= c.steps[16] - 1e-9, `${tag} 첫 노트가 2마디째보다 앞 (${f1(c.firstT)}s)`);
    ok(c.duration > 50 && c.duration < 75, `${tag} 곡 길이 ${f1(c.duration)}s (약 60초 목표)`);
    ok(c.lastT < c.duration - DIFFS[d].win.good, `${tag} 마지막 노트가 곡 끝에 붙음`);
    ok(c.tempo === st.tempo && c.bars === st.bars, `${tag} chart.tempo/bars`);
  }
}
// 기술 등장 목록 (보통 기준) · 새 기술이 그 대회에서 처음 나오나
console.log('\n  기술 등장(보통, 처음 나온 마디):');
const seenBefore = new Set();
for (const st of STAGES) {
  const c = charts[st.no + 'normal'];
  const firsts = c.techs.filter((x) => x.first).map((x) => `${x.name}(${Math.floor(x.s0 / 16)})`);
  console.log(`   ${st.no} ${pad(st.name, 7)} ${firsts.join(' · ')}`);
  for (const d of DK) {
    const ids = new Set(charts[st.no + d].techs.map((x) => x.id));
    for (const id of st.newTechs) ok(ids.has(id), `${st.id}/${d} 새 기술 ${id} 이 안 나온다`);
    for (const id of ids) ok(!STAGES.filter((s) => s.no > st.no).some((s) => s.newTechs.includes(id)), `${st.id}/${d} 뒤 대회 기술 ${id} 이 먼저 나온다`);
  }
  // 새 기술의 첫 등장 = 그 대회에서 처음(앞 대회엔 없음)
  for (const id of st.newTechs) ok(!seenBefore.has(id), `${id} 가 앞 대회에서 먼저 나왔다`);
  for (const x of c.techs) seenBefore.add(x.id);
  // 루틴 박 수 = 구간 길이
  st.sections.forEach((sec, i) => {
    const b = parseRoutine(ROUTINES[st.id][i]).reduce((s, r) => s + runBeats(r), 0);
    ok(b === (sec.to - sec.from) * 4, `${st.id} ${sec.label} 루틴 ${b}박`);
  });
}
// 예고
{
  const c = charts['5hard'];
  const tempoCues = c.cues.filter((q) => q.kind === 'tempo');
  console.log(`\n  예고(5/hard): 템포 ${tempoCues.map((q) => `${q.text}@${f1(q.t)}s`).join(' ')} · 기술 띠 ${c.cues.filter((q) => q.kind === 'tech').length}개 · 구간 ${c.cues.filter((q) => q.kind === 'section').length}개`);
  const st5 = STAGES[4];
  for (const sec of st5.sections.filter((s) => s.cue)) {
    const q = tempoCues.find((x) => x.cue === sec.cue && Math.abs(x.t - c.steps[(sec.from - 1) * 16]) < 1e-9);
    ok(q, `템포 예고 ${sec.cue} 가 구간(${sec.from}) 1마디 전에 없다`);
  }
  // 같은 기술이 바로 이어지면 띠는 처음만
  const techCues = c.cues.filter((q) => q.kind === 'tech');
  for (const q of techCues) { const x = c.techs[q.tech], p = c.techs[q.tech - 1]; ok(!(p && p.id === x.id && p.s1 === x.s0), '이어진 같은 기술에 띠가 또 나온다'); }
}

/* ============ 2) 완벽 자동 연주 ============ */
console.log('\n[2] 완벽 자동 연주 (각 노트 t 에 정확히, 꾹은 endT 에 뗌, B 는 동시)');
for (const st of STAGES) {
  const row = [];
  for (const d of DK) {
    const c = charts[st.no + d];
    const { res, log } = play(c, d);
    const stars = starsFor(res, st.goals, d);
    const g = goalsFor(st.goals, d, res.goalScale, res.total);
    row.push(`${d} P${res.perfect}/${res.total} 콤보${res.maxCombo} ${res.rank} ★${stars} 기술${res.techCleared}/${res.techTotal} 점수${res.score} (목표 ${g.combo}/${g.perfect})`);
    const tag = `${st.id}/${d}`;
    ok(res.perfect === res.total && res.miss === 0 && res.great === 0 && res.good === 0, `${tag} 전부 PERFECT 아님 P${res.perfect} G${res.great} g${res.good} M${res.miss}`);
    ok(res.maxCombo === res.perfect, `${tag} combo ${res.maxCombo} ≠ PERFECT ${res.perfect}`);
    ok(res.cleared && stars === 3 && res.rank === 'S', `${tag} 완주/별3/S 아님 (${res.cleared} ★${stars} ${res.rank})`);
    ok(res.techCleared === res.techTotal, `${tag} 기술 성공 ${res.techCleared}/${res.techTotal}`);
    ok(c.notes.every((n) => n.done && !n.holding), `${tag} note.done 표시 빠짐`);
    ok(log.some((r) => r.feverStart) === (res.total >= 50), `${tag} FEVER 시작 표시`);
    ok(log.filter((r) => r.kind === 'hold_ok').length === c.notes.filter((n) => n.kind === 'hold').length, `${tag} hold_ok 수`);
    // 점수 검산: 등급점 × 배율 합 + 기술 보너스
    let exp = 0; for (let k = 1; k <= res.total; k++) exp += Math.round(100 * comboMult(k));
    exp += c.techs.reduce((s, x) => s + x.level * 50, 0);
    ok(res.score === exp, `${tag} 점수 ${res.score} ≠ 계산 ${exp}`);
  }
  console.log(`  ${st.no} ${pad(st.name, 7)} ` + row.join('\n' + ' '.repeat(13)));
}

/* ============ 3) 흔들기 ============ */
console.log('\n[3] 흔들기 — 누름마다 균등 난수 오차 (P/G/g/M · 정확도 · 등급 · 별)');
for (const amp of [0.030, 0.070]) {
  console.log(`  ±${amp * 1000}ms`);
  for (const st of STAGES) {
    const row = [];
    for (const d of DK) {
      const r = seeded(st.no * 100 + Math.round(amp * 1000));
      const { res } = play(charts[st.no + d], d, { jitter: () => (r() * 2 - 1) * amp });
      row.push(`${d[0]} ${res.perfect}/${res.great}/${res.good}/${res.miss} ${f1(res.accuracy)}% ${res.rank} ★${starsFor(res, st.goals, d)}${res.cleared ? '' : ' 탈락'}`);
      if (amp <= 0.03) ok(res.miss === 0 && res.cleared, `${st.id}/${d} ±30ms 인데 MISS ${res.miss}`);
      if (amp <= 0.07) ok(res.cleared && res.miss <= Math.ceil(res.total * 0.02), `${st.id}/${d} ±70ms MISS ${res.miss} (창 안인데 놓침)`);
    }
    console.log(`   ${st.no} ` + row.join(' │ '));
  }
}

/* ============ 4) 실패 경로 ============ */
console.log('\n[4] ROPE 를 전혀 안 누름 (JUMP 만 완벽)');
for (const st of STAGES) {
  const row = [];
  for (const d of DK) {
    const { res, deathT, log } = play(charts[st.no + d], d, { skipL: true });
    const ropeMiss = log.filter((x) => x.kind === 'miss' && !x.trip).length;
    row.push(`${d[0]} ${res.cleared ? `완주 hp${Math.round(res.hp)}` : `탈락 ${f1(deathT)}s`} RM${ropeMiss} ${res.rank}`);
    ok(ropeMiss > 0 && res.accuracy < 70, `${st.id}/${d} ROPE MISS 가 안 생김`);
    if (d !== 'easy') ok(!res.cleared, `${st.id}/${d} ROPE 안 눌렀는데 완주 (hp ${Math.round(res.hp)})`);
    else if (res.cleared) {
      // 기획 수치(쉬움 ROPE MISS −6×0.6 = −3.6 < JUMP PERFECT 회복 +1.5 × 2)로는 살아남는다 → 경고 + 대안 수치
      const alt = play(charts[st.no + d], d, { skipL: true, hp: { ropeMiss: 10 } });
      warns.push(`${st.id}/easy: ROPE 를 안 눌러도 완주(hp ${Math.round(res.hp)}, 정확도 ${f1(res.accuracy)}% ${res.rank} ★${starsFor(res, st.goals, d)}). `
        + `쉬움 ROPE MISS 를 배율 없이 −6 으로 하면 → ${alt.res.cleared ? '완주' : `${f1(alt.deathT)}s 탈락`}`);
    }
  }
  console.log(`   ${st.no} ` + row.join(' │ '));
}
for (const w of warns) console.log('   ⚠', w);
console.log('\n[4b] 꾹을 일찍 뗌 (길이의 1/3 만 누름)');
for (const no of [3, 4, 5]) for (const d of ['normal', 'hard']) {
  const c = charts[no + d];
  const holds = c.notes.filter((n) => n.kind === 'hold').length;
  const { res, log } = play(c, d, { early: 0.33 });
  const br = log.filter((x) => x.kind === 'break');
  console.log(`   ${no}/${d}: 꾹 ${holds} → BREAK ${br.length} · MISS ${res.miss} · 줄에 걸림 ${res.trips} · ${res.cleared ? '완주' : '탈락'} hp${Math.round(res.hp)}`);
  ok(br.length > 0 && br.every((x) => x.combo === 0 && x.grade === 'miss'), `${no}/${d} BREAK 결과 이상`);
  ok(res.breaks === br.length && res.miss >= br.length, `${no}/${d} BREAK 를 MISS 로 안 셈`);
}
{ // 꾹 한 개만 일찍 떼서 숫자 확인
  const c = charts['3hard'], J = createJudge(c, 'hard');
  const h = c.notes.find((n) => n.kind === 'hold');
  for (const n of c.notes) { if (n.id >= h.id) break; J.update(n.t); for (const l of n.lane === 'B' ? ['L', 'R'] : [n.lane]) J.press(l, n.t); }
  const before = { ...J.state };
  const p = J.press('R', h.t);
  const r = J.release('R', h.t + 0.02);
  console.log(`   하나만: 누름 ${p.grade} +${p.scoreAdd} → BREAK scoreAdd ${r.scoreAdd} · 콤보 ${before.combo}→${J.state.combo} · hp ${f1(before.hp)}→${f1(J.state.hp)} · P ${before.perfect}→${J.state.perfect} · MISS ${before.miss}→${J.state.miss}`);
  ok(r.kind === 'break' && r.trip && J.state.combo === 0 && J.state.perfect === before.perfect && J.state.miss === before.miss + 1, '꾹 BREAK 숫자');
  ok(Math.abs(before.hp - J.state.hp - 14 * 1.3) < 1e-9 || J.state.hp === 0, `꾹 BREAK 피해 ${before.hp - J.state.hp}`);
  ok(h.done && !h.holding, 'BREAK 노트 done 표시');
}

console.log('\n[4c] 무한 줄넘기');
{
  const c = buildChart('endless', 'normal', { bars: 400 });
  const s = inspect(c);
  console.log(`   400마디: ${f1(c.duration)}s · 노트 ${c.total} · 기술 ${c.techs.length} · 뺌 ${c.dropped} · 초당 ${f1(s.nps)} 최대 ${s.npsMax} · BPM ${c.tempo[0].bpm}→${c.tempo[c.tempo.length - 1].bpm}`);
  const order = []; for (const x of c.techs) if (x.first) order.push(`${x.name}@${Math.floor(x.s0 / 16)}`);
  console.log(`   기술이 열리는 마디: ${order.join(' · ')}`);
  ok(s.v.holdClash === 0 && s.v.bClash === 0 && s.v.fast16 === 0 && s.v.offGrid === 0 && s.v.odd === 0, `무한 규칙 위반 ${JSON.stringify(s.v)}`);
  // 16마디 단위 밀도 상승
  const nps = [], share = [];
  for (let b = 2; b < 386; b += 16) {
    const ns = c.notes.filter((n) => n.step >= b * 16 && n.step < (b + 16) * 16);
    nps.push(ns.length / (c.steps[(b + 16) * 16] - c.steps[b * 16]));
    share.push(ns.filter((n) => n.tech >= 0).length / ns.length);
  }
  console.log(`   16마디마다 초당 노트: ${nps.map(f1).join(' ')}`);
  console.log(`   16마디마다 기술 노트 %: ${share.map((x) => Math.round(x * 100)).join(' ')}`);
  ok(nps[10] > nps[0] * 1.6 && share[10] > share[0] + 0.25, '무한 밀도(초당 노트 · 기술 비율)가 안 오른다');
  for (const d of DK) {
    const ch = buildChart('endless', d, { bars: 400 }), s2 = inspect(ch);
    ok(s2.v.holdClash + s2.v.bClash + s2.v.fast16 + s2.v.offGrid + s2.v.odd + s2.v.easyHold + s2.v.sameStep === 0, `무한/${d} 규칙 위반 ${JSON.stringify(s2.v)}`);
    // JUMP(R) 하나 놓치면 즉시 끝
    const target = ch.notes.find((n) => n.lane === 'R' && n.t > 20);
    const { res, J } = play(ch, d, { skipNote: target.id, stopAt: target.t + 5 });
    ok(!J.state.alive && res.miss === 1 && Math.abs(res.lastT - target.t) < 1e-9, `무한/${d} JUMP 놓쳤는데 안 끝남 (miss ${res.miss})`);
    // ROPE 하나 놓치면 −34 하고 계속
    const tl = ch.notes.find((n) => n.lane === 'L' && n.t > 20);
    const J2 = createJudge(ch, d);
    for (const n of ch.notes) { if (n.t > tl.t + 3) break; J2.update(n.t); if (n.id === tl.id) continue; for (const l of n.lane === 'B' ? ['L', 'R'] : [n.lane]) J2.press(l, n.t); if (n.kind === 'hold') J2.release(n.lane, n.endT); }
    const hp1 = J2.state.hp;
    ok(J2.state.alive && J2.state.miss === 1 && hp1 < 100 && hp1 > 60, `무한/${d} ROPE MISS 뒤 hp ${hp1}`);
    if (d === 'normal') console.log(`   JUMP 하나 놓침 → ${f1(target.t)}s 에 즉시 끝(MISS ${res.miss}, BPM ${res.bpm}) · ROPE 하나 놓침 → hp ${f1(hp1)} 계속`);
  }
  // 되살리기(본체 아이템): 걸린 순간 state 를 직접 고치면 그 뒤로 계속 판정된다
  const J3 = createJudge(c, 'normal');
  const r1 = c.notes.find((n) => n.lane === 'R' && n.t > 10);
  const sref = J3.state;
  let revived = false, after = 0;
  for (const n of c.notes) {
    if (n.t > r1.t + 6) break;
    J3.update(n.t);
    if (!J3.state.alive && !revived) { revived = true; sref.alive = true; sref.hp = 50; }
    if (n.id === r1.id) continue;
    for (const l of n.lane === 'B' ? ['L', 'R'] : [n.lane]) { const r = J3.press(l, n.t); if (revived && r && r.kind === 'hit') after++; }
    if (n.kind === 'hold') J3.release(n.lane, n.endT);
  }
  ok(revived && J3.state === sref && J3.state.alive && after > 5 && J3.state.miss === 1, `되살린 뒤 판정 (hit ${after}, miss ${J3.state.miss})`);
  console.log(`   되살리기: 걸린 뒤 state.alive=true·hp=50 → 이어서 ${after}개 판정 · MISS ${J3.state.miss}`);
}

/* ============ 5) 줄 키 · seed · 내 스테이지 ============ */
console.log('\n[5] 줄 각도 키 · seed · 내 스테이지');
{
  let bad = 0, badAt = 0, badSample = 0, keys = 0;
  const all = [...Object.values(charts), buildChart('endless', 'hard', { bars: 120 })];
  for (const c of all) {
    const K = c.ropeKeys; keys += K.length;
    for (let i = 1; i < K.length; i++) {
      if (!(K[i].t > K[i - 1].t && Math.abs(K[i].a - K[i - 1].a - Math.PI) < 1e-9)) bad++;
    }
    for (const k of K) { const m = ((k.a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI); if (!(Math.abs(m) < 1e-6 || Math.abs(m - Math.PI) < 1e-6 || Math.abs(m - 2 * Math.PI) < 1e-6)) bad++; }
    for (const n of c.notes) {
      const a = ropeAngleAt(c, n.t), m = ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      const want = n.lane === 'L' ? 0 : Math.PI;
      const dd = Math.min(Math.abs(m - want), Math.abs(m - want - 2 * Math.PI), Math.abs(m - want + 2 * Math.PI));
      if (dd > 1e-6) badAt++;
    }
    let prev = -Infinity;
    for (let t = -1; t < c.duration + 1; t += 0.004) { const a = ropeAngleAt(c, t); if (a < prev - 1e-9) badSample++; prev = a; }
  }
  console.log(`   키 ${keys}개 — 번갈이/π 간격 위반 ${bad} · 노트 시각 각도 어긋남 ${badAt} · 4ms 샘플 역행 ${badSample}`);
  ok(bad === 0 && badAt === 0 && badSample === 0, '줄 각도 키');
}
{
  const a = JSON.stringify(buildChart(4, 'hard', { seed: 7 }).notes), b = JSON.stringify(buildChart(4, 'hard', { seed: 7 }).notes);
  const c0 = JSON.stringify(buildChart(4, 'hard').notes), c1 = JSON.stringify(buildChart(4, 'hard', { seed: 0 }).notes), c2 = JSON.stringify(buildChart(4, 'hard', { seed: 8 }).notes);
  const e1 = JSON.stringify(buildChart('endless', 'normal', { bars: 64, seed: 3 }).notes), e2 = JSON.stringify(buildChart('endless', 'normal', { bars: 64, seed: 3 }).notes);
  const e3 = JSON.stringify(buildChart('endless', 'normal', { bars: 64, seed: 4 }).notes);
  console.log(`   같은 seed 같은 채보: 대회 ${a === b} · 기본=seed0 ${c0 === c1} · seed 7≠8 ${a !== c2} · 무한 ${e1 === e2}(다른 seed 다름 ${e1 !== e3})`);
  ok(a === b && c0 === c1 && a !== c2 && e1 === e2 && e1 !== e3, 'seed 결정성');
  for (const no of [1, 2, 3, 4, 5]) for (const d of DK) for (const seed of [1, 2, 3]) {
    const c = buildChart(no, d, { seed }), s = inspect(c);
    ok(s.v.holdClash + s.v.bClash + s.v.fast16 + s.v.offGrid + s.v.odd + s.v.sameStep === 0, `seed ${seed} ${no}/${d} 규칙 위반`);
    const { res } = play(c, d);
    ok(res.perfect === res.total && res.cleared, `seed ${seed} ${no}/${d} 자동 연주`);
  }
}
{
  console.log('   내 스테이지(기존 «만들기» 10개 + 시험 조각):');
  const test = { name: '시험', segs: [{ k: 's', n: 8, v: 3 }, { k: 'u', n: 8, a: 3, b: 7 }, { k: 'f', n: 2, v: 7 }, { k: 'd', n: 6, v: 7 }, { k: 'r', n: 12, a: 5, b: 9 }, { k: 's', n: 4, v: 10 }] };
  for (const stg of [...OLD_STAGES, test]) {
    const c = buildChart(stg, 'normal', { seed: 1 });
    const s = inspect(c);
    const ids = [...new Set(c.techs.map((x) => x.id))];
    const line = `    ${pad(stg.name, 8)} ${lpad(c.bars, 3)}마디 ${lpad(f1(c.duration), 5)}s 노트 ${lpad(c.total, 3)} BPM ${Math.min(...c.tempo.map((p) => p.bpm))}~${Math.max(...c.tempo.map((p) => p.bpm))} 기술 ${ids.join(',') || '-'}`;
    console.log(line);
    ok(s.v.holdClash + s.v.bClash + s.v.fast16 + s.v.offGrid + s.v.odd + s.v.sameStep === 0, `내 스테이지 ${stg.name} 규칙 위반 ${JSON.stringify(s.v)}`);
    ok(c.firstT >= c.steps[16] - 1e-9, `내 스테이지 ${stg.name} 앞 1마디가 안 비었다`);
    const { res } = play(c, 'normal');
    ok(res.perfect === res.total && res.cleared, `내 스테이지 ${stg.name} 자동 연주`);
  }
  // 조각 하나씩 정확히 바뀌나
  const c = buildChart(test, 'hard', { seed: 1 });
  const beatT = (b) => c.steps[b * 4];
  // s 8박 @ v3 = 110 BPM, u 3→7 = 110→150, f 2박 @ 150(v7) 노트 없음, d 6박 이단 뛰기, r 12박, s 4박 @ v10 = 180
  ok(Math.abs(bpmAt(c.tempo, 1.5) - 110) < 1e-9 && Math.abs(bpmAt(c.tempo, 5 - 0.001) - 150) < 0.1 && Math.abs(bpmAt(c.tempo, 4) - 130) < 1e-9 && Math.abs(bpmAt(c.tempo, 10.5) - 180) < 1e-9, '빠르기 → BPM 90+(v−1)×10');
  const fNotes = c.notes.filter((n) => n.t >= beatT(4 + 16) && n.t < beatT(4 + 18));
  const dTech = c.techs.filter((x) => x.id === 'double_under' && x.s0 >= (4 + 18) * 4 && x.s0 < (4 + 24) * 4);
  const dHolds = c.notes.filter((n) => n.kind === 'hold' && n.step >= (4 + 18) * 4 && n.step < (4 + 24) * 4).length;
  ok(fNotes.length === 0, `멈칫 구간에 노트 ${fNotes.length}`);
  ok(dTech.length >= 1 && dHolds === 6, `이단 뛰기 조각 (기술 ${dTech.length} · 꾹 ${dHolds})`);
  ok(c.cues.some((q) => q.cue === 'SPEED UP') && c.cues.some((q) => q.cue === 'FREEZE'), '내 스테이지 예고');
  console.log(`    조각 확인: s/u/f/d/r/s → 멈칫 노트 ${fNotes.length} · 이단 꾹 ${dHolds}/6 · 예고 ${c.cues.filter((q) => q.kind !== 'section').map((q) => q.text).join(' ')}`);
}

console.log(fails ? `\n✗ 실패 ${fails}개` : `\n✓ 전부 통과${warns.length ? ` (경고 ${warns.length})` : ''}`);
process.exit(fails ? 1 : 0);
