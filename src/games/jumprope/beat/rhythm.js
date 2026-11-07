/**
 * 줄넘기 챔피언 · ROPE BEAT — 게임 본체 (2026-11-07, 총괄)
 *
 *   mount(host, opts) · unmount() · requestPause()
 *
 * 리듬게임이다: 음악(music.js)이 시계이고, 위에서 떨어지는 «줄» 노트(chart.js)를 판정선에서
 * ROPE(왼쪽) · JUMP(오른쪽)로 받아 친다. 판정(judge.js)은 **곡 시각**으로만 한다 — 프레임과 무관.
 * 그림은 픽셀아트(beatArt.js · art.js): 도트 버퍼(짧은 변 128칸)에 그리고 정수배로 키운다.
 * 선수는 1배 도트 캔버스에 그린 뒤 **3배**로 키워 가운데에 세운다(줄도 같은 배율로 굵고 선명하게).
 * 단추 글자(ROPE · JUMP)만 프리텐다드 블랙으로 크게 — 권반장 지정.
 *
 * 흐름: ready(곡 소개 · 아무 단추나 누르면 시작) → play(리드인 4박 카운트 포함) ⇄ pause → end → 결과 카드
 */

import { buildChart, ropeAngleAt, TECHS } from './chart.js';
import { createJudge, starsFor } from './judge.js';
import { createMusic } from './music.js';
import { STAGES, ENDLESS, DIFFS } from './stages.js';
import { stepAtTime, bpmAt } from './timing.js';
import * as BA from './beatArt.js';
import { SURVIVAL, survivalTempo, survivalStatus, roundAt, roundBpm } from './survival.js';
import { drawKid, kidHands, poseHands, ropeGeom, drawRope, drawHandles, rect, rbox, sprite, tone, OUT, SPR } from '../art.js';

const SHORT_SIDE = 128;
const NEO = "'Neo둥근모', 'Courier New', monospace";
const PRET = "'PretendardV', 'Pretendard', 'Arial Black', sans-serif";
const KID_W = 80, KID_H = 76, KID_FOOT = 72;   // 선수 1배 캔버스 (줄 고리까지 들어가는 크기)
const GRADE_COL = { perfect: '#ffd23f', great: '#6fe3ff', good: '#9be36f', miss: '#ff6b6b' };
const GRADE_TXT = { perfect: 'PERFECT', great: 'GREAT', good: 'GOOD', miss: 'MISS' };
const L_KEYS = new Set(['KeyA', 'ArrowLeft', 'KeyF', 'KeyS']);
const R_KEYS = new Set(['KeyD', 'ArrowRight', 'KeyJ', 'KeyK', 'Space', 'Enter']);

let G = null;
let styleOn = false;

/**
 * @param {HTMLElement} host
 * @param {{mode:'stage'|'endless'|'test', stageNo?:number, custom?:object, diff:string, look:object, rope:object,
 *          items?:{shield?:boolean, heart?:boolean, candy2?:boolean}, opts?:{sound?:boolean, vib?:boolean, offset?:number},
 *          best?:number, hasNext?:boolean, onFinish:(r:object)=>object, onExit:(kind:string)=>void, onSound?:(on:boolean)=>void}} opts
 */
export function mount(host, opts) {
  unmount();
  if (!styleOn) { const st = document.createElement('style'); st.textContent = CSS; document.head.append(st); styleOn = true; }
  host.innerHTML = '';
  host.classList.add('rb-host');
  const cv = document.createElement('canvas');
  cv.className = 'rb-canvas';
  host.append(cv);

  const diff = DIFFS[opts.diff] ? opts.diff : 'normal';
  const stage = opts.mode === 'stage' ? STAGES[Math.max(0, Math.min(STAGES.length - 1, (opts.stageNo | 0) - 1))] : null;
  const surv = opts.mode === 'survival';
  const chartSrc = opts.mode === 'endless' || surv ? 'endless' : opts.mode === 'test' ? opts.custom : stage.no;
  const survTempo = surv ? survivalTempo(SURVIVAL.bars) : null;
  /* 조작 (2026-11-07 권반장 «너무 어려워 — 점프만이 기본»): 기본은 JUMP 하나. ROPE+JUMP 두 버튼은 Lv.20 해금 하드 모드.
     서바이벌은 모두 같은 노트로 겨루게 늘 JUMP 하나 */
  const jumpOnly = surv || opts.ctrl !== 'both';
  const ctrl = jumpOnly ? 'jump' : 'both';
  const chart = surv
    ? buildChart('endless', diff, { seed: (opts.seed | 0) || 1, bars: SURVIVAL.bars, tempo: survTempo, ctrl })      // 방 seed — 모두 같은 줄
    : buildChart(chartSrc, diff, { seed: 7 + (opts.stageNo | 0) * 31, bars: opts.mode === 'endless' ? 400 : undefined, ctrl });
  /* JUMP 하나: 판정 창 ×1.25 · 걸려도 덜 아프고 잘 뛰면 더 차오른다.
     두 버튼: 쉬움도 ROPE 를 계속 놓치면 탈락한다(«ROPE 없이 JUMP 만은 줄넘기가 아니다») — 쉬움 ROPE MISS = 10 × 0.6
     서바이벌은 체력 대신 하트 3개(본체가 센다) — 판정의 체력 피해 · 회복은 끈다 */
  const winScale = jumpOnly ? 1.25 : 1;
  const judge = createJudge(chart, diff, surv
    ? { winScale, hp: { ropeMiss: 0, jumpMiss: 0, perfect: 0, great: 0 } }
    : { winScale, endless: opts.mode === 'endless', hp: jumpOnly ? { jumpMiss: 9, endlessTrip: 25, perfect: 2, great: 1 } : diff === 'easy' ? { ropeMiss: 10 } : undefined });
  const music = createMusic();
  music.setEnabled?.(opts.opts?.sound !== false);

  const kidCv = document.createElement('canvas');
  kidCv.width = KID_W; kidCv.height = KID_H;
  /* 선수는 두 겹 — 뒤쪽 줄(레인 뒤) · 몸 + 앞쪽 줄(레인 위). 3배 선수의 줄이 레인에 숨지 않게 */
  const kidBack = document.createElement('canvas');
  kidBack.width = KID_W; kidBack.height = KID_H;
  const buf = document.createElement('canvas');

  G = {
    host, cv, ctx: cv.getContext('2d'), buf, b: buf.getContext('2d'), kidCv, k: kidCv.getContext('2d'), kidBack, kb: kidBack.getContext('2d'),
    opts, diff, stage, chart, judge, music, jumpOnly, winScale, lockAt: -9, apPtr: 0,
    tempo: surv ? survTempo : opts.mode === 'endless' ? ENDLESS.tempoUntil(400) : stage ? stage.tempo : (chart.tempo || [{ bar: 0, bpm: 120 }]),
    title: surv ? `멀티 서바이벌 · ${DIFFS[diff].en}` : opts.mode === 'endless' ? `${ENDLESS.name} · ${DIFFS[diff].en}` : opts.mode === 'test' ? `${opts.custom?.name || '내 스테이지'} (시험)` : `${stage.no}. ${stage.name}`,
    sub: surv ? '마지막까지 줄에 안 걸리면 우승!' : opts.mode === 'endless' ? ENDLESS.song.title : stage ? `${stage.en} · ${stage.song.title}` : 'CUSTOM',
    surv, hearts: SURVIVAL.hearts, out: false, room: opts.room || null, status: null, statusAt: -9, pubAt: -9, lastPub: '',
    round: -1, seenAlive: new Set(), roundOverSent: false, startMs: null,
    W: 128, H: 280, S: 1, dpr: 1, K: 3,
    phase: 'ready', phaseT: 0, t: 0, frameMs: 0, raf: 0,
    songT: -9, lastSongT: -9, T0: 0,
    down: { L: false, R: false }, pressAt: { L: -9, R: -9 }, flash: { L: 0, R: 0 },
    jumpAt: -9, jumpHold: false, ropeAt: -9, tripAt: -9, bothAt: -9,
    hits: [], pops: [], banners: [], parts: [], cueIdx: 0, shake: 0,
    feverOn: false, lastComboMilestone: 0,
    shield: !surv && !!opts.items?.shield, revive: !surv && !!opts.items?.heart,
    result: null, overlay: null, auto: null, autoIdx: 0, autoHolds: [],
    pointers: new Map(),
  };
  resize();

  /* 입력 — 이벤트 타임스탬프를 곡 시각으로 바꿔 판정한다 */
  const offsetSec = () => (G.opts.opts?.offset || 0) / 1000;
  const evT = (e) => {
    const ts = e && typeof e.timeStamp === 'number' && e.timeStamp > 0 ? e.timeStamp : performance.now();
    try { return G.music.eventSongTime(ts) - offsetSec(); } catch { return G.music.songTime() - offsetSec(); }
  };
  const begin = () => { G.music.init(); if (G.phase === 'ready' && !G.surv) startSong(); };
  const pressLane = (lane, e) => {
    if (G.overlay) return;
    begin();
    if (G.jumpOnly && lane === 'L') { G.lockAt = G.t; return; }        // ROPE 는 잠김(Lv.20 하드 모드) — 시작만 된다
    if (G.phase !== 'play' || G.down[lane] || G.out) return;
    doPress(lane, evT(e));
  };
  const releaseLane = (lane, e) => {
    if (!G.down[lane]) return;
    doRelease(lane, G.phase === 'play' ? evT(e) : G.songT);
  };
  const toNative = (e) => {
    const r = cv.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * G.dpr) / G.S, y: ((e.clientY - r.top) * G.dpr) / G.S };
  };
  const pdown = (e) => {
    if (G.overlay) return;
    e.preventDefault();
    const p = toNative(e);
    const pb = G.pauseBox;
    if (p.x >= pb.x - 4 && p.x <= pb.x + pb.w + 4 && p.y >= pb.y - 4 && p.y <= pb.y + pb.h + 4) { G.music.init(); requestPause(); return; }
    const lane = p.x < G.W / 2 ? 'L' : 'R';
    G.pointers.set(e.pointerId, lane);
    try { cv.setPointerCapture(e.pointerId); } catch { /* */ }
    pressLane(lane, e);
  };
  const pup = (e) => {
    const lane = G.pointers.get(e.pointerId);
    if (!lane) return;
    G.pointers.delete(e.pointerId);
    if (![...G.pointers.values()].includes(lane)) releaseLane(lane, e);
  };
  cv.addEventListener('pointerdown', pdown);
  cv.addEventListener('pointerup', pup);
  cv.addEventListener('pointercancel', pup);
  cv.addEventListener('contextmenu', (e) => e.preventDefault());
  const kd = (e) => {
    if (e.code === 'Escape' || e.code === 'KeyP') { if (!e.repeat) requestPause(); return; }
    const lane = L_KEYS.has(e.code) ? 'L' : R_KEYS.has(e.code) ? 'R' : null;
    if (!lane) return;
    e.preventDefault();
    if (e.repeat) return;
    pressLane(lane, e);
  };
  const ku = (e) => {
    const lane = L_KEYS.has(e.code) ? 'L' : R_KEYS.has(e.code) ? 'R' : null;
    if (lane) releaseLane(lane, e);
  };
  window.addEventListener('keydown', kd);
  window.addEventListener('keyup', ku);
  const vis = () => { if (document.hidden && !G.surv) requestPause(); };   // 서바이벌은 멈추지 않는다(모두 같은 시계)
  document.addEventListener('visibilitychange', vis);
  window.addEventListener('blur', vis);
  const ro = new ResizeObserver(() => resize());
  ro.observe(host);
  G.off = () => {
    window.removeEventListener('keydown', kd);
    window.removeEventListener('keyup', ku);
    document.removeEventListener('visibilitychange', vis);
    window.removeEventListener('blur', vis);
    ro.disconnect();
  };
  try { document.fonts?.load(`900 48px ${PRET}`); document.fonts?.load(`16px ${NEO}`); } catch { /* 글꼴이 없으면 대체 글꼴 */ }

  G.frameMs = performance.now();
  G.raf = requestAnimationFrame(loop);
  window.__rbDebug = _debug;
  /* 서바이벌 — 방에 적힌 시작 시각(서버)에 모두 같이 출발한다. 소리를 깨우려 미리 init 한 번 */
  if (G.surv) {
    G.music.init();
    Promise.resolve(opts.msUntil ? opts.msUntil() : 3000).catch(() => 3000).then((ms) => {
      if (!G || G.phase !== 'ready') return;
      G.startMs = performance.now() + Math.max(0, ms);
      startSong(ms);
    });
  }
}

