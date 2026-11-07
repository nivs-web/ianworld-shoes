# 줄넘기 챔피언 · ROPE BEAT — 마스터 기획서 v1.0 (2026-11-07, 총괄: 겜팀장)

> 권반장 지시 원문 요약
> 누르는 맛 · JUMP(프리텐다드) 큰 글씨 버튼 한가운데 · 캐릭터 3배 이상 · 회전하는 줄이 선명 · 음악 ·
> 어려운 리듬게임 느낌 · 음악이 빨라지고 느려지며 난이도도 같이 · 빠르게 두 번 점프 · 태고의 달인처럼 위에서 줄이 떨어지고
> 발 모양에서 타이밍 맞춰 누르는 타격감 · 효과음 착착 · 음악 1곡 = 1판 60초 · 실제 줄넘기 대회 기술 ·
> 왼쪽 = 줄 넘기기(ROPE) · 오른쪽 = 점프(JUMP) · 싱글은 세계 줄넘기 챔피언십 · 멀티는 마지막까지 안 걸린 사람이 승리 ·
> 완벽히 돌면 콤보 · 완벽한 타이밍은 점수로. 참고 기획서(ROPE BEAT)는 참고만, 더 박진감 있게 탈바꿈.
> 규칙: **픽셀아트만**(벡터 금지) · AI 이미지 생성 금지 · 기존 프로젝트(바닐라 JS + 캔버스 + Firebase) 그대로.

## 1. 한 줄
**음악에 맞춰 위에서 떨어지는 «줄»을 발(JUMP)과 손(ROPE) 판정선에서 받아 치는 두 버튼 줄넘기 리듬 액션.**
곡이 빨라지면 줄도 빨라지고, 느려지면 숨을 고른다. 60초 한 곡에 대회 기술이 몰아친다.

## 2. 조작 — 두 버튼
| 버튼 | PC | 폰 | 뜻 | 캐릭터 동작 |
|---|---|---|---|---|
| **ROPE** (왼쪽, 파랑) | A · ← · F | 왼쪽 아래 큰 단추 | 줄을 머리 위로 넘긴다(손목 회전) | 팔이 원을 그리고 줄이 머리 위를 지난다 |
| **JUMP** (오른쪽, 주황) | D · → · J · Space | 오른쪽 아래 큰 단추 | 발밑으로 오는 줄을 뛰어넘는다 | 점프 → 줄이 발밑 통과 → 착지 |
| 둘 다 | 동시에 | 동시에 | 엇걸어 뛰기(크로스) | 팔을 X 로 꼬며 점프 |
| JUMP 꾹 | 누른 채 | 누른 채 | 높이 점프(이단 · 삼단 뛰기) | 무릎을 접고 높이 떠서 줄이 두세 번 통과 |
| ROPE 꾹 | 누른 채 | 누른 채 | 줄 놓기(릴리스) | 손잡이를 놓아 줄이 공중에서 돌고 다시 잡는다 |
ESC · P · 오른쪽 위 단추 = 일시정지(음악도 같이 멈춘다).

기본 리듬: **박(쿵) = JUMP, 엇박(짝) = ROPE.** «JUMP·ROPE·JUMP·ROPE…» 두 손이 번갈아 북을 치는 느낌(태고의 달인 «쿵·딱»).
ROPE 를 건너뛰고 JUMP 만 누르면 ROPE 노트가 MISS — 콤보가 끊기고 체력이 깎인다(줄을 안 돌리면 줄넘기가 아니다).

