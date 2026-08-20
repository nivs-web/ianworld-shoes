/**
 * 세 번째 비트맵 폰트 — 갈무리9 **숫자만**. (2026-08-19 23차)
 *
 *   입력 : node_modules/galmuri/dist/Galmuri9.ttf  (OFL-1.1, quiple)
 *   출력 : src/data/font9.generated.json
 *
 * ## 왜 세 번째가 필요했나 — **사다리에 그 칸이 없었다**
 *
 * 사용자 요청: *"숫자가 써 있는 부분 전부 21px 폰트 크기인데, 이 크기를 17~18px 정도로 줄이자"*.
 * 그런데 배율은 정수만 쓰고(§3-1) 글꼴은 11px·7px 두 벌뿐이라 실제로 존재하는 크기는
 *
 *     11 · 14 · 21 · 22 · 28 · 33px
 *
 * 여섯 칸이 전부다 — **17~18 이 아예 없다.** 21 바로 아래가 14 라 세 단계가 뚝 떨어진다.
 * 갈무리9 를 한 벌 더 구우면 **9 × 2 = 18px**, 요청한 크기가 정확히 나온다.
 *
 * ## 숫자만 굽는다
 *
 * 이 폰트를 쓰는 곳은 로비 통계 줄의 **숫자 덩어리 하나뿐**이다(`statLine` 이 `/(\d+)/`
 * 로 숫자만 잘라 캔버스로 바꾼다). 한글까지 구우면 100KB 가 넘는데 한 글자도 안 쓴다.
 * 그래서 숫자와 곁들이 기호만 굽는다 — **1KB 남짓이라 정적 import 로 들어간다.**
 *
 * 정적 import 인 게 중요하다. 7px 폰트는 비동기라 도착 전에는 11px 로 그리는
 * 폴백이 필요했고(로비가 22 → 21 로 한 번 출렁였다), 이 폰트는 그 문제가 아예 없다.
 */

import opentype from 'opentype.js';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = resolve(ROOT, 'node_modules/galmuri/dist/Galmuri9.ttf');
const OUT = resolve(ROOT, 'src/data/font9.generated.json');

/** 갈무리9 = 9px 몸통 */
const H = 9;
/** 숫자 + 곁들이. `?` 는 없는 글자가 왔을 때의 대타라 반드시 있어야 한다 */
const CHARS = '0123456789/%.,:+-'+'?';

const font = opentype.parse(readFileSync(SRC).buffer);
const UPEM = font.unitsPerEm;
const PX = UPEM / 100; // 1픽셀 = 100유닛 (갈무리 공통)

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
  JSON.stringify({ source: 'Galmuri9 (quiple, OFL-1.1)', h: H, maxW, tracking: 0, glyphs }, null, 0) + '\n',
  'utf8'
);

const blank = [...CHARS].filter((c) => glyphs[c].r.every((r) => r === 0));
console.log(`미니 폰트 ${CHARS.length}자 → ${H}px, 최대 폭 ${maxW}`);
if (blank.length) {
  console.error(`빈 글리프: ${blank.join('')}`);
  process.exit(1);
}
