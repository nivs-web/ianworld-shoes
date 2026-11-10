/**
 * 이안 드래곤 게임 — 월드 확인 장면 (겜팀장) : 실제 화면 크기(640×360)에 배경 · 기지 · 용 · 좀비 · 보스를 늘어놓아
 * 크기 · 색이 서로 어울리는지 본다.   node tools/idg-art-scene.mjs → tools/_out/idg-scene.png (2배)
 */
import sharp from 'sharp';
import { FRAMES } from '../src/games/iandragon_game/art/index.js';
const W = 640, H = 360, buf = Buffer.alloc(W * H * 4);
const put = (name, anim, x, y, anchor = { x: 0.5, y: 1 }) => {
  const f = FRAMES[name].draw(anim); const ox = Math.round(x - f.w * anchor.x), oy = Math.round(y - f.h * anchor.y);
  for (let j = 0; j < f.h; j++) for (let i = 0; i < f.w; i++) { const c = f.get(i, j); if (!c) continue; const X = ox + i, Y = oy + j; if (X < 0 || Y < 0 || X >= W || Y >= H) continue; const t = (Y * W + X) * 4; buf[t] = c[0]; buf[t + 1] = c[1]; buf[t + 2] = c[2]; buf[t + 3] = 255; }
};
const G = 318;                                                       // 땅 높이
put('bg/w01/sky', null, 0, 0, { x: 0, y: 0 }); put('bg/w01/sky', null, 512, 0, { x: 0, y: 0 });
for (const ox of [0, 512]) { put('bg/w01/far', null, ox, 150, { x: 0, y: 0 }); put('bg/w01/near', null, ox, 244, { x: 0, y: 0 }); put('bg/w01/ground', null, ox, G - 6, { x: 0, y: 0 }); }
put('base/nest/0', 'hp1', 52, G); put('leader/novart/0', 'idle0', 56, G - 160 + 30);
put('base/tower/w01', 'hp2', 592, G);
const allies = [['dragon/doldeung/2', 'walk0', 150], ['dragon/kkomul/1', 'walk1', 190], ['dragon/bulttong/1', 'atk1', 226], ['dragon/ssaeng/1', 'walk0', 270], ['dragon/twetwe/1', 'atk0', 118]];
for (const [n, a, x] of allies) put(n, a, x, G);
const foes = [['zombie/walker/0', 'walk0', 312], ['zombie/pup/0', 'walk1', 342], ['zombie/shield/0', 'idle0', 380], ['zombie/chubby/0', 'walk0', 420], ['zombie/archer/0', 'atk0', 460], ['zombie/fart/0', 'atk1', 500], ['boss/bossFat/0', 'walk1', 548]];
for (const [n, a, x] of foes) put(n, a, x, G);
put('fx/hit/0', '2', 252, G - 22); put('crown/0/0', 'idle0', 380, G - 54);
for (const [i, id] of ['ember', 'coin', 'gem', 'star', 'attr_red', 'skill_meteor'].entries()) put(`icon/${id}`, null, 20 + i * 28, 30);
await sharp(buf, { raw: { width: W, height: H, channels: 4 } }).resize(W * 2, H * 2, { kernel: 'nearest' }).png().toFile('tools/_out/idg-scene.png');
console.log('✓ tools/_out/idg-scene.png');
