/**
 * 부품 캐릭터 기본 자세 한 장 (겜부장 · 2026-11-11 대표님 «날개가 뒤통수에 · 꼬리 위치가 이상하다» 점검용)
 *   node tools/_rig-sheet.mjs <출력.png> [id …]   (id 를 안 주면 ai/ 아래 rig.json 이 있는 모든 용 · 리더)
 * rig.json 의 parts 를 순서대로 a(기준점) · p(자리) · flip 그대로 겹친다 (움직임 없음 · 3배 확대 · 기준점은 빨간 점).
 */
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const AI = 'public/assets/iandragon_game/ai';
const [out, ...want] = process.argv.slice(2);
const ids = want.length ? want : fs.readdirSync(AI).filter((d) => fs.existsSync(path.join(AI, d, 'rig.json')) && JSON.parse(fs.readFileSync(path.join(AI, d, 'rig.json'), 'utf8')).kind !== 'zombie');
const CW = 150, CH = 130, K = 2, COLS = 6;
const tiles = [];
for (const id of ids) {
  const rig = JSON.parse(fs.readFileSync(path.join(AI, id, 'rig.json'), 'utf8'));
  const comp = [], dots = [];
  for (const p of rig.parts) {
    const f = path.join(AI, id, p.n + '.png'); if (!fs.existsSync(f)) continue;
    let img = sharp(f); const m = await img.metadata();
    if (p.flip) img = img.flop();
    const buf = await img.png().toBuffer();
    const ax = p.flip ? 1 - p.a[0] : p.a[0];   // 뒤집으면 기준점도 거울
    const left = Math.round(CW / 2 + p.p[0] - ax * m.width), top = Math.round(CH - 12 + p.p[1] - p.a[1] * m.height);
    comp.push({ input: buf, left: Math.max(0, left), top: Math.max(0, top) });
    dots.push([CW / 2 + p.p[0], CH - 12 + p.p[1], p.n]);
  }
  const svg = `<svg width="${CW}" height="${CH}" xmlns="http://www.w3.org/2000/svg">${dots.map(([x, y, n]) => `<circle cx="${x}" cy="${y}" r="1.5" fill="${n === 'wing' ? '#0f0' : n === 'tail' ? '#0ff' : 'red'}"/>`).join('')}<text x="3" y="11" font-size="10" fill="#fff" font-family="Arial">${id}</text></svg>`;
  const t = await sharp({ create: { width: CW, height: CH, channels: 4, background: { r: 40, g: 30, b: 70, alpha: 1 } } }).composite([...comp, { input: Buffer.from(svg) }]).png().toBuffer();
  tiles.push(t);
}
const rows = Math.ceil(tiles.length / COLS);
const sheet = await sharp({ create: { width: CW * COLS, height: CH * rows, channels: 4, background: { r: 20, g: 14, b: 36, alpha: 1 } } })
  .composite(tiles.map((t, i) => ({ input: t, left: (i % COLS) * CW, top: Math.floor(i / COLS) * CH }))).png().toBuffer();
await sharp(sheet).resize(CW * COLS * K, CH * rows * K, { kernel: 'nearest' }).toFile(out);
console.log(`→ ${out} (${tiles.length}개)`);
