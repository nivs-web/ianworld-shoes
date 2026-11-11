# 좀비와 드래곤 — 오케스트라 EDM 배경음악 출처

- 편곡 · 소리: 좀비와 드래곤 팀 — 무료 오픈소스 음악 프로그램 LMMS 1.2.2 의 신시사이저(TripleOscillator · Kicker)로 직접 합성 (녹음 샘플 0개).
- 원곡은 모두 작곡가 사후 70년이 지난 퍼블릭 도메인 곡이다. 선율은 아래 공개 악보(MIDI)에서 옮겼다.
- **w4 · w3(여름 선율), w5 · w7(카르멘 선율) 음원은 CC-BY-SA**, w2 음원은 CC-BY 표기 대상이다 — 아래 «라이선스 표기 문구» 그대로 게임 «음악 출처» 창에 보인다.
- 곡 배치: lobby 터키 행진곡 · w1 토카타 변주 · w2 민둥산 · w3 여름 변주 · w4 여름 · w5 카르멘 · w6 토카타 · w7 카르멘 변주 · w8 분노의 날 변주 · w9 터키 행진곡 변주 · w10 모차르트 «분노의 날» · boss 산왕의 궁전 · battleA 캉캉 · battleB 왕벌의 비행 · win 환희의 송가 · ending 캉캉

---

# 오케스트라 EDM 선율 자료 — 출처와 확신도

작성: 음악 보조(선율 담당), 2026-11-11 (겜팀장 결정 반영 2차판). 결과 파일: `melodies.json` (같은 폴더).
형식은 지시서대로 박 단위(4분음표 = 1박)이고 `lead` / `bass` / `chords` 가 들어 있다.

## 한눈에 보기

| id | 곡 | 출처 | 라이선스 | 확신도 | 마디 |
|---|---|---|---|---|---|
| lobby | 모차르트 터키 행진곡 (K.331 알라 투르카) | Mutopia id=108 MIDI | Public Domain | 높음 | 17 (2/4) |
| w1 | 생상스 죽음의 무도 | 비움 → **w6 재사용** | - | 미확정 | 0 |
| w2 | 무소륵스키 민둥산의 하룻밤 | Mutopia id=1892 MIDI | CC-BY 3.0 | 중간 | 8 |
| w3 | 바그너 발키리의 기행 | 비움 → **w4 재사용** | - | 미확정 | 0 |
| w4 | 비발디 사계 여름 3악장 «폭풍» | Mutopia id=336 MIDI | **CC-BY-SA 3.0** | 높음 | 16 (3/4) |
| w5 | 비제 카르멘 전주곡 행진 | Mutopia id=635 MIDI | **CC-BY-SA 2.5** | 높음 | 16 (2/4) |
| w6 | 바흐 토카타와 푸가 BWV 565 | Mutopia id=1780 MIDI | Public Domain | 높음 | 12 |
| w7 | 브람스 헝가리 무곡 5번 | 비움 → **w5 재사용** | - | 미확정 | 0 |
| w8 | 베토벤 교향곡 7번 2악장 | 비움 → **w10 재사용** | - | 미확정 | 0 |
| w9 | 차이콥스키 사탕 요정의 춤 | 비움 → **lobby 재사용** | - | 미확정 | 0 |
| w10 | 모차르트 레퀴엠 분노의 날 | Mutopia id=364 MIDI | Public Domain | 높음 | 8 |
| boss | 그리그 산왕의 궁전에서 | Mutopia id=1888 MIDI | Public Domain | 높음 | 8 |
| battleA | 오펜바흐 캉캉(지옥의 갤럽) | **게임 팀 옮김** (music.js TRACKS.battleA) | 선율 PD, 옮긴 데이터는 게임 팀 | 중간(기억으로 옮김) | 8 (4/4) |
| battleB | 림스키코르사코프 왕벌의 비행 | **게임 팀 옮김** (music.js TRACKS.battleB) | 선율 PD, 옮긴 데이터는 게임 팀 | 중간(기억으로 옮김) | 4 (4/4) |
| win | 베토벤 환희의 송가 | Mutopia id=528 MIDI | Public Domain | 높음 | 4 |
| ending | 오펜바흐 캉캉 | battleA 와 같은 선율 그대로 | (battleA 와 같음) | 중간(기억으로 옮김) | 8 (4/4) |

