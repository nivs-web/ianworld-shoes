/**
 * 캐치볼 그림 · 꾸미기 자료 (2026-10-29)
 *
 * 게임(`catchball.js`)과 순위표(`screens/CatchRanking.js`)가 **같은 그림**을 쓰려고 떼어 냈다.
 * 여기에는 상태가 없다 — 캔버스 컨텍스트와 값만 받아 그린다.
 *
 * 좌표 약속: `drawKid*` 는 발 밑을 원점으로 `scale(S)` 한 뒤 **미터 단위**로 그린다.
 * 화면 y 는 아래가 + 라서 "위로 1m" 는 `-1` 이다.
 *
 * 꾸미기 값(look) — 모두 작은 정수라 한 줄로 줄여 순위표에 싣는다(`encodeLook`).
 *   skin 피부 · hair 머리 모양 · hairColor 머리색 · eyes 눈 · blush 볼터치 · team 유니폼 색
 *   number 등번호 · shoes 신발 · glove{type,color,size} · hat 모자 · ball 야구공 · emoji 이모티콘
 */

export const TAU = Math.PI * 2;
const OUT = '#2a2238';
export const BALL_R = 0.075;

/* ---------- 색 도구 ---------- */
function hex2rgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
/** k>0 밝게, k<0 어둡게 (-1..1) */
export function shade(h, k) {
  const [r, g, b] = hex2rgb(h);
  const f = (v) => Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}
const clampI = (v, a, b, d = a) => { const n = Number.isFinite(+v) ? Math.round(+v) : d; return n < a ? a : n > b ? b : n; };

/* ======================================================================
   꾸미기 자료
   ====================================================================== */
export const SKINS = [
  { name: '밝은 피부', base: '#ffe3cc' },
  { name: '기본 피부', base: '#ffd3ae' },
  { name: '노란 피부', base: '#f3c193' },
  { name: '구릿빛', base: '#d99a6c' },
  { name: '갈색 피부', base: '#a86b45' },
];
export const HAIR_STYLES = ['짧은 머리', '더벅머리', '포니테일', '양갈래', '삐죽 머리'];
export const HAIR_COLORS = [
  { name: '흑갈색', c: '#3a281d' }, { name: '밤색', c: '#6b3d22' }, { name: '검정', c: '#1c1c24' },
  { name: '금발', c: '#d9a441' }, { name: '빨강', c: '#c8452c' }, { name: '보라', c: '#7b5cd6' },
];
export const EYES = ['동글 눈', '웃는 눈', '반짝 눈', '졸린 눈'];
export const TEAMS = {
  red:    { name: '빨강', jersey: '#e23b2e', dark: '#a3241b', num: '#fffaf0', cap: '#c9291f' },
  blue:   { name: '파랑', jersey: '#2f6fe0', dark: '#1d4697', num: '#fffaf0', cap: '#2456bb' },
  yellow: { name: '노랑', jersey: '#f5c22b', dark: '#b8860c', num: '#15304b', cap: '#e3a713' },
  purple: { name: '보라', jersey: '#8b5cf0', dark: '#5a34b2', num: '#fffaf0', cap: '#7243d6' },
  green:  { name: '초록', jersey: '#2f9a4f', dark: '#1d6a33', num: '#fffaf0', cap: '#247a3e' },
  orange: { name: '주황', jersey: '#f07a22', dark: '#b2520c', num: '#fffaf0', cap: '#d8640f' },
  pink:   { name: '분홍', jersey: '#ee6fa5', dark: '#b93f74', num: '#fffaf0', cap: '#d9568f' },
  navy:   { name: '남색', jersey: '#253a66', dark: '#141f3a', num: '#ffd84a', cap: '#1c2c52' },
};
export const TEAM_KEYS = Object.keys(TEAMS);
const PARTNER_OF = { red: 'blue', blue: 'red', yellow: 'purple', purple: 'yellow', green: 'orange', orange: 'green', pink: 'navy', navy: 'pink' };
export const SHOES = [{ name: '검정', c: '#20263a' }, { name: '흰색', c: '#f1ede4' }, { name: '빨강', c: '#c9291f' }, { name: '파랑', c: '#2456bb' }];

export const GLOVE_TYPES = [
  { name: '내야수 글러브', desc: '작고 빨라요. 땅볼에 딱!' },
  { name: '외야수 글러브', desc: '손가락이 길어 높은 공을 잘 감싸요' },
  { name: '포수 미트', desc: '동그랗고 두툼한 포수 전용 미트' },
  { name: '1루수 미트', desc: '길쭉해서 멀리 오는 공을 받아 내요' },
];
export const GLOVE_COLORS = [
  { name: '갈색', base: '#b5652b' }, { name: '검정', base: '#34313a' }, { name: '빨강', base: '#c2342a' },
  { name: '파랑', base: '#2e5fb8' }, { name: '흰색', base: '#e6dfd0' }, { name: '노랑', base: '#e0b02a' },
  { name: '분홍', base: '#e27aa8' }, { name: '민트', base: '#45b89c' },
];
export const GLOVE_SIZES = [{ name: '작게', k: 0.88 }, { name: '보통', k: 1 }, { name: '크게', k: 1.14 }];

/**
 * ★ 모자 — **최고 레벨에 도달해야** 열린다 (사용자 지정)
 * 레벨1 회색 단순 · 2 파스텔 · 3 원색 · 4 원색 2컬러 · 5 원색 3컬러 · 6 무지개 · 7~10 더 화려하게
 */
export const HATS = [
  { name: '회색 모자', level: 1, main: '#9aa0a8', brim: '#7c828b', btn: '#6b7079' },
  { name: '파스텔 모자', level: 2, pattern: 'pastel', main: '#f7b9cf', brim: '#a8e6cf', btn: '#c9b6f2' },
  { name: '원색 모자', level: 3, main: '#e23b2e', brim: '#b8231a', btn: '#ffd84a' },
  { name: '투톤 모자', level: 4, pattern: 'two', main: '#2f6fe0', alt: '#f5c22b', brim: '#e23b2e', btn: '#ffffff' },
  { name: '삼색 모자', level: 5, pattern: 'bands', bands: ['#e23b2e', '#f5c22b', '#2f6fe0'], brim: '#2f9a4f', btn: '#ffffff' },
  { name: '무지개 모자', level: 6, pattern: 'bands', bands: ['#ff4d4d', '#ff9f2e', '#ffe24a', '#4cd964', '#3fa9f5', '#8e6cf0'], brim: '#8e6cf0', btn: '#ffffff' },
  { name: '은빛 모자', level: 7, pattern: 'metal', main: '#c9d2dc', brim: '#8d99a6', btn: '#ffffff', sparkle: true },
  { name: '황금 모자', level: 8, pattern: 'gold', main: '#f2c94c', brim: '#c99a1c', btn: '#fff6c9', sparkle: true },
  { name: '불꽃 모자', level: 9, pattern: 'fire', main: '#2a1d24', brim: '#e2492a', btn: '#ffb02e' },
  { name: '전설의 왕관 모자', level: 10, pattern: 'legend', main: '#6b3fd6', brim: '#f2c94c', btn: '#f2c94c', sparkle: true, crown: true },
];
/** 팀 색 모자 (컴퓨터 친구 전용) */
export const TEAM_HAT = -1;

