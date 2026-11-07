/**
 * 줄넘기 챔피언 — 계산만 하는 엔진. (2026-11-07, 이안오락실 5번째 게임)
 *
 * 화면·소리·저장을 모른다 — node 에서 그대로 시험한다(`tools/_jumprope-sim.mjs`).
 * 기획·스펙: `docs/JUMPROPE_PLAN.md`
 *
 * ## 줄과 시간
 * 줄 각도 θ 는 «발밑 = π», «머리 위 = 2π»로 잰다. 한 바퀴 = π → 3π.
 *   발밑(π) → 등 뒤 → 머리 위(2π) → 앞 → 발밑(3π) — sin θ < 0 이면 아이 뒤, > 0 이면 앞.
 * 줄이 발밑을 지나는 순간 = **넘는 순간(beat)**. 스테이지는 넘는 순간들의 표(박자표)다.
 * 시간은 «줄 시계» 기준이다 — 넘어져서 쉬는 동안은 게임이 줄 시계를 멈춘다.
 *
 * ## 판정 (스펙 3-1)
 * 점프하면 공중에 AIR 초(꾹 누르면 AIR_HIGH 초). 뛴 뒤 m 초부터 내려오기 m 초 전까지 발이 줄보다 높다.
 * 넘는 순간이 그 구간 안이면 통과, 아니면 걸려 넘어진다. 통과하면 «가장 높이 뜬 순간»과의 차이로 등급.
 */

/* ---------- 상수 ---------- */
export const AIR = 0.46;          // 보통 점프 체공(초)
export const AIR_HIGH = 0.78;     // 높이 점프 체공(초) — 2단 뛰기용
export const HOLD_HIGH = 0.14;    // 이만큼 누르고 있으면 높이 점프로 바뀐다
export const DOUBLE_GAP = 0.34;   // 2단 뛰기 — 두 번째 줄이 오는 간격(초)
export const FAKE_HOLD = 0.38;    // 멈칫 — 줄이 머리 위에서 멈추는 시간(초)
/** 판정 넉넉함 → 뛴 직후·내려오기 직전에 «아직/이미 낮다»고 보는 여유(초). 클수록 통과 폭이 좁다 */
export const JUDGE = { e: 0.05, n: 0.08, h: 0.11 };
export const JUDGE_LABEL = { e: '넉넉', n: '보통', h: '빡빡' };
export const GRADE = { perfect: 0.045, great: 0.09 };
export const POINTS = { perfect: 100, great: 70, good: 40 };
export const XP = { perfect: 3, great: 2, good: 1 };
export const SPEED_MIN = 1, SPEED_MAX = 10;
export const MAX_LEVEL = 20;

/** 조각 종류 — 코드(k) · 이름 · 박자가 바뀔 때 미리 띄우는 글자 */
/* 2026-11-07 리듬판(ROPE BEAT)에서는 내 스테이지 조각이 «기술 · 템포 구간»이 된다 — n = 박 수, 빠르기 v → BPM 90+(v−1)×10 */
export const SEG_KINDS = {
  s: { name: '기본 뛰기', cue: '같은 박자로!' },
  r: { name: '기술 섞기', cue: '박자가 흔들려요!' },
  u: { name: '빨라지기·느려지기', cue: null },     // a<b 면 «빨라져요!», 아니면 «느려져요!»
  f: { name: '쉼(멈칫)', cue: '멈칫! 기다렸다 뛰어요' },
  d: { name: '이단 뛰기', cue: '2단 뛰기! 꾹 눌러요' },
};
export const segBpm = (v) => 90 + (Math.max(SPEED_MIN, Math.min(SPEED_MAX, +v || 1)) - 1) * 10;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const int = (v, d) => (Number.isFinite(+v) ? Math.round(+v) : d);

/** 빠르기(1~10) → 한 바퀴 시간(초). 1 = 1.00초 … 10 = 0.55초 */
export const rotT = (v) => 1.0 - (clamp(+v || 1, SPEED_MIN, SPEED_MAX) - 1) * 0.05;

/** 같은 씨앗이면 같은 랜덤(시험·코드 공유용) */
export function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- 박자표 ---------- */

