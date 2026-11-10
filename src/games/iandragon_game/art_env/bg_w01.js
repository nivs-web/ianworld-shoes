/**
 * 월드 1 「달밤 초록 언덕」 — 하늘 쪽 겹 (겜부장 · 그림 v3 · 960×540)
 *   sky 768×540 · moon 200×200 · clouds 768×260 · castle 360×240 · far 768×200
 * 짙은 남보라 밤 · 보름달(빛무리) · 달빛을 받은 밤구름 · 언덕 너머 좀비 드래곤 성(마지막 목적지) · 먼 언덕과 풍차.
 * 빛 나는 곳(성 창문 · 풍차)은 LIGHTS 로 내보내 화면이 빛무리를 얹는다.
 */
import { Pix } from '../art/kit.js';
import { TW, mix, bayer, ditherPick, noise1, fbm1, hash2, cloud } from './envkit.js';
import { deadTree, windmill, star } from './props.js';

export const SKY = ['#0b0a2a', '#121038', '#1a1748', '#241f5a', '#30286c', '#3e317c', '#4e3b8a', '#5f4794'];
export const LIGHTS_W01 = { castle: [], far: [] };

function sky() {
  const p = new Pix(TW, 540);
  for (let y = 0; y < 540; y++) {
    const t = Math.min(1, Math.pow(y / 430, 1.4));
    for (let x = 0; x < TW; x++) p.set(x, y, ditherPick(SKY, t, x, y));
  }
  for (let i = 0; i < 260; i++) {                                       // 별 (위쪽일수록 많이)
    const x = Math.floor(hash2(i, 1, 5) * TW), y = Math.floor(Math.pow(hash2(i, 2, 5), 1.8) * 300);
    star(p, x, y, hash2(i, 3, 5) > 0.93);
    if (hash2(i, 4, 5) > 0.6) p.set(x, y, mix('#ffffff', SKY[2], 0.5));
  }
  return p;
}

/** 보름달 + 빛무리 (디더 고리) — 판 가운데 (100, 100) */
function moon() {
  const p = new Pix(200, 200), cx = 100, cy = 100, R = 42;
  for (let y = 0; y < 200; y++) for (let x = 0; x < 200; x++) {
    const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
    if (d > R && d < 98) {                                               // 빛무리 : 3겹 고리가 바깥으로 흐려진다
      const t = (d - R) / (98 - R);
      const lvl = t < 0.18 ? 3 : t < 0.42 ? 2 : t < 0.75 ? 1 : 0;
      const fr = lvl === 3 ? 1 - t / 0.18 : lvl === 2 ? 1 - (t - 0.18) / 0.24 : lvl === 1 ? 1 - (t - 0.42) / 0.33 : 1 - (t - 0.75) / 0.25;
      const col = ['#3a2f7a', '#5a4c9a', '#8a7cbc', '#c8bce0'][lvl];
      if (fr * 0.9 > bayer(x, y)) p.set(x, y, col);
    } else if (d <= R) {
      const lx = (x - cx) / R, ly = (y - cy) / R;
      let k = 0.15 + lx * 0.35 + ly * 0.25;                              // 오른쪽 아래가 살짝 어둡다
      const crater = [[-14, -10, 9], [12, 6, 12], [-6, 18, 7], [18, -16, 6], [-20, 8, 5]].some(([ox, oy, r]) => Math.hypot(x - cx - ox, y - cy - oy) < r);
      if (crater) k += 0.3;
      p.set(x, y, ditherPick(['#fffbe6', '#fbefc0', '#eedc9e', '#d6c282', '#bca86e'], Math.max(0, Math.min(1, k)), x, y));
    }
  }
  return p;
}

/** 밤구름 — 위쪽(달 쪽)이 연보라로 빛나고 아래는 어둡다 */
function clouds() {
  const p = new Pix(TW, 260);
  const tones = (f) => [mix('#b8a8e8', SKY[3], f), mix('#8270c0', SKY[3], f), mix('#574896', SKY[3], f), mix('#3c3076', SKY[3], f)];
  const puff = (cx, cy, s) => [[cx, cy, 20 * s], [cx - 24 * s, cy + 8 * s, 15 * s], [cx + 26 * s, cy + 6 * s, 17 * s], [cx - 6 * s, cy - 12 * s, 15 * s],
    [cx + 12 * s, cy - 9 * s, 13 * s], [cx - 42 * s, cy + 13 * s, 9 * s], [cx + 44 * s, cy + 13 * s, 10 * s]];
  for (const [cx, cy, s] of [[90, 150, 0.6], [330, 170, 0.55], [560, 140, 0.65], [720, 175, 0.5]]) cloud(p, puff(cx, cy, s), tones(0.45), { baseY: cy + 10 * s + 3 });
  for (const [cx, cy, s] of [[200, 70, 1.2], [470, 50, 1.0], [680, 90, 1.1], [30, 100, 0.8]]) cloud(p, puff(cx, cy, s), tones(0), { baseY: cy + 16 * s });
  return p;
}

