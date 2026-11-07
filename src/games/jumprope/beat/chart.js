/**
 * 줄넘기 챔피언 · ROPE BEAT — 채보(chart) 만들기 (2026-11-07, 리듬 디자이너)
 *
 * 대회 5개 × 난이도 3 의 루틴(손으로 디자인한 채보) · 무한 채보 · 내 스테이지 변환 · 줄 회전 키 · 예고(cue).
 * 화면·소리를 모른다 — 순수 함수만. node 에서 `tools/_beat-sim.mjs` 가 그대로 시험한다.
 *
 * ## 레인
 *   L = ROPE(왼쪽 버튼, 줄을 머리 위로 넘긴다) · R = JUMP(오른쪽, 발밑 줄을 뛰어넘는다) · B = 둘 다(크로스)
 *   기획서 §6 표의 «J» 는 R 레인, «R(ROPE)» 는 L 레인이다 — 글자가 겹쳐 헷갈리니 코드에서는 레인 글자만 쓴다.
 * ## 칸
 *   노트는 언제나 16분음표 칸(timing.buildSteps) 위. 박 = 4칸. 쉬움·보통은 짝수 칸(8분)만, 어려움은 16분까지.
 *   기본 리듬 = 박(칸 0) JUMP · 엇박(칸 2) ROPE. 쉬움은 ROPE 를 2박에 하나만(나머지는 줄이 저절로 돈다고 본다).
 * ## 손으로 칠 수 있게 — 패턴을 그렇게 짰고, 마지막에 sanitize 가 한 번 더 지킨다
 *   - 같은 레인 연타: 어려움은 BPM 150 이하에서만 1칸(16분), 넘으면 2칸 이상. 보통 2칸. 쉬움 2칸(BPM 140 넘으면 1박).
 *   - 레인 번갈이 16분(L·R 1칸 간격)은 어려움에서만 나온다(쉬움·보통은 짝수 칸뿐).
 *   - 꾹 노트 동안(끝난 칸까지)은 같은 레인에 다른 노트 없음. B 노트 앞뒤 1칸에는 아무 노트도 없음.
 *   부딪히면 «기술 노트 > 기본 노트, 기술 첫 노트 · B · 꾹 우선»으로 남기고 나머지를 뺀다(chart.dropped 에 센다).
 * ## 결정적
 *   같은 (stage, diff, seed, bars) = 같은 채보. seed 0(기본) = 디자인한 그대로, 다른 seed 는 일부 기술만 바꿔 끼운다.
 */
import { STEPS_PER_BAR, STEPS_PER_BEAT, bpmAt, buildSteps, timeAtStep } from './timing.js';
import { STAGES, ENDLESS, DIFFS } from './stages.js';
import { sanitizeStage, seeded } from '../engine.js';

const PI = Math.PI, TAU = 2 * Math.PI;
/** 이 BPM 을 넘으면 어려움에서도 한 레인 16분 연타를 하지 않는다(사람 손가락 한계) */
export const FAST_BPM = 150;
/** 쉬움: 이 BPM 을 넘으면 같은 레인은 1박(4칸)에 한 번까지 */
export const EASY_FAST_BPM = 140;

/* ---------- 기술 ---------- */
/**
 * 실제 줄넘기 대회 기술 → 두 버튼 패턴. beats = 한 번(단위)의 길이(박).
 * pat[난이도] = [[칸, 레인, 꾹 칸 수?], …] 또는 (beat) => 그 배열. hardFast/easyFast = BPM 150 넘을 때.
 * pose · spin 은 그림(art.js drawKid) 힌트 — B 노트는 cross, R 꾹은 high, L 꾹은 release 로 보면 된다.
 */