## 3. 화면 (세로 기준, 도트 버퍼 짧은 변 128칸)
```
┌──────────────────────────────┐
│ ▓▓▓▓▓▓▓░░ 곡 진행  [Ⅱ]       │  위: 곡 진행 게이지 · 일시정지 · 점수 · BPM · 체력
│ ♥ 체력 ████████    123,400   │
│        58 COMBO  BPM 132     │  가운데 위: 큰 콤보 숫자
│ ┃R┃                    ┃J┃   │  왼쪽 줄 = ROPE 노트, 오른쪽 줄 = JUMP 노트 (위 → 아래로 떨어진다)
│ ┃▬┃      (캐릭터 3배)   ┃▬┃   │  가운데: 크게 줄넘기하는 선수 (판정과 같은 시간표로 줄이 돈다)
│ ┃ ┃        ◯◯◯         ┃▬┃   │
│ (✋)━━━━━━━ 발 ━━━━━━(👣)   │  판정선 = 선수의 발 높이. 왼쪽 표적 = 손+줄, 오른쪽 표적 = 발 모양
│ ┌────────┐  ┌────────┐       │
│ │  ROPE  │  │  JUMP  │       │  아래: 큰 단추 둘 — 글자는 프리텐다드 블랙, 단추 한가운데 큼직하게
│ └────────┘  └────────┘       │
└──────────────────────────────┘
```
- 떨어지는 노트 = **도트 줄 조각**(JUMP: 주황 줄 막대 + 손잡이 / ROPE: 파랑 줄 고리 / 크로스: 두 줄에 걸친 금색 X 줄 / 꾹: 꼬리 달린 줄).
- 노트 간격은 «박» 단위(빨라지면 노트가 더 빨리 떨어진다 — 템포가 눈에 보인다). 겹쳐 지나가는 일이 없다.
- 맞히면: 표적 번쩍 · 도트 폭발 · 판정 글자(PERFECT/GREAT/GOOD) · 선수가 그 기술 동작 · 짧은 화면 흔들림(JUMP PERFECT) · 진동 10ms.
- 템포가 바뀌기 1마디 전: «SPEED UP!» / «SLOW DOWN…» 띠. 기술이 시작될 때: 기술 이름 띠(예: «DOUBLE UNDER!»).

## 4. 판정 (오디오 시각 기준 — 프레임과 무관)
- 기준 시각 = 곡 시계(AudioContext). 입력 시각 = 이벤트 타임스탬프를 오디오 출력 시각으로 바꾼 값 − 사용자 보정값.
- 창(±초): 쉬움 0.060/0.110/0.160 · 보통 0.045/0.090/0.135 · 어려움 0.032/0.068/0.105 (PERFECT/GREAT/GOOD).
- 크로스(둘 다): 두 버튼이 각각 창 안 → 둘 중 나쁜 등급. 꾹 노트: 누를 때 판정 + 끝까지 누르고 있어야 성공(일찍 떼면 MISS).
- 빈 손(노트 없는데 누름): 벌점 없음 — 대신 헛스윙 동작만.
- 보정: 설정 «타이밍 맞추기» — 8박 메트로놈에 맞춰 JUMP → 중앙값으로 −150~+150ms 보정 저장.

## 5. 점수 · 콤보 · 체력 · 등급
- 점수: PERFECT 100 · GREAT 70 · GOOD 40 × 콤보 배율(0~9 ×1.0 · 10~19 ×1.2 · 20~49 ×1.5 · 50~99 ×2.0 · 100+ ×3.0).
- **콤보 = 완벽히 돈 횟수**: PERFECT +1 · GREAT/GOOD 유지 · MISS 0. PERFECT 수는 따로 센다.
- 기술 보너스: 기술 한 번을 MISS 없이 끝내면 +(기술 레벨 × 50), 기술 이름 + «CLEAR!».
- 체력(100): PERFECT +1.5 · GREAT +0.7 · ROPE MISS −6 · JUMP MISS(줄에 걸림) −14 (난이도 배율 쉬움 0.6 · 보통 1 · 어려움 1.3). 0 = «줄에 걸려 탈락».
- 정확도 = (P×100 + G×70 + g×40) / (노트 수×100). 등급 S(95%+) · A(90) · B(80) · C(70) · D.
- FEVER: 50콤보부터 — 배경 조명 · 선수 오라 · 줄 무지개. 100콤보 LEGEND FEVER.
- 별: ★ 완주 · ★★ 정확도 85%+ · ★★★ 스테이지 목표(최대 콤보 · PERFECT 수) 달성.

