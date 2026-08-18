/**
 * 작은 비트맵 폰트 빌더 — 갈무리7 TTF → 7px 비트마스크 JSON
 *
 *   입력 : node_modules/galmuri/dist/Galmuri7.ttf  (OFL-1.1, quiple)
 *   출력 : src/data/font7.generated.json
 *
 * ## 왜 두 번째 폰트가 필요한가
 *
 * 인게임 글자는 갈무리11 하나뿐이라 `scale: 1` 이 이미 최소였다. 상대 이름·판돈·알림을
 * 같은 크기로 그리면 180×320 안에서 계단이 안 보인다. 7px 폰트가 있어야 세 명분이 들어간다.
 *
 * ## 그리고 진짜 이유 — **닉네임이 '?' 로 나왔다**
 *
 * 11px 폰트는 **코드 문자열에 등장하는 한글만** 굽는다(CLAUDE.md §3-1). 그런데 닉네임은
 * 사용자가 지은 글자다. 실측하니 `토`·`닙` 같은 흔한 글자가 폰트에 없어서 인게임에서
 * `토토` 가 **`??`** 로 보이고 있었다. 그래서 이 폰트만은 **KS X 1001 상용 한글 2,350자**를
 * 통째로 굽는다. 그 대신 멀티에 들어갈 때만 동적으로 받는다(`core/pixelfont.js`).
 *
 * 11,172자를 다 굽지 않는 이유는 용량이다(약 5배). 2,350자는 한국어 실사용 닉네임을
 * 사실상 전부 덮는다 — 못 덮는 글자는 예전처럼 `?` 로 나오되, 그건 드물다.
 */

import opentype from 'opentype.js';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = resolve(ROOT, 'node_modules/galmuri/dist/Galmuri7.ttf');
const OUT = resolve(ROOT, 'src/data/font7.generated.json');

/** 갈무리7 = 7px 몸통 */
const H = 7;
const ASCII =
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz' +
  " .,:;-_/\\!?+*=<>()[]%'\"#&@~^|`$";

/**
 * KS X 1001 완성형 한글 2,350자 — EUC-KR 코드표에서 직접 뽑는다.
 * 목록을 소스에 박아 두면 오타 하나로 글자가 조용히 빠진다.
 */
function ksx1001() {
  const dec = new TextDecoder('euc-kr');
  const out = [];
  for (let hi = 0xb0; hi <= 0xc8; hi++) {
    for (let lo = 0xa1; lo <= 0xfe; lo++) {
      const ch = dec.decode(new Uint8Array([hi, lo]));
      if (/^[가-힣]$/.test(ch)) out.push(ch);
    }
  }
  return out;
}

const HANGUL = ksx1001();
const CHARS = ASCII + HANGUL.join('');

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
  JSON.stringify({ source: 'Galmuri7 (quiple, OFL-1.1)', h: H, maxW, tracking: 0, glyphs }, null, 0) + '\n',
  'utf8'
);

const blank = HANGUL.filter((c) => glyphs[c].r.every((r) => r === 0));
console.log(`작은 폰트 ${CHARS.length}자 (아스키 ${ASCII.length} + 한글 ${HANGUL.length}) → ${H}px, 최대 폭 ${maxW}`);
if (blank.length) {
  console.error(`빈 글리프 ${blank.length}자: ${blank.slice(0, 20).join('')}`);
  process.exit(1);
}
