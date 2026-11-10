# 좀비 소리 출처

좀비 소리(zombie_*)는 모두 OpenGameArt.org 에 CC0(퍼블릭 도메인 헌정)으로 올라온 공개 효과음에서 잘라 만들었다.
CC0 라서 출처 표기 의무는 없지만, 기록을 위해 적어 둔다.

## 쓴 원본 3종

| 짧은 이름 | 원본 묶음 | 지은이 | 라이선스 | 주소 |
| --- | --- | --- | --- | --- |
| Z | Zombies Sound Pack (zombies.zip, 24개) | artisticdude | CC0 | https://opengameart.org/content/zombies-sound-pack |
| M | Monster Sound Pack, Volume 1 (monster-sounds-volume-2.zip, 18개) | Ogrebane | CC0 | https://opengameart.org/content/monster-sound-pack-volume-1 |
| S | Zomby sfx pack (0x_zombey.mp3) | saturn91 (saturn91.dev) | CC0 (표기 안 해도 됨) | https://opengameart.org/content/zomby-sfx-pack |

내려받은 원본은 tools/_out/zombie_src/ 아래 출처별 폴더에 있다(저장소에는 올리지 않음).

## 만든 방법 (공통)

- 원본 앞에서 «자른 길이»만큼 쓰고, 앞뒤 무음을 지운 뒤 끝을 0.08초 페이드했다.
- «음높이 ×» 는 재생 속도를 바꿔 음높이를 낮춘 배율이다(1.0 이면 그대로, 낮을수록 더 낮고 느려짐).
- 소리 크기는 loudnorm 2패스(선형)로 맞췄다. 등장·쓰러짐·덩치·유령은 I=-20, 중얼(idle)은 I=-24.
- 모노 48kHz, ogg(libopus 64k)와 m4a(aac 80k)로 냈다.
- 원본에서 자른 구간은 모두 «원본 0초부터 N초»다(무음을 지운 뒤 길이는 파일마다 조금 다름).

## 묶음별

### zombie_spawn (등장 신음, 7벌, 낮은 신음 그대로 + 부드러운 고음 깎기 3kHz)

| 파일 | 원본 | 자른 구간 | 음높이 × |
| --- | --- | --- | --- |
| zombie_spawn_0 | Z: zombie-16.wav | 0~1.4초 | 1.0 |
| zombie_spawn_1 | Z: zombie-18.wav | 0~1.1초 | 0.92 |
| zombie_spawn_2 | Z: zombie-20.wav | 0~0.96초 | 1.0 |
| zombie_spawn_3 | Z: zombie-21.wav | 0~1.08초 | 0.9 |
| zombie_spawn_4 | S: 06_zombey.mp3 | 0~1.3초 | 1.0 |
| zombie_spawn_5 | S: 07_zombey.mp3 | 0~1.5초 | 1.0 |
| zombie_spawn_6 | Z: zombie-15.wav | 0~0.88초 | 0.88 |

### zombie_idle (가끔 내는 그르렁·숨소리, 7벌, 가장 작게: I=-24, 고음을 1.5~1.8kHz 아래로 깎아 은은하게)

| 파일 | 원본 | 자른 구간 | 음높이 × |
| --- | --- | --- | --- |
| zombie_idle_0 | Z: zombie-22.wav | 0~0.67초 | 0.92 |
| zombie_idle_1 | Z: zombie-23.wav | 0~0.81초 | 0.95 |
| zombie_idle_2 | Z: zombie-19.wav | 0~1.0초 | 0.9 |
| zombie_idle_3 | Z: zombie-9.wav | 0~0.88초 | 0.95 |
| zombie_idle_4 | Z: zombie-1.wav | 0~0.85초 | 0.9 |
| zombie_idle_5 | Z: zombie-6.wav | 0~0.54초 | 0.85 |
| zombie_idle_6 | M: monster-14.wav | 0~0.63초 | 0.9 |

### zombie_die (쓰러질 때 «크억» + 털썩, 7벌)

신음 끝부분에 «털썩»(아주 낮은 울림이 뚝 떨어지는 짧은 소리)를 겹쳤다. 털썩은 녹음이 아니라 ffmpeg 로 직접 만든 소리라 저작권 문제가 없다.

| 파일 | 원본 | 자른 구간 | 음높이 × |
| --- | --- | --- | --- |
| zombie_die_0 | Z: zombie-5.wav | 0~0.45초 | 0.9 |
| zombie_die_1 | Z: zombie-7.wav | 0~0.55초 | 0.9 |
| zombie_die_2 | Z: zombie-10.wav | 0~0.6초 | 0.85 |
| zombie_die_3 | Z: zombie-12.wav | 0~0.7초 | 0.85 |
| zombie_die_4 | Z: zombie-13.wav | 0~0.5초 | 0.9 |
| zombie_die_5 | Z: zombie-3.wav | 0~0.55초 | 0.88 |
| zombie_die_6 | Z: zombie-4.wav | 0~0.7초 | 0.85 |

### zombie_big (덩치·골렘의 낮고 묵직한 포효, 4벌, 음높이를 많이 낮추고 2.2~2.4kHz 위를 깎음)

| 파일 | 원본 | 자른 구간 | 음높이 × |
| --- | --- | --- | --- |
| zombie_big_0 | M: Monster-2.wav | 0~0.88초 | 0.6 |
| zombie_big_1 | M: Monster-1.wav | 0~0.75초 | 0.58 |
| zombie_big_2 | M: Monster-3.wav | 0~0.69초 | 0.55 |
| zombie_big_3 | Z: zombie-17.wav | 0~1.1초 | 0.72 |

### zombie_ghost (유령의 공허한 «우우~» 신음, 4벌)

180Hz~1.8kHz 만 남기고, 살짝 떨리게(비브라토) 하고, 짧은 메아리를 얹어 속이 빈 느낌을 냈다.

| 파일 | 원본 | 자른 구간 | 음높이 × |
| --- | --- | --- | --- |
| zombie_ghost_0 | S: 03_zombey.mp3 | 0~1.08초 | 0.9 |
| zombie_ghost_1 | S: 02_zombey.mp3 | 0~1.11초 | 0.78 |
| zombie_ghost_2 | S: 01_zombey.mp3 | 0~1.07초 | 0.9 |
| zombie_ghost_3 | S: 04_zombey.mp3 | 0~1.21초 | 0.88 |
