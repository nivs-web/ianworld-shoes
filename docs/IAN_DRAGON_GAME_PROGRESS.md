# 이안 드래곤 게임 — 진행 기록 (겜부장 · 코드)

> 기획 · 명령서 원본 : `C:/Users/ariancepc/Desktop/cowork/iandragon/docs/` — `IAN_DRAGON_DEV_ORDER.md`(블록 B0~B7) · `IAN_DRAGON_TEAM_PLAN.md`(분담 · 약속) · `IAN_DRAGON_GDD.md`
> 다음 세션은 이 파일부터 읽는다. 그림 · 소리 쪽 기록은 겜팀장의 `docs/IAN_DRAGON_GAME_ART_LOG.md` (가지 `feat/iandragon-game-art`).

## B0 — 뼈대 · 로비 · 가로 전환 (2026-11-10 완료)

**만든 것**
- `pixi.js@8.22.0` (이 게임만 예외 — 게임에 들어갈 때만 받는다)
- `src/screens/IanDragonGameLobby.js` 세로 로비 (상태창 · 하는 법 · 모험 시작 · 오락실로)
- `src/screens/IanDragonGame.js` 가로 게임 래퍼 — 오락실 루프 멈춤 · 뒤로가기=일시정지 · `html.idg-wide` 로 450 틀 해제 · 가로 잠금 / 나갈 때 전부 원래대로
- `src/games/iandragon_game/index.js` `mount · unmount · requestPause`
- `render/app.js` PixiJS 앱 — 화면 바탕 640×360칸(가로 최대 780) · PC 는 정수배, 고밀도 폰(dpr≥2)은 꽉 채움 · nearest · roundPixels
- `render/orient.js` 세로 지킴이 — 세로면 «가로로 돌려 주세요» + 일시정지 + 나가기
- `render/demo.js` **임시 장면** (자리표시 용 · 좀비가 걷기만 함) — **B2 에서 지운다**
- `src/services/iandragonGameState.js` 저장 묶음 `idg` 모양 · 병합 (기획서 14장), `profile.js` 병합에 연결
- `src/services/iandragonGame.js` `idg()` · `saveIdg()` · 표시용 도우미
- 겜팀장 빈 자리 : `src/games/iandragon_game/audio/index.js`(같은 모양 함수, 소리 없음) · `art/README.md` · `package.json` 의 `assets:idg-art` · `qa:idg-art`
- `tools/idg-placeholder.mjs` → `public/assets/iandragon_game/atlas.png/json` 자리표시 시트 (133프레임, `meta.placeholder: true`, 진짜 시트는 덮어쓰지 않음)
- 오락실 카드 id `iandragon` → `iandragon_game`, 계속 `ready: false`. **숨은 입구 : 주소에 `?game=iandragon_game`** 을 붙이고 카드의 SOON 을 누르면 로비로 들어간다
- 문구는 `strings.ko.js` 의 `idg*`, 화면 CSS 는 `src/styles/iandragon-game.css`

**합격 기준**
- ✔ 숨은 입구 → 세로 로비 → 모험 시작 → 가로 화면에 자리표시 용 · 좀비가 번짐 없이 보이고 움직인다
- ✔ 세로로 돌리면 안내 + 일시정지(ticker 멈춤 확인) · 안내의 나가기 → 로비, `idg-wide` 해제 · 450 틀 복귀 확인
- ✔ 배율 계산 : PC 1080p ×3 (640×360) · 노트북 1366 ×2 · 아이폰 가로 꽉 채움 (779×360) · 갤럭시 가로 · 아이패드
- ✔ `vite build` 통과 · 게임 코드는 지연 로딩 청크 (오락실 첫 화면 번들에 안 들어감)
- ☐ 저장 묶음이 서버에 쓰이고 다시 읽히는지 — 미리보기에 Firebase 설정이 없어 **실기기 로그인 상태에서 B1 때 확인**. Firestore 는 필드 화이트리스트가 없어 `idg` 를 받아 준다 (CLAUDE.md 9장)
- 통계 `countPlay` · 접속 표시는 규칙에 `idragon` 이 들어가기 전까지 부르지 않는다 (지켜짐)

**주의 (다음 사람에게)**
- 이 작업 폴더(`oraksil/fs-idg`)의 `node_modules` 는 **자기 것**이다 (pixi.js 포함). 원래 작업 폴더 `find_shoes` 의 것과 연결하지 않는다 — 그쪽은 다른 작업 중이다. 겜팀장 작업 폴더는 이 `fs-idg/node_modules` 에 연결한다.
- 개발 서버에서만 `window.__idgApp` 으로 Pixi 앱을 볼 수 있다 (점검용).

**다음 : B1** — `docs/sim/engine.js` 를 `core/` 로 옮기고 데이터 변환 · 골든 300판 검사 · `data/artManifest.js`.

## 합치기 (2026-11-10)

- 겜팀장 가지 `feat/iandragon-game-art` @ 0abf128 를 합침 (빨리 감기, 겜팀장 폴더 파일만 바뀜 · 충돌 0). 진짜 시트 133프레임 중 진짜 그림 30 (꼬물이 1·2 · 돌등이 1·2 · 어슬렁 좀비 44칸), 나머지 103은 자리표시.
- 휴대폰 가로 화면에서 진짜 그림과 자리표시가 함께 정상 표시 · 프레임 크기를 시트에서 읽는 것 확인 (walker 44×44).
