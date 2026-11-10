/**
 * «좀비와 드래곤» 배너 · 로고 전용 도트 그림 (2026-11-10, 겜팀장) — build-iandragon-banner.mjs 가 브라우저 안에서 부른다.
 *
 * 캐릭터는 게임 안 스프라이트(src/games/iandragon_game/art/)를 «같은 도트 칸»으로 그대로 찍는다 —
 * 게임 그림 1칸 = 배너 도트 1칸 = 화면 3픽셀. (줄넘기 배너의 bigKid 처럼 «배너용으로 다시 찍은 것» 과 같은 크기 감각)
 * 새로 그린 것은 둘뿐: 고깔 좀비(게임 그림 키트로 그림) · 화로와 불씨 마스코트. 전부 오리지널.
 * 규칙: 정수 칸 · 반투명 없음 · 그라디언트 없음 (알파는 0 아니면 255).
 */
import { rect, px, oval, tone, sprite } from '../src/games/jumprope/art.js';
import { Pix, part } from '../src/games/iandragon_game/art/kit.js';
import { RAMP, C, OUT } from '../src/games/iandragon_game/art/palette.js';
import { UNITS } from '../src/games/iandragon_game/art/units.js';
import { DRAGONS_W1 } from '../src/games/iandragon_game/art/dragons_w1.js';
import { ZOMBIES_W1, zFace, ZSKIN } from '../src/games/iandragon_game/art/zombies_w1.js';
import { pose } from '../src/games/iandragon_game/art/units.js';

const ro = Math.round;
const SPRITES = { ...UNITS, ...DRAGONS_W1, ...ZOMBIES_W1 };

