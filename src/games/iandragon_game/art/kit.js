/**
 * 이안 드래곤 게임 — 도트 부품 키트 (겜팀장 · 기획서 12.3)
 *
 * 캐릭터 = 부품(타원 · 다각형 · 점)을 차례로 올린 것. 부품마다
 *   ① 칸 단위로 채우고 (정수 좌표 · 번짐 없음)
 *   ② 빛(왼쪽 위)에 따라 밝음 · 보통 · 그림자 3단으로 나눈 뒤 (경계는 바둑판 디더 1줄)
 *   ③ 둘레에 1칸 외곽선(#14082a)을 둘러 앞 부품과 갈라지게 한 다음 판에 얹는다.
 * 회전은 쓰지 않는다(도트가 깨진다) — 움직임은 부품을 1~2칸 옮기기로.
 * DOM · 캔버스를 모른다: Node(굽기 스크립트)와 브라우저 어디서든 돈다.
 */
import { OUT } from './palette.js';

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), 255];

export class Pix {
  constructor(w, h) { this.w = w; this.h = h; this.d = new Uint8ClampedArray(w * h * 4); }
  get(x, y) { const i = (y * this.w + x) * 4; return this.d[i + 3] ? this.d.slice(i, i + 4) : null; }
  set(x, y, col) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h || !col) return;
    const c = typeof col === 'string' ? hex(col) : col, i = (y * this.w + x) * 4;
    this.d[i] = c[0]; this.d[i + 1] = c[1]; this.d[i + 2] = c[2]; this.d[i + 3] = 255;
  }
  rect(x, y, w, h, col) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, col); }
  /** 다른 판을 얹기 (투명 칸은 건너뜀) — flip 이면 좌우 뒤집어 */
  blit(src, ox, oy, flip = false) {
    for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
      const c = src.get(x, y);
      if (c) this.set(ox + (flip ? src.w - 1 - x : x), oy + y, c);
    }
  }
}

/** 한 부품 = 모양 칸들 → 3단 칠하기 → 외곽선 → 판에 얹기 */
function stamp(dst, cells, ramp, opts = {}) {
  if (!cells.length) return;
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const [x, y] of cells) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, rx = Math.max(1, (x1 - x0) / 2), ry = Math.max(1, (y1 - y0) / 2);
  const [lx, ly] = opts.light ?? [-0.55, -0.83];             // 빛은 왼쪽 위
  const hi = opts.hi ?? 0.42, lo = opts.lo ?? -0.32;
  const set = new Set(cells.map(([x, y]) => `${x},${y}`));
  if (opts.outline !== false) for (const [x, y] of cells) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const k = `${x + dx},${y + dy}`;
    if (!set.has(k) && !(opts.openBottom && dy === 1 && y === y1)) dst.set(x + dx, y + dy, opts.lineCol ?? OUT);
  }
  for (const [x, y] of cells) {
    if (opts.flat) { dst.set(x, y, ramp[opts.flat]); continue; }
    const nx = (x - cx) / rx, ny = (y - cy) / ry;
    const v = nx * lx + ny * ly;
    const dith = (x + y) % 2 === 0;
    let k = v > hi ? 0 : v < lo ? 2 : 1;
    if (Math.abs(v - hi) < 0.08) k = dith ? 0 : 1;            // 경계는 바둑판으로 부드럽게
    else if (Math.abs(v - lo) < 0.08) k = dith ? 2 : 1;
    dst.set(x, y, ramp[k]);
  }
}

export function ellCells(cx, cy, rx, ry) {
  const out = [];
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
    const dx = (x + 0.5 - cx) / (rx + 0.25), dy = (y + 0.5 - cy) / (ry + 0.25);
    if (dx * dx + dy * dy <= 1) out.push([x, y]);
  }
  return out;
}
export function polyCells(pts) {
  const out = [];
  const ys = pts.map((p) => p[1]);
  for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) {
    const xs = [];
    for (let i = 0; i < pts.length; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length];
      const yy = y + 0.5;
      if ((ay <= yy && by > yy) || (by <= yy && ay > yy)) xs.push(ax + ((yy - ay) / (by - ay)) * (bx - ax));
    }
    xs.sort((a, b) => a - b);
    for (let i = 0; i + 1 < xs.length; i += 2) for (let x = Math.round(xs[i]); x < Math.round(xs[i + 1]); x++) out.push([x, y]);
  }
  return out;
}

/** 부품 그리기 짧은 이름 */
export const part = {
  ell: (p, cx, cy, rx, ry, ramp, o) => stamp(p, ellCells(cx, cy, rx, ry), ramp, o),
  poly: (p, pts, ramp, o) => stamp(p, polyCells(pts), ramp, o),
  /** 눈 — 흰자 + 눈동자 + 반짝 (크기 r: 2~4) · look: 눈동자 쏠림 */
  eye(p, x, y, r, look = 1, opts = {}) {
    const cells = ellCells(x, y, r, r + (opts.tall ?? 1));
    stamp(p, cells, ['#ffffff', '#ffffff', '#e6e2f2'], { hi: 0.2, lo: -0.6 });
    const px = Math.round(x + look * Math.max(0, r - 2)), py = Math.round(y + 0.5);
    p.rect(px - 1, py - 1, 2 + (r >= 3 ? 1 : 0), 2 + (r >= 3 ? 1 : 0), opts.pupil ?? OUT);
    p.set(px - 1, py - 1, '#ffffff');                          // 반짝
  },
  /** 반짝이는 큰 눈 (귀여운 아기 몬스터 비율) — 진한 눈동자 + 큰 하이라이트 2개 · lid: 위 눈꺼풀(0~1, 졸린 눈) */
  gem(p, x, y, rx, ry, opts = {}) {
    const iris = opts.iris ?? '#2a1c48';
    const cells = ellCells(x, y, rx, ry);
    stamp(p, cells, [opts.irisHi ?? '#5a4a9a', iris, OUT], { hi: 0.55, lo: 0.1, light: [0.3, 0.9] });
    const top = Math.round(y - ry);
    if (opts.lid) { const lh = Math.round((ry * 2 + 1) * opts.lid); stamp(p, cells.filter(([, cy]) => cy < top + lh), opts.lidRamp ?? ['#000', '#000', '#000'], { outline: false, flat: 1 }); p.rect(Math.round(x - rx), top + lh, Math.round(rx * 2) + 1, 1, OUT); }
    const hx = Math.round(x - rx * 0.35), hy = Math.round(y - ry * (opts.lid ? 0.05 : 0.45));
    p.rect(hx - 1, hy - 1, 2, 2, '#ffffff'); if (rx >= 3) p.set(hx + 1, hy - 1, '#ffffff');
    p.set(Math.round(x + rx * 0.4), Math.round(y + ry * 0.5), '#ffffff');
  },
  /** 졸린 눈 — 반달 줄 */
  sleepy(p, x, y, w, col = OUT) { p.rect(x, y, w, 1, col); p.set(x - 1, y - 1, col); p.set(x + w, y - 1, col); },
  dot: (p, x, y, col) => p.set(x, y, col),
};
