/**
 * 줄넘기 챔피언 — 게임 한 판. (2026-11-07, 이안오락실 5번째 게임 · 픽셀아트판)
 *
 *   mount(host, opts) · unmount() · requestPause()
 *
 * 화면 래퍼(`screens/JumpRopeGame.js`)가 붙였다 뗀다. 저장 · 보상 계산은 래퍼가 하고(onFinish 가
 * 요약을 돌려준다), 여기서는 줄을 돌리고 판정하고 그린다. 판정 규칙은 전부 `engine.js` 에 있다.
 *
 * ## 그림 (권반장 규칙: 픽셀아트만)
 * 장면은 **저해상도 버퍼**(짧은 변 ≈ 150칸)에 도트로 그리고, 화면에는 **정수배 nearest** 로 키운다.
 * 글자만 큰 캔버스에 Neo둥근모(16px 배수)로 찍는다 — 신발을 찾아서 · 드래곤 스트라이커와 같은 방식.
 *
 * ## 흐름
 *   intro(스테이지 소개 · 누르면 시작) → count(3·2·1) → play ⇄ trip(걸려 넘어짐 1.3초) → end(축하/아쉬움) → 결과 카드
 *   pause 는 어디서든(뒤로가기 · ESC · 창 전환 · 오른쪽 위 단추). 다시 이으면 1초 «준비» 뒤에 줄이 돈다.
 *
 * ## 시간
 * «줄 시계» rt 는 play 일 때만 흐른다. 누른 순간은 마지막 프레임 이후 흐른 시간까지 더해 잰다.
 */

import * as E from './engine.js';
import { drawBg, drawKid, kidHands, ropeGeom, drawRope, drawHandles, drawParticle, rect, rbox, obox, sprite, tone, oval, px, SPR, OUT } from './art.js';
import { createAudio } from './audio.js';

const TRIP_TIME = 1.3;
const COUNT_STEP = 0.62;
const JUMP_H = 13, JUMP_H_HIGH = 23;      // 뛰는 높이(도트)
const SHORT_SIDE = 128;                   // 버퍼 짧은 변(도트) — 신발을 찾아서처럼 큼직한 도트
const FONT = "'Neo둥근모', 'Courier New', monospace";

let G = null;
let styleOn = false;

/**
 * @param {HTMLElement} host
 * @param {{mode:'stage'|'endless'|'test', stage?:object, stageNo?:number, diff:string, endlessShift?:number,
 *          look:object, rope:object, items?:{shield?:boolean, heart?:boolean, candy2?:boolean},
 *          opts?:{sound?:boolean, vib?:boolean}, best?:number, hasNext?:boolean,
 *          onFinish:(r:object)=>object, onExit:(kind:'retry'|'next'|'lobby')=>void, onSound?:(on:boolean)=>void}} opts
 */
export function mount(host, opts) {
  unmount();
  if (!styleOn) { const st = document.createElement('style'); st.textContent = CSS; document.head.append(st); styleOn = true; }
  host.innerHTML = '';
  host.classList.add('jrg-host');
  const cv = document.createElement('canvas');
  cv.className = 'jrg-canvas';
  host.append(cv);
  const buf = document.createElement('canvas');

  const au = createAudio();
  au.setOn(opts.opts?.sound !== false);

  G = {
    host, cv, ctx: cv.getContext('2d'), buf, b: buf.getContext('2d'), opts, au,
    W: 150, H: 300, S: 1, dpr: 1,
    mode: opts.mode, diff: opts.diff,
    phase: 'intro', phaseT: 0, prevPhase: null,
    rt: 0, frameMs: 0, raf: 0, t: 0,
    beats: [], k: 0,
    jump: null, pressing: false, landAt: -9,
    hearts: 3, heartsMax: 3, heartsLost: 0, shield: false,
    score: 0, combo: 0, maxCombo: 0, perfect: 0, great: 0, good: 0, miss: 0, count: 0, total: 0,
    pops: [], parts: [], cue: null, flash: 0, shake: 0,
    tripWhy: null, endT: 0, cleared: false, result: null, overlay: null,
    auto: null, autoRelease: -1, autoPressedK: -1,
    endless: null, lastTrail: 0,
  };
  setupRun();
  resize();

  /* 입력 — 오른쪽 위 일시정지 칸만 빼고 화면 어디를 눌러도 점프 */
  const toNative = (e) => {
    const r = cv.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * G.dpr) / G.S, y: ((e.clientY - r.top) * G.dpr) / G.S };
  };
  const down = (e) => {
    if (G.overlay) return;
    e.preventDefault();
    au.init();
    const p = toNative(e);
    const pb = G.pauseBox;
    if (p.x >= pb.x - 3 && p.x <= pb.x + pb.w + 3 && p.y >= pb.y - 3 && p.y <= pb.y + pb.h + 3) { requestPause(); return; }
    if (G.phase === 'intro') { startCount(); return; }
    press();
  };
  const up = () => release();
  cv.addEventListener('pointerdown', down);
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', up);
  const kd = (e) => {
    if (e.repeat) return;
    if (e.code === 'Escape' || e.code === 'KeyP') { requestPause(); return; }
    if (['Space', 'ArrowUp', 'KeyW', 'Enter'].includes(e.code)) {
      if (G.overlay) return;
      e.preventDefault();
      au.init();
      if (G.phase === 'intro') { startCount(); return; }
      press();
    }
  };
  const ku = (e) => { if (['Space', 'ArrowUp', 'KeyW', 'Enter'].includes(e.code)) release(); };
  window.addEventListener('keydown', kd);
  window.addEventListener('keyup', ku);
  const vis = () => { if (document.hidden) requestPause(); };
  document.addEventListener('visibilitychange', vis);
  window.addEventListener('blur', vis);
  const ro = new ResizeObserver(() => resize());
  ro.observe(host);
  G.off = () => {
    cv.removeEventListener('pointerdown', down);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', up);
    window.removeEventListener('keydown', kd);
    window.removeEventListener('keyup', ku);
    document.removeEventListener('visibilitychange', vis);
    window.removeEventListener('blur', vis);
    ro.disconnect();
  };

  G.frameMs = performance.now();
  G.raf = requestAnimationFrame(loop);
  /* 시험 도구가 모듈 주소(?t=…)와 상관없이 같은 판을 보게 */
  window.__jrDebug = _debug;
}

