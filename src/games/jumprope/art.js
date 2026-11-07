/**
 * 줄넘기 챔피언 — 그림. **픽셀아트(도트) 전용.** (2026-11-07, 권반장 지시로 전면 다시 그림)
 *
 * > «픽셀 아트 느낌 클래식 아케이드 게임처럼 픽셀아트 스타일로 정밀하게»
 * > «무조건 신발을 찾아서 혹은 드래곤 스트라이커 같은 픽셀아트 느낌으로»
 *
 * ## 규칙
 * · 모든 그림은 **저해상도 버퍼에 정수 좌표 한 칸 단위**로 찍는다(fillRect 만). 곡선 · 그라데이션 · 반투명 없음.
 * · 화면에는 nearest(번짐 없음)로 키운다 — 게임은 `imageSmoothingEnabled = false`, DOM 그림은 `image-rendering: pixelated`.
 * · 외곽선 1칸(진한 갈색) + 윗면 밝은 줄 + 아랫면 그늘 — 신발을 찾아서 · 드래곤 스트라이커와 같은 도트 문법.
 * · 하늘 색 띠는 계단식 + 경계 두 줄 바둑판 디더링.
 *
 * 아이 키 ≈ 44칸(발 바닥 = footY). 줄 각도 θ: 발밑 π · 머리 위 2π · sin θ < 0 이면 아이 뒤.
 * 가져올 때는 브라우저 객체를 건드리지 않는다 — document 는 함수 안에서만.
 */

import { SKINS, HAIR_COLORS, SHIRTS, PANTS, SHOES, HATS, decodeLook, DEFAULT_LOOK } from './data.js';

export const OUT = '#1b0f0a';
const TAU = Math.PI * 2;
const ro = Math.round;

export function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, ro(w));
  c.height = Math.max(1, ro(h));
  return c;
}

/* ---------- 도트 도구 ---------- */
export function rect(c, x, y, w, h, col) {
  w = ro(w); h = ro(h);
  if (w <= 0 || h <= 0) return;
  c.fillStyle = col;
  c.fillRect(ro(x), ro(y), w, h);
}
export const px = (c, x, y, col) => rect(c, x, y, 1, 1, col);
/** 타원 — 중심이 반 칸이어도 좌우가 대칭이 되게 줄마다 끝을 반올림한다 */
export function oval(c, cx, cy, rx, ry, col, maxRow = Infinity, minRow = -Infinity) {
  const y0 = Math.floor(cy - ry), y1 = Math.ceil(cy + ry);
  for (let y = y0; y <= y1; y++) {
    if (y > maxRow || y < minRow) continue;
    const dy = (y + 0.5 - cy) / ry;
    if (Math.abs(dy) > 1) continue;
    const hw = rx * Math.sqrt(1 - dy * dy);
    const a = ro(cx - hw), b = ro(cx + hw);
    if (b > a) rect(c, a, y, b - a, 1, col);
  }
}
/** 모서리를 cut 칸 깎은 상자 */
export function rbox(c, x, y, w, h, col, cut = 1) {
  for (let i = 0; i < h; i++) {
    const ins = Math.max(0, cut - Math.min(i, h - 1 - i));
    rect(c, x + ins, y + i, w - ins * 2, 1, col);
  }
}
/** 외곽선 + 면 + 윗줄 빛 + 아랫줄 그늘 */
export function obox(c, x, y, w, h, col, cut = 1, hi = true) {
  rbox(c, x - 1, y - 1, w + 2, h + 2, OUT, cut + 1);
  rbox(c, x, y, w, h, col, cut);
  if (hi && h > 2) {
    rect(c, x + cut, y, w - cut * 2, 1, tone(col, 0.35));
    rect(c, x + cut, y + h - 1, w - cut * 2, 1, tone(col, -0.28));
  }
}
/** 굵은 선(붓 b칸) */
export function line(c, x0, y0, x1, y1, b, col) {
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    rect(c, Math.floor(x0 + (x1 - x0) * t - (b - 1) / 2), Math.floor(y0 + (y1 - y0) * t - (b - 1) / 2), b, b, col);
  }
}
/** 색 밝게(+) · 어둡게(−) — 언제나 #rrggbb */
const toneCache = new Map();
export function tone(hex, k) {
  const key = hex + k;
  if (toneCache.has(key)) return toneCache.get(key);
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.min(255, ro(k < 0 ? v * (1 + k) : v + (255 - v) * k)));
  const out = '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => f(v).toString(16).padStart(2, '0')).join('');
  toneCache.set(key, out);
  return out;
}
/** 문자열 도트 그림: '.' 빈칸, 나머지는 pal[글자] */
export function sprite(c, x, y, rows, pal, sc = 1) {
  for (let j = 0; j < rows.length; j++) {
    const r = rows[j];
    for (let i = 0; i < r.length; i++) {
      const ch = r[i];
      if (ch !== '.' && pal[ch]) rect(c, x + i * sc, y + j * sc, sc, sc, pal[ch]);
    }
  }
}
/** 먼 언덕 — 두 겹, 꼭대기는 바둑판으로 섞는다 (하늘을 채운다) */
function hills(c, W, gy, top, col, amp, seed) {
  for (let x = 0; x < W; x++) {
    const h = Math.round(top + Math.sin(x * 0.035 + seed) * amp + Math.sin(x * 0.09 + seed * 2) * amp * 0.35);
    rect(c, x, gy - h, 1, h, col);
    if (x % 2 === 0) px(c, x, gy - h - 1, col);
    px(c, x, gy - h, tone(col, 0.18));
  }
}

/* ---------- 작은 도트 그림 ---------- */
export const SPR = {
  heart: ['.oo.oo.', 'orrorro', 'orwrrro', 'orrrrro', '.orrro.', '..oro..', '...o...'],
  heartE: ['.oo.oo.', 'o..o..o', 'o.....o', 'o.....o', '.o...o.', '..o.o..', '...o...'],
  star5: ['..o..', '.oyo.', 'oyyyo', '.oyo.', 'o.o.o'],
  starS: ['..y..', '.yyy.', 'yyyyy', '.yyy.', 'y...y'],
  spark: ['.w.', 'www', '.w.'],
  sparkL: ['...w...', '...w...', '..www..', 'wwwwwww', '..www..', '...w...', '...w...'],
  heartS: ['rr.rr', 'rrrrr', '.rrr.', '..r..'],
  note: ['..oo', '..o.', '..o.', 'ooo.', 'oo..'],
  coin: ['..ooooo..', '.oyyyyyo.', 'oyywwyyyo', 'oywyyyyyo', 'oyyyyyydo', 'oyyyyyydo', 'oyyyyyydo', '.oyyyddo.', '..ooooo..'],
};

/* ---------- 아이 ---------- */
function kidPal(look) {
  const sk = SKINS[look.skin] || SKINS[0];
  const hc = (HAIR_COLORS[look.hairColor] || HAIR_COLORS[0]).c;
  const sh = SHIRTS[look.shirt] || SHIRTS[0];
  const pa = PANTS[look.pants] || PANTS[0];
  const so = SHOES[look.shoes] || SHOES[0];
  const ha = HATS[look.hat] || HATS[0];
  return {
    skin: sk.c, skinS: sk.s, hair: hc, hairS: tone(hc, -0.35), hairL: tone(hc, 0.3),
    shirt: sh.c, shirtS: tone(sh.c, -0.3), shirtL: tone(sh.c, 0.35), shirt2: sh.c2 || '#ffffff', shirtP: sh.p,
    pants: pa.c, pantsS: tone(pa.c, -0.3), pants2: pa.c2, pantsP: pa.p,
    shoe: so.c, shoeS: so.s, shoeFx: so.fx, hat: ha.c || '#e8423a',
  };
}

/** 손 위치(아이 기준) — 줄 각도에 맞춰 작은 원을 그린다 */
function handOff(theta, drop, st, t) {
  if (st === 'cheer') { const w = (Math.floor(t * 8) % 2); return { l: { x: -12 - w, y: -42 + drop }, r: { x: 11 + w, y: -42 + drop } }; }
  if (st === 'trip' || st === 'sit') return { l: { x: -11, y: -6 }, r: { x: 10, y: -6 } };
  const dy = ro(-Math.cos(theta) * 2), dx = ro(Math.sin(theta));
  return { l: { x: -12 - dx, y: -14 + drop + dy }, r: { x: 11 + dx, y: -14 + drop + dy } };
}
/** 그리기 전에 손 위치만 (줄을 아이 뒤에 먼저 그리려고) — spin 은 'spin' 포즈에만 쓴다(ROPE BEAT 추가) */
export function kidHands(theta, x, footY, lift = 0, crouch = 0, state = 'stand', t = 0, spin = 0) {
  if (BEAT_SET.has(state)) return beatHands(theta, x, footY, lift, state, t, spin);
  const sit = state === 'trip' || state === 'sit';
  const drop = sit ? 8 : crouch > 0.5 ? 2 : 0;
  const h = handOff(theta, drop, state, t);
  const fy = ro(footY - lift);
  const X = ro(x);
  return { l: { x: X + h.l.x, y: fy + h.l.y }, r: { x: X + h.r.x, y: fy + h.r.y } };
}

/**
 * 아이 한 명 (배율 없음 — 버퍼 한 칸 = 도트 한 칸)
 * @param {{lift?:number, crouch?:number, tuck?:number, state?:string, theta?:number, t?:number, mouth?:string}} pose
 */
export function drawKid(c, xIn, footY, lookIn, pose = {}) {
  if (BEAT_SET.has(pose.state)) return drawKidBeat(c, xIn, footY, lookIn, pose);   // ROPE BEAT 기술 포즈 (아래 따로)
  const look = lookIn || DEFAULT_LOOK;
  const P = kidPal(look);
  const st = pose.state || 'stand';
  const t = pose.t || 0;
  const x = ro(xIn);
  const fy = ro(footY - (pose.lift || 0));
  const sit = st === 'trip' || st === 'sit';
  const drop = sit ? 8 : (pose.crouch || 0) > 0.5 ? 2 : 0;
  const tuck = !sit && (pose.tuck || 0) > 0.3;
  const theta = pose.theta ?? Math.PI;
  const cy = fy - 31 + drop;          // 머리 가운데 줄
  const cx = x - 0.5;
  const mk = look.mask | 0;           // 가면 (콤보 선물) — 0 이면 아래 가면 줄은 하나도 안 탄다

  /* 로켓 운동화 불꽃 */
  if (P.shoeFx === 'rocket' && (pose.lift || 0) > 2) {
    const f = Math.floor(t * 20) % 2;
    for (const sx of [-6, 4]) { rect(c, x + sx, fy - (tuck ? 2 : 0), 3, 3 + f, '#ff9a1a'); rect(c, x + sx + 1, fy - (tuck ? 2 : 0), 1, 2 + f, '#fff3a0'); }
  }

  if (mk) maskBehind(c, mk, x, cy, t, 'f', 0);
  drawHairBack(c, look.hair, P, x, cy, t, pose.lift || 0);

  /* 다리 · 신발 */
  const legC = P.pantsP === 'long' ? P.pants : P.skin;
  const legS = P.pantsP === 'long' ? P.pantsS : P.skinS;
  if (sit) {
    for (const s of [-1, 1]) {
      const lx = s < 0 ? x - 14 : x + 6;
      rect(c, lx - 1, fy - 5, 10, 5, OUT);
      rect(c, lx, fy - 4, 8, 3, legC);
      rect(c, lx, fy - 2, 8, 1, legS);
      const shx = s < 0 ? x - 19 : x + 14;
      obox(c, shx, fy - 6, 5, 5, P.shoe, 1);
      rect(c, shx, fy - 2, 5, 1, P.shoeS);
    }
  } else {
    const up = tuck ? 3 : 0;
    const legH = tuck ? 3 : 5 - drop;
    for (const s of [-1, 1]) {
      const lx = s < 0 ? x - 6 - (tuck ? 1 : 0) : x + 3 + (tuck ? 1 : 0);
      rect(c, lx - 1, fy - 4 - legH - up, 5, legH + 1, OUT);
      rect(c, lx, fy - 4 - legH - up + 0, 3, legH, legC);
      rect(c, lx + (s < 0 ? 2 : 0), fy - 4 - legH - up, 1, legH, legS);
      if (P.pantsP === 'long' && P.pants2) rect(c, lx + 1, fy - 4 - legH - up, 1, legH, P.pants2);
      const sx = s < 0 ? x - 9 - (tuck ? 1 : 0) : x + 1 + (tuck ? 1 : 0);
      rbox(c, sx, fy - 4 - up, 8, 4, OUT, 1);
      rect(c, sx + 1, fy - 3 - up, 6, 2, P.shoe);
      rect(c, sx + (s < 0 ? 1 : 4), fy - 3 - up, 2, 1, tone(P.shoe, 0.45));
      rect(c, sx + 1, fy - 2 - up, 6, 1, P.shoeS);
      if (P.shoeFx === 'star') px(c, sx + 3, fy - 3 - up, '#ffe066');
      if (P.shoeFx === 'spark' && (Math.floor(t * 5) + s) % 3 === 0) px(c, sx + (s < 0 ? 0 : 7), fy - 5 - up, '#ffffff');
    }
  }

  /* 아래옷 */
  const hy = fy - 13 + drop;
  if (P.pantsP === 'skirt' || P.pantsP === 'rainbow') {
    const RB = ['#ff4d4d', '#ffa64d', '#ffe14d', '#4dd27a', '#4d9cff', '#a64dff'];
    for (let i = 0; i < 6; i++) {
      const w = 14 + Math.floor(i * 0.8) * 2;
      rect(c, x - w / 2 - 1, hy + i, w + 2, 1, OUT);
    }
    for (let i = 0; i < 5; i++) {
      const w = 14 + Math.floor(i * 0.8) * 2;
      if (P.pantsP === 'rainbow') { for (let k = 0; k < w; k++) px(c, x - w / 2 + k, hy + i, RB[Math.floor((k / w) * 6)]); }
      else rect(c, x - w / 2, hy + i, w, 1, i === 4 ? P.pantsS : P.pants);
    }
  } else {
    obox(c, x - 7, hy, 14, P.pantsP === 'long' ? 3 : 4, P.pants, 1, false);
    rect(c, x - 7, hy + (P.pantsP === 'long' ? 2 : 3), 14, 1, P.pantsS);
    rect(c, x - 1, hy + 2, 1, 2, OUT);
  }

  /* 몸통 */
  const by = fy - 22 + drop;
  rbox(c, x - 8, by, 16, 11, OUT, 2);
  rbox(c, x - 7, by + 1, 14, 9, P.shirt, 1);
  rect(c, x - 5, by + 1, 9, 1, P.shirtL);
  rect(c, x + 5, by + 2, 1, 7, P.shirtS);
  rect(c, x - 7, by + 9, 14, 1, P.shirtS);
  shirtPattern(c, P, x, by);

  /* 팔 */
  const H = handOff(theta, drop, st, t);
  for (const s of [-1, 1]) {
    const h = s < 0 ? H.l : H.r;
    const sx = s < 0 ? x - 8 : x + 7, sy = by + 2;
    const hx = x + h.x, hyy = fy + h.y;
    line(c, sx, sy, hx, hyy, 4, OUT);
  }
  for (const s of [-1, 1]) {
    const h = s < 0 ? H.l : H.r;
    const sx = s < 0 ? x - 8 : x + 7, sy = by + 2;
    const hx = x + h.x, hyy = fy + h.y;
    const mx = sx + (hx - sx) * 0.45, my = sy + (hyy - sy) * 0.45;
    line(c, sx, sy, mx, my, 2, P.shirt);
    line(c, mx, my, hx, hyy, 2, P.skin);
    rect(c, hx - 1, hyy - 1, 3, 3, OUT);
    rect(c, hx, hyy, 2, 2, P.skin);
  }

  /* 머리 */
  oval(c, cx, cy, 11, 10, OUT);
  oval(c, cx, cy, 10, 9, P.skinS);
  oval(c, cx, cy - 0.7, 9.6, 8.4, P.skin);
  rect(c, x - 9, cy + 3, 2, 1, '#ff8fa3');
  rect(c, x + 7, cy + 3, 2, 1, '#ff8fa3');
  drawFace(c, look.eyes, x, cy, st, pose.mouth, t, pose.lift || 0);
  if (!(mk && MASK_COWL.has(mk))) drawHairFront(c, look.hair, P, x, cy);
  if (mk) maskFace(c, mk, x, cy, t, st, 'f', 0);
  if (!(mk && MASK_NOHAT.has(mk))) drawHat(c, look.hat, P, x, cy, t);
  if (mk) maskTop(c, mk, x, cy, t, 'f', 0);

  if (st === 'trip') {
    for (let i = 0; i < 3; i++) {
      const a = t * 5 + (i * TAU) / 3;
      sprite(c, ro(x + Math.cos(a) * 12) - 2, ro(cy - 14 + Math.sin(a) * 3) - 2, SPR.star5, { o: OUT, y: '#ffe066' });
    }
  }
  return { l: { x: x + H.l.x, y: fy + H.l.y }, r: { x: x + H.r.x, y: fy + H.r.y } };
}

