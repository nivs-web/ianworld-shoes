/**
 * 이안 드래곤 게임 — 월드 2~5 좀비 탑 · 배경 (겜팀장 · A2). 전부 오리지널 · 코드로 찍은 도트.
 * 탑 (96×160) : hp0~3 — 금이 늘고(1) · 모서리가 떨어지고(2) · 반대편도 깨지며 돌이 쏟아진다(3).
 *   월드 1 탑과 한 식구: 사다리꼴 몸 · 가운데 해골 장식 · 아래 문 · 꼭대기 깃발.
 *   2 화산(현무암 + 용암 줄눈 · 작은 화산 지붕) · 3 하늘섬(흰 돌 + 깃털 날개 · 구름 받침)
 *   4 얼음골(얼음 성벽 · 고드름 · 얼음에 갇힌 해골) · 5 고철 광산(리벳 철판 · 굴뚝 · 톱니 · 파이프)
 * 배경은 world_w25_bg.js (같은 규격 · 512칸 주기).
 */
import { Pix, part, polyCells } from './kit.js';
import { RAMP, OUT } from './palette.js';
import { BG_W25, hash } from './world_w25_bg.js';

const FLAG = ['#a8d468', '#6e9a3a', '#3e5a20'];                                     // 좀비 탑 공통 초록 깃발
const LAVA = ['#fff3a0', '#ffd23f', '#ff8a3a'];
const isOut = (c) => c[0] === 20 && c[1] === 8 && c[2] === 42;
const body = (p, x, y) => { const c = p.get(x, y); return !!c && !isOut(c); };
const clr = (p, x, y) => { if (x >= 0 && y >= 0 && x < p.w && y < p.h) p.d[(y * p.w + x) * 4 + 3] = 0; };
const mirror = (pts) => pts.map(([x, y]) => [95 - x, y]);
function line(p, ax, ay, bx, by, col) { const n = Math.max(Math.abs(bx - ax), Math.abs(by - ay), 1); for (let t = 0; t <= n; t++) p.set(Math.round(ax + ((bx - ax) * t) / n), Math.round(ay + ((by - ay) * t) / n), col); }

