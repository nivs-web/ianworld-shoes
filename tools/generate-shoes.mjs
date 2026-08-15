/**
 * 신발 130종 생성기 — 마스터 50×30 체계 (기획서 §9-3, 3차 개정)
 *
 * 레이아웃: 사용자 제공 하이탑 픽셀아트 레퍼런스 기준.
 *   컬러 칼라 밴드 + 칼라 블록 + 큰 발목/힐 오버레이 + 검은 아이스테이/레이스 +
 *   흰 쿼터·토박스 + 컬러 머드가드 + 흰 미드솔(회색 음영 대시) + 컬러 아웃솔 스트립.
 *   왼쪽 향함, 진한 외곽선. 실존 브랜드 마크는 넣지 않는다.
 *
 * 티어 규칙 (2026-08-13 3차 확정) — 색 수는 흰색 포함으로 센다:
 *   T5 60  단색 구조 (신발 전체가 한 색의 톤온톤)
 *   T4 40  2색 (흰 + 색 1)
 *   T3 15  3색 (흰 + 색 2 — 레퍼런스의 흰·검·빨 구조)
 *   T2 10  3색 + 줄무늬/스트라이프 패턴
 *   T1  5  스페셜 (무지개·홀로·황금·갤럭시·선셋) + 무늬 강화
 */

import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = resolve(ROOT, 'public/assets/shoes');
const OUT_JSON = resolve(ROOT, 'src/data/shoes.json');

const W = 50;
const H = 30;
const CELL_W = 52;
const CELL_H = 32;
const COLS = 10;
const ROWS = 13;

// ─────────────────────────────────────────────
// 색 유틸
// ─────────────────────────────────────────────

