/**
 * 소품 도서관 (겜부장 · 그림 v3) — 한 번만 그리고 배치표로 여러 번 쓴다 (토큰 절약 · 그림 v3 6장).
 * 함수 모양 : prop(p, x, y, opt) — (x, y) = 소품의 발(바닥 가운데). 빛이 나는 소품은 lights 배열에 {x, y, r, color} 를 넣는다.
 * 달빛은 왼쪽 위 → 왼쪽 가장자리 밝은 테두리, 오른쪽 어둡게.
 */
import { hash2, bayer, line, ditherPick } from './envkit.js';

const OUT = '#0c0716';

/** 비틀린 죽은 나무 — 가지가 갈라지며 가늘어진다 */
export function deadTree(p, x, y, h, { seed = 0, bark = ['#6a5a7a', '#3e3250', '#241a32'], lean = 0 } = {}) {
  const branch = (x0, y0, ang, len, w, depth) => {
    let cx = x0, cy = y0;
    for (let k = 0; k < len; k++) {
      const bend = (hash2(depth * 31 + k, seed, 7) - 0.5) * 0.5;
      ang += bend * 0.35;
      cx += Math.sin(ang); cy -= Math.cos(ang);
      const ww = Math.max(1, Math.round(w * (1 - k / (len * 1.25))));
      for (let i = 0; i < ww; i++) p.set(Math.round(cx) + i, Math.round(cy), i === 0 ? bark[0] : i === ww - 1 ? bark[2] : bark[1]);
      if (depth < 3 && k > len * 0.45 && hash2(k, depth, seed + 3) > 0.83) branch(cx, cy, ang + (hash2(k, depth, seed + 4) > 0.5 ? 0.9 : -0.9), Math.round(len * 0.55), Math.max(1, ww - 1), depth + 1);
    }
    if (depth < 3) { branch(cx, cy, ang - 0.7, Math.round(len * 0.5), Math.max(1, w - 2), depth + 1); branch(cx, cy, ang + 0.6, Math.round(len * 0.45), Math.max(1, w - 2), depth + 1); }
  };
  branch(x - Math.round(h / 18), y, lean, Math.round(h * 0.55), Math.max(2, Math.round(h / 9)), 0);
  for (let i = -3; i <= 3; i++) p.set(x + i, y, bark[2]);   // 뿌리 퍼짐
}

/** 묘비 — kind 0 둥근 · 1 십자가 · 2 기운 판 */
export function gravestone(p, x, y, { kind = 0, s = 1, stone = ['#b8b0cc', '#8a82a4', '#5c5678', '#3a3452'] } = {}) {
  const w = Math.round(14 * s), h = Math.round(20 * s);
  if (kind === 1) {
    for (let j = 0; j < h; j++) for (let i = -1; i <= 1; i++) p.set(x + i, y - j, ditherPick(stone, (i + 1) / 3, x + i, y - j));
    for (let i = -Math.round(5 * s); i <= Math.round(5 * s); i++) for (let j = 0; j < 3; j++) p.set(x + i, y - h + Math.round(5 * s) + j, ditherPick(stone, j / 3 + 0.1, x + i, j));
    return;
  }
  const tilt = kind === 2 ? 1 : 0;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const cx = i - w / 2 + 0.5, top = h - j;
    if (top > h - w / 2 && cx * cx + (top - (h - w / 2)) * (top - (h - w / 2)) > (w / 2) * (w / 2)) continue;
    const X = x - Math.round(w / 2) + i + Math.round((tilt * j) / 6), Y = y - j;
    const edge = i === 0 || j === h - 1;
    p.set(X, Y, edge ? stone[0] : ditherPick(stone, 0.25 + (i / w) * 0.65, X, Y));
  }
  for (let i = 3; i < w - 3; i += 2) p.set(x - Math.round(w / 2) + i, y - Math.round(h * 0.55), stone[3]);   // 새긴 글씨 자국
  p.set(x - 2, y - Math.round(h * 0.7), stone[3]); p.set(x + 1, y - Math.round(h * 0.7), stone[3]);
}

