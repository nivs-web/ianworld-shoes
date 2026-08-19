/**
 * 시즌2 배경 굽기 — `npm run assets:season2`
 *
 *   입력: etc/게임배경시즌2/*.png   (도로 / 1층 / 2·3층 3패널 포스터, 시즌1과 같은 형식)
 *         tools/bg-season2.json     파일명 → id · 이름 명단
 *   출력: public/assets/bg/build_NN_{road|floor1|tile}.png
 *         src/data/backgrounds.season2.json
 *
 * ## 왜 시즌1 스크립트에 합치지 않았나
 *
 * `downscale-bg.mjs` 는 **폴더 정렬 순서로 id 를 붙인다.** 거기에 30장을 더 넣는 순간
 * build_01..16 이 통째로 밀려서, 이미 구워 커밋해 둔 그림·`build_10` 간판 스크립트·
 * 사용자가 설정에 저장해 둔 배경이 전부 어긋난다. 시즌2는 명단으로 id 를 못 박고
 * **시즌1 파일은 건드리지 않는다** — 그래서 이 스크립트는 언제 다시 돌려도 안전하다.
 *
 * 검출기와 굽는 방식은 `_bg-lib.mjs` 로 시즌1과 공유한다(복사하면 한쪽만 고치게 된다).
 */

import sharp from 'sharp';
import { mkdir, readdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BG } from '../src/config/layout.js';
import { convert, COLORS } from './_bg-lib.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = resolve(ROOT, 'etc/게임배경시즌2');
const OUT_DIR = resolve(ROOT, 'public/assets/bg');
const OUT_JSON = resolve(ROOT, 'src/data/backgrounds.season2.json');
const MANIFEST = resolve(ROOT, 'tools/bg-season2.json');

const PANELS = [
  { key: 'road', w: BG.roadW, h: BG.roadH },
  { key: 'floor1', w: BG.floor1W, h: BG.floor1H },
  { key: 'tile', w: BG.tileW, h: BG.tileH },
];

/**
 * ★ 시즌2 는 **자동 검출을 쓰지 않는다.** 30장을 붙여 놓고 보니 셋 다 실패했다:
 *
 *   · 시즌1의 국소 표준편차 검출 — 시즌2 배경은 모눈 무늬가 진해서 판 전체가 한 덩어리로 붙는다
 *     (30장 중 18장이 "패널 2개", 나머지 12장은 3개를 찾았지만 좌표가 포스터 전체였다 —
 *      **통과처럼 보이는 실패**가 제일 위험하다)
 *   · 배경색 차이로 마스킹 — 모눈 배경에 좌우·상하 그라데이션이 있어 여백 색이 가운데와 90 이상 벌어진다
 *   · 열 투영 + 조각 잇기 — 하늘·단색 벽에서 끊겨 패널이 2~5조각으로 갈라진다
 *
 * 대신 **판형이 고정이라는 사실**을 썼다. 30장을 한 장씩 재 보니 세 패널의 자리가
 * 2752×1536 기준으로 전부 같았다(절반 크기 원본 2장은 정확히 배율 0.5). 자동으로 재는 것보다
 * 판형 하나를 눈으로 확인하고 못 박는 편이 정확하고, 무엇보다 **틀리면 눈에 바로 보인다.**
 * 판형에서 벗어나는 2장은 명단에 좌표를 손으로 적었다(`_why` 에 이유가 있다).
 */
const TEMPLATE = [
  { left: 88, top: 840, width: 832, height: 480 },     // 도로
  { left: 1000, top: 568, width: 752, height: 752 },   // 1층
  { left: 1880, top: 472, width: 744, height: 848 },   // 2·3층
];
const TEMPLATE_W = 2752;

async function main() {
  const manifest = JSON.parse(await readFile(MANIFEST, 'utf8'));
  delete manifest._readme;
  const entries = Object.entries(manifest);

  /**
   * ★ 원본이 없어도 **죽지 않는다** — `etc/` 는 gitignore 라 Vercel 에는 없다.
   * 예전에 깃발 굽는 단계가 이걸 안 지켜서 배포가 몇 판째 조용히 실패했다(§9-0-32).
   * 구워 둔 결과물이 커밋돼 있으면 그걸 그대로 쓰고 넘어간다.
   */
  if (!existsSync(SRC)) {
    const 있는것 = entries.filter(([, v]) => existsSync(resolve(OUT_DIR, `${v.id}_tile.png`)));
    if (있는것.length === entries.length) {
      console.log(`시즌2 원본(${SRC.replace(ROOT + '/', '')}) 없음 — 커밋된 ${있는것.length}종을 그대로 사용`);
      return;
    }
    console.error(`시즌2 원본도 없고 구워 둔 그림도 모자란다 (${있는것.length}/${entries.length})`);
    process.exit(1);
  }

  await mkdir(OUT_DIR, { recursive: true });
  const 실재 = new Set((await readdir(SRC)).filter((f) => f.toLowerCase().endsWith('.png')));

  // 명단에 없는 원본이 있으면 알린다 — 조용히 빠지는 것이 제일 나쁘다
  for (const f of 실재) if (!manifest[f]) console.warn(`  ! 명단에 없는 원본: ${f}`);

  const meta = { buildings: [], colors: COLORS, template: TEMPLATE, templateW: TEMPLATE_W };
  let failed = 0;

  for (const [file, info] of entries) {
    if (!실재.has(file)) {
      console.warn(`  ! ${info.id} (${info.name}): 원본 ${file} 없음 → 건너뜀`);
      failed++;
      continue;
    }
    const src = resolve(SRC, file);
    // 절반 크기 원본이 섞여 있다 — 좌표는 2752 기준이므로 실제 폭에 맞춰 배율을 건다
    const { width } = await sharp(src).metadata();
    const k = width / TEMPLATE_W;
    const boxes = (info.panels ?? TEMPLATE).map((b) => ({
      left: Math.round(b.left * k), top: Math.round(b.top * k),
      width: Math.round(b.width * k), height: Math.round(b.height * k),
    }));
    if (boxes.length !== 3) {
      console.warn(`  ! ${info.id} (${info.name}): 패널 좌표가 ${boxes.length}개 → 건너뜀`);
      failed++;
      continue;
    }

    const panels = {};
    for (let i = 0; i < 3; i++) {
      const p = PANELS[i];
      await convert(src, boxes[i], p.w, p.h, resolve(OUT_DIR, `${info.id}_${p.key}.png`));
      panels[p.key] = { crop: boxes[i], out: `${info.id}_${p.key}.png`, w: p.w, h: p.h };
    }
    meta.buildings.push({ id: info.id, name: info.name, source: file, panels });
    console.log(`  ${info.id}  ${info.name.padEnd(12)} ${basename(file).slice(0, 34)}`);
  }

  await writeFile(OUT_JSON, JSON.stringify(meta, null, 2) + '\n', 'utf8');
  console.log(`\n시즌2 배경 ${meta.buildings.length}종 → ${OUT_DIR.replace(ROOT + '/', '')}`);
  if (failed) {
    console.error(`실패 ${failed}건 — tools/bg-season2.json 에 panels 좌표를 손으로 넣어야 한다`);
    process.exit(1);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
