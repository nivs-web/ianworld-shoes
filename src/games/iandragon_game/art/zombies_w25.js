/**
 * 이안 드래곤 게임 — 월드 2~5 좀비 (겜팀장 · A2 ③). 대표님: «무섭고 징그러우면서도 귀여운» 카툰 좀비 · 큰 머리 · 큰 몸.
 * 이 파일 = 황금 좀비 + 월드 2(빨강) + 월드 3(날개). 월드 4(얼음) · 5(강철)는 zombies_w25b.js.
 * 승인본(어슬렁 좀비 · zombies_w1)과 같은 얼굴(zFace) · 썩은 살 · 찢어진 옷. 속성 좀비는 속성 색(RAMP.attr*)을 몸 · 소품에.
 * 오른쪽으로 그린 뒤 뒤집어 왼쪽을 보게 한다. 전부 오리지널.
 */
import { part } from './kit.js';
import { RAMP, C, OUT } from './palette.js';
import { zFace, ZSKIN } from './zombies_w1.js';
import { base, flip, FI, legs, rips, zFeat, flame, PANTS, SHIRT, JACKET, LAVA, ROCKD, SMOKE, DROOL } from './zombies_w25_kit.js';
import { ZOMBIES_W25B } from './zombies_w25b.js';

const RED = RAMP.attrRed, GOLD = RAMP.attrGold;
const FIRE = [['#ffb05a', '#e04a3a', '#8e2020'], RAMP.ember, RAMP.lemon];

/* ───────── 황금 좀비 gold (44) — 금빛 살 · 동전 자루를 메고 허둥지둥 도망 · 찌그러진 실크햇 ───────── */
function gold(a) {
  const S = 48, { p, q, X, Y, g } = base(S, a, 3, 4), f = FI(a);
  legs(p, S, [X(14), X(20)], Y(33), g, ['#6a5a7a', '#4a3a5a', '#2e2440']);
  part.ell(p, X(9), Y(25), 7.5, 8.5, RAMP.rag);                                               // 동전 자루 (등)
  part.ell(p, X(10), Y(16), 3, 2.2, GOLD); part.ell(p, X(6), Y(18), 2.4, 1.8, GOLD);           // 삐져나온 동전
  for (const [cx, cy] of [[6, 27], [11, 31], [9, 22]]) p.rect(X(cx), Y(cy), 2, 1, RAMP.rag[2]);   // 자루 꿰맨 자국
  part.poly(p, [[X(12), Y(20)], [X(16), Y(19)], [X(13), Y(15)], [X(10), Y(16)]], GOLD);        // 자루 쥔 손
  part.poly(p, [[X(13), Y(21)], [X(26), Y(20)], [X(27), Y(34)], [X(14), Y(35)]], ['#c88ad8', '#8e4fae', '#582a74']);   // 해진 보라 연미복
  part.poly(p, [[X(18), Y(21)], [X(23), Y(20)], [X(22), Y(32)], [X(18), Y(33)]], SHIRT, { outline: false });
  part.ell(p, X(20), Y(26), 2.6, 2.6, GOLD); p.set(X(20), Y(26), GOLD[2]);                      // 가슴 금메달
  rips(p, [[X(14), Y(34)], [X(17), Y(35)], [X(24), Y(34)]]);
  const reach = q.mouth === 1 ? 3 : 0;
  part.ell(p, X(29) + reach, Y(24), 5, 2.2, ['#c88ad8', '#8e4fae', '#582a74']);                // 앞팔 (동전 꽉 쥠)
  part.ell(p, X(34) + reach, Y(25), 2.6, 2.4, GOLD);
  part.ell(p, X(36) + reach, Y(22), 2, 2, ['#ffffff', GOLD[0], GOLD[1]]);
  zFace(p, X(25), Y(14), 8.5, q, { skin: GOLD });
  p.rect(X(19), Y(15), 1, 4, '#7a5a10'); p.rect(X(18), Y(16), 3, 1, '#7a5a10'); p.rect(X(18), Y(18), 3, 1, '#7a5a10');   // 꿰맨 볼
  p.set(X(28), Y(20), '#8a7a2a'); p.set(X(22), Y(8), '#8a7a2a'); p.set(X(23), Y(8), '#8a7a2a');                         // 녹슨 반점
  part.poly(p, [[X(17), Y(6)], [X(32), Y(5)], [X(31), Y(7)], [X(18), Y(8)]], ['#5a4a6a', '#3a2c48', '#20162c']);   // 챙
  part.poly(p, [[X(20), Y(6)], [X(29), Y(5)], [X(30), Y(-1)], [X(21), Y(1)]], ['#5a4a6a', '#3a2c48', '#20162c']);  // 찌그러진 실크햇
  p.rect(X(21), Y(4), 8, 1, GOLD[1]);
  p.rect(X(15), Y(10), 1, 2, '#bdeeff'); p.set(X(15), Y(12), '#5fc3f0');                       // 식은땀 (도망)
  for (const [sx, sy] of [[3, 10], [38, 12], [5, 36]]) if ((f + sx) % 2) { p.set(X(sx), Y(sy), C.spark); p.set(X(sx) - 1, Y(sy), '#fff'); p.set(X(sx), Y(sy) - 1, '#fff'); }   // 반짝
  return flip(p);
}