export function unmount() {
  if (!G) return;
  cancelAnimationFrame(G.raf);
  G.off?.();
  G.au.close();
  G.host.innerHTML = '';
  G.host.classList.remove('jrg-host');
  G = null;
}

/** 뒤로가기 · ESC · 창 전환 — 판 중이면 일시정지 창을 띄운다. 이미 결과 화면이면 로비로 */
export function requestPause() {
  if (!G) return;
  if (G.phase === 'result') { G.opts.onExit('lobby'); return; }
  if (G.phase === 'pause') { resume(); return; }
  if (G.phase === 'end') return;
  G.prevPhase = G.phase;
  setPhase('pause');
  release();
  showPause();
}

/* ---------- 판 준비 ---------- */
function shiftSeg(seg, dv) {
  if (!dv) return seg;
  const c = (v) => Math.max(E.SPEED_MIN, Math.min(E.SPEED_MAX, v + dv));
  const o = { ...seg };
  if (o.v != null) o.v = c(o.v);
  if (o.a != null) o.a = c(o.a);
  if (o.b != null) o.b = c(o.b);
  return o;
}

function setupRun() {
  const o = G.opts;
  const it = o.items || {};
  if (G.mode === 'endless') {
    const D = { easy: 'e', normal: 'n', hard: 'h' };
    G.margin = E.JUDGE[D[o.diff] || 'n'];
    G.ring = o.ring ?? (o.diff === 'easy');
    G.theme = 7;
    G.heartsMax = 1 + (o.diff === 'easy' ? 1 : 0) + (it.heart ? 1 : 0);
    const seed = (Date.now() & 0xffff) + 1;
    G.endless = { rand: E.seeded(seed), seg: 0, shift: o.endlessShift || 0 };
    G.beats = [];
    G.total = 0;
    topUpEndless();
    G.title = '무한 줄넘기';
  } else {
    const st = o.stage;
    G.margin = E.JUDGE[st.judge] ?? E.JUDGE.n;
    G.ring = st.ring !== false;
    G.theme = st.theme | 0;
    G.heartsMax = Math.max(1, Math.min(6, (st.hearts || 3) + (it.heart ? 1 : 0)));
    G.beats = E.buildBeats(st, (o.seed || 7) + (o.stageNo | 0) * 13);
    G.total = G.beats.length;
    G.title = o.mode === 'test' ? `${st.name} (시험)` : `${o.stageNo}. ${st.name}`;
  }
  G.hearts = G.heartsMax;
  G.shield = !!it.shield;
}

function topUpEndless() {
  const en = G.endless;
  while (G.beats.length - G.k < 8) {
    const last = G.beats[G.beats.length - 1];
    const seg = shiftSeg(E.endlessSeg(G.beats.length, en.rand), en.shift);
    const part = E.expandSeg(seg, last ? last.t : 0, en.rand, en.seg++, en.seg > 1);
    G.beats.push(...part);
  }
}

function setPhase(p) { G.phase = p; G.phaseT = 0; }

function startCount() {
  if (G.phase !== 'intro') return;
  setPhase('count');
  G.au.play('tick');
}

function resume() {
  hideOverlay();
  setPhase('resume');
}

/* ---------- 시간 ---------- */
function rtNow() {
  if (G.phase !== 'play') return G.rt;
  return G.rt + Math.min(0.12, (performance.now() - G.frameMs) / 1000);
}
/** 이 점프의 체공 — 꾹 누르고 있으면 높이 점프 */
function airOf(j, at) {
  if (!j) return E.AIR;
  const held = (j.releaseT ?? Infinity) - j.t;
  if (held >= E.HOLD_HIGH) return (j.releaseT != null || at - j.t >= E.HOLD_HIGH) ? E.AIR_HIGH : E.AIR;
  return E.AIR;
}

/* ---------- 입력 ---------- */
function press(fromAuto) {
  if (!G || G.phase !== 'play') return;
  if (!fromAuto && G.auto) return;
  const t = rtNow();
  const j = G.jump;
  if (j && t < j.t + airOf(j, t)) return;          // 아직 공중
  G.jump = { t, releaseT: null, high: false };
  G.pressing = true;
  G.au.play('jump');
  for (let i = 0; i < 4; i++) dust(G.cx + (i - 1.5) * 4, G.gy);
}
function release() {
  if (!G) return;
  G.pressing = false;
  if (G.jump && G.jump.releaseT == null) G.jump.releaseT = G.phase === 'play' ? rtNow() : G.rt;
}

/* ---------- 판정 ---------- */
function judge(i) {
  const b = G.beats[i];
  const j = G.jump && G.jump.t <= b.t ? G.jump : null;
  const air = j ? airOf(j, b.t) : E.AIR;
  const res = E.judgeCrossing(b.t, j ? { t: j.t, air } : null, G.margin, b.apex);
  G.au.play('swish', { pitch: G.opts.rope?.snd || 1 });
  if (res.ok) pass(b, res);
  else if (G.shield) { G.shield = false; G.au.play('shield'); pop('보호막!', '#7fc8ff', 2); G.count += 1; burst('spark', 10); }
  else { fail(i, b, res); return; }
  G.k = i + 1;
  afterBeat(i);
}

function pass(b, res) {
  G.combo += 1;
  G.maxCombo = Math.max(G.maxCombo, G.combo);
  G[res.grade] += 1;
  G.count += 1;
  const pts = E.scoreFor(res.grade, G.combo);
  G.score += pts;
  const C = { perfect: ['PERFECT!', '#ffd23f'], great: ['GREAT!', '#6fe3ff'], good: ['GOOD', '#9be36f'] }[res.grade];
  pop(C[0], C[1], 2, `+${pts}`);
  G.au.play(res.grade);
  if (res.grade === 'perfect') burst(G.opts.rope?.trail || 'spark', 8);
  if (G.combo > 0 && G.combo % 10 === 0) { G.au.play('combo'); pop(`${G.combo} 콤보!`, '#ff8fd1', 1.5, null, -18); G.flash = 0.25; }
}

