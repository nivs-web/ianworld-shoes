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
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = resolve(ROOT, 'node_modules/galmuri/dist/Galmuri11-Bold.ttf');
const OUT = resolve(ROOT, 'src/data/font.generated.json');

/**
 * 갈무리11 = 11px 몸통. 베이스라인 기준 위로 11px가 글리프 상자다.
 *
 * ★ **Neo둥근모 16px 로 갈아탔다가 되돌렸다.** (2026-08-19)
 * 16px 는 또렷하지만 **도트 게임의 아기자기한 맛이 사라진다** — 글자가 화면을 차지하는
 * 비중이 커서 계단·캐릭터보다 UI가 먼저 눈에 들어왔다. 인게임은 갈무리(11px + 7px)로
 * 되돌리고, **로비 등 DOM 화면만 Neo둥근모**를 쓴다(reset.css).
 */
const H = 11;
const ASCII =
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ' +
  " .,:;-_/\\!?+*=<>()[]%'\"#&@~^|`$";

/**
 * 한글은 11,172자를 전부 구우면 3MB가 넘는다. 그래서 **코드가 실제로 쓰는 글자만** 굽는다.
 *
 * 수집 기준은 `src/**` 의 **문자열 리터럴** 안에 있는 한글이다. 주석은 제외한다 —
 * 이 저장소는 주석이 전부 한글이라 같이 긁으면 쓰지도 않는 글자가 배로 늘어난다.
 *
 * 자동 수집인 이유: 목록을 손으로 관리하면 새 문구를 추가한 날 그 글자만
 * 캔버스에서 조용히 안 그려진다. 빈 화면은 원인을 찾기 제일 어려운 종류의 버그다.
 */
/**
 * 문자열과 주석을 **한 번에** 훑고 문자열만 남긴다.
 *
 * 주석을 먼저 지우고 문자열을 찾으면 `'https://...'` 의 `//` 부터 줄 끝이 날아간다.
 * 반대로 문자열만 찾으면 주석 안에 따옴표로 인용한 말("이 값은 힌트다" 같은)이
 * 문자열로 잡혀 쓰지도 않는 글자가 슬금슬금 늘어난다 — 실제로 그렇게 6자가 섞였다.
 * 하나의 교대(alternation)로 왼쪽부터 훑으면 둘 다 제자리에서 잡힌다.
 */
const TOKEN = /'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`|\/\/[^\n]*|\/\*[\s\S]*?\*\//g;
const isComment = (t) => t.startsWith('//') || t.startsWith('/*');

function collectHangul(dir, out = new Set()) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) collectHangul(p, out);
    else if (name.endsWith('.js')) {
      const src = readFileSync(p, 'utf8');
      for (const tok of src.match(TOKEN) ?? []) {
        if (isComment(tok)) continue;
        for (const ch of tok.match(/[가-힣]/g) ?? []) out.add(ch);
      }
    }
  }
  return out;
}

const HANGUL = [...collectHangul(resolve(ROOT, 'src'))].sort();
const CHARS = ASCII + HANGUL.join('');

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
console.log(`폰트 ${CHARS.length}자 (아스키 ${ASCII.length} + 한글 ${HANGUL.length}) → ${H}px 높이, 최대 폭 ${maxW}  (${sample})`);

// 한글 글리프가 통째로 비면(=폰트에 없음) 화면에 아무것도 안 그려진다. 조용히 넘기지 않는다.
const blank = HANGUL.filter((c) => glyphs[c].r.every((row) => row === 0));
if (blank.length) {
  console.error(`  [!] 빈 글리프 ${blank.length}자: ${blank.slice(0, 20).join('')}`);
  process.exit(1);
}
console.log(`  → ${OUT}`);
