/**
 * 로고 변환 — 원본 일러스트 → 화면용 PNG
 *
 *   입력 : etc/신발을 찾아서 로고.png        (3168×1344, 10MB)
 *          etc/오락실 이안월드 로고.png      (1264×911, 1.5MB)
 *   출력 : public/assets/ui/logo_game.png
 *          public/assets/ui/logo_portal.png
 *
 * 왜 원본을 그대로 안 쓰나:
 *   10MB PNG 한 장이 게임 전체 번들(98KB gz)의 100배다. 모바일에서 로비 한 번
 *   여는 데 그만큼 내려받게 할 수는 없다.
 *
 * 축소 방식:
 *   도트 "느낌"의 일러스트지 진짜 픽셀아트가 아니다 — 글로우·그라데이션이 섞여 있어
 *   원본에 정수 배율 격자가 없다. 그래서 캐릭터·신발 시트와 달리 블록 중심 샘플링이
 *   아니라 **lanczos 축소 + 팔레트 양자화**를 쓴다. (CLAUDE.md §5 "렌더 일러스트" 규칙)
 *
 *   표시 크기의 2배로 굽고 CSS에서 100% 폭으로 눕힌다. 레티나에서 뭉개지지 않으면서
 *   파일도 작다.
 */

import sharp from 'sharp';
import { statSync, mkdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'etc');
const OUT = join(ROOT, 'public/assets/ui');

/** 표시 폭의 2배. 로비·포털 모두 최대 360 CSS px 로 눕힌다. */
const W = 720;

const JOBS = [
  { src: '신발을 찾아서 로고.png', out: 'logo_game.png', colors: 128 },
  { src: '오락실 이안월드 로고.png', out: 'logo_portal.png', colors: 128 },
];

mkdirSync(OUT, { recursive: true });

for (const job of JOBS) {
  const from = join(SRC, job.src);
  try {
    statSync(from);
  } catch {
    console.error(`  [!] 원본 없음: etc/${job.src}`);
    console.error(`      etc/ 는 커밋되지 않는다 — 원본을 넣고 다시 실행할 것`);
    continue;
  }

  const meta = await sharp(from).metadata();
  const info = await sharp(from)
    .resize({ width: W, kernel: 'lanczos3', withoutEnlargement: true })
    .png({ palette: true, colours: job.colors, dither: 0, effort: 10 })
    .toFile(join(OUT, job.out));

  const kb = (n) => `${Math.round(n / 1024)}KB`;
  console.log(
    `${job.src} ${meta.width}×${meta.height} ${kb(statSync(from).size)}` +
    ` → ${job.out} ${info.width}×${info.height} ${kb(info.size)}`
  );
}

console.log(`  → ${OUT}`);