/**
 * ★ 야구공 — **최대 연속 스트라이크** 기록으로 열린다 (사용자 지정)
 * 회색 → 파스텔 → 원색 → 여러 색 순. `need` = 연속 스트라이크 몇 개
 */
export const BALLS = [
  { name: '기본 야구공', need: 0, body: '#ffffff', stitch: '#e23b2e' },
  { name: '회색 야구공', need: 3, body: '#b9bec6', stitch: '#5f6670' },
  { name: '파스텔 야구공', need: 5, body: '#f9c6d6', stitch: '#5fc9a5' },
  { name: '원색 야구공', need: 8, body: '#ffd23a', stitch: '#2456bb' },
  { name: '투톤 야구공', need: 12, pattern: 'half', bands: ['#2f6fe0', '#f5c22b'], stitch: '#ffffff' },
  { name: '삼색 야구공', need: 16, pattern: 'bands', bands: ['#e23b2e', '#f5c22b', '#2f6fe0'], stitch: '#ffffff' },
  { name: '무지개 야구공', need: 20, pattern: 'bands', bands: ['#ff4d4d', '#ff9f2e', '#ffe24a', '#4cd964', '#3fa9f5', '#8e6cf0'], stitch: '#ffffff' },
  { name: '은빛 야구공', need: 25, pattern: 'metal', body: '#d6dde5', stitch: '#4a5563' },
  { name: '황금 야구공', need: 30, pattern: 'gold', body: '#f2c94c', stitch: '#b23a1e' },
  { name: '불꽃 야구공', need: 40, pattern: 'fire', body: '#ff7a1a', stitch: '#fff3a0', trail: true },
];
export const EMOJIS = ['😀', '😎', '🤩', '🥳', '😆', '🤗', '😺', '🐶', '🐯', '🦁', '🐼', '🐵', '🐰', '🦊', '⚾', '🔥', '⭐', '👑', '💪', '🍀'];

export function defaultLook(team = 'red') {
  return { skin: 1, hair: 0, hairColor: 0, eyes: 0, blush: 1, team: TEAMS[team] ? team : 'red', number: 7, shoes: 0,
    glove: { type: 0, color: 0, size: 1 }, hat: 0, ball: 0, emoji: 0 };
}
export function normalizeLook(l) {
  const d = defaultLook();
  if (!l || typeof l !== 'object') return d;
  const g = l.glove || {};
  return {
    skin: clampI(l.skin, 0, SKINS.length - 1, d.skin),
    hair: clampI(l.hair, 0, HAIR_STYLES.length - 1, d.hair),
    hairColor: clampI(l.hairColor, 0, HAIR_COLORS.length - 1, d.hairColor),
    eyes: clampI(l.eyes, 0, EYES.length - 1, d.eyes),
    blush: l.blush === 0 ? 0 : 1,
    team: TEAMS[l.team] ? l.team : d.team,
    number: clampI(l.number, 0, 99, d.number),
    shoes: clampI(l.shoes, 0, SHOES.length - 1, d.shoes),
    glove: { type: clampI(g.type, 0, GLOVE_TYPES.length - 1, 0), color: clampI(g.color, 0, GLOVE_COLORS.length - 1, 0), size: clampI(g.size, 0, GLOVE_SIZES.length - 1, 1) },
    hat: l.hat === TEAM_HAT ? TEAM_HAT : clampI(l.hat, 0, HATS.length - 1, 0),
    ball: clampI(l.ball, 0, BALLS.length - 1, 0),
    emoji: clampI(l.emoji, 0, EMOJIS.length - 1, 0),
  };
}
/** 순위표에 싣는 한 줄 (64자 이하) */
export function encodeLook(l) {
  const n = normalizeLook(l);
  return [n.skin, n.hair, n.hairColor, n.eyes, n.blush, TEAM_KEYS.indexOf(n.team), n.number, n.shoes,
    n.glove.type, n.glove.color, n.glove.size, n.hat, n.ball, n.emoji].join('.');
}
export function decodeLook(s) {
  if (typeof s !== 'string') return defaultLook();
  const a = s.split('.').map((v) => parseInt(v, 10));
  if (a.length < 14) return defaultLook();
  return normalizeLook({ skin: a[0], hair: a[1], hairColor: a[2], eyes: a[3], blush: a[4], team: TEAM_KEYS[a[5]], number: a[6], shoes: a[7],
    glove: { type: a[8], color: a[9], size: a[10] }, hat: a[11], ball: a[12], emoji: a[13] });
}
/** 혼자 하기의 친구 — 내 유니폼과 다른 색, 팀 모자 */
export function friendLook(my) {
  const team = PARTNER_OF[my?.team] || 'blue';
  return { ...defaultLook(team), hair: 1, hairColor: 1, eyes: 1, number: 11, glove: { type: 1, color: 0, size: 1 }, hat: TEAM_HAT };
}

/* ======================================================================
   그림 : 공
   ====================================================================== */