const evenL = (beat) => (beat % 2 === 0 ? [[0, 'R'], [2, 'L']] : [[0, 'R']]);  // 쉬움: ROPE 2박에 하나
export const TECHS = {
  basic: { name: '기본 뛰기', en: 'Basic Bounce', level: 1, beats: 1, pose: 'stand',
    pat: { hard: [[0, 'R'], [2, 'L']], normal: [[0, 'R'], [2, 'L']], easy: evenL } },
  double_bounce: { name: '투스텝', en: 'Double Bounce', level: 2, beats: 1, pose: 'stand',
    pat: { hard: [[0, 'R'], [1, 'R'], [2, 'L']], hardFast: [[0, 'R'], [2, 'R']], normal: [[0, 'R'], [2, 'R']], easy: [[0, 'R'], [2, 'R']], easyFast: evenL } },
  side_swing: { name: '사이드 스윙', en: 'Side Swing', level: 2, beats: 1, pose: 'side',
    pat: { hard: [[0, 'L'], [2, 'L']], normal: [[0, 'L'], [2, 'L']], easy: [[0, 'L']] } },
  alternate: { name: '번갈아 뛰기', en: 'Alternate Step', level: 3, beats: 2, pose: 'stand',
    pat: { hard: [[0, 'R'], [2, 'L'], [3, 'R'], [4, 'R'], [6, 'L']], hardFast: [[0, 'R'], [2, 'L'], [4, 'R'], [6, 'R']],
      normal: [[0, 'R'], [2, 'L'], [4, 'R'], [6, 'R']], easy: [[0, 'R'], [2, 'L'], [4, 'R'], [6, 'R']], easyFast: [[0, 'R'], [2, 'L'], [4, 'R']] } },
  criss_cross: { name: '엇걸어 뛰기', en: 'Criss-Cross', level: 4, beats: 1, pose: 'cross',
    pat: { hard: [[0, 'B'], [2, 'L']], normal: [[0, 'B'], [2, 'L']], easy: [[0, 'R'], [2, 'L']], easyFast: evenL } },
  double_under: { name: '이단 뛰기', en: 'Double Under', level: 5, beats: 1, pose: 'high',
    pat: { hard: [[0, 'R', 3], [1, 'L'], [2, 'L']], hardFast: [[0, 'R', 3], [2, 'L']], normal: [[0, 'R', 3], [2, 'L']],
      easy: [[0, 'R'], [2, 'L']], easyFast: evenL } },
  release: { name: '줄 놓기', en: 'Release', level: 6, beats: 3, pose: 'release',
    pat: { hard: [[0, 'L', 6], [8, 'R'], [10, 'L']], normal: [[0, 'L', 6], [8, 'R'], [10, 'L']], easy: [[0, 'L'], [8, 'R'], [10, 'L']] } },
  turn180: { name: '180 턴', en: '180 Turn', level: 6, beats: 2, pose: 'spin', spin: 0.5,
    pat: { hard: [[0, 'L'], [2, 'L'], [4, 'R'], [6, 'L']], normal: [[0, 'L'], [2, 'L'], [4, 'R'], [6, 'L']], easy: [[0, 'L'], [4, 'R']] } },
  high_knees: { name: '하이니', en: 'High Knees', level: 7, beats: 1, pose: 'stand',
    // 보통은 16분이 없으니 «ROPE 가 박, JUMP 가 엇박»으로 뒤집어 달리는 느낌을 낸다
    pat: { hard: [[0, 'R'], [1, 'L'], [2, 'R'], [3, 'L']], normal: [[0, 'L'], [2, 'R']], easy: [[0, 'R'], [2, 'L']], easyFast: evenL } },
  cross_double: { name: 'X 이단', en: 'Cross Double Under', level: 8, beats: 2, pose: 'cross',
    // B 앞뒤 1칸 비움 규칙 때문에 «0 둘다 · 1 R · 2 R» 대신 «크로스 → 2칸 뒤 줄 → 이단(꾹)»으로 편다
    pat: { hard: [[0, 'B'], [2, 'L'], [4, 'R', 3], [5, 'L'], [6, 'L']], hardFast: [[0, 'B'], [2, 'L'], [4, 'R', 3], [5, 'L']],
      normal: [[0, 'B'], [2, 'L'], [4, 'R', 3], [6, 'L']], easy: [[0, 'R'], [4, 'R'], [6, 'L']] } },   // 쉬움: «쿵 . 쿵 딱» 큰 점프 두 번
  turn360: { name: '360 턴', en: '360 Turn', level: 8, beats: 2, pose: 'spin', spin: 1,
    pat: { hard: [[0, 'L'], [2, 'L'], [4, 'L'], [6, 'R']], normal: [[0, 'L'], [2, 'L'], [4, 'L'], [6, 'R']], easy: [[2, 'L'], [6, 'L']] } },
  triple_under: { name: '삼단 뛰기', en: 'Triple Under', level: 9, beats: 2, pose: 'high',
    // 꾹 동안 줄이 세 번 발밑을 지난다 — 150 이하는 16분 ROPE 셋, 넘으면 2칸 간격 셋(꾹을 6칸으로 늘림)
    pat: { hard: [[0, 'R', 4], [1, 'L'], [2, 'L'], [3, 'L'], [6, 'L']], hardFast: [[0, 'R', 6], [1, 'L'], [3, 'L'], [5, 'L']],
      normal: [[0, 'R', 6], [2, 'L'], [4, 'L']], easy: [[0, 'R'], [2, 'L'], [6, 'L']] } },
  combo_finale: { name: '콤비네이션', en: 'Combination', level: 10, beats: 0, pose: 'cheer', pat: null },
};
for (const [id, t] of Object.entries(TECHS)) t.id = id;
/** 쉬운 것 → 어려운 것 (무한 줄넘기가 16마디마다 하나씩 연다) */
export const TECH_ORDER = ['basic', 'double_bounce', 'side_swing', 'alternate', 'criss_cross', 'double_under', 'turn180', 'release', 'high_knees', 'cross_double', 'turn360', 'triple_under'];

function unitPattern(T, diff, fast, beat, lite) {
  if (lite && T.id === 'basic') return evenL(beat);                     // 무한 초반: 가벼운 기본 뛰기
  const p = T.pat;
  const v = (fast && p[diff + 'Fast']) || p[diff] || p.normal;
  return typeof v === 'function' ? v(beat) : v;
}

