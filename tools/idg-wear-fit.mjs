/**
 * 그림 담당 — 꾸미기 «착용 부품» 맞추기 (2026-11-11 · 대표님 «진짜 용이 쓴 모습을 계산해서, 파는 아이콘과 따로»)
 *
 *   node tools/idg-wear-extract.mjs ...   (먼저 — 모자 시트에서 장식만 떼고 fit.json 에 «머리 대비 크기 · 자리»)
 *   node tools/idg-ui-cut.mjs <목 장식 시트> 3x3 neck_... --out tools/_out/wear_src --max 2000
 *   node tools/idg-wear-fit.mjs
 *
 * 상점 아이콘(정면 · ai/meta/hat_*.png 등)과 착용 부품(옆모습 · ai/meta/wear/)은 따로다.
 * 착용 부품은 게임 부품과 같은 칸 굵기(노바트 머리 45칸 기준)로 줄이고, 반투명을 없앤다.
 *  · 모자 : 제미나이가 «청록 아기 용 머리에 씌운» 그림에서 잰 비율(머리 폭 대비 크기 · 정수리에서 떨어진 자리)을
 *           대장 용마다 head.png 에서 같은 방법으로 잰 정수리에 옮긴다 → 머리 부품의 자식으로 붙인다.
 *  · 고리 장식(목도리 · 메달 · 해골 · 넥타이 · 방울 · 꽃 · 금목걸이 · 덩굴) : 고리 위 반쪽(_back)은 몸통 뒤, 아래 반쪽(_front)은 몸통 앞
 *           → 진짜 목에 건 것처럼. 둘 다 몸통 기준 «목 점»(머리 회전축)에.
 *  · 망토 : 통째로 몸통 뒤 층, 오른쪽 위 걸쇠가 «목 뒤 점»에.
 * 결과 : public/assets/iandragon_game/ai/meta/wear/*.png · ai/meta/wear.json
 * 손으로 고칠 값 : NUDGE (대장 용별 · 칸) · NECK (장식별 크기 · 붙는 점)
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const AI = path.join(ROOT, 'public/assets/iandragon_game/ai');
const SRC = path.join(ROOT, 'tools/_out/wear_src');
const OUT = path.join(AI, 'meta/wear');
const LEADERS = ['novart', 'aquantis', 'forestia', 'crimsonde', 'volttail', 'solaris', 'sandscale', 'shadowfen', 'frostwing', 'goldrex'];
const FIT = JSON.parse(fs.readFileSync(path.join(SRC, 'fit.json'), 'utf8'));
/** 목 장식 : 폭(칸) · 붙는 점(그림 안 비율) — 고리는 가운데, 망토는 오른쪽 위 걸쇠 */
const NECK = {
  neck_cape: { w: 30, anchor: [0.82, 0.12], split: false },
  neck_scarf: { w: 26, anchor: [0.62, 0.3] }, neck_medal: { w: 20, anchor: [0.45, 0.25] }, neck_skull: { w: 22, anchor: [0.5, 0.3] },
  neck_bow: { w: 22, anchor: [0.4, 0.28] }, neck_bell: { w: 20, anchor: [0.45, 0.25] }, neck_lei: { w: 24, anchor: [0.5, 0.3] },
  neck_chain: { w: 20, anchor: [0.5, 0.25] }, neck_vine: { w: 24, anchor: [0.5, 0.3] },
};
/** 대장 용별 보정 (칸) — 10마리 확인 그림을 보고 고친다 */
const NUDGE = {};
const SINK = 4;                                                                  // 모자가 머리에 파묻히는 칸 (털 · 비늘 위에 살짝 눌러 쓴 느낌)

fs.mkdirSync(OUT, { recursive: true });