/** 조각 하나가 만드는 넘기 수 (2단 뛰기는 한 번에 두 번) */
export const segCount = (seg) => (seg.k === 'd' ? seg.n * 2 : seg.n);
export const stageCount = (stage) => (stage.segs || []).reduce((n, s) => n + segCount(s), 0);

/** 조각의 예고 글자 */
export function segCue(seg) {
  if (seg.k === 'u') return seg.b > seg.a ? '빨라져요!' : seg.b < seg.a ? '느려져요!' : '같은 박자로!';
  return SEG_KINDS[seg.k]?.cue ?? null;
}

/**
 * 조각 하나를 박자로 편다. 박자 하나 = 한 바퀴:
 *   { s: 시작(앞 박자의 넘는 순간) · t: 넘는 순간 · d: 도는 시간 · hold: 머리 위에서 멈추는 시간
 *     kind: 'n' 보통 · 'f' 멈칫 · 'd1' 2단 첫째 · 'd2' 2단 둘째 · apex: 가장 높이 떠 있어야 할 순간
 *     seg: 몇 번째 조각 · cue: 이 박자 직전 바퀴에 띄울 예고(조각의 첫 박자만) }
 */
export function expandSeg(seg, start, rand, segIdx = 0, withCue = true) {
  const out = [];
  let s = start;
  const push = (b) => { out.push(b); s = b.t; };
  const n = Math.max(1, seg.n | 0);
  for (let i = 0; i < n; i++) {
    let v = seg.v;
    if (seg.k === 'r') v = seg.a + rand() * (seg.b - seg.a);
    if (seg.k === 'u') v = n === 1 ? seg.b : seg.a + ((seg.b - seg.a) * i) / (n - 1);
    const d = rotT(v);
    if (seg.k === 'f') { push({ s, t: s + d + FAKE_HOLD, d, hold: FAKE_HOLD, kind: 'f', seg: segIdx }); continue; }
    if (seg.k === 'd') {
      const t1 = s + d, t2 = t1 + DOUBLE_GAP, apex = (t1 + t2) / 2;
      push({ s, t: t1, d, hold: 0, kind: 'd1', apex, seg: segIdx });
      push({ s, t: t2, d: DOUBLE_GAP, hold: 0, kind: 'd2', apex, seg: segIdx });
      continue;
    }
    push({ s, t: s + d, d, hold: 0, kind: 'n', seg: segIdx });
  }
  for (const b of out) if (b.apex == null) b.apex = b.t;
  if (withCue && out.length) out[0].cue = segCue(seg);
  return out;
}

/** 스테이지 전체 박자표. 첫 조각에는 예고를 안 띄운다(시작 카운트다운이 대신한다) */
export function buildBeats(stage, seed = 1) {
  const rand = seeded(seed);
  const beats = [];
  let t = 0;
  (stage.segs || []).forEach((seg, i) => {
    const part = expandSeg(seg, t, rand, i, i > 0);
    beats.push(...part);
    if (part.length) t = part[part.length - 1].t;
  });
  return beats;
}

/**
 * 줄 각도 — 줄 시계 rt 에서. 박자표 beats 와 «지금 돌고 있는 박자 번호» k 를 받는다.
 * 박자 k 의 [s, t] 구간이면 그 바퀴, 박자가 다 끝났으면 발밑(π)에 멈춘다.
 */
export function ropeAngle(beats, k, rt) {
  const b = beats[k];
  if (!b) return Math.PI;
  const tt = rt - b.s;
  if (tt <= 0) return Math.PI;
  if (tt >= b.t - b.s) return 3 * Math.PI;
  if (!b.hold) return Math.PI + (2 * Math.PI * tt) / b.d;
  const half = b.d / 2;
  if (tt < half) return Math.PI + (Math.PI * tt) / half;           // 등 뒤로 올라가 머리 위까지
  if (tt < half + b.hold) return 2 * Math.PI;                        // 머리 위에서 멈칫
  return 2 * Math.PI + (Math.PI * (tt - half - b.hold)) / half;     // 앞으로 내려와 발밑
}

