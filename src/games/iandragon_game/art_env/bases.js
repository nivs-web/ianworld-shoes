/**
 * 양쪽 성 v3 (겜부장 · 960×540) — 170 × 260칸, 기준점 발 가운데. 체력 단계 hp0 멀쩡 → hp3 크게 무너짐.
 *  - 드래곤 성 : 큰 둥근 돌탑 + 양쪽 낮은 성벽 · 횃불 2개 · 드래곤 깃발 2장 · 아치 대문 · 성가퀴 위 짚 둥지(리더 자리)
 *  - 좀비 성 : 기운 돌탑 · 해골 대문(쇠창살 뒤 초록 빛) · 초록 약물 통 · 초록 등 · 찢어진 깃발(좀비 얼굴) · 사슬 · 뼈 · 울타리
 * 빛 나는 곳은 BASE_LIGHTS[이름] = [{x, y, r, color}] (판 좌표) — 화면이 빛무리 · 깜빡임을 얹는다.
 */
import { Pix } from '../art/kit.js';
import { brickCylinder, ditherPick, hash2, line, bayer } from './envkit.js';
import { skull, bone, deadTree, gravestone } from './props.js';

export const BASE_W = 170, BASE_H = 260;
export const NEST_FEET_Y = 50;            // 리더 발 위치 (판 위에서부터)
export const BASE_LIGHTS = { nest: [], tower: [] };
const OUT = '#0c0716';

function damage(p, hp, seed, [ax, ay, aw, ah], col, hole) {
  const cracks = [0, 3, 7, 12][hp], holes = [0, 0, 6, 14][hp];
  for (let i = 0; i < cracks; i++) {
    let x = ax + Math.round(hash2(i, 1, seed) * aw), y = ay + Math.round(hash2(i, 2, seed) * ah);
    for (let k = 0; k < 8 + hp * 3; k++) { const nx = x + (hash2(i, k, seed + 3) > 0.5 ? 1 : -1), ny = y + 1 + (hash2(i, k, seed + 4) > 0.7 ? 1 : 0); line(p, x, y, nx, ny, col); x = nx; y = ny; }
  }
  for (let i = 0; i < holes; i++) { const x = ax + Math.round(hash2(i, 5, seed) * (aw - 12)), y = ay + Math.round(hash2(i, 6, seed) * (ah - 7)); p.rect(x, y, 9 + Math.round(hash2(i, 7, seed) * 6), 6, hole); p.rect(x, y, 9, 1, '#000000'); }
}

/** 횃불 — 쇠 받침 + 불꽃 (빛은 lights 로) */
function torch(p, x, y, lights) {
  for (let i = -3; i <= 3; i++) p.set(x + i, y, '#3c3c48');
  for (let j = 1; j < 7; j++) { p.set(x, y + j, '#3c3c48'); p.set(x + 1, y + j, '#5c5c6a'); }
  for (let j = 0; j < 12; j++) { const half = Math.round((1 - j / 12) * 4); for (let i = -half; i <= half; i++) p.set(x + i, y - 1 - j, ditherPick(['#fff7c0', '#ffd23f', '#ff8a2a', '#c4401a'], Math.abs(i) / 5 + j / 18, x + i, j)); }
  lights.push({ x, y: y - 6, r: 38, color: 0xff9a40, flicker: true });
}

function archWindow(p, wx, wy, w, h, dark, lights) {
  for (let y = wy; y < wy + h; y++) for (let x = wx; x < wx + w; x++) {
    if (y < wy + w / 2 && Math.hypot(x + 0.5 - (wx + w / 2), y + 0.5 - (wy + w / 2)) > w / 2) continue;
    const glow = dark ? '#1a1426' : ditherPick(['#fff3a0', '#ffd23f', '#e89a2a'], (y - wy) / h, x, y);
    p.set(x, y, x === Math.round(wx + w / 2) || y === Math.round(wy + h * 0.55) ? '#4a3220' : glow);
  }
  for (let x = wx - 2; x < wx + w + 2; x++) p.set(x, wy + h, '#fff4dc');
  if (!dark) lights.push({ x: wx + w / 2, y: wy + h / 2, r: 18, color: 0xffcc55 });
}