/** 고해상 그림 → w 칸 폭 도트 (반투명 없음) */
async function toNative(file, w) {
  const m = await sharp(file).metadata();
  const h = Math.max(1, Math.round(m.height * w / m.width));
  const { data } = await sharp(file).resize(w, h, { kernel: 'lanczos3' }).raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 120) { data[i] = data[i + 1] = data[i + 2] = data[i + 3] = 0; continue; }
    const a = data[i + 3] / 255; data[i] = Math.min(255, data[i] / a); data[i + 1] = Math.min(255, data[i + 1] / a); data[i + 2] = Math.min(255, data[i + 2] / a); data[i + 3] = 255;
  }
  return { data, w, h };
}
const save = (img, name) => sharp(img.data, { raw: { width: img.w, height: img.h, channels: 4 } }).png({ compressionLevel: 9 }).toFile(path.join(OUT, name + '.png'));

/** 머리 그림의 폭 · 정수리 (idg-wear-extract 와 같은 잣대) */
async function headRuler(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let x0 = info.width, x1 = -1;
  const top = [];
  for (let x = 0; x < info.width; x++) { let y = 0; while (y < info.height && data[(y * info.width + x) * 4 + 3] < 128) y++; top.push(y); if (y < info.height) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); } }
  const hw = x1 - x0 + 1 - 2;                                                    // 바깥 외곽선 1칸씩 빼고 (제미나이 쪽은 청록 살만 쟀다)
  const xs = []; for (let x = Math.round(x0 + hw * 0.46); x <= Math.round(x0 + hw * 0.72); x++) xs.push(top[x]);
  xs.sort((a, b) => a - b);
  const bs = []; for (let x = Math.round(x0 + hw * 0.62); x <= Math.round(x0 + hw * 0.85); x++) bs.push(top[x]);
  bs.sort((a, b) => a - b);
  // browY = 뿔 앞 «이마 선» 높이 — 모자는 이 선 근처 칸에만 얹힌다 (이보다 2칸 넘게 높은 칸 = 뿔 · 볏 · 갈기)
  return { w: info.width, h: info.height, hw, top, skullX: x0 + hw * 0.6, skullY: xs[Math.floor(xs.length / 2)] + 1, browY: bs[Math.floor(bs.length / 2)] };
}

/* 1. 모자 — 노바트 머리 기준 칸 굵기 */
const NOV = await headRuler(path.join(AI, 'novart/head.png'));
const items = {};
for (const [name, f] of Object.entries(FIT)) {
  if (f.kind !== 'hat' || !fs.existsSync(path.join(SRC, name + '.png'))) continue;
  const w = Math.max(6, Math.round(f.w * NOV.hw));
  const img = await toNative(path.join(SRC, name + '.png'), w);
  await save(img, name);
  // 정수리 기준 자리 → 붙는 점은 «장식 왼쪽 위» 로 두고, 대장 용마다 정수리 + (left, top) × 머리 폭
  const bottom = [];                                                            // 칸(열)마다 모자 맨 아래 칸
  for (let x = 0; x < img.w; x++) { let y = img.h - 1; while (y >= 0 && !img.data[(y * img.w + x) * 4 + 3]) y--; bottom.push(y); }
  items[name] = { file: `ai/meta/wear/${name}.png`, w: img.w, h: img.h, slot: 'hat', part: 'head', layer: 'front', anchor: [0, 0], rel: { left: f.left, top: f.top }, bottom };
}

/* 2. 목 장식 */
for (const [name, def] of Object.entries(NECK)) {
  const file = path.join(SRC, name + '.png'); if (!fs.existsSync(file)) continue;
  const img = await toNative(file, def.w);
  if (def.split === false) {
    await save(img, name);
    items[name] = { file: `ai/meta/wear/${name}.png`, w: img.w, h: img.h, slot: 'neck', part: 'torso', at: 'nape', layer: 'behind', anchor: def.anchor };
    continue;
  }
  const cut = Math.round(img.h * def.anchor[1]);                                 // 고리 가운데 높이에서 위 · 아래로 나눈다
  const back = Buffer.from(img.data), front = Buffer.from(img.data);
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) { const i = (y * img.w + x) * 4 + 3; if (y >= cut) back[i] = 0; else front[i] = 0; }
  await save({ ...img, data: back }, name + '_back');
  await save({ ...img, data: front }, name + '_front');
  items[name] = { files: { back: `ai/meta/wear/${name}_back.png`, front: `ai/meta/wear/${name}_front.png` }, w: img.w, h: img.h, slot: 'neck', part: 'torso', at: 'neck', layer: 'split', anchor: def.anchor };
}