/* ---------- 루틴 (대회별 채보) ---------- */
/**
 * stages.js 의 sections 순서대로 한 줄씩. 글자 하나 = 기술 한 번, 띄어쓰기 = 기술 묶음(인스턴스) 경계, `|` = 마디(읽기용).
 *   b 기본 · D 투스텝 · s 사이드 · a 번갈아 · x 크로스 · u 이단 · r 릴리스 · t 180 · k 하이니 · X X이단 · T 삼단 · o 360
 *   . = 1박 쉼 · !bbbb = «기본 뛰기»도 기술로 센다(첫 대회 첫 소개) · F=… = 콤비네이션(뒤 글자들을 이어 붙인 한 기술)
 * 짜는 법: 4마디 = 부르기(기본·익은 기술) 2마디 + 받기(새 기술) 2마디, 다음 4마디는 변주. 구간 첫 마디에 새 기술,
 *   break/bridge 는 기본 + 릴리스·사이드로 숨 고르기, final 은 몰아치기. 첫 노트는 2마디째(intro 끝 «준비, 시작»).
 *   «k(16분 끝이 ROPE)» 뒤에 바로 크로스(x·X)를 두지 않는다 — B 앞 1칸 비움 규칙.
 */
const CH = { b: 'basic', D: 'double_bounce', s: 'side_swing', a: 'alternate', x: 'criss_cross', u: 'double_under', r: 'release', t: 'turn180', k: 'high_knees', X: 'cross_double', T: 'triple_under', o: 'turn360' };
export const ROUTINES = {
  training: [
    '.... | ..bb',                                                   // intro — 박만 둘
    '!bbbb | bbbb | bbbb | bb DD | bbbb | bbbb | bb DD | DDDD',      // A — 기본 뛰기, 넷째 마디에 투스텝 대답
    'ssss | bbbb | ss bb | ss DD | bb ss | bbbb | ss DD | DD ss',    // B — 사이드 스윙(뛰지 않고 줄만) ↔ 기본
    'bbbb | bb DD | ss DD | DDDD',                                   // A2 SPEED UP — 셋을 섞어 몰기
    'bbbb | b...',                                                   // outro
  ],
  arena: [
    '.... | ..bb',
    'bbbb | bb DD | aa | bb ss | bbbb | bb DD | aa | ss a',          // A — 번갈아 뛰기 소개
    'bb xx | bb xx | a xx | xxxx',                                   // build SPEED UP — 크로스 소개
    'xx a | bb xx | a xx | ss xx | xx a | xxxx',                     // chorus — 크로스 ↔ 번갈아 콜&리스폰스
    'bbbb | bb ss | bbbb | ss DD',                                   // break SLOW DOWN
    'xx a | a xx | xx DD | ss xx | xxxx | a x.',                     // final SPEED UP
  ],
  cross: [
    '.... | ..bb',
    'bbbb | bb xx | uuuu | bb a | bbbb | bb xx | bb uu | uuuu',      // A — 이단 뛰기 소개
    'tt | bb uu | t xx | uuuu | tt | bb xx | t uu | xx t',           // B SPEED UP — 180 턴 소개
    'r b | bbbb | r b | bb ss',                                      // break SLOW DOWN — 릴리스 소개(숨 고르기)
    'uuuu | t xx | r b | uu t | xx uu | tt | r b | uuuu',            // C SPEED UP 138
    'bbbb | bb..',
  ],
  double: [
    '.... | ..bb',
    'bbbb | bb kk | uuuu | kk bb | t xx | kkkk | kk uu | xx t',      // A — 하이니 소개
    'XX | kk uu | X uu | X t | XX | kkkk | uu X | X uu',             // B SPEED UP — X 이단 소개
    'r b | bbbb | bb ss | r b | tt | bb uu',                         // bridge SLOW DOWN
    'XX | kk uu | t X | kkkk | uu X | X t | kk uu | X uu',           // C SPEED UP → 158
    'XX | kk uu | t uu | X x.',                                      // final
  ],
  world: [
    '.... | ..bb',
    'bbbb | bb uu | TT | xx kk | oo | X uu | T uu | oo',             // A — 삼단 뛰기 · 360 턴 소개 (150 = 16분 연타 가능)
    'X T | kk uu | oo | TT | kk uu | X o | T uu | X T',              // B SPEED UP
    'r b | bb ss | r b | t uu',                                      // break SLOW DOWN 120
    'TT | X kk | o T | XX | kkkk | T o | X T | kk uu',               // C SPEED UP → 172
    'F=XuxTo | kk uu | X T | F=XuxTo | kk uu | X T',                 // final MAX SPEED 182 — 콤비네이션 피날레 두 번
    'bbbb | x...',                                                   // outro — 크로스로 마무리
  ],
};

