/**
 * 뿔 · 볏이 모자 밖으로 삐져나오는지 점검 (겜보조 1 · 11/13) — node tools/idg-wear-poke.mjs [최소칸=6]
 * 덮지 않는 모자(cover:false)마다 대장 용 10마리의 머리 그림에서 «모자 붙는 줄(head.y) 위에 있으면서 모자 그림 영역 밖»인 칸을 센다.
 * 많이 나오는 조합만 표로 낸다 → 그 모자는 wear_items.json 에 cover:true(뿔 · 볏 지운 머리로 바꿔 끼움)로 하거나 dx/dy · w 를 손본다.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const AI = path.join(ROOT, 'public/assets/iandragon_game/ai'), META = path.join(AI, 'meta');
const A = JSON.parse(fs.readFileSync(path.join(META, 'wear_anchor.json'), 'utf8')), I = JSON.parse(fs.readFileSync(path.join(META, 'wear_items.json'), 'utf8'));
const FIXD = JSON.parse(fs.readFileSync(path.join(META, 'rigfix_dragon.json'), 'utf8'));
const MIN = Number(process.argv[2] || 6);
const raw = async (f) => { const { data, info } = await sharp(f).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); return { d: data, w: info.width, h: info.height }; };
const width = (it, D) => Math.max(2, Math.round(it.w * (D.head.w ?? A.sizes[D.size].head)));
const rows = [];
for (const [art, D] of Object.entries(A.dragons)) {
  const rig = JSON.parse(fs.readFileSync(path.join(AI, art, 'rig.json'), 'utf8')), hp = rig.parts.find((p) => p.n === 'head');
  const hf = FIXD[art]?.files?.head || 'head';
  const head = await raw(path.join(AI, art, hf + '.png')), cover = await raw(path.join(ROOT, 'public/assets/iandragon_game', D.cover + '.png'));
  const ox = Math.round(-hp.a[0] * head.w), oy = Math.round(-hp.a[1] * head.h);
  for (const [id, it] of Object.entries(I.items)) {
    if (it.slot !== 'hat') continue;
    const hat = await raw(path.join(META, 'wear/fit', `${id}_${width(it, D)}.png`));
    const hx = Math.round(D.head.x + (it.dx || 0) - it.anchor[0] * hat.w), hy = Math.round(D.head.y + (it.dy || 0) - it.anchor[1] * hat.h);
    const src = it.cover ? cover : head;
    let n = 0;
    for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
      if (src.d[(y * src.w + x) * 4 + 3] < 128) continue;
      const X = ox + x, Y = oy + y;                       // 머리 부품 기준 칸
      if (Y >= D.head.y + (it.dy || 0)) continue;         // 붙는 줄 아래 = 얼굴 (모자 밑으로 들어감)
      const hxl = X - hx, hyl = Y - hy;
      const inBox = hxl >= 0 && hxl < hat.w && hyl >= 0 && hyl < hat.h;
      if (!inBox) { n++; continue; }
      if (hat.d[(hyl * hat.w + hxl) * 4 + 3] < 128) { /* 구멍 · 빈 곳 : 머리가 비쳐 보임 (모자 안쪽이면 괜찮음) */ if (hyl < hat.h * 0.7) n++; }
    }
    rows.push([id, art, n, it.cover]);
  }
}
const by = new Map(); for (const [id, art, n, cv] of rows) { if (!by.has(id)) by.set(id, []); by.get(id).push([art, n, cv]); }
for (const [id, v] of by) {
  const bad = v.filter(([, n]) => n >= MIN);
  console.log(id.padEnd(18), v[0][2] ? '(덮음)' : '(안 덮음)', bad.length ? bad.map(([a, n]) => `${a}:${n}`).join(' ') : '— 괜찮음');
}
