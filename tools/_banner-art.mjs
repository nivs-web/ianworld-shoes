/**
 * «줄넘기 챔피언» 배너 · 로고 전용 도트 그림 (2026-11-07, 픽셀 아티스트) — build-jumprope-banner.mjs 가 브라우저 안에서 부른다.
 *
 * 권반장 지적(배너 다시): 제목은 드래곤 스트라이커처럼 아주 굵은 고딕 블록 글자 · 영어는 캐치볼처럼 굵은 빨강 ·
 * 캐릭터는 캐치볼 선수만큼 귀엽고 자세하게, 신나게 높이 뛰는 순간 · 동전은 진짜 동전(타원 · 옆면 · 무늬 · 더미 깊이).
 *
 * 규칙: 264x112 도트 버퍼에 정수 칸으로만 찍고 3배 nearest 로 키운다. 글꼴은 «가면»으로만 쓴다 —
 * 제 크기로 찍은 뒤 반투명 칸은 버려(문턱 128) 또렷한 도트만 남긴다. 반투명 · 그라데이션 · 안티앨리어싱 없음.
 */
import { rect, px, oval, rbox, line, tone, sprite } from '../src/games/jumprope/art.js';

export const W = 264, H = 112;
export const OUT = '#14082a';                 // 다른 배너처럼 남보라 외곽선
const ro = Math.round;
let seed = 11;
const R = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
export function reseed(s) { seed = s; }

/* =====================================================================
 * 글자 — 가면 만들기 · 입체 제목
 * ===================================================================== */
/** 글꼴로 찍어 문턱 128 로 도트 가면을 만든다. gap = 글자 사이 칸(음수면 붙인다) */
export function mask(text, font, size, weight = 900, gap = 0, thin = 0) {
  const c = document.createElement('canvas');
  c.width = Math.ceil(size * text.length * 1.2) + 16; c.height = Math.ceil(size * 1.6) + 8;
  const x = c.getContext('2d');
  x.font = `${weight} ${size}px '${font}'`; x.textBaseline = 'top'; x.fillStyle = '#fff';
  let cx = 4;
  for (const ch of text) { x.fillText(ch, cx, 4); cx += Math.round(x.measureText(ch).width) + gap; }
  const d = x.getImageData(0, 0, c.width, c.height).data;
  const CW = c.width, CH = c.height;
  let bm = new Uint8Array(CW * CH);
  for (let k = 0; k < CW * CH; k++) bm[k] = d[k * 4 + 3] >= 128 ? 1 : 0;
  /* 획 깎기: 오른쪽이나 아래가 빈 칸인 가장자리 칸을 thin 번 지운다 → 획이 1칸 가늘어지고 획 사이 틈이 1칸 넓어진다(모양은 그대로) */
  for (let t = 0; t < thin; t++) {
    const nb = bm.slice();
    for (let j = 1; j < CH - 1; j++) for (let i = 1; i < CW - 1; i++) {
      const k = j * CW + i;
      if (!bm[k]) continue;
      const r = bm[k + 1], b = bm[k + CW], l = bm[k - 1], u = bm[k - CW];
      if ((!r || !b) && (l || u) && (r || b || l)) nb[k] = 0;   // 외톨이 칸(가는 꼬리)은 남긴다
    }
    bm = nb;
  }
  const on = (i, j) => bm[j * CW + i] === 1;
  let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
  for (let j = 0; j < c.height; j++) for (let i = 0; i < c.width; i++) if (on(i, j)) { x0 = Math.min(x0, i); y0 = Math.min(y0, j); x1 = Math.max(x1, i); y1 = Math.max(y1, j); }
  const w = x1 - x0 + 1, h = y1 - y0 + 1, m = new Uint8Array(w * h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) m[j * w + i] = on(x0 + i, y0 + j) ? 1 : 0;
  return { w, h, m };
}

/* 굵은 도트 영문 — 10줄 · 획 2칸 (캐치볼 «CATCH BALL» 같은 뭉툭한 아케이드 글자). 글꼴을 찍으면 이 크기에선 획이 뭉개져서 직접 그렸다 */
const FONT_B = {
  A: ['.#####.', '#######', '##...##', '##...##', '##...##', '#######', '#######', '##...##', '##...##', '##...##'],
  C: ['.######', '#######', '##.....', '##.....', '##.....', '##.....', '##.....', '##.....', '#######', '.######'],
  E: ['#######', '#######', '##.....', '##.....', '######.', '######.', '##.....', '##.....', '#######', '#######'],
  H: ['##...##', '##...##', '##...##', '##...##', '#######', '#######', '##...##', '##...##', '##...##', '##...##'],
  I: ['######', '######', '..##..', '..##..', '..##..', '..##..', '..##..', '..##..', '######', '######'],
  J: ['..#####', '..#####', '.....##', '.....##', '.....##', '.....##', '##...##', '##...##', '#######', '.#####.'],
  M: ['##.....##', '###...###', '####.####', '##.###.##', '##..#..##', '##.....##', '##.....##', '##.....##', '##.....##', '##.....##'],
  N: ['##...##', '###..##', '####.##', '#######', '##.####', '##..###', '##...##', '##...##', '##...##', '##...##'],
  O: ['.#####.', '#######', '##...##', '##...##', '##...##', '##...##', '##...##', '##...##', '#######', '.#####.'],
  P: ['######.', '#######', '##...##', '##...##', '#######', '######.', '##.....', '##.....', '##.....', '##.....'],
  R: ['######.', '#######', '##...##', '##...##', '#######', '######.', '##.###.', '##..###', '##...##', '##...##'],
  U: ['##...##', '##...##', '##...##', '##...##', '##...##', '##...##', '##...##', '##...##', '#######', '.#####.'],
  /* 좀비와 드래곤 (2026-11-10) 에서 더한 글자 — 같은 규칙: 10줄 · 획 2칸 · 모서리 1칸 깎기 */
  B: ['######.', '#######', '##...##', '##...##', '######.', '######.', '##...##', '##...##', '#######', '######.'],
  D: ['######.', '#######', '##...##', '##...##', '##...##', '##...##', '##...##', '##...##', '#######', '######.'],
  G: ['.######', '#######', '##.....', '##.....', '##.####', '##.####', '##...##', '##...##', '#######', '.######'],
  Z: ['.######', '#######', '....###', '...###.', '..###..', '..###..', '.###...', '###....', '#######', '######.'],
  '&': ['..####..', '.######.', '.##..##.', '.######.', '..####..', '.######.', '###..###', '##....##', '#######.', '.#####.#'],
  ' ': ['...', '...', '...', '...', '...', '...', '...', '...', '...', '...'],
};
/** 도트 영문 가면 (gap = 글자 사이 칸) */
export function pixelMask(text, gap = 1) {
  const gl = [...text].map((ch) => FONT_B[ch] || FONT_B[' ']);
  const w = gl.reduce((a, g) => a + g[0].length, 0) + gap * (gl.length - 1), h = 10, m = new Uint8Array(w * h);
  let x = 0;
  for (const g of gl) { for (let j = 0; j < h; j++) for (let i = 0; i < g[j].length; i++) if (g[j][i] === '#') m[j * w + x + i] = 1; x += g[0].length + gap; }
  return { w, h, m };
}

