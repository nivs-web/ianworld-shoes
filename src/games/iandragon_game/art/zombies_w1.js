/**
 * 이안 드래곤 게임 — 월드 1 좀비 5종 (겜팀장 · A2). 어슬렁 좀비(승인본)와 같은 얼굴 규칙:
 * 큰 머리 · 툭 튀어나온 핏발 눈 + 처진 눈 · 비뚤게 벌린 입 · 초록 침 · 듬성 머리털 · 썩은 반점.
 * 오른쪽으로 그린 뒤 뒤집어 왼쪽을 보게 한다. 전부 오리지널.
 */
import { Pix, part } from './kit.js';
import { RAMP, C, OUT } from './palette.js';
import { pose } from './units.js';

export const ZSKIN = ['#c6d6a2', '#8fa66e', '#5a6e45'];
const PANTS = ['#7d7f86', '#55575f', '#33343a'];
const SHIRT = ['#ece6cf', '#c2b897', '#8a7e60'];
const METAL = ['#e6e9f0', '#a7adbb', '#646a7a'];

/** 좀비 얼굴 — (cx, cy) 머리 가운데 · r 반지름 · 얼굴은 오른쪽을 본다 */
export function zFace(p, cx, cy, r, q, o = {}) {
  part.ell(p, cx, cy, r, r * 0.95, o.skin ?? ZSKIN);
  if (!o.noHair) for (const [hx, h] of [[-0.6, 3], [-0.25, 3], [0.1, 2], [0.4, 2]]) p.rect(Math.round(cx + hx * r), Math.round(cy - r), 1, h, '#2e2a22');
  const ex = Math.round(cx + r * 0.45), ey = Math.round(cy - r * 0.15);
  if (q.eye === 'shut') { p.rect(ex - 2, ey, 4, 1, OUT); p.rect(ex - 7, ey + 1, 3, 1, OUT); }
  else {
    const er = Math.max(2, r * 0.36);
    part.ell(p, ex, ey, er, er * 1.05, ['#ffffff', '#f2eed8', '#c8c0a0']);                     // 튀어나온 눈
    p.rect(ex + 1, ey + 1, 2, 2, q.eye === 'focus' ? '#c01818' : OUT);
    p.set(ex - 2, ey - 2, '#e8a0a0');
    const sx = Math.round(cx - r * 0.12);                                                      // 처진 작은 눈
    p.rect(sx - 2, ey, 4, 1, OUT); p.rect(sx - 1, ey + 1, 2, 1, '#e2dcc0'); p.set(sx, ey + 1, OUT);
    p.rect(sx - 1, ey + 3, 3, 1, (o.skin ?? ZSKIN)[2]);
  }
  const mo = q.mouth === 1 ? 3 : q.mouth === 2 ? 2 : 1;                                        // 비뚤게 벌린 입
  const mx = Math.round(cx), my = Math.round(cy + r * 0.45);
  p.rect(mx, my, Math.round(r * 0.8), mo + 1, '#3a0e16');
  p.set(mx + 1, my, SHIRT[0]); p.set(mx + Math.round(r * 0.6), my, SHIRT[0]);
  if (!o.noDrool) { p.rect(mx + Math.round(r * 0.75), my + mo + 1, 1, 2, '#9fd86a'); p.set(mx + Math.round(r * 0.75), my + mo + 3, '#c8f27a'); }
  p.set(Math.round(cx - r * 0.5), Math.round(cy + r * 0.3), (o.skin ?? ZSKIN)[2]);            // 썩은 반점
}
const flip = (p) => { const o = new Pix(p.w, p.h); o.blit(p, 0, 0, true); return o; };

/* ───────── 뼈다귀 멍멍이 pup — 갈비뼈가 드러난 좀비 개 · 늘어진 혀 (빠른 놈) ───────── */
function pup(a) {
  const S = 36, p = new Pix(S, S), q = pose(a), X = (v) => v + q.dx, Y = (v) => v + q.dy, g = q.leg;
  part.poly(p, [[X(2), Y(15)], [X(5), Y(13)], [X(7), Y(18)]], RAMP.bone);                     // 뼈 꼬리
  for (const [lx, s] of [[8, 1], [22, -1]]) part.poly(p, [[X(lx) + g * s, Y(24)], [X(lx + 3) + g * s, Y(24)], [X(lx + 2) - g * s, S - 2], [X(lx - 1) - g * s, S - 2]], ZSKIN);
  part.ell(p, X(15), Y(21), 10, 5.5, ZSKIN);                                                   // 몸
  p.rect(X(11), Y(19), 8, 5, '#2a2030'); for (let i = 0; i < 4; i++) p.rect(X(11) + i * 2, Y(19), 1, 5, RAMP.bone[1]);   // 갈비뼈
  for (const [lx, s] of [[12, -1], [25, 1]]) part.poly(p, [[X(lx) + g * s, Y(24)], [X(lx + 3) + g * s, Y(24)], [X(lx + 3) - g * s, S - 2], [X(lx) - g * s, S - 2]], ZSKIN);
  part.ell(p, X(27), Y(15), 6.5, 6, ZSKIN);                                                    // 머리
  part.ell(p, X(32), Y(18), 3.4, 2.6, ZSKIN);                                                  // 주둥이
  part.poly(p, [[X(22), Y(10)], [X(25), Y(9)], [X(22), Y(19)]], ZSKIN[2] ? [ZSKIN[1], ZSKIN[2], '#3a4a30'] : ZSKIN);   // 늘어진 귀
  if (q.eye === 'shut') p.rect(X(28), Y(13), 3, 1, OUT);
  else { part.ell(p, X(29), Y(13), 2.4, 2.4, ['#ffffff', '#f2eed8', '#c8c0a0']); p.rect(X(30), Y(13), 2, 2, q.eye === 'focus' ? '#c01818' : OUT); }
  p.rect(X(32), Y(20), 3, 1 + (q.mouth ? 1 : 0), '#3a0e16'); p.set(X(32), Y(20), SHIRT[0]);
  p.rect(X(33), Y(21) + (q.mouth ? 1 : 0), 2, 3, C.tongue);                                     // 늘어진 혀
  p.set(X(24), Y(17), ZSKIN[2]);
  return flip(p);
}

