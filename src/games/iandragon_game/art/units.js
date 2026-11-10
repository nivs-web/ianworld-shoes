/**
 * 이안 드래곤 게임 — 캐릭터 그림 (겜팀장 · A1 샘플 3종)
 * 프레임 이름 약속(팀 계획서 2.1): 동작 idle0 · walk0 · walk1 · atk0(준비) · atk1(타격) · kb0(넉백).
 * 용은 오른쪽을, 좀비는 왼쪽을 본다(좀비는 오른쪽으로 그린 뒤 뒤집는다). 기준점 = 발 가운데.
 */
import { Pix, part } from './kit.js';
import { RAMP, C, OUT } from './palette.js';

export const ANIMS = ['idle0', 'walk0', 'walk1', 'atk0', 'atk1', 'kb0'];

/** 동작별 몸 움직임: dx(앞뒤) · dy(위아래) · 다리 칸 · 입 · 눈 */
function pose(a) {
  return {
    idle0: { dx: 0, dy: 0, leg: 0, mouth: 0, eye: 'open' },
    walk0: { dx: 0, dy: 0, leg: 1, mouth: 0, eye: 'open' },
    walk1: { dx: 0, dy: -1, leg: -1, mouth: 0, eye: 'open' },
    atk0: { dx: -1, dy: 0, leg: 0, mouth: 0, eye: 'focus' },
    atk1: { dx: 2, dy: 0, leg: 0, mouth: 1, eye: 'focus' },
    kb0: { dx: -2, dy: -1, leg: 0, mouth: 2, eye: 'shut' },
  }[a];
}
const darker = (ramp) => [ramp[1], ramp[2], OUT];

/* ───────── 꼬물이 kkomul — 애벌레처럼 통통한 연두 아기 용, 새싹 날개 ───────── */
function kkomul(form, a) {
  const S = form === 1 ? 32 : 36, k = S / 32, p = new Pix(S, S), q = pose(a);
  const G = form === 1 ? RAMP.leaf : ['#a8e860', '#5fbf3a', '#2f7f2e'];
  const X = (v) => Math.round(v * k) + q.dx, Y = (v) => Math.round(v * k) + q.dy, R = (v) => v * k;
  part.ell(p, X(6), Y(23), R(3.2), R(2.2), G);                                   // 꼬리
  part.ell(p, X(10) - q.leg, S - 4, R(3), R(2.6), G, { openBottom: true });      // 뒷다리
  part.ell(p, X(13), Y(21), R(9), R(7), G);                                      // 몸
  part.ell(p, X(17), Y(24), R(5.5), R(4.5), RAMP.belly);                         // 배
  part.ell(p, X(20) + q.leg, S - 4, R(3), R(2.6), G, { openBottom: true });      // 앞다리
  part.poly(p, [[X(8), Y(15)], [X(12), Y(9)], [X(14), Y(14)]], RAMP.leaf);       // 새싹 날개 1
  part.poly(p, [[X(5), Y(17)], [X(7), Y(11)], [X(10), Y(16)]], darker(RAMP.leaf)); // 새싹 날개 2(뒤)
  part.ell(p, X(21), Y(13), R(8), R(7), G);                                      // 머리 (크게)
  if (form === 2) {                                                              // 진화: 뿔 · 이마 무늬
    part.poly(p, [[X(17), Y(7)], [X(18), Y(2)], [X(20), Y(6)]], RAMP.lemon);
    part.poly(p, [[X(22), Y(6)], [X(24), Y(1)], [X(25), Y(6)]], RAMP.lemon);
  }
  part.ell(p, X(26), Y(16), R(3.5), R(2.5), RAMP.belly, { outline: false });      // 주둥이
  if (q.eye === 'shut') { part.sleepy(p, X(22), Y(12), 4); }
  else part.eye(p, X(23), Y(11), q.eye === 'focus' ? 2.6 : 3, 1);
  p.set(X(18), Y(16), C.blush); p.set(X(19), Y(16), C.blush);                    // 볼
  p.set(X(28), Y(15), OUT);                                                      // 콧구멍
  if (q.mouth === 1) { p.rect(X(26), Y(18), 3, 2, C.mouth); p.set(X(27), Y(18), C.tongue); }
  else if (q.mouth === 2) { p.rect(X(26), Y(17), 2, 2, C.mouth); }
  else p.rect(X(26), Y(18), 2, 1, OUT);
  return p;
}