/**
 * 굵은 입체 글자 — 바깥 빛(디더링) → 테두리(안쪽부터 edges 순서) → 아래로 밀린 두께(depth) → 면(위아래 색 띠) → 윗면 · 왼쪽 빛.
 * 두께는 글자 «바깥 아래»에만 — 획 사이 틈(예: 챔의 ㅊ·ㅐ 사이)은 두께로 메우지 않고 테두리 색으로 남겨 글자가 뭉개지지 않게.
 */
export function title(ctx, M, x0, y0, o) {
  const { w, h, m } = M;
  const { bands, depth = 3, side = '#5a1a00', edges = [[OUT, 2]], glow = '#6a3cc8', flat = false } = o;
  const colAt = (ec, i, j) => (typeof ec === 'function' ? ec(x0 + i - pad, y0 + j - pad) : ec);
  const pad = depth + 8, PW = w + pad * 2, PH = h + pad * 2;
  const G = new Uint8Array(PW * PH);                       // 0 빈칸 · 1 면 · 2 두께
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (m[j * w + i]) G[(j + pad) * PW + i + pad] = 1;
  /* 두께: 면 아래로 depth 칸. 단, 그 칸이 «위아래가 다 막힌 틈»이면 칠하지 않는다 */
  const face = (i, j) => i >= 0 && j >= 0 && i < PW && j < PH && G[j * PW + i] === 1;
  for (let j = 0; j < PH; j++) for (let i = 0; i < PW; i++) {
    if (G[j * PW + i]) continue;
    let up = 0; for (let k = 1; k <= depth; k++) if (face(i, j - k)) { up = k; break; }
    if (!up) continue;
    let below = false; for (let k = 1; k <= depth + 1; k++) if (face(i, j + k)) { below = true; break; }
    if (below) continue;                                   // 획 사이 틈 — 비워 둔다(테두리가 칠한다)
    G[j * PW + i] = 2 + up;                                // 2.. = 두께(몇 칸째)
  }
  const solid = (i, j) => i >= 0 && j >= 0 && i < PW && j < PH && G[j * PW + i] > 0;
  const near = (i, j, r) => { const rr = (r + 0.5) * (r + 0.5); for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (dx * dx + dy * dy <= rr && solid(i + dx, j + dy)) return true; return false; };
  const maxR = edges[edges.length - 1][1];
  /* 바깥 = 판 가장자리에서 빈 칸으로 이어지는 곳 (속 구멍은 바깥이 아니다) */
  const outside = new Uint8Array(PW * PH), Q = [];
  for (let i = 0; i < PW; i++) { Q.push(i, (PH - 1) * PW + i); }
  for (let j = 0; j < PH; j++) { Q.push(j * PW, j * PW + PW - 1); }
  for (const k of Q) outside[k] = 1;
  while (Q.length) {
    const k = Q.pop(), i = k % PW, j = (k - i) / PW;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ii = i + di, jj = j + dj;
      if (ii < 0 || jj < 0 || ii >= PW || jj >= PH) continue;
      const kk = jj * PW + ii;
      if (outside[kk] || G[kk]) continue;
      outside[kk] = 1; Q.push(kk);
    }
  }
  for (let j = 0; j < PH; j++) for (let i = 0; i < PW; i++) {
    if (solid(i, j)) continue;
    let col = null;
    for (const [ec, r] of edges) if (near(i, j, r)) { col = colAt(outside[j * PW + i] ? ec : edges[0][0], i, j); break; }
    if (col) px(ctx, x0 + i - pad, y0 + j - pad, col);
    else if (glow && near(i, j, maxR + 1) && (i + j) % 2 === 0) px(ctx, x0 + i - pad, y0 + j - pad, glow);
  }
  for (let j = 0; j < PH; j++) for (let i = 0; i < PW; i++) {
    const g = G[j * PW + i];
    if (g < 2) continue;
    const k = g - 2;                                       // 1 = 면 바로 밑
    px(ctx, x0 + i - pad, y0 + j - pad, k === 1 ? tone(side, 0.25) : k >= depth ? tone(side, -0.25) : side);
  }
  for (let j = 0; j < h; j++) {
    const col = bands[Math.min(bands.length - 1, Math.floor((j / h) * bands.length))];
    for (let i = 0; i < w; i++) {
      if (!m[j * w + i]) continue;
      const top = !(j > 0 && m[(j - 1) * w + i]), left = !(i > 0 && m[j * w + i - 1]);
      const bot = !(j < h - 1 && m[(j + 1) * w + i]);
      px(ctx, x0 + i, y0 + j, flat ? col : top ? tone(col, 0.55) : left ? tone(col, 0.3) : bot ? tone(col, -0.12) : col);
    }
  }
  return { w: w, h: h + depth };
}

/* =====================================================================
 * 우주 배경 · 은하 · 반짝이 · 테두리 (4개 배너와 같은 틀)
 * ===================================================================== */