/** 루틴 한 줄 → 묶음들 [{ rest } | { tech: 인스턴스 기술 id | null(기본), units: [기술 id…] }] */
export function parseRoutine(src) {
  const runs = [];
  // 한 덩어리 안에서도 글자가 바뀌면 묶음이 나뉜다('..bb' = 쉼 2박 + 기본 2박)
  const toks = String(src).split(/[\s|]+/).filter(Boolean)
    .flatMap((t) => (t.startsWith('F=') || t.startsWith('!') ? [t] : t.match(/(.)\1*/g)));
  for (const tok of toks) {
    if (/^\.+$/.test(tok)) { runs.push({ rest: tok.length }); continue; }
    if (tok.startsWith('F=')) {
      const units = [...tok.slice(2)].map((c) => CH[c]);
      if (!units.length || units.some((u) => !u)) throw new Error(`루틴 글자 오류: ${tok}`);
      runs.push({ tech: 'combo_finale', units });
      continue;
    }
    const mark = tok[0] === '!';
    const body = mark ? tok.slice(1) : tok;
    const id = CH[body[0]];
    if (!id || [...body].some((c) => c !== body[0])) throw new Error(`루틴 글자 오류: ${tok}`);
    runs.push({ tech: id === 'basic' && !mark ? null : id, units: Array(body.length).fill(id) });
  }
  return runs;
}
export const runBeats = (r) => r.rest ?? r.units.reduce((s, u) => s + TECHS[u].beats, 0);

/* ---------- 공통: 칸 위에 펴기 ---------- */

function makeCtx(tempo, bars, diff) {
  const steps = buildSteps(tempo, bars);
  return { tempo, bars, diff, steps, raw: [], insts: [], nSteps: steps.length - 1 };
}
/** 칸 s 의 BPM — buildSteps 와 같이 칸 가운데에서 잰다 */
const bpmStep = (tempo, s) => bpmAt(tempo, (s + 0.5) / STEPS_PER_BAR);
function maxBpm(tempo, s0, s1) {
  let m = 0;
  for (let s = s0; s < s1; s++) m = Math.max(m, bpmStep(tempo, s));
  return m;
}

/** 묶음들을 beat0 박부터 편다 → ctx.raw(노트 후보) · ctx.insts(기술 인스턴스). 끝난 박을 돌려준다 */
function emitRuns(runs, beat0, ctx) {
  let beat = beat0;
  for (const run of runs) {
    if (run.rest) { beat += run.rest; continue; }
    let inst = -1;
    if (run.tech) { inst = ctx.insts.length; ctx.insts.push({ id: run.tech, s0: beat * STEPS_PER_BEAT, s1: 0 }); }
    let head = inst >= 0;
    for (const u of run.units) {
      const T = TECHS[u], s0 = beat * STEPS_PER_BEAT, s1 = (beat + T.beats) * STEPS_PER_BEAT;
      const fast = maxBpm(ctx.tempo, s0, s1) > FAST_BPM;
      for (const [off, lane, hold] of unitPattern(T, ctx.diff, fast, beat, run.lite)) {
        const step = s0 + off;
        if (step >= ctx.nSteps) continue;
        ctx.raw.push({ step, lane, hold: hold || 0, inst, move: u, head });
        head = false;
      }
      beat += T.beats;
    }
    if (inst >= 0) ctx.insts[inst].s1 = beat * STEPS_PER_BEAT;
  }
  return beat;
}

const lanesOf = (n) => (n.lane === 'B' ? 'LR' : n.lane);
/** 부딪히면 남길 순서: 기술 > 기본, 기술의 첫 노트(새 기술 시작) · B · 꾹은 더 */
const prio = (n) => (n.inst >= 0 ? 2 : 1) + (n.head ? 0.3 : 0) + (n.lane === 'B' ? 0.5 : 0) + (n.hold ? 0.25 : 0);
function minGap(diff, bpm) {
  if (diff === 'hard') return bpm > FAST_BPM ? 2 : 1;
  if (diff === 'easy') return bpm > EASY_FAST_BPM ? 4 : 2;
  return 2;
}
/** 앞 노트 k(이미 남긴 것)와 지금 노트 c 가 손으로 칠 수 없게 붙어 있나 */
function clash(k, c, ctx) {
  if (c.step === k.step) return true;
  if ((k.lane === 'B' || c.lane === 'B') && c.step - k.step < 2) return true;
  const shared = [...lanesOf(c)].some((l) => lanesOf(k).includes(l));
  if (!shared) return false;
  if (k.hold) return c.step < k.step + k.hold + 1;                     // 꾹 끝난 칸 다음부터
  const bpm = Math.max(bpmStep(ctx.tempo, k.step), bpmStep(ctx.tempo, c.step));
  return c.step - k.step < minGap(ctx.diff, bpm);
}
/** 규칙 지키기 — 쉬움·보통 안전장치(꾹·B·홀수 칸 정리) + 부딪힘 정리 */
function sanitize(ctx) {
  const { diff } = ctx;
  let dropped = 0;
  const raw = [];
  for (const r of ctx.raw) {
    const n = { ...r };
    if (diff !== 'hard' && n.step % 2) { dropped++; continue; }
    if (diff === 'easy') { if (n.lane === 'B') n.lane = 'R'; n.hold = 0; }
    raw.push(n);
  }
  raw.sort((a, b) => a.step - b.step || prio(b) - prio(a));
  const kept = [];
  for (const c of raw) {
    const hits = [];
    for (let j = kept.length - 1; j >= 0 && kept[j].step >= c.step - 16; j--) if (clash(kept[j], c, ctx)) hits.push(j);
    if (!hits.length) { kept.push(c); continue; }
    if (hits.every((j) => prio(kept[j]) < prio(c))) {
      for (const j of hits) kept.splice(j, 1);                       // hits 는 뒤에서부터라 splice 해도 번호가 안 밀린다
      dropped += hits.length;
      kept.push(c);
    } else dropped++;
  }
  return { kept, dropped };
}

