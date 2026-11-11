/**
 * 배경 · 성 그림 WebP 판 만들기 (겜부장 11/11 밤 · 대표님 «로딩이 엄청 느려졌다»)
 *   node tools/idg-webp-bg.mjs
 * ai/bg/layers/*.png (하늘 · 앞 겹) → 같은 이름 .webp (q90 · 투명도 100) — 하늘 1.1MB → 0.14MB 정도
 * ai/castles/*.png → .webp (q92 · 투명도 100)
 * 원본 PNG 는 그대로 둔다 (게임은 WebP 를 먼저 받고 없으면 PNG). 새 파일이라 R2 판 번호를 올릴 필요 없다.
 */
import sharp from 'sharp'; import fs from 'node:fs'; import path from 'node:path';
const A = 'public/assets/iandragon_game/ai';
let before = 0, after = 0, n = 0;
for (const [dir, q] of [['bg/layers', 90], ['castles', 92]]) {
  for (const f of fs.readdirSync(path.join(A, dir)).filter((x) => x.endsWith('.png'))) {
    const src = path.join(A, dir, f), out = src.replace(/\.png$/, '.webp');
    const buf = await sharp(src).webp({ quality: q, alphaQuality: 100, effort: 5 }).toBuffer();
    fs.writeFileSync(out, buf); before += fs.statSync(src).size; after += buf.length; n++;
  }
}
console.log(`${n}개 · ${(before / 1e6).toFixed(1)}MB → ${(after / 1e6).toFixed(1)}MB`);
