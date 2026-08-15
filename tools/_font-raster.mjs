/** TTF(픽셀 폰트) → 불리언 격자. 100유닛=1px 그리드에 정렬된 폰트 전용. */
import opentype from 'opentype.js';
import { readFileSync } from 'node:fs';

export function loadPixelFont(path) {
  const font = opentype.parse(readFileSync(path).buffer);
  const U = font.unitsPerEm / (font.unitsPerEm / 100); // 항상 100
  return { font, unit: 100, px: font.unitsPerEm / 100 };
}

/** 글리프를 픽셀 격자로. 픽셀 중심(+0.5) 을 path 안/밖으로 판정한다. */
export function rasterGlyph(f, ch, { top, height }) {
  const g = f.font.charToGlyph(ch);
  if (!g || g.unicode === undefined && ch !== ' ') { /* fallthrough */ }
  const path = g.getPath(0, 0, f.font.unitsPerEm); // y축 아래로 뒤집힌 좌표계, baseline=0
  const cmds = path.commands;
  // 폴리곤 목록 (픽셀 폰트라 직선만 나온다고 가정, 곡선은 끝점만 사용)
  const polys = []; let cur = null;
  for (const c of cmds) {
    if (c.type === 'M') { cur = [[c.x, c.y]]; polys.push(cur); }
    else if (c.type === 'L') cur.push([c.x, c.y]);
    else if (c.type === 'Q') cur.push([c.x1, c.y1], [c.x, c.y]);
    else if (c.type === 'C') cur.push([c.x1, c.y1], [c.x2, c.y2], [c.x, c.y]);
  }
  const adv = Math.round((g.advanceWidth / f.font.unitsPerEm) * f.px);
  const W = adv || 1;
  const rows = [];
  for (let py = 0; py < height; py++) {
    let bits = [];
    for (let px = 0; px < W; px++) {
      const X = (px + 0.5) * 100;
      const Y = (top + py + 0.5) * 100; // getPath 좌표계는 y가 아래로 증가
      bits.push(inside(polys, X, Y) ? 1 : 0);
    }
    rows.push(bits);
  }
  return { rows, adv: W };
}

function inside(polys, x, y) {
  let wind = 0;
  for (const p of polys) {
    for (let i = 0; i < p.length; i++) {
      const [x1, y1] = p[i];
      const [x2, y2] = p[(i + 1) % p.length];
      if (y1 <= y) { if (y2 > y && cross(x1, y1, x2, y2, x, y) > 0) wind++; }
      else if (y2 <= y && cross(x1, y1, x2, y2, x, y) < 0) wind--;
    }
  }
  return wind !== 0;
}
const cross = (x1, y1, x2, y2, px, py) => (x2 - x1) * (py - y1) - (px - x1) * (y2 - y1);
