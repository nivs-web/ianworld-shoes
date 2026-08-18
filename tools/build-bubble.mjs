/**
 * 승리 깃발 굽기 — `node tools/build-bubble.mjs`
 *
 * `etc/승리깃발.png` 는 1024×1536 렌더 이미지다. 결과 화면(DOM)에 쓰므로
 * **정수 비율로 줄이고**(1024÷6 = 170.67 → 168×252) CSS 는 `image-rendering: pixelated`.
 *
 * ※ "1등이닷" 말풍선은 2026-08-19 삭제됐다(사용자 요청 — 인게임 흰 말풍선 제거).
 *   이 파일 이름(build-bubble)은 예전 이름을 그대로 쓴다 — 스크립트 이름 하나 바꾸는
 *   것보다 package.json·문서 곳곳의 참조를 놓칠 위험이 더 크다.
 *
 * ## ★ 원본이 없으면 **건너뛴다** — 이게 배포를 살린다 (2026-08-19)
 *
 * 이 스크립트는 `npm run build` 체인에 들어 있는데, 읽는 원본은 `etc/` 에 있다.
 * 그런데 **`etc/` 는 `.gitignore` 대상이라 저장소에 없다**(수백 MB 원본, §5).
 * 즉 Vercel 에는 이 파일이 존재하지 않는다 → `sharp` 가 예외를 던지고
 * **빌드가 통째로 실패한다.** 실측(2026-08-19): `etc/` 를 치우고 `npm run build` 를
 * 돌리면 종료코드 **1**.
 *
 * 증상이 고약했다 — 커밋도 푸시도 정상인데 **배포만 조용히 안 되어서**, 고친 것이
 * 하나도 반영되지 않은 것처럼 보였다("재배포 버튼 누르면 에러" 신고의 정체).
 *
 * 산출물(`public/assets/`)은 **커밋한다**는 게 이 저장소의 규칙이므로(§5), 원본이
 * 없더라도 구울 것이 이미 거기 있다. 그래서 **원본이 없고 산출물이 있으면 조용히
 * 넘어간다.** 둘 다 없을 때만 실패한다 — 그건 진짜로 고쳐야 하는 상태다.
 */

import sharp from 'sharp';
import { mkdirSync, existsSync } from 'node:fs';

const SRC = 'etc/승리깃발.png';
const OUT = 'public/assets/ui/victory_flag.png';
const FLAG_W = 168;
const FLAG_H = 252;

mkdirSync('public/assets/ui', { recursive: true });

if (!existsSync(SRC)) {
  if (existsSync(OUT)) {
    // 배포 환경(Vercel)의 정상 경로다. 커밋된 산출물을 그대로 쓴다.
    console.log(`승리 깃발: 원본(${SRC}) 없음 — 커밋된 ${OUT} 을 그대로 사용`);
  } else {
    console.error(`승리 깃발: 원본(${SRC})도 산출물(${OUT})도 없습니다.`);
    process.exit(1);
  }
} else {
  await sharp(SRC)
    .resize(FLAG_W, FLAG_H, { kernel: 'lanczos3' })
    .png()
    .toFile(OUT);
  console.log(`승리 깃발: ${OUT} (${FLAG_W}×${FLAG_H})`);
}
