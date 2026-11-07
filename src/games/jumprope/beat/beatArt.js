/**
 * 줄넘기 챔피언 · ROPE BEAT — 리듬 화면 그림. **픽셀아트(도트) 전용.** (2026-11-07, 픽셀 아티스트)
 *
 * 규칙(art.js 와 같다): 저해상도 버퍼에 정수 좌표 fillRect 만 · 곡선 안티앨리어싱/그라데이션/반투명 없음 ·
 * 외곽선 1칸(#1b0f0a) + 윗면 밝은 줄 + 아랫면 그늘 · 빛과 하늘은 계단식 색 띠 + 바둑판 디더링 · 글자는 도트 글꼴.
 *
 * 쓰는 법 (전부 도트 버퍼 좌표):
 *   drawArena(c, arena, W, H, floorY, t, { fever, energy, beat })   arena 0~4 · energy 0~3 · beat = 박 위치(소수, 없으면 t*2)
 *   drawLane(c, lane, x, top, bottom, w, t, { pulse, ticks, label }) lane 'L'|'R' · ticks = 박 줄 y 배열(선택) · label=false 면 머리 글자 없음
 *   drawNote(c, lane, kind, x, y, w, { holdPx, hit, t })             x = 레인 왼쪽 · y = 노트 가운데 · B 는 x·w 가 두 레인 전체(laneW 선택)
 *   drawTarget(c, lane, x, y, w, { pressed, flash })                  x = 레인 왼쪽 · y = 판정선(표적 가운데)
 *   drawHit(c, x, y, grade, age)                                       grade perfect|great|good|miss · age 0~0.4초
 *   drawFeverAura(c, cx, footY, scale, t)                              선수 뒤에 먼저 그린다(선수가 가운데를 덮는다)
 */

import { rect, px, oval, rbox, obox, line, tone, sprite, canvas, OUT } from '../art.js';

const ro = Math.round;
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ---------- 색 ---------- */
/** 레인 색 — L(ROPE) 파랑 · R(JUMP) 주황 · B(크로스) 금색 */
const LC = {
  L: { main: '#3a8cff', lite: '#a8d8ff', mid: '#6cb4ff', dark: '#1f4fb8', deep: '#10265e', bg: '#0b1330', bg2: '#132050', bg3: '#1c2e6e', hand: '#ffffff', handS: '#b8d0ff' },
  R: { main: '#ff8a1a', lite: '#ffd27a', mid: '#ffb04a', dark: '#c4500a', deep: '#5a2208', bg: '#1c0e0a', bg2: '#331a0e', bg3: '#4c2812', hand: '#fff3dc', handS: '#d8bc94' },
  B: { main: '#ffcc22', lite: '#fff6b0', mid: '#ffe066', dark: '#b8860b', deep: '#5a3a00', hand: '#e8423a', handS: '#9a2017' },
};
const RAIN = ['#ff4d4d', '#ff9a1a', '#ffe14d', '#4dd27a', '#4dc3ff', '#5a6dff', '#c45cff'];

/* ---------- 작은 도구 ---------- */
/** 바둑판 디더링 패턴 — 한 번 fillRect 로 반만(또는 1/3만) 찍는다. 화면 좌표에 고정되어 움직여도 번쩍이지 않는다 */
const patCache = new WeakMap();
function pat(c, col, n = 2) {
  let m = patCache.get(c);
  if (!m) { m = new Map(); patCache.set(c, m); }
  const k = col + n;
  let p = m.get(k);
  if (!p) {
    const tile = canvas(n, n);
    const g = tile.getContext('2d');
    g.fillStyle = col;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if ((x + y) % n === 0) g.fillRect(x, y, 1, 1);
    p = c.createPattern(tile, 'repeat');
    m.set(k, p);
  }
  return p;
}
/** 계단식 띠 — 띠 사이 두 줄은 바둑판으로 섞는다 */
function bands(c, x0, W, y0, y1, cols) {
  const n = cols.length, h = (y1 - y0) / n;
  for (let i = 0; i < n; i++) rect(c, x0, y0 + ro(i * h), W, ro((i + 1) * h) - ro(i * h), cols[i]);
  for (let i = 1; i < n; i++) {
    const y = y0 + ro(i * h);
    rect(c, x0, y - 1, W, 1, pat(c, cols[i]));
    rect(c, x0, y, W, 1, pat(c, cols[i - 1]));
  }
}
/** 타원 고리(바깥 − 안) — 줄마다 두 칸 덩어리로. 표적 고리 · 줄 고리에 쓴다 */
function ring(c, cx, cy, ro1, ri, col, ry1 = ro1, ryi = ri, maxRow = Infinity, minRow = -Infinity) {
  const y0 = Math.floor(cy - ry1), y1 = Math.ceil(cy + ry1);
  for (let y = y0; y <= y1; y++) {
    if (y > maxRow || y < minRow) continue;
    const k = (y + 0.5 - cy) / ry1;
    if (Math.abs(k) > 1) continue;
    const hw = ro1 * Math.sqrt(1 - k * k);
    const a = ro(cx - hw), b = ro(cx + hw);
    const ki = (y + 0.5 - cy) / ryi;
    if (Math.abs(ki) >= 1 || ri <= 0) { if (b > a) rect(c, a, y, b - a, 1, col); continue; }
    const hi = ri * Math.sqrt(1 - ki * ki);
    const ia = ro(cx - hi), ib = ro(cx + hi);
    if (ia > a) rect(c, a, y, ia - a, 1, col);
    if (b > ib) rect(c, ib, y, b - ib, 1, col);
  }
}
/** 정적인 도트 그림은 한 번 그려 두고 drawImage — (ox, oy) = 그림 속 기준점. 노트 · 표적처럼 매 프레임 여러 번 그리는 것 */
const stampCache = new Map();
function stamp(c, key, x, y, w, h, ox, oy, draw) {
  let cv = stampCache.get(key);
  if (!cv) {
    if (stampCache.size > 400) stampCache.clear();
    cv = canvas(w, h);
    draw(cv.getContext('2d'), ox, oy);
    stampCache.set(key, cv);
  }
  c.drawImage(cv, x - ox, y - oy);
}
/** 위치마다 같은 값이 나오는 난수 (관중 색 · 별 자리) */
function hash(n) { n = (n ^ 61) ^ (n >>> 16); n = (n + (n << 3)) | 0; n ^= n >>> 4; n = Math.imul(n, 0x27d4eb2d); n ^= n >>> 15; return (n >>> 0) / 4294967296; }

/* ---------- 도트 글꼴 (3x5, M·W·N 만 넓다) — 전광판 · 현수막 글자. 글꼴 파일 없음 ---------- */
const FONT = {
  A: ['.#.', '#.#', '###', '#.#', '#.#'], B: ['##.', '#.#', '##.', '#.#', '##.'], C: ['.##', '#..', '#..', '#..', '.##'],
  D: ['##.', '#.#', '#.#', '#.#', '##.'], E: ['###', '#..', '##.', '#..', '###'], F: ['###', '#..', '##.', '#..', '#..'],
  G: ['.##', '#..', '#.#', '#.#', '.##'], H: ['#.#', '#.#', '###', '#.#', '#.#'], I: ['###', '.#.', '.#.', '.#.', '###'],
  J: ['..#', '..#', '..#', '#.#', '.#.'], K: ['#.#', '#.#', '##.', '#.#', '#.#'], L: ['#..', '#..', '#..', '#..', '###'],
  M: ['#...#', '##.##', '#.#.#', '#...#', '#...#'], N: ['#..#', '##.#', '#.##', '#..#', '#..#'], O: ['.#.', '#.#', '#.#', '#.#', '.#.'],
  P: ['##.', '#.#', '##.', '#..', '#..'], Q: ['.#.', '#.#', '#.#', '##.', '.##'], R: ['##.', '#.#', '##.', '#.#', '#.#'],
  S: ['.##', '#..', '.#.', '..#', '##.'], T: ['###', '.#.', '.#.', '.#.', '.#.'], U: ['#.#', '#.#', '#.#', '#.#', '###'],
  V: ['#.#', '#.#', '#.#', '#.#', '.#.'], W: ['#...#', '#...#', '#.#.#', '##.##', '#...#'], X: ['#.#', '#.#', '.#.', '#.#', '#.#'],
  Y: ['#.#', '#.#', '.#.', '.#.', '.#.'], Z: ['###', '..#', '.#.', '#..', '###'],
  0: ['###', '#.#', '#.#', '#.#', '###'], 1: ['.#.', '##.', '.#.', '.#.', '###'], 2: ['##.', '..#', '.#.', '#..', '###'],
  3: ['##.', '..#', '.#.', '..#', '##.'], 4: ['#.#', '#.#', '###', '..#', '..#'], 5: ['###', '#..', '##.', '..#', '##.'],
  6: ['.##', '#..', '###', '#.#', '###'], 7: ['###', '..#', '.#.', '.#.', '.#.'], 8: ['###', '#.#', '###', '#.#', '###'],
  9: ['###', '#.#', '###', '..#', '##.'], '!': ['#', '#', '#', '.', '#'], '.': ['.', '.', '.', '.', '#'], ':': ['.', '#', '.', '#', '.'],
  '*': ['.....', '..#..', '#####', '.#.#.', '#...#'], ' ': ['..', '..', '..', '..', '..'], '-': ['...', '...', '###', '...', '...'],
};
export function textW(s) { let w = 0; for (const ch of s) w += (FONT[ch] || FONT[' '])[0].length + 1; return Math.max(0, w - 1); }
function glyphs(c, s, x, y, col) {
  let cx = x;
  for (const ch of s) {
    const g = FONT[ch] || FONT[' '];
    for (let j = 0; j < 5; j++) { const r = g[j]; for (let i = 0; i < r.length; i++) if (r[i] === '#') rect(c, cx + i, y + j, 1, 1, col); }
    cx += g[0].length + 1;
  }
}
/** 도트 글자 — edge: 'shadow'(오른쪽 아래 그림자) | 'outline'(둘레 1칸) | null */
export function ptext(c, s, x, y, col, edge = 'shadow', ec = OUT) {
  if (edge === 'outline') for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]]) glyphs(c, s, x + ox, y + oy, ec);
  else if (edge === 'shadow') { glyphs(c, s, x + 1, y + 1, ec); glyphs(c, s, x + 1, y, ec); }
  glyphs(c, s, x, y, col);
  return textW(s);
}
const ctext = (c, s, cx, y, col, edge, ec) => ptext(c, s, ro(cx - textW(s) / 2), y, col, edge, ec);