/* ---------- 판정 ---------- */

/**
 * 넘는 순간 tc 에 이 점프가 통과하나.
 * @param {number} tc 넘는 순간(줄 시계)
 * @param {{t:number, air:number}|null} jump 가장 최근 점프(뛴 순간 · 체공)
 * @param {number} margin JUDGE[...]
 * @param {number} apexT 가장 높이 떠 있어야 할 순간(보통 = tc, 2단 = 두 줄의 가운데)
 * @returns {{ok:boolean, why?:'late'|'early', grade?:'perfect'|'great'|'good', off?:number}}
 */
export function judgeCrossing(tc, jump, margin, apexT = tc) {
  if (!jump) return { ok: false, why: 'late' };
  const rel = tc - jump.t;
  if (rel < margin) return { ok: false, why: 'late' };               // 아직 덜 떴다(늦게 눌렀다)
  if (rel > jump.air - margin) return { ok: false, why: 'early' };   // 이미 내려왔다(일찍 눌렀다)
  const off = apexT - (jump.t + jump.air / 2);                       // + = 일찍 눌렀다
  const a = Math.abs(off);
  return { ok: true, grade: a <= GRADE.perfect ? 'perfect' : a <= GRADE.great ? 'great' : 'good', off };
}

/** 이 박자에 딱 맞는 누르는 순간(자동 플레이·시험용) */
export function idealPress(beat) {
  const air = beat.kind === 'd1' || beat.kind === 'd2' ? AIR_HIGH : AIR;
  return beat.apex - air / 2;
}

/* ---------- 점수 · 별 · 경험치 · 레벨 ---------- */

/** 콤보 10마다 +10%, 최대 ×2 */
export const comboMult = (combo) => 1 + Math.min(1, Math.floor(combo / 10) * 0.1);
export const scoreFor = (grade, combo) => Math.round((POINTS[grade] || 0) * comboMult(combo));

/** ★ 클리어 · ★★ 하트 1개 이하로 잃음 · ★★★ 안 잃고 PERFECT 절반 이상 */
export function starsFor({ cleared, heartsLost, perfect, total }) {
  if (!cleared) return 0;
  if (heartsLost === 0 && total > 0 && perfect / total >= 0.5) return 3;
  if (heartsLost <= 1) return 2;
  return 1;
}

/** 경험치: 판정마다 + 클리어 보너스(20 + 스테이지 번호×10) + 처음 깨면 30 */
export function xpFor({ perfect = 0, great = 0, good = 0, cleared = false, stageNo = 0, firstClear = false }) {
  let xp = perfect * XP.perfect + great * XP.great + good * XP.good;
  if (cleared) xp += 20 + stageNo * 10 + (firstClear ? 30 : 0);
  return xp;
}

/** 레벨 n 이 되는 데 필요한 누적 경험치 — Lv2 60 · Lv3 150 · Lv4 270 … (한 칸마다 30씩 더) */
export function xpToReach(n) {
  if (n <= 1) return 0;
  const k = n - 1;
  return 60 * k + 15 * k * (k - 1);
}
export function levelFromXp(xp) {
  let lv = 1;
  while (lv < MAX_LEVEL && xp >= xpToReach(lv + 1)) lv++;
  const cur = xpToReach(lv), next = lv >= MAX_LEVEL ? cur : xpToReach(lv + 1);
  return { level: lv, cur, next, into: xp - cur, need: next - cur };
}

/* ---------- 무한 줄넘기 ---------- */

/**
 * 무한 줄넘기 — 넘은 수(count)가 늘수록 조각이 어려워진다. 하나씩 이어 붙인다.
 * 처음 10번은 같은 박자(몸풀기), 그 뒤로 랜덤 폭과 빠르기가 커지고 멈칫(30~) · 2단(50~)이 섞인다.
 */
