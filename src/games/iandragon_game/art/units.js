/**
 * 이안 드래곤 게임 — 캐릭터 그림 (겜팀장 · A1 샘플 2차)
 * 대표님 2026-11-10: 용은 아기 몬스터처럼 더 귀엽게(머리 크게 · 반짝이는 큰 눈), 좀비는 더 크고 무섭게.
 * 생김새는 전부 오리지널(기획서 12.7) — 느낌만 살리고 특정 게임 캐릭터를 베끼지 않는다.
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
    atk0: { dx: -1, dy: 1, leg: 0, mouth: 0, eye: 'focus' },
    atk1: { dx: 2, dy: 0, leg: 0, mouth: 1, eye: 'focus' },
    kb0: { dx: -2, dy: -1, leg: 0, mouth: 2, eye: 'shut' },
  }[a];
}
/** 눈 감김 «><» */
function shutEye(p, x, y) { p.set(x - 1, y - 1, OUT); p.set(x, y, OUT); p.set(x - 1, y + 1, OUT); p.set(x + 1, y - 1, OUT); p.set(x + 1, y + 1, OUT); }

/* ───────── 꼬물이 kkomul — 동글동글 머리 큰 연두 아기 용 · 짧은 주둥이 · 반짝이는 까만 눈 · 새싹 ───────── */
function kkomul(form, a) {
  const S = form === 1 ? 32 : 36, k = S / 32, p = new Pix(S, S), q = pose(a);
  const G = form === 1 ? RAMP.leaf : ['#b6ee6a', '#6cc843', '#358a31'];
  const X = (v) => Math.round(v * k) + q.dx, Y = (v) => Math.round(v * k) + q.dy, R = (v) => v * k;
  part.poly(p, [[X(2), Y(18)], [X(4), Y(14)], [X(7), Y(19)]], RAMP.leaf);                     // 꼬리 끝 잎
  part.ell(p, X(6), Y(24), R(3.2), R(2.3), G);                                                 // 꼬리
  part.ell(p, X(10) - q.leg, S - 3, R(2.8), R(2.4), G, { openBottom: true });                  // 뒷다리
  part.ell(p, X(13), Y(24), R(7.5), R(5.8), G);                                                // 몸 (통통하게)
  part.ell(p, X(15), Y(26), R(4.6), R(3.4), RAMP.belly);                                       // 배
  part.ell(p, X(18) + q.leg, S - 3, R(2.8), R(2.4), G, { openBottom: true });                  // 앞다리
  part.poly(p, [[X(7), Y(18)], [X(9), Y(13)], [X(12), Y(18)]], RAMP.leaf);                     // 아기 날개
  part.ell(p, X(19), Y(13), R(10), R(9.5), G);                                                 // 머리 (동그랗게 · 크게)
  part.ell(p, X(24), Y(18), R(4.5), R(3), RAMP.belly, { outline: false });                     // 턱 밑 (짧게)
  /* 머리 위 새싹 (진화하면 잎 두 장 + 작은 뿔) */
  part.poly(p, [[X(17), Y(5)], [X(13), Y(0)], [X(19), Y(2)]], RAMP.leaf);
  if (form === 2) {
    part.poly(p, [[X(19), Y(4)], [X(23), Y(-0.5)], [X(22), Y(5)]], RAMP.leaf);
    part.poly(p, [[X(25), Y(7)], [X(27), Y(3)], [X(28), Y(8)]], RAMP.lemon);
  }
  /* 눈 — 세로로 긴 까만 눈 + 큰 하이라이트 (아기 몬스터 눈) */
  const ex = X(23), ey = Y(12);
  if (q.eye === 'shut') shutEye(p, ex, ey + 1);
  else {
    const eh = q.eye === 'focus' ? 3 : 4;
    p.rect(ex - 1, ey - eh + 1, 3, eh * 2 - 1, OUT); p.rect(ex - 2, ey - eh + 2, 5, eh * 2 - 3, OUT);   // 까만 타원 눈
    p.rect(ex - 1, ey - eh + 2, 2, 2, '#ffffff'); p.set(ex + 1, ey + eh - 3, '#ffffff');              // 하이라이트
    p.set(ex, ey + eh - 2, '#4a3a6a');                                                                 // 눈 아래 반사
  }
  part.ell(p, X(22), Y(18), R(2.2), R(1.4), [C.blush, C.blush, '#f07890'], { outline: false });       // 동그란 볼
  if (q.mouth === 1) { p.rect(X(27), Y(16), 3, 3, C.mouth); p.rect(X(28), Y(17), 2, 2, C.tongue); }  // 앙!
  else if (q.mouth === 2) p.rect(X(27), Y(17), 2, 2, C.mouth);
  else { p.set(X(26), Y(17), OUT); p.set(X(27), Y(18), OUT); p.set(X(28), Y(17), OUT); }             // 방긋
  return p;
}

