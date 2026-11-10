# 이안 드래곤 게임 — 그림 · 소리 진행 기록 (겜팀장)

## A1 — 팔레트 · 부품 키트 · 샘플 3종 (2026-11-10)
- `art/palette.js` : 외곽선 #14082a + 3단 램프(용 12 · 좀비 5 · 속성 덮어쓰기 5) + 단색.
- `art/kit.js` : 부품(타원 · 다각형) → 칸 채우기 → 빛(왼쪽 위) 3단 + 경계 바둑판 디더 → 부품마다 1칸 외곽선. 회전 없음.
- `art/units.js` : 꼬물이(1·2모습 32·36칸) · 돌등이(1·2모습 40·44칸) · 어슬렁 좀비(36칸) × 6동작(idle0 · walk0 · walk1 · atk0 · atk1 · kb0).
- `tools/idg-art-preview.mjs` : 확인 시트(실제 크기 6동작 · 2배 · 4배 · 실루엣) → `tools/_out/idg-art-preview.png`.
- 다음 : 대표님 승인 → 굽기(`tools/idg-art-build.mjs` · atlas) + A2 월드 1.
