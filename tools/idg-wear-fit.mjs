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
const COVER = 0.5;                                                                // 챙 높이 = 이마 꼭대기 → 눈 사이 이 비율 (대표님 «눈과 이마 사이 절반»)
const SINK = 1;                                                                  // 모자가 머리에 파묻히는 칸 (털 · 비늘 위에 살짝 눌러 쓴 느낌)

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

/* 1. 대장 용 머리 재기 — 눈 · 이마 · «덮는 선»(이마 꼭대기와 눈 사이 절반) · 그 높이의 머리 폭 */
const EYE_FIX = { volttail: 14 };                                                  // 눈 찾기가 입선을 잡은 용 — 손으로 (눈 윗줄)
async function measure(id) {
  const { data, info } = await sharp(path.join(AI, id, 'head.png')).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, a = (x, y) => x >= 0 && y >= 0 && x < W && y < H && data[(y * W + x) * 4 + 3] > 128;
  const v = (x, y) => { const i = (y * W + x) * 4; return Math.max(data[i], data[i + 1], data[i + 2]) / 255; };
  const dark = new Uint8Array(W * H);
  for (let y = Math.floor(H * 0.28); y < H * 0.7; y++) for (let x = Math.floor(W * 0.48); x < W * 0.82; x++) {
    if (!a(x, y) || v(x, y) > 0.32) continue;
    let inner = true; for (let d = -2; d <= 2 && inner; d++) for (let e = -2; e <= 2; e++) if (!a(x + d, y + e)) { inner = false; break; }
    if (inner) dark[y * W + x] = 1;
  }
  const seen = new Uint8Array(W * H); let best = [];
  for (let i = 0; i < W * H; i++) {
    if (!dark[i] || seen[i]) continue;
    const c = [i], st = [i]; seen[i] = 1;
    while (st.length) { const p = st.pop(), x = p % W, y = (p / W) | 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const q = (y + dy) * W + x + dx; if (x + dx >= 0 && x + dx < W && y + dy >= 0 && y + dy < H && dark[q] && !seen[q]) { seen[q] = 1; c.push(q); st.push(q); } } }
    if (c.length > best.length) best = c;
  }
  const eyeX = best.length ? Math.round(best.reduce((t, p) => t + (p % W), 0) / best.length) : Math.round(W * 0.6);
  const eyeTop = EYE_FIX[id] ?? (best.length ? Math.min(...best.map((p) => (p / W) | 0)) : Math.round(H * 0.45));
  const top = []; for (let x = 0; x < W; x++) { let y = 0; while (y < H && !a(x, y)) y++; top.push(y); }
  const tops = []; for (let x = Math.max(0, eyeX - 3); x <= Math.min(W - 1, eyeX + 3); x++) tops.push(top[x]);
  tops.sort((p, q) => p - q);
  const browTop = tops[Math.floor(tops.length / 2)];                              // 눈 위 이마 꼭대기 (뿔 끝이 아니라 가운데 값)
  const coverY = Math.round(browTop + COVER * (eyeTop - browTop));               // 모자 챙이 내려오는 선
  let L = W, R = -1; for (let x = 0; x < W; x++) if (a(x, coverY)) { L = Math.min(L, x); R = Math.max(R, x); }
  return { W, H, eyeX, eyeTop, browTop, coverY, L, R };
}
const M = {}; for (const id of LEADERS) M[id] = await measure(id);
const SPAN = Math.max(...LEADERS.map((id) => M[id].R - M[id].L + 1)) + 2;          // 챙이 덮어야 할 가장 넓은 머리 폭 (+양쪽 1칸)

/* 2. 모자 — 고해상 원본에서 «챙 폭 = SPAN» 이 되게 바로 줄인다 (칸 굵기 유지) · 리본은 꽂는 장식(덮지 않음) */
const items = {};
async function brimOf(file) {                                                      // 챙(밑동) = 아래쪽 30% 높이에 칸이 있는 열 전체 — 깃털 · 고깔 끝은 위쪽이라 빠진다
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let x0 = info.width, x1 = -1;
  for (let y = Math.floor(info.height * 0.7); y < info.height; y++) for (let x = 0; x < info.width; x++) if (data[(y * info.width + x) * 4 + 3] >= 128) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); }
  return { x0, x1, w: info.width, h: info.height };
}
for (const [name, f] of Object.entries(FIT)) {
  if (f.kind !== 'hat' || !fs.existsSync(path.join(SRC, name + '.png'))) continue;
  const clip = name === 'hat_ribbon';
  const B = await brimOf(path.join(SRC, name + '.png'));
  const w = clip ? Math.round(f.w * M.novart.R * 0.9) : Math.round(B.w * SPAN / (B.x1 - B.x0 + 1));
  const img = await toNative(path.join(SRC, name + '.png'), Math.max(8, w));
  await save(img, name);
  const bottom = []; for (let x = 0; x < img.w; x++) { let y = img.h - 1; while (y >= 0 && !img.data[(y * img.w + x) * 4 + 3]) y--; bottom.push(y); }
  const k = img.w / B.w, bx0 = Math.round(B.x0 * k), bx1 = Math.round(B.x1 * k);
  const bs = bottom.slice(bx0, bx1 + 1).filter((b) => b >= 0).sort((p, q) => p - q);
  items[name] = { file: `ai/meta/wear/${name}.png`, w: img.w, h: img.h, slot: 'hat', part: 'head', layer: 'front', anchor: [0, 0], cover: !clip, brim: [bx0, bx1], brimY: bs[Math.floor(bs.length * 0.3)] ?? img.h - 1 };
}

