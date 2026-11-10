/**
 * 이안 드래곤 게임 — 리더 5 (64×56 · idle0) + 아이콘 5 (24칸) (겜팀장 · A3). 전부 오리지널.
 * 리더는 노바트와 같은 뼈대(꼬리 · 몸 · 다리 · 머리)에 리더마다 날개 · 볏 · 소품을 달리 얹는다.
 */
import { Pix, part, ellCells } from './kit.js';
import { RAMP, C, OUT } from './palette.js';
import { grid } from './dragons_w25.js';

const GOLD = ['#fff1a0', '#f2c230', '#a8780e'];
const WATER = ['#effbff', '#a6e0ff', '#5fb0e8'];
const INK = ['#6a6488', '#3a3552', '#1f1c30'];

/** 뒤쪽 몸: 꼬리 · 뒷다리 · 몸 · 배 · 앞다리 (발은 맨 아래 칸에 닿는다) */
function lBody(p, B, belly = RAMP.belly) {
  part.ell(p, 14, 45, 6.5, 3.4, B);                                                              // 꼬리
  part.ell(p, 26, 51, 3.8, 3.6, B, { openBottom: true });                                        // 뒷다리
  part.ell(p, 30, 39, 11, 10, B);                                                                // 몸 (가슴을 편다)
  part.ell(p, 33, 42, 7, 7, belly);
  part.ell(p, 37, 51, 4.2, 3.8, B, { openBottom: true });                                        // 앞다리
}
/** 머리: 동그란 머리 · 주둥이 · 큰 눈 · 볼 · 씩 웃는 입 */
function lHead(p, B, belly = RAMP.belly) {
  part.ell(p, 44, 22, 11, 10, B);
  part.ell(p, 51, 26, 5, 3.6, belly, { outline: false });                                        // 주둥이
  p.rect(48, 17, 3, 7, OUT); p.rect(47, 18, 5, 5, OUT); p.rect(48, 18, 2, 2, '#ffffff'); p.set(50, 22, '#ffffff');   // 눈
  p.rect(46, 14, 5, 1, B[2]); p.set(51, 15, B[2]);                                               // 늠름한 눈썹
  part.ell(p, 44, 25, 2.2, 1.4, [C.blush, C.blush, '#f07890'], { outline: false });
  p.set(53, 27, OUT); p.set(54, 28, OUT); p.set(55, 28, OUT); p.set(56, 27, OUT);               // 씩
}

/* 아쿠안티스 — 청록 물의 용 · 지느러미 날개 · 부채 꼬리 · 가슴에 물방울 구슬 */
function aquantis() {
  const p = new Pix(64, 56), T = ['#a6f2ea', '#34c4bc', '#177a7c'], F = ['#e0fcff', '#8ae6f2', '#3a9cb8'];
  part.poly(p, [[22, 30], [8, 10], [5, 18], [9, 25], [15, 33]], F);                              // 뒤 지느러미
  part.poly(p, [[10, 45], [1, 37], [4, 45], [1, 53]], F);                                        // 부채 꼬리
  lBody(p, T);
  part.poly(p, [[30, 31], [40, 9], [47, 17], [45, 26], [38, 37]], F);                            // 앞 지느러미
  for (const [x0, y0, x1, y1] of [[33, 30, 40, 13], [37, 32, 44, 19]]) for (let t = 0; t <= 6; t++) p.set(Math.round(x0 + ((x1 - x0) * t) / 6), Math.round(y0 + ((y1 - y0) * t) / 6), F[2]);   // 지느러미 살
  lHead(p, T);
  part.poly(p, [[36, 15], [34, 5], [39, 10], [42, 2], [45, 9], [48, 5], [48, 13]], F);           // 지느러미 볏
  part.ell(p, 33, 32, 3.2, 3.2, WATER); p.set(32, 31, '#ffffff'); p.set(31, 32, '#ffffff');      // 물방울 구슬
  p.rect(30, 28, 7, 1, GOLD[2]);                                                                 // 구슬 끈
  return p;
}