function fail(i, b, res) {
  G.miss += 1;
  G.combo = 0;
  G.hearts -= 1;
  G.heartsLost += 1;
  G.tripWhy = res.why;
  G.jump = null;
  G.pressing = false;
  G.shake = 0.35;
  G.au.play('trip');
  if (G.opts.opts?.vib !== false) try { navigator.vibrate?.(80); } catch { /* */ }
  pop(res.why === 'early' ? '일찍 뛰었어요!' : '늦게 뛰었어요!', '#ff6b6b', 1.5);
  /* 2단 첫 줄에 걸리면 둘째 줄도 지나간 것으로 */
  let end = i;
  if (b.kind === 'd1' && G.beats[i + 1]?.kind === 'd2') { end = i + 1; G.miss += 1; }
  G.k = end + 1;
  G.rt = G.beats[end].t;
  if (G.mode === 'endless') topUpEndless();
  setPhase('trip');
}

function afterBeat(i) {
  if (G.mode === 'endless') topUpEndless();
  /* 다음다음 바퀴의 예고 — 한 바퀴 먼저 띄운다 */
  const nb = G.beats[i + 2];
  if (nb?.cue) { G.cue = { text: nb.cue, t: 0, kind: nb.kind }; G.au.play('cue'); }
}

/* ---------- 매 프레임 ---------- */
function loop(now) {
  if (!G) return;
  const dt = Math.min(0.12, Math.max(0, (now - G.frameMs) / 1000));   // 느린 기기에서도 슬로모션이 되지 않게 (창 전환은 일시정지가 막는다)
  G.frameMs = now;
  G.t += dt;
  G.phaseT += dt;
  update(dt);
  render();
  G.raf = requestAnimationFrame(loop);
}

function update(dt) {
  const ph = G.phase;
  if (ph === 'count' && G.phaseT >= COUNT_STEP * 3) {
    setPhase('play');
    G.au.play('go');
    pop('시작!', '#ffffff', 3, null, -10);
  } else if (ph === 'count') {
    const n = Math.floor(G.phaseT / COUNT_STEP);
    if (n !== G.lastCount) { G.lastCount = n; if (n > 0) G.au.play('tick'); }
  }
  if (ph === 'resume' && G.phaseT >= 1.0) setPhase('play');
  if (ph === 'trip' && G.phaseT >= TRIP_TIME) {
    if (G.hearts <= 0) finish(false);
    else if (G.mode !== 'endless' && G.k >= G.beats.length) finish(true);
    else setPhase('play');
  }
  if (G.phase === 'play') {
    G.rt += dt;
    autoPlay();
    while (G.phase === 'play' && G.k < G.beats.length && G.beats[G.k].t <= G.rt) judge(G.k);
    if (G.phase === 'play' && G.mode !== 'endless' && G.k >= G.beats.length) {
      const last = G.beats[G.beats.length - 1];
      if (G.rt - last.t > 0.45) finish(true);
    }
    /* 착지 */
    const j = G.jump;
    if (j && !j.landed && G.rt >= j.t + airOf(j, G.rt)) { j.landed = true; G.landAt = G.t; G.au.play('land'); for (let i = 0; i < 3; i++) dust(G.cx + (i - 1) * 6, G.gy); }
    if (j && !j.high && airOf(j, G.rt) === E.AIR_HIGH) { j.high = true; G.au.play('high'); }
  }
  if (G.phase === 'end' && G.phaseT >= 1.6 && !G.overlay) showResult();
  /* 효과 */
  if (G.cue) { G.cue.t += dt; if (G.cue.t > 1.6) G.cue = null; }
  G.flash = Math.max(0, G.flash - dt);
  G.shake = Math.max(0, G.shake - dt);
  for (const p of G.pops) p.age += dt;
  G.pops = G.pops.filter((p) => p.age < p.life);
  for (const p of G.parts) { p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.g || 0) * dt; }
  G.parts = G.parts.filter((p) => p.age < p.life);
  if (G.phase === 'end' && G.cleared && Math.random() < 0.5) confetti();
}

/** 시험용 자동 플레이 — 'perfect' 는 이상적인 순간에, 'sloppy' 는 조금씩 흔들려서, 'late' 는 늘 늦게 */
function autoPlay() {
  const A = G.auto;
  if (!A) return;
  if (G.autoRelease >= 0 && G.rt >= G.autoRelease) { G.autoRelease = -1; G.pressing = false; if (G.jump && G.jump.releaseT == null) G.jump.releaseT = G.rt; }
  const b = G.beats[G.k];
  if (!b || b.kind === 'd2' || G.autoPressedK === G.k) return;
  const noise = A === 'sloppy' ? (((G.k * 7919) % 13) - 6) * 0.012 : A === 'late' ? 0.3 : 0;
  const at = E.idealPress(b) + noise;
  if (G.rt >= at) {
    G.autoPressedK = G.k;
    press(true);
    /* 프레임이 느려도 «딱 그 순간에 눌렀다 · 뗐다»로 (시험 도구 전용) */
    if (G.jump) { G.jump.t = at; G.jump.releaseT = at + (b.kind === 'd1' ? 0.3 : 0.06); }
    G.autoRelease = G.rt + 0.08;
  }
}

function finish(cleared) {
  if (G.phase === 'end' || G.phase === 'result') return;
  G.cleared = cleared;
  setPhase('end');
  G.au.play(cleared ? 'clear' : 'fail');
  const r = {
    mode: G.mode, diff: G.diff, stageNo: G.opts.stageNo | 0, cleared,
    heartsLost: G.heartsLost, perfect: G.perfect, great: G.great, good: G.good, miss: G.miss,
    score: G.score, maxCombo: G.maxCombo, count: G.count, total: G.total, used: G.opts.items || {},
  };
  try { G.result = { r, sum: G.opts.onFinish?.(r) || null }; } catch (e) { console.warn('[줄넘기] 결과 저장 실패', e); G.result = { r, sum: null }; }
}

