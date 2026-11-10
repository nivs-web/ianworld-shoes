/**
 * 이안 드래곤 게임 — 배경 · 성 · 분위기 그림 굽기 (겜부장)
 *   npm run assets:idg-env      → public/assets/iandragon_game/env/{common,w01,...}.png + .json (PixiJS 스프라이트 시트)
 * json meta 에 겹 배치(layers · front · groundY) 와 빛 자리(lights) 를 같이 적는다 → 게임은 그림 코드를 받지 않고 json 만 읽는다.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { ENV_SHEETS, LAYERS, FRONT, GROUND_Y, LIGHTS, BASE_LIGHTS, NEST_FEET_Y, TW } from '../src/games/iandragon_game/art_env/index.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const OUT = path.join(ROOT, 'public/assets/iandragon_game/env');
fs.mkdirSync(OUT, { recursive: true });
const MAX = 4096;

for (const [sheet, frames] of Object.entries(ENV_SHEETS)) {
  const list = [];
  for (const [prefix, def] of Object.entries(frames)) {
    const names = def.anims?.length ? def.anims.map((a) => [`${prefix}/${a}`, a]) : [[prefix, null]];
    for (const [name, a] of names) { const p = def.draw(a); list.push({ name, w: p.w, h: p.h, d: p.d, anchor: def.anchor ?? { x: 0.5, y: 1 } }); }
  }
  const W = Math.min(MAX, Math.max(1024, ...list.map((f) => f.w + 4)));
  let x = 2, y = 2, row = 0;
  for (const f of [...list].sort((a, b) => b.h - a.h || b.w - a.w)) {
    if (x + f.w + 2 > W) { x = 2; y += row + 2; row = 0; }
    f.x = x; f.y = y; x += f.w + 2; row = Math.max(row, f.h);
  }
  const H = y + row + 2;
  if (H > MAX) throw new Error(`${sheet} 시트 높이 ${H} > ${MAX}`);
  const buf = Buffer.alloc(W * H * 4);
  const json = { frames: {}, meta: { image: `${sheet}.png`, size: { w: W, h: H }, scale: 1, by: 'idg-env-build', tile: TW } };
  for (const f of list) {
    for (let j = 0; j < f.h; j++) Buffer.from(f.d.buffer, j * f.w * 4, f.w * 4).copy(buf, ((f.y + j) * W + f.x) * 4);
    json.frames[f.name] = { frame: { x: f.x, y: f.y, w: f.w, h: f.h }, sourceSize: { w: f.w, h: f.h }, spriteSourceSize: { x: 0, y: 0, w: f.w, h: f.h }, anchor: f.anchor };
  }
  if (sheet === 'common') Object.assign(json.meta, { baseLights: BASE_LIGHTS, nestFeetY: NEST_FEET_Y });
  else Object.assign(json.meta, {
    layers: LAYERS[sheet], front: FRONT[sheet], groundY: GROUND_Y,
    lights: Object.fromEntries(Object.entries(LIGHTS).filter(([k]) => k.includes(`/${sheet}/`)).map(([k, v]) => [k, v.map((l) => ({ ...l }))])),
  });
  await sharp(buf, { raw: { width: W, height: H, channels: 4 } }).png({ compressionLevel: 9 }).toFile(path.join(OUT, `${sheet}.png`));
  fs.writeFileSync(path.join(OUT, `${sheet}.json`), JSON.stringify(json));
  console.log(`env/${sheet} : ${list.length}장 · ${W}×${H}`);
}
