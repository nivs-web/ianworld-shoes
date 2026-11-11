/* 부품 캐릭터 발 아래 빈칸 재기 (겜부장 11/11 · 대표님 «보스가 땅 위에 떠 있다») : 기준점 y=0 아래/위로 실제 불투명 픽셀이 어디서 끝나는지 */
import sharp from 'sharp'; import fs from 'node:fs'; import path from 'node:path';
const AI = 'public/assets/iandragon_game/ai';
for (const id of process.argv.slice(2)) {
  const rig = JSON.parse(fs.readFileSync(path.join(AI, id, 'rig.json'), 'utf8')); let bot = -1e9;
  for (const p of rig.parts) {
    const f = path.join(AI, id, p.n + '.png'); if (!fs.existsSync(f)) continue;
    const { data, info } = await sharp(f).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let lo = -1; for (let y = info.height - 1; y >= 0 && lo < 0; y--) for (let x = 0; x < info.width; x++) if (data[(y * info.width + x) * 4 + 3] > 40) { lo = y; break; }
    if (lo >= 0) bot = Math.max(bot, p.p[1] - p.a[1] * info.height + lo + 1);
  }
  console.log(id.padEnd(14), 'scale', rig.scale ?? '-', 'bottom', bot.toFixed(1));
}