/** 서바이벌 — 방 기록이 바뀔 때마다 래퍼가 넣어 준다 */
export function setRoom(room) {
  if (!G) return;
  G.room = room;
  G.statusAt = -9;
  if (G.phase === 'result' && G.rankBox && room) { G.status = survivalStatus(room, srvNow()); rankRows({ ...G.status, over: true }, G.rankBox); }
}

export function unmount() {
  if (!G) return;
  cancelAnimationFrame(G.raf);
  G.off?.();
  try { G.music.stop(); G.music.close(); } catch { /* */ }
  G.host.innerHTML = '';
  G.host.classList.remove('rb-host');
  G = null;
}

/** 뒤로가기 · ESC · 창 전환 — 판 중이면 일시정지(음악도), 결과 화면이면 로비로 */
export function requestPause() {
  if (!G) return;
  if (G.phase === 'result') { G.opts.onExit('lobby'); return; }
  if (G.phase === 'pause') { resume(); return; }
  if (G.surv) { if (G.overlay) { hideOverlay(); return; } showSurvMenu(); return; }   // 모두 같은 시계 — 멈추지 않고 나가기만 묻는다
  if (G.phase !== 'play' && G.phase !== 'resume') return;
  if (G.phase === 'play') { try { G.music.pause(); } catch { /* */ } }
  setPhase('pause');
  for (const l of ['L', 'R']) G.down[l] = false;
  showPause();
}

/* ---------- 진행 ---------- */
function setPhase(p) { G.phase = p; G.phaseT = 0; }

function startSong(msUntil) {
  const m = G.music;
  m.init();
  m.prepare(G.opts.mode === 'endless' || G.surv || G.opts.mode === 'test' ? 'endless' : G.stage ? G.stage.id : 'training', { tempo: G.tempo, bars: G.chart.bars });
  /* 서바이벌: 곡 0칸이 방 시작 시각에 오도록 리드인을 늘린다(4박 카운트는 그 끝에) */
  G.T0 = m.start(G.surv ? Math.max(1.6, (msUntil || 0) / 1000) : 1.6);
  setPhase('play');
}

function resume() {
  hideOverlay();
  setPhase('resume');          // 1.2초 «3 · 2 · 1» 뒤에 음악을 다시 튼다(멈춘 바로 그 자리부터)
}

function doPress(lane, t) {
  G.down[lane] = true;
  G.pressAt[lane] = G.t;
  G.music.hit(lane === 'L' ? (G.down.R && G.t - G.pressAt.R < 0.06 ? 'both' : 'rope') : (G.down.L && G.t - G.pressAt.L < 0.06 ? 'both' : 'jump'));
  if (lane === 'R') { G.jumpAt = G.t; G.jumpHold = true; } else G.ropeAt = G.t;
  if (G.down.L && G.down.R && Math.abs(G.pressAt.L - G.pressAt.R) < 0.08) G.bothAt = G.t;
  if (G.jumpOnly && lane === 'R') { G.ropeAt = G.t; G.bothAt = G.t; }   // JUMP 하나: 기술 동작(옆 · 엇걸기)은 JUMP 로 저절로
  if (G.opts.opts?.vib !== false) try { navigator.vibrate?.(8); } catch { /* */ }
  const res = G.judge.press(lane, t);
  if (res) handle([res.kind ? res : { kind: 'hit', ...res, lane }]);
}

function doRelease(lane, t) {
  G.down[lane] = false;
  if (lane === 'R') G.jumpHold = false;
  const res = G.judge.release?.(lane, t);
  if (res) handle([res]);
}

/** 판정 결과 → 효과 (소리 · 폭발 · 글자 · 흔들림 · 기술 띠 · 피버) */
function handle(list) {
  if (G.surv && G.out) return;                       // 탈락해 관전 중 — 남은 노트의 MISS 는 조용히
  for (const r of list || []) {
    if (!r) continue;
    const lane = r.lane || (r.note?.lane === 'L' ? 'L' : 'R');
    const lanes = r.note?.lane === 'B' ? ['L', 'R'] : [lane === 'B' ? 'R' : lane];
    if (r.kind === 'miss' || r.kind === 'break' || r.grade === 'miss') {
      const jumpMiss = r.trip ?? (r.note?.lane !== 'L' || r.kind === 'break');
      if (jumpMiss && G.shield) {
        /* 보호막 아이템 — 줄에 한 번 걸려도 넘어지지 않는다(판정 기록은 그대로) */
        G.shield = false;
        G.music.hit('tech');
        banner('보호막!', '#7fc8ff');
        continue;
      }
      G.music.hit(jumpMiss ? 'trip' : 'miss');
      if (jumpMiss) { G.tripAt = G.t; G.shake = 0.25; }
      if (jumpMiss && G.surv && !G.out) loseHeart();
      for (const l of lanes) { pop(l, 'miss'); hit(l, 'miss'); }
      continue;
    }
    if (r.kind === 'hold_ok') { G.music.hit('good'); continue; }
    const g = r.grade;
    if (!g) continue;
    G.music.hit(g);
    for (const l of lanes) { pop(l, g); hit(l, g); G.flash[l] = 1; }
    if (g === 'perfect' && lanes.includes('R')) G.shake = Math.max(G.shake, 0.08);
    if (r.techClear) { G.music.hit('tech'); banner(`${r.techClear.name || ''} CLEAR! +${r.techClear.bonus || 0}`, '#ffd23f'); }
    if (r.feverStart && !G.feverOn) { G.feverOn = true; G.music.setFever?.(true); G.music.hit('fever'); banner('FEVER!!', '#ff7fd1'); }
    const c = G.judge.state.combo | 0;
    if (c >= 10 && Math.floor(c / 10) > G.lastComboMilestone) { G.lastComboMilestone = Math.floor(c / 10); G.music.hit('combo', { n: c }); }
    if (c < 10) G.lastComboMilestone = 0;
  }
  if (G.feverOn && (G.judge.state.combo | 0) < 50) { G.feverOn = false; G.music.setFever?.(false); }
}