export function drawBall(c, x, y, r, rot, id = 0) {
  const B = BALLS[id] || BALLS[0];
  c.save(); c.translate(x, y);
  c.beginPath(); c.arc(0, 0, r, 0, TAU);
  if (B.pattern === 'metal' || B.pattern === 'gold') {
    const g = c.createLinearGradient(-r, -r, r, r);
    g.addColorStop(0, shade(B.body, 0.7)); g.addColorStop(0.45, B.body); g.addColorStop(0.55, shade(B.body, -0.25)); g.addColorStop(1, shade(B.body, 0.35));
    c.fillStyle = g; c.fill();
  } else if (B.pattern === 'fire') {
    const g = c.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.05, 0, 0, r * 1.05);
    g.addColorStop(0, '#fff3a0'); g.addColorStop(0.45, '#ffb02e'); g.addColorStop(1, '#d7261e');
    c.fillStyle = g; c.fill();
  } else if (B.pattern) {
    c.save(); c.clip(); c.rotate(rot * 0.35);
    const n = B.pattern === 'half' ? 2 : B.bands.length;
    for (let i = 0; i < n; i++) { c.fillStyle = B.bands[i]; c.fillRect(-r + (2 * r * i) / n, -r, (2 * r) / n + 0.5 / Math.max(1, r), 2 * r); }
    c.restore();
  } else {
    const g = c.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r * 1.05);
    g.addColorStop(0, shade(B.body, 0.6)); g.addColorStop(0.65, B.body); g.addColorStop(1, shade(B.body, -0.22));
    c.fillStyle = g; c.fill();
  }
  /* 둥근 맛 — 위쪽 하이라이트 */
  c.beginPath(); c.arc(-r * 0.32, -r * 0.36, r * 0.42, 0, TAU);
  c.fillStyle = 'rgba(255,255,255,.28)'; c.fill();
  c.beginPath(); c.arc(0, 0, r, 0, TAU);
  c.lineWidth = r * 0.12; c.strokeStyle = 'rgba(42,34,56,.6)'; c.stroke();
  c.rotate(rot);
  c.beginPath(); c.arc(0, 0, r * 0.97, 0, TAU); c.clip();
  c.strokeStyle = B.stitch; c.lineWidth = r * 0.14; c.lineCap = 'round';
  c.beginPath(); c.arc(-r * 1.32, 0, r * 0.92, -0.85, 0.85); c.stroke();
  c.beginPath(); c.arc(r * 1.32, 0, r * 0.92, Math.PI - 0.85, Math.PI + 0.85); c.stroke();
  c.restore();
}

/* ======================================================================
   그림 : 글러브
   ====================================================================== */
function gloveColors(glove) {
  const G = GLOVE_COLORS[glove?.color | 0] || GLOVE_COLORS[0];
  const light = G.base === '#34313a' ? '#5d5866' : shade(G.base, 0.32);
  const dark = shade(G.base, -0.38);
  const lace = G.base === '#e6dfd0' ? '#b5652b' : shade(G.base, 0.55);
  return { base: G.base, light, dark, lace, pocket: shade(G.base, -0.5) };
}
function leatherFill(c, K) {
  const g = c.createLinearGradient(-0.45, -0.6, 0.45, 0.55);
  g.addColorStop(0, K.light); g.addColorStop(0.5, K.base); g.addColorStop(1, K.dark);
  return g;
}
function fillStroke(c, fill, lw) {
  c.fillStyle = fill; c.fill();
  if (lw) { c.lineWidth = lw; c.strokeStyle = OUT; c.stroke(); }
}
export function rr(c, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}
export function circ(c, x, y, r) { c.beginPath(); c.arc(x, y, Math.max(0.0001, r), 0, TAU); }

/**
 * 글러브 하나. `view` = 'back'(내 캐릭터 — 손등 쪽, 엄지가 오른쪽) | 'front'(친구 — 손바닥 쪽, 엄지가 왼쪽)
 * u = 글러브 폭(그리는 단위), cl = 0(펼침)..1(오므림)
 */