function shirtPattern(c, P, x, by) {
  const c2 = P.shirt2;
  switch (P.shirtP) {
    case 'stripe': rect(c, x - 7, by + 3, 14, 1, c2); rect(c, x - 7, by + 6, 14, 1, c2); break;
    case 'star': sprite(c, x - 3, by + 2, ['..y..', '.yyy.', 'yyyyy', '.yyy.', 'y...y'], { y: c2 }); break;
    case 'heart': sprite(c, x - 3, by + 3, ['rr.rr', 'rrrrr', '.rrr.', '..r..'], { r: c2 }); break;
    case 'sport': rect(c, x - 7, by + 1, 1, 8, c2); rect(c, x + 6, by + 1, 1, 8, c2); rect(c, x - 2, by + 1, 4, 1, c2); break;
    case 'number': sprite(c, x - 2, by + 2, ['www', '..w', '.w.', '.w.', '.w.'], { w: c2 }); break;
    default: break;
  }
}

function drawFace(c, eyes, x, cy, st, mouth, t, lift) {
  const E = '#1b0f0a', W = '#ffffff';
  const ey = cy - 2;
  const blink = st !== 'trip' && (t % 3.4) < 0.12;
  const dot = (ex, big) => {
    if (blink) { rect(c, ex, ey + 1, 2, 1, E); return; }
    if (big) { rect(c, ex - 1, ey - 1, 3, 4, E); px(c, ex + 1, ey - 1, W); px(c, ex - 1, ey + 1, W); }
    else { rect(c, ex, ey, 2, 3, E); px(c, ex + 1, ey, W); }
  };
  const arc = (ex) => { px(c, ex - 1, ey + 2, E); rect(c, ex, ey + 1, 2, 1, E); px(c, ex + 2, ey + 2, E); };
  if (st === 'trip') {
    for (const ex of [x - 6, x + 4]) { px(c, ex - 1, ey, E); px(c, ex + 1, ey, E); px(c, ex, ey + 1, E); px(c, ex - 1, ey + 2, E); px(c, ex + 1, ey + 2, E); }
  } else if (eyes === 1 || st === 'cheer') { arc(x - 6); arc(x + 4); }
  else if (eyes === 2) { dot(x - 6); arc(x + 4); }
  else if (eyes === 3) { dot(x - 6, true); dot(x + 5, true); }
  else { dot(x - 6); dot(x + 4); }
  const m = mouth || (st === 'trip' ? 'sad' : st === 'cheer' ? 'grin' : lift > 10 ? 'o' : 'smile');
  const my = cy + 4;
  const M = '#7a2a1a';
  if (m === 'o') { rect(c, x - 1, my, 2, 2, M); }
  else if (m === 'sad') { rect(c, x - 1, my, 2, 1, M); px(c, x - 2, my + 1, M); px(c, x + 1, my + 1, M); }
  else if (m === 'grin') { rect(c, x - 3, my, 6, 1, M); rect(c, x - 2, my + 1, 4, 1, '#d9485a'); rect(c, x - 2, my, 4, 1, W); }
  else { px(c, x - 2, my, M); px(c, x + 1, my, M); rect(c, x - 1, my + 1, 2, 1, M); }
}

function drawHairBack(c, style, P, x, cy, t, lift) {
  if (style === 1) { // 단발 — 얼굴 뒤로 내려온다
    rbox(c, x - 12, cy - 9, 23, 17, OUT, 3);
    rbox(c, x - 11, cy - 8, 21, 15, P.hair, 3);
    rect(c, x - 11, cy + 5, 21, 1, P.hairS);
  } else if (style === 2) { // 양갈래
    const sw = (Math.floor(t * 6) % 2) + Math.min(2, Math.floor(lift / 6));
    for (const s of [-1, 1]) {
      const px0 = s < 0 ? x - 15 : x + 10;
      oval(c, px0 + 2.5, cy + 2 - sw, 4, 5, OUT);
      oval(c, px0 + 2.5, cy + 2 - sw, 3, 4, P.hair);
      rect(c, px0 + 1, cy - 1 - sw, 2, 1, P.hairL);
      rect(c, s < 0 ? x - 12 : x + 10, cy - 4, 2, 2, '#ff4f8b');
    }
  } else if (style === 3) { // 포니테일
    const sw = (Math.floor(t * 5) % 2) - Math.min(3, Math.floor(lift / 5));
    rbox(c, x + 7, cy - 7 + sw, 7, 15, OUT, 2);
    rbox(c, x + 8, cy - 6 + sw, 5, 13, P.hair, 2);
    rect(c, x + 12, cy - 4 + sw, 1, 9, P.hairS);
    rect(c, x + 7, cy - 6, 2, 2, '#3a7be8');
  }
}

function drawHairFront(c, style, P, x, cy) {
  const cx = x - 0.5;
  if (style === 5) { // 뾰족
    const spikes = [[-10, 5], [-6, 8], [-1, 9], [4, 8], [8, 5]];
    for (const [sx, h] of spikes) {
      for (let i = 0; i < h; i++) { const w = Math.max(1, Math.round((h - i) * 0.7)); rect(c, x + sx - w / 2 - 1, cy - 8 - i, w + 2, 1, OUT); }
    }
    for (const [sx, h] of spikes) {
      for (let i = 0; i < h - 1; i++) { const w = Math.max(1, Math.round((h - i) * 0.7) - 1); rect(c, x + sx - w / 2, cy - 8 - i, w, 1, P.hair); }
    }
  }
  /* 정수리 덮개 */
  oval(c, cx, cy - 1, 11.5, 10.5, OUT, cy - 4);
  oval(c, cx, cy - 1, 10.5, 9.5, P.hair, cy - 5);
  oval(c, cx - 2, cy - 5, 5, 3, P.hairL, cy - 7, cy - 9);
  if (style === 4) { // 곱슬 — 정수리에 동글동글
    for (let i = 0; i < 7; i++) {
      const a = Math.PI + 0.25 + (i * (Math.PI - 0.5)) / 6;
      const bx = cx + Math.cos(a) * 10, byy = cy - 3 + Math.sin(a) * 9;
      oval(c, bx, byy, 3.4, 3.4, OUT); oval(c, bx, byy, 2.4, 2.4, P.hair);
      px(c, ro(bx) - 1, ro(byy) - 1, P.hairL);
    }
  }
  /* 앞머리 — 들쭉날쭉한 끝 */
  const fr = [1, 2, 2, 1, 3, 2, 1, 2, 3, 2, 1, 2, 2, 1, 2, 3, 2, 1];
  for (let i = 0; i < 18; i++) {
    const col = x - 9 + i;
    const d = fr[i] + (style === 1 ? 1 : 0);
    rect(c, col, cy - 5, 1, d + 1, OUT);
    rect(c, col, cy - 5, 1, d, P.hair);
  }
  /* 옆머리 */
  const side = style === 1 ? 9 : 4;
  for (const s of [-1, 1]) {
    const sx = s < 0 ? x - 11 : x + 9;
    rect(c, sx, cy - 5, 2, side + 1, OUT);
    rect(c, sx + (s < 0 ? 1 : 0), cy - 5, 1, side, P.hair);
  }
}

function drawHat(c, idx, P, x, cy, t) {
  if (!idx) return;
  const h = P.hat, hS = tone(h, -0.3), hL = tone(h, 0.35);
  const cx = x - 0.5;
  switch (idx) {
    case 1: { // 야구 모자 — 둥근 머리 + 오른쪽 챙
      oval(c, cx, cy - 4, 12, 9, OUT, cy - 4);
      oval(c, cx, cy - 4, 11, 8, h, cy - 5);
      oval(c, cx - 3, cy - 8, 4, 2, hL, cy - 8, cy - 10);
      rect(c, x - 11, cy - 5, 22, 2, OUT);
      rect(c, x - 10, cy - 5, 20, 1, hS);
      rbox(c, x + 6, cy - 6, 10, 4, OUT, 1);
      rect(c, x + 7, cy - 5, 8, 2, hS);
      rect(c, x - 1, cy - 13, 2, 1, '#ffffff');
      break;
    }
    case 2: // 헤드밴드
      rect(c, x - 11, cy - 7, 22, 4, OUT);
      rect(c, x - 10, cy - 6, 20, 2, h);
      rect(c, x - 10, cy - 5, 20, 1, '#e8423a');
      break;
    case 3: // 리본
      sprite(c, x + 3, cy - 13, ['oo...oo', 'orro.oro'.slice(0, 7), 'orrrorrro'.slice(0, 7), 'orrrorr', 'oro.oro', 'oo...oo'], { o: OUT, r: h });
      sprite(c, x + 3, cy - 13, ['oo...oo', 'orroorro', 'orrrrrro', 'orroorro', 'oo..oo..'], { o: OUT, r: h });
      px(c, x + 6, cy - 11, hS); px(c, x + 7, cy - 11, hS);
      break;
    case 4: // 비니
      oval(c, cx, cy - 4, 12, 11, OUT, cy - 3);
      oval(c, cx, cy - 4, 11, 10, h, cy - 4);
      for (let k = x - 9; k < x + 9; k += 3) rect(c, k, cy - 12, 1, 6, hS);
      rect(c, x - 12, cy - 6, 24, 4, OUT);
      rect(c, x - 11, cy - 5, 22, 2, hS);
      oval(c, cx, cy - 15, 3, 3, OUT); oval(c, cx, cy - 15, 2, 2, '#ffffff');
      break;
    case 5: // 꽃핀
      sprite(c, x - 11, cy - 10, ['.oyo.', 'oyyyo', 'yyryy', 'oyyyo', '.oyo.'], { o: OUT, y: h, r: '#ff7f50' });
      break;
    case 6: // 고양이 귀
    case 7: { // 토끼 귀
      for (const s of [-1, 1]) {
        if (idx === 6) {
          const ex = s < 0 ? x - 10 : x + 4;
          sprite(c, ex, cy - 15, s < 0
            ? ['o.....', 'oo....', 'opo...', 'oppo..', 'opppo.', 'oooooo']
            : ['.....o', '....oo', '...opo', '..oppo', '.opppo', 'oooooo'], { o: OUT, p: '#ffb3c6' });
          for (let i = 1; i < 5; i++) { const w = i; rect(c, s < 0 ? ex + 1 : ex + 5 - w, cy - 15 + i, w, 1, h); }
          rect(c, s < 0 ? ex + 1 : ex + 3, cy - 12, 2, 2, '#ffb3c6');
        } else {
          const ex = s < 0 ? x - 6 : x + 2;
          oval(c, ex + 1.5, cy - 15, 3, 7, OUT);
          oval(c, ex + 1.5, cy - 15, 2, 6, h);
          rect(c, ex + 1, cy - 19, 1, 7, '#ffb3c6');
        }
      }
      break;
    }
    case 8: // 왕관
      sprite(c, x - 8, cy - 16, [
        'o.....o.....o..', 'oo...ooo...oo..', 'oyo.oyyyo.oyo..', 'oyyoyyyyyoyyo..', 'oyyyyrybyyggyo.', 'oyyyyyyyyyyyyo.', 'oooooooooooooo.',
      ], { o: OUT, y: h, r: '#e8423a', b: '#3a7be8', g: '#3fbf5a' });
      break;
    default: break;
  }
}

/* ---------- 가면 — 콤보 기록 선물 (2026-11-07) ---------- */
/**
 * look.mask 1~7 = 눈복면 · 마스크 · 얼굴복면 · 박쥐 가면 · 강철 가면 · 무지개 가면 · 최종보스 가면 (data.js MASKS).
 * 세 겹으로 그린다 —
 *  · maskBehind : 아이보다 먼저(뒤) — 머리 뒤로 펄럭이는 끈 · 무지개 리본 · 최종보스 오라
 *  · maskFace   : 얼굴 · 앞머리 위, 모자 아래 — 가면 본체. 눈구멍은 비워 둬서 원래 눈(깜빡 · 윙크 · 넘어짐 ×)이 그대로 보인다
 *  · maskTop    : 모자 위 — 뿔 · 왕관 · 반짝이
 * view 'f' 정면 · 's' 옆(d 1 = 오른쪽을 봄 · −1 = 왼쪽) · 'b' 뒤. 가면 0 이면 셋 다 부르지 않는다(예전 그림 그대로).
 * 박쥐 가면은 머리를 덮는 두건이라 앞머리 · 모자를 그리지 않고, 최종보스 가면은 왕관이 모자 자리를 쓴다.
 * 실존 영웅 디자인 · 로고는 쓰지 않는다 — 박쥐 귀 반가면 · 빨강 금 강철 얼굴판 모두 이안오락실 오리지널.
 * 정면 그림의 칸: «머리 축» 대칭(sym mid) = 머리 가운데 칸 x−1 · «얼굴 축» 대칭(sym) = 두 눈 사이 x−½.
 */
const MASK_COWL = new Set([4]);
const MASK_NOHAT = new Set([4, 7]);
const MASK_RB = ['#ff4d4d', '#ffa64d', '#ffe14d', '#4dd27a', '#4d9cff', '#a64dff'];
const mod = (a, n) => ((a % n) + n) % n;
const step12 = (t) => Math.floor(t * 12) / 12;        // 도트 애니메이션 — 초당 12장으로 끊는다

