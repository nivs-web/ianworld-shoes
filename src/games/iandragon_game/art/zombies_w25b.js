/**
 * 이안 드래곤 게임 — 월드 4(얼음) · 5(강철) 좀비 (겜팀장 · A2 ③). zombies_w25.js 가 합쳐서 ZOMBIES_W25 로 내보낸다.
 * 얼음 = RAMP.attrIce (몸 · 목도리 · 고드름) · 강철 = RAMP.attrMetal (깡통 · 광차 · 갑옷). 얼굴은 승인본 zFace 그대로.
 */
import { part } from './kit.js';
import { RAMP, OUT } from './palette.js';
import { zFace, ZSKIN } from './zombies_w1.js';
import { base, flip, FI, legs, rips, zFeat, gearWheel, PANTS, SHIRT, ICESKIN, SNOW, DROOL } from './zombies_w25_kit.js';

const ICE = RAMP.attrIce, METAL = RAMP.attrMetal;
const RUST = ['#c88a5a', '#9a5a32', '#5e3418'];
const icicle = (p, x, y, h, rp = ICE) => part.poly(p, [[x - 1, y], [x + 2, y], [x, y + h]], rp);

/* ───────── 미끄럼 펭귄 좀비 penguin (38) — 썩은 배 · 깨진 부리 · 얼음 목도리 · 배로 미끄러져 온다 (빠른 놈) ───────── */
const PENG = ['#7a98bc', '#4a6488', '#28385a'];
function penguin(a) {
  const S = 40, { p, q, X, Y, g } = base(S, a, 1, 2);
  const slide = a === 'walk1' ? 1 : 0;
  for (const [fx, s] of [[13, 1], [20, -1]]) part.ell(p, X(fx) + g * s * 2, S - 4, 3.4, 1.6, RAMP.ember);   // 주황 발
  part.poly(p, [[X(8), Y(31)], [X(3), Y(34)], [X(9), Y(34)]], PENG);                           // 꼬리
  part.ell(p, X(17), Y(24) + slide, 10, 10.5, PENG);                                           // 몸
  part.ell(p, X(20), Y(26) + slide, 6.5, 8, ['#e2ead8', '#b8c4ac', '#7e8c76']);                // 썩은 흰 배
  p.rect(X(18), Y(28) + slide, 3, 2, '#8aa060'); p.set(X(22), Y(23) + slide, '#6a3030');       // 곰팡이 · 얼룩
  p.rect(X(17), Y(31) + slide, 1, 3, OUT); p.set(X(18), Y(32) + slide, OUT);                    // 꿰맨 자국
  part.poly(p, [[X(9), Y(20)], [X(12), Y(19)], [X(10), Y(30)], [X(7), Y(28)]], PENG);           // 뒷날개
  const fl = a === 'atk1' ? -6 : a === 'atk0' ? 2 : 0;
  part.poly(p, [[X(25), Y(21)], [X(28), Y(22)], [X(32), Y(29) + fl], [X(29), Y(30) + fl]], PENG);   // 앞날개 (철썩)
  zFace(p, X(20), Y(11), 8, q, { skin: PENG, noHair: true, noDrool: true });
  part.ell(p, X(24), Y(10), 3.6, 3.2, ['#f4f8ff', '#d4dce8', '#a0acc0'], { outline: false });  // 눈 둘레 흰 털
  if (q.eye !== 'shut') { part.ell(p, X(24), Y(10), 2.8, 3, ['#ffffff', '#f2eed8', '#c8c0a0']); p.rect(X(25), Y(11), 2, 2, q.eye === 'focus' ? '#c01818' : OUT); p.set(X(22), Y(8), '#e8a0a0'); }
  const op = q.mouth === 1 ? 3 : q.mouth === 2 ? 2 : 1;
  part.poly(p, [[X(26), Y(13)], [X(33), Y(14)], [X(27), Y(15)]], RAMP.ember);                  // 윗부리
  part.poly(p, [[X(26), Y(15) + op], [X(31), Y(15) + op], [X(27), Y(17) + op]], RAMP.ember);   // 아랫부리 (깨짐)
  p.rect(X(27), Y(15), 3, op, '#3a0e16'); p.set(X(29), Y(15), SHIRT[0]);
  p.rect(X(30), Y(16) + op, 1, 2, DROOL[0]); p.set(X(30), Y(18) + op, DROOL[1]);
  for (const ix of [15, 18, 21]) icicle(p, X(ix), Y(3), -3);                                   // 머리에 얼음 가시 (털 대신)
  part.poly(p, [[X(12), Y(17)], [X(27), Y(16)], [X(27), Y(19)], [X(12), Y(20)]], ICE);          // 얼음 목도리
  part.poly(p, [[X(12), Y(18)], [X(5), Y(20) + (FI(a) % 2)], [X(6), Y(23) + (FI(a) % 2)], [X(12), Y(20)]], ICE);
  rips(p, [[X(6), Y(22) + (FI(a) % 2)]]);
  return flip(p);
}

