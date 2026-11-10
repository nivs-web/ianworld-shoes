/**
 * 이안 드래곤 게임 — 월드 1 보스 · 리더 · 왕관 · 기지 (겜팀장 · A2 ②). 전부 오리지널.
 * 보스 동작: idle0 · walk0~3 · atk0 · atk1 · kb0 / 기지: hp0~3 (금이 점점) / 리더 · 왕관: idle0
 */
import { Pix, part } from './kit.js';
import { RAMP, C, OUT } from './palette.js';
import { pose } from './units.js';
import { zFace, ZSKIN } from './zombies_w1.js';

export const BOSS_ANIMS = ['idle0', 'walk0', 'walk1', 'walk2', 'walk3', 'atk0', 'atk1', 'kb0'];
const PANTS = ['#7d7f86', '#55575f', '#33343a'];
const GOLD = ['#fff1a0', '#f2c230', '#a8780e'];
const flip = (p) => { const o = new Pix(p.w, p.h); o.blit(p, 0, 0, true); return o; };

/* ───────── 뚱보 좀비 대장 bossFat (128칸) — 산만 한 배 · 뼈다귀 몽둥이 · 찢어진 양복 ───────── */
function bossFat(a) {
  const S = 128, p = new Pix(S, S);
  const w = { walk0: [1, 0], walk1: [-1, -2], walk2: [-1, 0], walk3: [1, -2] }[a] ?? [0, 0];
  const q = a.startsWith('walk') ? { dx: 0, dy: w[1], eye: 'open', mouth: 0 } : pose(a);
  const X = (v) => v + (q.dx ?? 0) * 2, Y = (v) => v + (q.dy ?? 0), g = w[0] * 3;
  for (const [lx, s] of [[40, 1], [70, -1]]) part.poly(p, [[X(lx) + g * s, Y(96)], [X(lx + 16) + g * s, Y(96)], [X(lx + 17) + g * s, S - 3], [X(lx - 1) + g * s, S - 3]], PANTS);
  for (const [lx, s] of [[36, 1], [68, -1]]) p.rect(X(lx) + g * s, S - 6, 22, 5, '#3a2a20');      // 구두
  part.ell(p, X(30), Y(70), 9, 16, ZSKIN);                                                       // 뒷팔
  part.ell(p, X(62), Y(72), 40, 32, ['#a3825f', '#715640', '#45321f']);                          // 찢어진 양복 몸통
  part.ell(p, X(68), Y(78), 28, 24, ZSKIN);                                                      // 산만 한 배
  for (const [bx, by, r] of [[58, 70, 3], [80, 88, 4], [72, 64, 2]]) part.ell(p, X(bx), Y(by), r, r * 0.7, ['#a8b880', '#7a8a50', '#4f5e3a'], { outline: false });   // 반점
  p.rect(X(68), Y(82), 3, 2, ZSKIN[2]);                                                          // 배꼽
  for (const [tx, ty] of [[30, 98], [44, 101], [86, 100], [98, 95]]) { p.rect(X(tx), Y(ty), 3, 2, OUT); }   // 찢어진 단
  /* 뼈다귀 몽둥이 (공격: 들었다 내려찍기) */
  const club = a === 'atk0' ? -26 : a === 'atk1' ? 10 : 0;
  part.ell(p, X(100), Y(66) + club * 0.4, 9, 7, ZSKIN);                                          // 앞팔 · 주먹
  part.poly(p, [[X(104), Y(60) + club], [X(110), Y(58) + club], [X(116), Y(30) + club], [X(110), Y(28) + club]], RAMP.bone);
  part.ell(p, X(110), Y(26) + club, 6, 5, RAMP.bone); part.ell(p, X(117), Y(29) + club, 5, 4.5, RAMP.bone);
  zFace(p, X(66), Y(30), 22, q);                                                                 // 큰 머리
  part.poly(p, [[X(50), Y(10)], [X(56), Y(2)], [X(60), Y(11)]], ZSKIN);                          // 머리 혹
  p.rect(X(78), Y(18), 8, 2, '#2a1c22');                                                         // 눈썹 흉터
  if (a === 'atk1') for (const [sx, sy] of [[104, 112], [114, 116], [94, 118]]) p.rect(X(sx), sy, 6, 2, '#c8b890');   // 땅 먼지
  return flip(p);
}