/* 3. 목 장식 */
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

/* 4. 대장 용별 붙는 자리 + «모자용 머리» (덮는 선 위 뿔 · 볏을 지운 머리 · 깜빡 · 브레스) */
const leaders = {};
fs.mkdirSync(path.join(OUT, 'heads'), { recursive: true });
for (const id of LEADERS) {
  const rig = JSON.parse(fs.readFileSync(path.join(AI, id, 'rig.json'), 'utf8'));
  const P = Object.fromEntries(rig.parts.map((p) => [p.n, p]));
  const m = M[id], T = await sharp(path.join(AI, id, 'torso.png')).metadata();
  const n = NUDGE[id] || {};
  const hat = {};
  for (const [name, it] of Object.entries(items)) {
    if (it.slot !== 'hat') continue;
    let x, y;
    if (it.cover) {                                                               // 챙 가운데 = 덮는 선의 머리 가운데 · 챙 바닥 = 덮는 선 + SINK
      x = Math.round((m.L + m.R) / 2 - (it.brim[0] + it.brim[1]) / 2);
      y = m.coverY + SINK - it.brimY;
    } else {                                                                      // 꽂는 장식 (리본) : 덮지 않는다 (뿔 그대로)
      x = Math.round(m.L + (m.R - m.L) * 0.42 - it.w / 2); y = Math.round(m.coverY - it.h * 0.62);   // 뿔 밑동 · 이마 옆에 반쯤 걸린 머리핀
    }
    x += n.hat?.[0] || 0; y += n.hat?.[1] || 0;
    const e = { x: Math.round(x - P.head.a[0] * m.W), y: Math.round(y - P.head.a[1] * m.H) };
    if (it.cover) {                                                               // 모자용 머리 : 덮는 선 위(= 모자 밖으로 삐져나올 뿔 · 볏 · 정수리)를 지운다
      const cut = m.coverY - 1, dir = path.join(OUT, 'heads', id);
      fs.mkdirSync(dir, { recursive: true });
      e.head = {};
      for (const tn of [P.head.n, P.head.blink, P.head.breath].filter(Boolean)) {
        const { data, info } = await sharp(path.join(AI, id, tn + '.png')).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        for (let yy = 0; yy < Math.min(cut, info.height); yy++) for (let xx = 0; xx < info.width; xx++) data[(yy * info.width + xx) * 4 + 3] = 0;
        await sharp(data, { raw: info }).png({ compressionLevel: 9 }).toFile(path.join(dir, `${name}_${tn}.png`));
        e.head[tn] = `ai/meta/wear/heads/${id}/${name}_${tn}.png`;
      }
    }
    hat[name] = e;
  }
  const neck = { x: Math.round(P.head.p[0] - P.torso.p[0] - 2 + (n.neck?.[0] || 0)), y: Math.round(P.head.p[1] - P.torso.p[1] + 2 + (n.neck?.[1] || 0)) };
  const nape = { x: Math.round(neck.x - T.width * 0.22 + (n.nape?.[0] || 0)), y: neck.y - 1 + (n.nape?.[1] || 0) };
  leaders[id] = { hat, neck, nape, measure: { eye: [m.eyeX, m.eyeTop], browTop: m.browTop, coverY: m.coverY, span: [m.L, m.R] } };
}
for (const it of Object.values(items)) delete it.brimY;
const out = {
  note: '착용 부품 (상점 아이콘 ai/meta/hat_*.png 와 따로). 모자 = head 부품의 자식, leaders[id].hat[이름] (x, y) 에 그림 왼쪽 위. cover 모자를 쓰면 그 용의 head 텍스처들(head · head_blink · head_breath)을 leaders[id].hat[이름].head[원래 이름] 그림으로 바꾼다 (덮는 선 위 뿔 · 볏을 지운 머리 — 뿔이 모자를 뚫고 나오지 않게). 목 = torso 부품 기준: layer split 은 _back 을 몸통 뒤 · _front 를 몸통 앞(머리보다 뒤)에, anchor 점을 neck 에. 망토(behind)는 anchor 점을 nape 에, 몸통 뒤 층(몸통과 같이 움직이게). 좌표 단위 = 부품 칸(rig 배율 전).',
  items, leaders,
};
fs.writeFileSync(path.join(AI, 'meta/wear.json'), JSON.stringify(out, null, 1) + '\n');
console.log(`착용 부품 ${Object.keys(items).length}개 · 대장 용 ${LEADERS.length}마리 → ai/meta/wear.json`);
for (const [k, v] of Object.entries(items)) console.log(' ', k, `${v.w}×${v.h}`, v.layer);