/* ---------- 작은 스프라이트 ---------- */
const STAR9 = ['....o....', '...oyo...', '...oyo...', 'oooyyyooo', 'oyyywyyyo', '.oyyyyyo.', '..oyyyo..', '.oyyoyyo.', '.ooo.ooo.'];
const STAR7 = ['...o...', '..oyo..', 'ooyyyoo', 'oyywyyo', '.oyyyo.', '.oyoyo.', '.oo.oo.'];
const STAR5 = ['..o..', '.oyo.', 'oyyyo', '.oyo.', 'o.o.o'];
const SPARK = ['.w.', 'www', '.w.'];
const SPARK5 = ['..w..', '..w..', 'wwyww', '..w..', '..w..'];
const XMARK = ['ooo...ooo', 'oxxo.oxxo', '.oxxoxxo.', '..oxxxo..', '..oxxxo..', '.oxxoxxo.', 'oxxo.oxxo', 'ooo...ooo'];
const TROPHY = ['ooooooooo', 'oyyywyyyo', 'oyoywyoyo', 'oyoyyyoyo', '.ooyyyoo.', '..oyyyo..', '...oyo...', '...oyo...', '..ooooo..', '..oyyyo..', '.ooooooo.'];

/* =====================================================================
 * 레인 — 어두운 디더링 기둥 + 박 눈금 + 판정선 쪽 은은한 빛
 * ===================================================================== */
export function drawLane(c, lane, x, top, bottom, w, t = 0, opt = {}) {
  const P = LC[lane] || LC.R;
  x = ro(x); top = ro(top); bottom = ro(bottom); w = ro(w);
  const h = bottom - top;
  if (h <= 0 || w <= 2) return;
  const pulse = opt.pulse || 0;
  const lv = pulse > 0.66 ? 2 : pulse > 0.2 ? 1 : 0;           // 빛은 3계단
  const ticks = opt.ticks && opt.ticks.length ? opt.ticks : null;
  const label = opt.label !== false && h > 20;
  /* 기둥 자체는 움직이지 않으니 구워 두고, 박 줄만 매번 */
  stamp(c, `l${lane}${w}x${h}:${lv}:${label}:${!ticks}`, x, top, w + 2, h + 2, 1, 1, (g, ox, oy) => laneRaw(g, P, lane, ox, oy, oy + h, w, lv, label, !ticks));
  if (ticks) for (const ty of ticks) {
    const yy = ro(ty);
    if (yy <= top + 1 || yy >= bottom - 1) continue;
    for (let k = x + 2; k < x + w - 1; k += 2) px(c, k, yy, lv ? P.mid : P.dark);
  }
}
function laneRaw(c, P, lane, x, top, bottom, w, lv, label, ruler) {
  const h = bottom - top;
  const base = [P.bg, P.bg2, P.bg3][lv];
  rect(c, x - 1, top - 1, w + 2, h + 2, OUT);
  rect(c, x, top, w, h, base);
  rect(c, x, top, w, h, pat(c, lv ? P.bg3 : P.bg2, 2));                    // 바탕 결
  /* 안쪽 테두리 — 왼쪽 빛 · 오른쪽 그늘 */
  rect(c, x, top, 1, h, lv ? P.dark : P.deep);
  rect(c, x + w - 1, top, 1, h, OUT);
  rect(c, x + 1, top, 1, h, pat(c, lv ? P.mid : P.dark, 2));
  /* 판정선 쪽 빛 — 아래로 갈수록 진해지는 3계단 디더링 (pulse 면 높이 · 밝기 ↑) */
  const gh = ro(h * (0.22 + lv * 0.1));
  const g3 = ro(gh / 3);
  rect(c, x + 2, bottom - gh, w - 3, g3, pat(c, lv ? P.dark : P.deep, 3));
  rect(c, x + 2, bottom - gh + g3, w - 3, g3, pat(c, lv ? P.main : P.dark, 2));
  rect(c, x + 2, bottom - gh + g3 * 2, w - 3, gh - g3 * 2, lv === 2 ? P.dark : P.deep);
  rect(c, x + 2, bottom - gh + g3 * 2, w - 3, gh - g3 * 2, pat(c, lv === 2 ? P.mid : P.dark, 2));
  /* 박 줄(ticks)이 없으면 양옆 자 눈금 */
  if (ruler) for (let yy = bottom - 6; yy > top + 8; yy -= 6) {
    const big = ((bottom - yy) / 6) % 4 === 0;
    rect(c, x + 2, yy, big ? 3 : 2, 1, P.dark);
    rect(c, x + w - (big ? 4 : 3), yy, big ? 3 : 2, 1, P.dark);
  }
  /* 머리 글자 ROPE / JUMP */
  if (label) {
    rect(c, x, top, w, 8, P.dark);
    rect(c, x, top, w, 1, P.main);
    rect(c, x, top + 7, w, 1, OUT);
    ctext(c, lane === 'L' ? 'ROPE' : 'JUMP', x + w / 2, top + 1, lv ? '#ffffff' : P.lite, 'shadow');
  }
}

/* =====================================================================
 * 노트 — «떨어지는 줄»
 *  R(JUMP) 주황 굵은 줄 막대 + 양끝 손잡이 · L(ROPE) 파랑 줄 고리(∩) · B(크로스) 두 레인의 금색 X 줄 · hold 위로 꼬리
 * ===================================================================== */
export function drawNote(c, lane, kind, x, y, w, opt = {}) {
  x = ro(x); y = ro(y); w = ro(w);
  const hit = !!opt.hit;
  const t = opt.t || 0;
  if (lane === 'B') {
    const lw = opt.laneW || 24;
    stamp(c, `nB${w}:${lw}:${hit}`, x, y, w + 4, 26, 2, 13, (g, ox, oy) => noteCross(g, ox, oy, w, lw, hit));
    if (hit || Math.floor(t * 8) % 4 === 0) sprite(c, ro(x + w / 2) - 2, y - 2, STAR5, { o: OUT, y: hit ? '#ffffff' : LC.B.lite });   // 매듭 반짝
    return;
  }
  const P = LC[lane] || LC.R;
  if (kind === 'hold' && (opt.holdPx || 0) > 0) holdTail(c, P, x, y, w, ro(opt.holdPx), hit, t);
  if (lane === 'L') stamp(c, `nL${w}:${hit}`, x, y, w + 8, 26, 4, 13, (g, ox, oy) => noteLoop(g, P, ox, oy, w, hit));
  else stamp(c, `nR${w}:${hit}`, x, y, w + 8, 20, 4, 10, (g, ox, oy) => noteBar(g, P, ox, oy, w, hit));
}

/** 줄 손잡이(세로, 3칸 굵기) — 노트에 쓴다. (hx, hy) = 손잡이 왼쪽 위, band = 가운데 손잡이 띠 색 */
function grip(c, hx, hy, hh, P, band) {
  rbox(c, hx - 1, hy - 1, 5, hh + 2, OUT, 1);
  rect(c, hx, hy, 3, hh, P.hand);
  rect(c, hx, hy, 1, hh, '#ffffff');
  rect(c, hx + 2, hy, 1, hh, P.handS);
  const by = hy + Math.floor(hh / 2) - 1;
  rect(c, hx, by, 3, 3, band);                                          // 손잡이 띠
  rect(c, hx, by, 1, 3, tone(band, 0.35));
  rect(c, hx, hy + hh - 1, 3, 1, P.handS);
}

/** JUMP — 살짝 처진 굵은 줄(4칸) + 양끝 흰 손잡이. 꼰 줄처럼 사선 무늬 */
function noteBar(c, P, x, y, w, hit) {
  const main = hit ? P.lite : P.main, lite = hit ? '#ffffff' : P.lite, dark = hit ? P.mid : P.dark;
  const ax = x + 4, bx = x + w - 5;                       // 줄이 손잡이에 붙는 자리
  const mid = (ax + bx) / 2, half = Math.max(1, (bx - ax) / 2);
  const yAt = (i) => y - 2 + ro(2 * (1 - ((i - mid) / half) ** 2));
  for (let i = ax; i <= bx; i++) rect(c, i, yAt(i) - 2, 1, 6, OUT);
  for (let i = ax; i <= bx; i++) {
    const yy = yAt(i);
    px(c, i, yy - 1, lite);
    for (let r = 0; r < 2; r++) { const k = (i + r + 40) % 4; px(c, i, yy + r, k === 0 ? lite : k === 2 ? dark : main); }
    px(c, i, yy + 2, dark);
  }
  grip(c, x + 1, y - 5, 11, P, main);
  grip(c, x + w - 4, y - 5, 11, P, main);
  if (hit) for (const [ox, oy] of [[-2, -7], [w + 1, -7], [-2, 6], [w + 1, 6]]) px(c, x + ox, y + oy, '#ffffff');
}

/** ROPE — 머리 위를 넘어가는 굵은 줄 고리(∩) + 두 끝 흰 손잡이 */
function noteLoop(c, P, x, y, w, hit) {
  const main = hit ? P.lite : P.main, lite = hit ? '#ffffff' : P.lite, dark = hit ? P.mid : P.dark;
  const cx = x + w / 2 - 0.5;
  const rx = w / 2 - 1, ry = 10;
  const base = y + 2;                                     // 고리 아래 끝 줄
  ring(c, cx, base, rx, rx - 5, OUT, ry, ry - 5, base);
  ring(c, cx, base, rx - 1, rx - 4, main, ry - 1, ry - 4, base);
  ring(c, cx, base, rx - 1, rx - 2, lite, ry - 1, ry - 2, base - 3);          // 바깥 윗줄 빛
  ring(c, cx, base, rx - 3.3, rx - 4, dark, ry - 3.3, ry - 4, base);          // 안쪽 그늘
  /* 꼰 줄 무늬 */
  for (let i = 0; i < 9; i++) {
    const a = Math.PI + 0.3 + (i * (Math.PI - 0.6)) / 8;
    px(c, ro(cx + Math.cos(a) * (rx - 2.6)), ro(base + Math.sin(a) * (ry - 2.6)), i % 2 ? lite : dark);
  }
  grip(c, x + 1, base - 1, 7, P, main);
  grip(c, x + w - 4, base - 1, 7, P, main);
  if (hit) { const k = ro(cx); px(c, k, y - 10, '#ffffff'); px(c, k - 1, y - 9, '#ffffff'); px(c, k + 1, y - 9, '#ffffff'); }
}