/** 벽돌 줄눈 — 몸 안쪽에만 · hot 이 있으면 군데군데 빛나는 줄눈 */
function mortar(p, y0, y1, step, bw, col, hot) {
  for (let y = y0, k = 0; y < y1; y += step, k++) for (let x = 0; x < p.w; x++) {
    if (!body(p, x - 2, y) || !body(p, x + 2, y)) continue;
    p.set(x, y, hot && hash(x, y, 5) < 0.3 ? hot : col);
    if ((x + (k % 2) * (bw >> 1)) % bw === 0) for (let j = 1; j < step; j++) if (body(p, x - 2, y + j) && body(p, x + 2, y + j)) p.set(x, y + j, col);
  }
}
/** 해골 장식 (월드 1 과 같은 얼굴) */
function skull(p, x, y, ramp = RAMP.bone, eye = '#c8f27a', eye2 = eye) {
  part.ell(p, x, y, 11, 10, ramp);
  p.rect(x - 6, y - 2, 4, 4, OUT); p.rect(x + 3, y - 2, 4, 4, OUT); p.set(x - 5, y - 1, eye); p.set(x + 4, y - 1, eye2); p.set(x - 4, y - 1, eye); p.set(x + 5, y - 1, eye2);
  p.set(x, y + 3, OUT); p.set(x + 1, y + 3, OUT);
  p.rect(x - 4, y + 6, 9, 2, OUT); for (let i = x - 3; i < x + 5; i += 2) p.set(i, y + 6, ramp[0]);
}
/** 아치 문 — 안쪽 색 · 창살 색 */
function door(p, inner, bar, glow) {
  part.ell(p, 48, 128, 10, 8, [inner, inner, inner]); p.rect(38, 128, 21, 31, OUT); p.rect(39, 129, 19, 30, inner);
  if (glow) { p.rect(39, 146, 19, 13, glow[0]); for (let y = 140; y < 146; y++) for (let x = 39; x < 58; x++) if ((x + y) % 2) p.set(x, y, glow[0]); p.rect(41, 152, 15, 7, glow[1]); }
  for (let x = 41; x < 58; x += 4) p.rect(x, 122, 1, 37, bar);
}
const CRACK = [[[64, 88], [58, 100], [63, 110], [60, 118]], [[30, 84], [36, 96], [31, 106], [35, 116]], [[66, 124], [61, 136], [66, 146], [62, 156]]];
const BITE2 = [[94, 52], [68, 58], [74, 65], [66, 72], [73, 79], [67, 85], [94, 90]], BITE3 = [[1, 44], [30, 50], [24, 57], [31, 63], [25, 70], [30, 76], [1, 80]];
/** 모서리가 떨어져 나감 — 칸을 지우고 새 가장자리에 외곽선 */
function bite(p, pts) {
  const cells = polyCells(pts), gone = new Set(cells.map(([x, y]) => `${x},${y}`));
  for (const [x, y] of cells) clr(p, x, y);
  for (const [x, y] of cells) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!gone.has(`${x + dx},${y + dy}`) && p.get(x + dx, y + dy)) p.set(x + dx, y + dy, OUT);
}
/** hp 단계별 부서짐 — glow: 금 안쪽 색(용암 · 얼음빛) */
function damage(p, hp, ramp, glow) {
  for (let i = 0; i < hp; i++) for (let j = 0; j + 1 < CRACK[i].length; j++) {
    const [ax, ay] = CRACK[i][j], [bx, by] = CRACK[i][j + 1], n = Math.max(Math.abs(bx - ax), Math.abs(by - ay));
    for (let t = 0; t <= n; t++) { const x = Math.round(ax + ((bx - ax) * t) / n), y = Math.round(ay + ((by - ay) * t) / n); if (body(p, x, y)) p.set(x, y, OUT); if (body(p, x + 1, y)) p.set(x + 1, y, glow ?? OUT); }
  }
  if (hp >= 2) { bite(p, BITE2); part.ell(p, 86, 156, 3, 2, ramp); }
  if (hp >= 3) { bite(p, BITE3); for (const [x, r] of [[10, 3], [17, 2], [80, 2], [91, 2]]) part.ell(p, x, 157 - r, r + 1, r, ramp); }
}

/* ───────── 월드 2 · 화산 탑 — 현무암 + 용암 줄눈 · 꼭대기는 작은 화산 ───────── */
function towerFire(hp) {
  const p = new Pix(96, 160), B = ['#8a6668', '#5a3c48', '#36222e'];
  part.poly(p, [[16, 158], [24, 36], [72, 36], [80, 158]], B);
  mortar(p, 46, 156, 11, 16, '#a8401f', '#ff8a3a');
  part.poly(p, [[16, 42], [36, 15], [42, 11], [54, 11], [60, 15], [80, 42]], ['#6a4a50', '#40282f', '#24141e']);   // 화산 지붕
  for (const [ax, ay, bx, by] of [[44, 12, 34, 26], [52, 12, 62, 24], [47, 12, 46, 30]]) { line(p, ax, ay, bx, by, '#ff8a3a'); line(p, ax + 1, ay, bx + 1, by, '#c4521f'); }
  part.ell(p, 48, 10, 6, 2.4, LAVA);                                                 // 끓는 용암
  p.set(44, 6, '#ffd23f'); p.set(53, 5, '#ff8a3a'); p.set(50, 3, '#ffd23f');
  skull(p, 48, 60, ['#f2dccc', '#c49a8a', '#8a5a50'], '#ffd23f');
  for (const pts of [[[8, 106], [26, 106], [23, 111], [11, 111]]]) for (const q of [pts, mirror(pts)]) part.poly(p, q, ['#6a5a5e', '#3a3040', '#241a28']);   // 불 화로
  for (const pts of [[[11, 106], [13, 97], [16, 101], [18, 92], [21, 99], [23, 106]]]) for (const q of [pts, mirror(pts)]) part.poly(p, q, LAVA);
  door(p, '#2a1018', '#4a2a2a', ['#8e2020', '#c4521f']);
  p.rect(29, 2, 2, 22, '#3a2430'); part.poly(p, [[31, 2], [45, 4], [39, 7], [45, 10], [31, 12]], ['#ffc27a', '#ff8a3a', '#c4521f']);   // 불꽃 깃발
  damage(p, hp, B, '#ff8a3a');
  if (hp >= 2) { part.poly(p, [[76, 74], [80, 64], [83, 70], [86, 62], [88, 76]], LAVA); }   // 깨진 틈에서 불길
  return p;
}