## 6. 기술 — 실제 줄넘기 대회 기술을 두 버튼 패턴으로 (16분음표 칸, 박 = 4칸)
| 기술 | 대회 이름 | 패턴(칸: 동작) | 레벨 | 동작 |
|---|---|---|---|---|
| 기본 뛰기 | Basic Bounce | 0 J · 2 R | 1 | 양발 모아 뛰기 |
| 투스텝 (빠르게 두 번) | Double Bounce | 0 J · 1 J · 2 R | 2 | 줄 한 바퀴에 두 번 콩콩 |
| 사이드 스윙 | Side Swing | 0 R · 2 R | 2 | 두 손을 모아 줄을 옆으로 휙 (뛰지 않음) |
| 번갈아 뛰기 | Alternate Step | 0 J · 2 R (발 번갈아) + 8분 J | 3 | 달리듯 한 발씩 |
| 엇걸어 뛰기 | Criss-Cross | 0 둘다 · 2 R | 4 | 팔 X 자 |
| 이단 뛰기 | Double Under | 0 J꾹(3칸) · 1 R · 2 R | 5 | 높이 떠서 줄 두 번 |
| 줄 놓기 | Release | 0 R꾹(6칸) · 8 J | 6 | 손잡이 놓고 다시 잡기 |
| 180 턴 | 180 Turn | 0 R · 2 R · 4 J · 6 R | 6 | 옆 스윙하며 반 바퀴 돌기 |
| 하이니 | High Knees | 0 J · 1 R · 2 J · 3 R | 7 | 16분 무릎 높이 달리기 |
| X 이단 | Cross Double Under | 0 둘다 · 1 R · 2 R | 8 | 팔 X + 이단 |
| 삼단 뛰기 | Triple Under | 0 J꾹(4칸) · 1 R · 2 R · 3 R | 9 | 줄 세 번 |
| 360 턴 | 360 Turn | 0 R · 2 R · 4 R · 6 J | 8 | 한 바퀴 돌기 |
| 콤비네이션 | Combination | 위 기술 이어 붙이기 | 10 | 결승 피날레 |
쉬움에서는 꾹 노트 · 16분 노트를 빼고(줄이 저절로 돈다) 핵심 박만 남긴다. 어려움에서는 16분 · 꾹 · 크로스가 모두 나온다.

## 7. 싱글 — 세계 줄넘기 챔피언십 (각 곡 약 60초)
| # | 대회 | 곡(오리지널) | 템포 지도 | 새 기술 | 목표(★★★) |
|---|---|---|---|---|---|
| 1 | 동네 예선 TRAINING GROUND | First Bounce · 칩튠 팝 | 92 → 100 | 기본 · 투스텝 · 사이드 | 콤보 15 · P 20 |
| 2 | 지역 대회 SPEED ARENA | Speed Arena · 펑크 | 108 → 124 ↗ · 100 ↘ · 128 ↗ | 번갈아 · 크로스 | 콤보 25 · P 35 |
| 3 | 전국 대회 CROSS CHALLENGE | Cross Fire · EDM | 124 → 132 · 112 ↘ · 138 | 이단 · 릴리스 · 180 | 콤보 40 · P 60 |
| 4 | 아시아 대회 DOUBLE UNDER | Neon Double · 신스웨이브 | 140 → 148 · 126 ↘ · 158 ↗ | 하이니 · X이단 | 콤보 60 · P 90 |
| 5 | 세계 선수권 WORLD CHAMPIONSHIP | Champion of the Rope · 아케이드 일렉트로 | 150 → 160 · 120 ↘ · 172 ↗ · 182 | 삼단 · 360 · 피날레 | 콤보 80 · P 130 |
- 앞 대회를 완주해야 다음 대회가 열린다(난이도마다 따로). 표: `src/games/jumprope/beat/stages.js`.
- 결과: 등급(S~D) · 별 · 점수 · P/G/g/MISS · 최대 콤보 · 정확도 · 기술 성공 n/m · 경험치 · 별사탕 · 레벨 업.

