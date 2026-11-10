/**
 * 양쪽 성 (겜부장 · v2) — 112 × 176칸, 기준점 발 가운데. 체력 단계 hp0 멀쩡 → hp3 크게 무너짐.
 *  - 내 성 「드래곤 둥지 탑」 : 둥근 돌탑 · 철 장식 나무문 · 불 켜진 아치 창 · 드래곤 깃발 · 성가퀴 위 짚 둥지와 알
 *  - 좀비 탑 : 기울어진 어두운 돌 + 판자 · 해골 장식(초록 눈빛) · 판자로 막은 창의 초록 빛 · 찢어진 깃발 · 뾰족 울타리 · 뼈
 * 리더는 둥지 안에 선다 → NEST_FEET_Y (판 위에서부터 리더 발 높이)
 */
import { Pix } from '../art/kit.js';
import { brickCylinder, ditherPick, hash2, line, bayer, mix } from './envkit.js';

export const BASE_W = 112, BASE_H = 176;
export const NEST_FEET_Y = 30;        // 리더 발 위치 (판 위에서부터)
const OUT = '#14082a';

/** 금 · 빠진 벽돌 — 체력 단계가 높을수록 많이 */
function damage(p, hp, seed, area, col = OUT, hole = '#1a1226') {
  const [ax, ay, aw, ah] = area;
  const cracks = [0, 2, 5, 9][hp], holes = [0, 0, 4, 10][hp];
  for (let i = 0; i < cracks; i++) {
    let x = ax + Math.round(hash2(i, 1, seed) * aw), y = ay + Math.round(hash2(i, 2, seed) * ah);
    for (let k = 0; k < 6 + hp * 2; k++) {
      const nx = x + (hash2(i, k, seed + 3) > 0.5 ? 1 : -1), ny = y + 1 + (hash2(i, k, seed + 4) > 0.7 ? 1 : 0);
      line(p, x, y, nx, ny, col); x = nx; y = ny;
    }
  }
  for (let i = 0; i < holes; i++) {
    const x = ax + Math.round(hash2(i, 5, seed) * (aw - 8)), y = ay + Math.round(hash2(i, 6, seed) * (ah - 5));
    p.rect(x, y, 6 + Math.round(hash2(i, 7, seed) * 4), 4, hole);
    p.rect(x, y, 6, 1, '#000000');
  }
}