/* ───────── 불타는 해골 skull (40) — 머리만 큰 해골이 불꽃 머리칼을 휘날리며 달린다 (빠른 놈) ───────── */
function skull(a) {
  const S = 46, { p, q, X, Y, g } = base(S, a, 3, 6), f = FI(a);
  for (const [lx, s] of [[15, 1], [20, -1]]) { p.rect(X(lx) + g * s * 2, Y(29), 2, S - 3 - Y(29), RAMP.bone[1]); p.rect(X(lx) + g * s * 2 - 1, S - 3, 4, 2, RAMP.bone[2]); }   // 뼈 다리
  part.ell(p, X(17), Y(27), 5, 3.5, RAMP.bone);                                               // 갈비
  for (let i = 0; i < 3; i++) p.rect(X(14) + i * 2, Y(26), 1, 3, '#3a2a2a');
  p.rect(X(11), Y(25), 4, 1, RAMP.bone[2]); p.rect(X(22) + (q.mouth === 1 ? 3 : 0), Y(25), 5, 1, RAMP.bone[1]);   // 뼈 팔
  /* 불꽃 머리칼 — 뒤로 휘날림 (동작마다 일렁) */
  const fl = [2, 0, 3, 1, 4, 1][f];
  flame(p, X(10), Y(14), 13 + fl, 4, -7, FIRE);
  flame(p, X(16), Y(8), 12 - fl / 2, 4, -6, FIRE);
  flame(p, X(22), Y(7), 9 + fl / 2, 3.5, -4, FIRE);
  part.ell(p, X(16), Y(10), 9, 5 + (f % 2), RED); part.ell(p, X(16), Y(9), 6, 3, RAMP.ember, { outline: false }); part.ell(p, X(15), Y(8), 3, 1.6, RAMP.lemon, { outline: false });   // 불꽃 밑동
  part.ell(p, X(21), Y(16), 10, 9, RAMP.bone);                                                 // 큰 해골
  part.poly(p, [[X(17), Y(21)], [X(31), Y(20)], [X(30), Y(26) + (q.mouth ? 2 : 0)], [X(19), Y(26) + (q.mouth ? 2 : 0)]], RAMP.bone);   // 아래턱
  const op = q.mouth === 1 ? 3 : q.mouth === 2 ? 2 : 1;
  p.rect(X(20), Y(22), 10, op, '#2a1018');
  for (const tx of [21, 24, 28]) p.rect(X(tx), Y(22) - 1, 1 + (tx === 24 ? 1 : 0), 2, RAMP.bone[0]);   // 듬성 이빨
  if (q.eye === 'shut') { p.rect(X(24), Y(14), 5, 1, OUT); p.rect(X(16), Y(15), 4, 1, OUT); }
  else {
    part.ell(p, X(26), Y(14), 3.4, 3.6, ['#2a1018', '#2a1018', '#140810'], { outline: false });   // 큰 눈구멍
    p.rect(X(26), Y(14), 2, 2, q.eye === 'focus' ? '#fff3a0' : '#ff7a3a'); p.set(X(27), Y(13), '#fff3a0');   // 이글거리는 눈빛
    part.poly(p, [[X(15), Y(13)], [X(20), Y(13)], [X(19), Y(16)], [X(16), Y(16)]], ['#2a1018', '#2a1018', '#140810'], { outline: false });   // 처진 눈구멍
    p.set(X(18), Y(15), '#c4521f');
  }
  p.rect(X(22), Y(18), 2, 2, '#2a1018');                                                       // 코 구멍
  p.set(X(14), Y(10), RAMP.bone[2]); p.set(X(15), Y(11), RAMP.bone[2]); p.set(X(15), Y(12), RAMP.bone[2]);   // 금
  p.set(X(30), Y(24), RAMP.ember[1]);                                                          // 불똥 침
  return flip(p);
}

