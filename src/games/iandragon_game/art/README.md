# art/ — 이안 드래곤 게임 그림 원본 (겜팀장 담당)

이 폴더 · `audio/` · `public/assets/iandragon_game/` · `tools/idg-art-*.mjs` · `tools/idg-audio-*.mjs` 는 **겜팀장만** 고친다.
약속은 `iandragon` 저장소 `docs/IAN_DRAGON_TEAM_PLAN.md` 2장.

- 그림 원본 : 부품 격자 + 팔레트 (촘촘한 도트, 기획서 12장)
- 굽기 : `npm run assets:idg-art` → `public/assets/iandragon_game/atlas.png` + `atlas.json`
- 검사 : `npm run qa:idg-art` → `src/games/iandragon_game/data/artManifest.js` 와 대조해 빠진 프레임만 출력
- 그 전까지 게임은 겜부장의 자리표시 시트(`tools/idg-placeholder.mjs`, `meta.placeholder: true`)를 쓴다.
  진짜 시트를 구우면 `meta.placeholder` 를 빼면 된다 — 자리표시 도구는 진짜 시트를 덮어쓰지 않는다.
