/**
 * 이안 드래곤 게임 — 배경 · 성 그리기 도구 (겜부장 · 2026-11-10, 대표님 «배경 · 성이 허술하다» 반영)
 *
 * 도트 배경의 정석만 쓴다 :
 *  - 색 띠 사이는 **Bayer 4×4 디더**로 잇는다 (줄무늬 · 엉성한 바둑판 금지).
 *  - 구름은 원 여러 개를 겹친 뭉게구름 + 빛(왼쪽 위) 쪽으로 옮긴 원으로 밝은 면 + 평평한 밑면 그림자.
 *  - 멀수록 하늘색이 섞여 흐려진다 (공기 원근).
 *  - 512칸마다 이음매 없이 이어지는 노이즈 (주기 노이즈).
 * 난수는 쓰지 않는다 — 같은 입력이면 늘 같은 그림 (해시 노이즈).
 */

export const TW = 512;   // 배경 한 장의 가로 주기

/* ── 색 ── */
export const rgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), 255];
export const mix = (a, b, t) => {
  const A = typeof a === 'string' ? rgb(a) : a, B = typeof b === 'string' ? rgb(b) : b;
  return [Math.round(A[0] + (B[0] - A[0]) * t), Math.round(A[1] + (B[1] - A[1]) * t), Math.round(A[2] + (B[2] - A[2]) * t), 255];
};

/* ── Bayer 4×4 (0~1) ── */
const B4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
export const bayer = (x, y) => (B4[((y & 3) << 2) | (x & 3)] + 0.5) / 16;

/** 팔레트 목록에서 0~1 위치 t 의 색 — 이웃 두 색을 Bayer 로 섞는다 (부드러운 띠) */
export function ditherPick(list, t, x, y) {
  const f = Math.max(0, Math.min(list.length - 1, t * (list.length - 1)));
  const i = Math.floor(f), fr = f - i;
  return list[Math.min(list.length - 1, fr > bayer(x, y) ? i + 1 : i)];
}

/* ── 주기 해시 노이즈 (x 는 period 마다 같다) ── */
const hash = (i, j, s) => {
  let h = (i * 374761393 + j * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const smooth = (t) => t * t * (3 - 2 * t);
/** 1차원 값 노이즈 0~1 — cell 칸마다 격자, period 칸마다 반복 */
export function noise1(x, cell, seed = 0, period = TW) {
  const n = Math.round(period / cell);
  const gx = x / cell, i = Math.floor(gx), f = smooth(gx - i);
  const a = hash(((i % n) + n) % n, 0, seed), b = hash((((i + 1) % n) + n) % n, 0, seed);
  return a + (b - a) * f;
}
/** 여러 겹 노이즈 (fbm) */
export function fbm1(x, cells, seed = 0) {
  let s = 0, w = 0, amp = 1;
  for (let k = 0; k < cells.length; k++) { s += noise1(x, cells[k], seed + k * 17) * amp; w += amp; amp *= 0.55; }
  return s / w;
}
/** 2차원 해시 0~1 (점 무늬 · 벽돌 색 흔들기) */
export const hash2 = (x, y, s = 0) => hash(x, y, s);

/* ── 모양 ── */
/** 원들을 합친 덩어리 안인가 */
export const inBlobs = (blobs, x, y, ox = 0, oy = 0, rs = 1) => blobs.some(([cx, cy, r]) => {
  const dx = x + 0.5 - (cx + ox), dy = y + 0.5 - (cy + oy), rr = r * rs;
  return dx * dx + dy * dy <= rr * rr;
});

/**
 * 뭉게구름 — blobs: [[cx, cy, r], ...] (판 좌표). tones: [밝음, 보통, 그림자, 밑그림자]
 * 밝은 면 = 빛 쪽으로 옮기고 조금 줄인 원 안 · 밑면은 baseY 에서 잘라 평평하게.
 * wrap 이면 512칸 이음매를 넘어가는 구름을 반대쪽에도 그린다.
 */
export function cloud(p, blobs, tones, { baseY = Infinity, wrap = true } = {}) {
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const [cx, cy, r] of blobs) { x0 = Math.min(x0, cx - r); x1 = Math.max(x1, cx + r); y0 = Math.min(y0, cy - r); y1 = Math.max(y1, cy + r); }
  y1 = Math.min(y1, baseY);
  const lit = blobs.map(([cx, cy, r]) => [cx - r * 0.28, cy - r * 0.34, r * 0.78]);
  const shade = blobs.map(([cx, cy, r]) => [cx - r * 0.1, cy - r * 0.12, r * 0.95]);
  for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) {
    if (!inBlobs(blobs, x, y)) continue;
    const b = bayer(x, y);
    let c;
    if (y >= baseY - 2) c = tones[3];
    else if (inBlobs(lit, x, y) || (b > 0.75 && inBlobs(lit, x, y, 0, 0, 1.12))) c = tones[0];
    else if (inBlobs(shade, x, y) || (b > 0.6 && inBlobs(shade, x, y, 0, 0, 1.1))) c = tones[1];
    else c = y >= baseY - 4 && b > 0.5 ? tones[3] : tones[2];
    p.set(x, y, c);
    if (wrap) { if (x < 0) p.set(x + TW, y, c); if (x >= TW) p.set(x - TW, y, c); }
  }
}

