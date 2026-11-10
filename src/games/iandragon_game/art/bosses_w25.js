/**
 * 이안 드래곤 게임 — 월드 2~5 보스 (겜팀장 · A2 ③). 동작 8장(BOSS_ANIMS): idle0 · walk0~3 · atk0(준비) · atk1(타격) · kb0(움찔).
 * 이 파일 = 화산 좀비 킹(월드 2) · 좀비 라이더(월드 3). 눈사태 거인 · 고철 대왕 로봇은 bosses_w25b.js.
 * 우스꽝스러운 악당 느낌 · 승인본 좀비 얼굴. 오른쪽으로 그린 뒤 뒤집어 왼쪽을 보게 한다. 전부 오리지널.
 */
import { part } from './kit.js';
import { RAMP, OUT } from './palette.js';
import { BOSS_ANIMS } from './misc_w1.js';
import { zFace, ZSKIN } from './zombies_w1.js';
import { bossBase, flip, FI, rips, zFeat, flame, LAVA, ROCKD, SMOKE } from './zombies_w25_kit.js';
import { BOSSES_W25B } from './bosses_w25b.js';

const GOLD = RAMP.attrGold, RED = RAMP.attrRed;
const ROYAL = ['#c88ad8', '#8e4fae', '#582a74'];
const VSKIN = ['#b8ae90', '#7e745e', '#4c4234'];                                              // 그을린 좀비 살
const crack = (p, pts, col) => { for (let i = 0; i + 1 < pts.length; i++) { const [ax, ay] = pts[i], [bx, by] = pts[i + 1], n = Math.max(Math.abs(bx - ax), Math.abs(by - ay)); for (let t = 0; t <= n; t++) p.set(Math.round(ax + (bx - ax) * t / n), Math.round(ay + (by - ay) * t / n), col); } };

