/**
 * 이안 드래곤 게임 — 월드 2~5 좀비 · 보스 공용 도구 (겜팀장 · A2 ③)
 * zFeat = 승인된 zFace 의 얼굴만(머리 타원 없이) — 고추 몸통 · 용암 덩이 · 보스 머리처럼 얼굴을 몸에 바로 그릴 때.
 * 큰 얼굴(r ≥ 12)은 눈동자 · 입 · 침을 크기에 맞춰 키운다. 규칙은 zFace 와 같다:
 * 툭 튀어나온 핏발 눈 + 처진 작은 눈 · 비뚤게 벌린 입(이빨 두 개) · 초록 침 · 썩은 반점.
 */
import { Pix, part } from './kit.js';
import { OUT } from './palette.js';
import { pose } from './units.js';
import { ZSKIN } from './zombies_w1.js';

export const PANTS = ['#7d7f86', '#55575f', '#33343a'];
export const SHIRT = ['#ece6cf', '#c2b897', '#8a7e60'];
export const EYEW = ['#ffffff', '#f2eed8', '#c8c0a0'];
export const JACKET = ['#a3825f', '#715640', '#45321f'];
export const ICESKIN = ['#cfe6da', '#93b8ac', '#587e78'];      // 얼어붙은 좀비 살 (초록 + 얼음)
export const SNOW = ['#ffffff', '#d4ecf6', '#8cb6cc'];
export const LAVA = ['#ffe07a', '#ff8a2a', '#c43a1a'];
export const ROCKD = ['#7a6662', '#4e3e3e', '#2e2228'];
export const SMOKE = ['#a8a0b0', '#7a7288', '#4e485c'];
export const DROOL = ['#9fd86a', '#c8f27a'];
export const MOUTH = '#3a0e16';

export const flip = (p) => { const o = new Pix(p.w, p.h); o.blit(p, 0, 0, true); return o; };
/** 동작 번호 (불꽃 · 날개 깜빡임용) */
export const FI = (a) => ({ idle0: 0, walk0: 1, walk1: 2, atk0: 3, atk1: 4, kb0: 5, walk2: 6, walk3: 7 }[a] ?? 0);
/** 보통 좀비 판: S칸 정사각 · pose · 좌표 옮기기 (ox · oy = 그림을 판 안쪽으로 미는 여백) */
export function base(S, a, ox = 0, oy = 0) { const q = pose(a); return { p: new Pix(S, S), q, X: (v) => v + q.dx + ox, Y: (v) => v + q.dy + oy, g: q.leg }; }
/** 보스 판: walk0~3 은 다리 앞뒤 + 출렁임 (0 → 위 → 반대 → 위) */
export function bossBase(S, a, ox = 0, oy = 0) {
  const w = { walk0: [1, 0], walk1: [0, -2], walk2: [-1, 0], walk3: [0, -2] }[a] ?? [0, 0];
  const q = a.startsWith('walk') ? { dx: 0, dy: w[1], eye: 'open', mouth: 0 } : pose(a);
  return { p: new Pix(S, S), q, X: (v) => v + q.dx * 2 + ox, Y: (v) => v + q.dy + oy, g: w[0] };
}
/** 찢어진 옷단 — 칸 두 개 대각선 */
export function rips(p, pts) { for (const [x, y] of pts) { p.set(x, y, OUT); p.set(x + 1, y + 1, OUT); } }
/** 다리 한 쌍 (앞뒤로 엇갈림) — xs: 두 다리 왼쪽 x, top: 허벅지 y, w: 굵기 */
export function legs(p, S, xs, top, g, ramp = PANTS, w = 5, shoe = '#3a2a20') {
  xs.forEach((lx, i) => {
    const s = i ? -g : g;
    part.poly(p, [[lx + s, top], [lx + w + s, top], [lx + w + s, S - 2], [lx + s, S - 2]], ramp);
    if (shoe) p.rect(lx + s - 1, S - 3, w + 3, 2, shoe);
  });
}