/* ───────── 돌등이 doldeung — 등에 돌 껍질, 회갈색, 졸린 눈 (튼튼 방패: 낮고 넓게) ───────── */
function doldeung(form, a) {
  const S = form === 1 ? 40 : 44, k = S / 40, p = new Pix(S, S), q = pose(a);
  const B = form === 1 ? RAMP.stone : ['#cbb99c', '#8f7c63', '#5a4b3d'];
  const X = (v) => Math.round(v * k) + q.dx, Y = (v) => Math.round(v * k) + q.dy, R = (v) => v * k;
  part.ell(p, X(5), Y(31), R(3.5), R(2.4), B);                                   // 꼬리
  for (const [lx, s] of [[10, 1], [27, 1]]) part.ell(p, X(lx) - q.leg * s, S - 4, R(3.4), R(3), B, { openBottom: true });   // 뒤쪽 다리
  part.ell(p, X(19), Y(30), R(13), R(7.5), B);                                   // 몸 (낮고 넓게)
  part.ell(p, X(21), Y(33), R(9), R(4), RAMP.belly);                             // 배
  for (const [lx, s] of [[15, -1], [31, -1]]) part.ell(p, X(lx) - q.leg * s, S - 3, R(3.4), R(3), B, { openBottom: true });  // 앞쪽 다리
  part.ell(p, X(17), Y(22), R(12.5), R(9), RAMP.rock);                           // 돌 껍질
  part.ell(p, X(10), Y(18), R(4.5), R(3.5), RAMP.rock);                          // 돌 덩이
  part.ell(p, X(18), Y(15), R(5.5), R(4.2), RAMP.rock);
  part.ell(p, X(25), Y(19), R(4.2), R(3.4), RAMP.rock);
  for (const [cx, cy] of [[14, 24], [21, 22], [9, 25]]) { p.set(X(cx), Y(cy), OUT); p.set(X(cx) + 1, Y(cy) + 1, OUT); }   // 금
  if (form === 2) for (const [sx, sy] of [[12, 13], [18, 9], [24, 13]]) part.poly(p, [[X(sx) - 2, Y(sy) + 3], [X(sx), Y(sy) - 3], [X(sx) + 2, Y(sy) + 3]], RAMP.bone);   // 진화: 돌 가시
  part.ell(p, X(32), Y(28), R(6.5), R(5.2), B);                                  // 머리 (몸 앞 낮게)
  part.ell(p, X(36), Y(30), R(3.2), R(2.6), RAMP.belly, { outline: false });     // 주둥이
  if (q.eye === 'shut') part.sleepy(p, X(32), Y(26), 3);
  else if (q.eye === 'focus') { p.rect(X(32), Y(26), 3, 2, '#ffffff'); p.rect(X(33), Y(26), 2, 2, OUT); p.rect(X(31), Y(25), 5, 1, OUT); }
  else { p.rect(X(32), Y(26), 4, 1, OUT); p.rect(X(32), Y(27), 4, 1, '#ffffff'); p.set(X(34), Y(27), OUT); }  // 졸린 눈(반쯤 감김)
  p.set(X(38), Y(29), OUT);
  if (q.mouth === 1) p.rect(X(35), Y(32), 3, 2, C.mouth); else p.rect(X(35), Y(32), 3, 1, OUT);
  return p;
}

/* ───────── 어슬렁 좀비 walker — 구부정한 칙칙한 초록 좀비, 팔을 앞으로 (왼쪽을 본다) ───────── */
function walker(form, a) {
  const S = 36, p = new Pix(S, S), q = pose(a);
  const X = (v) => v + q.dx, Y = (v) => v + q.dy;
  const lg = q.leg;
  part.poly(p, [[X(12) + lg, Y(25)], [X(16) + lg, Y(25)], [X(15) + lg, S - 2], [X(11) + lg, S - 2]], RAMP.cloth);   // 뒷다리
  part.poly(p, [[X(17) - lg, Y(25)], [X(21) - lg, Y(25)], [X(22) - lg, S - 2], [X(18) - lg, S - 2]], RAMP.cloth);   // 앞다리
  p.rect(X(10) + lg, S - 3, 6, 2, RAMP.rag[2]); p.rect(X(18) - lg, S - 3, 6, 2, RAMP.rag[2]);                     // 신발
  part.poly(p, [[X(10), Y(14)], [X(22), Y(13)], [X(23), Y(27)], [X(10), Y(27)]], RAMP.rag);                    // 해진 웃옷
  p.set(X(13), Y(26), OUT); p.set(X(16), Y(27), OUT); p.set(X(20), Y(26), OUT);                                  // 찢어진 옷단
  part.poly(p, [[X(12), Y(17)], [X(14), Y(16)], [X(13), Y(22)], [X(11), Y(22)]], RAMP.rot);                      // 뒷팔
  const reach = q.mouth === 1 ? 3 : 0;
  part.ell(p, X(25) + reach, Y(18), 6, 2.2, RAMP.rot);                                                           // 앞팔 (쭉)
  part.ell(p, X(31) + reach, Y(18), 2.4, 2.4, RAMP.rot);                                                         // 손
  part.ell(p, X(19), Y(9), 7, 6.5, RAMP.rot);                                                                    // 머리 (앞으로 숙임)
  p.rect(X(14), Y(3), 3, 1, RAMP.rag[2]); p.set(X(18), Y(2), RAMP.rag[2]); p.set(X(19), Y(3), RAMP.rag[2]);     // 머리털
  if (q.eye === 'shut') { p.rect(X(21), Y(8), 3, 1, OUT); p.rect(X(16), Y(8), 2, 1, OUT); }
  else {
    part.eye(p, X(22), Y(8), 2.6, 1, { pupil: C.zPupil });                                                       // 큰 눈
    p.rect(X(16), Y(8), 2, 2, C.zEye); p.set(X(17), Y(9), C.zPupil);                                             // 작은 눈
  }
  p.rect(X(19), Y(13), 6, 1, C.stitch);                                                                          // 꿰맨 입
  for (const sx of [20, 22, 24]) { p.set(X(sx), Y(12), C.stitch); p.set(X(sx), Y(14), C.stitch); }
  if (q.mouth === 2) p.rect(X(20), Y(13), 3, 2, C.mouth);
  p.set(X(14), Y(11), RAMP.rot[2]); p.set(X(15), Y(12), RAMP.rot[2]);                                            // 멍
  const out = new Pix(S, S); out.blit(p, 0, 0, true);                                                            // 왼쪽을 보게
  return out;
}

/** 이름 → 그리기 */
export const UNITS = {
  'dragon/kkomul/1': (a) => kkomul(1, a),
  'dragon/kkomul/2': (a) => kkomul(2, a),
  'dragon/doldeung/1': (a) => doldeung(1, a),
  'dragon/doldeung/2': (a) => doldeung(2, a),
  'zombie/walker/0': (a) => walker(0, a),
};