function pop(lane, grade) {
  G.pops.push({ lane, grade, age: 0 });
  if (G.pops.length > 6) G.pops.shift();
}
function hit(lane, grade) { G.hits.push({ lane, grade, age: 0 }); }
function banner(text, color) {
  G.banners.push({ text, color, age: 0 });
  if (G.banners.length > 2) G.banners.shift();
}

/* ---------- 매 프레임 ---------- */
function loop(now) {
  if (!G) return;
  const dt = Math.min(0.1, Math.max(0, (now - G.frameMs) / 1000));
  G.frameMs = now;
  G.t += dt;
  G.phaseT += dt;
  update(dt);
  render();
  G.raf = requestAnimationFrame(loop);
}

function update(dt) {
  if (G.phase === 'resume' && G.phaseT >= 1.2) { try { G.music.resume(); } catch { /* */ } setPhase('play'); }
  if (G.phase === 'play') {
    /* 화면 · 자동 MISS 도 입력과 **같은 시계**(오디오 출력 시각)로 — songTime 과 몇 ms 어긋나지 않게 */
    try { G.songT = G.music.eventSongTime(performance.now()); } catch { G.songT = G.music.songTime(); }
    autoPlay();
    handle(G.judge.update(G.songT - (G.opts.opts?.offset || 0) / 1000));   // 판정은 보정값을 뺀 입력 기준
    /* 예고 띠 — 곡 시각이 지나간 cue 를 띄운다 */
    const cues = G.chart.cues || [];
    const lead = G.leadSec ?? 1.2;
    while (G.cueIdx < cues.length && cues[G.cueIdx].t - (cues[G.cueIdx].kind === 'tech' ? lead : 0) <= G.songT) {
      const cu = cues[G.cueIdx++];
      if (cu.kind === 'tech' && !cu.first) continue;      // 기술 이름은 그 곡에서 처음 나올 때만 크게
      if (cu.kind === 'section') continue;
      const col = cu.kind === 'speed' ? '#ff9a3c' : cu.kind === 'slow' ? '#6fc8ff' : cu.kind === 'tech' ? '#ffe14d' : '#ffffff';
      banner(cu.kind === 'speed' ? `▲ ${cu.text}!` : cu.kind === 'slow' ? `▼ ${cu.text}…` : cu.text, col);
    }
    const st = G.judge.state;
    if (G.surv) {
      survUpdate();
      if (G.phase === 'play' && G.songT >= G.chart.duration + 0.6) finishSurvival();
    } else if (!st.alive) {
      if (G.revive) {
        /* 하트 하나 더 — 한 번 다시 일어선다 */
        G.revive = false;
        st.alive = true;
        st.hp = 50;
        G.music.hit('tech');
        banner('다시 일어나요!', '#ff7fa8');
      } else finish(false);
    } else if (G.opts.mode !== 'endless' && G.songT >= G.chart.duration + 0.6) finish(true);
  }
  if (G.phase === 'end' && G.phaseT >= 1.8 && !G.overlay) showResult();
  for (const l of ['L', 'R']) G.flash[l] = Math.max(0, G.flash[l] - dt * 5);
  G.shake = Math.max(0, G.shake - dt);
  for (const a of [G.hits, G.pops, G.banners, G.parts]) for (const p of a) p.age += dt;
  G.hits = G.hits.filter((p) => p.age < 0.4);
  G.pops = G.pops.filter((p) => p.age < 0.55);
  G.banners = G.banners.filter((p) => p.age < 1.5);
  for (const p of G.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.g || 0) * dt; }
  G.parts = G.parts.filter((p) => p.age < p.life);
  if (G.phase === 'end' && G.result?.r?.cleared && Math.random() < 0.6) confetti();
}

/** 시험용 자동 연주 — 'perfect' 는 노트 시각 그대로, 'sloppy' 는 ±40ms, 'none' 은 안 친다 */
function autoPlay() {
  const A = G.auto;
  if (!A || A === 'none' || G.out) return;
  const notes = G.chart.notes;
  /* 꾹 노트(JUMP 꾹 · ROPE 꾹) — 끝 시각까지 누르고 있다가 뗀다 */
  for (const h of G.autoHolds) {
    if (h.done || G.songT < h.endT) continue;
    h.done = true;
    G.down[h.lane] = false;
    if (h.lane === 'R') G.jumpHold = false;
    handle([G.judge.release?.(h.lane, h.endT)]);
  }
  while (G.autoIdx < notes.length && notes[G.autoIdx].t <= G.songT) {
    const n = notes[G.autoIdx++];
    if (A === 'ropeless' && n.lane === 'L') continue;
    const jit = A === 'sloppy' ? (((n.id * 7919) % 9) - 4) * 0.01 : 0;
    const t = n.t + jit;
    const lanes = n.lane === 'B' ? ['L', 'R'] : [n.lane];
    for (const l of lanes) {
      G.pressAt[l] = G.t;
      if (l === 'R') { G.jumpAt = G.t; G.jumpHold = n.kind === 'hold'; } else G.ropeAt = G.t;
      handle([G.judge.press(l, t)]);
      if (n.kind === 'hold') { G.down[l] = true; G.autoHolds.push({ lane: l, endT: n.endT, done: false }); }
      else handle([G.judge.release?.(l, t + 0.05)]);
    }
    if (n.lane === 'B' || G.jumpOnly) G.bothAt = G.t;
    if (G.jumpOnly) G.ropeAt = G.t;
  }
}

function finish(cleared) {
  if (G.phase === 'end' || G.phase === 'result') return;
  setPhase('end');
  try { G.music.stop(); } catch { /* */ }
  G.music.hit(cleared ? 'clear' : 'fail');
  const res = { ...G.judge.result(), cleared };
  const goals = G.stage?.goals || { combo: 999999, perfect: 999999 };
  const stars = G.opts.mode === 'stage' ? starsFor(res, goals, G.diff) : 0;
  const r = {
    mode: G.opts.mode, diff: G.diff, stageNo: G.stage?.no || 0, cleared, stars,
    score: res.score | 0, perfect: res.perfect | 0, great: res.great | 0, good: res.good | 0, miss: res.miss | 0,
    maxCombo: res.maxCombo | 0, accuracy: res.accuracy || 0, rank: res.rank || 'D',
    techCleared: res.techCleared | 0, techTotal: res.techTotal | 0,
    count: (res.perfect | 0) + (res.great | 0) + (res.good | 0),
    bpm: Math.round(bpmAt(G.tempo, stepAtTime(G.chart.steps, Math.max(0, G.songT)) / 16)),
    used: G.opts.items || {}, ctrl: G.jumpOnly ? 'jump' : 'both',
  };
  try { G.result = { r, sum: G.opts.onFinish?.(r) || null }; } catch (e) { console.warn('[ROPE BEAT] 결과 저장 실패', e); G.result = { r, sum: null }; }
}

function confetti() {
  const cols = ['#ff4d4d', '#ffd23f', '#4dd27a', '#4d9cff', '#ff7fbf', '#b36bff'];
  G.parts.push({ x: Math.random() * G.W, y: -3, vx: (Math.random() - 0.5) * 14, vy: 30 + Math.random() * 30, g: 8, age: 0, life: 3, color: cols[(Math.random() * cols.length) | 0] });
}


