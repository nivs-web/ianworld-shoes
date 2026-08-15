# CLAUDE.md — 오락실 이안월드 / 신발을 찾아서

이 파일은 Claude Code가 이 저장소에서 작업할 때 **매번 먼저 읽는 지침**입니다.
기획의 진실은 `docs/GAME_DESIGN.md` 에 있습니다. 충돌 시 기획서가 우선합니다.

---

## 1. 프로젝트 한 줄 요약

맨발의 주인공이 **신발 상자 계단**을 좌우로 오르며 신발을 갈아 신고, **130종 도감**과 **명예의 전당**을 채우는 세로형 **레트로 도트** 웹게임(PWA).
포털 이름은 `오락실 이안월드`, 첫 게임은 `신발을 찾아서`.

---

## 2. 기술 스택 (확정)

| 영역 | 선택 | 이유 |
|------|------|------|
| 빌드 | **Vite** | 빠른 HMR, 정적 배포, 설정 최소 |
| 언어 | **JavaScript (ESM)** + JSDoc 타입 | 빌드 마찰 최소화. TS 미도입 |
| 렌더링 | **Canvas 2D** (라이브러리 없음) | 180×320 저해상도 픽셀 렌더에 최적 |
| 사운드 | **Web Audio API 직접 합성** | 오디오 파일 0개. 8bit 칩튠을 코드로 생성 |
| 인증 | **Firebase Auth (Google)** | |
| DB | **Firestore** (계정/도감/랭킹) + **Realtime Database** (멀티 룸) | 랭킹은 쿼리, 멀티는 저지연 |
| 배포 | **Vercel** ← GitHub `nivs-web/find_shoes` | main push = 자동 배포 |
| PWA | manifest + service worker (수동 작성) | |

> **금지**: React / Phaser / PixiJS / Tailwind / 애니메이션 라이브러리(GSAP 등).
> 이 게임은 순수 Canvas + 바닐라 JS로 만든다. 번들 크기와 픽셀 제어권이 우선이다.

---

## 3. 절대 규칙 (Non-Negotiable)

이 5가지는 **어떤 이유로도 어기지 않는다.** 위반 코드는 리뷰에서 되돌린다.

### 3-1. 픽셀 퍼펙트

```js
// 부트스트랩에서 단 한 번
const ctx = canvas.getContext('2d', { alpha: false });
ctx.imageSmoothingEnabled = false;      // 절대 금지: true
ctx.imageSmoothingQuality = 'low';
```
```css
canvas { image-rendering: pixelated; image-rendering: crisp-edges; }
```
- 논리 캔버스는 **정확히 180 × 320**. 절대 바꾸지 않는다.
- 확정 상수 (레퍼런스 「무한의 계단」 스크린샷 실측 기준, 2026-08-14):
  계단 블록 **36×19**(사용자 제작 돌블록 아트), 수직 간격 **25**, 수평 간격 **32**, 발끝 y **212**,
  캐릭터 원본 35×50 → **1.5배**로 렌더(53×75), 조작 버튼 **48×48** @ y266.
  · 실측 환산: 원본 839×1489 이미지 = 논리 180×320 (1논리px = 4.65px)
  · 배율 1.5는 비정수지만 목적지 크기를 반올림 + 스무딩 off 라 nearest 확대가 된다.
    캔버스→화면 확대는 여전히 정수배이므로 §3-1 규칙은 지켜진다.
- 신발은 **마스터 50×30 체계** (2026-08-13 개정): 마스터 50×30(도감) → 계단용 25×15(정수 ½) → 착용용 15×9(근사).
  도감에서 신발을 탭하면 마스터를 3×~4×로 키운 상세 팝업이 뜬다. 기획서 §9-3 참조.
- 화면 표시는 **정수배 스케일만** (`scale = Math.floor(min(vw/180, vh/320))`, 최소 1).
- 오프스크린 버퍼가 있어도 **모든** 컨텍스트에 `imageSmoothingEnabled = false` 를 건다.

### 3-2. 좌표는 정수만

```js
// ✅ 이렇게
entity.x += STEP_X;                 // STEP_X는 정수 상수
ctx.drawImage(img, entity.x, entity.y);

// ❌ 절대 금지
entity.x += speed * dt;             // 소수 누적
ctx.drawImage(img, x + 0.5, y);     // 소수 좌표
```
- 소수가 필요한 계산은 **별도 accumulator**에 두고, 렌더에는 `| 0` 로 내림한 정수만 넘긴다.
- `lerp`, `easeOut`, `smoothstep` 류 **보간 함수 사용 금지**.

### 3-3. 스프라이트 시트 애니메이션 (보간 금지)