/* ───────── 화산 좀비 킹 bossVolcano (136) — 머리에서 화산이 솟은 바위 거인 왕 · 용암 주먹 · 해진 망토 · 분화구에 걸친 왕관 ───────── */
function bossVolcano(a) {
  const S = 142, { p, q, X, Y, g } = bossBase(S, a, 0, 6), f = FI(a);
  /* 해진 왕의 망토 (뒤) */
  part.poly(p, [[X(36), Y(50)], [X(60), Y(48)], [X(58), Y(118)], [X(48), Y(124)], [X(40), Y(117)], [X(30), Y(125)], [X(20), Y(116)], [X(14), Y(120)]], ROYAL);
  for (const [tx, ty] of [[18, 116], [30, 121], [44, 119]]) rips(p, [[X(tx), Y(ty)]]);
  p.rect(X(30), Y(70), 3, 3, OUT); p.set(X(22), Y(100), OUT);                                  // 망토 구멍
  /* 다리 */
  for (const [lx, s] of [[44, 1], [74, -1]]) {
    part.poly(p, [[X(lx) + g * s * 4, Y(100)], [X(lx + 18) + g * s * 4, Y(100)], [X(lx + 19) + g * s * 4, S - 3], [X(lx - 1) + g * s * 4, S - 3]], ROCKD);
    part.ell(p, X(lx + 9) + g * s * 4, S - 5, 13, 4, ROCKD, { openBottom: true });
    crack(p, [[X(lx + 6) + g * s * 4, Y(104)], [X(lx + 10) + g * s * 4, Y(114)], [X(lx + 7) + g * s * 4, Y(122)]], LAVA[1]);
  }
  part.ell(p, X(28), Y(82), 10, 17, ROCKD);                                                    // 뒷팔
  part.ell(p, X(26), Y(100), 9, 8, ROCKD); crack(p, [[X(22), Y(96)], [X(26), Y(101)], [X(30), Y(98)]], LAVA[1]);
  /* 몸 — 바위 몸통 · 용암 배 · 이글 금 */
  part.ell(p, X(64), Y(82), 36, 28, ROCKD);
  part.ell(p, X(72), Y(88), 20, 16, LAVA);
  part.ell(p, X(74), Y(86), 10, 7, [RAMP.lemon[0], RAMP.lemon[1], LAVA[1]], { outline: false });   // 이글이글 속
  crack(p, [[X(56), Y(80)], [X(62), Y(88)], [X(58), Y(96)]], ROCKD[1]); crack(p, [[X(86), Y(80)], [X(82), Y(90)], [X(88), Y(98)]], ROCKD[1]);   // 굳어 가는 금
  crack(p, [[X(40), Y(64)], [X(46), Y(74)], [X(42), Y(86)], [X(48), Y(96)]], LAVA[0]);
  crack(p, [[X(56), Y(60)], [X(60), Y(68)]], LAVA[1]);
  for (const [mx, my] of [[36, 76], [50, 100], [90, 70]]) part.ell(p, X(mx), Y(my), 3, 2, ['#a8c870', '#6e9040', '#3e5a24'], { outline: false });   // 이끼 (썩음)
  /* 머리 — 그을린 좀비 얼굴 위로 화산이 솟았다 */
  part.poly(p, [[X(46), Y(44)], [X(96), Y(44)], [X(83), Y(13)], [X(59), Y(13)]], ROCKD);         // 화산 뿔
  crack(p, [[X(66), Y(18)], [X(64), Y(26)], [X(67), Y(33)]], LAVA[1]); crack(p, [[X(86), Y(24)], [X(88), Y(32)]], LAVA[1]);
  part.ell(p, X(71), Y(13), 12, 3, LAVA);                                                       // 분화구 용암
  part.poly(p, [[X(74), Y(14)], [X(79), Y(14)], [X(81), Y(28)], [X(77), Y(33)]], LAVA, { outline: false });   // 흘러내림
  part.poly(p, [[X(61), Y(15)], [X(64), Y(15)], [X(62), Y(25)]], LAVA, { outline: false });
  part.ell(p, X(70), Y(52), 24, 20, VSKIN);
  zFeat(p, X(76), Y(52), 19, q, { skin: VSKIN, drool: [LAVA[1], LAVA[0]] });
  p.rect(X(80), Y(40), 12, 3, OUT); p.rect(X(78), Y(41), 3, 2, OUT);                          // 성난 눈썹
  /* 왕관 — 분화구 가장자리에 삐뚤게 */
  const cb = (a === 'atk1' ? -5 : 0) + 6;
  part.poly(p, [[X(80), Y(10) + cb], [X(81), Y(0) + cb], [X(85), Y(5) + cb], [X(89), Y(-1) + cb], [X(92), Y(5) + cb], [X(96), Y(1) + cb], [X(95), Y(12) + cb]], GOLD);
  p.rect(X(87), Y(7) + cb, 3, 2, RED[1]);
  /* 연기 · 분화 */
  if (a === 'atk1' || a === 'atk0') {
    const h = a === 'atk1' ? 0 : 8;
    flame(p, X(65), Y(12), 13 - h / 2, 8, -4, [RED, RAMP.ember, RAMP.lemon]);
    flame(p, X(77), Y(12), 14 - h / 2, 8, 4, [RED, RAMP.ember, RAMP.lemon]);
    if (a === 'atk1') for (const [bx, by] of [[50, 10], [100, 20], [56, 2]]) part.ell(p, X(bx), Y(by) + 2, 3, 3, LAVA);
  } else for (const [sx, sy, r] of [[66, 6, 4], [75, 3, 3], [59, 4, 2.5]]) part.ell(p, X(sx) + (f % 2) * (sx > 70 ? 1 : -1), Y(sy), r, r * 0.8, SMOKE);
  /* 앞팔 · 용암 주먹 (준비: 번쩍 들기 · 타격: 내려찍기) */
  const fist = a === 'atk0' ? [104, 30] : a === 'atk1' ? [112, 112] : a === 'kb0' ? [96, 92] : [104, 96];
  part.poly(p, [[X(88), Y(60)], [X(98), Y(64)], [X(fist[0] + 4), Y(fist[1])], [X(fist[0] - 6), Y(fist[1])]], ROCKD);
  part.ell(p, X(fist[0]), Y(fist[1]), 13, 11, ROCKD);                                          // 바위 주먹
  for (const [kx, ky] of [[-5, 4], [1, 5], [7, 3]]) part.ell(p, X(fist[0] + kx), Y(fist[1] + ky), 3.4, 3, ROCKD);   // 손가락 마디
  crack(p, [[X(fist[0] - 8), Y(fist[1] - 4)], [X(fist[0] - 2), Y(fist[1] - 1)], [X(fist[0] + 4), Y(fist[1] - 6)], [X(fist[0] + 9), Y(fist[1] - 2)]], LAVA[0]);   // 이글 금
  crack(p, [[X(fist[0] - 2), Y(fist[1] - 1)], [X(fist[0]), Y(fist[1] + 3)]], LAVA[1]);
  if (a === 'atk1') for (const [sx, sy, r] of [[100, 126, 3], [124, 124, 3.5], [116, 98, 2.5], [128, 110, 2]]) part.ell(p, X(sx), Y(sy), r, r, LAVA);   // 튀는 용암
  if (a === 'kb0') for (const [sx, sy] of [[34, 30], [26, 44], [40, 20]]) part.ell(p, X(sx), Y(sy), 2.5, 2.5, LAVA);
  return flip(p);
}