/* ───────── 돌등이 doldeung — 동글동글 돌 세 덩이를 진 아기 용 · 이끼 · 졸린 큰 눈 ───────── */
function doldeung(form, a) {
  const S = form === 1 ? 40 : 44, k = S / 40, p = new Pix(S, S), q = pose(a);
  const B = form === 1 ? ['#e3d3b8', '#b39f84', '#7a6a58'] : ['#d6c3a4', '#a08b6e', '#685744'];
  const X = (v) => Math.round(v * k) + q.dx, Y = (v) => Math.round(v * k) + q.dy, R = (v) => v * k;
  part.ell(p, X(5), Y(32), R(3.4), R(2.4), B);                                                 // 꼬리
  for (const lx of [9, 25]) part.ell(p, X(lx) - q.leg, S - 3, R(3.2), R(2.8), B, { openBottom: true });
  part.ell(p, X(18), Y(31), R(12), R(6.5), B);                                                 // 몸
  part.ell(p, X(20), Y(33), R(8), R(3.6), RAMP.belly);                                         // 배
  for (const lx of [14, 29]) part.ell(p, X(lx) + q.leg, S - 2, R(3.2), R(2.8), B, { openBottom: true });
  /* 돌 껍질 — 둥근 돌 세 덩이 + 이끼 */
  part.ell(p, X(10), Y(22), R(6.5), R(5.5), RAMP.rock);
  part.ell(p, X(26), Y(22), R(6), R(5.2), RAMP.rock);
  part.ell(p, X(18), Y(17), R(7.5), R(6.5), RAMP.rock);
  for (const [mx, my, w] of [[14, 11, 5], [7, 17, 3], [24, 17, 3]]) { p.rect(X(mx), Y(my), Math.round(w * k), 1, RAMP.leaf[1]); p.rect(X(mx) + 1, Y(my) - 1, Math.max(1, Math.round(w * k) - 2), 1, RAMP.leaf[0]); }
  if (form === 2) for (const [sx, sy] of [[12, 13], [19, 9], [26, 14]]) part.poly(p, [[X(sx) - 2, Y(sy) + 3], [X(sx), Y(sy) - 3], [X(sx) + 2, Y(sy) + 3]], RAMP.bone);
  part.ell(p, X(31), Y(26), R(8), R(7.5), B);                                                  // 머리 (크고 동그랗게)
  part.ell(p, X(36), Y(30), R(3.4), R(2.6), RAMP.belly, { outline: false });                   // 주둥이
  if (q.eye === 'shut') shutEye(p, X(33), Y(25));
  else part.gem(p, X(33), Y(25), R(2.8), R(3.4), { lid: q.eye === 'focus' ? 0.15 : 0.42, lidRamp: B });   // 졸린 큰 눈
  p.rect(X(34), Y(30), 3, 1, C.blush);
  if (q.mouth === 1) p.rect(X(37), Y(31), 3, 2, C.mouth);
  else { p.set(X(37), Y(31), OUT); p.set(X(38), Y(32), OUT); p.set(X(39), Y(31), OUT); }
  return p;
}

