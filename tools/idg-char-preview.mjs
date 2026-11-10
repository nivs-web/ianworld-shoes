/**
 * 캐릭터 줄 세우기 확인 그림 (겜부장) — node tools/idg-char-preview.mjs <출력.png> <id[:L|R]> ...
 * 조립된 rig 를 쉬는 자세로 나란히 놓고 3배로 키운다. :L 은 왼쪽을 보게(좀비), :R 은 오른쪽(용).
 */
import fs from 'node:fs';
import sharp from 'sharp';
const [out, ...ids] = process.argv.slice(2);
const BASE = 'public/assets/iandragon_game/ai/';
const tiles = [];
let x = 0;
for (const spec of ids) {
  const [id, want] = spec.split(':');
  const rig = JSON.parse(fs.readFileSync(BASE + id + '/rig.json', 'utf8'));
  const W = Number(process.env.PW || 170), H = Number(process.env.PH || 130), ox = W / 2, oy = H - 8, comps = [];
  for (const p of rig.parts) {
    const f = BASE + id + '/' + p.n + '.png', m = await sharp(f).metadata();
    let img = sharp(f), ax = p.a[0];
    if (p.flip) { img = img.flop(); ax = 1 - ax; }
    comps.push({ input: await img.png().toBuffer(), left: Math.round(ox + p.p[0] - m.width * ax), top: Math.round(oy + p.p[1] - m.height * p.a[1]) });
  }
  let buf = await sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite(comps).png().toBuffer();
  const wantDir = want === 'L' ? -1 : want === 'R' ? 1 : rig.face;
  if (wantDir !== rig.face) buf = await sharp(buf).flop().png().toBuffer();
  tiles.push({ input: buf, left: x, top: 0 }); x += W;
}
const img = await sharp({ create: { width: x, height: Number(process.env.PH || 130), channels: 4, background: "#2a2050" } }).composite(tiles).png().toBuffer();
await sharp(img).resize(x * 3, Number(process.env.PH || 130) * 3, { kernel: 'nearest' }).png().toFile(out);
console.log('→ ' + out);
