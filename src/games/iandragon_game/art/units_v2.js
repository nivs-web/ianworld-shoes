/**
 * 이안 드래곤 게임 — 캐릭터 움직임 규칙 v2 (겜팀장 · iandragon/docs/IAN_DRAGON_ANIM_RULES.md)
 * 대표님 지적: «발만 움직인다 · 눈을 안 깜빡인다 · 좀비 팔이 대충 · 성 위 드래곤이 드래곤 같지 않다».
 * 프레임: idle0 idle1 blink0 walk0~3 atk0~2 kb0 (11장). 몸통 · 머리(반 박자 늦게) · 눈 · 입 · 팔/날개/꼬리(다리와 엇박자) 다섯 곳이 움직인다.
 * 회전 금지 — 부품을 1~3칸 옮기거나 모양을 바꿔 끼운다. 이 파일은 대표님 승인용 샘플 3장(꼬물이 · 어슬렁 좀비 · 노바트).
 */
import { Pix, part } from './kit.js';
import { RAMP, C, OUT } from './palette.js';

export const ANIMS_V2 = ['idle0', 'idle1', 'blink0', 'walk0', 'walk1', 'walk2', 'walk3', 'atk0', 'atk1', 'atk2', 'kb0'];

/** 동작 → 부위별 움직임 (규칙서 2장 표) */
export function poseV2(a) {
  const P = {
    idle0: { bx: 0, by: 0, hx: 0, hy: 0, leg: [0, 0], lift: [0, 0], arm: 0, wing: 0, tail: 0, eye: 'open', mouth: 0 },
    idle1: { bx: 0, by: -1, hx: 0, hy: -1, leg: [0, 0], lift: [0, 0], arm: 0, wing: -1, tail: 1, eye: 'open', mouth: 0 },
    blink0: { bx: 0, by: 0, hx: 0, hy: 0, leg: [0, 0], lift: [0, 0], arm: 0, wing: 0, tail: 0, eye: 'blink', mouth: 0 },
    walk0: { bx: 0, by: 0, hx: 0, hy: 0, leg: [2, -2], lift: [0, 0], arm: -1, wing: 0, tail: 1, eye: 'open', mouth: 0 },
    walk1: { bx: 0, by: -1, hx: 0, hy: 0, leg: [0, 0], lift: [1, 0], arm: 0, wing: -1, tail: 0, eye: 'open', mouth: 0, nod: 1 },
    walk2: { bx: 0, by: 0, hx: 0, hy: 0, leg: [-2, 2], lift: [0, 0], arm: 1, wing: 0, tail: -1, eye: 'open', mouth: 1 },
    walk3: { bx: 0, by: -1, hx: 0, hy: 0, leg: [0, 0], lift: [0, 1], arm: 0, wing: 1, tail: 0, eye: 'open', mouth: 0, tilt: 1 },
    atk0: { bx: -2, by: 0, hx: -1, hy: 0, leg: [0, 0], lift: [0, 0], arm: -2, wing: -1, tail: 1, eye: 'squint', mouth: 0, puff: 1 },
    atk1: { bx: 3, by: 0, hx: 1, hy: 0, leg: [1, -1], lift: [0, 0], arm: 3, wing: 1, tail: -1, eye: 'big', mouth: 2 },
    atk2: { bx: 1, by: 0, hx: 0, hy: 0, leg: [0, 0], lift: [0, 0], arm: 1, wing: 0, tail: 0, eye: 'open', mouth: 1 },
    kb0: { bx: -2, by: 1, hx: -2, hy: 0, leg: [-1, 1], lift: [0, 0], arm: -3, wing: -1, tail: 1, eye: 'x', mouth: 1, guard: 1 },
  };
  return P[a] ?? P.idle0;
}

/* ── 눈 · 입 공통 ── */
function cuteEyeV2(p, ex, ey, eye, h = 4) {
  if (eye === 'blink') { p.set(ex - 2, ey + 1, OUT); p.rect(ex - 1, ey, 3, 1, OUT); p.set(ex + 2, ey + 1, OUT); return; }    // 웃는 반달 눈 ^
  if (eye === 'x') { for (const d of [-2, -1, 0, 1, 2]) { p.set(ex + d, ey + d, OUT); p.set(ex + d, ey - d, OUT); } return; }
  if (eye === 'squint') { p.rect(ex - 2, ey, 5, 2, OUT); p.set(ex - 1, ey, '#ffffff'); return; }
  const hh = eye === 'big' ? h + 1 : h;
  p.rect(ex - 1, ey - hh + 1, 3, hh * 2 - 1, OUT); p.rect(ex - 2, ey - hh + 2, 5, hh * 2 - 3, OUT);
  p.rect(ex - 1, ey - hh + 2, 2, 2, '#ffffff'); p.set(ex + 1, ey + hh - 3, '#ffffff'); p.set(ex, ey + hh - 2, '#4a3a6a');
}
const blush = (p, x, y, r = 2.2) => part.ell(p, x, y, r, r * 0.65, [C.blush, C.blush, '#f07890'], { outline: false });