function hsl(h, s, l) {
  s /= 100;
  l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

function hex(str) {
  const n = parseInt(str.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const dark = (c, t) => c.map((v) => Math.round(v * (1 - t)));
const lite = (c, t) => c.map((v) => Math.round(v + (255 - v) * t));
const lum = (c) => c[0] + c[1] + c[2];

const WHITE_PANEL = hex('#FBF8F2'); // 쿼터/토박스
const SOLE_WHITE = hex('#F2EFE8'); // 미드솔
const SOLE_GRAY = hex('#C9C5BD'); // 미드솔 음영 대시
const WHITE = hex('#FFFFFF');
const BLACK = hex('#23232B');
const INK = hex('#17171F');

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─────────────────────────────────────────────
// 실루엣 템플릿 (50×30, 왼쪽 향함)
// 역할:
//   O 외곽선            M 미드솔(흰)      m 미드솔 음영 대시   U 아웃솔 스트립(색A)
//   Q 쿼터/토박스(흰)   T 머드가드+앞 로우 패널(색A)
//   C 칼라 탑 밴드(색A) K 칼라 블록(색B)  A 발목/힐 오버레이(색A)
//   E 아이스테이(색B)   L 레이스(색B)     l 레이스 틈(흰)
// ─────────────────────────────────────────────

function makeTemplate() {
  const g = Array.from({ length: H }, () => Array(W).fill('.'));

  const soleTop = 22; // 미드솔 시작
  const outsoleY = 25; // 아웃솔 스트립 시작
  const soleBot = 28;
  const collarY = 1;
  const collarX0 = 31;
  const toeTipX = 2;
  const topAtToe = 13;
  const X_RIGHT = 47;

  const yTop = (x) => {
    if (x >= collarX0) return collarY;
    if (x < 8) return topAtToe;
    const t = (collarX0 - x) / (collarX0 - 8);
    const base = collarY + t * (topAtToe - collarY);
    const dip = 2.5 * Math.sin(Math.PI * t);
    return Math.round(base + dip);
  };
  const xLeft = (y) => {
    if (y < topAtToe) return 8;
    const t = (y - topAtToe) / (soleTop - topAtToe);
    return Math.max(toeTipX, Math.round(8 - t * (8 - toeTipX) * 1.15));
  };

  // ── 어퍼 기본(흰 쿼터) ──
  for (let y = 0; y < soleTop; y++) {
    for (let x = 0; x < W; x++) {
      if (x > X_RIGHT) continue;
      if (y < yTop(x)) continue;
      if (x < xLeft(y)) continue;
      g[y][x] = 'Q';
    }
  }

  // ── 솔: 흰 미드솔 + 회색 대시 + 컬러 아웃솔 ──
  for (let y = soleTop; y <= soleBot; y++) {
    const inset = y === soleBot ? 1 : 0;
    for (let x = 1 + inset; x <= 48 - inset; x++) {
      g[y][x] = y >= outsoleY ? 'U' : 'M';
    }
  }
  // 미드솔 음영 대시 (회색 가로줄 조각)
  for (const [dx0, dx1, dy] of [[6, 16, 23], [22, 34, 23], [38, 45, 24], [10, 20, 24]]) {
    for (let x = dx0; x <= dx1; x++) if (g[dy][x] === 'M') g[dy][x] = 'm';
  }

  // ── 발목/힐 오버레이(색A): 뒤쪽 블록 ──
  for (let y = 9; y < soleTop; y++) {
    const xStart = 42 - Math.round((y - 9) * 0.4);
    for (let x = xStart; x <= X_RIGHT; x++) {
      if (g[y][x] === 'Q') g[y][x] = 'A';
    }
  }

  // ── 칼라 블록(색B): 상단 뒤쪽 ──
  for (let y = 0; y <= 8; y++) {
    for (let x = 30; x <= X_RIGHT; x++) {
      if (g[y][x] === 'Q') g[y][x] = 'K';
    }
  }

  // ── 칼라 탑 밴드(색A): 탑라인 위 2px ──
  for (let x = 27; x <= X_RIGHT; x++) {
    const y0 = yTop(x);
    for (let d = 0; d <= 1; d++) {
      const y = y0 + d;
      const cur = g[y]?.[x];
      if (cur === 'K' || cur === 'Q' || cur === 'A') g[y][x] = 'C';
    }
  }

  // ── 아이스테이(색B): 발등 탑라인 밴드 (2px) ──
  for (let x = 10; x <= 29; x++) {
    const y0 = yTop(x);
    for (let d = 0; d <= 1; d++) {
      const y = y0 + d;
      const cur = g[y]?.[x];
      if (cur === 'Q' || cur === 'T') g[y][x] = 'E';
    }
  }

  // ── 레이스(색B): 아이스테이 아래 사다리 — 세로 흰 틈으로 정갈하게 ──
  for (let x = 12; x <= 26; x++) {
    const y0 = yTop(x);
    for (let d = 2; d <= 4; d++) {
      const y = y0 + d;
      if (y >= soleTop - 4) break;
      const cur = g[y]?.[x];
      if (cur !== 'Q') continue;
      g[y][x] = x % 4 < 3 ? 'L' : 'l';
    }
  }

  // ── 머드가드(색A): 앞코만 감싼다 — 흰 쿼터를 넓게 남긴다 ──
  for (let y = 14; y < soleTop; y++) {
    const xEdge = 10 + Math.round((y - 14) * 0.7);
    for (let x = xLeft(y); x <= xEdge; x++) {
      if (g[y][x] === 'Q') g[y][x] = 'T';
    }
  }

  // ── 외곽선 ──
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (g[y][x] === '.') continue;
      const nb = [g[y - 1]?.[x] ?? '.', g[y + 1]?.[x] ?? '.', g[y][x - 1] ?? '.', g[y][x + 1] ?? '.'];
      if (nb.includes('.')) g[y][x] = 'O';
    }
  }

  return g;
}

// ─────────────────────────────────────────────
// 팔레트 130종
// slots: A(메인 색), B(보조 색). 흰 패널·솔은 고정(단, T5는 톤온톤 틴트).
// pattern: 'diag' | 'hband' | 'vband' | 'zig' (T2 줄무늬 — 쿼터에 적용)
// ─────────────────────────────────────────────

function buildPalettes() {
  const P = [];

  // ══ T1 — 스페셜 (5) ══
  for (const [name, special] of [
    ['무지개', 'rainbow'],
    ['홀로그램', 'holo'],
    ['황금', 'gold'],
    ['갤럭시', 'galaxy'],
    ['선셋', 'sunset'],
  ]) {
    P.push({ tier: 1, name, special });
  }

  // ══ T2 — 3색 + 줄무늬 (10) ══
  const t2 = [
    ['레드 사선', '#D42B2B', '#23232B', 'diag'],
    ['블루 사선', '#2B59C3', '#F0D25C', 'diag'],
    ['그린 가로줄', '#1E8A5A', '#23232B', 'hband'],
    ['퍼플 가로줄', '#6A3BBF', '#E3559C', 'hband'],
    ['오렌지 세로줄', '#E8721F', '#243B6B', 'vband'],
    ['틸 세로줄', '#1F8A8A', '#D42B2B', 'vband'],
    ['핑크 지그재그', '#E3559C', '#23232B', 'zig'],
    ['네이비 지그재그', '#243B6B', '#E8B93C', 'zig'],
    ['버건디 사선', '#8A2438', '#D9A73C', 'diag'],
    ['시안 가로줄', '#2AA8C3', '#E3559C', 'hband'],
  ];
  for (const [name, a, b, pattern] of t2) {
    P.push({ tier: 2, name, A: hex(a), B: hex(b), pattern });
  }

  // ══ T3 — 3색 (흰 + A + B) (15) ══
  const t3 = [
    ['레드 블랙', '#D42B2B', '#23232B'],
    ['블루 블랙', '#2B59C3', '#23232B'],
    ['그린 블랙', '#1E8A5A', '#23232B'],
    ['퍼플 블랙', '#6A3BBF', '#23232B'],
    ['오렌지 블랙', '#E8721F', '#23232B'],
    ['레드 네이비', '#D42B2B', '#243B6B'],
    ['틸 오렌지', '#1F8A8A', '#E8721F'],
    ['퍼플 옐로', '#6A3BBF', '#E3B93C'],
    ['그린 핑크', '#1E8A5A', '#E3559C'],
    ['핑크 스카이', '#E3559C', '#5C9AD9'],
    ['머스터드 네이비', '#D9A73C', '#243B6B'],
    ['코랄 민트', '#F2745C', '#3EA98A'],
    ['와인 골드', '#8A2A4E', '#D9A73C'],
    ['스카이 레드', '#5C9AD9', '#D42B2B'],
    ['올리브 버건디', '#7A7A3E', '#7A2438'],
  ];
  for (const [name, a, b] of t3) {
    P.push({ tier: 3, name, A: hex(a), B: hex(b) });
  }

  // ══ T4 — 2색 (흰 + A) (40) ══
  const t4hues = [
    352, 8, 20, 32, 45, 58, 70, 85, 100, 118,
    132, 145, 158, 170, 182, 195, 208, 222, 235, 248,
    262, 275, 288, 300, 312, 325, 338, 15, 230, 140,
  ];
  t4hues.forEach((h, i) => {
    const body = hsl(h, 66, 46);
    P.push({ tier: 4, name: `투톤 ${String(i + 1).padStart(2, '0')}`, A: body, B: body });
  });
  const t4deep = [[350, 58, 30], [222, 58, 30], [152, 48, 26], [275, 48, 30], [28, 62, 33], [190, 52, 28], [48, 58, 36], [318, 48, 32], [95, 42, 28], [0, 0, 30]];
  t4deep.forEach(([h, s, l], i) => {
    const body = hsl(h, s, l);
    P.push({ tier: 4, name: `딥투톤 ${String(i + 1).padStart(2, '0')}`, A: body, B: body });
  });

  // ══ T5 — 단색 톤온톤 (60) ══
  const t5p = [350, 20, 45, 75, 110, 150, 180, 205, 235, 265, 300, 325];
  t5p.forEach((h, i) => {
    P.push({ tier: 5, name: `파스텔 ${String(i + 1).padStart(2, '0')}`, mono: hsl(h, 48, 70) });
  });
  const t5e = [[35, 35, 45], [30, 30, 35], [70, 25, 40], [20, 40, 38], [140, 15, 42], [210, 10, 55], [45, 30, 55], [280, 8, 40], [15, 25, 48], [90, 20, 50], [200, 15, 40], [330, 12, 45]];
  t5e.forEach(([h, s, l], i) => {
    P.push({ tier: 5, name: `어스 ${String(i + 1).padStart(2, '0')}`, mono: hsl(h, s, l) });
  });
  for (let i = 0; i < 36; i++) {
    const h = Math.round((360 / 36) * i);
    const l = [46, 54, 38][i % 3];
    const s = [60, 48, 68][i % 3];
    P.push({ tier: 5, name: `모노 ${String(i + 1).padStart(2, '0')}`, mono: hsl(h, s, l) });
  }

  return P;
}

// ─────────────────────────────────────────────
// 렌더러
// ─────────────────────────────────────────────

function renderShoe(tpl, pal, seed) {
  const buf = Buffer.alloc(W * H * 4, 0);
  const rnd = rng(seed);
  const sparkles = new Set();
  for (let i = 0; i < 30; i++) sparkles.add(`${(rnd() * W) | 0},${(rnd() * H) | 0}`);

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const r = tpl[y][x];
      if (r === '.') continue;
      let c;

      if (pal.special) {
        c = specialColor(pal.special, r, x, y, sparkles);
      } else if (pal.mono) {
        c = monoColor(pal.mono, r);
      } else {
        c = blockColor(pal, r, x, y);
      }

      const o = (y * W + x) * 4;
      buf[o] = c[0];
      buf[o + 1] = c[1];
      buf[o + 2] = c[2];
      buf[o + 3] = 255;
    }
  }
  return buf;
}