- 캐릭터는 정해진 컷 사이를 **뚝뚝 교체**한다. 중간 상태 생성 금지.
- 애니메이션 프레임 레이트: **8~12 FPS** (게임 루프 60FPS와 분리).
- 상승 시퀀스는 반드시:
  `방향컷 → [이펙트(번개) 컷 2~3프레임] → 새 계단의 방향컷`

### 3-4. 고정 타임스텝 루프

```js
const FIXED_DT = 1000 / 60;
let acc = 0;
function loop(now) {
  acc += Math.min(now - last, 100);   // 스파이크 클램프
  while (acc >= FIXED_DT) { update(FIXED_DT); acc -= FIXED_DT; }
  render();
  requestAnimationFrame(loop);
}
```
- `render()`에서 **보간(interpolation) 하지 않는다.** 마지막 상태를 그대로 그린다.

### 3-5. 밸런스 수치는 코드에 박지 않는다

모든 숫자(게이지 감소율, 회복량, 신발 확률, 계단 간격…)는 `src/config/balance.js` 한 파일에만 존재한다.
게임 로직 파일에 리터럴 숫자를 쓰면 안 된다.

---

## 4. 디렉터리 구조

```
find_shoes/
├─ CLAUDE.md                     ← 이 파일
├─ index.html                    ← 단일 진입점 (SPA)
├─ vite.config.js
├─ package.json
├─ vercel.json
├─ .env.example                  ← Firebase 키 템플릿 (실제 .env는 커밋 금지)
│
├─ docs/
│  ├─ GAME_DESIGN.md             ← 기획 진실
│  ├─ PROJECT_INSTRUCTIONS.md    ← Claude 프로젝트 지침 붙여넣기용
│  ├─ ASSET_PIPELINE.md          ← 원본 → 게임 에셋 변환 절차
│  └─ DECISIONS.md               ← 결정 로그 (왜 그렇게 했는지)
│
├─ etc/                          ← 원본 참고 이미지 (게임이 직접 읽지 않음, 읽기 전용)
│
├─ public/
│  ├─ manifest.webmanifest
│  ├─ sw.js
│  ├─ icons/                     ← 192/512/maskable
│  └─ assets/                    ← 최종 게임 에셋 (빌드 산출물, 아래 §5)
│     ├─ characters/             ← ian_front.png, ian_right.png, ian_jump.png …
│     ├─ shoes/shoes_atlas.png   ← 160×140
│     ├─ bg/build_01.png … build_12.png, floor200.png … floor500.png
│     └─ ui/                     ← 버튼, 로고, 패널
│
├─ tools/                        ← Node 스크립트 (빌드 타임 전용)
│  ├─ slice-characters.mjs       ← 캐릭터 시트 → 개별 PNG 30장
│  ├─ build-shoe-atlas.mjs       ← 신발 시트 → 160×140 아틀라스 + shoes.json
│  ├─ downscale-bg.mjs           ← 배경 포스터 → 패널 크롭 → 180폭 축소 → 32색 양자화
│  ├─ bg-panels.json             ← 배경 패널 좌표 (수동 지정)
│  ├─ _bg-qa.mjs                 ← (진단) 포스터에 좌표 격자 얹기
│  └─ _bg-preview.mjs            ← (진단) 변환 결과를 게임처럼 쌓아 미리보기
│
└─ src/
   ├─ main.js                    ← 부트: 캔버스 셋업, 라우터 시작
   │
   ├─ core/                      ← 엔진 (게임 규칙 모름)
   │  ├─ canvas.js               ← 180×320 + 정수배 스케일 + 스무딩 off
   │  ├─ loop.js                 ← 고정 타임스텝
   │  ├─ input.js                ← 터치/키보드 → 추상 입력(LEFT/RIGHT), 버퍼 2
   │  ├─ sprite.js               ← 스프라이트/아틀라스 드로우 (정수 좌표 강제)
   │  ├─ anim.js                 ← 프레임 시퀀서 (8~12FPS)
   │  ├─ scene.js                ← 씬 스택 (push/pop/replace)
   │  ├─ assets.js               ← 로더 + 진행률
   │  └─ rng.js                  ← 시드 기반 난수 (멀티 동기화용)
   │
   ├─ audio/
   │  ├─ audio.js                ← AudioContext, 마스터 게인, unlock 처리
   │  ├─ synth.js                ← 파형 프리미티브 (square/pulse/tri/noise/sweep)
   │  ├─ sfx.js                  ← 효과음 정의 테이블
   │  └─ bgm.js                  ← 10트랙 시퀀서 (100층마다 교체)
   │
   ├─ game/                      ← 인게임 로직
   │  ├─ GameScene.js            ← 조립
   │  ├─ stairs.js               ← 계단 생성/방향/스크롤
   │  ├─ player.js               ← 상태머신 (IDLE/STEP/EFFECT/FALL/DEAD)
   │  ├─ shoes.js                ← 티어 롤, 배치, 착용, 팝 효과
   │  ├─ gauge.js                ← 시간 게이지
   │  ├─ background.js           ← 도로/1층/반복층, 구름, 층수별 교체
   │  ├─ hud.js                  ← 게이지/계단수/찾은신발/부활/일시정지
   │  └─ revive.js               ← 부활 카운트/사용
   │
   ├─ screens/                   ← 비-인게임 화면 (DOM 기반, S01~S18)
   │  ├─ SplashLogin.js  NicknameSetup.js  Portal.js  Lobby.js
   │  ├─ CharacterSelect.js  Collection.js  HallOfFame.js  Controls.js
   │  ├─ Pause.js  GameOver.js  Revive.js
   │  └─ multi/  MultiMenu.js  Room.js  CodeInput.js  Countdown.js  MultiResult.js
   │
   ├─ data/
   │  ├─ characters.js           ← 10종 메타 (id, 이름, 해금 비용, 노출 순서)
   │  ├─ shoes.json              ← 130종 (id, tier, atlas x/y/w/h)
   │  └─ backgrounds.js          ← 12종 + 층수별 교체 테이블
   │
   ├─ services/                  ← Firebase 래퍼 (화면은 이 계층만 호출)
   │  ├─ firebase.js  auth.js  profile.js  collection.js
   │  ├─ leaderboard.js  multiplayer.js  storageLocal.js
   │
   ├─ config/
   │  ├─ balance.js              ← ★ 모든 밸런스 숫자
   │  ├─ layout.js               ← ★ 모든 좌표/크기 상수
   │  └─ strings.ko.js           ← ★ 모든 한국어 문구
   │
   └─ styles/
      ├─ reset.css  pixel-ui.css  screens.css
```