/* ───────── 통통 좀비 chubby — 배가 터질 듯한 뚱뚱한 좀비 (튼튼한 놈) ───────── */
function chubby(a) {
  const S = 52, p = new Pix(S, S), q = pose(a), X = (v) => v + q.dx, Y = (v) => v + q.dy, g = q.leg;
  for (const [lx, s] of [[16, 1], [28, -1]]) part.poly(p, [[X(lx) + g * s, Y(38)], [X(lx + 7) + g * s, Y(38)], [X(lx + 7) + g * s, S - 2], [X(lx) + g * s, S - 2]], PANTS);
  part.ell(p, X(13), Y(28), 3, 6, ZSKIN);                                                      // 뒷팔
  part.ell(p, X(25), Y(30), 15, 12, ['#a3825f', '#715640', '#45321f']);                        // 몸 (낡은 조끼)
  part.ell(p, X(28), Y(32), 10, 9, ZSKIN);                                                     // 터져 나온 배
  p.set(X(28), Y(33), ZSKIN[2]); p.set(X(29), Y(33), ZSKIN[2]);                                // 배꼽
  for (const [bx, by] of [[22, 26], [33, 36]]) { p.set(X(bx), Y(by), '#7a8a50'); p.set(X(bx) + 1, Y(by), '#7a8a50'); }
  const reach = q.mouth === 1 ? 3 : 0;
  part.ell(p, X(40) + reach, Y(28), 5, 3, ZSKIN);                                              // 앞팔 (짧고 굵게)
  zFace(p, X(29), Y(12), 9, q);
  return flip(p);
}

/* ───────── 새총 좀비 archer — 새총을 당기는 비쩍 마른 좀비 · 거꾸로 쓴 모자 (원거리) ───────── */
function archer(a) {
  const S = 44, p = new Pix(S, S), q = pose(a), X = (v) => v + q.dx, Y = (v) => v + q.dy, g = q.leg;
  part.poly(p, [[X(14) + g, Y(30)], [X(18) + g, Y(30)], [X(17) + g, S - 2], [X(13) + g, S - 2]], PANTS);
  part.poly(p, [[X(19) - g, Y(30)], [X(23) - g, Y(30)], [X(24) - g, S - 2], [X(20) - g, S - 2]], PANTS);
  part.poly(p, [[X(13), Y(17)], [X(24), Y(16)], [X(25), Y(31)], [X(13), Y(31)]], ['#8fae6a', '#5f7f45', '#3a5228']);   // 낡은 초록 셔츠
  const pull = a === 'atk0' ? -4 : 0;
  /* 새총: Y자 막대 + 고무줄 */
  const sx = 33, sy = 16;
  p.rect(X(sx), Y(sy) + 4, 2, 7, RAMP.rag[1]); part.poly(p, [[X(sx) - 2, Y(sy)], [X(sx), Y(sy) + 5], [X(sx) - 1, Y(sy) + 5]], RAMP.rag, { outline: false });
  part.poly(p, [[X(sx) + 3, Y(sy)], [X(sx) + 2, Y(sy) + 5], [X(sx) + 1, Y(sy) + 5]], RAMP.rag, { outline: false });
  p.rect(X(sx) - 2, Y(sy) - 1, 1, 2, OUT); p.rect(X(sx) + 3, Y(sy) - 1, 1, 2, OUT);
  for (let i = 0; i <= 5; i++) p.set(X(sx - 2 - i * (1 + (pull ? 1 : 0))), Y(sy + i * 0.5), '#c04a4a');   // 고무줄
  part.ell(p, X(sx + 1), Y(sy + 9), 2.2, 2.2, ZSKIN);                                          // 새총 든 손
  part.ell(p, X(22 + pull), Y(20), 2.4, 2.4, ZSKIN);                                           // 당기는 손
  if (a !== 'atk1') p.rect(X(sx - 3 + pull), Y(sy + 1), 2, 2, RAMP.bone[1]);                   // 돌멩이
  zFace(p, X(22), Y(10), 7.5, q);
  part.poly(p, [[X(15), Y(5)], [X(27), Y(4)], [X(28), Y(7)], [X(15), Y(8)]], ['#e05a4a', '#b03a2e', '#702018']);   // 모자
  p.rect(X(11), Y(6), 5, 2, '#702018');                                                        // 거꾸로 쓴 챙
  return flip(p);
}