/** 문자열 도트 — pal 값이 함수면 (x, y) 로 색을 고른다(흐르는 무지개 · 반짝임). flip 이면 x0 에서 왼쪽으로 찍는다(옆모습 뒤집기) */
function mspr(c, x0, y0, rows, pal, flip = false) {
  for (let j = 0; j < rows.length; j++) {
    const r = rows[j];
    for (let i = 0; i < r.length; i++) {
      const v = pal[r[i]];
      if (!v) continue;
      const xx = flip ? x0 - i : x0 + i, yy = y0 + j;
      rect(c, xx, yy, 1, 1, typeof v === 'function' ? v(xx, yy) : v);
    }
  }
}
/** 왼쪽 반쪽 → 좌우 대칭 한 줄. mid 면 마지막 글자가 가운데 칸, 아니면 반쪽끼리 맞붙는다. sh: 오른쪽(그늘) 쪽 글자 바꾸기 */
function sym(rows, mid, sh = {}) {
  return rows.map((s) => s + [...(mid ? s.slice(0, -1) : s)].reverse().map((ch) => sh[ch] || ch).join(''));
}
/** 머리를 두르는 띠 (cy 기준 r0~r1 줄) — 머리보다 한 칸 굵게 감긴다. 정면 · 옆 · 뒤 모두 같은 모양 */
function headBand(c, x, cy, r0, r1, col, hi, lo) {
  const cx = x - 0.5;
  oval(c, cx, cy, 12, 11, OUT, cy + r1 + 1, cy + r0 - 1);
  oval(c, cx, cy, 11, 10, col, cy + r1, cy + r0);
  if (hi) oval(c, cx, cy, 11, 10, hi, cy + r0, cy + r0);
  if (lo && r1 > r0) oval(c, cx, cy, 11, 10, lo, cy + r1, cy + r1);
}
/** 머리를 덮는 두건 — 열마다 아랫단이 다르다. bot(k) = 그 열의 마지막 줄(cy 기준), K(xx) = 화면 칸 → 보는 쪽 기준 칸 */
function hood(c, x, cy, bot, col, K) {
  const cx = x - 0.5;
  for (const [rx, ry, cc, ex] of [[11.5, 10.5, OUT, 1], [10.5, 9.5, col, 0]]) {
    for (let y = cy - 12; y <= cy + 8; y++) {
      const dy = (y + 0.5 - (cy - 1)) / ry;
      if (Math.abs(dy) > 1) continue;
      const hw = rx * Math.sqrt(1 - dy * dy);
      for (let xx = ro(cx - hw), b = ro(cx + hw); xx < b; xx++) if (y - cy <= bot(K(xx)) + ex) px(c, xx, y, cc);
    }
  }
}
/** 펄럭이는 천 끈 — (x0, y0) 에서 dir 쪽으로 len 칸. 끝으로 갈수록 크게 흔들리고 droop 만큼 처진다. col 이 함수면 마디 번호로 색 */
function clothTail(c, x0, y0, len, dir, ph, t, col, colD, droop = 0, th = 2) {
  const f = step12(t);
  const pts = [];
  for (let i = 0; i <= len; i++) {
    const k = i / len;
    pts.push([x0 + dir * i, y0 + ro(Math.sin(f * 9 - i * 0.75 + ph) * 1.7 * k + droop * k * k), i >= len - 1 ? Math.max(1, th - 1) : th]);
  }
  for (const [xx, yy, w] of pts) rect(c, xx, yy - 1, 1, w + 2, OUT);
  const [ex, ey, ew] = pts[len];
  rect(c, ex + dir, ey, 1, ew, OUT);
  pts.forEach(([xx, yy, w], i) => {
    rect(c, xx, yy, 1, w, typeof col === 'function' ? col(i) : col);
    if (w > 1) px(c, xx, yy + w - 1, typeof colD === 'function' ? colD(i) : colD);
  });
}
/** 반짝이 하나 — ph 0~0.5 동안 점 → 십자 → 큰 별 → 십자 → 점, 나머지는 쉰다 */
function twinkle(c, x, y, ph, col = '#ffffff') {
  if (!(ph >= 0 && ph < 0.5)) return;
  const s = ph < 0.1 || ph >= 0.4 ? 0 : ph < 0.2 || ph >= 0.3 ? 1 : 2;
  if (s === 0) px(c, x, y, col);
  else if (s === 1) sprite(c, x - 1, y - 1, SPR.spark, { w: col });
  else sprite(c, x - 3, y - 3, SPR.sparkL, { w: col });
}

/* 팔레트 */
const PM1 = { o: OUT, l: '#ff6b6b', r: '#d92b3a', d: '#8e1624' };                                    // 눈복면 — 빨간 천
const PM2 = { o: OUT, l: '#5a78d8', n: '#2c3f8f', d: '#1a2660', w: '#ffffff', k: '#b0203a' };        // 마스크 — 남색 천 · 상어 이빨
const PM3 = { o: OUT, c: '#30334a', L: '#4d5272', k: '#1d1f2e', B: '#ff6b6b', b: '#d7263d', p: '#8e1624' };   // 얼굴복면
const PM4 = { o: OUT, k: '#24212f', d: '#14121c', m: '#3b3650', h: '#6c6590', j: '#57507a' };          // 박쥐 가면 — 광택 검정
const PM4D = { o: OUT, k: '#14121c', d: '#0c0b12', m: '#24212f', h: '#3b3650', j: '#2e2a3d' };         // 먼 쪽 귀(그늘)
const PM5 = { o: OUT, R: '#c8202e', r: '#7c101b', q: '#ff5a5a', Q: '#ffd6d6', G: '#ffc93c', g: '#b8860b', y: '#fff09a', n: '#0d3a4a' };   // 강철 가면
const PM7 = { o: OUT, K: '#2a1533', k: '#170b1d', m: '#553070', n: '#7d4a9e', G: '#ffcf3f', g: '#b07a10', y: '#fff3a0', R: '#e0103a', r: '#ff8aa0', b: '#3a7bff', e: '#2fd27a', h: '#f6efe0', B: '#d8c6a3', s: '#9c8462' };

/* ① 눈복면 — 정면 (x−12, cy−4) · 옆 (k −14, cy−4) */
const M1F = [
  '.ooooooooooooooooooooo.',
  'ollllddddllllllddddlllo',
  'orrrd....drrrrd....drro',
  'ordrd....drlrrd....drdo',
  'orrrd....drrrrd....drro',
  'oddddddddddoodddddddddo',
  '.oooooooooo..ooooooooo.',
];
const M1S = [
  '..ooooooooooooooooooooooo.',
  '..olllllllllllllll....llo.',
  '..orrrrrrrrrrrrrrd....dro.',
  '..ordrrrrrrrrrrrrd....dro.',
  '..oddddddddddddddd....ddo.',
  '..oooooooooooooooooooooo..',
];
const KNOT = ['.oo.', 'olro', 'orro', 'odro', 'oddo', '.oo.'];

/* ② 마스크 — 정면 (x−11, cy) · 옆 (k −4, cy) */
const M2F = [
  '........ooooo........',
  'ooooooooolllooooooooo',
  'ollllllllnnnllllllllo',
  'onnonnnnnnnnnnnnnonno',
  '.onnooooooooooooonno.',
  '.oonowkwkwkwkwkwonoo.',
  '..oonowkwkwkwkwonoo..',
  '...oonooooooooonoo...',
  '.....ooddddddddoo....',
];
const M2S = [
  '.ooo........ooo.',
  '.nnnoooooooolllo',
  '.oooolllllllno..',
  '....onnnnnnnno..',
  '....onnoooooo...',
  '....onnowkwko...',
  '....onnnowoo....',
  '.....onnooo.....',
  '.....odoo.......',
];

/* ③ 얼굴복면 — 정면 (x−12, cy−8) · 옆 (k −1, cy−3) */
const M3F = [
  '...ooooooooooooooooo...',
  '..oBBBBBBBBBBBBBBBBBo..',
  '.obbbbbbbbbbbbbbbbbbbo.',
  '.opppppppppppppppppppo.',
  '.ooooooooooooooooooooo.',
  '.okkkkkkkkkkkkkkkkkkko.',
  '.occk..............kco.',
  '.occk..............kco.',
  '.occck............kcco.',
  '.occccccccccccccccccco.',
  '.occcccccccLccccccccco.',
  '.occkccccccccccccckcco.',
  '..occkccccccccccckcco..',
  '..oocckccccccccckccoo..',
  '...oocckccccccckccoo...',
  '....oocckccccckccoo....',
  '......ookkkkkkkoo......',
];
const M3S = [
  '.okkkkkkkko...',
  '.ock......o...',
  '.ock......o...',
  '.occk.....o...',
  '.occcccccccco.',
  '.occccccLcco..',
  '.ockcccccco...',
  '.occkcccco....',
  '..occkcco.....',
  '...occko......',
  '....oco.......',
];

/* ④ 박쥐 가면 — 정면 (x−13, cy−18), 머리 축 대칭 · 오른쪽은 그늘 */
const M4F = sym([
  '...o.........',
  '...oo........',
  '...ojo.......',
  '...ojko......',
  '...ojkko.....',
  '...ojkkko....',
  '...ojkkkko...',
  '...ojkkkkkooo',
  '...ojkkkkkkmm',
  '...ojkkkkkkkk',
  '...ohkkkkkkkk',
  '...ohmkkkkkkk',
  '..ohmkkkkkkkk',
  '..ohkkkkkkkkk',
  '.ohkkkkkkkkkk',
  '.omkkkkkkkkkk',
  '.okkkkkkkkkkk',
  '.okkkkkkkkkkk',
  '.okkkkkkkkkkk',
  '.odkkkkkkkkkk',
  '..odkkkkkkook',
  '..okkkooko..o',
  '...oko..o....',
  '....o........',
], true, { j: 'm', h: 'm', m: 'k' });
const EAR4 = ['o......', 'oo.....', 'ojo....', 'ojko...', 'ojkko..', 'ojkkko.', 'ojkkkko', 'ojkkkkk', 'ojkkkkk'];

/* ⑤ 강철 가면 — 정면 (x−13, cy−12) · 옆 (k −1, cy−11). v · V(눈빛)는 시간에 따라 깜빡 */
const M5F = sym([
  '............o',
  '...........oy',
  '...........oG',
  '..........oyG',
  '..........oyG',
  '....oooooooyG',
  '....oGGGGGGyG',
  '...oQqRRRRRRR',
  '..oqqRRRRRRRR',
  '..ogGGGGGGGGG',
  '..oGnvvVvvnGG',
  '..oGnnvvvvvnG',
  '..ogGGGGGGGGG',
  '..oqRRRRRRRRq',
  '..oqGGGRRRRRq',
  '..oqRRRRRRRRq',
  '...oGGGRRRRRq',
  '...ooqRRooooo',
  '....ooRRRRRRR',
  '.....ooRRoooo',
  '.......ooGGGy',
], true, { Q: 'R', q: 'R', R: 'r', y: 'G', G: 'g' });
const M5S = [
  '.....o........',
  '....oyo.......',
  '...oyGGo......',
  '...oyGGGo.....',
  '..ooooooo.....',
  '.oGGGGGGo.....',
  '.oqRRRRRRo....',
  '.oqRRRRRRRo...',
  '.ogGGGGGGGo...',
  '.oGGnvvVvvo...',
  '.oGGGnvvvvo...',
  '.ogGGGGGGGGo..',
  '.oqRRRRRRRRRo.',
  '.oqRRRRRRRRo..',
  '.oqRRRRRRRo...',
  '..oRRRoooo....',
  '..oRRRRRo.....',
  '...oRooo......',
  '....oGGo......',
];
const BOLT5 = ['.oo.', 'oyGo', 'oGgo', '.oo.'];

/* ⑥ 무지개 가면 — 정면 (x−16, cy−10), 얼굴 축 대칭 · 옆 (k −1, cy−10). X 칸은 흐르는 무지개 */
const M6F = sym([
  '.o..............',
  '.oo.............',
  '.oXo............',
  '.oXXo...........',
  '.oXXXooooo......',
  '.oXXXXXXXXoooooo',
  '..oXXXXXXooooXXX',
  '..oXXXXXo....oXX',
  '..oXXXXXo....oXX',
  '...oXXXXo....oXX',
  '....oXXXo....oXX',
  '.....oXXXooooXoo',
  '......oooooooo..',
], false);
const M6S = [
  '...........o..',
  '..........oo..',
  '.........oXo..',
  '........oXXo..',
  '..oooooooXXo..',
  '.oXXXXXXXXXXo.',
  '.oXXXooooXXXo.',
  '.oXXo....oXXo.',
  '.oXXo....oXXo.',
  '.oXXo....oXXo.',
  '..oXo....oXo..',
  '...oXooooXo...',
  '....oooooo....',
];
const GEM6 = ['.oo.', 'oWpo', 'oppo', '.oo.'];
const BOW6 = ['oo...oo', 'oXo.oXo', 'oXXoXXo', 'oXo.oXo', 'oo...oo'];

/* ⑦ 최종보스 가면 — 정면 (x−13, cy−10) · 왕관 (x−8, cy−20) · 뿔 왼쪽 (x−16, cy−16) */
const M7F = sym([
  '............o',
  '...........oG',
  '.....ooooooGy',
  '....ooyGGGGGG',
  '...ooKnnKKKgR',
  '...oKnKKKKgrR',
  '..oGGGKKKKKgR',
  '..oKKKGGGKKKg',
  '..oKKKKKKGGKK',
  '..oKKKKKKKKKK',
  '..oKKKKKKKKKK',
  '..oKKKKKKKKKK',
  '..omKKKKKKKKK',
  '..okKKKKKKKKK',
  '...oGGGGGGGGG',
  '...ooKKKKyKyK',
  '....ooKKKyKKK',
  '.....ookKKKKK',
  '.......ookkkk',
], true, { n: 'm', m: 'K', y: 'G', G: 'g', r: 'R' });
const CROWN7 = [
  '.o.....o.....o.',
  '.oo...oyo...oo.',
  '.oyo..oyo..oyo.',
  'oyGo.oyGgo.oGgo',
  'oyGGooyRgooGGgo',
  'oyGGGGGRGGGGGgo',
  'oyGbGGGGGGGeGgo',
  'oyyyyyyyyyyyyyo',
  'ooooooooooooooo',
];
const HORN7 = [
  '.o......',
  '.oo.....',
  '.oho....',
  'ohBo....',
  'ohBo....',
  'ohBso...',
  'ohBBo...',
  '.ohBso..',
  '.ohBBso.',
  '..ohBBGo',
  '...oGGgo',
  '....ooo.',
];

/* 최종보스 옆모습 (k −1, cy−8) */
const M7S = [
  '..ooooo.......',
  '.oyGGGGo......',
  '.oKnnKKRo.....',
  '.oKnKKKKRo....',
  '.oKKKKGGKKo...',
  '.oKKKKKKGGo...',
  '.oKKKKKKKKo...',
  '.oKKKKKKKKo...',
  '.oKKKKKKKKKo..',
  '.oKKKKKKKKKKo.',
  '.omKKKKKKKKo..',
  '.okKKKKKKKo...',
  '..oGGGGGGo....',
  '..oKKyKyo.....',
  '...oKKyo......',
  '....okko......',
  '.....oo.......',
];

/** 최종보스 오라 — 머리 둘레에서 보랏빛 불꽃이 일렁인다(머리 · 몸이 위에 덮는다) */
function bossAura(c, x, cy, t) {
  const f = step12(t);
  const cx = x - 0.5, cyy = cy - 1;
  const C = ['#3b0f5c', '#7a22c9', '#c050ff', '#ff9cf7'];
  for (let yy = cy - 22; yy <= cy + 7; yy++) {
    for (let xx = x - 18; xx <= x + 17; xx++) {
      const dx = (xx + 0.5 - cx) / 12.5, dy = (yy + 0.5 - cyy) / 11.5;
      const e = Math.sqrt(dx * dx + dy * dy);
      if (e < 0.9) continue;                                   // 머리 안쪽은 어차피 덮인다
      const up = Math.max(0, -dy / (e || 1));                  // 1 = 머리 꼭대기 쪽
      const a = Math.atan2(dy, dx);
      const tongue = Math.max(0, Math.sin(a * 9 + f * 11)) * 0.45 + Math.max(0, Math.sin(a * 5 - f * 7)) * 0.22;
      const m = 0.15 + up * (0.15 + tongue);
      const lim = 1 + m - (yy > cy + 3 ? (yy - cy - 3) * 0.06 : 0);
      if (e >= lim) continue;
      const depth = (lim - e) / Math.max(0.08, m);
      px(c, xx, yy, C[depth < 0.22 ? 0 : depth < 0.5 ? 1 : depth < 0.8 ? 2 : 3]);
    }
  }
  /* 위로 날아오르는 불티 */
  for (let i = 0; i < 4; i++) {
    const p = mod(f * 0.9 + i * 0.25, 1);
    const ex = x - 0.5 + Math.sin(i * 2.3 + 1) * 11, ey = cy - 12 - p * 10;
    if (p < 0.85) px(c, ro(ex + Math.sin(p * 9 + i) * 1.5), ro(ey), p < 0.5 ? '#ff9cf7' : '#c050ff');
  }
}

function maskBehind(c, m, x, cy, t, view, d) {
  if (m === 7) { bossAura(c, x, cy, t); return; }
  if (view !== 'f') return;                 // 옆 · 뒤에서는 끈이 머리 앞쪽으로 보인다 — maskFace 에서 그린다
  if (m === 1) { clothTail(c, x - 12, cy - 2, 7, -1, 0, t, PM1.r, PM1.d, 2); clothTail(c, x - 12, cy, 6, -1, 2, t, PM1.r, PM1.d, 4); }
  else if (m === 2) { clothTail(c, x + 10, cy + 3, 5, 1, 0.6, t, PM2.n, PM2.d, 2); clothTail(c, x + 10, cy + 5, 4, 1, 2.4, t, PM2.n, PM2.d, 3); }
  else if (m === 3) { clothTail(c, x + 10, cy - 7, 10, 1, 0.3, t, PM3.b, PM3.p, 3); clothTail(c, x + 10, cy - 5, 8, 1, 2.1, t, PM3.b, PM3.p, 6); }
  else if (m === 6) {
    const f = Math.floor(t * 10);
    const rb = (i) => MASK_RB[mod(i + f, 6)], rbD = (i) => tone(MASK_RB[mod(i + f, 6)], -0.3);
    clothTail(c, x - 15, cy - 3, 6, -1, 0.4, t, rb, rbD, 3);
    clothTail(c, x + 14, cy - 3, 6, 1, 1.9, t, rb, rbD, 3);
  }
}