/** 게임 도트판(Pix) → 캔버스. (ox, oy) = 왼쪽 위 */
export function blitPix(c, pix, ox, oy) {
  for (let y = 0; y < pix.h; y++) for (let x = 0; x < pix.w; x++) {
    const i = (y * pix.w + x) * 4;
    if (!pix.d[i + 3]) continue;
    const h = (n) => n.toString(16).padStart(2, '0');
    px(c, ox + x, oy + y, `#${h(pix.d[i])}${h(pix.d[i + 1])}${h(pix.d[i + 2])}`);
  }
}
/** 그림이 있는 칸의 가장자리 */
export function bbox(pix) {
  let x0 = pix.w, y0 = pix.h, x1 = -1, y1 = -1;
  for (let y = 0; y < pix.h; y++) for (let x = 0; x < pix.w; x++) if (pix.d[(y * pix.w + x) * 4 + 3]) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  return { x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}
const flipPix = (p) => { const o = new Pix(p.w, p.h); o.blit(p, 0, 0, true); return o; };

/**
 * 스프라이트 하나를 «발 바닥 = foot» 에 세운다. (cx = 그림 가장자리의 가로 가운데 · lift = 뜬 칸 수)
 * 돌려주는 값 = 찍힌 자리(가장자리 상자)
 */
export function stand(c, name, anim, cx, foot, lift = 0, o = {}) {
  let p = SPRITES[name](anim);
  if (o.flip) p = flipPix(p);
  if (o.post) o.post(p);
  const b = bbox(p);
  const ox = ro(cx - (b.x0 + b.x1 + 1) / 2), oy = foot - lift - b.y1;
  blitPix(c, p, ox, oy);
  return { x: ox + b.x0, y: oy + b.y0, w: b.w, h: b.h, p, ox, oy };
}

/* =====================================================================
 * 고깔 좀비 — 오렌지색 공사 고깔을 뒤집어쓴 좀비 (게임 키트 · 어슬렁 좀비와 같은 얼굴 규칙)
 * 얼굴은 오른쪽을 보게 그린 뒤 뒤집는다(= 왼쪽을 본다). 고깔은 한쪽으로 살짝 기울어 걸쳐진 모양.
 * ===================================================================== */
const CONE = ['#ffc070', '#ff7a1a', '#b84608'];
const CONE_W = ['#ffffff', '#eceaf4', '#b8b4cc'];
const TEE = ['#8f9bb3', '#5f6a85', '#3a4258'];
const PANTS = ['#7d7f86', '#55575f', '#33343a'];
export function coneZombie(a = 'idle0') {
  const p = new Pix(32, 46), q = pose(a), X = (v) => v + q.dx, Y = (v) => v + q.dy + 6, g = q.leg;
  /* 다리 · 해진 바지 + 낡은 신발 */
  for (const [lx, s] of [[8, 1], [15, -1]]) part.poly(p, [[X(lx) + g * s, Y(29)], [X(lx + 5) + g * s, Y(29)], [X(lx + 5) + g * s, 43], [X(lx) + g * s, 43]], PANTS);
  p.rect(X(6) + g, 43, 8, 2, '#3a2a20'); p.rect(X(15) - g, 43, 8, 2, '#3a2a20');
  p.set(X(10) + g, 36, OUT); p.set(X(11) + g, 37, OUT); p.set(X(17) - g, 35, OUT);              // 해진 바짓단
  /* 뒷팔 */
  part.ell(p, X(8), Y(25), 2.2, 4.6, ZSKIN);
  /* 몸 — 낡은 티셔츠 + 얼룩 + 찢어진 단 */
  part.poly(p, [[X(8), Y(18)], [X(21), Y(17)], [X(23), Y(31)], [X(9), Y(32)]], TEE);
  p.rect(X(11), Y(21), 3, 2, '#7a8a50'); p.set(X(18), Y(25), '#6a3030'); p.set(X(19), Y(25), '#6a3030');
  for (const [tx, ty] of [[10, 31], [14, 32], [18, 31], [22, 30]]) { p.set(X(tx), Y(ty), OUT); p.set(X(tx) + 1, Y(ty) + 1, OUT); }
  /* 앞팔 — 앞으로 쭉 (뒤집으면 왼쪽 = 어슬렁 좀비 쪽) */
  part.ell(p, X(25), Y(21), 4.6, 2, TEE);
  part.ell(p, X(30), Y(21) + 1, 2, 2, ZSKIN);
  /* 얼굴 (고깔 밑으로) */
  zFace(p, X(17), Y(13), 6.5, q, { noHair: true });
  /* 고깔 — 머리에 푹 눌러 쓴 오렌지색 공사 고깔: 흰 줄 둘 + 넓은 밑단 테 */
  const tip = Y(-5), cb = Y(8);
  part.poly(p, [[X(17), tip], [X(23), cb], [X(11), cb]], CONE, { hi: 0.5, lo: -0.15 });
  const hwAt = (y) => ((y - tip) / (cb - tip)) * 6;
  for (const [y0, hgt] of [[tip + 4, 2], [tip + 8, 2]]) for (let y = y0; y < y0 + hgt; y++) { const hw = Math.round(hwAt(y + 0.5)); p.rect(X(17) - hw + 1, y, Math.max(2, hw * 2 - 1), 1, y === y0 ? CONE_W[0] : CONE_W[1]); }
  part.poly(p, [[X(9), cb], [X(25), cb], [X(26), cb + 2], [X(8), cb + 2]], ['#ff9a40', '#e86412', '#a03a06']);   // 밑단 테
  p.set(X(17), tip, '#ffd8a0');
  return flipPix(p);
}

/** 뼈다귀(멍멍이가 문 것) — 왼쪽을 보는 멍멍이 입 앞에 얹는다 */
export function boneBit(c, x, y) {
  const B = ['ww....ww', 'wwwwwwww', 'ww....ww'], set = new Set();
  B.forEach((r, j) => [...r].forEach((ch, i) => { if (ch === 'w') set.add(i + ',' + j); }));
  for (const k of set) { const [i, j] = k.split(',').map(Number); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!set.has((i + dx) + ',' + (j + dy))) px(c, x + i + dx, y + j + dy, OUT); }
  for (const k of set) { const [i, j] = k.split(',').map(Number); px(c, x + i, y + j, j === 2 ? '#bfb497' : '#efe7d2'); }
  px(c, x + 3, y + 1, '#ffffff');
}