/* ───────── 눈덩이 좀비 snowball (50) — 굴러가다 몸이 큰 눈덩이에 박힌 좀비 · 눈 속에 뼈다귀 · 털모자 (튼튼한 놈) ───────── */
function snowball(a) {
  const S = 54, { p, q, X, Y, g } = base(S, a, 1, 5), f = FI(a);
  for (const [fx, s] of [[15, 1], [27, -1]]) { p.rect(X(fx) + g * s, S - 6, 5, 4, PANTS[1]); p.rect(X(fx) + g * s - 1, S - 3, 7, 2, '#3a2a20'); }   // 발
  part.ell(p, X(9), Y(26), 2.6, 4.5, ICESKIN);                                                 // 뒷팔 (눈 위로)
  part.ell(p, X(22), Y(33), 16, 13.5, SNOW);                                                   // 큰 눈덩이
  const r = g * 2;                                                                              // 굴러가는 무늬
  for (const [sx, sy] of [[12, 30], [27, 38], [19, 42], [32, 29], [9, 38]]) { p.rect(X(sx + r), Y(sy), 2, 1, SNOW[2]); p.set(X(sx + r) + 1, Y(sy) - 1, ICE[1]); }
  part.poly(p, [[X(14 + r), Y(34)], [X(20 + r), Y(32)], [X(21 + r), Y(34)], [X(15 + r), Y(36)]], RAMP.bone);   // 박힌 뼈다귀
  part.ell(p, X(8), Y(31), 2.4, 2, ICE); part.ell(p, X(35), Y(41), 2.2, 1.8, ICE);              // 얼음 덩이
  zFace(p, X(24), Y(15), 9.5, q, { skin: ICESKIN, noHair: true });
  part.poly(p, [[X(14), Y(10)], [X(17), Y(4)], [X(25), Y(2)], [X(32), Y(6)], [X(34), Y(10)]], ICE);   // 해진 털모자
  for (let x = 15; x < 34; x += 3) p.rect(X(x), Y(8), 1, 2, ICE[2]);
  part.ell(p, X(19), Y(2), 2.6, 2.4, SNOW);                                                    // 방울
  p.set(X(30), Y(4), OUT); p.set(X(31), Y(5), OUT);                                             // 구멍
  for (const ix of [26, 30]) icicle(p, X(ix), Y(23), 3);                                       // 턱 고드름
  const reach = q.mouth === 1 ? 3 : 0;
  part.ell(p, X(37) + reach, Y(24), 4.5, 2.6, ICESKIN);                                        // 앞팔
  for (const fx of [40, 42]) p.rect(X(fx) + reach, Y(26), 1, 2, ICESKIN[2]);
  if (f === 4) for (const [bx, by] of [[44, 20], [46, 27], [42, 30]]) part.ell(p, X(bx), Y(by), 1.6, 1.4, SNOW);   // 눈 뭉치 탁
  return flip(p);
}