/** 노트 → 줄 각도 키. R/B·꾹 시작 = 발밑(π+2πk), L = 머리 위(2πk), R 꾹 끝 = 발밑. 늘 번갈아 · 단조 증가 */
function buildRopeKeys(notes, steps) {
  const ev = [];
  for (const n of notes) {
    ev.push({ s: n.step, up: n.lane === 'L', pri: 2 });
    // JUMP 꾹 끝 = 착지(줄이 마지막으로 발밑을 지난 순간). ROPE 꾹(릴리스) 끝은 키를 두지 않는다 — 놓은 줄이 공중에서 천천히 돈다
    if (n.kind === 'hold' && n.lane === 'R') ev.push({ s: n.endStep, up: false, pri: 1 });
  }
  ev.sort((a, b) => a.s - b.s || b.pri - a.pri);
  const E = [];
  for (const e of ev) if (!E.length || E[E.length - 1].s !== e.s) E.push(e);  // 같은 칸은 탭이 이긴다
  if (!E.length) return [];
  let a = E[0].up ? TAU : PI;
  // 리드인: 첫 키 1박 전 발밑(정지) → 반 박 전 머리 위 → 첫 키. 줄을 뒤꿈치에서 크게 한 번 돌려 시작한다
  const keys = [{ s: E[0].s - 4, a: a - TAU }, { s: E[0].s - 2, a: a - PI }, { s: E[0].s, a }];
  let prev = E[0];
  for (let i = 1; i < E.length; i++) {
    const e = E[i];
    if (e.up === prev.up) { a += PI; keys.push({ s: (prev.s + e.s) / 2, a }); }  // 같은 종류가 연달아 → 가운데에 반대
    a += PI; keys.push({ s: e.s, a });
    prev = e;
  }
  if (prev.up) { a += PI; keys.push({ s: prev.s + 2, a }); }                   // 끝은 발밑에 내려놓는다
  const K = keys.map((k) => ({ t: timeAtStep(steps, k.s), a: k.a, m: 0 }));
  // 기울기: 단조 3차 보간(Fritsch–Butland). 끝은 0(천천히 서고 출발), 키에서는 평균의 85%(«착» 하고 살짝 머무는 느낌)
  for (let i = 1; i < K.length - 1; i++) {
    const h0 = K[i].t - K[i - 1].t, h1 = K[i + 1].t - K[i].t;
    const d0 = (K[i].a - K[i - 1].a) / h0, d1 = (K[i + 1].a - K[i].a) / h1;
    if (!(d0 > 0 && d1 > 0)) continue;
    const w1 = 2 * h1 + h0, w2 = h1 + 2 * h0;
    K[i].m = (0.85 * (w1 + w2)) / (w1 / d0 + w2 / d1);
  }
  return K;
}

/** 줄 각도(라디안). 발밑 = π+2πk, 머리 위 = 2πk. 키 사이는 단조 3차 보간 — 첫 키 앞 · 마지막 키 뒤는 멈춰 있다 */
export function ropeAngleAt(chart, t) {
  const K = chart?.ropeKeys;
  if (!K?.length) return PI;
  const n = K.length;
  if (t <= K[0].t) return K[0].a;
  if (t >= K[n - 1].t) return K[n - 1].a;
  let lo = chart._rk ?? 0;                                              // 지난번 칸부터 찾는다(매 프레임 부르니까)
  if (!(lo < n - 1 && K[lo].t <= t && t < K[lo + 1].t)) {
    lo = 0; let hi = n - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (K[m].t <= t) lo = m; else hi = m; }
  }
  if (Object.isExtensible(chart)) chart._rk = lo;
  const A = K[lo], B = K[lo + 1], h = B.t - A.t, s = (t - A.t) / h, s2 = s * s, s3 = s2 * s;
  return (2 * s3 - 3 * s2 + 1) * A.a + (s3 - 2 * s2 + s) * h * (A.m || 0) + (-2 * s3 + 3 * s2) * B.a + (s3 - s2) * h * (B.m || 0);
}

const CUE_TEXT = { 'SPEED UP': 'SPEED UP!', 'SLOW DOWN': 'SLOW DOWN…', 'MAX SPEED': 'MAX SPEED!!' };