/* ───────── 월드 3 · 하늘섬 탑 — 흰 돌 · 양쪽 깃털 날개 · 푸른 돔 · 구름 받침 ───────── */
function towerSky(hp) {
  const p = new Pix(96, 160), ST = ['#fbf7ef', '#d6cde0', '#9a90b4'], SKY = RAMP.sky, FE = ['#ffffff', '#e8e4f6', '#aaa2ce'];
  const WING = [[34, 66], [26, 54], [14, 45], [3, 43], [6, 51], [1, 57], [6, 63], [2, 71], [8, 77], [5, 85], [14, 89], [14, 97], [24, 93], [34, 88]];
  for (const w of [WING, mirror(WING)]) part.poly(p, w, FE);
  for (const [ax, ay, bx, by] of [[30, 72, 8, 54], [30, 79, 7, 70], [30, 85, 10, 86], [26, 90, 16, 94]]) { line(p, ax, ay, bx, by, FE[2]); line(p, 95 - ax, ay, 95 - bx, by, FE[2]); }
  part.poly(p, [[20, 158], [27, 44], [69, 44], [76, 158]], ST);
  for (const x of [35, 61]) for (let y = 84; y < 150; y++) if (body(p, x, y)) p.set(x, y, '#b8aecb');   // 기둥 홈
  for (const [y, c] of [[54, ['#fff1a0', '#f2c230', '#a8780e']], [112, ['#bdeeff', '#5fc3f0', '#2f7fb8']]]) for (let x = 0; x < 96; x++) for (let j = 0; j < 3; j++) if (body(p, x - 1, y + j) && body(p, x + 1, y + j)) p.set(x, y + j, c[j]);   // 금 띠 · 하늘 띠
  for (const wx of [33, 59]) { p.rect(wx, 90, 5, 9, OUT); p.rect(wx + 1, 92, 3, 6, '#2f7fb8'); p.set(wx + 2, 91, '#2f7fb8'); p.set(wx + 1, 92, '#bdeeff'); }   // 창
  part.ell(p, 48, 42, 25, 11, SKY);                                                  // 푸른 돔 + 첨탑
  part.poly(p, [[42, 34], [48, 8], [54, 34]], SKY);
  part.ell(p, 48, 7, 3, 3, ['#fff1a0', '#f2c230', '#a8780e']);
  part.poly(p, [[52, 13], [66, 16], [60, 19], [66, 22], [52, 24]], FLAG);             // 첨탑에 매단 깃발
  skull(p, 48, 72);
  for (const pts of [[[30, 70], [26, 66], [22, 66], [25, 70], [21, 72], [26, 74]]]) for (const q of [pts, mirror(pts)]) part.poly(p, q, FE);   // 해골 꼬마 날개
  door(p, '#24345e', '#8f9bb3');
  for (const [cx, cy, rx, ry] of [[20, 154, 11, 6], [76, 154, 11, 6], [36, 157, 11, 4], [60, 157, 11, 4]]) part.ell(p, cx, cy, rx, ry, ['#ffffff', '#eef6ff', '#b8d0ee'], { lineCol: '#7a96c8' });   // 구름 받침
  damage(p, hp, ST, '#5fc3f0');
  if (hp >= 2) for (const [fx, fy] of [[84, 104], [90, 118], [8, 120]]) { p.rect(fx, fy, 4, 1, FE[0]); p.set(fx - 1, fy + 1, FE[2]); p.set(fx + 4, fy - 1, FE[2]); }   // 떨어지는 깃털
  return p;
}