/* ───────── 고드름 사수 icicle (46) — 털 달린 얼음 후드 · 고드름 석궁 (원거리 · 얼림) ───────── */
function icicleZ(a) {
  const S = 48, { p, q, X, Y, g } = base(S, a, 0, 2);
  legs(p, S, [X(14), X(20)], Y(31), g, PANTS, 4);
  part.poly(p, [[X(12), Y(18)], [X(25), Y(17)], [X(27), Y(33)], [X(11), Y(34)]], ICE);          // 얼음 파카
  for (const [tx, ty] of [[12, 33], [16, 34], [21, 33], [25, 32]]) part.poly(p, [[X(tx), Y(ty)], [X(tx + 2), Y(ty)], [X(tx + 1), Y(ty + 3)]], ICE, { outline: false });   // 너덜 단
  p.rect(X(18), Y(19), 1, 13, ICE[2]); p.rect(X(15), Y(26), 2, 2, '#7a8a50');
  part.ell(p, X(18), Y(11), 10.5, 10, ICE);                                                    // 후드
  part.ell(p, X(20), Y(12), 8, 8, ['#f4f8ff', '#d4dce8', '#a0acc0']);                          // 털 테두리
  zFace(p, X(22), Y(12), 7.5, q, { skin: ICESKIN, noHair: true });
  for (const ix of [17, 21, 25]) icicle(p, X(ix), Y(20), 3);                                   // 후드 고드름
  /* 고드름 석궁 */
  const pull = a === 'atk0' ? 3 : 0, cx = X(33), cy = Y(23);
  p.rect(cx - 9, cy, 13, 2, RAMP.rag[1]); p.rect(cx - 9, cy + 2, 13, 1, RAMP.rag[2]);           // 개머리
  part.poly(p, [[cx + 2, cy - 7], [cx + 5, cy - 6], [cx + 6, cy + 1], [cx + 5, cy + 8], [cx + 2, cy + 9], [cx + 4, cy + 1]], ICE);   // 얼음 활
  p.set(cx + 2, cy - 6, OUT); p.set(cx - 2 - pull, cy, OUT); p.set(cx + 2, cy + 8, OUT);        // 시위
  for (let i = 0; i < 6; i++) { p.set(cx + 2 - Math.round((4 + pull) * i / 6), cy - 6 + i, '#e6e2f2'); p.set(cx + 2 - Math.round((4 + pull) * i / 6), cy + 8 - i, '#e6e2f2'); }
  if (a !== 'atk1') part.poly(p, [[cx - 5 - pull, cy - 1], [cx + 9, cy], [cx - 5 - pull, cy + 1]], ['#ffffff', '#d6f6ff', '#86cfe8']);   // 고드름 화살
  else { part.ell(p, cx + 9, cy, 2.6, 2.2, ['#ffffff', '#d6f6ff', '#86cfe8'], { outline: false }); p.set(cx + 11, cy - 3, '#fff'); p.set(cx + 10, cy + 3, '#fff'); }   // 쉭 (냉기)
  part.ell(p, cx - 6, cy + 2, 2.2, 2, ICESKIN); part.ell(p, cx + 1, cy + 3, 2.2, 2, ICESKIN);   // 손
  return flip(p);
}

/* ───────── 깡통 좀비 can (44) — 큰 통조림 깡통 속에 낀 좀비 · 뜯긴 뚜껑 · 찌그러짐 · 녹 (강철) ───────── */
function can(a) {
  const S = 46, { p, q, X, Y, g } = base(S, a, 0, 2);
  legs(p, S, [X(13), X(21)], Y(36), g, PANTS, 4);
  part.poly(p, [[X(12), Y(13)], [X(16), Y(1)], [X(18), Y(4)], [X(20), Y(0)], [X(22), Y(4)], [X(24), Y(13)]], METAL);   // 뜯긴 뚜껑 (뒤로 젖힘)
  part.ell(p, X(9), Y(27), 2.4, 4, ZSKIN);                                                     // 뒷팔 (구멍 밖)
  zFace(p, X(22), Y(13), 8, q);
  part.poly(p, [[X(10), Y(18)], [X(32), Y(18)], [X(32), Y(37)], [X(10), Y(37)]], METAL);        // 깡통 몸
  part.ell(p, X(21), Y(18), 11, 2, ['#f2f4f8', '#c3c8d3', '#8a90a0']);                         // 위 테두리 (턱 덮음)
  p.rect(X(10), Y(36), 23, 2, METAL[2]);
  for (let y = 21; y < 36; y += 3) p.rect(X(11), Y(y), 21, 1, METAL[0]);                       // 골
  part.poly(p, [[X(11), Y(25)], [X(31), Y(25)], [X(31), Y(32)], [X(11), Y(32)]], ['#f08070', '#c84a3a', '#8a2a20'], { outline: false });   // 바랜 라벨
  part.ell(p, X(21), Y(28), 3.4, 2.4, ['#fff6dc', '#f5dfa8', '#d1b070'], { outline: false });  // 라벨 그림 (생선뼈)
  p.rect(X(19), Y(28), 5, 1, '#8a2a20'); p.set(X(20), Y(27), '#8a2a20'); p.set(X(22), Y(29), '#8a2a20');
  part.poly(p, [[X(27), Y(25)], [X(31), Y(25)], [X(31), Y(29)]], ['#fff6dc', '#e6d8b0', '#b8a880']);   // 벗겨진 귀퉁이
  for (const [rx, ry] of [[13, 34], [29, 21], [15, 22]]) { p.rect(X(rx), Y(ry), 2, 1, RUST[1]); p.set(X(rx), Y(ry) + 1, RUST[2]); }   // 녹
  p.rect(X(25), Y(21), 3, 1, METAL[2]); p.set(X(26), Y(22), OUT);                               // 찌그러짐
  const reach = q.mouth === 1 ? 3 : 0;
  part.ell(p, X(32), Y(26), 2, 2.4, [METAL[2], OUT, OUT], { outline: false });                 // 팔 구멍
  part.ell(p, X(35) + reach, Y(25), 4, 2.2, ZSKIN);
  for (const fx of [37, 39]) p.rect(X(fx) + reach, Y(27), 1, 2, ZSKIN[2]);
  return flip(p);
}