function maskFace(c, m, x, cy, t, st, view, d) {
  const f = step12(t);
  const K = (k) => (d > 0 ? x + k : x - 1 - k);                       // 옆모습: 보는 쪽 기준 칸 k → 화면 칸
  const kOf = (xx) => (d > 0 ? xx - x : x - 1 - xx);
  const side = (k0, y0, rows, pal) => mspr(c, d > 0 ? x + k0 : x - 1 - k0, y0, rows, pal, d < 0);
  const squint = st === 'trip' || (t % 3.4) < 0.12;                    // 렌즈 눈도 깜빡 · 넘어지면 질끈
  const flow = (xx, yy) => MASK_RB[mod(Math.floor(((xx - x) + (yy - cy) - f * 16) / 2), 6)];
  switch (m) {
    case 1:
      if (view === 'f') mspr(c, x - 12, cy - 4, M1F, PM1);
      else if (view === 's') {
        side(-14, cy - 4, M1S, PM1);
        side(-15, cy - 4, KNOT, PM1);
        clothTail(c, K(-16), cy - 2, 6, -d, 0, t, PM1.r, PM1.d, 2);
        clothTail(c, K(-16), cy, 5, -d, 2, t, PM1.r, PM1.d, 4);
      } else {
        headBand(c, x, cy, -3, 0, PM1.r, PM1.l, PM1.d);
        mspr(c, x - 3, cy - 4, KNOT, PM1);
        clothTail(c, x - 4, cy - 2, 5, -1, 0, t, PM1.r, PM1.d, 4);
        clothTail(c, x + 1, cy - 1, 5, 1, 1.6, t, PM1.r, PM1.d, 5);
      }
      break;
    case 2:
      if (view === 'f') mspr(c, x - 11, cy, M2F, PM2);
      else if (view === 's') {
        side(-4, cy, M2S, PM2);
        side(-13, cy - 1, ['.oo.', 'onno', 'odno', '.oo.'], PM2);
        clothTail(c, K(-14), cy, 4, -d, 0.6, t, PM2.n, PM2.d, 2);
      } else {
        headBand(c, x, cy, 1, 1, PM2.n);
        mspr(c, x - 3, cy - 1, ['.oo.', 'onno', 'odno', '.oo.'], PM2);
        clothTail(c, x - 4, cy + 1, 4, -1, 0.6, t, PM2.n, PM2.d, 3);
        clothTail(c, x + 1, cy + 1, 4, 1, 2.0, t, PM2.n, PM2.d, 3);
      }
      break;
    case 3:
      if (view === 'f') mspr(c, x - 12, cy - 8, M3F, PM3);
      else {
        headBand(c, x, cy, -7, -5, PM3.b, PM3.B, PM3.p);
        if (view === 's') {
          side(-1, cy - 3, M3S, PM3);
          side(-15, cy - 8, KNOT, { o: OUT, l: PM3.B, r: PM3.b, d: PM3.p });
          clothTail(c, K(-16), cy - 7, 10, -d, 0.3, t, PM3.b, PM3.p, 3);
          clothTail(c, K(-16), cy - 5, 8, -d, 2.1, t, PM3.b, PM3.p, 6);
        } else {
          mspr(c, x - 3, cy - 8, KNOT, { o: OUT, l: PM3.B, r: PM3.b, d: PM3.p });
          clothTail(c, x - 4, cy - 6, 9, -1, 0.3, t, PM3.b, PM3.p, 6);
          clothTail(c, x + 1, cy - 5, 9, 1, 2.1, t, PM3.b, PM3.p, 7);
        }
      }
      break;
    case 4: {
      const lens = '#ffffff', lensB = '#a8dcff';
      if (view === 'f') {
        mspr(c, x - 13, cy - 18, M4F, PM4);
        for (const s of [-1, 1]) {                                    // 하얀 렌즈 눈 — 머리 축 대칭(칸 k ↔ −2−k)
          const L = (k, y, w, col) => rect(c, s < 0 ? x + k : x - 2 - k - (w - 1), y, w, 1, col);
          if (squint) L(-8, cy - 1, 4, lens);
          else { L(-8, cy - 2, 2, lens); L(-8, cy - 1, 4, lens); L(-7, cy, 4, lensB); }
        }
        px(c, x - 8, cy - 9, '#e8e4ff'); px(c, x - 7, cy - 10, '#e8e4ff');   // 광택 점
      } else if (view === 's') {
        side(-9, cy - 18, EAR4, PM4D);
        hood(c, x, cy, (k) => (k <= -3 ? 5 : k <= 3 ? 3 : k === 6 ? 2 : k <= 8 ? 1 : 0), PM4.k, kOf);
        side(-4, cy - 18, EAR4, PM4);
        oval(c, x - 0.5 - 3 * d, cy - 6, 5, 3, PM4.m, cy - 6, cy - 9);
        if (squint) side(4, cy - 1, ['wwww'], { w: lens });
        else side(4, cy - 2, ['ww..', 'wwww', '.bbb'], { w: lens, b: lensB });
      } else {
        mspr(c, x - 10, cy - 18, EAR4, PM4);
        mspr(c, x + 8, cy - 18, EAR4, PM4, true);
        hood(c, x, cy, () => 5, PM4.k, (xx) => xx - x);
        oval(c, x - 3.5, cy - 6, 5, 3, PM4.m, cy - 6, cy - 9);
      }
      break;
    }
    case 5: {
      const glow = mod(f * 1.5, 1) < 0.5;
      const pal = { ...PM5, v: glow ? '#9ffbff' : '#3fd8ea', V: '#ffffff' };
      if (view === 'f') mspr(c, x - 13, cy - 12, M5F, pal);
      else if (view === 's') { side(-1, cy - 11, M5S, pal); side(-4, cy - 2, BOLT5, pal); }
      else {
        headBand(c, x, cy, -2, -1, PM5.R, PM5.q, PM5.r);
        mspr(c, x - 3, cy - 3, ['.oooo.', 'oyGGGo', 'oGGGgo', '.oooo.'], pal);
        for (const s of [-1, 1]) px(c, s < 0 ? x - 9 : x + 7, cy - 2, PM5.y);
      }
      break;
    }
    case 6: {
      const pal = { o: OUT, X: flow, W: '#ffffff', p: '#ff7ad9' };
      if (view === 'f') { mspr(c, x - 16, cy - 10, M6F, pal); mspr(c, x - 2, cy - 9, GEM6, pal); }
      else if (view === 's') {
        for (let k = -11; k <= 0; k++) { px(c, K(k), cy - 4, OUT); px(c, K(k), cy - 3, flow(K(k), cy - 3)); px(c, K(k), cy - 2, OUT); }
        side(-1, cy - 10, M6S, pal);
        side(-16, cy - 5, BOW6, pal);
        const fi = Math.floor(t * 10);
        clothTail(c, K(-17), cy - 3, 6, -d, 0.4, t, (i) => MASK_RB[mod(i + fi, 6)], (i) => tone(MASK_RB[mod(i + fi, 6)], -0.3), 4);
      } else {
        headBand(c, x, cy, -3, -2, '#ffffff');
        for (let xx = x - 12; xx <= x + 11; xx++) for (let yy = cy - 3; yy <= cy - 2; yy++) if (xx > x - 12 && xx < x + 10) px(c, xx, yy, flow(xx, yy));
        mspr(c, x - 4, cy - 5, BOW6, pal);
        const fi = Math.floor(t * 10);
        clothTail(c, x - 4, cy - 2, 6, -1, 0.4, t, (i) => MASK_RB[mod(i + fi, 6)], (i) => tone(MASK_RB[mod(i + fi, 6)], -0.3), 6);
        clothTail(c, x + 2, cy - 2, 6, 1, 1.9, t, (i) => MASK_RB[mod(i + fi + 3, 6)], (i) => tone(MASK_RB[mod(i + fi + 3, 6)], -0.3), 6);
      }
      break;
    }
    case 7: {
      const hot = mod(f * 2, 1) < 0.5;
      const E = hot ? '#ff6a7e' : '#ff2448', Ec = hot ? '#ffffff' : '#ffd0d8';
      if (view === 'f') {
        mspr(c, x - 13, cy - 10, M7F, PM7);
        for (const s of [-1, 1]) {                                    // 붉게 빛나는 눈 — 머리 축 대칭
          const L = (k, y, w, col) => rect(c, s < 0 ? x + k : x - 2 - k - (w - 1), y, w, 1, col);
          if (squint) L(-9, cy - 1, 5, E);
          else { L(-9, cy - 2, 4, E); L(-9, cy - 1, 5, E); L(-7, cy, 3, E); L(-7, cy - 1, 2, Ec); }
        }
      } else if (view === 's') {
        headBand(c, x, cy, -3, -2, PM7.G, PM7.y, PM7.g);
        side(-1, cy - 8, M7S, PM7);
        if (!squint) side(4, cy - 2, ['EEE.', 'EeEE', '.EEE'], { E, e: Ec }); else side(4, cy - 1, ['EEEE'], { E });
      } else headBand(c, x, cy, -3, -2, PM7.G, PM7.y, PM7.g);
      break;
    }
    default: break;
  }
}

function maskTop(c, m, x, cy, t, view, d) {
  const f = step12(t);
  if (m === 5 && view === 'f') {                                       // 금속 반짝 — 세 군데를 돌아가며
    const i = Math.floor(f * 1.4) % 3, P = [[-8, -5], [3, -4], [-6, 5]][i];
    twinkle(c, x + P[0], cy + P[1], mod(f * 1.4, 1));
  } else if (m === 6) {
    for (let i = 0; i < 4; i++) {
      const P = [[-15, -11], [14, -11], [-12, 3], [11, 3]][i];
      twinkle(c, x + P[0], cy + P[1], mod(f * 0.8 + i * 0.27, 1), i % 2 ? '#fff7a8' : '#ffffff');
    }
  } else if (m === 7) {
    /* 뿔 · 왕관 */
    if (view === 's') {
      const side = (k0, y0, rows, pal) => mspr(c, d > 0 ? x + k0 : x - 1 - k0, y0, rows, pal, d < 0);
      side(-6, cy - 16, HORN7, PM7);
      side(-5, cy - 20, CROWN7.map((r) => r.slice(3, 12)), PM7);
    } else {
      mspr(c, x - 16, cy - 16, HORN7, PM7);
      mspr(c, x + 14, cy - 16, HORN7, PM7, true);
      mspr(c, x - 8, cy - 20, CROWN7, PM7);
    }
    for (let i = 0; i < 3; i++) {
      const a = f * 1.3 + i * 2.094;
      twinkle(c, ro(x - 0.5 + Math.cos(a) * 17), ro(cy - 5 + Math.sin(a) * 12), mod(f * 1.1 + i * 0.33, 1), i === 1 ? '#fff3a0' : '#ffffff');
    }
    twinkle(c, x - 1, cy - 20, mod(f * 0.7, 1), '#ffffff');
  }
}

/* ---------- ROPE BEAT 기술 포즈 (2026-11-07 추가) ---------- */
/**
 * 'ready' 무릎 살짝 · 'cross' 팔 X · 'side' 두 손 오른쪽 옆구리 · 'high' 무릎 바짝 + 팔 높이 ·
 * 'release' 한 손 번쩍 + 손잡이가 공중 · 'spin' pose.spin(0~1) → 정면 · 옆(오른쪽 봄) · 뒤 · 옆(왼쪽 봄)
 * 기존 stand · trip · sit · cheer 는 위 drawKid 가 그대로 그린다(여기 오지 않는다).
 * 손 위치는 beatHandOff 한 곳에서만 정한다 — kidHands 와 drawKid 가 같은 값을 돌려줘야 줄이 손에서 나온다.
 */
export const BEAT_POSES = ['ready', 'cross', 'side', 'high', 'release', 'spin'];
const BEAT_SET = new Set(BEAT_POSES);

/** spin 0~1 → 0 정면 · 1 옆(오른쪽 봄) · 2 뒤 · 3 옆(왼쪽 봄) */
export function spinView(spin = 0) {
  const u = ((spin % 1) + 1) % 1;
  return Math.floor(u * 4) % 4;
}

/** 손 위치(아이 발 기준 오프셋). 아이 가운데는 x − 0.5 라 좌우 대칭은 +a ↔ −a−1 */
function beatHandOff(st, theta, t, spin) {
  const dy = ro(-Math.cos(theta) * 2), dx = ro(Math.sin(theta));
  switch (st) {
    case 'ready': return { l: { x: -12 - dx, y: -12 + dy }, r: { x: 11 + dx, y: -12 + dy } };
    /* 손목이 배 앞에서 엇갈린다 — 왼손(l)이 오른쪽, 오른손(r)이 왼쪽 */
    case 'cross': return { l: { x: 8 + dx, y: -11 + dy }, r: { x: -9 - dx, y: -12 + dy } };
    /* 두 손을 오른쪽 옆구리에 모아 줄을 옆으로 — 손이 작은 원을 크게 그린다 */
    case 'side': { const sx = ro(Math.sin(theta) * 2); return { l: { x: 9 + sx, y: -13 + dy }, r: { x: 12 + sx, y: -14 + dy } }; }
    case 'high': return { l: { x: -14 - dx, y: -20 + dy }, r: { x: 13 + dx, y: -20 + dy } };
    /* 놓은 손잡이(r)는 번쩍 든 손 위에서 원을 그리며 돈다 — r 이 곧 손잡이 자리 */
    case 'release': { const a = theta * 2; return { l: { x: -12 - dx, y: -14 + dy }, r: { x: 18 + ro(Math.cos(a) * 5), y: -49 + ro(Math.sin(a) * 4) } }; }
    case 'spin': {
      const v = spinView(spin);
      if (v === 1) return { l: { x: 6, y: -14 + dy }, r: { x: 10, y: -15 + dy } };
      if (v === 3) return { l: { x: -7, y: -14 + dy }, r: { x: -11, y: -15 + dy } };
      return { l: { x: -12 - dx, y: -14 + dy }, r: { x: 11 + dx, y: -14 + dy } };
    }
    default: return { l: { x: -12, y: -14 }, r: { x: 11, y: -14 } };
  }
}
function beatHands(theta, x, footY, lift, state, t, spin) {
  const h = beatHandOff(state, theta, t, spin);
  const fy = ro(footY - lift), X = ro(x);
  return { l: { x: X + h.l.x, y: fy + h.l.y }, r: { x: X + h.r.x, y: fy + h.r.y } };
}
/** drawKid 에 넘길 pose 를 그대로 넣으면 손 위치 — kidHands 를 pose 하나로 부르는 편의 함수 */
export function poseHands(x, footY, pose = {}) {
  return kidHands(pose.theta ?? Math.PI, x, footY, pose.lift || 0, pose.crouch || 0, pose.state || 'stand', pose.t || 0, pose.spin || 0);
}

/** 팔 하나 — 소매(윗옷) 45% + 살. ol=false 면 외곽선을 따로 먼저 그린 경우 */
function beatArm(c, P, sx, sy, hx, hy, shade = false, ol = true) {
  if (ol) line(c, sx, sy, hx, hy, 4, OUT);
  const mx = sx + (hx - sx) * 0.45, my = sy + (hy - sy) * 0.45;
  line(c, sx, sy, mx, my, 2, shade ? P.shirtS : P.shirt);
  line(c, mx, my, hx, hy, 2, shade ? P.skinS : P.skin);
  rect(c, hx - 1, hy - 1, 3, 3, OUT);
  rect(c, hx, hy, 2, 2, shade ? P.skinS : P.skin);
}
/** 신발 한 짝 (정면) — drawKid 와 같은 모양 */
function beatShoe(c, P, sx, sy, s, t) {
  rbox(c, sx, sy, 8, 4, OUT, 1);
  rect(c, sx + 1, sy + 1, 6, 2, P.shoe);
  rect(c, sx + (s < 0 ? 1 : 4), sy + 1, 2, 1, tone(P.shoe, 0.45));
  rect(c, sx + 1, sy + 2, 6, 1, P.shoeS);
  if (P.shoeFx === 'star') px(c, sx + 3, sy + 1, '#ffe066');
  if (P.shoeFx === 'spark' && (Math.floor(t * 5) + s) % 3 === 0) px(c, sx + (s < 0 ? 0 : 7), sy - 1, '#ffffff');
}

