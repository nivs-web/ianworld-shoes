/**
 * 월드 1 「달밤 초록 언덕」 — 땅 쪽 겹 (겜부장 · 그림 v3 · 960×540)
 *   mid 768×190 (y 270) · near 768×100 (y 360) · ground 768×90 (y 450) · fg/left · fg/right (화면 아래 모서리 고정)
 * 배치표로 소품을 늘어놓는다 (소품은 props.js 한 번만 그림). 빛 나는 소품 자리는 LIGHTS_W01_LAND.
 */
import { Pix } from '../art/kit.js';
import { TW, ditherPick, noise1, fbm1, hash2, bayer, cloud, outlineBlobs } from './envkit.js';
import { deadTree, gravestone, lampPost, fence, pumpkin, mushrooms, bone, skull, sign, rock, grassTuft } from './props.js';

export const LIGHTS_W01_LAND = { mid: [], near: [], ground: [], fgLeft: [], fgRight: [] };

/** 가운데 언덕 — 어두운 청록 풀밭 + 달빛 능선 · 비틀린 나무 · 묘지 · 가로등 · 울타리 */
function mid() {
  const p = new Pix(TW, 190), L = LIGHTS_W01_LAND.mid; L.length = 0;
  const hill = ['#2f5a5e', '#26484e', '#1d3a42', '#152c34'];
  const top = (x) => 66 + fbm1(((x % TW) + TW) % TW, [300, 110, 36], 101) * 54;
  for (let x = 0; x < TW; x++) {
    const t = Math.round(top(x)), slope = top(x + 4) - top(x - 4);
    for (let y = t; y < 190; y++) p.set(x, y, ditherPick(hill, Math.min(1, (y - t) / 110 + (noise1(x + y, 17, 102) - 0.5) * 0.15), x, y));
    p.set(x, t, slope < 0 ? '#6aa89a' : '#3e7070'); if (slope < -0.4) p.set(x, t + 1, '#4e8a80');
  }
  /* 배치표 : [종류, x, 크기/옵션] */
  const plan = [
    ['tree', 40, 70, 1], ['grave', 120, 0], ['grave', 140, 1], ['lamp', 175, 58], ['fence', 200, 7], ['tree', 330, 86, 2], ['grave', 300, 2],
    ['grave', 395, 0], ['grave', 412, 1], ['grave', 430, 0], ['lamp', 470, 62], ['tree', 540, 64, 3], ['fence', 590, 6], ['grave', 680, 2], ['lamp', 720, 56],
  ];
  for (const [kind, x, a, b] of plan) {
    const y = Math.round(top(x)) + 4;
    if (kind === 'tree') deadTree(p, x, y, a, { seed: b, bark: ['#7a6a8e', '#4a3e60', '#2a223c'] });
    else if (kind === 'grave') gravestone(p, x, y, { kind: a, s: 1.1 });
    else if (kind === 'lamp') lampPost(p, x, y, a, L);
    else if (kind === 'fence') fence(p, x, y, a);
  }
  return p;
}

/** 가까운 덤불 — 짙은 초록 덤불 줄 + 호박등 + 풀 포기 */
function near() {
  const p = new Pix(TW, 100), L = LIGHTS_W01_LAND.near; L.length = 0;
  const bush = [];
  for (let x = -12; x < TW + 12; x += 15) bush.push([x + hash2(x, 1, 111) * 6, 82 + hash2(x, 2, 111) * 8, 10 + hash2(x, 3, 111) * 8]);
  outlineBlobs(p, bush, '#0c1c18');
  cloud(p, bush, ['#4e9a72', '#2e6a52', '#1e4a3c', '#163a30'], { wrap: true });
  for (let i = 0; i < 40; i++) grassTuft(p, Math.round(hash2(i, 4, 112) * TW), 98, 6 + Math.round(hash2(i, 5, 112) * 6), ['#5aa078', '#2e6a52']);
  for (const [x, s] of [[150, 1.1], [420, 0.9], [640, 1.2]]) pumpkin(p, x, 96, s, L);
  for (const x of [80, 300, 520, 730]) rock(p, x, 99, 9, 6);
  return p;
}