export function endlessSeg(count, rand) {
  if (count < 10) return { k: 's', n: 10, v: 2 };
  const lv = Math.min(12, Math.floor((count - 10) / 15));
  const base = 2 + lv * 0.55;
  const roll = rand();
  if (count >= 50 && roll < 0.16) return { k: 'd', n: 1 + Math.floor(rand() * 2), v: clamp(base, 1, 8) };
  if (count >= 30 && roll < 0.34) return { k: 'f', n: 1 + Math.floor(rand() * 3), v: clamp(base, 1, 9) };
  if (roll < 0.55) return { k: 'u', n: 6, a: clamp(base - 1, 1, 10), b: clamp(base + 1.5, 1, 10) };
  return { k: 'r', n: 6 + Math.floor(rand() * 5), a: clamp(base - 1.5, 1, 10), b: clamp(base + 1, 1, 10) };
}

/* ---------- 스테이지 코드 (친구에게 보내는 한 줄) ---------- */

export const CODE_PREFIX = 'JR1-';
export const LIMITS = { name: 12, segs: 30, n: 60, total: 300, hearts: [1, 5], themes: 10 };

/** 받은 값을 검사해 안전한 스테이지로 고친다. 고칠 수 없으면 null */
export function sanitizeStage(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const segsIn = Array.isArray(raw.segs) ? raw.segs : [];
  const segs = [];
  let total = 0;
  for (const s of segsIn.slice(0, LIMITS.segs)) {
    if (!s || !SEG_KINDS[s.k]) continue;
    const seg = { k: s.k, n: clamp(int(s.n, 1), 1, LIMITS.n) };
    if (s.k === 'r' || s.k === 'u') {
      seg.a = clamp(int(s.a, 3), SPEED_MIN, SPEED_MAX);
      seg.b = clamp(int(s.b, 5), SPEED_MIN, SPEED_MAX);
      if (s.k === 'r' && seg.a > seg.b) [seg.a, seg.b] = [seg.b, seg.a];
    } else seg.v = clamp(int(s.v, 3), SPEED_MIN, SPEED_MAX);
    const c = segCount(seg);
    if (total + c > LIMITS.total) {
      const left = LIMITS.total - total;
      const n = seg.k === 'd' ? Math.floor(left / 2) : left;
      if (n < 1) break;
      seg.n = n;
    }
    segs.push(seg);
    total += segCount(seg);
  }
  if (!segs.length) return null;
  const name = String(raw.name ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, LIMITS.name) || '내 스테이지';
  return {
    name,
    theme: clamp(int(raw.theme, 0), 0, LIMITS.themes - 1),
    hearts: clamp(int(raw.hearts, 3), LIMITS.hearts[0], LIMITS.hearts[1]),
    judge: JUDGE[raw.judge] != null ? raw.judge : 'n',
    ring: raw.ring !== false,
    segs,
  };
}

const toB64url = (str) => {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const fromB64url = (s) => {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
};

/** 스테이지 → `JR1-…` 한 줄 (조각은 [종류, 횟수, 값…] 배열로 줄인다) */
export function encodeStage(stage) {
  const st = sanitizeStage(stage);
  if (!st) return '';
  const c = {
    n: st.name, t: st.theme, h: st.hearts, j: st.judge, r: st.ring ? 1 : 0,
    s: st.segs.map((g) => (g.k === 'r' || g.k === 'u' ? [g.k, g.n, g.a, g.b] : [g.k, g.n, g.v])),
  };
  return CODE_PREFIX + toB64url(JSON.stringify(c));
}

/** `JR1-…` → 스테이지(검사 통과한 것만) 또는 null. 앞뒤 공백·줄바꿈·안내 글은 무시한다 */
export function decodeStage(code) {
  const m = String(code || '').match(/JR1-([A-Za-z0-9_-]{4,})/);
  if (!m) return null;
  try {
    const c = JSON.parse(fromB64url(m[1]));
    return sanitizeStage({
      name: c.n, theme: c.t, hearts: c.h, judge: c.j, ring: c.r !== 0,
      segs: (Array.isArray(c.s) ? c.s : []).map((a) => (Array.isArray(a)
        ? (a[0] === 'r' || a[0] === 'u' ? { k: a[0], n: a[1], a: a[2], b: a[3] } : { k: a[0], n: a[1], v: a[2] })
        : null)),
    });
  } catch { return null; }
}
