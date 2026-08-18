/**
 * 승리 깃발 굽기 — `node tools/build-bubble.mjs`
 *
 * `etc/승리깃발.png` 는 1024×1536 렌더 이미지다. 결과 화면(DOM)에 쓰므로
 * **정수 비율로 줄이고**(1024÷6 = 170.67 → 168×252) CSS 는 `image-rendering: pixelated`.
 *
 * ※ "1등이닷" 말풍선은 2026-08-19 삭제됐다(사용자 요청 — 인게임 흰 말풍선 제거).
 *   이 파일 이름(build-bubble)은 예전 이름을 그대로 쓴다 — 스크립트 이름 하나 바꾸는
 *   것보다 package.json·문서 곳곳의 참조를 놓칠 위험이 더 크다.
 */

import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

mkdirSync('public/assets/ui', { recursive: true });

// ── 승리 깃발 ──
const FLAG_W = 168;
const FLAG_H = 252;
await sharp('etc/승리깃발.png')
  .resize(FLAG_W, FLAG_H, { kernel: 'lanczos3' })
  .png()
  .toFile('public/assets/ui/victory_flag.png');
console.log(`승리 깃발: public/assets/ui/victory_flag.png (${FLAG_W}×${FLAG_H})`);