/* ───────── 냄비뚜껑 좀비 shield — 냄비를 쓰고 냄비뚜껑을 든 덩치 좀비 (대형) ───────── */
function shield(a) {
  const S = 52, p = new Pix(S, S), q = pose(a), X = (v) => v + q.dx, Y = (v) => v + q.dy, g = q.leg;
  for (const [lx, s] of [[15, 1], [26, -1]]) part.poly(p, [[X(lx) + g * s, Y(36)], [X(lx + 6) + g * s, Y(36)], [X(lx + 7) + g * s, S - 2], [X(lx) + g * s, S - 2]], PANTS);
  part.poly(p, [[X(11), Y(19)], [X(32), Y(18)], [X(34), Y(38)], [X(12), Y(39)]], ['#7f8fa8', '#56637d', '#343c52']);   // 낡은 작업복
  part.ell(p, X(13), Y(28), 3, 6, ZSKIN);
  zFace(p, X(24), Y(13), 8.5, q);
  part.poly(p, [[X(14), Y(9)], [X(34), Y(8)], [X(33), Y(3)], [X(15), Y(4)]], METAL);           // 머리에 쓴 냄비
  p.rect(X(34), Y(5), 4, 2, OUT); p.rect(X(10), Y(6), 4, 2, OUT);                              // 냄비 손잡이
  p.set(X(20), Y(5), METAL[2]); p.set(X(27), Y(6), METAL[2]);                                  // 찌그러짐
  const bash = q.mouth === 1 ? 3 : 0;
  part.ell(p, X(38) + bash, Y(28), 6, 11, METAL);                                              // 냄비뚜껑 방패
  part.ell(p, X(38) + bash, Y(28), 3.5, 7, ['#f2f4f8', '#c3c8d3', '#8a90a0'], { outline: false });
  p.rect(X(42) + bash, Y(27), 2, 3, OUT);                                                      // 뚜껑 손잡이
  p.set(X(36) + bash, Y(22), '#ffffff'); p.set(X(36) + bash, Y(23), '#ffffff');
  return flip(p);
}

/* ───────── 방귀 좀비 fart — 가스로 빵빵한 좀비 · 뒤로 초록 방귀 구름 (특수: 범위 밀치기) ───────── */
function fart(a) {
  const S = 46, p = new Pix(S, S), q = pose(a), X = (v) => v + q.dx, Y = (v) => v + q.dy, g = q.leg;
  const GAS = ['#d8f0a0', '#a8d468', '#6e9a3a'];
  const big = a === 'atk1' ? 1 : 0;
  part.ell(p, X(6), Y(28) - big * 2, 4 + big * 2, 3.5 + big, GAS, { outline: false });         // 방귀 구름 (뒤)
  part.ell(p, X(4), Y(34), 3 + big, 2.6 + big, GAS, { outline: false });
  if (big) part.ell(p, X(8), Y(22), 3, 2.6, GAS, { outline: false });
  for (const [lx, s] of [[15, 1], [24, -1]]) part.poly(p, [[X(lx) + g * s, Y(34)], [X(lx + 5) + g * s, Y(34)], [X(lx + 5) + g * s, S - 2], [X(lx) + g * s, S - 2]], PANTS);
  part.ell(p, X(21), Y(28), 11, 9 + (a === 'atk0' ? 1 : 0), ['#d6a8c8', '#a87898', '#6e4a64']);   // 빵빵한 분홍 줄무늬 잠옷
  for (let i = 0; i < 3; i++) p.rect(X(13), Y(24) + i * 4, 16, 1, '#8a5a7a');
  part.ell(p, X(32), Y(27), 4.5, 2.6, ZSKIN);                                                  // 배 문지르는 팔
  zFace(p, X(23), Y(12), 8, q, { noDrool: true });
  if (q.mouth !== 1) { p.rect(X(21), Y(12), 1, 1, OUT); }                                       // 볼에 힘
  p.rect(X(30), Y(4), 2, 2, GAS[1]); p.set(X(33), Y(2), GAS[0]);                               // 냄새 줄
  return flip(p);
}

export const ZOMBIES_W1 = {
  'zombie/pup/0': (a) => pup(a), 'zombie/chubby/0': (a) => chubby(a), 'zombie/archer/0': (a) => archer(a),
  'zombie/shield/0': (a) => shield(a), 'zombie/fart/0': (a) => fart(a),
};