/** T2~T4: 컬러블록 (+선택적 쿼터 줄무늬) */
function blockColor(pal, r, x, y) {
  const { A, B } = pal;
  switch (r) {
    case 'O': return INK;
    case 'M': return SOLE_WHITE;
    case 'm': return SOLE_GRAY;
    case 'U': return A;
    case 'T': return A;
    case 'A': return A;
    case 'C': return A;
    case 'K': return B;
    case 'E': return B;
    case 'L': return B;
    case 'l': return WHITE;
    case 'Q': {
      if (pal.pattern) {
        const hit =
          pal.pattern === 'diag' ? (x + y) % 6 < 2
          : pal.pattern === 'hband' ? y % 5 < 2
          : pal.pattern === 'vband' ? x % 6 < 2
          : /* zig */ (x + ((y >> 1) % 2 ? 3 : 0)) % 6 < 2;
        if (hit) return pal.pattern === 'diag' || pal.pattern === 'zig' ? B : A;
      }
      return WHITE_PANEL;
    }
    default: return WHITE_PANEL;
  }
}

/** T5: 단색 톤온톤 — 신발 전체가 한 색 계열 */
function monoColor(base, r) {
  switch (r) {
    case 'O': return dark(base, 0.72);
    case 'M': return lite(base, 0.78);
    case 'm': return lite(base, 0.55);
    case 'U': return base;
    case 'Q': return lite(base, 0.62);
    case 'T': return base;
    case 'A': return base;
    case 'C': return dark(base, 0.18);
    case 'K': return dark(base, 0.35);
    case 'E': return dark(base, 0.3);
    case 'L': return dark(base, 0.45);
    case 'l': return lite(base, 0.62);
    default: return base;
  }
}

