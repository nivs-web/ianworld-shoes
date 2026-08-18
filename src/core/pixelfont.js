/**
 * 비트맵 픽셀 폰트 — 갈무리11 볼드(Galmuri11-Bold, quiple, OFL-1.1).
 *
 * ctx.fillText는 무조건 안티앨리어싱이 걸리므로 절대 쓰지 않는다. (CLAUDE.md §3-1)
 * 글리프는 빌드 타임에 `tools/build-font.mjs` 가 TTF에서 픽셀 격자로 굳혀
 * `src/data/font.generated.json` 에 비트마스크로 저장한다.
 * 여기서는 그 비트를 fillRect로 한 도트씩 찍기만 한다 —
 * 색·외곽선·그림자를 자유롭게 주고, 배율은 정수만 곱한다.
 *
 * 폰트를 바꾸려면 build-font.mjs 의 SRC/H만 고치고 다시 굽는다.
 */

import { getCtx, createBuffer } from './canvas.js';
import FONT from '../data/font.generated.json';

/** 글리프 상자 높이 (베이스라인 포함) */
export const GLYPH_H = FONT.h;
/** 숫자 고정폭 — mono 모드에서 쓰는 셀 폭 */
export const DIGIT_W = FONT.glyphs['0'].w;

/**
 * ★ **두 번째 폰트 — 갈무리7 + 상용 한글 2,350자.** (2026-08-18)
 *
 * 두 가지를 한꺼번에 푼다.
 *
 * 1. **더 작은 글자.** 인게임 폰트가 11px 하나뿐이라 `scale: 1` 이 이미 최소였다.
 *    상대 이름·판돈·알림을 그 크기로 그리면 180×320 안에서 계단이 안 보인다.
 * 2. **닉네임이 '?' 로 나오던 버그.** 11px 폰트는 코드 문자열에 있는 한글만 굽는데
 *    (CLAUDE.md §3-1) 닉네임은 사용자가 지은 글자다. 실측하니 `토`·`닙` 이 없어서
 *    인게임에서 `토토` 가 **`??`** 로 보였다. 작은 폰트만은 KS X 1001 2,350자를 다 굽는다.
 *
 * 대신 **필요할 때만 받는다**(gzip 19KB). 싱글만 하는 사람은 받지 않는다.
 * 아직 안 왔으면 큰 폰트로 그린다 — 글자가 커질 뿐 화면이 비지는 않는다.
 */
let SMALL = null;
let smallLoading = null;

export function loadSmallFont() {
  if (SMALL) return Promise.resolve(SMALL);
  if (!smallLoading) {
    smallLoading = import('../data/font7.generated.json')
      .then((m) => { SMALL = m.default ?? m; return SMALL; })
      .catch(() => { smallLoading = null; return null; });
  }
  return smallLoading;
}

/** 작은 폰트가 준비됐나 (레이아웃을 미리 재는 곳에서 본다) */
export const smallReady = () => !!SMALL;

/** 이 옵션이 실제로 쓸 폰트 */
const fontOf = (small) => (small && SMALL ? SMALL : FONT);

/** 그 폰트의 글리프 높이 — 줄 간격 계산에 쓴다 */
export const glyphH = (small) => fontOf(small).h;

const MISSING = FONT.glyphs['?'];

function glyph(ch, F = FONT) {
  return F.glyphs[ch] ?? F.glyphs['?'] ?? MISSING;
}

/**
 * 문자열의 픽셀 폭.
 * @param {string} str
 * @param {number} [scale]
 * @param {boolean} [mono] 숫자 고정폭 (스코어처럼 자릿수가 바뀌어도 흔들리면 안 되는 곳)
 */
export function measure(str, scale = 1, mono = false, small = false) {
  const F = fontOf(small);
  const s = String(str).toUpperCase();
  if (!s.length) return 0;
  const digitW = F.glyphs['0'].w;
  let w = 0;
  for (const ch of s) w += mono ? digitW : glyph(ch, F).w;
  return (w + F.tracking * (s.length - 1)) * scale;
}

/**
 * 픽셀 텍스트를 그린다. 좌표·배율 모두 정수여야 한다.
 * @param {string} str
 * @param {number} x @param {number} y 좌상단 (글리프 상자 기준)
 * @param {object} [opt]
 * @param {string} [opt.color] 글자색
 * @param {string} [opt.shadow] 그림자색 (오른쪽 아래 1도트)
 * @param {string} [opt.outline] 외곽선색 (8방향 1도트)
 * @param {number} [opt.scale] 정수 배율
 * @param {'left'|'center'|'right'} [opt.align]
 * @param {boolean} [opt.mono] 고정폭
 * @param {CanvasRenderingContext2D} [opt.ctx] 그릴 대상 (기본: 게임 캔버스).
 *   DOM 화면에서도 같은 글자를 쓰려고 열어 뒀다 — screens/pixelText.js 참고.
 */