/* ---------- 멀티 서바이벌 ---------- */
const srvNow = () => (G.opts.serverNow ? G.opts.serverNow() : Date.now());
/** 내 칸 올리기 — 바뀐 것이 있을 때만(1초마다 확인), 하트를 잃으면 바로 */
function publishMine(force) {
  const st = G.judge.state;
  const f = { lives: G.hearts, score: st.score | 0, jc: st.combo | 0, alive: !G.out };
  const key = JSON.stringify(f);
  G.pubAt = G.t;
  if (!force && key === G.lastPub) return;
  G.lastPub = key;
  try { G.opts.publish?.(f); } catch { /* 다음 번에 */ }
}
function loseHeart() {
  G.hearts = Math.max(0, G.hearts - 1);
  if (G.hearts > 0) { banner(`줄에 걸렸어요! 하트 ${G.hearts}개 남음`, '#ff6b6b'); publishMine(true); return; }
  /* 하트 0 — 탈락 · 관전 */
  G.out = true;
  G.down.L = false; G.down.R = false;
  G.lastPub = '';
  try { G.opts.publish?.({ lives: 0, alive: false, deadAt: srvNow(), score: G.judge.state.score | 0, jc: 0 }); } catch { /* */ }
  G.music.hit('fail');
  banner('탈락! 관전 중', '#ff6b6b');
  showSpec();
}
function survUpdate() {
  /* 라운드 띠 — 8마디마다 빨라진다 */
  if (G.songT >= 0) {
    const rd = roundAt(stepAtTime(G.chart.steps, G.songT) / 16);
    if (rd !== G.round) {
      G.round = rd;
      banner(`ROUND ${rd + 1} · BPM ${roundBpm(rd)}`, rd ? '#ff9a3c' : '#ffffff');
      if (rd) G.music.hit('tech');
    }
  }
  if (!G.out && G.t - G.pubAt >= SURVIVAL.publishMs / 1000) publishMine(false);
  if (!G.room || G.t - G.statusAt < 0.25) return;
  G.statusAt = G.t;
  const stt = survivalStatus(G.room, srvNow());
  for (const x of stt.seats) {
    if (x.alive) G.seenAlive.add(x.uid);
    else if (G.seenAlive.has(x.uid)) {
      G.seenAlive.delete(x.uid);
      if (x.uid !== G.opts.myUid) banner(`${x.nickname} 탈락! 남은 선수 ${stt.aliveCount}명`, '#ff9a9a');
    }
  }
  G.status = stt;
  if (G.out) updateSpec();
  if (G.songT > 1 && (stt.over || G.room.state === 'finished')) finishSurvival();
}
function finishSurvival() {
  if (G.phase === 'end' || G.phase === 'result') return;
  const stt = G.room ? survivalStatus(G.room, srvNow()) : (G.status || { ranking: [], total: 1 });
  G.status = stt;
  const idx = stt.ranking.findIndex((x) => x.uid === G.opts.myUid);
  const rank = idx >= 0 ? idx + 1 : Math.max(1, stt.total);
  const won = rank === 1 && !(stt.total <= 1 && G.out);
  setPhase('end');
  hideSpec();
  try { G.music.stop(); } catch { /* */ }
  G.music.hit(won ? 'clear' : 'fail');
  if (!G.roundOverSent) { G.roundOverSent = true; try { G.opts.onRoundOver?.(); } catch { /* */ } }
  try { G.opts.publish?.({ done: true, lives: G.hearts, score: G.judge.state.score | 0, alive: !G.out }); } catch { /* */ }
  const res = G.judge.result();
  const r = {
    mode: 'survival', diff: G.diff, rank, total: stt.total, won, cleared: won,
    score: res.score | 0, perfect: res.perfect | 0, great: res.great | 0, good: res.good | 0, miss: res.miss | 0,
    maxCombo: res.maxCombo | 0, accuracy: res.accuracy || 0, rank_: res.rank, count: (res.perfect | 0) + (res.great | 0) + (res.good | 0),
  };
  try { G.result = { r, sum: G.opts.onFinish?.(r) || null }; } catch (e) { console.warn('[ROPE BEAT] 결과 저장 실패', e); G.result = { r, sum: null }; }
}
/** 관전 패널 — 탈락한 뒤 남은 선수들을 실시간으로 (화면을 막지 않는다) */
function showSpec() {
  hideSpec();
  const d = div('rb-spec');
  G.host.append(d);
  G.spec = d;
  updateSpec();
}
function hideSpec() { G.spec?.remove(); G.spec = null; }
function rankRows(stt, box) {
  box.innerHTML = '';
  stt.ranking.forEach((x, i) => {
    const row = div(`rb-rk${x.alive ? ' on' : ''}${x.uid === G.opts.myUid ? ' me' : ''}`);
    row.append(
      div('rb-rk-n', i === 0 && stt.over ? '🏆' : `${i + 1}`),
      div('rb-rk-name', x.nickname),
      div('rb-rk-h', x.alive ? '♥'.repeat(x.lives) + '♡'.repeat(Math.max(0, SURVIVAL.hearts - x.lives)) : (x.stale ? '나감' : '탈락')),
      div('rb-rk-s', (x.score | 0).toLocaleString('en-US')),
    );
    box.append(row);
  });
}
function updateSpec() {
  if (!G.spec || !G.status) return;
  const stt = G.status;
  G.spec.innerHTML = '';
  G.spec.append(div('rb-spec-h', `관전 중 — 남은 선수 ${stt.aliveCount}명 / ${stt.total}명`));
  const box = div('rb-rk-list');
  rankRows(stt, box);
  G.spec.append(box);
}
function showSurvMenu() {
  hideOverlay();
  const o = div('rb-ov');
  const card = div('rb-card');
  card.append(div('rb-title', 'MENU'), div('rb-acc', '멀티 서바이벌은 모두 같은 시계라 멈출 수 없어요.'));
  card.append(btn('계속하기', 'primary', () => hideOverlay()), btn('포기하고 나가기', '', () => G.opts.onExit('lobby')));
  o.append(card);
  G.host.append(o);
  G.overlay = o;
}

/* ---------- 크기 · 배치 ---------- */
function resize() {
  if (!G) return;
  const w = Math.max(1, G.host.clientWidth), h = Math.max(1, G.host.clientHeight);
  G.dpr = Math.min(2, window.devicePixelRatio || 1);
  const cw = Math.round(w * G.dpr), ch = Math.round(h * G.dpr);
  G.cv.width = cw; G.cv.height = ch;
  G.cv.style.width = `${w}px`; G.cv.style.height = `${h}px`;
  G.S = Math.max(1, Math.floor(Math.min(cw, ch) / SHORT_SIDE));
  G.W = Math.ceil(cw / G.S);
  G.H = Math.ceil(ch / G.S);
  G.buf.width = G.W; G.buf.height = G.H;
  G.b = G.buf.getContext('2d');
  G.cx = Math.floor(G.W / 2);
  const btnArea = Math.max(40, Math.min(64, Math.round(G.H * 0.17)));
  G.btnTop = G.H - btnArea;
  G.floorY = G.btnTop - 10;
  G.hudH = 36;
  G.K = Math.max(1, Math.min(3, Math.floor((G.floorY - 22) / 52)));
  G.laneW = Math.max(20, Math.min(28, Math.floor(G.W * 0.19)));
  const gap = Math.min(Math.floor(G.W / 2) - G.laneW - 3, Math.max(34 * G.K, 40));
  G.xL = G.cx - gap - G.laneW;
  G.xR = G.cx + gap;
  const bw = Math.floor((G.W - 9) / 2);
  G.btnL = { x: 3, y: G.btnTop + 4, w: bw, h: btnArea - 8 };
  G.btnR = { x: G.W - 3 - bw, y: G.btnTop + 4, w: bw, h: btnArea - 8 };
  G.pauseBox = { x: G.W - 17, y: 3, w: 14, h: 14 };
  /* 노트가 판정선까지 떨어지는 칸 수 → 대략의 초(첫 BPM 기준) — 기술 이름 띠를 그만큼 먼저 띄운다 */
  const stepsVisible = (G.floorY - G.hudH) / (DIFFS[G.diff].pxPerBeat / 4);
  G.leadSec = Math.min(1.8, Math.max(0.6, (stepsVisible / 4) * (60 / (G.tempo?.[0]?.bpm || 120)) * 0.7));
}

/* ---------- 그리기 ---------- */
function render() {
  const { ctx, b } = G;
  b.imageSmoothingEnabled = false;
  const sh = G.shake > 0 ? (Math.floor(G.t * 50) % 2 ? 1 : -1) * (G.shake > 0.15 ? 2 : 1) : 0;
  b.save();
  b.translate(0, sh);
  const st = G.judge.state;
  const fever = !!(st.fever || G.feverOn);
  BA.drawArena(b, G.stage ? G.stage.arena : 4, G.W, G.H, G.floorY, G.t, { fever, energy: currentEnergy(), beat: G.phase === 'play' ? nowStep() / 4 : G.t * 2 });
  if (fever) BA.drawFeverAura(b, G.cx, G.floorY, G.K, G.t);
  drawKidBig();                    // 두 겹을 만들고 뒤쪽 줄만 먼저 깐다
  drawLanes();
  blitKid(G.kidCv);                // 몸 + 앞쪽 줄은 레인 위에 — 줄이 늘 또렷하게
  drawNotes();                     // 노트는 맨 위
  drawTargets();
  drawApproach();                  // 반투명 다가오는 원 — 판정 원 위에
  b.restore();
  drawHudPixels();
  drawButtons();
  if (G.phase === 'ready') drawReadyPanel();
  for (const p of G.parts) rect(b, p.x, p.y, 2, 2, p.color);
  ctx.imageSmoothingEnabled = false;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(G.buf, 0, 0, G.W * G.S, G.H * G.S);
  drawTexts();
}

function currentEnergy() {
  const secs = G.stage?.sections;
  if (!secs) return 2;
  const bar = stepAtTime(G.chart.steps, Math.max(0, G.songT)) / 16;
  return (secs.find((s) => bar >= s.from && bar < s.to) || secs[secs.length - 1]).energy;
}

function nowStep() { return stepAtTime(G.chart.steps, G.songT); }
function pxPerStep() { return DIFFS[G.diff].pxPerBeat / 4; }

function drawLanes() {
  const b = G.b;
  const beatPhase = ((nowStep() % 4) + 4) % 4 / 4;
  const pulse = Math.max(0, 1 - beatPhase * 3);
  /* 박마다 눈금 — 빨라지면 눈금이 빨리 내려온다(템포가 눈에 보인다) */
  const ns = nowStep(), pps = pxPerStep(), ticks = [];
  for (let s = Math.ceil(ns / 4) * 4; ; s += 4) { const y = Math.round(G.floorY - (s - ns) * pps); if (y < G.hudH) break; ticks.push(y); }
  BA.drawLane(b, 'L', G.xL, G.hudH, G.floorY + 6, G.laneW, G.t, { pulse: G.jumpOnly ? 0 : Math.max(pulse * 0.5, G.flash.L), ticks });
  BA.drawLane(b, 'R', G.xR, G.hudH, G.floorY + 6, G.laneW, G.t, { pulse: Math.max(pulse * 0.5, G.flash.R), ticks });
  if (G.jumpOnly) {
    /* 잠긴 ROPE 레인 — 바둑판으로 어둡게 + 자물쇠 (Lv.20 하드 모드에서 열린다) */
    for (let y = G.hudH; y < G.floorY + 16; y++) for (let x = G.xL - 3 + (y % 2); x < G.xL + G.laneW + 3; x += 2) rect(b, x, y, 1, 1, 'rgba(10,6,24,0.75)');
    drawLock(b, G.xL + Math.floor(G.laneW / 2) - 4, Math.floor((G.hudH + G.floorY) / 2) - 5);
  }
}

