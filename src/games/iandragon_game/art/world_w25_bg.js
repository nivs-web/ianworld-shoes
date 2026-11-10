/**
 * 이안 드래곤 게임 — 월드 2~5 배경 (겜팀장 · A2). 전부 오리지널 · 코드로 찍은 도트.
 * 월드 1 과 같은 규격: 하늘 512×360 · 먼 곳 512×140 · 가까운 곳 512×80 · 바닥 512×60.
 * 무늬는 모두 x mod 512 의 함수(wave · hash · 512 의 약수 주기)라 0번 열이 511번 열에 그대로 이어진다.
 * 가장자리를 넘는 물체(섬 · 나무 · 연기)는 wrap() 으로 반대쪽에 한 번 더 찍는다.
 */
import { Pix, part } from './kit.js';
import { OUT } from './palette.js';

const TW = 512, TAU = Math.PI * 2;
const wave = (x, ...t) => t.reduce((s, [a, n, ph]) => s + a * Math.sin((x / TW) * TAU * n + ph), 0);
export const hash = (x, y = 0, s = 0) => {
  let h = (Math.imul(((x % TW) + TW) % TW, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 982451653)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const wrap = (fn) => { for (const o of [-TW, 0, TW]) fn(o); };
const dd = (x, cx) => ((((x - cx) % TW) + TW * 1.5) % TW) - TW / 2;            // 512 주기 거리
const chk = (x, y) => (x + y) % 2 === 0;
const NO = { outline: false };
/** 둥근 뭉게 윗선 — P칸(512 약수)마다 반원 혹 하나, 높이는 혹마다 다르게 */
const bump = (x, P, off, s, h0, h1) => { const m = (((x + off) % TW) + TW) % TW, u = ((m % P) - P / 2) / (P / 2); return (h0 + hash(Math.floor(m / P), s, 9) * (h1 - h0)) * Math.sqrt(Math.max(0, 1 - u * u)); };

/** 계단 색 띠 하늘 — 띠 끝에서 25% · 50% 바둑판으로 다음 색에 넘어간다 · span 아래는 마지막 색 */
function bands(cols, span = 300) {
  const p = new Pix(TW, 360), bh = span / cols.length;
  for (let y = 0; y < 360; y++) {
    const b = Math.min(cols.length - 1, Math.floor(y / bh)), f = (y % bh) / bh, nx = cols[b + 1];
    for (let x = 0; x < TW; x++) p.set(x, y, nx && (f > 0.84 ? chk(x, y) : f > 0.68 && x % 2 === 0 && y % 2 === 0) ? nx : cols[b]);
  }
  return p;
}
/** 열마다 윗선 top(x) 아래를 채우기 — col(x, y, 깊이, 빛받는쪽?) */
function fill(p, top, col) {
  for (let x = 0; x < TW; x++) {
    const t = Math.round(top(x)), lit = top(x + 1) < top(x - 1);
    for (let y = Math.max(0, t); y < p.h; y++) { const c = col(x, y, y - t, lit); if (c) p.set(x, y, c); }
  }
}
const puff = (p, cx, cy, s, ramp, light) => wrap((o) => {
  for (const [dx, dy, r] of [[0, 0, 14], [14, -7, 13], [29, -1, 14], [13, 4, 13], [-12, 3, 9], [41, 4, 9]]) part.ell(p, o + cx + dx * s, cy + dy * s, r * s, r * 0.62 * s, ramp, { outline: false, light });
});
const dots = (p, n, seed, y0, y1, cols) => { for (let i = 0; i < n; i++) p.set(Math.floor(hash(i, 1, seed) * TW), Math.floor(y0 + hash(i, 2, seed) * (y1 - y0)), cols[i % cols.length]); };

/* ═════════ 월드 2 · 부글부글 화산 — 붉은 노을 · 화산재 · 불씨 ═════════ */
function sky2() {
  const p = bands(['#240c2c', '#3a1034', '#561638', '#7a1f38', '#a42c34', '#cc462e', '#e8742f', '#f6a446'], 280);
  for (const [cx, cy, w] of [[60, 46, 70], [250, 96, 90], [420, 30, 64], [350, 158, 56], [130, 176, 46]]) wrap((o) => {
    for (const [dx, dy, rx, ry] of [[0, 0, 1, 1], [0.45, -0.4, 0.55, 0.9], [-0.42, 0.2, 0.5, 0.8]]) part.ell(p, o + cx + dx * w, cy + dy * 8, rx * w * 0.5, ry * 5, ['#d8664a', '#7e2e44', '#521c3a'], { outline: false, light: [0.2, 0.95] });
  });
  for (let i = 0; i < 44; i++) {                                                     // 불씨 (가끔 2칸 꼬리)
    const x = Math.floor(hash(i, 1, 2) * TW), y = Math.floor(30 + hash(i, 2, 2) * 190), c = i % 3 ? '#ff8a3a' : '#ffd23f';
    p.set(x, y, c); if (i % 4 === 0) p.set(x - 1, y + 1, '#c4521f');
  }
  return p;
}
function far2() {
  const p = new Pix(TW, 140);
  const cone = (x, cx, py, k) => { const a = Math.abs(dd(x, cx)); return a < 5 ? py + 2 : py + (a - 5) * k; };
  const top = (x) => Math.min(80 + wave(x, [14, 2, 0.4], [7, 5, 1.3], [3, 13, 2]), cone(x, 170, 46, 0.6) + wave(x, [1.5, 37, 0]), cone(x, 410, 66, 0.72));
  fill(p, top, (x, y, d, lit) => d < 2 ? (lit ? '#a44a52' : '#6e2c42') : hash(x, y, 3) < 0.07 ? '#3a1428' : d < 5 && chk(x, y) ? (lit ? '#6e2c42' : '#52203a') : lit ? '#5a2238' : '#46192e');
  for (const [cx, py, dir] of [[170, 48, 1], [170, 48, -1], [410, 68, 1]]) for (let y = py; y < 140; y++) {   // 흘러내리는 용암
    const x = Math.round(cx + dir * (Math.sin(y / 8) * 2 + (y - py) * 0.3));
    if (!p.get(x, y)) continue;
    p.set(x - 1, y, '#c4521f'); p.set(x, y, y % 5 ? '#ff8a3a' : '#ffd23f'); p.set(x + 1, y, '#c4521f');
  }
  for (const [cx, py, n] of [[170, 46, 8], [410, 66, 3]]) {                           // 분화구 빛 + 연기 기둥 (층 위쪽에 닿지 않게)
    p.rect(cx - 4, py + 1, 9, 2, '#ff8a3a'); p.rect(cx - 2, py + 1, 5, 1, '#ffd23f');
    for (let i = n - 1; i >= 0; i--) for (const [ox, oy, k] of [[0, 0, 1], [-0.5, 0.4, 0.6]]) part.ell(p, cx + 2 + i * 5 + Math.round(Math.sin(i * 1.3) * 2) + ox * (4 + i), py - 5 - i * 4.4 + oy * 4, (4 + i * 1.1) * k, (3 + i * 0.7) * k, ['#b08088', '#7a5464', '#523a4a'], NO);
  }
  fill(p, (x) => 108 + wave(x, [9, 3, 2.1], [4, 7, 0.2]), (x, y, d, lit) => d < 2 ? (lit ? '#6a2440' : '#4a1a32') : '#2e1024');
  return p;
}
function near2() {
  const p = new Pix(TW, 80);
  const spike = (x, off, s, amp) => { const m = (((x + off) % TW) + TW) % TW, k = Math.floor(m / 32), f = (m % 32) / 32; return (4 + hash(k, s, 7) * amp) * (1 - Math.abs(f * 2 - 1)); };
  const top = (x) => 42 + wave(x, [5, 3, 0.5], [3, 11, 1.1]) - Math.max(spike(x, 0, 0, 16), spike(x, 16, 1, 9));
  fill(p, top, (x, y, d, lit) => d < 2 ? (lit ? '#8a4448' : '#5a2a36') : d < 4 && chk(x, y) ? '#4a2232' : hash(x, y, 8) < 0.08 ? '#1e0e18' : d > 20 && chk(x, y) ? '#22101a' : '#2e1824');
  for (let x = 0; x < TW; x++) p.set(x, Math.round(top(x)) - 1, OUT);
  for (let i = 0; i < 11; i++) {                                                     // 바위 틈 용암 줄기
    const cx = Math.floor(hash(i, 3, 9) * TW), y0 = Math.round(top(cx)) + 5;
    for (let r = 0; r < 16 + (i % 3) * 5; r++) { const x = cx + [0, 0, 1, 1, 2, 1, 1, 0][r % 8]; p.set(x, y0 + r, r % 4 ? '#ff8a3a' : '#ffd23f'); p.set(x + 1, y0 + r, '#8e2020'); }
  }
  return p;
}
function ground2() {
  const p = new Pix(TW, 60);
  for (let y = 0; y < 60; y++) for (let x = 0; x < TW; x++) {
    const r = hash(x, y, 21);
    p.set(x, y, y < 1 ? '#c27a50' : y < 4 ? (r < 0.15 ? '#c8844e' : '#9a5a3e') : y < 6 ? (y === 4 ? '#6a3030' : '#4a1e26') : r < 0.05 ? '#4a2622' : y < 22 || (y < 25 && chk(x, y)) ? '#7a4232' : '#683628');
  }
  for (let x = 0; x < TW; x++) if (hash(x, 0, 22) < 0.05) { p.set(x, 1, '#ffd23f'); p.set(x, 2, '#ff8a3a'); }   // 위 가장자리 불씨
  for (let i = 0; i < 8; i++) {                                                      // 땅속 용암 금
    const x0 = Math.floor(hash(i, 1, 23) * TW), y0 = 14 + Math.floor(hash(i, 2, 23) * 32), n = 10 + (i % 3) * 6;
    for (let t = 0; t < n; t++) { const x = (x0 + t) % TW, y = y0 + [0, 0, 1, 1, 1, 0, -1, -1][t % 8]; p.set(x, y - 1, '#3a1418'); p.set(x, y, t % 5 ? '#ff8a3a' : '#ffd23f'); p.set(x, y + 1, '#8e2020'); }
  }
  for (let i = 0; i < 24; i++) { const x = Math.floor(hash(i, 3, 24) * (TW - 4)), y = 10 + Math.floor(hash(i, 4, 24) * 44); p.rect(x, y, 3, 2, '#3a2028'); p.set(x, y, '#9a6a5a'); }
  return p;
}

/* ═════════ 월드 3 · 뭉게구름 하늘섬 — 밝은 하늘 · 떠 있는 섬 · 구름 바다 ═════════ */
function sky3() {
  const p = bands(['#3c88dc', '#4c98e4', '#5ea8ec', '#72b8f2', '#88c8f6', '#a2d6fa', '#bee4fc', '#d6eefe']);
  for (const [cx, cy, s] of [[40, 58, 1.1], [230, 120, 1.3], [390, 64, 0.9], [330, 196, 1], [110, 206, 0.8]]) puff(p, cx, cy, s, ['#ffffff', '#eef6ff', '#bcd6f2']);
  for (const [bx, by] of [[150, 40], [160, 46], [300, 30]]) { p.set(bx, by, '#2f5f9a'); p.set(bx + 1, by + 1, '#2f5f9a'); p.set(bx + 2, by, '#2f5f9a'); p.set(bx - 1, by - 1, '#2f5f9a'); p.set(bx + 3, by - 1, '#2f5f9a'); }   // 작은 새
  return p;
}
function island(p, cx, ty, w, o) {
  const L = o + cx - w / 2, R = o + cx + w / 2, X = o + cx;
  part.poly(p, [[L + 2, ty + 4], [R - 2, ty + 4], [X + w / 4, ty + 6 + w * 0.3], [X + 4, ty + 6 + w * 0.55], [X - w / 6, ty + 6 + w * 0.38], [L + 6, ty + 10]], ['#d8d0ea', '#a69ec6', '#766e9e'], { lineCol: '#565a8e' });
  for (let i = 0; i < w / 9; i++) { const x = Math.round(L + 6 + i * 9), l = 3 + ((i * 5) % 6); for (let j = 0; j < l; j++) p.set(x + (j > 3 ? 1 : 0), ty + 9 + Math.round(w * 0.12) + j, '#6a8a7a'); }   // 늘어진 뿌리
  part.poly(p, [[L, ty], [R, ty], [R - 3, ty + 6], [L + 3, ty + 6]], ['#c8f2a4', '#8cd08a', '#5aa080'], { lineCol: '#3a6a70' });
}
function far3() {
  const p = new Pix(TW, 140);
  for (const [cx, ty, w] of [[64, 40, 70], [205, 68, 42], [338, 26, 92], [462, 60, 52]]) wrap((o) => island(p, cx, ty, w, o));
  for (const [tx, ty] of [[52, 40], [74, 40], [320, 26]]) { p.rect(tx, ty - 6, 2, 6, '#7a5a5a'); part.ell(p, tx + 1, ty - 10, 5, 5, ['#c8f2a4', '#8cd08a', '#5aa080'], { lineCol: '#3a6a70' }); }   // 섬 위 나무
  for (const px of [452, 460, 470]) { p.rect(px, 50 + (px % 3) * 2, 4, 10 - (px % 3) * 2, '#f4f0ff'); p.rect(px + 3, 50 + (px % 3) * 2, 1, 10 - (px % 3) * 2, '#a69ec6'); }   // 옛 기둥
  for (let y = 28; y < 104; y++) for (let x = 366; x < 370; x++) p.set(x, y, (x + Math.floor(y / 3)) % 3 ? '#ffffff' : '#cfe8ff');   // 폭포
  fill(p, (x) => 108 + wave(x, [3, 3, 0.5]) - Math.max(bump(x, 32, 0, 1, 5, 10), bump(x, 16, 8, 2, 2, 6)), (x, y, d) => d < 2 ? '#ffffff' : d < 8 ? '#eaf4ff' : d < 10 && chk(x, y) ? '#eaf4ff' : '#d0e4fa');
  return p;
}
function near3() {
  const p = new Pix(TW, 80);
  const top = (x) => 50 + wave(x, [4, 2, 0.3], [2, 7, 1.2]) - Math.max(bump(x, 64, 0, 3, 10, 20), bump(x, 32, 16, 4, 6, 13));
  fill(p, top, (x, y, d) => d < 3 ? '#ffffff' : d < 12 ? '#f2f8ff' : d < 15 && chk(x, y) ? '#f2f8ff' : d < 24 ? '#d8e6f8' : d < 27 && chk(x, y) ? '#d8e6f8' : '#bccdee');
  for (let x = 0; x < TW; x++) {
    const t = Math.round(top(x)); p.set(x, t - 1, '#7a96c8');
    const u = x % 32; if (u === 0 || u === 1) for (let j = 2; j < 9 - u * 3; j++) p.set(x + 1 - u, t + j, '#c8d8f2');   // 뭉치 사이 그늘
  }
  return p;
}
function ground3() {
  const p = new Pix(TW, 60);
  for (let y = 0; y < 60; y++) for (let x = 0; x < TW; x++) {
    let c;
    if (y < 3) c = hash(x, y, 31) < 0.25 ? '#c8f27a' : '#9ce85a';
    else if (y < 6) c = ['#5ab840', '#3f9a3a', '#2a5a4a'][y - 3];
    else {                                                                           // 하늘 신전 돌길 (32칸 판석)
      const r = Math.floor((y - 6) / 10), yy = (y - 6) % 10, jx = (x + (r % 2) * 16) % 32;
      c = yy === 9 || jx === 0 ? '#bcae98' : yy === 0 || jx === 1 ? '#fff4e4' : hash(x, y, 32) < 0.04 ? '#c8b8a0' : r >= 2 ? '#d6c8b2' : '#e6dac6';
    }
    p.set(x, y, c);
  }
  for (let x = 0; x < TW; x++) if (hash(x, 0, 33) < 0.2) { p.set(x, 5, '#5ab840'); if (hash(x, 1, 33) < 0.5) p.set(x, 6, '#3f9a3a'); }   // 늘어진 풀
  return p;
}

/* ═════════ 월드 4 · 꽁꽁 얼음골 — 푸른 밤 · 오로라 · 눈송이 ═════════ */
function sky4() {
  const p = bands(['#0b1034', '#101845', '#162356', '#1d3068', '#263f7a', '#325089', '#406296', '#5274a4']);
  for (let x = 0; x < TW; x++) {                                                     // 오로라 커튼
    const yc = Math.round(58 + wave(x, [10, 2, 0.3], [5, 5, 1.2], [2, 11, 0.5])), L = 11 + wave(x, [5, 3, 2], [3, 7, 0.1]);
    const on = Math.sin((x / TW) * TAU * 26 + wave(x, [2, 3, 0])) > -0.4;
    for (let y = Math.round(yc - L); y <= yc; y++) {
      const g = (yc - y) / L;
      if (g < 0.12) { if (on || chk(x, y)) p.set(x, y, on ? '#6ad0b0' : '#3a9896'); } else if (g < 0.45) { if (on && chk(x, y)) p.set(x, y, '#2e9488'); } else if (on && x % 2 === 0 && y % 2 === 0) p.set(x, y, '#24607e');
    }
  }
  part.ell(p, 392, 44, 15, 15, ['#ffffff', '#eef4ff', '#c4d2ec'], NO);                // 달
  for (const [mx, my, r] of [[386, 40, 3], [398, 50, 2], [396, 36, 1.5]]) part.ell(p, mx, my, r, r, ['#d4e0f2', '#c4d2ec', '#b0c0e0'], NO);
  dots(p, 70, 41, 0, 200, ['#ffffff', '#bfe0ff', '#ffffff']);
  for (let i = 0; i < 130; i++) {                                                    // 눈송이
    const x = Math.floor(hash(i, 1, 42) * TW), y = Math.floor(hash(i, 2, 42) * 300);
    if (i % 7 === 0) { p.set(x, y, '#ffffff'); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) p.set(x + dx, y + dy, '#cfe4ff'); } else p.set(x, y, i % 3 ? '#ffffff' : '#dceaff');
  }
  return p;
}
function far4() {
  const p = new Pix(TW, 140);
  const top = (x) => 30 + Math.min(Math.abs(40 * Math.sin((x / TW) * TAU * 3 + 0.4)), 46) + wave(x, [8, 2, 1], [3, 11, 0], [1.5, 29, 2]);
  fill(p, top, (x, y, d, lit) => {
    const sl = 8 + Math.floor(hash(Math.floor(x / 3), 0, 44) * 6) + (lit ? 0 : 3);
    if (d < sl) return lit ? '#f0f8ff' : '#b4c8e4';
    if (d === sl && chk(x, y)) return lit ? '#b4c8e4' : '#8aa4cc';
    return lit ? '#5876a8' : '#3c5888';
  });
  const t2 = (x) => 98 + wave(x, [8, 3, 0.6], [4, 9, 2]);
  fill(p, t2, (x, y, d) => d < 2 ? '#c8dcf2' : d < 3 && chk(x, y) ? '#c8dcf2' : '#24386a');
  for (let i = 0; i < 32; i++) {                                                     // 언덕 위 전나무 그림자
    const cx = i * 16 + Math.floor(hash(i, 0, 45) * 10), h = 10 + Math.floor(hash(i, 1, 45) * 9), by = Math.round(t2(cx)) + 3;
    wrap((o) => { for (let r = 0; r <= h; r++) { const hw = Math.floor(r * 0.42) - (r % 4 === 3 ? 1 : 0); for (let dx = -hw; dx <= hw; dx++) p.set(o + cx + dx, by - h + r, r < 2 || (r % 4 === 0 && Math.abs(dx) === hw) ? '#c8dcf2' : '#16264e'); } });
  }
  for (let i = 0; i < 60; i++) { const x = Math.floor(hash(i, 1, 46) * TW), y = Math.floor(hash(i, 2, 46) * 140); if (p.get(x, y)) p.set(x, y, '#ffffff'); }   // 산 앞으로 내리는 눈
  return p;
}
function near4() {
  const p = new Pix(TW, 80), PINE = ['#4a9a92', '#2a6a72', '#1a4a58'], SNOW = ['#ffffff', '#ffffff', '#d4e6f6'];
  for (let i = 0; i < 10; i++) {
    const cx = i * 51 + Math.floor(hash(i, 0, 51) * 20), h = 28 + Math.floor(hash(i, 1, 51) * 16), base = 52;
    wrap((o) => {
      const X = o + cx; p.rect(X - 1, base - 6, 3, 8, '#5a3a3a');
      for (let k = 0; k < 3; k++) {
        const ty = base - h + Math.round(k * h * 0.27), by = ty + Math.round(h * 0.42), hw = 5 + k * 4;
        part.poly(p, [[X, ty], [X + hw + 1, by], [X - hw, by]], PINE);
        part.poly(p, [[X, ty], [X + Math.ceil(hw * 0.55), ty + Math.round((by - ty) * 0.5)], [X - Math.floor(hw * 0.5), ty + Math.round((by - ty) * 0.5)]], SNOW, { outline: false, flat: 0 });
      }
    });
  }
  const top = (x) => 46 + wave(x, [4, 3, 0.2], [3, 8, 1.4], [1.5, 19, 0.3]);
  fill(p, top, (x, y, d) => d < 2 ? '#ffffff' : d < 10 ? '#eaf4fe' : d < 13 && chk(x, y) ? '#eaf4fe' : d < 24 ? '#cfe2f6' : d < 27 && chk(x, y) ? '#cfe2f6' : '#b6d0ee');
  for (let x = 0; x < TW; x++) { p.set(x, Math.round(top(x)) - 1, '#4a6a9c'); if (hash(x, 5, 52) < 0.03) p.set(x, Math.round(top(x)) + 4, '#9ad0ff'); }
  return p;
}
function ground4() {
  const p = new Pix(TW, 60);
  for (let x = 0; x < TW; x++) {
    const e = Math.floor(hash(Math.floor(x / 4), 0, 61) * 3);                         // 눈 덩이 가장자리 (위 0~2칸 울퉁불퉁)
    for (let y = e; y < 60; y++) {
      const r = hash(x, y, 62);
      p.set(x, y, y === e ? '#6a8cc0' : y < 5 ? (r < 0.2 ? '#e2f0ff' : '#ffffff') : y === 5 ? '#a8c8e8' : r < 0.04 ? '#b0cce8' : y < 24 || (y < 27 && chk(x, y)) ? '#d6eaf8' : '#c4ddf2');
    }
  }
  for (let i = 0; i < 9; i++) wrap((o) => {                                         // 얼음판
    const x = o + Math.floor(hash(i, 1, 63) * TW), y = 14 + Math.floor(hash(i, 2, 63) * 34);
    part.ell(p, x, y, 7 + (i % 3) * 3, 2.5, ['#e8f8ff', '#a8d8f0', '#7ab0d8'], NO); p.rect(x - 3, y - 1, 2, 1, '#ffffff');
  });
  for (let i = 0; i < 20; i++) { const x = Math.floor(hash(i, 3, 64) * (TW - 3)), y = 10 + Math.floor(hash(i, 4, 64) * 46); p.rect(x, y, 2, 2, '#8aa8cc'); p.set(x, y, '#ffffff'); }
  return p;
}

/* ═════════ 월드 5 · 덜컹덜컹 고철 광산 — 매연 노을 · 굴뚝 · 파이프 ═════════ */
function sky5() {
  const p = bands(['#1e1a26', '#28222e', '#342a38', '#423442', '#54404a', '#6a4e50', '#845e54', '#a07258']);
  for (const [cx, cy, w] of [[90, 46, 96], [300, 84, 120], [470, 132, 70], [200, 168, 60]]) wrap((o) => {
    for (const [dx, dy, rx, ry] of [[0, 0, 1, 1], [0.4, -0.4, 0.5, 0.8], [-0.4, 0.3, 0.5, 0.7]]) part.ell(p, o + cx + dx * w, cy + dy * 8, rx * w * 0.5, ry * 5, ['#8a7470', '#5e5058', '#443a4a'], { outline: false, light: [0.2, 0.95] });
  });
  dots(p, 24, 53, 10, 200, ['#c8a07a', '#8a7a7a']);
  return p;
}
function line(p, ax, ay, bx, by, col) { const n = Math.max(Math.abs(bx - ax), Math.abs(by - ay), 1); for (let t = 0; t <= n; t++) p.set(Math.round(ax + ((bx - ax) * t) / n), Math.round(ay + ((by - ay) * t) / n), col); }
function far5() {
  const p = new Pix(TW, 140), BD = '#3a3346', LIT = '#4e4558', tb = (x) => 106 + wave(x, [6, 4, 1], [3, 13, 0.4]);
  const B = [[20, 46, 66, 'saw'], [80, 10, 34, 'stack'], [96, 34, 80, 'flat'], [146, 34, 44, 'frame'], [196, 8, 40, 'stack'], [214, 52, 72, 'saw'], [280, 40, 62, 'tank'], [334, 9, 30, 'stack'], [352, 44, 78, 'flat'], [408, 30, 52, 'frame'], [450, 48, 68, 'saw'], [500, 9, 44, 'stack']];
  for (const [x0, w, top, k] of B) {
    if (k === 'frame') {                                                             // 광산 권양탑 (A자 + 바퀴)
      const cx = x0 + w / 2;
      for (const s of [0, 1]) { line(p, x0 + s, 110, cx - 1 + s, top + 6, BD); line(p, x0 + w - s, 110, cx + 1 - s, top + 6, BD); }
      for (let y = top + 16; y < 106; y += 10) { const hw = Math.round(((y - top - 6) / (110 - top - 6)) * (w / 2)); line(p, cx - hw, y, cx + hw, y, BD); line(p, cx - hw, y, cx + hw - 4, y + 10, BD); }
      part.ell(p, cx, top + 5, 6, 6, [LIT, BD, BD], { lineCol: BD }); p.rect(cx - 1, top + 4, 3, 3, '#5e566a');
      continue;
    }
    for (let x = x0; x < x0 + w; x++) {
      const t = k === 'saw' ? top + Math.floor(((x - x0) % 12) * 0.7) : k === 'tank' ? top + Math.round(12 - Math.sqrt(Math.max(0, 1 - ((x - x0 - w / 2) / (w / 2)) ** 2)) * 12) : top;
      for (let y = t; y < 112; y++) p.set(x, y, x === x0 ? LIT : k === 'stack' && ((y - top) % 12 > 3 && (y - top) % 12 < 7) && y < top + 30 ? '#7a3a3a' : BD);
      if (k === 'saw' && (x - x0) % 12 === 11) for (let y = t - 7; y < t; y++) p.set(x, y, '#6a6478');   // 톱니 지붕 유리
    }
    if (k === 'stack') { p.rect(x0 - 1, top - 2, w + 2, 2, LIT); for (let i = 4; i >= 0; i--) wrap((o) => part.ell(p, o + x0 + w / 2 + i * 5, top - 6 - i * 5, 3 + i * 1.2, 2.5 + i, ['#8a8088', '#6a6070', '#4e4658'], NO)); }
    else for (let y = top + 16; y < 100; y += 6) for (let x = x0 + 3; x < x0 + w - 3; x += 5) if (hash(x, y, 55) < 0.4) p.rect(x, y, 2, 2, hash(x, y, 56) < 0.5 ? '#e0bc62' : '#8a7448');   // 불 켜진 창
  }
  fill(p, tb, (x, y, d) => d < 2 ? '#54465a' : d < 3 && chk(x, y) ? '#54465a' : '#2a2432');
  return p;
}
function near5() {
  const p = new Pix(TW, 80), M = ['#b4b8c6', '#7a8092', '#4a5062'], RUST = '#8a5636';
  const top = (x) => 38 + wave(x, [6, 3, 0.7], [4, 7, 2.1], [2, 17, 0.3]) + (hash(Math.floor(x / 3), 0, 71) < 0.3 ? 1 : 0);
  fill(p, top, (x, y, d) => d < 2 ? '#6a5a50' : hash(x, y, 72) < 0.06 ? '#2e2628' : '#4a3e3a');
  for (let x = 0; x < TW; x++) p.set(x, Math.round(top(x)) - 1, OUT);
  for (let i = 0; i < 46; i++) { const x = Math.floor(hash(i, 1, 73) * TW), y = Math.round(top(x)) + 1 + Math.floor(hash(i, 2, 73) * 10); p.rect(x, y, 3 + (i % 4), 2 + (i % 2), ['#7a6a5e', '#8a8e9e', RUST, '#5c6274'][i % 4]); }   // 고철 조각
  for (const gx of [60, 250, 390]) wrap((o) => {                                    // 반쯤 묻힌 톱니바퀴
    const X = o + gx, Y = Math.round(top(gx)) + 7;
    for (let k = 0; k < 8; k++) { const a = (k / 8) * TAU; part.ell(p, X + Math.round(Math.cos(a) * 8), Y + Math.round(Math.sin(a) * 8), 1.6, 1.6, M); }
    part.ell(p, X, Y, 7, 7, M); part.ell(p, X, Y, 2, 2, ['#5c6274', '#3a3e4c', OUT]);
  });
  for (const [px, pt] of [[120, 12], [300, 20], [440, 8]]) {                        // 세로 파이프 + 밸브
    for (let y = pt; y < 52; y++) for (let i = 0; i < 8; i++) p.set(px + i, y, i === 0 || i === 7 ? OUT : i < 3 ? M[0] : i < 6 ? M[1] : M[2]);
    part.poly(p, [[px - 1, pt - 3], [px + 9, pt - 3], [px + 9, pt + 1], [px - 1, pt + 1]], M);
    p.rect(px - 3, pt + 12, 14, 2, '#c4402f'); p.rect(px + 2, pt + 9, 4, 8, '#c4402f');
  }
  part.ell(p, 444, 2, 3, 2, ['#ffffff', '#e0e0e8', '#b0b0c0'], NO); part.ell(p, 448, -1, 4, 2.5, ['#ffffff', '#e0e0e8', '#b0b0c0'], NO);   // 김
  for (let x = 0; x < TW; x++) {                                                     // 큰 가로 파이프 (64칸마다 이음쇠)
    const f = x % 64 < 5;
    for (let y = f ? 48 : 50; y <= (f ? 63 : 61); y++) {
      const r = y - (f ? 48 : 50), n = f ? 15 : 11;
      p.set(x, y, r === 0 || r === n ? OUT : r < 3 ? M[0] : r < n - 4 ? M[1] : M[2]);
    }
    if (f && x % 64 === 2) { p.set(x, 51, OUT); p.set(x, 60, OUT); for (let j = 0; j < 3; j++) p.set(x + 1, 64 + j, RUST); }
    if (x % 64 === 30 || x % 64 === 31) for (let j = 0; j < 3; j++) p.set(x, 62 + j + (x % 2), RUST);
  }
  return p;
}
function ground5() {
  const p = new Pix(TW, 60);
  for (let y = 0; y < 60; y++) for (let x = 0; x < TW; x++) {
    const r = hash(x, y, 81);
    let c = y === 0 ? '#cfd3de' : y < 4 ? '#8e92a2' : y === 4 ? '#5c6274' : y === 5 ? '#2a2632' : r < 0.05 ? '#3a302c' : y < 24 || (y < 27 && chk(x, y)) ? '#5e5048' : '#4e423c';
    if (y < 5 && x % 64 === 0) c = '#4e5262';                                         // 철판 이음매
    if (y === 2 && x % 16 === 8) c = '#e3e6ee'; if (y === 2 && x % 16 === 9) c = '#4e5262';   // 리벳
    p.set(x, y, c);
  }
  for (let i = 0; i < 26; i++) { const x = Math.floor(hash(i, 1, 82) * (TW - 4)), y = 10 + Math.floor(hash(i, 2, 82) * 46), coal = i % 3; p.rect(x, y, coal ? 3 : 2, 2, coal ? '#2a2430' : '#8a8e9e'); p.set(x, y, coal ? '#6a6478' : '#e3e6ee'); }
  return p;
}

const BG = { w02: [sky2, far2, near2, ground2], w03: [sky3, far3, near3, ground3], w04: [sky4, far4, near4, ground4], w05: [sky5, far5, near5, ground5] };
export const BG_W25 = Object.fromEntries(Object.entries(BG).flatMap(([w, fns]) => ['sky', 'far', 'near', 'ground'].map((l, i) => [`bg/${w}/${l}`, { anims: [], draw: fns[i], anchor: { x: 0, y: 0 } }])));
