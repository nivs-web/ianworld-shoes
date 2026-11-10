/**
 * 이안 드래곤 게임 — 월드 4 · 5 보스 (겜팀장 · A2 ③). bosses_w25.js 가 합쳐서 BOSSES_W25 로 내보낸다.
 * 눈사태 거인(얼음) · 고철 대왕 로봇(강철). 동작 8장 · 오른쪽으로 그린 뒤 뒤집기. 전부 오리지널.
 */
import { part } from './kit.js';
import { RAMP, OUT } from './palette.js';
import { BOSS_ANIMS } from './misc_w1.js';
import { zFace } from './zombies_w1.js';
import { bossBase, flip, FI, rips, zFeat, ICESKIN, SNOW, SMOKE } from './zombies_w25_kit.js';

const ICE = RAMP.attrIce, METAL = RAMP.attrMetal, GOLD = RAMP.attrGold;
const FUR = ['#f4f8ff', '#c4d6e6', '#7e98b2'];
const RUST = ['#d8945a', '#a05e30', '#62361a'];

/* ───────── 눈사태 거인 bossAvalanche (144) — 얼음 가시 등 · 털북숭이 거인 좀비 · 썩은 배 · 머리에 작은 털모자 · 큰 눈덩이를 던진다 ───────── */
function bossAvalanche(a) {
  const S = 148, { p, q, X, Y, g } = bossBase(S, a, 0, 4), f = FI(a);
  for (const [sx, sy, h] of [[30, 52, 20], [44, 40, 24], [60, 36, 20], [22, 70, 16]]) part.poly(p, [[X(sx - 6), Y(sy + 8)], [X(sx - 2), Y(sy - h)], [X(sx + 7), Y(sy + 6)]], ICE);   // 등 얼음 가시
  for (const [lx, s] of [[46, 1], [80, -1]]) {                                                  // 다리 · 큰 발
    part.poly(p, [[X(lx) + g * s * 4, Y(112)], [X(lx + 22) + g * s * 4, Y(112)], [X(lx + 22) + g * s * 4, S - 5], [X(lx) + g * s * 4, S - 5]], FUR);
    part.ell(p, X(lx + 12) + g * s * 4, S - 5, 15, 4, ['#9ab0c4', '#6a8098', '#3e5068'], { openBottom: true });
  }
  const bigUp = a === 'atk0', slam = a === 'atk1';
  if (!bigUp) { part.ell(p, X(26), Y(98), 12, 24, FUR); part.ell(p, X(24), Y(122), 11, 9, FUR); }   // 뒷팔 (주먹 짚기)
  part.ell(p, X(64), Y(88), 42, 34, FUR);                                                      // 털 몸통
  for (let x = 26; x < 104; x += 7) part.poly(p, [[X(x), Y(114) - (x % 3)], [X(x + 6), Y(114) - (x % 3)], [X(x + 3), Y(122) - (x % 2) * 2]], FUR, { outline: false });   // 덥수룩 털끝
  for (const [tx, ty] of [[30, 70], [40, 100], [90, 74], [52, 62]]) { p.rect(X(tx), Y(ty), 5, 1, FUR[2]); p.rect(X(tx) + 2, Y(ty) + 1, 4, 1, FUR[2]); }   // 털결
  part.ell(p, X(74), Y(96), 17, 14, ICESKIN);                                                  // 털 빠진 썩은 배
  for (let i = 0; i < 3; i++) { p.rect(X(66), Y(89) + i * 5, 14, 1, ICESKIN[2]); p.set(X(65), Y(90) + i * 5, ICESKIN[2]); p.set(X(80), Y(90) + i * 5, ICESKIN[2]); }   // 갈비
  p.rect(X(64), Y(100), 3, 2, '#7a9a70'); p.set(X(78), Y(86), '#6a3030');                     // 곰팡이 · 얼룩
  p.rect(X(84), Y(100), 1, 8, OUT); for (let i = 0; i < 4; i++) p.rect(X(83), Y(101) + i * 2, 3, 1, OUT);   // 꿰맨 자국
  p.rect(X(70), Y(104), 4, 2, '#7a9a70');
  /* 머리 — 털 두건 · 얼어붙은 좀비 얼굴 · 턱 고드름 · 작은 털모자 */
  part.ell(p, X(88), Y(50), 24, 22, FUR);
  part.ell(p, X(94), Y(54), 17, 15, ICESKIN);
  zFeat(p, X(95), Y(53), 16, q, { skin: ICESKIN });
  p.rect(X(98), Y(41), 12, 3, OUT);                                                            // 성난 눈썹
  for (const [ix, h] of [[86, 9], [92, 12], [100, 8], [106, 10]]) part.poly(p, [[X(ix - 2), Y(68)], [X(ix + 3), Y(68)], [X(ix), Y(68 + h)]], ICE);   // 턱 고드름
  part.poly(p, [[X(80), Y(30)], [X(84), Y(22)], [X(94), Y(20)], [X(100), Y(26)], [X(100), Y(30)]], ICE);   // 작은 털모자 (우스꽝)
  for (let x = 82; x < 100; x += 3) p.rect(X(x), Y(27), 1, 3, ICE[2]);
  part.ell(p, X(90), Y(19), 3.5, 3, SNOW);
  /* 앞팔 · 눈덩이 (준비: 머리 위로 · 타격: 내리꽂기) */
  if (bigUp) {
    part.ell(p, X(34), Y(46), 9, 20, FUR); part.ell(p, X(119), Y(44), 9, 21, FUR);              // 두 팔 번쩍
    part.ell(p, X(76), Y(19), 36, 18, SNOW);                                                   // 큰 눈덩이
    for (const [sx, sy] of [[52, 18], [80, 14], [66, 30], [92, 26]]) { p.rect(X(sx), Y(sy), 3, 1, SNOW[2]); p.set(X(sx) + 1, Y(sy) - 1, ICE[1]); }
    part.poly(p, [[X(58), Y(24)], [X(68), Y(22)], [X(69), Y(25)], [X(59), Y(27)]], RAMP.bone);   // 박힌 뼈
  } else {
    const fist = slam ? [118, 118] : a === 'kb0' ? [104, 104] : [112, 122];
    part.poly(p, [[X(98), Y(70)], [X(112), Y(74)], [X(fist[0] + 8), Y(fist[1] - 4)], [X(fist[0] - 8), Y(fist[1] - 4)]], FUR);
    part.ell(p, X(fist[0]), Y(fist[1]), 12, 10, FUR);
    for (const kx of [-6, 0, 6]) p.rect(X(fist[0] + kx), Y(fist[1] + 6), 3, 2, ICESKIN[1]);     // 썩은 손가락 끝
    if (slam) {
      part.ell(p, X(124), Y(128), 13, 8, SNOW);                                                // 와르르 눈 더미
      for (const [sx, sy, r] of [[110, 100, 4], [132, 106, 3.5], [137, 118, 3], [104, 130, 3]]) part.ell(p, X(sx), Y(sy), r, r, SNOW);
    }
  }
  if (a === 'kb0') for (const [sx, sy] of [[44, 30], [30, 40], [56, 22]]) part.ell(p, X(sx), Y(sy), 3, 3, SNOW);
  if (f === 0 || f === 2 || f === 6) { p.set(X(118), Y(52), '#ffffff'); p.set(X(122), Y(50), '#e6e2f2'); }   // 하얀 입김
  return flip(p);
}

