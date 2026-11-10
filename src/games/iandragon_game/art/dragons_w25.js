/**
 * 이안 드래곤 게임 — 월드 2~5 용 5종 (겜팀장 · A3). 꼬물이 · 불똥이와 같은 아기 몬스터 비율:
 * 머리 크게 · 세로로 긴 까만 눈 + 하이라이트 · 동그란 볼 홍조 · 짧은 팔다리. 전부 오리지널.
 * 진화(2) = 부품 하나 더 + 색 진하게 + 크기 +4칸. 오른쪽을 본다 · 기준점 = 발 가운데.
 */
import { Pix, part, ellCells } from './kit.js';
import { RAMP, C, OUT } from './palette.js';
import { pose } from './units.js';
import { cuteEye } from './dragons_w1.js';

const blush = (p, x, y, r = 2.2) => part.ell(p, x, y, r, r * 0.65, [C.blush, C.blush, '#f07890'], { outline: false });
/** 물방울 모양 — 타원 둘레 + 뾰족한 끝 (tx, ty) 하나 */
export function dropPts(cx, cy, rx, ry, tx, ty, n = 28) {
  const ta = Math.atan2(ty - cy, tx - cx), pts = [];
  for (let i = 0; i < n; i++) { const a = ta + Math.PI * 0.3 + (i / (n - 1)) * Math.PI * 1.4; pts.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]); }
  pts.push([tx, ty]);
  return pts;
}
/** 타원 여러 개를 한 덩어리로 (안쪽 외곽선은 두 번째 칠로 덮는다) — 구름 · 털 뭉치 */
export function union(p, shapes, ramp) {
  for (const o of [{}, { outline: false }]) for (const [cx, cy, rx, ry] of shapes) part.ell(p, cx, cy, rx, ry, ramp, o);
}
/** 문자열 격자 → 칸 (글자마다 색 · '.' 빈칸) · 둘레에 외곽선 */
export function grid(p, ox, oy, rows, pal) {
  const cells = [];
  rows.forEach((r, y) => [...r].forEach((ch, x) => { if (pal[ch]) cells.push([ox + x, oy + y, pal[ch]]); }));
  const has = new Set(cells.map(([x, y]) => `${x},${y}`));
  for (const [x, y] of cells) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!has.has(`${x + dx},${y + dy}`)) p.set(x + dx, y + dy, OUT);
  for (const [x, y, c] of cells) p.set(x, y, c);
}
const smile = (p, x, y) => { p.set(x, y, OUT); p.set(x + 1, y + 1, OUT); p.set(x + 2, y, OUT); };
const WATER = ['#effbff', '#a6e0ff', '#5fb0e8'];
const ICE = ['#ffffff', '#d6f6ff', '#86cfe8'];
const FLUFF = ['#ffffff', '#f1ecfa', '#c9bce0'];
const INK = ['#6a6488', '#3a3552', '#1f1c30'];   // 찌릿이 검정 (외곽선과 갈라지게 살짝 보라)