---

## 5. 에셋 파이프라인 규칙

**원본(`etc/`)은 절대 수정하지 않는다.** 항상 `tools/` 스크립트로 `public/assets/` 를 생성한다.

| 원본 | 스크립트 | 산출물 |
|------|----------|--------|
| `etc/캐릭터/캐릭터에셋.png` | `slice-characters.mjs` | 캐릭터 10 × 3컷 = 30 PNG (35×50, 35×50, 50×50) |
| `etc/신발자료/신발130개.png` | `build-shoe-atlas.mjs` | `shoes_atlas.png` (160×140) + `src/data/shoes.json` |
| `etc/백그라운드건물/*.png` (16) | `downscale-bg.mjs` | `build_01~16_{road,floor1,tile}.png` (48장) |
| `etc/200층이상배경/*.png` (4) | `downscale-bg.mjs` | `floor200/300/400/500.png` (각 180×320) |
| `etc/신발자료/newdesign.png` | `slice-newdesign.mjs` | `shoes_master.png` / `shoes_game.png` / `shoe_icon.png` |
| `etc/인터페이스 버튼.png` | `slice-buttons.mjs` | `ui/btn_{turn,left,up,right}.png` (48×48) |
| `etc/UI/계단.png` | `slice-stair.mjs` | `ui/stair.png` (36×19) |

**축소 규칙은 원본의 성격에 따라 다르다.**

| 원본이 | 방법 |
|--------|------|
| 진짜 픽셀아트 (7× 확대된 시트) | 7×7 블록 **중심 픽셀 그대로** 집기 = 무손실. 리샘플 금지 |
| 렌더 일러스트 (배경 포스터) | 패널 크롭 → **lanczos** 축소 → **32색 양자화** |

두 번째 경우 lanczos를 쓰는 건 예외가 아니다. 원본에 픽셀 격자가 없으므로 nearest는 노이즈만 남긴다.
**중요한 건 런타임이다** — 결과물은 180폭 고정이고 화면에서는 정수배로만 확대되므로 완전한 픽셀 퍼펙트다.

배경 패널 좌표는 `tools/bg-panels.json` 에 수동 지정되어 있다. 포스터를 다시 그리면
`node tools/_bg-qa.mjs <이름> <파일...>` 로 좌표 격자를 얹어 보고, `node tools/_bg-preview.mjs build 1 8` 로
타일이 매끄럽게 반복되는지 확인한 뒤 JSON을 고친다.
좌우 반전 컷(왼쪽 보기)은 파일로 만들지 않고 **런타임에 `ctx.scale(-1,1)`** 로 처리한다.

