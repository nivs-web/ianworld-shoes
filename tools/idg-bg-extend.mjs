/**
 * 그림 담당 — 배경 오른쪽 이어 붙이기 (2026-11-11 · 대표님 «긴 판에서 배경이 거울로 되풀이되는 것 없게»)
 *
 *   node tools/idg-bg-extend.mjs <월드번호> <이어 그린 그림.png> [--need 1760]
 *
 * 제미나이에게 배경 오른쪽 끝(760칸)을 주고 «오른쪽으로 이어 그려»라고 하면, 받은 그림 왼쪽에 그 끝을 거의 그대로 다시 그리고
 * 오른쪽으로 장면을 잇는다. 그래서:
 *  ① 두 그림을 540 높이로 맞추고  ② 원래 배경의 맨 오른쪽 띠(160칸)가 새 그림 어디에 있는지 찾는다(밝기 차이 합이 가장 작은 곳 · 위아래 ±10칸)
 *  ③ 그 띠 뒤부터를 원래 배경 오른쪽에 붙이고, 이음새 56칸은 서서히 섞는다(크로스페이드)
 *  ④ public/assets/iandragon_game/ai/bg/wNN_panel.png 를 넓어진 그림으로 바꾼다 (왼쪽은 한 칸도 안 바뀜 → 재미 요소 자리표 그대로)
 * --need : 이만큼 넓지 않으면 «한 번 더 이어 그려야 함» 이라고 알려 준다 (가장 긴 판 전장 폭 1,710 + 여유).
 * 확인 그림 : tools/_out/ext_wNN.png (이음새 자리에 빨간 줄)
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const args = process.argv.slice(2);
const [worldArg, extFile] = args;
const NEED = Number(args.includes('--need') ? args[args.indexOf('--need') + 1] : 1760);
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const n = String(worldArg).padStart(2, '0');
const opt = (k) => (args.includes(k) ? args[args.indexOf(k) + 1] : null);
const panelFile = opt('--panel') || path.join(ROOT, `public/assets/iandragon_game/ai/bg/w${n}_panel.png`);   // --panel : 배경 판 대신 다른 그림(겹)
const OUTFILE = opt('--out') || panelFile;
const KEY = args.includes('--key');                                              // --key : 붙인 뒤 분홍(#FF00FF) → 투명 (앞 겹)
const H = 540, T = 160, FADE = 56;

const load = async (f) => { const r = await sharp(f).resize({ height: H }).removeAlpha().raw().toBuffer({ resolveWithObject: true }); return { d: r.data, w: r.info.width, c: r.info.channels }; };
const SRC_PANEL = opt('--from') || panelFile;                                 // --from : 원래(넓히기 전) 그림
const P = await load(SRC_PANEL), E = await load(extFile);
const lum = (img, x, y) => { const i = (y * img.w + x) * img.c; return img.d[i] * 0.3 + img.d[i + 1] * 0.59 + img.d[i + 2] * 0.11; };

/* ② 원래 배경의 띠(160칸)가 새 그림 어디에 있는지 — 띠 자리도 오른쪽 끝에서 560칸 안쪽까지 40칸씩 바꿔 보며 가장 잘 맞는 곳 */
const score = (pX, x, dy, st) => { let s = 0, n = 0; for (let y = 20; y < H - 20; y += st) { const yy = y + dy; if (yy < 0 || yy >= H) continue; for (let k = 0; k < T; k += st) { s += Math.abs(lum(P, pX + k, y) - lum(E, x + k, yy)); n++; } } return s / n; };
let best = { s: Infinity, x: 0, dy: 0, px: P.w - T };
for (let back = 0; back <= Math.min(Number(opt("--maxback") ?? 560), P.w - T - 400); back += 40) {
  const pX = P.w - T - back;
  for (let dy = -10; dy <= 10; dy += 2) for (let x = 0; x <= Math.min(E.w - T - 200, Math.round(E.w * 0.75)); x += 4) {
    const s = score(pX, x, dy, 8);
    if (s < best.s - 0.05 || (s < best.s + 0.05 && back < P.w - T - best.px)) best = { s, x, dy, px: pX };   // 비슷하면 원래 그림을 더 많이 남기는 쪽
  }
}
for (let dy = best.dy - 2; dy <= best.dy + 2; dy++) for (let x = Math.max(0, best.x - 4); x <= best.x + 4; x++) { const s = score(best.px, x, dy, 3); if (s < best.s) best = { ...best, s, x, dy }; }
console.log(`띠 자리 : 원래 x=${best.px}~${best.px + T} ↔ 새 그림 x=${best.x} · 위아래 ${best.dy} · 평균 밝기 차이 ${best.s.toFixed(1)}`);