/** 후보 → 완성 채보 (노트 번호 · 기술 인스턴스 · 줄 키 · 예고) */
function finalize(ctx, meta, sections, extraCues = []) {
  const { steps } = ctx;
  const { kept, dropped } = sanitize(ctx);
  const laneOrd = { L: 0, B: 1, R: 2 };
  kept.sort((a, b) => a.step - b.step || laneOrd[a.lane] - laneOrd[b.lane]);
  const byInst = new Map();
  const notes = kept.map((r, id) => {
    const n = { id, lane: r.lane, kind: r.hold ? 'hold' : 'tap', step: r.step, t: steps[r.step], tech: -1, move: r.move };
    if (r.hold) { n.endStep = r.step + r.hold; n.endT = timeAtStep(steps, n.endStep); }
    if (r.inst >= 0) { if (!byInst.has(r.inst)) byInst.set(r.inst, []); byInst.get(r.inst).push(n); }
    return n;
  });
  // 노트가 하나도 안 남은 인스턴스는 버리고 번호를 다시 매긴다
  const techs = [];
  const seen = new Set();
  ctx.insts.forEach((ins, k) => {
    const ns = byInst.get(k);
    if (!ns?.length) return;
    const T = TECHS[ins.id], i = techs.length;
    for (const n of ns) n.tech = i;
    techs.push({ i, id: ins.id, name: T.name, en: T.en, level: T.level, t0: ns[0].t, t1: Math.max(...ns.map((n) => n.endT ?? n.t)),
      s0: ins.s0, s1: ins.s1, noteIds: ns.map((n) => n.id), first: !seen.has(ins.id) });
    seen.add(ins.id);
  });
  const sec = sections.map((s) => ({ ...s, t0: timeAtStep(steps, s.from * STEPS_PER_BAR), t1: timeAtStep(steps, s.to * STEPS_PER_BAR) }));
  const cues = [...extraCues];
  for (const s of sec) {
    cues.push({ t: s.t0, text: s.label, kind: 'section', label: s.label, energy: s.energy ?? 1 });
    if (s.cue) cues.push({ t: timeAtStep(steps, Math.max(0, (s.from - 1) * STEPS_PER_BAR)), text: CUE_TEXT[s.cue] || s.cue, kind: 'tempo', cue: s.cue });
  }
  techs.forEach((x, i) => {
    const p = techs[i - 1];
    if (p && p.id === x.id && p.s1 === x.s0) return;                    // 같은 기술이 바로 이어지면 처음만
    cues.push({ t: x.t0, text: x.en.toUpperCase() + '!', kind: 'tech', name: x.name, tech: i, first: x.first });
  });
  cues.sort((a, b) => a.t - b.t);
  const duration = steps[steps.length - 1];
  return {
    ...meta, diff: ctx.diff, tempo: ctx.tempo, bars: ctx.bars, steps, duration, sections: sec,
    notes, techs, ropeKeys: buildRopeKeys(notes, steps), cues, total: notes.length,
    firstT: notes.length ? notes[0].t : 0, lastT: notes.length ? Math.max(...notes.map((n) => n.endT ?? n.t)) : 0,
    dropped, goalScale: 1,
  };
}

/* ---------- 대회 채보 ---------- */

/** 대회 k 까지 나온 기술(기본·피날레 빼고) */
const poolUpTo = (no) => STAGES.filter((s) => s.no <= no).flatMap((s) => s.newTechs).filter((id) => id !== 'basic' && id !== 'combo_finale');

/** seed 변주 — 새 기술의 첫 소개와 피날레는 그대로 두고, 나머지 기술 묶음 일부를 같은 길이 · 비슷한 레벨 기술로 바꿔 끼운다 */
function varyRuns(runs, rand, pool, debut) {
  return runs.map((r) => {
    if (r.rest || !r.tech || r.tech === 'combo_finale' || r.tech === 'basic') return r;
    if (!debut.has(r.tech)) { debut.add(r.tech); return r; }
    if (rand() >= 0.35) return r;
    const T = TECHS[r.tech];
    const alt = pool.filter((id) => id !== r.tech && TECHS[id].beats === T.beats && Math.abs(TECHS[id].level - T.level) <= 3);
    if (!alt.length) return r;
    const id = alt[Math.floor(rand() * alt.length)];
    return { tech: id, units: r.units.map(() => id) };
  });
}

function stageChart(st, diff, seed, opts) {
  const ctx = makeCtx(st.tempo, st.bars, diff);
  const routine = ROUTINES[st.id];
  if (!routine || routine.length !== st.sections.length) throw new Error(`루틴이 구간 수와 다르다: ${st.id}`);
  const rand = seeded(seed * 7919 + st.no);
  const pool = poolUpTo(st.no);
  const debut = new Set();
  st.sections.forEach((sec, si) => {
    let runs = parseRoutine(routine[si]);
    const beats = runs.reduce((s, r) => s + runBeats(r), 0);
    if (beats !== (sec.to - sec.from) * 4) throw new Error(`루틴 박 수 오류: ${st.id} ${sec.label} = ${beats}박 (구간 ${(sec.to - sec.from) * 4}박)`);
    if (seed) runs = varyRuns(runs, rand, pool, debut);
    emitRuns(runs, sec.from * 4, ctx);
  });
  const chart = finalize(ctx, { kind: 'stage', stage: st.no, id: st.id, name: st.name, en: st.en, seed }, st.sections);
  // 별 목표 비율: 보통 채보 노트 수 대비(쉬움은 노트가 적으니 낮춘다. 어려움은 올리지 않는다) — judge.goalsFor 가 쓴다
  if (diff !== 'normal' && !opts._ref) chart.goalScale = Math.min(1, chart.total / stageChart(st, 'normal', seed, { _ref: true }).total);
  return chart;
}

/* ---------- 무한 ---------- */
/**
 * 무한 줄넘기: ENDLESS 템포(8마디마다 +4, 최고 200). 16마디(한 단계)마다 기술이 하나씩 열리고 기술 비율이 오른다.
 * 4마디 프레이즈 = A · B · A(되풀이) · 채움(새 기술 쪽으로). 단계 첫 마디 = 새 기술 소개, 단계 끝 마디 = 숨 고르기.
 */
