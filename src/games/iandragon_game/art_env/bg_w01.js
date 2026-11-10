/**
 * 월드 1 「초록 언덕」 배경 4겹 — 맑은 낮 (겜부장 · v2)
 *   sky 512×360 (y 0) · far 512×140 (y 160) · near 512×80 (y 220) · ground 512×60 (y 300)
 * 멀수록 하늘색을 섞어 흐리게, 가까울수록 진하고 자세하게. 512칸마다 이음매 없음.
 */
import { Pix } from '../art/kit.js';
import { TW, mix, bayer, ditherPick, noise1, fbm1, hash2, cloud, tree, outlineBlobs } from './envkit.js';

const SKY = ['#2f6fd0', '#3f82dc', '#5296e6', '#68aaee', '#82bff4', '#a0d3f8', '#c2e5fb', '#e2f4fe'];
const HORIZON = '#d8effd';

/* 구름 한 송이 — 원 몇 개를 겹쳐 모양을 만든다 (가운데가 높은 뭉게구름) */
function puff(cx, cy, s) {
  return [[cx, cy, 13 * s], [cx - 15 * s, cy + 5 * s, 10 * s], [cx + 16 * s, cy + 4 * s, 11 * s], [cx - 4 * s, cy - 8 * s, 10 * s],
    [cx + 8 * s, cy - 6 * s, 9 * s], [cx - 26 * s, cy + 9 * s, 6 * s], [cx + 27 * s, cy + 9 * s, 6 * s]];
}

function sky() {
  const p = new Pix(TW, 360);
  for (let y = 0; y < 360; y++) {
    const t = Math.min(1, Math.pow(y / 300, 1.25));
    for (let x = 0; x < TW; x++) p.set(x, y, ditherPick(SKY, t, x, y));
  }
  /* 먼 구름 (작고 하늘색 섞임) → 가까운 구름 (크고 하얗게) */
  const far = (t) => [mix('#ffffff', SKY[4], t), mix('#e8f2ff', SKY[4], t), mix('#bccfee', SKY[4], t), mix('#a7bde6', SKY[4], t)];
  for (const [cx, cy, s] of [[40, 104, 0.55], [190, 96, 0.5], [300, 110, 0.6], [440, 100, 0.5]]) cloud(p, puff(cx, cy, s), far(0.45), { baseY: cy + 6 * s + 3 });
  for (const [cx, cy, s] of [[110, 62, 1.0], [365, 48, 1.15], [250, 82, 0.75], [490, 76, 0.8]]) cloud(p, puff(cx, cy, s), far(0), { baseY: cy + 10 * s });
  return p;
}