/* ③ 붙이기 : 결과 폭 = 원래 + (새 그림에서 띠 끝 이후) */
const keepW = best.px + T;                                      // 원래 그림은 띠 끝까지만 쓴다
const startE = best.x + T;                                     // 새 그림에서 그 자리에 해당하는 열
const addW = E.w - startE, W = keepW + addW, out = Buffer.alloc(W * H * 3);
for (let y = 0; y < H; y++) {
  for (let x = 0; x < keepW; x++) { const si = (y * P.w + x) * P.c, di = (y * W + x) * 3; out[di] = P.d[si]; out[di + 1] = P.d[si + 1]; out[di + 2] = P.d[si + 2]; }
  const yy = Math.min(H - 1, Math.max(0, y + best.dy));
  for (let x = 0; x < addW; x++) { const si = (yy * E.w + startE + x) * E.c, di = (y * W + keepW + x) * 3; out[di] = E.d[si]; out[di + 1] = E.d[si + 1]; out[di + 2] = E.d[si + 2]; }
  for (let k = 0; k < FADE; k++) {                              // 이음새 : 원래 배경 끝 FADE 칸을 새 그림 쪽으로 서서히
    const a = (k + 1) / (FADE + 1), x = keepW - FADE + k, ex = startE - FADE + k;
    const si = (yy * E.w + ex) * E.c, di = (y * W + x) * 3;
    for (let ch = 0; ch < 3; ch++) out[di + ch] = Math.round(out[di + ch] * (1 - a) + E.d[si + ch] * a);
  }
}
if (KEY) {
  const rgba = Buffer.alloc(W * H * 4);
  for (let i = 0, j = 0; i < W * H * 3; i += 3, j += 4) { rgba[j] = out[i]; rgba[j + 1] = out[i + 1]; rgba[j + 2] = out[i + 2]; const r = out[i], g = out[i + 1], b = out[i + 2]; rgba[j + 3] = r > 150 && b > 150 && g < 110 && Math.abs(r - b) < 90 ? 0 : 255; }
  for (let pass = 0; pass < 2; pass++) { const kill = []; for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { const j = (y * W + x) * 4; if (!rgba[j + 3]) continue; if (!((rgba[j] + rgba[j + 2]) / 2 - rgba[j + 1] > 60 && rgba[j] > 110 && rgba[j + 2] > 100)) continue; if (!rgba[j - 4 + 3] || !rgba[j + 4 + 3] || !rgba[j - W * 4 + 3] || !rgba[j + W * 4 + 3]) kill.push(j); } for (const j of kill) rgba[j + 3] = 0; }
  await sharp(rgba, { raw: { width: W, height: H, channels: 4 } }).png({ compressionLevel: 9 }).toFile(OUTFILE + '.new');
} else await sharp(out, { raw: { width: W, height: H, channels: 3 } }).png({ compressionLevel: 9 }).toFile(OUTFILE + '.new');
fs.renameSync(OUTFILE + '.new', OUTFILE);
const mark = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg"><line x1="${keepW}" y1="0" x2="${keepW}" y2="${H}" stroke="red" stroke-width="2" stroke-dasharray="6 6"/></svg>`;
fs.mkdirSync(path.join(ROOT, 'tools/_out'), { recursive: true });
const prev = await sharp(out, { raw: { width: W, height: H, channels: 3 } }).composite([{ input: Buffer.from(mark) }]).png().toBuffer();
await sharp(prev).resize({ width: Math.min(W, 2400) }).png().toFile(path.join(ROOT, `tools/_out/ext_w${n}.png`));
console.log(`→ ${path.basename(OUTFILE)} ${P.w} → ${W}칸 ${W >= NEED ? '✔' : `✘ ${NEED} 보다 좁음 — 한 번 더 이어 그려야 함`}`);
