/**
 * 그림 담당 — 착용 시트에서 «장식만» 떼어 내고, 머리 대비 크기 · 자리를 잰다 (2026-11-11)
 *
 *   node tools/idg-wear-extract.mjs <시트.png> <이름들(쉼표 9개 · '-' 버림)> [--kind hat|neck]
 *
 * 제미나이가 «청록 아기 용 머리에 씌운 모습»으로 그려 준 3×3 시트를 칸마다:
 *  ① 분홍 → 투명  ② 청록(머리 · 목 살) → 머리 마스크  ③ 머리도 분홍도 아닌 색 = 장식 핵심
 *  ④ 어두운 외곽선은 장식 핵심 가까이(1.5칸) 있는 것만 남긴다 (머리 외곽선은 버림)
 *  ⑤ 머리 마스크로 «머리 폭 · 정수리(가로 46~72% 맨 윗줄 중앙값) · 목 가운데»를 재서, 장식의 크기와 자리를 머리 기준 비율로 적는다
 * 결과 : tools/_out/wear_src/<이름>.png (장식만 · 고해상) + tools/_out/wear_src/fit.json (머리 대비 비율)
 *        tools/_out/wear_src/_debug_<시트>.png (빨강 = 버린 머리 · 그대로 = 남긴 장식)
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const args = process.argv.slice(2);
const [src, namesArg] = args;
const KIND = args.includes('--kind') ? args[args.indexOf('--kind') + 1] : 'hat';
const names = namesArg.split(',');
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const OUT = path.join(ROOT, 'tools/_out/wear_src');
fs.mkdirSync(OUT, { recursive: true });

const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height;
const hsv = (i) => {
  const r = data[i] / 255, g = data[i + 1] / 255, b = data[i + 2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0; if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(h * 60 + 360) % 360, mx ? d / mx : 0, mx];
};
const N = W * H, cls = new Uint8Array(N);            // 0 분홍 · 1 머리(청록) · 2 어두움 · 3 장식 핵심
for (let p = 0; p < N; p++) {
  const i = p * 4, r = data[i], g = data[i + 1], b = data[i + 2];
  if (r > 150 && b > 150 && g < 110 && Math.abs(r - b) < 90) { cls[p] = 0; continue; }
  const [hh, s, v] = hsv(i);
  const H0 = 150, H1 = 216;
  if (hh >= 288 && hh <= 326 && s > 0.6 && r > 80 && b > 80) { cls[p] = 0; continue; }   // 외곽선과 분홍 바탕이 섞인 보라 테두리
  if (v < 0.36 || (v < 0.45 && s < 0.35)) cls[p] = 2;                           // 어두운 외곽선 (남보라 포함)
  else if ((hh >= H0 && hh <= H1 && (s > 0.18 || (s > 0.07 && v > 0.55))) || (hh >= 222 && hh <= 290 && s < 0.42 && v > 0.5)) cls[p] = 1;   // 청록 머리 + 옅은 하늘색 목살 + 옅은 보라 달빛 테두리
  else cls[p] = 3;
}
/* 분홍 번짐 : 바탕(분홍)과 맞닿은 분홍 기운 칸만 (리본 · 꽃의 분홍은 살린다) */
for (let pass = 0; pass < 2; pass++) {
  const kill = [];
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const p = y * W + x, i = p * 4; if (!cls[p]) continue;
    if (!((data[i] + data[i + 2]) / 2 - data[i + 1] > 70 && data[i] > 150 && data[i + 2] > 140)) continue;
    if (!cls[p - 1] || !cls[p + 1] || !cls[p - W] || !cls[p + W]) kill.push(p);
  }
  for (const p of kill) cls[p] = 0;
}
/* 장식 핵심과의 거리(칸) — 두 번 훑는 간단한 거리 변환 (체스판 거리) */
const dist = new Int32Array(N).fill(1e6);
for (let p = 0; p < N; p++) if (cls[p] === 3) dist[p] = 0;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const p = y * W + x; if (x) dist[p] = Math.min(dist[p], dist[p - 1] + 1); if (y) dist[p] = Math.min(dist[p], dist[p - W] + 1, x ? dist[p - W - 1] + 1 : 1e6, x < W - 1 ? dist[p - W + 1] + 1 : 1e6); }
for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) { const p = y * W + x; if (x < W - 1) dist[p] = Math.min(dist[p], dist[p + 1] + 1); if (y < H - 1) dist[p] = Math.min(dist[p], dist[p + W] + 1, x < W - 1 ? dist[p + W + 1] + 1 : 1e6, x ? dist[p + W - 1] + 1 : 1e6); }
const KEEP_DARK = 14;                                 // 칸 하나 ≈ 10~12px → 1.2칸