/* ───────── 꼬물이 v2 ───────── */
function kkomulV2(form, a) {
  const S = form === 1 ? 32 : 36, k = S / 32, p = new Pix(S, S), q = poseV2(a);
  const G = form === 1 ? RAMP.leaf : ['#b6ee6a', '#6cc843', '#358a31'];
  const R = (v) => v * k;
  const BX = (v) => Math.round(v * k) + q.bx, BY = (v) => Math.round(v * k) + q.by;            // 몸통
  const HX = (v) => BX(v) + q.hx, HY = (v) => BY(v) + q.hy - (q.by < 0 && a !== 'idle1' ? -1 : 0);   // 머리(늦게 따라옴)
  part.poly(p, [[BX(2) - q.tail, BY(18)], [BX(4) - q.tail, BY(14)], [BX(7), BY(19)]], RAMP.leaf);                 // 꼬리 끝 잎 (반대로)
  part.ell(p, BX(6) - q.tail, BY(24), R(3.2), R(2.3), G);
  part.ell(p, BX(10) + q.leg[1], S - 3 - q.lift[1], R(2.8), R(2.4), G, { openBottom: !q.lift[1] });              // 뒷다리
  part.ell(p, BX(13), BY(24), R(7.5), R(5.8), G);
  part.ell(p, BX(15), BY(26), R(4.6), R(3.4), RAMP.belly);
  part.ell(p, BX(18) + q.leg[0], S - 3 - q.lift[0], R(2.8), R(2.4), G, { openBottom: !q.lift[0] });              // 앞다리
  part.ell(p, BX(19) + q.arm, BY(24) - (q.guard ? 3 : 0), R(1.8), R(1.6), G);                                    // 앞발 (엇박자)
  part.poly(p, [[BX(7), BY(18)], [BX(9), BY(13) + q.wing * 2], [BX(12), BY(18)]], RAMP.leaf);                     // 날개 퍼덕
  part.ell(p, HX(19), HY(13), R(10), R(9.5), G);                                                                  // 머리
  part.ell(p, HX(24), HY(18), R(4.5) + (q.puff ? 1 : 0), R(3), RAMP.belly, { outline: false });                    // 턱 (atk0 볼 부풂)
  part.poly(p, [[HX(17), HY(5)], [HX(13) - q.tail, HY(0)], [HX(19), HY(2)]], RAMP.leaf);                         // 새싹 (살랑)
  if (form === 2) { part.poly(p, [[HX(19), HY(4)], [HX(23), HY(-0.5)], [HX(22), HY(5)]], RAMP.leaf); part.poly(p, [[HX(25), HY(7)], [HX(27), HY(3)], [HX(28), HY(8)]], RAMP.lemon); }
  cuteEyeV2(p, HX(23), HY(12), q.eye, Math.round(4 * k));
  blush(p, HX(22), HY(18));
  if (q.mouth === 2) { p.rect(HX(26), HY(16), 4, 3, C.mouth); p.rect(HX(27), HY(17), 2, 2, C.tongue); }
  else if (q.mouth === 1) p.rect(HX(27), HY(17), 2, 2, C.mouth);
  else { p.set(HX(26), HY(17), OUT); p.set(HX(27), HY(18), OUT); p.set(HX(28), HY(17), OUT); }
  if (q.eye === 'x') for (const [sx, sy] of [[HX(14), HY(6)], [HX(29), HY(9)]]) p.set(sx, sy, '#ffffff');        // 별 튐
  return p;
}