/* ───────── 리더 노바트 novart (64×56) — 내 기지 꼭대기의 파란 용 · 날개를 편 자세 ───────── */
const NAVY = ['#8fc4ff', '#4f86e0', '#2a4ea0'];
function novart() {
  const p = new Pix(64, 56);
  part.poly(p, [[20, 26], [4, 6], [10, 22], [2, 20], [16, 34]], ['#c6e0ff', '#8fb4f0', '#5a7ac0']);   // 뒤 날개
  part.ell(p, 14, 44, 6, 3.4, NAVY);                                                             // 꼬리
  part.ell(p, 28, 44, 4, 4, NAVY, { openBottom: true });
  part.ell(p, 30, 38, 11, 10, NAVY);                                                             // 몸
  part.ell(p, 33, 41, 7, 7, RAMP.belly);
  part.ell(p, 37, 50, 4, 4, NAVY, { openBottom: true });
  part.poly(p, [[30, 28], [46, 6], [44, 24], [54, 20], [38, 36]], ['#dceeff', '#a8ccf8', '#6a90d0']);   // 앞 날개
  part.ell(p, 44, 22, 11, 10, NAVY);                                                             // 머리
  part.poly(p, [[38, 14], [36, 3], [43, 12]], GOLD); part.poly(p, [[46, 12], [48, 2], [50, 12]], GOLD);   // 뿔
  part.ell(p, 51, 26, 5, 3.6, RAMP.belly, { outline: false });                                   // 주둥이
  p.rect(48, 17, 3, 7, OUT); p.rect(47, 18, 5, 5, OUT); p.rect(48, 18, 2, 2, '#ffffff'); p.set(50, 22, '#ffffff');   // 눈
  p.rect(41, 23, 3, 1, '#ff9ab0');
  p.set(54, 27, OUT); p.set(55, 28, OUT); p.set(56, 27, OUT);
  p.rect(28, 30, 8, 2, '#e04a3a'); p.rect(26, 32, 3, 5, '#e04a3a');                             // 빨간 목도리 (리더 표시)
  return p;
}

/* ───────── 중간 보스 왕관 crown (24×16) ───────── */
function crown() {
  const p = new Pix(24, 16);
  part.poly(p, [[2, 14], [2, 4], [7, 9], [12, 2], [17, 9], [22, 4], [22, 14]], GOLD);
  p.rect(5, 11, 3, 2, '#e04a3a'); p.rect(11, 10, 3, 3, '#3f8cff'); p.rect(17, 11, 3, 2, '#e04a3a');
  p.set(12, 3, '#ffffff'); p.set(3, 5, '#ffffff');
  return p;
}