/**
 * 원통 벽돌 벽 — (x0, y0) 부터 w × h. 빛은 왼쪽 위 → 왼쪽 밝음 · 오른쪽 어두움 (원통 명암).
 * ramp: [밝음, 보통, 어두움, 아주 어두움] · mortar: 줄눈 색 · bh/bw: 벽돌 높이/너비
 */
export function brickCylinder(p, x0, y0, w, h, ramp, mortar, { bh = 6, bw = 12, seed = 0, taper = 0, skip } = {}) {
  for (let y = 0; y < h; y++) {
    const inset = Math.round((taper * (h - y)) / h);
    const row = Math.floor(y / bh), yy = y % bh;
    for (let x = inset; x < w - inset; x++) {
      const px = x0 + x, py = y0 + y;
      if (skip && skip(px, py)) continue;
      const u = (x - inset) / Math.max(1, w - inset * 2 - 1);            // 0 왼쪽 ~ 1 오른쪽
      const off = row % 2 ? bw / 2 : 0;
      const bx = Math.floor((x + off) / bw), xx = (x + off) % bw;
      if (yy === bh - 1 || xx === bw - 1) { p.set(px, py, mortar); continue; }
      const jitter = (hash2(bx, row, seed) - 0.5) * 0.18;               // 벽돌마다 색 조금씩
      let t = 0.15 + u * 0.75 + jitter;
      if (yy === 0 && u < 0.7) t -= 0.12;                               // 벽돌 윗면 빛
      if (xx === 0) t -= 0.06;
      p.set(px, py, ditherPick(ramp, Math.max(0, Math.min(1, t)), px, py));
    }
  }
}

/** 둥근 나무 (판 좌표, 발 = (x, y)) — 줄기 + 원 덩어리 수관 3단 + 외곽선 */
export function tree(p, x, y, size, leaf, trunk, line) {
  const r = size;
  for (let j = 0; j < Math.round(r * 0.9); j++) for (let i = -1; i <= 1; i++) p.set(x + i, y - j, i < 0 ? trunk[0] : trunk[1]);
  const cy = y - r * 1.3;
  const blobs = [[x, cy, r], [x - r * 0.7, cy + r * 0.35, r * 0.7], [x + r * 0.7, cy + r * 0.3, r * 0.72], [x - r * 0.2, cy - r * 0.55, r * 0.7]];
  outlineBlobs(p, blobs, line);
  cloud(p, blobs, [leaf[0], leaf[1], leaf[2], leaf[2]], { wrap: true });
}

/** 덩어리 둘레 1칸 외곽선 */
export function outlineBlobs(p, blobs, col) {
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const [cx, cy, r] of blobs) { x0 = Math.min(x0, cx - r - 1); x1 = Math.max(x1, cx + r + 1); y0 = Math.min(y0, cy - r - 1); y1 = Math.max(y1, cy + r + 1); }
  for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) {
    if (inBlobs(blobs, x, y)) continue;
    if (inBlobs(blobs, x + 1, y) || inBlobs(blobs, x - 1, y) || inBlobs(blobs, x, y + 1) || inBlobs(blobs, x, y - 1)) {
      p.set(x, y, col);
      if (x < 0) p.set(x + TW, y, col); if (x >= TW) p.set(x - TW, y, col);
    }
  }
}

/** 칸 단위 선 (금 · 갈라짐) */
export function line(p, x0, y0, x1, y1, col) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let k = 0; k <= n; k++) p.set(Math.round(x0 + ((x1 - x0) * k) / n), Math.round(y0 + ((y1 - y0) * k) / n), col);
}
