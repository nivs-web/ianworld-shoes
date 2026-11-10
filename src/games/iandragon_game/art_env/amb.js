/**
 * 분위기 그림 (겜부장) — 화면이 여러 번 뿌려 쓰는 작은 그림들.
 *  amb/glow : 흰 빛무리 (디더 고리) — 화면이 색을 입혀 더하기 섞기로 올린다 (달 · 횃불 · 등 · 독빛)
 *  amb/bat/0~2 : 박쥐 날갯짓 · amb/ghost/0~1 : 떠다니는 유령 · amb/firefly : 반딧불 · amb/fog : 흐르는 안개 띠 (768 주기)
 */
import { Pix } from '../art/kit.js';
import { TW, bayer, noise1 } from './envkit.js';

function glow() {
  const S = 64, p = new Pix(S, S), c = S / 2;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const t = Math.hypot(x + 0.5 - c, y + 0.5 - c) / c;
    if (t >= 1) continue;
    const lvl = t < 0.25 ? 3 : t < 0.5 ? 2 : t < 0.78 ? 1 : 0;
    if ((1 - t) * 1.25 > bayer(x, y) + (3 - lvl) * 0.1) p.set(x, y, ['#404040', '#707070', '#a8a8a8', '#e0e0e0'][lvl]);
  }
  return p;
}

function bat(f) {
  const p = new Pix(18, 12), col = '#120c1e', eye = '#ff4a4a';
  for (let y = 4; y < 9; y++) for (let x = 7; x < 11; x++) p.set(x, y, col);
  p.set(7, 3, col); p.set(10, 3, col);
  const wing = [[[0, 2], [2, 3], [4, 4], [6, 5]], [[0, 6], [2, 6], [4, 6], [6, 6]], [[0, 9], [2, 8], [4, 7], [6, 6]]][f];
  for (const [x, y] of wing) { for (let k = 0; k < 2; k++) { p.set(x + k, y, col); p.set(17 - x - k, y, col); p.set(x + k, y + 1, col); p.set(17 - x - k, y + 1, col); } }
  p.set(8, 5, eye); p.set(10, 5, eye);
  return p;
}

function ghost(f) {
  const p = new Pix(22, 26);
  const body = ['#f4f8ff', '#cfd8f4', '#9aa8d8'];
  for (let y = 0; y < 26; y++) for (let x = 0; x < 22; x++) {
    const head = Math.hypot(x + 0.5 - 11, y + 0.5 - 10) <= 9.5;
    const skirt = y >= 10 && y < 22 + ((x + f * 2) % 6 < 3 ? 2 : 0) && x > 1 && x < 21;
    if (!head && !skirt) continue;
    p.set(x, y, x < 8 && y < 12 ? body[0] : x > 15 ? body[2] : body[1]);
  }
  for (const ex of [7, 13]) { p.rect(ex, 8, 3, 4, '#2a2a4a'); p.set(ex, 8, '#ffffff'); }
  p.rect(9, 14 + f, 4, 2 + f, '#2a2a4a');
  p.set(1 - f + 1, 16, '#cfd8f4'); p.set(20 + f - 1, 16, '#cfd8f4');   // 팔
  return p;
}

function firefly() {
  const p = new Pix(3, 3);
  p.set(1, 1, '#fffbc0'); p.set(0, 1, '#d8f06a'); p.set(2, 1, '#d8f06a'); p.set(1, 0, '#d8f06a'); p.set(1, 2, '#d8f06a');
  return p;
}

function fog() {
  const p = new Pix(TW, 70);
  for (let y = 0; y < 70; y++) for (let x = 0; x < TW; x++) {
    const n = noise1(x, 96, 151) * 0.6 + noise1(x + y * 2, 31, 152) * 0.4;
    const band = 1 - Math.abs(y - 35) / 35;
    if (band * n * 1.15 > bayer(x, y) + 0.25) p.set(x, y, '#b8b0e0');
  }
  return p;
}

export const AMB = {
  'amb/glow': { anims: [], draw: glow, anchor: { x: 0.5, y: 0.5 } },
  'amb/bat': { anims: ['0', '1', '2'], draw: (a) => bat(Number(a)), anchor: { x: 0.5, y: 0.5 } },
  'amb/ghost': { anims: ['0', '1'], draw: (a) => ghost(Number(a)), anchor: { x: 0.5, y: 0.5 } },
  'amb/firefly': { anims: [], draw: firefly, anchor: { x: 0.5, y: 0.5 } },
  'amb/fog': { anims: [], draw: fog, anchor: { x: 0, y: 0 } },
};