/* ───────── 빨간 고추 좀비 chili (48) — 고추 몸통 · 꼭지 모자 · 베어 먹힌 자리에 씨 · 공격 땐 불을 뿜음 ───────── */
function chili(a) {
  const S = 52, { p, q, X, Y, g } = base(S, a, 2, 4);
  legs(p, S, [X(17), X(24)], Y(38), g, ZSKIN, 4);
  part.poly(p, [[X(12), Y(36)], [X(17), Y(38)], [X(11), Y(42)], [X(8), Y(41)]], RED);           // 구부러진 고추 끝
  part.poly(p, [[X(13), Y(18)], [X(34), Y(17)], [X(33), Y(30)], [X(28), Y(38)], [X(18), Y(40)], [X(12), Y(33)]], RED);   // 고추 몸
  part.ell(p, X(16), Y(29), 3, 3.5, ['#ffe8b0', '#f2d48a', '#c8a050']);                        // 베어 먹힌 자리
  for (const [sx, sy] of [[15, 28], [17, 30], [16, 31]]) p.set(X(sx), Y(sy), '#fff6dc');
  p.rect(X(24), Y(25), 1, 9, RED[0]); p.rect(X(29), Y(27), 1, 4, RED[2]);                       // 고추 결
  rips(p, [[X(19), Y(39)], [X(26), Y(37)]]);
  part.ell(p, X(11), Y(25), 2.4, 4, ZSKIN);                                                    // 뒷팔 (썩은 초록)
  const reach = q.mouth === 1 ? 3 : 0;
  part.ell(p, X(36) + reach, Y(24), 4.5, 2.2, ZSKIN);
  for (const fx of [38, 40]) p.rect(X(fx) + reach, Y(26), 1, 2, ZSKIN[2]);
  zFace(p, X(24), Y(13), 10, q, { skin: RED, noHair: true });
  part.poly(p, [[X(15), Y(6)], [X(33), Y(5)], [X(31), Y(9)], [X(27), Y(7)], [X(23), Y(10)], [X(19), Y(7)], [X(16), Y(9)]], ['#a8d468', '#5f8a34', '#34521c']);   // 꼭지
  part.poly(p, [[X(23), Y(6)], [X(25), Y(6)], [X(22), Y(0)], [X(19), Y(1)]], ['#a8d468', '#5f8a34', '#34521c']);   // 꼭지 줄기
  for (const [hx, hy] of [[33, 2], [36, 4]]) if ((FI(a) + hx) % 2) p.set(X(hx), Y(hy), '#ffffff');   // 매운 김
  p.set(X(34), Y(3), '#e6e2f2');
  if (a === 'atk1') { flame(p, X(38), Y(19), 0, 0, 0, FIRE); part.ell(p, X(39), Y(18), 3.5, 2.4, RAMP.ember, { outline: false }); part.ell(p, X(42), Y(18), 2.2, 1.6, RAMP.lemon, { outline: false }); }   // 불 뿜기
  return flip(p);
}