const STAR4 = ['....y....', '....y....', '....w....', '...www...', 'yywwwwwyy', '...www...', '....w....', '....y....', '....y....'];
const STAR4S = ['..y..', '..w..', 'ywwwy', '..w..', '..y..'];
const SPARK = ['.w.', 'www', '.w.'];
export function sparkle(c, x, y, big = false, tint = '#ffe66b') {
  if (big) sprite(c, ro(x) - 4, ro(y) - 4, STAR4, { y: tint, w: '#ffffff' });
  else sprite(c, ro(x) - 2, ro(y) - 2, STAR4S, { y: tint, w: '#ffffff' });
}
export function space(c) {
  const bands = ['#070522', '#0b0830', '#100c3c', '#161048', '#1c1454', '#22185e'];
  for (let i = 0; i < bands.length; i++) rect(c, 0, ro((i * H) / bands.length), W, Math.ceil(H / bands.length) + 1, bands[i]);
  /* 성운 — 보라 · 분홍 구름을 듬성듬성(바둑판) 찍는다 */
  for (const [nx, ny, rx, ry, col] of [[60, 30, 50, 16, '#2c1a6a'], [200, 70, 60, 18, '#2a1660'], [130, 18, 40, 10, '#3a1a6a'], [230, 26, 30, 12, '#4a1a6a']]) {
    for (let y = ny - ry; y <= ny + ry; y++) for (let x = nx - rx; x <= nx + rx; x++) {
      const d = ((x - nx) / rx) ** 2 + ((y - ny) / ry) ** 2;
      if (d < 1 && (x + y) % 2 === 0 && R() < 1.2 - d) px(c, x, y, col);
    }
  }
  for (let i = 0; i < 150; i++) px(c, Math.floor(R() * W), Math.floor(R() * H), R() < 0.7 ? '#bfc8ff' : '#ffffff');
  for (let i = 0; i < 12; i++) sprite(c, Math.floor(R() * W), Math.floor(R() * H * 0.9), SPARK, { w: ['#fff6b0', '#bfefff', '#ffd1ec'][i % 3] });
}
export function galaxy(c, gx, gy) {
  for (let y = gy - 9; y <= gy + 9; y++) for (let x = gx - 22; x <= gx + 22; x++) {
    const d = ((x - gx) / 22) ** 2 + ((y - gy) / 9) ** 2;
    if (d < 1 && (x + y) % 2 === 0) px(c, x, y, d < 0.3 ? '#5a2a9a' : '#3a1a72');
  }
  for (let k = 0; k < 150; k++) {
    const a = k * 0.23, rr = k * 0.07;
    for (const s of [0, Math.PI]) {
      const x = ro(gx + Math.cos(a + s) * rr * 2), y = ro(gy + Math.sin(a + s) * rr * 0.75);
      px(c, x, y, k < 20 ? '#ffffff' : k < 55 ? '#ffc8f4' : k < 100 ? '#e08aff' : '#9a5cff');
    }
  }
  oval(c, gx, gy, 3, 2, '#ffe8ff'); rect(c, gx - 1, gy - 1, 2, 2, '#ffffff');
}
/** 네온 무지개 둥근 테두리 — 무지개 2칸 + 흰 1칸 + 바깥 보라 빛 */
export function frame(c, inset = 3, r = 9) {
  const RB = ['#ff3d6e', '#ff9a1a', '#ffe14d', '#4dd27a', '#3fc4ff', '#6a5cff', '#d24dff'];
  const x0 = inset, y0 = inset, x1 = W - 1 - inset, y1 = H - 1 - inset;
  const inR = (x, y, rr) => {
    const cx = x < x0 + rr ? x0 + rr : x > x1 - rr ? x1 - rr : x;
    const cy = y < y0 + rr ? y0 + rr : y > y1 - rr ? y1 - rr : y;
    return (x - cx) ** 2 + (y - cy) ** 2 <= rr * rr + rr * 0.8;
  };
  for (let y = y0 - 3; y <= y1 + 3; y++) for (let x = x0 - 3; x <= x1 + 3; x++) {
    const o = inR(x, y, r);
    const i2 = x > x0 + 1 && x < x1 - 1 && y > y0 + 1 && y < y1 - 1 && inR(x, y, r - 2);
    const i3 = x > x0 + 2 && x < x1 - 2 && y > y0 + 2 && y < y1 - 2 && inR(x, y, r - 3);
    if (o && !i2) { const t = ((x - x0) + (y - y0) * 1.6) / (W + H * 1.6); px(c, x, y, RB[Math.floor(t * RB.length * 1.4) % RB.length]); }
    else if (i2 && !i3) px(c, x, y, '#ffffff');
    else if (!o && inR(x, y, r + 1)) px(c, x, y, OUT);
    else if (!o && inR(x, y, r + 2) && (x + y) % 2 === 0) px(c, x, y, '#7a4ad8');
  }
}

/* =====================================================================
 * 동전 — 진짜 동전처럼: 타원 원근 · 옆면 두께(톱니) · 테두리 · 안쪽 별 무늬 · 반짝
 * ===================================================================== */
