/**
 * 진단용: 변환된 배경을 게임에서 보이는 대로 조립해 미리 본다. (커밋 대상 아님)
 * 도로(120) + 1층(180) + 반복타일(360) 을 쌓아 180×320 뷰포트 여러 컷으로 보여준다.
 */
import sharp from 'sharp';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = resolve(ROOT, 'public/assets/bg');
const Z = 2;
const [, , mode] = process.argv;

if (mode === 'floors') {
  const ids = ['floor200', 'floor300', 'floor400', 'floor500'];
  const comps = [];
  for (let i = 0; i < ids.length; i++) {
    const buf = await sharp(resolve(DIR, `${ids[i]}.png`))
      .resize(180 * Z, 320 * Z, { kernel: 'nearest' })
      .toBuffer();
    comps.push({ input: buf, left: 8 + i * (180 * Z + 8), top: 8 });
  }
  await sharp({
    create: { width: 8 + ids.length * (180 * Z + 8), height: 320 * Z + 16, channels: 3, background: { r: 16, g: 16, b: 20 } },
  })
    .composite(comps)
    .png()
    .toFile('/tmp/bgprev_floors.png');
  console.log('/tmp/bgprev_floors.png');
} else {
  // 건물: 도로+1층+타일×2 를 세로로 쌓아 1개 컬럼으로
  const from = Number(process.argv[3] ?? 1);
  const to = Number(process.argv[4] ?? 8);
  const colH = 120 + 180 + 360 * 2;
  const comps = [];
  let n = 0;
  for (let i = from; i <= to; i++) {
    const id = `build_${String(i).padStart(2, '0')}`;
    const x = 8 + n * (180 * Z + 8);
    let y = 8 + (colH - 120) * Z; // 도로가 맨 아래
    const road = await sharp(resolve(DIR, `${id}_road.png`)).resize(180 * Z, 120 * Z, { kernel: 'nearest' }).toBuffer();
    comps.push({ input: road, left: x, top: y });
    y -= 180 * Z;
    const f1 = await sharp(resolve(DIR, `${id}_floor1.png`)).resize(180 * Z, 180 * Z, { kernel: 'nearest' }).toBuffer();
    comps.push({ input: f1, left: x, top: y });
    const tile = await sharp(resolve(DIR, `${id}_tile.png`)).resize(180 * Z, 360 * Z, { kernel: 'nearest' }).toBuffer();
    for (let k = 0; k < 2; k++) {
      y -= 360 * Z;
      comps.push({ input: tile, left: x, top: y });
    }
    n++;
  }
  await sharp({
    create: { width: 8 + n * (180 * Z + 8), height: colH * Z + 16, channels: 3, background: { r: 16, g: 16, b: 20 } },
  })
    .composite(comps)
    .png()
    .toFile(`/tmp/bgprev_${from}_${to}.png`);
  console.log(`/tmp/bgprev_${from}_${to}.png`);
}
