# 이안 드래곤 게임 — 그림 · 소리 진행 기록 (겜팀장)

## A1 — 팔레트 · 부품 키트 · 샘플 3종 (2026-11-10)
- `art/palette.js` : 외곽선 #14082a + 3단 램프(용 12 · 좀비 5 · 속성 덮어쓰기 5) + 단색.
- `art/kit.js` : 부품(타원 · 다각형) → 칸 채우기 → 빛(왼쪽 위) 3단 + 경계 바둑판 디더 → 부품마다 1칸 외곽선. 회전 없음.
- `art/units.js` : 꼬물이(1·2모습 32·36칸) · 돌등이(1·2모습 40·44칸) · 어슬렁 좀비(36칸) × 6동작(idle0 · walk0 · walk1 · atk0 · atk1 · kb0).
- `tools/idg-art-preview.mjs` : 확인 시트(실제 크기 6동작 · 2배 · 4배 · 실루엣) → `tools/_out/idg-art-preview.png`.
- 다음 : 대표님 승인 → 굽기(`tools/idg-art-build.mjs` · atlas) + A2 월드 1.

## A1 승인 · A2 월드 1 (2026-11-10)
- 대표님 승인: 3차 샘플(꼬물이 귀엽게 · 돌등이 그대로 · 좀비 다시). 대표님 방향: 용 = 귀여운 아기 몬스터 비율, 좀비 = «무섭고 징그러우면서 귀여운» 카툰 좀비, 크게(40~52칸).
- 굽기 `tools/idg-art-build.mjs`(진짜 + 빠진 이름은 보관한 자리표시) · 검사 `tools/idg-art-qa.mjs` · 장면 확인 `tools/idg-art-scene.mjs`.
- 월드 1 전부 진짜 그림(133/133): 용 5종 × 1·2모습(`units.js` · `dragons_w1.js`) · 좀비 6종(`zombies_w1.js`) · 뚱보 좀비 대장 · 노바트 · 왕관 · 둥지 탑 · 좀비 탑 hp0~3(`misc_w1.js`) · 배경 4겹 · 아이콘 6 · 이펙트 3×3(`bg_ui_w1.js`).
- 다음: A3 효과음 · 곡 · 음성(보이스 스튜디오), artManifest 가 오면 빠진 이름 채우기.

## A4 · A5 월드 2~5 (2026-11-10)
- 용 5종 × 1·2모습(`dragons_w25.js`) · 리더 5 · 아이콘 5(`leaders_w25.js`) · 좀비 14(`zombies_w25*.js`) · 보스 4(`bosses_w25*.js`) · 좀비 탑 4 · 배경 4×4(`world_w25*.js`).
- 시트 351/351 진짜 그림 · 빠짐 0. 크기는 매니페스트 참고값보다 큰 것이 있다(좀비 40~60 · 보스 138~148, 대표님 «크게»). 날아다니는 bat · wingz · bossRider 는 발이 바닥에 안 닿음(판 크기 · 기준점은 같음).
- 음악 v2: 저작권 끝난 클래식(터키 행진곡 · 지옥의 갤럽 · 왕벌의 비행 · 산왕의 궁전 · 환희의 송가)으로 교체 — 대표님 지시.

## 이름 변경 · 야간 제작 (2026-11-10 밤 → 11-11 13:00)
- 게임 이름 «좀비와 드래곤»(ZOMBIE & DRAGON) · 오락실 메인 게임 (대표님). id · 폴더(iandragon)는 그대로.
- 배너 v2 (`5b08e19`): 「좀비와」 좀비 살색 · 양 끝 성 반쯤(부장 ai/castles) · 큰 캐릭터 넷(노바트 · 불똥이 ↔ 거대 좀비 · 고깔 좀비) · 로비판 720×305. 스크립트 `tools/build-iandragon-banner.mjs` · `tools/_banner-chars.mjs`.
- 음성 126줄 (`ab8be82`): 보이스 스튜디오 VoxCPM2(감정) 3벌 + Supertonic-3(또박또박) 1벌 → Whisper 받아쓰기로 고름 → 캐릭터 효과(ffmpeg). `tools/idg-voice-gen.mjs`. VoxCPM2 75 · Supertonic 51. 보스 목소리 셋(bossDeep · bossGiant · bossCold)으로 나눔 · 거대 좀비 대사 새로 · title 3줄.
  - 짧은 의성어(퉤엣 · 쌩 · 데굴데굴 · 진화다)는 Whisper 가 못 알아들어 점수가 낮다 → 귀로 확인 필요.
  - OmniVoice(비상업 CC-BY-NC)는 라이선스 동의가 막혀 안 씀 · CosyVoice 3 는 C++ 빌드 도구가 필요해 보류.
- 월드 곡 w1~w5 · 효과음 보강 · 재미 소리 FUN_SFX 17종(꺼 둠) (`bd6c134`) · 연결 함수 worldBgm · fun · setFun (`1c8d55c`) · 부화장 효과음 5 (`d8868eb`).
  - w2 · w3 · w4 선율은 악보 없이 기억으로 옮김 → 대표님이 들어 보고 어색하면 음만 고친다.
- 전투 HUD 아이콘 28 (`0606555`): ui/hud/* + DOM PNG.
- 청취 페이지 (곡 · 효과음 · 재미 소리 · 대사): https://claude.ai/artifact/3hKNriKwHaSVAKRMQTEUXd · 녹음 도구 `tools/idg-audio-record.mjs`.