/** 언덕 위 좀비 드래곤 성 실루엣 — 뾰족 탑 · 해골 얼굴 대문 · 노란 창 */
function castle() {
  const W = 360, H = 240, p = new Pix(W, H);
  const body = ['#2c2654', '#211d44', '#181436'], rim = '#4a4282';
  const L = LIGHTS_W01.castle; L.length = 0;
  for (let x = 0; x < W; x++) {                                          // 바위 언덕
    const t = Math.round(170 + Math.abs(x - W / 2) * 0.32 + (noise1(x, 23, 81, W) - 0.5) * 14);
    for (let y = t; y < H; y++) p.set(x, y, ditherPick(['#221e48', '#1a1638', '#13102c'], (y - t) / 70 + (x > W / 2 ? 0.2 : 0), x, y));
    p.set(x, t, x < W / 2 ? rim : '#2c2654');
  }
  const towers = [[70, 60, 22], [120, 30, 26], [180, 6, 34], [240, 34, 24], [290, 66, 20]];
  for (const [tx, top, w] of towers) {
    for (let y = top + w; y < 190; y++) for (let x = tx - w / 2; x < tx + w / 2; x++) p.set(x, y, ditherPick(body, (x - (tx - w / 2)) / w, x, y));
    for (let y = top; y < top + w; y++) { const half = ((y - top) / w) * (w / 2 + 3); for (let x = Math.round(tx - half); x <= Math.round(tx + half); x++) p.set(x, y, ditherPick(body, (x - tx + half) / (2 * half + 1) + 0.15, x, y)); }
    for (let y = top - 8; y < top; y++) p.set(tx, y, body[2]);
    for (let y = top + w; y < 190; y++) p.set(Math.round(tx - w / 2), y, rim);   // 달빛 테두리
    for (let k = 0; k < 3; k++) {                                        // 창
      const wy = top + w + 8 + k * 22; if (wy > 180) break;
      if (hash2(tx, k, 83) > 0.3) { p.rect(tx - 2, wy, 4, 6, '#ffd860'); p.rect(tx - 2, wy, 4, 2, '#fff3a0'); L.push({ x: tx, y: wy + 3, r: 10, color: 0xffcc55 }); }
    }
  }
  for (let y = 120; y < 190; y++) for (let x = 60; x < 300; x++) p.set(x, y, ditherPick(body, 0.2 + (x - 60) / 300, x, y));   // 성벽
  for (let x = 60; x < 300; x += 8) p.rect(x, 116, 5, 4, body[1]);                                                              // 성가퀴
  const sx = 180, sy = 150;                                              // 드래곤 해골 대문
  for (let y = -22; y <= 22; y++) for (let x = -26; x <= 26; x++) {
    const d = (x * x) / (26 * 26) + (y * y) / (20 * 20);
    if (d > 1 && !(y > 8 && Math.abs(x) < 16)) continue;
    p.set(sx + x, sy + y, y > 12 ? '#a89c88' : ditherPick(['#e8dcc4', '#c8baa0', '#9a8c76'], (x + 26) / 52 + y / 60, x, y));
  }
  for (const ex of [-12, 6]) { p.rect(sx + ex, sy - 6, 7, 6, '#0c0a1a'); p.rect(sx + ex + 2, sy - 4, 3, 2, '#9aff6a'); L.push({ x: sx + ex + 3, y: sy - 3, r: 9, color: 0x9aff6a }); }
  for (let x = -12; x <= 12; x += 4) p.rect(sx + x, sy + 12, 2, 6, '#e8dcc4');
  for (const hx of [-24, 22]) for (let k = 0; k < 14; k++) p.set(sx + hx + (hx < 0 ? -k : k) * 0.6, sy - 18 - k, '#c8baa0');   // 뿔
  return p;
}

/** 먼 언덕 — 달빛 받은 능선 · 작은 죽은 나무 · 풍차 */
function far() {
  const p = new Pix(TW, 200);
  const hill = ['#2c2c62', '#242456', '#1c1c48', '#15153a'];
  const L = LIGHTS_W01.far; L.length = 0;
  const top = (x) => 70 + fbm1(((x % TW) + TW) % TW, [260, 90, 30], 91) * 60;
  for (let x = 0; x < TW; x++) {
    const t = Math.round(top(x)), slope = top(x + 4) - top(x - 4);
    for (let y = t; y < 200; y++) p.set(x, y, ditherPick(hill, Math.min(1, (y - t) / 120 + (slope > 0 ? 0.2 : 0)), x, y));
    p.set(x, t, slope < 0 ? '#5a5aa0' : '#3a3a76');
    if (slope < -0.5) p.set(x, t + 1, '#46468a');
  }
  for (let i = 0; i < 16; i++) { const x = Math.round((i * 48 + hash2(i, 1, 93) * 30) % TW); deadTree(p, x, Math.round(top(x)) + 3, 22 + Math.round(hash2(i, 2, 93) * 10), { seed: i, bark: ['#3a3a70', '#2a2a5a', '#1e1e48'] }); }
  windmill(p, 600, Math.round(top(600)) + 6, 1.1, ['#34346a', '#26265a', '#1c1c4a'], L);
  return p;
}

export const BG_W01_SKY = {
  'bg/w01/sky': { anims: [], draw: sky, anchor: { x: 0, y: 0 } },
  'bg/w01/moon': { anims: [], draw: moon, anchor: { x: 0.5, y: 0.5 } },
  'bg/w01/clouds': { anims: [], draw: clouds, anchor: { x: 0, y: 0 } },
  'bg/w01/castle': { anims: [], draw: castle, anchor: { x: 0.5, y: 1 } },
  'bg/w01/far': { anims: [], draw: far, anchor: { x: 0, y: 0 } },
};
