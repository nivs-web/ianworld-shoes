/**
 * 캐치볼 — 오락실 이안월드의 3번째 게임. (2026-10-28, 2026-10-29 대개편)
 *
 * 처음에는 `cowork/catchball/index.html` 한 파일짜리 게임이었다. 드래곤처럼
 * iframe 으로 붙이지 않고 **모듈로 옮겼다** — iframe 은 포커스가 부모로 새서
 * 키보드가 죽는다(DragonGame.js 머리 주석, 같은 이유).
 *
 * 파일 나눔: `ui.js` 스타일·DOM · `art.js` 그림·꾸미기 자료 · `audio.js` 효과음·배경음악 · 이 파일은 게임.
 *
 * ## 3D캐치볼 (4번째 게임, 2026-10-29)
 * 같은 게임을 `opts.world3d`(= `world3d.js` 의 `createWorld3D`)로 띄우면 경기장 · 인형 · 공을 3D 로 그린다.
 * 규칙 · 입력 · HUD 는 이 파일 그대로다. 2D 캔버스는 투명해져서 3D 위에 조준경 · 링 · 글자만 얹는다 —
 * 3D 카메라가 이 파일의 원근(`proj`)과 수학적으로 같아서 둘이 정확히 겹친다.
 * three.js 는 화면(`screens/Catch3DGame.js`)이 따로 받아 넘긴다 — 2D 캐치볼 번들에는 안 들어간다.
 *
 * ## 이 파일은 Firebase 를 모른다
 * 혼자 하는 판은 그대로 돌고, 1:1 대결(`mode: 'duel'`)은 화면(`screens/CatchGame.js`)이
 * 넣어 주는 두 통로로만 바깥과 이어진다.
 *   · 나가는 쪽 : `opts.duel.send(fields)` — 내 참가자 칸에 쓸 값
 *   · 들어오는 쪽: `setRemote(node)` — 상대 참가자 칸 스냅샷 (없어지면 `null`)
 * 기록 · 꾸미기 · 선물함도 콜백으로만 내보낸다(onFinish · onLook · onProgress · onClaim).
 *
 * ## 대결은 차례대로 주고받는다 (lockstep 이 아니다)
 *   · `th` = `판|순번|공종류|x(cm)|y(cm)|비행(ms)`  — 좌표는 **받는 사람 기준**
 *     공종류 칸 = 종류 번호 + (빠르기+1)×10
 *   · `ct` = `판|순번|결과`  (p 퍼펙트 · g 그레이트 · n 나이스 · l 아슬아슬 · m 놓침 · w 악송구)
 *
 * ## 던지기 (2026-10-29, 사용자 지정 — 양궁·사격 게임처럼)
 *   · 조준점이 위아래 좌우로 크게 흔들린다. 과녁은 초록(스트라이크) · 주황(볼) · 빨강(실책).
 *     초록에 머무는 시간이 **보통 1/5**(쉬움 1/4 · 어려움 1/7), 빠른 볼·변화구는 더 흔들린다.
 *   · 판마다 바람이 분다. 초록 한가운데로 던져도 바람에 밀리면 스트라이크가 아니다.
 *   · 던지기는 화면을 **아래에서 위로 쓸어 올리는 것**. 비스듬히 밀면 옆으로, 약하게 밀면 낮게 간다.
 *   · 빨강에서 던지면 실책 — 혼자 할 때 실책 3개면 아웃.
 */

import { CSS, HTML, BALL_SVG, FONT_HREF } from './ui.js';
import * as Art from './art.js';
import { createAudio } from './audio.js';

/* ======================================================================
   모듈 경계
   ====================================================================== */
let inst = null;

/**
 * @param {HTMLElement} host
 * @param {object} opts
 *   mode 'solo'|'duel' · difficulty · bests{easy,normal,hard} · combos{easy,normal,hard}
 *   look(꾸미기) · progress{bestLevel,bestStrikes,hats[],balls[]} · duelRecord{wins,losses}
 *   onFinish(r) · onLook(look) · onProgress(p) · onClaim({hats,balls}) · onDifficulty(d)
 *   onDuel() · onRanking() · onExit(kind)
 *   duel { gid, iStart, myName, oppName, oppLook, difficulty, startInMs, absentMs, send(fields), onEnd(r) }
 */
export function mount(host, opts = {}) {
  unmount();
  inst = createGame(host, opts);
}
export function unmount() {
  if (inst) { inst.destroy(); inst = null; }
}
/** ESC · 안드로이드 뒤로가기 — 곧바로 나가지 않고 멈춘다(대결은 기권을 묻는다) */
export function requestPause() { inst?.requestPause(); }
/** 대결 상대의 참가자 칸 (없어졌으면 null) */
export function setRemote(node) { inst?.remote(node); }
/** 대결 상대의 꾸미기 (순위표에서 늦게 읽혀 온다) */
export function setOppLook(look) { inst?.oppLook(look); }
/** 검사 도구 전용 (tools/_catch-*.html) — 게임 상태를 들여다본다 */
export function _debug() { return inst?.dbg; }

/* ======================================================================
   게임 본체
   ====================================================================== */