function beatLegs(c, P, x, fy, mode, d, t, drop) {
  const legC = P.pantsP === 'long' ? P.pants : P.skin;
  const legS = P.pantsP === 'long' ? P.pantsS : P.skinS;
  const stripe = P.pantsP === 'long' && P.pants2;
  if (mode === 'high') {
    /* 무릎을 양옆으로 벌려 바짝 접는다(개구리 뛰기) — 허벅지는 엉덩이에서 바깥 위로, 정강이는 무릎에서 안쪽 아래로 */
    for (const s of [-1, 1]) {
      const M = (k) => (s < 0 ? x - 1 - k : x + k);      // 오른쪽 기준 칸 k → 양쪽 대칭
      const hx = M(3), kx = M(10), ax = M(6);
      const hy0 = fy - 9, ky = fy - 11, ay = fy - 6;
      line(c, hx, hy0, kx, ky, 5, OUT); line(c, kx, ky, ax, ay, 5, OUT);
      line(c, hx, hy0, kx, ky, 3, legC); line(c, kx, ky, ax, ay, 3, legS);
      if (stripe) line(c, hx, hy0 - 1, kx, ky - 1, 1, P.pants2);
      rect(c, kx - 1, ky - 1, 2, 1, tone(legC, 0.35));                // 무릎 빛
      const sx = s < 0 ? ax - 5 : ax - 2;
      rbox(c, sx, ay, 8, 4, OUT, 1);
      rect(c, sx + 1, ay + 1, 6, 1, P.shoe);
      rect(c, sx + (s < 0 ? 1 : 4), ay + 1, 2, 1, tone(P.shoe, 0.45));
      rect(c, sx + 1, ay + 2, 6, 1, '#f4ead8');                      // 밑창이 보인다
      px(c, sx + 2, ay + 2, '#c9b89a'); px(c, sx + 5, ay + 2, '#c9b89a');
    }
    return;
  }
  if (mode === 'profile') {
    /* 옆모습 — 다리 둘이 겹치고 신발 앞코가 보는 쪽(d)을 향한다. 먼 쪽 다리는 그늘색 */
    const legs = d > 0 ? [[x - 3, true], [x, false]] : [[x, true], [x - 3, false]];
    for (const [lx, far] of legs) {
      rect(c, lx - 1, fy - 10, 5, 7, OUT);
      rect(c, lx, fy - 9, 3, 5, far ? legS : legC);
      if (stripe && !far) rect(c, lx + 1, fy - 9, 1, 5, P.pants2);
    }
    const shoes = d > 0 ? [[x - 4, true], [x - 1, false]] : [[x - 5, true], [x - 8, false]];
    for (const [sx, far] of shoes) {
      rbox(c, sx, fy - 4, 9, 4, OUT, 1);
      rect(c, sx + 1, fy - 3, 7, 2, far ? P.shoeS : P.shoe);
      rect(c, d > 0 ? sx + 5 : sx + 1, fy - 3, 3, 1, tone(far ? P.shoeS : P.shoe, 0.4));   // 앞코 빛
      rect(c, sx + 1, fy - 2, 7, 1, far ? tone(P.shoeS, -0.2) : P.shoeS);
    }
    return;
  }
  const tuck = mode === 'tuck';
  const up = tuck ? 3 : 0;
  const legH = tuck ? 3 : 5 - drop;
  for (const s of [-1, 1]) {
    const lx = s < 0 ? x - 6 - (tuck ? 1 : 0) : x + 3 + (tuck ? 1 : 0);
    const top = fy - 4 - legH - up;
    if (mode === 'ready') {
      /* 무릎 살짝 굽힘 — 다리를 어깨보다 넓게(A 자) — 아래 칸이 바깥으로 한 칸, 신발도 한 칸 바깥. 몸은 2칸 낮다 */
      const ox = s < 0 ? -1 : 1;
      rect(c, lx - 1, top, 5, 2, OUT);
      rect(c, lx - 1 + ox, top + 1, 5, legH, OUT);
      rect(c, lx, top, 3, 1, legC);
      rect(c, lx + ox, top + 1, 3, legH - 1, legC);
      rect(c, lx + (s < 0 ? 2 : 0), top, 1, 1, legS);
      rect(c, lx + ox + (s < 0 ? 2 : 0), top + 1, 1, legH - 1, legS);
      if (stripe) { px(c, lx + 1, top, P.pants2); rect(c, lx + 1 + ox, top + 1, 1, legH - 1, P.pants2); }
    } else {
      rect(c, lx - 1, top, 5, legH + 1, OUT);
      rect(c, lx, top, 3, legH, legC);
      rect(c, lx + (s < 0 ? 2 : 0), top, 1, legH, legS);
      if (stripe) rect(c, lx + 1, top, 1, legH, P.pants2);
    }
    const sx = (s < 0 ? x - 9 - (tuck ? 1 : 0) : x + 1 + (tuck ? 1 : 0)) + (mode === 'ready' ? s : 0);
    beatShoe(c, P, sx, fy - 4 - up, s, t);
  }
}

function beatPants(c, P, x, hy, d) {
  if (d) { // 옆모습은 폭이 좁다
    obox(c, x - 5, hy, 10, P.pantsP === 'long' ? 3 : 4, P.pantsP === 'rainbow' ? '#ff4d4d' : P.pants, 1, false);
    rect(c, x - 5, hy + (P.pantsP === 'long' ? 2 : 3), 10, 1, P.pantsS);
    return;
  }
  if (P.pantsP === 'skirt' || P.pantsP === 'rainbow') {
    const RB = ['#ff4d4d', '#ffa64d', '#ffe14d', '#4dd27a', '#4d9cff', '#a64dff'];
    for (let i = 0; i < 6; i++) { const w = 14 + Math.floor(i * 0.8) * 2; rect(c, x - w / 2 - 1, hy + i, w + 2, 1, OUT); }
    for (let i = 0; i < 5; i++) {
      const w = 14 + Math.floor(i * 0.8) * 2;
      if (P.pantsP === 'rainbow') { for (let k = 0; k < w; k++) px(c, x - w / 2 + k, hy + i, RB[Math.floor((k / w) * 6)]); }
      else rect(c, x - w / 2, hy + i, w, 1, i === 4 ? P.pantsS : P.pants);
    }
  } else {
    obox(c, x - 7, hy, 14, P.pantsP === 'long' ? 3 : 4, P.pants, 1, false);
    rect(c, x - 7, hy + (P.pantsP === 'long' ? 2 : 3), 14, 1, P.pantsS);
    rect(c, x - 1, hy + 2, 1, 2, OUT);
  }
}

function beatBody(c, P, x, by, d, back) {
  if (d) {
    rbox(c, x - 6, by, 12, 11, OUT, 2);
    rbox(c, x - 5, by + 1, 10, 9, P.shirt, 1);
    rect(c, x - 3, by + 1, 6, 1, P.shirtL);
    rect(c, d > 0 ? x - 5 : x + 4, by + 2, 1, 7, P.shirtS);           // 등 쪽 그늘
    rect(c, x - 5, by + 9, 10, 1, P.shirtS);
    return;
  }
  rbox(c, x - 8, by, 16, 11, OUT, 2);
  rbox(c, x - 7, by + 1, 14, 9, P.shirt, 1);
  rect(c, x - 5, by + 1, 9, 1, P.shirtL);
  rect(c, x + 5, by + 2, 1, 7, P.shirtS);
  rect(c, x - 7, by + 9, 14, 1, P.shirtS);
  /* 뒤에서는 등번호 · 줄무늬 · 체육복 선만 보인다(별 · 하트는 앞판) */
  if (!back || P.shirtP === 'stripe' || P.shirtP === 'sport' || P.shirtP === 'number') shirtPattern(c, P, x, by);
}

/** 정면 머리 — drawKid 와 똑같이 */
function beatHeadFront(c, look, P, x, cy, st, mouth, t, lift) {
  const cx = x - 0.5;
  oval(c, cx, cy, 11, 10, OUT);
  oval(c, cx, cy, 10, 9, P.skinS);
  oval(c, cx, cy - 0.7, 9.6, 8.4, P.skin);
  rect(c, x - 9, cy + 3, 2, 1, '#ff8fa3');
  rect(c, x + 7, cy + 3, 2, 1, '#ff8fa3');
  drawFace(c, look.eyes, x, cy, st, mouth, t, lift);
  const mk = look.mask | 0;
  if (!(mk && MASK_COWL.has(mk))) drawHairFront(c, look.hair, P, x, cy);
  if (mk) maskFace(c, mk, x, cy, t, st, 'f', 0);
  if (!(mk && MASK_NOHAT.has(mk))) drawHat(c, look.hat, P, x, cy, t);
  if (mk) maskTop(c, mk, x, cy, t, 'f', 0);
}

/** 옆모습 머리 — 눈 하나 · 뒤통수는 머리카락 · 귀 · 코끝 한 칸. d = 1 오른쪽을 봄, −1 왼쪽 */
function beatHeadSide(c, look, P, x, cy, d, mouth, t, lift) {
  const cx = x - 0.5;
  const M = (k) => (d > 0 ? x + k : x - 1 - k);       // 오른쪽 기준 칸 k 를 보는 방향으로 뒤집는다
  const sw = Math.floor(t * 5) % 2;
  const mk = look.mask | 0, cowl = mk && MASK_COWL.has(mk);   // 가면 — 두건(박쥐)은 뾰족 · 곱슬 머리를 덮는다
  /* 뒤로 늘어진 머리 */
  if (look.hair === 1) { const x0 = d > 0 ? x - 13 : x - 2; rbox(c, x0, cy - 8, 15, 17, OUT, 3); rbox(c, x0 + 1, cy - 7, 13, 15, P.hair, 3); rect(c, x0 + 1, cy + 6, 13, 1, P.hairS); }
  else if (look.hair === 2) { const p0 = d > 0 ? x - 15 : x + 10; oval(c, p0 + 2.5, cy + 2 - sw, 4, 5, OUT); oval(c, p0 + 2.5, cy + 2 - sw, 3, 4, P.hair); rect(c, p0 + 1, cy - 1 - sw, 2, 1, P.hairL); }
  else if (look.hair === 3) { const tx = d > 0 ? x - 16 : x + 9; rbox(c, tx, cy - 6 + sw, 7, 15, OUT, 2); rbox(c, tx + 1, cy - 5 + sw, 5, 13, P.hair, 2); rect(c, d > 0 ? tx + 1 : tx + 5, cy - 3 + sw, 1, 9, P.hairS); }
  oval(c, cx, cy, 11, 10, OUT);
  oval(c, cx, cy, 10, 9, P.skinS);
  oval(c, cx, cy - 0.7, 9.6, 8.4, P.skin);
  px(c, M(11), cy + 1, OUT); px(c, M(10), cy + 1, P.skin);   // 코끝
  /* 뒤통수 절반은 머리카락 (머리 둘레를 따라) */
  for (let yy = cy - 6; yy <= cy + 5; yy++) {
    const k = (yy + 0.5 - cy) / 9;
    if (Math.abs(k) > 1) continue;
    const hw = 10 * Math.sqrt(1 - k * k);
    if (d > 0) { const a = ro(cx - hw); rect(c, a, yy, x - 1 - a, 1, yy >= cy + 4 ? P.hairS : P.hair); }
    else { const b = ro(cx + hw); rect(c, x, yy, b - x, 1, yy >= cy + 4 ? P.hairS : P.hair); }
  }
  /* 정수리 덮개 + 빛 */
  oval(c, cx, cy - 1, 11.5, 10.5, OUT, cy - 4);
  oval(c, cx, cy - 1, 10.5, 9.5, P.hair, cy - 5);
  oval(c, cx - 2 * d, cy - 5, 5, 3, P.hairL, cy - 7, cy - 9);
  if (look.hair === 5 && !cowl) for (const [k, h] of [[-9, 5], [-5, 7], [-1, 8], [3, 6]]) { const kx = d > 0 ? x + k : x - 1 - k; for (let i = 0; i < h; i++) { const w = Math.max(1, ro((h - i) * 0.6)); rect(c, kx - ro(w / 2) - 1, cy - 8 - i, w + 2, 1, OUT); } for (let i = 0; i < h - 1; i++) { const w = Math.max(1, ro((h - i) * 0.6) - 1); rect(c, kx - ro(w / 2), cy - 8 - i, w, 1, P.hair); } }
  if (look.hair === 4 && !cowl) for (let i = 0; i < 5; i++) { const a = Math.PI + 0.2 + i * 0.62, bx = cx + Math.cos(a) * 10 * -d * -1, byy = cy - 3 + Math.sin(a) * 9; oval(c, bx, byy, 3.4, 3.4, OUT); oval(c, bx, byy, 2.4, 2.4, P.hair); }
  /* 앞머리 — 얼굴 쪽으로 들쭉날쭉 */
  const fr = [3, 2, 3, 2, 1, 2, 3, 2, 1, 1];
  for (let i = 0; i < 10; i++) { const col = d > 0 ? x + i : x - 1 - i; rect(c, col, cy - 5, 1, fr[i] + 1, OUT); rect(c, col, cy - 5, 1, fr[i], P.hair); }
  /* 귀 */
  const ex = d > 0 ? x - 4 : x;
  sprite(c, ex, cy - 2, d > 0 ? ['.oo.', 'osso', 'osho', 'osho', '.oo.'] : ['.oo.', 'osso', 'ohso', 'ohso', '.oo.'], { o: OUT, s: P.skin, h: P.skinS });
  /* 눈 · 볼 · 입 */
  const E = OUT, W = '#ffffff';
  const blink = (t % 3.4) < 0.12;
  const eyx = d > 0 ? x + 5 : x - 7;
  if (blink || look.eyes === 1) rect(c, eyx, cy, 2, 1, E);
  else if (look.eyes === 3) { rect(c, eyx - (d > 0 ? 0 : 1), cy - 3, 3, 4, E); px(c, eyx + (d > 0 ? 1 : 0), cy - 3, W); }
  else { rect(c, eyx, cy - 2, 2, 3, E); px(c, eyx + (d > 0 ? 1 : 0), cy - 2, W); }
  rect(c, d > 0 ? x + 6 : x - 8, cy + 3, 2, 1, '#ff8fa3');
  const m = mouth || (lift > 10 ? 'o' : 'smile');
  const mx = d > 0 ? x + 7 : x - 9, my = cy + 4, MC = '#7a2a1a';
  if (m === 'o') rect(c, mx, my, 2, 2, MC);
  else if (m === 'grin') { rect(c, mx - (d > 0 ? 1 : 0), my, 3, 1, W); rect(c, mx - (d > 0 ? 1 : 0), my + 1, 3, 1, '#d9485a'); }
  else if (m === 'sad') { rect(c, mx, my, 2, 1, MC); px(c, d > 0 ? mx - 1 : mx + 2, my + 1, MC); }
  else { px(c, d > 0 ? mx - 1 : mx + 2, my, MC); rect(c, mx, my + 1, 2, 1, MC); }
  if (mk) maskFace(c, mk, x, cy, t, 'spin', 's', d);
  /* 모자 — 야구 모자는 챙이 보는 쪽으로, 헤드밴드는 띠, 나머지는 정면 그림 그대로 */
  const hat = mk && MASK_NOHAT.has(mk) ? 0 : look.hat;
  if (hat === 1) {
    const h = P.hat, hS = tone(h, -0.3), hL = tone(h, 0.35);
    oval(c, cx, cy - 4, 12, 9, OUT, cy - 4); oval(c, cx, cy - 4, 11, 8, h, cy - 5);
    oval(c, cx - 3 * d, cy - 8, 4, 2, hL, cy - 8, cy - 10);
    rect(c, x - 11, cy - 5, 22, 2, OUT); rect(c, x - 10, cy - 5, 20, 1, hS);
    const bx = d > 0 ? x + 6 : x - 16;
    rbox(c, bx, cy - 6, 10, 4, OUT, 1); rect(c, bx + 1, cy - 5, 8, 2, hS);
  } else if (hat === 2) { rect(c, x - 11, cy - 7, 22, 4, OUT); rect(c, x - 10, cy - 6, 20, 2, P.hat); rect(c, x - 10, cy - 5, 20, 1, '#e8423a'); }
  else if (hat) drawHat(c, hat, P, x, cy, t);
  if (mk) maskTop(c, mk, x, cy, t, 's', d);
}