/* ───────── 월드 4 · 얼음 요새 — 얼음 벽돌 · 눈 덮인 성가퀴 · 고드름 · 얼음에 갇힌 해골 ───────── */
function towerIce(hp) {
  const p = new Pix(96, 160), ICE = ['#e4fbff', '#94d6ee', '#4f92b4'], SNOW = ['#ffffff', '#f0f8ff', '#c8dcf0'], CRY = ['#ffffff', '#c8eeff', '#6ab0d8'];
  part.poly(p, [[14, 158], [22, 48], [74, 48], [82, 158]], ICE);
  mortar(p, 60, 156, 12, 18, '#5a9cbe');
  for (let i = 0; i < 16; i++) { const x = 24 + Math.floor(hash(i, 1, 91) * 48), y = 62 + Math.floor(hash(i, 2, 91) * 90); if (body(p, x, y) && body(p, x + 2, y + 2)) { p.set(x, y, '#ffffff'); p.set(x + 1, y + 1, '#ffffff'); } }
  part.poly(p, [[42, 46], [48, 4], [55, 46]], CRY); part.poly(p, [[38, 46], [35, 24], [44, 42]], CRY); part.poly(p, [[58, 46], [61, 26], [52, 42]], CRY);   // 얼음 첨탑
  part.poly(p, [[17, 44], [79, 44], [79, 52], [17, 52]], ICE);                        // 성벽 띠
  for (const [x0, x1] of [[17, 28], [31, 40], [56, 65], [68, 79]]) { part.poly(p, [[x0, 34], [x1, 34], [x1, 45], [x0, 45]], ICE); part.ell(p, (x0 + x1) / 2, 34, (x1 - x0) / 2 + 1, 2.2, SNOW); }
  for (const x of [21, 27, 33, 39, 57, 63, 69, 75]) part.poly(p, [[x - 2, 52], [x + 2, 52], [x, 56 + ((x * 7) % 6)]], CRY);   // 고드름
  part.poly(p, [[34, 62], [62, 62], [62, 88], [34, 88]], ['#f0fcff', '#b8e6f6', '#7ab8d4']);   // 얼음 덩이 속 해골
  skull(p, 48, 75, ['#f4f8ff', '#c4ccd8', '#8a94a8'], '#bdeeff');
  line(p, 53, 64, 60, 71, '#ffffff'); line(p, 56, 64, 60, 68, '#ffffff'); line(p, 36, 80, 40, 84, '#ffffff');
  door(p, '#1f3a72', '#bfe8ff');
  for (let x = 40; x < 57; x += 3) part.poly(p, [[x, 121], [x + 2, 121], [x + 1, 125]], CRY, { outline: false });
  for (const [cx, cy, rx, ry] of [[18, 156, 9, 4], [78, 156, 9, 4], [30, 158, 6, 3], [66, 158, 6, 3]]) part.ell(p, cx, cy, rx, ry, SNOW);   // 쌓인 눈
  p.rect(22, 14, 2, 20, '#3a4258'); part.poly(p, [[24, 14], [37, 17], [24, 21]], RAMP.mint);   // 깃발 (얼음빛 초록)
  damage(p, hp, ICE, '#ffffff');
  return p;
}