/** 자물쇠 9×11 도트 */
function drawLock(c, x, y) {
  rect(c, x + 1, y, 7, 6, OUT); rect(c, x + 2, y + 1, 5, 5, '#c9c2dc'); rect(c, x + 3, y + 2, 3, 4, OUT);
  rect(c, x, y + 4, 9, 7, OUT); rect(c, x + 1, y + 5, 7, 5, '#ffd23f'); rect(c, x + 1, y + 5, 7, 1, '#fff2a8'); rect(c, x + 1, y + 9, 7, 1, '#c98a14');
  rect(c, x + 4, y + 6, 1, 2, OUT);
}

/* ---------- 다가오는 원 (2026-11-07) ----------
 * 권반장: «어느 정도 내려왔는지 반투명하게 보여서 그 동그란 원 안에 들어왔을 때 딱 눌러야 되는데 …»
 * 다음 노트가 판정 원에 닿기 전부터, 바깥 고리(크게 → 판정 원 크기로 줄어듦)와 안쪽 원(차오름)을 반투명으로 그린다.
 * 둘 다 노트가 판정 원 한가운데 닿는 **바로 그 순간** 판정 원과 겹친다. PERFECT 창 안에서는 흰 고리가 번쩍. */
function pring(c, cx, cy, r, th, col) {
  c.fillStyle = col;
  const ro2 = (r + 0.5) * (r + 0.5), rin = Math.max(-1, r - th), ri2 = (rin + 0.5) * (rin + 0.5);
  for (let dy = -r; dy <= r; dy++) {
    const yy = dy * dy;
    const ho = Math.sqrt(Math.max(0, ro2 - yy));
    const l0 = Math.ceil(cx - ho), r0 = Math.floor(cx + ho);
    if (rin < 0 || yy >= ri2) { c.fillRect(l0, cy + dy, r0 - l0 + 1, 1); continue; }
    const hi = Math.sqrt(ri2 - yy);
    const l1 = Math.ceil(cx - hi), r1 = Math.floor(cx + hi);
    if (l1 > l0) c.fillRect(l0, cy + dy, l1 - l0, 1);
    if (r0 > r1) c.fillRect(r1 + 1, cy + dy, r0 - r1, 1);
  }
}
const AP_COL = { R: ['#fff6c8', '#ffd23f'], L: ['#e6f4ff', '#7fc0ff'] };   // 판정 원(주황 · 파랑)과 잘 갈리는 밝은 색
function drawApproach() {
  if (G.phase !== 'play' && G.phase !== 'pause' && G.phase !== 'resume') return;
  const b = G.b, notes = G.chart.notes, T = G.songT;
  const D = DIFFS[G.diff].win, good = D.good * G.winScale, perfect = D.perfect * G.winScale;
  const bpm = bpmAt(G.tempo, Math.max(0, stepAtTime(G.chart.steps, Math.max(0, T))) / 16);
  const A = Math.max(0.45, Math.min(0.95, (60 / Math.max(60, bpm)) * 1.6));      // 원이 줄어드는 시간 ≈ 1.6박
  while (G.apPtr < notes.length && (notes[G.apPtr].done || notes[G.apPtr].t < T - good - 0.05)) G.apPtr++;
  for (const l of G.jumpOnly ? ['R'] : ['L', 'R']) {
    let n = null;
    for (let j = G.apPtr; j < notes.length && j < G.apPtr + 24; j++) {
      const m = notes[j];
      if (m.done || m.holding || (l === 'R' ? m.lane === 'L' : m.lane === 'R')) continue;
      if (m.t < T - good) continue;
      n = m; break;
    }
    if (!n) continue;
    const dt = n.t - T;
    if (dt > A) continue;
    const p = Math.max(0, Math.min(1, dt / A));
    const x = l === 'L' ? G.xL : G.xR, w = G.laneW;
    const cx = x + w / 2 - 0.5, cy = G.floorY, R = Math.round(w / 2 + 2);
    const [ringC, fillC] = AP_COL[l];
    b.save();
    /* 안쪽 원 — 노트가 가까울수록 차오른다 */
    const ri = Math.round((R - 4) * (1 - p));
    if (ri > 0) { b.globalAlpha = 0.3 + 0.3 * (1 - p); pring(b, cx, cy, ri, 99, fillC); }
    /* 바깥 고리 — 크게 시작해 판정 원으로 줄어든다 */
    const rr = R + Math.round(p * Math.min(16, w * 0.6));                 // 레인이 화면 끝에 붙어 있어도 잘리지 않을 만큼
    b.globalAlpha = 0.45 + 0.45 * (1 - p);
    pring(b, cx, cy, rr + 1, 4, OUT);
    pring(b, cx, cy, rr, 2, ringC);
    /* 지금! — PERFECT 창 안 */
    if (Math.abs(dt) <= perfect) { b.globalAlpha = 0.9; pring(b, cx, cy, R + 3, 2, '#ffffff'); }
    b.restore();
  }
}

function drawNotes() {
  const b = G.b;
  const ns = nowStep();
  const pps = pxPerStep();
  const topStep = ns + (G.floorY - G.hudH) / pps;
  const notes = G.chart.notes;
  const judged = G.judge.judgedIds || null;
  for (let i = notes.length - 1; i >= 0; i--) {
    const n = notes[i];
    if (n.step > topStep + 2) continue;
    const endS = n.kind === 'hold' ? (n.endStep ?? n.step) : n.step;
    if (endS < ns - 3) break;
    if (n.done || (judged && judged.has?.(n.id))) { if (n.kind !== 'hold' || endS < ns) continue; }
    const y = Math.round(G.floorY - (n.step - ns) * pps);
    const holdPx = n.kind === 'hold' ? Math.round((endS - n.step) * pps) : 0;
    if (n.lane === 'B') BA.drawNote(b, 'B', n.kind, G.xL, y, G.xR + G.laneW - G.xL, { holdPx, t: G.t, laneW: G.laneW });
    else BA.drawNote(b, n.lane, n.kind, n.lane === 'L' ? G.xL : G.xR, y, G.laneW, { holdPx, t: G.t, hit: n.holding });
  }
}

function drawTargets() {
  const b = G.b;
  for (const l of ['L', 'R']) BA.drawTarget(b, l, l === 'L' ? G.xL : G.xR, G.floorY, G.laneW, { pressed: G.down[l], flash: G.flash[l] });
  for (const h of G.hits) BA.drawHit(b, (h.lane === 'L' ? G.xL : G.xR) + G.laneW / 2, G.floorY, h.grade, h.age);
}

/** 선수 포즈 — 지금 기술 · 마지막 입력 · 넘어짐으로 고른다 */
function kidPose(theta) {
  const T = G.t;
  const st = G.judge.state;
  if (G.phase === 'end') return { state: G.result?.r?.cleared ? 'cheer' : 'sit', lift: G.result?.r?.cleared ? Math.round(Math.abs(Math.sin(G.phaseT * 7)) * 6) : 0, theta, t: T };
  if (T - G.tripAt < 0.55) return { state: 'trip', theta, t: T };
  const tech = currentTech();
  const since = T - G.jumpAt;
  let lift = 0, tuck = 0, state = 'stand';
  const high = G.jumpHold && G.down.R && since > 0.12;
  if (high) { lift = 14; tuck = 1; state = 'high'; }
  else if (since >= 0 && since < 0.3) { lift = Math.round(Math.sin((since / 0.3) * Math.PI) * 10); tuck = lift > 3 ? 1 : 0; }
  if (tech) {
    const pose = TECHS[tech.id]?.pose;
    if (pose === 'cross' && T - G.bothAt < 0.35) state = 'cross';
    else if (pose === 'side' && T - G.ropeAt < 0.4) state = 'side';
    else if (pose === 'spin' && st.alive) return { state: 'spin', spin: Math.min(0.999, Math.max(0, (G.songT - tech.t0) / Math.max(0.2, tech.t1 - tech.t0)) * (TECHS[tech.id].spin ?? 1)), lift, tuck, theta, t: T };
    else if (pose === 'release' && (G.down.L || (G.jumpOnly && G.down.R))) state = 'release';
  }
  if (G.phase === 'ready') state = 'ready';
  return { state, lift, tuck, crouch: lift === 0 && since < 0.38 && since > 0.3 ? 1 : 0, theta, t: T };
}
function currentTech() {
  const ts = G.chart.techs || [];
  for (let i = 0; i < ts.length; i++) { const x = ts[i]; if (G.songT >= x.t0 - 0.05 && G.songT <= x.t1 + 0.1) return x; }
  return null;
}