function endlessChart(diff, seed, bars, opts) {
  bars = Math.max(8, Math.round(bars));
  const tempo = ENDLESS.tempoUntil(bars);
  const ctx = makeCtx(tempo, bars, diff);
  const rand = seeded(seed * 104729 + 31);
  const sections = [{ from: 0, to: 2, label: 'intro', energy: 0 }];
  const cues = [];
  emitRuns(parseRoutine('.... | ..bb'), 0, ctx);
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  /** 한 마디(4박) 만들기 — pool 에서 dens 확률로 기술, 나머지 기본(fill 확률로 꽉 찬 기본, 아니면 ROPE 2박에 하나). favor 는 더 자주 */
  const makeBar = (pool, dens, favor, fill) => {
    const runs = [];
    let left = 4;
    while (left > 0) {
      const fits = pool.filter((id) => TECHS[id].beats <= left);
      if (fits.length && rand() < dens) {
        const id = favor && TECHS[favor].beats <= left && rand() < 0.45 ? favor : pick(fits);
        const b = TECHS[id].beats, reps = Math.max(1, Math.min(Math.floor(left / b), 1 + Math.floor(rand() * 2)));
        runs.push({ tech: id, units: Array(reps).fill(id) });
        left -= b * reps;
      } else {
        const n = Math.min(left, 1 + Math.floor(rand() * 2));
        runs.push({ tech: null, units: Array(n).fill('basic'), lite: rand() >= fill });
        left -= n;
      }
    }
    return runs;
  };
  const last = bars - 1;                                               // 마지막 마디는 비운다(끝 판정 여유)
  for (let p = 0, bar = 2; bar < last; p++, bar += 16) {
    const open = TECH_ORDER.slice(1, Math.min(TECH_ORDER.length, 2 + p));
    const newest = open[open.length - 1];
    const dens = Math.min(0.85, 0.3 + 0.07 * p);                     // 기술 비율
    const fill = Math.min(1, 0.25 + 0.15 * p);                         // 기본 뛰기가 8분으로 꽉 차는 비율 (밀도)
    sections.push({ from: bar, to: Math.min(last, bar + 16), label: `LEVEL ${p + 1}`, energy: Math.min(3, 1 + (p >> 1)) });
    if (p > 0 && bpmAt(tempo, bar) < ENDLESS.maxBpm) cues.push({ s: (bar - 1) * STEPS_PER_BAR, text: CUE_TEXT['SPEED UP'], kind: 'tempo', cue: 'SPEED UP' });
    for (let ph = 0; ph < 4; ph++) {
      const A = makeBar(open, dens, newest, fill), B = makeBar(open, dens, newest, fill), F = makeBar(open, Math.min(0.95, dens + 0.15), newest, fill);
      const four = [A, B, A, F];
      if (ph === 0 && p > 0) {                                         // 새 기술 소개 마디
        const b = TECHS[newest].beats, reps = Math.floor(4 / b);
        four[0] = [{ tech: newest, units: Array(reps).fill(newest) }];
        if (4 - reps * b) four[0].push({ tech: null, units: Array(4 - reps * b).fill('basic') });
      }
      if (ph === 3) four[3] = parseRoutine('bb ..');                    // 단계 끝 숨 고르기
      for (let i = 0; i < 4; i++) {
        const at = bar + ph * 4 + i;
        if (at >= last) break;
        emitRuns(four[i], at * 4, ctx);
      }
    }
  }
  sections.push({ from: last, to: bars, label: 'outro', energy: 0 });
  const chart = finalize(ctx, { kind: 'endless', stage: 'endless', id: 'endless', name: ENDLESS.name, en: ENDLESS.en, seed }, sections,
    cues.map((c) => ({ t: timeAtStep(ctx.steps, c.s), text: c.text, kind: c.kind, cue: c.cue })));
  return chart;
}

/* ---------- 내 스테이지 ---------- */
/**
 * 기존 «만들기» 조각 {k, n, v|a,b} → 템포 지도 + 기술. 빠르기 v → BPM 90+(v−1)×10, n = 박 수. 앞에 1마디 비움, 뒤에 1마디 여유.
 *   s 기본 뛰기 · r 지금까지 기술 랜덤 섞기(빠르기 = a·b 가운데) · u a→b 빨라지기/느려지기(기본 뛰기)
 *   f 멈칫(쉼, 노트 없음) · d 이단 뛰기
 * «지금까지 기술» = opts.techs(본체가 넘기는 열린 기술 목록). 없으면 피날레 빼고 전부.
 */