/* =====================================================================
 * 화로 · 불씨 마스코트
 * ===================================================================== */
const ROCK = RAMP.rock;
/** 돌 한 덩이 — 외곽선 + 3단 */
function stone(c, cx, cy, rx, ry, k = 0) {
  oval(c, cx - 0.5, cy, rx + 1, ry + 1, OUT);
  oval(c, cx - 0.5, cy, rx, ry, ROCK[1]);
  oval(c, cx - 1, cy + 1, rx - 1, ry - 1, ROCK[2], cy + ry);                                    // 밑 그늘
  oval(c, cx - 0.5, cy - 0.5, rx - 0.5, ry - 1.2, ROCK[1]);
  oval(c, cx - 1.5, cy - 1, rx * 0.55, ry * 0.45, ROCK[0]);                                      // 왼쪽 위 빛
}
export function hearth(c, cx, bottom) {
  const y = bottom;                                                                              // 바닥 줄
  /* 안쪽 불빛 + 숯 (뒤) */
  rect(c, cx - 17, y - 14, 34, 6, OUT);
  rect(c, cx - 16, y - 13, 32, 5, '#c4521f');
  for (let i = -15; i <= 15; i += 2) px(c, cx + i, y - 13, '#ff8a1a');
  /* 돌: 맨 뒷줄 · 가운데 줄 · 앞줄 */
  for (const dx of [-17, -6, 6, 17]) stone(c, cx + dx, y - 9, 6, 4.5);
  for (const dx of [-21, -11, 0, 11, 21]) stone(c, cx + dx, y - 4, 6, 4.2);
  /* 앞줄 돌 사이 틈 그림자 + 바닥 그림자 */
  rect(c, cx - 25, y + 1, 51, 1, OUT);
}
const FLAME = { out: '#ff8a1a', mid: '#ffd21f', core: '#fff8c8' };
/** 눈 · 입 달린 작은 불꽃 — (cx, bottom) 밑 가운데 · H 높이 · Wd 폭(반지름) */
export function flameMascot(c, cx, bottom, H = 28, R = 11) {
  const top = bottom - H + 1;
  const hwOf = (j, Hh, Rr) => {                                                                  // j = 위에서 몇 번째 줄
    const cr = Rr, cyc = Hh - 1 - cr;
    if (j >= cyc) { const d = j - cyc; return Math.sqrt(Math.max(0, cr * cr - d * d)); }
    return Rr * Math.pow(j / cyc, 1.15);
  };
  const shift = (j, Hh, Rr) => { const cyc = Hh - 1 - Rr; return j < cyc ? Math.round(2.4 * Math.pow(1 - j / cyc, 1.6)) : 0; };   // 꼬리가 오른쪽으로 말린다
  const draw = (Hh, Rr, bot, col, cxx) => {
    for (let j = 0; j < Hh; j++) {
      const hw = hwOf(j + 0.5, Hh, Rr), y = bot - Hh + 1 + j, sx = shift(j, Hh, Rr);
      const a = ro(cxx + sx - hw), b = ro(cxx + sx + hw);
      if (b > a) rect(c, a, y, b - a, 1, col);
    }
  };
  /* 외곽선: 같은 모양을 1칸씩 네 방향으로 밀어 찍는다 */
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1]]) {
    for (let j = 0; j < H; j++) {
      const hw = hwOf(j + 0.5, H, R), y = bottom - H + 1 + j + dy, sx = shift(j, H, R);
      const a = ro(cx + sx - hw) + dx, b = ro(cx + sx + hw) + dx;
      if (b > a) rect(c, a, y, b - a, 1, OUT);
    }
  }
  draw(H, R, bottom, FLAME.out, cx);
  draw(ro(H * 0.7), R - 4, bottom - 1, FLAME.mid, cx);
  draw(ro(H * 0.36), R - 8, bottom - 2, FLAME.core, cx);
  /* 얼굴 — 노랑 덩어리 위에. 동그란 눈 둘 + 웃는 입 */
  const fy = bottom - 11;
  for (const s of [-1, 1]) {
    const ex = cx + s * 4 - (s > 0 ? 0 : 1);
    rect(c, ex - 1, fy - 1, 3, 5, OUT); rect(c, ex - 2, fy, 5, 3, OUT);
    px(c, ex - 1, fy, '#ffffff'); px(c, ex - 1, fy + 1, '#ffffff');
  }
  rect(c, cx - 7, fy + 4, 2, 1, '#ff7a6a'); rect(c, cx + 5, fy + 4, 2, 1, '#ff7a6a');            // 볼
  rect(c, cx - 3, fy + 5, 6, 1, OUT); px(c, cx - 4, fy + 4, OUT); px(c, cx + 3, fy + 4, OUT);     // 웃는 입
  rect(c, cx - 2, fy + 6, 4, 1, '#8e2a3a');
  return top;
}
/** 불티 — 1~2칸짜리 주황 · 노랑 점 */
export function embers(c, list) {
  for (const [x, y, col, big] of list) { px(c, x, y, col); if (big) px(c, x + 1, y, col); }
}