const fit = fs.existsSync(path.join(OUT, 'fit.json')) ? JSON.parse(fs.readFileSync(path.join(OUT, 'fit.json'), 'utf8')) : {};
const dbg = Buffer.from(data);
const CW = W / 3, CH = H / 3;
for (let k = 0; k < 9; k++) {
  const name = names[k]; if (!name || name === '-') continue;
  const cx0 = Math.round((k % 3) * CW), cy0 = Math.round(Math.floor(k / 3) * CH), cx1 = Math.round(cx0 + CW), cy1 = Math.round(cy0 + CH);
  /* 머리 = 칸 안 청록 덩어리 중 가장 큰 것 + 그 안에 갇힌 구멍(눈 · 입) */
  const cw = cx1 - cx0, ch = cy1 - cy0, L = (x, y) => (y - cy0) * cw + (x - cx0);
  const lab = new Int32Array(cw * ch).fill(-1); let best = -1, bestN = 0, nl = 0;
  for (let y = cy0; y < cy1; y++) for (let x = cx0; x < cx1; x++) {
    if (cls[y * W + x] !== 1 || lab[L(x, y)] >= 0) continue;
    let n = 0; const st = [[x, y]]; lab[L(x, y)] = nl;
    while (st.length) { const [px, py] = st.pop(); n++; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const qx = px + dx, qy = py + dy; if (qx < cx0 || qy < cy0 || qx >= cx1 || qy >= cy1) continue; if (cls[qy * W + qx] === 1 && lab[L(qx, qy)] < 0) { lab[L(qx, qy)] = nl; st.push([qx, qy]); } } }
    if (n > bestN) { bestN = n; best = nl; } nl++;
  }
  /* 가장 큰 덩어리와 색이 비슷한 청록 조각(떨어져 그려진 뿔 · 목살)도 머리 — 파티 모자 줄무늬처럼 색이 다른 청록은 장식으로 남긴다 */
  const sum = Array.from({ length: nl }, () => [0, 0, 0, 0]);
  for (let y = cy0; y < cy1; y++) for (let x = cx0; x < cx1; x++) { const l = lab[L(x, y)]; if (l < 0) continue; const i = (y * W + x) * 4; sum[l][0] += data[i]; sum[l][1] += data[i + 1]; sum[l][2] += data[i + 2]; sum[l][3]++; }
  const mean = sum.map(([r, g, b, n]) => [r / n, g / n, b / n, n]), M0 = mean[best];
  const headLike = new Set([best]);
  mean.forEach((m, l) => { if (l !== best && m[3] > 30 && Math.hypot(m[0] - M0[0], m[1] - M0[1], m[2] - M0[2]) < (KIND === 'neck' ? 90 : 45)) headLike.add(l); });
  const head = new Uint8Array(cw * ch);
  for (let i = 0; i < head.length; i++) if (headLike.has(lab[i])) head[i] = 1;
  const out = new Uint8Array(cw * ch), st2 = [];                          // 칸 테두리에서 머리를 건너지 않고 닿는 곳 = 바깥
  for (let x = cx0; x < cx1; x++) for (const y of [cy0, cy1 - 1]) if (!head[L(x, y)]) { out[L(x, y)] = 1; st2.push([x, y]); }
  for (let y = cy0; y < cy1; y++) for (const x of [cx0, cx1 - 1]) if (!head[L(x, y)] && !out[L(x, y)]) { out[L(x, y)] = 1; st2.push([x, y]); }
  while (st2.length) { const [px, py] = st2.pop(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const qx = px + dx, qy = py + dy; if (qx < cx0 || qy < cy0 || qx >= cx1 || qy >= cy1) continue; const q = L(qx, qy); if (!head[q] && !out[q] && cls[qy * W + qx] !== 3) { out[q] = 1; st2.push([qx, qy]); } else if (!head[q] && !out[q] && cls[qy * W + qx] === 3) { out[q] = 1; st2.push([qx, qy]); } } }
  for (let i = 0; i < head.length; i++) if (!out[i]) head[i] = 1;      // 갇힌 구멍 → 머리
  /* 머리 둘레 띠(외곽선 · 그림자) = 머리에서 체스판 거리 22px 안 */
  const R = 22, dh = new Int32Array(cw * ch).fill(1e6), ring = new Uint8Array(cw * ch);
  for (let i = 0; i < dh.length; i++) if (head[i]) dh[i] = 0;
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) { const i = y * cw + x; if (x) dh[i] = Math.min(dh[i], dh[i - 1] + 1); if (y) { dh[i] = Math.min(dh[i], dh[i - cw] + 1); if (x) dh[i] = Math.min(dh[i], dh[i - cw - 1] + 1); if (x < cw - 1) dh[i] = Math.min(dh[i], dh[i - cw + 1] + 1); } }
  for (let y = ch - 1; y >= 0; y--) for (let x = cw - 1; x >= 0; x--) { const i = y * cw + x; if (x < cw - 1) dh[i] = Math.min(dh[i], dh[i + 1] + 1); if (y < ch - 1) { dh[i] = Math.min(dh[i], dh[i + cw] + 1); if (x < cw - 1) dh[i] = Math.min(dh[i], dh[i + cw + 1] + 1); if (x) dh[i] = Math.min(dh[i], dh[i + cw - 1] + 1); } }
  for (let i = 0; i < dh.length; i++) if (!head[i] && dh[i] <= R) ring[i] = 1;
  if (process.env.IDG_PX && k === 0) { for (const pr of process.env.IDG_PX.split(';')) { const [px, py] = pr.split(',').map(Number); const pp = py * W + px, qq = L(px, py), ii = pp * 4; console.log('px', px, py, 'rgb', data[ii], data[ii + 1], data[ii + 2], 'cls', cls[pp], 'head', head[qq], 'ring', ring[qq], 'dh', dh[qq], 'dist', dist[pp]); } }
  /* 장식 핵심(머리 밖 · 색 있는 칸)까지 거리 — 머리 안 하이라이트 · 볼 색은 빼고 칸 안에서 다시 잰다 */
  const dc = new Int32Array(cw * ch).fill(1e6);
  for (let y = cy0; y < cy1; y++) for (let x = cx0; x < cx1; x++) { const q = L(x, y); if (cls[y * W + x] === 3 && !head[q]) { const [, ss, vv] = hsv((y * W + x) * 4); if ((ss > 0.3 && vv > 0.4) || !ring[q]) dc[q] = 0; } }   // 머리 밖 · 또렷한 색(또는 머리 띠 바깥)
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) { const i = y * cw + x; if (x) dc[i] = Math.min(dc[i], dc[i - 1] + 1); if (y) { dc[i] = Math.min(dc[i], dc[i - cw] + 1); if (x) dc[i] = Math.min(dc[i], dc[i - cw - 1] + 1); if (x < cw - 1) dc[i] = Math.min(dc[i], dc[i - cw + 1] + 1); } }
  for (let y = ch - 1; y >= 0; y--) for (let x = cw - 1; x >= 0; x--) { const i = y * cw + x; if (x < cw - 1) dc[i] = Math.min(dc[i], dc[i + 1] + 1); if (y < ch - 1) { dc[i] = Math.min(dc[i], dc[i + cw] + 1); if (x < cw - 1) dc[i] = Math.min(dc[i], dc[i + cw + 1] + 1); if (x) dc[i] = Math.min(dc[i], dc[i + cw - 1] + 1); } }
  /* 머리 마스크 상자 · 장식 상자 */
  let hx0 = 1e9, hy0 = 1e9, hx1 = -1, hy1 = -1, ix0 = 1e9, iy0 = 1e9, ix1 = -1, iy1 = -1, headN = 0;
  const keep = (p) => {
    const x = p % W, y = (p / W) | 0, q = L(x, y);
    if (!cls[p] || head[q]) return false;
    if (!ring[q]) return true;                                            // 머리 밖 = 전부 장식
    return dc[q] <= KEEP_DARK && (cls[p] === 3 || cls[p] === 2);          // 외곽선 띠 = 머리 밖 장식에 바로 붙은 칸만 (장식이 머리에 얹힌 아랫선)
  };
  for (let y = cy0; y < cy1; y++) for (let x = cx0; x < cx1; x++) {
    const p = y * W + x;
    if (head[L(x, y)]) { headN++; if (x < hx0) hx0 = x; if (x > hx1) hx1 = x; if (y < hy0) hy0 = y; if (y > hy1) hy1 = y; }
    if (keep(p)) { if (x < ix0) ix0 = x; if (x > ix1) ix1 = x; if (y < iy0) iy0 = y; if (y > iy1) iy1 = y; }
    else if (cls[p]) { const i = p * 4; dbg[i] = 255; dbg[i + 1] = 40; dbg[i + 2] = 40; }
  }
  if (ix1 < 0 || hx1 < 0) { console.log(`✘ ${name} : 장식 또는 머리를 못 찾음`); continue; }
  /* 티끌 지우기 : 남긴 칸들 중 120칸 미만 덩어리는 버리고 상자를 다시 잰다 */
  const kept = new Uint8Array(cw * ch);
  for (let y = cy0; y < cy1; y++) for (let x = cx0; x < cx1; x++) if (keep(y * W + x)) kept[L(x, y)] = 1;
  const seen = new Uint8Array(cw * ch), comps = [];
  for (let i0 = 0; i0 < kept.length; i0++) {
    if (!kept[i0] || seen[i0]) continue;
    const comp = [i0], st3 = [i0]; seen[i0] = 1;
    while (st3.length) { const i = st3.pop(), x = i % cw, y = (i / cw) | 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const qx = x + dx, qy = y + dy; if (qx < 0 || qy < 0 || qx >= cw || qy >= ch) continue; const q = qy * cw + qx; if (kept[q] && !seen[q]) { seen[q] = 1; comp.push(q); st3.push(q); } } }
    comps.push(comp);
  }
  /* 가장 큰 덩어리 + 그 상자(1.5칸 여유) 안에 걸친 덩어리만 남긴다 — 머리 둘레에 남은 외곽선 조각을 버림 */
  comps.sort((a, c) => c.length - a.length);
  if (comps.length) {
    let bx0 = 1e9, by0 = 1e9, bx1 = -1, by1 = -1;
    for (const i of comps[0]) { const x = i % cw, y = (i / cw) | 0; if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y; }
    const PAD = 4;
    for (const comp of comps.slice(1)) {
      let inside = false;
      for (const i of comp) { const x = i % cw, y = (i / cw) | 0; if (x >= bx0 - PAD && x <= bx1 + PAD && y >= by0 - PAD && y <= by1 + PAD) { inside = true; break; } }
      let darkN = 0, tealN = 0;
      for (const i of comp) { const pp = (cy0 + ((i / cw) | 0)) * W + cx0 + (i % cw); if (cls[pp] === 2) darkN++; if (cls[pp] === 1) tealN++; }
      const lineOnly = darkN > comp.length * 0.8;                         // 어두운 선뿐인 조각 = 머리 외곽선 찌꺼기
      const hornBit = name !== 'hat_party' && tealN + darkN > comp.length * 0.85; // 청록 + 외곽선뿐인 조각 = 떨어진 뿔 끝
      if (!inside || comp.length < 40 || lineOnly || hornBit) for (const i of comp) kept[i] = 0;
    }
  }
  ix0 = 1e9; iy0 = 1e9; ix1 = -1; iy1 = -1;
  for (let i = 0; i < kept.length; i++) if (kept[i]) { const x = cx0 + (i % cw), y = cy0 + ((i / cw) | 0); if (x < ix0) ix0 = x; if (x > ix1) ix1 = x; if (y < iy0) iy0 = y; if (y > iy1) iy1 = y; }
  const strongTeal = (p) => { const [hh, ss, vv] = hsv(p * 4); return hh >= 160 && hh <= 212 && ss > 0.3 && vv > 0.28; };
  const keepFinal = (p) => kept[L(p % W, (p / W) | 0)] && (name === 'hat_party' || !strongTeal(p));   // 붙어 남은 진한 청록 뿔 끝 (은빛은 채도가 낮아 남는다)
  const iw = ix1 - ix0 + 1, ih = iy1 - iy0 + 1, b = Buffer.alloc(iw * ih * 4);
  for (let y = 0; y < ih; y++) for (let x = 0; x < iw; x++) {
    const p = (iy0 + y) * W + ix0 + x; if (!keepFinal(p)) continue;
    const i = p * 4, o = (y * iw + x) * 4; b[o] = data[i]; b[o + 1] = data[i + 1]; b[o + 2] = data[i + 2]; b[o + 3] = 255;
  }
  await sharp(b, { raw: { width: iw, height: ih, channels: 4 } }).png().toFile(path.join(OUT, name + '.png'));
  /* 머리 기준 잣대 : 폭 · 정수리 · (목) */
  const hw = hx1 - hx0 + 1;
  const tops = [];
  for (let x = Math.round(hx0 + hw * 0.46); x <= Math.round(hx0 + hw * 0.72); x++) { let y = cy0; while (y < cy1 && cls[y * W + x] !== 1) y++; tops.push(y); }
  tops.sort((a, c) => a - c);
  const skullX = hx0 + hw * 0.6, skullY = tops[Math.floor(tops.length / 2)];
  fit[name] = {
    kind: KIND, headW: hw,
    w: iw / hw, h: ih / hw,                                           // 장식 크기 = 머리 폭의 몇 배
    left: (ix0 - skullX) / hw, top: (iy0 - skullY) / hw,              // 장식 왼쪽 위 = 정수리에서 머리 폭의 몇 배 떨어졌나
    neckLeft: (ix0 - (hx0 + hw * 0.4)) / hw, neckTop: (iy0 - hy1) / hw, // 목 장식용 : 머리(+목) 마스크 아래 · 가로 40% 기준
  };
  console.log(`→ ${name} @${ix0},${iy0} 장식 ${iw}×${ih} · 머리 폭 ${hw} · 크기 ${(iw / hw).toFixed(2)}×${(ih / hw).toFixed(2)}`);
}
fs.writeFileSync(path.join(OUT, 'fit.json'), JSON.stringify(fit, null, 1));
await sharp(dbg, { raw: { width: W, height: H, channels: 4 } }).png().toFile(path.join(OUT, '_debug_' + path.basename(src)));