function blitKid(cvs) {
  const K = G.K;
  G.b.drawImage(cvs, 0, 0, KID_W, KID_H, G.cx - (KID_W / 2) * K, G.floorY - KID_FOOT * K, KID_W * K, KID_H * K);
}
function drawKidBig() {
  const k = G.k, kb = G.kb;
  k.clearRect(0, 0, KID_W, KID_H);
  kb.clearRect(0, 0, KID_W, KID_H);
  const theta = G.phase === 'play' || G.phase === 'pause' || G.phase === 'resume' ? ropeAngleAt(G.chart, G.songT) : Math.PI;
  const pose = kidPose(theta);
  const x = KID_W / 2, fy = KID_FOOT;
  const rope = G.opts.rope;
  /* 그림자 — 바둑판 */
  const sw = 10 - Math.floor((pose.lift || 0) / 3);
  for (let dx = -sw; dx <= sw; dx++) if (dx % 2 === 0) rect(k, x + dx, fy, 1, 1, 'rgba(0,0,0,0.5)');
  const tangled = pose.state === 'trip' || pose.state === 'sit';
  const pre = poseHands ? poseHands(x, fy, pose) : kidHands(theta, x, fy, pose.lift || 0, pose.crouch || 0, pose.state, G.t, pose.spin || 0);
  const g0 = ropeGeom(pre, x, fy, theta);
  if (!tangled && g0.depth < 0) drawRope(kb, rope, g0, G.t);
  const hands = drawKid(k, x, fy, G.opts.look, pose);
  const g1 = ropeGeom(hands, x, fy, theta);
  if (tangled) { g1.c1 = { x: g1.p0.x - 3, y: fy + 6 }; g1.c2 = { x: g1.p2.x + 3, y: fy + 6 }; drawRope(k, rope, g1, G.t); }
  else if (g1.depth >= 0) drawRope(k, rope, g1, G.t);
  drawHandles(k, rope, hands);
  blitKid(G.kidBack);
}

/* ---------- 위 HUD (도트) ---------- */
function gauge(c, x, y, w, h, ratio, fill) {
  rect(c, x - 2, y - 2, w + 4, h + 4, OUT);
  rect(c, x - 1, y - 1, w + 2, h + 2, '#ffdd8e');
  rect(c, x, y, w, h, '#4a3428');
  const fw = Math.round(w * Math.max(0, Math.min(1, ratio)));
  if (fw > 0) { rect(c, x, y, fw, h, fill); rect(c, x, y, fw, 1, tone(fill, 0.35)); rect(c, x, y + h - 1, fw, 1, tone(fill, -0.3)); }
}
function drawHudPixels() {
  const b = G.b;
  const W = G.W;
  const barNow = Math.max(0, stepAtTime(G.chart.steps, Math.max(0, G.songT)) / 16);
  const prog = G.surv ? (barNow % SURVIVAL.roundBars) / SURVIVAL.roundBars : G.opts.mode === 'endless' ? 0 : Math.max(0, Math.min(1, G.songT / G.chart.duration));
  gauge(b, 4, 4, W - 28, 5, prog, G.surv ? '#ff4fa3' : '#e8501f');
  if (G.surv) {
    for (let i = 0; i < SURVIVAL.hearts; i++) sprite(b, 3 + i * 9, 13, i < G.hearts ? SPR.heart : SPR.heartE, { o: OUT, r: '#ff4d6d', w: '#ffffff' });
  } else {
    const hp = Math.max(0, Math.min(100, G.judge.state.hp ?? 100));
    sprite(b, 3, 13, SPR.heart, { o: OUT, r: '#ff4d6d', w: '#ffffff' });
    gauge(b, 13, 15, Math.min(56, W - 70), 3, hp / 100, hp > 50 ? '#5fd35f' : hp > 25 ? '#ffc21a' : '#ff4d4d');
  }
  if (G.shield) { rect(b, 13 + Math.min(56, W - 70) + 4, 13, 6, 7, OUT); rect(b, 13 + Math.min(56, W - 70) + 5, 14, 4, 5, '#4d9cff'); }
  const pb = G.pauseBox;
  rbox(b, pb.x - 1, pb.y - 1, pb.w + 2, pb.h + 2, OUT, 2);
  rbox(b, pb.x, pb.y, pb.w, pb.h, '#ffdd8e', 2);
  rbox(b, pb.x + 2, pb.y + 2, pb.w - 4, pb.h - 4, '#e8501f', 1);
  rect(b, pb.x + 4, pb.y + 4, 2, 6, '#ffdd8e'); rect(b, pb.x + 8, pb.y + 4, 2, 6, '#ffdd8e');
  if (G.banners.length) {
    const y = G.hudH + 4;
    rect(b, 0, y, W, 13, OUT);
    rect(b, 0, y + 1, W, 11, '#24123f');
  }
}

/** 큰 단추 둘 — 눌리면 3칸 내려가고 그림자가 사라진다(누르는 맛) */
function drawButtons() {
  const b = G.b;
  const draw = (bt, lane) => {
    const locked = lane === 'L' && G.jumpOnly;                         // 잠긴 ROPE — 회색 · 눌리지 않는다
    const down = !locked && G.down[lane];
    const face = locked ? '#4a4560' : lane === 'L' ? (down ? '#2a5fc8' : '#3a7be8') : (down ? '#d9561a' : '#ff7a1a');
    const hi = locked ? '#6e6888' : lane === 'L' ? '#9cc4ff' : '#ffd08a';
    const lo = locked ? '#2a2638' : lane === 'L' ? '#1a3a7a' : '#8a2a00';
    const y = bt.y + (down ? 3 : 0);
    if (!down) rbox(b, bt.x, bt.y + 4, bt.w, bt.h, 'rgba(0,0,0,0.55)', 4);
    rbox(b, bt.x - 1, y - 1, bt.w + 2, bt.h + 2, OUT, 4);
    rbox(b, bt.x, y, bt.w, bt.h, face, 4);
    rect(b, bt.x + 4, y + 1, bt.w - 8, 2, hi);
    rect(b, bt.x + 4, y + bt.h - 3, bt.w - 8, 2, lo);
    if (down) for (let i = 0; i < bt.w; i += 2) { rect(b, bt.x + i, y - 3, 1, 1, '#ffffff'); }
    bt.labelY = y + bt.h / 2;
    if (locked) drawLock(b, bt.x + 5, y + bt.h - 15);
  };
  draw(G.btnL, 'L');
  draw(G.btnR, 'R');
}

function drawReadyPanel() {
  const b = G.b;
  for (let y = G.hudH; y < G.btnTop; y++) for (let x = (y % 2); x < G.W; x += 2) rect(b, x, y, 1, 1, 'rgba(8,4,20,0.6)');
  const pw = Math.min(G.W - 10, 150), ph = 86;
  const x = Math.floor((G.W - pw) / 2), y = Math.max(G.hudH + 6, Math.floor(G.floorY / 2) - 46);
  rbox(b, x - 1, y - 1, pw + 2, ph + 2, OUT, 3);
  rbox(b, x, y, pw, ph, '#2b1a4a', 3);
  rect(b, x + 3, y + 2, pw - 6, 1, '#ffd23f');
  rect(b, x + 3, y + ph - 3, pw - 6, 1, '#ffd23f');
  G.readyBox = { x, y, w: pw, h: ph };
}

/* ---------- 글자 (Neo둥근모 16px 배수 · 단추만 프리텐다드) ---------- */
function fontPx(level) { return 16 * Math.max(1, Math.round(level * G.dpr)); }
function ptxt(text, nx, ny, level, color, align = 'center', outline = true, family = NEO, weight = '') {
  const ctx = G.ctx;
  const size = family === NEO ? fontPx(level) : Math.round(level * 16 * G.dpr);
  ctx.font = `${weight} ${size}px ${family}`;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  const w = Math.round(ctx.measureText(text).width);
  let x = Math.round(nx * G.S);
  if (align === 'center') x = Math.round(x - w / 2);
  else if (align === 'right') x -= w;
  const y = Math.round(ny * G.S - size * (family === NEO ? 0.5 : 0.56));
  if (outline) {
    const o = Math.max(1, Math.round(size / (family === NEO ? 16 : 14)));
    ctx.fillStyle = '#1b0f0a';
    for (const [dx, dy] of [[-o, 0], [o, 0], [0, -o], [0, o], [-o, -o], [o, -o], [-o, o], [o, o], [0, o * 2], [o, o * 2], [-o, o * 2]]) ctx.fillText(text, x + dx, y + dy);
  }
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  return w / G.S;
}