---

## 6. 코딩 규칙

### 6-1. 일반

- 파일당 300줄 이내. 넘으면 분리한다.
- 함수는 한 가지 일만. 이름은 동사로 시작 (`spawnShoe`, `drainGauge`).
- 전역 상태 금지. 상태는 씬이 소유하고 명시적으로 전달한다.
- `console.log` 는 커밋 전 제거. 디버그는 `DEBUG` 플래그 뒤에 둔다.
- 주석은 **왜**를 적는다. 무엇을 하는지는 코드가 말한다.

### 6-2. 문자열

- UI에 보이는 모든 한국어는 `src/config/strings.ko.js` 에만 존재한다. JSX/템플릿에 직접 쓰지 않는다.
- 기획서에 명시된 문구는 **토씨 하나 바꾸지 않는다.** 예:
  - `게임난이도(신발의 등장 빈도가 달라집니다)`
  - `티어가 높은 신발부터 사라집니다`
  - `내 소중한 신발 1켤레를 뺏겼습니다`
  - `신발이 1켤레 이하면 게임에 참가할 수 없습니다`

### 6-3. 인게임 vs 화면 UI

- **인게임(S09/S17)** 은 전부 Canvas에 그린다. DOM 오버레이 금지 (HUD 포함).
- **로비/메뉴(S01~S08, S10~S16, S18)** 는 DOM + CSS. 픽셀 폰트와 `image-rendering: pixelated` 를 CSS로 유지한다.
- 두 방식을 한 화면에서 섞지 않는다.

### 6-4. Firebase

- 화면 코드는 Firebase SDK를 **직접 import 하지 않는다.** 반드시 `src/services/*` 를 경유한다.
- 모든 쓰기는 실패를 가정한다. 실패 시 `sf_pendingScores` 에 큐잉하고 다음 접속에 재시도.
- 키는 `.env` (`VITE_FIREBASE_*`). `.env` 는 `.gitignore`. Vercel 환경변수에 동일하게 등록.
- 보안 규칙: 본인 `users/{uid}` 만 쓰기 가능. `scores` 는 create만 허용하고 update/delete 금지.

### 6-5. 커밋

```
feat(game): 계단 상승 시 번개 이펙트 컷 추가
fix(render): 캐릭터 y좌표 소수점 발생 수정
chore(assets): 신발 아틀라스 재생성
```
- 한 커밋 = 한 가지 변경. `main` 에 push하면 Vercel이 자동 배포되므로 **깨진 상태로 push 금지**.

---

## 7. 작업 시 반드시 확인할 것 (Claude용 체크리스트)

코드를 쓰기 전:

1. `docs/GAME_DESIGN.md` 의 해당 절을 읽었는가?
2. 필요한 숫자가 `src/config/balance.js` / `layout.js` 에 있는가? 없으면 **먼저 거기에 추가**한다.
3. 기획서에 `[빈칸]` 이 남아 있는 항목인가? → **추측하지 말고 사용자에게 묻는다.**

코드를 쓴 후:

4. 소수점 좌표가 생길 수 있는 경로가 있는가?
5. 새 캔버스/버퍼를 만들었다면 `imageSmoothingEnabled = false` 를 걸었는가?
6. 문자열을 하드코딩하지 않았는가?
7. 애니메이션에 보간이나 이징이 섞이지 않았는가?

---

## 8. 자주 하는 실수 (하지 말 것)

| ❌ 하지 마라 | ✅ 대신 |
|-------------|---------|
| `canvas.width = window.innerWidth` | 논리 180×320 고정, CSS로만 확대 |
| `devicePixelRatio` 로 캔버스 확대 | 정수배 스케일만. DPR은 CSS 크기 계산에만 |
| `y += velocity * deltaTime` | 정수 상수 이동 또는 accumulator + `|0` |
| `requestAnimationFrame` 안에서 물리 계산 | 고정 타임스텝 `update()` 안에서만 |
| CSS `transition` / `transform: scale(1.05)` 로 신발 팝 | 스프라이트 크기를 정수배(15→19px)로 2프레임 교체 |
| 배경을 별도 속도로 스크롤 | 계단 상승량과 **동일한 정수 픽셀**만큼 이동 |
| 새 화면마다 Firebase 재초기화 | `services/firebase.js` 싱글턴 |
| 오디오 파일(mp3/wav) 추가 | Web Audio 파형 합성 |
| 캐릭터 왼쪽 컷을 새 PNG로 생성 | 런타임 `ctx.scale(-1,1)` 반전 |
| 기획서 없이 숫자 정하기 | 기획서에 먼저 쓰고 승인받기 |