/* ───────── 방울이 bangul — 물방울 머리 파란 아기 용 · 볼에 물을 머금음 (빨강 특화) ───────── */
function bangul(form, a) {
  const S = form === 1 ? 40 : 44, k = S / 40, p = new Pix(S, S), q = pose(a);
  const B = form === 1 ? RAMP.aqua : ['#8cc0ff', '#2f6ef0', '#173c90'];
  const X = (v) => Math.round(v * k) + q.dx, Y = (v) => Math.round(v * k) + q.dy, R = (v) => v * k;
  part.ell(p, X(6), Y(30), R(4), R(2.6), B);                                                   // 꼬리
  part.poly(p, dropPts(X(3), Y(26), R(2.6), R(2.6), X(6), Y(20)), WATER);                      // 꼬리 끝 물방울
  part.ell(p, X(12) - q.leg, S - 3, R(3.2), R(2.6), B, { openBottom: true });
  part.ell(p, X(15), Y(29), R(8.5), R(6.5), B);                                                // 몸
  part.ell(p, X(17), Y(31), R(5.2), R(4), ['#f4fbff', '#d2ecff', '#94c0e8']);                  // 배
  part.ell(p, X(21) + q.leg, S - 3, R(3.2), R(2.6), B, { openBottom: true });
  part.poly(p, [[X(9), Y(23)], [X(10), Y(16)], [X(15), Y(22)]], WATER);                        // 지느러미 날개
  part.poly(p, dropPts(X(23), Y(17), R(10.5), R(10), X(15), Y(1)), B);                         // 물방울 머리 (끝이 뒤로)
  for (const [gx, gy] of [[16, 9], [17, 8], [15, 11]]) p.set(X(gx), Y(gy), '#ffffff');         // 머리 물빛
  if (form === 2) {                                                                            // 진화: 물 지느러미 볏 + 물방울 하나 더
    part.poly(p, [[X(25), Y(8)], [X(29), Y(2)], [X(31), Y(9)]], WATER);
    part.poly(p, dropPts(X(20), Y(5), R(1.8), R(1.8), X(21), Y(1)), WATER);
  }
  const puff = a === 'atk0' ? 1 : 0;
  part.ell(p, X(27), Y(22), R(4.4) + puff, R(3.6) + puff, WATER);                               // 물 머금은 볼
  p.set(X(25), Y(20), '#ffffff'); p.set(X(26), Y(20), '#ffffff');
  cuteEye(p, X(28), Y(14), q, 4);
  blush(p, X(28), Y(24), 1.8);
  if (q.mouth === 1) { p.rect(X(32), Y(20), 2, 3, C.mouth); p.rect(X(34), Y(20), 4, 2, WATER[1]); p.rect(X(36), Y(19), 2, 1, WATER[0]); p.set(X(38), Y(21), WATER[1]); }   // 퓨! 물줄기
  else if (q.mouth === 2) p.rect(X(32), Y(21), 2, 2, C.mouth);
  else if (a === 'atk0') p.rect(X(31), Y(21), 3, 1, OUT);
  else smile(p, X(31), Y(21));
  return p;
}

/* ───────── 둥실이 dungsil — 풍선처럼 떠 있는 흰 · 연보라 구름 아기 용 · 발 대신 구름 (중거리 범위) ───────── */
function dungsil(form, a) {
  const S = form === 1 ? 40 : 44, k = S / 40, p = new Pix(S, S), q = pose(a);
  const L = form === 1 ? RAMP.cloud : ['#e8dcff', '#b096e8', '#7456b0'];
  const X = (v) => Math.round(v * k) + q.dx, Y = (v) => Math.round(v * k) + q.dy - 2, R = (v) => v * k;   // 2칸 떠 있다
  const g = q.leg;
  union(p, [[X(10) - g, S - 4, R(3.6), R(2.8)], [X(17), S - 4.4, R(4.6), R(3.4)], [X(24) + g, S - 4, R(3.6), R(2.8)]], FLUFF);   // 발밑 구름
  union(p, [[X(6), Y(26), R(3), R(2.6)], [X(3), Y(23), R(2), R(2)]], L);                       // 몽글 꼬리
  part.ell(p, X(16), Y(27), R(8.5), R(6.5), L);                                                // 몸
  part.ell(p, X(18), Y(29), R(5.2), R(3.8), FLUFF);                                            // 배
  union(p, [[X(9), Y(20), R(3.2), R(2.4)], [X(7), Y(17), R(2.4), R(2)]], FLUFF);               // 구름 날개
  part.ell(p, X(23), Y(16), R(10.5), R(10), L);                                                // 머리
  union(p, [[X(17), Y(7), R(3.2), R(2.4)], [X(21), Y(5), R(3.6), R(2.8)], [X(26), Y(6), R(3.2), R(2.4)]], FLUFF);   // 머리 구름털
  if (form === 2) {                                                                            // 진화: 작은 별 뿔 둘 + 볼 구름
    part.poly(p, [[X(29), Y(8)], [X(32), Y(3)], [X(32), Y(9)]], RAMP.lemon);
    part.poly(p, [[X(14), Y(9)], [X(11), Y(5)], [X(16), Y(7)]], RAMP.lemon);
    union(p, [[X(16), Y(21), R(2.4), R(2)]], FLUFF);
  }
  cuteEye(p, X(27), Y(14), q, 4);
  blush(p, X(26), Y(20), 2);
  if (q.mouth === 1) { p.rect(X(31), Y(18), 2, 2, C.mouth); union(p, [[X(36), Y(17), R(2.6), R(2.2)], [X(34), Y(15), R(1.6), R(1.4)]], FLUFF); }   // 후! 구름 뭉치
  else if (q.mouth === 2) p.rect(X(31), Y(19), 2, 2, C.mouth);
  else smile(p, X(30), Y(19));
  return p;
}