function drawTexts() {
  const st = G.judge.state;
  const W = G.W;
  const bpm = Math.round(bpmAt(G.tempo, Math.max(0, stepAtTime(G.chart.steps, Math.max(0, G.songT))) / 16));
  ptxt(`${(st.score | 0).toLocaleString('en-US')}`, W - 20, 17, 0.75, '#ffe9a8', 'right');
  ptxt(G.surv ? `R${Math.max(1, G.round + 1)} · BPM ${bpm}` : `BPM ${bpm}`, 4, 27, 0.75, bpm >= 150 ? '#ff9a3c' : '#c9e8ff', 'left');
  if (G.surv && G.status) ptxt(`생존 ${G.status.aliveCount}/${G.status.total}`, W - 20, 27, 0.75, G.out ? '#ff9a9a' : '#9be36f', 'right');
  if ((st.combo | 0) >= 2) {
    const c = st.combo | 0;
    const bounce = G.pops.length && G.pops[G.pops.length - 1].age < 0.08 && G.pops[G.pops.length - 1].grade === 'perfect' ? 0.3 : 0;
    ptxt(String(c), G.cx, 30 - bounce * 4, 2.5 + bounce, c >= 100 ? '#ff7fd1' : c >= 50 ? '#ffd23f' : '#ffffff');
    ptxt('COMBO', G.cx, 41, 0.75, '#ffe9a8');
  }
  if (G.banners.length) {
    const bn = G.banners[G.banners.length - 1];
    if (!(bn.age > 1.2 && Math.floor(bn.age * 12) % 2)) ptxt(bn.text, G.cx, G.hudH + 10.5, 1, bn.color);
  }
  for (const p of G.pops) {
    const x = (p.lane === 'L' ? G.xL : G.xR) + G.laneW / 2;
    const y = G.floorY - 22 - Math.round(p.age * 14);
    if (p.age > 0.4 && Math.floor(p.age * 24) % 2) continue;
    ptxt(GRADE_TXT[p.grade], x, y, p.grade === 'perfect' ? 1 : 0.75, GRADE_COL[p.grade]);
  }
  /* 단추 글자 — 프리텐다드 블랙, 단추 한가운데 큼직하게 */
  for (const [bt, label] of [[G.btnL, 'ROPE'], [G.btnR, 'JUMP']]) {
    const lv = Math.max(1.6, Math.min(3, (bt.h * G.S) / (16 * G.dpr) * 0.5));
    const locked = bt === G.btnL && G.jumpOnly;
    const ly = bt.labelY ?? (bt.y + bt.h / 2);
    ptxt(label, bt.x + bt.w / 2, ly - (locked ? 5 : 0), lv, locked ? '#8f89a8' : '#ffffff', 'center', true, PRET, 900);
    if (locked) ptxt('Lv.20 해금', bt.x + bt.w / 2 + 5, ly + bt.h / 2 - 7, 0.75, '#c9c2dc', 'center', true);
  }
  /* 잠긴 ROPE 를 눌렀다 — 잠깐 안내 */
  if (G.jumpOnly && G.t - G.lockAt < 1.1 && !(G.t - G.lockAt > 0.8 && Math.floor(G.t * 12) % 2)) {
    ptxt('JUMP 만 누르면 돼요!', G.cx, G.btnTop - 8, 0.75, '#ffd23f');
  }
  if (G.phase === 'ready' && G.readyBox) {
    const rb = G.readyBox;
    ptxt(G.title, G.cx, rb.y + 11, 1, '#ffd23f');
    ptxt(G.sub, G.cx, rb.y + 23, 0.75, '#c9b8ff', 'center', false);
    const tempo = G.tempo;
    const bpms = tempo.map((x) => x.bpm);
    ptxt(`BPM ${Math.min(...bpms)}~${Math.max(...bpms)} · ${DIFFS[G.diff].label}${G.jumpOnly ? '' : ' · 하드 모드'}`, G.cx, rb.y + 35, 0.75, '#ffffff', 'center', false);
    ptxt(G.jumpOnly ? '오른쪽 JUMP 버튼 하나만!' : '왼쪽 ROPE  ·  오른쪽 JUMP', G.cx, rb.y + 48, 0.75, '#9be36f', 'center', false);
    ptxt(G.surv ? `하트 ${SURVIVAL.hearts}개 · 8마디마다 빨라져요` : G.jumpOnly ? '줄이 동그란 원에 쏙 들어올 때!' : '박 = JUMP · 엇박 = ROPE', G.cx, rb.y + 59, 0.75, '#ffffff', 'center', false);
    if (G.surv) ptxt(G.startMs ? `곧 시작! ${Math.max(0, Math.ceil((G.startMs - performance.now()) / 1000))}` : '시작 시각 맞추는 중…', G.cx, rb.y + rb.h - 11, 1, '#ffd23f');
    else if (Math.floor(G.t * 2.2) % 2 === 0) ptxt('아무 단추나 누르면 시작!', G.cx, rb.y + rb.h - 11, 1, '#ffffff');
  } else if (G.phase === 'play' && G.songT < 0) {
    const beat = 60 / G.tempo[0].bpm;
    const n = Math.ceil(-G.songT / beat);
    if (n >= 1 && n <= 4) ptxt(String(n), G.cx, G.floorY - 60 * G.K / 1.4, 4, '#ffffff');
  } else if (G.phase === 'resume') {
    ptxt(String(Math.max(1, 3 - Math.floor(G.phaseT / 0.4))), G.cx, G.floorY - 80, 4, '#ffffff');
  } else if (G.phase === 'end') {
    const r = G.result?.r;
    const endTxt = G.surv ? (r?.won ? 'WINNER!' : `${r?.rank || '-'}등`) : r?.cleared ? (G.opts.mode === 'endless' ? 'FINISH!' : 'CLEAR!') : 'FAILED';
    ptxt(endTxt, G.cx, G.floorY - 70 * G.K / 1.5, 3, (G.surv ? r?.won : r?.cleared) ? '#ffd23f' : '#ff7a7a');
  }
}

/* ---------- DOM 창: 일시정지 · 결과 ---------- */
function hideOverlay() { G.overlay?.remove(); G.overlay = null; }
function btn(label, cls, fn) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = `pbtn ${cls || ''}`;
  b.textContent = label;
  b.addEventListener('click', fn);
  return b;
}
function div(cls, text) { const d = document.createElement('div'); d.className = cls; if (text != null) d.textContent = text; return d; }
function starPix(on) {
  const c = document.createElement('canvas');
  c.width = 11; c.height = 11;
  sprite(c.getContext('2d'), 0, 0, [
    '.....o.....', '....oyo....', '....oyo....', 'oooooyyoooo', 'oyywyyyyyyo', '.oywyyyyyo.', '..oyyyyyo..', '.oyyyoyyyo.', '.oyyo.oyyo.', 'oyoo...ooyo', 'oo.......oo',
  ], on ? { o: '#5a3a00', y: '#ffd23f', w: '#fff6b0' } : { o: '#3a2a5a', y: '#4a3a6a', w: '#5a4a7a' });
  c.className = `rb-star${on ? ' on' : ''}`;
  return c;
}

function showPause() {
  hideOverlay();
  const o = div('rb-ov');
  const card = div('rb-card');
  card.append(div('rb-title', 'PAUSE'));
  let soundOn = G.opts.opts?.sound !== false;
  const sb = btn(soundOn ? '소리 끄기' : '소리 켜기', '', () => {
    soundOn = !soundOn; G.music.setEnabled?.(soundOn); G.opts.onSound?.(soundOn); sb.textContent = soundOn ? '소리 끄기' : '소리 켜기';
  });
  card.append(
    btn('계속하기', 'primary', () => resume()),
    btn('처음부터 다시', '', () => G.opts.onExit('retry')),
    sb,
    btn(G.opts.mode === 'test' ? '만들기로 돌아가기' : '그만하기', '', () => G.opts.onExit('lobby')),
  );
  o.append(card);
  G.host.append(o);
  G.overlay = o;
}

function showResult() {
  setPhase('result');
  hideOverlay();
  const { r, sum } = G.result || { r: {}, sum: null };
  if (G.surv) { showSurvResult(r, sum); return; }
  const o = div('rb-ov');
  const card = div('rb-card rb-result');
  card.append(div('rb-title', r.cleared ? (G.opts.mode === 'endless' ? `${r.count}번 넘었어요!` : 'STAGE CLEAR!') : (G.opts.mode === 'endless' ? `${r.count}번 넘었어요!` : '줄에 걸려 탈락!')));
  const top = div('rb-top');
  top.append(div(`rb-rank r${r.rank}`, r.rank));
  const right = div('rb-top-r');
  if (G.opts.mode === 'stage') {
    const stars = div('rb-stars');
    for (let i = 0; i < 3; i++) {
      const on = i < (r.stars | 0);
      const s = starPix(on);
      s.style.animationDelay = `${0.2 + i * 0.25}s`;
      stars.append(s);
      if (on) setTimeout(() => G?.music.hit('combo', { n: (i + 1) * 10 }), 200 + i * 250);
    }
    right.append(stars);
  }
  right.append(div('rb-score', (r.score | 0).toLocaleString('en-US')), div("rb-acc", `정확도 ${Number(r.accuracy || 0).toFixed(1)}%`));
  top.append(right);
  card.append(top);
  if (sum?.newBest) card.append(div('rb-best', '★ NEW RECORD ★'));
  const grid = div('rb-grid');
  const cell = (k, v, cls = '') => { const c = div(`rb-cell ${cls}`); c.append(div('rb-k', k), div('rb-v', v)); grid.append(c); };
  cell('PERFECT', `${r.perfect}`, 'p'); cell('GREAT', `${r.great}`, 'g'); cell('GOOD', `${r.good}`, 'o');
  cell('MISS', `${r.miss}`, 'm'); cell('MAX COMBO', `${r.maxCombo}`); cell('기술', `${r.techCleared}/${r.techTotal}`);
  card.append(grid);
  if (sum) {
    const rw = div('rb-reward');
    rw.append(div('rb-rw', `경험치 +${sum.xp}`));
    if (sum.candy) rw.append(div('rb-rw candy', `별사탕 +${sum.candy}`));
    card.append(rw);
    if (sum.lvAfter > sum.lvBefore) card.append(div('rb-up', `LEVEL UP! Lv.${sum.lvAfter}`));
    const got = [...(sum.newRopes || []).map((x) => `새 줄넘기 · ${x.name}`), ...(sum.newParts || []).map((x) => `새 꾸미기 · ${x.name}`)];
    if (got.length) {
      const g = div('rb-got');
      g.append(div('rb-got-h', '새로 얻었어요!'));
      for (const s of got.slice(0, 6)) g.append(div('rb-got-i', s));
      card.append(g);
    }
  }
  const row = div('rb-row');
  row.append(btn('다시 하기', r.cleared ? '' : 'primary', () => G.opts.onExit('retry')));
  if (G.opts.mode === 'stage' && r.cleared && G.opts.hasNext) row.append(btn('다음 대회', 'primary', () => G.opts.onExit('next')));
  card.append(row);
  card.append(btn(G.opts.mode === 'test' ? '만들기로 돌아가기' : '로비로', '', () => G.opts.onExit('lobby')));
  o.append(card);
  G.host.append(o);
  G.overlay = o;
}