/* ---------- 효과 (도트 단위 속도) ---------- */
function pop(text, color, size, sub = null, dy = 0) {
  G.pops.push({ text, color, size, sub, age: 0, life: 0.9, dy });
  if (G.pops.length > 4) G.pops.shift();
}
function dust(x, y) {
  G.parts.push({ kind: 'dust', x, y: y - 1, vx: (Math.random() - 0.5) * 30, vy: -8 - Math.random() * 10, g: 30, age: 0, life: 0.4 });
}
function burst(kind, n) {
  const cx = G.cx, cy = G.gy - 8;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, sp = 25 + Math.random() * 40;
    G.parts.push({ kind, x: cx + Math.cos(a) * 8, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 25, g: 55, age: 0, life: 0.8 });
  }
}
function confetti() {
  const cols = ['#ff4d4d', '#ffd23f', '#4dd27a', '#4d9cff', '#ff7fbf', '#b36bff'];
  G.parts.push({ kind: 'confetti', x: Math.random() * G.W, y: -4, vx: (Math.random() - 0.5) * 16, vy: 35 + Math.random() * 30, g: 10, age: 0, life: 3, color: cols[(Math.random() * cols.length) | 0] });
}

/* ---------- 크기 · 배치 ---------- */
function resize() {
  if (!G) return;
  const w = Math.max(1, G.host.clientWidth), h = Math.max(1, G.host.clientHeight);
  G.dpr = Math.min(2, window.devicePixelRatio || 1);
  const cw = Math.round(w * G.dpr), ch = Math.round(h * G.dpr);
  G.cv.width = cw;
  G.cv.height = ch;
  G.cv.style.width = `${w}px`;
  G.cv.style.height = `${h}px`;
  /* 도트 한 칸 = 기기 픽셀 S개 (정수) — 칸 크기가 들쭉날쭉하지 않게 */
  G.S = Math.max(1, Math.floor(Math.min(cw, ch) / SHORT_SIDE));
  G.W = Math.ceil(cw / G.S);
  G.H = Math.ceil(ch / G.S);
  G.buf.width = G.W;
  G.buf.height = G.H;
  G.b = G.buf.getContext('2d');
  G.cx = Math.floor(G.W / 2);
  const btnArea = Math.max(34, Math.min(50, Math.round(G.H * 0.15)));
  G.gy = G.H - btnArea;
  const bw = Math.min(G.W - 20, 96), bh = Math.max(22, btnArea - 12);
  G.btn = { x: Math.floor((G.W - bw) / 2), y: G.gy + 6, w: bw, h: bh };
  G.pauseBox = { x: G.W - 17, y: 3, w: 14, h: 14 };
}

/* ---------- 그리기 ---------- */
function ropeTheta() {
  if (G.phase === 'intro' || G.phase === 'count' || G.phase === 'trip') return Math.PI;
  return E.ropeAngle(G.beats, G.k, G.rt);
}

function kidPose(theta) {
  const st = G.phase === 'trip' ? 'trip' : G.phase === 'end' ? (G.cleared ? 'cheer' : 'sit') : 'stand';
  let lift = 0, tuck = 0, crouch = 0;
  const j = G.jump;
  if (st === 'stand' && j && (G.phase === 'play' || G.phase === 'pause' || G.phase === 'resume')) {
    const air = airOf(j, G.rt);
    const u = (G.rt - j.t) / air;
    if (u >= 0 && u <= 1) {
      lift = Math.round(Math.sin(u * Math.PI) * (air > E.AIR ? JUMP_H_HIGH : JUMP_H));
      tuck = lift > 3 ? 1 : 0;
    }
  }
  const sinceLand = G.t - G.landAt;
  if (lift === 0 && sinceLand < 0.1) crouch = 1;
  if (st === 'cheer') lift = Math.round(Math.abs(Math.sin(G.phaseT * 7)) * 8);
  return { state: st, lift, tuck, crouch, theta, t: G.t };
}

function render() {
  const { ctx, b } = G;
  b.imageSmoothingEnabled = false;
  const sh = G.shake > 0 ? (Math.floor(G.t * 40) % 2 ? 2 : -2) : 0;
  b.save();
  b.translate(sh, 0);
  drawBg(b, G.theme, G.W, G.H, G.gy, G.t);
  drawScene();
  b.restore();
  drawHudPixels();
  drawButton();
  drawPanels();
  if (G.flash > 0 && Math.floor(G.t * 20) % 2) { b.fillStyle = 'rgba(255,200,240,0.35)'; b.fillRect(0, 0, G.W, G.H); }
  /* 버퍼 → 화면 (정수배, 번짐 없음) */
  ctx.imageSmoothingEnabled = false;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(G.buf, 0, 0, G.W * G.S, G.H * G.S);
  drawTexts();
}

function drawScene() {
  const c = G.b;
  const x = G.cx, gy = G.gy;
  const rope = G.opts.rope;
  const theta = ropeTheta();
  const pose = kidPose(theta);
  const look = G.opts.look;

  /* 그림자 — 바둑판 디더링 */
  const sw = 11 - Math.floor(pose.lift / 4);
  for (let dx = -sw; dx <= sw; dx++) for (let dy = 0; dy < 2; dy++) if ((dx + dy) % 2 === 0) px(c, x + dx, gy + dy, 'rgba(0,0,0,0.45)');

  if (G.ring && (G.phase === 'play' || G.phase === 'resume')) drawRing(x, gy);

  const pre = kidHands(theta, x, gy, pose.lift, pose.crouch, pose.state, G.t);
  const fast = G.phase === 'play' && currentSpeed() > 7;
  const tangled = G.phase === 'trip' || (G.phase === 'end' && !G.cleared);
  const side = (front) => {
    if (fast) {
      const th2 = E.ropeAngle(G.beats, G.k, G.rt - 0.04);
      const g2 = ropeGeom(pre, x, gy, th2);
      if ((g2.depth >= 0) === front) drawRope(c, rope, g2, G.t, true);
    }
    const g = ropeGeom(pre, x, gy, theta);
    if (tangled) { g.c1 = { x: g.p0.x - 3, y: gy + 8 }; g.c2 = { x: g.p2.x + 3, y: gy + 8 }; g.apex.y = gy + 3; }
    if ((g.depth >= 0) === front || (tangled && front)) {
      const cueOn = G.cue && G.cue.t < 1 && Math.floor(G.cue.t * 12) % 2 === 0;
      drawRope(c, cueOn ? { ...rope, pattern: 'solid', c1: cueColor(G.cue.kind), glow: true, c2: '#ffffff' } : rope, g, G.t);
    }
    return g;
  };
  if (!tangled) side(false);
  const hands = drawKid(c, x, gy, look, pose);
  const gFront = side(true);
  drawHandles(c, rope, hands);

  /* 꼬리 효과 */
  if (rope.trail && G.phase === 'play' && gFront.depth > 0.2 && G.t - G.lastTrail > 0.05) {
    G.lastTrail = G.t;
    const up = rope.trail === 'fire' || rope.trail === 'bubble';
    G.parts.push({ kind: rope.trail, x: gFront.apex.x + (Math.random() - 0.5) * 22, y: gFront.apex.y, vx: (Math.random() - 0.5) * 12, vy: up ? -18 : 8, g: rope.trail === 'snow' || rope.trail === 'leaf' ? 4 : 0, age: 0, life: 0.7 });
  }
  for (const p of G.parts) drawParticle(c, p);
}

