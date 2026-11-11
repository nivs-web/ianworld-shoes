/**
 * 그림 담당 — 젬 v3 (2026-11-11 · 대표님 «반짝이는 하얀 효과는 넣지 말고, 그냥 보라색의 심플한 젬 · 누가 봐도 젬» · 겜부장 전달)
 *
 *   node tools/idg-gem-v3.mjs        (먼저 tools/idg-gem-v2.mjs)
 *
 * icon_gem_v2 에서 흰 반짝이(아주 밝은 칸)를 옆 면 색으로 메우고, 면 색을 v2 의 보라 4톤으로 정리 → ui/lobby/icon_gem_v3.png 64×64 (새 이름)
 */
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const UI = path.join(ROOT, 'public/assets/iandragon_game/ui/lobby');
const { data: d, info } = await sharp(path.join(UI, 'icon_gem_v2.png')).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const N = info.width, TONES = [[110, 40, 190], [150, 70, 235], [185, 120, 255], [215, 175, 255]], OUT = [28, 10, 44];
const lum = (o) => (d[o] * 0.3 + d[o + 1] * 0.59 + d[o + 2] * 0.11) / 255;
const isOut = (o) => Math.max(d[o], d[o + 1], d[o + 2]) < 70;
/* 1) 흰 반짝이 → 둘레 면들의 평균 (몇 번 되풀이) */
for (let pass = 0; pass < 4; pass++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
  const o = (y * N + x) * 4; if (!d[o + 3] || Math.min(d[o], d[o + 1], d[o + 2]) < 215) continue;
  const nb = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]].map(([dx, dy]) => ((y + dy) * N + x + dx) * 4).filter((p) => p >= 0 && p < d.length && d[p + 3] && !isOut(p) && Math.min(d[p], d[p + 1], d[p + 2]) < 215);
  if (!nb.length) continue; for (let c = 0; c < 3; c++) d[o + c] = Math.round(nb.reduce((t, p) => t + d[p + c], 0) / nb.length);
}
/* 2) 면 색을 4톤으로 : 밝기 순서로 네 묶음 → 묶음마다 v2 의 평균 색 (선명함 유지 · 외곽선은 그대로) */
const face = []; for (let o = 0; o < d.length; o += 4) if (d[o + 3] && !isOut(o)) face.push(o);
face.sort((p, q) => lum(p) - lum(q));
const groups = [0, 1, 2, 3].map((g) => face.slice(Math.floor((face.length * g) / 4), Math.floor((face.length * (g + 1)) / 4)));
const tone = groups.map((gp) => [0, 1, 2].map((c) => Math.round(gp.reduce((t, o) => t + d[o + c], 0) / gp.length)));
groups.forEach((gp, g) => { for (const o of gp) { d[o] = tone[g][0]; d[o + 1] = tone[g][1]; d[o + 2] = tone[g][2]; } });
for (let o = 0; o < d.length; o += 4) if (d[o + 3] && isOut(o)) { d[o] = OUT[0]; d[o + 1] = OUT[1]; d[o + 2] = OUT[2]; }
await sharp(d, { raw: { width: N, height: N, channels: 4 } }).png({ compressionLevel: 9 }).toFile(path.join(UI, 'icon_gem_v3.png'));
console.log('→ ui/lobby/icon_gem_v3.png 64×64');