## 8. 무한 줄넘기 (ENDLESS)
- BPM 100 시작 · 8마디마다 +4 (최고 200) · 갈수록 기술이 늘어난다. **줄에 걸리면(JUMP MISS) 즉시 끝**, ROPE MISS 3번이면 끝.
- 기록: 넘은 수 · 점수 · 최고 콤보 · 도달 BPM → 명예의 전당(난이도별).

## 9. 멀티 — 서바이벌 배틀 (다음 단계, 설계)
- 최대 8명 · 같은 곡 · 같은 채보(같은 씨앗) · 같은 시작 시각(서버 시각 기준 카운트다운). 각자 자기 화면에서 판정(오디오 시각).
- 하트 3개 · **줄에 걸리면(JUMP MISS) −1** · ROPE MISS 는 콤보만 끊김. 하트 0 = 탈락 → 관전(남은 사람 하트 · 콤보 · 점수 실시간).
- 곡은 라운드마다 빨라진다: ROUND 1 BPM 100 → 120 → 140 → 160 → FINAL 180+ (8마디마다 올라감) — 마지막 한 명이 남을 때까지.
- 동시 탈락이면 점수 높은 사람. 1:1 듀얼은 같은 규칙 2인.
- 동기화: 기존 방(RTDB rooms) 구조 재사용 — 시작 시각 · 내 상태(하트 · 콤보 · 점수 · 탈락 시각)만 주고받는다(입력 하나하나는 보내지 않는다 → 비용 최소, NEW_GAME_RULES 준수).
- ⏳ RTDB 규칙에 줄넘기 방 필드 추가 · 게시가 필요하다(대표님 승인). 그 전에는 가짜 DB 시험으로 확인.

## 10. 소리
- 곡: 전부 Web Audio 로 합성하는 오리지널 칩튠(파일 0개) — 템포 지도와 같은 시간표로 예약 재생, 칸 단위로 정확.
- 효과음(누르는 즉시): ROPE = 짧고 마른 «딱»(나무 림 + 줄 휘익) · JUMP = 묵직한 «쿵»(킥 + 줄 찰싹) · 둘 다 = 쿵+딱 ·
  PERFECT 반짝 · MISS 둔탁 · 10콤보마다 상승음 · FEVER · 기술 CLEAR 팡파레 · 카운트다운.

## 11. 그림 (픽셀아트 규칙)
- 선수: 기존 도트 아이(44칸)를 **3배**로(머리끝~발끝 화면 절반). 줄은 같은 배율로 굵고 선명하게, 앞쪽 줄은 외곽선 + 밝은 심.
- 기술 포즈: 기본 · 크로스(팔 X) · 사이드(손 한쪽 모으기) · 높이 점프(무릎 접기) · 회전(정면→옆→뒤→옆) · 릴리스 · 넘어짐 · 환호.
- 대회장 5종: 동네 운동장 · 체육관 · 도시 아레나 · 네온 아레나 · 세계 선수권 경기장(관중 · 조명 · 전광판). FEVER 때 조명 반응.

