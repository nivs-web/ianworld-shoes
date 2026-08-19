/**
 * 배경 변환기
 *
 *   입력: etc/백그라운드건물/*.png     각 장에 도로 / 1층 / 2·3층 3패널이 나란히 그려진 설명 포스터
 *         etc/200층이상배경/*.png       층수별 교체 배경 (역시 포스터 형식, 패널 1개)
 *   출력: public/assets/bg/build_NN_{road|floor1|tile}.png
 *         public/assets/bg/floor200|300|400|500.png
 *         src/data/backgrounds.generated.json
 *
 * 패널을 찾아 규격 크기로 굽는 방법은 `_bg-lib.mjs` 에 있다 — 시즌2와 **같은 부품**을 쓴다.
 * (예전엔 이 파일 안에 있었는데, 시즌2가 복사해 가면 한쪽만 고쳐서 두 시즌의 결과가
 *  달라질 수 있다. 그래서 떼어 냈다. 2026-08-19)
 */

import { mkdir, readdir, writeFile, readFile } from 'node:fs/promises';
import { dirname, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BG } from '../src/config/layout.js';
import { findPanels, convert, COLORS, B } from './_bg-lib.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC_BUILD = resolve(ROOT, 'etc/백그라운드건물');
const SRC_FLOOR = resolve(ROOT, 'etc/200층이상배경');
const OUT_DIR = resolve(ROOT, 'public/assets/bg');
const OUT_JSON = resolve(ROOT, 'src/data/backgrounds.generated.json');
/** 자동 검출이 실패한 포스터의 패널 좌표를 손으로 지정하는 파일 */
const OVERRIDE = resolve(ROOT, 'tools/bg-panels.json');

const PANELS = [
  { key: 'road', w: BG.roadW, h: BG.roadH },
  { key: 'floor1', w: BG.floor1W, h: BG.floor1H },
  { key: 'tile', w: BG.tileW, h: BG.tileH },
];

// ─────────────────────────────────────────────

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  await mkdir(dirname(OUT_JSON), { recursive: true });

  const meta = { buildings: [], floors: [], colors: COLORS, blockSize: B };
  let failed = 0;

  /** @type {Record<string, Array<{left:number,top:number,width:number,height:number}>>} */
  let override = {};
  try {
    override = JSON.parse(await readFile(OVERRIDE, 'utf8'));
    delete override._readme;
    const n = Object.keys(override).length;
    if (n) console.log(`수동 패널 좌표 ${n}건 적용 (tools/bg-panels.json)\n`);
  } catch {
    /* 없으면 전부 자동 검출 */
  }

  // ── 건물 포스터 (패널 3개씩) ──
  const files = (await readdir(SRC_BUILD)).filter((f) => f.toLowerCase().endsWith('.png')).sort();
  console.log(`건물 포스터 ${files.length}장`);

  let n = 0;
  for (const f of files) {
    n++;
    const id = `build_${String(n).padStart(2, '0')}`;
    const src = resolve(SRC_BUILD, f);
    const boxes = override[f] ?? (await findPanels(src, 3));

    if (boxes.length !== 3) {
      console.warn(`  ! ${id} (${basename(f).slice(0, 30)}): 패널 ${boxes.length}개 감지 → 건너뜀`);
      failed++;
      continue;
    }

    const panels = {};
    for (let i = 0; i < 3; i++) {
      const p = PANELS[i];
      await convert(src, boxes[i], p.w, p.h, resolve(OUT_DIR, `${id}_${p.key}.png`));
      panels[p.key] = { crop: boxes[i], out: `${id}_${p.key}.png`, w: p.w, h: p.h };
    }
    meta.buildings.push({ id, source: f, panels });
    console.log(`  ${id}  ${basename(f).slice(0, 32)}`);
  }

  // ── 층수별 교체 배경 (패널 1개씩) ──
  const floorMap = {
    '200층이상.png': 'floor200',
    '300층이상.png': 'floor300',
    '400층이상.png': 'floor400',
    '500층이상.png': 'floor500',
  };
  for (const [srcName, id] of Object.entries(floorMap)) {
    const src = resolve(SRC_FLOOR, srcName);
    try {
      const boxes = override[srcName] ?? (await findPanels(src, 1));
      const crop = boxes[0] ?? null;
      // 층수 배경은 반복 타일이 아니라 화면 전체(180×320)
      await convert(src, crop, BG.fullW, BG.fullH, resolve(OUT_DIR, `${id}.png`));
      meta.floors.push({ id, source: srcName, crop, w: BG.fullW, h: BG.fullH });
      console.log(`  ${id}  ${srcName}${crop ? '' : '  (패널 미검출 → 전체 사용)'}`);
    } catch (e) {
      console.warn(`  ! ${id}: ${e.message}`);
      failed++;
    }
  }

  await writeFile(OUT_JSON, JSON.stringify(meta, null, 2) + '\n', 'utf8');
  console.log(`\n건물 ${meta.buildings.length}종 · 층수배경 ${meta.floors.length}종`);
  console.log(`  → ${OUT_DIR}`);
  if (failed) console.log(`실패 ${failed}건 — 해당 포스터는 패널 좌표 수동 지정 필요`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