/** 크로스 — 레인마다 금색 X 줄 + 가운데를 잇는 꼰 두 가닥 */
function noteCross(c, x, y, w, lw, hit) {
  const P = LC.B;
  const main = hit ? P.lite : P.main, lite = hit ? '#ffffff' : P.lite, dark = hit ? P.mid : P.dark;
  /* 잇는 줄 — 두 가닥(2칸 굵기)이 꼬였다 풀렸다 */
  const a0 = x + lw - 3, a1 = x + w - lw + 2;
  const k = (i) => ro(Math.sin((i - x) / 3.6) * 3);
  for (let i = a0; i <= a1; i++) { rect(c, i, y - k(i) - 2, 1, 4, OUT); rect(c, i, y + k(i) - 2, 1, 4, OUT); }
  for (let i = a0; i <= a1; i++) {
    const front = Math.cos((i - x) / 3.6) > 0;             // 앞에 오는 가닥을 나중에
    const draw = (s) => { px(c, i, y + s * k(i) - 1, s > 0 ? main : lite); px(c, i, y + s * k(i), s > 0 ? dark : main); };
    if (front) { draw(1); draw(-1); } else { draw(-1); draw(1); }
  }
  /* 레인마다 X */
  for (const lx of [x, x + w - lw]) {
    const x0 = lx + 3, x1 = lx + lw - 4, y0 = y - 7, y1 = y + 7;
    line(c, x0, y0, x1, y1, 6, OUT); line(c, x0, y1, x1, y0, 6, OUT);
    line(c, x0, y1, x1, y0, 4, dark); line(c, x0, y1, x1, y0, 2, main);
    line(c, x0, y0, x1, y1, 4, dark); line(c, x0, y0, x1, y1, 2, main);
    for (let i = 0; i <= x1 - x0; i += 3) px(c, x0 + i, ro(y0 + ((y1 - y0) * i) / (x1 - x0)) - 1, lite);
    const mx = ro(lx + lw / 2);
    rbox(c, mx - 4, y - 3, 7, 6, OUT, 1);                  // 가운데 매듭
    rect(c, mx - 3, y - 2, 5, 4, main);
    rect(c, mx - 3, y - 2, 5, 1, lite);
    rect(c, mx - 3, y + 1, 5, 1, dark);
    for (const [ex, ey] of [[x0, y0], [x1, y0], [x0, y1], [x1, y1]]) { rect(c, ex - 2, ey - 2, 5, 5, OUT); rect(c, ex - 1, ey - 1, 3, 3, '#ffffff'); px(c, ex + 1, ey + 1, '#c9b89a'); }
  }
}

/** 꾹 노트 꼬리 — 위로 뻗은 줄 기둥 + 반짝이 무늬 + 끝 고리 */
function holdTail(c, P, x, y, w, len, hit, t) {
  const cx = x + ro(w / 2) - 3;
  const top = y - len;
  rect(c, cx - 1, top, 8, len, OUT);
  rect(c, cx, top, 6, len, hit ? P.mid : P.dark);
  rect(c, cx + 1, top, 4, len, hit ? P.lite : P.main);
  rect(c, cx + 1, top, 1, len, hit ? '#ffffff' : P.lite);
  /* 사선 꼰 무늬 — 위로 흐른다(hit 면 빠르게) */
  const sh = Math.floor(t * (hit ? 40 : 12));
  for (let yy = y - 1; yy > top; yy--) {
    const k = (yy + sh + 600) % 5;
    if (k === 0) { px(c, cx + 2, yy, '#ffffff'); px(c, cx + 3, yy - 1, hit ? '#ffffff' : P.lite); }
    else if (k === 2) px(c, cx + 4, yy, P.dark);
  }
  /* 반짝 별 — 꼬리 위를 오른다 */
  const n = Math.floor(len / 14);
  for (let i = 0; i < n; i++) {
    const yy = y - 10 - ((i * 14 + sh * 2) % Math.max(1, len - 12));
    if ((i + Math.floor(t * 6)) % 2 === 0) sprite(c, cx + 1, ro(yy) - 1, SPARK, { w: '#ffffff' });
  }
  /* 끝 고리 */
  rbox(c, cx - 2, top - 5, 10, 7, OUT, 2);
  rbox(c, cx - 1, top - 4, 8, 5, P.hand, 1);
  rect(c, cx, top - 4, 6, 1, '#ffffff');
  rect(c, cx - 1, top, 8, 1, P.handS);
  rect(c, cx + 1, top - 3, 4, 2, hit ? P.lite : P.main);
}

/* =====================================================================
 * 표적 — 판정선. R = 발 모양(발바닥 두 짝, 발가락까지) 주황 고리, L = 주먹 + 줄 손잡이 파랑 고리
 * 고리 지름 = 레인 폭 + 4 (양옆으로 2칸씩 나온다 — 판정선이 눈에 확 띄게)
 * ===================================================================== */
/* 왼발 발바닥 — 엄지발가락이 안쪽(오른쪽), 장심(안쪽)이 오목. w=발바닥 · s=그늘 · o=외곽선 */
const SOLE_L = [
  '....ooo.',
  '.oo.owwo',
  'oswoowwo',
  'oswoowwo',
  '.ooooooo',
  'oswwwwwo',
  'oswwwwwo',
  'oswwwwwo',
  'oswwwwo.',
  '.oswwo..',
  '.oswwo..',
  '.oswwwo.',
  '.oswwwo.',
  '.oswwwo.',
  '..oooo..',
];
const SOLE_R = SOLE_L.map((r) => r.split('').reverse().join(''));

export function drawTarget(c, lane, x, y, w, opt = {}) {
  const pressed = !!opt.pressed;
  const fl = opt.flash || 0;
  const flv = fl > 0.66 ? 2 : fl > 0.2 ? 1 : 0;
  x = ro(x); w = ro(w);
  const M = 14, V = ro(w / 2) + 13;                       // 번쩍 반짝이까지 들어가는 여백
  stamp(c, `t${lane}${w}:${pressed}:${flv}`, x, ro(y), w + M * 2, V * 2, M, V, (g, ox, oy) => targetRaw(g, lane, ox, oy, w, pressed, flv));
}
function targetRaw(c, lane, x, y, w, pressed, flv) {
  const P = LC[lane] || LC.R;
  const cy = y + (pressed ? 1 : 0);
  const cx = x + w / 2 - 0.5;
  const R = w / 2 + 2;
  const band = flv === 2 ? '#ffffff' : flv === 1 ? P.lite : pressed ? P.dark : P.main;
  const bandL = flv ? '#ffffff' : pressed ? P.main : P.lite;
  const bandD = flv ? P.lite : pressed ? P.deep : P.dark;
  /* 번쩍 — 고리 바깥에 한 겹 더 */
  if (flv) ring(c, cx, cy, R + 3, R + 1, flv === 2 ? P.lite : pat(c, P.lite, 2));
  /* 고리: 외곽선 · 굵은 띠(윗빛 · 아래 그늘) · 안 외곽선 · 바닥 */
  oval(c, cx, cy, R + 1, R + 1, OUT);
  ring(c, cx, cy, R, R - 3, band);
  ring(c, cx, cy, R, R - 1, bandL, R, R - 1, cy - 3);
  ring(c, cx, cy, R, R - 1, bandD, R, R - 1, Infinity, cy + 3);
  oval(c, cx, cy, R - 3, R - 3, OUT);
  oval(c, cx, cy, R - 4, R - 4, pressed ? P.bg3 : P.deep);
  if (!pressed) oval(c, cx, cy - 1, R - 5, R - 6, pat(c, P.dark, 2));
  /* 판정선 눈금 — 고리 양옆 */
  rect(c, ro(cx - R) - 3, cy, 2, 1, bandL); rect(c, ro(cx + R) + 2, cy, 2, 1, bandL);
  const ix = ro(cx);
  if (lane === 'L') {
    /* 손잡이(세로) — 위아래 흰 마개 */
    const hc = pressed ? P.dark : P.main;
    rect(c, ix - 2, cy - 9, 5, 18, OUT);
    rect(c, ix - 1, cy - 8, 3, 16, hc);
    rect(c, ix - 1, cy - 8, 1, 16, pressed ? P.main : P.lite);
    rect(c, ix - 1, cy - 8, 3, 2, '#ffffff'); rect(c, ix - 1, cy + 6, 3, 2, '#e8e8f0');
    /* 줄 — 손잡이 위에서 오른쪽으로 휘어 나간다 */
    const ROPE_PTS = [[0, -10], [1, -11], [2, -12], [3, -12], [4, -12], [5, -12], [6, -11], [7, -10], [8, -9]];
    for (const [ox, oy] of ROPE_PTS) rect(c, ix + ox - 1, cy + oy - 1, 3, 3, OUT);
    for (const [ox, oy] of ROPE_PTS) { px(c, ix + ox, cy + oy, bandL); px(c, ix + ox, cy + oy + 1, band); }
    /* 주먹 — 엄지가 위로 감싸고 손가락 세 마디 */
    const sk = pressed ? '#e8b48a' : '#ffe0c2', skS = pressed ? '#c99268' : '#f2bf98', skL = '#fff4e8';
    rbox(c, ix - 6, cy - 4, 12, 10, OUT, 2);
    rbox(c, ix - 5, cy - 3, 10, 8, sk, 1);
    rect(c, ix - 5, cy - 3, 6, 2, skL);                          // 엄지(위)
    rect(c, ix - 5, cy - 1, 7, 1, OUT);                          // 엄지 아래 금
    rect(c, ix + 1, cy - 3, 1, 2, OUT);
    for (const fy2 of [cy + 1, cy + 3]) rect(c, ix - 5, fy2, 8, 1, skS);   // 손가락 마디
    rect(c, ix + 3, cy, 2, 5, skS);                              // 손가락 끝 그늘
    px(c, ix - 4, cy, skL);
  } else {
    const pal = { o: OUT, w: pressed ? '#e8d4b4' : '#fff3dc', s: pressed ? '#c9a878' : '#f0c890' };
    sprite(c, ix - 9, cy - 7, SOLE_L, pal);
    sprite(c, ix + 1, cy - 7, SOLE_R, pal);
  }
  if (flv) {
    const r = R + 4 + (flv === 2 ? 0 : 2);
    for (let i = 0; i < 4; i++) {
      const a = i * (TAU / 4) + Math.PI / 4;
      sprite(c, ro(cx + Math.cos(a) * r) - 2, ro(cy + Math.sin(a) * r) - 2, SPARK5, { w: '#ffffff', y: flv === 2 ? '#ffffff' : P.lite });
    }
  }
}

