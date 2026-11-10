/**
 * 이안 드래곤 게임 — 월드 1 용 3종 (겜팀장 · A2). 꼬물이와 같은 아기 몬스터 비율:
 * 머리 크게 · 세로로 긴 까만 눈 + 하이라이트 · 동그란 볼 홍조 · 짧은 팔다리. 전부 오리지널.
 */
import { Pix, part } from './kit.js';
import { RAMP, C, OUT } from './palette.js';
import { pose, shutEye } from './units.js';

/** 아기 몬스터 눈 (세로 타원 · 큰 하이라이트) */
export function cuteEye(p, ex, ey, q, eh = 4) {
  if (q.eye === 'shut') { shutEye(p, ex, ey + 1); return; }
  const h = q.eye === 'focus' ? eh - 1 : eh;
  p.rect(ex - 1, ey - h + 1, 3, h * 2 - 1, OUT); p.rect(ex - 2, ey - h + 2, 5, Math.max(1, h * 2 - 3), OUT);
  p.rect(ex - 1, ey - h + 2, 2, 2, '#ffffff'); p.set(ex + 1, ey + h - 3, '#ffffff');
  p.set(ex, ey + h - 2, '#4a3a6a');
}
const blush = (p, x, y, r = 2.2) => part.ell(p, x, y, r, r * 0.65, [C.blush, C.blush, '#f07890'], { outline: false });

/* ───────── 불똥이 bulttong — 볼이 빵빵한 주황 아기 용 · 꼬리 끝 불씨 (근접 딜러) ───────── */
function bulttong(form, a) {
  const S = form === 1 ? 40 : 44, k = S / 40, p = new Pix(S, S), q = pose(a);
  const O = form === 1 ? RAMP.ember : ['#ffb066', '#f2731f', '#a8401a'];
  const X = (v) => Math.round(v * k) + q.dx, Y = (v) => Math.round(v * k) + q.dy, R = (v) => v * k;
  const fl = a === 'walk1' || a === 'atk1' ? 1 : 0;                                            // 불씨 일렁임
  part.ell(p, X(6), Y(29), R(4), R(2.6), O);                                                   // 꼬리
  part.poly(p, [[X(1), Y(27)], [X(3), Y(19) - fl], [X(5), Y(23)], [X(6), Y(18) + fl], [X(8), Y(27)]], RAMP.lemon);   // 꼬리 불씨
  p.set(X(4), Y(24), '#ffffff');
  part.ell(p, X(12) - q.leg, S - 3, R(3.2), R(2.6), O, { openBottom: true });
  part.ell(p, X(15), Y(29), R(8.5), R(6.5), O);                                                // 몸
  part.ell(p, X(17), Y(31), R(5.2), R(4), RAMP.belly);
  part.ell(p, X(21) + q.leg, S - 3, R(3.2), R(2.6), O, { openBottom: true });
  part.poly(p, [[X(9), Y(22)], [X(11), Y(15)], [X(15), Y(21)]], ['#ffd8a8', '#ffa860', '#d0702a']);   // 아기 날개
  part.ell(p, X(23), Y(16), R(11), R(10.5), O);                                                // 머리
  part.poly(p, [[X(17), Y(8)], [X(18), Y(2)], [X(21), Y(7)]], RAMP.belly);                    // 뿔
  part.poly(p, [[X(23), Y(6)], [X(26), Y(1)], [X(27), Y(7)]], RAMP.belly);
  if (form === 2) part.poly(p, [[X(28), Y(8)], [X(32), Y(4)], [X(31), Y(10)]], RAMP.lemon);   // 진화: 뿔 하나 더
  part.ell(p, X(27), Y(22), R(4.6), R(3.6), ['#ffcf98', '#ffab6a', '#e0803a']);               // 빵빵한 볼 (불덩이 볼)
  cuteEye(p, X(28), Y(14), q, 4);
  blush(p, X(28), Y(22), 2);
  if (q.mouth === 1) { p.rect(X(32), Y(19), 3, 3, C.mouth); p.rect(X(35), Y(19), 2, 2, RAMP.lemon[1]); p.set(X(37), Y(18), RAMP.lemon[0]); }   // 콱 + 불꽃
  else if (q.mouth === 2) p.rect(X(32), Y(20), 2, 2, C.mouth);
  else { p.set(X(32), Y(20), OUT); p.set(X(33), Y(21), OUT); p.set(X(34), Y(20), OUT); }
  return p;
}