/* 3. 대장 용별 붙는 자리 (그 부품 원점 = anchor 점 기준 칸) */
const leaders = {};
for (const id of LEADERS) {
  const rig = JSON.parse(fs.readFileSync(path.join(AI, id, 'rig.json'), 'utf8'));
  const P = Object.fromEntries(rig.parts.map((p) => [p.n, p]));
  const R = await headRuler(path.join(AI, id, 'head.png'));
  const T = await sharp(path.join(AI, id, 'torso.png')).metadata();
  const n = NUDGE[id] || {};
  const hat = {};
  for (const [name, it] of Object.entries(items)) {
    if (it.slot !== 'hat') continue;
    const x = Math.round(R.skullX + it.rel.left * R.hw);                         // 장식 왼쪽 위 (머리 그림 좌표) — 가로는 비율대로
    /* 세로는 «얹기» : 모자 아랫선 칸마다 그 아래 머리 윗선까지 거리 → 뿔이 아닌 자리(정수리 높이 근처) 중 가장 먼저 닿는 곳에 SINK 칸 파묻힘 */
    let y = R.skullY + it.rel.top * R.hw, best = Infinity;
    for (let c = 0; c < it.w; c++) {
      const X = x + c, b = it.bottom[c];
      if (b < 0 || X < 0 || X >= R.w || R.top[X] >= R.h) continue;              // 모자 칸 없음 · 머리 밖(챙)
      if (R.top[X] < R.browY - 2) continue;                                      // 뿔 · 볏 · 갈기 끝 (이마 선보다 높이 솟은 칸)
      best = Math.min(best, R.top[X] - b);
    }
    if (best < Infinity) y = best + SINK;
    hat[name] = { x: Math.round(x - P.head.a[0] * R.w + (n.hat?.[0] || 0)), y: Math.round(y - P.head.a[1] * R.h + (n.hat?.[1] || 0)) };
  }
  // 목 점 = 머리 회전축(몸통 원점 기준) · 목 뒤 점 = 목 점에서 몸통 폭 22% 뒤
  const neck = { x: Math.round(P.head.p[0] - P.torso.p[0] - 2 + (n.neck?.[0] || 0)), y: Math.round(P.head.p[1] - P.torso.p[1] + 2 + (n.neck?.[1] || 0)) };
  const nape = { x: Math.round(neck.x - T.width * 0.22 + (n.nape?.[0] || 0)), y: neck.y - 1 + (n.nape?.[1] || 0) };
  leaders[id] = { hat, neck, nape };
}
const out = {
  note: '착용 부품 (상점 아이콘 ai/meta/hat_*.png 와 따로). 모자 = head 부품의 자식, leaders[id].hat[이름] (x, y) 에 그림 왼쪽 위. 목 = torso 부품 기준: layer split 은 _back 을 몸통 뒤 · _front 를 몸통 앞(머리보다 뒤)에, anchor 점을 neck 에. 망토(behind)는 anchor 점을 nape 에, 몸통 뒤 층(몸통과 같이 움직이게). 좌표 단위 = 부품 칸(rig 배율 전).',
  items, leaders,
};
fs.writeFileSync(path.join(AI, 'meta/wear.json'), JSON.stringify(out, null, 1) + '\n');
console.log(`착용 부품 ${Object.keys(items).length}개 · 대장 용 ${LEADERS.length}마리 → ai/meta/wear.json`);
for (const [k, v] of Object.entries(items)) console.log(' ', k, `${v.w}×${v.h}`, v.layer);