/* ───────────── 드래곤 성 ───────────── */
function nest(hp) {
  const p = new Pix(BASE_W, BASE_H), L = []; if (hp === 0) BASE_LIGHTS.nest = L;
  const stone = ['#efe2c8', '#d6c3a0', '#b29c7a', '#8a765c', '#5e4f3e'], mortar = '#4a3c30';
  const tx = 44, tw = 82;
  /* 주춧돌 */
  for (let y = 222; y < 260; y++) for (let x = 4; x < 166; x++) {
    const row = Math.floor((y - 222) / 10), off = row % 2 ? 12 : 0, bx = Math.floor((x - 4 + off) / 24);
    p.set(x, y, (y - 222) % 10 === 9 || (x - 4 + off) % 24 === 23 ? mortar : ditherPick(stone, 0.3 + ((x - 4) / 162) * 0.55 + (hash2(bx, row, 3) - 0.5) * 0.25, x, y));
  }
  for (let x = 4; x < 166; x++) p.set(x, 222, '#fff4dc');
  /* 양쪽 낮은 성벽 + 성가퀴 */
  for (const [wx, ww] of [[8, 40], [122, 40]]) {
    brickCylinder(p, wx, 150, ww, 72, stone, mortar, { bh: 8, bw: 16, seed: wx });
    for (let m = 0; m < 4; m++) { if (hp >= 2 && m === (wx < 60 ? 0 : 3)) continue; const mx = wx + m * 11; for (let y = 140; y < 150; y++) for (let x = mx; x < mx + 7; x++) p.set(x, y, x === mx || y === 140 ? '#fff4dc' : ditherPick(stone, 0.35, x, y)); }
  }
  /* 큰 둥근 탑 */
  brickCylinder(p, tx, 72, tw, 150, stone, mortar, { bh: 8, bw: 16, seed: 1, taper: 4 });
  for (let y = 72; y < 222; y++) { const ins = Math.round((4 * (222 - y)) / 150); p.set(tx - 1 + ins, y, OUT); p.set(tx + tw - ins, y, OUT); }
  for (const by of [72, 140]) for (let x = tx - 3; x < tx + tw + 3; x++) { p.set(x, by, '#fff4dc'); p.set(x, by + 1, '#c9b48e'); p.set(x, by + 2, '#7a6650'); }
  /* 아치 대문 (철 장식) */
  const dx = 70, dw = 30, dTop = 182;
  for (let y = dTop - 8; y < 222; y++) for (let x = dx - 5; x < dx + dw + 5; x++) {
    const cx = dx + dw / 2, rr = Math.hypot(x + 0.5 - cx, y + 0.5 - dTop);
    if (y < dTop && rr > dw / 2 + 5) continue;
    const inDoor = y >= dTop ? x >= dx && x < dx + dw : rr <= dw / 2;
    if (!inDoor) { p.set(x, y, (x + y) % 6 === 0 ? mortar : '#8a765c'); continue; }
    const pe = (x - dx) % 6; let c = pe === 0 ? '#3a2416' : pe === 1 ? '#c4864e' : ['#a0683c', '#8a5632', '#a0683c', '#7a4a2a', '#94603a'][Math.floor((x - dx) / 6) % 5];
    if (y === dTop + 8 || y === dTop + 28) c = pe === 3 ? '#9aa0b4' : '#3c3c48';
    p.set(x, y, hp >= 3 && (x + y) % 9 < 2 ? '#1a1226' : c);
  }
  for (let y = 218; y < 222; y++) for (let x = dx - 8; x < dx + dw + 8; x++) p.set(x, y, y === 218 ? '#fff4dc' : '#a3917a');
  /* 창 · 깃발 · 횃불 */
  archWindow(p, 79, 92, 12, 22, hp >= 3, L);
  archWindow(p, 20, 168, 8, 14, false, L); archWindow(p, 142, 168, 8, 14, hp >= 2, L);
  if (hp < 3) for (const bx of [52, 102]) {
    const bl = hp >= 2 && bx > 60 ? 30 : 44;
    for (let y = 0; y < bl; y++) for (let x = 0; x < 16; x++) {
      if (y > bl - 7 && Math.abs(x - 7.5) < (y - (bl - 7)) * 1.2) continue;
      p.set(bx + x, 80 + y, x === 0 || x === 15 ? '#8e2a1a' : ditherPick(['#ffb05a', '#ff8a3a', '#d4602a'], x / 16, bx + x, y));
    }
    for (const [ox, oy] of [[7, 10], [6, 12], [8, 12], [5, 14], [7, 14], [9, 14], [4, 16], [6, 16], [8, 16], [10, 16], [5, 18], [7, 18], [9, 18], [6, 20], [8, 20], [7, 22]]) p.set(bx + ox, 80 + oy, oy < 14 ? '#fff3a0' : '#ffd23f');
    for (let x = bx - 1; x <= bx + 16; x++) p.set(x, 79, '#5a3e2a');
  }
  torch(p, 16, 128, L); torch(p, 154, 128, L);
  /* 담쟁이 */
  for (let i = 0; i < 70; i++) { const x = tx + Math.round(hash2(i, 1, 9) * 18), y = 150 + Math.round(hash2(i, 2, 9) * 70); p.set(x, y, i % 3 ? '#5aa448' : '#8fd166'); p.set(x + 1, y, '#43863d'); }
  /* 꼭대기 성가퀴 + 둥지 */
  const top = 50;
  for (let y = top + 10; y < 72; y++) for (let x = tx - 8; x < tx + tw + 8; x++) { const st = y - (top + 10) < 4 ? 0 : 3; if (x < tx - 8 + st || x >= tx + tw + 8 - st) continue; p.set(x, y, ditherPick(stone, 0.2 + ((x - tx + 8) / (tw + 16)) * 0.7, x, y)); }
  for (let x = tx - 8; x < tx + tw + 8; x++) { p.set(x, top + 10, '#fff4dc'); p.set(x, 71, mortar); }
  for (let m = 0; m < 8; m++) {
    if (hp >= 2 && (m === 6 || (hp >= 3 && (m === 7 || m === 5)))) continue;
    const mx = tx - 8 + m * 13;
    for (let y = top; y < top + 10; y++) for (let x = mx; x < mx + 9; x++) p.set(x, y, x === mx || y === top ? '#fff4dc' : x === mx + 8 ? '#6b5c4d' : ditherPick(stone, 0.2 + ((x - tx) / tw) * 0.6, x, y));
    p.rect(mx - 1, top, 1, 10, OUT); p.rect(mx + 9, top, 1, 10, OUT); p.rect(mx, top - 1, 9, 1, OUT);
  }
  const nx = 85, ny = top + 2;
  for (let y = ny - 14; y < ny + 6; y++) for (let x = nx - 40; x <= nx + 40; x++) {
    const ex = (x - nx) / 40, ey = (y - (ny - 4)) / 9;
    if (ex * ex + ey * ey > 1) continue;
    if ((x - nx) * (x - nx) / 1024 + ((y - (ny - 8)) * (y - (ny - 8))) / 30 < 1 && y < ny - 4) continue;
    p.set(x, y, ditherPick(['#f2d27a', '#d9a94e', '#a8762e', '#6e4a1e'], 0.15 + ((x + y * 2) % 6 < 3 ? 0 : 0.35) + ((y - (ny - 14)) / 20) * 0.4, x, y));
  }
  for (let x = nx - 40; x <= nx + 40; x += 6) line(p, x, ny - 12, x + 5, ny - 16, '#f2d27a');
  for (const [ex, c] of [[nx - 26, '#ff8a3a'], [nx + 24, '#7fcd4f']]) {
    for (let y = -8; y <= 7; y++) for (let x = -6; x <= 6; x++) if ((x * x) / 36 + (y * y) / (y < 0 ? 64 : 49) <= 1) p.set(ex + x, ny - 8 + y, x < -2 && y < -2 ? '#ffffff' : x > 2 || y > 3 ? '#d8cbb0' : '#fff6e4');
    for (const [ox, oy] of [[2, -4], [-3, 1], [3, 3], [-1, -6]]) p.set(ex + ox, ny - 8 + oy, c);
  }
  if (hp < 3) { for (let y = 4; y < top; y++) { p.set(tx - 6, y, '#6e4a1e'); p.set(tx - 5, y, '#a8762e'); } for (let y = 0; y < 14; y++) for (let x = 0; x < 22 - y * 1.5; x++) p.set(tx - 4 + x, 6 + y, y < 3 ? '#ffb05a' : '#ff8a3a'); }
  damage(p, hp, 101, [tx + 6, 76, tw - 12, 140], '#3a2c22', '#2a1e16');
  if (hp >= 3) for (let y = top; y < top + 30; y++) for (let x = tx + tw - 26; x < tx + tw + 10; x++) if (y - top < (x - (tx + tw - 26)) * 0.9) p.d[(y * BASE_W + x) * 4 + 3] = 0;
  return p;
}