/** 먼 산 2줄 — 뒷줄은 하늘에 거의 녹고, 앞줄은 눈 덮인 봉우리 + 왼쪽 빛 */
function far() {
  const p = new Pix(TW, 140);
  const back = ['#a9c4e6', '#93b0da', '#7f9dcf'];
  const front = ['#b2c3e8', '#8d9fd2', '#7083ba', '#5a6aa2'];
  const snow = ['#ffffff', '#e4ecfa', '#b9c7e6'];
  /* 뒷줄 — 뾰족한 봉우리를 만들려고 노이즈를 접는다 (1 - |2n-1| = 능선) */
  const ridge = (x, cells, seed) => { const n = fbm1(((x % TW) + TW) % TW, cells, seed); return 1 - Math.abs(2 * n - 1); };
  for (let x = 0; x < TW; x++) {
    const tb = Math.round(70 - ridge(x, [150, 60, 20], 11) * 58);
    for (let y = tb; y < 140; y++) p.set(x, y, ditherPick(back, Math.min(1, (y - tb) / 60 + (noise1(x + y, 11, 12) - 0.5) * 0.15), x, y));
    if (tb < 34) for (let y = tb; y < tb + 5 - (tb > 26 ? 2 : 0); y++) p.set(x, y, mix('#ffffff', '#a9c4e6', 0.35));   // 먼 눈
  }
  /* 앞줄 — 눈 덮인 봉우리 + 왼쪽 면 빛 + 바위 결 */
  const top = (x) => 92 - ridge(x, [200, 80, 26, 9], 21) * 70;
  for (let x = 0; x < TW; x++) {
    const t = Math.round(top(x));
    for (let y = t; y < 140; y++) {
      const d = y - t;
      /* 명암은 "그 칸에서 능선을 따라 내려가는 방향"으로 — 넓은 경사를 쓰고 아래로 갈수록 흐리게 섞는다 */
      const xs = x + Math.round(d * 0.35);
      const slope = (top(xs + 7) - top(xs - 7)) / 14;           // < 0 : 왼쪽을 본다 = 빛
      let k = 0.42 + Math.max(-0.4, Math.min(0.4, slope * 0.9));
      k = k * (1 - Math.min(0.6, d / 90)) + 0.5 * Math.min(0.6, d / 90) + (noise1(x + y * 3, 13, 31) - 0.5) * 0.12;
      p.set(x, y, ditherPick(front, Math.max(0, Math.min(1, k)), x, y));
      const snowLine = t < 58 ? 26 - t * 0.4 + noise1(x, 5, 41) * 7 : 0;   // 높은 봉우리만 눈
      if (d < snowLine) p.set(x, y, ditherPick(snow, Math.max(0, Math.min(1, 0.35 + slope * 0.9)), x, y));
    }
    p.set(x, t, t < 58 ? '#ffffff' : '#c6d2ee');
  }
  /* 산 아래 깔린 안개 */
  for (let y = 100; y < 140; y++) for (let x = 0; x < TW; x++) if ((y - 100) / 40 > bayer(x, y) + 0.1) p.set(x, y, mix('#93b0da', HORIZON, 0.45));
  return p;
}

/** 가까운 언덕 — 뒤 언덕 줄 + 둥근 나무 숲 + 앞 덤불 · 꽃 · 울타리 */
function near() {
  const p = new Pix(TW, 80);
  const hill = ['#9fdc6a', '#79c255', '#5aa448', '#43863d'];
  const leafFar = ['#8fd166', '#6bb551', '#4c9443'];
  const leaf = ['#b5ec74', '#7fcd4f', '#4f9c3c'];
  const line = '#2c5a2e';
  for (let x = 0; x < TW; x++) {
    const t = Math.round(30 + fbm1(x, [200, 70, 25], 51) * 26);
    for (let y = t; y < 80; y++) p.set(x, y, ditherPick(hill, Math.min(1, (y - t) / 46 + (noise1(x, 31, 52) - 0.5) * 0.2), x, y));
    p.set(x, t, '#c4f08a');
  }
  /* 먼 나무 (작게 · 흐리게) → 가까운 나무 */
  for (let i = 0; i < 14; i++) {
    const x = Math.round((i * 37 + hash2(i, 1, 61) * 20) % TW), y = 44 + Math.round(hash2(i, 2, 61) * 6);
    tree(p, x, y, 5 + Math.round(hash2(i, 3, 61) * 2), leafFar, ['#7a5a3e', '#5c4230'], '#3d6e36');
  }
  for (let i = 0; i < 9; i++) {
    const x = Math.round((i * 57 + 20 + hash2(i, 4, 62) * 24) % TW), y = 60 + Math.round(hash2(i, 5, 62) * 6);
    tree(p, x, y, 8 + Math.round(hash2(i, 6, 62) * 3), leaf, ['#8a6444', '#62452e'], line);
  }
  /* 앞 덤불 줄 (아래 가장자리) */
  const bush = [];
  for (let x = -8; x < TW + 8; x += 11) bush.push([x + hash2(x, 7, 63) * 4, 76 + hash2(x, 8, 63) * 3, 7 + hash2(x, 9, 63) * 4]);
  outlineBlobs(p, bush, line);
  cloud(p, bush, ['#a6e46a', '#6fbe4a', '#4a9440', '#3d7f37'], { wrap: true });
  /* 꽃 · 열매 점 */
  for (let i = 0; i < 70; i++) {
    const x = Math.round(hash2(i, 10, 64) * TW), y = 66 + Math.round(hash2(i, 11, 64) * 12);
    const c = ['#ffffff', '#ffe066', '#ff9ec4', '#ff7a7a'][i % 4];
    if (p.get(x, y)) { p.set(x, y, c); if (i % 3 === 0) p.set(x + 1, y, c); }
  }
  /* 나무 울타리 (군데군데) */
  for (const fx of [70, 230, 400]) {
    for (let k = 0; k < 5; k++) { const px = fx + k * 9; for (let y = 60; y < 78; y++) { p.set(px, y, '#5a3e2a'); p.set(px + 1, y, '#a87c52'); p.set(px + 2, y, '#7e5a3a'); } p.set(px + 1, 59, '#5a3e2a'); }
    for (const ry of [64, 71]) for (let x = fx; x < fx + 40; x++) { p.set(x, ry, '#c49466'); p.set(x, ry + 1, '#6e4c32'); }
  }
  return p;
}