const CO = { out: '#3a1c00', edge: '#c47c0a', edgeD: '#7a4600', face: '#ffd23a', faceL: '#fff6c0', rim: '#d88c10', disk: '#f4b41c', emb: '#fff6c8', embD: '#b8700a' };
const sh = (col, k) => (k ? tone(col, k) : col);
/** 누운 동전(더미용) — (cx, cy) 윗면 가운데 · r 반지름 · k 어둡기(−0.4 ~ 0). 옆면은 아래로 th칸 */
export function coinFlat(c, cx, cy, r, k = 0) {
  cx = ro(cx); cy = ro(cy);
  const ry = Math.max(2, ro(r * 0.48)), th = r >= 5 ? 2 : 1;
  oval(c, cx - 0.5, cy + th, r + 1, ry + 1, CO.out);
  oval(c, cx - 0.5, cy, r + 1, ry + 1, CO.out);
  for (let d = th; d >= 1; d--) oval(c, cx - 0.5, cy + d, r, ry, sh(CO.edge, k));
  for (let i = -r + 1; i < r; i += 2) {                   // 옆면 톱니
    const yb = cy + ro(ry * Math.sqrt(Math.max(0, 1 - (i / r) ** 2)));
    rect(c, cx + i, yb, 1, th, sh(CO.edgeD, k));
  }
  oval(c, cx - 0.5, cy, r, ry, sh(CO.rim, k));
  oval(c, cx - 1, cy - 0.4, r - 1, ry - 0.7, sh(CO.face, k));
  if (r >= 5) {
    ringFlat(c, cx - 0.5, cy, r - 2, ry - 1, sh(CO.rim, k));       // 안쪽 테(돋을새김)
    rect(c, cx - 2, cy, 3, 1, sh(CO.embD, k)); rect(c, cx - 2, cy - 1, 3, 1, sh(CO.emb, k));   // 가운데 무늬
  }
  rect(c, cx - ro(r * 0.7), cy - ry + 1, ro(r * 0.8), 1, sh(CO.faceL, k));
  if (k > -0.12) { px(c, cx - ro(r * 0.6), cy - ry + 1, '#ffffff'); px(c, cx - ro(r * 0.6) + 1, cy - ry + 1, '#ffffff'); }
}
/** 납작한 타원 테두리 한 줄 */
function ringFlat(c, cx, cy, rx, ry, col) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    const k = (y + 0.5 - cy) / ry; if (Math.abs(k) > 1) continue;
    const hw = rx * Math.sqrt(1 - k * k), a = ro(cx - hw), b = ro(cx + hw);
    if (Math.abs(k) > 0.6) rect(c, a, y, b - a, 1, col); else { px(c, a, y, col); px(c, b - 1, y, col); }
  }
}
/** 선 동전 — 앞면이 보이고 오른쪽으로 옆면. wr = 가로 비율(1 정면 · 0.25 거의 옆) */
export function coinStand(c, cx, cy, r, wr = 1, k = 0) {
  cx = ro(cx); cy = ro(cy);
  const rx = Math.max(1.5, r * wr), dx = r >= 7 ? 2 : 1;
  oval(c, cx + dx - 0.5, cy - 0.5, rx + 1, r + 1, CO.out);
  oval(c, cx - 0.5, cy - 0.5, rx + 1, r + 1, CO.out);
  for (let d = dx; d >= 1; d--) oval(c, cx + d - 0.5, cy - 0.5, rx, r, sh(CO.edge, k));
  for (let j = -r + 2; j < r - 1; j += 2) {                // 옆면 톱니(가로 줄)
    const xr = cx + ro(rx * Math.sqrt(Math.max(0, 1 - (j / r) ** 2)));
    rect(c, xr, cy + j, dx, 1, sh(CO.edgeD, k));
  }
  oval(c, cx - 0.5, cy - 0.5, rx, r, sh(CO.rim, k));
  oval(c, cx - 1, cy - 1, rx - 0.8, r - 0.8, sh(CO.face, k));
  if (rx >= 3.5 && r >= 5) {
    oval(c, cx - 0.5, cy - 0.5, rx - 2, r - 2, sh(CO.rim, k));       // 안쪽 테두리(돋을새김)
    oval(c, cx - 0.8, cy - 0.8, rx - 2.6, r - 2.6, sh(CO.disk, k));
    /* 별 무늬(돋을새김) — 가로 비율만큼 좁힌다. 빛 칸 + 오른쪽 아래 그늘 칸 */
    const S = r >= 7 ? ['...o...', '..ooo..', 'ooooooo', '.ooooo.', '..ooo..', '.oo.oo.', 'oo...oo'] : r >= 5 ? ['..o..', '.ooo.', 'ooooo', '.o.o.'] : ['.o.', 'ooo', 'o.o'];
    const sw = S[0].length, kx = Math.min(1, (rx - 1.5) / (r - 1.5));
    const pts = [];
    for (let j = 0; j < S.length; j++) for (let i = 0; i < sw; i++) if (S[j][i] === 'o') pts.push([cx - 1 + ro((i - (sw - 1) / 2) * kx), cy - 1 + j - Math.floor(S.length / 2)]);
    for (const [ex, ey] of pts) px(c, ex + 1, ey + 1, sh(CO.embD, k));
    for (const [ex, ey] of pts) px(c, ex, ey, sh(CO.emb, k));
  }
  /* 왼쪽 위 빛 · 반짝 */
  for (let a = 0; a < 5; a++) { const t = Math.PI * (1.05 + a * 0.12); px(c, cx + ro(Math.cos(t) * (rx - 1)) - 1, cy + ro(Math.sin(t) * (r - 1)) - 1, sh(CO.faceL, k)); }
  if (k > -0.15 && rx >= 3) { px(c, cx - ro(rx * 0.45) - 1, cy - ro(r * 0.5), '#ffffff'); px(c, cx - ro(rx * 0.45), cy - ro(r * 0.5) + 1, '#ffffff'); }
}
/** 금화 더미 — 어두운 바탕(틈) 위에 누운 동전을 층마다 엇갈려 쌓는다. 뒤(위 층)는 어둡게 · 앞(아래 층)은 밝게, 몇 개는 세운다 */
export function coinPile(c, cx, base, wide, high, r = 6, standSide = 0) {
  const top = base - high;
  const lim = (x) => high * Math.max(0, 1 - Math.abs((x - cx) / (wide / 2)) ** 1.7);
  /* 틈 바탕 — 동전 사이로 보이는 짙은 금빛 그늘 */
  for (let x = ro(cx - wide / 2); x <= ro(cx + wide / 2); x++) {
    const hh = ro(lim(x) - 3);
    if (hh > 0) { rect(c, x, base - hh, 1, hh, '#4a2804'); if (x % 2 === 0) px(c, x, base - hh, '#7a4a0c'); }
  }
  /* 층: 위에서 아래로. 층마다 동전 간격 r*1.7, 한 층 건너 반 칸씩 엇갈림 */
  const step = Math.max(3, ro(r * 0.62));
  let row = 0;
  for (let y = top + 3; y <= base + 2; y += step, row++) {
    const xs = [];
    for (let x = cx - wide / 2 + ((row % 2) * r * 0.85); x <= cx + wide / 2; x += r * 1.7) {
      const xx = x + (R() - 0.5) * 2.4;
      if (lim(xx) - 2 < base - y) continue;                // 더미 윤곽 밖
      xs.push(xx);
    }
    const k = -0.3 * (1 - (y - top) / high);               // 뒤(위)일수록 어둡게
    for (const xx of xs) coinFlat(c, xx, y + (R() < 0.3 ? -1 : 0), r - (R() < 0.2 ? 1 : 0), Math.min(0, k + (R() - 0.5) * 0.08));
  }
  /* 세운 동전 — 더미에 꽂힌 것 · 맨 앞에 기댄 것 */
  for (let k = 0; k < Math.max(2, ro(wide / 26)); k++) {
    let x = cx + (R() - 0.5) * wide * 0.6;
    if (standSide) x = cx + standSide * Math.abs(x - cx);                // 바깥쪽에만(아이 다리 사이에 끼지 않게)
    const L = lim(x);
    if (L < 8) continue;
    coinStand(c, x, base - L + 3 + R() * 4, r, 0.5 + R() * 0.5, -0.05);
  }
  for (let k = 0; k < Math.max(2, ro(wide / 22)); k++) { let x = cx + (R() - 0.5) * wide * 0.75; if (standSide) x = cx + standSide * Math.abs(x - cx); sparkle(c, x, base - lim(x) + 3 + R() * 7, R() < 0.35); }
}

/** 타원 고리(바깥 − 안) — 가운데는 비운다 */
function ringO(c, cx, cy, rx, ry, irx, iry, col) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
    const a = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2, b = ((x + 0.5 - cx) / irx) ** 2 + ((y + 0.5 - cy) / iry) ** 2;
    if (a <= 1 && b > 1) px(c, x, y, col);
  }
}

/* =====================================================================
 * 트로피 — 챔피언 금컵 (가운데 아래)
 * ===================================================================== */
