/**
 * 그림 담당 — 성 잔해 (hp0 크기판) · 무너짐 프레임 띠 (2026-11-11 · 겜부장 주문 «폭발 → 깜박깜박 → 와르르 무너지며 먼지 → 잔해가 남는다 · 투명하게 사라지기 금지»)
 *
 *   node tools/idg-castle-rubble.mjs        (먼저 tools/idg-castle-fall.mjs 로 <성>_ruin.png · ai/fx/dust_* · debris_* 를 만든 뒤)
 *
 *  ai/castles/tower_w01~w10_rubble.png · tower_rubble.png(= 월드 1 · 공용) · nest_rubble.png
 *    = <성>_ruin.png 를 그 성 hp0 과 **같은 칸 크기 · 같은 바닥선**(아래 끝 · 가로 가운데)에 놓은 것. 칸보다 넓으면 비율 그대로 줄여 맞춤.
 *  ai/fx/crumble.png + crumble.json — 무너지는 돌덩이 · 먼지 구름 8프레임 가로 띠 (300×200 · 10fps · loop:false · anchor 바닥 가운데)
 *    제미나이로 그린 먼지(dust_0~3) · 파편(debris_0~7) 조각을 프레임마다 배치 — 돌은 위에서 떨어지고 먼지는 바닥에서 부풀었다가 작아짐 (반투명 없음)
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const C = path.join(ROOT, 'public/assets/iandragon_game/ai/castles');
const FX = path.join(ROOT, 'public/assets/iandragon_game/ai/fx');
const made = [];

/* 1) 잔해를 hp0 칸에 */
const pairs = [['nest', 'nest'], ['tower', 'tower_w01'], ...Array.from({ length: 9 }, (_, i) => { const n = 'w' + String(i + 2).padStart(2, '0'); return [`tower_${n}`, `tower_${n}`]; })];
for (const [src, dst] of pairs) {
  const hp0 = await sharp(path.join(C, `${src}_hp0.png`)).metadata(), ru = await sharp(path.join(C, `${src}_ruin.png`)).metadata();
  const k = Math.min(1, hp0.width / ru.width, hp0.height / ru.height), w = Math.round(ru.width * k), h = Math.round(ru.height * k);
  const img = k < 1 ? await sharp(path.join(C, `${src}_ruin.png`)).resize(w, h, { kernel: 'nearest' }).png().toBuffer() : await sharp(path.join(C, `${src}_ruin.png`)).png().toBuffer();
  const out = await sharp({ create: { width: hp0.width, height: hp0.height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([{ input: img, left: Math.round((hp0.width - w) / 2), top: hp0.height - h }]).png({ compressionLevel: 9 }).toBuffer();
  fs.writeFileSync(path.join(C, `${dst}_rubble.png`), out);
  if (src === 'tower') fs.writeFileSync(path.join(C, 'tower_rubble.png'), out);
  made.push(`ai/castles/${dst}_rubble.png ${hp0.width}×${hp0.height}${src === 'tower' ? ' (+ tower_rubble.png 공용 = 월드 1)' : ''}`);
}

/* 2) 무너짐 프레임 띠 */
const FW = 300, FH = 200, N = 8;
const dust = await Promise.all([0, 1, 2, 3].map((k) => sharp(path.join(FX, `dust_${k}.png`)).png().toBuffer()));
const deb = await Promise.all([0, 1, 2, 3, 4, 5, 6, 7].map((k) => sharp(path.join(FX, `debris_${k}.png`)).png().toBuffer()));
const rnd = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
const stones = Array.from({ length: 14 }, (_, i) => ({ img: deb[i % 8], x: 30 + rnd() * (FW - 60), y0: 10 + rnd() * 70, vy: 18 + rnd() * 16, delay: Math.floor(rnd() * 3) }));
const puffs = Array.from({ length: 7 }, (_, i) => ({ x: 25 + (i / 6) * (FW - 50) + (rnd() - 0.5) * 20, born: Math.floor(rnd() * 2) + (i % 2) }));
const frames = [];
for (let f = 0; f < N; f++) {
  const layers = [];
  for (const p of puffs) {                                                        // 먼지 : 바닥에서 부풀었다(0→3) 작아짐(3→0) · 투명도는 안 씀
    const age = f - p.born; if (age < 0) continue;
    const size = [0, 1, 2, 3, 3, 2, 1, 0][Math.min(7, age)], img = dust[size], m = await sharp(img).metadata();
    const rise = age * 6;
    layers.push({ input: img, left: Math.round(p.x - m.width / 2), top: Math.round(FH - m.height - 4 - rise) });
  }
  for (const s of stones) {                                                       // 돌 : 떨어져 바닥에 닿으면 굴러 멈춤
    const t = f - s.delay; if (t < 0) continue;
    const m = await sharp(s.img).metadata(), y = Math.min(FH - m.height - 2, s.y0 + s.vy * t + 6 * t * t);
    layers.push({ input: s.img, left: Math.round(s.x - m.width / 2), top: Math.round(y) });
  }
  const safe = layers.filter((l) => l.left > -40 && l.top > -40).map((l) => ({ ...l, left: Math.max(0, Math.min(FW - 1, l.left)), top: Math.max(0, Math.min(FH - 1, l.top)) }));
  const fb = await sharp({ create: { width: FW, height: FH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite(safe).png().toBuffer();
  frames.push({ input: fb, left: f * FW, top: 0 });
}
await sharp({ create: { width: FW * N, height: FH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite(frames).png({ compressionLevel: 9 }).toFile(path.join(FX, 'crumble.png'));
fs.writeFileSync(path.join(FX, 'crumble.json'), JSON.stringify({ file: 'ai/fx/crumble.png', frames: N, w: FW, h: FH, fps: 10, loop: false, anchor: [0.5, 1], note: '가로 띠 · 한 번만 · anchor = 바닥 가운데(성 바닥 가운데에 맞춤) · 성 폭에 맞게 크기 조절 · 마지막 프레임 뒤 잔해(<성>_rubble)만 남김' }, null, 1) + '\n');
made.push(`ai/fx/crumble.png ${FW}×${FH} × ${N}프레임 + crumble.json`);
console.log(made.map((m) => '→ ' + m).join('\n'));