/* ───────── 용암 덩이 lava (50) — 굳은 껍질을 인 용암 방울 · 흘러내리는 몸 · 이글거리는 침 (광역) ───────── */
function lava(a) {
  const S = 52, { p, q, X, Y } = base(S, a), f = FI(a);
  const sq = a === 'walk0' ? 1 : a === 'atk0' ? 2 : 0;                                          // 꿀렁 (납작)
  const cx = 24, top = 12 + sq * 2, bot = S - 2, rx = 18 + sq;
  const dome = [];
  for (let i = 0; i <= 16; i++) { const t = (i / 16) * Math.PI; dome.push([X(cx) - Math.cos(t) * rx, top + (1 - Math.sin(t)) * (bot - top) * 0.55]); }
  part.poly(p, [[X(cx) - rx - 1, bot], ...dome, [X(cx) + rx + 1, bot]], LAVA);
  for (const [dx, h] of [[-12, 3], [-3, 2], [9, 3]]) part.ell(p, X(cx + dx), bot - 1, 2, h * 0.6, LAVA, { outline: false });   // 흘러내린 방울
  for (const [px, py, r] of [[14, 20, 5], [24, 15, 6], [8, 30, 4], [33, 22, 4]]) part.ell(p, X(px), py + sq * 2, r, r * 0.7, ROCKD);   // 굳은 껍질
  for (const [lx, ly] of [[19, 19], [29, 18], [12, 26]]) { p.rect(X(lx), ly + sq * 2, 2, 1, RAMP.lemon[1]); p.set(X(lx) + 1, ly + 1 + sq * 2, RAMP.lemon[0]); }   // 이글 금
  const arm = a === 'atk1' ? 3 : 0;
  part.ell(p, X(40) + arm, Y(33), 4 + (arm ? 1 : 0), 3, LAVA);                                  // 뭉툭한 팔
  part.ell(p, X(8), Y(37), 3, 2.6, LAVA);
  zFeat(p, X(28), Y(29) + sq, 11, q, { skin: ['#ffe07a', '#ff8a2a', '#a8301a'], drool: [RAMP.lemon[1], '#ffffff'], pupil: '#5a1a0a' });
  for (const [sx, sy, r] of [[20, 8], [27, 5], [16, 4]]) if ((f + sx) % 3) part.ell(p, X(sx), sy + sq, 1.6 + (r ?? 0), 1.4, SMOKE, { outline: false });   // 연기
  if (a === 'atk1') for (const [bx, by] of [[42, 26], [44, 38], [39, 21]]) part.ell(p, X(bx), Y(by), 1.6, 1.6, LAVA);   // 튀는 용암
  return flip(p);
}

/* ───────── 폭탄 좀비 bomb (42) — 빨간 두건을 매고 커다란 폭탄을 껴안고 뛰어든다 (자폭) ───────── */
function bomb(a) {
  const S = 46, { p, q, X, Y, g } = base(S, a, 1, 4), f = FI(a);
  legs(p, S, [X(11), X(17)], Y(30), g, PANTS, 4);
  part.poly(p, [[X(9), Y(17)], [X(21), Y(16)], [X(22), Y(31)], [X(10), Y(32)]], ['#e8e2d0', '#b8b098', '#7e7660']);   // 해진 러닝셔츠
  for (let i = 0; i < 3; i++) p.rect(X(10), Y(20) + i * 4, 11, 1, RED[1]);
  rips(p, [[X(11), Y(31)], [X(18), Y(31)]]);
  zFace(p, X(17), Y(11), 8.5, q, { noHair: true });
  part.poly(p, [[X(9), Y(6)], [X(25), Y(4)], [X(25), Y(7)], [X(9), Y(9)]], RED);                // 빨간 두건
  part.poly(p, [[X(9), Y(6)], [X(3), Y(4) + (f % 2)], [X(4), Y(9) + (f % 2)]], RED);            // 휘날리는 두건 끈
  for (const dx of [12, 18, 22]) p.set(X(dx), Y(6), RED[0]);
  const lift = a === 'atk0' ? -4 : a === 'atk1' ? 3 : 0;
  const bx = X(28) + (a === 'atk1' ? 3 : 0), by = Y(26) + lift;
  part.ell(p, bx, by, 9, 9, ['#6e7088', '#3e4054', '#1e1e2c']);                                 // 큰 폭탄
  p.rect(bx - 9, by - 1, 19, 3, RED[1]); p.rect(bx - 9, by - 1, 19, 1, RED[0]);                 // 빨간 띠
  p.rect(bx - 4, by - 6, 3, 2, '#9a9cb4');                                                     // 반짝
  part.ell(p, bx + 1, by - 9, 2.4, 1.6, ['#9a9cb4', '#6e7088', '#3e4054']);                     // 꼭지
  for (let i = 0; i < 4; i++) p.set(bx + 2 + i, by - 11 - (i % 2), RAMP.rag[1]);               // 심지
  const sp = [[0, 0], [1, -1], [0, 1], [2, -2], [3, -2], [0, 0]][f];
  p.set(bx + 6, by - 13 + sp[1], '#ffffff');
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) p.set(bx + 6 + dx * (1 + sp[0] % 2), by - 13 + sp[1] + dy * (1 + sp[0] % 2), dx || dy ? RAMP.lemon[1] : '#fff');   // 불꽃 튐
  part.ell(p, bx - 7, by + 3, 2.4, 2.4, ZSKIN); part.ell(p, bx + 2, by + 7, 2.4, 2.2, ZSKIN);   // 껴안은 손
  return flip(p);
}