---

## 9. 현재 상태

- [x] 기획서 `docs/GAME_DESIGN.md` v0.2
- [x] `CLAUDE.md` v0.2
- [x] 확정: 캐릭터 10명 / 계단 46·30 / 멀티 패널티 랜덤 / 난이도별 3개 랭킹
- [x] 확정: 게이지 밸런스 (무한의 계단보다 살짝 빡세게 — 기획서 §5-3 표)
- [x] 확정: 신발 등장 완전 균등 / 함성 효과음 칩튠 합성
- [x] **기획 사양 전체 확정 → 기획서 v1.0**
- [x] **M0 프로젝트 세팅** — Vite 빌드 통과, 180×320 정수배 캔버스, 고정 타임스텝 루프,
      입력(선입력 버퍼 2), 스프라이트/애니 모듈, 5×7 비트맵 폰트, 씬 스택, 시드 RNG, PWA 셸
- [x] **M1 에셋 파이프라인 완료**
  - [x] 캐릭터 10명 × 3컷 = 30장 — 7×7 블록 중심 샘플링으로 무손실 복원, 배경 투명, 바닥 정렬
  - [x] **신발 130종 완료 (마스터 50×30 체계)** — `tools/generate-shoes.mjs` 가 사용자 제공 스니커즈
        스타일을 코드 템플릿(하이탑/로우컷)으로 재현, 130개 팔레트 전량 생성.
        아틀라스 3종: `shoes_master.png` 520×416 · `shoes_stair.png` 260×208(정수 ½) · `shoes_worn.png` 160×130.
        티어 5/10/15/40/60 검증 완료. 색 수정은 스크립트 팔레트만 고치고 재실행.
  - [x] 배경 건물 16종 × 3패널 = 48장 + 층수 배경 4장 — 좌표 수동 지정 후 타일 이음새 육안 검증 완료
- [x] **M2 코어 게임플레이 완료** — 계단 생성(시드 RNG)·상승·전환·추락·게이지·스코어 +
      신발 스폰/획득/착용/팝, 부활(20개당 1개, 3초 카운트다운), 일시정지/게임오버 오버레이,
      배경 3층 레이어 스크롤 + 100층 구름 + 200층↑ 풀스크린 교체, 조작 3모드, 로컬 최고기록.
      브라우저 봇 테스트 통과(30칸 등반·신발 5개 획득·사망 연출·재시작).
      main.js는 임시로 게임 직행 — M5에서 로그인→포털→로비 흐름으로 교체.
- [ ] M3 잔여(도감 영구 저장은 M5 Firebase와 함께) · M4~M8 (기획서 §11-1 참조)

### 에셋 원본 성격 (중요)

| 원본 | 성격 | 결론 |
|------|------|------|
| `캐릭터에셋.png` | 진짜 픽셀아트, 정확히 7× 확대 | 무손실 복원 가능 ✅ |
| `참고용사진/sneaker_strata_spec_sheet.png` | 진짜 픽셀아트, 정확히 7× 확대 | (참고용으로만 남김 — 사용 안 함) |
| `신발자료/신발130개.png` | 렌더 일러스트(런렝스=1, 중간톤 49.6%) | 사용 안 함 |
| **`신발자료/newdesign.png`** | 픽셀아트풍 렌더(중간톤 56%) — 원본 그대로는 도트 아님 | **✅ 최종 소스** — `tools/slice-newdesign.mjs` 가 축소+14색 양자화로 도트화. 티어는 화려함 점수 자동 랭킹 |
| `백그라운드건물/*.png` (16장) | 렌더 일러스트 + 설명 포스터 | 패널 크롭 → 축소 → 양자화 |
| `200층이상배경/*.png` | 렌더 일러스트 + 설명 포스터, 규격이 180×**320** | 패널 크롭 필요 |

**남은 미정값 2개** (개발 환경 값. M0~M4 착수에는 불필요)
- Firebase 프로젝트 ID + 웹 앱 설정 → M5에 필요
- 커스텀 도메인 사용 여부 → M8에 필요

**다음 작업**: `src/config/balance.js` · `layout.js` 초안 작성 → M0 (Vite + Vercel + 180×320 캔버스).

---

## 10. 외부 연결

| 항목 | 값 |
|------|-----|
| GitHub | `https://github.com/nivs-web/find_shoes` |
| 배포 | Vercel (GitHub import 완료, main 자동 배포) |
| Firebase 프로젝트 | `[빈칸 — 프로젝트 ID]` |
| 도메인 | `[빈칸 — 커스텀 도메인 사용 여부]` |