/* ───────── 어슬렁 좀비 walker — 머리 큰 카툰 좀비 · 툭 튀어나온 눈 + 처진 눈 · 침 흘리는 입 · 해진 양복 ───────── */
const ZSKIN = ['#c6d6a2', '#8fa66e', '#5a6e45'];
const JACKET = ['#a3825f', '#715640', '#45321f'];
const SHIRT = ['#ece6cf', '#c2b897', '#8a7e60'];
function walker(form, a) {
  const S = 44, p = new Pix(S, S), q = pose(a);
  const X = (v) => v + q.dx, Y = (v) => v + q.dy, lg = q.leg;
  /* 다리 — 안짱다리로 질질 */
  part.poly(p, [[X(12) + lg, Y(30)], [X(17) + lg, Y(30)], [X(16) + lg, S - 2], [X(12) + lg, S - 2]], ['#7d7f86', '#55575f', '#33343a']);
  part.poly(p, [[X(18) - lg, Y(30)], [X(23) - lg, Y(30)], [X(24) - lg, S - 3], [X(19) - lg, S - 3]], ['#7d7f86', '#55575f', '#33343a']);
  p.rect(X(10) + lg, S - 3, 8, 2, '#3a2a20'); p.rect(X(19) - lg, S - 3, 8, 2, '#3a2a20');      // 낡은 구두
  /* 뒷팔 — 축 늘어짐 */
  part.poly(p, [[X(10), Y(18)], [X(14), Y(17)], [X(13), Y(28)], [X(10), Y(28)]], JACKET);
  part.ell(p, X(11), Y(29), 2.2, 2, ZSKIN);
  /* 몸통 — 앞으로 굽은 해진 양복 + 얼룩진 셔츠 */
  part.poly(p, [[X(11), Y(17)], [X(24), Y(15)], [X(26), Y(31)], [X(12), Y(32)]], JACKET);
  part.poly(p, [[X(17), Y(16)], [X(22), Y(15)], [X(21), Y(30)], [X(17), Y(31)]], SHIRT, { outline: false });
  p.rect(X(18), Y(22), 2, 3, '#7a8a50'); p.set(X(20), Y(26), '#6a3030');                       // 셔츠 얼룩
  for (const [tx, ty] of [[13, 31], [16, 32], [22, 31], [25, 30]]) { p.set(X(tx), Y(ty), OUT); p.set(X(tx) + 1, Y(ty) + 1, OUT); }   // 찢어진 옷단
  /* 앞팔 — 앞으로 쭉, 손목이 축 처짐 */
  const reach = q.mouth === 1 ? 3 : 0;
  part.ell(p, X(28) + reach, Y(19), 6.5, 2.4, JACKET);
  part.poly(p, [[X(33) + reach, Y(18)], [X(37) + reach, Y(19)], [X(37) + reach, Y(25)], [X(34) + reach, Y(24)]], ZSKIN);
  for (const fx of [34, 36]) p.rect(X(fx) + reach, Y(25), 1, 2, ZSKIN[2]);                     // 처진 손가락
  /* 머리 — 크고 둥근 머리를 앞으로 기울임 */
  part.ell(p, X(26), Y(11), 9.5, 9, ZSKIN);
  part.ell(p, X(18), Y(11), 2.2, 3, ZSKIN);                                                    // 귀 (뜯긴)
  p.set(X(17), Y(9), OUT); p.set(X(17), Y(10), OUT);
  for (const [hx, hy, h] of [[20, 2, 3], [23, 1, 3], [26, 1, 2], [29, 2, 2]]) p.rect(X(hx), Y(hy), 1, h, '#2e2a22');   // 듬성 머리털
  p.set(X(22), Y(1), '#2e2a22'); p.set(X(27), Y(0), '#2e2a22');
  part.ell(p, X(22), Y(6), 2, 1.2, ['#a49cb8', '#7d6f95', '#55496a'], { outline: false });     // 멍
  if (q.eye === 'shut') { p.rect(X(28), Y(9), 4, 1, OUT); p.rect(X(23), Y(10), 3, 1, OUT); }
  else {
    /* 툭 튀어나온 큰 눈 (작은 눈동자가 딴 데를 봄) */
    part.ell(p, X(30), Y(9), 3.4, 3.6, ['#ffffff', '#f2eed8', '#c8c0a0']);
    p.rect(X(31), Y(10), 2, 2, q.eye === 'focus' ? '#c01818' : OUT);
    p.set(X(28), Y(7), '#e8a0a0');                                                             // 핏발
    /* 처진 작은 눈 + 다크서클 */
    part.ell(p, X(24), Y(10), 2, 1.6, ['#f2eed8', '#e2dcc0', '#c8c0a0'], { outline: false });
    p.rect(X(22), Y(9), 5, 1, OUT);                                                            // 처진 눈꺼풀
    p.set(X(24), Y(10), OUT);
    p.rect(X(23), Y(12), 3, 1, ZSKIN[2]);                                                      // 다크서클
  }
  /* 입 — 비뚤게 벌린 입 · 이빨 두어 개 · 초록 침 */
  const open = q.mouth === 1 ? 4 : q.mouth === 2 ? 3 : 2;
  part.poly(p, [[X(25), Y(15)], [X(33), Y(14)], [X(32), Y(15) + open], [X(26), Y(15) + open]], ['#5a1a24', '#3a0e16', '#22060c'], { lineCol: ZSKIN[2] });
  p.set(X(27), Y(15), SHIRT[0]); p.set(X(31), Y(14), SHIRT[0]); p.set(X(29), Y(15) + open - 1, SHIRT[1]);
  p.rect(X(32), Y(16) + open, 1, 2, '#9fd86a'); p.set(X(32), Y(18) + open, '#c8f27a');         // 침
  p.set(X(20), Y(14), ZSKIN[2]); p.set(X(33), Y(5), ZSKIN[2]);                                 // 썩은 반점
  const out = new Pix(S, S); out.blit(p, 0, 0, true);                                         // 왼쪽을 보게
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