## 12. 모듈 (기존 구조 위에 `src/games/jumprope/beat/`)
| 파일 | 담당 | 내용 |
|---|---|---|
| `timing.js` | 총괄 | 템포 지도 → 16분 칸 시각 (공용) |
| `stages.js` | 총괄 | 5대회 + 무한 + 난이도 표 (공용) |
| `music.js` | 음악 감독 | 합성 칩튠 6곡 · 예약 재생 · 곡 시계 · 입력 시각 변환 · 효과음 · 메트로놈 |
| `chart.js` · `judge.js` | 리듬 디자이너 | 기술 패턴 · 대회별 채보 × 3난이도 · 무한 채보 · 줄 회전 키 · 판정 · 점수 · 체력 · 등급 · 별 |
| `beatArt.js` (+ `art.js` 포즈) | 픽셀 아티스트 | 노트 · 표적 · 레인 · 폭발 · 피버 · 대회장 5종 · 기술 포즈 |
| `rhythm.js` | 총괄 | 게임 본체: 입력 · 곡 시계 동기 · 그리기 · 결과 |
| 화면들 | 총괄 | 로비 · 대회 고르기 · 준비 · 설정(타이밍 맞추기) |

### 12-1. music.js 규격
```js
export function createMusic() → {
  init()                         // 사용자 제스처 안에서. 여러 번 불러도 된다(AudioContext 생성/재개)
  ctx                            // AudioContext | null
  prepare(songId, { tempo, bars }) → { steps, duration }   // songId: training|arena|cross|double|world|endless
  start(leadIn = 1.6) → T0       // 곡 0칸이 울리는 ctx 시각. 리드인 동안 4박 카운트(효과음 count)
  stop() · pause() · resume()    // pause/resume = ctx.suspend/resume → 곡 시계도 멈춘다
  songTime() → 초                // 지금 들리는 곡 시각 = ctx.currentTime − T0 − 출력 지연
  eventSongTime(perfMs) → 초     // performance.now() 기준 입력 시각 → 곡 시각 (getOutputTimestamp)
  hit(name, opt)                 // rope|jump|both|hold|perfect|great|good|miss|trip|combo{n}|fever|tech|count{n}|go|clear|fail|ui
  setFever(on) · setMusicVolume(v) · setSfxVolume(v) · setEnabled(on)
  metronome(bpm, beats) → T0     // 타이밍 맞추기: T0 부터 bpm 클릭 beats 번
  close()
}
```
### 12-2. chart.js · judge.js 규격
```js
buildChart(stage /* 1~5 | 'endless' | 내 스테이지 객체 */, diff /* easy|normal|hard */, { seed, bars }) → {
  steps, duration, bars,
  notes: [{ id, lane: 'L'|'R'|'B', kind: 'tap'|'hold', step, t, endStep?, endT?, tech /* techs 번호 | -1 */ }],
  techs: [{ i, id, name, en, level, t0, t1, noteIds }],
  ropeKeys: [{ t, a }],          // 줄 각도 키: 발밑 = π + 2πk, 머리 위 = 2πk (늘 증가)
  cues: [{ t, text, kind }],     // SPEED UP / SLOW DOWN / 기술 이름 / 구간
  total }
ropeAngleAt(chart, t) → 각도
createJudge(chart, diff, { endless }) → {
  press(lane, t) → { grade, note, delta } | null      // lane: 'L' | 'R'
  release(lane, t) → 결과 | null
  update(t) → 결과[]                                   // 창이 지난 노트 자동 MISS · 꾹 노트 완료
  state: { score, combo, maxCombo, hp, perfect, great, good, miss, accuracy, fever, alive, techCleared }
  result() → { score, perfect, great, good, miss, maxCombo, accuracy, rank, techCleared, techTotal, cleared, hp }
}
starsFor(result, goals) → 0~3
```
### 12-3. beatArt.js 규격 (전부 도트 버퍼 좌표 · 정수)
```js
drawArena(c, arena, W, H, floorY, t, { fever, energy })
drawLane(c, lane, x, top, bottom, w, t, { pulse })
drawNote(c, lane, kind, x, y, w, { holdPx, hit })        // lane: L|R|B (B 는 x·w 가 두 레인을 덮는 폭)
drawTarget(c, lane, x, y, w, { pressed, flash })          // L = 손+줄 표적(파랑), R = 발 모양 표적(주황)
drawHit(c, x, y, grade, age)
drawFeverAura(c, cx, footY, scale, t)
art.js drawKid pose.state: 'cross' | 'side' | 'spin'(pose.spin 0~1) | 'release' | 'high' (+ 기존 stand · trip · sit · cheer)
```