/* ───────── 박쥐떼 bat (40) — 툭 튀어나온 눈의 좀비 박쥐 세 마리 · 구멍 난 날개 (날개 · 빠름) ───────── */
const BAT = ['#c8a8d0', '#8a6898', '#54405e'], MEMB = ['#9a7aa6', '#64466e', '#3a2846'];
function oneBat(p, x, y, s, up, q, big) {
  const w = Math.round(11 * s), R = (v) => Math.round(v * s);
  for (const d of [-1, 1]) {
    const pts = up
      ? [[x + d * 2, y - 2], [x + d * R(6), y - R(7)], [x + d * w, y - R(5)], [x + d * R(9), y + 1], [x + d * R(7), y - 1], [x + d * R(5), y + 2], [x + d * 2, y + 2]]
      : [[x + d * 2, y - 1], [x + d * R(6), y], [x + d * w, y + R(6)], [x + d * R(8.5), y + R(5)], [x + d * R(6.5), y + R(6.5)], [x + d * R(4.5), y + R(4)], [x + d * 2, y + 3]];
    part.poly(p, pts, MEMB);
    for (let t = 1; t < 4; t++) p.set(Math.round(pts[0][0] + (pts[1][0] - pts[0][0]) * t / 4), Math.round(pts[0][1] + (pts[1][1] - pts[0][1]) * t / 4) + 1, BAT[0]);   // 날개 뼈
  }
  p.set(x - R(7), y + (up ? -2 : 3), OUT); p.set(x + R(8), y + (up ? -2 : 4), OUT);                          // 날개 구멍
  const r = 4.6 * s;
  part.poly(p, [[x - R(4), y - r + 2], [x - R(3), y - r - R(3)], [x - 1, y - r + 2]], BAT); part.poly(p, [[x + 1, y - r + 2], [x + R(3), y - r - R(3)], [x + R(4), y - r + 2]], BAT);   // 귀
  part.ell(p, x, y, r, r * 0.95, BAT);
  if (q.eye === 'shut') { p.rect(x + 1, y - 1, 3, 1, OUT); p.rect(x - 4, y, 3, 1, OUT); }
  else {
    const er = big ? 2.8 : 2;
    part.ell(p, x + R(2), y - 1, er, er * 1.05, ['#ffffff', '#f2eed8', '#c8c0a0']);
    p.rect(x + R(2) + 1, y - 1, big ? 2 : 1, big ? 2 : 1, q.eye === 'focus' ? '#c01818' : OUT);
    if (big) p.set(x + R(2) - 2, y - 3, '#e8a0a0');
    p.rect(x - R(3) - 1, y - 1, 3, 1, OUT); p.set(x - R(3), y, '#e2dcc0');                              // 처진 눈
  }
  const mo = q.mouth === 1 ? 2 : 1;
  p.rect(x - 1, y + R(2.5), R(4), mo, '#3a0e16'); p.set(x - 1, y + R(2.5) + mo, '#fff6dc'); p.set(x + R(4) - 2, y + R(2.5) + mo, '#fff6dc');   // 송곳니
  if (big) { p.set(x + R(4) - 1, y + R(2.5) + mo + 1, DROOL[0]); p.set(x + R(4) - 1, y + R(2.5) + mo + 2, DROOL[1]); }
  p.set(x - R(3), y + R(2), BAT[2]);                                                                       // 썩은 반점
}
function bat(a) {
  const S = 48, { p, q, X, Y } = base(S, a, 3, 5), f = FI(a);
  const up = (i) => (f + i) % 2 === 0, bob = (i) => (up(i) ? -1 : 1);
  const lunge = a === 'atk1' ? 2 : 0;
  oneBat(p, X(11), Y(23) + bob(1), 0.95, up(1), q, false);
  oneBat(p, X(20), Y(32) + bob(2), 0.9, up(2), q, false);
  oneBat(p, X(24) + lunge, Y(13) + bob(0), 1.35, up(0), q, true);
  return flip(p);
}