/** T1 스페셜 — 무늬 강화 */
function specialColor(kind, role, x, y, sparkles) {
  if (role === 'O') return INK;
  if (role === 'M') return SOLE_WHITE;
  if (role === 'm') return SOLE_GRAY;
  if (role === 'l') return WHITE;

  switch (kind) {
    case 'rainbow': {
      if (role === 'L') return BLACK;
      const h = (y * 40 + 340) % 360;
      const c = hsl(h, 80, role === 'Q' ? 60 : 48);
      // 무늬: 대각 하이라이트 줄
      if (role === 'Q' && (x + y) % 8 < 2) return lite(c, 0.4);
      if (role === 'U') return hsl((y * 40 + 160) % 360, 80, 50);
      return c;
    }
    case 'holo': {
      if (role === 'L') return hex('#8A8AB4');
      const band = ((x + y * 2) >> 2) % 3;
      let c = [hex('#6BE8E8'), hex('#E88AE8'), hex('#F0F0FF')][band];
      if (sparkles.has(`${x},${y}`)) return WHITE;
      if (role === 'Q') c = lite(c, 0.3);
      return c;
    }
    case 'gold': {
      const gold = hex('#E8B93C');
      if (role === 'L') return dark(gold, 0.5);
      if (sparkles.has(`${x},${y}`)) return WHITE;
      if (role === 'Q') {
        // 무늬: 다이아 격자
        if ((x + y) % 6 === 0 || (x - y + 60) % 6 === 0) return lite(gold, 0.35);
        return lite(gold, 0.55);
      }
      if (role === 'K' || role === 'E') return dark(gold, 0.3);
      if (role === 'U') return dark(gold, 0.15);
      return gold;
    }
    case 'galaxy': {
      if (role === 'L') return hex('#4A4A7A');
      if (sparkles.has(`${x},${y}`)) return WHITE;
      const neb = Math.sin(x * 0.35 + y * 0.5) + Math.sin(x * 0.15 - y * 0.3);
      let c = hex('#232343');
      if (neb > 0.9) c = hex('#6B3B9C');
      if (neb > 1.5) c = hex('#C35CA0');
      if (role === 'Q') return lite(c, 0.12);
      if (role === 'U') return hex('#6B3B9C');
      return c;
    }
    case 'sunset': {
      if (role === 'L') return hex('#4A3B8A');
      const stops = [hex('#F2A03C'), hex('#F2745C'), hex('#E3559C'), hex('#8A4AB4'), hex('#4A3B8A')];
      const c = stops[Math.min(stops.length - 1, Math.max(0, ((y - 1) / 4.5) | 0))];
      // 무늬: 태양 원반 (쿼터 중앙)
      const dx = x - 30;
      const dy2 = y - 13;
      if (role === 'Q' && dx * dx + dy2 * dy2 < 14) return hex('#F0D25C');
      if (role === 'Q') return lite(c, 0.28);
      if (role === 'U') return c;
      return c;
    }
  }
  return INK;
}