/* ───────── 길쭉이 giljjuk — 목이 아주 긴 레몬색 아기 용 · 등 돌기 (저격) ───────── */
function giljjuk(form, a) {
  const S = form === 1 ? 48 : 52, k = S / 48, p = new Pix(S, S), q = pose(a);
  const L = form === 1 ? ['#fdffc4', '#eceb5c', '#aea628'] : ['#f8f8a0', '#ded838', '#948a16'];
  const X = (v) => Math.round(v * k) + q.dx, Y = (v) => Math.round(v * k) + q.dy, R = (v) => v * k;
  const nk = a === 'atk0' ? 2 : 0;                                                             // 준비: 목을 젖힘
  part.ell(p, X(6), Y(38), R(4), R(2.4), L);                                                   // 꼬리
  part.ell(p, X(13) - q.leg, S - 3, R(3), R(2.6), L, { openBottom: true });
  part.ell(p, X(16), Y(37), R(9), R(6), L);                                                    // 몸 (작게)
  part.ell(p, X(18), Y(39), R(5.6), R(3.4), RAMP.belly);
  part.ell(p, X(22) + q.leg, S - 3, R(3), R(2.6), L, { openBottom: true });
  part.poly(p, [[X(10), Y(32)], [X(12), Y(26)], [X(16), Y(31)]], RAMP.ember);                  // 아기 날개
  for (let i = 0; i < 4; i++) part.poly(p, [[X(19 + i * 2.6) - nk, Y(30 - i * 5.4)], [X(17 + i * 2.6) - nk, Y(27 - i * 5.4)], [X(21 + i * 2.6) - nk, Y(28 - i * 5.4)]], RAMP.ember);   // 목 뒤 돌기
  part.poly(p, [[X(18), Y(36)], [X(26), Y(36)], [X(35) - nk, Y(13)], [X(28) - nk, Y(11)]], L); // 긴 목
  part.poly(p, [[X(23), Y(36)], [X(26), Y(36)], [X(35) - nk, Y(14)], [X(32) - nk, Y(13)]], RAMP.belly, { outline: false });   // 목 앞 줄무늬
  const hx = 33 - nk / k;
  part.ell(p, X(hx), Y(11), R(8.5), R(7.5), L);                                                // 머리
  part.ell(p, X(hx + 5), Y(14), R(3.6), R(2.6), RAMP.belly, { outline: false });               // 주둥이
  part.poly(p, [[X(hx - 6), Y(6)], [X(hx - 7), Y(0)], [X(hx - 3), Y(4)]], RAMP.ember);         // 뿔 둘
  part.poly(p, [[X(hx - 2), Y(4)], [X(hx - 1), Y(0)], [X(hx + 1), Y(4)]], RAMP.ember);
  if (form === 2) part.poly(p, [[X(hx - 9), Y(10)], [X(hx - 14), Y(5)], [X(hx - 8), Y(6)]], RAMP.lemon);   // 진화: 뒤로 뻗은 볏
  cuteEye(p, X(hx + 3), Y(10), q, 3);
  blush(p, X(hx + 1), Y(15), 1.8);
  if (q.mouth === 1) { p.rect(X(hx + 7), Y(14), 2, 2, C.mouth); part.ell(p, X(hx + 12), Y(13), R(2), R(2), [RAMP.lemon[0], RAMP.ember[1], RAMP.ember[2]]); }   // 톡! 씨앗탄
  else if (q.mouth === 2) p.rect(X(hx + 7), Y(14), 2, 2, C.mouth);
  else smile(p, X(hx + 6), Y(14));
  return p;
}