/* =====================================================================
 * 맞힘 폭발 — perfect 금색 큰 별 터짐 · great 하늘 · good 초록 작게 · miss 회색 X
 * 8장짜리 도트 애니메이션 (age 0~0.4초)
 * ===================================================================== */
const HIT = {
  perfect: { a: '#ffffff', b: '#fff3a0', c: '#ffcc22', d: '#ff8a1a', n: 8, r: 20, th: 2 },
  great: { a: '#ffffff', b: '#c8f0ff', c: '#4dc3ff', d: '#1f6fd8', n: 8, r: 15, th: 2 },
  good: { a: '#f0ffe0', b: '#b8f0a0', c: '#4dd27a', d: '#2e8b3a', n: 6, r: 10, th: 1 },
};
export function drawHit(c, x, y, grade, age) {
  x = ro(x); y = ro(y);
  const u = clamp(age / 0.4, 0, 1);
  if (u >= 1) return;
  const f = Math.min(7, Math.floor(u * 8));
  if (grade === 'miss') {
    if (f >= 6 && f % 2) return;
    const sx = f < 2 ? (f % 2 ? 1 : -1) : 0;
    const yy = y - 3 + ro(u * 8);
    sprite(c, x - 4 + sx, yy, XMARK, { o: OUT, x: f < 2 ? '#c8ccd4' : '#8a909a' });
    if (f < 4) for (const [ox, oy] of [[-7, 0], [6, -1], [-5, 5], [6, 4]]) { rect(c, x + ox + sx - (f > 1 ? Math.sign(ox) : 0), y + oy + f, 2, 1, '#6a707a'); }
    return;
  }
  const H = HIT[grade] || HIT.good;
  const big = grade === 'perfect';
  /* 퍼지는 고리 (굵기 th) */
  if (f >= 1 && f < 6) {
    const rr = 3 + u * H.r;
    ring(c, x - 0.5, y - 0.5, rr + H.th, rr, f < 3 ? H.a : f < 5 ? H.b : H.c);
    if (f >= 4) ring(c, x - 0.5, y - 0.5, rr + H.th, rr, pat(c, H.d, 2));
  }
  /* 가운데 섬광 */
  if (f === 0) {
    const L = big ? 11 : 7;
    rect(c, x - 1, y - L, 2, L * 2, H.a); rect(c, x - L, y - 1, L * 2, 2, H.a);
    for (const [ox, oy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) line(c, x + ox * 2, y + oy * 2, x + ox * (L - 4), y + oy * (L - 4), 1, H.b);
    sprite(c, x - 4, y - 4, STAR9, { o: OUT, y: H.b, w: '#ffffff' });
  } else if (f < 3) {
    if (big) sprite(c, x - 4, y - 4, STAR9, { o: OUT, y: H.c, w: '#ffffff' });
    else sprite(c, x - 3, y - 3, STAR7, { o: OUT, y: H.c, w: '#ffffff' });
  } else if (f < 5) sprite(c, x - 2, y - 2, STAR5, { o: OUT, y: big ? H.b : H.c });
  /* 사방으로 튀는 알갱이 */
  if (f === 0 || (f >= 6 && f % 2)) return;
  const dist = 4 + u * H.r * 1.15;
  for (let i = 0; i < H.n; i++) {
    const a = (i / H.n) * TAU + Math.PI / H.n;
    const ex = ro(x + Math.cos(a) * dist), ey = ro(y + Math.sin(a) * dist);
    if (big && f < 5) sprite(c, ex - 2, ey - 2, STAR5, { o: OUT, y: i % 2 ? H.b : H.c });
    else if (f < 5) sprite(c, ex - 1, ey - 1, SPARK, { w: i % 2 ? H.b : H.c });
    else rect(c, ex, ey, 2, 2, H.c);
  }
  /* perfect 는 바깥에 흰 반짝이 넷 더 */
  if (big && f >= 2 && f < 7) {
    const d2 = 8 + u * 16;
    for (let i = 0; i < 4; i++) { const a = i * (TAU / 4) + 0.4; sprite(c, ro(x + Math.cos(a) * d2) - 1, ro(y + Math.sin(a) * d2) - 1, SPARK, { w: '#ffffff' }); }
  }
}

/* =====================================================================
 * 피버 오라 — 선수 몸을 따라 타오르는 불꽃 테두리(바깥 주황 디더링 → 노랑 → 흰빛) + 꼭대기 불꽃 혀 + 떠오르는 별.
 * scale 칸 덩어리로 찍어 선수 도트와 크기를 맞춘다. 선수보다 먼저 그리면 가운데는 선수가 덮어 «테두리»만 남는다.
 * ===================================================================== */
const FLAME = [
  ['..y..', '.yoy.', '.yoy.', 'yowoy', 'yowoy', '.yoy.'],
  ['.y...', '.yy..', 'yoy..', 'yooy.', 'yowoy', '.yoy.'],
  ['...y.', '..yy.', '..yoy', '.yooy', 'yowoy', '.yoy.'],
];
/** 높이 v(발에서 위로, 아이 도트 칸)에서 오라 반폭 — 몸 12 · 머리 13.5 · 꼭대기로 갈수록 뾰족 */
function auraHW(v) {
  if (v < 0) return 0;
  if (v < 4) return 11 + v * 0.25;
  if (v < 18) return 12;
  if (v < 22) return 12 + (v - 18) * 0.4;
  if (v < 44) return 13.5;
  if (v < 56) return 13.5 * Math.pow(1 - (v - 44) / 12, 0.65);
  return 0;
}
export function drawFeverAura(c, cx, footY, scale = 3, t = 0) {
  const s = Math.max(1, ro(scale));
  const ox = ro(cx), oy = ro(footY);
  /* 바깥 → 안: 짙은 주황 디더링 · 주황 · 노랑 · 흰노랑 디더링. 가운데는 비워 둔다(테두리만 — 안쪽은 대회장이 보인다) */
  const LAYERS = [['#c43a0a', 2], ['#ff7a1a', 0], ['#ffc23a', 0], ['#fff6c8', 2]];
  /* 줄마다(아이 도트 한 칸 높이) 반폭을 일렁이게 — 겹마다 경로에 모아 한 번에 칠한다 */
  const paths = LAYERS.map(() => new Path2D());
  for (let v = -1; v < 57; v++) {
    const base = auraHW(v);
    if (base <= 0) continue;
    const wob = Math.sin(t * 13 + v * 0.75) + Math.sin(t * 7 - v * 0.4);
    const hw0 = Math.floor(base + 2 + (wob > 0.6 ? 1 : 0) + (wob > 1.4 ? 1 : 0));
    const yy = oy - (v + 1) * s;
    for (let L = 0; L < LAYERS.length; L++) {
      const hw = hw0 - L;
      if (hw <= 0) break;
      const P2 = paths[L];
      if (hw === 1 || (L === LAYERS.length - 1 && hw <= 2)) { P2.rect(ox - hw * s, yy, hw * 2 * s, s); continue; }
      P2.rect(ox - hw * s, yy, s, s);                       // 왼쪽 한 칸
      P2.rect(ox + (hw - 1) * s, yy, s, s);                 // 오른쪽 한 칸
    }
  }
  LAYERS.forEach(([col, n], L) => { c.fillStyle = n ? pat(c, col, n) : col; c.fill(paths[L]); });
  /* 꼭대기 불꽃 혀 — 3개가 번갈아 일렁인다 */
  const pal = [{ y: '#ff7a1a', o: '#ffd23f', w: '#fff6c8' }, { y: '#c43a0a', o: '#ff9a1a', w: '#ffe14d' }];
  for (let i = 0; i < 5; i++) {
    const k = i - 2;
    const fr = FLAME[(Math.floor(t * 12) + i * 2) % 3];
    const v = 50 - Math.abs(k) * 5 + ((Math.floor(t * 12) + i) % 2);
    sprite(c, ox + (k * 6 - 3) * s, oy - (v + 6) * s, fr, pal[i % 2], s);
  }
  /* 떠오르는 별 — 양옆에서 위로 */
  for (let i = 0; i < 6; i++) {
    const side = i % 2 ? 1 : -1;
    const u = (t * 0.6 + i / 6) % 1;
    if (u > 0.85 && Math.floor(t * 20) % 2) continue;
    const v = Math.floor(u * 54);
    const sx = ox + side * (Math.floor(auraHW(v) + 3 + (i % 3))) * s - (side < 0 ? s : 0), sy = oy - (v + 1) * s;
    sprite(c, sx - s, sy - s, i % 3 === 0 ? ['.y.', 'yyy', '.y.'] : ['y'], { y: i % 3 === 0 ? '#ffe14d' : '#ffffff' }, s);
  }
}

/* =====================================================================
 * 대회장 5종 — 0 동네 운동장 · 1 체육관 · 2 도시 아레나 · 3 네온 아레나 · 4 세계 선수권 경기장
 * 정적인 부분(하늘 · 벽 · 전광판 · 좌석 · 바닥)은 구워 두고, 관중 · 조명 · 피버만 매 프레임
 * ===================================================================== */
const arenaCache = new Map();
const crowdCache = new Map();
const ARENA_TEXT = [
  ['TRAINING', 'GROUND'], ['SPEED', 'ARENA'], ['CROSS', 'CHALLENGE'], ['DOUBLE', 'UNDER'], ['WORLD JUMP ROPE', 'CHAMPIONSHIP'],
];

function layout(W, H, fy) {
  const cx = Math.floor(W / 2);
  const boardH = clamp(ro(fy * 0.16), 14, 34);
  const boardY = clamp(ro(fy * 0.17), 3, 40);
  /* 넓은 화면(가로 · PC)은 전광판 둘 — 가운데 선수에 가리지 않게 양옆으로 */
  const two = W >= 220;
  const boardW = two ? clamp(ro(W * 0.3), 70, 130) : clamp(W - 56, 60, 150);
  const off = ro(W * 0.24);
  const boards = (two ? [cx - off, cx + off] : [cx]).map((c0) => ({ cx: c0, x: c0 - Math.floor(boardW / 2), w: boardW }));
  const crowdTop = boardY + boardH + clamp(ro(fy * 0.1), 4, 26);
  const wallBase = fy - 6;                                // 무대 뒤끝 = 맨 앞줄 관중 발치
  return { cx, boardH, boardY, boardW, boardX: boards[0].x, boards, crowdTop, wallBase, fy, W, H };
}

export function drawArena(c, arena, W, H, floorY, t = 0, opt = {}) {
  const a = (((arena | 0) % 5) + 5) % 5;
  W = ro(W); H = ro(H); floorY = ro(floorY);
  const energy = clamp(ro(opt.energy ?? 1), 0, 3);
  const fever = !!opt.fever;
  const L = layout(W, H, floorY);
  const key = `${a}:${W}x${H}:${floorY}:${energy}`;
  let base = arenaCache.get(key);
  if (!base) {
    if (arenaCache.size > 20) arenaCache.clear();
    base = canvas(W, H);
    paintArena(base.getContext('2d'), a, L, energy);
    arenaCache.set(key, base);
  }
  c.drawImage(base, 0, 0);
  const beat = opt.beat ?? t * 2;
  moveArena(c, a, L, t, beat, energy, fever);
}

/* ---------- 관중 ---------- */
const SKIN = ['#ffe0c2', '#f5c99b', '#d69a6a', '#8d5a3b'];
const HAIR = ['#2a1d15', '#6b3f1d', '#e8c35a', '#c8402e', '#1b0f0a', '#4a3020', '#ff7fbf', '#3a6fd8'];
const SHIRT = ['#e8423a', '#3a7be8', '#f5c518', '#3fbf5a', '#ff7fbf', '#ffffff', '#9b5de5', '#ff8a1a', '#1d3f8a', '#4dc3ff'];
/** 대회장마다 관중 줄 — 위치 · 크기(5칸/4칸) · 어둡기(dark 0 = 다 보임, 1 = 실루엣 + 앞 줄만 색) */
function crowdSpec(a, L) {
  const fy = L.fy;
  if (a === 0) return { rows: [fy - 22, fy - 14], big: true, dark: 0 };
  if (a === 1) { const n = clamp(Math.floor((fy - 10 - L.crowdTop) / 7), 2, 6); return { rows: Array.from({ length: n }, (_, i) => fy - 12 - (n - 1 - i) * 7), big: true, dark: 0 }; }
  const bottom = fy - 15, stride = a === 4 ? 5 : 6;
  const top = a === 3 ? L.crowdTop + 10 : L.crowdTop;
  const n = clamp(Math.floor((bottom - top) / stride) + 1, 2, 30);
  return { rows: Array.from({ length: n }, (_, i) => bottom - (n - 1 - i) * stride), big: a !== 4, dark: 1 };
}
/** 관중 한 무리를 구워 둔다 — part 0/1(번갈아 들썩), arms 팔 번쩍 */
function crowdLayer(a, L, part, arms) {
  const key = `${a}:${L.W}x${L.H}:${L.fy}:${part}:${arms}`;
  let cv = crowdCache.get(key);
  if (cv) return cv;
  if (crowdCache.size > 60) crowdCache.clear();
  cv = canvas(L.W, L.H);
  const c = cv.getContext('2d');
  const S = crowdSpec(a, L);
  const tint = ['#2a3050', '#3a2a30', '#141a3a', '#1e0c34', '#10163a'][a];
  const tintL = ['#4a5070', '#5a4040', '#26305e', '#3a1a5c', '#232c62'][a];
  S.rows.forEach((ry, r) => {
    const front = r >= S.rows.length - (S.dark ? 2 : 9);
    const pw = S.big ? 5 : 4, step = S.big ? 6 : 5;
    const off = (r % 2) * Math.floor(step / 2);
    for (let px0 = -off, i = 0; px0 < L.W; px0 += step, i++) {
      const id = r * 997 + i * 31 + a * 7;
      if (((i + r) % 2) !== part) continue;
      if (hash(id) < 0.06) continue;                          // 빈자리 몇 개
      const sk = SKIN[Math.floor(hash(id + 1) * 4)], hr = HAIR[Math.floor(hash(id + 2) * 8)], sh = SHIRT[Math.floor(hash(id + 3) * 10)];
      const dk = S.dark ? 0 : Math.min(0.32, (S.rows.length - 1 - r) * 0.07);     // 뒷줄일수록 어둡게(깊이)
      const col = front && S.dark ? { sk, hr, sh, rim: null } : !S.dark ? { sk: dk ? tone(sk, -dk) : sk, hr: dk ? tone(hr, -dk) : hr, sh: dk ? tone(sh, -dk) : sh, rim: null } : { sk: tintL, hr: tint, sh: tone(tint, -0.2), rim: tintL };
      person(c, px0, ry, S.big, col, arms && hash(id + 5) < 0.75, a === 3 && hash(id + 6) < 0.6 ? RAIN[Math.floor(hash(id + 7) * 7)] : null);
    }
  });
  crowdCache.set(key, cv);
  return cv;
}
/** 관중 한 명 — (x, y) = 머리 왼쪽 위. big 5칸 폭 / 작게 4칸 폭 */
function person(c, x, y, big, col, arms, stick) {
  if (big) {
    rect(c, x + 1, y, 3, 1, col.hr);
    rect(c, x, y + 1, 5, 1, col.hr); rect(c, x + 1, y + 1, 3, 1, col.sk);
    rect(c, x + 1, y + 2, 3, 1, col.sk);
    rect(c, x, y + 3, 5, 3, col.sh);
    if (col.rim) rect(c, x + 1, y, 3, 1, col.rim);
    else { px(c, x + 1, y + 1, col.hr); px(c, x + 3, y + 1, col.hr); px(c, x + 1, y + 2, '#3a2418'); px(c, x + 3, y + 2, '#3a2418'); }
    if (arms) { rect(c, x - 1, y - 1, 1, 4, col.sh); rect(c, x + 5, y - 1, 1, 4, col.sh); px(c, x - 1, y - 2, col.sk); px(c, x + 5, y - 2, col.sk); if (stick) { rect(c, x - 1, y - 5, 1, 3, stick); rect(c, x + 5, y - 5, 1, 3, stick); } }
  } else {
    rect(c, x + 1, y, 2, 1, col.hr);
    rect(c, x + 1, y + 1, 2, 1, col.sk);
    rect(c, x, y + 2, 4, 3, col.sh);
    if (col.rim) px(c, x + 1, y, col.rim);
    if (arms) { px(c, x - 1, y, col.sh); px(c, x + 4, y, col.sh); px(c, x - 1, y - 1, col.sk); px(c, x + 4, y - 1, col.sk); }
  }
}

/* ---------- 부품 ---------- */
/** 철골 트러스 — 위아래 관 + 지그재그 */
function truss(c, x0, x1, y, col = '#5a6478') {
  rect(c, x0, y - 1, x1 - x0, 7, OUT);
  rect(c, x0, y, x1 - x0, 1, tone(col, 0.3));
  rect(c, x0, y + 4, x1 - x0, 1, col);
  for (let x = x0; x < x1; x += 4) { line(c, x, y + 1, x + 2, y + 3, 1, col); line(c, x + 2, y + 3, x + 4, y + 1, 1, tone(col, -0.2)); }
}
/** 조명 깡통 — 렌즈 색 lens */
function lamp(c, x, y, lens) {
  rect(c, x, y - 2, 1, 2, OUT);
  rbox(c, x - 3, y, 7, 6, OUT, 1);
  rect(c, x - 2, y + 1, 5, 3, '#3a4050');
  rect(c, x - 2, y + 1, 5, 1, '#5a6478');
  rect(c, x - 2, y + 4, 5, 1, lens);
  px(c, x - 1, y + 4, '#ffffff');
}
/** 전광판 틀 — 외곽선 + 틀 색 + 윗빛 + 아래 그늘 + 볼트 */
function frame(c, x, y, w, h, col, screen) {
  obox(c, x, y, w, h, col, 1);
  rect(c, x + 2, y + 2, w - 4, h - 4, OUT);
  rect(c, x + 3, y + 3, w - 6, h - 6, screen);
  for (const [bx, by] of [[x + 1, y + 1], [x + w - 2, y + 1], [x + 1, y + h - 2], [x + w - 2, y + h - 2]]) px(c, bx, by, tone(col, 0.5));
}
/** 삼각 깃발 줄 */
function bunting(c, x0, x1, y, sag, cols) {
  let k = 0;
  for (let x = x0; x < x1; x++) {
    const u = (x - x0) / Math.max(1, x1 - x0);
    const yy = y + ro(Math.sin(u * Math.PI) * sag);
    px(c, x, yy, OUT);
    if ((x - x0) % 7 === 2) {
      const col = cols[k++ % cols.length];
      for (let j = 0; j < 4; j++) { rect(c, x - 2 + j / 2, yy + 1 + j, 5 - j, 1, j === 3 ? OUT : col); }
      px(c, x - 2, yy + 1, OUT); px(c, x + 2, yy + 1, OUT);
    }
  }
}
/** 꼭대기에서 아래로 퍼지는 빛 기둥 — 줄마다 한 번 fillRect(디더링 패턴). L 을 주면 전광판 글자 위는 비켜 간다 */
function beam(c, x0, y0, x1, y1, w0, w1, col, n = 3, L = null) {
  const p = pat(c, col, n);
  const h = Math.max(1, y1 - y0);
  const path = new Path2D();                              // 줄마다 fillRect 대신 경로에 모아 한 번에(패턴 칠은 비싸다)
  const rect = (_, x, y, w, hh) => { if (w > 0) path.rect(x, y, w, hh); };
  for (let y = y0; y < y1; y++) {
    const u = (y - y0) / h;
    const cxx = x0 + (x1 - x0) * u, hw = (w0 + (w1 - w0) * u) / 2;
    let a = ro(cxx - hw);
    const b = a + ro(hw * 2);
    if (L && y >= L.boardY - 2 && y < L.boardY + L.boardH + 2) {
      for (const B of L.boards) {
        const ba = B.x - 2, bb = B.x + B.w + 2;
        if (bb <= a || ba >= b) continue;
        if (ba > a) rect(c, a, y, ba - a, 1, p);
        a = Math.max(a, bb);
      }
    }
    if (b > a) rect(c, a, y, b - a, 1, p);
  }
  c.fillStyle = p;
  c.fill(path);
}
/** 밤하늘 별 */
function stars(c, W, y0, y1, n, seed) {
  for (let i = 0; i < n; i++) {
    const x = Math.floor(hash(seed + i * 3) * W), y = y0 + Math.floor(hash(seed + i * 3 + 1) * (y1 - y0));
    px(c, x, y, hash(seed + i * 3 + 2) < 0.3 ? '#bfe8ff' : '#fffbe0');
  }
}
/** 뭉게구름 (art.js 와 같은 모양) */
function cloud(c, x, y, w) {
  const h = 4 + Math.floor(w / 8);
  rbox(c, x, y + 2, w, h, '#ffffff', 2);
  rbox(c, x + ro(w * 0.2), y, ro(w * 0.45), h, '#ffffff', 2);
  rbox(c, x + ro(w * 0.5), y - 2, ro(w * 0.35), h, '#ffffff', 2);
  rect(c, x + 2, y + h + 1, w - 4, 1, '#cfe6f5');
}
/** 나무 */
function tree(c, x, gy, r, col) {
  rect(c, x - 2, gy - r - 3, 4, r + 3, OUT); rect(c, x - 1, gy - r - 2, 2, r + 2, '#7a4a24');
  oval(c, x, gy - r * 2, r + 1, r + 1, OUT);
  oval(c, x, gy - r * 2, r, r, col);
  oval(c, x - r * 0.3, gy - r * 2 - r * 0.3, r * 0.5, r * 0.45, tone(col, 0.25));
  oval(c, x + r * 0.35, gy - r * 1.7, r * 0.4, r * 0.3, tone(col, -0.25));
}
/** 바닥 — 윗줄 빛 · 그 아래 그늘 · 흩뿌린 점 */
function floorBase(c, L, base, top, dot) {
  const { W, H, wallBase } = L;
  rect(c, 0, wallBase, W, H - wallBase, base);
  rect(c, 0, wallBase, W, 1, top);
  rect(c, 0, wallBase + 1, W, 1, tone(base, -0.18));
  if (dot) for (let i = 0; i < (W * (H - wallBase)) / 36; i++) rect(c, Math.floor(hash(i * 7 + W) * W), wallBase + 3 + Math.floor(hash(i * 7 + 1) * (H - wallBase - 3)), 2, 1, dot);
}
/** LED 글자(전광판) — 꺼진 점 격자 위에 켜진 글자 */
function ledText(c, s, cx, y, on, off) {
  const w = textW(s), x = ro(cx - w / 2);
  for (let j = -1; j <= 5; j++) for (let i = -1; i <= w; i++) if ((i + j) % 2 === 0) px(c, x + i, y + j, off);
  glyphs(c, s, x, y, on);
}

/* ---------- 정적인 그림 (구워 둔다) ---------- */
function paintArena(c, a, L, energy) {
  const { W, H, fy, cx, boardX, boardY, boardW, boardH, crowdTop, wallBase } = L;
  const [t1, t2] = ARENA_TEXT[a];
  switch (a) {
    case 0: { // 동네 운동장 — 맑은 낮, 나무 간판, 철망, 벤치 두 줄
      bands(c, 0, W, 0, wallBase, ['#5fb4f5', '#78c3f8', '#95d2fa', '#b4e1fc', '#d2eefe']);
      oval(c, W - 16, 12, 8, 8, '#fff3a0'); oval(c, W - 16, 12, 6, 6, '#fffbe0');
      /* 먼 아파트 */
      for (let x = -4, i = 0; x < W; i++) {
        const w = 14 + Math.floor(hash(i + 3) * 10), h = 18 + Math.floor(hash(i + 9) * 22);
        const bc = ['#c9d8f0', '#e0d4c0', '#d4e0e8', '#e8d0c8'][i % 4];
        rect(c, x, fy - 34 - h, w, h + 10, bc); rect(c, x, fy - 34 - h, w, 1, tone(bc, 0.4));
        for (let yy = fy - 31 - h; yy < fy - 36; yy += 4) for (let xx = x + 2; xx < x + w - 2; xx += 3) px(c, xx, yy, '#8aa8c8');
        x += w + 1;
      }
      for (let x = 2, i = 0; x < W + 10; x += 15 + Math.floor(hash(i + 40) * 8), i++) tree(c, x, fy - 26, 6 + Math.floor(hash(i + 50) * 3), i % 2 ? '#4caf50' : '#5cbf5c');
      /* 철망 */
      rect(c, 0, fy - 30, W, 1, '#4b5560');
      for (let x = 0; x < W; x += 2) for (let y = fy - 29; y < wallBase; y += 2) if ((x + y) % 4 === 0) px(c, x, y, '#9aa5b0');
      for (let x = 4; x < W; x += 22) { rect(c, x - 1, fy - 31, 3, 25, OUT); rect(c, x, fy - 30, 1, 24, '#7d8894'); }
      /* 벤치 두 줄 */
      for (const by of [fy - 15, fy - 8]) { rect(c, 0, by, W, 3, OUT); rect(c, 0, by, W, 1, '#e0e4ea'); rect(c, 0, by + 1, W, 1, '#aab2bc'); }
      /* 나무 간판 — 기둥 둘 + 초록 칠판 */
      for (const B of L.boards) {
        const bx = B.x, bw = B.w, bc = B.cx;
        for (const sx of [bx + 6, bx + bw - 8]) { rect(c, sx - 1, boardY + boardH, 4, fy - 30 - boardY - boardH, OUT); rect(c, sx, boardY + boardH, 2, fy - 30 - boardY - boardH, '#8d5a3b'); rect(c, sx, boardY + boardH, 1, fy - 30 - boardY - boardH, '#b07a50'); }
        frame(c, bx, boardY, bw, boardH, '#a8703c', '#2f6b3f');
        rect(c, bx + 3, boardY + 3, bw - 6, boardH - 6, pat(c, '#3a7a4a', 2));
        { const g = Math.floor((boardH - 6 - 12) / 3); ctext(c, t1, bc, boardY + 3 + g + 1, '#ffffff', 'shadow', '#1d4a2a'); ctext(c, t2, bc, boardY + 3 + g * 2 + 7, '#ffe066', 'shadow', '#1d4a2a'); }
        sprite(c, bx + 4, boardY + 4, STAR5.map((r) => r.replace(/o/g, '.')), { y: '#ffe066' });
        sprite(c, bx + bw - 9, boardY + 4, STAR5.map((r) => r.replace(/o/g, '.')), { y: '#ffe066' });
      }
      if (energy >= 1) bunting(c, 0, W, boardY - 2, 5, ['#e8423a', '#ffd23f', '#3a7be8', '#3fbf5a']);
      if (energy >= 2) bunting(c, 0, W, crowdTop - 4, 4, ['#ff7fbf', '#ffffff', '#ff8a1a']);
      /* 바닥 — 흙 운동장 + 분필 선 */
      floorBase(c, L, '#d8b47c', '#f0d29c', '#c09a64');
      rect(c, 0, wallBase - 2, W, 2, '#5cb85c'); rect(c, 0, wallBase - 2, W, 1, '#8ee08e');
      for (let x = 0; x < W; x += 3) px(c, x, fy + 3, '#ffffff');
      oval(c, cx - 0.5, fy + 1, 22, 3, '#c9a26b'); oval(c, cx - 0.5, fy + 1, 20, 2, '#e4c48c');
      break;
    }
    case 1: { // 체육관 — 크림 벽, 높은 창, 천장 등, LED 점수판, 나무 관람석, 반들반들 마룻바닥
      rect(c, 0, 0, W, wallBase, '#f0dcb4');
      for (let y = 6; y < wallBase; y += 6) rect(c, 0, y, W, 1, '#e4cda2');
      for (let x = 0, k = 0; x < W; x += 12, k++) for (let y = 6; y < wallBase; y += 12) rect(c, x + (k % 2) * 6, y + 1, 1, 5, '#e4cda2');
      /* 천장 보 + 창 */
      rect(c, 0, 0, W, 4, '#6b5a48'); rect(c, 0, 4, W, 1, OUT);
      for (let x = 3; x < W; x += 26) { obox(c, x, 7, 18, boardY - 9 > 8 ? boardY - 9 : 8, '#9fd8ff', 0, false); rect(c, x + 8, 7, 2, Math.max(8, boardY - 9), '#ffffff'); rect(c, x + 2, 9, 4, 3, '#d4f0ff'); }
      /* 펜던트 등 */
      for (let x = 14; x < W; x += 34) { rect(c, x, 5, 1, 4, OUT); rbox(c, x - 4, 9, 9, 4, OUT, 2); rect(c, x - 3, 10, 7, 2, '#c8ccd4'); rect(c, x - 2, 12, 5, 1, '#fff3a0'); }
      /* LED 점수판 */
      for (const B of L.boards) {
        const bx = B.x, bw = B.w, bc = B.cx;
        frame(c, bx, boardY, bw, boardH, '#3a4050', '#160a0a');
        { const g = Math.floor((boardH - 6 - 12) / 3); ledText(c, t1, bc, boardY + 3 + g + 1, '#ffd23f', '#3a1a10'); ledText(c, t2, bc, boardY + 3 + g * 2 + 7, '#ff5a3a', '#3a1a10'); }
        /* 학교 깃발 — 점수판 양옆에 늘어뜨림 */
        for (const [fx, fc] of [[bx - 9, '#e8423a'], [bx + bw + 3, '#3a7be8']]) {
          if (fx < 0 || fx > W - 6) continue;
          for (let j = 0; j < 14; j++) { const w = Math.max(1, 7 - Math.floor(j / 2)); rect(c, fx + Math.floor((7 - w) / 2) - 1, boardY + j, w + 2, 1, OUT); rect(c, fx + Math.floor((7 - w) / 2), boardY + j, w, 1, fc); }
          rect(c, fx - 1, boardY - 1, 9, 1, '#8d5a3b');
        }
      }
      /* 농구 골대 — 전광판이 둘일 때 그 사이 */
      if (L.boards.length > 1) { const hx = cx - 13; obox(c, hx, boardY + 2, 26, 18, '#ffffff', 0, false); rect(c, hx + 8, boardY + 9, 10, 7, '#e8423a'); rect(c, hx + 9, boardY + 10, 8, 5, '#ffffff'); rect(c, hx + 7, boardY + 21, 12, 2, '#ff7a1a'); for (let k = 0; k < 4; k++) px(c, hx + 8 + k * 3, boardY + 23 + (k % 2), '#ffffff'); }
      /* 관람석 계단 */
      const S = crowdSpec(1, L);
      const benchTop = S.rows[0] - 2;
      rect(c, 0, benchTop, W, wallBase - benchTop, '#a8814e');
      for (const ry of S.rows) { rect(c, 0, ry + 4, W, 3, OUT); rect(c, 0, ry + 4, W, 1, '#e0b070'); rect(c, 0, ry + 5, W, 1, '#c49a62'); }
      rect(c, 0, benchTop - 1, W, 1, OUT);
      if (energy >= 2) bunting(c, 0, W, boardY + boardH + 3, 3, ['#e8423a', '#ffffff', '#3a7be8']);
      /* 마룻바닥 */
      floorBase(c, L, '#d9a35f', '#f0c080', null);
      for (let y = wallBase + 3, k = 0; y < H; y += 4, k++) { rect(c, 0, y, W, 1, '#c48c4a'); for (let x = (k % 3) * 9; x < W; x += 27) rect(c, x, y - 3, 1, 3, '#c48c4a'); }
      rect(c, 0, fy + 4, W, 1, '#ff7a1a');
      rect(c, 0, wallBase + 2, W, 2, pat(c, '#f8d8a0', 2));              // 반들반들 윗빛
      break;
    }
    case 2: { // 도시 아레나 — 밤 실내, 철골 조명, 대형 화면, 계단식 관중석, 파란 매트
      bands(c, 0, W, 0, crowdTop + 6, ['#070a1c', '#0c1230', '#121a40', '#18224e']);
      truss(c, 0, W, 2);
      for (let x = 10; x < W; x += 24) lamp(c, x, 9, '#fff3a0');
      /* 대형 화면 + 줄 매달림 */
      for (const B of L.boards) {
        const bx = B.x, bw = B.w, bc = B.cx;
        for (const sx of [bx + 8, bx + bw - 9]) rect(c, sx, 8, 1, boardY - 8, '#5a6478');
        frame(c, bx, boardY, bw, boardH, '#4a5268', '#081838');
        rect(c, bx + 3, boardY + 3, bw - 6, boardH - 6, pat(c, '#0e2a5a', 2));
        { const g = Math.floor((boardH - 6 - 12) / 3); ctext(c, t1, bc, boardY + 3 + g + 1, '#ffffff', 'shadow', '#000814'); ctext(c, t2, bc, boardY + 3 + g * 2 + 7, '#4dc3ff', 'shadow', '#000814'); }
      }
      /* 좌석 — 짙은 파랑 줄무늬, 위층·아래층 사이 리본 전광판 자리 */
      rect(c, 0, crowdTop - 2, W, wallBase - crowdTop + 2, '#141c3e');
      for (let y = crowdTop + 4; y < wallBase; y += 6) rect(c, 0, y, W, 1, '#1c2650');
      const rib = crowdTop + 2 + 6 * 3;
      if (rib < fy - 30) { rect(c, 0, rib - 1, W, 6, OUT); rect(c, 0, rib, W, 4, '#0a0a14'); }
      /* 광고판 담장 */
      rect(c, 0, fy - 14, W, 9, OUT);
      rect(c, 0, fy - 13, W, 7, '#1d3f8a');
      for (let x = 2, i = 0; x < W; x += 30, i++) ptext(c, i % 2 ? 'ROPE' : 'BEAT', x + 4, fy - 12, i % 2 ? '#ffffff' : '#ffd23f', null);
      /* 파란 매트 */
      floorBase(c, L, '#1e3a8a', '#4d7ad8', null);
      rect(c, 0, wallBase + 2, W, H - wallBase - 2, '#2a52b8');
      rect(c, 0, wallBase + 2, W, H - wallBase - 2, pat(c, '#3060c8', 2));
      rect(c, 6, fy + 3, W - 12, 1, '#ffffff'); rect(c, 6, fy + 3, 1, H - fy - 3, '#ffffff'); rect(c, W - 7, fy + 3, 1, H - fy - 3, '#ffffff');
      break;
    }
    case 3: { // 네온 아레나 — 신스웨이브 하늘, 줄무늬 해, 네온 간판, 야광봉 관중, LED 바닥
      bands(c, 0, W, 0, wallBase, ['#0b0420', '#140630', '#200a44', '#2e0e58', '#3e1266', '#521470']);
      stars(c, W, 2, crowdTop, ro(W / 6), 300);
      /* 줄무늬 해 — 관중 뒤로 반쯤 */
      { const sr = clamp(ro(W * 0.18), 14, 34), scy = L.crowdTop + 12;
        const SUN = ['#ffe14d', '#ffb03a', '#ff7a3a', '#ff4a6a', '#e0308a'];
        for (let y = scy - sr; y <= scy; y++) {
          const k = (y + 0.5 - scy) / sr; if (Math.abs(k) > 1) continue;
          const hw = sr * Math.sqrt(1 - k * k), band = Math.floor(((y - (scy - sr)) / sr) * 5);
          if (band >= 2 && (y - (scy - sr)) % (7 - band) === 0) continue;   // 아래로 갈수록 굵은 틈
          rect(c, ro(cx - hw), y, ro(hw * 2), 1, SUN[Math.min(4, band)]);
        } }
      /* 네온 간판 — 분홍 관 글자 + 하늘색 관 테두리, 둘레는 디더링 빛 */
      for (const B of L.boards) {
        const bx = B.x, bw = B.w, bc = B.cx;
        { const x = bx, y = boardY, w = bw, h = boardH;
          rect(c, x - 2, y - 2, w + 4, h + 4, pat(c, '#5a1a7a', 2));
          rect(c, x, y, w, h, '#120420');
          for (const [rx, ry, rw, rh] of [[x + 1, y + 1, w - 2, 1], [x + 1, y + h - 2, w - 2, 1], [x + 1, y + 1, 1, h - 2], [x + w - 2, y + 1, 1, h - 2]]) rect(c, rx, ry, rw, rh, '#4dfcff');
          rect(c, x + 2, y + 2, w - 4, 1, '#1a6a7a'); rect(c, x + 2, y + h - 3, w - 4, 1, '#1a6a7a');
          const g = Math.floor((h - 6 - 12) / 3);
          ctext(c, t1, bc, y + 3 + g + 1, '#ff6ae0', 'outline', '#6a1a6a');
          ctext(c, t2, bc, y + 3 + g * 2 + 7, '#ffe14d', 'outline', '#6a3a1a'); }
        /* 양옆 네온 기둥 */
        for (const nx of [Math.max(28, bx - 12), Math.min(W - 30, bx + bw + 11)]) { rect(c, nx - 1, boardY, 3, wallBase - boardY - 14, '#3a0e5a'); rect(c, nx, boardY, 1, wallBase - boardY - 14, '#ff4ad8'); }
      }
      /* 관중 단 */
      rect(c, 0, fy - 13, W, 8, OUT); rect(c, 0, fy - 12, W, 6, '#1a0830');
      for (let x = 0; x < W; x += 2) px(c, x, fy - 12, '#ff4ad8');
      /* LED 바닥 판 — 격자만 굽고 빛은 움직일 때 */
      floorBase(c, L, '#14082a', '#ff4ad8', null);
      for (let y = wallBase + 2; y < H; y += 6) rect(c, 0, y, W, 1, '#2a1048');
      for (let x = 0; x < W; x += 8) rect(c, x, wallBase + 2, 1, H - wallBase - 2, '#2a1048');
      break;
    }
    default: { // 세계 선수권 — 밤 스타디움, 지붕 조명 줄, 금색 대형 전광판, 만국기, 층층 관중, 붉은 무대
      bands(c, 0, W, 0, crowdTop + 4, ['#04051a', '#080a26', '#0c1034', '#121842']);
      stars(c, W, 6, boardY, ro(W / 5), 900);
      /* 지붕 링 + 투광등 */
      rect(c, 0, 0, W, 4, '#1a1e34'); rect(c, 0, 4, W, 1, OUT);
      for (let x = 3; x < W; x += 11) { rect(c, x - 1, 1, 6, 4, OUT); rect(c, x, 2, 4, 2, '#fffbe0'); px(c, x, 2, '#ffffff'); }
      /* 전광판 — 금 틀, 양옆 트로피 */
      for (const B of L.boards) {
        const bx = B.x, bw = B.w, bc = B.cx;
        frame(c, bx, boardY, bw, boardH, '#e8a820', '#0a0e2e');
        rect(c, bx + 3, boardY + 3, bw - 6, boardH - 6, pat(c, '#141c4a', 2));
        { const g = Math.floor((boardH - 6 - 12) / 3); ctext(c, t1, bc, boardY + 3 + g + 1, '#ffffff', 'shadow', '#000000'); ctext(c, t2, bc, boardY + 3 + g * 2 + 7, '#ffd23f', 'shadow', '#5a3a00'); }
        if (bw >= 100) for (const tx of [bx + 5, bx + bw - 14]) sprite(c, tx, boardY + Math.floor(boardH / 2) - 5, TROPHY, { o: OUT, y: '#ffcc22', w: '#fff6b0' });
        for (const [sx, sy] of [[bx - 4, boardY + 2], [bx + bw - 1, boardY + 2], [bx - 4, boardY + boardH - 7], [bx + bw - 1, boardY + boardH - 7]]) sprite(c, sx, sy, STAR5, { o: OUT, y: '#ffd23f' });
      }
      /* 만국기 */
      { const fy0 = boardY + boardH + 3; let k = 0;
        for (let x = 0; x < W; x++) px(c, x, fy0 + ro(Math.sin((x / W) * Math.PI) * 3), '#8a8a9a');
        for (let x = 3; x < W - 6; x += 9, k++) {
          const yy = fy0 + ro(Math.sin(((x + 3) / W) * Math.PI) * 3) + 1;
          rect(c, x - 1, yy - 1, 8, 6, OUT);
          const FL = [['#e8423a', '#ffffff'], ['#3a7be8', '#ffffff'], ['#3fbf5a', '#ffd23f'], ['#ffd23f', '#e8423a'], ['#ffffff', '#e8423a'], ['#1d3f8a', '#e8423a'], ['#ff8a1a', '#ffffff']][k % 7];
          rect(c, x, yy, 6, 4, FL[0]);
          if (k % 3 === 0) rect(c, x, yy + 2, 6, 2, FL[1]); else if (k % 3 === 1) rect(c, x + 2, yy, 2, 4, FL[1]); else rect(c, x + 2, yy + 1, 2, 2, FL[1]);
        } }
      /* 층층 관중석 — 4줄마다 난간(금 · 빨강 띠) */
      rect(c, 0, crowdTop - 2, W, wallBase - crowdTop + 2, '#0e1434');
      const S = crowdSpec(4, L);
      S.rows.forEach((ry, i) => { if (i % 5 === 4) { rect(c, 0, ry + 4, W, 2, '#d7263d'); rect(c, 0, ry + 4, W, 1, '#ffcc22'); } });
      /* LED 담장 */
      rect(c, 0, fy - 14, W, 9, OUT);
      rect(c, 0, fy - 13, W, 7, '#5a0a18');
      for (let x = 3, i = 0; x < W; x += textW('WJRC') + 9, i++) ptext(c, 'WJRC', x, fy - 12, i % 2 ? '#ffffff' : '#ffd23f', null);
      /* 붉은 무대 + 금 테두리 */
      floorBase(c, L, '#8a1024', '#ffd23f', null);
      rect(c, 0, wallBase + 1, W, 1, '#b8860b');
      rect(c, 0, wallBase + 2, W, H - wallBase - 2, '#a8142a');
      rect(c, 0, wallBase + 2, W, H - wallBase - 2, pat(c, '#c01c34', 2));
      for (let x = 4; x < W; x += 16) sprite(c, x, fy + 6 + ((x / 16) % 2) * 6, ['.y.', 'yyy', '.y.'], { y: '#e8a820' });
      break;
    }
  }
  /* 관중 단 아래 그늘 — 무대 뒤끝을 또렷하게 */
  rect(c, 0, wallBase - 1, W, 1, OUT);
}

/* ---------- 움직이는 그림 (매 프레임) ---------- */
function moveArena(c, a, L, t, beat, energy, fever) {
  const { W, H, fy, cx, boardX, boardY, boardW, boardH, crowdTop, wallBase } = L;
  const ph = beat - Math.floor(beat);
  const on = ph < 0.3, off = ph >= 0.5 && ph < 0.8;
  const lvl = fever ? 4 : energy;
  const cyc = Math.floor(t * 6);                           // 피버 색 돌기
  const fcol = (i) => RAIN[(cyc + i) % 7];

  /* 낮 하늘의 구름 · 피버 햇살 */
  if (a === 0) {
    for (let i = 0; i < 3; i++) { const w = 18 + i * 6; cloud(c, ro(((t * (3 + i) + i * 60) % (W + 50)) - 36), boardY + boardH + 4 + i * 9, w); }
    if (fever) for (let i = 0; i < 8; i++) { const ang = (i / 8) * TAU + t * 0.8; for (let k = 11; k < 18; k += 2) px(c, ro(W - 16 + Math.cos(ang) * k), ro(12 + Math.sin(ang) * k), '#fff3a0'); }
  }
  /* 조명 빛 기둥 */
  if (a === 1 && lvl >= 2) {
    for (let i = 0; i < (fever ? 3 : 2); i++) { const x0 = 14 + i * 34; if (x0 > W) break; beam(c, x0, 13, x0 + ro(Math.sin(t * 0.9 + i * 2) * 12), wallBase, 3, 26, fever ? fcol(i) : '#fff6d0', 3, L); }
  }
  if (a === 2) {
    const n = 2 + Math.min(2, lvl);
    for (let i = 0; i < n; i++) {
      const x0 = ro((W * (i + 0.5)) / n);
      const sw = Math.sin(t * (0.6 + i * 0.13) * (fever ? 2.2 : 1) + i * 1.9) * W * 0.25;
      beam(c, x0, 15, ro(x0 + sw), wallBase, 3, 30, fever ? fcol(i * 2) : i % 2 ? '#bfe8ff' : '#fff6c0', lvl >= 3 ? 2 : 3, L);
      rect(c, x0 - 2, 14, 5, 1, fever ? fcol(i * 2) : '#fff3a0');
    }
  }
  if (a === 4) {
    const n = 3 + Math.min(3, lvl);
    for (let i = 0; i < n; i++) {
      const x0 = ro((W * (i + 0.5)) / n);
      const sw = Math.sin(t * (0.5 + i * 0.11) * (fever ? 2 : 1) + i * 2.3) * W * 0.3;
      beam(c, x0, 5, ro(x0 + sw), wallBase, 2, 26, fever ? fcol(i) : i % 3 === 1 ? '#ffe6a0' : '#fffbe0', lvl >= 3 ? 2 : 3, L);
    }
  }
  /* 네온: 레이저 · 간판 깜빡 */
  if (a === 3) {
    if (lvl >= 2) {
      const n = fever ? 6 : lvl >= 3 ? 4 : 2;
      for (let i = 0; i < n; i++) {
        const left = i % 2 === 0;
        const x0 = left ? 0 : W - 1, y0 = boardY + 2;
        const ang = Math.sin(t * (1.1 + i * 0.2) + i) * 0.5 + (left ? 0.9 : Math.PI - 0.9);
        const col = fever ? fcol(i) : i % 2 ? '#4dfcff' : '#ff4ad8';
        for (let k = 0; k < W * 1.6; k += 2) { const lx = ro(x0 + Math.cos(ang) * k), ly = ro(y0 + Math.sin(ang) * k); if (ly > wallBase || lx < 0 || lx >= W) break; if (ly < boardY + boardH + 2 && L.boards.some((B) => lx >= B.x - 2 && lx < B.x + B.w + 2)) continue; px(c, lx, ly, col); }
      }
    }
    if (Math.floor(t * 7) % 23 === 0) for (const B of L.boards) rect(c, B.x, boardY, B.w, boardH, pat(c, '#120420', 2));   // 네온 깜빡
  }
  /* 전광판 테두리 전구 — 체육관 빼고, 박에 맞춰 번갈아 */
  if (a === 2 || a === 4) {
    const bulbs = [];
    for (const B of L.boards) for (let x = B.x + 1; x < B.x + B.w - 1; x += 3) { bulbs.push([x, boardY - 2]); bulbs.push([x, boardY + boardH + 1]); }
    bulbs.forEach(([bx, by], i) => px(c, bx, by, (i + (on ? 0 : 1)) % 2 ? (fever ? fcol(i) : a === 4 ? '#fff3a0' : '#4dc3ff') : '#2a2a3a'));
  }
  /* 리본 전광판 흐르는 글자 (도시 아레나) */
  if (a === 2) {
    const rib = crowdTop + 2 + 6 * 3;
    if (rib < fy - 30) {
      const msg = 'ROPE BEAT * CROSS CHALLENGE * ', mw = textW(msg) + 1;
      const sx = -ro((t * 18) % mw);
      for (let x = sx; x < W; x += mw) glyphs(c, msg, x, rib, fever ? fcol(0) : '#ffb03a');
      rect(c, 0, rib - 1, 1, 6, OUT); rect(c, W - 1, rib - 1, 1, 6, OUT);
    }
  }

  /* 관중 — 두 무리가 박에 맞춰 번갈아 들썩, 기운이 셀수록 크게 · 팔 번쩍 */
  const amp = lvl >= 3 ? 2 : 1;
  const bobA = lvl >= 1 && on ? -amp : 0;
  const bobB = lvl >= 2 && off ? -amp : 0;
  const armsA = lvl >= 3 && on, armsB = lvl >= 4 && off;
  c.drawImage(crowdLayer(a, L, 0, armsA), 0, bobA);
  c.drawImage(crowdLayer(a, L, 1, armsB), 0, bobB);

  /* 카메라 플래시 (아레나 · 세계) */
  if (a === 2 || a === 4) {
    const S = crowdSpec(a, L);
    const n = 2 + lvl * 2;
    for (let i = 0; i < n; i++) {
      const k = Math.floor(t * 9) * 17 + i * 131;
      if (hash(k) < 0.45) continue;
      const fx = Math.floor(hash(k + 1) * W), fyy = S.rows[Math.floor(hash(k + 2) * S.rows.length)] + 1;
      px(c, fx, fyy, '#ffffff'); if (hash(k + 3) < 0.4) { px(c, fx - 1, fyy, '#bfe8ff'); px(c, fx + 1, fyy, '#bfe8ff'); px(c, fx, fyy - 1, '#bfe8ff'); px(c, fx, fyy + 1, '#bfe8ff'); }
    }
  }
  /* 네온 LED 바닥 — 박마다 다른 칸이 켜진다 */
  if (a === 3) {
    const b = Math.floor(beat);
    for (let y = wallBase + 3, r = 0; y < H; y += 6, r++) for (let x = 1, k = 0; x < W; x += 8, k++) {
      const hsh = hash(b * 977 + r * 31 + k * 7);
      if (hsh < (lvl >= 3 ? 0.22 : 0.12)) { const col = fever ? fcol(k + r) : ['#ff4ad8', '#4dfcff', '#ffe14d', '#9b5dff'][Math.floor(hsh * 40) % 4]; rect(c, x, y, 7, 5, tone(col, -0.55)); rect(c, x, y, 7, 1, tone(col, -0.2)); }
    }
  }
  /* 체육관 등 — 피버면 색이 돈다 */
  if (a === 1) for (let x = 14, i = 0; x < W; x += 34, i++) rect(c, x - 2, 12, 5, 1, fever ? fcol(i) : on && lvl >= 1 ? '#ffffff' : '#fff3a0');
  /* 무대 조명 렌즈 — 박에 깜빡 */
  if (a === 2) for (let x = 10, i = 0; x < W; x += 24, i++) rect(c, x - 2, 13, 5, 1, fever ? fcol(i) : (i % 2) === (on ? 0 : 1) ? '#ffffff' : '#fff3a0');

  /* 불꽃놀이 (세계 선수권 · 기운 3 이상) */
  if (a === 4 && lvl >= 3) {
    for (let i = 0; i < (fever ? 3 : 2); i++) {
      const per = 1.4, u = ((t + i * 0.55) % per) / per;
      const k = Math.floor((t + i * 0.55) / per) * 7 + i;
      const fx = ro(W * (0.15 + hash(k) * 0.7)), fyy = ro(boardY * 0.3 + hash(k + 1) * Math.max(4, boardY * 0.6)) + 6;
      const col = RAIN[Math.floor(hash(k + 2) * 7)];
      if (u < 0.15) { px(c, fx, ro(fyy + (1 - u / 0.15) * 20), '#fff3a0'); continue; }
      const r = 2 + (u - 0.15) * 22;
      if (u > 0.8 && Math.floor(t * 20) % 2) continue;
      for (let j = 0; j < 12; j++) { const ang = (j / 12) * TAU; px(c, ro(fx + Math.cos(ang) * r), ro(fyy + Math.sin(ang) * r + u * 3), j % 2 ? col : '#ffffff'); }
      px(c, fx, fyy, '#ffffff');
    }
  }
  /* 피버 색종이 */
  if (fever || lvl >= 3) {
    const n = fever ? ro(W / 3) : ro(W / 8);
    for (let i = 0; i < n; i++) {
      const sp = 18 + (i % 5) * 6;
      const x = ro((hash(i * 13) * W + Math.sin(t * 2 + i) * 4 + W) % W), y = ro((hash(i * 13 + 1) * H + t * sp) % (fy - 2));
      const col = RAIN[i % 7];
      if ((Math.floor(t * 8) + i) % 2) rect(c, x, y, 2, 1, col); else rect(c, x, y, 1, 2, tone(col, -0.2));
    }
  }
}