/* ───────── 광차 좀비 cart (48) — 녹슨 광차를 타고 돌진 · 헤드랜턴 헬멧 · 광석 실은 짐칸 (강철 · 빠름) ───────── */
function cart(a) {
  const S = 52, { p, q, X, Y } = base(S, a, 1, 4), f = FI(a);
  const rush = a === 'atk1' ? 3 : 0;
  for (const [ox, oy] of [[8, 25], [12, 23]]) part.ell(p, X(ox), Y(oy), 3, 2.4, ['#5a5468', '#3a3448', '#1e1a28']);   // 광석
  p.set(X(9), Y(24), '#bdeeff'); p.set(X(12), Y(22), '#ffd23f');
  part.poly(p, [[X(17), Y(18)], [X(29), Y(17)], [X(30), Y(28)], [X(17), Y(28)]], RAMP.cloth);   // 몸통
  rips(p, [[X(19), Y(19)], [X(26), Y(18)]]);
  zFace(p, X(25) + rush, Y(11), 8.5, q, { noHair: true });
  part.poly(p, [[X(16) + rush, Y(7)], [X(19) + rush, Y(1)], [X(29) + rush, Y(0)], [X(34) + rush, Y(5)], [X(35) + rush, Y(8)]], RAMP.attrGold);   // 광부 헬멧
  p.rect(X(15) + rush, Y(7), 21, 2, RAMP.attrGold[2]);
  part.ell(p, X(31) + rush, Y(4), 2, 2, ['#ffffff', '#fff3a0', '#c99a1f']);                    // 헤드랜턴
  if (f % 2 === 0) for (let i = 0; i < 4; i++) p.set(X(35 + i * 2) + rush, Y(4) + (i % 2), '#fff3a0');   // 불빛
  part.ell(p, X(36) + rush, Y(20), 4, 2.2, ZSKIN);                                             // 앞으로 뻗은 팔
  part.poly(p, [[X(4), Y(24)], [X(42), Y(24)], [X(39), Y(40)], [X(7), Y(40)]], METAL);          // 광차
  p.rect(X(4), Y(24), 39, 2, METAL[0]); p.rect(X(5), Y(26), 37, 1, METAL[2]);
  for (const [rx, ry] of [[8, 29], [8, 36], [38, 29], [37, 36], [23, 29]]) p.set(X(rx), Y(ry), OUT);   // 리벳
  for (const [rx, ry, w] of [[12, 31, 4], [27, 35, 5], [33, 28, 3]]) { p.rect(X(rx), Y(ry), w, 2, RUST[1]); p.set(X(rx), Y(ry), RUST[0]); }   // 녹
  for (const wx of [13, 33]) {                                                                 // 바퀴 (살이 돈다)
    part.ell(p, X(wx), S - 6, 4, 4, ['#7a7488', '#4a4458', '#26222e']);
    const sp = f % 2 ? [[-2, -2], [2, 2]] : [[0, -3], [0, 3]];
    for (const [dx, dy] of sp) { p.set(X(wx) + dx, S - 6 + dy, METAL[0]); p.set(X(wx) + Math.sign(dx), S - 6 + Math.sign(dy), METAL[0]); }
    p.set(X(wx), S - 6, OUT);
  }
  if (a.startsWith('walk')) for (const [lx, ly] of [[0, 30], [1, 35]]) p.rect(X(lx), Y(ly) + (f % 2), 3, 1, '#e6e2f2');   // 속도 줄
  return flip(p);
}