/* 포레스티아 — 숲의 용 · 잎사귀 볏 · 잎 날개 · 머리에 꽃 · 덩굴 목걸이 */
function forestia() {
  const p = new Pix(64, 56), G = ['#b8ec78', '#5cb848', '#2c7238'], L = ['#e4ffb0', '#9ee060', '#4f9a30'];
  part.poly(p, [[22, 30], [12, 22], [3, 6], [16, 12], [25, 22]], L);                             // 뒤 잎 날개
  part.poly(p, [[8, 44], [1, 39], [3, 46], [8, 49]], L);                                         // 꼬리 끝 잎
  lBody(p, G);
  part.poly(p, [[30, 32], [34, 18], [46, 4], [46, 18], [39, 34]], L);                            // 앞 잎 날개
  for (let t = 0; t < 12; t++) p.set(Math.round(36 + t * 0.75), Math.round(31 - t * 2), L[2]); // 잎맥
  lHead(p, G);
  part.poly(p, [[37, 14], [31, 6], [39, 8]], L); part.poly(p, [[40, 12], [39, 1], [44, 9]], L); part.poly(p, [[45, 12], [50, 3], [50, 12]], L);   // 잎사귀 볏
  for (const [fx, fy] of [[-2, 0], [2, 0], [0, -2], [0, 2]]) part.ell(p, 36 + fx, 16 + fy, 1.6, 1.6, RAMP.rose, { outline: false });   // 꽃
  p.rect(35, 15, 2, 2, RAMP.lemon[1]);
  for (let x = 25; x < 36; x++) p.set(x, 29 + (x % 3 === 0 ? 1 : 0), '#3f8a2a');                // 덩굴 목걸이
  part.poly(p, [[30, 30], [28, 35], [32, 33]], L);
  return p;
}

/* 크림슨데 — 진홍 불의 용 · 박쥐 날개 · 불꽃 볏 · 꼬리 불 · 금 메달 */
function crimsonde() {
  const p = new Pix(64, 56), R = ['#ff9a8a', '#e0303a', '#8e1626'], M = ['#ffb070', '#ff6a3a', '#b03a1a'];
  part.poly(p, [[22, 27], [8, 2], [2, 10], [8, 13], [1, 21], [9, 22], [6, 30], [16, 34]], M);             // 뒤 박쥐 날개
  part.poly(p, [[8, 44], [1, 36], [5, 39], [4, 31], [10, 40], [11, 46]], ['#fff6a0', '#ffb030', '#e0602a']);   // 꼬리 불
  lBody(p, R);
  part.poly(p, [[30, 30], [40, 1], [53, 5], [46, 10], [53, 17], [45, 18], [47, 26], [38, 36]], M);        // 앞 박쥐 날개
  for (const [x0, y0, x1, y1] of [[34, 29, 40, 4], [37, 31, 50, 16]]) for (let t = 0; t <= 8; t++) p.set(Math.round(x0 + ((x1 - x0) * t) / 8), Math.round(y0 + ((y1 - y0) * t) / 8), R[2]);   // 날개 뼈
  lHead(p, R);
  part.poly(p, [[37, 15], [35, 6], [39, 9], [41, 0], [44, 8], [48, 3], [48, 13]], ['#fff6a0', '#ffd23f', '#ff8a3a']);   // 불꽃 볏
  part.poly(p, [[50, 15], [57, 9], [54, 17]], GOLD);                                              // 금 뿔
  part.ell(p, 32, 32, 3, 3, GOLD); p.rect(31, 31, 2, 2, '#e0303a'); p.set(31, 31, '#ffffff');    // 금 메달 + 루비
  return p;
}