/** 철 가로등 — 등불 빛은 lights 로 */
export function lampPost(p, x, y, h, lights) {
  for (let j = 0; j < h; j++) { p.set(x, y - j, '#2a2438'); p.set(x + 1, y - j, '#4a4060'); }
  for (let i = -3; i <= 4; i++) p.set(x + i, y, '#2a2438');
  for (let i = 0; i < 9; i++) p.set(x + 1 + i, y - h + Math.round(i * i * 0.05), '#2a2438');   // 굽은 팔
  const lx = x + 9, ly = y - h + 6;
  for (let j = 0; j < 9; j++) for (let i = -3; i <= 3; i++) {
    const e = Math.abs(i) === 3 || j === 0 || j === 8;
    p.set(lx + i, ly + j, e ? '#2a2438' : ditherPick(['#fff7c0', '#ffd860', '#f0a030'], j / 9, lx + i, ly + j));
  }
  p.set(lx, ly - 1, '#2a2438'); p.set(lx, ly - 2, '#4a4060');
  lights?.push({ x: lx, y: ly + 4, r: 34, color: 0xffcc66 });
}

/** 나무 울타리 (n 칸) — 낡아서 기운 말뚝 */
export function fence(p, x, y, n, { wood = ['#8a7468', '#5e4c48', '#3a2e30'] } = {}) {
  for (let k = 0; k < n; k++) {
    const px = x + k * 9, h = 16 + (k * 5) % 5, tilt = hash2(k, x, 11) > 0.7 ? 1 : 0;
    for (let j = 0; j < h; j++) for (let i = 0; i < 3; i++) p.set(px + i + Math.round((tilt * j) / 8), y - j, wood[i]);
    p.set(px + 1 + tilt * 2, y - h, wood[0]);
  }
  for (const ry of [y - 6, y - 12]) for (let i = 0; i < n * 9 - 6; i++) { p.set(x + i, ry, wood[0]); p.set(x + i, ry + 1, wood[2]); }
}

/** 풍차 (먼 겹 실루엣용 · 날개 고정) */
export function windmill(p, x, y, s, col = ['#3a3a66', '#2a2a50', '#1e1e3c'], lights) {
  const h = Math.round(46 * s), w = Math.round(16 * s);
  for (let j = 0; j < h; j++) { const half = Math.round(w / 2 - (j / h) * (w / 5)); for (let i = -half; i <= half; i++) p.set(x + i, y - j, ditherPick(col, (i + half) / (half * 2 + 1), x + i, y - j)); }
  const hx = x, hy = y - h + 2, L = Math.round(30 * s);
  for (const [dx, dy] of [[1, -1], [-1, 1], [1, 1], [-1, -1]]) {
    line(p, hx, hy, hx + dx * L * 0.7, hy + dy * L * 0.7, col[2]);
    for (let k = 4; k < L * 0.7; k += 3) line(p, hx + dx * k, hy + dy * k, hx + dx * k + dy * 4, hy + dy * k - dx * 4, col[1]);
  }
  p.rect(x - 2, y - Math.round(h * 0.45), 4, 5, '#ffd860');
  lights?.push({ x, y: y - Math.round(h * 0.45) + 2, r: 14, color: 0xffcc66 });
}

/** 호박등 (웃는 얼굴 · 안에서 빛) */
export function pumpkin(p, x, y, s, lights) {
  const rx = Math.round(9 * s), ry = Math.round(7 * s);
  for (let j = -ry; j <= ry; j++) for (let i = -rx; i <= rx; i++) {
    if ((i * i) / (rx * rx) + (j * j) / (ry * ry) > 1) continue;
    const rib = Math.abs(i) % Math.max(3, Math.round(rx / 2)) === 0;
    p.set(x + i, y - ry + j, rib ? '#a8481a' : ditherPick(['#ffb050', '#f07a20', '#b04a14'], (i + rx) / (2 * rx + 1), x + i, j));
  }
  for (const ex of [-4, 3]) { p.rect(x + Math.round(ex * s), y - ry - 2, Math.round(2 * s), Math.round(2 * s), '#fff3a0'); }
  for (let i = -4; i <= 4; i++) p.set(x + Math.round(i * s), y - ry + Math.round(3 * s) + (Math.abs(i) > 2 ? -1 : 0), '#fff3a0');
  p.rect(x - 1, y - ry * 2 - 2, 2, 3, '#4a7a2a');
  lights?.push({ x, y: y - ry, r: 22, color: 0xff9a30 });
}