function cueColor(kind) { return kind === 'f' ? '#ff9a3c' : kind === 'd1' ? '#c77dff' : '#ffe14d'; }

function currentSpeed() {
  const bt = G.beats[G.k];
  return bt ? (1.0 - bt.d) / 0.05 + 1 : 0;
}

/** 도우미 링 — 발밑 타원 점선(목표) + 줄어드는 링. 딱 맞는 누르는 순간에 겹친다 */
function ellipsePts(cx, cy, rx, ry) {
  const out = [];
  const n = Math.max(24, Math.round((rx + ry) * 2.2));
  let last = '';
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const p = { x: Math.round(cx + Math.cos(a) * rx), y: Math.round(cy + Math.sin(a) * ry) };
    const key = p.x + ',' + p.y;
    if (key !== last) out.push(p);
    last = key;
  }
  return out;
}
function drawRing(x, gy) {
  const bt = G.beats[G.k];
  if (!bt || bt.kind === 'd2') return;
  const left = E.idealPress(bt) - G.rt;
  if (left > 0.75 || left < -0.15) return;
  const c = G.b;
  const col = cueColor(bt.kind === 'n' ? 'n' : bt.kind);
  ellipsePts(x - 0.5, gy + 1, 16, 4).forEach((p, i) => { if (i % 2 === 0) px(c, p.x, p.y, '#ffffff'); });
  const k = Math.max(0, left) / 0.75;
  for (const p of ellipsePts(x - 0.5, gy + 1, 16 + k * 30, 4 + k * 8)) { px(c, p.x, p.y, col); px(c, p.x, p.y + 1, tone(col, -0.4)); }
  if (bt.kind === 'd1') G.ringLabel = { x: x + 22, y: gy - 6, col };
  else G.ringLabel = null;
}

/* ---------- HUD (도트) ---------- */
function gauge(c, x, y, w, h, ratio, fill) {
  rect(c, x - 2, y - 2, w + 4, h + 4, OUT);
  rect(c, x - 1, y - 1, w + 2, h + 2, '#ffdd8e');
  rect(c, x, y, w, h, '#4a3428');
  const fw = Math.round(w * Math.max(0, Math.min(1, ratio)));
  if (fw > 0) { rect(c, x, y, fw, h, fill); rect(c, x, y, fw, 1, tone(fill, 0.35)); rect(c, x, y + h - 1, fw, 1, tone(fill, -0.3)); }
}
function drawHudPixels() {
  const c = G.b;
  const W = G.W;
  /* 위 게이지 — 진행(스테이지) / 콤보(무한) */
  const gw = W - 28;
  if (G.mode === 'endless') gauge(c, 4, 4, gw, 6, (G.combo % 10) / 10, '#ff4fa3');
  else gauge(c, 4, 4, gw, 6, Math.min(G.k, G.total) / Math.max(1, G.total), '#e8501f');
  /* 일시정지 단추 — 신발을 찾아서처럼 크림 테두리 주황 칸 */
  const pb = G.pauseBox;
  rbox(c, pb.x - 1, pb.y - 1, pb.w + 2, pb.h + 2, OUT, 2);
  rbox(c, pb.x, pb.y, pb.w, pb.h, '#ffdd8e', 2);
  rbox(c, pb.x + 2, pb.y + 2, pb.w - 4, pb.h - 4, '#e8501f', 1);
  rect(c, pb.x + 4, pb.y + 4, 2, 6, '#ffdd8e'); rect(c, pb.x + 8, pb.y + 4, 2, 6, '#ffdd8e');
  /* 하트 */
  for (let i = 0; i < G.heartsMax; i++) {
    const hx = 4 + i * 9, hy = 14;
    sprite(c, hx, hy, i < G.hearts ? SPR.heart : SPR.heartE, { o: OUT, r: '#ff4d6d', w: '#ffffff' });
  }
  if (G.shield && Math.floor(G.t * 3) % 4) {
    const sx = 4 + G.heartsMax * 9 + 1;
    oval(c, sx + 3, 17.5, 4, 4, OUT); oval(c, sx + 3, 17.5, 3, 3, '#4d9cff'); px(c, sx + 2, 16, '#ffffff');
  }
  /* 예고 띠 */
  if (G.cue && G.cue.t < 1.5) {
    const y = 44;
    rect(c, 0, y, W, 13, OUT);
    rect(c, 0, y + 1, W, 11, '#2a1748');
    rect(c, 0, y + 1, W, 1, tone(cueColor(G.cue.kind), -0.2));
    rect(c, 0, y + 11, W, 1, tone(cueColor(G.cue.kind), -0.2));
  }
}