export function drawGlove(c, x, y, u, cl, ball, rot, ow, glove, view, ballId = 0) {
  const type = glove?.type | 0;
  const K = gloveColors(glove);
  const size = (GLOVE_SIZES[glove?.size ?? 1] || GLOVE_SIZES[1]).k;
  c.save(); c.translate(x, y); if (rot) c.rotate(rot); c.scale(u * size, u * size);
  if (view === 'front') c.scale(-1, 1);          // 손바닥 쪽은 좌우가 뒤집힌다 (엄지가 몸 쪽)
  const o = ow / (u * size), L = leatherFill(c, K);
  const front = view === 'front';

  if (type === 2) {
    /* 포수 미트 — 손가락 구분이 없는 둥글고 두툼한 미트 */
    if (ball && !front) drawBall(c, 0.22, -0.4, BALL_R / (u * size), 0.5, ballId);
    c.beginPath(); c.ellipse(0, 0.04, 0.5, 0.5 - cl * 0.06, 0, 0, TAU); fillStroke(c, L, o);
    c.lineWidth = 0.09; c.strokeStyle = K.dark;
    c.beginPath(); c.ellipse(0, 0.04, 0.43, 0.43 - cl * 0.06, 0, Math.PI * 1.05, Math.PI * 1.95); c.stroke();
    c.strokeStyle = K.lace; c.lineWidth = 0.03;
    for (let i = 0; i < 9; i++) { const a = Math.PI * (1.08 + i * 0.105); c.beginPath(); c.moveTo(Math.cos(a) * 0.4, 0.04 + Math.sin(a) * 0.4); c.lineTo(Math.cos(a) * 0.5, 0.04 + Math.sin(a) * 0.5); c.stroke(); }
    if (front) {
      const pg = c.createRadialGradient(0, 0.06, 0.02, 0, 0.08, 0.3);
      pg.addColorStop(0, K.pocket); pg.addColorStop(1, K.base);
      c.beginPath(); c.ellipse(0, 0.08, 0.27, 0.25, 0, 0, TAU); c.fillStyle = pg; c.fill();
      if (ball) drawBall(c, 0, 0.05, BALL_R / (u * size), 0.6, ballId);
      if (cl > 0.3) { c.beginPath(); c.ellipse(0, -0.12, 0.42, 0.22 * cl, 0, Math.PI, 0); fillStroke(c, L, o); }
    } else {
      rr(c, -0.34, 0.16, 0.62, 0.13, 0.06); c.fillStyle = K.dark; c.fill();
      c.beginPath(); c.ellipse(0, 0.47, 0.24, 0.06, 0, 0, TAU); c.fillStyle = '#2a170a'; c.fill();
    }
    c.restore();
    return;
  }

  /* 손가락 길이 · 모양 (종류마다) */
  const longK = type === 1 ? 1.22 : 1;
  const F4 = type === 3
    ? [[-0.22, 0.62, -0.12, 0.3], [0.14, 0.66, 0.08, 0.3]]                       // 1루수 미트 — 둘로 묶인 손가락
    : [[-0.33, 0.4 * longK, -0.24, 0.21], [-0.12, 0.5 * longK, -0.09, 0.21], [0.08, 0.53 * longK, 0.03, 0.21], [0.27, 0.47 * longK, 0.14, 0.21]];

  if (!front && ball) drawBall(c, 0.3, -0.36 * longK, BALL_R / (u * size), 0.5, ballId);
  if (front) {
    /* 엄지-검지 사이 그물 (손바닥 쪽은 잘 보인다) */
    if (cl < 0.8) {
      c.beginPath(); c.moveTo(0.5, -0.14); c.lineTo(0.37, -0.44 * longK); c.lineTo(0.19, -0.36 * longK); c.lineTo(0.19, 0.02); c.closePath();
      fillStroke(c, K.dark, o);
      c.strokeStyle = K.lace; c.lineWidth = 0.028;
      c.beginPath(); c.moveTo(0.44, -0.28); c.lineTo(0.22, -0.2); c.moveTo(0.46, -0.1); c.lineTo(0.22, -0.02); c.moveTo(0.34, -0.4); c.lineTo(0.3, -0.02); c.stroke();
    }
  }
  const fingers = () => {
    for (const [bx, len, ang, w] of F4) {
      /* 앞모습은 통째로 좌우를 뒤집어 그리므로 회전 부호가 같아도 엄지 쪽으로 오므라든다 */
      c.save(); c.translate(bx, front ? -0.05 : 0.02); c.rotate(ang + cl * 0.5);
      const l = len * (1 - cl * (front ? 0.45 : 0.32));
      rr(c, -w / 2, -l, w, l + 0.12, w / 2); fillStroke(c, L, o);
      c.strokeStyle = K.lace; c.lineWidth = 0.028;
      c.beginPath(); c.moveTo(-w * 0.22, -l + 0.075); c.lineTo(w * 0.22, -l + 0.075); c.stroke();
      if (type === 3) { c.beginPath(); c.moveTo(0, -l + 0.12); c.lineTo(0, 0); c.stroke(); }
      c.restore();
    }
  };
  if (!front) {
    fingers();
    if (cl < 0.7 && !ball) {
      c.strokeStyle = K.dark; c.lineWidth = 0.05;
      c.beginPath(); c.moveTo(0.36, -0.36 * longK); c.lineTo(0.55, -0.12); c.moveTo(0.3, -0.2); c.lineTo(0.5, 0); c.stroke();
    }
  }
  /* 엄지 */
  c.save(); c.translate(0.33, 0.28); c.rotate(0.62 - cl * 0.55);
  rr(c, -0.11, -0.47, 0.22, 0.53, 0.11); fillStroke(c, L, o); c.restore();
  /* 손바닥 / 손등 */
  if (front) {
    c.beginPath(); c.ellipse(-0.03, 0.14, 0.42, 0.38, 0, 0, TAU); fillStroke(c, L, o);
    const pg = c.createRadialGradient(0, 0.06, 0.02, 0, 0.08, 0.27);
    pg.addColorStop(0, K.pocket); pg.addColorStop(1, shade(K.base, -0.15));
    c.beginPath(); c.ellipse(0, 0.08, 0.25, 0.23, 0, 0, TAU); c.fillStyle = pg; c.fill();
    if (ball) { c.save(); c.scale(-1, 1); drawBall(c, 0, 0.04, BALL_R / (u * size), 0.6, ballId); c.restore(); }
    fingers();
    rr(c, -0.31, 0.42, 0.58, 0.12, 0.05); fillStroke(c, K.dark, o);
  } else {
    c.beginPath(); c.moveTo(-0.44, -0.03); c.quadraticCurveTo(-0.47, 0.38, -0.2, 0.5); c.lineTo(0.24, 0.5); c.quadraticCurveTo(0.45, 0.4, 0.43, 0.0); c.closePath();
    fillStroke(c, L, o);
    rr(c, -0.37, 0.16, 0.64, 0.13, 0.065); c.fillStyle = K.dark; c.fill();
    c.beginPath(); c.ellipse(-0.05, 0.225, 0.09, 0.046, 0, 0, TAU); c.fillStyle = '#f3d9b5'; c.fill();
    c.beginPath(); c.ellipse(0, 0.47, 0.22, 0.06, 0, 0, TAU); c.fillStyle = '#2a170a'; c.fill();
  }
  c.restore();
}

/* ======================================================================
   그림 : 사람
   ====================================================================== */
function joint(ax, ay, bx, by, L, prefX, prefY, stretch) {
  let dx = bx - ax, dy = by - ay; const d = Math.hypot(dx, dy) || 1e-4;
  const max = 2 * L * 0.999;
  if (d >= max) {
    if (!stretch) { bx = ax + dx / d * max; by = ay + dy / d * max; }
    return { jx: (ax + bx) / 2, jy: (ay + by) / 2, ex: bx, ey: by };
  }
  const h = Math.sqrt(L * L - (d / 2) * (d / 2));
  let px = -dy / d, py = dx / d;
  if (px * prefX + py * prefY < 0) { px = -px; py = -py; }
  return { jx: ax + dx / 2 + px * h, jy: ay + dy / 2 + py * h, ex: bx, ey: by };
}
function drawArm(c, sx, sy, hx, hy, prefX, prefY, sleeve, skin, ow, stretch) {
  const k = joint(sx, sy, hx, hy, 0.235, prefX, prefY, stretch);
  c.lineCap = 'round'; c.lineJoin = 'round';
  c.strokeStyle = OUT; c.lineWidth = 0.11 + ow * 2;
  c.beginPath(); c.moveTo(sx, sy); c.lineTo(k.jx, k.jy); c.lineTo(k.ex, k.ey); c.stroke();
  c.strokeStyle = skin; c.lineWidth = 0.095;
  c.beginPath(); c.moveTo(k.jx, k.jy); c.lineTo(k.ex, k.ey); c.stroke();
  c.strokeStyle = sleeve; c.lineWidth = 0.115;
  c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx + (k.jx - sx) * 0.78, sy + (k.jy - sy) * 0.78); c.stroke();
  circ(c, k.ex, k.ey, 0.058); fillStroke(c, skin, ow);
  return k;
}
function drawLeg(c, hx, hy, fx, fy, side, T, shoe, ow) {
  const k = joint(hx, hy, fx, fy, 0.27, side, -0.2, false);
  c.lineCap = 'round'; c.lineJoin = 'round';
  c.strokeStyle = OUT; c.lineWidth = 0.15 + ow * 2;
  c.beginPath(); c.moveTo(hx, hy); c.lineTo(k.jx, k.jy); c.lineTo(k.ex, k.ey); c.stroke();
  const mx = k.jx + (k.ex - k.jx) * 0.45, my = k.jy + (k.ey - k.jy) * 0.45;
  c.strokeStyle = '#f7f3ea'; c.lineWidth = 0.15;
  c.beginPath(); c.moveTo(hx, hy); c.lineTo(k.jx, k.jy); c.lineTo(mx, my); c.stroke();
  c.strokeStyle = T.dark; c.lineWidth = 0.12;
  c.beginPath(); c.moveTo(mx, my); c.lineTo(k.ex, k.ey); c.stroke();
  c.beginPath(); c.ellipse(k.ex + side * 0.015, k.ey + 0.03, 0.09, 0.05, 0, 0, TAU); fillStroke(c, shoe, ow);
}
export function basePose() {
  return { fL: { x: -0.11, y: 0, f: 0 }, fR: { x: 0.11, y: 0, f: 0 }, rh: { x: -0.27, y: 0.58 }, gh: { x: 0.2, y: 0.7 },
    gloveClosed: 0, gloveRot: 0, rot: 0, lift: 0, crouch: 0, offX: 0, turn: 0, face: 'smile', ballHand: false, ballGlove: false };
}