/* ───────── 얼음땡 eoreum — 고드름 뿔 민트색 아기 용 · 분홍 목도리 (방해) ───────── */
function eoreum(form, a) {
  const S = form === 1 ? 40 : 44, k = S / 40, p = new Pix(S, S), q = pose(a);
  const M = form === 1 ? RAMP.mint : ['#b2f6e2', '#46cbad', '#1d7f6a'];
  const X = (v) => Math.round(v * k) + q.dx, Y = (v) => Math.round(v * k) + q.dy, R = (v) => v * k;
  const fl = a === 'walk1' || a === 'kb0' ? -2 : a === 'walk0' ? 1 : 0;                       // 목도리 펄럭
  part.ell(p, X(6), Y(30), R(3.8), R(2.6), M);                                                 // 꼬리
  part.poly(p, [[X(1), Y(31)], [X(3), Y(26)], [X(5), Y(30)]], ICE);                             // 꼬리 끝 얼음
  part.poly(p, [[X(14), Y(22)], [X(5), Y(18) + fl], [X(4), Y(23) + fl], [X(13), Y(27)]], RAMP.rose);   // 목도리 끝 (뒤로)
  p.rect(X(5), Y(20) + fl, 4, 1, RAMP.rose[0]);
  part.ell(p, X(12) - q.leg, S - 3, R(3.2), R(2.6), M, { openBottom: true });
  part.ell(p, X(15), Y(29), R(8.5), R(6.5), M);                                                // 몸
  part.ell(p, X(17), Y(31), R(5.2), R(4), RAMP.belly);
  part.ell(p, X(21) + q.leg, S - 3, R(3.2), R(2.6), M, { openBottom: true });
  part.ell(p, X(23), Y(16), R(10.5), R(10), M);                                                // 머리
  part.poly(p, [[X(15), Y(9)], [X(16), Y(0)], [X(19), Y(7)]], ICE);                             // 고드름 뿔
  part.poly(p, [[X(21), Y(7)], [X(24), Y(0)], [X(26), Y(7)]], ICE);
  if (form === 2) part.poly(p, [[X(28), Y(9)], [X(32), Y(3)], [X(31), Y(11)]], ICE);           // 진화: 고드름 하나 더
  p.set(X(16), Y(4), '#ffffff'); p.set(X(23), Y(3), '#ffffff');
  part.poly(p, [[X(12), Y(22)], [X(22), Y(25)], [X(21), Y(29)], [X(12), Y(26)]], RAMP.rose);   // 목도리
  for (const sx of [15, 19]) p.rect(X(sx), Y(25), 1, 2, RAMP.rose[0]);                          // 목도리 줄무늬
  if (form === 2) { p.set(X(9), Y(30), '#ffffff'); p.rect(X(8), Y(30), 3, 1, ICE[1]); p.rect(X(9), Y(29), 1, 3, ICE[1]); p.set(X(9), Y(30), '#ffffff'); }   // 눈송이 무늬
  cuteEye(p, X(28), Y(14), q, 4);
  blush(p, X(27), Y(20), 2);
  if (q.mouth === 1) { p.rect(X(32), Y(19), 2, 2, C.mouth); for (const [ix, iy] of [[35, 19], [37, 17], [37, 21], [39, 19]]) p.rect(X(ix), Y(iy), 2, 2, ICE[1]); p.set(X(37), Y(19), '#ffffff'); }   // 하~ 얼음 숨결
  else if (q.mouth === 2) p.rect(X(32), Y(20), 2, 2, C.mouth);
  else smile(p, X(31), Y(20));
  return p;
}