/** 점프 단추 — 크림색 도트 단추(진한 외곽선 · 윗면 빛 · 아랫면 그늘 · 아래 그림자) + 빨간 화살표 */
function drawButton() {
  const c = G.b;
  const bt = G.btn;
  const down = G.pressing && G.phase === 'play';
  const high = G.jump && G.jump.high && down;
  const y = bt.y + (down ? 2 : 0);
  if (!down) rbox(c, bt.x, bt.y + 3, bt.w, bt.h, 'rgba(0,0,0,0.45)', 3);
  rbox(c, bt.x - 1, y - 1, bt.w + 2, bt.h + 2, '#600f09', 3);
  rbox(c, bt.x, y, bt.w, bt.h, high ? '#e3c4ff' : '#ffdd8e', 3);
  rect(c, bt.x + 3, y + 1, bt.w - 6, 1, '#fefffb');
  rect(c, bt.x + 3, y + bt.h - 2, bt.w - 6, 1, high ? '#a982d1' : '#cca977');
  rect(c, bt.x + 1, y + bt.h - 1 - 1, bt.w - 2, 1, high ? '#a982d1' : '#cca977');
  /* 화살표 (높이 점프면 두 개) */
  /* 빨간 위 화살표 — 신발을 찾아서 점프 단추와 같은 모양 (높이 점프면 보라 · 두 개) */
  const arrow = ['....oo....', '...orro...', '..orrlro..', '.orrrrrro.', 'orrrrrrrro', 'oooorrrooo', '...orrro..', '...orrro..', '...ooooo..'];
  const pal = { o: '#600f09', r: high ? '#8a3fd1' : '#cd4421', l: high ? '#d9b3ff' : '#ff8a5c' };
  const ax = bt.x + 6, ay = y + Math.floor(bt.h / 2) - 9;
  sprite(c, ax, ay, arrow, pal, 2);
  if (high) sprite(c, bt.x + bt.w - 26, ay, arrow, pal, 2);
  G.btnLabel = { x: bt.x + bt.w / 2 + (high ? 0 : 9), y: y + bt.h / 2, high };
}

/** 소개 · 카운트다운 · 끝 글자 판 (도트 판넬) */
function drawPanels() {
  const c = G.b;
  if (G.phase === 'intro') {
    for (let y = 0; y < G.H; y++) for (let x = (y % 2); x < G.W; x += 2) px(c, x, y, 'rgba(10,6,24,0.55)');
    const pw = Math.min(G.W - 12, 140), ph = 92;
    const x = Math.floor((G.W - pw) / 2), y = Math.max(28, Math.floor(G.gy / 2) - 50);
    obox(c, x, y, pw, ph, '#2b1a4a', 2, false);
    rect(c, x + 2, y + 2, pw - 4, 1, '#ffd23f');
    rect(c, x + 2, y + ph - 3, pw - 4, 1, '#ffd23f');
    G.introBox = { x, y, w: pw, h: ph };
  } else G.introBox = null;
}

/* ---------- 글자 (큰 캔버스에 Neo둥근모 — 16px 배수로 또렷하게) ---------- */
function fontPx(level) {
  /* level 1 = 화면 16px 안팎. 기기 픽셀로 16의 배수에 맞춘다 */
  return 16 * Math.max(1, Math.round((level * 16 * G.dpr) / 16));
}
function ptxt(text, nx, ny, level, color, align = 'center', outline = true) {
  const ctx = G.ctx;
  const size = fontPx(level);
  ctx.font = `${size}px ${FONT}`;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  const w = Math.round(ctx.measureText(text).width);
  let x = Math.round(nx * G.S);
  if (align === 'center') x = Math.round(x - w / 2);
  else if (align === 'right') x -= w;
  const y = Math.round(ny * G.S - size / 2);
  if (outline) {
    const o = Math.max(1, Math.round(size / 16));
    ctx.fillStyle = '#1b0f0a';
    for (const [dx, dy] of [[-o, 0], [o, 0], [0, -o], [0, o], [-o, -o], [o, -o], [-o, o], [o, o], [0, o * 2], [o, o * 2], [-o, o * 2]]) ctx.fillText(text, x + dx, y + dy);
  }
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  return w / G.S;
}

function drawTexts() {
  const W = G.W;
  /* 위 HUD 글자 — 1줄: 게이지·일시정지 / 2줄: 하트·점수 / 3줄: 큰 숫자 / 4줄: 스테이지 이름·연속 */
  /* 낮은 화면(가로)에서는 큰 숫자를 왼쪽에 — 머리 위로 도는 줄과 겹치지 않게 */
  const compact = G.H < 210;
  const nx = compact ? 4 : G.cx, nal = compact ? 'left' : 'center';
  ptxt(`${G.score.toLocaleString('en-US')}점`, W - 4, 18, 0.75, '#ffe9a8', 'right');
  if (G.mode === 'endless') {
    ptxt(String(G.count), nx, 30, 2.5, '#ffffff', nal);
    if (!compact) ptxt(`최고 ${G.opts.best | 0}`, 4, 37, 0.75, '#d8c8ff', 'left');
  } else {
    const w = ptxt(`${Math.min(G.k, G.total)}`, nx, 30, 2.5, '#ffffff', nal);
    ptxt(`/${G.total}`, compact ? 4 + w + 1 : G.cx + w / 2 + 1, 33, 1, '#ffe9a8', 'left');
    if (!compact) ptxt(G.title, 4, 39, 0.75, '#fff3c4', 'left');
  }
  if (G.combo >= 2) {
    const m = E.comboMult(G.combo);
    ptxt(`${G.combo}연속${m > 1 ? ` x${m.toFixed(1)}` : ''}`, W - 4, 37, 0.75, G.combo >= 10 ? '#ff8fd1' : '#ffffff', 'right');
  }
  if (G.cue && G.cue.t < 1.5 && Math.floor(G.cue.t * 6) % 3 !== 2) ptxt(G.cue.text, G.cx, 50.5, 1, cueColor(G.cue.kind));
  /* 판정 글자 — 머리 위 */
  for (const p of G.pops) {
    const u = p.age / p.life;
    if (u > 0.75 && Math.floor(p.age * 24) % 2) continue;
    const y = (compact ? G.gy - 44 : G.gy - 76) - Math.round(u * 8) + (p.dy || 0);
    const px0 = compact ? Math.min(G.W - 30, G.cx + 46) : G.cx;
    ptxt(p.text, px0, y, p.size, p.color);
    if (p.sub) ptxt(p.sub, px0, y + 11, 0.75, '#ffffff');
  }
  if (G.ringLabel && G.ring) ptxt('꾹!', G.ringLabel.x, G.ringLabel.y, 1, G.ringLabel.col);
  /* 점프 단추 글자 */
  const bl = G.btnLabel;
  if (bl) {
    ptxt(bl.high ? '높이 점프!' : '점프', bl.x, bl.y - 3, 1.5, bl.high ? '#5a1f8a' : '#600f09', 'center', false);
    ptxt('꾹 = 높이 점프', bl.x, bl.y + 7, 0.5, '#8a5a2a', 'center', false);
  }
  /* 판넬 글자 */
  if (G.phase === 'intro' && G.introBox) {
    const ib = G.introBox;
    ptxt(G.title, G.cx, ib.y + 10, 1, '#ffd23f');
    introLines().forEach((l, i, a) => ptxt(l, G.cx, ib.y + 24 + i * 11, 0.75, i === a.length - 1 ? '#9be36f' : '#ffffff', 'center', false));
    if (Math.floor(G.t * 2.2) % 2 === 0) ptxt('화면을 누르면 시작!', G.cx, ib.y + ib.h - 10, 1, '#ffffff');
  } else if (G.phase === 'count') {
    const n = 3 - Math.floor(G.phaseT / COUNT_STEP);
    ptxt(String(Math.max(1, n)), G.cx, G.gy - 80, 4, '#ffffff');
  } else if (G.phase === 'resume') {
    ptxt('준비…', G.cx, G.gy - 80, 2, '#ffffff');
  } else if (G.phase === 'end') {
    const tx = G.cleared ? (G.mode === 'endless' ? '끝!' : '클리어!') : (G.mode === 'endless' ? '끝!' : '아쉬워요!');
    ptxt(tx, G.cx, G.gy - 84, 3, G.cleared ? '#ffd23f' : '#ff9a9a');
  }
}