/* ───────── 월드 5 · 고철 공장 탑 — 리벳 철판 · 녹 · 굴뚝 · 톱니 · 셔터 문 ───────── */
function towerMetal(hp) {
  const p = new Pix(96, 160), ST = ['#c4c8d4', '#868a9a', '#4a4e5e'], DK = ['#8a8e9e', '#5c6274', '#3a3e4c'], RUST = ['#d08a5a', '#a0603a', '#6a3a22'];
  part.poly(p, [[72, 54], [86, 54], [86, 158], [80, 158], [80, 60], [72, 60]], ST);   // 옆 파이프
  for (let y = 70; y < 156; y += 22) p.rect(80, y, 6, 2, OUT);
  part.poly(p, [[16, 158], [22, 44], [74, 44], [80, 158]], ST);
  for (const y of [66, 96, 126]) for (let x = 0; x < 96; x++) if (body(p, x - 1, y) && body(p, x + 1, y)) { p.set(x, y, '#3a3e4c'); p.set(x, y + 1, '#d8dce6'); if (x % 6 === 0) p.set(x, y - 2, '#e3e6ee'); }   // 철판 이음 + 리벳
  for (const [x, y0, y1] of [[48, 44, 66], [32, 67, 96], [64, 67, 96], [48, 97, 126]]) for (let y = y0; y < y1; y++) if (body(p, x, y)) p.set(x, y, '#3a3e4c');
  for (const [cx, cy, rx, ry] of [[28, 84, 4, 6], [66, 140, 5, 4], [30, 142, 4, 5], [62, 108, 3, 4]]) part.ell(p, cx, cy, rx, ry, RUST, { outline: false });   // 녹
  part.poly(p, [[54, 100], [69, 98], [70, 112], [55, 114]], ['#a8b890', '#7a8a60', '#4e5a3a']);   // 덧댄 판
  for (const [x, y] of [[56, 102], [67, 100], [68, 110], [57, 112]]) p.set(x, y, '#e3e6ee');
  part.poly(p, [[58, 40], [58, 12], [68, 12], [68, 40]], ST);                         // 굴뚝
  p.rect(59, 17, 9, 2, '#c4402f'); p.rect(59, 24, 9, 2, '#c4402f');
  part.poly(p, [[56, 8], [70, 8], [70, 12], [56, 12]], DK);
  for (const [cx, cy, rx, ry] of [[66, 4, 3, 2.4], [73, 2, 3.4, 2]]) part.ell(p, cx, cy, rx, ry, ['#d8d4dc', '#a8a0ac', '#787080'], { outline: false });
  part.poly(p, [[18, 48], [20, 38], [76, 38], [78, 48]], DK);                         // 지붕판
  p.rect(39, 4, 2, 30, '#3a3e4c'); part.poly(p, [[41, 4], [54, 6], [50, 9], [55, 12], [41, 13]], FLAG);   // 안테나 깃발
  for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; part.ell(p, 28 + Math.round(Math.cos(a) * 8), 32 + Math.round(Math.sin(a) * 8), 1.6, 1.6, ST); }   // 톱니바퀴
  part.ell(p, 28, 32, 7, 7, ST); part.ell(p, 28, 32, 2, 2, ['#5c6274', '#3a3e4c', OUT]);
  skull(p, 48, 76, RAMP.bone, '#ff6a5a', '#c8f27a');
  p.rect(35, 70, 3, 5, '#868a9a'); p.set(35, 70, '#e3e6ee'); p.rect(34, 72, 1, 2, OUT);   // 머리에 박힌 볼트
  p.rect(36, 122, 25, 37, OUT);                                                      // 셔터 문 + 경고 줄무늬
  for (let y = 124; y < 159; y += 3) { p.rect(37, y, 23, 2, '#9aa1b2'); p.rect(37, y + 2, 23, 1, '#5c6274'); }
  for (let x = 37; x < 60; x++) for (let y = 119; y < 122; y++) p.set(x, y, Math.floor((x + y) / 3) % 2 ? '#f2c230' : '#2a2430');
  damage(p, hp, ST, '#2a2430');
  if (hp >= 3) for (const [cx, cy, r] of [[82, 52, 3], [86, 46, 4]]) part.ell(p, cx, cy, r, r * 0.8, ['#c8c4cc', '#8a8490', '#5a5462'], { outline: false });   // 터진 틈 연기
  return p;
}

const HP = ['hp0', 'hp1', 'hp2', 'hp3'];
const TOWER = { w02: towerFire, w03: towerSky, w04: towerIce, w05: towerMetal };
export const WORLD_W25 = {
  ...Object.fromEntries(Object.entries(TOWER).map(([w, fn]) => [`base/tower/${w}`, { anims: HP, draw: (a) => fn(+a.slice(2)) }])),
  ...BG_W25,
};