/* ───────── 날개 좀비 wingz (48) — 너덜너덜한 박쥐 날개로 떠서 초록 침을 멀리 뱉는다 (원거리) ───────── */
const WING = ['#c4a2b0', '#86607a', '#523448'];
function wingz(a) {
  const S = 58, { p, q, X: X0, Y: Y0 } = base(S, a, 4, 5), f = FI(a);
  const X = (v) => X0(v + 6), Y = (v) => Y0(v + 2);                                          // 몸은 오른쪽 아래로 (날개 자리)
  const up = f % 2 === 1 || a === 'atk0', hv = up ? -2 : 0;
  const sh = [X(17), Y(19) + hv];
  const bone = (ax, ay, bx, by) => { const n = Math.max(1, Math.abs(bx - ax), Math.abs(by - ay)); for (let t = 0; t <= n; t++) p.set(Math.round(ax + (bx - ax) * t / n), Math.round(ay + (by - ay) * t / n), RAMP.bone[1]); };
  const wing = (ox, oy, rp, bones) => {
    const P = ([x, y]) => [X0(x + ox), Y0(y + oy)];
    const wr = P(up ? [12, 1] : [8, 30]);                                                    // 날개 손목
    const tips = (up ? [[1, 5], [0, 19], [9, 28]] : [[0, 33], [2, 45], [13, 47]]).map(P);
    const sc = (up ? [[6, 12], [7, 24]] : [[5, 37], [8, 43]]).map(P);
    part.poly(p, [[sh[0] + ox, sh[1] + oy], wr, tips[0], sc[0], tips[1], sc[1], tips[2], [X(15) + ox, Y(28) + oy + hv]], rp);   // 날개 막
    if (bones) { bone(sh[0], sh[1], wr[0], wr[1]); for (const [tx, ty] of tips) bone(wr[0], wr[1], tx, ty); p.set(wr[0], wr[1], RAMP.bone[0]); }
  };
  wing(7, up ? -1 : 1, ['#94707e', '#62445a', '#3a2232'], false);                             // 먼 쪽 날개
  wing(0, 0, WING, true);
  p.set(X0(5), Y0(up ? 14 : 38), OUT); p.set(X0(6), Y0(up ? 14 : 38), OUT); p.set(X0(9), Y0(up ? 20 : 35), OUT);   // 날개 구멍
  for (const [lx, d] of [[17, 0], [22, 1]]) { part.poly(p, [[X(lx), Y(32) + hv], [X(lx + 4), Y(32) + hv], [X(lx + 3 + d), S - 9 + hv], [X(lx + d), S - 9 + hv]], PANTS); p.rect(X(lx + d), S - 9 + hv, 3, 2, ZSKIN[1]); p.rect(X(lx + 1 + d), S - 7 + hv, 2, 1, ZSKIN[2]); }   // 축 늘어진 다리 (떠 있음)
  part.poly(p, [[X(14), Y(19) + hv], [X(27), Y(18) + hv], [X(28), Y(33) + hv], [X(15), Y(34) + hv]], RAMP.cloth);   // 해진 환자복
  rips(p, [[X(16), Y(33) + hv], [X(20), Y(34) + hv], [X(25), Y(33) + hv]]);
  p.rect(X(19), Y(23) + hv, 2, 3, '#7a8a50');
  part.ell(p, X(29), Y(23) + hv, 4.5, 2.2, ZSKIN);                                             // 팔
  zFace(p, X(26), Y(12) + hv, 9, q);
  if (a === 'atk0') part.ell(p, X(32), Y(16) + hv, 2.4, 2, DROOL.concat('#6e9a3a'), { outline: false });   // 볼 가득 침
  if (a === 'atk1') { part.ell(p, X(40), Y(16), 3.2, 2.6, ['#c8f27a', '#9fd86a', '#5e8a30']); p.rect(X(35), Y(16), 2, 1, DROOL[0]); p.set(X(44), Y(14), DROOL[1]); }   // 퉤!
  return flip(p);
}