/* ───────── 고철 대왕 로봇 bossRobot (132) — 고철을 이어 붙인 로봇 · 머리 유리돔 속에 좀비 조종사 · 짝짝이 램프 눈 · 기름 침 · 망치 주먹 ───────── */
function bossRobot(a) {
  const S = 138, { p, q, X, Y, g } = bossBase(S, a, 0, 6), f = FI(a);
  const GLASS = ['#e6faff', '#a8dcec', '#6aa6c0'];
  part.poly(p, [[X(22), Y(64)], [X(30), Y(64)], [X(30), Y(36)], [X(22), Y(36)]], METAL);        // 배기관
  for (const [sx, sy, r] of [[26, 28, 5], [22, 18, 4], [29, 10, 3]]) if ((f + sx) % 3) part.ell(p, X(sx) + (f % 2), Y(sy), r, r * 0.8, SMOKE);
  for (const [lx, s] of [[42, 1], [76, -1]]) {                                                 // 피스톤 다리
    const o = g * s * 5, lift = g * s > 0 ? -2 : 0;
    part.poly(p, [[X(lx + 4) + o, Y(100)], [X(lx + 14) + o, Y(100)], [X(lx + 14) + o, S - 13 + lift], [X(lx + 4) + o, S - 13 + lift]], METAL);
    p.rect(X(lx + 6) + o, Y(104), 6, S - 17 + lift - Y(104), METAL[0]);
    part.poly(p, [[X(lx - 2) + o, S - 15 + lift], [X(lx + 22) + o, S - 15 + lift], [X(lx + 24) + o, S - 2 + lift], [X(lx - 4) + o, S - 2 + lift]], ['#7a8090', '#4e5464', '#2e3240']);
    for (let x = lx; x < lx + 20; x += 6) p.rect(X(x) + o, S - 7 + lift, 3, 2, '#ffd23f');
  }
  part.ell(p, X(24), Y(80), 7, 14, METAL);                                                     // 뒷팔
  part.poly(p, [[X(16), Y(92)], [X(22), Y(90)], [X(18), Y(102)]], METAL); part.poly(p, [[X(26), Y(92)], [X(32), Y(94)], [X(28), Y(104)]], METAL);   // 집게
  /* 몸통 — 짝짝이 판 · 리벳 · 녹 */
  part.poly(p, [[X(30), Y(50)], [X(102), Y(48)], [X(104), Y(104)], [X(28), Y(106)]], METAL);
  part.poly(p, [[X(32), Y(52)], [X(56), Y(52)], [X(56), Y(76)], [X(32), Y(78)]], RUST);        // 녹슨 판
  part.poly(p, [[X(34), Y(84)], [X(54), Y(82)], [X(54), Y(100)], [X(34), Y(102)]], ['#a6d6ff', '#3f8cff', '#1f4fa8']);   // 파란 판
  for (let x = 30; x < 104; x += 8) { p.rect(X(x), Y(96), 4, 6, '#ffd23f'); p.rect(X(x + 4), Y(96), 4, 6, '#2a2430'); }   // 경고 줄무늬
  for (const [rx, ry] of [[34, 54], [52, 54], [98, 52], [98, 92], [34, 92], [60, 50], [80, 50]]) { p.rect(X(rx), Y(ry), 2, 2, OUT); p.set(X(rx), Y(ry), METAL[0]); }
  p.rect(X(70), Y(54), 10, 1, METAL[2]); p.rect(X(72), Y(55), 6, 1, OUT);                      // 찌그러짐
  /* 가슴 얼굴 — 툭 튀어나온 램프 눈 + 처진 램프 눈 · 삐뚤어진 창살 입 · 기름 침 */
  if (q.eye === 'shut') { p.rect(X(78), Y(66), 14, 3, OUT); p.rect(X(58), Y(68), 9, 2, OUT); }
  else {
    part.ell(p, X(84), Y(66), 9, 9, ['#ffffff', '#f2eed8', '#c8c0a0']);
    p.rect(X(85), Y(66), 5, 5, q.eye === 'focus' ? '#ff2a2a' : '#c01818'); p.rect(X(86), Y(67), 2, 2, '#ffd0d0');
    p.rect(X(78), Y(60), 2, 1, '#e8a0a0'); p.rect(X(77), Y(62), 1, 2, '#e8a0a0');
    part.ell(p, X(62), Y(68), 5.5, 5, ['#fff3a0', '#ffd23f', '#c99a1f']);
    part.poly(p, [[X(55), Y(62)], [X(69), Y(63)], [X(69), Y(68)], [X(55), Y(67)]], ['#9aa1b2', '#5c6274', '#363a48']);   // 처진 눈꺼풀 (철판)
  }
  const mo = q.mouth === 1 ? 4 : q.mouth === 2 ? 2 : 0;
  part.poly(p, [[X(58), Y(80)], [X(94), Y(78)], [X(94), Y(88) + mo], [X(58), Y(86) + mo]], ['#3a2a30', '#241820', '#140c10']);
  for (let x = 62; x < 94; x += 5) p.rect(X(x), Y(79), 2, 8 + mo - Math.round((x - 58) / 16), METAL[1]);   // 창살
  p.rect(X(92), Y(88) + mo, 2, 5, '#3a3a2a'); p.rect(X(92), Y(93) + mo, 2, 2, '#6a7a3a');      // 기름 침
  /* 머리 — 유리돔 속 좀비 조종사 · 용접한 왕관 · 안테나 */
  part.poly(p, [[X(62), Y(28)], [X(64), Y(4)], [X(66), Y(28)]], METAL);
  part.ell(p, X(65), Y(3) + 2, 3, 3, (f % 2) ? ['#ff9a8a', '#e04a3a', '#8e2020'] : ['#ffb0a0', '#ff6a5a', '#c04040']);   // 깜빡 램프
  part.ell(p, X(70), Y(34), 20, 17, GLASS);
  zFace(p, X(72), Y(36), 12, q);
  for (let i = 0; i < 6; i++) { p.set(X(56) + i, Y(26) - i, '#ffffff'); p.set(X(58) + i, Y(28) - i, '#ffffff'); }   // 유리 반짝
  part.ell(p, X(70), Y(50), 22, 4, METAL);                                                     // 돔 받침
  for (let x = 52; x < 90; x += 6) p.set(X(x), Y(50), OUT);
  part.poly(p, [[X(76), Y(20)], [X(78), Y(10)], [X(82), Y(15)], [X(86), Y(8)], [X(89), Y(14)], [X(94), Y(10)], [X(92), Y(22)]], GOLD);   // 삐뚤게 용접한 왕관
  p.rect(X(84), Y(17), 3, 2, '#e04a3a'); p.set(X(78), Y(21), '#ff9a3a'); p.set(X(91), Y(23), '#ff9a3a');   // 용접 불똥 자국
  /* 앞팔 · 망치 주먹 */
  const fist = a === 'atk0' ? [110, 26] : a === 'atk1' ? [114, 112] : a === 'kb0' ? [104, 86] : [112, 94];
  part.ell(p, X(102), Y(60), 8, 8, METAL);                                                     // 어깨
  part.poly(p, [[X(100), Y(62)], [X(106), Y(60)], [X(fist[0] + 3), Y(fist[1])], [X(fist[0] - 3), Y(fist[1])]], ['#7a8090', '#4e5464', '#2e3240']);
  part.poly(p, [[X(fist[0] - 12), Y(fist[1] - 10)], [X(fist[0] + 13), Y(fist[1] - 10)], [X(fist[0] + 13), Y(fist[1] + 10)], [X(fist[0] - 12), Y(fist[1] + 10)]], METAL);   // 망치 머리
  p.rect(X(fist[0] - 12), Y(fist[1] - 2), 26, 3, RUST[1]);
  for (const [rx, ry] of [[-9, -7], [10, -7], [-9, 7], [10, 7]]) p.rect(X(fist[0] + rx), Y(fist[1] + ry), 2, 2, OUT);
  if (a === 'atk1') for (const [sx, sy] of [[100, 124], [128, 122], [124, 98], [96, 104], [130, 110]]) { p.rect(X(sx), Y(sy), 2, 2, '#fff3a0'); p.set(X(sx) + 2, Y(sy) - 1, '#ffffff'); }   // 불똥
  if (a === 'kb0') for (const [sx, sy] of [[40, 40], [30, 48], [50, 30]]) { p.rect(X(sx), Y(sy), 3, 3, METAL[1]); p.set(X(sx) + 1, Y(sy) + 1, OUT); }   // 튀는 나사
  rips(p, [[X(40), Y(104)], [X(70), Y(105)]]);
  return flip(p);
}

export const BOSSES_W25B = {
  'boss/bossAvalanche/0': { anims: BOSS_ANIMS, draw: (a) => bossAvalanche(a) },
  'boss/bossRobot/0': { anims: BOSS_ANIMS, draw: (a) => bossRobot(a) },
};