export function trophy(c, cx, top) {
  cx = ro(cx);
  const G = { o: '#3a1c00', y: '#ffcc2e', l: '#fff2a0', d: '#d48a10', D: '#9a5a00', w: '#ffffff' };
  /* 손잡이(뒤) — 고리 */
  for (const s of [-1, 1]) {
    const hx = cx + s * 13;
    ringO(c, hx, top + 7, 6, 7, 2, 3, G.o); ringO(c, hx, top + 7, 5, 6, 3, 4, s < 0 ? G.y : G.d); ringO(c, hx, top + 6, 5, 6, 4.2, 5.2, s < 0 ? G.l : G.y);
  }
  /* 컵 몸통 — 위가 넓고 아래로 좁아진다 */
  const bowl = 16;
  for (let j = -1; j <= bowl; j++) {
    const k = Math.max(0, j) / bowl;
    const hw = ro(12 - k * k * 8.5);
    rect(c, cx - hw - 1, top + j, hw * 2 + 2, 1, G.o);
  }
  for (let j = 0; j < bowl; j++) {
    const k = j / bowl, hw = ro(12 - k * k * 8.5);
    rect(c, cx - hw, top + j, hw * 2, 1, G.y);
    rect(c, cx - hw, top + j, 2, 1, G.l);                  // 왼쪽 빛
    rect(c, cx - hw + 3, top + j, 1, 1, G.l);
    rect(c, cx + hw - 3, top + j, 3, 1, G.d);              // 오른쪽 그늘
    px(c, cx + hw - 1, top + j, G.D);
  }
  /* 입구 — 안쪽이 보이는 타원 */
  oval(c, cx - 0.5, top + 1, 12, 2.6, G.o); oval(c, cx - 0.5, top + 1, 11, 1.8, G.D); rect(c, cx - 10, top + 2, 20, 1, G.l);
  /* 별 무늬 */
  sprite(c, cx - 5, top + 4, ['....o....', '...olo...', 'ooooloooo', 'ollllllld', '.olllldo.', '.oldoldo.', 'olo...odo'], { o: G.D, l: G.l, d: G.d });
  /* 목 · 매듭 · 받침 */
  rect(c, cx - 3, top + bowl, 6, 5, G.o); rect(c, cx - 2, top + bowl, 4, 5, G.y); px(c, cx - 2, top + bowl, G.l); rect(c, cx + 1, top + bowl, 1, 5, G.d);
  rbox(c, cx - 6, top + bowl + 4, 12, 4, G.o, 1); rect(c, cx - 5, top + bowl + 5, 10, 2, G.y); rect(c, cx - 5, top + bowl + 5, 10, 1, G.l);
  rect(c, cx - 10, top + bowl + 8, 20, 8, G.o);
  rect(c, cx - 9, top + bowl + 9, 18, 6, '#7a3a1a'); rect(c, cx - 9, top + bowl + 9, 18, 1, '#a8582a'); rect(c, cx - 9, top + bowl + 14, 18, 1, '#5a2a10');
  rect(c, cx - 6, top + bowl + 10, 12, 3, G.y); rect(c, cx - 6, top + bowl + 10, 12, 1, G.l);   // 이름판
  /* 반짝 */
  px(c, cx - 8, top + 4, G.w); px(c, cx - 7, top + 3, G.w); px(c, cx - 7, top + 5, G.w); px(c, cx - 6, top + 4, G.w);
}
/** 시상대 — 가운데 1등(금) · 왼쪽 2등(은) · 오른쪽 3등(동). (cx, top) = 1등 단 윗면 가운데 */
export function podium(c, cx, top, bottom) {
  cx = ro(cx);
  const NUM = { 1: ['.##.', '###.', '.##.', '.##.', '.##.', '####'], 2: ['###.', '...#', '.##.', '#...', '#...', '####'], 3: ['###.', '...#', '.##.', '...#', '...#', '###.'] };
  const hh = bottom - top;
  for (const [dx, dy, w, col, n] of [[-17, ro(hh * 0.3), 14, '#c8d0e0', 2], [17, ro(hh * 0.43), 14, '#e09a5a', 3], [0, 0, 20, '#ffcc2e', 1]]) {
    const x = cx + dx - Math.floor(w / 2), y = top + dy, h = bottom - y;
    rect(c, x - 1, y - 1, w + 2, h + 1, OUT);
    rect(c, x, y, w, h, col);
    rect(c, x, y, w, 2, tone(col, 0.45));                 // 윗면
    rect(c, x, y + 2, 1, h - 2, tone(col, 0.25));
    rect(c, x + w - 2, y + 2, 2, h - 2, tone(col, -0.25));
    rect(c, x, y + 2, w, 1, tone(col, -0.15));
    sprite(c, x + Math.floor(w / 2) - 2, y + 2, NUM[n], { '#': tone(col, -0.45) });
  }
}

/** 트로피 뒤 빛 — 둥근 빛무리(디더링 두 겹) + 가는 빛살 8가닥 */
export function rays(c, cx, cy, r) {
  for (let y = ro(cy - r); y <= ro(cy + r); y++) for (let x = ro(cx - r * 1.3); x <= ro(cx + r * 1.3); x++) {
    const d = ((x - cx) / (r * 1.3)) ** 2 + ((y - cy) / r) ** 2;
    if (d < 0.35 && (x + y) % 2 === 0) px(c, x, y, '#6a3a7a');
    else if (d < 1 && (x % 2 === 0) && (y % 2 === 0)) px(c, x, y, '#4a2a6a');
  }
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
    for (let t = r * 0.45; t < r * 1.25; t += 1) { if ((t | 0) % 3 === 2) continue; px(c, ro(cx + Math.cos(a) * t * 1.2), ro(cy + Math.sin(a) * t * 0.8), t < r * 0.8 ? '#ffe680' : '#c88a30'); }
  }
}

/* =====================================================================
 * 배너 전용 큰 아이 — 게임 아이(44칸)보다 크고 자세하게(≈60칸). 신나게 높이 뛰는 순간:
 * 무릎을 접고 팔을 벌려 손잡이를 쥐고, 줄은 발밑을 지나는 굵은 U + 머리 위로 돌아온 호 모양 잔상.
 * (X, Y) = 머리 가운데. o.kind 'girl' | 'boy'
 * ===================================================================== */