// ─────────────────────────────────────────────
// 축소 파생
// ─────────────────────────────────────────────

function halve(src, sw, sh) {
  const dw = sw >> 1;
  const dh = sh >> 1;
  const out = Buffer.alloc(dw * dh * 4, 0);
  for (let y = 0; y < dh; y++) {
    for (let x = 0; x < dw; x++) {
      let best = null;
      let bestLum = 1e9;
      let opaque = 0;
      for (let dy = 0; dy < 2; dy++) {
        for (let dx = 0; dx < 2; dx++) {
          const o = ((y * 2 + dy) * sw + x * 2 + dx) * 4;
          if (src[o + 3] === 0) continue;
          opaque++;
          const l = src[o] + src[o + 1] + src[o + 2];
          if (l < bestLum) {
            bestLum = l;
            best = o;
          }
        }
      }
      if (opaque < 2) continue;
      const to = (y * dw + x) * 4;
      out[to] = src[best];
      out[to + 1] = src[best + 1];
      out[to + 2] = src[best + 2];
      out[to + 3] = 255;
    }
  }
  return { buf: out, w: dw, h: dh };
}

// ─────────────────────────────────────────────
// 메인
// ─────────────────────────────────────────────

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  await mkdir(dirname(OUT_JSON), { recursive: true });

  const palettes = buildPalettes();
  if (palettes.length !== 130) throw new Error(`팔레트 수 ${palettes.length} ≠ 130`);
  palettes.sort((a, b) => a.tier - b.tier);

  const tpl = makeTemplate();
  const master = Buffer.alloc(COLS * CELL_W * ROWS * CELL_H * 4, 0);
  const AW = COLS * CELL_W;
  const shoes = [];
  const rendered = [];

  palettes.forEach((pal, index) => {
    const buf = renderShoe(tpl, pal, 1000 + index * 7919);
    rendered.push(buf);
    const col = index % COLS;
    const row = (index / COLS) | 0;
    const ax = col * CELL_W + 1;
    const ay = row * CELL_H + 1;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const so = (y * W + x) * 4;
        if (buf[so + 3] === 0) continue;
        const to = ((ay + y) * AW + ax + x) * 4;
        master[to] = buf[so];
        master[to + 1] = buf[so + 1];
        master[to + 2] = buf[so + 2];
        master[to + 3] = 255;
      }
    }
    const nth = shoes.filter((s) => s.tier === pal.tier).length + 1;
    shoes.push({
      id: `t${pal.tier}_${String(nth).padStart(3, '0')}`,
      index,
      tier: pal.tier,
      name: pal.name,
      ax, ay, aw: W, ah: H,
    });
  });

  await sharp(master, { raw: { width: AW, height: ROWS * CELL_H, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toFile(resolve(OUT_DIR, 'shoes_master.png'));

  // 계단용 ½ (25×15)
  const SW = 26, SH = 16;
  const stairAtlas = Buffer.alloc(COLS * SW * ROWS * SH * 4, 0);
  const SAW = COLS * SW;
  rendered.forEach((buf, index) => {
    const half = halve(buf, W, H);
    const col = index % COLS;
    const row = (index / COLS) | 0;
    for (let y = 0; y < half.h; y++) {
      for (let x = 0; x < half.w; x++) {
        const so = (y * half.w + x) * 4;
        if (half.buf[so + 3] === 0) continue;
        const to = ((row * SH + y) * SAW + col * SW + x) * 4;
        stairAtlas[to] = half.buf[so];
        stairAtlas[to + 1] = half.buf[so + 1];
        stairAtlas[to + 2] = half.buf[so + 2];
        stairAtlas[to + 3] = 255;
      }
    }
  });
  await sharp(stairAtlas, { raw: { width: SAW, height: ROWS * SH, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toFile(resolve(OUT_DIR, 'shoes_stair.png'));

  // 착용용 (15×9)
  const WW = 16, WH = 10;
  const wornAtlas = Buffer.alloc(COLS * WW * ROWS * WH * 4, 0);
  const WAW = COLS * WW;
  for (let index = 0; index < rendered.length; index++) {
    const small = await sharp(rendered[index], { raw: { width: W, height: H, channels: 4 } })
      .resize(15, 9, { kernel: 'nearest', fit: 'fill' })
      .raw()
      .toBuffer();
    const col = index % COLS;
    const row = (index / COLS) | 0;
    for (let y = 0; y < 9; y++) {
      for (let x = 0; x < 15; x++) {
        const so = (y * 15 + x) * 4;
        if (small[so + 3] < 128) continue;
        const to = ((row * WH + y) * WAW + col * WW + x) * 4;
        wornAtlas[to] = small[so];
        wornAtlas[to + 1] = small[so + 1];
        wornAtlas[to + 2] = small[so + 2];
        wornAtlas[to + 3] = 255;
      }
    }
  }
  await sharp(wornAtlas, { raw: { width: WAW, height: ROWS * WH, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toFile(resolve(OUT_DIR, 'shoes_worn.png'));

  const meta = {
    master: { file: 'shoes_master.png', w: AW, h: ROWS * CELL_H, cellW: CELL_W, cellH: CELL_H, shoeW: W, shoeH: H },
    stair: { file: 'shoes_stair.png', w: SAW, h: ROWS * SH, cellW: SW, cellH: SH, shoeW: 25, shoeH: 15 },
    worn: { file: 'shoes_worn.png', w: WAW, h: ROWS * WH, cellW: WW, cellH: WH, shoeW: 15, shoeH: 9 },
    tiers: [
      { tier: 1, name: 'MAXIMAL CHROMA', count: 5, prob: 0.05, offset: 0 },
      { tier: 2, name: 'STRIPED', count: 10, prob: 0.1, offset: 5 },
      { tier: 3, name: 'TRI-COLOUR', count: 15, prob: 0.15, offset: 15 },
      { tier: 4, name: 'TWO-TONE', count: 40, prob: 0.2, offset: 30 },
      { tier: 5, name: 'SINGLE PIGMENT', count: 60, prob: 0.5, offset: 70 },
    ],
    shoes,
  };
  await writeFile(OUT_JSON, JSON.stringify(meta, null, 2) + '\n', 'utf8');

  const counts = {};
  for (const s of shoes) counts[s.tier] = (counts[s.tier] ?? 0) + 1;
  console.log('생성 완료:', JSON.stringify(counts));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