/** 뒷모습 머리 — 얼굴 없이 머리카락이 다 덮는다. 가마 · 목덜미 · 귀 끝 */
function beatHeadBack(c, look, P, x, cy, t) {
  const cx = x - 0.5;
  const mk = look.mask | 0, cowl = mk && MASK_COWL.has(mk);
  /* 귀 끝이 머리 양옆으로 살짝 */
  for (const s of [-1, 1]) { const ex = s < 0 ? x - 13 : x + 9; rect(c, ex, cy - 1, 4, 5, OUT); rect(c, ex + 1, cy, 2, 3, P.skin); }
  oval(c, cx, cy, 11, 10, OUT);
  oval(c, cx, cy, 10, 9, P.hairS);
  oval(c, cx, cy - 0.8, 9.6, 8.6, P.hair);
  oval(c, cx - 3, cy - 5, 5, 3, P.hairL, cy - 6, cy - 9);
  /* 머리결 — 아래쪽 세로 그늘 줄 */
  for (let k = -6; k <= 5; k += 3) rect(c, x + k, cy + 2, 1, 4, P.hairS);
  px(c, x, cy - 6, P.hairS); px(c, x + 1, cy - 5, P.hairS); px(c, x - 1, cy - 5, P.hairL);   // 가마
  if (look.hair === 0 || look.hair === 4 || look.hair === 5) { rect(c, x - 4, cy + 8, 7, 2, OUT); rect(c, x - 3, cy + 8, 5, 1, P.skinS); }   // 목덜미
  if (look.hair === 1) { rbox(c, x - 12, cy - 2, 23, 11, OUT, 2); rbox(c, x - 11, cy - 1, 21, 9, P.hair, 2); for (let k = -8; k <= 7; k += 3) rect(c, x + k, cy + 2, 1, 6, P.hairS); rect(c, x - 11, cy + 7, 21, 1, P.hairS); }
  if (look.hair === 3) { const sw = Math.floor(t * 5) % 2; rbox(c, x - 3, cy + 1, 6, 13 + sw, OUT, 2); rbox(c, x - 2, cy + 2, 4, 11 + sw, P.hair, 1); rect(c, x + 1, cy + 3, 1, 9, P.hairS); rect(c, x - 2, cy - 1, 4, 2, '#3a7be8'); }
  if (look.hair === 5 && !cowl) for (const [k, h] of [[-9, 5], [-5, 7], [-1, 8], [3, 7], [7, 5]]) { for (let i = 0; i < h; i++) { const w = Math.max(1, ro((h - i) * 0.7)); rect(c, x + k - ro(w / 2) - 1, cy - 8 - i, w + 2, 1, OUT); } for (let i = 0; i < h - 1; i++) { const w = Math.max(1, ro((h - i) * 0.7) - 1); rect(c, x + k - ro(w / 2), cy - 8 - i, w, 1, P.hair); } }
  if (look.hair === 4 && !cowl) for (let i = 0; i < 9; i++) { const a = Math.PI * 0.9 + (i * Math.PI * 1.2) / 8, bx = cx + Math.cos(a) * 9, byy = cy - 1 + Math.sin(a) * 8; oval(c, bx, byy, 3.2, 3.2, OUT); oval(c, bx, byy, 2.2, 2.2, P.hair); px(c, ro(bx) - 1, ro(byy) - 1, P.hairL); }
  if (mk) maskFace(c, mk, x, cy, t, 'spin', 'b', 0);
  /* 모자 뒷모습 — 야구 모자는 둥근 머리 + 뒤 조임 구멍, 나머지는 정면 그림 */
  const hat = mk && MASK_NOHAT.has(mk) ? 0 : look.hat;
  if (hat === 1) {
    const h = P.hat, hS = tone(h, -0.3), hL = tone(h, 0.35);
    oval(c, cx, cy - 4, 12, 9, OUT, cy - 3); oval(c, cx, cy - 4, 11, 8, h, cy - 4);
    oval(c, cx - 3, cy - 8, 4, 2, hL, cy - 8, cy - 10);
    rbox(c, x - 3, cy - 5, 6, 3, OUT, 1); rect(c, x - 2, cy - 4, 4, 1, P.hair);   // 뒤 조임 구멍
    rect(c, x - 10, cy - 3, 20, 1, hS);
  } else if (hat === 2) { rect(c, x - 11, cy - 7, 22, 4, OUT); rect(c, x - 10, cy - 6, 20, 2, P.hat); rect(c, x - 10, cy - 5, 20, 1, '#e8423a'); rect(c, x - 2, cy - 7, 3, 5, OUT); rect(c, x - 1, cy - 6, 1, 3, P.hat); }
  else if (hat) drawHat(c, hat, P, x, cy, t);
  if (mk) maskTop(c, mk, x, cy, t, 'b', 0);
}

/** 번쩍 든 손바닥(손가락 셋 + 엄지) — 줄 손잡이를 막 놓은 손 */
const PALM = ['.o.o.o.', 'osososo', 'osososo', 'ossssso', 'oosssso', '.osssso', '..oooo.'];

function drawKidBeat(c, xIn, footY, lookIn, pose) {
  const look = lookIn || DEFAULT_LOOK;
  const P = kidPal(look);
  const st = pose.state;
  const t = pose.t || 0;
  const x = ro(xIn);
  const lift = pose.lift || 0;
  const fy = ro(footY - lift);
  const theta = pose.theta ?? Math.PI;
  const v = st === 'spin' ? spinView(pose.spin || 0) : 0;
  const d = v === 1 ? 1 : v === 3 ? -1 : 0;            // 옆모습 방향 (0 = 정면 · 뒤)
  const back = v === 2;
  const drop = st === 'ready' ? 2 : 0;
  const cy = fy - 31 + drop, by = fy - 22 + drop, hy = fy - 13 + drop;
  const H = beatHandOff(st, theta, t, pose.spin || 0);
  const legMode = st === 'high' ? 'high' : st === 'ready' ? 'ready' : d ? 'profile' : (pose.tuck || 0) > 0.3 ? 'tuck' : 'stand';
  const mouth = pose.mouth || (st === 'release' ? 'grin' : st === 'high' && lift > 4 ? 'o' : undefined);

  /* 로켓 운동화 불꽃 */
  if (P.shoeFx === 'rocket' && lift > 2) {
    const f = Math.floor(t * 20) % 2, up = legMode === 'high' ? 4 : legMode === 'tuck' ? 2 : 0;
    for (const sx of [-6, 4]) { rect(c, x + sx, fy - up, 3, 3 + f, '#ff9a1a'); rect(c, x + sx + 1, fy - up, 1, 2 + f, '#fff3a0'); }
  }
  if (look.mask | 0) maskBehind(c, look.mask | 0, x, cy, t, back ? 'b' : d ? 's' : 'f', d);
  if (!d && !back) drawHairBack(c, look.hair, P, x, cy, t, lift);
  if (back && look.hair === 2) drawHairBack(c, 2, P, x, cy, t, lift);   // 양갈래는 뒤에서도 양옆에

  beatLegs(c, P, x, fy, legMode, d, t, drop);
  beatPants(c, P, x, hy, d);

  const lh = { x: x + H.l.x, y: fy + H.l.y }, rh = { x: x + H.r.x, y: fy + H.r.y };
  if (d) {
    /* 옆모습: 먼 팔은 몸 뒤(그늘색), 가까운 팔은 몸 앞 */
    beatArm(c, P, x + d, by + 2, rh.x, rh.y, true);
    beatBody(c, P, x, by, d, false);
    beatArm(c, P, x - d, by + 3, lh.x, lh.y, false);
  } else {
    beatBody(c, P, x, by, 0, back);
    const ls = { x: x - 8, y: by + 2 }, rs = { x: x + 7, y: by + 2 };
    if (st === 'cross') {
      /* 팔 X — 하나씩 따로 그려 위에 올라간 팔의 외곽선이 살아 있게 */
      beatArm(c, P, rs.x, rs.y, rh.x, rh.y);
      beatArm(c, P, ls.x, ls.y, lh.x, lh.y);
    } else if (st === 'release') {
      beatArm(c, P, ls.x, ls.y, lh.x, lh.y);
    } else {
      line(c, ls.x, ls.y, lh.x, lh.y, 4, OUT);
      line(c, rs.x, rs.y, rh.x, rh.y, 4, OUT);
      beatArm(c, P, ls.x, ls.y, lh.x, lh.y, false, false);
      beatArm(c, P, rs.x, rs.y, rh.x, rh.y, false, false);
    }
  }

  if (d) beatHeadSide(c, look, P, x, cy, d, mouth, t, lift);
  else if (back) beatHeadBack(c, look, P, x, cy, t);
  else beatHeadFront(c, look, P, x, cy, st, mouth, t, lift);

  if (st === 'release') {
    /* 오른팔을 머리 옆으로 쭉 — 머리 위에 겹쳐 그려야 팔이 보인다 */
    const sx = x + 7, sy = by + 2, hx = x + 15, hyy = fy - 38 + drop;
    line(c, sx, sy, hx, hyy, 4, OUT);
    const mx = sx + (hx - sx) * 0.4, my = sy + (hyy - sy) * 0.4;
    line(c, sx, sy, mx, my, 2, P.shirt);
    line(c, mx, my, hx, hyy, 2, P.skin);
    sprite(c, hx - 3, hyy - 6, PALM, { o: OUT, s: P.skin });
  }
  return { l: lh, r: rh };
}

/* ---------- 줄 ---------- */
/**
 * 줄의 모양. 손은 아이와 같이 움직이지만 **줄의 맨 아래는 땅에 붙어 있다** —
 * 그래야 뛰어올랐을 때 발밑으로 줄이 지나가는 게 보인다.
 */
export function ropeGeom(hands, x, groundY, theta) {
  const topY = groundY - 62, botY = groundY + 1;
  const midY = (topY + botY) / 2, R = (botY - topY) / 2;
  const apex = { x: x - 0.5 + Math.sin(theta) * 1.5, y: midY - R * Math.cos(theta) };
  const p0 = { x: hands.l.x + 0.5, y: hands.l.y + 1 }, p2 = { x: hands.r.x + 1.5, y: hands.r.y + 1 };
  /* 3차 곡선 — 줄이 위·아래로 뻗었을 때 손보다 바깥으로 불룩한 고리가 된다(진짜 줄넘기 모양) */
  const B = 15 * Math.abs(Math.cos(theta));
  const cy = (8 * apex.y - p0.y - p2.y) / 6;
  const c1 = { x: p0.x - B, y: cy }, c2 = { x: p2.x + B, y: cy };
  return { p0, p2, apex, c1, c2, depth: Math.sin(theta) };
}

/** 곡선 위의 칸들 (빈틈 없이) */
function ropePts(g) {
  const pts = [];
  let last = null;
  const N = 140;
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    let x, y;
    if (g.c1) {
      const a = (1 - u) ** 3, b = 3 * u * (1 - u) ** 2, e = 3 * u * u * (1 - u), d = u ** 3;
      x = Math.floor(a * g.p0.x + b * g.c1.x + e * g.c2.x + d * g.p2.x);
      y = Math.floor(a * g.p0.y + b * g.c1.y + e * g.c2.y + d * g.p2.y);
    } else {
      const a = (1 - u) * (1 - u), b = 2 * u * (1 - u), d = u * u;
      x = Math.floor(a * g.p0.x + b * g.c.x + d * g.p2.x);
      y = Math.floor(a * g.p0.y + b * g.c.y + d * g.p2.y);
    }
    if (last && last.x === x && last.y === y) continue;
    pts.push({ x, y });
    last = { x, y };
  }
  return pts;
}
const RAINBOW = ['#ff4d4d', '#ff9a1a', '#ffe14d', '#4dd27a', '#4dc3ff', '#5a6dff', '#c45cff'];
function ropeColor(rope, i, n, t) {
  switch (rope.pattern) {
    case 'stripe': return Math.floor((i + t * 24) / 3) % 2 ? rope.c2 : rope.c1;
    case 'dots': return (i + Math.floor(t * 16)) % 5 === 0 ? rope.c2 : rope.c1;
    case 'rainbow': return RAINBOW[Math.floor((i + t * 18) / 3) % 7];
    case 'gradient': { const k = Math.abs(i / Math.max(1, n - 1) - 0.5) * 2; return k < 0.35 ? rope.c2 : k < 0.7 ? tone(rope.c1, 0.25) : rope.c1; }
    case 'beads': { const pal = [rope.c1, rope.c2, '#ffe066', '#ffffff']; return pal[Math.floor(i / 2) % 4]; }
    default: return rope.c1;
  }
}
/**
 * 줄 한 가닥. 앞쪽(아이 앞)은 굵게(2칸 + 외곽선), 뒤쪽은 가늘게(1칸).
 * ghost = 잔상 — 반투명 대신 한 칸 걸러 찍는다(도트 문법).
 */
export function drawRope(c, rope, g, t, ghost = false) {
  const pts = ropePts(g);
  const n = pts.length;
  const front = g.depth >= 0;
  const edge = rope.pattern === 'glow' || rope.glow ? rope.c2 : OUT;
  if (ghost) {
    for (let i = 0; i < n; i += 2) px(c, pts[i].x, pts[i].y, tone(rope.c1, -0.2));
    return;
  }
  if (front) {
    for (const p of pts) rect(c, p.x - 1, p.y - 1, 4, 4, edge);
    for (let i = 0; i < n; i++) {
      const col = ropeColor(rope, i, n, t);
      rect(c, pts[i].x, pts[i].y, 2, 1, col);
      rect(c, pts[i].x, pts[i].y + 1, 2, 1, tone(col, -0.22));
    }
  } else {
    for (const p of pts) rect(c, p.x - 1, p.y - 1, 3, 3, edge === OUT ? OUT : tone(edge, -0.3));
    for (let i = 0; i < n; i++) px(c, pts[i].x, pts[i].y, tone(ropeColor(rope, i, n, t), -0.25));
  }
}

/** 손잡이 — 손 위에 (세로 막대) */
export function drawHandles(c, rope, hands) {
  for (const h of [hands.l, hands.r]) {
    rect(c, h.x - 1, h.y - 4, 4, 8, OUT);
    rect(c, h.x, h.y - 3, 2, 6, rope.handle);
    rect(c, h.x, h.y - 3, 1, 6, tone(rope.handle, 0.35));
    rect(c, h.x, h.y + 2, 2, 1, tone(rope.handle, -0.3));
  }
}

/* ---------- 꼬리 효과 알갱이 (도트) ---------- */
const P_COL = { spark: '#fff6b0', star: '#ffe066', heart: '#ff6fa8', fire: '#ff8a1a', bubble: '#bff0ff', snow: '#ffffff', note: '#ffffff', leaf: '#6fcf6a', thunder: '#ffe14d', candy: '#ffb3de', dust: '#f4ead8', confetti: '#ff4d4d' };
export function drawParticle(c, p) {
  if (p.age / p.life > 0.85 && Math.floor(p.age * 30) % 2) return;   // 사라질 때 깜빡
  const x = ro(p.x), y = ro(p.y);
  const col = p.color || P_COL[p.kind] || '#fff';
  switch (p.kind) {
    case 'spark': sprite(c, x - 1, y - 1, SPR.spark, { w: col }); break;
    case 'star': case 'candy': sprite(c, x - 2, y - 2, SPR.starS, { y: col }); break;
    case 'heart': sprite(c, x - 2, y - 2, SPR.heartS, { r: col }); break;
    case 'fire': rect(c, x - 1, y - 1, 2, 3, col); px(c, x, y, '#fff3a0'); break;
    case 'bubble': px(c, x - 1, y, col); px(c, x + 1, y, col); px(c, x, y - 1, col); px(c, x, y + 1, col); break;
    case 'snow': px(c, x, y, col); px(c, x - 1, y, '#dff4ff'); px(c, x + 1, y, '#dff4ff'); px(c, x, y - 1, '#dff4ff'); px(c, x, y + 1, '#dff4ff'); break;
    case 'note': sprite(c, x - 2, y - 2, SPR.note, { o: col }); break;
    case 'leaf': rect(c, x - 1, y, 3, 1, col); px(c, x, y - 1, tone(col, 0.3)); break;
    case 'thunder': px(c, x, y - 2, col); px(c, x - 1, y - 1, col); px(c, x, y, col); px(c, x + 1, y, col); px(c, x, y + 1, col); break;
    case 'dust': rect(c, x, y, 2, 1, col); break;
    default: rect(c, x, y, 2, 2, col);
  }
}