/* ───────────────────────── 드래곤 둥지 탑 ───────────────────────── */
function nest(hp) {
  const p = new Pix(BASE_W, BASE_H);
  const stone = ['#efe2c8', '#d6c3a0', '#b29c7a', '#8a765c', '#5e4f3e'];
  const mortar = '#4a3c30';
  const tx = 20, tw = 72;                 // 탑 몸통

  /* 주춧돌 (넓고 큰 돌) */
  for (let y = 150; y < 176; y++) for (let x = 6; x < 106; x++) {
    const row = Math.floor((y - 150) / 9), off = row % 2 ? 9 : 0, bx = Math.floor((x - 6 + off) / 18);
    const edge = (y - 150) % 9 === 8 || (x - 6 + off) % 18 === 17;
    if (y < 152 && (x < 8 || x > 103)) continue;
    p.set(x, y, edge ? mortar : ditherPick(stone, 0.25 + ((x - 6) / 100) * 0.6 + (hash2(bx, row, 3) - 0.5) * 0.25, x, y));
  }
  for (let x = 6; x < 106; x++) p.set(x, 150, '#fff4dc');
  /* 원통 몸통 (위로 갈수록 살짝 좁게) */
  brickCylinder(p, tx, 44, tw, 106, stone, mortar, { bh: 7, bw: 14, seed: 1, taper: 3 });
  for (let y = 44; y < 150; y++) { p.set(tx - 1 + Math.round((3 * (150 - y)) / 106), y, OUT); p.set(tx + tw - Math.round((3 * (150 - y)) / 106), y, OUT); }
  /* 받침 띠 (돌림띠) */
  for (const by of [96, 44]) for (let x = tx - 2; x < tx + tw + 2; x++) { p.set(x, by, '#fff4dc'); p.set(x, by + 1, '#c9b48e'); p.set(x, by + 2, '#7a6650'); }

  /* 철 장식 나무문 (아치) */
  const dx = 44, dw = 24, dTop = 118;
  for (let y = dTop - 6; y < 150; y++) for (let x = dx - 4; x < dx + dw + 4; x++) {
    const cx = dx + dw / 2, inArch = y >= dTop || Math.hypot(x + 0.5 - cx, y + 0.5 - dTop) <= dw / 2 + 4;
    if (!inArch) continue;
    const inDoor = y >= dTop ? x >= dx && x < dx + dw : Math.hypot(x + 0.5 - cx, y + 0.5 - dTop) <= dw / 2;
    if (!inDoor) { p.set(x, y, (x + y) % 5 === 0 ? mortar : '#8a765c'); continue; }   // 아치 돌
    const plank = Math.floor((x - dx) / 6), pe = (x - dx) % 6;
    let c = pe === 0 ? '#3a2416' : ['#a0683c', '#8a5632', '#a0683c', '#7a4a2a'][plank % 4];
    if (pe === 1) c = '#c4864e';
    if (y === dTop + 6 || y === dTop + 22) c = '#3c3c48';                 // 철띠
    if ((y === dTop + 6 || y === dTop + 22) && pe === 3) c = '#9aa0b4';     // 못
    p.set(x, y, c);
  }
  if (hp < 3) { p.rect(dx + dw - 6, dTop + 14, 2, 3, '#e8c040'); p.set(dx + dw - 6, dTop + 14, '#fff3a0'); }  // 문고리
  for (let y = 147; y < 150; y++) for (let x = dx - 6; x < dx + dw + 6; x++) p.set(x, y, y === 147 ? '#fff4dc' : '#a3917a');   // 계단

  /* 불 켜진 아치 창 2개 */
  for (const [wx, wy] of [[52, 62], [34, 104]]) {
    for (let y = wy; y < wy + 16; y++) for (let x = wx; x < wx + 10; x++) {
      const inW = y >= wy + 5 || Math.hypot(x + 0.5 - (wx + 5), y + 0.5 - (wy + 5)) <= 5;
      if (!inW) continue;
      const glow = hp >= 3 && wx === 52 ? '#2a1c2a' : ditherPick(['#fff3a0', '#ffd23f', '#e89a2a'], (y - wy) / 16, x, y);
      p.set(x, y, x === wx + 5 || y === wy + 9 ? '#5a3e2a' : glow);        // 창살 십자
    }
    for (let x = wx - 1; x < wx + 11; x++) p.set(x, wy + 16, '#fff4dc');
  }
  /* 드래곤 깃발 (몸통 왼쪽에 늘어진 천) */
  if (hp < 3) {
    const bx = 26, by = 50, bw = 14, bl = hp >= 2 ? 26 : 34;
    for (let y = 0; y < bl; y++) for (let x = 0; x < bw; x++) {
      if (y > bl - 6 && Math.abs(x - bw / 2) < (y - (bl - 6)) * 1.2) continue;   // 아래 V 홈
      const edge = x === 0 || x === bw - 1;
      p.set(bx + x, by + y, edge ? '#8e2a1a' : ditherPick(['#ffb05a', '#ff8a3a', '#d4602a'], x / bw, bx + x, by + y));
    }
    /* 불꽃 문장 */
    for (const [ox, oy] of [[6, 8], [5, 9], [7, 9], [4, 10], [6, 10], [8, 10], [4, 11], [5, 11], [6, 11], [7, 11], [8, 11], [5, 12], [6, 12], [7, 12], [6, 13]]) p.set(bx + ox, by + oy + 2, oy < 10 ? '#fff3a0' : '#ffd23f');
    for (let x = bx - 1; x <= bx + bw; x++) p.set(x, by - 1, '#5a3e2a');
  }
  /* 담쟁이 (왼쪽 아래) */
  for (let i = 0; i < 40; i++) {
    const x = tx + Math.round(hash2(i, 1, 9) * 14), y = 112 + Math.round(hash2(i, 2, 9) * 36);
    p.set(x, y, i % 3 ? '#5aa448' : '#8fd166'); p.set(x + 1, y, '#43863d');
  }

  /* 성가퀴 (꼭대기 테) + 받침 돌 */
  const top = 30;
  for (let y = top + 8; y < 44; y++) for (let x = tx - 6; x < tx + tw + 6; x++) {
    const step = (y - (top + 8)) < 3 ? 0 : 2;
    if (x < tx - 6 + step || x >= tx + tw + 6 - step) continue;
    p.set(x, y, ditherPick(stone, 0.2 + ((x - tx + 6) / (tw + 12)) * 0.7, x, y));
  }
  for (let x = tx - 6; x < tx + tw + 6; x++) { p.set(x, top + 8, '#fff4dc'); p.set(x, 43, mortar); }
  const merlons = 7, mw = 9, gap = Math.round((tw + 12 - merlons * mw) / (merlons - 1));
  for (let m = 0; m < merlons; m++) {
    if (hp >= 2 && (m === 5 || (hp >= 3 && (m === 6 || m === 4)))) continue;   // 부서진 성가퀴
    const mx = tx - 6 + m * (mw + gap);
    for (let y = top; y < top + 8; y++) for (let x = mx; x < mx + mw; x++) {
      const e = x === mx || x === mx + mw - 1 || y === top;
      p.set(x, y, e ? (x === mx || y === top ? '#fff4dc' : '#6b5c4d') : ditherPick(stone, 0.2 + ((x - tx) / tw) * 0.6, x, y));
    }
    p.rect(mx - 1, top, 1, 8, OUT); p.rect(mx + mw, top, 1, 8, OUT); p.rect(mx, top - 1, mw, 1, OUT);
  }

  /* 짚 둥지 + 알 (리더가 여기 앉는다) */
  const nx = 56, ny = top + 2;
  for (let y = ny - 10; y < ny + 4; y++) for (let x = nx - 30; x <= nx + 30; x++) {
    const ex = (x - nx) / 30, ey = (y - (ny - 3)) / 7;
    if (ex * ex + ey * ey > 1) continue;
    const inner = (x - nx) * (x - nx) / (24 * 24) + ((y - (ny - 6)) * (y - (ny - 6))) / 16 < 1;
    if (inner && y < ny - 3) continue;                                          // 둥지 안쪽은 비워 리더 자리
    const weave = (x + y * 2) % 6 < 3 ? 0 : 1;                                  // 엮인 짚 결
    p.set(x, y, ditherPick(['#f2d27a', '#d9a94e', '#a8762e', '#6e4a1e'], 0.15 + weave * 0.35 + ((y - (ny - 10)) / 14) * 0.4, x, y));
  }
  for (let x = nx - 30; x <= nx + 30; x += 7) { line(p, x, ny - 9, x + 4, ny - 12, '#f2d27a'); }   // 삐친 짚
  for (const [ex, sp] of [[nx - 18, 0], [nx + 17, 1]]) {                         // 둥지 가장자리 알 2개
    for (let y = -6; y <= 5; y++) for (let x = -4; x <= 4; x++) {
      if ((x * x) / 16 + (y * y) / (y < 0 ? 36 : 25) > 1) continue;
      p.set(ex + x, ny - 6 + y, x < -1 && y < -1 ? '#ffffff' : x > 1 || y > 2 ? '#d8cbb0' : '#fff6e4');
    }
    for (const [ox, oy] of [[1, -3], [-2, 1], [2, 2]]) p.set(ex + ox, ny - 6 + oy, sp ? '#7fcd4f' : '#ff8a3a');
  }
  /* 깃대 + 삼각 깃발 */
  if (hp < 3) {
    for (let y = 2; y < top; y++) { p.set(tx - 3, y, '#6e4a1e'); p.set(tx - 2, y, '#a8762e'); }
    for (let y = 0; y < 10; y++) for (let x = 0; x < 16 - y * 1.5; x++) p.set(tx - 1 + x, 3 + y, y < 2 ? '#ffb05a' : '#ff8a3a');
    p.set(tx - 3, 1, '#ffd23f'); p.set(tx - 2, 1, '#ffd23f');
  }

  damage(p, hp, 101, [tx + 4, 48, tw - 8, 96], '#3a2c22', '#2a1e16');
  if (hp >= 3) for (let y = top; y < top + 22; y++) for (let x = tx + tw - 18; x < tx + tw + 8; x++) if (y - top < (x - (tx + tw - 18)) * 0.9) p.d[(y * BASE_W + x) * 4 + 3] = 0;   // 오른쪽 위가 떨어져 나감
  return p;
}