/** 모자 (앞 · 뒤). 반환값 없음 — 머리 중심 hy 기준 */
function drawCap(c, hy, hatId, look, ow, view, t, big) {
  const H = hatId === TEAM_HAT ? null : (HATS[hatId] || HATS[0]);
  const T = TEAMS[look.team] || TEAMS.red;
  const main = H ? (H.main || H.bands?.[0] || '#999') : T.cap;
  const brim = H ? H.brim : T.dark;
  const btn = H ? H.btn : T.dark;
  const domeY = hy - (view === 'front' ? 0.045 : 0.04);
  const dome = () => { c.beginPath(); c.ellipse(0, domeY, 0.265, 0.235, 0, Math.PI, 0); c.closePath(); };
  dome(); fillStroke(c, main, ow);
  if (H && H.pattern) {
    c.save(); dome(); c.clip();
    const top = domeY - 0.24, h = 0.25;
    if (H.pattern === 'pastel') {
      c.fillStyle = 'rgba(255,255,255,.75)';
      for (const [dx, dy] of [[-0.15, -0.1], [0.02, -0.18], [0.16, -0.08], [-0.05, -0.05], [0.1, -0.2], [-0.2, -0.03]]) { circ(c, dx, domeY + dy, 0.022); c.fill(); }
    } else if (H.pattern === 'two') {
      c.fillStyle = H.alt; c.fillRect(0, top, 0.3, h + 0.01);
    } else if (H.pattern === 'bands') {
      const n = H.bands.length, w = 0.53 / n;
      for (let i = 0; i < n; i++) { c.fillStyle = H.bands[i]; c.fillRect(-0.265 + i * w, top, w + 0.002, h + 0.01); }
    } else if (H.pattern === 'metal' || H.pattern === 'gold') {
      const g = c.createLinearGradient(-0.26, top, 0.26, domeY);
      g.addColorStop(0, shade(H.main, 0.6)); g.addColorStop(0.4, H.main); g.addColorStop(0.55, shade(H.main, -0.25)); g.addColorStop(1, shade(H.main, 0.4));
      c.fillStyle = g; c.fillRect(-0.27, top, 0.54, h + 0.01);
    } else if (H.pattern === 'fire') {
      const cols = ['#d7261e', '#ff7a1a', '#ffd23a'];
      for (let i = 0; i < 3; i++) {
        c.fillStyle = cols[i]; c.beginPath(); c.moveTo(-0.27, domeY);
        for (let x = -0.27; x <= 0.27; x += 0.06) {
          const hh = (0.16 - i * 0.045) * (0.7 + 0.3 * Math.sin(x * 40 + t * 6 + i));
          c.quadraticCurveTo(x + 0.03, domeY - hh * 1.6, x + 0.06, domeY - hh * 0.35);
        }
        c.lineTo(0.27, domeY); c.closePath(); c.fill();
      }
    } else if (H.pattern === 'legend') {
      const g = c.createLinearGradient(0, top, 0, domeY);
      g.addColorStop(0, shade(H.main, 0.25)); g.addColorStop(1, shade(H.main, -0.2));
      c.fillStyle = g; c.fillRect(-0.27, top, 0.54, h + 0.01);
      c.fillStyle = '#f2c94c'; c.fillRect(-0.27, domeY - 0.05, 0.54, 0.035);
      for (const [dx, col] of [[-0.12, '#ff4d6d'], [0, '#3fd0f5'], [0.12, '#7cff6b']]) { c.fillStyle = col; circ(c, dx, domeY - 0.033, 0.016); c.fill(); }
    }
    c.restore();
    dome(); c.lineWidth = ow; c.strokeStyle = OUT; c.stroke();
  }
  c.strokeStyle = 'rgba(0,0,0,.14)'; c.lineWidth = 0.012;
  if (view === 'front') {
    c.beginPath(); c.moveTo(0, hy - 0.27); c.lineTo(0, hy - 0.06); c.stroke();
    if (big) { c.fillStyle = '#fffaf0'; circ(c, 0, hy - 0.15, 0.062); c.fill(); drawBall(c, 0, hy - 0.15, 0.046, 0.2, look.ball | 0); }
    c.beginPath(); c.ellipse(0, hy - 0.04, 0.25, 0.066, 0, 0, Math.PI); c.closePath(); fillStroke(c, brim, ow);
  } else {
    c.beginPath(); c.moveTo(0, hy - 0.27); c.lineTo(0, hy - 0.11); c.stroke();
  }
  circ(c, 0, hy - 0.283, 0.026); fillStroke(c, btn, ow);
  if (H && H.crown) {
    /* 전설 — 꼭대기에 작은 왕관 */
    c.beginPath();
    c.moveTo(-0.1, hy - 0.26); c.lineTo(-0.1, hy - 0.36); c.lineTo(-0.05, hy - 0.31); c.lineTo(0, hy - 0.39);
    c.lineTo(0.05, hy - 0.31); c.lineTo(0.1, hy - 0.36); c.lineTo(0.1, hy - 0.26); c.closePath();
    fillStroke(c, '#f2c94c', ow);
    c.fillStyle = '#ff4d6d'; circ(c, 0, hy - 0.3, 0.015); c.fill();
  }
  if (H && H.sparkle) {
    for (let i = 0; i < 3; i++) {
      const ph = (t * 1.6 + i * 0.37) % 1;
      const a = Math.sin(ph * Math.PI);
      if (a < 0.2) continue;
      const sx = [-0.16, 0.12, 0.02][i], sy = hy - [0.18, 0.12, 0.25][i], r = 0.035 * a;
      c.fillStyle = `rgba(255,255,255,${a.toFixed(2)})`;
      c.beginPath(); c.moveTo(sx, sy - r); c.lineTo(sx + r * 0.3, sy - r * 0.3); c.lineTo(sx + r, sy); c.lineTo(sx + r * 0.3, sy + r * 0.3);
      c.lineTo(sx, sy + r); c.lineTo(sx - r * 0.3, sy + r * 0.3); c.lineTo(sx - r, sy); c.lineTo(sx - r * 0.3, sy - r * 0.3); c.closePath(); c.fill();
    }
  }
  if (view === 'back') {
    /* 모자 뒤 트임 · 끈 */
    const hair = (HAIR_COLORS[look.hairColor] || HAIR_COLORS[0]).c;
    c.beginPath(); c.ellipse(0, hy - 0.04, 0.075, 0.062, 0, Math.PI, 0); c.closePath(); c.fillStyle = hair; c.fill();
    rr(c, -0.09, hy - 0.058, 0.18, 0.03, 0.012); c.fillStyle = shade(brim, -0.1); c.fill();
  }
}