## 13. 시험
- `node tools/_beat-sim.mjs` — 템포 · 곡 길이 · 채보(노트가 칸 위 · 손으로 칠 수 있는 간격 · 꾹 노트 겹침 없음) · 판정 · 콤보 · 체력 · 별.
- `node tools/_beat-qa.mjs` — 진짜 화면: 자동 연주로 5대회 × 3난이도 완주 · 일시정지 · 결과 · 저장 · 캡처.
- 체크리스트: ROPE 없이 JUMP 만 → ROPE MISS · PERFECT 가 음악과 맞나 · 콤보 증가/초기화 · 이단/싱글 구분 · 터치 · 탭 전환 뒤 판정.

## 14. 단계
- PHASE 1 (지금): 두 버튼 · 음악 · 줄 회전 · 판정 · 점수 · 콤보 · 체력 · 게임 오버 · 다시 하기.
- PHASE 2 (지금): 5대회 · 3난이도 · 기술 패턴 · 결과 · 별 · 기록 저장 · 무한.
- PHASE 3 (지금): 기술 포즈 · 대회장 5종 · 효과음 · 피버.
- PHASE 4 (다음): 멀티 서바이벌 (규칙 게시 후 실제 네트워크 시험).

## 2026-11-07 개편 — «너무 어려워» (권반장 플레이 후)

- **조작: JUMP 하나가 기본.** ROPE 버튼은 잠김(회색 · 자물쇠 · «Lv.20 해금»), 왼쪽 레인은 어둡게.
  채보는 `chart.jumpOnly` 로 바꾼다 — ROPE 노트 빼기 · B(같이) → JUMP · 꾹은 어려움만 · JUMP 사이 최소 간격
  (쉬움 1박 · 0.42초 / 보통 반 박 · 0.27초 / 어려움 반 박 · 0.25초, 어려움은 ROPE 박도 JUMP 로 바꿔 촘촘하게).
  판정 창 ×1.25 · 걸림 피해 9(두 버튼 14) · PERFECT 회복 2 · 무한은 네 번 걸리면 끝(두 버튼은 바로 끝).
- **ROPE+JUMP 두 버튼 = 하드 모드, Lv.20(최고 레벨) 해금.** 로비 «조작»에서 고른다. 별사탕 ×1.5.
  멀티 서바이벌은 모두 같은 노트로 겨루게 늘 JUMP 하나.
- **다가오는 원**(rhythm.js `drawApproach`): 다음 노트 1.6박 전부터 판정 원 둘레의 반투명 고리가 줄어들고
  안쪽이 노랗게 차오른다. 둘 다 노트가 원 한가운데 닿는 순간 판정 원과 겹치고, PERFECT 창 안에서는 흰 고리가 번쩍.
- **모드 설명 팝업**(jrui `modeGuide`): 챔피언십 · 무한 줄넘기 · 멀티 서바이벌을 처음 누를 때 한 번. 설정에서 다시 보기.
- **멀티 서바이벌**(2~8명): `survival.js` · `JumpMultiMenu` · 대기방 · RTDB 규칙 초안(게시 전 — FIREBASE_RULES.md 머리말).
  시뮬 `node --import ./tools/_sim-loader.mjs tools/_jump-survival-sim.mjs` (3명 · 8명 · 한 판 더).
- 배너 · 로고 다시 그림(`tools/build-jumprope-banner.mjs` + `tools/_banner-art.mjs`): 굵은 고딕 블록 제목 · 빨간 영문 ·
  배너 전용 큰 아이 둘 · 진짜 동전 더미 · 트로피.
