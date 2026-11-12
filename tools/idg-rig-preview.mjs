/**
 * 그림 담당 — 조립 미리보기 (게임 rig.js 와 같은 규칙으로 부품을 겹쳐 PNG 로) · 갤러리 없이 날개 · 부품 점검용
 *
 *   node tools/idg-rig-preview.mjs <출력.png> <id> [id ...] [--k 6] [--wing <대체 날개 폴더>]
 *
 * 규칙 (render/rig.js) : 부품 순서 = 그리는 순서(뒤 → 앞) · a = 그림 안 기준점(비율) · p = 몸 기준점(발밑 가운데)에서의 위치 · flip = 좌우 뒤집기.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const AI = path.join(ROOT, 'public/assets/iandragon_game/ai');
const args = process.argv.slice(2), out = args[0];
const opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const K = Number(opt('--k', 6)), WING = opt('--wing', null);
const ids = args.slice(1).filter((a, i, all) => !a.startsWith('--') && !(all[i - 1] || '').startsWith('--'));

export async function assemble(id, k = K, wingDir = WING) {
  const rig = JSON.parse(fs.readFileSync(path.join(AI, id, 'rig.json'), 'utf8'));
  const S = 120, layers = [];
  for (const p of rig.parts) {
    let f = path.join(AI, id, p.n + '.png');
    if (p.n === 'wing' && wingDir && fs.existsSync(path.join(wingDir, id + '.png'))) f = path.join(wingDir, id + '.png');
    if (!fs.existsSync(f)) continue;
    const m = await sharp(f).metadata();
    let img = sharp(f).resize(m.width * k, m.height * k, { kernel: 'nearest' });
    if (p.flip) img = img.flop();
    const ax = p.flip ? 1 - p.a[0] : p.a[0];
    layers.push({ input: await img.png().toBuffer(), left: Math.round((S + p.p[0] - ax * m.width) * k), top: Math.round((S + p.p[1] - p.a[1] * m.height) * k) });
  }
  const canvas = await sharp({ create: { width: S * 2 * k, height: (S + 10) * k, channels: 4, background: { r: 42, g: 33, b: 64, alpha: 1 } } }).composite(layers).png().toBuffer();
  return sharp(canvas).trim({ threshold: 2 }).png().toBuffer();
}

if (out && ids.length) {
  const bufs = await Promise.all(ids.map((id) => assemble(id)));
  const metas = await Promise.all(bufs.map((b) => sharp(b).metadata()));
  const H = Math.max(...metas.map((m) => m.height)) + 20; let x = 10; const comp = [];
  bufs.forEach((b, i) => { comp.push({ input: b, left: x, top: H - 10 - metas[i].height }); x += metas[i].width + 20; });
  await sharp({ create: { width: x, height: H, channels: 3, background: '#2a2140' } }).composite(comp).png().toFile(out);
  console.log('→', out);
}