/** 머리카락 — 모자 밖으로 보이는 부분 */
function drawHair(c, hy, look, view, phase, ow) {
  const col = (HAIR_COLORS[look.hairColor] || HAIR_COLORS[0]).c;
  const style = look.hair | 0;
  c.fillStyle = col;
  if (phase === 'behind') {
    /* 머리 뒤로 드리워지는 것 (머리보다 먼저 그린다) */
    if (style === 2) {
      if (view === 'front') { c.beginPath(); c.ellipse(0.2, hy + 0.12, 0.06, 0.16, -0.3, 0, TAU); fillStroke(c, col, ow); }
    }
    if (style === 3) {
      for (const sx of [-1, 1]) {
        c.beginPath(); c.ellipse(sx * 0.29, hy + 0.12, 0.065, 0.15, sx * 0.25, 0, TAU); fillStroke(c, col, ow);
        c.fillStyle = (TEAMS[look.team] || TEAMS.red).jersey; circ(c, sx * 0.27, hy + 0.0, 0.025); c.fill(); c.fillStyle = col;
      }
    }
    return;
  }
  if (view === 'front') {
    if (style === 1) {
      for (const [x, y, r] of [[-0.22, -0.04, 0.075], [0.22, -0.04, 0.075], [-0.24, 0.04, 0.05], [0.24, 0.04, 0.05]]) { circ(c, x, hy + y, r); c.fill(); }
    } else if (style === 4) {
      for (const sx of [-1, 1]) {
        c.beginPath(); c.moveTo(sx * 0.2, hy - 0.1); c.lineTo(sx * 0.32, hy - 0.06); c.lineTo(sx * 0.23, hy - 0.02); c.lineTo(sx * 0.33, hy + 0.04); c.lineTo(sx * 0.22, hy + 0.05); c.closePath(); c.fill();
      }
    } else {
      c.beginPath(); c.ellipse(-0.205, hy - 0.05, 0.06, 0.1, 0.35, 0, TAU); c.fill();
      c.beginPath(); c.ellipse(0.205, hy - 0.05, 0.06, 0.1, -0.35, 0, TAU); c.fill();
    }
    return;
  }
  /* 뒤에서 본 머리 */
  circ(c, 0, hy, 0.25); fillStroke(c, col, ow);
  if (style === 1) for (const x of [-0.16, -0.05, 0.06, 0.17]) { circ(c, x, hy + 0.2, 0.06); c.fillStyle = col; c.fill(); }
  if (style === 2) {
    c.beginPath(); c.moveTo(-0.05, hy - 0.02); c.quadraticCurveTo(0.08, hy + 0.2, 0.02, hy + 0.42); c.quadraticCurveTo(-0.08, hy + 0.2, -0.05, hy - 0.02);
    fillStroke(c, col, ow);
    c.fillStyle = (TEAMS[look.team] || TEAMS.red).jersey; circ(c, -0.02, hy + 0.02, 0.028); c.fill();
  }
  if (style === 3) for (const sx of [-1, 1]) { c.beginPath(); c.ellipse(sx * 0.27, hy + 0.13, 0.065, 0.15, sx * 0.25, 0, TAU); fillStroke(c, col, ow); }
  if (style === 4) {
    c.fillStyle = col;
    for (let i = -3; i <= 3; i++) { const x = i * 0.07; c.beginPath(); c.moveTo(x - 0.04, hy + 0.17); c.lineTo(x, hy + 0.27); c.lineTo(x + 0.04, hy + 0.17); c.closePath(); c.fill(); }
  }
}
function drawFace(c, hy, look, face, blink) {
  const ey = hy + 0.075;
  const eyes = look.eyes | 0;
  for (const sx of [-1, 1]) {
    const ex = sx * 0.09;
    c.strokeStyle = '#2a1d1a'; c.fillStyle = '#2a1d1a'; c.lineCap = 'round';
    if (face === 'grin' || (eyes === 1 && face !== 'oops' && face !== 'o')) {
      c.lineWidth = 0.024; c.beginPath(); c.arc(ex, ey + 0.015, 0.036, Math.PI * 1.12, Math.PI * 1.88); c.stroke();
    } else if (blink) {
      c.lineWidth = 0.022; c.beginPath(); c.moveTo(ex - 0.03, ey); c.lineTo(ex + 0.03, ey); c.stroke();
    } else if (eyes === 3 && face !== 'o' && face !== 'oops') {
      /* 졸린 눈 — 윗눈꺼풀이 반쯤 */
      c.beginPath(); c.ellipse(ex, ey + 0.012, 0.034, 0.03, 0, 0, Math.PI); c.fill();
      c.lineWidth = 0.02; c.beginPath(); c.moveTo(ex - 0.04, ey + 0.008); c.lineTo(ex + 0.04, ey + 0.008); c.stroke();
    } else {
      const big = eyes === 2 ? 1.18 : 1;
      c.beginPath(); c.ellipse(ex, ey, 0.034 * big, (face === 'oops' ? 0.028 : 0.048) * big, 0, 0, TAU); c.fill();
      c.fillStyle = '#ffffff'; circ(c, ex + 0.011, ey - 0.017, 0.012 * big); c.fill();
      if (eyes === 2) { circ(c, ex - 0.012, ey + 0.016, 0.007); c.fill(); }
    }
  }
  if (look.blush !== 0) {
    c.fillStyle = 'rgba(255,110,110,.42)';
    circ(c, -0.16, hy + 0.135, 0.042); c.fill(); circ(c, 0.16, hy + 0.135, 0.042); c.fill();
  }
  c.strokeStyle = '#7a2a22'; c.fillStyle = '#7a2a22'; c.lineWidth = 0.02; c.lineCap = 'round';
  if (face === 'o' || face === 'oops') { c.beginPath(); c.ellipse(0, hy + 0.158, 0.03, 0.035, 0, 0, TAU); c.fill(); }
  else if (face === 'grin') { c.beginPath(); c.arc(0, hy + 0.128, 0.058, 0.12, Math.PI - 0.12); c.closePath(); c.fill(); }
  else if (face === 'focus') { c.beginPath(); c.moveTo(-0.035, hy + 0.158); c.lineTo(0.035, hy + 0.158); c.stroke(); }
  else { c.beginPath(); c.arc(0, hy + 0.12, 0.048, 0.25, Math.PI - 0.25); c.stroke(); }
}