/* ───────── 톱니 기사 gear (54) — 등에 큰 톱니 · 녹슨 판금 갑옷 · 들어 올린 투구 사이로 좀비 얼굴 · 대형 스패너 (강철 · 대형) ───────── */
function gear(a) {
  const S = 60, { p, q, X, Y, g } = base(S, a, 3, 6), f = FI(a);
  gearWheel(p, X(13), Y(22), 9, 10, f % 2, METAL);                                             // 등 톱니
  for (const [lx, s] of [[17, 1], [28, -1]]) { part.poly(p, [[X(lx) + g * s, Y(38)], [X(lx + 7) + g * s, Y(38)], [X(lx + 8) + g * s, S - 3], [X(lx - 1) + g * s, S - 3]], METAL); p.rect(X(lx - 2) + g * s, S - 4, 12, 3, METAL[2]); }   // 갑옷 다리
  part.poly(p, [[X(14), Y(22)], [X(36), Y(21)], [X(37), Y(40)], [X(15), Y(41)]], RAMP.rag);     // 너덜 겉옷
  rips(p, [[X(16), Y(40)], [X(21), Y(41)], [X(29), Y(40)], [X(34), Y(39)]]);
  part.poly(p, [[X(16), Y(21)], [X(35), Y(20)], [X(34), Y(33)], [X(17), Y(34)]], METAL);        // 가슴 판금
  gearWheel(p, X(26), Y(27), 3, 6, f % 2, RAMP.attrGold);                                       // 톱니 문장
  for (const [rx, ry] of [[18, 23], [33, 22], [18, 31], [32, 31]]) p.set(X(rx), Y(ry), OUT);
  p.rect(X(30), Y(30), 3, 2, RUST[1]);
  part.ell(p, X(15), Y(26), 4, 4, METAL);                                                      // 어깨 받이
  zFace(p, X(28), Y(14), 9, q, { noHair: true });
  part.poly(p, [[X(18), Y(14)], [X(19), Y(5)], [X(26), Y(2)], [X(34), Y(4)], [X(37), Y(9)], [X(37), Y(11)], [X(20), Y(14)]], METAL);   // 투구 (위)
  p.rect(X(21), Y(9), 17, 2, METAL[2]); p.rect(X(23), Y(6), 10, 1, METAL[0]);                    // 올린 얼굴 가리개
  part.poly(p, [[X(18), Y(13)], [X(21), Y(13)], [X(21), Y(22)], [X(18), Y(20)]], METAL);        // 볼 가리개
  part.poly(p, [[X(22), Y(3)], [X(16), Y(-1) + (f % 2)], [X(12), Y(4) + (f % 2)], [X(20), Y(5)]], ['#e05a4a', '#a83a2e', '#681c14']);   // 해진 깃털 장식
  /* 대형 스패너 — 공격: 들었다 내려침 */
  const up = a === 'atk0' ? -8 : a === 'atk1' ? 4 : 0, sx = a === 'atk1' ? 43 : 40;
  part.ell(p, X(38), Y(28) + Math.round(up / 3), 3.4, 3.4, METAL);                              // 팔 (갑옷)
  part.poly(p, [[X(sx) - 1, Y(30) + up], [X(sx) + 2, Y(30) + up], [X(sx) + 3, Y(10) + up], [X(sx), Y(10) + up]], METAL);   // 자루
  part.poly(p, [[X(sx) - 4, Y(11) + up], [X(sx) - 3, Y(3) + up], [X(sx) - 1, Y(7) + up], [X(sx) + 4, Y(7) + up], [X(sx) + 6, Y(3) + up], [X(sx) + 7, Y(11) + up]], METAL);   // 스패너 입
  part.ell(p, X(sx) + 1, Y(31) + up, 2.4, 2.2, ZSKIN);                                         // 쥔 손
  if (a === 'atk1') for (const [kx, ky] of [[48, 44], [51, 41], [46, 48]]) { p.set(X(kx), ky, '#fff3a0'); p.set(X(kx) + 1, ky, '#ffffff'); }   // 불똥
  return flip(p);
}

export const ZOMBIES_W25B = {
  'zombie/penguin/0': (a) => penguin(a), 'zombie/snowball/0': (a) => snowball(a), 'zombie/icicle/0': (a) => icicleZ(a),
  'zombie/can/0': (a) => can(a), 'zombie/cart/0': (a) => cart(a), 'zombie/gear/0': (a) => gear(a),
};