/* ───────── 풍선 좀비 balloon (52) — 풍선 셋에 매달려 둥실 · 죽으면 어슬렁 둘로 (날개) ───────── */
function balloon(a) {
  const S = 56, { p, q, X, Y } = base(S, a, 1, 4), f = FI(a), bob = f % 2 ? -1 : 0;
  const hy = Y(25) + bob;                                                                     // 끈 쥔 손
  const balls = [[13, 9, RAMP.rose], [24, 7, RAMP.lemon], [34, 11, RAMP.sky]];
  for (const [bx, by] of balls) for (let t = 1; t < 8; t++) p.set(X(24) + Math.round((X(bx) - X(24)) * (1 - t / 8)), hy - Math.round((hy - (Y(by) + 7)) * t / 8), OUT);   // 끈
  balls.forEach(([bx, by, rp], i) => {
    const yy = Y(by) + bob + (i === 1 && f % 2 ? 1 : 0);
    part.ell(p, X(bx), yy, 5.5, 6.5, rp);
    p.rect(X(bx) - 1, yy + 7, 3, 1, rp[2]);
    p.rect(X(bx) - 3, yy - 4, 2, 2, '#ffffff');
  });
  p.rect(X(32), Y(8) + bob, 5, 1, '#e2d8b8'); p.rect(X(34), Y(6) + bob, 1, 5, '#e2d8b8');        // 반창고 (기운 풍선)
  part.poly(p, [[X(22), hy], [X(26), hy], [X(26), Y(33) + bob], [X(23), Y(33) + bob]], ZSKIN);  // 끈 쥔 팔
  part.ell(p, X(24), hy, 2.2, 2, ZSKIN);
  for (const [lx, d] of [[16, -1], [22, 1]]) { part.poly(p, [[X(lx), Y(42) + bob], [X(lx + 4), Y(42) + bob], [X(lx + 4 + d), S - 3 + bob], [X(lx + d), S - 3 + bob]], PANTS); p.rect(X(lx + d), S - 3 + bob, 5, 2, '#3a2a20'); }   // 대롱대롱 다리
  part.poly(p, [[X(13), Y(32) + bob], [X(27), Y(31) + bob], [X(28), Y(43) + bob], [X(14), Y(44) + bob]], JACKET);   // 해진 재킷
  part.poly(p, [[X(18), Y(32) + bob], [X(22), Y(32) + bob], [X(21), Y(42) + bob], [X(18), Y(43) + bob]], ['#f2b8c8', '#d488a0', '#9a5068'], { outline: false });   // 파티 셔츠
  rips(p, [[X(14), Y(43) + bob], [X(25), Y(42) + bob]]);
  part.ell(p, X(13), Y(37) + bob, 2.2, 3.5, ZSKIN);
  zFace(p, X(18), Y(27) + bob, 8, q);
  part.poly(p, [[X(12), Y(20) + bob], [X(17), Y(10) + bob], [X(19), Y(20) + bob]], ['#a6d6ff', '#3f8cff', '#1f4fa8']);   // 고깔모자
  p.set(X(17), Y(10) + bob, '#ffd23f'); p.rect(X(14), Y(17) + bob, 4, 1, '#ffd23f');
  return flip(p);
}

export const ZOMBIES_W25 = {
  'zombie/gold/0': (a) => gold(a), 'zombie/skull/0': (a) => skull(a), 'zombie/chili/0': (a) => chili(a),
  'zombie/lava/0': (a) => lava(a), 'zombie/bomb/0': (a) => bomb(a), 'zombie/bat/0': (a) => bat(a),
  'zombie/wingz/0': (a) => wingz(a), 'zombie/balloon/0': (a) => balloon(a),
  ...ZOMBIES_W25B,
};