/* ---------- 배경 10 (도트) ---------- */
const bgCache = new Map();
/** 움직이는 것(구름 · 비 · 눈 · 별 · 물결 · 조명)만 매 프레임 그리고 나머지는 구워 둔다 */
export function drawBg(c, theme, W, H, gy, t) {
  const key = `${theme}:${W}x${H}:${gy}`;
  let base = bgCache.get(key);
  if (!base) {
    if (bgCache.size > 16) bgCache.clear();
    base = canvas(W, H);
    paintStatic(base.getContext('2d'), theme, W, H, gy);
    bgCache.set(key, base);
  }
  c.drawImage(base, 0, 0);
  paintMoving(c, theme, W, H, gy, t);
}

function rng(seed) { let a = seed | 0 || 1; return () => { a = (a * 16807) % 2147483647; return (a - 1) / 2147483646; }; }
/** 계단식 하늘 — 띠 사이 두 줄은 바둑판으로 섞는다 */
function bands(c, W, y0, y1, cols) {
  const n = cols.length, h = (y1 - y0) / n;
  for (let i = 0; i < n; i++) rect(c, 0, y0 + ro(i * h), W, ro((i + 1) * h) - ro(i * h), cols[i]);
  for (let i = 1; i < n; i++) {
    const y = y0 + ro(i * h);
    for (let x = 0; x < W; x++) { if (x % 2 === 0) px(c, x, y - 1, cols[i]); if (x % 2 === 1) px(c, x, y, cols[i - 1]); }
  }
}
function cloud(c, x, y, w) {
  const h = 4 + Math.floor(w / 8);
  rbox(c, x, y + 2, w, h, '#ffffff', 2);
  rbox(c, x + ro(w * 0.2), y, ro(w * 0.45), h, '#ffffff', 2);
  rbox(c, x + ro(w * 0.5), y - 2, ro(w * 0.35), h, '#ffffff', 2);
  rect(c, x + 2, y + h + 1, w - 4, 1, '#cfe6f5');
}
function tree(c, x, gy, r, col) {
  rect(c, x - 2, gy - r - 3, 4, r + 3, OUT); rect(c, x - 1, gy - r - 2, 2, r + 2, '#7a4a24');
  oval(c, x, gy - r * 2, r + 1, r + 1, OUT);
  oval(c, x, gy - r * 2, r, r, col);
  oval(c, x - r * 0.3, gy - r * 2 - r * 0.3, r * 0.5, r * 0.45, tone(col, 0.25));
  oval(c, x + r * 0.35, gy - r * 1.7, r * 0.4, r * 0.3, tone(col, -0.25));
}
function house(c, x, gy, w, h, wall, roof, snow, lit = '#ffe9a8') {
  obox(c, x, gy - h, w, h, wall, 0, false);
  for (let i = 0; i <= ro(w / 2) + 2; i++) {
    const rw = w + 4 - i * 2;
    if (rw <= 0) break;
    rect(c, x - 2 + i, gy - h - 1 - i, rw, 1, i === 0 ? OUT : (snow && i < 3 ? '#ffffff' : roof));
    px(c, x - 2 + i, gy - h - 1 - i, OUT); px(c, x - 2 + i + rw - 1, gy - h - 1 - i, OUT);
  }
  const ww = Math.max(2, ro(w * 0.22));
  obox(c, x + ro(w * 0.18), gy - ro(h * 0.7), ww, ww, lit, 0, false);
  obox(c, x + w - ro(w * 0.18) - ww, gy - ro(h * 0.7), ww, ww, lit, 0, false);
  obox(c, x + ro(w / 2) - 2, gy - ro(h * 0.45), 4, ro(h * 0.45), tone(wall, -0.4), 0, false);
}
function groundTex(c, W, H, gy, base, top, dot) {
  rect(c, 0, gy, W, H - gy, base);
  rect(c, 0, gy, W, 1, top);
  rect(c, 0, gy + 1, W, 1, tone(base, -0.15));
  const R = rng(gy * 7 + W);
  for (let i = 0; i < (W * (H - gy)) / 40; i++) rect(c, ro(R() * W), gy + 3 + ro(R() * (H - gy - 3)), 2, 1, dot);
}

function paintStatic(c, theme, W, H, gy) {
  const R = rng(theme * 131 + 17);
  const cx = Math.floor(W / 2);
  switch (theme) {
    case 0: { // 동네 운동장
      bands(c, W, 0, gy, ['#5fb4f5', '#78c3f8', '#95d2fa', '#b4e1fc', '#d2eefe']);
      oval(c, W - 24, 60, 10, 10, '#fff3a0'); oval(c, W - 24, 60, 7, 7, '#fffbe0');
      hills(c, W, gy - 20, 30, '#8fcf8a', 9, 1);
      hills(c, W, gy - 20, 18, '#6fbf6a', 6, 4);
      for (let x = -6; x < W; x += 26) house(c, x + ro(R() * 6), gy - 22, 18 + ro(R() * 6), 12 + ro(R() * 10), ['#f2c6a0', '#c9d8f0', '#f0e0b0', '#e8b8b8'][ro(R() * 3)], ['#c8402e', '#3a6fd8', '#8a5a2a'][ro(R() * 2)], false);
      rect(c, 0, gy - 22, W, 1, '#4b5560');
      for (let x = 0; x < W; x += 4) { px(c, x, gy - 21 + (x % 8 === 0 ? 0 : 1), '#7d8894'); for (let y = gy - 20; y < gy; y += 4) { px(c, x + 1, y, '#9aa5b0'); px(c, x + 3, y + 2, '#9aa5b0'); } }
      for (let x = 0; x < W; x += 20) rect(c, x, gy - 22, 1, 22, '#4b5560');
      groundTex(c, W, H, gy, '#5cb85c', '#8ee08e', '#4a9d4a');
      oval(c, cx, gy + 7, Math.min(W / 2 - 4, 60), 6, '#c9a26b'); oval(c, cx, gy + 7, Math.min(W / 2 - 6, 56), 4, '#d8b47c');
      break;
    }
    case 1: { // 놀이터
      bands(c, W, 0, gy, ['#7cc6ff', '#97d3ff', '#b2e0ff', '#cdecff']);
      hills(c, W, gy - 6, 40, '#9ad49a', 10, 2);
      hills(c, W, gy - 6, 24, '#7cc47c', 7, 5);
      for (let x = 6; x < W; x += 34) tree(c, x + ro(R() * 10), gy - 8, 9 + ro(R() * 3), '#4caf50');
      const sx = cx - 60;
      for (const xx of [sx, sx + 16]) { rect(c, xx - 1, gy - 46, 4, 46, OUT); rect(c, xx, gy - 45, 2, 45, '#ffd23f'); }
      for (let y = gy - 40; y < gy; y += 8) { rect(c, sx, y, 18, 2, OUT); rect(c, sx + 1, y, 16, 1, '#ffd23f'); }
      obox(c, sx - 2, gy - 50, 22, 4, '#e8423a', 0);
      for (let i = 0; i < 40; i++) { rect(c, sx + 18 + i, gy - 48 + i, 6, 2, i % 6 < 3 ? '#e8423a' : '#ff6b5c'); px(c, sx + 18 + i, gy - 49 + i, OUT); }
      const wx = cx + 34;
      line(c, wx, gy, wx + 8, gy - 48, 3, OUT); line(c, wx + 42, gy, wx + 34, gy - 48, 3, OUT);
      line(c, wx, gy, wx + 8, gy - 48, 1, '#3a7be8'); line(c, wx + 42, gy, wx + 34, gy - 48, 1, '#3a7be8');
      rect(c, wx + 6, gy - 50, 31, 3, OUT); rect(c, wx + 7, gy - 49, 29, 1, '#3a7be8');
      for (const ox of [12, 26]) { rect(c, wx + ox, gy - 47, 1, 30, '#555'); obox(c, wx + ox - 3, gy - 17, 7, 2, '#c8402e', 0, false); }
      groundTex(c, W, H, gy, '#f0d9a0', '#fff0c8', '#d9bf84');
      break;
    }
    case 2: { // 학교 체육관
      rect(c, 0, 0, W, gy, '#f0dcb4');
      for (let y = 0; y < gy - 34; y += 6) rect(c, 0, y, W, 1, '#e4cda2');
      for (let x = 8; x < W; x += 34) { obox(c, x, 14, 22, 26, '#9fd8ff', 0, false); rect(c, x + 10, 14, 2, 26, '#ffffff'); rect(c, x, 26, 22, 2, '#ffffff'); rect(c, x + 2, 16, 4, 4, '#d4f0ff'); }
      rect(c, 0, gy - 34, W, 34, '#c49a62'); for (let x = 0; x < W; x += 10) rect(c, x, gy - 34, 1, 34, '#a8814e');
      rect(c, 0, gy - 35, W, 2, OUT);
      obox(c, W - 40, 50, 28, 18, '#ffffff', 0, false); rect(c, W - 32, 57, 12, 8, '#e8423a'); rect(c, W - 31, 58, 10, 6, '#ffffff');
      rect(c, W - 33, 69, 14, 2, '#ff7a1a'); for (let k = 0; k < 5; k++) px(c, W - 32 + k * 3, 71 + (k % 2), '#ffffff');
      obox(c, 10, 52, 36, 16, '#222222', 0, false);
      for (const [dx, col] of [[4, '#ff4d4d'], [20, '#ff4d4d']]) rect(c, 10 + dx, 56, 10, 8, '#3a0a0a'), rect(c, 10 + dx + 2, 58, 6, 4, col);
      groundTex(c, W, H, gy, '#d9a35f', '#f0c080', '#c48c4a');
      for (let y = gy + 6; y < H; y += 6) rect(c, 0, y, W, 1, '#c48c4a');
      oval(c, cx, gy + 14, 40, 7, '#ffffff'); oval(c, cx, gy + 14, 38, 5, '#d9a35f');
      break;
    }
    case 3: { // 분수 공원
      bands(c, W, 0, gy, ['#62bdf7', '#7fcbfa', '#9cd8fc', '#c0e8ff']);
      for (let x = 0; x < W; x += 22) { const h = 40 + ((x * 7) % 26); rect(c, x, gy - 10 - h, 18, h, '#b9d7ee'); for (let yy = gy - 6 - h; yy < gy - 14; yy += 5) for (let xx = x + 2; xx < x + 16; xx += 4) px(c, xx, yy, '#e6f3fc'); }
      hills(c, W, gy - 10, 16, '#7fbf7a', 5, 3);
      for (let x = 4; x < W; x += 28) tree(c, x + ro(R() * 8), gy - 10, 10 + ro(R() * 4), R() < 0.5 ? '#3f9b4a' : '#57b85e');
      obox(c, cx - 30, gy - 14, 60, 8, '#b8b8c8', 0); rect(c, cx - 28, gy - 14, 56, 2, '#7fd0ff');
      obox(c, cx - 4, gy - 30, 8, 16, '#9a9aac', 0);
      obox(c, cx - 12, gy - 32, 24, 3, '#b8b8c8', 0);
      groundTex(c, W, H, gy, '#c8c8d0', '#e4e4ec', '#a8a8b4');
      for (let x = 0; x < W; x += 12) rect(c, x, gy + 2, 1, H - gy, '#b4b4c0');
      for (let i = 0; i < 18; i++) sprite(c, ro(R() * W), gy - 3 - ro(R() * 2), ['.p.', 'pyp', '.g.'], { p: ['#ff6fb1', '#ffe066', '#ffffff'][i % 3], y: '#ffd23f', g: '#2e8b3a' });
      break;
    }
    case 4: { // 여름 바닷가
      bands(c, W, 0, gy - 24, ['#3fb2ff', '#5cc0ff', '#7ccdff', '#a2dcff']);
      oval(c, 24, 24, 11, 11, '#ffd23f'); oval(c, 24, 24, 8, 8, '#fff3a0');
      bands(c, W, gy - 24, gy, ['#1e7fd8', '#2a90e6', '#3aa0f0']);
      groundTex(c, W, H, gy, '#f7dc9a', '#fff0c0', '#e0c27c');
      const px0 = cx - 56;
      rect(c, px0, gy - 36, 2, 38, '#7a4a24');
      for (let i = 0; i < 12; i++) { const w = 4 + i * 3; rect(c, px0 + 1 - w / 2, gy - 48 + i, w, 1, Math.floor((i + 0) / 1) % 2 ? '#e8423a' : '#e8423a'); }
      for (let i = 0; i < 12; i++) { const w = 4 + i * 3; for (let k = 0; k < w; k++) if (Math.floor((k / w) * 6) % 2) px(c, px0 + 1 - w / 2 + k, gy - 48 + i, '#ffffff'); }
      rect(c, px0 - 18, gy - 37, 38, 1, OUT);
      const tx = cx + 58;
      for (let i = 0; i < 46; i++) { const bx = tx + ro(Math.sin(i / 14) * 4); rect(c, bx - 2, gy - i, 5, 1, OUT); rect(c, bx - 1, gy - i, 3, 1, i % 5 === 0 ? '#6b3f1d' : '#8d5a3b'); }
      for (let a = 0; a < 5; a++) { const ang = -2.8 + a * 0.95; for (let k = 0; k < 16; k++) { const lx = tx + ro(Math.cos(ang) * k), ly = gy - 46 + ro(Math.sin(ang) * k * 0.55 + k * k * 0.03); rect(c, lx - 1, ly - 1, 3, 3, OUT); rect(c, lx, ly, 2, 1, '#2e9b46'); } }
      break;
    }
    case 5: { // 노을 옥상
      bands(c, W, 0, gy, ['#3b1e5c', '#6b2a6b', '#a83d6e', '#e0566b', '#ff8a4d', '#ffb35c']);
      oval(c, cx + 30, gy - 40, 14, 14, '#ffd27a'); oval(c, cx + 30, gy - 40, 11, 11, '#fff0b0');
      for (let x = -4; x < W;) {
        const w = 14 + ro(R() * 12), h = 30 + ro(R() * 60);
        rect(c, x, gy - 18 - h, w, h + 18, '#33204a');
        rect(c, x, gy - 18 - h, w, 1, '#4a3166');
        for (let yy = gy - 14 - h; yy < gy - 22; yy += 5) for (let xx = x + 2; xx < x + w - 2; xx += 4) if (R() < 0.4) rect(c, xx, yy, 2, 2, '#ffcf6b');
        x += w + 1 + ro(R() * 3);
      }
      rect(c, 0, gy - 10, W, 10, '#6e6e7e'); rect(c, 0, gy - 10, W, 1, '#8e8e9e');
      rect(c, 0, gy - 20, W, 2, OUT); rect(c, 0, gy - 20, W, 1, '#5a5a68');
      for (let x = 0; x < W; x += 10) rect(c, x, gy - 20, 1, 10, '#4a4a58');
      groundTex(c, W, H, gy, '#8a8a98', '#a8a8b8', '#76768a');
      break;
    }
    case 6: { // 비 오는 날
      bands(c, W, 0, gy, ['#4e5a68', '#5d6a79', '#6d7a89', '#7f8c9a']);
      for (let x = -4; x < W;) { const w = 16 + ro(R() * 14), h = 26 + ro(R() * 40); rect(c, x, gy - h, w, h, '#5a6674'); rect(c, x, gy - h, w, 1, '#6c7886'); for (let yy = gy - h + 4; yy < gy - 4; yy += 6) for (let xx = x + 2; xx < x + w - 2; xx += 5) if (R() < 0.3) rect(c, xx, yy, 2, 2, '#c8d4a0'); x += w + 2; }
      for (let i = 0; i < 5; i++) { const x = ro(R() * W), y = 10 + ro(R() * 20); rbox(c, x - 22, y, 44, 10, '#3e4855', 4); rbox(c, x - 12, y - 5, 26, 10, '#3e4855', 4); }
      groundTex(c, W, H, gy, '#47525e', '#5f6b78', '#3a444f');
      for (let i = 0; i < 4; i++) { const x = ro(R() * W); oval(c, x, gy + 8 + ro(R() * 14), 14, 2, '#6f8296'); }
      break;
    }
    case 7: { // 별빛 밤하늘
      bands(c, W, 0, gy, ['#070a24', '#0d1236', '#141b48', '#1c255a', '#26306b']);
      oval(c, W - 26, 30, 10, 10, '#fff6c8'); oval(c, W - 22, 27, 8, 8, '#0d1236');
      const hill = [];
      for (let x = 0; x < W; x++) hill.push(gy - 10 - ro(Math.sin(x * 0.045) * 7 + Math.sin(x * 0.11) * 3));
      for (let x = 0; x < W; x++) { rect(c, x, hill[x], 1, gy - hill[x], '#141f48'); px(c, x, hill[x], '#26336e'); }
      groundTex(c, W, H, gy, '#1d3a2a', '#2f5a40', '#16301f');
      break;
    }
    case 8: { // 눈 오는 마을
      bands(c, W, 0, gy, ['#8aa3c6', '#9fb6d6', '#b6c9e3', '#ccdaee', '#e0e9f6']);
      for (let x = -8; x < W; x += 30) house(c, x + ro(R() * 6), gy - 4, 20 + ro(R() * 6), 14 + ro(R() * 8), ['#c86b4a', '#8a6fb8', '#5b8db8'][ro(R() * 2)], '#6b3f1d', true);
      for (let i = 0; i < 5; i++) {
        const x = ro(R() * W), h = 16 + ro(R() * 8);
        for (let k = 0; k < h; k++) { const w = 2 + Math.floor(k * 0.6) * 2; rect(c, x - w / 2 - 1, gy - 4 - h + k, w + 2, 1, OUT); rect(c, x - w / 2, gy - 4 - h + k, w, 1, k % 5 < 1 ? '#ffffff' : '#2f6b3f'); }
        rect(c, x - 1, gy - 4, 2, 4, '#6b3f1d');
      }
      groundTex(c, W, H, gy, '#f4f8fc', '#ffffff', '#dce6f0');
      break;
    }
    case 9: { // 줄넘기 대회
      bands(c, W, 0, gy, ['#140a26', '#1d1036', '#2a1748', '#3a2060']);
      for (let row = 0; row < 3; row++) for (let x = (row % 2) * 4; x < W; x += 8) { const y = gy - 34 + row * 9; oval(c, x + 0.5, y, 3, 3.5, ['#2b1a45', '#34204f', '#3e2660'][row]); rect(c, x - 3, y + 3, 7, 4, ['#2b1a45', '#34204f', '#3e2660'][row]); }
      obox(c, cx - 50, 26, 100, 16, '#d7263d', 0);
      rect(c, cx - 50, 26, 100, 1, '#ffd700'); rect(c, cx - 50, 41, 100, 1, '#ffd700');
      for (let k = 0; k < 9; k++) sprite(c, cx - 46 + k * 11, 31, ['..y..', '.yyy.', 'yyyyy', '.yyy.', 'y...y'], { y: '#ffd700' });
      groundTex(c, W, H, gy, '#a0522d', '#c87040', '#86421f');
      for (let x = 0; x < W; x += 14) rect(c, x, gy + 2, 1, H - gy, '#7a3c1e');
      break;
    }
    default: bands(c, W, 0, gy, ['#87ceeb', '#b0e0f0']); groundTex(c, W, H, gy, '#5cb85c', '#8ee08e', '#4a9d4a');
  }
}