/* =====================================================================
 * 한 장면 — (W=264, H=112 도트판). 뒤 → 앞: 빛살 → 화로 → 불씨 → 뒤쪽 작은 것 → 큰 것 → 앞쪽 작은 것
 * 지금은 «자리» 가 정해진 대로만 찍고, 겹침은 build 스크립트가 미리보기를 보고 고친다.
 * ===================================================================== */
export const FOOT = 101;
export function scene(c, B) {
  const info = {};
  B.rays(c, 132, 78, 22);
  hearth(c, 132, 101);
  flameMascot(c, 132, 85, 28, 11);
  embers(c, [[116, 70, '#ffd21f'], [148, 68, '#ff8a1a'], [120, 58, '#ff8a1a', 1], [145, 76, '#ffd21f'], [112, 82, '#ff8a1a'], [152, 84, '#ffd21f'], [124, 52, '#ffd21f'], [141, 56, '#ff8a1a']]);
  /* 왼쪽 — 아기 용 (오른쪽을 본다) */
  info.dol = stand(c, 'dragon/doldeung/1', 'idle0', 55, FOOT - 3, 0);
  info.bul = stand(c, 'dragon/bulttong/2', 'atk1', 44, FOOT, 3);
  info.kko = stand(c, 'dragon/kkomul/1', 'walk1', 89, FOOT, 4);
  /* 오른쪽 — 좀비 (왼쪽을 본다) */
  info.cone = { ...coneStand(c, 242, FOOT - 4, 0) };
  info.wal = stand(c, 'zombie/walker/0', 'walk0', 224, FOOT, 0);
  info.pup = stand(c, 'zombie/pup/0', 'walk1', 187, FOOT, 2);
  boneBit(c, info.pup.x - 7, info.pup.y + 11);
  return info;
}
/** 반짝이 — 줄넘기 배너와 같은 자리에서 시작 (인물과 겹치면 옮긴다) */
export const SPARKS = [[30, 54, true], [106, 66, false], [100, 94, false], [160, 62, true], [162, 98, false], [244, 50, false]];
function coneStand(c, cx, foot, lift) {
  const p = coneZombie('idle0'), b = bbox(p);
  const ox = ro(cx - (b.x0 + b.x1 + 1) / 2), oy = foot - lift - b.y1;
  blitPix(c, p, ox, oy);
  return { x: ox + b.x0, y: oy + b.y0, w: b.w, h: b.h };
}