/**
 * 앞에서 본 아이 (친구 · 타이틀 · 꾸미기 미리보기). 반환값 = 글러브 중심의 **CSS 픽셀** 좌표.
 * @param {number} dpr 캔버스에 걸린 기본 배율 (반환 좌표를 CSS 픽셀로 바꾸는 데만 쓴다)
 */
export function drawKidFront(c, fx, fy, S, look, p, t, dpr = 1, opt = {}) {
  look = look || defaultLook();
  const T = TEAMS[look.team] || TEAMS.red;
  const skin = (SKINS[look.skin] || SKINS[1]).base, skinD = shade(skin, -0.12);
  const shoe = (SHOES[look.shoes] || SHOES[0]).c;
  const ow = Math.max(1, S * 0.018) / S;
  const turn = p.turn || 0, tw = 1 - 0.36 * turn;
  c.save(); c.translate(fx, fy); c.scale(S, S);
  c.fillStyle = 'rgba(16,48,20,.26)';
  c.beginPath(); c.ellipse(p.offX, 0, 0.34 * (1 - Math.min(0.5, p.lift * 0.6)), 0.075, 0, 0, TAU); c.fill();
  c.translate(p.offX, -p.lift);
  if (p.rot) { c.translate(0, -0.45); c.rotate(p.rot); c.translate(0, 0.45); }
  const cr = p.crouch;
  const hipY = -(0.56 - cr * 0.17), shY = hipY - 0.4, hy = shY - 0.215;
  const fy0 = (f) => -(f.y || 0) + (f.f || 0) * 0.3 - 0.035;
  drawLeg(c, -0.085, hipY, p.fL.x, fy0(p.fL), -1, T, shoe, ow);
  drawLeg(c, 0.085, hipY, p.fR.x, fy0(p.fR), 1, T, shoe, ow);
  rr(c, -0.185 * tw, hipY - 0.07, 0.37 * tw, 0.15, 0.06); fillStroke(c, '#f7f3ea', ow);
  rr(c, -0.205 * tw, shY, 0.41 * tw, hipY - shY + 0.01, 0.1); fillStroke(c, T.jersey, ow);
  c.beginPath(); c.moveTo(-0.065 * tw, shY + 0.005); c.lineTo(0, shY + 0.085); c.lineTo(0.065 * tw, shY + 0.005); c.closePath(); c.fillStyle = T.dark; c.fill();
  c.strokeStyle = 'rgba(0,0,0,.16)'; c.lineWidth = 0.014;
  c.beginPath(); c.moveTo(0, shY + 0.09); c.lineTo(0, hipY - 0.03); c.stroke();
  if (opt.big) drawBall(c, -0.105 * tw, shY + 0.14, 0.042, 0.5, look.ball | 0);
  c.fillStyle = '#20263a'; c.fillRect(-0.185 * tw, hipY - 0.03, 0.37 * tw, 0.04);
  /* 머리 */
  drawHair(c, hy, look, 'front', 'behind', ow);
  c.fillStyle = skinD; c.fillRect(-0.06, hy + 0.17, 0.12, 0.08);
  for (const sx of [-1, 1]) { circ(c, sx * 0.245, hy + 0.03, 0.055); fillStroke(c, skin, ow); }
  circ(c, 0, hy, 0.25); fillStroke(c, skin, ow);
  drawHair(c, hy, look, 'front', 'front', ow);
  drawFace(c, hy, look, p.face, (t % 3.4) < 0.12);
  drawCap(c, hy, look.hat, look, ow, 'front', t, opt.big);
  /* 팔 : 화면 왼쪽 = 던지는 손, 화면 오른쪽 = 글러브 손 */
  const shX = 0.2 * tw;
  const R = drawArm(c, -shX, shY + 0.07, p.rh.x, -p.rh.y, -1, 0.5, T.jersey, skin, ow, false);
  if (p.ballHand) drawBall(c, R.ex, R.ey - 0.015, BALL_R, t * 3, look.ball | 0);
  const G2 = drawArm(c, shX, shY + 0.07, p.gh.x, -p.gh.y, 1, 0.5, T.jersey, skin, ow, false);
  const gcx = G2.ex + 0.035, gcy = G2.ey - 0.09;
  drawGlove(c, gcx, gcy, 0.36, p.gloveClosed, p.ballGlove, p.gloveRot, ow, look.glove, 'front', look.ball | 0);
  const m = c.getTransform();
  const pt = m.transformPoint(new DOMPoint(gcx, gcy));
  c.restore();
  return { x: pt.x / dpr, y: pt.y / dpr };
}

