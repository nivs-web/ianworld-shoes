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
/**
 * ★ **세 번째 폰트 — 갈무리9, 숫자만.** (2026-08-19 23차)
 *
 * 로비 통계 줄의 숫자를 **18px** 로 그리기 위한 것이다(사용자 지정 "17~18px").
 * 11px·7px 두 벌로 만들 수 있는 크기는 11·14·21·22·28·33 여섯 칸뿐이라 그 사이가 없었다.
 * 9 × 2 = 18 이 정확히 그 자리다.
 *
 * 숫자·기호 18자만 굽는다 — **1KB 미만이라 정적 import 로 들어간다.** 7px 폰트처럼
 * 비동기로 받으면 도착 전 폴백이 필요하고, 그 폴백이 로비를 한 번 출렁이게 만든다.
 * 인게임은 이 폰트를 쓰지 않는다(한글이 없다).
 */
import MINI from '../data/font9.generated.json';

/** 글리프 상자 높이 (베이스라인 포함) */
export const GLYPH_H = FONT.h;
/**
 * 숫자 고정폭 — mono 모드에서 쓰는 셀 폭.
 *
 * ★ **'0' 의 폭이 아니라 "가장 넓은 숫자" 의 폭이다.** (2026-08-26, 버그 수정)
 *
 * 예전에는 `glyphs['0'].w` 를 그대로 썼다. 11px·7px 글꼴은 숫자 폭이 전부 같아서
 * 아무 문제가 없었는데, **9px 글꼴은 '4' 만 7px 이고 나머지는 6px 이었다.**
 * 그러면 `pad = (6 - 7) >> 1 = -1` 이 되어 글자가 셀 왼쪽 밖에서 시작하고,
 * 캔버스가 6px 폭이라 **'4' 의 왼쪽 세로줄이 통째로 잘렸다** — 화면에는 십자가(✛)로 나왔다.
 * 두 게임 모두 로비 숫자에 이 글꼴을 쓰므로 양쪽에서 같은 증상이 났다.
 *
 * 가장 넓은 숫자를 기준으로 잡으면 어떤 글꼴을 굽더라도 넘칠 일이 없다.
 */
const widestDigit = (F) => {
  let w = 0;
  for (const d of '0123456789') { const g = F.glyphs[d]; if (g && g.w > w) w = g.w; }
  return w || 1;
};
export const DIGIT_W = widestDigit(FONT);

/**
 * ★ **두 번째 폰트 — 갈무리7 + 상용 한글 2,350자.** (2026-08-18)
 *
 * 두 가지를 한꺼번에 푼다.
 *
 * 1. **더 작은 글자.** 인게임 폰트가 11px 하나뿐이라 `scale: 1` 이 이미 최소였다.
 *    판돈·알림·등수를 그 크기로 그리면 180×320 안에서 계단이 안 보인다.
 * 2. **닉네임이 '?' 로 나오던 버그.** 11px 폰트는 코드 문자열에 있는 한글만 굽는데
 *    (CLAUDE.md §3-1) 닉네임은 사용자가 지은 글자다. 작은 폰트만은 KS X 1001 2,350자를 다 굽는다.
 *
 * 대신 **필요할 때만 받는다**(gzip 19KB). 싱글만 하는 사람은 받지 않는다.
 * 아직 안 왔으면 큰 폰트로 그린다 — 글자가 커질 뿐 화면이 비지는 않는다.
 *
 * ※ 2026-08-19 에 이 두 벌을 Neo둥근모 16px 한 벌로 바꿨다가 **되돌렸다.**
 *   또렷하긴 한데 도트 게임 특유의 아기자기함이 사라졌다. 인게임은 갈무리,
 *   로비 등 DOM 화면만 Neo둥근모를 쓴다.
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

/**
 * 이 옵션이 실제로 쓸 폰트.
 * `mini` 가 우선한다 — 정적이라 항상 준비돼 있고, 부르는 쪽이 숫자만 넘긴다.
 */
const fontOf = (small, mini) => (mini ? MINI : (small && SMALL ? SMALL : FONT));

/** 그 폰트의 글리프 높이 — 줄 간격 계산에 쓴다 */
export const glyphH = (small, mini) => fontOf(small, mini).h;

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
export function measure(str, scale = 1, mono = false, small = false, mini = false) {
  const F = fontOf(small, mini);
  const s = String(str).toUpperCase();
  if (!s.length) return 0;
  const digitW = widestDigit(F);
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
  const F = fontOf(opt.small, opt.mini);

  let ox = Math.floor(x);
  const oy = Math.floor(y);
  const w = measure(up, s, mono, opt.small, opt.mini);
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
  const digitW = widestDigit(F);
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
/**
 * 96 은 숫자·영문만 쓰던 시절의 값이다. 멀티는 **한글 이름·판돈·알림**을 매 프레임
 * 캐시본으로 찍으므로 금방 넘치고, 넘치면 매 프레임 다시 굽느라 오히려 느려진다.
 * 글리프 하나는 7~11px 짜리 작은 캔버스라 300개라도 메모리가 거의 안 든다.
 */
export const GLYPH_CACHE_MAX = 320;
/** 진단용 — 캐시가 상한에 붙으면 매 프레임 버리고 다시 굽는다(캐시가 손해가 된다) */
export const glyphCacheSize = () => glyphCache.size;

function cachedGlyph(ch, s, color, outline, shadow, mono, small, mini) {
  const F = fontOf(small, mini);
  // 폰트가 셋이 됐으므로 열쇠도 셋을 구별해야 한다 — 안 그러면 9px 글리프가 11px 자리에 붙는다
  const fid = F === FONT ? 'L' : F === SMALL ? 'S' : 'M';
  const key = `${ch}|${s}|${color}|${outline ?? ''}|${shadow ?? ''}|${mono ? 1 : 0}|${fid}`;
  const hit = glyphCache.get(key);
  if (hit) return hit;

  const cell = mono ? widestDigit(F) : glyph(ch, F).w;
  // 외곽선은 사방으로 1도트(=s픽셀) 삐져나온다 — 그만큼 여백을 준다
  const pad = outline || shadow ? s : 0;
  const buf = createBuffer(cell * s + pad * 2, F.h * s + pad * 2);
  text(ch, pad, pad, { color, outline, shadow, scale: s, mono, small, mini, ctx: buf.ctx });

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
  const w = measure(up, s, mono, opt.small, opt.mini);
  if (opt.align === 'center') ox -= w >> 1;
  else if (opt.align === 'right') ox -= w;

  const ctx = opt.ctx ?? getCtx();
  const oy = Math.floor(y);
  for (const ch of up) {
    const g = cachedGlyph(ch, s, color, opt.outline, opt.shadow, mono, opt.small, opt.mini);
    ctx.drawImage(g.canvas, ox - g.pad, oy - g.pad);
    ox += g.advance;
  }
}