/* ───────────────────────── 좀비 탑 ───────────────────────── */
function tower(world, hp) {
  const p = new Pix(BASE_W, BASE_H);
  const stone = ['#8a7c9c', '#6e6084', '#54486a', '#3e3452', '#2a2238'];
  const mortar = '#1c1628';
  const lean = (y) => Math.round((176 - y) * 0.06);         // 위로 갈수록 오른쪽으로 기운다
  const tx = 24, tw = 64;

  /* 뾰족 나무 울타리 + 뼈 (아래) */
  for (let k = 0; k < 13; k++) {
    const px = 4 + k * 8 + (k % 2), h = 14 + (k * 7) % 6;
    for (let y = 176 - h; y < 176; y++) for (let x = px; x < px + 5; x++) {
      if (y < 176 - h + 3 && Math.abs(x - (px + 2)) > (y - (176 - h)) ) continue;
      p.set(x, y, x === px ? '#2a1c14' : x === px + 1 ? '#8a6444' : '#5c4230');
    }
  }
  for (let x = 4; x < 108; x++) { p.set(x, 166, '#3a2a1c'); p.set(x, 167, '#7a5a3e'); }
  /* 몸통 (기운 벽돌 탑) */
  for (let y = 36; y < 168; y++) {
    const L = lean(y);
    for (let x = 0; x < tw; x++) {
      const px = tx + x + L, row = Math.floor((y - 36) / 6), off = row % 2 ? 5 : 0, xx = (x + off) % 10, yy = (y - 36) % 6;
      const u = x / (tw - 1);
      let c;
      if (yy === 5 || xx === 9) c = mortar;
      else c = ditherPick(stone, Math.max(0, Math.min(1, 0.15 + u * 0.7 + (hash2(Math.floor((x + off) / 10), row, 7) - 0.5) * 0.3)), px, y);
      if (hash2(Math.floor((x + off) / 10), row, 8) > 0.9 && yy !== 5 && xx !== 9) c = ditherPick(['#8a6a4a', '#6a4e36', '#4a3424'], u, px, y);   // 판자로 땜질
      p.set(px, y, c);
    }
    p.set(tx + L - 1, y, OUT); p.set(tx + tw + L, y, OUT);
  }
  /* 초록 점액 흘러내림 */
  for (let i = 0; i < 6; i++) {
    const x = tx + 6 + Math.round(hash2(i, 1, 21) * (tw - 12)), y0 = 40 + Math.round(hash2(i, 2, 21) * 60), len = 6 + Math.round(hash2(i, 3, 21) * 14);
    for (let k = 0; k < len; k++) { p.set(x + lean(y0 + k), y0 + k, k === len - 1 ? '#c8ff6a' : '#7fd34e'); }
  }
  /* 판자로 막은 창 (초록 빛이 새어 나옴) */
  for (const [wx, wy] of [[tx + 12, 70], [tx + 38, 110]]) {
    const L = lean(wy);
    for (let y = wy; y < wy + 18; y++) for (let x = wx; x < wx + 14; x++) p.set(x + L, y, ditherPick(['#e9ff9a', '#9fe85a', '#4aa83a'], Math.abs(x - wx - 7) / 7, x, y));
    for (const [by, slope] of [[wy + 3, 1], [wy + 10, -1], [wy + 15, 0]]) for (let x = wx - 2; x < wx + 16; x++) {
      const yy = by + Math.round(((x - wx) * slope) / 6);
      p.set(x + L, yy, '#7a5a3e'); p.set(x + L, yy + 1, '#4a3424');
    }
  }
  /* 해골 문장 (초록 눈빛) */
  const sx = tx + 30 + lean(50), sy = 46;
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const d = ((x - 7.5) * (x - 7.5)) / 64 + ((y - 6) * (y - 6)) / 42;
    const jaw = y >= 11 && x >= 4 && x <= 11;
    if (d > 1 && !jaw) continue;
    p.set(sx + x, sy + y, x < 6 && y < 6 ? '#fffbe8' : y > 9 ? '#bfb497' : '#efe7d2');
  }
  for (const ex of [3, 9]) { p.rect(sx + ex, sy + 5, 4, 4, '#1a1226'); if (hp < 3) { p.rect(sx + ex + 1, sy + 6, 2, 2, '#c8ff6a'); } }
  p.set(sx + 7, sy + 10, '#1a1226'); p.set(sx + 8, sy + 10, '#1a1226');
  for (let x = 5; x <= 10; x += 2) p.set(sx + x, sy + 13, '#1a1226');
  /* 찢어진 보라 깃발 (오른쪽 깃대) */
  if (hp < 3) {
    const fx = tx + tw + lean(20) - 2;
    for (let y = 4; y < 40; y++) { p.set(fx, y, '#2a1c14'); p.set(fx + 1, y, '#5c4230'); }
    for (let y = 0; y < 18; y++) for (let x = 0; x < 20; x++) {
      if ((x > 14 && (y % 6 < 3)) || (x + y * 0.3 > 21)) continue;               // 찢어진 끝
      p.set(fx + 2 + x, 6 + y + Math.round(x / 7), ditherPick(['#a46ad0', '#7a3fb0', '#4e2478'], y / 18, x, y));
    }
  }
  /* 뾰족 지붕 (깨진 기와) */
  const roofBase = 38;
  for (let y = 6; y < roofBase; y++) {
    const L = lean(y), half = ((y - 6) / (roofBase - 6)) * (tw / 2 + 8), cx = tx + tw / 2 + L;
    for (let x = Math.round(cx - half); x <= Math.round(cx + half); x++) {
      const shingle = (Math.floor((x - cx) / 4) + Math.floor(y / 4)) % 2;
      let c = ditherPick(['#5a3a6a', '#42284e', '#2e1a38'], 0.2 + ((x - (cx - half)) / (2 * half + 1)) * 0.7, x, y);
      if (y % 4 === 3) c = '#1c1022'; else if (shingle && hash2(x >> 2, y >> 2, 31) > 0.85) c = '#1c1022';   // 빠진 기와
      p.set(x, y, c);
    }
    p.set(Math.round(cx - half) - 1, y, OUT); p.set(Math.round(cx + half) + 1, y, OUT);
  }
  for (let y = 0; y < 8; y++) p.set(tx + tw / 2 + lean(0) + Math.round(y * 0.2), y, y < 3 ? '#c8ff6a' : '#6e6084');   // 꼭대기 뾰족 침

  /* 튀어나온 나무 들보 + 사슬에 매달린 철창 (오른쪽) */
  const bx0 = tx + tw + lean(86);
  for (let x = bx0 - 4; x < bx0 + 16; x++) { p.set(x, 84, '#8a6444'); p.set(x, 85, '#5c4230'); p.set(x, 86, '#2a1c14'); }
  for (let y = 87; y < 98; y++) p.set(bx0 + 11, y, y % 2 ? '#9aa0b4' : '#5c6274');
  for (let y = 98; y < 116; y++) for (let x = bx0 + 5; x < bx0 + 18; x++) {
    const bar = (x - bx0 - 5) % 3 === 0 || y === 98 || y === 115;
    if (bar) p.set(x, y, y === 98 ? '#9aa0b4' : '#5c6274');
  }
  for (const [ox, oy, c] of [[10, 109, '#efe7d2'], [11, 109, '#efe7d2'], [12, 109, '#efe7d2'], [10, 110, '#1a1226'], [12, 110, '#1a1226'], [11, 111, '#efe7d2']]) p.set(bx0 + ox, oy, c);   // 철창 속 해골
  /* 말라 죽은 나무 (왼쪽) */
  const trunk = (x0, y0, x1, y1, w) => { for (let k = 0; k <= 20; k++) { const x = Math.round(x0 + ((x1 - x0) * k) / 20), y = Math.round(y0 + ((y1 - y0) * k) / 20); for (let i = 0; i < w; i++) p.set(x + i, y, i === 0 ? '#5a4a52' : '#2e2430'); } };
  trunk(10, 168, 12, 120, 3); trunk(12, 132, 3, 116, 2); trunk(12, 124, 20, 108, 2); trunk(5, 120, 1, 112, 1); trunk(18, 112, 22, 106, 1);
  /* 묘비 (오른쪽 아래) */
  for (let y = 152; y < 168; y++) for (let x = 92; x < 104; x++) {
    if (y < 156 && Math.hypot(x + 0.5 - 98, y + 0.5 - 156) > 6) continue;
    p.set(x, y, x === 92 || y === 152 ? '#a8a0b4' : x === 103 ? '#4a4258' : '#7a7090');
  }
  p.rect(97, 155, 2, 8, '#3a3248'); p.rect(95, 157, 6, 2, '#3a3248');
  /* 왼쪽 가장자리에 초록 기운 (음산한 테두리 빛) */
  for (let y = 40; y < 166; y++) if (bayer(0, y) > 0.4) p.set(tx + lean(y), y, '#7f9a7a');

  /* 바닥 뼈 */
  for (const [bx, by] of [[14, 172], [86, 170], [60, 173]]) { for (let x = 0; x < 8; x++) p.set(bx + x, by, '#efe7d2'); p.rect(bx - 1, by - 1, 2, 3, '#efe7d2'); p.rect(bx + 7, by - 1, 2, 3, '#efe7d2'); }

  damage(p, hp, 202 + world, [tx + 6, 44, tw - 12, 110], '#120c1a', '#0c0812');
  if (hp >= 2) for (let y = 6; y < 6 + hp * 6; y++) for (let x = tx + tw / 2; x < tx + tw + 12; x++) if (hash2(x >> 1, y >> 1, 41) > 0.55 - hp * 0.1) p.d[(y * BASE_W + x) * 4 + 3] = 0;   // 지붕이 날아감
  return p;
}

export const BASES = {
  'base/nest/0': { anims: ['hp0', 'hp1', 'hp2', 'hp3'], draw: (a) => nest(Number(a.slice(2))) },
  'base/tower/w01': { anims: ['hp0', 'hp1', 'hp2', 'hp3'], draw: (a) => tower(1, Number(a.slice(2))) },
};
