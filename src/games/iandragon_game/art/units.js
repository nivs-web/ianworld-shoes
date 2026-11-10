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

/* ───────── 꼬물이 kkomul — 머리가 몸보다 큰 연두 아기 용 · 머리 위 새싹 · 꼬리 끝 잎 ───────── */
function kkomul(form, a) {
  const S = form === 1 ? 32 : 36, k = S / 32, p = new Pix(S, S), q = pose(a);
  const G = form === 1 ? RAMP.leaf : ['#b6ee6a', '#6cc843', '#358a31'];
  const X = (v) => Math.round(v * k) + q.dx, Y = (v) => Math.round(v * k) + q.dy, R = (v) => v * k;
  part.poly(p, [[X(2), Y(17)], [X(5), Y(14)], [X(7), Y(19)]], RAMP.leaf);                     // 꼬리 끝 잎
  part.ell(p, X(6), Y(23), R(3.4), R(2.4), G);                                                 // 꼬리
  part.ell(p, X(10) - q.leg, S - 3, R(2.8), R(2.4), G, { openBottom: true });                  // 뒷다리
  part.ell(p, X(13), Y(23), R(7.5), R(6), G);                                                  // 몸 (작게)
  part.ell(p, X(15), Y(25), R(4.5), R(3.6), RAMP.belly);                                       // 배
  part.ell(p, X(18) + q.leg, S - 3, R(2.8), R(2.4), G, { openBottom: true });                  // 앞다리
  part.poly(p, [[X(7), Y(17)], [X(10), Y(12)], [X(12), Y(17)]], RAMP.leaf);                    // 아기 날개
  part.ell(p, X(19), Y(13), R(10), R(9), G);                                                   // 머리 (아주 크게)
  part.ell(p, X(26), Y(17), R(4), R(3), RAMP.belly, { outline: false });                       // 주둥이 · 턱
  /* 머리 위 새싹 (진화하면 잎 두 장 + 작은 뿔) */
  part.poly(p, [[X(17), Y(5)], [X(14), Y(0)], [X(19), Y(2)]], RAMP.leaf);
  if (form === 2) {
    part.poly(p, [[X(19), Y(4)], [X(23), Y(-0.5)], [X(22), Y(5)]], RAMP.leaf);
    part.poly(p, [[X(24), Y(6)], [X(26), Y(2)], [X(27), Y(7)]], RAMP.lemon);
  }
  if (q.eye === 'shut') shutEye(p, X(22), Y(12));
  else part.gem(p, X(22), Y(12), R(3), R(4) * (q.eye === 'focus' ? 0.85 : 1));               // 반짝이는 큰 눈
  p.rect(X(23), Y(17), 3, 1, C.blush); p.rect(X(24), Y(18), 1, 1, C.blush);                    // 볼 홍조
  if (q.mouth === 1) { p.rect(X(27), Y(18), 3, 2, C.mouth); p.set(X(28), Y(19), C.tongue); }  // 앙!
  else if (q.mouth === 2) p.rect(X(27), Y(18), 2, 2, C.mouth);
  else { p.set(X(27), Y(18), OUT); p.set(X(28), Y(19), OUT); p.set(X(29), Y(18), OUT); }       // ω 웃음
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

/* ───────── 어슬렁 좀비 walker — 크고 구부정한 회록색 좀비 · 꺼진 눈두덩 · 벌린 턱 · 해진 옷 ───────── */
const ZSKIN = ['#c3cfae', '#8a9c78', '#56684d'];
function walker(form, a) {
  const S = 44, p = new Pix(S, S), q = pose(a);
  const X = (v) => v + q.dx, Y = (v) => v + q.dy, lg = q.leg;
  /* 다리 — 질질 끄는 걸음 (한쪽은 맨발) */
  part.poly(p, [[X(13) + lg, Y(30)], [X(18) + lg, Y(30)], [X(17) + lg, S - 2], [X(12) + lg, S - 2]], RAMP.cloth);
  part.poly(p, [[X(19) - lg, Y(30)], [X(24) - lg, Y(30)], [X(25) - lg, S - 3], [X(20) - lg, S - 3]], RAMP.cloth);
  p.rect(X(10) + lg, S - 3, 8, 2, RAMP.rag[2]);                                                // 낡은 신발
  part.ell(p, X(24) - lg, S - 3, 3, 1.6, ZSKIN, { openBottom: true });                         // 맨발
  /* 몸통 — 앞으로 숙인 해진 셔츠 + 구멍 사이 갈비뼈 */
  part.poly(p, [[X(11), Y(16)], [X(25), Y(15)], [X(27), Y(31)], [X(12), Y(32)]], ['#9fb0a8', '#6b7d78', '#3f4d4c']);
  for (const [tx, ty] of [[14, 31], [18, 32], [23, 31]]) { p.set(X(tx), Y(ty), OUT); p.set(X(tx) + 1, Y(ty) - 1, OUT); }
  p.rect(X(17), Y(21), 5, 6, '#2a2030');                                                       // 셔츠 구멍
  for (let i = 0; i < 3; i++) p.rect(X(17), Y(22) + i * 2, 5, 1, RAMP.bone[1]);                // 갈비뼈
  p.rect(X(13), Y(26), 2, 3, '#5c3a3a'); p.set(X(24), Y(19), '#5c3a3a');                       // 얼룩
  /* 뒷팔 · 앞팔 — 축 늘어진 손을 앞으로 */
  part.poly(p, [[X(13), Y(18)], [X(16), Y(17)], [X(15), Y(25)], [X(12), Y(25)]], ZSKIN);
  const reach = q.mouth === 1 ? 3 : 0;
  part.ell(p, X(29) + reach, Y(20), 7, 2.4, ['#9fb0a8', '#6b7d78', '#3f4d4c']);                // 소매
  part.ell(p, X(36) + reach, Y(22), 3.2, 3, ZSKIN);                                            // 늘어진 손
  for (const fx of [34, 36, 38]) p.set(X(fx) + reach, Y(25), OUT);                             // 손톱
  /* 머리 — 앞으로 쑥 내민 길쭉한 머리 · 꺼진 눈두덩 · 벌린 턱 */
  part.ell(p, X(23), Y(10), 8, 8.5, ZSKIN);
  part.poly(p, [[X(20), Y(15)], [X(31), Y(14)], [X(30), Y(20)], [X(21), Y(19)]], ZSKIN);       // 아래턱
  for (const [hx, hy] of [[17, 2], [20, 1], [23, 2], [26, 3]]) p.rect(X(hx), Y(hy), 1, 2, '#3a3a2a');   // 듬성듬성한 머리털
  p.rect(X(19), Y(5), 3, 1, C.stitch); p.set(X(20), Y(4), C.stitch); p.set(X(20), Y(6), C.stitch);       // 이마 꿰맨 자국
  if (q.eye === 'shut') { p.rect(X(23), Y(9), 3, 1, OUT); p.rect(X(28), Y(9), 2, 1, OUT); }
  else {
    part.ell(p, X(24), Y(9), 2.4, 2.4, ['#3a2a3a', '#241826', '#140c18'], { outline: false });  // 꺼진 눈두덩
    part.ell(p, X(29), Y(9), 2, 2, ['#3a2a3a', '#241826', '#140c18'], { outline: false });
    p.set(X(25), Y(9), q.eye === 'focus' ? '#ff5a3a' : '#f2e46a');                            // 번뜩이는 눈
    p.set(X(29), Y(9), q.eye === 'focus' ? '#ff5a3a' : '#f2e46a');
  }
  const open = q.mouth === 1 ? 3 : q.mouth === 2 ? 2 : 1;                                     // 벌린 턱 + 들쭉날쭉 이빨
  p.rect(X(22), Y(15), 8, open + 1, '#2a1018');
  for (const tx of [22, 24, 27, 29]) p.set(X(tx), Y(15), C.tooth);
  for (const tx of [23, 26, 28]) p.set(X(tx), Y(15) + open, C.tooth);
  p.set(X(18), Y(12), ZSKIN[2]); p.set(X(19), Y(13), ZSKIN[2]); p.set(X(27), Y(4), ZSKIN[2]);  // 썩은 반점
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
