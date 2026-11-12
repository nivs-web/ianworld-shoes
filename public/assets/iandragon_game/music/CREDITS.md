# 좀비와 드래곤 — 배경음악 출처와 저작권

이 폴더의 음악은 모두 «작곡가 사후 70년이 지난 곡»을 «녹음 자체가 퍼블릭 도메인(PD) 또는 CC0, 또는 출처 표기만 하면 되는 CC BY» 인 공개 음원에서 잘라 만든 것입니다.
NC(비상업)·ND(변경 금지)·SA(동일조건) 조건의 음원은 쓰지 않았습니다. 다만 아래 «라이선스» 칸은 위키미디어 커먼즈 파일 쪽 표시를 그대로 옮긴 것이고, 원 사이트에서 다시 확인한 것은 아닙니다.
처리: 구간 자르기 → (고리 곡) 끝 0.3초와 시작 직전 0.3초 크로스페이드 → loudnorm -16 LUFS → 스테레오 44.1kHz → ogg(opus 112k)·m4a(aac). 내려받은 원본은 tools/_out/music_src 에 있고 커밋하지 않습니다.

## 게임에 꼭 넣어야 하는 표기 (CC BY)

게임의 «크레딧» 화면이나 설명란에 아래 3줄을 넣어야 합니다.

- «Camille Saint-Saëns: Danse Macabre» by Kevin MacLeod (incompetech.com). Licensed under Creative Commons: By Attribution 3.0 — http://creativecommons.org/licenses/by/3.0/
- «Ride of the Valkyries» conducted by Philip Milman (pmmusic.pro). Licensed under Creative Commons: By Attribution 3.0 — https://creativecommons.org/licenses/by/3.0/
- «P. I. Tchaikovsky: Dance of the Sugar Plum Fairy» by Kevin MacLeod (incompetech.com). Licensed under Creative Commons: By Attribution 3.0 — http://creativecommons.org/licenses/by/3.0/

## 곡별 기록