주의: 처음 지시서의 battleA 는 «윌리엄 텔», ending 은 «캉캉» 이었으나, 게임 쪽 music.js 의 battleA 는 캉캉이다.
겜팀장 결정에 따라 battleA = ending = 캉캉(게임 팀 선율), battleB = 왕벌의 비행으로 정했다. 윌리엄 텔은 이번 판에서 쓰지 않는다.

## 라이선스 표기 문구 (음원에 넣을 것)

### CC-BY-SA 로 표기해야 하는 음원 2개 — w4, w5
이 두 곡의 EDM 음원 파일(과 곡 소개문)에는 아래 문구를 그대로 넣고, 음원 파일의 라이선스를 **CC-BY-SA** 로 표기한다.
(`melodies.json` 의 해당 곡 `attribution` 칸에도 같은 문장이 들어 있다. 다른 곡으로 재사용(w3←w4, w7←w5)한 음원도 같은 표기를 따른다.)

- **w4 (사계 «여름» 3악장)**
  - 원 작곡: Antonio Vivaldi (1678–1741, 저작권 소멸), 협주곡 Op.8 No.2 «여름».
  - 악보를 타이핑·조판한 사람: Mutopia Project 기여자 «Anonymous» (LilyPond 원본의 maintainer 항목이 익명, 악보 원본 Performers' Facsimiles).
  - 보관처: Mutopia Project — https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=336
  - 라이선스: Creative Commons Attribution-ShareAlike 3.0 (CC-BY-SA 3.0), https://creativecommons.org/licenses/by-sa/3.0/
  - 넣을 문장: «선율: A. Vivaldi, 사계 중 여름 (악보 타이핑: Anonymous / Mutopia Project, CC-BY-SA 3.0). 이 음원은 같은 조건(CC-BY-SA)으로 공유됩니다.»
- **w5 (카르멘 전주곡)**
  - 원 작곡: Georges Bizet (1838–1875, 저작권 소멸), «카르멘» 제1막 전주곡.
  - 악보를 타이핑·조판한 사람: Alex O'S (Mutopia Project, 악보 원본 Schirmer 1895).
  - 보관처: Mutopia Project — https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=635
  - 라이선스: Creative Commons Attribution-ShareAlike 2.5 (CC-BY-SA 2.5), https://creativecommons.org/licenses/by-sa/2.5/
  - 넣을 문장: «선율: G. Bizet, 카르멘 전주곡 (악보 타이핑: Alex O'S / Mutopia Project, CC-BY-SA 2.5). 이 음원은 같은 조건(CC-BY-SA)으로 공유됩니다.»
- 원 편곡자 칸: 두 곡 모두 «편곡자»는 따로 적혀 있지 않다(원곡 그대로의 악보). 악보를 옮긴 사람이 위 «타이핑한 사람»이다.

### CC-BY(출처 표기 필요) — w2
Modest Mussorgsky, 피아노 편곡 Konstantin Chernov, 조판 Robert Clausecker, Mutopia Project, Creative Commons Attribution 3.0.

## 만든 방식

- 받은 파일은 `<id>/` 폴더에 있다 (Mutopia 직접 주소, 로그인 없음, 실행 파일 없음). w4 는 `w4/x/summer-score-2.mid`(3악장), 머리말 확인용 `w4/ly/`.
- `midi_dump.mjs`: 표준 MIDI 파일 읽기 도구(직접 작성, 새 패키지 설치 없음).
- `build.mjs`: `melodies.json` 만드는 스크립트. 다시 돌리려면 `node build.mjs`. 게임 팀 옮김 곡은 `src/games/iandragon_game/audio/music.js` 를 «읽기만» 해서 TRACKS 칸을 변환한다.
  - `lead` = 선율 성부에서 «가장 높은 음만» 따라간 단선율.
  - `bassLine` = 저음 성부에서 «가장 낮은 음만» 따라간 줄(원곡의 실제 저음 움직임, 참고용). MIDI 곡에만 있음.
  - `chords` = 사람이 악보 음을 보고 붙인 코드 추정(게임 팀 곡은 게임 팀 저음의 근음을 따름).
  - `bass` = MIDI 곡은 `chords` 의 근음을 C2~B2 음역에 놓은 근음 진행. 게임 팀 곡(battleA/B/ending)은 게임 팀의 저음(근음·5도 번갈아) 그대로.
  - 모든 시각은 1/48박 단위로 반올림. 1/48박짜리 음은 앞꾸밈음(장식음).
  - `reuse`/`variant`: 선율을 비워 둔 곡이 어느 곡의 선율을 바꿔 쓰는지(`"reuse": "w6", "variant": 1`). 편곡 쪽이 조·빠르기·음색을 바꿔 다른 곡처럼 굽는다.
- `verify.mjs`: 곡별 음 개수, 총 박 수, 음 높이 범위 표 + 길이 초과·단선율 겹침 검사. `show.mjs <id> <lead|bass|bassLine|chords|figure>`: 음 이름으로 출력.

## 곡별 메모

### lobby — 모차르트 «터키 행진곡» (피아노 소나타 K.331 3악장)
- 출처: https://www.mutopiaproject.org/ftp/MozartWA/KV331/KV331_3_RondoAllaTurca/KV331_3_RondoAllaTurca.mid (Mutopia id=108, Public Domain)
- 대목: 첫 주제(a단조 B A G# A C …) + C장조 중간 대목, 원곡 박 0~33 (16마디).
- 박자 2/4(마디=2박). 원곡 여린내기(16분음표 4개)를 첫 마디 안으로 당기려고 전체를 1박 뒤로 밀었다(첫 마디 = 쉼 1박 + 여린내기 1박, `pickupBeats: 1`). 4/4 로 묶으려면 2마디씩.
- 빠르기 약 120(대략). 확신도 높음.

### w2 — 무소륵스키 «민둥산의 하룻밤»
- 출처: https://www.mutopiaproject.org/ftp/MussorgskyM/nobm/nobm.mid (Mutopia id=1892, IMSLP #19990), CC-BY 3.0 — 위 표기 문구 필요.
- 대목: 시작 8마디(2/2 → 4분음표 박, 32박). 떨림 음형 4마디 → 팡파르(A A# C D D#) 모티프. 앞 8박은 저음 없음(`bassLine` 은 박 8 부터).
- 무소륵스키 «원본(1867)» 계열 피아노 편곡이라 림스키코르사코프판(판타지아)과 리듬·장식이 다를 수 있어 확신도 «중간».

### w4 — 비발디 «사계» 여름 3악장 (폭풍, Presto) ★CC-BY-SA 3.0
- 출처: https://www.mutopiaproject.org/ftp/VivaldiA/O8/summer/summer-mids.zip 의 `summer-score-2.mid` (Mutopia id=336, Performers' Facsimiles 판).
- 박자 3/4(마디=3박). 대목: 박 0~48(16마디). G 페달 16분음표 반복 위에 마디 첫 박 액센트가 G4 F4 E♭4 D4 로 내려오고, 쉼 뒤 D 위에서 한 번 더(D5 C5 B♭4 A4), 이어서 D5 → A3 하행 음계, G · C · E♭ 위 반복과 D6 → G4 하행 음계.
- MIDI 빠르기 150(4분음표). lead = 솔로 성부(합주와 같은 음). 확신도 높음.
- 3/4 이므로 w3(발키리, 원곡 9/8)가 이 선율을 재사용할 때 마디 길이 약속에 유리하다.

### w5 — 비제 «카르멘» 전주곡 행진 주제 ★CC-BY-SA 2.5
- 출처: https://www.mutopiaproject.org/ftp/BizetG/prelude/prelude.mid (Mutopia id=635, Schirmer 1895 판 피아노 편곡).
- 박자 2/4(마디=2박). 대목: 박 0~32(16마디). A 주제(A A A E D E | A A A B C# B | A A B A G# A | B…) → D → A 되풀이 → C → E7 → A 끝맺음.
- 전주곡의 첫 행진 주제이며 «투우사의 노래»(Votre toast)는 아니다. 확신도 높음(MIDI 원본 그대로).

### w6 — 바흐 «토카타와 푸가 d단조» BWV 565
- 출처: https://www.mutopiaproject.org/ftp/BachJS/BWV565/ToccataFugue/ToccataFugue.mid (Mutopia id=1780, Public Domain)
- 대목: 도입부(A → G F E D C# D, 감7화음, D) + 토카타 음형(D–E–C# 3잇단 연속, 한 단계씩 올라가는 되풀이, 옥타브 위 되풀이, 내려오는 순차 진행) + 내려오는 A7 → d단조 끝맺음. 박 0~46.
- 박 0~11 은 늘임표성 자유 리듬. MIDI 에는 첫 A 의 모르덴트(A–G–A) 장식이 빠져 있다. 마지막 2박(46~48)은 쉼. 확신도 높음.

### w10 — 모차르트 «레퀴엠» 분노의 날 (Dies irae)
- 출처: https://www.mutopiaproject.org/ftp/MozartWA/KV626/dies_irae/dies_irae.mid (Mutopia id=364, Public Domain)
- lead = 합창 소프라노 선율(8마디, 박 0~30). `figure` = 제1바이올린 16분음표 반복 음형(박 0~32). 빠르기 180. 확신도 높음.
- w8 이 이 선율을 재사용한다(편곡 쪽이 조·빠르기·음색을 바꿔 구움).

### boss — 그리그 «산왕의 궁전에서»
- 출처: https://www.mutopiaproject.org/ftp/GriegE/O46/Dans_l_antre_du_roi_de_la_montagne/Dans_l_antre_du_roi_de_la_montagne.mid (Mutopia id=1888, Public Domain)
- 대목: 주제 8마디(b단조). MIDI 의 두 번째 마디(박 4)를 박 0 으로 당김. MIDI 가 한 옥타브 낮게(B1 시작) 적혀 있어 lead·bassLine 에 +12(원곡 B2 시작). 원곡은 점점 빨라짐(138 → 154). 확신도 높음.

### win — 베토벤 «환희의 송가»
- 출처: https://www.mutopiaproject.org/ftp/BeethovenLv/ode/ode.mid (Mutopia id=528, Public Domain, SATB 편)
- G장조. 첫 2마디(박 0~8) = B B C D | D C B A 가 승리 소리, 3~4마디는 여유분. 확신도 높음.

### battleA · ending — 캉캉(지옥의 갤럽), 게임 팀 옮김
- 출처: 게임 쪽 `src/games/iandragon_game/audio/music.js` 의 `TRACKS.battleA` (bpm 176, div 2). 읽기만 하고 같은 형식으로 변환했다.
- 마디 = 4박(원곡 2/4 두 마디), 8마디, C장조. 확신도 «중간(기억으로 옮김, 주제 윤곽은 맞음)». 음 하나하나는 악보 대조 전.
- `origBpm` 값(176)은 게임 곡의 bpm 이다. `bass` 는 게임 팀의 근음·5도 번갈아 저음 그대로.
- `ending` 은 battleA 선율·저음·코드를 그대로 복제했다.

### battleB — 왕벌의 비행, 게임 팀 옮김
- 출처: `TRACKS.battleB` (bpm 144, div 4). 마디 = 4박(16분음표 16개), 4마디, a단조. 반음계 16분음표 지그재그 하행 → 상행.
- 확신도 «중간(기억으로 옮김, 주제 윤곽은 맞음)».

## 비운 5곡과 재사용 짝

선율을 정확히 옮길 자신이 없는 곡은 지어내지 않고 비웠다. 대신 `reuse` 칸을 넣었다.

| 비운 곡 | 재사용 | 비고 |
|---|---|---|
| w1 죽음의 무도 (3/4, g단조) | w6 토카타 | 편곡 쪽이 조·빠르기·음색을 바꿔 다른 곡처럼 굽는다 |
| w3 발키리의 기행 (원곡 9/8) | w4 사계 여름 | 3/4 선율 |
| w7 헝가리 무곡 5번 (2/4) | w5 카르멘 행진 | 2/4 선율 |
| w8 베토벤 7번 2악장 | w10 분노의 날 | 원곡 리듬 동기는 «4분 · 8분8분 · 4분 · 4분» |
| w9 사탕 요정의 춤 | lobby 터키 행진곡 | |

왜 못 찾았나: Wikimedia Commons 에는 해당 MIDI 가 없고(녹음 ogg 뿐), IMSLP 는 PDF 를 자동으로 받으려 하면
«봇 확인(friendlytest.html)»으로 넘어간다(봇 확인 우회는 하지 않았다). 녹음에서 음 높이를 자동 추출하는 시도(사탕 요정의 춤)는 실패해 접었다.

## 다음 한 걸음(제안)

- 대표님이 IMSLP 에서 PD 악보(피아노 편곡 PDF)를 `w1`, `w3`, `w7`, `w8`, `w9` 폴더에 넣어 주시면 내가 눈으로 읽어 옮김(확신도 «중간» 예상) → 재사용 대신 진짜 선율로 교체.
- battleA·battleB 의 «기억으로 옮김» 선율은 악보나 귀로 대조하면 확신도를 올릴 수 있다.