function introLines() {
  const o = G.opts;
  if (G.mode === 'endless') {
    return [`하트 ${G.heartsMax}개로 몇 번까지 넘을까요?`, '갈수록 빨라지고 박자가 흔들려요.', `내 최고 기록 ${o.best | 0}개`];
  }
  const st = o.stage;
  const out = [];
  if (st.intro) {
    const words = st.intro.split(' ');
    let cur = '';
    for (const w of words) { if ((cur + ' ' + w).trim().length > 17) { out.push(cur.trim()); cur = w; } else cur += ' ' + w; }
    if (cur.trim()) out.push(cur.trim());
  }
  out.push(`${G.total}번 · 하트 ${G.heartsMax} · 판정 ${E.JUDGE_LABEL[st.judge] || '보통'}`);
  return out.slice(-5);
}

/* ---------- DOM 창: 일시정지 · 결과 (도트 판넬 모양) ---------- */
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
/** 도트 별 하나 (결과 화면) */
function starPix(on) {
  const c = document.createElement('canvas');
  c.width = 11; c.height = 11;
  sprite(c.getContext('2d'), 0, 0, [
    '.....o.....', '....oyo....', '....oyo....', 'oooooyyoooo', 'oyywyyyyyyo', '.oywyyyyyo.', '..oyyyyyo..', '.oyyyoyyyo.', '.oyyo.oyyo.', 'oyoo...ooyo', 'oo.......oo',
  ], on ? { o: '#5a3a00', y: '#ffd23f', w: '#fff6b0' } : { o: '#3a2a5a', y: '#4a3a6a', w: '#5a4a7a' });
  c.className = `jrg-star${on ? ' on' : ''}`;
  return c;
}

function showPause() {
  hideOverlay();
  const o = div('jrg-ov');
  const card = div('jrg-card');
  card.append(div('jrg-title', '잠깐 쉬어요'));
  let soundOn = G.opts.opts?.sound !== false;
  const sb = btn(soundOn ? '소리 끄기' : '소리 켜기', '', () => {
    soundOn = !soundOn; G.au.setOn(soundOn); G.opts.onSound?.(soundOn); sb.textContent = soundOn ? '소리 끄기' : '소리 켜기';
  });
  card.append(
    btn('계속하기', 'primary', () => resume()),
    btn('처음부터 다시', '', () => G.opts.onExit('retry')),
    sb,
    btn(G.mode === 'test' ? '만들기로 돌아가기' : '그만하기', '', () => G.opts.onExit('lobby')),
  );
  o.append(card);
  G.host.append(o);
  G.overlay = o;
}

