# 신발을 찾아서 (오락실 이안월드)

맨발의 주인공이 신발 상자 계단을 오르며 130종 신발을 모으는 세로형 레트로 도트 웹게임.

- 기획: [`docs/GAME_DESIGN.md`](docs/GAME_DESIGN.md)
- 개발 지침: [`CLAUDE.md`](CLAUDE.md)
- 클로드 프로젝트 지침: [`docs/PROJECT_INSTRUCTIONS.md`](docs/PROJECT_INSTRUCTIONS.md)

## 시작하기

```bash
npm install
npm run assets     # 원본(etc/) → 게임 에셋(public/assets/) 생성
npm run dev        # http://localhost:5173
```

`.env.example` 을 `.env` 로 복사하고 Firebase 값을 채운다. (M5 이후 필요)

## 명령어

| 명령 | 설명 |
|------|------|
| `npm run dev` | 개발 서버 |
| `npm run build` | 프로덕션 빌드 → `dist/` |
| `npm run preview` | 빌드 결과 미리보기 |
| `npm run assets` | 에셋 3종 전부 재생성 |
| `npm run assets:chars` | 캐릭터 10명 × 3컷 = 30장 |
| `npm run assets:shoes` | 신발 아틀라스 160×140 + `shoes.json` |
| `npm run assets:bg` | 배경 축소·양자화 |

## 에셋 파이프라인

`etc/` 의 원본은 **절대 수정하지 않는다.** 항상 `tools/` 스크립트가 `public/assets/` 를 만든다.
`public/assets/` 는 `.gitignore` 대상이므로 클론 후 `npm run assets` 를 한 번 돌려야 한다.

| 원본 | 성격 | 처리 |
|------|------|------|
| `etc/캐릭터/캐릭터에셋.png` | 진짜 픽셀아트 (7× 확대) | 7×7 블록 중심 샘플링 → 무손실 복원 |
| `etc/신발자료/참고용사진/sneaker_strata_spec_sheet.png` | 진짜 픽셀아트 (7× 확대) | 위와 동일 → 130종 아틀라스 |
| `etc/백그라운드건물/*.png` | 렌더 일러스트 (픽셀아트 아님) | 패널 크롭 → lanczos 축소 → 32색 양자화 |
| `etc/200층이상배경/*.png` | 렌더 일러스트 | 위와 동일 |

배경 포스터의 패널 좌표는 `tools/bg-panels.json` 에 수동 지정되어 있다.
포스터를 다시 그렸다면 이렇게 확인하고 고친다.

```bash
node tools/_bg-qa.mjs 확인용 "etc/백그라운드건물/<파일>.png"   # 좌표 격자를 얹은 이미지 → /tmp/bgqa_*.png
node tools/_bg-preview.mjs build 1 8                          # 타일 이음새 미리보기 → /tmp/bgprev_*.png
node tools/_bg-preview.mjs floors                             # 층수 배경 미리보기
```

## 진행 상황

- [x] M0 프로젝트 세팅 — Vite, 180×320 정수배 캔버스, 고정 타임스텝 루프, 입력, 픽셀 폰트
- [x] M1 에셋 파이프라인 — 캐릭터 30장, 신발 130종, 배경 건물 16종 × 3패널 + 층수 배경 4장
- [ ] M2 코어 게임플레이
- [ ] M3 신발 시스템
- [ ] M4 사운드 (Web Audio 합성)
- [ ] M5 계정 & 로비 (Firebase)
- [ ] M6 명예의 전당
- [ ] M7 멀티플레이
- [ ] M8 PWA & 폴리시

## 배포

GitHub `main` push → Vercel 자동 배포.
Firebase 키는 Vercel 환경변수(`VITE_FIREBASE_*`)에 등록한다.