/** 빛나는 버섯 무리 */
export function mushrooms(p, x, y, n, lights, cap = ['#c8ff9a', '#7fe05a', '#3a9a3a']) {
  for (let k = 0; k < n; k++) {
    const mx = x + k * 5 - n * 2, h = 3 + (k * 7) % 4, r = 2 + (k % 2);
    for (let j = 0; j < h; j++) p.set(mx, y - j, '#d8d0e8');
    for (let i = -r; i <= r; i++) for (let j = 0; j <= r; j++) if (i * i + j * j * 2 <= r * r + 1) p.set(mx + i, y - h - j, ditherPick(cap, (j + (i < 0 ? 0 : 1)) / (r + 2), mx + i, j));
  }
  lights?.push({ x, y: y - 5, r: 18, color: 0x8aff6a });
}

/** 뼈 · 해골 */
export function bone(p, x, y, len = 9, col = '#e8e0cc') {
  for (let i = 0; i < len; i++) p.set(x + i, y, col);
  for (const bx of [x - 1, x + len]) { p.set(bx, y - 1, col); p.set(bx, y + 1, col); }
}
export function skull(p, x, y, s = 1) {
  const r = Math.round(5 * s);
  for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) if (i * i + j * j <= r * r) p.set(x + i, y - r + j, i < -1 && j < -1 ? '#fffbe8' : j > 1 ? '#bfb497' : '#efe7d2');
  p.rect(x - Math.round(3 * s), y - r, Math.round(2 * s), Math.round(2 * s), OUT); p.rect(x + Math.round(1 * s), y - r, Math.round(2 * s), Math.round(2 * s), OUT);
  for (let i = -2; i <= 2; i += 2) p.set(x + i, y + 1, OUT);
}

/** 나무 표지판 (해골 그림) */
export function sign(p, x, y, s = 1) {
  for (let j = 0; j < Math.round(26 * s); j++) { p.set(x, y - j, '#4a3428'); p.set(x + 1, y - j, '#6e5038'); }
  const w = Math.round(30 * s), h = Math.round(16 * s), sx = x - Math.round(w / 2), sy = y - Math.round(28 * s);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const e = i === 0 || j === 0 || i === w - 1 || j === h - 1;
    p.set(sx + i, sy + j, e ? '#3a2818' : (j % 5 === 4 ? '#5e4430' : ditherPick(['#a07850', '#86603e', '#6a4a30'], i / w, sx + i, sy + j)));
  }
  skull(p, x, sy + Math.round(h * 0.75), 0.8 * s);
}

/** 바위 */
export function rock(p, x, y, rx, ry, col = ['#8a86a4', '#5e5a7a', '#3c3854']) {
  for (let j = -ry; j <= 0; j++) for (let i = -rx; i <= rx; i++) if ((i * i) / (rx * rx) + (j * j) / (ry * ry) <= 1) p.set(x + i, y + j, ditherPick(col, 0.2 + (i / rx) * 0.35 - (j / ry) * 0.3, x + i, j));
}

/** 잎 없는 덤불 · 풀 포기 */
export function grassTuft(p, x, y, h, col = ['#5a9a6a', '#3a6a52']) {
  for (let k = -2; k <= 2; k++) { const hh = h - Math.abs(k); for (let j = 0; j < hh; j++) p.set(x + k + Math.round((k * j) / (hh * 2)), y - j, j > hh - 2 ? col[0] : col[1]); }
}

/** 별 반짝 (작은 십자) */
export function star(p, x, y, big = false) {
  p.set(x, y, '#ffffff');
  if (big) { p.set(x - 1, y, '#a8b8ff'); p.set(x + 1, y, '#a8b8ff'); p.set(x, y - 1, '#a8b8ff'); p.set(x, y + 1, '#a8b8ff'); }
}

export { bayer };
