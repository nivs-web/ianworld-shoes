/* 월드 배경에서 달의 실제 중심 · 지름 재기 (자리표 moon 점검용 · 겜부장 11/11) */
import sharp from 'sharp';
import { SPOTS } from '../src/games/iandragon_game/render/funSpots.js';
for (const w of Object.keys(SPOTS)) {
  const S = SPOTS[w]; if (!S.moon) continue;
  const f = `public/assets/iandragon_game/ai/bg/w${String(w).padStart(2, '0')}_panel.png`;
  const m = await sharp(f).metadata(); const W = Math.round(m.width * 540 / m.height);
  const { data, info } = await sharp(f).resize(W, 540, { kernel: 'nearest' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const L = (x, y) => { const i = (y * info.width + x) * 4; return 0.3 * data[i] + 0.59 * data[i + 1] + 0.11 * data[i + 2]; };
  const { x, y, d } = S.moon, x0 = Math.max(0, x - d), x1 = Math.min(W - 1, x + d);
  let best = [0, 0, 0, 0], top = -1;
  for (let yy = Math.max(0, y - d); yy < Math.min(540, y + d); yy++) {
    let a = -1, b = -1; for (let xx = x0; xx <= x1; xx++) if (L(xx, yy) > 190) { if (a < 0) a = xx; b = xx; }
    if (a >= 0 && Math.abs((a + b) / 2 - x) < d / 3) { if (top < 0) top = yy; if (b - a > best[0]) best = [b - a, yy, a, b]; }
  }
  const D = best[0], cx = (best[2] + best[3]) / 2;
  console.log(`W${w} 자리표 ${x},${y},${d} | 실제 가장 넓은 줄 y=${best[1]} x=${best[2]}~${best[3]} → 중심 x ${cx} · 지름 ${D} · 위 끝 ${top} → 중심 y ≈ ${Math.max(best[1], top + D / 2)}`);
}