/** 서바이벌 결과 — 순위표(방 기록이 바뀌면 그 자리에서 고쳐진다) · 보상 · 같은 방에서 한 판 더 */
function showSurvResult(r, sum) {
  const o = div('rb-ov');
  const card = div('rb-card rb-result');
  card.append(div('rb-title', r.won ? '🏆 우승!' : `${r.rank}등 / ${r.total}명`));
  card.append(div('rb-acc', r.won ? '마지막까지 줄에 안 걸렸어요!' : '다음 판엔 끝까지 살아남아요!'));
  const box = div('rb-rk-list big');
  G.rankBox = box;
  rankRows(G.status || { ranking: [], over: true }, box);
  card.append(box);
  const grid = div('rb-grid');
  const cell = (k, v, cls = '') => { const c = div(`rb-cell ${cls}`); c.append(div('rb-k', k), div('rb-v', v)); grid.append(c); };
  cell('점수', (r.score | 0).toLocaleString('en-US')); cell('PERFECT', `${r.perfect}`, 'p'); cell('MAX COMBO', `${r.maxCombo}`);
  card.append(grid);
  if (sum) {
    const rw = div('rb-reward');
    rw.append(div('rb-rw', `경험치 +${sum.xp}`));
    if (sum.candy) rw.append(div('rb-rw candy', `별사탕 +${sum.candy}`));
    card.append(rw);
    if (sum.lvAfter > sum.lvBefore) card.append(div('rb-up', `LEVEL UP! Lv.${sum.lvAfter}`));
  }
  card.append(btn('같은 방에서 한 판 더', 'primary', () => G.opts.onExit('rematch')), btn('나가기', '', () => G.opts.onExit('lobby')));
  o.append(card);
  G.host.append(o);
  G.overlay = o;
}

/** 시험 도구용 */
export function _debug() {
  if (!G) return null;
  const st = G.judge.state;
  return {
    phase: G.phase, songT: G.songT, duration: G.chart.duration, notes: G.chart.notes.length, ctrl: G.jumpOnly ? 'jump' : 'both',
    score: st.score, combo: st.combo, maxCombo: st.maxCombo, hp: st.hp, perfect: st.perfect, great: st.great, good: st.good, miss: st.miss, alive: st.alive,
    result: G.result, W: G.W, H: G.H, S: G.S, K: G.K, hearts: G.hearts, out: G.out, surv: G.surv, status: G.status ? { aliveCount: G.status.aliveCount, total: G.status.total, over: G.status.over, ranking: G.status.ranking.map((x) => x.uid) } : null,
    setAuto(m) { G.auto = m || null; },
    next() { const n = G.chart.notes.find((m) => !m.done && m.lane !== 'L' && m.t >= G.songT - 0.08); return n ? n.t - G.songT : null; },
    start() { G.music.init(); if (G.phase === 'ready') startSong(); },
  };
}

const CSS = `
@font-face { font-family: 'PretendardV'; src: url('https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/web/variable/woff2/PretendardVariable.woff2') format('woff2'); font-weight: 45 920; font-display: swap; }
.rb-host { position: relative; width: 100%; height: 100%; overflow: hidden; touch-action: none; user-select: none; -webkit-user-select: none; background: #0a0618; }
.rb-canvas { display: block; touch-action: none; image-rendering: pixelated; }
.rb-ov { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(8,4,20,0.66); padding: 14px; overflow-y: auto; }
.rb-card { width: min(340px, 100%); background: #1f1238; padding: 14px 12px; display: flex; flex-direction: column; gap: 8px; color: #fff4d6; max-height: 100%; overflow-y: auto;
  box-shadow: 0 -3px 0 0 #ffdd8e, 0 3px 0 0 #ffdd8e, -3px 0 0 0 #ffdd8e, 3px 0 0 0 #ffdd8e, 0 -6px 0 0 #600f09, 0 6px 0 0 #600f09, -6px 0 0 0 #600f09, 6px 0 0 0 #600f09, 0 10px 0 0 rgba(0,0,0,0.45); }
.rb-title { text-align: center; font-size: 24px; color: #ffd23f; text-shadow: 2px 2px 0 #1b0f0a; }
.rb-top { display: flex; align-items: center; gap: 12px; justify-content: center; }
.rb-rank { font-family: 'PretendardV', sans-serif; font-weight: 900; font-size: 64px; line-height: 1; color: #ffd23f; text-shadow: 3px 3px 0 #600f09, -2px -2px 0 #1b0f0a; animation: rbRank .5s steps(5) both; }
.rb-rank.rS { color: #ffe14d; } .rb-rank.rA { color: #7cf09a; } .rb-rank.rB { color: #6fe3ff; } .rb-rank.rC { color: #c9b8ff; } .rb-rank.rD { color: #ff9a9a; }
@keyframes rbRank { 0% { transform: scale(2.4); opacity: 0 } 100% { transform: scale(1); opacity: 1 } }
.rb-top-r { display: flex; flex-direction: column; gap: 3px; align-items: flex-start; }
.rb-stars { display: flex; gap: 4px; }
.rb-star { width: 33px; height: 33px; image-rendering: pixelated; }
.rb-star.on { animation: rbStar .4s steps(4) both; }
@keyframes rbStar { 0% { transform: scale(0.25); opacity: 0 } 60% { transform: scale(1.3) } 100% { transform: scale(1) } }
.rb-score { font-family: 'PretendardV', sans-serif; font-weight: 900; font-size: 26px; color: #fff; text-shadow: 2px 2px 0 #1b0f0a; }
.rb-acc { font-size: 13px; color: #c9b8ff; }
.rb-best { text-align: center; color: #ff8fd1; font-size: 16px; animation: rbBlink 0.5s steps(2) infinite; }
@keyframes rbBlink { 50% { opacity: 0.35 } }
.rb-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; }
.rb-cell { background: #150c28; padding: 5px 2px; text-align: center; box-shadow: inset 0 0 0 2px #3d2766; }
.rb-cell.p .rb-v { color: #ffd23f; } .rb-cell.g .rb-v { color: #6fe3ff; } .rb-cell.o .rb-v { color: #9be36f; } .rb-cell.m .rb-v { color: #ff7a7a; }
.rb-k { font-size: 10px; color: #c9b8ff; }
.rb-v { font-size: 17px; }
.rb-reward { display: flex; justify-content: center; gap: 14px; font-size: 16px; }
.rb-rw.candy { color: #ffb3de; }
.rb-up { text-align: center; color: #7cf09a; font-size: 18px; animation: rbBlink 0.4s steps(2) infinite; }
.rb-got { background: #3a2a10; padding: 6px; box-shadow: inset 0 0 0 2px #ffd23f; }
.rb-got-h { color: #ffd23f; text-align: center; font-size: 14px; margin-bottom: 3px; }
.rb-got-i { font-size: 13px; text-align: center; }
.rb-row { display: flex; gap: 8px; }
.rb-row > * { flex: 1; }
.rb-card .pbtn { font-size: 16px; padding: 9px 8px; }
.rb-spec { position: absolute; left: 6px; right: 6px; top: 46px; background: rgba(20,10,40,0.82); padding: 6px; pointer-events: none; color: #fff4d6; font-size: 12px; box-shadow: 0 0 0 2px #ffdd8e, 0 0 0 4px #600f09; }
.rb-spec-h { text-align: center; color: #ff9a9a; font-size: 13px; margin-bottom: 4px; }
.rb-rk-list { display: flex; flex-direction: column; gap: 2px; }
.rb-rk { display: grid; grid-template-columns: 22px 1fr auto 64px; gap: 6px; align-items: center; padding: 2px 4px; background: #150c28; opacity: 0.6; }
.rb-rk.on { opacity: 1; }
.rb-rk.me { box-shadow: inset 0 0 0 2px #ffd23f; }
.rb-rk-n { text-align: center; color: #ffd23f; }
.rb-rk-name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rb-rk-h { color: #ff6b8a; letter-spacing: -1px; }
.rb-rk-s { text-align: right; color: #ffe9a8; }
.rb-rk-list.big .rb-rk { font-size: 14px; padding: 4px 6px; }
`;
