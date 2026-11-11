/* 앉는 재미 요소 자리 맞추기 (11/11 · «첫판부터 부엉이가 엉뚱한 곳») — 두 겹 배경의 앞 겹 그림에서
 * 부엉이 자리(x) 아래로 내려가며 처음 만나는 불투명 픽셀 = 가지 윗면 · 울타리 가운데 아래로 처음 만나는 윗면을 찾는다 (540 기준 좌표). */
import sharp from 'sharp';
import { SPOTS } from '../src/games/iandragon_game/render/funSpots.js';
const over = { 1: { owl: { x: 300, y: 136 }, fence: { x0: 1010, x1: 1250, y: 398 } } };
for (let w = 1; w <= 10; w++) {
  const S = { ...SPOTS[w], ...(over[w] || {}) }, n = String(w).padStart(2, '0');
  const { data, info } = await sharp(`public/assets/iandragon_game/ai/bg/layers/w${n}_front.png`).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const k = info.height / 540, op = (x, y) => data[(Math.round(y * k) * info.width + Math.round(x * k)) * 4 + 3] > 160;
  const down = (x, y0, span) => { for (let y = y0 - 12; y <= y0 + span; y++) if (op(x, y) && op(x - 6, y) && op(x + 6, y)) return y; return null; };   // 폭 12px 이상 윗면
  const owlY = S.owl ? down(S.owl.x, S.owl.y, 60) : '-';
  const fx = S.fence ? [S.fence.x0 + 20, (S.fence.x0 + S.fence.x1) / 2, S.fence.x1 - 20].map((x) => down(x, S.fence.y, 40)) : '-';
  console.log(`w${n} owl ${S.owl ? `${S.owl.x},${S.owl.y} → 가지 윗면 ${owlY}` : '-'} | fence ${S.fence ? `y ${S.fence.y} → 윗면 ${fx}` : '-'}`);
}