/* ───────── 좀비 라이더 bossRider (136) — 털 빠진 좀비 독수리를 탄 비행사 좀비 · 뼈 창을 던진다 (날개) ───────── */
const BIRD = ['#b8a4b4', '#7e6878', '#4a3846'], BALD = ['#ecb8b0', '#b87e7a', '#7a4a4a'], BEAK = ['#f2e0a0', '#c8a050', '#7e6028'];
/** 깃털 날개 — 어깨(sx, sy) · dir 날개 방향 · trail 뒷깃 방향(라디안) · len 길이. 한 덩어리 + 깃털 갈래 + 빠진 깃털 · 드러난 뼈 */
function fanWing(p, sx, sy, dir, trail, len, ramp, bones) {
  const at = (t) => [sx + Math.cos(dir) * len * t, sy + Math.sin(dir) * len * t];
  const tipsAt = [];
  for (let i = 0; i <= 6; i++) {                                                               // 날개 끝(i=0) → 몸쪽(i=6)
    const t = 1 - i * 0.14, [bx, by] = at(Math.max(0.12, t * 0.62)), an = dir + (trail - dir) * (i / 6), L = len * (0.4 + i * 0.03);
    tipsAt.push([bx + Math.cos(an) * L, by + Math.sin(an) * L, bx, by]);
  }
  const pts = [[sx, sy], at(0.62)];
  tipsAt.forEach(([tx, ty, bx, by], i) => {
    pts.push([tx, ty]);
    if (i < 6) { const [nx, ny] = tipsAt[i + 1]; pts.push([(tx + nx) / 2 * 0.8 + bx * 0.2, (ty + ny) / 2 * 0.8 + by * 0.2]); }   // 깃털 사이 홈
  });
  pts.push(at(0.05));
  part.poly(p, pts.map(([x, y]) => [Math.round(x), Math.round(y)]), ramp);
  tipsAt.forEach(([tx, ty, bx, by], i) => { if (i % 2 === 0 || i === 5) crack(p, [[Math.round(bx), Math.round(by)], [Math.round(bx + (tx - bx) * 0.7), Math.round(by + (ty - by) * 0.7)]], ramp[2]); });   // 깃털 갈래
  const [cx, cy] = at(0.3);
  part.ell(p, cx, cy, len * 0.16, len * 0.1, ramp, { outline: false, light: [-0.3, -0.9] });  // 덮깃
  if (bones) {
    crack(p, [[Math.round(sx), Math.round(sy)], at(0.62).map(Math.round)], RAMP.bone[0]);      // 드러난 날개 뼈
    const [tx, ty, bx, by] = tipsAt[3];
    crack(p, [[Math.round(bx), Math.round(by)], [Math.round(tx), Math.round(ty)]], OUT);       // 빠진 깃털 틈
    part.ell(p, bx + (tx - bx) * 0.4, by + (ty - by) * 0.4, 2, 2, BALD, { outline: false });   // 맨살
  }
}
function bossRider(a) {
  const S = 144, { p, q, X, Y } = bossBase(S, a, 6, 6), f = FI(a);
  const st = { idle0: 1, walk0: 0, walk1: 1, walk2: 2, walk3: 1, atk0: 0, atk1: 2, kb0: 0 }[a];   // 날개: 0 위 · 1 가운데 · 2 아래
  const W = [[-1.85, -3.4], [3.4, 2.2], [2.3, 3.3]][st];
  const bob = st === 0 ? -3 : st === 2 ? 2 : 0;
  const B = (v) => Y(v) + bob;
  fanWing(p, X(64), B(64), W[0] + 0.25, W[1] + 0.2, 56, ['#94808e', '#62505e', '#3a2c38'], false);   // 먼 쪽 날개
  part.poly(p, [[X(34), B(74)], [X(6), B(66)], [X(10), B(76)], [X(2), B(80)], [X(12), B(86)], [X(6), B(94)], [X(34), B(86)]], BIRD);   // 꽁지
  for (const [lx, s] of [[54, 1], [70, -1]]) {                                                 // 대롱대롱 다리 · 발톱
    const sw = (f % 2 ? 2 : -2) * s;
    part.poly(p, [[X(lx), B(92)], [X(lx + 6), B(92)], [X(lx + 4) + sw, B(118)], [X(lx + 1) + sw, B(118)]], BEAK);
    for (const tx of [-3, 1, 5]) part.poly(p, [[X(lx + 1) + sw, B(117)], [X(lx + 4) + sw, B(117)], [X(lx + tx + 1) + sw, B(124)]], RAMP.bone);
  }
  part.ell(p, X(60), B(78), 30, 18, BIRD);                                                     // 몸
  part.ell(p, X(66), B(84), 11, 8, BALD);                                                      // 털 빠진 배
  for (let i = 0; i < 4; i++) p.rect(X(60) + i * 4, B(80), 1, 7, BALD[2]);                     // 갈비뼈
  for (const [fx, fy] of [[40, 70], [48, 88], [76, 70]]) { p.rect(X(fx), B(fy), 3, 1, BIRD[2]); p.set(X(fx) + 1, B(fy) + 1, BIRD[2]); }
  part.poly(p, [[X(80), B(76)], [X(88), B(62)], [X(100), B(48)], [X(108), B(52)], [X(96), B(68)], [X(90), B(80)]], BALD);   // 맨살 목
  for (const [wx, wy] of [[92, 62], [96, 57], [89, 68]]) p.rect(X(wx), B(wy), 4, 1, BALD[2]);  // 주름
  part.ell(p, X(84), B(72), 9, 7, BIRD);                                                       // 목 깃털 목도리
  for (const tx of [76, 82, 88]) part.poly(p, [[X(tx), B(76)], [X(tx + 4), B(76)], [X(tx + 2), B(82)]], BIRD, { outline: false });
  /* 독수리 머리 — 툭 튀어나온 눈 · 휜 부리 */
  part.ell(p, X(108), B(44), 11, 10, BALD);
  const bo = a === 'atk1' || a === 'kb0' ? 4 : 0;
  part.poly(p, [[X(114), B(38)], [X(126), B(40)], [X(130), B(48)], [X(126), B(52)], [X(117), B(47)]], BEAK);   // 윗부리 (갈고리)
  part.poly(p, [[X(115), B(48) + bo], [X(125), B(51) + bo], [X(117), B(54) + bo]], BEAK);
  if (bo) { p.rect(X(117), B(48), 7, bo, '#3a0e16'); p.set(X(122), B(52) + bo, '#9fd86a'); p.set(X(122), B(53) + bo, '#c8f27a'); }
  if (q.eye === 'shut') { p.rect(X(108), B(40), 6, 1, OUT); p.rect(X(100), B(42), 4, 1, OUT); }
  else {
    part.ell(p, X(110), B(40), 4.5, 4.7, ['#ffffff', '#f2eed8', '#c8c0a0']); p.rect(X(111), B(41), 3, 3, q.eye === 'focus' ? '#c01818' : OUT); p.set(X(107), B(37), '#e8a0a0');
    p.rect(X(100), B(41), 5, 1, OUT); p.rect(X(101), B(42), 3, 1, '#e2dcc0');
  }
  p.set(X(104), B(48), BALD[2]); p.rect(X(102), B(34), 2, 1, BALD[2]);
  fanWing(p, X(58), B(66), W[0], W[1], 64, ['#cbb8c6', '#937c8e', '#5a4658'], true);          // 가까운 날개
  /* 탄 사람 — 비행 모자 · 고글 · 휘날리는 빨간 목도리 */
  part.poly(p, [[X(46), B(58)], [X(68), B(57)], [X(66), B(64)], [X(48), B(65)]], RED);        // 안장
  part.poly(p, [[X(52), B(56)], [X(58), B(56)], [X(60), B(68)], [X(52), B(68)]], ['#7d7f86', '#55575f', '#33343a']);   // 다리
  const sc = f % 2;
  part.poly(p, [[X(48), B(30)], [X(22), B(22) + sc * 3], [X(12), B(28) + sc], [X(20), B(30) + sc * 2], [X(10), B(36) + sc * 3], [X(46), B(36)]], RED);   // 목도리
  part.poly(p, [[X(44), B(30)], [X(62), B(28)], [X(64), B(58)], [X(46), B(58)]], ['#a3825f', '#715640', '#45321f']);   // 가죽 재킷
  rips(p, [[X(47), B(56)], [X(56), B(57)], [X(61), B(54)]]);
  zFace(p, X(56), B(20), 11, q, { noHair: true });
  part.poly(p, [[X(44), B(16)], [X(48), B(8)], [X(58), B(6)], [X(66), B(10)], [X(67), B(14)], [X(46), B(18)]], RAMP.rag);   // 비행 모자
  part.poly(p, [[X(44), B(16)], [X(46), B(24)], [X(48), B(16)]], RAMP.rag);                  // 귀덮개
  part.ell(p, X(54), B(11), 3, 2.5, ['#bdeeff', '#5fc3f0', '#2f7fb8']); part.ell(p, X(61), B(11), 3, 2.5, ['#bdeeff', '#5fc3f0', '#2f7fb8']);   // 고글
  p.rect(X(57), B(11), 2, 1, OUT);
  /* 뼈 창 (준비: 뒤로 젖힘 · 타격: 던짐) */
  if (a === 'atk0') { part.ell(p, X(44), B(30), 3, 3, ZSKIN); part.poly(p, [[X(20), B(27)], [X(66), B(25)], [X(66), B(28)], [X(20), B(30)]], RAMP.bone); part.poly(p, [[X(66), B(23)], [X(76), B(26)], [X(66), B(30)]], RAMP.bone); }
  else if (a === 'atk1') { part.ell(p, X(72), B(34), 5, 2.4, ZSKIN); part.poly(p, [[X(80), B(30)], [X(118), B(26)], [X(118), B(29)], [X(80), B(33)]], RAMP.bone); part.poly(p, [[X(118), B(24)], [X(130), B(27)], [X(118), B(31)]], RAMP.bone); for (let i = 0; i < 3; i++) p.rect(X(70 - i * 8), B(30 + i * 2), 5, 1, '#e6e2f2'); }
  else { part.ell(p, X(68), B(38), 4, 2.4, ZSKIN); part.poly(p, [[X(70), B(4)], [X(73), B(4)], [X(73), B(56)], [X(70), B(56)]], RAMP.bone); part.poly(p, [[X(68), B(4)], [X(71), B(-6) + 6], [X(75), B(4)]], RAMP.bone); }
  return flip(p);
}

export const BOSSES_W25 = {
  'boss/bossVolcano/0': { anims: BOSS_ANIMS, draw: (a) => bossVolcano(a) },
  'boss/bossRider/0': { anims: BOSS_ANIMS, draw: (a) => bossRider(a) },
  ...BOSSES_W25B,
};