/* 볼트테일 — 전기 노랑 용 · 커다란 번개 꼬리 · 검정 가시 볏 · 등 줄무늬 · 불꽃 튐 */
function volttail() {
  const p = new Pix(64, 56), Y = ['#fff6a8', '#ffd23f', '#c99a1f'];
  const BOLT = [0, 0, 1, 2, 3, 4, 5, 6, 5, 4, 3, 2, 2, 3, 4, 5, 6, 7, 8, 9].map((o, i) => (i === 0 ? 'yy' : '.'.repeat(o) + 'wyyyy').padEnd(14, '.'));
  grid(p, 0, 24, BOLT, { w: '#ffffff', y: Y[1] });                                               // 커다란 번개 꼬리 (꼬리 끝에서 솟음)
  part.poly(p, [[24, 30], [17, 17], [14, 25], [19, 33]], INK);                                    // 작은 검정 날개
  lBody(p, Y);
  for (const sx of [22, 26, 30]) for (const [cx, cy] of ellCells(30, 39, 10, 9)) if ((cx === sx || cx === sx + 1) && cy < 35) p.set(cx, cy, INK[1]);   // 등 줄무늬
  lHead(p, Y);
  part.poly(p, [[35, 18], [30, 12], [36, 13], [33, 6], [39, 10], [40, 2], [44, 9], [48, 4], [48, 13]], INK);   // 검정 가시 볏
  for (const [sx, sy] of [[5, 20], [13, 27], [58, 10], [61, 14], [16, 50]]) { p.set(sx, sy, '#fff6a8'); p.set(sx + 1, sy + 1, '#ffffff'); }   // 찌릿
  return p;
}

/* 솔라리스 — 해의 용 · 흰 금빛 몸 · 머리 뒤 해 바퀴 · 금 뿔 · 이마 보석 */
function solaris() {
  const p = new Pix(64, 56), S = ['#fffbe0', '#ffe49a', '#e2ae50'], W = ['#ffffff', '#fff3c8', '#e8c070'], WB = ['#ffffff', '#fff8ea', '#e6d4a8'];
  for (let i = 0; i < 12; i++) {                                                                  // 해 바퀴 빛살
    const an = (i / 12) * Math.PI * 2, c = Math.cos(an), s = Math.sin(an), r0 = 13, r1 = i % 2 ? 17 : 20;
    part.poly(p, [[44 + c * r0 - s * 2.4, 21 + s * r0 + c * 2.4], [44 + c * r1, 21 + s * r1], [44 + c * r0 + s * 2.4, 21 + s * r0 - c * 2.4]], ['#fff6c0', '#ffc840', '#f08a20']);
  }
  part.ell(p, 44, 21, 14, 13, ['#fff6c0', '#ffd860', '#f0a030']);                                 // 해 바퀴
  part.poly(p, [[20, 26], [4, 6], [10, 22], [2, 20], [16, 34]], W);                               // 뒤 날개
  lBody(p, S, WB);
  part.poly(p, [[30, 28], [42, 8], [42, 22], [52, 20], [38, 36]], W);                             // 앞 날개
  lHead(p, S, WB);
  part.poly(p, [[38, 14], [36, 3], [43, 12]], GOLD); part.poly(p, [[46, 12], [49, 2], [50, 12]], GOLD);   // 금 뿔
  part.poly(p, [[44, 13], [46, 10], [48, 13], [46, 16]], ['#ffd0a0', '#ff6a3a', '#b02a1a']);     // 이마 보석
  p.set(45, 12, '#ffffff');
  return p;
}