const EYE = ['.ooo.', 'ooooo', 'owwoo', 'owwio', 'oiiio', 'oiiwo', '.ooo.'];
const EYE_R = EYE.map((r) => r.split('').reverse().join('').replace('wi', 'iw'));
const MOUTH = ['oooooo', 'owwwwo', 'orrrro', '.orpo.', '..oo..'];
/* 양갈래 — 뛰어오르는 순간 양옆 위로 날린다(머리에서 바깥으로 세 덩이) */
const PIG = [[15, -3, 5, 5.5], [18, -5, 4, 4.5], [20, -7, 2.6, 3]];
export function bigKid(c, X, Y, o = {}) {
  const uDepth = o.uDepth ?? 54;
  const girl = o.kind === 'girl';
  const P0 = girl
    ? { sk: '#ffe0c6', skS: '#f2b28c', skL: '#fff2e4', hr: '#8a4a22', hrL: '#c8823e', hrS: '#5a2a10', iris: '#8a4a22', sh: '#ff86c4', shS: '#e0509a', shL: '#ffc4e2', bt: '#9b5de5', btS: '#6a34b8', btL: '#c39cff', shoe: '#ff4d6a', shoeS: '#b81e3a', rope: '#ff4fd8', ropeL: '#ffb8f0', ropeD: '#a8188a', hand: '#ffffff', handS: '#ffc0e8' }
    : { sk: '#f8cc9c', skS: '#d99a6a', skL: '#ffe6c8', hr: '#2a1a12', hrL: '#5a3a26', hrS: '#120a06', iris: '#3a5ad8', sh: '#e8423a', shS: '#a82018', shL: '#ff8a7a', bt: '#2f5fb3', btS: '#1a3a7a', btL: '#6a96e8', shoe: '#3a7be8', shoeS: '#1d3f8a', rope: '#3fd0ff', ropeL: '#c8f4ff', ropeD: '#1a78b8', hand: '#ffd23f', handS: '#c88a10', cap: '#e8423a', capS: '#a82018', capL: '#ff8a7a' };
  /* o.pal 로 색 바꾸기 · o.noRope 줄 없이(두 손 번쩍) · o.noCap 모자 대신 머리 · o.headphones 헤드폰 · o.emblem 'note'|'crown' 가슴 무늬 (점프 피아노 배너) */
  const P = { ...P0, ...(o.pal || {}) };
  const SO = OUT;
  /* 땅 그림자 — 높이 떴으니 멀리 아래에 작게 */
  if (!o.noShadow) for (let dx = -12; dx <= 12; dx++) for (let dy = 0; dy < 3; dy++) if ((dx + dy) % 2 === 0 && Math.abs(dx) < 12 - dy * 3) px(c, X + dx, Y + 49 + dy, '#05030f');
  /* 머리 위로 돌아온 줄의 잔상 — 굵기가 다른 호 세 겹(바둑판) */
  const ecx = X - 0.5, ecy = Y + 15;
  if (!o.noRope) for (const [rx, ry, a0, a1, col, step] of [[31, 41, 3.55, 5.87, P.ropeL, 1], [28, 38, 3.75, 5.67, P.rope, 2], [25, 35, 3.95, 5.47, P.ropeD, 2]]) {
    for (let a = a0; a < a1; a += 0.012) {
      const x = ro(ecx + Math.cos(a) * rx), y = ro(ecy + Math.sin(a) * ry);
      if (step === 1 || (x + y) % 2 === 0) px(c, x, y, col);
    }
  }
  /* 포니 · 양갈래(뒤) — 뛰어서 위로 날린다 */
  if (girl) for (const s of [-1, 1]) {
    for (const [ox, oy, rx, ry] of PIG) oval(c, X + s * ox - 0.5, Y + oy, rx + 1, ry + 1, SO);
    for (const [ox, oy, rx, ry] of PIG) { oval(c, X + s * ox - 0.5, Y + oy, rx, ry, P.hr); oval(c, X + s * ox - 1.5, Y + oy - 1, rx * 0.45, ry * 0.4, P.hrL); rect(c, X + s * ox - 1, Y + oy + ro(ry * 0.5), 2, 1, P.hrS); }
  }
  /* ---- 다리 (무릎을 양옆으로 접어 올림) ---- */
  const legC = P.sk, legS = P.skS;
  for (const s of [-1, 1]) {
    const hip = [X + s * 4, Y + 28], knee = [X + s * 11, Y + 32], ank = [X + s * 7, Y + 39];
    line(c, hip[0], hip[1], knee[0], knee[1], 7, SO); line(c, knee[0], knee[1], ank[0], ank[1], 7, SO);
  }
  for (const s of [-1, 1]) {
    const hip = [X + s * 4, Y + 28], knee = [X + s * 11, Y + 32], ank = [X + s * 7, Y + 39];
    line(c, hip[0], hip[1], knee[0], knee[1], 5, legC); line(c, knee[0], knee[1], ank[0], ank[1], 5, legS);
    rect(c, knee[0] - 2, knee[1] - 2, 3, 1, P.skL);                         // 무릎 빛
    line(c, ank[0] + s, ank[1] - 3, ank[0], ank[1] - 1, 4, '#ffffff');      // 양말
    /* 신발 — 앞코 · 끈 · 흰 밑창 */
    const sx = ank[0] - 5, sy = ank[1];
    rbox(c, sx - 1, sy - 1, 12, 7, SO, 2);
    rbox(c, sx, sy, 10, 5, P.shoe, 1);
    rect(c, sx + 1, sy, 8, 1, tone(P.shoe, 0.4));
    rect(c, sx + (s < 0 ? 1 : 5), sy + 1, 3, 1, tone(P.shoe, 0.55));
    px(c, sx + 4, sy + 1, '#ffffff'); px(c, sx + 6, sy + 1, '#ffffff'); px(c, sx + 5, sy + 2, '#ffffff');
    rect(c, sx, sy + 3, 10, 2, '#f4f0ea'); rect(c, sx, sy + 4, 10, 1, '#c8c0b8');
    rect(c, sx + 1, sy + 2, 8, 1, P.shoeS);
  }
  /* ---- 아래옷 ---- */
  if (girl) {
    for (let i = 0; i < 7; i++) { const hw = 9 + ro(i * 0.9); rect(c, X - hw - 1, Y + 22 + i, hw * 2 + 2, 1, SO); }
    for (let i = 0; i < 6; i++) {
      const hw = 9 + ro(i * 0.9);
      rect(c, X - hw, Y + 22 + i, hw * 2, 1, i === 5 ? P.btL : P.bt);
      for (let k = -hw + 3; k < hw; k += 4) px(c, X + k, Y + 22 + i, i > 1 ? P.btS : P.bt);   // 주름
    }
  } else {
    rbox(c, X - 10, Y + 22, 20, 8, SO, 1);
    rect(c, X - 9, Y + 23, 18, 6, P.bt); rect(c, X - 9, Y + 23, 18, 1, P.btL); rect(c, X - 9, Y + 28, 18, 1, P.btS);
    rect(c, X - 9, Y + 23, 1, 6, '#ffffff'); rect(c, X + 8, Y + 23, 1, 6, '#ffffff');
    rect(c, X - 1, Y + 25, 1, 4, SO);
  }
  /* ---- 몸통 ---- */
  rbox(c, X - 10, Y + 10, 20, 14, SO, 3);
  rbox(c, X - 9, Y + 11, 18, 12, P.sh, 2);
  rect(c, X - 7, Y + 11, 10, 1, P.shL); rect(c, X - 9, Y + 13, 1, 7, P.shL);
  rect(c, X + 6, Y + 13, 2, 9, P.shS); rect(c, X - 8, Y + 21, 16, 1, P.shS);
  line(c, X - 6, Y + 18, X - 4, Y + 20, 1, P.shS); line(c, X + 5, Y + 15, X + 3, Y + 18, 1, P.shS);   // 옷 주름
  if (girl) {
    rect(c, X - 4, Y + 11, 8, 2, '#ffffff'); px(c, X - 1, Y + 13, '#ffffff'); px(c, X, Y + 13, '#ffffff');   // 흰 칼라
    if (o.emblem === 'note') sprite(c, X - 2, Y + 14, ['..ww', '..w.', '..w.', 'www.', 'ww..'], { w: '#ffffff' });
    else sprite(c, X - 3, Y + 15, ['rr.rr', 'rwrrr', 'rrrrr', '.rrr.', '..r..'], { r: '#ff3d6e', w: '#ffffff' });
  } else {
    rect(c, X - 3, Y + 11, 6, 1, '#ffffff'); px(c, X - 2, Y + 12, '#ffffff'); px(c, X + 1, Y + 12, '#ffffff'); px(c, X - 1, Y + 13, '#ffffff'); px(c, X, Y + 13, '#ffffff');
    if (o.emblem === 'crown') sprite(c, X - 3, Y + 15, ['y.y.y', 'yyyyy', 'yryby', 'yyyyy'], { y: '#ffd23f', r: '#ff3d6e', b: '#3fc4ff' });
    else sprite(c, X - 2, Y + 15, ['oooo', 'wwww', '..ww', '.ww.', '.ww.', '.ww.'].slice(1), { w: '#ffffff' });
  }
  /* ---- 팔 · 손잡이 (팔을 벌려 줄을 돌린다) ---- */
  const hands = o.noRope ? [[X - 18, Y + 2], [X + 17, Y + 2]] : [[X - 20, Y + 17], [X + 19, Y + 17]];
  [[-1, hands[0]], [1, hands[1]]].forEach(([s, [hx, hy]]) => {
    const sx = X + s * 8 - (s > 0 ? 1 : 0), sy = Y + 13;
    line(c, sx, sy, hx, hy, 6, SO);
  });
  [[-1, hands[0]], [1, hands[1]]].forEach(([s, [hx, hy]]) => {
    const sx = X + s * 8 - (s > 0 ? 1 : 0), sy = Y + 13;
    const mx = sx + (hx - sx) * 0.38, my = sy + (hy - sy) * 0.38;
    line(c, sx, sy, mx, my, 4, P.sh); line(c, sx, sy - 1, mx, my - 1, 1, P.shL);
    line(c, mx, my, hx, hy, 4, P.sk); line(c, mx, my - 1, hx, hy - 1, 1, P.skL);
    /* 손잡이: 세로(살짝 바깥으로 기움) 3x11 */
    if (!o.noRope) for (let j = -6; j <= 5; j++) { const xx = hx + ro(j * -0.15 * s) - 1; rect(c, xx - 1, hy + j, 5, 1, SO); }
    if (!o.noRope) for (let j = -5; j <= 4; j++) { const xx = hx + ro(j * -0.15 * s) - 1; rect(c, xx, hy + j, 3, 1, P.hand); px(c, xx, hy + j, '#ffffff'); px(c, xx + 2, hy + j, P.handS); }
    /* 주먹 */
    rbox(c, hx - 3, hy - 3, 7, 6, SO, 1); rbox(c, hx - 2, hy - 2, 5, 4, P.sk, 1); rect(c, hx - 2, hy - 2, 3, 1, P.skL);
    px(c, hx + (s < 0 ? 1 : -1), hy, P.skS); px(c, hx + (s < 0 ? 1 : -1), hy + 1, P.skS);
  });
  /* ---- 머리 ---- */
  oval(c, X - 0.5, Y, 15, 13.5, SO);
  oval(c, X - 0.5, Y, 14, 12.5, P.skS);
  oval(c, X - 1.3, Y - 0.8, 13.2, 11.6, P.sk);
  rect(c, X - 11, Y + 5, 3, 2, '#ff9ab0'); rect(c, X + 8, Y + 5, 3, 2, '#ff9ab0');
  px(c, X - 11, Y + 5, '#ffc4d0'); px(c, X + 8, Y + 5, '#ffc4d0');
  sprite(c, X - 9, Y - 2, EYE, { o: OUT, w: '#ffffff', i: P.iris });
  sprite(c, X + 4, Y - 2, EYE_R, { o: OUT, w: '#ffffff', i: P.iris });
  if (girl) { px(c, X - 10, Y - 2, OUT); px(c, X - 10, Y - 3, OUT); px(c, X + 9, Y - 2, OUT); px(c, X + 9, Y - 3, OUT); }  // 속눈썹
  rect(c, X - 9, Y - 5, 4, 1, P.hrS); px(c, X - 5, Y - 6, P.hrS); rect(c, X + 5, Y - 5, 4, 1, P.hrS); px(c, X + 4, Y - 6, P.hrS);   // 눈썹(신남)
  sprite(c, X - 3, Y + 6, MOUTH, { o: '#6a1a1a', w: '#ffffff', r: '#c8304a', p: '#ff8a9a' });
  /* ---- 머리카락 · 모자 ---- */
  if (girl) {
    oval(c, X - 0.5, Y - 1.5, 15.5, 13.5, SO, Y - 4);
    oval(c, X - 0.5, Y - 1.5, 14.5, 12.5, P.hr, Y - 4);
    oval(c, X - 4, Y - 8, 7, 3, P.hrL, Y - 7, Y - 11);   // 머리 윤기 띠
    px(c, X + 3, Y - 10, P.hrL); px(c, X + 4, Y - 10, P.hrL);
    const fr = [3, 4, 5, 4, 2, 3, 5, 4, 3, 2, 4, 5, 3, 2, 3, 4, 5, 3, 2, 3, 4, 3, 2, 3];
    for (let i = 0; i < 24; i++) { const col = X - 12 + i; rect(c, col, Y - 4, 1, fr[i] + 1, SO); rect(c, col, Y - 4, 1, fr[i], P.hr); if (fr[i] >= 4) px(c, col, Y - 3, P.hrL); }
    for (const s of [-1, 1]) { const sx = s < 0 ? X - 15 : X + 13; rect(c, sx, Y - 4, 3, 11, SO); rect(c, sx + (s < 0 ? 1 : 0), Y - 4, 2, 10, P.hr); px(c, sx + (s < 0 ? 1 : 0), Y - 3, P.hrL); }
    /* 리본 둘 */
    if (!o.headphones) for (const s of [-1, 1]) sprite(c, X + s * 13 - 3, Y - 13, ['oo...oo', 'olpopPo', 'oppkppo', 'oPpopPo', 'oo...oo'], { o: SO, p: '#ff4f8b', P: '#c8205a', l: '#ffd0e0', k: '#a8104a' });
  } else {
    /* 옆머리 · 구레나룻 */
    for (const s of [-1, 1]) { const sx = s < 0 ? X - 15 : X + 13; rect(c, sx, Y - 5, 3, 8, SO); rect(c, sx + (s < 0 ? 1 : 0), Y - 5, 2, 7, P.hr); }
    const fr = [2, 3, 2, 4, 3, 2, 3, 4, 2, 3, 2, 3, 4, 2, 3, 2, 3, 4, 3, 2, 3, 2];
    for (let i = 0; i < 22; i++) { const col = X - 11 + i; rect(c, col, Y - 5, 1, fr[i] + 1, SO); rect(c, col, Y - 5, 1, fr[i], P.hr); }
    if (o.noCap) { oval(c, X - 0.5, Y - 2.5, 15.5, 13, SO, Y - 4); oval(c, X - 0.5, Y - 2.5, 14.5, 12, P.hr, Y - 4); oval(c, X - 4, Y - 9, 6, 2.5, P.hrL, Y - 8, Y - 12); } else {
    /* 야구 모자 — 둥근 정수리 + 앞 챙(가운데가 살짝 내려온다) + 흰 별 */
    oval(c, X - 0.5, Y - 5, 16, 12, SO, Y - 4);
    oval(c, X - 0.5, Y - 5, 15, 11, P.cap, Y - 5);
    oval(c, X - 5, Y - 11, 6, 3, P.capL, Y - 10, Y - 14);
    rect(c, X - 1, Y - 16, 2, 1, '#ffffff');
    for (let k = -2; k <= 2; k++) line(c, X + k * 5, Y - 15 + Math.abs(k), X + k * 6, Y - 6, 1, P.capS);   // 모자 이음선
    sprite(c, X - 4, Y - 13, ['...o...', '..owo..', 'oowwwoo', '.owwwo.', '.owowo.', '.oo.oo.'], { o: P.capS, w: '#ffffff' });
    for (let i = -15; i <= 14; i++) {
      const dy = ro((i / 15) ** 2 * -2);
      rect(c, X + i, Y - 6 + dy, 1, 4, SO);
      rect(c, X + i, Y - 5 + dy, 1, 2, i < -8 ? P.capL : P.capS);
    }
    rect(c, X - 12, Y - 2, 24, 1, P.skS);                                 // 챙 그늘
    }
  }
  if (o.headphones) {                                                  // 헤드폰 — 머리 위 띠 + 양쪽 귀 덮개
    const hc = o.headphones === true ? ['#ff4f8b', '#ffd0e0', '#a8104a'] : o.headphones;
    for (let a = Math.PI * 1.04; a <= Math.PI * 1.96; a += 0.01) { const x = ro(X - 0.5 + Math.cos(a) * 16), y = ro(Y - 1 + Math.sin(a) * 15); rect(c, x - 1, y - 1, 3, 3, SO); }
    for (let a = Math.PI * 1.04; a <= Math.PI * 1.96; a += 0.01) { const x = ro(X - 0.5 + Math.cos(a) * 16), y = ro(Y - 1 + Math.sin(a) * 15); px(c, x, y, hc[0]); }
    for (const s of [-1, 1]) { const cx = s < 0 ? X - 19 : X + 14; rbox(c, cx - 1, Y - 6, 7, 11, SO, 2); rbox(c, cx, Y - 5, 5, 9, hc[0], 1); rect(c, cx + 1, Y - 4, 1, 6, hc[1]); rect(c, cx + 3, Y - 4, 1, 7, hc[2]); }
  }
  if (!o.noRope) {
  /* ---- 줄: 발밑을 지나는 굵은 U (지금 줄) ---- */
  const [L, Rr] = hands;
  const p0 = [L[0], L[1] + 6], p3 = [Rr[0] + 1, Rr[1] + 6];
  const c1 = [L[0] - 8, Y + uDepth], c2 = [Rr[0] + 9, Y + uDepth];
  const pts = [];
  for (let i = 0; i <= 160; i++) {
    const u = i / 160, a = (1 - u) ** 3, b = 3 * u * (1 - u) ** 2, e = 3 * u * u * (1 - u), d = u ** 3;
    pts.push([ro(a * p0[0] + b * c1[0] + e * c2[0] + d * p3[0]), ro(a * p0[1] + b * c1[1] + e * c2[1] + d * p3[1])]);
  }
  for (const [x, y] of pts) rect(c, x - 2, y - 2, 5, 5, SO);
  pts.forEach(([x, y], i) => { rect(c, x - 1, y - 1, 3, 3, (Math.floor(i / 6) % 2) ? P.rope : P.ropeD); px(c, x - 1, y - 1, P.ropeL); });
  /* 줄 바깥 스피드 선 — 발밑 양옆 짧은 호 */
  for (const s of [-1, 1]) for (let k = 0; k < 3; k++) {
    const a = Math.PI * (s < 0 ? 0.62 + k * 0.06 : 0.38 - k * 0.06);
    const rr = 33 + k * 2;
    for (let t = 0; t < 6 - k; t++) px(c, ro(ecx + Math.cos(a + s * t * 0.02) * rr), ro(ecy + Math.sin(a + s * t * 0.02) * (rr + 9)), '#ffffff');
  }
  }
  /* 뛰어오른 표시 — 발밑 세로 줄 */
  if (!o.noShadow) for (const dx of [-9, -3, 3, 9]) rect(c, X + dx, Y + 45 + (Math.abs(dx) > 5 ? 1 : 0), 1, 2, '#cfe0ff');
}
