/**
 * 그림 담당 — 용 부품 그림 고치기 (겜보조 · 2026-11-12 · 대표님 «메아리 귀가 투명하고 찢어져 보인다 · 반짝이 눈이 없다 · 솜뭉치가 피카소 그림»)
 *
 *   node tools/idg-dragon-partfix.mjs      → 아래 새 이름 그림을 만든다 (원래 그림은 R2 1년 캐시라 덮어쓰지 않는다)
 *     meari/head_ear1.png · head_blink_ear1.png   왼쪽 귀 안쪽 투명 구멍을 둘레 색으로 채움 (닫힘 연산 → 가장 가까운 안쪽 색)
 *     banjjak/head_eye1.png                         빈 눈(빛나는 동그라미)에 눈동자 · 반짝이 그려 넣음 + 먼 쪽 눈
 *     sommung/arm_f_fix1.png · arm_b_fix1.png        팔 그림에 같이 잘려 들어온 날개 조각 지움
 * 연결은 ai/meta/rigfix_dragon_v2.json 의 files (tools/idg-rigfix-dragon.mjs FILES 표).
 */
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const AI = path.join(ROOT, 'public/assets/iandragon_game/ai');

async function load(id, n) {
  const { data, info } = await sharp(path.join(AI, id, n + '.png')).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  const at = (x, y) => (y * W + x) * 4;
  return { data, W, H, at, on: (x, y) => x >= 0 && y >= 0 && x < W && y < H && data[at(x, y) + 3] > 128 };
}
const save = (img, id, n) => sharp(img.data, { raw: { width: img.W, height: img.H, channels: 4 } }).png().toFile(path.join(AI, id, n + '.png')).then(() => console.log(`→ ${id}/${n}.png`));
const put = (img, x, y, hex) => { const i = img.at(x, y); img.data[i] = parseInt(hex.slice(1, 3), 16); img.data[i + 1] = parseInt(hex.slice(3, 5), 16); img.data[i + 2] = parseInt(hex.slice(5, 7), 16); img.data[i + 3] = 255; };
const dark = (img, x, y) => { const i = img.at(x, y); return img.data[i] + img.data[i + 1] + img.data[i + 2] < 180; };

/** 상자 안의 투명 구멍 채우기 : 불투명 마스크를 r 만큼 닫고(팽창 → 침식), 새로 막힌 칸을 가장 가까운 «외곽선 아닌» 색으로 */
function fillHoles(img, box, r = 2) {
  const [x0, y0, x1, y1] = box, inBox = (x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
  const dil = new Set(), key = (x, y) => x + ',' + y;
  for (let y = y0 - r; y <= y1 + r; y++) for (let x = x0 - r; x <= x1 + r; x++) {
    let hit = false; for (let dy = -r; dy <= r && !hit; dy++) for (let dx = -r; dx <= r && !hit; dx++) if (img.on(x + dx, y + dy)) hit = true;
    if (hit) dil.add(key(x, y));
  }
  const fill = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if (img.on(x, y)) continue;
    let all = true; for (let dy = -r; dy <= r && all; dy++) for (let dx = -r; dx <= r && all; dx++) if (!dil.has(key(x + dx, y + dy))) all = false;
    if (all) fill.push([x, y]);
  }
  for (const [x, y] of fill) {
    let best = null;
    for (let d = 1; d < 8 && !best; d++) for (let dy = -d; dy <= d && !best; dy++) for (let dx = -d; dx <= d && !best; dx++) {
      const X = x + dx, Y = y + dy;
      if (inBox(X, Y) && img.on(X, Y) && !dark(img, X, Y)) best = [X, Y];
    }
    if (best) { const s = img.at(...best), t = img.at(x, y); for (let c = 0; c < 4; c++) img.data[t + c] = img.data[s + c]; img.data[t + 3] = 255; }
  }
  return fill.length;
}

/* 메아리 : 왼쪽 큰 귀 (x 0~16 · y 2~26) */
for (const n of ['head', 'head_blink']) {
  const img = await load('meari', n);
  console.log(`  meari/${n} 귀 구멍 ${fillHoles(img, [0, 2, 16, 26], 2)}칸 채움`);
  await save(img, 'meari', n.replace('head', 'head') + '_ear1');
}

/* 반짝이 : 가까운 눈 = 테두리 x18~25 · y20~28 안쪽 (x19~24 · y21~27), 먼 눈 = 주둥이 쪽 x35~36 · y22~25 */
{
  const img = await load('banjjak', 'head');
  const EYE = [
    '..KKKK',
    '.KBBBBK',
    'KBHHBBK',
    'KBHHBBK',
    'KBBBBBK',
    'KBBBhBK',
    '.KBBBK',
  ];
  const C = { K: '#3b2314', B: '#5a3a26', H: '#ffffff', h: '#fff4c8' };
  EYE.forEach((row, j) => [...row].forEach((ch, i) => { if (C[ch]) put(img, 18 + i, 21 + j, C[ch]); }));
  for (const [x, y, c] of [[35, 22, 'K'], [35, 23, 'B'], [36, 23, 'K'], [35, 24, 'B'], [36, 24, 'K'], [35, 25, 'K']]) put(img, x, y, C[c]);
  await save(img, 'banjjak', 'head_eye1');
}

/* 솜뭉치 : 팔 그림 왼쪽 위에 붙어 온 날개 조각 */
for (const [n, cut] of [['arm_f', (x, y) => (y <= 10 && x <= 14) || (y === 11 && x <= 13)], ['arm_b', (x, y) => (y <= 9 && x <= 13) || (y <= 11 && x <= 12)]]) {
  const img = await load('sommung', n);
  for (let y = 0; y < img.H; y++) for (let x = 0; x < img.W; x++) if (cut(x, y)) img.data[img.at(x, y) + 3] = 0;
  await save(img, 'sommung', n + '_fix1');
}