function createGame(host, opts) {
  const DUEL = opts.mode === 'duel' && opts.duel ? opts.duel : null;

  /* ---------- DOM ---------- */
  if (!document.getElementById('cb-style')) {
    const st = document.createElement('style');
    st.id = 'cb-style'; st.textContent = CSS;
    document.head.appendChild(st);
  } else document.getElementById('cb-style').textContent = CSS;
  if (!document.getElementById('cb-font')) {
    const ln = document.createElement('link');
    ln.id = 'cb-font'; ln.rel = 'stylesheet'; ln.href = FONT_HREF;
    document.head.appendChild(ln);
  }
  const root = document.createElement('div');
  root.className = 'cb-root' + (DUEL ? ' cb-duel' : '');
  root.innerHTML = HTML;
  host.appendChild(root);
  const $ = (k) => root.querySelector(`[data-cb="${k}"]`);
  const cvs = root.querySelector('.cb-canvas');
  const ctx = cvs.getContext('2d');
  const hudEl = root.querySelector('.cb-hud');
  /* 3D캐치볼 — 3D 를 못 켜는 기기면 조용히 2D 로 돈다 */
  let W3 = null, glCv = null, closetMini = null, lessonMini = null;
  if (opts.world3d) {
    glCv = document.createElement('canvas');
    glCv.className = 'cb-canvas cb-gl';
    cvs.parentNode.insertBefore(glCv, cvs);
    try { W3 = opts.world3d({ canvas: glCv }); root.classList.add('cb-3d'); }
    catch (e) { console.warn('[3D캐치볼] 3D 를 켜지 못해 2D 로 돈다', e); glCv.remove(); glCv = null; W3 = null; }
  }
  if (opts.titleLogo) root.querySelector('.cb-logo').textContent = opts.titleLogo;
  if (opts.titleKicker) root.querySelector('.cb-kicker').textContent = opts.titleKicker;

  const offs = [];
  const on = (t, ev, fn, o) => { t.addEventListener(ev, fn, o); offs.push(() => t.removeEventListener(ev, fn, o)); };
  const timers = new Set();
  const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); return id; };
  let dead = false;

  /* ---------- 도구 ---------- */
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[(Math.random() * arr.length) | 0];
  const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  const lp = (a, b, t) => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) });
  const TAU = Math.PI * 2;
  const { circ, rr } = Art;

  const local = {
    get(k, d) { try { const v = localStorage.getItem('catchball.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('catchball.' + k, JSON.stringify(v)); } catch (e) { /* 저장 불가 */ } },
  };
  function seeded(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------- 상수 ---------- */
  const LEVELS = ['동네 캐치볼', '리틀 야구', '중학 야구부', '고교 에이스', '대학 야구', '프로 2군', '프로 1군', '국가대표', '메이저리그', '야구의 전설'];
  const PARTNER_Z = 11;
  const GLOVE_Z = 0.35;
  const BALL_R = Art.BALL_R;
  let EARLY = 0.24;          // 난이도가 넓히고 좁힌다 (applyDiff)
  const LATE = 0.075;
  const REACH_X = 1.82, REACH_YMAX = 2.62, REACH_YMIN = -0.02;
  const reachable = (x, y) => Math.abs(x) <= REACH_X && y <= REACH_YMAX && y >= REACH_YMIN;
  const HOLD_LIMIT = 12;
  const MAX_ERRORS = 3;

  /**
   * ★ 난이도 — 받기와 던지기를 한꺼번에 바꾼다.
   *   받기: T 비행시간 · R 글러브 반경 · early 미리 눌러도 잡히는 시간 · spread 공 오는 폭 · typeGap 새 공 간격 · minT
   *   던지기: amp 조준점 흔들림(m) · freq 흔들림 빠르기 · cG/cO 초록·주황 반경(흔들림 대비) · wind 풍속 범위(m/s)
   *   cG·cO 는 계산으로 맞췄다 — 흔들림 위에 고르게 놓였을 때 초록에 머무는 시간이 쉬움 25% · 보통 20% · 어려움 15%,
   *   빨강(실책)에 있는 시간이 쉬움 25% · 보통 40% · 어려움 50%.
   *   per = 레벨 하나를 올리는 데 필요한 잡은 공
   */
  const DIFFS = {
    easy:   { label: '쉬움',   T: 1.25, R: 1.22, early: 1.3,  spread: 0.75, typeGap: 1.6, minT: 0.6,  per: 15, amp: 0.34, freq: 0.8,  cG: 0.435, cO: 0.891, wind: [0, 2.5] },
    normal: { label: '보통',   T: 1.0,  R: 1.0,  early: 1.0,  spread: 1.0,  typeGap: 1.0, minT: 0.48, per: 10, amp: 0.46, freq: 1.0,  cG: 0.379, cO: 0.769, wind: [0.5, 5] },
    hard:   { label: '어려움', T: 0.82, R: 0.84, early: 0.78, spread: 1.15, typeGap: 0.6, minT: 0.4,  per: 7,  amp: 0.58, freq: 1.25, cG: 0.325, cO: 0.681, wind: [2, 7.5] },
  };
  /** 공 빠르기 — 0 느린 볼 · 1 중간 볼 · 2 빠른 볼. amp = 조준점 흔들림 배율 */
  const SPEEDS = [
    { label: '느린 볼', T: 1.35, amp: 0.85, calls: ['느린 볼~', '살살 간다~'] },
    { label: '중간 볼', T: 1.0, amp: 1.0, calls: ['간다~!', '받아!'] },
    { label: '빠른 볼', T: 0.62, amp: 1.2, calls: ['빠른 볼!!', '세게 간다!'] },
  ];
  /** 구종 — 직구 + 변화구 셋. 변화구는 받기 어렵지만 조준이 더 흔들린다 */
  const PITCHES = [
    { label: '직구', type: 'normal', amp: 1.0, Tk: 1.0, color: '#ffffff' },
    { label: '커브', type: 'curve', amp: 1.1, Tk: 1.06, color: '#3fa9f5' },
    { label: '슬라이더', type: 'slider', amp: 1.12, Tk: 1.0, color: '#ff9f2e' },
    { label: '포크볼', type: 'fork', amp: 1.15, Tk: 1.04, color: '#b48cff' },
  ];
  const TYPES = ['normal', 'lob', 'grounder', 'curve', 'fast', 'knuckle', 'slider', 'fork'];
  const TYPE_NAME = { lob: '뜬공', grounder: '땅볼', curve: '커브', fast: '강속구', knuckle: '너클볼', slider: '슬라이더', fork: '포크볼' };
  const CALLS = {
    normal: ['간다~!', '받아!', '잡아봐!', '자, 간다!'],
    lob: ['높이 간다!', '하늘 높이~!'],
    grounder: ['땅볼이다!', '낮게 간다!'],
    curve: ['커브!', '휘어진다~!'],
    fast: ['강속구!!', '빠르다!'],
    knuckle: ['흔들흔들~', '너클볼!'],
    slider: ['슬라이더!', '옆으로 휜다~!'],
    fork: ['포크볼!', '뚝 떨어진다~!'],
  };
  const TYPE_HINT = {
    lob: '높이 뜬 공! 글러브를 위로 올려요',
    grounder: '땅볼! 한 번 튀어요. 글러브를 낮게!',
    curve: '커브! 공이 크게 휘어요',
    knuckle: '너클볼! 공이 흔들흔들 날아와요',
    slider: '슬라이더! 끝에서 옆으로 확 휘어요',
    fork: '포크볼! 끝에서 뚝 떨어져요',
  };
  function callFor(type, speed) {
    if (speed == null || speed === 1) return pick(CALLS[type] || CALLS.normal);
    if (type === 'normal') return pick(SPEEDS[speed].calls);
    return (speed === 2 ? '빠른 ' : '느린 ') + (TYPE_NAME[type] || '') + (speed === 2 ? '!' : '~');
  }

  /**
   * ★ 던지기 자세 — 초등학생이 따라 배우는 순서 (사용자 지정)
   * 뒤에서 본 오른손잡이 기준(던지는 손 = +x, 글러브 손 = -x). 앞모습은 좌우를 뒤집어 쓴다.
   * rh 던지는 손 · gh 글러브 손 · fG 글러브 쪽 발 · fT 던지는 쪽 발 [x, 들기, 앞으로] · turn 몸 옆으로 돌리기 · cr 숙이기
   */
  const THROW_KEYS = [
    { u: 0.00, rh: [0.06, 0.88], gh: [-0.02, 0.9], fG: [-0.12, 0, 0], fT: [0.12, 0, 0], turn: 0, cr: 0.05 },
    { u: 0.20, rh: [0.03, 0.92], gh: [-0.03, 0.93], fG: [-0.05, 0.28, 0], fT: [0.11, 0, 0], turn: 0.7, cr: 0 },
    { u: 0.40, rh: [0.46, 0.78], gh: [-0.34, 1.12], fG: [-0.17, 0.05, 0.32], fT: [0.13, 0, 0], turn: 0.8, cr: 0.1 },
    { u: 0.55, rh: [0.44, 1.14], gh: [-0.3, 1.06], fG: [-0.2, 0, 0.42], fT: [0.15, 0, 0], turn: 0.6, cr: 0.12 },
    { u: 0.66, rh: [0.12, 1.38], gh: [-0.12, 0.92], fG: [-0.2, 0, 0.42], fT: [0.1, 0.05, 0.08], turn: 0, cr: 0.18 },
    { u: 1.00, rh: [-0.22, 0.5], gh: [-0.1, 0.9], fG: [-0.2, 0, 0.42], fT: [0.02, 0.16, 0.3], turn: 0, cr: 0.35 },
  ];
  const THROW_STEPS = [
    { u: 0.0, t: '① 준비', tip: '글러브 속에서 공을 쥐고, 던질 쪽으로 몸을 옆으로 돌려요' },
    { u: 0.2, t: '② 다리 들기', tip: '글러브 쪽 다리를 들어 한 발로 균형을 잡아요' },
    { u: 0.4, t: '③ 팔 벌리기', tip: '글러브는 목표를 가리키고, 공 든 손은 뒤로 내려요' },
    { u: 0.55, t: '④ L자 만들기', tip: '팔꿈치를 어깨 높이로 들고, 공은 하늘을 보게 해요' },
    { u: 0.66, t: '⑤ 던지기', tip: '발을 내딛고 허리를 돌리며, 팔꿈치가 먼저 앞으로!' },
    { u: 0.8, t: '⑥ 팔로스루', tip: '던진 팔이 반대쪽 무릎까지 쭉 내려와요' },
  ];
  const THROW_DUR = 0.95, RELEASE_U = 0.66;
  function throwPose(u) {
    u = clamp(u, 0, 1);
    let i = 0;
    while (i < THROW_KEYS.length - 2 && u > THROW_KEYS[i + 1].u) i++;
    const a = THROW_KEYS[i], b = THROW_KEYS[i + 1];
    const k = ease(clamp((u - a.u) / (b.u - a.u), 0, 1));
    const L2 = (p, q) => [lerp(p[0], q[0], k), lerp(p[1], q[1], k), lerp(p[2] ?? 0, q[2] ?? 0, k)];
    return { rh: L2(a.rh, b.rh), gh: L2(a.gh, b.gh), fG: L2(a.fG, b.fG), fT: L2(a.fT, b.fT), turn: lerp(a.turn, b.turn, k), cr: lerp(a.cr, b.cr, k) };
  }
  const stepOf = (u) => { let s = THROW_STEPS[0]; for (const x of THROW_STEPS) if (u >= x.u) s = x; return s; };

  /* ---------- 소리 ---------- */
  const audio = createAudio(local);
  const sfx = (n, o) => { try { audio.play(n, o); } catch (e) { /* 소리 실패는 게임을 멈추지 않는다 */ } };
  const voice = (t) => { try { audio.say(t); } catch (e) { /* 무시 */ } };
  const ainit = () => { try { audio.init(); } catch (e) { /* 무시 */ } };

  /* ---------- 카메라 · 원근 ---------- */
  const cam = { x: 0, y: 4.2, z: -6.3, pitch: 0.4 };
  let cosP = 1, sinP = 0;
  let W = 0, H = 0, DPR = 1, F = 500, CX = 0, CY = 0, portrait = true, APEX_MAX = 6;
  const SAFE = { t: 0, r: 0, b: 0, l: 0 };
  function proj(x, y, z) {
    const dx = x - cam.x, dy = y - cam.y, dz = z - cam.z;
    const depth = dz * cosP - dy * sinP;
    const up = dy * cosP + dz * sinP;
    const s = F / depth;
    return { x: CX + dx * s, y: CY - up * s, s, depth };
  }
  function upRatio(y, z) {
    const dy = y - cam.y, dz = z - cam.z;
    return (dy * cosP + dz * sinP) / (dz * cosP - dy * sinP);
  }
  function depthOf(y, z) { return (z - cam.z) * cosP - (y - cam.y) * sinP; }
  function unproject(sx, sy, z0) {
    const px = (sx - CX) / F, py = (CY - sy) / F;
    const dX = px, dY = py * cosP - sinP, dZ = py * sinP + cosP;
    const t = (z0 - cam.z) / dZ;
    return { x: cam.x + dX * t, y: cam.y + dY * t };
  }
  const horizonY = () => CY - F * sinP / cosP;
  const probe = $('probe');
  function readSafe() {
    const cs = getComputedStyle(probe);
    SAFE.t = parseFloat(cs.paddingTop) || 0;
    SAFE.r = parseFloat(cs.paddingRight) || 0;
    SAFE.b = parseFloat(cs.paddingBottom) || 0;
    SAFE.l = parseFloat(cs.paddingLeft) || 0;
  }
  function layout() {
    const r = root.getBoundingClientRect();
    W = Math.max(1, r.width || window.innerWidth); H = Math.max(1, r.height || window.innerHeight);
    DPR = Math.min(2, window.devicePixelRatio || 1);
    cvs.width = Math.round(W * DPR); cvs.height = Math.round(H * DPR);
    readSafe();
    const btn = probe.offsetWidth || 110;
    portrait = H >= W * 0.95;
    if (portrait) { cam.y = 4.2; cam.z = -6.3; cam.pitch = 0.4; }
    else { cam.y = 2.6; cam.z = -6.6; cam.pitch = 0.05; }
    cosP = Math.cos(cam.pitch); sinP = Math.sin(cam.pitch);
    const topY = SAFE.t + (portrait ? (DUEL ? 128 : 100) : 80);
    let feetY, side;
    if (portrait) { feetY = H - SAFE.b - btn - 24; side = 6; }
    else { feetY = H - SAFE.b - 10; side = Math.max(SAFE.l, SAFE.r) + btn + 24; }
    const dG = depthOf(1.1, GLOVE_Z);
    const Fw = (W / 2 - side) * dG / 2.05;
    const a = upRatio(0, 0), b = upRatio(2.42, GLOVE_Z);
    const Fv = (feetY - topY) / (b - a);
    F = Math.max(120, Math.min(Fw, portrait ? Fv : Fv * 0.86));
    CX = W / 2;
    CY = feetY + a * F;
    APEX_MAX = Math.max(2.6, unproject(CX, SAFE.t + 70, 5.5).y - 0.25);
    titleRect = null;
    if (W3) W3.resize(W, H, DPR, { x: cam.x, y: cam.y, z: cam.z, pitch: cam.pitch, F, CX, CY });
    else buildLayers();
  }

  /* ---------- 고정 배경 ---------- */
  let skyL = null, groundL = null, cloudSpr = null;
  function mkLayer() {
    const c = document.createElement('canvas');
    c.width = cvs.width; c.height = cvs.height;
    const x = c.getContext('2d');
    x.setTransform(DPR, 0, 0, DPR, 0, 0);
    return [c, x];
  }
  function buildCloud() {
    const c = document.createElement('canvas');
    c.width = 360; c.height = 160;
    const x = c.getContext('2d');
    const puffs = [[70, 105, 46], [125, 78, 60], [195, 70, 66], [255, 92, 50], [300, 112, 36], [160, 112, 50], [230, 118, 44]];
    x.fillStyle = 'rgba(150,190,220,.45)';
    for (const [px, py, r] of puffs) { x.beginPath(); x.arc(px + 4, py + 10, r, 0, TAU); x.fill(); }
    x.fillStyle = '#ffffff';
    for (const [px, py, r] of puffs) { x.beginPath(); x.arc(px, py, r, 0, TAU); x.fill(); }
    x.fillStyle = 'rgba(214,235,250,.9)';
    x.beginPath(); x.ellipse(185, 140, 135, 14, 0, 0, TAU); x.fill();
    cloudSpr = c;
  }
  function buildLayers() {
    const hz = horizonY();
    const [sc, s] = mkLayer();
    const g = s.createLinearGradient(0, 0, 0, Math.max(40, hz));
    g.addColorStop(0, '#2a8fe3'); g.addColorStop(0.6, '#5fbdf5'); g.addColorStop(1, '#c6f0ff');
    s.fillStyle = g; s.fillRect(0, 0, W, H);
    const sr = clamp(Math.min(W, H) * 0.065, 24, 60);
    const sx = W * 0.8, sy = clamp(hz * 0.3, sr + SAFE.t + 70, Math.max(sr + SAFE.t + 70, hz - sr * 2));
    const sg = s.createRadialGradient(sx, sy, sr * 0.5, sx, sy, sr * 3.4);
    sg.addColorStop(0, 'rgba(255,246,190,.85)'); sg.addColorStop(1, 'rgba(255,246,190,0)');
    s.fillStyle = sg; circ(s, sx, sy, sr * 3.4); s.fill();
    s.fillStyle = '#fff7c9'; circ(s, sx, sy, sr); s.fill();
    skyL = sc;

    const [gc, c] = mkLayer();
    const rnd = seeded(7);
    hills(c, 190, 24, '#a3d6c6', 0.021, 1.3);
    hills(c, 120, 13, '#82c5a3', 0.037, 4.1);
    for (const tx of [-17, 17]) tower(c, tx, 57);
    const trees = [];
    for (let x = -95; x <= 95; x += 2.5) trees.push({ x: x + rnd() * 1.2, z: 59 + rnd() * 3, h: 4.4 + rnd() * 2.4, r: 2.2 + rnd() * 1.2 });
    for (const t of trees) { const p = proj(t.x, t.h, t.z); c.fillStyle = '#2b8148'; circ(c, p.x, p.y, t.r * p.s); c.fill(); }
    for (const t of trees) { const p = proj(t.x - 0.5, t.h + 0.6, t.z); c.fillStyle = '#3d9c58'; circ(c, p.x, p.y, t.r * 0.62 * p.s); c.fill(); }
    const ft = proj(0, 2.6, 46), fb = proj(0, 0, 46);
    c.fillStyle = '#1e6a44'; c.fillRect(0, ft.y, W, fb.y - ft.y + 1);
    c.fillStyle = '#ffd84a'; c.fillRect(0, ft.y, W, Math.max(2, 0.17 * fb.s));
    c.strokeStyle = 'rgba(0,0,0,.2)'; c.lineWidth = 1;
    for (let x = -100; x <= 100; x += 5) { const p = proj(x, 0, 46); c.beginPath(); c.moveTo(p.x + 0.5, ft.y + 0.17 * fb.s); c.lineTo(p.x + 0.5, fb.y); c.stroke(); }
    const sp = proj(0, 1.2, 46);
    c.font = `${Math.max(10, 1.2 * sp.s)}px "Black Han Sans","Jua",sans-serif`;
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#fffaf0';
    c.fillText('122m', sp.x, sp.y);
    const gg = c.createLinearGradient(0, fb.y, 0, H);
    gg.addColorStop(0, '#83c962'); gg.addColorStop(1, '#3e9b3a');
    c.fillStyle = gg; c.fillRect(0, fb.y, W, H - fb.y);
    const wt = proj(0, 0, 43.2);
    c.fillStyle = '#c98e5c'; c.fillRect(0, fb.y, W, wt.y - fb.y);
    const zNear = cam.z + 0.9;
    let k = 0;
    for (let z = 43.2; z > zNear; z -= 3, k++) {
      if (k % 2) continue;
      const y0 = proj(0, 0, z).y, y1 = proj(0, 0, Math.max(zNear, z - 3)).y;
      c.fillStyle = 'rgba(255,255,255,.075)'; c.fillRect(0, y0, W, y1 - y0);
    }
    for (let i = -18; i < 18; i += 2) {
      const x0 = i * 3, x1 = x0 + 3;
      const a = proj(x0, 0, 43.2), b = proj(x1, 0, 43.2), cc = proj(x1, 0, zNear), d = proj(x0, 0, zNear);
      c.fillStyle = 'rgba(20,80,20,.075)';
      c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.lineTo(cc.x, cc.y); c.lineTo(d.x, d.y); c.closePath(); c.fill();
    }
    c.lineCap = 'round';
    for (let i = 0; i < 110; i++) {
      const x = (rnd() * 2 - 1) * 8, z = -2.5 + rnd() * 28;
      const p = proj(x, 0, z); const l = 0.09 * p.s;
      c.strokeStyle = 'rgba(38,112,40,.55)'; c.lineWidth = Math.max(1, 0.018 * p.s);
      c.beginPath(); c.moveTo(p.x - l * 0.55, p.y - l); c.lineTo(p.x, p.y); c.lineTo(p.x + l * 0.55, p.y - l); c.moveTo(p.x, p.y); c.lineTo(p.x + l * 0.05, p.y - l * 1.25); c.stroke();
    }
    for (let i = 0; i < 26; i++) {
      const x = (rnd() * 2 - 1) * 9, z = 1 + rnd() * 30;
      const p = proj(x, 0, z);
      c.fillStyle = rnd() < 0.5 ? '#fff6d8' : '#ffe066';
      circ(c, p.x, p.y, Math.max(1, 0.035 * p.s)); c.fill();
    }
    groundL = gc;
  }
  function hills(c, z, hBase, col, freq, ph) {
    const base = proj(0, 0, z); const s = base.s;
    c.fillStyle = col; c.beginPath(); c.moveTo(0, H);
    for (let sx = 0; sx <= W + 8; sx += 8) {
      const x = (sx - CX) / s;
      const h = hBase + Math.sin(x * freq + ph) * hBase * 0.35 + Math.sin(x * freq * 2.3 + ph * 2) * hBase * 0.18;
      c.lineTo(sx, proj(x, h, z).y);
    }
    c.lineTo(W, H); c.closePath(); c.fill();
  }
  function tower(c, x, z) {
    const b = proj(x, 0, z), t = proj(x, 23, z), s = b.s;
    c.fillStyle = '#b7c4cf'; c.fillRect(b.x - 0.35 * s, t.y, 0.7 * s, b.y - t.y);
    const pw = 5.4 * s, ph = 3.3 * s, px = t.x - pw / 2, py = t.y - ph;
    c.fillStyle = '#7b8a98'; c.fillRect(px, py, pw, ph);
    c.fillStyle = '#f2f8ff';
    for (let r = 0; r < 3; r++) for (let q = 0; q < 5; q++) { circ(c, px + (q + 0.5) * pw / 5, py + (r + 0.5) * ph / 3, Math.min(pw / 5, ph / 3) * 0.32); c.fill(); }
  }

  /* ---------- 상태 ---------- */
  const G = {
    phase: 'title', t: 0, phaseT: 0, paused: false, freeze: 0,
    score: 0, best: 0, lives: 3, combo: 0, maxCombo: 0, perfects: 0, nice: 0,
    errors: 0, strikes: 0, maxStrikes: 0, strikeAll: 0, level: 1,
    round: 0, plan: null, holdDur: 0.6, seenTypes: new Set(), tut: {}, recordShown: false,
    shakeT: 0, shakeMag: 0, easyNext: false, outPending: false,
  };
  const BESTS = { easy: 0, normal: 0, hard: 0, ...(opts.bests || {}) };
  const COMBOS = { easy: 0, normal: 0, hard: 0, ...(opts.combos || {}) };
  const wantDiff = (DUEL && DUEL.difficulty) || opts.difficulty;
  G.diff = DIFFS[wantDiff] ? wantDiff : 'normal';
  G.speed = clamp(local.get('speed', 1) | 0, 0, 2);
  G.pitch = clamp(local.get('pitch', 0) | 0, 0, 3);
  const DF = () => DIFFS[G.diff];
  function applyDiff() { EARLY = 0.24 * DF().early; G.best = BESTS[G.diff] | 0; }
  applyDiff();

  /* 성장 · 꾸미기 */
  const PR = {
    bestLevel: Math.max(1, opts.progress?.bestLevel | 0),
    bestStrikes: Math.max(0, opts.progress?.bestStrikes | 0),
    hats: new Set([0, ...((opts.progress && opts.progress.hats) || [])]),
    balls: new Set([0, ...((opts.progress && opts.progress.balls) || [])]),
  };
  const hatOpen = (i) => Art.HATS[i] && Art.HATS[i].level <= PR.bestLevel;
  const ballOpen = (i) => Art.BALLS[i] && Art.BALLS[i].need <= PR.bestStrikes;
  function giftList() {
    const out = [];
    Art.HATS.forEach((h, i) => { if (hatOpen(i) && !PR.hats.has(i)) out.push({ kind: 'hat', i }); });
    Art.BALLS.forEach((b, i) => { if (ballOpen(i) && !PR.balls.has(i)) out.push({ kind: 'ball', i }); });
    return out;
  }
  /* 꾸미기는 객체로도, 순위표에 싣는 한 줄(`encodeLook`)로도 받는다 */
  const asLook = (v, team) => (typeof v === 'string' && v ? Art.decodeLook(v) : Art.normalizeLook({ ...Art.defaultLook(team || 'red'), ...(v && typeof v === 'object' ? v : {}) }));
  let LOOK = asLook(opts.look, opts.team);
  if (!PR.hats.has(LOOK.hat)) LOOK.hat = 0;
  if (!PR.balls.has(LOOK.ball)) LOOK.ball = 0;
  let FRIEND = DUEL && DUEL.oppLook ? asLook(DUEL.oppLook) : Art.friendLook(LOOK);
  if (DUEL && !DUEL.oppLook) FRIEND.hat = Art.TEAM_HAT;
  const ballId = () => LOOK.ball | 0;

  const P = { gx: 0, gy: 1.05, tgx: 0, tgy: 1.05, bodyX: 0.36, bodyV: 0, runPh: 0, crouch: 0, lift: 0,
    glove: 0, closeT: 0, cooldown: 0, pending: null, whiffAt: -9, throwT: -1, throwRate: 1, hop: 0 };
  const A = { bx: 0, by: 1.05, x: 0, y: 1.05, fx: 0, fy: 1.05, seed: 0, res: 'ball', zone: 'g', T: 1, note: '' };
  const WIND = { x: 0, h: 0, spd: 0, ang: 0 };
  const M = { x: 0, z: PARTNER_Z, tx: 0, pose: 'wave', poseT: 0, windDur: 0.6, say: '', sayT: 0, runPh: 0,
    judge: 'ok', dir: 1, catchLocal: { x: 0.2, y: 1.05 }, fetch: 0, glove: null, head: null };
  const B = { state: 'partner', segs: [], launch: 0, dur: 1, arriveAt: 0, target: { x: 0, y: 1, z: 0 }, type: 'normal',
    pos: { x: 0, y: 1, z: PARTNER_Z }, vel: { x: 0, y: 0, z: 0 }, rot: 0, spin: 14, toPlayer: true,
    arrDist: 9, arrGlove: { x: 0, y: 0 }, segIdx: 0, trail: [], judge: 'ok', bounces: 0, wild: false, res: 'ball', speed: 1 };

  const D = DUEL ? {
    gid: String(DUEL.gid ?? '0'),
    iStart: !!DUEL.iStart,
    myName: DUEL.myName || '나',
    oppName: DUEL.oppName || '상대',
    seq: 0, mySeq: 0, result: null, inThrow: null, rally: 0,
    opp: { lives: 3, score: 0, gx: 0, gy: 1.05, lastSeen: performance.now(), seenAt: null, alive: true },
    ended: false, win: null, reason: '',
    ghost: { at: 0, x: 9, y: 9 }, lastNode: null, startAt: 0,
  } : null;

  const catchR = () => DF().R * (D ? Math.max(0.28, 0.34 - D.rally * 0.003) : Math.max(0.27, 0.36 - G.score * 0.0025));
  const levelOf = (s) => Math.min(LEVELS.length - 1, Math.floor(s / DF().per));
  const isPlaying = () => !['title', 'over', 'vs'].includes(G.phase);
  const fineMouse = window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* ---------- 공 궤적 ---------- */
  function mkSeg(p0, p1, T, g, ax = 0) {
    return { p0: { x: p0.x, y: p0.y, z: p0.z }, T, a: { x: ax, y: -g },
      v: { x: (p1.x - p0.x - 0.5 * ax * T * T) / T, y: (p1.y - p0.y + 0.5 * g * T * T) / T, z: (p1.z - p0.z) / T }, wob: null, late: null };
  }
  function fitSeg(p0, p1, T, g, ax = 0) {
    let s = mkSeg(p0, p1, T, g, ax);
    for (let i = 0; i < 14; i++) {
      const apex = s.v.y > 0 ? p0.y + s.v.y * s.v.y / (2 * g) : p0.y;
      if (apex <= APEX_MAX || g < 2.4) break;
      g *= 0.88; s = mkSeg(p0, p1, T, g, ax);
    }
    return s;
  }
  function evalBall(tr, out) {
    let i = 0, tau = tr;
    for (; i < B.segs.length - 1; i++) { if (tau <= B.segs[i].T) break; tau -= B.segs[i].T; }
    const s = B.segs[i];
    tau = Math.min(tau, s.T);
    out.x = s.p0.x + s.v.x * tau + 0.5 * s.a.x * tau * tau;
    out.y = s.p0.y + s.v.y * tau + 0.5 * s.a.y * tau * tau;
    out.z = s.p0.z + s.v.z * tau;
    if (s.wob) {
      out.x += s.wob.ax * Math.sin(Math.PI * s.wob.kx * tau / s.T);
      out.y += s.wob.ay * Math.sin(Math.PI * s.wob.ky * tau / s.T);
    }
    if (s.late) { const k = Math.pow(tau / s.T, 3); out.x += s.late.x * k; out.y += s.late.y * k; }
    return i;
  }
  function endVel() {
    const s = B.segs[B.segs.length - 1], T = s.T;
    const v = { x: s.v.x + s.a.x * T, y: s.v.y + s.a.y * T, z: s.v.z };
    if (s.wob) {
      v.x += s.wob.ax * Math.PI * s.wob.kx / T * Math.cos(Math.PI * s.wob.kx);
      v.y += s.wob.ay * Math.PI * s.wob.ky / T * Math.cos(Math.PI * s.wob.ky);
    }
    if (s.late) { v.x += 3 * s.late.x / T; v.y += 3 * s.late.y / T; }
    return v;
  }
  /** 공 종류 · 도착점 · 비행시간으로 실제 궤적을 짓는다 (혼자·대결 공용) */
  function buildSegs(type, rel, tx, ty, T) {
    const tgt = { x: tx, y: ty, z: GLOVE_Z };
    switch (type) {
      case 'lob': return [fitSeg(rel, tgt, T, 9.8)];
      case 'grounder': {
        const bz = rand(2.6, 4.2), bx = lerp(rel.x, tx, 0.72);
        const T1 = Math.max(0.42, T * 0.72);
        const s1 = mkSeg(rel, { x: bx, y: BALL_R, z: bz }, T1, 6.5);
        const T2 = Math.max(0.2, T - T1);
        return [s1, mkSeg({ x: bx, y: BALL_R, z: bz }, tgt, T2, 9.8)];
      }
      case 'curve': {
        const ax = (Math.random() < 0.5 ? -1 : 1) * rand(2.4, 3.8);
        return [fitSeg(rel, tgt, T, 6.5, ax)];
      }
      case 'slider': {
        /* 끝에서 옆으로 확 — 마지막 몇 걸음에 몰아서 꺾인다 */
        const late = { x: (Math.random() < 0.5 ? -1 : 1) * rand(0.45, 0.7), y: 0 };
        const s = fitSeg(rel, { x: tx - late.x, y: ty, z: GLOVE_Z }, T, 6.5); s.late = late;
        return [s];
      }
      case 'fork': {
        /* 끝에서 뚝 — 높게 오다가 마지막에 떨어진다 */
        const late = { x: 0, y: -rand(0.45, 0.7) };
        const s = fitSeg(rel, { x: tx, y: ty - late.y, z: GLOVE_Z }, T, 6.5); s.late = late;
        return [s];
      }
      case 'fast': return [fitSeg({ ...rel, y: 1.72 }, tgt, T, 4.5)];
      case 'knuckle': {
        const sg = fitSeg(rel, tgt, T, 6.5);
        sg.wob = { ax: (Math.random() < 0.5 ? -1 : 1) * rand(0.16, 0.26), kx: 3, ay: rand(0.08, 0.14), ky: 2 };
        return [sg];
      }
      default: return [fitSeg(rel, tgt, T, 6.5)];
    }
  }
  /** 혼자 하기: 친구가 고르는 공 빠르기 */
  function pickSpeed(type) {
    const s = G.score, d = G.diff;
    let w = d === 'easy' ? [5, 4, s >= 10 ? 1 : 0] : d === 'hard' ? [2, 3.5, 4.5] : [2.5, 5, s >= 5 ? 2.5 : 0];
    if (type === 'lob') w = [w[0], w[1], w[2] * 0.4];
    const tot = w[0] + w[1] + w[2];
    let r = Math.random() * tot;
    for (let i = 0; i < 3; i++) { r -= w[i]; if (r <= 0) return i; }
    return 1;
  }
  function planThrow() {
    const s = G.score, gap = DF().typeGap;
    const pool = [['normal', 3]];
    if (s >= 5 * gap) pool.push(['lob', 1.1]);
    if (s >= 9 * gap) pool.push(['grounder', 1.1]);
    if (s >= 12 * gap) pool.push(['curve', 1.2]);
    if (s >= 16 * gap) pool.push(['slider', 1.2]);
    if (s >= 20 * gap) pool.push(['fork', 1.2]);
    if (s >= 28 * gap) pool.push(['knuckle', 1.0]);
    let type = 'normal';
    if (G.round > 2 && !G.easyNext) {
      let tot = 0; for (const [, w] of pool) tot += w;
      let r = Math.random() * tot;
      for (const [k, w] of pool) { r -= w; if (r <= 0) { type = k; break; } }
      for (const [k] of pool) if (!G.seenTypes.has(k)) { type = k; break; }
    }
    G.easyNext = false;
    G.seenTypes.add(type);
    const spreadX = Math.min(1.45, (0.2 + s * 0.045) * DF().spread);
    const yr = Math.min(0.85, (0.12 + s * 0.03) * DF().spread);
    let tx = rand(-spreadX, spreadX), ty = clamp(1.1 + rand(-yr * 0.95, yr), 0.3, 2.1);
    let T = 1.55 - Math.min(s, 40) * 0.017 + rand(-0.06, 0.06);
    if (G.round <= 2) { tx = clamp(P.gx, -0.5, 0.5) + rand(-0.12, 0.12); ty = rand(0.95, 1.2); T = 1.75; }
    if (type === 'lob') { ty = rand(1.4, 2.1); T = Math.max(1.45, 2.05 - s * 0.009); }
    if (type === 'grounder') { ty = rand(0.2, 0.5); tx *= 0.85; }
    if (type === 'curve') T += 0.08;
    if (type === 'knuckle') T += 0.18;
    const speed = G.round > 2 ? pickSpeed(type) : 1;
    T = Math.max(DF().minT, T * DF().T * SPEEDS[speed].T);
    const rel = { x: M.x - 0.2, y: 1.6, z: M.z - 0.3 };
    return { type, speed, segs: buildSegs(type, rel, tx, ty, T), target: { x: tx, y: ty, z: GLOVE_Z } };
  }
  /** 내가 던지는 공의 비행시간 (빠르기 · 구종 · 난이도) */
  function myThrowT() {
    let T;
    if (D) T = Math.max(0.8, 1.45 - D.rally * 0.035);
    else T = Math.max(0.62, 0.82 - G.score * 0.004) * 1.35;
    return Math.max(D ? DF().minT : 0.42, T * (D ? DF().T : 1) * SPEEDS[G.speed].T * PITCHES[G.pitch].Tk);
  }

  /* ---------- 던지기 : 조준 · 바람 · 판정 ---------- */
  const throwAmp = () => DF().amp * SPEEDS[G.speed].amp * PITCHES[G.pitch].amp;
  function swayAt(tt) {
    const a = throwAmp(), f = DF().freq, s = A.seed;
    return {
      x: a * (0.62 * Math.sin(tt * 1.9 * f + s) + 0.38 * Math.sin(tt * 4.3 * f + 1.1 + s * 2)),
      y: a * 0.8 * (0.6 * Math.sin(tt * 2.6 * f + 0.5 + s * 1.3) + 0.4 * Math.sin(tt * 5.1 * f + 2.0 + s * 3)),
    };
  }
  /** 과녁 크기 (m, 가로 반지름 — 세로는 ×0.8) */
  const zoneR = () => ({ g: DF().cG * DF().amp, o: DF().cO * DF().amp });
  const zoneC = () => ({ x: M.x, y: 1.05 });
  function zoneOf(x, y) {
    const c = zoneC(), r = zoneR();
    const d = Math.hypot(x - c.x, (y - c.y) / 0.8);
    return d < r.g ? 'g' : d < r.o ? 'o' : 'r';
  }
  function newWind() {
    const [a, b] = DF().wind;
    WIND.spd = rand(a, b); WIND.ang = rand(0, TAU);
    WIND.x = Math.cos(WIND.ang) * WIND.spd;      // + 오른쪽으로 분다
    WIND.h = Math.sin(WIND.ang) * WIND.spd;      // + 친구 쪽으로 (뒷바람)
  }
  /** 바람에 밀리는 거리 — 오래 날수록(느린 공일수록) 많이 밀린다 */
  const windDrift = (T) => ({ x: WIND.x * 0.045 * T, y: WIND.h * 0.02 * T });

  /* ---------- 진행 단계 ---------- */
  /* 대결이 끝난 뒤에는 늦게 도착한 연출이 '끝' 화면을 덮지 못한다 */
  function setPhase(p) { if (D && D.ended && p !== 'over') return; G.phase = p; G.phaseT = 0; }
  function say(text, dur) { M.say = text; M.sayT = dur; }
  function setPose(p) { M.pose = p; M.poseT = 0; }

  function resetRun() {
    Object.assign(G, { score: 0, lives: 3, combo: 0, maxCombo: 0, perfects: 0, nice: 0, errors: 0, strikes: 0, maxStrikes: 0, strikeAll: 0, level: 1,
      round: 0, paused: false, freeze: 0, recordShown: false, easyNext: false, outPending: false });
    G.seenTypes = new Set();
    Object.assign(P, { gx: 0, gy: 1.05, tgx: 0, tgy: 1.05, bodyX: 0.36, bodyV: 0, crouch: 0, lift: 0, glove: 0, closeT: 0, cooldown: 0, pending: null, throwT: -1, throwRate: 1 });
    Object.assign(M, { x: 0, z: PARTNER_Z, tx: 0, sayT: 0 });
    B.state = 'partner'; B.trail.length = 0;
    fx.parts.length = 0; fx.pops.length = 0; fx.rings.length = 0; fx.confetti.length = 0;
  }
  function startGame() {
    if (G.phase !== 'title' && G.phase !== 'over') return;
    ainit(); sfx('select');
    resetRun();
    closeSheets();
    $('title').hidden = true; $('over').hidden = true; $('pauseBox').hidden = true;
    hudEl.hidden = false; $('controls').hidden = false; $('errs').hidden = false;
    hud.score(false); hud.lives(); hud.level(); hud.combo(); hud.errs();
    setPose('cheer'); say('캐치볼 하자!', 1.4);
    setPhase('intro');
    banner('플레이 볼!', `${DF().label} · 공을 잡으면 1점!`);
    sfx('go'); audio.bgm('game');
  }
  function goTitle() {
    setPhase('title'); G.paused = false;
    $('over').hidden = true; $('pauseBox').hidden = true; hudEl.hidden = true; $('controls').hidden = true;
    $('hint').hidden = true; $('banner').hidden = true; $('step').hidden = true;
    $('title').hidden = false;
    refreshTitle();
    Object.assign(M, { x: 0, z: PARTNER_Z, tx: 0, sayT: 0 }); setPose('wave');
    B.state = 'partner';
    audio.bgm('title');
  }
  function nextRound() {
    G.round++;
    const s = G.score;
    if (s >= 8) { const r = Math.min(1.5, 0.35 + (s - 8) * 0.05); M.tx = clamp(rand(-r, r), -1.6, 1.6); }
    else M.tx = 0;
    setPose('idle');
    setPhase('reposition');
  }
  function startWindup() {
    G.plan = planThrow();
    setPose('windup');
    M.windDur = Math.max(0.45, 0.66 - G.score * 0.004);
    say(callFor(G.plan.type, G.plan.speed), M.windDur + 0.5);
    setPhase('windup');
    if (G.round <= 1) tutorial('move', fineMouse ? '마우스를 움직이면 글러브가 따라와요' : '화면을 손가락으로 끌면 글러브가 움직여요');
    if (G.plan.type !== 'normal' && !G.tut['type_' + G.plan.type]) tutorial('type_' + G.plan.type, TYPE_HINT[G.plan.type]);
    else if (G.plan.speed === 2 && !G.tut.fastIn) tutorial('fastIn', '빠른 볼! 금방 날아와요');
    else if (G.plan.speed === 0 && !G.tut.slowIn) tutorial('slowIn', '느린 볼~ 너무 일찍 누르지 마세요');
  }
  function launchPartnerBall() {
    const pl = G.plan;
    B.segs = pl.segs; B.launch = G.t; B.dur = pl.segs.reduce((a, s) => a + s.T, 0);
    B.arriveAt = G.t + B.dur; B.target = pl.target; B.type = pl.type; B.wild = !!pl.wild;
    B.state = 'flight'; B.toPlayer = true; B.segIdx = 0; B.trail.length = 0; B.bounces = 0;
    B.spin = pl.type === 'knuckle' ? 0.6 : 14;
    B.ballId = D ? (FRIEND.ball | 0) : 0;
    if (W3) {
      const h = W3.palHandPos(), s0 = B.segs[0];
      s0.v = { x: s0.v.x + (s0.p0.x - h.x) / s0.T, y: s0.v.y + (s0.p0.y - h.y) / s0.T, z: s0.v.z + (s0.p0.z - h.z) / s0.T };
      s0.p0 = { x: h.x, y: h.y, z: h.z };
    }
    evalBall(0, B.pos);
    P.pending = null;
    setPose('follow');
    sfx('throw', { speed: pl.speed ?? 1 });
    setPhase('flying');
    if (!D && G.round <= 2) tutorial('catch', fineMouse ? '작아지는 링이 공에 닿을 때 잡기!' : '링이 공에 닿을 때 잡기!\n(손을 떼고 화면을 톡 눌러도 잡혀요)');
    if (D && !G.tut.dcatch) tutorial('dcatch', '링이 공에 닿을 때 잡기!');
  }
  function onArrivePlayer() {
    B.arrGlove = { x: P.gx, y: P.gy };
    B.arrDist = Math.hypot(B.target.x - P.gx, B.target.y - P.gy);
    const R = catchR();
    if (B.wild) { B.state = 'free'; B.vel = endVel(); wildIn(); return; }
    if (P.pending) { resolveCatch(P.pending.dtA); return; }
    if (B.arrDist <= R) {
      if (P.closeT > 0) { deflect('early'); return; }
      B.state = 'atGlove';
      return;
    }
    B.state = 'free'; B.vel = endVel();
    miss('pos');
  }
  function resolveCatch(dtA) {
    const R = catchR(), d = B.arrDist;
    if (d > R) { B.state = 'free'; B.vel = endVel(); miss('pos'); return; }
    let grade;
    if (dtA >= -0.005 && dtA <= 0.11 && d <= R * 0.62) grade = 'perfect';
    else if (dtA >= -0.04 && dtA <= 0.17) grade = 'great';
    else grade = dtA < 0 ? 'late' : 'nice';
    caught(grade);
  }
  function caught(grade) {
    B.state = 'player'; P.pending = null; P.closeT = 0; P.glove = 1; P.hop = 0.28;
    G.score++; G.combo++; G.maxCombo = Math.max(G.maxCombo, G.combo);
    if (grade === 'perfect') G.perfects++;
    const gp = proj(P.gx, P.gy, GLOVE_Z);
    const big = grade === 'perfect';
    burst(gp.x, gp.y, big ? 16 : 10, big ? ['#ffd84a', '#fff', '#ffb02e'] : ['#fff', '#ffe9a8'], big ? 340 : 240, 'star');
    burst(gp.x, gp.y, 7, ['#e9d7b8', '#fff4dc'], 120, 'puff');
    fx.rings.push({ x: gp.x, y: gp.y, r: 10, vr: big ? 420 : 300, life: 0.35, max: 0.35, col: big ? '#ffd84a' : '#ffffff' });
    const label = { perfect: 'PERFECT!', great: 'GREAT!', nice: 'NICE CATCH!', late: '아슬아슬!' }[grade];
    const col = { perfect: '#ffd84a', great: '#ffb347', nice: '#ffffff', late: '#bff0ff' }[grade];
    popText(label, gp.x, gp.y - 46, col, big ? 40 : 32, 0.9);
    popText('+1', gp.x + 46, gp.y - 10, '#ffffff', 26, 0.7);
    sfx('catch', { grade });
    shake(big ? 7 : 4, 0.18);
    vibrate(big ? 30 : 18);
    G.freeze = big ? 0.09 : 0.04;
    hud.score(true); hud.combo();
    if (D) {
      D.rally++;
      sendResult({ perfect: 'p', great: 'g', nice: 'n', late: 'l' }[grade]);
      hud.level();
    } else {
      const lv = levelOf(G.score) + 1;
      if (lv > G.level) {
        G.level = lv; hud.level();
        if (lv > PR.bestLevel) {
          /* ★ 최고 레벨 갱신 → 그 레벨의 모자가 열린다 (선물함으로) */
          PR.bestLevel = lv; saveProgress();
          banner(`Lv.${lv} 모자 획득!`, `「${Art.HATS[lv - 1]?.name || '새 모자'}」 선물함을 확인하세요`, true);
          sfx('unlock'); confettiBurst();
          refreshGiftBadge();
        } else {
          banner(`Lv.${lv}`, LEVELS[lv - 1]); sfx('levelUp'); confettiBurst();
        }
        setPose('cheer'); say(pick(['대단해!', '최고야!', '와아~!']), 1.2);
      } else if (!G.recordShown && G.best > 0 && G.score === G.best + 1) {
        G.recordShown = true; banner('신기록!', `${G.score}개 돌파`); sfx('cheer');
      } else if (G.combo >= 3 && G.combo % 5 === 0) {
        say(`${G.combo}개 연속!`, 1);
      }
    }
    setPhase('caught');
  }
  function deflect(reason) {
    B.state = 'free';
    B.pos = { x: B.target.x, y: B.target.y, z: GLOVE_Z };
    B.vel = { x: rand(-2.2, 2.2), y: rand(2.6, 4), z: rand(-2.6, -1.2) };
    sfx('deflect');
    const gp = proj(B.pos.x, B.pos.y, GLOVE_Z);
    burst(gp.x, gp.y, 6, ['#fff'], 160, 'star');
    miss(reason);
  }
  function miss(reason) {
    if (G.phase !== 'flying') return;
    G.lives--; G.combo = 0;
    hud.lives(true); hud.combo();
    const gp = proj(P.gx, P.gy, GLOVE_Z);
    popText('놓쳤다!', gp.x, gp.y - 40, '#ff6b5e', 34, 1);
    let tip;
    if (reason === 'early') tip = '너무 빨리 눌렀어요!\n링이 공에 닿을 때 잡기';
    else if (reason === 'nopress') tip = '글러브 위치는 딱 좋았어요!\n이제 잡기 버튼을 눌러요 (화면을 톡!)';
    else {
      const dx = B.target.x - B.arrGlove.x, dy = B.target.y - B.arrGlove.y;
      if (Math.abs(dx) >= Math.abs(dy) * 0.9) tip = dx > 0 ? '공은 조금 더 오른쪽이었어요' : '공은 조금 더 왼쪽이었어요';
      else tip = dy > 0 ? '공이 더 높았어요. 글러브를 위로!' : '공이 더 낮았어요. 글러브를 아래로!';
    }
    showHint(tip, 2.2);
    sfx('miss'); shake(5, 0.2); vibrate([40, 40, 40]);
    setPose(D ? 'cheerSmall' : 'oops');
    if (D) { D.rally = 0; hud.level(); sendResult('m'); }
    setPhase('missed');
  }
  /** 대결: 상대 악송구 — 손이 안 닿는 공. 나는 아무것도 안 잃는다 */
  function wildIn() {
    if (G.phase !== 'flying') return;
    G.combo = 0; hud.combo();
    const p = proj(B.target.x, clamp(B.target.y, 0.3, 2.3), GLOVE_Z);
    popText('악송구!', p.x, p.y - 30, '#ffb84a', 32, 1);
    showHint('손이 닿지 않는 공이에요\n상대가 공 하나를 잃어요', 2.2);
    sfx('deflect');
    setPose('oops');
    D.rally = 0; hud.level();
    sendResult('w');
    setPhase('missed');
  }

  /* ---------- 던질 차례 ---------- */
  function beginHolding() {
    setPhase('holding');
    A.bx = M.x; A.by = 1.05; A.seed = rand(0, TAU);
    const s0 = swayAt(0); A.x = A.bx + s0.x; A.y = A.by + s0.y;
    newWind();
    if (WIND.spd > 1.5) sfx('wind', { strength: clamp(WIND.spd / 7.5, 0, 1) });
    setPose('ready');
    syncThrowPanel();
    if (D) {
      if (!G.tut.dthrow) tutorial('dthrow', '내 차례! 조준점이 초록일 때 화면을 위로 밀어 던져요\n바람도 봐야 해요');
      return;
    }
    if (G.round <= 2 || Math.random() < 0.3) say(pick(['여기!', '이쪽이야!', '던져~!']), 0.9);
    if (!G.tut.throw) tutorial('throw', fineMouse
      ? '조준점이 초록일 때 클릭(스페이스)! 빨강에서 던지면 실책이에요\n바람에 공이 밀려요'
      : '조준점이 초록일 때 화면을 아래에서 위로 쓱!\n빨강에서 던지면 실책 · 바람에 공이 밀려요');
    else if (!G.tut.speed && G.round >= 3) tutorial('speed', '빠르기와 구종을 고를 수 있어요\n빠를수록·변화구일수록 조준이 더 흔들려요');
  }
  /**
   * 던진다. fl = 쓸어 올리기 정보 {power(px/ms), dirX(가로/세로 비)} — 없으면 키보드·마우스(깨끗한 손놀림)
   * 판정은 **누른 순간** 정해진다(양궁처럼). 공은 자세가 끝날 때 손을 떠난다.
   */
  function doThrow(fl) {
    if (G.paused || G.phase !== 'holding') return;
    let ex = 0, ey = 0, note = '';
    if (fl) {
      ex = clamp(fl.dirX * 0.55, -0.45, 0.45);
      if (fl.power < 1.0) { ey = -(1.0 - fl.power) * 0.9; note = '약하게 밀었어요 — 공이 낮게 가요'; }
      else if (fl.power > 4.5) { ey = Math.min(0.3, (fl.power - 4.5) * 0.15); note = '너무 세게 밀었어요 — 공이 높게 가요'; }
      if (Math.abs(ex) > 0.12) note = ex > 0 ? '비스듬히 밀어서 오른쪽으로 갔어요' : '비스듬히 밀어서 왼쪽으로 갔어요';
    }
    const rx = A.x + ex, ry = A.y + ey;
    const zone = zoneOf(rx, ry);                 // 손놀림 (바람 전)
    const T = myThrowT();
    const dr = windDrift(T);
    let lx = rx + dr.x, ly = ry + dr.y;
    const c = zoneC();
    let res;
    if (zone === 'r') {
      /* 빨강 = 실책 — 손에 닿지 않는 곳으로 크게 빗나간다 */
      res = 'error';
      const sx = Math.sign((lx - c.x) || (Math.random() - 0.5));
      /* 대결: 받는 사람 손이 닿는 폭(REACH_X)을 확실히 벗어나야 상대 화면도 악송구로 읽는다 */
      lx = D ? sx * rand(2.3, 2.8) : c.x + sx * rand(1.9, 2.4);
      ly = clamp(c.y + (ly - c.y) * 2.2, 0.0, 3.1);
    } else {
      const d = Math.hypot(lx - c.x, (ly - c.y) / 0.8);
      res = d < zoneR().g ? 'strike' : 'ball';
      /* 대결: 볼은 바람에 밀려도 받을 수 있는 공이어야 한다 (안 그러면 상대가 악송구로 읽는다) */
      if (D) { lx = clamp(lx, -1.72, 1.72); ly = clamp(ly, 0.08, 2.5); }
    }
    Object.assign(A, { fx: lx, fy: ly, res, zone, T, note });
    P.throwT = 0;
    P.throwRate = (!D && G.guideLeft > 0) ? 0.42 : 1;
    if (P.throwRate < 1) { G.guideLeft--; local.set('guideLeft', G.guideLeft); $('hint').hidden = true; }
    pressBtn('throwBtn');
    sfx('select');
    setPhase('throwing');
  }
  function launchPlayerBall() {
    const hand = W3 ? W3.handPos() : { x: P.bodyX + 0.22, y: 1.5 + P.lift, z: 0.2 };
    const tgt = { x: A.fx, y: A.fy, z: M.z - 0.25 };
    let T = A.T;
    if (D) {
      /* 대결: 구종·빠르기·도착점을 한 줄로. 내 화면에서는 조금 느리게 — 상대 판정이 올 틈 */
      D.mySeq = D.seq + 1; D.result = null;
      const typeIdx = TYPES.indexOf(PITCHES[G.pitch].type) + (G.speed + 1) * 10;
      const th = `${D.gid}|${D.mySeq}|${typeIdx}|${Math.round(-A.fx * 100)}|${Math.round(A.fy * 100)}|${Math.round(T * 1000)}`;
      DUEL.send({ th });
      T = T + 0.12;
    }
    const segs = buildSegsTo(PITCHES[G.pitch].type, hand, tgt, T);
    B.segs = segs;
    B.launch = G.t; B.dur = segs.reduce((a, s) => a + s.T, 0); B.arriveAt = G.t + B.dur; B.target = tgt;
    B.state = 'flight'; B.toPlayer = false; B.segIdx = 0; B.trail.length = 0; B.spin = 16; B.bounces = 0;
    B.res = A.res; B.speed = G.speed; B.ballId = ballId();
    evalBall(0, B.pos);
    const c = zoneC();
    const dx = A.fx - c.x;
    M.judge = A.res === 'error' ? 'miss' : A.res === 'strike' ? 'nice' : (Math.abs(dx) > 0.75 || A.fy < 0.3) ? 'dive' : A.fy > 1.95 ? 'jump' : 'ok';
    M.dir = A.fx >= M.x ? 1 : -1;
    M.catchLocal = { x: clamp(A.fx - M.x, -0.5, 0.7), y: clamp(A.fy, 0.4, 1.85) };
    setPose('track');
    sfx('throw', { speed: G.speed });
    if (A.note && !D) showHint(A.note, 1.6);
    setPhase('toPartner');
  }
  /** 내 화면에서 친구 쪽으로 날아가는 공 (구종 모양을 흉내 낸다) */
  function buildSegsTo(type, hand, tgt, T) {
    if (type === 'slider' || type === 'fork') {
      const late = type === 'slider' ? { x: (Math.random() < 0.5 ? -1 : 1) * 0.5, y: 0 } : { x: 0, y: -0.5 };
      const s = mkSeg(hand, { x: tgt.x - late.x, y: tgt.y - late.y, z: tgt.z }, T, 6.5); s.late = late;
      return [s];
    }
    if (type === 'curve') return [mkSeg(hand, tgt, T, 6.5, (Math.random() < 0.5 ? -1 : 1) * 3)];
    return [mkSeg(hand, tgt, T, 6.5)];
  }
  function countStrike(res) {
    if (res === 'strike') {
      G.strikes++; G.strikeAll++; G.maxStrikes = Math.max(G.maxStrikes, G.strikes);
      hud.strk();
      if (G.strikes > PR.bestStrikes) {
        const before = PR.bestStrikes;
        PR.bestStrikes = G.strikes; saveProgress();
        const opened = Art.BALLS.findIndex((b, i) => b.need > before && b.need <= PR.bestStrikes && i > 0);
        if (opened > 0) {
          banner('야구공 획득!', `「${Art.BALLS[opened].name}」 선물함을 확인하세요`, true);
          sfx('unlock'); refreshGiftBadge();
        }
      }
    } else { G.strikes = 0; hud.strk(); }
  }
  function onArrivePartner() {
    if (D) {
      if (D.result == null) { B.state = 'hang'; setPhase('awaitResult'); return; }
      resolveMyThrow(D.result);
      return;
    }
    const res = B.res;
    const hp = proj(M.x, 1.95, M.z);
    countStrike(res);
    if (res === 'error') {
      B.state = 'free'; B.vel = endVel();
      G.combo = 0; hud.combo();
      G.errors++; hud.errs(true);
      setPose('oops'); say('어이쿠!', 0.9);
      popText('실책!', hp.x, hp.y - 10, '#ff6b5e', 30, 1.2);
      sfx('error'); voice('실책!'); shake(4, 0.18);
      if (G.errors >= MAX_ERRORS) G.outPending = true;
      else showHint(`실책 ${G.errors}개 — ${MAX_ERRORS}개면 아웃이에요\n조준점이 초록·주황일 때 던져요`, 2.2);
      M.fetch = 0;
      setPhase('fetch');
      return;
    }
    B.state = 'partner';
    sfx('catchSoft');
    if (res === 'strike') {
      popText('스트라이크!', hp.x, hp.y - 8, '#7cff6b', 32, 1.1);
      sfx('strike'); voice('스트라이크!');
      burst(M.glove ? M.glove.x : hp.x, M.glove ? M.glove.y : hp.y, 10, ['#7cff6b', '#fff'], 160, 'star');
      G.nice++;
    } else {
      popText(M.judge === 'dive' ? '다이빙 캐치! 볼' : M.judge === 'jump' ? '점프 캐치! 볼' : '볼!', hp.x, hp.y - 8, '#ffd27a', 24, 1);
      sfx('ball'); voice('볼');
    }
    setPose(M.judge === 'dive' ? 'diveHold' : M.judge === 'jump' ? 'jumpLand' : 'caught');
    G.holdDur = M.judge === 'dive' ? 1.15 : M.judge === 'jump' ? 0.8 : 0.5;
    setPhase('partnerHold');
  }
  /** 대결: 내가 던진 공의 결과 (상대가 판정해 돌려준 것) */
  function resolveMyThrow(res) {
    D.seq = D.mySeq; D.result = null;
    countStrike(A.res);
    const hp = proj(M.x, 1.95, M.z);
    if (res === 'm' || res === 'w') {
      B.state = 'free';
      B.vel = { x: rand(-1.5, 1.5) + (B.target.x - M.x) * 0.5, y: rand(1.5, 3), z: 6 };
      if (res === 'w') {
        G.lives--; G.errors++; hud.lives(true); hud.errs(true);
        popText('악송구! -1', hp.x, hp.y - 10, '#ff6b5e', 28, 1.2);
        showHint('빨강에서 던져서 실책이에요\n내 공이 하나 줄어요', 2.2);
        sfx('error'); voice('실책!'); shake(4, 0.18);
        setPose('oops');
        DUEL.send({ lives: Math.max(0, G.lives), ...(G.lives <= 0 ? { alive: false, done: true } : {}) });
        if (G.lives <= 0) { endDuel(false, 'lives'); return; }
      } else {
        popText('상대가 놓쳤다!', hp.x, hp.y - 10, '#7cff6b', 26, 1.2);
        sfx('cheer');
        setPose('oops');
      }
      D.rally = 0; G.combo = 0; hud.combo(); hud.level();
      G.holdDur = 1.1;
      setPhase('partnerHold');
      return;
    }
    B.state = 'partner';
    sfx('catchSoft');
    const txt = A.res === 'strike' ? '스트라이크! 잡았다' : ({ p: 'PERFECT 캐치!', g: '잡았다!', n: '잡았다!', l: '아슬아슬!' }[res] || '잡았다!');
    popText(txt, hp.x, hp.y - 8, A.res === 'strike' ? '#7cff6b' : '#ffffff', 24, 1);
    if (A.res === 'strike') { sfx('strike'); voice('스트라이크!'); }
    D.rally++; hud.level();
    setPose('caught');
    G.holdDur = 0.5;
    setPhase('partnerHold');
  }
  function sendResult(code) {
    const seq = D.seq + 1;
    D.seq = seq;
    const out = { ct: `${D.gid}|${seq}|${code}`, lives: Math.max(0, G.lives), score: G.score };
    if (G.lives <= 0) { out.alive = false; out.done = true; }
    DUEL.send(out);
    if (G.lives <= 0) later(() => endDuel(false, 'lives'), 900);
  }
  function startRemoteWindup(th) {
    D.inThrow = null;
    const tc = th.type | 0, sc = Math.floor(tc / 10);
    const type = TYPES[tc % 10] || 'normal';
    const speed = sc >= 1 && sc <= 3 ? sc - 1 : 1;
    const tx = th.x / 100, ty = th.y / 100, T = clamp(th.T / 1000, 0.38, 3);
    const rel = { x: M.x - 0.2, y: 1.6, z: M.z - 0.3 };
    G.plan = { type, speed, segs: buildSegs(type, rel, tx, ty, T), target: { x: tx, y: ty, z: GLOVE_Z }, wild: !reachable(tx, ty) };
    setPose('windup');
    M.windDur = 0.42;
    say(callFor(type, speed), 0.9);
    setPhase('windup');
    if (type !== 'normal' && TYPE_HINT[type] && !G.tut['type_' + type]) tutorial('type_' + type, TYPE_HINT[type]);
  }
  function endDuel(win, reason) {
    if (!D || D.ended) return;
    D.ended = true; D.win = win; D.reason = reason;
    hud.lives(); hud.opp();
    setPose(win ? 'oops' : 'cheer');
    if (win) { confettiBurst(); sfx('win'); } else sfx('lose');
    banner(win ? '승리!' : '패배', win ? (reason === 'gone' || reason === 'forfeit' ? '상대가 나갔어요' : '상대의 공이 다 떨어졌어요') : '내 공이 다 떨어졌어요');
    setPhase('over');
    saveProgress();
    try { DUEL.onEnd?.({ win, reason, myScore: G.score, oppScore: D.opp.score, maxStrikes: G.maxStrikes }); } catch (e) { /* 무시 */ }
    later(() => showDuelOver(), 1500);
  }
  function showDuelOver() {
    if (dead || G.phase !== 'over') return;
    $('soloBoard').hidden = true; $('duelBoard').hidden = false;
    $('stats').hidden = true; $('newRec').hidden = true;
    $('dMe').textContent = G.score; $('dOpp').textContent = D.opp.score;
    $('dOppName').textContent = D.oppName;
    $('overTitle').textContent = D.win ? '승리!' : '아쉽게 졌어요';
    $('rankLine').textContent = D.win ? (D.reason === 'gone' || D.reason === 'forfeit' ? '상대가 경기장을 떠났어요' : '끝까지 잘 잡았어요!') : '다음엔 꼭 이겨요!';
    $('retry').textContent = '한 판 더';
    $('home').textContent = '나가기';
    $('over').hidden = false;
    $('controls').hidden = true;
    $('retry').focus({ preventScroll: true });
  }
  function gameOver(byOut) {
    setPhase('over');
    const newBest = G.score > G.best;
    if (newBest) { G.best = G.score; BESTS[G.diff] = G.best; }
    if (G.maxCombo > (COMBOS[G.diff] | 0)) COMBOS[G.diff] = G.maxCombo;
    setPose(G.score >= 10 ? 'cheer' : 'idle');
    if (byOut) { banner('아웃!', `실책 ${MAX_ERRORS}개`); sfx('out'); voice('아웃!'); }
    else sfx('gameOver');
    audio.bgm(null);
    saveProgress();
    try { opts.onFinish?.({ score: G.score, diff: G.diff, maxCombo: G.maxCombo, maxStrikes: G.maxStrikes, level: G.level, byOut: !!byOut }); } catch (e) { /* 무시 */ }
    later(() => {
      if (G.phase !== 'over') return;
      $('overScore').textContent = G.score;
      $('soloLabel').textContent = `오늘 잡은 공 · ${DF().label}`;
      $('overBest').textContent = G.best;
      $('overPerfect').textContent = G.perfects;
      $('overCombo').textContent = G.maxCombo;
      $('overStrikes').textContent = G.maxStrikes;
      $('overStrikeAll').textContent = G.strikeAll;
      $('overErrors').textContent = G.errors;
      $('overRank').textContent = LEVELS[levelOf(G.score)];
      $('newRec').hidden = !newBest || G.score === 0;
      $('overTitle').textContent = byOut ? '실책 아웃!' : G.score >= 30 ? '굉장한 경기였어요!' : G.score >= 10 ? '멋진 경기!' : '경기 끝!';
      $('over').hidden = false;
      $('controls').hidden = true;
      $('retry').focus({ preventScroll: true });
    }, byOut ? 1500 : 750);
  }
  function saveProgress() {
    try { opts.onProgress?.({ bestLevel: PR.bestLevel, bestStrikes: PR.bestStrikes }); } catch (e) { /* 무시 */ }
  }

  /* ---------- 대결: 들어오는 값 ---------- */
  function parsePkt(s, n) {
    if (typeof s !== 'string') return null;
    const a = s.split('|');
    return a.length === n ? a : null;
  }
  function remote(node) {
    if (!D || D.ended || dead) return;
    if (!node) { endDuel(true, 'gone'); return; }
    if (node.seenAt !== undefined && node.seenAt !== D.opp.seenAt) { D.opp.seenAt = node.seenAt; D.opp.lastSeen = performance.now(); }
    if (typeof node.lives === 'number') D.opp.lives = node.lives;
    if (typeof node.score === 'number') D.opp.score = node.score;
    if (typeof node.gx === 'number') D.opp.gx = clamp((node.gx - 700) / 100, -1.6, 1.6);
    if (typeof node.gy === 'number') D.opp.gy = clamp(node.gy / 100, 0.1, 2.5);
    if (typeof node.nickname === 'string' && node.nickname) D.oppName = node.nickname;
    D.lastNode = node;
    const ct = parsePkt(node.ct, 3);
    if (ct && ct[0] === D.gid && (ct[1] | 0) === D.mySeq && D.mySeq > D.seq && D.result == null) {
      D.result = ct[2];
      if (G.phase === 'awaitResult') resolveMyThrow(D.result);
    }
    takeThrow(node);
    hud.opp();
    if (node.alive === false || node.done === true || node.lives === 0) {
      later(() => { if (!D.ended) endDuel(true, node.lives === 0 ? 'lives' : 'forfeit'); }, G.phase === 'awaitResult' || G.phase === 'toPartner' ? 900 : 300);
    }
  }
  function takeThrow(node) {
    if (!node || D.inThrow) return;
    const th = parsePkt(node.th, 6);
    if (!th || th[0] !== D.gid) return;
    const seq = th[1] | 0;
    if (seq === D.seq + 1 && D.mySeq !== seq) D.inThrow = { seq, type: th[2] | 0, x: +th[3], y: +th[4], T: +th[5] };
  }
  function publishGhost(force) {
    if (!D || D.ended) return;
    const now = performance.now();
    if (!force && now - D.ghost.at < 160) return;
    if (!force && Math.abs(P.gx - D.ghost.x) < 0.03 && Math.abs(P.gy - D.ghost.y) < 0.03) return;
    D.ghost = { at: now, x: P.gx, y: P.gy };
    DUEL.send({ gx: Math.round(P.gx * 100) + 700, gy: Math.round(clamp(P.gy, 0.1, 2.5) * 100) });
  }

  /* ---------- 입력 ---------- */
  function tryCatch() {
    if (G.paused || !isPlaying()) return;
    if (P.cooldown > 0 || B.state === 'player') return;
    P.closeT = 0.3; P.cooldown = 0.36;
    sfx('whiff');
    pressBtn('catchBtn');
    if (G.phase !== 'flying') return;
    if (B.state === 'flight' && B.toPlayer) {
      const dtA = B.arriveAt - G.t;
      if (dtA <= EARLY) { P.pending = { dtA }; P.closeT = dtA + 0.25; }
      else P.whiffAt = G.t;
    } else if (B.state === 'atGlove') {
      resolveCatch(B.arriveAt - G.t);
    }
  }
  function contextAction() { if (G.phase === 'holding') doThrow(); else tryCatch(); }
  const aimPhase = () => G.phase === 'holding';
  function moveBy(dx, dy) {
    if (aimPhase()) {
      /* 조준경 배율 그대로 — 손가락이 움직인 만큼 조준점도 움직인다 */
      A.bx = clamp(A.bx + dx / aimK, M.x - 2.6, M.x + 2.6);
      A.by = clamp(A.by - dy / aimK, 0.1, 3.0);
    } else {
      /* 글러브는 손가락을 빠르게 따라온다 (사용자 지정) */
      const sg = F / depthOf(1.1, GLOVE_Z);
      P.tgx = clamp(P.tgx + dx / sg * 1.7, -1.55, 1.55);
      P.tgy = clamp(P.tgy - dy / sg * 1.7, 0.15, 2.4);
    }
  }
  /**
   * 터치 하나를 따라간다.
   *   · 끌면 글러브(받을 때) 또는 조준 기준점(던질 때)이 움직인다
   *   · 던질 때 아래→위로 빠르게 쓸어 올리고 떼면 던진다 — 쓸어 올리는 동안 움직인 조준은 되돌린다
   *   · 받을 때 손을 떼고 **다시 누르면** 그 순간이 잡기다 (사용자 지정)
   */
  let drag = null, mouseLast = null;
  const baseHist = [];
  const toLocal = (e) => { const r = cvs.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  function tapCatchIfReady() {
    if (G.phase !== 'flying' || !B.toPlayer) return false;
    if (B.state === 'atGlove') { tryCatch(); return true; }
    if (B.state === 'flight' && B.arriveAt - G.t <= EARLY + 0.35) { tryCatch(); return true; }
    return false;
  }
  on(cvs, 'pointerdown', (e) => {
    ainit();
    if (drag) return;
    drag = { id: e.pointerType === 'mouse' ? 'mouse' : e.pointerId, x: e.clientX, y: e.clientY, pts: [{ t: performance.now(), x: e.clientX, y: e.clientY }], mouse: e.pointerType === 'mouse', moved: 0 };
    if (e.pointerType === 'mouse') {
      mouseLast = { x: e.clientX, y: e.clientY };
      if (e.button === 0 && isPlaying() && !aimPhase()) tryCatch();
      return;
    }
    try { cvs.setPointerCapture(e.pointerId); } catch (err) { /* 무시 */ }
    e.preventDefault();
    if (!G.paused) tapCatchIfReady();
  });
  on(cvs, 'pointermove', (e) => {
    if (e.pointerType === 'mouse') {
      const dragging = drag && drag.mouse;
      if (mouseLast && Math.abs(mouseLast.x - e.clientX) + Math.abs(mouseLast.y - e.clientY) < 1.5) return;
      if (!isPlaying() || G.paused) { mouseLast = { x: e.clientX, y: e.clientY }; return; }
      if (aimPhase()) {
        if (dragging) { drag.pts.push({ t: performance.now(), x: e.clientX, y: e.clientY }); if (drag.pts.length > 16) drag.pts.shift(); }
        if (mouseLast) moveBy(e.clientX - mouseLast.x, e.clientY - mouseLast.y);
        baseHist.push({ t: performance.now(), bx: A.bx, by: A.by }); if (baseHist.length > 30) baseHist.shift();
      } else {
        const lpnt = toLocal(e);
        const w = unproject(lpnt.x, lpnt.y, GLOVE_Z);
        P.tgx = clamp(w.x, -1.55, 1.55); P.tgy = clamp(w.y, 0.15, 2.4);
      }
      mouseLast = { x: e.clientX, y: e.clientY };
      return;
    }
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.x = e.clientX; drag.y = e.clientY; drag.moved += Math.abs(dx) + Math.abs(dy);
    drag.pts.push({ t: performance.now(), x: e.clientX, y: e.clientY }); if (drag.pts.length > 16) drag.pts.shift();
    if (!G.paused && isPlaying()) {
      moveBy(dx, dy);
      if (aimPhase()) { baseHist.push({ t: performance.now(), bx: A.bx, by: A.by }); if (baseHist.length > 30) baseHist.shift(); }
    }
  });
  /** 마지막 0.15초가 빠르게 위로 쓸어 올린 것이면 던지기 */
  function flickOf(pts) {
    if (!pts || pts.length < 2) return null;
    const end = pts[pts.length - 1];
    let start = end;
    for (let i = pts.length - 1; i >= 0; i--) { if (end.t - pts[i].t > 150) break; start = pts[i]; }
    const dt = Math.max(16, end.t - start.t), dy = end.y - start.y, dx = end.x - start.x;
    const vy = dy / dt;
    if (-dy > 40 && -vy > 0.55 && Math.abs(dx) < Math.abs(dy) * 1.3) return { power: -vy, dirX: dx / -dy, t0: start.t };
    return null;
  }
  const endDrag = (e) => {
    if (!drag) return;
    if (e.pointerType === 'mouse' ? !drag.mouse : e.pointerId !== drag.id) return;
    const d = drag; drag = null;
    if (G.phase !== 'holding' || G.paused) return;
    const fl = flickOf(d.pts);
    if (fl) {
      /* 쓸어 올리는 동안 같이 움직인 조준 기준점을 그 전 자리로 되돌린다 */
      for (let i = baseHist.length - 1; i >= 0; i--) if (baseHist[i].t <= fl.t0) { A.bx = baseHist[i].bx; A.by = baseHist[i].by; break; }
      doThrow(d.mouse ? null : fl);
    } else if (d.mouse && d.moved < 6) {
      doThrow();                                  // 마우스는 클릭이 곧 던지기
    } else if (!d.mouse && d.moved < 8 && !G.tut.swipeNag) {
      G.tut.swipeNag = true; showHint('던질 땐 화면을 아래에서 위로 쓱 밀어 올려요!', 2);
    }
  };
  on(cvs, 'pointerup', endDrag);
  on(cvs, 'pointercancel', (e) => { if (drag && (e.pointerType === 'mouse' || e.pointerId === drag.id)) drag = null; });
  on(cvs, 'contextmenu', (e) => e.preventDefault());

  function bindAct(key, fn) {
    const el = $(key);
    let viaPointer = false;
    on(el, 'pointerdown', (e) => { e.preventDefault(); ainit(); viaPointer = true; fn(e); });
    on(el, 'click', (e) => { if (viaPointer) { viaPointer = false; return; } fn(e); });
  }
  bindAct('catchBtn', () => tryCatch());
  bindAct('throwBtn', (e) => {
    if (G.phase !== 'holding') return;
    if (e && e.pointerType === 'touch') { showHint('던질 땐 화면을 아래에서 위로 쓱 밀어 올려요!', 2); return; }
    doThrow();
  });
  function pressBtn(key) {
    const el = $(key);
    el.classList.add('down');
    later(() => el.classList.remove('down'), 110);
  }

  const keys = {};
  const ARROWS = { ArrowLeft: 1, ArrowRight: 1, ArrowUp: 1, ArrowDown: 1 };
  on(window, 'keydown', (e) => {
    const code = e.code;
    if (ARROWS[code] && !sheetOpen()) e.preventDefault();
    keys[code] = true;
    if (e.repeat) { if (code === 'Space') e.preventDefault(); return; }
    ainit();
    if (sheetOpen()) { if (code === 'Escape') closeSheets(); return; }
    if (G.phase === 'title') {
      if ((code === 'Enter' || code === 'Space') && !(document.activeElement && root.contains(document.activeElement) && document.activeElement.tagName === 'BUTTON')) { e.preventDefault(); startGame(); }
      return;
    }
    if (code === 'KeyP') { requestPause(); return; }
    if (G.paused || G.phase === 'over') return;
    if (code === 'Space' || code === 'Enter') {
      if (document.activeElement && document.activeElement.tagName === 'BUTTON' && root.contains(document.activeElement)) document.activeElement.blur();
      e.preventDefault(); contextAction();
    }
    else if (code === 'KeyZ' || code === 'KeyJ') tryCatch();
    else if (code === 'KeyX' || code === 'KeyK') doThrow();
    else if (code === 'Digit1' || code === 'Numpad1') setSpeed(0);
    else if (code === 'Digit2' || code === 'Numpad2') setSpeed(1);
    else if (code === 'Digit3' || code === 'Numpad3') setSpeed(2);
    else if (code === 'Digit4') setPitch(0);
    else if (code === 'Digit5') setPitch(1);
    else if (code === 'Digit6') setPitch(2);
    else if (code === 'Digit7') setPitch(3);
  });
  on(window, 'keyup', (e) => { keys[e.code] = false; });
  on(window, 'blur', () => { for (const k in keys) keys[k] = false; });
  function keysUpdate(dt) {
    const kx = (keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA ? 1 : 0);
    const ky = (keys.ArrowUp || keys.KeyW ? 1 : 0) - (keys.ArrowDown || keys.KeyS ? 1 : 0);
    if (!kx && !ky) return;
    if (aimPhase()) {
      A.bx = clamp(A.bx + kx * 1.4 * dt, M.x - 2.6, M.x + 2.6);
      A.by = clamp(A.by + ky * 1.1 * dt, 0.1, 3.0);
    } else {
      P.tgx = clamp(P.tgx + kx * 4.4 * dt, -1.55, 1.55);
      P.tgy = clamp(P.tgy + ky * 3.6 * dt, 0.15, 2.4);
    }
  }

  /* ---------- 업데이트 ---------- */
  function update(dt) {
    if (G.freeze > 0) { G.freeze -= dt; dt *= 0.1; }
    G.t += dt; G.phaseT += dt;
    keysUpdate(dt);
    updatePlayer(dt);
    updatePartner(dt);
    updateBall(dt);
    phaseLogic(dt);
    updateFx(dt);
    updateShake(dt);
    if (D && !D.ended) {
      if (['oppHold', 'windup', 'flying', 'reposition'].includes(G.phase)) publishGhost(false);
      if (G.phase !== 'vs' && performance.now() - D.opp.lastSeen > (DUEL.absentMs || 30000)) endDuel(true, 'gone');
    }
  }
  function updatePlayer(dt) {
    const holding = B.state === 'player';
    const throwing = P.throwT >= 0;
    if (throwing) {
      /* 던지는 동안 글러브는 자세표를 따른다 (몸은 제자리) */
      P.throwT += dt * P.throwRate;
      const u = P.throwT / THROW_DUR;
      const k = throwPose(u);
      P.gx = P.bodyX + k.gh[0]; P.gy = k.gh[1] + P.lift; P.tgx = P.gx; P.tgy = P.gy;
      if (u >= 1) { P.throwT = -1; P.throwRate = 1; $('step').hidden = true; }
    } else {
      let gx = P.tgx, gy = P.tgy;
      if (holding) {
        if (G.phase === 'caught' && G.phaseT < 0.22) { gx = P.gx; gy = P.gy; }
        else { gx = P.bodyX - 0.02; gy = 0.9; }
      }
      const k = 1 - Math.exp(-dt * (holding ? 12 : 46));
      P.gx += (gx - P.gx) * k; P.gy += (gy - P.gy) * k;
      if (holding) { P.tgx = P.gx; P.tgy = P.gy; }
      const bx = clamp(P.gx + (holding ? 0.02 : 0.36), -1.3, 1.62);
      const prev = P.bodyX;
      P.bodyX += (bx - P.bodyX) * (1 - Math.exp(-dt * 9));
      P.bodyV = (P.bodyX - prev) / Math.max(dt, 1e-4);
      P.runPh += Math.abs(P.bodyV) * dt * 9;
    }
    const wantCrouch = throwing ? 0 : clamp((0.72 - P.gy) / 0.5, 0, 1);
    const wantLift = throwing ? 0 : clamp(P.gy - 1.42, 0, 0.8) + (P.hop > 0 ? Math.sin((0.28 - P.hop) / 0.28 * Math.PI) * 0.08 : 0);
    const kk = 1 - Math.exp(-dt * 14);
    P.crouch += (wantCrouch - P.crouch) * kk;
    P.lift += (wantLift - P.lift) * kk;
    if (P.hop > 0) P.hop -= dt;
    P.closeT -= dt; P.cooldown -= dt;
    let gt;
    if (holding) gt = 1;
    else if (P.pending) gt = (B.arriveAt - G.t) < 0.06 ? 1 : 0.35;
    else gt = P.closeT > 0 ? 1 : 0;
    P.glove += (gt - P.glove) * (1 - Math.exp(-dt * 30));
    if (throwing && P.throwRate < 1) {
      const s = stepOf(P.throwT / THROW_DUR);
      if ($('stepT').textContent !== s.t) { $('stepT').textContent = s.t; $('stepTip').textContent = s.tip; }
      $('step').hidden = false;
    }
  }
  function moveToward(tx, tz, step) {
    const dx = tx - M.x, dz = tz - M.z, d = Math.hypot(dx, dz);
    if (d <= step || d < 1e-4) { M.x = tx; M.z = tz; return true; }
    M.x += dx / d * step; M.z += dz / d * step;
    return false;
  }
  function updatePartner(dt) {
    M.poseT += dt;
    if (M.sayT > 0) M.sayT -= dt;
    if (G.phase === 'reposition') {
      const arrived = moveToward(M.tx, PARTNER_Z, 2.6 * dt);
      M.pose = arrived ? 'idle' : 'shuffle';
      M.runPh += dt * 14;
    }
    if (G.phase === 'fetch') M.runPh += dt * 16;
    if (D && ['holding', 'throwing', 'toPartner', 'awaitResult', 'oppHold', 'vs'].includes(G.phase)) {
      const want = -clamp(D.opp.gx + 0.33, -1.3, 1.62);
      M.x += (want - M.x) * (1 - Math.exp(-dt * 6));
    }
  }
  function updateBall(dt) {
    B.rot += B.spin * dt;
    if (B.state === 'flight') {
      const tr = G.t - B.launch;
      if (tr < B.dur) {
        const idx = evalBall(tr, B.pos);
        if (idx !== B.segIdx) {
          B.segIdx = idx; sfx('bounce');
          const p = proj(B.pos.x, 0, B.pos.z);
          burst(p.x, p.y, 6, ['#d9c39a', '#efe1c0'], 70, 'puff');
        }
      } else {
        evalBall(B.dur, B.pos);
        if (B.toPlayer) onArrivePlayer(); else onArrivePartner();
      }
    } else if (B.state === 'atGlove') {
      B.pos.x = B.target.x; B.pos.y = B.target.y; B.pos.z = GLOVE_Z;
      if (G.t > B.arriveAt + LATE) deflect('nopress');
    } else if (B.state === 'hang') {
      B.pos.y = B.target.y + Math.sin(G.t * 9) * 0.02;
    } else if (B.state === 'free') {
      const v = B.vel, p = B.pos;
      v.y -= 9.8 * dt;
      p.x += v.x * dt; p.y += v.y * dt; p.z += v.z * dt;
      if (p.y < BALL_R) {
        p.y = BALL_R;
        if (v.y < -1.2) {
          v.y = -v.y * 0.42; v.x *= 0.78; v.z *= 0.72;
          if (B.bounces++ < 3 && p.z > cam.z + 2) sfx('bounce');
        } else {
          v.y = 0; const f = Math.exp(-dt * 3.2); v.x *= f; v.z *= f;
        }
      }
      if (p.z > 43 && v.z > 0) { p.z = 43; v.z = -v.z * 0.35; }
    }
    if (B.state === 'flight' || B.state === 'free') {
      const p = proj(B.pos.x, B.pos.y, B.pos.z);
      if (p.depth > 0.9) { B.trail.push({ x: p.x, y: p.y, r: Math.max(2.6, BALL_R * p.s) }); if (B.trail.length > 7) B.trail.shift(); }
    } else if (B.trail.length) B.trail.shift();
  }
  function phaseLogic(dt) {
    switch (G.phase) {
      case 'intro':
        if (G.phaseT > 1.7) nextRound();
        break;
      case 'vs': {
        const left = D.startAt - performance.now();
        const n = Math.ceil(left / 1000);
        const el = $('vsCount');
        const txt = left > 0 ? String(Math.max(1, n)) : '';
        if (el.textContent !== txt) { el.textContent = txt; if (txt) sfx('countdown'); }
        if (left <= 0) beginDuel();
        break;
      }
      case 'reposition':
        if (G.phaseT > 0.3 && M.x === M.tx && M.z === PARTNER_Z) startWindup();
        break;
      case 'windup':
        if (M.poseT >= M.windDur) launchPartnerBall();
        break;
      case 'caught':
        if (G.phaseT > 0.55) beginHolding();
        break;
      case 'holding': {
        const sw = swayAt(G.phaseT);
        A.x = A.bx + sw.x;
        A.y = clamp(A.by + sw.y, 0.0, 3.3);
        if (D) {
          const left = HOLD_LIMIT - G.phaseT;
          if (left < 5 && !G.tut['hold' + D.seq]) { G.tut['hold' + D.seq] = true; showHint('5초 안에 던져요!', 2); }
          if (left <= 0) doThrow();
        }
        break;
      }
      case 'throwing':
        if (P.throwT >= 0 && P.throwT / THROW_DUR >= RELEASE_U && B.state === 'player') launchPlayerBall();
        break;
      case 'partnerHold':
        if (G.phaseT > G.holdDur) {
          if (D) { B.state = 'partner'; setPose('idle'); setPhase('oppHold'); }
          else nextRound();
        }
        break;
      case 'oppHold':
        if (!D.inThrow) takeThrow(D.lastNode);
        if (D.inThrow && G.phaseT > 0.35) startRemoteWindup(D.inThrow);
        else if (G.phaseT > 4 && M.sayT <= 0 && !D.inThrow) say(pick(['어디로 던질까~', '조준 중...', '흐음~']), 1.6);
        break;
      case 'fetch': fetchLogic(dt); break;
      case 'missed':
        if (G.phaseT > 1.6) {
          if (D) {
            if (D.ended) break;
            B.state = 'player'; P.glove = 1;
            if (G.lives <= 0) break;
            beginHolding();
          } else if (G.lives <= 0) gameOver(false);
          else { B.state = 'partner'; G.easyNext = true; say('괜찮아! 다시 간다~', 1.3); nextRound(); }
        }
        break;
    }
  }
  function beginDuel() {
    $('vs').hidden = true;
    hudEl.hidden = false; $('controls').hidden = false;
    banner('플레이 볼!', D.iStart ? '내가 먼저 던져요' : '상대가 먼저 던져요');
    sfx('go'); audio.bgm('duel');
    publishGhost(true);
    if (D.iStart) { B.state = 'player'; P.glove = 1; beginHolding(); }
    else { B.state = 'partner'; setPose('idle'); setPhase('oppHold'); }
  }
  function fetchLogic(dt) {
    if (M.fetch === 0) {
      if (G.phaseT > 0.5) { M.fetch = 1; setPose('runAway'); }
    } else if (M.fetch === 1) {
      const tz = Math.max(PARTNER_Z, B.pos.z + 0.3);
      moveToward(B.pos.x, tz, 6.5 * dt);
      const d = Math.hypot(B.pos.x - M.x, tz - M.z);
      if ((d < 0.6 && Math.hypot(B.vel.x, B.vel.z) < 3) || G.phaseT > 5) {
        B.state = 'partner'; M.fetch = 2; setPose('runBack'); say('잡았다~', 0.8);
        const s = G.score; const r = s >= 8 ? Math.min(1.5, 0.35 + (s - 8) * 0.05) : 0;
        M.tx = clamp(rand(-r, r), -1.6, 1.6);
      }
    } else if (M.fetch === 2) {
      if (moveToward(M.tx, PARTNER_Z, 6 * dt)) {
        if (G.outPending) { G.outPending = false; gameOver(true); return; }
        G.round++; startWindup();
      }
    }
  }

  /* ---------- 친구(상대) 자세 ---------- */
  /** 자세표(뒤에서 본 기준)를 앞모습으로 뒤집어 옮긴다 */
  function frontFromKeys(p, k) {
    p.rh = { x: -k.rh[0], y: k.rh[1] }; p.gh = { x: -k.gh[0], y: k.gh[1] };
    p.fR = { x: -k.fG[0], y: k.fG[1], f: k.fG[2] }; p.fL = { x: -k.fT[0], y: k.fT[1], f: k.fT[2] };
    p.turn = k.turn; p.crouch = k.cr;
  }
  function partnerPose(t) {
    const p = Art.basePose();
    const inGlove = B.state === 'partner';
    p.ballGlove = inGlove;
    const bob = Math.sin(t * 3) * 0.012;
    switch (M.pose) {
      case 'wave':
        p.rh = { x: -0.3 + Math.sin(t * 9) * 0.07, y: 1.42 }; p.face = 'grin'; break;
      case 'cheer': {
        const j = Math.abs(Math.sin(M.poseT * 7));
        p.lift = j * 0.12; p.rh = { x: -0.33, y: 1.42 }; p.gh = { x: 0.33, y: 1.4 }; p.face = 'grin';
        p.fL.y = j * 0.05; p.fR.y = j * 0.05;
        if (M.poseT > 1.3 && G.phase !== 'over') setPose('idle');
        break;
      }
      case 'cheerSmall':
        p.rh = { x: -0.33, y: 1.4 }; p.face = 'grin';
        if (M.poseT > 1.2) setPose('idle');
        break;
      case 'shuffle': {
        const ph = M.runPh;
        p.fL = { x: -0.13 + Math.sin(ph) * 0.04, y: Math.max(0, Math.sin(ph)) * 0.07 };
        p.fR = { x: 0.13 + Math.sin(ph) * 0.04, y: Math.max(0, -Math.sin(ph)) * 0.07 };
        p.gh = { x: 0.2, y: 0.72 }; break;
      }
      case 'windup': {
        /* 와인드업은 자세표의 ①~⑤ (공을 놓는 순간까지) */
        const u = clamp(M.poseT / M.windDur, 0, 1) * RELEASE_U;
        frontFromKeys(p, throwPose(u));
        p.ballHand = u >= 0.12; p.ballGlove = u < 0.12; p.face = 'focus';
        break;
      }
      case 'follow': {
        /* 팔로스루 ⑥ */
        const u = RELEASE_U + clamp(M.poseT / 0.32, 0, 1) * (1 - RELEASE_U);
        frontFromKeys(p, throwPose(u));
        p.face = 'smile';
        if (M.poseT > 0.6) setPose('watch');
        break;
      }
      case 'watch':
        p.gh = { x: 0.2, y: 0.7 + bob }; p.face = 'o'; break;
      case 'ready':
        if (D) {
          p.gh = { x: 0.24, y: clamp(D.opp.gy, 0.35, 1.9) }; p.rh = { x: -0.26, y: 0.6 }; p.face = 'focus';
          if (D.opp.gy < 0.7) p.crouch = clamp((0.7 - D.opp.gy) / 0.5, 0, 1);
        } else { p.gh = { x: 0.24, y: 0.98 + bob }; p.rh = { x: -0.26, y: 0.6 }; p.face = 'grin'; }
        break;
      case 'track': {
        const rem = B.launch + B.dur - G.t;
        const tg = M.catchLocal;
        if (M.judge === 'dive') {
          const d = ease(clamp(1 - rem / 0.4, 0, 1));
          p.rot = M.dir * 1.2 * d; p.offX = M.dir * 0.6 * d;
          p.gh = { x: M.dir * 0.15, y: lerp(1.05, 1.5, d) }; p.face = 'o';
          p.fL.y = d * 0.1;
        } else if (M.judge === 'jump') {
          const d = clamp(1 - rem / 0.45, 0, 1);
          p.lift = Math.sin(d * Math.PI * 0.5) * clamp(B.target.y - 1.75, 0.25, 0.9);
          p.gh = { x: tg.x, y: Math.min(1.85, B.target.y - p.lift) }; p.face = 'o';
          p.fL.y = 0.12 * d; p.fR.y = 0.08 * d;
        } else if (M.judge === 'miss') {
          p.face = 'o'; p.gh = { x: 0.3, y: 1.1 };
        } else {
          const k = ease(clamp(1 - rem / (B.dur * 0.8), 0, 1));
          p.gh = lp({ x: 0.24, y: 0.98 }, tg, k); p.face = 'smile';
          if (Math.abs(tg.x) > 0.45) p.offX = Math.sign(tg.x) * 0.15 * k;
        }
        break;
      }
      case 'caught': {
        const k = ease(clamp((M.poseT - 0.15) / 0.35, 0, 1));
        p.gh = lp(M.catchLocal, { x: 0.2, y: 0.72 }, k); p.gloveClosed = 1 - k * 0.6; p.face = 'grin';
        break;
      }
      case 'diveHold': {
        const d = 1 - ease(clamp((M.poseT - 0.5) / 0.5, 0, 1));
        p.rot = M.dir * 1.2 * d; p.offX = M.dir * 0.6 * d;
        p.gh = { x: M.dir * 0.15, y: lerp(0.9, 1.5, d) }; p.gloveClosed = 1; p.face = d > 0.5 ? 'o' : 'grin';
        break;
      }
      case 'jumpLand': {
        const k = clamp(M.poseT / 0.3, 0, 1);
        p.lift = (1 - k) * 0.3; p.gh = lp({ x: M.catchLocal.x, y: 1.8 }, { x: 0.2, y: 0.72 }, ease(k)); p.gloveClosed = 1; p.face = 'grin';
        break;
      }
      case 'oops':
        p.face = 'oops'; p.rh = { x: -0.13, y: 1.28 }; p.gh = { x: 0.25, y: 0.72 }; break;
      case 'runAway':
      case 'runBack': {
        const ph = M.runPh;
        p.fL = { x: -0.1, y: Math.max(0, Math.sin(ph)) * 0.16 };
        p.fR = { x: 0.1, y: Math.max(0, -Math.sin(ph)) * 0.16 };
        p.rh = { x: -0.3, y: 0.75 + Math.sin(ph) * 0.12 };
        p.gh = { x: 0.3, y: 0.78 - Math.sin(ph) * 0.12 };
        p.lift = Math.abs(Math.sin(ph)) * 0.04;
        if (M.pose === 'runBack') { p.ballHand = true; p.ballGlove = false; p.face = 'grin'; }
        break;
      }
      default:
        p.gh = { x: 0.2, y: 0.7 + bob };
    }
    if (D && G.phase === 'oppHold' && inGlove) { p.face = 'focus'; p.gh = { x: 0.12, y: 0.86 }; p.rh = { x: -0.05, y: 0.86 }; }
    return p;
  }
  function playerPose() {
    const p = Art.basePose();
    p.crouch = P.crouch; p.lift = P.lift;
    p.fL = { x: -0.11 - P.crouch * 0.09, y: 0, f: 0 };
    p.fR = { x: 0.11 + P.crouch * 0.09, y: 0, f: 0 };
    p.rh = { x: 0.28, y: 0.56 - P.crouch * 0.12 };
    const mv = Math.min(1, Math.abs(P.bodyV) * 0.7);
    if (mv > 0.05 && P.lift < 0.05) {
      p.fL.y = Math.max(0, Math.sin(P.runPh)) * 0.13 * mv;
      p.fR.y = Math.max(0, -Math.sin(P.runPh)) * 0.13 * mv;
      p.rh.y += Math.sin(P.runPh) * 0.06 * mv;
    }
    if (P.lift > 0.03) { p.fL.y = Math.min(0.12, P.lift * 0.3); p.fR.y = Math.min(0.16, P.lift * 0.4); }
    if (B.state === 'player' && P.throwT < 0) p.rh = { x: 0.06, y: 0.88 };     // 공을 쥐고 준비
    if (P.throwT >= 0) {
      const u = P.throwT / THROW_DUR;
      const k = throwPose(u);
      p.rh = { x: k.rh[0], y: k.rh[1] };
      p.fL = { x: k.fG[0], y: k.fG[1], f: k.fG[2] };
      p.fR = { x: k.fT[0], y: k.fT[1], f: k.fT[2] };
      p.turn = k.turn; p.crouch = k.cr;
      p.ballHand = u > 0.12 && u < RELEASE_U;
    }
    return p;
  }

  /* ---------- 효과 ---------- */
  const fx = { parts: [], pops: [], rings: [], confetti: [], swirl: null };
  function burst(x, y, n, cols, spd, kind) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), v = rand(0.35, 1) * spd;
      fx.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - spd * 0.25, life: rand(0.35, 0.65), max: 0.6,
        r: kind === 'puff' ? rand(5, 10) : rand(4, 8), col: pick(cols), kind, rot: rand(0, TAU) });
    }
  }
  function popText(text, x, y, col, size, life) { fx.pops.push({ text, x, y, col, size, life, max: life }); }
  function confettiBurst() {
    const cols = ['#e23b2e', '#ffd84a', '#2f6fe0', '#7cff6b', '#ffffff', '#ff8ad8'];
    for (let i = 0; i < 90; i++) {
      fx.confetti.push({ x: rand(0, W), y: rand(-H * 0.3, -10), vx: rand(-40, 40), vy: rand(80, 220), rot: rand(0, TAU), vr: rand(-8, 8),
        w: rand(6, 11), h: rand(3, 6), col: pick(cols), life: 3.2 });
    }
  }
  function updateFx(dt) {
    for (const q of fx.parts) { q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += (q.kind === 'puff' ? 60 : 420) * dt; q.vx *= 0.96; q.rot += dt * 6; }
    fx.parts = fx.parts.filter((q) => q.life > 0);
    for (const q of fx.pops) { q.life -= dt; q.y -= dt * 40; }
    fx.pops = fx.pops.filter((q) => q.life > 0);
    for (const q of fx.rings) { q.life -= dt; q.r += q.vr * dt; }
    fx.rings = fx.rings.filter((q) => q.life > 0);
    for (const q of fx.confetti) { q.life -= dt; q.x += (q.vx + Math.sin(q.rot) * 30) * dt; q.y += q.vy * dt; q.rot += q.vr * dt; }
    fx.confetti = fx.confetti.filter((q) => q.life > 0 && q.y < H + 20);
    if (fx.swirl) { fx.swirl.life -= dt; if (fx.swirl.life <= 0) fx.swirl = null; }
  }
  let shaking = false;
  function shake(mag, dur) { G.shakeMag = mag; G.shakeT = dur; }
  function updateShake(dt) {
    if (G.shakeT > 0) {
      G.shakeT -= dt;
      const m = G.shakeMag * Math.max(0, G.shakeT) / 0.2;
      cvs.style.transform = `translate(${rand(-m, m).toFixed(1)}px,${rand(-m, m).toFixed(1)}px)`;
      if (glCv) glCv.style.transform = cvs.style.transform;
      shaking = true;
    } else if (shaking) { cvs.style.transform = ''; if (glCv) glCv.style.transform = ''; shaking = false; }
  }
  function vibrate(p) {
    try { const ua = navigator.userActivation; if (navigator.vibrate && (!ua || ua.hasBeenActive)) navigator.vibrate(p); } catch (e) { /* 막힌 환경 */ }
  }

  /* ---------- 렌더 ---------- */
  const clouds = [{ x: 0.08, y: 0.32, s: 1.0, v: 7 }, { x: 0.5, y: 0.2, s: 0.72, v: 5 }, { x: 0.82, y: 0.48, s: 1.15, v: 9 }, { x: 0.32, y: 0.62, s: 0.6, v: 4 }];
  let titleRect = null;
  function drawClouds() {
    const hz = horizonY();
    const k = clamp(Math.min(W, 1000) / 640, 0.7, 1.4);
    /* 바람이 불면 구름도 그쪽으로 흐른다 */
    const wv = G.phase === 'holding' ? WIND.x * 6 : 0;
    for (const cl of clouds) {
      const w = 200 * cl.s * k, h = w * 160 / 360;
      const span = W + w * 2;
      cl.off = (cl.off || 0) + wv * 0.016;
      const x = ((((cl.x * span + G.t * cl.v + cl.off) % span) + span) % span) - w;
      ctx.drawImage(cloudSpr, x, hz * cl.y - h / 2, w, h);
    }
  }
  const ballVisible = () => B.state === 'flight' || B.state === 'free' || B.state === 'atGlove' || B.state === 'hang';
  function drawBallShadow() {
    if (!ballVisible()) return;
    const p = proj(B.pos.x, 0, B.pos.z);
    if (p.depth < 1.2) return;
    const h = Math.max(0, B.pos.y - BALL_R);
    const r = BALL_R * p.s * 1.25 * (1 + h * 0.12);
    ctx.fillStyle = `rgba(20,50,20,${(0.34 / (1 + h * 0.35)).toFixed(3)})`;
    ctx.beginPath(); ctx.ellipse(p.x, p.y, Math.max(1.5, r), Math.max(0.8, r * 0.38), 0, 0, TAU); ctx.fill();
  }
  function drawFlyingBall() {
    const p = proj(B.pos.x, B.pos.y, B.pos.z);
    if (p.depth < 0.9) return;
    const r = Math.max(2.6, BALL_R * p.s);
    const bid = B.ballId | 0;
    const fire = Art.BALLS[bid]?.trail;
    for (let i = 0; i < B.trail.length - 1; i++) {
      const q = B.trail[i], a = (i + 1) / B.trail.length;
      ctx.fillStyle = fire ? `rgba(255,${(120 + a * 100) | 0},40,${(a * 0.5).toFixed(3)})` : `rgba(255,255,255,${(a * 0.32).toFixed(3)})`;
      circ(ctx, q.x, q.y, q.r * (0.45 + 0.45 * a)); ctx.fill();
    }
    Art.drawBall(ctx, p.x, p.y, r, B.rot, bid);
  }
  function drawPartner() {
    const mp = proj(M.x, 0, M.z);
    const p = partnerPose(G.t);
    if (M.pose === 'runAway') {
      Art.drawKidBack(ctx, mp.x, mp.y, mp.s, FRIEND, p, { x: mp.x - 0.34 * mp.s, y: mp.y - 0.8 * mp.s, u: 0.34 * mp.s, rot: 0.25, closed: 0, ball: false }, G.t);
      M.glove = null;
    } else {
      M.glove = Art.drawKidFront(ctx, mp.x, mp.y, mp.s, FRIEND, p, G.t, DPR);
    }
    M.head = { x: mp.x + p.offX * mp.s, y: mp.y - (1.62 + p.lift) * mp.s };
    nameTag(mp);
  }
  function nameTag(mp) {
    if (D && G.phase !== 'title') {
      const fs = portrait ? 12 : 13;
      ctx.font = `${fs}px "Jua","Black Han Sans",sans-serif`;
      const name = D.oppName.length > 8 ? D.oppName.slice(0, 8) + '…' : D.oppName;
      const w = ctx.measureText(name).width + 14;
      const x = clamp(mp.x - w / 2, 4, W - w - 4), y = mp.y + 6;
      rr(ctx, x, y, w, fs + 8, 6); ctx.fillStyle = 'rgba(21,48,75,.82)'; ctx.fill();
      ctx.fillStyle = '#fffaf0'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(name, x + w / 2, y + (fs + 8) / 2 + 1);
    }
  }
  function drawPlayer() {
    const feet = proj(P.bodyX, 0, 0);
    const gp = proj(P.gx, P.gy, GLOVE_Z);
    const low = clamp((0.8 - P.gy) / 0.45, 0, 1);
    const throwing = P.throwT >= 0;
    const rot = throwing ? -0.2 : -low * 2.5 + clamp((P.gx - (P.bodyX - 0.36)) * 0.5, -0.4, 0.4);
    const glove = { x: gp.x, y: gp.y, u: 0.4 * gp.s, rot, closed: P.glove, ball: B.state === 'player' && !(P.throwT >= 0 && P.throwT / THROW_DUR > 0.12) };
    Art.drawKidBack(ctx, feet.x, feet.y, feet.s, LOOK, playerPose(), glove, G.t);
    drawSwirl(gp.x, gp.y);
  }
  /** 변화구를 고르면 공 든 손에 소용돌이 */
  function drawSwirl(hx, hy) {
    if (fx.swirl) {
      const s = fx.swirl, k = s.life / s.max;
      ctx.save(); ctx.translate(hx, hy); ctx.rotate((1 - k) * 9);
      ctx.strokeStyle = s.col; ctx.lineWidth = 4; ctx.globalAlpha = k;
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(0, 0, 18 + i * 9 + (1 - k) * 20, i * 2.1, i * 2.1 + 1.6); ctx.stroke(); }
      ctx.restore(); ctx.globalAlpha = 1;
    }
  }
  /** 받을 때 — 타이밍 링 · 글러브 원 */
  function drawCatchGuides() {
    const gp = proj(P.gx, P.gy, GLOVE_Z);
    const R = catchR();
    let inPos = false, rem = 9;
    if (G.phase === 'flying' && (B.state === 'flight' || B.state === 'atGlove') && B.toPlayer) {
      rem = B.arriveAt - G.t;
      const tg = B.target;
      inPos = Math.hypot(tg.x - P.gx, tg.y - P.gy) <= R;
      const showFrom = G.diff === 'easy' ? 99 : G.diff === 'hard' ? 0.6 : (!D && G.score < 6 ? 99 : 0.95);
      if (rem < showFrom && !B.wild) {
        const p = proj(tg.x, tg.y, GLOVE_Z);
        const rb = BALL_R * p.s * 1.3 + 3;
        const k = clamp(rem / 0.9, 0, 1);
        const timing = rem <= EARLY;
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(21,48,75,.55)'; circ(ctx, p.x, p.y, rb + 1.5); ctx.stroke();
        ctx.strokeStyle = '#ffffff'; circ(ctx, p.x, p.y, rb); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(p.x - rb * 0.5, p.y); ctx.lineTo(p.x + rb * 0.5, p.y); ctx.moveTo(p.x, p.y - rb * 0.5); ctx.lineTo(p.x, p.y + rb * 0.5); ctx.stroke();
        const r2 = rb + k * R * p.s * 2.2;
        ctx.globalAlpha = 0.45 + 0.55 * (1 - k);
        ctx.lineWidth = 4; ctx.strokeStyle = timing ? '#7cff6b' : '#ffffff';
        circ(ctx, p.x, p.y, r2); ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
    const good = inPos && rem <= EARLY && rem > -LATE;
    ctx.setLineDash([7, 6]); ctx.lineWidth = good ? 4 : 2.5;
    ctx.strokeStyle = good ? '#7cff6b' : inPos ? 'rgba(124,255,107,.85)' : 'rgba(255,255,255,.6)';
    circ(ctx, gp.x, gp.y, R * gp.s); ctx.stroke(); ctx.setLineDash([]);
    if (good) {
      ctx.fillStyle = 'rgba(124,255,107,.18)'; circ(ctx, gp.x, gp.y, R * gp.s); ctx.fill();
      if (G.diff === 'easy' || (G.diff === 'normal' && (D || G.score < 15))) outlinedText('지금!', gp.x, gp.y - R * gp.s - 14, '#7cff6b', 26);
    }
  }
  /**
   * ★ 던질 때 — 조준경 (양궁·사격 게임처럼)
   * 친구는 11m 밖이라 실제 크기로 그리면 과녁이 손톱만 하다. 친구 가슴을 가운데 두고
   * 과녁(빨강 바탕 · 주황 · 초록)과 흔들리는 조준점을 **크게 확대해서** 그린다.
   * `aimK` = 조준경 배율(px/m) — 손가락으로 조준을 옮길 때도 같은 배율을 쓴다(moveBy).
   */
  let aimK = 200;
  function drawAimGuides() {
    const c = zoneC(), r = zoneR();
    const pc = proj(c.x, c.y, M.z - 0.25);
    /* 가로 화면은 높이가 모자라 조금 작게 — 내 캐릭터 머리와 겹치지 않게 */
    const K = aimK = clamp(Math.min(W, H) * (portrait ? 0.19 : 0.15) / r.o, 80, 700);
    const R = r.o * 1.62 * K;
    const top = SAFE.t + R + (portrait ? 96 : 68);
    const cx = clamp(pc.x, R + 8, W - R - 8);
    const cy = clamp(pc.y, top, Math.max(top, H - R - 12));
    const toS = (x, y) => ({ x: cx + (x - c.x) * K, y: cy - (y - c.y) * K });
    /* 조준경 */
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU);
    ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.fill();
    ctx.clip();
    ctx.fillStyle = 'rgba(255,74,58,.26)'; ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
    ctx.fillStyle = 'rgba(255,159,46,.55)'; ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(cx, cy, r.o * K, r.o * K * 0.8, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(47,191,90,.78)'; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(cx, cy, r.g * K, r.g * K * 0.8, 0, 0, TAU); ctx.fill(); ctx.stroke();
    /* 스트라이크 존 9칸 */
    const gw = r.g * K * 0.66, gh = r.g * K * 0.8 * 0.66;
    ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 1.5;
    ctx.strokeRect(cx - gw, cy - gh, gw * 2, gh * 2);
    ctx.beginPath();
    for (const f of [-1 / 3, 1 / 3]) { ctx.moveTo(cx + gw * 2 * f, cy - gh); ctx.lineTo(cx + gw * 2 * f, cy + gh); ctx.moveTo(cx - gw, cy + gh * 2 * f); ctx.lineTo(cx + gw, cy + gh * 2 * f); }
    ctx.stroke();
    ctx.restore();
    /* 조준경 테두리 · 눈금 */
    ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(21,48,75,.9)';
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,.8)';
    ctx.beginPath(); ctx.arc(cx, cy, R - 4, 0, TAU); ctx.stroke();
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(21,48,75,.9)';
    ctx.beginPath();
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; ctx.moveTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); ctx.lineTo(cx + Math.cos(a) * (R - 14), cy + Math.sin(a) * (R - 14)); }
    ctx.stroke();
    /* 쉬움 — 바람에 밀려 떨어질 자리 (점선) */
    const dr = windDrift(myThrowT());
    const pa = toS(A.x, A.y);
    if (G.diff === 'easy' && WIND.spd > 0.3) {
      const pg = toS(A.x + dr.x, A.y + dr.y);
      ctx.setLineDash([5, 5]); ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pg.x, pg.y); ctx.stroke();
      circ(ctx, pg.x, pg.y, 9); ctx.stroke(); ctx.setLineDash([]);
    }
    /* 흔들리는 조준점 */
    const zone = zoneOf(A.x, A.y);
    const col = zone === 'g' ? '#3dff7a' : zone === 'o' ? '#ffb02e' : '#ff4a3a';
    const rad = clamp(R * 0.12, 11, 18);
    ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(21,48,75,.75)'; circ(ctx, pa.x, pa.y, rad); ctx.stroke();
    ctx.lineWidth = 3.5; ctx.strokeStyle = col; circ(ctx, pa.x, pa.y, rad); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(pa.x - rad * 1.8, pa.y); ctx.lineTo(pa.x - rad * 0.4, pa.y); ctx.moveTo(pa.x + rad * 0.4, pa.y); ctx.lineTo(pa.x + rad * 1.8, pa.y);
    ctx.moveTo(pa.x, pa.y - rad * 1.8); ctx.lineTo(pa.x, pa.y - rad * 0.4); ctx.moveTo(pa.x, pa.y + rad * 0.4); ctx.lineTo(pa.x, pa.y + rad * 1.8);
    ctx.stroke();
    ctx.fillStyle = col; circ(ctx, pa.x, pa.y, 3); ctx.fill();
    const word = zone === 'g' ? '스트라이크 존!' : zone === 'o' ? '볼' : '위험! 실책';
    /* 가로 화면은 위가 좁다 — 글자를 조준경 왼쪽에 둔다 */
    if (portrait) outlinedText(word, cx, cy - R - 16, col, zone === 'g' ? 22 : 18);
    else outlinedText(word, Math.max(72, cx - R - 72), cy - R * 0.45, col, zone === 'g' ? 20 : 17);
    if (D) {
      const left = Math.ceil(HOLD_LIMIT - G.phaseT);
      if (left <= 5) outlinedText(String(Math.max(0, left)), cx, cy + R + 22, '#ffd84a', 26);
    }
    drawWind(cx, cy, R);
  }
  /** 바람 — 풍향계 + 풍속 + 조준경 옆 깃발 */
  function drawWind(cx, cy, R) {
    const rw = 30;
    /* 조준경 오른쪽 → 왼쪽 → 오른쪽 위 순서로, 조준경과 겹치지 않고 화면 안에 들어가는 자리 */
    const fits = (x, y) => x - rw >= 6 && x + rw <= W - 6 && Math.hypot(x - cx, y - cy) >= R + rw + 6;
    let wx = Math.min(cx + R + rw + 14, W - rw - 6), wy = cy - R * 0.45;
    if (!fits(wx, wy)) { wx = Math.max(cx - R - rw - 14, rw + 6); }
    if (!fits(wx, wy)) { wx = W - rw - 12; wy = Math.max(SAFE.t + 150, cy - R - 60); }
    ctx.fillStyle = 'rgba(255,250,240,.94)'; ctx.strokeStyle = '#15304b'; ctx.lineWidth = 3;
    circ(ctx, wx, wy, rw); ctx.fill(); ctx.stroke();
    /* 화면 위쪽 = 친구 쪽(뒷바람) */
    const ang = Math.atan2(-WIND.h, WIND.x);
    const len = 8 + clamp(WIND.spd / 7.5, 0, 1) * 13;
    ctx.save(); ctx.translate(wx, wy); ctx.rotate(ang);
    ctx.strokeStyle = '#2f78c9'; ctx.fillStyle = '#2f78c9'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-len, 0); ctx.lineTo(len - 6, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(len + 4, 0); ctx.lineTo(len - 8, -8); ctx.lineTo(len - 8, 8); ctx.closePath(); ctx.fill();
    ctx.restore();
    outlinedText(`바람 ${WIND.spd.toFixed(1)}m/s`, clamp(wx, 58, W - 58), wy + rw + 15, '#ffffff', 15);
    const side = Math.abs(WIND.x) < 0.4 ? '' : WIND.x > 0 ? '→ 오른쪽으로 밀려요' : '← 왼쪽으로 밀려요';
    if (side) outlinedText(side, clamp(wx, 66, W - 66), wy + rw + 33, '#bfe6ff', 13);
    /* 조준경 왼쪽 아래 깃발 — 바람 부는 쪽으로 펄럭인다 */
    const fx0 = cx - R * 0.86, fyb = cy + R * 0.95, fyt = cy + R * 0.3;
    ctx.strokeStyle = '#e9e4d8'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(fx0, fyb); ctx.lineTo(fx0, fyt); ctx.stroke();
    const fl = (10 + clamp(WIND.spd / 7.5, 0, 1) * 26) * Math.sign(WIND.x || 1);
    const wav = Math.sin(G.t * (4 + WIND.spd)) * 4;
    ctx.fillStyle = '#ff5a4a'; ctx.strokeStyle = '#15304b'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(fx0, fyt); ctx.lineTo(fx0 + fl, fyt + 7 + wav); ctx.lineTo(fx0, fyt + 16); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  function outlinedText(text, x, y, col, size) {
    ctx.font = `${size}px "Black Han Sans","Jua",sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(4, size * 0.2); ctx.strokeStyle = '#15304b'; ctx.strokeText(text, x, y);
    ctx.fillStyle = col; ctx.fillText(text, x, y);
  }
  function drawBubble() {
    if (M.sayT <= 0 || !M.head) return;
    const fs = portrait ? 15 : 17;
    ctx.font = `${fs}px "Jua","Black Han Sans",sans-serif`;
    const w = ctx.measureText(M.say).width + 24, h = fs + 15;
    const tipX = M.head.x, tipY = M.head.y - 4;
    const bx = clamp(tipX - w / 2, 8, W - w - 8), by = tipY - h - 9;
    ctx.globalAlpha = Math.min(1, M.sayT * 5);
    rr(ctx, bx, by, w, h, h / 2);
    ctx.fillStyle = '#fffaf0'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = '#15304b'; ctx.stroke();
    const tx = clamp(tipX, bx + 14, bx + w - 14);
    ctx.beginPath(); ctx.moveTo(tx - 7, by + h - 1.5); ctx.lineTo(tx, by + h + 8); ctx.lineTo(tx + 7, by + h - 1.5); ctx.closePath();
    ctx.fillStyle = '#fffaf0'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(tx - 7, by + h); ctx.lineTo(tx, by + h + 8); ctx.lineTo(tx + 7, by + h); ctx.stroke();
    ctx.fillStyle = '#15304b'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(M.say, bx + w / 2, by + h / 2 + 1);
    ctx.globalAlpha = 1;
  }
  function star(c, x, y, r, rot) {
    c.beginPath();
    for (let i = 0; i < 8; i++) { const rad = i % 2 ? r * 0.42 : r; const a = rot + i * Math.PI / 4; c.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad); }
    c.closePath();
  }
  function drawFx() {
    for (const q of fx.rings) {
      ctx.globalAlpha = Math.max(0, q.life / q.max); ctx.lineWidth = 4; ctx.strokeStyle = q.col;
      circ(ctx, q.x, q.y, q.r); ctx.stroke();
    }
    for (const q of fx.parts) {
      const a = Math.max(0, Math.min(1, q.life / q.max * 1.4));
      ctx.globalAlpha = a; ctx.fillStyle = q.col;
      if (q.kind === 'star') { star(ctx, q.x, q.y, q.r, q.rot); ctx.fill(); }
      else { circ(ctx, q.x, q.y, q.r * (1.4 - a * 0.4)); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
    for (const q of fx.pops) {
      const age = q.max - q.life;
      const sc = age < 0.12 ? 1.5 - age / 0.12 * 0.5 : 1;
      ctx.globalAlpha = Math.min(1, q.life / (q.max * 0.3));
      ctx.font = `${q.size}px "Black Han Sans","Jua",sans-serif`;
      const half = ctx.measureText(q.text).width / 2 * sc + 10;
      ctx.save(); ctx.translate(clamp(q.x, half, Math.max(half, W - half)), q.y); ctx.scale(sc, sc);
      outlinedText(q.text, 0, 0, q.col, q.size);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    for (const q of fx.confetti) {
      ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot); ctx.fillStyle = q.col;
      ctx.fillRect(-q.w / 2, -q.h / 2, q.w, q.h * Math.abs(Math.cos(q.rot * 0.7)) + 1); ctx.restore();
    }
  }
  function drawTitleKid() {
    if (!titleRect) {
      const a = $('stage').getBoundingClientRect(), b = root.getBoundingClientRect();
      titleRect = { left: a.left - b.left, top: a.top - b.top, width: a.width, height: a.height, bottom: a.bottom - b.top };
    }
    const r = titleRect;
    if (r.height < 40) return;
    const S = Math.min(r.height * 0.86 / 1.62, r.width * 0.55 / 0.9);
    const fx0 = r.left + r.width / 2, fy0 = r.bottom - Math.max(6, r.height * 0.04);
    const t = G.t;
    const k = Math.pow((Math.sin(t * 6.5) + 1) / 2, 3);
    const p = Art.basePose();
    p.fL = { x: -0.13, y: 0 }; p.fR = { x: 0.13, y: 0 };
    p.rh = { x: lerp(-0.14, 0.08, k), y: lerp(0.66, 0.72, k) };
    p.gh = { x: 0.2, y: 0.7 };
    p.gloveClosed = 0.18 * k; p.ballHand = true;
    p.face = (t % 5) > 4.2 ? 'grin' : 'smile';
    p.lift = Math.abs(Math.sin(t * 3.25)) * 0.015;
    ctx.fillStyle = 'rgba(255,255,255,.18)';
    ctx.beginPath(); ctx.ellipse(fx0, fy0, 0.75 * S, 0.17 * S, 0, 0, TAU); ctx.fill();
    Art.drawKidFront(ctx, fx0, fy0, S, LOOK, p, t, DPR, { big: true });
  }
  /** 3D 화면에 넘기는 게임 상태 (게임 좌표 그대로) */
  function snap3d() {
    const throwing = P.throwT >= 0;
    const u = throwing ? clamp(P.throwT / THROW_DUR, 0, 1) : -1;
    const meHas = B.state === 'player';
    const meBall = !meHas ? 'none' : throwing ? (u < RELEASE_U ? 'hand' : 'none') : G.phase === 'holding' ? 'hand' : 'glove';
    const palHas = B.state === 'partner';
    let palBall = 'none';
    if (palHas) palBall = M.pose === 'windup' ? (M.poseT / Math.max(0.1, M.windDur) * RELEASE_U >= 0.12 ? 'hand' : 'glove') : M.pose === 'runBack' ? 'hand' : 'glove';
    if (M.pose === 'follow') palBall = 'none';
    let title = null;
    if (G.phase === 'title') {
      if (!titleRect) {
        const a = $('stage').getBoundingClientRect(), b = root.getBoundingClientRect();
        titleRect = { left: a.left - b.left, top: a.top - b.top, width: a.width, height: a.height, bottom: a.bottom - b.top };
      }
      title = titleRect;
    }
    return {
      t: G.t, phase: G.phase, title,
      me: { x: P.bodyX, gx: P.gx, gy: P.gy, close: P.glove, crouch: P.crouch, lift: P.lift, u,
        mode: throwing ? 'throw' : meHas && G.phase === 'holding' ? 'set' : meHas ? 'caught' : 'track',
        runPh: P.runPh, moving: Math.min(1, Math.abs(P.bodyV) * 0.7), ball: meBall, ballId: LOOK.ball | 0 },
      pal: { x: M.x, z: M.z, pose: M.pose, poseT: M.poseT, windDur: M.windDur, judge: M.judge, dir: M.dir,
        cx: M.catchLocal.x, cy: M.catchLocal.y, rem: B.launch + B.dur - G.t, tgtY: B.target.y, runPh: M.runPh,
        oppGy: D ? D.opp.gy : null, ball: palBall, ballId: D ? (FRIEND.ball | 0) : 0 },
      ball: { show: ballVisible(), x: B.pos.x, y: B.pos.y, z: B.pos.z, id: B.ballId | 0, rot: B.rot,
        fly: B.state === 'flight' || B.state === 'free', toMe: B.toPlayer && (B.state === 'flight' || B.state === 'atGlove') },
    };
  }
  /** 3D 가 그리다 실패하면 그 자리에서 2D 로 돌아간다 (게임은 멈추지 않는다) */
  function fail3d(e) {
    console.warn('[3D캐치볼] 3D 그리기 실패 — 2D 로 돈다', e);
    try { W3.destroy(); } catch (err) { /* 무시 */ }
    W3 = null; if (glCv) { glCv.remove(); glCv = null; }
    root.classList.remove('cb-3d');
    layout();
  }
  function render3d() {
    try { W3.frame(snap3d()); } catch (e) { fail3d(e); return; }
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);
    if (G.phase === 'title') return;
    const hp = proj(M.x, 1.82, M.z); M.head = { x: hp.x, y: hp.y };
    try { const gw = W3.palGlovePos(), gp = proj(gw.x, gw.y, gw.z); M.glove = { x: gp.x, y: gp.y }; } catch (e) { M.glove = null; }
    nameTag(proj(M.x, 0, M.z));
    if (G.phase === 'holding') drawAimGuides();
    if (G.phase === 'windup' || G.phase === 'flying' || G.phase === 'reposition' || G.phase === 'oppHold') drawCatchGuides();
    if (G.phase === 'awaitResult' && M.glove) outlinedText('...', M.glove.x, M.glove.y - 26, '#ffffff', 22);
    if (fx.swirl) { const h = W3.handPos(), q = proj(h.x, h.y, h.z); drawSwirl(q.x, q.y); }
    drawFx();
    drawBubble();
  }
  function render() {
    if (W3) { render3d(); return; }
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.drawImage(skyL, 0, 0, W, H);
    drawClouds();
    ctx.drawImage(groundL, 0, 0, W, H);
    if (G.phase === 'title') { drawTitleKid(); return; }
    drawPartner();
    drawBallShadow();
    const front = B.pos.z <= 0.05;
    if (ballVisible() && !front) drawFlyingBall();
    drawPlayer();
    /* 조준경은 내 캐릭터 위에 — 가로 화면에서 머리에 가리지 않게 */
    if (G.phase === 'holding') drawAimGuides();
    if (ballVisible() && front) drawFlyingBall();
    if (G.phase === 'windup' || G.phase === 'flying' || G.phase === 'reposition' || G.phase === 'oppHold') drawCatchGuides();
    if (G.phase === 'awaitResult' && M.glove) outlinedText('...', M.glove.x, M.glove.y - 26, '#ffffff', 22);
    drawFx();
    drawBubble();
  }

  /* ---------- HUD · 안내 ---------- */
  const hud = {
    score(bump) {
      const el = $('score'); el.textContent = G.score;
      $('best').textContent = Math.max(G.best, G.score);
      $('bestDiffHud').textContent = DF().label;
      if (bump) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
    },
    lives(lost) {
      const box = $('lives');
      if (box.children.length !== 3) box.innerHTML = BALL_SVG + BALL_SVG + BALL_SVG;
      [...box.children].forEach((n, i) => {
        const off = i >= G.lives;
        if (lost && off && !n.classList.contains('lost')) { n.classList.add('pop'); later(() => n.classList.remove('pop'), 600); }
        n.classList.toggle('lost', off);
      });
      box.setAttribute('aria-label', `남은 공 ${G.lives}개`);
    },
    errs(bump) {
      const box = $('errs');
      [...box.querySelectorAll('i')].forEach((n, i) => n.classList.toggle('on', i < G.errors));
      if (bump) { box.animate?.([{ transform: 'scale(1.3)' }, { transform: 'scale(1)' }], { duration: 300 }); }
    },
    level() {
      if (D) { $('level').innerHTML = `<b>${DF().label}</b>랠리 ${D.rally}`; return; }
      $('level').innerHTML = `<b>Lv.${G.level}</b>${LEVELS[G.level - 1]}`;
    },
    combo() {
      const el = $('combo');
      el.textContent = G.combo >= 2 ? `${G.combo} 연속 캐치!` : '';
      el.classList.toggle('hot', G.combo >= 10);
    },
    strk() { $('strk').textContent = G.strikes >= 1 ? `연속 스트라이크 ${G.strikes}` : ''; },
    opp() {
      if (!D) return;
      $('oppname').textContent = D.oppName;
      $('oppscore').textContent = `${D.opp.score}개`;
      const box = $('opplives');
      if (box.children.length !== 3) box.innerHTML = BALL_SVG + BALL_SVG + BALL_SVG;
      [...box.children].forEach((n, i) => n.classList.toggle('lost', i >= D.opp.lives));
    },
  };
  let btnState = '';
  function syncButtons() {
    const holdingNow = G.phase === 'holding';
    const catchOn = ['windup', 'flying', 'reposition', 'oppHold'].includes(G.phase) && B.state !== 'player';
    const catchReady = G.phase === 'flying';
    const s = `${catchOn}${catchReady}${holdingNow}`;
    if (s === btnState) return;
    btnState = s;
    const c = $('catchBtn'), t = $('throwBtn');
    c.classList.toggle('off', !catchOn); c.classList.toggle('ready', catchReady);
    c.hidden = holdingNow && !fineMouse;
    t.classList.toggle('off', !holdingNow); t.classList.toggle('ready', holdingNow);
    $('tpanel').hidden = !holdingNow;
    $('swipe').hidden = !holdingNow || fineMouse;
    $('throwLabel').textContent = holdingNow && !fineMouse ? '위로 밀기' : '던지기';
  }
  function syncThrowPanel() {
    root.querySelectorAll('.cb-sp').forEach((b) => b.setAttribute('aria-checked', String((b.dataset.sp | 0) === G.speed)));
    root.querySelectorAll('.cb-pt').forEach((b) => b.setAttribute('aria-checked', String((b.dataset.pt | 0) === G.pitch)));
  }
  function setSpeed(i) {
    G.speed = clamp(i | 0, 0, 2); local.set('speed', G.speed);
    syncThrowPanel();
  }
  function setPitch(i) {
    G.pitch = clamp(i | 0, 0, 3); local.set('pitch', G.pitch);
    syncThrowPanel();
    const btn = root.querySelector(`.cb-pt[data-pt="${G.pitch}"]`);
    if (btn) { btn.classList.remove('spin'); void btn.offsetWidth; btn.classList.add('spin'); }
    sfx('pitchSelect', { kind: ['straight', 'curve', 'slider', 'fork'][G.pitch] });
    if (G.pitch > 0 && isPlaying()) {
      /* 변화구 장착 — 손에 소용돌이 + 글자 */
      fx.swirl = { life: 0.7, max: 0.7, col: PITCHES[G.pitch].color };
      const gp = proj(P.gx, P.gy, GLOVE_Z);
      popText(`${PITCHES[G.pitch].label}!`, gp.x + 30, gp.y - 50, PITCHES[G.pitch].color, 26, 0.8);
      burst(gp.x, gp.y, 10, [PITCHES[G.pitch].color, '#ffffff'], 180, 'star');
    }
  }
  root.querySelectorAll('.cb-sp').forEach((b) => on(b, 'pointerdown', (e) => { e.preventDefault(); ainit(); sfx('select'); setSpeed(b.dataset.sp | 0); }));
  root.querySelectorAll('.cb-pt').forEach((b) => on(b, 'pointerdown', (e) => { e.preventDefault(); ainit(); setPitch(b.dataset.pt | 0); }));
  syncThrowPanel();

  let hintTimer = 0;
  function showHint(text, sec) {
    const el = $('hint');
    el.textContent = text; el.hidden = false;
    el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
    clearTimeout(hintTimer); timers.delete(hintTimer);
    hintTimer = later(() => { el.hidden = true; }, sec * 1000);
  }
  function tutorial(key, text) {
    if (G.tut[key]) return;
    G.tut[key] = true;
    showHint(text, 3.4);
  }
  let bannerTimer = 0;
  function banner(main, sub, long) {
    const el = $('banner');
    $('bmain').textContent = main;
    $('bsub').textContent = sub || ''; $('bsub').hidden = !sub;
    el.classList.toggle('long', !!long);
    el.hidden = false; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
    clearTimeout(bannerTimer); timers.delete(bannerTimer);
    bannerTimer = later(() => { el.hidden = true; el.classList.remove('show'); }, long ? 2850 : 1850);
  }

  /* ---------- 일시정지 (대결은 기권을 묻는다) ---------- */
  function requestPause() {
    if (sheetOpen()) { closeSheets(); return; }
    if (G.phase === 'title') { exit('leave'); return; }
    if (G.phase === 'over') { if (D) exit('leave'); else goTitle(); return; }
    if (G.phase === 'vs') return;
    togglePause();
  }
  function togglePause() {
    if (!isPlaying()) return;
    if (D) {
      const show = $('pauseBox').hidden;
      $('pauseTitle').textContent = '기권하고 나갈까요?';
      $('resume').textContent = '계속하기';
      $('quit').textContent = '기권하기';
      $('pauseBox').hidden = !show;
      if (show) $('resume').focus({ preventScroll: true });
      return;
    }
    G.paused = !G.paused;
    $('pauseBox').hidden = !G.paused;
    if (G.paused) { $('resume').focus({ preventScroll: true }); audio.pause(); }
    else { last = performance.now(); audio.resume(); }
  }
  function exit(kind) {
    try { opts.onExit?.(kind); } catch (e) { /* 무시 */ }
  }

  /* ---------- 꾸미기 · 선물함 · 자세 배우기 ---------- */
  const SHEETS = ['closet', 'gifts', 'lesson'];
  const sheetOpen = () => SHEETS.some((k) => !$(k).hidden);
  let sheetRaf = 0;
  function closeSheets() {
    for (const k of SHEETS) $(k).hidden = true;
    cancelAnimationFrame(sheetRaf); sheetRaf = 0;
    lessonAuto = false;
  }
  function el(tag, cls, text) { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }

  let closetTab = 0, preview = null, closetInfo = '';
  const TABS = ['얼굴', '머리', '유니폼', '글러브', '모자', '야구공', '이모티콘'];
  function openCloset() {
    closeSheets(); sfx('select');
    $('closet').hidden = false;
    preview = null; closetInfo = '';
    renderCloset();
    if (W3) {
      /* 3D캐치볼 — 3D 로 빙글빙글 도는 내 캐릭터 */
      try { closetMini ||= W3.mini($('closetCv'), 'closet'); } catch (e) { closetMini = null; }
      if (closetMini) {
        const loop3 = (now) => {
          if ($('closet').hidden) return;
          try { closetMini.frame({ t: now / 1000, look: preview ? { ...LOOK, ...preview } : LOOK }); } catch (e) { /* 다음 장면에서 */ }
          sheetRaf = requestAnimationFrame(loop3);
        };
        sheetRaf = requestAnimationFrame(loop3);
        return;
      }
    }
    const cv = $('closetCv'), c = cv.getContext('2d');
    const loop = (now) => {
      if ($('closet').hidden) return;
      const w = cv.width, h = cv.height;
      c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, w, h);
      const look = preview ? { ...LOOK, ...preview } : LOOK;
      const t = now / 1000;
      const p = Art.basePose();
      const k = Math.pow((Math.sin(t * 4) + 1) / 2, 3);
      p.fL = { x: -0.13, y: 0 }; p.fR = { x: 0.13, y: 0 };
      p.rh = { x: lerp(-0.14, 0.08, k), y: lerp(0.66, 0.72, k) }; p.gh = { x: 0.2, y: 0.7 };
      p.gloveClosed = 0.18 * k; p.ballHand = true; p.face = 'smile';
      Art.drawKidFront(c, w / 2, h - 18, h * 0.55, look, p, t, 1, { big: true });
      sheetRaf = requestAnimationFrame(loop);
    };
    sheetRaf = requestAnimationFrame(loop);
  }
  function renderCloset() {
    const tabs = $('closetTabs'); tabs.innerHTML = '';
    TABS.forEach((name, i) => {
      const b = el('button', 'cb-tab', name); b.type = 'button'; b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', String(i === closetTab));
      b.onclick = () => { closetTab = i; preview = null; closetInfo = ''; sfx('tab'); renderCloset(); };
      tabs.append(b);
    });
    $('closetEmoji').textContent = Art.EMOJIS[LOOK.emoji] || '😀';
    const panel = $('closetPanel'); panel.innerHTML = '';
    const sec = (title, desc) => { const s = el('div', 'cb-sec'); s.append(el('h3', null, title)); if (desc) s.append(el('p', null, desc)); const o = el('div', 'cb-opts'); s.append(o); panel.append(s); return o; };
    const choose = (patch) => { LOOK = Art.normalizeLook({ ...LOOK, ...patch }); preview = null; sfx('select'); saveLook(); renderCloset(); };
    const opt = (box, { label, color, canvas, checked, locked, gift, cls, onClick, title }) => {
      const b = el('button', 'cb-opt' + (color ? ' sw' : '') + (canvas ? ' big' : '') + (cls ? ' ' + cls : '') + (locked ? ' locked' : '') + (gift ? ' gift' : ''));
      b.type = 'button'; b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', String(!!checked));
      if (title) b.title = title;
      if (color) { b.style.setProperty('--c', color); b.setAttribute('aria-label', label); }
      else { if (canvas) b.append(canvas); b.append(document.createTextNode(label)); }
      b.onclick = onClick; box.append(b); return b;
    };
    const info = () => { const n = el('div', 'cb-info', closetInfo || ' '); panel.prepend(n); };
    switch (TABS[closetTab]) {
      case '얼굴': {
        const a = sec('피부색');
        Art.SKINS.forEach((s, i) => opt(a, { label: s.name, color: s.base, checked: LOOK.skin === i, onClick: () => choose({ skin: i }) }));
        const b = sec('눈');
        Art.EYES.forEach((s, i) => opt(b, { label: s, checked: LOOK.eyes === i, onClick: () => choose({ eyes: i }) }));
        const c2 = sec('볼터치');
        opt(c2, { label: '켜기', checked: LOOK.blush !== 0, onClick: () => choose({ blush: 1 }) });
        opt(c2, { label: '끄기', checked: LOOK.blush === 0, onClick: () => choose({ blush: 0 }) });
        break;
      }
      case '머리': {
        const a = sec('머리 모양');
        Art.HAIR_STYLES.forEach((s, i) => opt(a, { label: s, checked: LOOK.hair === i, onClick: () => choose({ hair: i }) }));
        const b = sec('머리 색');
        Art.HAIR_COLORS.forEach((s, i) => opt(b, { label: s.name, color: s.c, checked: LOOK.hairColor === i, onClick: () => choose({ hairColor: i }) }));
        break;
      }
      case '유니폼': {
        const a = sec('유니폼 색');
        Art.TEAM_KEYS.forEach((k) => opt(a, { label: Art.TEAMS[k].name, color: Art.TEAMS[k].jersey, checked: LOOK.team === k, onClick: () => choose({ team: k }) }));
        const s = el('div', 'cb-sec'); s.append(el('h3', null, '등번호'));
        const row = el('div', 'cb-step-ctl');
        const mk = (t, d) => { const b = el('button', null, t); b.type = 'button'; b.onclick = () => choose({ number: (LOOK.number + d + 100) % 100 }); return b; };
        row.append(mk('-10', -10), mk('-', -1), el('span', 'cb-num', String(LOOK.number)), mk('+', 1), mk('+10', 10));
        s.append(row); panel.append(s);
        const c2 = sec('신발 색');
        Art.SHOES.forEach((sh, i) => opt(c2, { label: sh.name, color: sh.c, checked: LOOK.shoes === i, onClick: () => choose({ shoes: i }) }));
        break;
      }
      case '글러브': {
        const a = sec('글러브 종류', Art.GLOVE_TYPES[LOOK.glove.type].desc);
        Art.GLOVE_TYPES.forEach((g, i) => opt(a, { label: g.name, canvas: Art.gloveIcon({ ...LOOK.glove, type: i }, 40), checked: LOOK.glove.type === i, onClick: () => choose({ glove: { ...LOOK.glove, type: i } }) }));
        const b = sec('글러브 색');
        Art.GLOVE_COLORS.forEach((g, i) => opt(b, { label: g.name, color: g.base, checked: LOOK.glove.color === i, onClick: () => choose({ glove: { ...LOOK.glove, color: i } }) }));
        const c2 = sec('글러브 크기');
        Art.GLOVE_SIZES.forEach((g, i) => opt(c2, { label: g.name, checked: LOOK.glove.size === i, onClick: () => choose({ glove: { ...LOOK.glove, size: i } }) }));
        break;
      }
      case '모자': {
        const a = sec('내 모자 바꾸기', `최고 레벨 Lv.${PR.bestLevel} — 레벨을 올리면 더 화려한 모자가 열려요`);
        Art.HATS.forEach((h, i) => {
          const owned = PR.hats.has(i), open = hatOpen(i);
          opt(a, { label: `Lv.${h.level}\n${h.name}`, canvas: Art.hatIcon(i, LOOK, 42), checked: LOOK.hat === i, locked: !open, gift: open && !owned,
            onClick: () => {
              if (owned) { choose({ hat: i }); return; }
              preview = { hat: i };
              closetInfo = open ? `🎁 「${h.name}」는 선물함에 있어요. 선물함에서 받으면 쓸 수 있어요` : `🔒 최고 레벨 Lv.${h.level}에 도달하면 「${h.name}」를 획득합니다 (지금은 구경만 할 수 있어요)`;
              sfx('tab'); renderCloset();
            } });
        });
        info();
        break;
      }
      case '야구공': {
        const a = sec('내 야구공 바꾸기', `최대 연속 스트라이크 ${PR.bestStrikes}개 — 스트라이크를 연속으로 던지면 새 공이 열려요`);
        Art.BALLS.forEach((bl, i) => {
          const owned = PR.balls.has(i), open = ballOpen(i);
          opt(a, { label: i === 0 ? bl.name : `연속 ${bl.need}\n${bl.name}`, canvas: Art.ballIcon(i, 36), checked: LOOK.ball === i, locked: !open, gift: open && !owned,
            onClick: () => {
              if (owned) { choose({ ball: i }); return; }
              preview = { ball: i };
              closetInfo = open ? `🎁 「${bl.name}」은 선물함에 있어요. 선물함에서 받으면 쓸 수 있어요` : `🔒 스트라이크를 ${bl.need}개 연속으로 던지면 「${bl.name}」을 획득합니다 (지금은 구경만 할 수 있어요)`;
              sfx('tab'); renderCloset();
            } });
        });
        info();
        break;
      }
      case '이모티콘': {
        const a = sec('명예의 전당에 내 이름과 같이 떠요');
        Art.EMOJIS.forEach((e, i) => opt(a, { label: e, cls: 'emo', checked: LOOK.emoji === i, onClick: () => choose({ emoji: i }) }));
        break;
      }
    }
  }
  function saveLook() {
    if (!D) FRIEND = Art.friendLook(LOOK);
    if (W3) W3.setLooks(LOOK, FRIEND);
    try { opts.onLook?.(LOOK, Art.encodeLook(LOOK)); } catch (e) { /* 무시 */ }
  }

  function openGifts() {
    closeSheets(); sfx('select');
    $('gifts').hidden = false;
    renderGifts();
  }
  function renderGifts() {
    const panel = $('giftPanel'); panel.innerHTML = '';
    const list = giftList();
    if (!list.length) {
      const e = el('div', 'cb-empty');
      e.textContent = '선물함이 비어 있어요\n최고 레벨을 올리면 모자, 스트라이크를 연속으로 던지면 야구공이 와요';
      e.style.whiteSpace = 'pre-line';
      panel.append(e);
      return;
    }
    if (list.length >= 2) {
      const all = el('button', 'cb-big', `모두 받기 (${list.length})`); all.type = 'button';
      all.onclick = () => { for (const g of list) claim(g, false); sfx('unlock'); confettiBurst(); renderGifts(); refreshGiftBadge(); };
      panel.append(all);
    }
    for (const g of list) {
      const row = el('div', 'cb-gift');
      const item = g.kind === 'hat' ? Art.HATS[g.i] : Art.BALLS[g.i];
      row.append(g.kind === 'hat' ? Art.hatIcon(g.i, LOOK, 48) : Art.ballIcon(g.i, 44));
      const txt = el('div');
      txt.append(el('b', null, item.name));
      txt.append(el('small', null, g.kind === 'hat' ? `최고 레벨 Lv.${item.level} 달성 선물` : `연속 스트라이크 ${item.need}개 달성 선물`));
      row.append(txt);
      const b = el('button', null, '받기'); b.type = 'button';
      b.onclick = () => { claim(g, true); sfx('unlock'); renderGifts(); refreshGiftBadge(); };
      row.append(b);
      panel.append(row);
    }
  }
  /** 선물 받기 — 받으면 곧바로 써 본다 (꾸미기에서 언제든 바꿀 수 있다) */
  function claim(g, equip) {
    if (g.kind === 'hat') { PR.hats.add(g.i); if (equip || Art.HATS[g.i].level >= (Art.HATS[LOOK.hat]?.level || 0)) LOOK.hat = g.i; }
    else { PR.balls.add(g.i); if (equip || Art.BALLS[g.i].need >= (Art.BALLS[LOOK.ball]?.need || 0)) LOOK.ball = g.i; }
    try { opts.onClaim?.({ hats: [...PR.hats], balls: [...PR.balls] }); } catch (e) { /* 무시 */ }
    saveLook();
    if (equip) showHint(`「${(g.kind === 'hat' ? Art.HATS : Art.BALLS)[g.i].name}」${g.kind === 'hat' ? '를' : '을'} 받아서 바로 썼어요!`, 2);
  }
  function refreshGiftBadge() {
    const n = giftList().length;
    $('giftCount').textContent = n; $('giftCount').hidden = n === 0;
  }

  let lessonStep = 0, lessonAuto = false, lessonT0 = 0;
  function openLesson() {
    closeSheets(); sfx('select');
    $('lesson').hidden = false;
    lessonStep = 0; lessonAuto = true; lessonT0 = performance.now();
    renderLessonText();
    if (W3) {
      try { lessonMini ||= W3.mini($('lessonCv'), 'lesson'); } catch (e) { lessonMini = null; }
      if (lessonMini) {
        const loop3 = (now) => {
          if ($('lesson').hidden) return;
          try { lessonMini.frame({ t: now / 1000, look: LOOK, u: lessonU(now) }); } catch (e) { /* 다음 장면에서 */ }
          sheetRaf = requestAnimationFrame(loop3);
        };
        sheetRaf = requestAnimationFrame(loop3);
        return;
      }
    }
    const cv = $('lessonCv'), c = cv.getContext('2d');
    const loop = (now) => {
      if ($('lesson').hidden) return;
      const r = cv.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (cv.width !== Math.round(r.width * dpr)) { cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); }
      c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, r.width, r.height);
      const u = lessonU(now);
      const p = Art.basePose();
      frontFromKeys(p, throwPose(u));
      p.ballHand = u >= 0.12 && u < RELEASE_U; p.ballGlove = u < 0.12; p.face = 'focus';
      const S = Math.min(r.height * 0.78 / 1.6, r.width * 0.5 / 0.9);
      const fy0 = r.height - 14;
      /* 던지는 쪽을 가리키는 화살표 · 목표 */
      c.fillStyle = 'rgba(255,255,255,.85)'; c.strokeStyle = '#15304b'; c.lineWidth = 3;
      Art.circ(c, r.width - 34, r.height * 0.36, 16); c.fill(); c.stroke();
      c.fillStyle = '#e23b2e'; Art.circ(c, r.width - 34, r.height * 0.36, 6); c.fill();
      Art.drawKidFront(c, r.width * 0.42, fy0, S, LOOK, p, now / 1000, dpr, { big: true });
      if (u >= RELEASE_U && u < 0.9) {
        const bx = lerp(r.width * 0.42, r.width - 34, (u - RELEASE_U) / 0.24);
        Art.drawBall(c, bx, lerp(fy0 - S * 1.35, r.height * 0.36, (u - RELEASE_U) / 0.24), 9, now / 80, LOOK.ball | 0);
      }
      sheetRaf = requestAnimationFrame(loop);
    };
    sheetRaf = requestAnimationFrame(loop);
  }
  /** 자세 배우기의 지금 동작 위치 (자동 재생이면 천천히 한 바퀴, 아니면 그 단계 근처를 오간다) */
  function lessonU(now) {
    if (lessonAuto) {
      const cyc = ((now - lessonT0) / 1000) % 7;
      const u = cyc < 6 ? cyc / 6 : 1;
      const s = THROW_STEPS.reduce((acc, x, i) => (u >= x.u ? i : acc), 0);
      if (s !== lessonStep) { lessonStep = s; renderLessonText(); }
      return u;
    }
    const a = THROW_STEPS[lessonStep].u, b = (THROW_STEPS[lessonStep + 1] || { u: 1 }).u;
    return a + (b - a) * (0.5 + 0.5 * Math.sin(now / 400)) * 0.6;
  }
  function renderLessonText() {
    const s = THROW_STEPS[lessonStep];
    $('lessonStep').textContent = s.t;
    $('lessonTip').textContent = s.tip;
    $('lessonDots').innerHTML = THROW_STEPS.map((_, i) => `<i class="${i === lessonStep ? 'on' : ''}"></i>`).join('');
    $('lessonPlay').textContent = lessonAuto ? '멈추기' : '자동 재생';
  }

  /* ---------- 타이틀 ---------- */
  function refreshTitle() {
    $('bestDiff').textContent = DF().label; $('bestTitle').textContent = G.best;
    $('comboTitle').textContent = COMBOS[G.diff] | 0;
    $('lvTitle').textContent = PR.bestLevel; $('strTitle').textContent = PR.bestStrikes;
    root.querySelectorAll('.cb-dbtn').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.diff === G.diff)));
    refreshGiftBadge();
  }
  function setDiff(d) {
    if (!DIFFS[d] || D) return;
    G.diff = d; applyDiff(); refreshTitle();
    try { opts.onDifficulty?.(d); } catch (e) { /* 무시 */ }
  }
  root.querySelectorAll('.cb-dbtn').forEach((b) => on(b, 'click', () => { ainit(); sfx('select'); setDiff(b.dataset.diff); }));
  on($('start'), 'click', (e) => { e.currentTarget.blur(); startGame(); });
  on($('exitTitle'), 'click', () => exit('leave'));
  on($('openCloset'), 'click', () => { ainit(); openCloset(); });
  on($('openGifts'), 'click', () => { ainit(); openGifts(); });
  on($('openLesson'), 'click', () => { ainit(); openLesson(); });
  if (opts.onRanking) on($('openRank'), 'click', () => { ainit(); sfx('select'); try { opts.onRanking(); } catch (e) { /* 무시 */ } });
  else $('openRank').hidden = true;
  on($('closetDone'), 'click', () => { sfx('select'); closeSheets(); refreshTitle(); });
  on($('giftsDone'), 'click', () => { sfx('select'); closeSheets(); refreshTitle(); });
  on($('lessonDone'), 'click', () => { sfx('select'); closeSheets(); });
  on($('lessonPrev'), 'click', () => { lessonAuto = false; lessonStep = (lessonStep + THROW_STEPS.length - 1) % THROW_STEPS.length; sfx('tab'); renderLessonText(); });
  on($('lessonNext'), 'click', () => { lessonAuto = false; lessonStep = (lessonStep + 1) % THROW_STEPS.length; sfx('tab'); renderLessonText(); });
  on($('lessonPlay'), 'click', () => { lessonAuto = !lessonAuto; lessonT0 = performance.now() - THROW_STEPS[lessonStep].u * 6000; sfx('tab'); renderLessonText(); });
  if (opts.onDuel) {
    $('duelBtn').hidden = false;
    on($('duelBtn'), 'click', () => { ainit(); sfx('select'); try { opts.onDuel(); } catch (e) { /* 무시 */ } });
  }
  if (opts.duelRecord) {
    $('duelRec').hidden = false;
    $('duelWins').textContent = opts.duelRecord.wins | 0;
    $('duelLosses').textContent = opts.duelRecord.losses | 0;
  }
  on($('retry'), 'click', (e) => { e.currentTarget.blur(); if (D) { exit('rematch'); return; } startGame(); });
  on($('home'), 'click', () => { sfx('select'); if (D) { exit('leave'); return; } goTitle(); });
  on($('pause'), 'click', (e) => { e.currentTarget.blur(); ainit(); requestPause(); });
  on($('resume'), 'click', (e) => { e.currentTarget.blur(); if (D) { $('pauseBox').hidden = true; return; } togglePause(); });
  on($('quit'), 'click', () => {
    if (D) {
      $('pauseBox').hidden = true;
      if (!D.ended) { DUEL.send({ lives: 0, alive: false, done: true }); D.ended = true; D.win = false; D.reason = 'quit'; }
      exit('forfeit');
      return;
    }
    G.paused = false; audio.resume(); goTitle();
  });
  function syncSoundIcons() {
    for (const k of ['mute', 'tMute']) {
      const b = $(k); b.querySelector('[data-on]').style.display = audio.muted ? 'none' : ''; b.querySelector('[data-off]').style.display = audio.muted ? '' : 'none';
      b.setAttribute('aria-label', audio.muted ? '효과음 켜기' : '효과음 끄기');
    }
    for (const k of ['bgm', 'tBgm']) {
      const b = $(k); b.querySelector('[data-on]').style.display = audio.bgmOn ? '' : 'none'; b.querySelector('[data-off]').style.display = audio.bgmOn ? 'none' : '';
      b.setAttribute('aria-label', audio.bgmOn ? '배경음악 끄기' : '배경음악 켜기');
    }
  }
  const toggleMute = (e) => { e.currentTarget.blur(); ainit(); audio.setMuted(!audio.muted); syncSoundIcons(); if (!audio.muted) sfx('select'); };
  const toggleBgm = (e) => { e.currentTarget.blur(); ainit(); audio.setBgm(!audio.bgmOn); syncSoundIcons(); };
  on($('mute'), 'click', toggleMute); on($('tMute'), 'click', toggleMute);
  on($('bgm'), 'click', toggleBgm); on($('tBgm'), 'click', toggleBgm);
  /* 첫 터치에서 소리를 깨운다 (브라우저 자동재생 규칙) */
  on(root, 'pointerdown', () => ainit(), { capture: true });
  if (fineMouse) $('howto').innerHTML = '마우스로 글러브 이동 · 공이 오면 <b>클릭/스페이스</b>로 잡기 · 조준이 초록일 때 <b>클릭</b>으로 던지기';
  on(window, 'resize', layout);
  on(window, 'orientationchange', () => later(layout, 200));
  on(document, 'visibilitychange', () => {
    if (document.hidden) { if (!D && isPlaying() && !G.paused) togglePause(); else audio.pause(); }
    else if (!G.paused) audio.resume();
  });

  /* ---------- 루프 ---------- */
  let last = performance.now(), raf = 0;
  function frame(now) {
    if (dead) return;
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    if (G.phase === 'title') { G.t += dt; M.poseT += dt; }
    else if (!G.paused) update(dt);
    render();
    if (G.phase !== 'title') syncButtons();
    raf = requestAnimationFrame(frame);
  }

  G.guideLeft = local.get('guideLeft', 3) | 0;
  buildCloud();
  if (W3) W3.setLooks(LOOK, FRIEND);
  layout();
  syncSoundIcons();
  hud.lives(); hud.level();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (!dead) layout(); });

  if (D) {
    D.startAt = performance.now() + Math.max(0, DUEL.startInMs | 0);
    $('title').hidden = true;
    $('vs').hidden = false;
    $('vsMe').textContent = D.myName;
    $('vsOpp').textContent = D.oppName;
    $('vsRule').textContent = `난이도 ${DF().label} · 공 3개씩 · 놓치면 하나, 빨강에서 던지면(실책) 하나 잃어요`;
    $('opp').hidden = false;
    $('bestline').hidden = true;
    hud.opp();
    Object.assign(M, { x: 0, z: PARTNER_Z, tx: 0 });
    setPose('idle');
    B.state = D.iStart ? 'player' : 'partner';
    setPhase('vs');
    hud.score(false);
    audio.bgm('duel');
  } else {
    goTitle();
  }
  raf = requestAnimationFrame((t) => { last = t; frame(t); });

  return {
    requestPause,
    remote,
    oppLook(look) { if (D && look) { FRIEND = asLook(look); if (W3) W3.setLooks(null, FRIEND); } },
    dbg: { G, P, B, M, A, D, WIND, tryCatch, doThrow, catchR, zoneOf, zoneR, setSpeed, setPitch, PR },
    destroy() {
      dead = true;
      cancelAnimationFrame(raf); cancelAnimationFrame(sheetRaf);
      for (const off of offs) off();
      for (const id of timers) clearTimeout(id);
      timers.clear();
      try { audio.close(); } catch (e) { /* 무시 */ }
      for (const x of [closetMini, lessonMini, W3]) { try { x?.destroy(); } catch (e) { /* 무시 */ } }
      root.remove();
    },
  };
}
