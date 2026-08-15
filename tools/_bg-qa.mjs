/**
 * 진단용: 배경 포스터에 좌표 격자를 얹어 QA 시트를 만든다. (커밋 대상 아님)
 * node tools/_bg-qa.mjs <출력번호> <파일1> <파일2> ...
 */
import sharp from 'sharp';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CELL_W = 920; // 각 포스터 표시 폭

const [, , outName, ...files] = process.argv;

const tiles = [];
let maxH = 0;
for (const f of files) {
  const src = resolve(ROOT, f);
  const meta = await sharp(src).metadata();
  const scale = CELL_W / meta.width;
  const h = Math.round(meta.height * scale);
  maxH = Math.max(maxH, h);
  tiles.push({ src, w: CELL_W, h, ow: meta.width, oh: meta.height, scale });
}

// 격자 SVG (원본 픽셀 좌표를 라벨로 표시)
function gridSvg(t) {
  const stepX = t.ow <= 1500 ? 50 : 100;
  const stepY = t.oh <= 900 ? 50 : 100;
  let s = `<svg width="${t.w}" height="${t.h}" xmlns="http://www.w3.org/2000/svg">`;
  for (let x = 0; x <= t.ow; x += stepX) {
    const px = Math.round(x * t.scale);
    const major = x % (stepX * 2) === 0;
    s += `<line x1="${px}" y1="0" x2="${px}" y2="${t.h}" stroke="${major ? '#ff0044' : '#ff004455'}" stroke-width="${major ? 1.2 : 0.6}"/>`;
    if (major) s += `<text x="${px + 2}" y="13" font-family="monospace" font-size="13" font-weight="bold" fill="#ff0044">${x}</text>`;
  }
  for (let y = 0; y <= t.oh; y += stepY) {
    const py = Math.round(y * t.scale);
    const major = y % (stepY * 2) === 0;
    s += `<line x1="0" y1="${py}" x2="${t.w}" y2="${py}" stroke="${major ? '#00d0ff' : '#00d0ff55'}" stroke-width="${major ? 1.2 : 0.6}"/>`;
    if (major) s += `<text x="2" y="${py - 3}" font-family="monospace" font-size="13" font-weight="bold" fill="#00d0ff">${y}</text>`;
  }
  s += '</svg>';
  return Buffer.from(s);
}

const cols = 1;
const rows = Math.ceil(tiles.length / cols);
const PAD = 8;
const W = cols * CELL_W + (cols + 1) * PAD;
const H = rows * maxH + (rows + 1) * PAD;

const comps = [];
for (let i = 0; i < tiles.length; i++) {
  const t = tiles[i];
  const cx = PAD + (i % cols) * (CELL_W + PAD);
  const cy = PAD + Math.floor(i / cols) * (maxH + PAD);
  const img = await sharp(t.src).resize(t.w, t.h).png().toBuffer();
  comps.push({ input: img, left: cx, top: cy });
  comps.push({ input: gridSvg(t), left: cx, top: cy });
}

await sharp({ create: { width: W, height: H, channels: 3, background: { r: 12, g: 12, b: 16 } } })
  .composite(comps)
  .png()
  .toFile(`/tmp/bgqa_${outName}.png`);

console.log(`/tmp/bgqa_${outName}.png`, W + 'x' + H);
for (const t of tiles) console.log('  ', t.src.split('/').pop(), t.ow + 'x' + t.oh);