export function text(str, x, y, opt = {}) {
  const ctx = opt.ctx ?? getCtx();
  const s = Math.max(1, opt.scale | 0 || 1);
  const color = opt.color ?? '#ffffff';
  const up = String(str).toUpperCase();
  const mono = !!opt.mono;
  const F = fontOf(opt.small);

  let ox = Math.floor(x);
  const oy = Math.floor(y);
  const w = measure(up, s, mono, opt.small);
  if (opt.align === 'center') ox -= w >> 1;
  else if (opt.align === 'right') ox -= w;

  if (opt.outline) {
    for (let dy = -s; dy <= s; dy += s) {
      for (let dx = -s; dx <= s; dx += s) {
        if (dx === 0 && dy === 0) continue;
        blit(ctx, up, ox + dx, oy + dy, s, opt.outline, mono, F);
      }
    }
  } else if (opt.shadow) {
    blit(ctx, up, ox + s, oy + s, s, opt.shadow, mono, F);
  }

  blit(ctx, up, ox, oy, s, color, mono, F);
}

function blit(ctx, str, x, y, s, color, mono, F = FONT) {
  ctx.fillStyle = color;
  const digitW = F.glyphs['0'].w;
  let cx = x;
  for (const ch of str) {
    const g = glyph(ch, F);
    // 고정폭에서는 좁은 글자('1' 등)를 셀 가운데로 민다
    const pad = mono ? (digitW - g.w) >> 1 : 0;
    for (let row = 0; row < F.h; row++) {
      const bits = g.r[row];
      if (!bits) continue;
      let run = 0;
      for (let col = 0; col < g.w; col++) {
        // 왼쪽 비트가 x=0
        if (bits & (1 << (g.w - 1 - col))) {
          run++;
          continue;
        }
        if (run) {
          ctx.fillRect(cx + (pad + col - run) * s, y + row * s, run * s, s);
          run = 0;
        }
      }
      if (run) ctx.fillRect(cx + (pad + g.w - run) * s, y + row * s, run * s, s);
    }
    cx += ((mono ? digitW : g.w) + F.tracking) * s;
  }
}

// ─────────────────────────────────────────────
// 글자 캐시 — HUD 처럼 매 프레임 찍는 글자용
// ─────────────────────────────────────────────

/**
 * ★ **외곽선은 렌더 비용을 정확히 9배로 만든다.** (2026-08-16)
 *
 * `outline` 이 켜지면 `blit()` 이 8방향 + 본체 = **글리프를 9번** 찍는다.
 * HUD 의 세 텍스트(계단수·신발수·부활수)가 전부 외곽선을 쓰는데, 폰트 비트마스크로
 * 실제 `fillRect` 호출 수를 세어 보니 **프레임당 666회**(계단수 333 + 신발수 216 +
 * 부활 117) 였다. 초당 4만 번이다. 180×320 캔버스에서 이건 중저가 안드로이드의
 * 60fps 를 깨는 크기다.
 *
 * 그런데 이 글자들은 **거의 안 바뀐다** — 계단수는 한 칸 오를 때만, 신발수·부활수는
 * 주울 때만 바뀐다. 그래서 **글자 하나씩 오프스크린 버퍼에 구워 두고** 그 뒤로는
 * `drawImage` 만 한다. "999" 는 fillRect 333회 → drawImage 3회가 된다.
 *
 * 문자열이 아니라 **글자 단위로** 캐시하는 이유: 계단수는 매 층 달라지므로 문자열로
 * 캐시하면 층마다 캔버스를 새로 만든다. 글자 단위면 숫자 10개만 구우면 끝이다.
 */
const glyphCache = new Map();
const GLYPH_CACHE_MAX = 96;

function cachedGlyph(ch, s, color, outline, shadow, mono, small) {
  const F = fontOf(small);
  const key = `${ch}|${s}|${color}|${outline ?? ''}|${shadow ?? ''}|${mono ? 1 : 0}|${F === FONT ? 'L' : 'S'}`;
  const hit = glyphCache.get(key);
  if (hit) return hit;

  const cell = mono ? F.glyphs['0'].w : glyph(ch, F).w;
  // 외곽선은 사방으로 1도트(=s픽셀) 삐져나온다 — 그만큼 여백을 준다
  const pad = outline || shadow ? s : 0;
  const buf = createBuffer(cell * s + pad * 2, F.h * s + pad * 2);
  text(ch, pad, pad, { color, outline, shadow, scale: s, mono, small, ctx: buf.ctx });

  const entry = { canvas: buf.canvas, pad, advance: (cell + F.tracking) * s };
  // 오래된 것부터 버린다 (Map 은 넣은 순서를 지킨다)
  if (glyphCache.size >= GLYPH_CACHE_MAX) glyphCache.delete(glyphCache.keys().next().value);
  glyphCache.set(key, entry);
  return entry;
}

/**
 * `text()` 와 같은 결과를 내지만 **글자를 미리 구워 두고 붙인다.**
 * 매 프레임 그리는 곳(HUD)에만 쓴다. 한 번만 그리는 화면은 `text()` 로 충분하다.
 */
export function textCached(str, x, y, opt = {}) {
  const up = String(str).toUpperCase();
  if (!up.length) return;
  const s = Math.max(1, opt.scale | 0 || 1);
  const mono = !!opt.mono;
  const color = opt.color ?? '#ffffff';

  let ox = Math.floor(x);
  const w = measure(up, s, mono, opt.small);
  if (opt.align === 'center') ox -= w >> 1;
  else if (opt.align === 'right') ox -= w;

  const ctx = opt.ctx ?? getCtx();
  const oy = Math.floor(y);
  for (const ch of up) {
    const g = cachedGlyph(ch, s, color, opt.outline, opt.shadow, mono, opt.small);
    ctx.drawImage(g.canvas, ox - g.pad, oy - g.pad);
    ox += g.advance;
  }
}
