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

import { getCtx } from './canvas.js';
import FONT from '../data/font.generated.json';

/** 글리프 상자 높이 (베이스라인 포함) */
export const GLYPH_H = FONT.h;
/** 숫자 고정폭 — mono 모드에서 쓰는 셀 폭 */
export const DIGIT_W = FONT.glyphs['0'].w;

const MISSING = FONT.glyphs['?'];

function glyph(ch) {
  return FONT.glyphs[ch] ?? MISSING;
}

/**
 * 문자열의 픽셀 폭.
 * @param {string} str
 * @param {number} [scale]
 * @param {boolean} [mono] 숫자 고정폭 (스코어처럼 자릿수가 바뀌어도 흔들리면 안 되는 곳)
 */
export function measure(str, scale = 1, mono = false) {
  const s = String(str).toUpperCase();
  if (!s.length) return 0;
  let w = 0;
  for (const ch of s) w += mono ? DIGIT_W : glyph(ch).w;
  return (w + FONT.tracking * (s.length - 1)) * scale;
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
 */
export function text(str, x, y, opt = {}) {
  const s = Math.max(1, opt.scale | 0 || 1);
  const color = opt.color ?? '#ffffff';
  const up = String(str).toUpperCase();
  const mono = !!opt.mono;

  let ox = Math.floor(x);
  const oy = Math.floor(y);
  const w = measure(up, s, mono);
  if (opt.align === 'center') ox -= w >> 1;
  else if (opt.align === 'right') ox -= w;

  if (opt.outline) {
    for (let dy = -s; dy <= s; dy += s) {
      for (let dx = -s; dx <= s; dx += s) {
        if (dx === 0 && dy === 0) continue;
        blit(up, ox + dx, oy + dy, s, opt.outline, mono);
      }
    }
  } else if (opt.shadow) {
    blit(up, ox + s, oy + s, s, opt.shadow, mono);
  }

  blit(up, ox, oy, s, color, mono);
}

function blit(str, x, y, s, color, mono) {
  const ctx = getCtx();
  ctx.fillStyle = color;
  let cx = x;
  for (const ch of str) {
    const g = glyph(ch);
    // 고정폭에서는 좁은 글자('1' 등)를 셀 가운데로 민다
    const pad = mono ? (DIGIT_W - g.w) >> 1 : 0;
    for (let row = 0; row < GLYPH_H; row++) {
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
    cx += ((mono ? DIGIT_W : g.w) + FONT.tracking) * s;
  }
}