/* ───────── 퉤퉤 twetwe — 입이 얼굴 절반인 노랑 아기 용 · 불덩이를 «퉤» (원거리 범위) ───────── */
function twetwe(form, a) {
  const S = form === 1 ? 40 : 44, k = S / 40, p = new Pix(S, S), q = pose(a);
  const Y0 = form === 1 ? RAMP.lemon : ['#ffe680', '#f2be20', '#a87a10'];
  const X = (v) => Math.round(v * k) + q.dx, Y = (v) => Math.round(v * k) + q.dy, R = (v) => v * k;
  part.ell(p, X(6), Y(30), R(3.6), R(2.4), Y0);                                                // 꼬리
  part.ell(p, X(12) - q.leg, S - 3, R(3), R(2.6), Y0, { openBottom: true });
  part.ell(p, X(14), Y(29), R(8), R(6.5), Y0);
  part.ell(p, X(16), Y(31), R(5), R(4), RAMP.belly);
  part.ell(p, X(20) + q.leg, S - 3, R(3), R(2.6), Y0, { openBottom: true });
  part.poly(p, [[X(8), Y(22)], [X(10), Y(16)], [X(14), Y(22)]], RAMP.ember);                  // 아기 날개 (주황)
  const puff = a === 'atk0' ? 1.6 : 0;                                                          // 준비: 볼이 부풂
  part.ell(p, X(23), Y(17), R(11) + puff, R(10.5) + puff, Y0);                                 // 머리
  part.ell(p, X(24), Y(6), R(3), R(2.4), RAMP.ember);                                          // 이마 볏
  if (form === 2) part.ell(p, X(19), Y(7), R(2.4), R(2), RAMP.ember);
  cuteEye(p, X(24), Y(12), q, 3);
  /* 얼굴 절반 크기의 입 */
  if (q.mouth === 1) {                                                                          // 퉤! (크게 벌리고 불덩이)
    part.ell(p, X(29), Y(21), R(5.5), R(5), ['#a0303a', C.mouth, '#5a1420']);
    part.ell(p, X(30), Y(23), R(3), R(2), [C.tongue, C.tongue, '#d04a5a'], { outline: false });
    part.ell(p, X(35), Y(18), R(3), R(3), [RAMP.lemon[0], RAMP.ember[1], RAMP.ember[2]]);
  } else if (a === 'atk0') {                                                                    // 볼 빵빵 · 입 꾹
    p.rect(X(27), Y(22), 8, 1, OUT); p.set(X(26), Y(21), OUT); p.set(X(35), Y(21), OUT);
  } else {                                                                                      // 넓게 웃는 입
    part.poly(p, [[X(24), Y(20)], [X(33), Y(19)], [X(31), Y(25)], [X(26), Y(25)]], ['#a0303a', C.mouth, '#5a1420']);
    p.rect(X(27), Y(24), 4, 1, C.tongue);
  }
  blush(p, X(21), Y(21), 2);
  return p;
}

/* ───────── 쌩쌩이 ssaeng — 길쭉한 하늘색 아기 용 · 눈가 고글 무늬 · 바람 볏 (돌격) ───────── */
function ssaeng(form, a) {
  const S = form === 1 ? 48 : 52, k = S / 48, p = new Pix(S, S), q = pose(a);
  const B = form === 1 ? RAMP.sky : ['#a8e4ff', '#40aee8', '#1f6aa8'];
  const X = (v) => Math.round(v * k) + q.dx * 2, Y = (v) => Math.round((v + 4) * k) + q.dy, R = (v) => v * k;   // 몸을 4칸 내려 다리와 붙인다
  const run = q.leg;
  part.poly(p, [[X(2), Y(30)], [X(12), Y(32)], [X(12), Y(36)], [X(4), Y(35)]], B);            // 길게 뻗은 꼬리
  part.poly(p, [[X(1), Y(28)], [X(5), Y(30)], [X(2), Y(33)]], ['#ffffff', '#dff6ff', '#9fd8f0']);   // 꼬리 끝 깃
  part.ell(p, X(14) - run, S - 3, R(3), R(2.6), B, { openBottom: true });
  part.ell(p, X(22), Y(34), R(12), R(5.5), B);                                                 // 길쭉한 몸
  part.ell(p, X(24), Y(36), R(8), R(3), RAMP.belly);
  part.ell(p, X(30) + run, S - 3, R(3), R(2.6), B, { openBottom: true });
  part.poly(p, [[X(14), Y(27)], [X(20), Y(22)], [X(23), Y(28)]], ['#ffffff', '#dff6ff', '#9fd8f0']);   // 날개
  part.ell(p, X(35), Y(24), R(10), R(9), B);                                                   // 머리
  part.poly(p, [[X(28), Y(17)], [X(22), Y(12)], [X(31), Y(15)]], ['#ffffff', '#dff6ff', '#9fd8f0']);   // 뒤로 젖힌 바람 볏
  part.poly(p, [[X(32), Y(16)], [X(28), Y(9)], [X(35), Y(15)]], ['#ffffff', '#dff6ff', '#9fd8f0']);
  if (form === 2) part.poly(p, [[X(36), Y(16)], [X(34), Y(8)], [X(39), Y(15)]], RAMP.lemon);
  part.poly(p, [[X(33), Y(18)], [X(44), Y(18)], [X(44), Y(25)], [X(34), Y(25)]], ['#3a4a7a', '#2a3460', '#1a2040'], { outline: false });   // 고글 무늬
  cuteEye(p, X(39), Y(21), q, 3);
  blush(p, X(37), Y(28), 2);
  if (q.mouth === 1) p.rect(X(42), Y(28), 3, 2, C.mouth);
  else { p.set(X(42), Y(28), OUT); p.set(X(43), Y(29), OUT); p.set(X(44), Y(28), OUT); }
  if (a === 'walk0' || a === 'walk1' || a === 'atk1') for (const [lx, ly] of [[2, 22], [6, 25], [0, 38]]) p.rect(X(lx), Y(ly), 4, 1, '#dff6ff');   // 바람 줄
  return p;
}

export const DRAGONS_W1 = {
  'dragon/bulttong/1': (a) => bulttong(1, a), 'dragon/bulttong/2': (a) => bulttong(2, a),
  'dragon/twetwe/1': (a) => twetwe(1, a), 'dragon/twetwe/2': (a) => twetwe(2, a),
  'dragon/ssaeng/1': (a) => ssaeng(1, a), 'dragon/ssaeng/2': (a) => ssaeng(2, a),
};