### lobby — 로비 (2026-11-12 교체 · 대표님 «무섭고 으스스한 오케스트라 곡으로»)
- 곡명: 환상 교향곡 5악장 «마녀들의 밤의 꿈» (Symphonie fantastique, op. 14 – V. Songe d'une nuit du Sabbat)
- 작곡가: 엑토르 베를리오즈 (1803–1869)
- 연주자: 이고르 마르케비치 지휘, 라무뢰 관현악단 (Igor Markevitch, Orchestre Lamoureux), 1962년 녹음
- 출처 주소: https://commons.wikimedia.org/wiki/File:Hector_Berlioz_-_Symphonie_fantastique,_op._14_-_5._Songe_d%27une_nuit_du_Sabbat_(Igor_Markevitch,_Orchestre_Lamoureux,_1962).ogg
- 라이선스: 퍼블릭 도메인 (위키미디어 커먼즈 표시)
- 자른 구간: 176.5초 – 261.7초 (길이 85.2초, 고리) — 장례 종소리와 «진노의 날(Dies irae)» 주제, 마녀들의 춤으로 넘어가는 부분. 이음매는 tools/idg-music-loop.mjs 가 끝 2초가 시작 직전 2초와 가장 닮은 곳으로 골랐음
- 처리: 끝 0.3초 크로스페이드 → loudnorm → -16 LUFS 맞춤 → ogg(opus 48k) · m4a(aac 64k)
- 음질 한 줄: 풀 오케스트라 실연(1962 스테레오), 원본 ogg 약 89kbps라 아주 맑지는 않지만 폰 스피커로는 충분
- 이전 로비 곡: 주페 «경기병 서곡» (미국 해병대 군악대 · PD) — 11/12 교체

### w1 — 달밤 언덕
- 곡명: 죽음의 무도 (Danse Macabre)
- 작곡가: 카미유 생상스 (1835–1921)
- 연주자: 케빈 맥러드 (Kevin MacLeod) 편곡·연주 (컴퓨터 합성 오케스트라, 2011)
- 출처 주소: https://commons.wikimedia.org/wiki/File:Kevin_MacLeod_-_Camille_Saint-Sans_Danse_Macabre.ogg
- 라이선스: CC BY 3.0 (출처 표기 필요)
- 자른 구간: 75.53초 – 141.12초 (길이 65.6초, 고리)
- 음질 한 줄: 합성 오케스트라(실제 연주 아님), 192kbps 스테레오. 실연 PD 녹음은 1925년 모노 음반뿐이라 이쪽으로 골랐음

### w2 — 화산
- 곡명: 민둥산의 하룻밤 (Night on Bald Mountain)
- 작곡가: 모데스트 무소륵스키 (1839–1881)
- 연주자: Musopen 제공 오케스트라 녹음 (연주자 미표기)
- 출처 주소: https://commons.wikimedia.org/wiki/File:Modest_Mussorgsky_-_night_on_bald_mountain.ogg
- 라이선스: 퍼블릭 도메인 (커먼즈 표시, 출처 Musopen)
- 자른 구간: 339.47초 – 416.10초 (길이 76.63초, 고리)
- 음질 한 줄: 오케스트라 실연, 192kbps 스테레오. 연주단 이름이 안 적혀 있어 약간 애매함

### w3 — 하늘섬
- 곡명: 발키리의 기행 (Ride of the Valkyries)
- 작곡가: 리하르트 바그너 (1813–1883)
- 연주자: 필립 밀먼 (Philip Milman) 지휘 오케스트라 녹음 (PM Music, 2022)
- 출처 주소: https://commons.wikimedia.org/wiki/File:Ride_of_the_Valkyries.ogg
- 라이선스: CC BY 3.0 (출처 표기 필요)
- 자른 구간: 55.53초 – 122.43초 (길이 66.9초, 고리)
- 음질 한 줄: 오케스트라 실연(2022 스튜디오 녹음), 256kbps 48kHz 스테레오. 이번 묶음 중 음질 최상급

### w4 — 얼음골
- 곡명: 사계 중 «겨울» 1악장 (Vivaldi, Winter I. Allegro non molto)
- 작곡가: 안토니오 비발디 (1678–1741)
- 연주자: 모데나 실내악단 (The Modena Chamber Orchestra), Musopen 제공
- 출처 주소: https://commons.wikimedia.org/wiki/File:The_Modena_Chamber_Orchestra_-_Vivaldi's_Winter,_RV_297_-_I._Allegro_non_molto.ogg
- 라이선스: 퍼블릭 도메인 마크 (PDM, 저작권자가 직접 표시), 출처 Musopen
- 자른 구간: 32.63초 – 113.20초 (길이 80.57초, 고리)
- 음질 한 줄: 실내악 현악 합주(풀 오케스트라 아님), 160kbps 48kHz 스테레오. 커먼즈에 «음높이 20센트 내림 보정»이라고 적혀 있음. 전체적으로 작은 소리 위주

### w5 — 고철 광산
- 곡명: 모루 합창 (Anvil Chorus, 일 트로바토레)
- 작곡가: 주세페 베르디 (1813–1901)
- 연주자: Musopen 제공 녹음 (연주자 미표기)
- 출처 주소: https://commons.wikimedia.org/wiki/File:Giuseppe_Verdi_-_Anvil_Chorus.ogg
- 라이선스: CC0 (커먼즈 표시, 출처 Musopen)
- 자른 구간: 81.60초 – 156.81초 (길이 75.21초, 고리)
- 음질 한 줄: 오케스트라 연주, 140kbps «모노» 원본이라 입체감이 약함(스테레오로 복제). 망치·모루 소리가 광산에 어울려 선택

### w6 — 유령 묘지
- 곡명: 토카타와 푸가 d단조 BWV 565 (금관 합주 편곡)
- 작곡가: 요한 제바스티안 바흐 (1685–1750)
- 연주자: 일리노이 브라스 밴드 (Illinois Brass Band), 2010
- 출처 주소: https://commons.wikimedia.org/wiki/File:Illinois_Brass_Band_-_02_-_Bach_Toccata_and_Fugue_in_D_Minor.ogg
- 라이선스: CC0 (커먼즈 표시)
- 자른 구간: 0.44초 – 64.19초 (길이 63.74초, 고리)
- 음질 한 줄: 금관 합주 실연, 192kbps 스테레오. 맨 처음의 그 유명한 도입부부터 시작하는 고리

### w7 — 사막
- 곡명: 바카날 (Danse Bacchanale, 삼손과 데릴라)
- 작곡가: 카미유 생상스 (1835–1921)
- 연주자: 미국 공군 군악대 콘서트 밴드 (United States Air Force Band), 음반 «French Impressions» (2000)
- 출처 주소: https://commons.wikimedia.org/wiki/File:Danse_Bacchanale_-_Concert_Band_-_United_States_Air_Force_Band.mp3
- 라이선스: 퍼블릭 도메인 (미국 연방정부 저작물로 커먼즈에 표시됨)
- 자른 구간: 339.39초 – 399.96초 (길이 60.56초, 고리)
- 음질 한 줄: 관악 합주, 원본 mp3 320kbps 스테레오라 음질 좋음. 곡 후반 클라이맥스 구간

### w8 — 독 늪·마녀
- 곡명: 전람회의 그림 중 «바바 야가의 오두막» (Baba Yaga)
- 작곡가: 모데스트 무소륵스키 (1839–1881)
- 연주자: 스키드모어 대학 오케스트라 (Skidmore College Orchestra), Musopen 제공
- 출처 주소: https://commons.wikimedia.org/wiki/File:Skidmore_College_Orchestra_-_14_-_IX_La_Cabane_sur_des_pattes_de_poule_Allegro_con_brio_feroce_An.ogg
- 라이선스: CC0 (커먼즈 표시)
- 자른 구간: 6.70초 – 63.88초 (길이 57.18초, 고리)
- 음질 한 줄: 풀 오케스트라 실연, 192kbps 스테레오. 마녀 곡이라 늪·마녀에 딱 맞아 베를리오즈 대신 바꿈

### w9 — 수정 동굴
- 곡명: 사탕 요정의 춤 (Dance of the Sugar Plum Fairy)
- 작곡가: 표트르 차이콥스키 (1840–1893)
- 연주자: 케빈 맥러드 (Kevin MacLeod) 편곡·연주 (컴퓨터 합성, 2011)
- 출처 주소: https://commons.wikimedia.org/wiki/File:Kevin_MacLeod_-_P_I_Tchaikovsky_Dance_of_the_Sugar_Plum_Fairy.ogg
- 라이선스: CC BY 3.0 (출처 표기 필요)
- 자른 구간: 30.13초 – 100.79초 (길이 70.66초, 고리)
- 음질 한 줄: 합성 악기(실연 아님), 192kbps 스테레오. 첼레스타 소리는 깨끗함. 실연 PD 후보는 1930년대 모노 음반뿐

### w10 — 좀비 드래곤 성
- 곡명: 전람회의 그림 중 «키예프의 대문» (The Great Gate of Kiev)
- 작곡가: 모데스트 무소륵스키 (1839–1881)
- 연주자: 스키드모어 대학 오케스트라 (Skidmore College Orchestra), Musopen 제공
- 출처 주소: https://commons.wikimedia.org/wiki/File:Skidmore_College_Orchestra_-_15_-_X_La_grande_porte_de_Kiev_Allegro_alla_breve_Maestoso_Con_gran.ogg
- 라이선스: CC0 (커먼즈 표시)
- 자른 구간: 9.34초 – 59.12초 (길이 49.78초, 고리)
- 음질 한 줄: 풀 오케스트라 실연, 192kbps 스테레오. 장엄한 주제라 성에 어울려, 베르디 레퀴엠(커먼즈 음원이 CC BY-SA 라 불가) 대신 바꿈. 고리 길이는 약 50초

### boss — 보스
- 곡명: 산왕의 궁전에서 (In the Hall of the Mountain King)
- 작곡가: 에드바르 그리그 (1843–1907)
- 연주자: 체코 국립 교향악단 (Czech National Symphony Orchestra, «Musopen Symphony» 이름으로 녹음)
- 출처 주소: https://commons.wikimedia.org/wiki/File:Grieg_-_Peer_Gynt_Suite_No._1,_Op._46_-_IV._In_the_Hall_of_the_Mountain_King_%28Musopen_Symphony%29.flac
- 라이선스: 퍼블릭 도메인 (커먼즈 표시, Musopen 킥스타터 녹음)
- 자른 구간: 106.77초 – 144.17초 (길이 37.4초, 고리)
- 음질 한 줄: 풀 오케스트라 실연, flac 무손실 48kHz 스테레오 — 최고 음질. 곡이 점점 빨라져서 후반 가장 웅장한 약 37초만 고리로 씀

### battleA — 전투 A
- 곡명: 지옥의 갤럽 (캉캉) — 천국과 지옥 서곡
- 작곡가: 자크 오펜바흐 (1819–1880)
- 연주자: Musopen 제공 녹음 (카를 빈더 편곡, 연주자 미표기)
- 출처 주소: https://commons.wikimedia.org/wiki/File:Offenbach_-_Orpheus_in_the_Underworld_-_Overture.ogg
- 라이선스: CC0 (커먼즈 표시, 출처 Musopen)
- 자른 구간: 486.66초 – 553.97초 (길이 67.31초, 고리)
- 음질 한 줄: 오케스트라 실연, 140kbps «모노» 원본(스테레오로 복제). 서곡 맨 끝의 캉캉 구간

### battleB — 전투 B
- 곡명: 왕벌의 비행 (Flight of the Bumblebee)
- 작곡가: 니콜라이 림스키코르사코프 (1844–1908)
- 연주자: 미국 공군 로키산맥 군악대 콘서트 밴드 (United States Air Force Band of the Rockies), 음반 «Hands Across the Sea» (2007)
- 출처 주소: https://commons.wikimedia.org/wiki/File:Flight_of_the_Bumblebee_-_Concert_Band_-_United_States_Air_Force_Band_of_the_Rockies.mp3
- 라이선스: 퍼블릭 도메인 (미국 연방정부 저작물로 커먼즈에 표시됨)
- 자른 구간: 3.63초 – 73.13초 (길이 69.49초, 고리)
- 음질 한 줄: 관악 합주, 128kbps mp3 원본에 소리가 작아(-29 LUFS) 크게 끌어올림. 이번 묶음 중 음질 가장 낮은 편

### win — 승리
- 곡명: 환희의 송가 (Ode to Joy) 마지막 대목
- 작곡가: 루트비히 판 베토벤 (1770–1827)
- 연주자: 미국 공군 로키산맥 군악대 콘서트 밴드 (United States Air Force Band of the Rockies), 음반 «Christmas from the Rockies» (1993)
- 출처 주소: https://commons.wikimedia.org/wiki/File:Ode_to_Joy_-_Concert_Band_-_United_States_Air_Force_Band_of_the_Rockies.mp3
- 라이선스: 퍼블릭 도메인 (미국 연방정부 저작물로 커먼즈에 표시됨)
- 자른 구간: 210.08초 – 215.90초 (길이 5.82초, 고리 아님)
- 음질 한 줄: 관악 합주, 1993년 음반 mp3 원본. 마지막 화음까지 5.8초

### ending — 엔딩
- 곡명: 1812년 서곡 (1812 Overture) 끝부분 — 종소리·대포의 피날레
- 작곡가: 표트르 차이콥스키 (1840–1893)
- 연주자: 스키드모어 대학 오케스트라 (Skidmore College Orchestra), Musopen 제공
- 출처 주소: https://commons.wikimedia.org/wiki/File:Pyotr_Ilyich_Tchaikovsky_-_1812_overture.ogg
- 라이선스: 퍼블릭 도메인 (커먼즈 표시, 출처 Musopen)
- 자른 구간: 944.99초 – 999.00초 (길이 54.01초, 고리 아님)
- 음질 한 줄: 풀 오케스트라 실연, 192kbps 48kHz 스테레오. 엘가 «위풍당당 행진곡»(미 해병대 군악대 PD 녹음)보다 장엄해서 바꿈

## 참고
- Musopen 은 «올리는 사람이 퍼블릭 도메인임을 보증한다»는 조건의 사이트이고, 커먼즈에는 그 파일들이 미러되어 있습니다.
- 미국 군악대 음원(lobby·w7·battleB·win)은 미국 연방정부 직원의 직무 저작물이라 PD 라고 커먼즈에 표시되어 있습니다.
- 사람이 귀로 직접 들어본 것이 아니므로, 어색한 고리 이음새나 곡 선택은 들어 보고 바꿔도 됩니다.
