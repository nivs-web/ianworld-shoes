/**
 * 배경 · 성 확인 그림 (겜부장) — 게임 화면과 같은 배치로 한 장을 만든다.
 *   node tools/idg-env-preview.mjs [출력폴더]
 * → scene.png (780×360 ×2 : 배경 4겹 + 양쪽 성 + 지금 시트의 캐릭터들) · bases.png (성 hp0~3 ×2)
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { ENV_FRAMES, NEST_FEET_Y } from '../src/games/iandragon_game/art_env/index.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const OUT = path.resolve(process.argv[2] || path.join(ROOT, 'tools/_out'));
fs.mkdirSync(OUT, { recursive: true });
const W = 780, H = 360, GROUND = 300;

const canvas = (w, h) => ({ w, h, d: new Uint8ClampedArray(w * h * 4) });
function blit(dst, src, ox, oy, sx = 0, sy = 0, sw = src.w, sh = src.h) {
  for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
    const s = ((sy + y) * src.w + sx + x) * 4, a = src.d[s + 3];
    if (!a) continue;
    const X = ox + x, Y = oy + y;
    if (X < 0 || Y < 0 || X >= dst.w || Y >= dst.h) continue;
    const t = (Y * dst.w + X) * 4;
    dst.d[t] = src.d[s]; dst.d[t + 1] = src.d[s + 1]; dst.d[t + 2] = src.d[s + 2]; dst.d[t + 3] = 255;
  }
}
const draw = (name, anim) => { const f = ENV_FRAMES[name]; return f.draw(anim); };
async function save(img, file, k = 2) {
  await sharp(Buffer.from(img.d.buffer), { raw: { width: img.w, height: img.h, channels: 4 } })
    .resize(img.w * k, img.h * k, { kernel: 'nearest' }).png().toFile(path.join(OUT, file));
}

/* 지금 시트에서 캐릭터 프레임 꺼내기 (크기 비교용) */
const atlasJ = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/assets/iandragon_game/atlas.json'), 'utf8'));
const atlasI = await sharp(path.join(ROOT, 'public/assets/iandragon_game/atlas.png')).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const atlas = { w: atlasI.info.width, h: atlasI.info.height, d: atlasI.data };
function sprite(dst, name, footX, footY) {
  const f = atlasJ.frames[name]; if (!f) return;
  const { x, y, w, h } = f.frame;
  blit(dst, atlas, Math.round(footX - w / 2), footY - h, x, y, w, h);
}

const scene = canvas(W, H);
for (const [name, y] of [['bg/w01/sky', 0], ['bg/w01/far', 160], ['bg/w01/near', 220], ['bg/w01/ground', 300]]) {
  const img = draw(name);
  for (let x = 0; x < W; x += img.w) blit(scene, img, x, y);
}
const nest = draw('base/nest/0', 'hp0'), tower = draw('base/tower/w01', 'hp1');
blit(scene, nest, 70 - nest.w / 2, GROUND + 4 - nest.h);
sprite(scene, 'leader/novart/0/idle0', 70, GROUND + 4 - nest.h + NEST_FEET_Y);
blit(scene, tower, W - 70 - tower.w / 2, GROUND + 4 - tower.h);
let x = 150;
for (const id of ['dragon/kkomul/1', 'dragon/doldeung/1', 'dragon/bulttong/1', 'dragon/twetwe/2', 'dragon/ssaeng/1']) { sprite(scene, `${id}/walk0`, x, GROUND + 2); x += 46; }
x = 560;
for (const id of ['zombie/walker/0', 'zombie/chubby/0', 'zombie/pup/0', 'zombie/shield/0']) { sprite(scene, `${id}/walk0`, x, GROUND + 2); x -= 50; }
await save(scene, 'idg-env-scene.png', 2);

const sheet = canvas(4 * 120 + 8, 2 * 184 + 8);
for (let i = 0; i < 4; i++) {
  blit(sheet, draw('base/nest/0', 'hp' + i), 4 + i * 120, 4);
  blit(sheet, draw('base/tower/w01', 'hp' + i), 4 + i * 120, 192);
}
for (let k = 0; k < sheet.d.length; k += 4) if (!sheet.d[k + 3]) { sheet.d[k] = 40; sheet.d[k + 1] = 44; sheet.d[k + 2] = 70; sheet.d[k + 3] = 255; }
await save(sheet, 'idg-env-bases.png', 2);
console.log('확인 그림 → ' + OUT);