/** 뒤에서 본 아이 (내 캐릭터). glove = 화면 좌표의 글러브 {x,y,u,rot,closed,ball} */
export function drawKidBack(c, fx, fy, S, look, p, glove, t) {
  look = look || defaultLook();
  const T = TEAMS[look.team] || TEAMS.red;
  const skin = (SKINS[look.skin] || SKINS[1]).base;
  const shoe = (SHOES[look.shoes] || SHOES[0]).c;
  const ow = Math.max(1.1, S * 0.018) / S;
  const turn = p.turn || 0, tw = 1 - 0.36 * Math.max(0, turn);
  c.save(); c.translate(fx, fy); c.scale(S, S);
  c.fillStyle = 'rgba(16,48,20,.28)';
  c.beginPath(); c.ellipse(0, 0, 0.36 * (1 - Math.min(0.55, p.lift * 0.6)), 0.09, 0, 0, TAU); c.fill();
  c.translate(0, -p.lift);
  const cr = p.crouch;
  const hipY = -(0.56 - cr * 0.2), shY = hipY - 0.4, hy = shY - 0.215;
  /* 앞으로 내딛은 발은 화면 위쪽(멀리)에 놓인다 */
  const fy0 = (f) => -(f.y || 0) - (f.f || 0) * 0.32 - 0.035;
  drawLeg(c, -0.085, hipY, p.fL.x, fy0(p.fL), -1, T, shoe, ow);
  drawLeg(c, 0.085, hipY, p.fR.x, fy0(p.fR), 1, T, shoe, ow);
  rr(c, -0.185 * tw, hipY - 0.07, 0.37 * tw, 0.16, 0.06); fillStroke(c, '#f7f3ea', ow);
  c.strokeStyle = 'rgba(0,0,0,.12)'; c.lineWidth = 0.012;
  rr(c, -0.15 * tw, hipY + 0.005, 0.1 * tw, 0.06, 0.02); c.stroke(); rr(c, 0.05 * tw, hipY + 0.005, 0.1 * tw, 0.06, 0.02); c.stroke();
  rr(c, -0.205 * tw, shY, 0.41 * tw, hipY - shY + 0.01, 0.1); fillStroke(c, T.jersey, ow);
  c.fillStyle = '#20263a'; c.fillRect(-0.185 * tw, hipY - 0.03, 0.37 * tw, 0.04);
  /* 등번호 */
  c.save(); c.scale(1 / S, 1 / S); c.scale(tw, 1);
  c.font = `${0.24 * S}px "Black Han Sans","Jua",sans-serif`;
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.lineJoin = 'round'; c.lineWidth = Math.max(1.5, 0.035 * S); c.strokeStyle = T.dark;
  const num = String(look.number ?? 7);
  c.strokeText(num, 0, (shY + 0.2) * S); c.fillStyle = T.num; c.fillText(num, 0, (shY + 0.2) * S);
  c.restore();
  /* 목 · 귀 · 머리 · 모자 */
  rr(c, -0.07, hy + 0.14, 0.14, 0.12, 0.03); c.fillStyle = skin; c.fill();
  c.beginPath(); c.moveTo(-0.09 * tw, shY + 0.01); c.quadraticCurveTo(0, shY + 0.07, 0.09 * tw, shY + 0.01); c.strokeStyle = T.dark; c.lineWidth = 0.03; c.stroke();
  for (const sx of [-1, 1]) { circ(c, sx * 0.24, hy + 0.03, 0.05); fillStroke(c, skin, ow); }
  drawHair(c, hy, look, 'back', 'front', ow);
  drawCap(c, hy, look.hat, look, ow, 'back', t, false);
  /* 오른팔 (던지는 팔) — 팔꿈치는 바깥 · 아래로 접힌다 (L자) */
  const shX = 0.2 * tw;
  const R = drawArm(c, shX, shY + 0.07, p.rh.x, -p.rh.y, 1, 0.5, T.jersey, skin, ow, false);
  if (p.ballHand) drawBall(c, R.ex, R.ey - 0.02, BALL_R, t * 3, look.ball | 0);
  /* 왼팔 → 글러브 */
  const gx = (glove.x - fx) / S, gy = (glove.y - fy) / S + p.lift;
  const wr = Math.sin(glove.rot), wc = Math.cos(glove.rot);
  drawArm(c, -shX, shY + 0.07, gx - wr * 0.15, gy + wc * 0.15, -1, 0.4, T.jersey, skin, ow, true);
  drawGlove(c, gx, gy, glove.u / S, glove.closed, glove.ball, glove.rot, ow, look.glove, 'back', look.ball | 0);
  c.restore();
}

/* ======================================================================
   작은 그림 (꾸미기 칸 · 순위표)
   ====================================================================== */
function iconCanvas(px, dpr) {
  const cv = document.createElement('canvas');
  cv.width = Math.round(px * dpr); cv.height = Math.round(px * dpr);
  cv.style.width = px + 'px'; cv.style.height = px + 'px';
  const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
  return [cv, c];
}
const DPR = () => Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
export function gloveIcon(glove, px = 36) {
  const [cv, c] = iconCanvas(px, DPR());
  drawGlove(c, px / 2, px * 0.55, px * 0.62, 0, false, 0, Math.max(0.8, px / 40), glove, 'front');
  return cv;
}
export function ballIcon(id, px = 32) {
  const [cv, c] = iconCanvas(px, DPR());
  drawBall(c, px / 2, px / 2, px * 0.38, 0.5, id);
  return cv;
}
/** 얼굴 + 모자 (순위표 · 꾸미기) */
export function headIcon(look, px = 40, hatOverride) {
  look = normalizeLook(look);
  if (hatOverride !== undefined) look = { ...look, hat: hatOverride };
  const [cv, c] = iconCanvas(px, DPR());
  const S = px * 1.55;
  c.save(); c.translate(px / 2, px * 0.62); c.scale(S, S);
  const skin = (SKINS[look.skin] || SKINS[1]).base;
  const ow = Math.max(0.8, S * 0.018) / S;
  drawHair(c, 0, look, 'front', 'behind', ow);
  for (const sx of [-1, 1]) { circ(c, sx * 0.245, 0.03, 0.055); fillStroke(c, skin, ow); }
  circ(c, 0, 0, 0.25); fillStroke(c, skin, ow);
  drawHair(c, 0, look, 'front', 'front', ow);
  drawFace(c, 0, look, 'smile', false);
  drawCap(c, 0, look.hat, look, ow, 'front', 0.3, true);
  c.restore();
  return cv;
}
export function hatIcon(id, look, px = 44) { return headIcon(look || defaultLook(), px, id); }
