/**
 * 비트맵 폰트 빌더 — 갈무리(Galmuri) TTF → 비트마스크 JSON
 *
 *   입력 : node_modules/galmuri/dist/Galmuri11-Bold.ttf   (OFL-1.1, quiple)
 *   출력 : src/data/font.generated.json
 *
 * 왜 TTF를 그대로 안 쓰나:
 *   ctx.fillText 는 무조건 안티앨리어싱이 걸린다 (CLAUDE.md §3-1).
 *   그래서 빌드 타임에 글리프를 **픽셀 격자**로 굳혀 두고, 런타임에는
 *   fillRect 로 한 도트씩 찍는다. 색·외곽선·그림자를 자유롭게 줄 수 있고
 *   배율도 정수로만 곱해지므로 어떤 크기에서도 픽셀 퍼펙트다.
 *
 * 갈무리는 100유닛 = 1픽셀 격자에 정확히 정렬된 진짜 도트 폰트라
 * 픽셀 중심을 아웃라인에 넣고 빼는 것만으로 무손실 복원이 된다.
 */

import opentype from 'opentype.js';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = resolve(ROOT, 'node_modules/galmuri/dist/Galmuri11-Bold.ttf');
const OUT = resolve(ROOT, 'src/data/font.generated.json');

/** 갈무리11 = 11px 몸통. 베이스라인 기준 위로 11px가 글리프 상자다. */
const H = 11;
const CHARS =
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ' +
  " .,:;-_/\\!?+*=<>()[]%'\"#&@~^|`$";

// ─────────────────────────────────────────────

const font = opentype.parse(readFileSync(SRC).buffer);
const UPEM = font.unitsPerEm; // 1200
const PX = UPEM / 100; // 12 — 1픽셀 = 100유닛

/** 아웃라인 폴리곤 목록 (도트 폰트라 직선만 나온다) */
function outline(glyph) {
  const polys = [];
  let cur = null;
  for (const c of glyph.getPath(0, 0, UPEM).commands) {
    if (c.type === 'M') polys.push((cur = [[c.x, c.y]]));
    else if (c.type === 'L') cur.push([c.x, c.y]);
    else if (c.type === 'Q') cur.push([c.x1, c.y1], [c.x, c.y]);
    else if (c.type === 'C') cur.push([c.x1, c.y1], [c.x2, c.y2], [c.x, c.y]);
    else if (c.type === 'Z' && cur) cur = null;
  }
  return polys;
}

const side = (x1, y1, x2, y2, px, py) => (x2 - x1) * (py - y1) - (px - x1) * (y2 - y1);

/** non-zero winding */
function inside(polys, x, y) {
  let w = 0;
  for (const p of polys) {
    for (let i = 0; i < p.length; i++) {
      const [x1, y1] = p[i];
      const [x2, y2] = p[(i + 1) % p.length];
      if (y1 <= y) {
        if (y2 > y && side(x1, y1, x2, y2, x, y) > 0) w++;
      } else if (y2 <= y && side(x1, y1, x2, y2, x, y) < 0) w--;
    }
  }
  return w !== 0;
}

const glyphs = {};
let maxW = 0;

for (const ch of CHARS) {
  const g = font.charToGlyph(ch);
  const adv = Math.round((g.advanceWidth / UPEM) * PX);
  const polys = outline(g);
  const rows = [];
  for (let y = 0; y < H; y++) {
    let bits = 0;
    for (let x = 0; x < adv; x++) {
      // getPath 좌표계는 y가 아래로 증가하고 baseline이 0이다 → 몸통은 -H..0
      if (inside(polys, (x + 0.5) * 100, (y - H + 0.5) * 100)) bits |= 1 << (adv - 1 - x);
    }
    rows.push(bits);
  }
  glyphs[ch] = { w: adv, r: rows };
  if (adv > maxW) maxW = adv;
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(
  OUT,
  JSON.stringify(
    {
      source: 'Galmuri11-Bold (quiple, OFL-1.1)',
      h: H,
      maxW,
      /** 글리프 상자에 좌우 여백이 이미 포함되어 있어 추가 자간은 0이다 */
      tracking: 0,
      glyphs,
    },
    null,
    0
  ) + '\n',
  'utf8'
);

const sample = ['0', '8', 'A'].map((c) => `${c}:${glyphs[c].w}px`).join(' ');
console.log(`폰트 ${CHARS.length}자 → ${H}px 높이, 최대 폭 ${maxW}  (${sample})`);
console.log(`  → ${OUT}`);
