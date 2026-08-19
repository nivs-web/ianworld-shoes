/**
 * `build_10` 간판 다시 쓰기 — `node tools/build-museum-sign.mjs`
 *
 *   입력·출력: public/assets/bg/build_10_floor1.png  (제자리에서 고친다)
 *
 * ## 무엇을 하나
 *
 * 이 맵은 원래 「조선총독부」였고 1층 입구 위 석판에 한자 두 줄
 * (`朝鮮總督府` / `- 慶城府廳 -`)이 새겨져 있었다. 맵 이름을 **「고대박물관」**으로
 * 바꾸면서 그 간판도 같이 바꾼다 — 이름만 갈면 화면과 메뉴가 서로 다른 말을 한다.
 *
 *   ① 석판 **안쪽만** 골라 한자를 지운다. 단색으로 덮지 않고 **같은 줄의 성한 픽셀**을
 *      좌우에서 찾아 채운다 — 석판에는 위아래로 미묘한 명암과 잡티가 있어서,
 *      평균색 한 가지로 칠하면 그 자리만 반반해져 붙인 티가 난다.
 *   ② 그 자리에 **갈무리11 볼드**로 `고대박물관` 을 찍는다. 게임이 인게임 글자를 굽는
 *      바로 그 폰트라(§3-1) 화면 안에서 이질감이 없다. 안티앨리어싱은 끈다 —
 *      켜면 도트 사이에 중간색이 생겨 확대했을 때 뭉갠다.
 *
 * ## 왜 별도 스크립트인가 (그리고 왜 제자리에서 고치나)
 *
 * 원본(`etc/백그라운드건물/*.png`)은 한자가 그려진 그림 그대로다. 원본을 고칠 수는
 * 없고(§5 — `etc/` 는 읽기 전용), `downscale-bg.mjs` 를 다시 돌리면 한자가 되살아난다.
 * 그래서 **축소 파이프라인 뒤에 붙는 한 단계**로 뒀고, `package.json` 의 `assets:bg` 가
 * 이 스크립트를 이어서 부른다.
 *
 * **여러 번 돌려도 결과가 같다**(멱등) — 지우는 범위가 좌표로 고정이라 이미 새 글자가
 * 찍힌 그림에 다시 돌려도 그 글자를 지우고 같은 자리에 다시 찍는다.
 */

import sharp from 'sharp';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FILE = resolve(ROOT, 'public/assets/bg/build_10_floor1.png');
const FONT = resolve(ROOT, 'node_modules/galmuri/dist/Galmuri11-Bold.ttf');
const LABEL = '고대박물관';

/**
 * 석판 **안쪽** 사각형 (테두리 장식은 건드리지 않는다).
 * 실측으로 잡았다: 바깥 테두리가 x35·x142, 위 테두리 y37~38, 아래 테두리 y66.
 */
const BOX = { x0: 40, y0: 41, x1: 137, y1: 64 };
/**
 * 다시 칠할 때 원본으로 삼는 **깨끗한 여백 띠**. 실측으로 골랐다 —
 * x47~61 은 글자 픽셀이 칸당 0~2개(잡티 수준)뿐인 왼쪽 여백이다.
 */
const BAND = { x0: 47, x1: 61 };
/** 이보다 어두우면 글자로 본다 (석판 바탕은 120~160, 한자는 60~100) */
const TEXT_LUM = 108;

const lum = (r, g, b) => (r + g + b) / 3;

/**
 * 석판 안쪽을 **깨끗한 여백 띠로 새로 깐다.**
 *
 * 처음에는 글자 픽셀만 골라 이웃에서 메워 봤다. 가로로 메우니 **가로 줄무늬**가,
 * 세로로 메우니 **세로 줄무늬**가 생겼다(둘 다 확대해서 눈으로 확인했다). 한자가
 * 가로로도 세로로도 두꺼워서, 어느 방향으로 가도 성한 픽셀이 멀어 한 점을 길게
 * 늘여 칠하게 되기 때문이다.
 *
 * 그래서 메우지 않고 **갈아엎는다.** 글자가 가운데 몰려 있어 양옆에는 손대지 않은
 * 돌 여백이 남아 있다(실측: x47~61 이 거의 글자 0). 그 띠를 **가로로 반복**해
 * 안쪽을 통째로 다시 칠한다.
 *
 *   · 가로로만 반복하므로 **행마다의 명암은 원래 그대로**다 (석판 위아래 그라데이션 보존)
 *   · 한 칸씩 복사하니 원본의 잡티가 그대로 따라와 "칠한 티"가 안 난다
 *   · 띠를 한 번 걸러 **좌우 반전**해 이어 붙인다 — 안 그러면 같은 무늬가 15칸마다
 *     반복되는 게 눈에 띈다
 */