const segBpm = (v) => 90 + (Math.max(1, Math.min(10, +v || 1)) - 1) * 10;
function customChart(stage, diff, seed, opts) {
  const st = sanitizeStage(stage) || { name: '내 스테이지', theme: 0, judge: 'n', segs: [{ k: 's', n: 8, v: 3 }] };
  const pool = (Array.isArray(opts.techs) && opts.techs.length ? opts.techs : TECH_ORDER).filter((id) => TECHS[id] && id !== 'combo_finale');
  const rand = seeded(seed * 15485863 + 7);
  const tempo = [];
  const plan = [];                                                    // [{ seg, beat0, beats, bpm0, bpm1 }]
  let beat = 4;                                                       // 1마디 비움
  for (const g of st.segs) {
    const b0 = g.k === 'u' ? segBpm(g.a) : g.k === 'r' ? Math.round((segBpm(g.a) + segBpm(g.b)) / 2) : segBpm(g.v);
    const b1 = g.k === 'u' ? segBpm(g.b) : b0;
    if (!tempo.length) tempo.push({ bar: 0, bpm: b0 });
    tempo.push({ bar: beat / 4, bpm: b0 }, { bar: (beat + g.n) / 4, bpm: b1 });
    plan.push({ g, beat0: beat, beats: g.n, bpm0: b0, bpm1: b1 });
    beat += g.n;
  }
  const bars = Math.ceil(beat / 4) + 1;
  tempo.push({ bar: bars, bpm: tempo[tempo.length - 1].bpm });
  const ctx = makeCtx(tempo, bars, diff);
  const sections = [{ from: 0, to: 1, label: 'intro', energy: 0 }];
  const cues = [];
  let prevBpm = plan[0]?.bpm0;
  plan.forEach((p, i) => {
    const { g } = p;
    const runs = [];
    if (g.k === 's' || g.k === 'u') runs.push({ tech: null, units: Array(g.n).fill('basic') });
    else if (g.k === 'd') for (let k = 0; k < g.n; k += 4) runs.push({ tech: 'double_under', units: Array(Math.min(4, g.n - k)).fill('double_under') });
    else if (g.k === 'f') runs.push({ rest: g.n });
    else if (g.k === 'r') {
      let left = g.n;
      while (left > 0) {
        const fits = pool.filter((id) => TECHS[id].beats <= left);
        const id = fits.length ? fits[Math.floor(rand() * fits.length)] : 'basic';
        const b = TECHS[id].beats, reps = Math.max(1, Math.min(Math.floor(left / b), 1 + Math.floor(rand() * 2)));
        runs.push({ tech: id === 'basic' ? null : id, units: Array(reps).fill(id) });
        left -= b * reps;
      }
    }
    emitRuns(runs, p.beat0, ctx);
    sections.push({ from: p.beat0 / 4, to: (p.beat0 + p.beats) / 4, label: g.k, energy: g.k === 'f' ? 0 : g.k === 's' ? 1 : 2 });
    // 예고: 템포가 바뀌면 1마디 전, 멈칫은 1박 전
    const s = p.beat0 * STEPS_PER_BEAT;
    const up = g.k === 'u' ? p.bpm1 - p.bpm0 : 0, jump = i ? p.bpm0 - prevBpm : 0;
    const d = Math.abs(jump) >= 5 ? jump : up;
    if (d) cues.push({ s: Math.max(0, s - STEPS_PER_BAR), text: CUE_TEXT[d > 0 ? 'SPEED UP' : 'SLOW DOWN'], kind: 'tempo', cue: d > 0 ? 'SPEED UP' : 'SLOW DOWN' });
    if (g.k === 'f') cues.push({ s: Math.max(0, s - STEPS_PER_BEAT), text: 'FREEZE!', kind: 'rest', cue: 'FREEZE' });
    prevBpm = p.bpm1;
  });
  sections.push({ from: bars - 1, to: bars, label: 'outro', energy: 0 });
  return finalize(ctx, { kind: 'custom', stage: 'custom', id: 'custom', name: st.name, theme: st.theme, judge: st.judge, seed }, sections,
    cues.map((c) => ({ t: timeAtStep(ctx.steps, c.s), text: c.text, kind: c.kind, cue: c.cue })));
}

/* ---------- 입구 ---------- */
/**
 * @param stage 1~5 | 'training'… | STAGES 항목 | 'endless' | 내 스테이지 객체 {name, segs:[…], judge?, theme?}
 * @param diff 'easy' | 'normal' | 'hard'
 * @param opts { seed=0, bars=400(무한), techs(내 스테이지 r 조각이 섞을 기술) }
 * @returns { kind, stage, id, name, diff, seed, tempo, bars, steps, duration, sections, notes, techs, ropeKeys, cues, total,
 *            firstT, lastT, dropped, goalScale }
 */
export function buildChart(stage, diff = 'normal', opts = {}) {
  diff = DIFFS[diff] ? diff : 'normal';
  opts = opts || {};
  const seed = Math.abs(Math.floor(+opts.seed || 0));
  if (stage === 'endless' || stage?.id === 'endless') return endlessChart(diff, seed, opts.bars ?? 400, opts);
  if (stage && typeof stage === 'object' && Array.isArray(stage.segs)) return customChart(stage, diff, seed, opts);
  const st = typeof stage === 'number' ? STAGES[stage - 1]
    : typeof stage === 'string' ? STAGES.find((s) => s.id === stage || String(s.no) === stage)
      : STAGES.find((s) => s.no === stage?.no);
  if (!st) throw new Error(`모르는 대회: ${stage}`);
  return stageChart(st, diff, seed, opts);
}