/* ───────────── 좀비 성 ───────────── */
function tower(world, hp) {
  const p = new Pix(BASE_W, BASE_H), L = []; if (hp === 0) BASE_LIGHTS.tower = L;
  const stone = ['#8a7c9c', '#6e6084', '#54486a', '#3e3452', '#2a2238'], mortar = '#1c1628';
  const lean = (y) => Math.round((260 - y) * 0.06), tx = 46, tw = 84;
  /* 뾰족 울타리 */
  for (let k = 0; k < 19; k++) { const px = 3 + k * 9, h = 18 + (k * 7) % 8; for (let y = 260 - h; y < 260; y++) for (let x = px; x < px + 6; x++) { if (y < 260 - h + 4 && Math.abs(x - (px + 2.5)) > y - (260 - h)) continue; p.set(x, y, x === px ? '#2a1c14' : x === px + 1 ? '#8a6444' : '#5c4230'); } }
  for (let x = 3; x < 168; x++) { p.set(x, 246, '#3a2a1c'); p.set(x, 247, '#7a5a3e'); }
  /* 몸통 */
  for (let y = 58; y < 248; y++) {
    const Lr = lean(y);
    for (let x = 0; x < tw; x++) {
      const px = tx + x + Lr, row = Math.floor((y - 58) / 8), off = row % 2 ? 7 : 0, xx = (x + off) % 14, yy = (y - 58) % 8, u = x / (tw - 1);
      let c = yy === 7 || xx === 13 ? mortar : ditherPick(stone, Math.max(0, Math.min(1, 0.15 + u * 0.7 + (hash2(Math.floor((x + off) / 14), row, 7) - 0.5) * 0.3)), px, y);
      if (hash2(Math.floor((x + off) / 14), row, 8) > 0.9 && yy !== 7 && xx !== 13) c = ditherPick(['#8a6a4a', '#6a4e36', '#4a3424'], u, px, y);
      p.set(px, y, c);
    }
    p.set(tx + Lr - 1, y, OUT); p.set(tx + tw + Lr, y, OUT);
    if (bayer(0, y) > 0.4) p.set(tx + Lr, y, '#7f9a7a');            // 음산한 초록 테두리 빛
  }
  /* 해골 대문 (쇠창살 뒤 초록 빛) */
  const gx = 88 + lean(210), gy = 214;
  for (let y = -30; y <= 34; y++) for (let x = -30; x <= 30; x++) {
    const d = (x * x) / 900 + ((y + 4) * (y + 4)) / 900; const jaw = y > 14 && Math.abs(x) < 22;
    if (d > 1 && !jaw) continue;
    p.set(gx + x, gy + y, ditherPick(['#f4ecd8', '#d8ccb0', '#a89c80', '#7a6e58'], (x + 30) / 60 + y / 90, x, y));
  }
  for (const ex of [-17, 5]) { p.rect(gx + ex, gy - 14, 12, 11, '#120c1a'); if (hp < 3) { p.rect(gx + ex + 3, gy - 11, 6, 5, '#9aff6a'); L.push({ x: gx + ex + 6, y: gy - 9, r: 14, color: 0x9aff6a, flicker: true }); } }
  p.rect(gx - 3, gy, 6, 6, '#120c1a');
  for (let y = gy + 10; y < gy + 34; y++) for (let x = gx - 20; x <= gx + 20; x++) p.set(x, y, (x - gx) % 6 === 0 ? '#5c6274' : ditherPick(['#c8ff6a', '#6ad04a', '#2a6a2a'], (y - gy - 10) / 24, x, y));   // 쇠창살 + 초록 빛
  for (let x = gx - 20; x <= gx + 20; x += 6) for (let k = 0; k < 4; k++) p.set(x + 2, gy + 10 + k, '#efe7d2');   // 이빨
  L.push({ x: gx, y: gy + 22, r: 30, color: 0x8aff5a });
  /* 판자 창 */
  for (const [wx, wy] of [[tx + 14, 96], [tx + 52, 140]]) {
    const Lr = lean(wy);
    for (let y = wy; y < wy + 24; y++) for (let x = wx; x < wx + 18; x++) p.set(x + Lr, y, ditherPick(['#e9ff9a', '#9fe85a', '#4aa83a'], Math.abs(x - wx - 9) / 9, x, y));
    for (const [by, sl] of [[wy + 4, 1], [wy + 13, -1], [wy + 20, 0]]) for (let x = wx - 2; x < wx + 20; x++) { const yy = by + Math.round(((x - wx) * sl) / 7); p.set(x + Lr, yy, '#7a5a3e'); p.set(x + Lr, yy + 1, '#4a3424'); }
    L.push({ x: wx + 9 + Lr, y: wy + 12, r: 18, color: 0x9aff6a });
  }
  /* 초록 약물 통 (오른쪽) */
  const vx = 146, vy = 238;
  for (let y = 0; y < 34; y++) for (let x = -11; x <= 11; x++) {
    if (y < 5 && Math.abs(x) > 6) continue;
    const glass = Math.abs(x) >= 10 || y === 0;
    p.set(vx + x, vy - y, glass ? '#a8c8d0' : y > 22 ? '#d8e8ec' : ditherPick(['#e0ff9a', '#9aff4a', '#4ab02a'], (x + 11) / 22, x, y));
  }
  for (const [ox, oy] of [[-4, 8], [3, 14], [-1, 19], [5, 6]]) p.rect(vx + ox, vy - oy, 2, 2, '#f4ffd0');   // 거품
  for (let x = -13; x <= 13; x++) p.set(vx + x, vy + 1, '#3c3c48');
  L.push({ x: vx, y: vy - 14, r: 26, color: 0x9aff4a, flicker: true });
  /* 사슬 + 초록 등 (왼쪽 들보) */
  const bx0 = tx + lean(120) - 22;
  for (let x = bx0; x < bx0 + 24; x++) { p.set(x, 120, '#8a6444'); p.set(x, 121, '#5c4230'); }
  for (let y = 122; y < 134; y++) p.set(bx0 + 4, y, y % 2 ? '#9aa0b4' : '#5c6274');
  for (let y = 134; y < 146; y++) for (let x = bx0; x < bx0 + 9; x++) p.set(x, y, x === bx0 || x === bx0 + 8 || y === 134 || y === 145 ? '#3c3c48' : ditherPick(['#e9ff9a', '#8af05a', '#4aa83a'], (y - 134) / 12, x, y));
  L.push({ x: bx0 + 4, y: 140, r: 22, color: 0x9aff6a, flicker: true });
  /* 찢어진 깃발 (좀비 얼굴) */
  if (hp < 3) {
    const fx = tx + tw + lean(30) - 2;
    for (let y = 6; y < 60; y++) { p.set(fx, y, '#2a1c14'); p.set(fx + 1, y, '#5c4230'); }
    for (let y = 0; y < 26; y++) for (let x = 0; x < 28; x++) { if ((x > 20 && y % 7 < 3) || x + y * 0.3 > 30) continue; p.set(fx + 2 + x, 8 + y + Math.round(x / 8), ditherPick(['#a46ad0', '#7a3fb0', '#4e2478'], y / 26, x, y)); }
    for (let y = -5; y <= 5; y++) for (let x = -5; x <= 5; x++) if (x * x + y * y <= 25) p.set(fx + 14 + x, 20 + y, '#8fbf6a');
    p.set(fx + 12, 18, '#120c1a'); p.set(fx + 16, 19, '#120c1a'); for (let x = -2; x <= 2; x++) p.set(fx + 14 + x, 23, '#120c1a');
  }
  /* 뾰족 지붕 */
  for (let y = 8; y < 60; y++) {
    const Lr = lean(y), half = ((y - 8) / 52) * (tw / 2 + 12), cx = tx + tw / 2 + Lr;
    for (let x = Math.round(cx - half); x <= Math.round(cx + half); x++) {
      let c = ditherPick(['#5a3a6a', '#42284e', '#2e1a38'], 0.2 + ((x - (cx - half)) / (2 * half + 1)) * 0.7, x, y);
      if (y % 5 === 4 || ((Math.floor((x - cx) / 5) + Math.floor(y / 5)) % 2 && hash2(x >> 2, y >> 2, 31) > 0.85)) c = '#1c1022';
      p.set(x, y, c);
    }
    p.set(Math.round(cx - half) - 1, y, OUT); p.set(Math.round(cx + half) + 1, y, OUT);
  }
  for (let y = 0; y < 10; y++) p.set(tx + tw / 2 + lean(0) + Math.round(y * 0.2), y, y < 4 ? '#c8ff6a' : '#6e6084');
  deadTree(p, 16, 246, 70, { seed: 7, bark: ['#5a4a62', '#3a2e44', '#241a2e'] });
  gravestone(p, 30, 244, { kind: 1, s: 1.2 }); skull(p, 58, 252, 1.2);
  for (const [bx, by] of [[20, 254], [120, 252], [100, 256]]) bone(p, bx, by, 10);
  damage(p, hp, 202 + world, [tx + 8, 66, tw - 16, 150], '#120c1a', '#0c0812');
  if (hp >= 2) for (let y = 8; y < 8 + hp * 9; y++) for (let x = tx + tw / 2; x < tx + tw + 16; x++) if (hash2(x >> 1, y >> 1, 41) > 0.55 - hp * 0.1) p.d[(y * BASE_W + x) * 4 + 3] = 0;
  return p;
}

export const BASES = {
  'base/nest/0': { anims: ['hp0', 'hp1', 'hp2', 'hp3'], draw: (a) => nest(Number(a.slice(2))) },
  'base/tower/w01': { anims: ['hp0', 'hp1', 'hp2', 'hp3'], draw: (a) => tower(1, Number(a.slice(2))) },
};