/* ───────── 어슬렁 좀비 v2 — 고개 까딱 · 팔 위아래 · 손가락 3개 · 턱 덜렁 · 질질 끄는 발 ───────── */
const ZSKIN = ['#c6d6a2', '#8fa66e', '#5a6e45'], JACKET = ['#a3825f', '#715640', '#45321f'], SHIRT = ['#ece6cf', '#c2b897', '#8a7e60'], PANTS = ['#7d7f86', '#55575f', '#33343a'];
function hand(p, x, y, droop) {                                    // 손바닥 + 늘어진 손가락 3개
  part.ell(p, x, y, 2.6, 2.2, ZSKIN);
  for (let f = 0; f < 3; f++) { const fx = x - 2 + f * 2, len = 2 + droop + (f === 1 ? 1 : 0); p.rect(fx, y + 2, 1, len, ZSKIN[1]); p.set(fx, y + 2 + len, ZSKIN[2]); p.set(fx + 1, y + 2, OUT); }
}
function walkerV2(a) {
  const S = 44, p = new Pix(S, S), q = poseV2(a);
  const X = (v) => v + q.bx, Y = (v) => v + q.by;
  const hx = q.hx + (q.nod ? 1 : 0) + (q.tilt ? -1 : 0), hy = q.hy + (q.nod ? 1 : 0);
  /* 다리: 접지 · 지나감 — 뒷발은 질질 끈다 */
  const [lf, lb] = q.leg;
  part.poly(p, [[X(12) + lb, Y(30)], [X(17) + lb, Y(30)], [X(16) + lb * 2, S - 2], [X(11) + lb * 2, S - 2]], PANTS);
  p.rect(X(9) + lb * 2, S - 3, 8, 2, '#3a2a20');
  part.poly(p, [[X(18), Y(30)], [X(23), Y(30)], [X(24) + lf, S - 2 - q.lift[0]], [X(19) + lf, S - 2 - q.lift[0]]], PANTS);
  p.rect(X(18) + lf, S - 3 - q.lift[0], 8, 2, '#3a2a20');
  /* 뒷팔 (앞팔과 엇박자로 위아래) */
  const armB = -q.arm, armF = q.arm;
  part.poly(p, [[X(10), Y(18)], [X(14), Y(17)], [X(16) + 2, Y(24) + armB], [X(12) + 2, Y(25) + armB]], JACKET);
  hand(p, X(16), Y(26) + armB, 1);
  /* 몸통 */
  part.poly(p, [[X(11), Y(17)], [X(24), Y(15)], [X(26), Y(31)], [X(12), Y(32)]], JACKET);
  part.poly(p, [[X(17), Y(16)], [X(22), Y(15)], [X(21), Y(30)], [X(17), Y(31)]], SHIRT, { outline: false });
  p.rect(X(18), Y(22), 2, 3, '#7a8a50'); p.set(X(20), Y(26), '#6a3030');
  for (const [tx, ty] of [[13, 31], [16, 32], [22, 31], [25, 30]]) { p.set(X(tx), Y(ty), OUT); p.set(X(tx) + 1, Y(ty) + 1, OUT); }
  /* 앞팔: 팔꿈치가 보이는 두 마디 + 찢어진 소매 + 손가락 */
  const lunge = q.mouth === 2 ? 3 : 0, guard = q.guard ? -6 : 0;
  part.poly(p, [[X(22), Y(17)], [X(28), Y(18) + armF], [X(28), Y(21) + armF], [X(22), Y(21)]], JACKET);         // 위팔
  for (const tx of [26, 28]) p.set(X(tx), Y(21) + armF, OUT);                                                    // 찢어진 소매
  part.poly(p, [[X(28), Y(18) + armF], [X(34) + lunge, Y(19) + armF + guard], [X(34) + lunge, Y(22) + armF + guard], [X(28), Y(21) + armF]], ZSKIN);   // 아래팔
  p.set(X(28), Y(19) + armF, ZSKIN[2]);                                                                           // 팔꿈치
  hand(p, X(36) + lunge, Y(20) + armF + guard, q.guard ? 0 : 1);
  /* 머리 — 앞으로 숙임 · walk1 까딱 · walk3 기울임 */
  const H = (v) => X(v) + hx, V = (v) => Y(v) + hy;
  part.ell(p, H(26), V(11), 9.5, 9, ZSKIN);
  part.ell(p, H(18), V(11), 2.2, 3, ZSKIN); p.set(H(17), V(9), OUT); p.set(H(17), V(10), OUT);
  for (const [hx2, hy2, h] of [[20, 2, 3], [23, 1, 3], [26, 1, 2], [29, 2, 2]]) p.rect(H(hx2), V(hy2), 1, h, '#2e2a22');
  part.ell(p, H(22), V(6), 2, 1.2, ['#a49cb8', '#7d6f95', '#55496a'], { outline: false });
  const big = q.eye === 'big', sq = q.eye === 'squint';
  if (q.eye === 'blink') { p.rect(H(28), V(9), 5, 1, OUT); p.rect(H(22), V(10), 4, 1, OUT); }
  else if (q.eye === 'x') { for (const d of [-2, -1, 0, 1, 2]) { p.set(H(30) + d, V(9) + d, OUT); p.set(H(30) + d, V(9) - d, OUT); } p.rect(H(22), V(10), 4, 1, OUT); }
  else {
    part.ell(p, H(30), V(9), sq ? 3.4 : big ? 4 : 3.4, sq ? 1.6 : big ? 4.2 : 3.6, ['#ffffff', '#f2eed8', '#c8c0a0']);   // 튀어나온 큰 눈
    p.rect(H(31), V(10), 2, 2, big ? '#c01818' : OUT); if (!sq) p.set(H(28), V(7), '#e8a0a0');
    part.ell(p, H(24), V(10), 2, 1.6, ['#f2eed8', '#e2dcc0', '#c8c0a0'], { outline: false }); p.rect(H(22), V(9), 5, 1, OUT); p.set(H(24), V(10), OUT);   // 반쯤 감긴 눈
    p.rect(H(23), V(12), 3, 1, ZSKIN[2]);
  }
  /* 턱 — walk2 덜렁 · atk1 크게 */
  const open = q.mouth === 2 ? 5 : q.mouth === 1 ? 3 : 2;
  part.poly(p, [[H(25), V(15)], [H(33), V(14)], [H(32), V(15) + open], [H(26), V(15) + open]], ['#5a1a24', '#3a0e16', '#22060c'], { lineCol: ZSKIN[2] });
  p.set(H(27), V(15), SHIRT[0]); p.set(H(31), V(14), SHIRT[0]); p.set(H(29), V(15) + open - 1, SHIRT[1]); if (open >= 4) { p.set(H(28), V(14) + open, SHIRT[0]); p.set(H(30), V(15), SHIRT[0]); }
  p.rect(H(32), V(16) + open, 1, 2, '#9fd86a'); p.set(H(32), V(18) + open, '#c8f27a');
  const out = new Pix(S, S); out.blit(p, 0, 0, true);
  return out;
}

