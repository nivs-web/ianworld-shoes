/**
 * 이안 드래곤 게임 — 월드 1 배경 · 아이콘 · 공통 이펙트 (겜팀장 · A2 ③)
 * 배경은 가로로 이어 붙일 수 있게(512칸 주기) · 그라디언트 대신 계단 색 띠 + 바둑판 디더.
 */
import { Pix, part } from './kit.js';
import { RAMP, OUT } from './palette.js';

const TW = 512, TAU = Math.PI * 2;
const wave = (x, ...terms) => terms.reduce((s, [amp, n, ph]) => s + amp * Math.sin((x / TW) * TAU * n + ph), 0);   // 512칸마다 같은 모양

/** 하늘 (512×360) — 해 질 녘 띠 + 구름 */
function sky() {
  const p = new Pix(TW, 360);
  const bands = ['#2a2a6e', '#343a86', '#41509c', '#5a6aae', '#7f86bc', '#b49ac0', '#e2a6a8', '#f6c49a'];
  const bh = 360 / bands.length;
  for (let y = 0; y < 360; y++) {
    const b = Math.min(bands.length - 1, Math.floor(y / bh)), f = (y % bh) / bh;
    for (let x = 0; x < TW; x++) p.set(x, y, f > 0.8 && (x + y) % 2 === 0 && b + 1 < bands.length ? bands[b + 1] : bands[b]);
  }
  for (const [cx, cy, s] of [[60, 70, 1], [200, 40, 0.8], [330, 90, 1.2], [450, 55, 0.9]]) {     // 구름
    for (const [dx, dy, r] of [[0, 0, 14], [14, -6, 12], [28, 0, 13], [12, 6, 12]]) part.ell(p, cx + dx * s, cy + dy * s, r * s, r * 0.6 * s, ['#fff6f0', '#f2d8e0', '#c8a8c8'], { outline: false });
  }
  for (let i = 0; i < 40; i++) { const x = (i * 197) % TW, y = (i * 73) % 120; p.set(x, y, '#ffffff'); }   // 이른 별
  return p;
}
/** 먼 산 (512×140) */
function far() {
  const p = new Pix(TW, 140);
  for (let x = 0; x < TW; x++) {
    const top = Math.round(60 + wave(x, [24, 2, 0.4], [12, 5, 1.3], [5, 11, 2.2]));
    for (let y = top; y < 140; y++) p.set(x, y, y - top < 3 ? '#8a7ab8' : (x + y) % 7 === 0 ? '#5a4e8a' : '#6a5c9c');
    const t2 = Math.round(95 + wave(x, [14, 3, 2.1], [6, 7, 0.2]));
    for (let y = t2; y < 140; y++) p.set(x, y, y - t2 < 2 ? '#6e7ab0' : '#4f5a90');
  }
  return p;
}
/** 가까운 풀숲 (512×80) */
function near() {
  const p = new Pix(TW, 80);
  for (let x = 0; x < TW; x++) {
    const top = Math.round(30 + wave(x, [10, 4, 0.9], [5, 13, 1.7]));
    for (let y = top; y < 80; y++) p.set(x, y, y - top < 2 ? RAMP.leaf[0] : y - top < 8 ? RAMP.leaf[1] : (x * 3 + y) % 11 === 0 ? RAMP.leaf[1] : RAMP.leaf[2]);
    p.set(x, top - 1, OUT);
  }
  for (let i = 0; i < 18; i++) { const x = (i * 29 + 7) % TW, y = Math.round(36 + wave(x, [10, 4, 0.9], [5, 13, 1.7])); p.set(x, y, i % 3 ? '#ffe680' : '#ff9ab0'); }   // 들꽃
  return p;
}
/** 바닥 (512×60) — 흙길 + 풀 테두리 + 조약돌 */
function ground() {
  const p = new Pix(TW, 60);
  for (let y = 0; y < 60; y++) for (let x = 0; x < TW; x++) p.set(x, y, y < 4 ? RAMP.leaf[1] : y < 6 ? RAMP.leaf[2] : (x * 7 + y * 13) % 23 === 0 ? '#8a6a44' : y < 20 ? '#b08a5a' : '#9a7448');
  for (let x = 0; x < TW; x += 3) p.set(x, 4 + (x % 2), RAMP.leaf[0]);
  for (let i = 0; i < 26; i++) { const x = (i * 41 + 11) % (TW - 4), y = 12 + (i * 17) % 40; p.rect(x, y, 3, 2, '#d8c8a8'); p.set(x, y + 2, '#6a4a2a'); }
  return p;
}

