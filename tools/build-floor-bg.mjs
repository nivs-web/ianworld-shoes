/**
 * 층수별 교체 배경 변환기 — `node tools/build-floor-bg.mjs`
 *
 *   입력: etc/floor200.png … etc/floor1000.png  (사용자가 직접 만든 **180×320 완성본**)
 *   출력: public/assets/bg/floor200.png … floor1000.png
 *
 * ## 왜 downscale-bg.mjs 와 따로 두나
 *
 * `downscale-bg.mjs` 는 **설명 포스터**가 입력이다 — 그림 패널을 찾아 잘라내고,
 * lanczos 로 줄이고, 양자화한다(§5). 그런데 이 파일들은 사용자가 이미 논리 해상도
 * 180×320 으로 맞춰 준 완성본이라 **자를 것도 줄일 것도 없다.** 같은 스크립트에
 * 억지로 끼우면 패널 검출이 멀쩡한 그림을 잘라먹는다.
 *
 * ## 이미 도트인 그림은 건드리지 않는다 (이게 핵심)
 *
 * 9장의 성격이 갈린다 — 실측(2026-08-19):
 *   floor200 · 700 · 800 · 1000 → **16색**. 이미 도트로 찍은 완성품이다.
 *   floor300 · 400 · 500 · 600 · 900 → 4,465 ~ 17,213색. 매끈하게 렌더된 일러스트다.
 *
 * 이미 16색인 그림을 양자화 파이프라인에 다시 태우면 **디더링이 없던 노이즈를 새로
 * 만든다.** 그래서 `COLORS` 이하인 그림은 픽셀을 그대로 복사하고, 색이 넘치는 것만
 * 양자화한다. 색 수는 세어 보고 판단하므로 나중에 어떤 그림으로 바뀌어도 알아서 갈린다.
 *
 * (실측 확인: 사용자가 준 floor200.png 는 현재 게임에 들어 있는 것과 **픽셀 단위로
 *  동일**했다. 즉 200은 이미 이 파이프라인을 통과한 결과물이고, 300~500 은 사용자가
 *  **새 그림으로 교체**한 것이었다 — 그래서 무조건 덮어쓴다.)
 */

import sharp from 'sharp';
import { mkdir, copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BG } from '../src/config/layout.js';
import { FLOOR_EVENTS } from '../src/config/balance.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = resolve(ROOT, 'etc');
const OUT_DIR = resolve(ROOT, 'public/assets/bg');

/** 양자화 색 수 — downscale-bg.mjs 와 같은 기준(§5) */
const COLORS = 32;

/**
 * 만들 층 목록은 **밸런스 테이블에서 읽는다.** 여기에 숫자를 또 적으면 둘이 어긋나서
 * "이미지는 있는데 게임이 안 쓰는" 조용한 실패가 난다(§3-5).
 */
const KEYS = FLOOR_EVENTS.bgSwap.map((e) => e.key);

/** 이 그림이 이미 도트인가 (고유색이 COLORS 이하) */
async function countColors(file) {
  const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true });
  const seen = new Set();
  const ch = info.channels;
  for (let i = 0; i < data.length; i += ch) {
    seen.add((data[i] << 16) | (data[i + 1] << 8) | data[i + 2]);
    if (seen.size > COLORS) return Infinity;   // 더 셀 필요 없다
  }
  return seen.size;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  let copied = 0, quantized = 0, missing = 0;
  for (const key of KEYS) {
    const src = resolve(SRC, `${key}.png`);
    const out = resolve(OUT_DIR, `${key}.png`);

    /**
     * ★ 원본이 없고 **산출물이 이미 있으면 건너뛴다.** `etc/` 는 저장소에 없으므로
     * (§5) 배포 환경에서는 항상 이 경로를 탄다 — 여기서 죽으면 빌드가 통째로 실패한다
     * (`build-bubble.mjs` 주석에 그 사고 기록이 있다). 둘 다 없을 때만 진짜 실패다.
     */
    if (!existsSync(src)) {
      if (existsSync(out)) {
        console.log(`  ${key}  원본 없음 — 커밋된 산출물 그대로 사용`);
        copied++;
      } else {
        console.warn(`  ! ${key}  원본도 산출물도 없음 (etc/${key}.png)`);
        missing++;
      }
      continue;
    }
    const meta = await sharp(src).metadata();

    // 규격이 틀리면 조용히 늘리지 않고 소리를 지른다. 논리 해상도가 어긋난 배경은
    // 정수배 확대에서 반드시 뭉갠다(§3-1).
    const sized = meta.width === BG.fullW && meta.height === BG.fullH;

    const colors = await countColors(src);
    if (colors <= COLORS && sized) {
      await copyFile(src, out);                       // 이미 도트다 — 손대지 않는다
      console.log(`  ${key}  ${meta.width}×${meta.height}  ${colors}색  (그대로 복사)`);
      copied++;
    } else {
      const buf = await sharp(src)
        .resize(BG.fullW, BG.fullH, { kernel: 'lanczos3', fit: 'fill' })
        .png({ palette: true, colors: COLORS, dither: 0.4, compressionLevel: 9 })
        .toBuffer();
      await sharp(buf).toFile(out);
      console.log(
        `  ${key}  ${meta.width}×${meta.height}  ${colors === Infinity ? `>${COLORS}` : colors}색` +
        `  → ${COLORS}색 양자화${sized ? '' : `  (규격 보정 ${BG.fullW}×${BG.fullH})`}`
      );
      quantized++;
    }
  }

  console.log(`\n층수 배경 ${copied + quantized}종 (그대로 ${copied} · 양자화 ${quantized})`);
  console.log(`  → ${OUT_DIR}`);
  if (missing) {
    console.error(`\n원본 없음 ${missing}건 — etc/ 에 파일을 넣고 다시 실행하세요.`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