function repaveInterior(px, w, box, band) {
  const at = (x, y) => (y * w + x) * 3;
  const bw = band.x1 - band.x0 + 1;
  /**
   * **편차를 아예 안 살린다.** (DEV = 0)
   *
   * 이 그림은 32색 양자화를 거쳐서(§5) 석판 안쪽이 사실상 **한 가지 색**이다 —
   * 실측하면 줄마다 중앙값이 132로 같고, 나머지는 ±8·±11 짜리 양자화 디더뿐이다.
   * 그 디더를 띠째로 반복해 붙이면 **없던 규칙이 생겨 점선처럼 보인다**(확대해서 확인).
   * 원본이 평평하므로 줄 중앙값으로 평평하게 까는 쪽이 오히려 원본에 가깝다.
   */
  const DEV = 0;
  const med = (arr) => { const a = [...arr].sort((p, q) => p - q); return a[a.length >> 1]; };

  for (let y = box.y0; y <= box.y1; y++) {
    // 이 줄에서 띠가 가진 색의 중앙값 — 줄마다 따로 잡아야 위아래 그라데이션이 산다
    const mid = [0, 1, 2].map((c) => med(
      Array.from({ length: bw }, (_, k) => px[at(band.x0 + k, y) + c])
    ));
    for (let x = box.x0; x <= box.x1; x++) {
      const i = x - box.x0;
      const tile = Math.floor(i / bw);
      const k = i % bw;
      // 홀수 번째 띠는 뒤집어 붙인다 (같은 무늬가 규칙적으로 반복되는 것을 흐린다)
      const sx = band.x0 + (tile % 2 === 0 ? k : bw - 1 - k);
      const s = at(sx, y), o = at(x, y);
      for (let c = 0; c < 3; c++) {
        // 중앙값 + **작게 자른 편차** = 잡티는 남고 장식은 사라진다
        const dev = Math.max(-DEV, Math.min(DEV, px[s + c] - mid[c]));
        px[o + c] = Math.max(0, Math.min(255, mid[c] + dev));
      }
    }
  }
}

async function main() {
  if (!existsSync(FILE)) {
    console.error(`간판: ${FILE} 이 없습니다. 먼저 npm run assets:bg 를 돌리세요.`);
    process.exit(1);
  }
  if (!existsSync(FONT)) {
    console.error(`간판: 폰트(${FONT})가 없습니다. npm i 를 먼저 돌리세요.`);
    process.exit(1);
  }

  const src = sharp(FILE);
  const { width: w, height: h } = await src.metadata();
  const px = await src.raw().toBuffer();          // RGB (알파 없음)

  // ── 1) 한자 지우기 ──────────────────────────
  // 원래 글자색을 먼저 재 둔다 — 새 글자도 같은 색으로 찍어야 새긴 느낌이 산다
  let sum = [0, 0, 0], n = 0;
  const isText = (x, y) => {
    const o = (y * w + x) * 3;
    return lum(px[o], px[o + 1], px[o + 2]) < TEXT_LUM;
  };
  for (let y = BOX.y0; y <= BOX.y1; y++) {
    for (let x = BOX.x0; x <= BOX.x1; x++) {
      if (!isText(x, y)) continue;
      const o = (y * w + x) * 3;
      sum[0] += px[o]; sum[1] += px[o + 1]; sum[2] += px[o + 2]; n++;
    }
  }
  const ink = n ? sum.map((v) => Math.round(v / n)) : [70, 62, 54];

  repaveInterior(px, w, BOX, BAND);

  // ── 2) 새 글자 찍기 ─────────────────────────
  // 안티앨리어싱 없이 굽는다: sharp 의 text 는 SVG 엔진이라 threshold 로 각을 세운다
  const boxW = BOX.x1 - BOX.x0 + 1;
  const boxH = BOX.y1 - BOX.y0 + 1;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${boxW}" height="${boxH}">
    <style>@font-face{font-family:'G';src:url('file://${FONT}');}
      text{font-family:'G';font-size:11px;font-weight:bold;letter-spacing:1px;}</style>
    <text x="${boxW / 2}" y="${Math.round(boxH / 2) + 4}" text-anchor="middle"
      fill="#000">${LABEL}</text>
  </svg>`;
  const glyph = await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer();

  let painted = 0;
  for (let y = 0; y < boxH; y++) {
    for (let x = 0; x < boxW; x++) {
      const a = glyph[(y * boxW + x) * 4 + 3];
      if (a < 128) continue;                       // 반투명 가장자리는 버린다 = 각진 도트
      const o = ((BOX.y0 + y) * w + (BOX.x0 + x)) * 3;
      px[o] = ink[0]; px[o + 1] = ink[1]; px[o + 2] = ink[2];
      painted++;
    }
  }
  if (!painted) {
    console.error('간판: 글자가 한 픽셀도 안 찍혔습니다 (폰트 로드 실패?)');
    process.exit(1);
  }

  await sharp(px, { raw: { width: w, height: h, channels: 3 } }).png().toFile(FILE);
  console.log(`간판: build_10_floor1.png — 한자 ${n}px 지우고 "${LABEL}" ${painted}px 새김 (잉크 rgb(${ink}))`);
}

main().catch((e) => { console.error(e); process.exit(1); });