/* ───────── 리더 노바트 v2 (80×72) — 뿔 · 주둥이 · 펼친 박쥐 날개 · 굵은 꼬리 · 발톱 · 등 가시 · 배 비늘 ───────── */
export const LEADER_ANIMS_V2 = ['idle0', 'idle1', 'blink0', 'breath0', 'breath1'];
const NV = ['#9fd0ff', '#4f86e0', '#2a4ea0'], WING = ['#c8e2ff', '#7aa8ea', '#3f62b0'], BONE = ['#e8f2ff', '#a8c4f0', '#5a78b8'];
function novartV2(a) {
  const W = 80, H = 72, p = new Pix(W, H);
  const fold = a === 'idle1' ? 3 : 0, br0 = a === 'breath0', br1 = a === 'breath1';
  const hx = br0 ? -3 : br1 ? 3 : 0, hy = br0 ? -2 : br1 ? 1 : 0;
  /* 뒤 날개 (막 + 뼈대) */
  part.poly(p, [[30, 30], [8, 4 + fold], [2, 22 + fold], [12, 26], [8, 38], [22, 38]], WING);
  for (const [x1, y1] of [[8, 4 + fold], [2, 22 + fold], [8, 38]]) { const st = 20; for (let t = 0; t <= st; t++) p.set(Math.round(30 + (x1 - 30) * t / st), Math.round(30 + (y1 - 30) * t / st), BONE[2]); }
  /* 꼬리 — 굵게 말리고 끝에 삼각 장식 */
  part.ell(p, 18, 58, 10, 4.5, NV); part.ell(p, 8, 54, 4, 3, NV);
  part.poly(p, [[2, 46], [8, 50], [3, 55]], ['#ffe680', '#f2c230', '#a8780e']);
  /* 뒷다리 · 발톱 */
  part.ell(p, 28, 60, 7, 6, NV); for (const cx of [24, 27, 30]) { p.rect(cx, 66, 2, 2, '#f6efe0'); p.set(cx, 67, OUT); }
  /* 몸 · 배 비늘 띠 */
  part.ell(p, 36, 48, 13, 14, NV);
  part.ell(p, 40, 51, 8, 11, ['#fff2c8', '#f2dc98', '#c8a860']);
  for (let y = 43; y < 62; y += 3) p.rect(35, y, 10, 1, '#c8a860');
  if (br0) part.ell(p, 41, 48, 4, 5, ['#fff6c0', '#ffd23f', '#ff8a3a'], { outline: false });                // 가슴에 불이 모임
  /* 등 가시 */
  for (const [sx, sy] of [[26, 36], [24, 42], [24, 49]]) part.poly(p, [[sx, sy], [sx - 5, sy + 2], [sx, sy + 4]], ['#ffe680', '#f2c230', '#a8780e']);
  /* 앞발 · 발톱 */
  part.ell(p, 46, 60, 5, 5, NV); for (const cx of [44, 47, 50]) { p.rect(cx, 64, 2, 2, '#f6efe0'); p.set(cx + 1, 65, OUT); }
  /* 앞 날개 (몸보다 크게 펼침) */
  part.poly(p, [[34, 34], [46, 2 + fold], [56, 10 + fold], [52, 20], [60, 24 + fold], [44, 40]], WING);
  for (const [x1, y1] of [[46, 2 + fold], [56, 10 + fold], [60, 24 + fold]]) { const st = 22; for (let t = 0; t <= st; t++) p.set(Math.round(34 + (x1 - 34) * t / st), Math.round(34 + (y1 - 34) * t / st), BONE[2]); }
  part.ell(p, 46, 2 + fold, 1.6, 1.6, BONE);
  /* 목 · 머리 — 주둥이가 앞으로 · 콧구멍 · 뿔 2개 */
  part.poly(p, [[42, 40], [50, 26 + hy], [58, 28 + hy], [50, 44]], NV);
  part.ell(p, 58 + hx, 24 + hy, 9, 8, NV);
  part.poly(p, [[62 + hx, 20 + hy], [76 + hx, 23 + hy], [76 + hx, 30 + hy], [63 + hx, 31 + hy]], NV);              // 주둥이
  part.poly(p, [[64 + hx, 27 + hy], [76 + hx, 27 + hy], [75 + hx, 30 + hy], [64 + hx, 31 + hy]], ['#fff2c8', '#f2dc98', '#c8a860'], { outline: false });   // 아래턱
  p.set(73 + hx, 24 + hy, OUT); p.set(74 + hx, 24 + hy, OUT);                                                   // 콧구멍
  part.poly(p, [[52 + hx, 18 + hy], [46 + hx, 6 + hy], [56 + hx, 15 + hy]], ['#fff6c0', '#f2c230', '#a8780e']);   // 뿔 ①
  part.poly(p, [[57 + hx, 16 + hy], [54 + hx, 4 + hy], [61 + hx, 14 + hy]], ['#fff6c0', '#f2c230', '#a8780e']);   // 뿔 ②
  /* 눈 */
  const ex = 62 + hx, ey = 21 + hy;
  if (a === 'blink0') { p.rect(ex - 2, ey, 5, 1, OUT); p.set(ex - 3, ey - 1, OUT); }
  else { p.rect(ex - 2, ey - 2, 4, 5, OUT); p.rect(ex - 1, ey - 2, 2, 2, '#ffffff'); p.set(ex + 1, ey + 1, '#ffd23f'); p.rect(ex - 3, ey - 3, 6, 1, NV[2]); }   // 매서운 눈썹
  /* 입 · 불 */
  if (br1) {
    p.rect(66 + hx, 29 + hy, 10, 3, '#5a1420'); for (const tx of [67, 70, 73]) p.set(tx + hx, 29 + hy, '#ffffff');
    part.poly(p, [[76, 26 + hy], [80, 22 + hy], [80, 36 + hy], [76, 32 + hy]], ['#fff6c0', '#ffd23f', '#ff8a3a'], { outline: false });
  } else p.rect(66 + hx, 29 + hy, 8, 1, OUT);
  p.rect(40, 30, 10, 2, '#e04a3a'); p.rect(38, 32, 3, 5, '#e04a3a');                                            // 빨간 목도리 (리더 표시)
  return p;
}

export const UNITS_V2 = {
  'dragon/kkomul/1': (a) => kkomulV2(1, a), 'dragon/kkomul/2': (a) => kkomulV2(2, a),
  'zombie/walker/0': (a) => walkerV2(a),
};
export const LEADER_V2 = { 'leader/novart/0': { anims: LEADER_ANIMS_V2, draw: (a) => novartV2(a) } };
