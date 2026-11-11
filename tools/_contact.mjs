/* 캡처 모음 한 장 (겜부장 점검용) : node tools/_contact.mjs <폴더> <앞글자> <출력.jpg> [칸 너비=300] [열=6] */
import sharp from 'sharp'; import fs from 'node:fs'; import path from 'node:path';
const [dir, pre, out, W0 = 300, C0 = 6] = process.argv.slice(2); const W = +W0, C = +C0, H = Math.round(W * 1.0);
const files = fs.readdirSync(dir).filter((f) => f.startsWith(pre) && f.endsWith('.png')).sort();
const tiles = await Promise.all(files.map(async (f) => {
  const img = await sharp(path.join(dir, f)).resize(W, H - 16, { fit: 'contain', background: '#111' }).toBuffer();
  const lab = Buffer.from(`<svg width="${W}" height="16"><rect width="100%" height="100%" fill="#000"/><text x="3" y="12" font-size="11" fill="#ff0" font-family="Arial">${f.replace('.png', '')}</text></svg>`);
  return sharp({ create: { width: W, height: H, channels: 3, background: '#111' } }).composite([{ input: lab, left: 0, top: 0 }, { input: img, left: 0, top: 16 }]).png().toBuffer();
}));
const R = Math.ceil(tiles.length / C);
await sharp({ create: { width: W * C, height: H * R, channels: 3, background: '#000' } }).composite(tiles.map((t, i) => ({ input: t, left: (i % C) * W, top: Math.floor(i / C) * H }))).jpeg({ quality: 78 }).toFile(out);
console.log(files.length, 'tiles');