/** 땅 — 풀 윗선(풀잎이 위로 삐침) + 흙 층 + 돌 · 뿌리 */
function ground() {
  const p = new Pix(TW, 60);
  const grass = ['#bdf07a', '#8fd65a', '#68b84a', '#4f9a40'];
  const dirt = ['#c08a5a', '#a87348', '#8a5c3a', '#6e472d', '#55361f'];
  for (let x = 0; x < TW; x++) {
    const g = 6 + Math.round(noise1(x, 9, 71) * 3);
    /* 풀잎 (위로 1~4칸) */
    const blade = hash2(x, 0, 72);
    const bh = blade > 0.8 ? 4 : blade > 0.55 ? 2 : blade > 0.3 ? 1 : 0;
    for (let j = 1; j <= bh; j++) p.set(x, 4 - j, j === bh ? grass[0] : grass[1]);
    for (let y = 4; y < 4 + g; y++) p.set(x, y, ditherPick(grass, (y - 4) / g, x, y));
    /* 풀이 흙 위로 늘어진 술 */
    const hang = hash2(x, 1, 73) > 0.7 ? 2 : hash2(x, 1, 73) > 0.45 ? 1 : 0;
    for (let j = 0; j < hang; j++) p.set(x, 4 + g + j, grass[3]);
    for (let y = 4 + g + hang; y < 60; y++) {
      const strata = (y - 4 - g) / (56 - g) + (noise1(x, 23, 74) - 0.5) * 0.25;
      p.set(x, y, ditherPick(dirt, Math.max(0, Math.min(1, strata)), x, y));
    }
  }
  /* 작은 돌 · 조약돌 */
  for (let i = 0; i < 46; i++) {
    const x = Math.round(hash2(i, 2, 75) * TW), y = 18 + Math.round(hash2(i, 3, 75) * 38), r = 1 + Math.round(hash2(i, 4, 75) * 2);
    for (let dy = -r; dy <= r; dy++) for (let dx = -r - 1; dx <= r + 1; dx++) {
      if ((dx * dx) / ((r + 1) * (r + 1)) + (dy * dy) / (r * r) > 1) continue;
      const c = dy < 0 && dx <= 0 ? '#d8c4a8' : dy > 0 ? '#7a6656' : '#a8927a';
      p.set(((x + dx) % TW + TW) % TW, y + dy, c);
    }
  }
  /* 뿌리 */
  for (let i = 0; i < 12; i++) {
    let x = Math.round(hash2(i, 5, 76) * TW), y = 12;
    for (let k = 0; k < 10; k++) { p.set(x, y, '#4a2e1a'); x += hash2(i, k, 77) > 0.5 ? 1 : 0; y++; }
  }
  return p;
}

export const BG_W01 = {
  'bg/w01/sky': { anims: [], draw: sky, anchor: { x: 0, y: 0 } },
  'bg/w01/far': { anims: [], draw: far, anchor: { x: 0, y: 0 } },
  'bg/w01/near': { anims: [], draw: near, anchor: { x: 0, y: 0 } },
  'bg/w01/ground': { anims: [], draw: ground, anchor: { x: 0, y: 0 } },
};