function paintMoving(c, theme, W, H, gy, t) {
  const cx = Math.floor(W / 2);
  if (theme === 0 || theme === 1 || theme === 3 || theme === 4) {
    for (let i = 0; i < 3; i++) {
      const w = 22 + i * 6;
      const x = ro(((t * (3 + i) + i * 70) % (W + 60)) - 40);
      cloud(c, x, 46 + i * 17, w);
    }
  }
  if (theme === 3) { // 분수 물
    const f = Math.floor(t * 8) % 3;
    for (let i = -2; i <= 2; i++) {
      for (let k = 0; k < 12; k++) {
        const u = k / 11, xx = cx + ro(i * 9 * u), yy = gy - 33 - ro(Math.sin(u * Math.PI) * (14 - Math.abs(i) * 2)) + ro(u * 18);
        if ((k + f) % 3 !== 0) px(c, xx, yy, k % 2 ? '#bfe8ff' : '#ffffff');
      }
    }
  }
  if (theme === 4) { // 물결
    for (let row = 0; row < 3; row++) for (let x = 0; x < W; x += 9) { const xx = ro((x + t * (6 + row * 3)) % (W + 9)) - 4; rect(c, xx, gy - 20 + row * 7, 4, 1, '#ffffff'); }
  }
  if (theme === 6) { // 비
    for (let i = 0; i < 60; i++) {
      const x = ro((i * 37.7 + t * 30) % (W + 20)) - 10, y = ro((i * 61.3 + t * 190) % H);
      px(c, x, y, '#b9cbe0'); px(c, x - 1, y + 1, '#b9cbe0'); px(c, x - 1, y + 2, '#8fa3ba');
    }
  }
  if (theme === 7) { // 별 · 반딧불
    for (let i = 0; i < 40; i++) {
      const x = (i * 53) % W, y = (i * 29) % Math.max(1, gy - 30);
      const on = (Math.floor(t * 2 + i * 0.7) % 4) !== 0;
      if (on) px(c, x, y, i % 5 ? '#fffbe0' : '#bfe8ff');
      if (i % 9 === 0 && on) { px(c, x - 1, y, '#8a92c8'); px(c, x + 1, y, '#8a92c8'); px(c, x, y - 1, '#8a92c8'); px(c, x, y + 1, '#8a92c8'); }
    }
    for (let i = 0; i < 6; i++) {
      const x = ro((i * 41 + Math.sin(t * 0.6 + i) * 12 + W) % W), y = gy - 6 - ro((i * 13 + t * 4) % 28);
      if (Math.floor(t * 3 + i) % 3) px(c, x, y, '#d8ff7a');
    }
  }
  if (theme === 8) { // 눈
    for (let i = 0; i < 50; i++) {
      const x = ro((i * 47.1 + Math.sin(t + i) * 6 + W) % W), y = ro((i * 33.7 + t * (12 + (i % 4) * 4)) % H);
      if (i % 3) px(c, x, y, '#ffffff'); else rect(c, x, y, 2, 2, '#ffffff');
    }
  }
  if (theme === 9) { // 조명 — 디더링 빛 기둥
    for (let i = 0; i < 3; i++) {
      const ox = ro(W * (0.2 + i * 0.3) + Math.sin(t * 0.8 + i * 2) * 20);
      for (let y = 44; y < gy; y += 1) {
        const w = 4 + ro((y - 44) * 0.35);
        for (let x = -w; x <= w; x++) if ((x + y) % 3 === 0) px(c, ox + x, y, '#fff6c0');
      }
    }
  }
}

/* ---------- 화면용 작은 도트 그림 (CSS 로 정수배 확대 · pixelated) ---------- */
function finish(cv, scale, cls) {
  cv.style.width = `${cv.width * scale}px`;
  cv.style.height = `${cv.height * scale}px`;
  cv.style.imageRendering = 'pixelated';
  if (cls) cv.className = cls;
  return cv;
}

/** 서 있는 아이 + 줄 (도트 W x H, CSS 로 scale 배) */
export function figureCanvas(lookIn, rope, scale = 2, opt = {}) {
  const look = typeof lookIn === 'string' ? decodeLook(lookIn) : lookIn;
  const W = opt.w || 40, Hh = opt.h || 50;
  const cv = canvas(W, Hh);
  const c = cv.getContext('2d');
  /* focus: 'head' = 얼굴·모자만, 'body' = 몸·다리·신발만 (꾸미기 칸) */
  const gy = opt.focus === 'head' ? Hh + 19 : opt.focus === 'body' ? Hh - 1 : Hh - 2;
  const x = Math.floor(W / 2);
  const theta = opt.theta ?? 1.6 * Math.PI;
  /* lift · tuck · crouch · spin · t 는 미리보기용(가면 시트 등) — 안 주면 예전과 같다 */
  const lift = opt.lift || 0, t = opt.t ?? 1;
  const pre = kidHands(theta, x, gy, lift, opt.crouch || 0, opt.state || 'stand', t, opt.spin || 0);
  if (rope) { const g = ropeGeom(pre, x, gy, theta); if (g.depth < 0) drawRope(c, rope, g, 0); }
  const hh = drawKid(c, x, gy, look, { theta, t, state: opt.state, mouth: opt.mouth, lift, tuck: opt.tuck, crouch: opt.crouch, spin: opt.spin });
  if (rope) { const g = ropeGeom(hh, x, gy, theta); if (g.depth >= 0) drawRope(c, rope, g, 0); drawHandles(c, rope, hh); }
  return finish(cv, scale);
}

/** 로비에서 혼자 줄넘기하는 아이 — 일정한 박자로 계속 뛴다. 반드시 stop() */
export function animFigure(lookIn, rope, scale = 2, w = 44, h = 70) {
  const look = typeof lookIn === 'string' ? decodeLook(lookIn) : lookIn;
  const cv = finish(canvas(w, h), scale);
  const c = cv.getContext('2d');
  const gy = h - 3;
  const x = Math.floor(w / 2);
  const PERIOD = 0.8;
  let raf = 0, t0 = 0, alive = true, lastF = -1;
  const frame = (now) => {
    if (!alive) return;
    if (!t0) t0 = now;
    const t = (now - t0) / 1000;
    const f = Math.floor(t * 24);                    // 도트 애니메이션 — 초당 24장이면 충분
    if (f !== lastF) {
      lastF = f;
      const ph = (t % PERIOD) / PERIOD;
      const theta = Math.PI + ph * TAU;
      const jp = ((t + 0.2) % PERIOD) / 0.4;
      const lift = jp < 1 ? ro(Math.sin(jp * Math.PI) * 9) : 0;
      c.clearRect(0, 0, w, h);
      rect(c, x - 9 + Math.floor(lift / 3), gy, 18 - Math.floor(lift / 3) * 2, 2, 'rgba(0,0,0,0.3)');
      const pre = kidHands(theta, x, gy, lift);
      const g0 = ropeGeom(pre, x, gy, theta);
      if (g0.depth < 0 && rope) drawRope(c, rope, g0, t);
      const hh = drawKid(c, x, gy, look, { theta, lift, tuck: lift > 3 ? 1 : 0, t });
      if (rope) { const g = ropeGeom(hh, x, gy, theta); if (g.depth >= 0) drawRope(c, rope, g, t); drawHandles(c, rope, hh); }
    }
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return { cv, stop() { alive = false; cancelAnimationFrame(raf); } };
}

/** 얼굴(모자 포함) — 명예의 전당 줄 (도트 24x24) */
export function headIcon(lookIn, scale = 2) {
  const look = typeof lookIn === 'string' ? decodeLook(lookIn) : lookIn;
  const cv = canvas(24, 20);
  const c = cv.getContext('2d');
  drawKid(c, 12, 20 + 22, look, { t: 1 });
  return finish(cv, scale);
}

/** 줄넘기 한 개 — 고리 + 손잡이 둘 (도트 22x22) */
export function ropeIcon(rope, scale = 2) {
  const cv = canvas(22, 22);
  const c = cv.getContext('2d');
  const g = { p0: { x: 5, y: 7 }, p2: { x: 16, y: 7 }, c: { x: 10.5, y: 36 }, depth: 1 };
  drawRope(c, rope, g, 0);
  for (const hx of [4, 15]) { rect(c, hx - 1, 1, 4, 9, OUT); rect(c, hx, 2, 2, 7, rope.handle); rect(c, hx, 2, 1, 7, tone(rope.handle, 0.35)); }
  if (rope.trail) drawParticle(c, { kind: rope.trail, x: 18, y: 17, age: 0, life: 1, color: rope.trail === 'note' ? '#333333' : undefined });
  return finish(cv, scale);
}

/** 별사탕(돈) — 도트 8x8 */
export function candyIcon(scale = 2) {
  const cv = canvas(8, 8);
  sprite(cv.getContext('2d'), 0, 0, [
    '...oo...', '..opqo..', 'oopppqoo', 'opwppppo', '.oppppo.', '.opqqpo.', 'opqoopqo', 'ooo..ooo',
  ], { o: '#7a2a52', p: '#ff9ad5', q: '#e0609e', w: '#ffffff' });
  return finish(cv, scale, 'jr-candy-ic');
}

/** 아이템 — 도트 16x16 */
export function itemIcon(id, scale = 2) {
  const cv = canvas(16, 16);
  const c = cv.getContext('2d');
  if (id === 'shield') sprite(c, 1, 0, [
    '.ooooooooooooo.', 'obbbbbbbbbbbbbo', 'obllbbbbbbbbbbo', 'oblbbbbwbbbbbbo', 'obbbbbwwwbbbbbo', 'obbbbwwwwwbbbbo', 'obbbbbwwwbbbbbo', 'obbbbbwbwbbbbbo',
    '.obbbbbbbbbbbo.', '.obbbbbbbbbbdo.', '..obbbbbbbbdo..', '...obbbbbbdo...', '....obbbbdo....', '.....obbdo.....', '......ooo......',
  ], { o: OUT, b: '#4d9cff', l: '#b8dcff', w: '#ffffff', d: '#2a64c8' });
  else if (id === 'heart') sprite(c, 0, 1, [
    '..ooo....ooo....', '.orrro..orrro...', 'orwrrroorrrrro..', 'orwrrrrrrrrrro..', 'orrrrrrrrrrrro..', 'orrrrrrrrwwrro..', '.orrrrrrwwwwro..', '..orrrrrrwwro...',
    '...orrrrrrro....', '....orrrrro.....', '.....orrro......', '......oro.......', '.......o........',
  ], { o: OUT, r: '#ff4d6d', w: '#ffffff' });
  else sprite(c, 0, 0, [
    '.......oo.......', '......oppo......', '......oppo......', '.....oppppo.....', 'ooooooppwpoooooo', 'oppppppwwppppppo', '.oppppppppppppo.', '..oppppppppppo..',
    '...oppppppppo...', '...opppqqpppo...', '..oppppoopppo...', '..opppo..oppo...', '.oppqo....oqppo.', '.oqqo......oqqo.', '.ooo........ooo.',
  ], { o: '#7a2a52', p: '#ff9ad5', q: '#e0609e', w: '#ffffff' });
  return finish(cv, scale);
}

/** 스테이지 고르기 칸 그림 (도트 W x H) */
export function stageThumb(theme, w = 120, h = 66, scale = 1) {
  const cv = canvas(w, h);
  const c = cv.getContext('2d');
  const gy = h - 14;
  paintStatic(c, theme, w, h, gy);
  paintMoving(c, theme, w, h, gy, 3);
  return finish(cv, scale);
}

/** 배너 굽기 전용(tools/build-jumppiano-banner.mjs) — 가면을 정면으로 그린다. layer 'behind' = 머리 뒤(오라 · 끈), 그 밖 = 얼굴 위 · 왕관. 게임에서는 쓰지 않는다 */
export function bannerMask(c, m, x, cy, layer, t = 0.4) {
  if (layer === 'behind') maskBehind(c, m, x, cy, t, 'f', 1);
  else { maskFace(c, m, x, cy, t, 'stand', 'f', 1); maskTop(c, m, x, cy, t, 'f', 1); }
}