/* ───────── 찌릿이 jjirit — 지그재그 번개 꼬리 노랑 · 검정 작은 용 · 등 줄무늬 (연타 · 치명타) ───────── */
function jjirit(form, a) {
  const S = form === 1 ? 32 : 36, k = S / 32, p = new Pix(S, S), q = pose(a);
  const Yl = form === 1 ? ['#fff6a8', '#ffd83a', '#cf9c1c'] : ['#ffec80', '#f6bf16', '#a8740c'];
  const X = (v) => Math.round(v * k) + q.dx + 2, Y = (v) => Math.round(v * k) + q.dy, R = (v) => v * k;
    const BOLT = ['y........', 'yy.......', '.yh......', '.hkk.....', '..hkk....', '...hkk...', '....hkk..', '....hkk..', '...hkk...', '..hkk....', '.hkk.....', '.hkk.....', '..hkk....', '...hkk...', '....hkk..', '.....hkk.', '......hkk', '.......hk'];
  const big = form === 2 ? ['y........', 'yy.......'] : [];
  grid(p, Math.max(0, X(1) - 2), Y(7) - big.length, [...big, ...BOLT], { y: RAMP.lemon[0], h: INK[0], k: INK[1] });   // 번개 꼬리 (Z자)
  part.ell(p, X(10) - q.leg, S - 3, R(2.6), R(2.5), Yl, { openBottom: true });
  part.ell(p, X(13), Y(24), R(7), R(5.5), Yl);                                                 // 몸
  const st = form === 1 ? [7, 8, 10, 11] : [6, 7, 9, 10, 12];                                 // 등 줄무늬 (몸 안쪽만)
  for (const [cx, cy] of ellCells(X(13), Y(24), R(7) - 1, R(5.5) - 1)) if (st.includes(cx - q.dx - 2) && cy < Y(26)) p.set(cx, cy, INK[1]);
  part.ell(p, X(15), Y(26), R(4.2), R(3), RAMP.belly);
  part.ell(p, X(18) + q.leg, S - 3, R(2.6), R(2.5), Yl, { openBottom: true });
  part.ell(p, X(19), Y(13), R(9), R(9), Yl);                                                 // 머리
  part.poly(p, [[X(13), Y(6)], [X(12), Y(1)], [X(16), Y(4)]], INK);                            // 작은 검정 뿔
  part.poly(p, [[X(18), Y(4)], [X(19), Y(0)], [X(21), Y(4)]], INK);
  for (const sx of [14, 17]) p.rect(X(sx), Y(7), 1, 2, INK[1]);                               // 이마 줄무늬
  if (form === 2) part.poly(p, [[X(22), Y(5)], [X(26), Y(1)], [X(25), Y(4)], [X(27), Y(3)], [X(24), Y(7)]], Yl);   // 진화: 번개 볏
  cuteEye(p, X(23), Y(12), q, 4);
  blush(p, X(22), Y(17), 1.8);
  const zap = a === 'atk1' || a === 'walk1';
  if (zap) for (const [sx, sy] of [[-2, 20], [-1, 11], [12, 8]]) p.set(X(sx), Y(sy), '#ffffff');   // 꼬리 불꽃
  if (q.mouth === 1) { p.rect(X(26), Y(16), 2, 2, C.mouth); for (const [zx, zy] of [[27, 13], [28, 14], [27, 15], [28, 16], [29, 17]]) p.set(X(zx), Y(zy), RAMP.lemon[0]); }   // 찌릿!
  else if (q.mouth === 2) p.rect(X(26), Y(17), 2, 2, C.mouth);
  else smile(p, X(25), Y(17));
  return p;
}

export const DRAGONS_W25 = {
  'dragon/bangul/1': (a) => bangul(1, a), 'dragon/bangul/2': (a) => bangul(2, a),
  'dragon/dungsil/1': (a) => dungsil(1, a), 'dragon/dungsil/2': (a) => dungsil(2, a),
  'dragon/giljjuk/1': (a) => giljjuk(1, a), 'dragon/giljjuk/2': (a) => giljjuk(2, a),
  'dragon/eoreum/1': (a) => eoreum(1, a), 'dragon/eoreum/2': (a) => eoreum(2, a),
  'dragon/jjirit/1': (a) => jjirit(1, a), 'dragon/jjirit/2': (a) => jjirit(2, a),
};