function showResult() {
  setPhase('result');
  hideOverlay();
  const { r, sum } = G.result || { r: {}, sum: null };
  const o = div('jrg-ov');
  const card = div('jrg-card jrg-result');
  const head = G.mode === 'endless' ? `${r.count}개 넘었어요!` : r.cleared ? '스테이지 클리어!' : '다음엔 꼭 넘을 수 있어요!';
  card.append(div('jrg-title', head));
  if (G.mode === 'stage') {
    const stars = div('jrg-stars');
    for (let i = 0; i < 3; i++) {
      const on = i < (sum?.stars | 0);
      const s = starPix(on);
      s.style.animationDelay = `${0.15 + i * 0.25}s`;
      stars.append(s);
      if (on) setTimeout(() => G?.au.play('star', { n: i }), 150 + i * 250);
    }
    card.append(stars);
  }
  if (sum?.newBest) { card.append(div('jrg-best', G.mode === 'endless' ? '★ 최고 기록 ★' : '★ 최고 점수 ★')); setTimeout(() => G?.au.play('best'), 900); }
  const grid = div('jrg-grid');
  const cell = (k, v) => { const c = div('jrg-cell'); c.append(div('jrg-k', k), div('jrg-v', v)); grid.append(c); };
  cell('점수', `${(r.score | 0).toLocaleString('en-US')}`);
  cell('최대 콤보', `${r.maxCombo | 0}`);
  cell('PERFECT', `${r.perfect | 0}`);
  cell('GREAT', `${r.great | 0}`);
  cell('GOOD', `${r.good | 0}`);
  cell('걸림', `${r.miss | 0}`);
  card.append(grid);
  if (sum) {
    const rw = div('jrg-reward');
    rw.append(div('jrg-rw', `경험치 +${sum.xp}`));
    if (sum.candy) rw.append(div('jrg-rw candy', `별사탕 +${sum.candy}`));
    card.append(rw);
    const L = sum.level;
    if (L) {
      const bar = div('jrg-xp');
      const fill = div('jrg-xp-fill');
      fill.style.width = `${L.need ? Math.min(100, (L.into / L.need) * 100) : 100}%`;
      bar.append(fill);
      card.append(div('jrg-lv', `Lv.${L.level}${L.need ? `  (${L.into} / ${L.need})` : '  최고 레벨'}`), bar);
    }
    if (sum.lvAfter > sum.lvBefore) card.append(div('jrg-up', `레벨 업! Lv.${sum.lvAfter}`));
    const got = [...(sum.newRopes || []).map((x) => `새 줄넘기 · ${x.name}`), ...(sum.newParts || []).map((x) => `새 꾸미기 · ${x.name}`)];
    if (got.length) {
      const g = div('jrg-got');
      g.append(div('jrg-got-h', '새로 얻었어요!'));
      for (const s of got.slice(0, 6)) g.append(div('jrg-got-i', s));
      card.append(g);
    }
  }
  const row = div('jrg-row');
  row.append(btn('다시 하기', r.cleared ? '' : 'primary', () => G.opts.onExit('retry')));
  if (G.mode === 'stage' && r.cleared && G.opts.hasNext) row.append(btn('다음 스테이지', 'primary', () => G.opts.onExit('next')));
  card.append(row);
  card.append(btn(G.mode === 'test' ? '만들기로 돌아가기' : '로비로', '', () => G.opts.onExit('lobby')));
  o.append(card);
  G.host.append(o);
  G.overlay = o;
}

/** 시험 도구용 — 상태 보기 · 자동 플레이 · 바로 시작 */
export function _debug() {
  if (!G) return null;
  return {
    phase: G.phase, k: G.k, total: G.total, rt: G.rt, hearts: G.hearts, count: G.count, score: G.score,
    perfect: G.perfect, great: G.great, good: G.good, miss: G.miss, combo: G.combo, beats: G.beats.length,
    result: G.result, W: G.W, H: G.H, S: G.S,
    setAuto(m) { G.auto = m || null; },
    start() { G.au.init(); if (G.phase === 'intro') startCount(); },
    skipCount() { if (G.phase === 'count') G.phaseT = COUNT_STEP * 3; },
  };
}

/* 판넬은 오락실 공용 도트 단추(.pbtn)와 같은 문법 — 둥근 모서리 없음, 십자 그림자로 깎인 모서리 */
const CSS = `
.jrg-host { position: relative; width: 100%; height: 100%; overflow: hidden; touch-action: none; user-select: none; -webkit-user-select: none; background: #120a24; }
.jrg-canvas { display: block; touch-action: none; image-rendering: pixelated; }
.jrg-ov { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(10,6,24,0.62); padding: 14px; overflow-y: auto; }
.jrg-card { width: min(330px, 100%); background: #2b1a4a; padding: 14px 12px; display: flex; flex-direction: column; gap: 8px; color: #fff4d6; max-height: 100%; overflow-y: auto;
  box-shadow: 0 -3px 0 0 #ffdd8e, 0 3px 0 0 #ffdd8e, -3px 0 0 0 #ffdd8e, 3px 0 0 0 #ffdd8e, 0 -6px 0 0 #600f09, 0 6px 0 0 #600f09, -6px 0 0 0 #600f09, 6px 0 0 0 #600f09, 0 10px 0 0 rgba(0,0,0,0.45); }
.jrg-title { text-align: center; font-size: 24px; color: #ffd23f; text-shadow: 2px 2px 0 #1b0f0a; }
.jrg-stars { display: flex; justify-content: center; gap: 8px; }
.jrg-star { width: 44px; height: 44px; image-rendering: pixelated; }
.jrg-star.on { animation: jrgStar .4s steps(4) both; }
@keyframes jrgStar { 0% { transform: scale(0.25); opacity: 0 } 60% { transform: scale(1.25) } 100% { transform: scale(1) } }
.jrg-best { text-align: center; color: #ff8fd1; font-size: 16px; animation: jrgBlink 0.5s steps(2) infinite; }
@keyframes jrgBlink { 50% { opacity: 0.35 } }
.jrg-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; }
.jrg-cell { background: #1d1236; padding: 5px 2px; text-align: center; box-shadow: inset 0 0 0 2px #3d2766; }
.jrg-k { font-size: 10px; color: #c9b8ff; }
.jrg-v { font-size: 16px; }
.jrg-reward { display: flex; justify-content: center; gap: 14px; font-size: 16px; }
.jrg-rw.candy { color: #ffb3de; }
.jrg-lv { text-align: center; font-size: 12px; color: #c9b8ff; }
.jrg-xp { height: 8px; background: #4a3428; box-shadow: 0 0 0 2px #ffdd8e, 0 0 0 4px #600f09; margin: 2px 4px 4px; }
.jrg-xp-fill { height: 100%; background: #7cf09a; box-shadow: inset 0 2px 0 #c8ffd4, inset 0 -2px 0 #3fbf5a; transition: width .8s steps(12); }
.jrg-up { text-align: center; color: #7cf09a; font-size: 18px; animation: jrgBlink 0.4s steps(2) infinite; }
.jrg-got { background: #3a2a10; padding: 6px; box-shadow: inset 0 0 0 2px #ffd23f; }
.jrg-got-h { color: #ffd23f; text-align: center; font-size: 14px; margin-bottom: 3px; }
.jrg-got-i { font-size: 13px; text-align: center; }
.jrg-row { display: flex; gap: 8px; }
.jrg-row > * { flex: 1; }
.jrg-card .pbtn { font-size: 16px; padding: 9px 8px; }
`;