/** 땅 — 달빛 받은 밝은 풀 윗선 + 보라 흙 단면 · 묻힌 뼈 · 해골 · 뿌리 · 독 슬라임 · 빛 버섯 */
function ground() {
  const p = new Pix(TW, 90), L = LIGHTS_W01_LAND.ground; L.length = 0;
  const grass = ['#9cf07a', '#6ad05a', '#45a04a', '#2e7a3e'];
  const dirt = ['#5e4462', '#4c3652', '#3c2a44', '#2c1e34', '#1e1426'];
  for (let x = 0; x < TW; x++) {
    const g = 9 + Math.round(noise1(x, 11, 121) * 4);
    const bl = hash2(x, 0, 122), bh = bl > 0.82 ? 5 : bl > 0.55 ? 3 : bl > 0.3 ? 1 : 0;
    for (let j = 1; j <= bh; j++) p.set(x, 6 - j, j === bh ? grass[0] : grass[1]);
    for (let y = 6; y < 6 + g; y++) p.set(x, y, ditherPick(grass, (y - 6) / g, x, y));
    const hang = hash2(x, 1, 123) > 0.72 ? 3 : hash2(x, 1, 123) > 0.45 ? 1 : 0;   // 흙 위로 늘어진 풀
    for (let j = 0; j < hang; j++) p.set(x, 6 + g + j, grass[3]);
    for (let y = 6 + g + hang; y < 90; y++) p.set(x, y, ditherPick(dirt, Math.max(0, Math.min(1, (y - 6 - g) / (84 - g) + (noise1(x, 29, 124) - 0.5) * 0.3)), x, y));
  }
  for (let i = 0; i < 14; i++) bone(p, Math.round(hash2(i, 2, 125) * (TW - 12)), 34 + Math.round(hash2(i, 3, 125) * 46), 6 + Math.round(hash2(i, 4, 125) * 6), '#c8bca8');
  for (const [x, y] of [[180, 62], [520, 74]]) skull(p, x, y, 1.1);
  for (let i = 0; i < 16; i++) { let x = Math.round(hash2(i, 5, 126) * TW), y = 16; for (let k = 0; k < 16; k++) { p.set(x, y, '#2a1a22'); if (hash2(i, k, 127) > 0.5) x++; else if (hash2(i, k, 128) > 0.6) x--; y++; } }
  for (const [x, y, w] of [[90, 48, 22], [400, 40, 30], [690, 56, 20]]) {   // 독 슬라임 웅덩이
    for (let j = 0; j < 8; j++) for (let i = 0; i < w; i++) if (((i - w / 2) * (i - w / 2)) / ((w / 2) * (w / 2)) + ((j - 4) * (j - 4)) / 16 <= 1) p.set(x + i, y + j, ditherPick(['#c8ff6a', '#7fe04a', '#3a9a2a'], j / 8, x + i, j));
    L.push({ x: x + w / 2, y: y + 4, r: 20, color: 0x8aff5a });
  }
  for (const x of [260, 600]) for (let k = 0; k < 4; k++) p.set(x + k * 3, 5 + 7 + k, '#c8ff6a');   // 흘러내린 슬라임
  return p;
}

/** 화면 왼쪽 아래 앞 장식 — 뼈 더미 · 해골 표지판 · 부서진 말뚝 · 빛 버섯 */
function fgLeft() {
  const p = new Pix(240, 150), L = LIGHTS_W01_LAND.fgLeft; L.length = 0;
  for (let x = 0; x < 240; x++) { const t = Math.round(110 + (x / 240) * 30 + noise1(x, 13, 131, 240) * 6); for (let y = t; y < 150; y++) p.set(x, y, ditherPick(['#3a2a40', '#2a1e30', '#1a1220'], (y - t) / 30, x, y)); }
  sign(p, 60, 128, 1.5);
  for (let k = 0; k < 4; k++) { const fx = 120 + k * 16, h = 34 - k * 6; for (let j = 0; j < h; j++) for (let i = 0; i < 6; i++) p.set(fx + i + Math.round((k - 1) * j / 10), 132 - j, ['#6e5a50', '#5a4840', '#4a3a34', '#3a2c28', '#2a1e1c', '#1e1414'][i]); }
  for (const [x, y] of [[20, 130], [36, 136], [96, 138]]) skull(p, x, y, 1.4);
  for (let i = 0; i < 8; i++) bone(p, 6 + i * 14, 140 + (i % 3) * 3, 10);
  mushrooms(p, 196, 138, 5, L);
  return p;
}

/** 화면 오른쪽 아래 앞 장식 — 기운 울타리 · 빛 버섯 · 풀 */
function fgRight() {
  const p = new Pix(240, 150), L = LIGHTS_W01_LAND.fgRight; L.length = 0;
  for (let x = 0; x < 240; x++) { const t = Math.round(140 - (x / 240) * 30 + noise1(x, 13, 141, 240) * 6); for (let y = t; y < 150; y++) p.set(x, y, ditherPick(['#3a2a40', '#2a1e30', '#1a1220'], (y - t) / 30, x, y)); }
  for (let k = 0; k < 6; k++) { const fx = 70 + k * 26, h = 46 + (k % 2) * 8; for (let j = 0; j < h; j++) for (let i = 0; i < 7; i++) p.set(fx + i + Math.round(j / 9), 140 - j, ['#7a6658', '#64524a', '#52423c', '#40322e', '#2e2220', '#201616', '#160e0e'][i]); }
  for (const ry of [104, 122]) for (let x = 64; x < 236; x++) { p.set(x, ry + Math.round((x - 64) / 40), '#7a6658'); p.set(x, ry + 1 + Math.round((x - 64) / 40), '#2e2220'); }
  mushrooms(p, 40, 140, 6, L, ['#9af0ff', '#4ab8e8', '#2a6a9a']);
  for (let i = 0; i < 14; i++) grassTuft(p, 6 + i * 17, 148, 10 + (i % 3) * 3, ['#4e8a60', '#2a5a40']);
  return p;
}

export const BG_W01_LAND = {
  'bg/w01/mid': { anims: [], draw: mid, anchor: { x: 0, y: 0 } },
  'bg/w01/near': { anims: [], draw: near, anchor: { x: 0, y: 0 } },
  'bg/w01/ground': { anims: [], draw: ground, anchor: { x: 0, y: 0 } },
  'fg/w01/left': { anims: [], draw: fgLeft, anchor: { x: 0, y: 1 } },
  'fg/w01/right': { anims: [], draw: fgRight, anchor: { x: 1, y: 1 } },
};