/** 좀비 얼굴(머리 없이) — (cx, cy) 얼굴 가운데 · r 얼굴 반지름 · 오른쪽을 본다 */
export function zFeat(p, cx, cy, r, q, o = {}) {
  const skin = o.skin ?? ZSKIN, k = Math.max(1, Math.round(r / 9));
  const ex = Math.round(cx + r * 0.45), ey = Math.round(cy - r * 0.15), sx = Math.round(cx - r * 0.12);
  const dw = Math.max(4, Math.round(r * 0.45));
  if (q.eye === 'shut') { p.rect(ex - 2 * k, ey, 4 * k, k, OUT); p.rect(sx - dw / 2, ey + k, dw - 1, k, OUT); }
  else {
    const er = Math.max(2, r * 0.36);
    part.ell(p, ex, ey, er, er * 1.05, EYEW);                                                   // 튀어나온 눈
    const pr = Math.max(2, Math.round(er * 0.42));
    p.rect(ex + Math.round(er * 0.25), ey + Math.round(er * 0.2), pr, pr, q.eye === 'focus' ? '#c01818' : (o.pupil ?? OUT));
    p.set(ex - 2 * k, ey - 2 * k, '#e8a0a0');                                                   // 핏발
    if (k > 1) { p.set(ex - 2 * k - 1, ey - k, '#e8a0a0'); p.set(ex - k, ey - 3 * k, '#e8a0a0'); p.set(ex + 2 * k, ey + 2 * k, '#e8a0a0'); }
    const lx = Math.round(sx - dw / 2);                                                         // 처진 작은 눈
    p.rect(lx, ey, dw, k, OUT); p.rect(lx + 1, ey + k, dw - 2, k, '#e2dcc0'); p.rect(lx + Math.round(dw / 2), ey + k, k, k, OUT);
    p.rect(lx + 1, ey + 3 * k, dw - 1, k, skin[2]);                                             // 다크서클
  }
  if (o.noMouth) return;
  const mo = (q.mouth === 1 ? 3 : q.mouth === 2 ? 2 : 1) * k;                                   // 비뚤게 벌린 입
  const mx = Math.round(cx), my = Math.round(cy + r * 0.45), mw = Math.round(r * 0.8);
  p.rect(mx, my, mw, mo + k, MOUTH); p.rect(mx + mw - k, my - k, k + 1, k, MOUTH);              // 한쪽이 올라간 입
  p.rect(mx + k, my, k, k, SHIRT[0]); p.rect(mx + Math.round(r * 0.6), my, k, k, SHIRT[0]);
  if (k > 1) p.rect(mx + Math.round(r * 0.35), my + mo, k, k, SHIRT[1]);
  const dc = o.drool ?? DROOL;
  if (!o.noDrool) { const dx = mx + Math.round(r * 0.75); p.rect(dx, my + mo + k, k, 2 * k, dc[0]); p.rect(dx, my + mo + 3 * k, k, k, dc[1]); }
  p.rect(Math.round(cx - r * 0.5), Math.round(cy + r * 0.3), k, k, skin[2]);                    // 썩은 반점
  if (k > 1) p.rect(Math.round(cx - r * 0.2), Math.round(cy - r * 0.6), k + 1, k, skin[2]);
}

/** 듬성 머리털 (zFace 와 같은 자리) */
export function zHair(p, cx, cy, r, col = '#2e2a22') {
  for (const [hx, h] of [[-0.6, 3], [-0.25, 3], [0.1, 2], [0.4, 2]]) p.rect(Math.round(cx + hx * r), Math.round(cy - r), 1, h + Math.floor(r / 12), col);
}
/** 불꽃 혀 하나 — 밑동(x, y) · 높이 h · 너비 w · 기울기 lean · 3겹 */
export function flame(p, x, y, h, w, lean, ramps) {
  ramps.forEach((rp, i) => {
    const s = 1 - i * 0.34;
    if (s <= 0) return;
    part.poly(p, [[x - w * s, y], [x + w * s, y], [x + lean * s, y - h * s]], rp, { outline: i === 0 });
  });
}
/** 톱니바퀴 — 이빨 n개 · phase(0/1)로 반 칸씩 돈다 */
export function gearWheel(p, cx, cy, r, n, phase, ramp) {
  for (let i = 0; i < n; i++) {
    const t = ((i + phase * 0.5) / n) * Math.PI * 2, tx = cx + Math.cos(t) * (r + 1.5), ty = cy + Math.sin(t) * (r + 1.5);
    part.ell(p, tx, ty, 1.6, 1.6, ramp);
  }
  part.ell(p, cx, cy, r, r, ramp);
  part.ell(p, cx, cy, Math.max(1, r * 0.35), Math.max(1, r * 0.35), [ramp[2], ramp[2], OUT], { outline: false });
}