/* ───────── 아이콘 (24칸) ───────── */
const ICON = {
  ember: (p) => { part.poly(p, [[12, 2], [19, 12], [17, 20], [12, 22], [7, 20], [5, 12]], ['#ffe680', '#ff8a3a', '#c4521f']); part.ell(p, 12, 16, 3, 4, ['#fff6c0', '#ffd23f', '#f2a020'], { outline: false }); },
  coin: (p) => { part.ell(p, 12, 12, 9, 9, ['#fff1a0', '#f2c230', '#a8780e']); part.ell(p, 12, 12, 5, 5, ['#fff6c0', '#ffd23f', '#c99a1f'], { outline: false }); p.rect(11, 8, 2, 8, '#a8780e'); },
  gem: (p) => { part.poly(p, [[6, 9], [9, 4], [15, 4], [18, 9], [12, 20]], ['#bfe8ff', '#4f9cff', '#2a4ea0']); p.rect(9, 6, 3, 1, '#ffffff'); },
  star: (p) => { part.poly(p, [[12, 2], [15, 9], [22, 9], [16, 14], [18, 21], [12, 17], [6, 21], [8, 14], [2, 9], [9, 9]], ['#fff6a0', '#ffd23f', '#c99a1f']); },
  attr_red: (p) => { part.ell(p, 12, 12, 10, 10, ['#ff9a8a', '#e04a3a', '#8e2020']); part.poly(p, [[12, 5], [16, 12], [14, 17], [10, 17], [8, 12]], ['#fff6c0', '#ffd23f', '#f2a020'], { outline: false }); },
  skill_meteor: (p) => { for (let i = 0; i < 4; i++) p.rect(3 + i * 2, 3 + i * 2, 3, 2, i < 2 ? '#ffe680' : '#ff8a3a'); part.ell(p, 15, 15, 6, 6, ['#d8a878', '#a06a3e', '#6a4026']); p.set(13, 13, '#ffffff'); },
};
function icon(id) { const p = new Pix(24, 24); ICON[id]?.(p); return p; }

/* ───────── 공통 이펙트 (16칸 · 3장) ───────── */
function fx(kind, i) {
  const p = new Pix(16, 16), c = 8;
  if (kind === 'hit') {                                                                           // 타격 별빛
    const r = 3 + i * 2;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) for (let t = 1; t <= r; t++) p.set(c + dx * t, c + dy * t, t > r - 2 ? '#ff8a3a' : '#fff6a0');
    for (const [dx, dy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) for (let t = 1; t <= r - 2; t++) p.set(c + dx * t, c + dy * t, '#ffd23f');
    p.rect(c - 1, c - 1, 3, 3, '#ffffff');
  } else if (kind === 'dust') {                                                                   // 발밑 먼지
    for (const [dx, r] of [[-3, 2 + i], [3, 2 + i], [0, 3 + i]]) part.ell(p, c + dx * (1 + i * 0.5), 12 - i, r, r * 0.7, ['#f2e6d0', '#d8c4a0', '#a89070'], { outline: false });
  } else {                                                                                        // 펑 (쓰러짐)
    const r = 2 + i * 2.2;
    for (let k = 0; k < 6; k++) { const an = (k / 6) * TAU; part.ell(p, c + Math.cos(an) * r, c + Math.sin(an) * r, 2.2 - i * 0.4, 2.2 - i * 0.4, ['#ffffff', '#e8e2f2', '#b8a8d0'], { outline: false }); }
    if (i === 0) p.rect(c - 2, c - 2, 4, 4, '#ffffff');
  }
  return p;
}

export const BG_UI_W1 = {
  'bg/w01/sky': { anims: [], draw: sky, anchor: { x: 0, y: 0 } },
  'bg/w01/far': { anims: [], draw: far, anchor: { x: 0, y: 0 } },
  'bg/w01/near': { anims: [], draw: near, anchor: { x: 0, y: 0 } },
  'bg/w01/ground': { anims: [], draw: ground, anchor: { x: 0, y: 0 } },
  ...Object.fromEntries(Object.keys(ICON).map((id) => [`icon/${id}`, { anims: [], draw: () => icon(id) }])),
  ...Object.fromEntries(['hit', 'dust', 'poof'].map((k) => [`fx/${k}/0`, { anims: ['0', '1', '2'], draw: (a) => fx(k, +a) }])),
};