/* ───────── 아이콘 (24칸) — attr_red · skill_meteor 와 같은 짜임 ───────── */
/** 칸 묶음 칠하기: 외곽선 + 위 칸은 밝게 · 아래 칸은 어둡게 */
function strokes(p, cells, ramp) {
  const has = new Set(cells.map(([x, y]) => `${x},${y}`)), h = (x, y) => has.has(`${x},${y}`);
  for (const [x, y] of cells) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!h(x + dx, y + dy)) p.set(x + dx, y + dy, OUT);
  for (const [x, y] of cells) p.set(x, y, !h(x, y - 1) ? ramp[0] : !h(x, y + 1) ? ramp[2] : ramp[1]);
}
const line = (x0, x1, y, th = 2) => { const o = []; for (let x = x0; x <= x1; x++) for (let t = 0; t < th; t++) o.push([x, y + t]); return o; };
const arc = (cx, cy, r, skip) => ellCells(cx, cy, r, r).filter(([x, y]) => { const dx = x + 0.5 - cx, dy = y + 0.5 - cy; return dx * dx + dy * dy > (r - 1.8) ** 2 && !skip(dx, dy); });
const flake = (p, cx, cy, n, col, sh) => {                                                        // 눈송이 (그림자 1칸)
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]];
  for (const pass of [sh, col]) for (const [dx, dy] of dirs) for (let t = 0; t <= n; t++) { const o = pass === sh ? 1 : 0; p.set(cx + dx * t + o, cy + dy * t + o, pass); }
  for (const [dx, dy] of dirs.slice(0, 4)) { const bx = cx + dx * (n - 1), by = cy + dy * (n - 1); p.set(bx + dy, by + dx, col); p.set(bx - dy, by - dx, col); }
};
const ICON = {
  attr_ice: (p) => { part.ell(p, 12, 12, 10, 10, RAMP.attrIce); flake(p, 12, 12, 6, '#ffffff', RAMP.attrIce[2]); p.rect(11, 11, 3, 3, '#ffffff'); },
  attr_metal: (p) => {
    part.ell(p, 12, 12, 10, 10, RAMP.attrMetal);
    part.poly(p, [[12, 4], [19, 8], [19, 16], [12, 20], [5, 16], [5, 8]], ['#ffffff', '#c8ccd8', '#7a8094'], { lineCol: RAMP.attrMetal[2] });   // 육각 너트
    part.ell(p, 12, 12, 2.6, 2.6, ['#5c6274', '#3a3f4e', '#262a36'], { outline: false });
  },
  attr_wing: (p) => {
    part.ell(p, 12, 12, 10, 10, RAMP.sky);
    grid(p, 4, 6, ['......wwwwwwww.', '....wwwwwwwwwww', '..wwwwwwwwwwwww', '.ssssssssswwwww', '...wwwwwwwwwwww', '..ssssssswwwwww', '.....wwwwwwwwww', '....sssssswwwww', '........wwwwwww', '.......sssswwww', '...........wwww'], { w: '#ffffff', s: '#9fd8f0' });   // 깃털 날개
  },
  skill_gust: (p) => {
    const W = ['#ffffff', '#bdeeff', '#5fc3f0'];
    strokes(p, [...line(2, 15, 7), ...arc(15, 5, 3.2, (dx, dy) => dx < 0 && dy > 0)], W);          // 위 바람 (위로 말림)
    strokes(p, [...line(5, 19, 12), ...arc(19, 15, 3.2, (dx, dy) => dx < 0 && dy < 0)], W);        // 가운데 바람 (아래로 말림)
    strokes(p, line(2, 11, 18), W);
  },
  skill_frost: (p) => {
    const I = ['#ffffff', '#bfeaff', '#5aa6d0'];
    part.poly(p, [[5, 10], [8, 15], [5, 21], [2, 15]], I);                                        // 작은 얼음 조각
    part.poly(p, [[19, 8], [22, 13], [19, 20], [16, 13]], I);
    part.poly(p, [[12, 2], [17, 11], [12, 21], [7, 11]], I);                                      // 큰 얼음 결정
    for (let t = 0; t < 6; t++) p.set(10 - Math.floor(t / 3), 6 + t, '#ffffff');
    p.rect(12, 3, 1, 17, I[2]);
    for (const [sx, sy] of [[3, 4], [21, 3], [20, 22]]) { p.set(sx, sy, '#ffffff'); p.set(sx - 1, sy, I[1]); p.set(sx + 1, sy, I[1]); p.set(sx, sy - 1, I[1]); p.set(sx, sy + 1, I[1]); }   // 반짝
  },
};
const icon = (id) => { const p = new Pix(24, 24); ICON[id](p); return p; };

export const LEADERS_W25 = Object.fromEntries(Object.entries({ aquantis, forestia, crimsonde, volttail, solaris })
  .map(([id, draw]) => [`leader/${id}/0`, { anims: ['idle0'], draw: () => draw() }]));
export const ICONS_W25 = Object.fromEntries(Object.keys(ICON).map((id) => [`icon/${id}`, { anims: [], draw: () => icon(id) }]));