/* ───────── 기지 (96×160) — 내 둥지 탑 · 좀비 탑, hp0~3 금 ───────── */
function cracks(p, n, col) {
  const lines = [[[30, 40], [36, 52], [32, 62]], [[60, 80], [54, 94], [60, 104], [56, 116]], [[40, 120], [48, 132], [44, 146]]];
  for (let i = 0; i < n; i++) for (let j = 0; j + 1 < lines[i].length; j++) {
    const [ax, ay] = lines[i][j], [bx, by] = lines[i][j + 1], st = Math.max(Math.abs(bx - ax), Math.abs(by - ay));
    for (let t = 0; t <= st; t++) { const x = Math.round(ax + ((bx - ax) * t) / st), y = Math.round(ay + ((by - ay) * t) / st); p.set(x, y, col); p.set(x + 1, y, col); }
  }
}
function nest(hp) {
  const p = new Pix(96, 160);
  part.poly(p, [[18, 158], [24, 40], [72, 40], [78, 158]], RAMP.stone);                          // 돌탑
  for (let y = 52; y < 156; y += 14) for (let x = (y / 14) % 2 ? 26 : 34; x < 72; x += 16) p.rect(x, y, 12, 1, RAMP.stone[2]);   // 돌 줄눈
  p.rect(40, 126, 16, 32, OUT); part.ell(p, 48, 126, 8, 8, ['#4a3a2a', '#3a2a1a', '#2a1a10'], { outline: false });   // 문
  part.ell(p, 48, 36, 34, 12, ['#f2d080', '#c89a40', '#8a6420']);                                 // 짚 둥지
  for (let x = 18; x < 80; x += 5) { p.rect(x, 30 + ((x * 7) % 5), 4, 1, '#8a6420'); p.set(x + 2, 44 - ((x * 3) % 4), '#fff0b0'); }
  part.ell(p, 34, 28, 6, 5, ['#ffffff', '#f2eed8', '#c8c0a0']); part.ell(p, 62, 29, 5, 4.4, ['#ffffff', '#f2eed8', '#c8c0a0']);   // 알
  p.set(32, 26, '#ff9ab0'); p.set(61, 27, '#8fc4ff');
  p.rect(46, 4, 2, 18, RAMP.rag[1]); part.poly(p, [[48, 4], [62, 8], [48, 13]], ['#ff8a8a', '#e04a3a', '#a02020']);   // 깃발
  cracks(p, hp, RAMP.stone[2] === OUT ? '#000' : OUT);
  return p;
}
function tower(hp) {
  const p = new Pix(96, 160);
  const WOOD = ['#8a7a8f', '#5e4f66', '#3a2f42'];
  part.poly(p, [[16, 158], [26, 30], [70, 30], [80, 158]], WOOD);                                // 썩은 나무 탑
  for (let y = 40; y < 156; y += 10) p.rect(24, y, 50, 1, WOOD[2]);
  for (const [vx, vy] of [[28, 60], [66, 96], [34, 130]]) part.ell(p, vx, vy, 4, 6, ['#a8d468', '#6e9a3a', '#3e5a20'], { outline: false });   // 덩굴 · 이끼
  p.rect(38, 122, 20, 36, OUT); for (let x = 40; x < 58; x += 4) p.rect(x, 124, 1, 34, '#4a3a2a');   // 창살 문
  part.poly(p, [[20, 34], [48, 6], [76, 34]], ['#7a6a80', '#4f4258', '#2f2638']);                // 뾰족 지붕
  part.ell(p, 48, 52, 11, 10, RAMP.bone);                                                        // 해골 장식
  p.rect(42, 50, 4, 4, OUT); p.rect(51, 50, 4, 4, OUT); p.set(43, 51, '#c8f27a'); p.set(52, 51, '#c8f27a');
  p.rect(44, 58, 9, 2, OUT); for (let x = 45; x < 53; x += 2) p.set(x, 58, RAMP.bone[0]);
  p.rect(47, 2, 2, 8, '#3a2f42'); part.poly(p, [[49, 2], [60, 5], [49, 9]], ['#a8d468', '#6e9a3a', '#3e5a20']);   // 초록 깃발
  cracks(p, hp, OUT);
  return p;
}

export const MISC_W1 = {
  'boss/bossFat/0': { anims: BOSS_ANIMS, draw: (a) => bossFat(a) },
  'leader/novart/0': { anims: ['idle0'], draw: () => novart() },
  'crown/0/0': { anims: ['idle0'], draw: () => crown() },
  'base/nest/0': { anims: ['hp0', 'hp1', 'hp2', 'hp3'], draw: (a) => nest(+a.slice(2)) },
  'base/tower/w01': { anims: ['hp0', 'hp1', 'hp2', 'hp3'], draw: (a) => tower(+a.slice(2)) },
};
