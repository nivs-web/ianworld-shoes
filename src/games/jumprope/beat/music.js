/**
 * 줄넘기 챔피언 · ROPE BEAT — 음악 · 효과음 · 곡 시계 (2026-11-07, 음악 감독)
 *
 *   const mu = createMusic();
 *   단추를 누를 때 mu.init()                        // 자동재생 규칙: 제스처 안에서 깨운다
 *   const { steps, duration } = mu.prepare('arena', { tempo: st.tempo, bars: st.bars });
 *   const T0 = mu.start();                          // 리드인(4박 카운트) 뒤 곡 0칸이 울리는 ctx 시각
 *   매 프레임 mu.songTime() → 노트 위치 · 입력은 mu.eventSongTime(e.timeStamp) → 판정
 *   mu.hit('jump') · mu.hit('combo', { n: 30 }) · mu.setFever(true) · mu.pause() / mu.resume()
 *
 * 오디오 파일 0개 — 전부 Web Audio 로 합성한 오리지널 칩튠 6곡.
 * ★ 모든 음표 시각 = T0 + steps[칸] (timing.js buildSteps). 채보와 **같은 시간표**라 템포가
 *   빨라지고 느려져도 음악은 노트에서 한 칸도 어긋나지 않는다. 프레임 · 타이머 오차와 무관하고,
 *   «다음 음 = 지난 음 + 간격» 식으로 더해 가지 않으니 오차가 쌓이지 않는다.
 * ★ 박마다 킥(= JUMP), 엇박마다 오픈 하이햇(= ROPE) — 소리만 듣고도 박을 잡을 수 있게.
 *   킥은 **박 위에만** 둔다(엇박 킥 금지): 귀가 «쿵 = JUMP» 를 배우면 헷갈리지 않는다.
 * 작곡(순수 함수 planSong · stepEvents)과 연주(Web Audio)를 나눴다 — node 에서 이벤트 수 ·
 * 시각을 점검할 수 있게(tools/_beat-music-check.mjs). 가져올 때 window/document 를 건드리지 않는다.
 *
 * 신호: 곡 버스(곡마다 새로: 리드 메아리 · 피버 층) → 음악 버스 ┐
 *       효과음 · 카운트 · 메트로놈 ───────────────→ 효과음 버스 ┴→ 컴프레서 → 마스터 → 스피커
 */

import { buildSteps, timeAtStep, bpmAt } from './timing.js';
import { STAGES, ENDLESS } from './stages.js';

export const SONG_IDS = ['training', 'arena', 'cross', 'double', 'world', 'endless'];

/* ===================================================================== *
 * 악보 — 마디 = 16칸(16분음표). 'C5:4' = C5 를 4칸, 길이를 빼면 2칸, '.' = 쉼표.
 * 화음은 마디마다 '|', 한 마디에 둘이면 'F G' 처럼 반씩. 파트 이름 = stages.js 의 구간 이름.
 * 곡 공통 편곡(세기 · 구간 종류에 따른 킥 · 하이햇 · 필 · 라이저)은 stepEvents 가 붙인다.
 * ===================================================================== */
const SONGS = {
  // 1. 동네 예선 — 통통 튀는 칩튠 팝(C장조). 베이스가 박 = 낮은 음, 엇박 = 옥타브 위 «쿵-짝».
  training: {
    title: 'First Bounce', style: 'chiptune-pop', key: 'C', mode: 'major',
    bass: 'bounce', bassVoice: 'tri', comp: 'stab', snare: 'snare', arpPat: [0, 1, 2, 3], echo: 0.12, vib: true, mix: 0.75,
    end: { ch: 'C', m: 'C6' },
    parts: {
      intro: { ch: 'C|G', comp: 'arp', mel: ['.:16', '.:8 G4:2 A4:2 B4:2 D5:2'] },
      A: {
        ch: 'C|Am|F|G|C|Am|F G|C',
        mel: [
          'E5:2 G5:2 C6:4 B5:2 G5:2 E5:4',
          'A5:4 G5:2 E5:2 C5:6 .:2',
          'F5:2 A5:2 C6:2 A5:2 G5:2 F5:2 E5:2 D5:2',
          'D5:4 G5:4 B4:6 .:2',
          'E5:2 G5:2 C6:4 D6:2 C6:2 G5:4',
          'A5:2 C6:2 E6:4 D6:2 C6:2 A5:4',
          'F5:2 A5:2 C6:4 B5:2 A5:2 G5:2 D5:2',
          'C6:4 G5:2 E5:2 C5:8',
        ],
      },
      B: {
        ch: 'F|G|Em|Am|F|G|Em Am|Dm G', comp: 'arp',
        mel: [
          'A5:2 A5:2 C6:2 A5:2 F5:4 C6:4',
          'B5:2 B5:2 D6:2 B5:2 G5:4 D6:4',
          'G5:2 E5:2 G5:2 B5:2 E6:6 .:2',
          'C6:2 B5:2 A5:2 E5:2 A5:8',
          'F5:2 G5:2 A5:2 C6:2 F6:4 E6:2 D6:2',
          'D6:2 C6:2 B5:2 G5:2 D6:4 B5:4',
          'E6:2 D6:2 C6:2 B5:2 C6:2 E6:2 A5:4',
          'D6:4 C6:2 A5:2 B5:2 G5:2 .:4',
        ],
      },
      A2: {
        ch: 'C|Am|F G|C', comp: 'arp',
        mel: [
          'E5:2 G5:2 C6:4 B5:2 G5:2 E5:4',
          'A5:2 C6:2 E6:4 D6:2 C6:2 A5:4',
          'F5:2 A5:2 C6:4 B5:2 A5:2 G5:2 D5:2',
          'C6:4 G5:2 E5:2 C5:8',
        ],
      },
      outro: { ch: 'F G|C', mel: ['C6:4 A5:4 B5:4 D6:4', 'C6:8 .:8'] },
    },
  },

  // 2. 지역 대회 — 펑크(A단조 · 도리안 D). 엇박 화음 «칙» · 16분 하이햇 · 고스트 스네어 · 당김 베이스.
  arena: {
    title: 'Speed Arena', style: 'funk', key: 'A', mode: 'minor',
    bass: 'funk', bassVoice: 'pulse', comp: 'stab', stab16: true, snare: 'snare', ghost: true, hat16: true,
    gate: 0.72, arpPat: [0, 2, 1, 3], echo: 0.06, mix: 1.25,
    end: { ch: 'Am', m: 'A5' },
    parts: {
      intro: { ch: 'Am|D', mel: [] },
      A: {
        ch: 'Am|D|Am|D|Am|D|F|E',
        mel: [
          'A4:1 .:1 C5:1 .:1 D5:2 E5:2 .:2 G5:1 E5:1 D5:2 C5:2',
          '.:2 F#5:2 .:1 E5:1 D5:2 A4:4 .:4',
          'A4:1 .:1 C5:1 .:1 D5:2 E5:2 .:2 A5:2 G5:1 E5:1 G5:2',
          'F#5:2 E5:2 D5:2 E5:2 .:4 C5:2 B4:2',
          'A4:1 .:1 C5:1 .:1 D5:2 E5:2 .:2 G5:1 E5:1 D5:2 C5:2',
          '.:2 A5:2 .:1 G5:1 F#5:2 D5:4 .:4',
          'C6:2 A5:2 F5:2 A5:1 C6:1 .:2 A5:2 G5:2 F5:2',
          'G#5:2 E5:2 B4:2 D5:2 E5:4 .:4',
        ],
      },
      build: {
        ch: 'Dm|Em|F|E',
        mel: [
          'D5:2 .:2 D5:2 .:2 F5:2 .:2 A5:4',
          'E5:2 .:2 E5:2 .:2 G5:2 .:2 B5:4',
          'F5:2 .:2 F5:2 .:2 A5:2 .:2 C6:4',
          'B5:2 C6:2 D6:2 E6:2 G#5:4 B5:4',
        ],
      },
      chorus: {
        ch: 'Am|F|C|G|Am F|E',
        mel: [
          'E6:3 C6:3 A5:2 .:2 C6:2 D6:2 E6:2',
          'F6:3 E6:3 C6:2 .:2 A5:2 C6:2 F6:2',
          'G6:3 E6:3 C6:2 .:2 E6:2 D6:2 C6:2',
          'D6:3 B5:3 G5:2 .:2 B5:2 C6:2 D6:2',
          'E6:2 D6:2 C6:2 A5:2 F6:2 E6:2 C6:2 A5:2',
          'G#5:2 B5:2 E6:4 D6:2 B5:2 G#5:4',
        ],
      },
      break: { ch: 'Fmaj7|Em7|Dm7|E', mel: ['A5:8 G5:8', 'G5:8 E5:8', 'F5:8 D5:8', 'E5:8 G#5:8'] },
      final: {
        ch: 'Am|F|C|G|Am F|E',
        mel: [
          'E6:3 C6:3 A5:2 .:2 C6:2 D6:2 E6:2',
          'F6:3 E6:3 C6:2 .:2 A5:2 C6:2 F6:2',
          'G6:3 E6:3 C6:2 .:2 E6:2 D6:2 C6:2',
          'D6:3 B5:3 G5:2 .:2 B5:2 C6:2 D6:2',
          'E6:2 D6:2 C6:2 A5:2 F6:2 E6:2 C6:2 A5:2',
          'B5:2 C6:2 D6:2 E6:2 F6:2 G#6:2 B6:4',
        ],
      },
    },
  },

  // 3. 전국 대회 — EDM(D단조). 박 = 킥, 엇박 = 베이스(«쿵-붕»), 패드가 박마다 펌핑한다.
  cross: {
    title: 'Cross Fire', style: 'edm', key: 'D', mode: 'minor',
    bass: 'offbeat', bassVoice: 'synth', comp: 'pad', pump: true, arpAt: 2, snare: 'clap', detune: true,
    arpPat: [0, 1, 2, 3], echo: 0.2, mix: 1.05,
    end: { ch: 'Dm', m: 'D6' },
    parts: {
      intro: { ch: 'Dm|C', mel: [] },
      A: {
        ch: 'Dm|Bb|F|C|Dm|Bb|F|A',
        mel: [
          'D5:2 F5:2 A5:2 D6:2 C6:2 A5:2 F5:2 A5:2',
          'D5:2 F5:2 Bb5:2 D6:2 C6:2 Bb5:2 F5:2 Bb5:2',
          'C5:2 F5:2 A5:2 C6:2 F6:2 E6:2 C6:2 A5:2',
          'C5:2 E5:2 G5:2 C6:2 E6:4 D6:2 C6:2',
          'D5:2 F5:2 A5:2 D6:2 C6:2 A5:2 F5:2 A5:2',
          'D6:2 C6:2 Bb5:2 F5:2 D6:2 C6:2 Bb5:2 D6:2',
          'A5:2 C6:2 F6:4 E6:2 C6:2 A5:4',
          'C#6:2 E6:2 A6:4 G6:2 E6:2 C#6:4',
        ],
      },
      B: {
        ch: 'Gm|Dm|Bb|A|Gm|Dm|Bb|A',
        mel: [
          'G5:4 Bb5:4 D6:6 C6:2',
          'A5:4 F5:4 D5:6 E5:2',
          'F5:4 Bb5:4 D6:4 F6:4',
          'E6:6 C#6:2 A5:8',
          'G5:2 Bb5:2 D6:4 G6:4 F6:2 D6:2',
          'F6:4 E6:2 D6:2 A5:4 F5:4',
          'D6:2 F6:2 Bb6:4 A6:2 F6:2 D6:4',
          'C#6:2 D6:2 E6:4 A6:4 .:4',
        ],
      },
      break: { ch: 'Bb|F|Gm|A', mel: ['F5:8 D6:8', 'C6:8 A5:8', 'Bb5:8 D6:8', 'C#6:8 E6:8'] },
      C: {
        ch: 'Dm|Bb|F|C|Dm|Bb|Gm|A',
        mel: [
          'A5:2 A5:2 D6:2 A5:2 F6:3 E6:3 D6:2',
          'F6:2 F6:2 D6:2 Bb5:2 D6:3 C6:3 Bb5:2',
          'C6:2 C6:2 F6:2 C6:2 A6:3 G6:3 F6:2',
          'G6:4 E6:4 C6:4 E6:2 G6:2',
          'A6:2 F6:2 D6:2 A5:2 D6:2 F6:2 A6:4',
          'Bb6:2 F6:2 D6:2 Bb5:2 D6:2 F6:2 Bb6:4',
          'G6:2 D6:2 Bb5:2 G5:2 Bb5:2 D6:2 G6:4',
          'A6:4 E6:2 C#6:2 E6:2 G6:2 A6:4',
        ],
      },
      outro: { ch: 'Dm|Dm', mel: ['D6:8 A5:8', 'F5:4 E5:4 D5:8'] },
    },
  },

  // 4. 아시아 대회 — 신스웨이브(E단조). 8분 톱니 베이스가 달리고, 비브라토 리드에 긴 메아리.
  double: {
    title: 'Neon Double', style: 'synthwave', key: 'E', mode: 'minor',
    bass: 'eighths', bassVoice: 'synth', comp: 'pad', arpAt: 2, snare: 'snare', bigSnare: true, vib: true,
    arpPat: [0, 1, 2, 3, 2, 1], echo: 0.3,
    end: { ch: 'Em', m: 'E6' },
    parts: {
      intro: { ch: 'Em|C', mel: [] },
      A: {
        ch: 'Em|C|G|D|Em|C|G|B',
        mel: [
          'B5:6 G5:2 E5:4 G5:2 A5:2',
          'B5:4 C6:2 B5:2 G5:8',
          'D6:6 B5:2 G5:4 A5:2 B5:2',
          'A5:4 F#5:4 D5:8',
          'E6:6 D6:2 B5:4 G5:2 B5:2',
          'C6:4 E6:4 G6:4 E6:4',
          'D6:4 B5:2 D6:2 G6:6 F#6:2',
          'F#6:4 D#6:4 B5:8',
        ],
      },
      B: {
        ch: 'Am|Em|C|D|Am|Em|C|B',
        mel: [
          'E6:2 E6:2 C6:2 A5:2 E6:4 G6:4',
          'F#6:2 G6:2 F#6:2 E6:2 B5:8',
          'E6:2 E6:2 C6:2 G5:2 E6:4 G6:4',
          'A6:4 F#6:4 D6:4 A5:4',
          'C7:4 B6:2 A6:2 E6:4 A6:4',
          'G6:4 F#6:2 E6:2 B5:8',
          'C6:2 E6:2 G6:2 C7:2 B6:4 G6:4',
          'F#6:2 A6:2 B6:4 D#6:4 B5:4',
        ],
      },
      bridge: {
        ch: 'Cmaj7|Bm7|Am7|Em|C|B',
        mel: ['G5:8 E5:8', 'F#5:8 D5:8', 'E5:8 C5:8', 'B4:16', 'E5:8 G5:8', 'F#5:8 D#5:8'],
      },
      C: {
        ch: 'Em|C|G|D|Em|C|Am|B',
        mel: [
          'E5:1 G5:1 B5:1 E6:1 G6:2 E6:2 B5:2 G5:2 E6:4',
          'C5:1 E5:1 G5:1 C6:1 E6:2 C6:2 G5:2 E5:2 C6:4',
          'D5:1 G5:1 B5:1 D6:1 G6:2 D6:2 B5:2 G5:2 D6:4',
          'D5:1 F#5:1 A5:1 D6:1 F#6:2 A6:2 F#6:4 D6:4',
          'B5:2 E6:2 G6:2 B6:2 A6:2 G6:2 F#6:2 E6:2',
          'E6:2 G6:2 C7:4 B6:2 G6:2 E6:4',
          'C7:2 B6:2 A6:2 E6:2 C6:2 E6:2 A6:4',
          'B6:4 A6:2 F#6:2 D#6:4 B5:4',
        ],
      },
      final: {
        ch: 'Em|C|D|B',
        mel: [
          'E6:6 D6:2 B5:4 G6:2 B6:2',
          'C7:4 B6:4 G6:4 E6:4',
          'F#6:4 A6:4 D7:4 C7:2 A6:2',
          'B6:4 A6:2 F#6:2 D#6:2 F#6:2 B6:4',
        ],
      },
    },
  },

  // 5. 세계 선수권 — 아케이드 일렉트로(F단조), 가장 웅장하게. 금관 화음 · 말발굽 베이스 · 3도 화성 리드 ·
  //    톰 필. 마지막 화음은 F장조(피카르디 3도) — 챔피언이 되는 순간 밝게 끝난다.
  world: {
    title: 'Champion of the Rope', style: 'arcade-electro', key: 'F', mode: 'minor',
    bass: 'gallop', bassVoice: 'square', comp: 'brass', arpAt: 2, snare: 'snare', clapLayer: true, toms: true,
    harm: true, vib: true, arpPat: [0, 2, 1, 3], echo: 0.18,
    end: { ch: 'F', m: 'F6' },
    parts: {
      intro: { ch: 'Fm|C', comp: 'pad', mel: ['.:16', 'C5:2 C5:1 C5:1 C5:2 .:2 E5:2 .:2 G5:4'] },
      A: {
        ch: 'Fm|Db|Eb|C|Fm|Db|Bbm C|Fm',
        mel: [
          'F5:4 C6:4 Ab5:2 G5:2 F5:4',
          'Ab5:4 F5:2 Ab5:2 Db6:8',
          'Bb5:4 G5:2 Bb5:2 Eb6:4 F6:2 G6:2',
          'E6:6 C6:2 G5:8',
          'F6:4 Eb6:2 C6:2 Ab5:4 C6:4',
          'Db6:4 F6:4 Ab6:6 G6:2',
          'F6:2 Db6:2 Bb5:2 F5:2 E5:2 G5:2 C6:4',
          'F5:6 G5:2 Ab5:2 Bb5:2 C6:4',
        ],
      },
      B: {
        ch: 'Db|Eb|Cm|Fm|Db|Eb|C|C',
        mel: [
          'Ab6:3 F6:3 Db6:2 F6:4 Ab6:4',
          'G6:3 Eb6:3 Bb5:2 Eb6:4 G6:4',
          'G6:2 F6:2 Eb6:2 D6:2 Eb6:4 C6:4',
          'C6:4 Ab5:4 F5:4 C6:4',
          'Db7:4 C7:2 Ab6:2 F6:4 Ab6:4',
          'Bb6:4 G6:2 Eb6:2 Bb5:4 Eb6:4',
          'C7:4 Bb6:2 G6:2 E6:4 G6:4',
          'E6:2 F6:2 G6:2 Bb6:2 C7:8',
        ],
      },
      break: { ch: 'Db|Bbm|Eb|C', mel: ['F5:12 Ab5:4', 'Db6:8 Bb5:8', 'G5:8 Bb5:4 Eb6:4', 'E6:8 C6:4 G5:4'] },
      C: {
        ch: 'Fm|Db|Ab|Eb|Fm|Db|Bbm|C',
        mel: [
          'C6:2 F6:2 C6:2 Ab5:2 C6:2 F6:2 G6:2 Ab6:2',
          'F6:2 Db6:2 Ab5:2 Db6:2 F6:4 Ab6:4',
          'Eb6:2 C6:2 Ab5:2 C6:2 Eb6:2 Ab6:2 G6:2 Ab6:2',
          'Bb6:4 G6:4 Eb6:4 Bb5:4',
          'F6:2 Ab6:2 C7:4 Bb6:2 Ab6:2 G6:2 F6:2',
          'Ab6:2 F6:2 Db6:2 F6:2 Ab6:4 Db7:4',
          'Db7:2 C7:2 Bb6:2 F6:2 Db6:2 F6:2 Bb6:4',
          'C7:4 G6:2 E6:2 G6:2 Bb6:2 C7:4',
        ],
      },
      final: {
        ch: 'Fm|Db|Eb|C|Fm|Db|Bbm C|Fm',
        mel: [
          'F5:4 C6:4 Ab5:2 G5:2 F5:4',
          'Ab5:4 F5:2 Ab5:2 Db6:8',
          'Bb5:4 G5:2 Bb5:2 Eb6:4 F6:2 G6:2',
          'E6:4 G6:4 C7:4 Bb6:2 G6:2',
          'F6:4 Eb6:2 C6:2 Ab5:4 C6:4',
          'Db6:4 F6:4 Ab6:6 G6:2',
          'F6:2 Db6:2 Bb5:2 F5:2 E5:2 G5:2 C6:4',
          'F6:4 C6:2 Ab5:2 F5:2 G5:2 Ab5:2 C6:2',
        ],
      },
      outro: { ch: 'Db|C', mel: ['Ab5:8 F5:8', 'E5:4 G5:4 C6:8'] },
    },
  },

  // 6. 무한 줄넘기 — 칩튠 드라이브(G단조). 8마디 한 바퀴를 돌 때마다 선율 · 세기 · 아르페지오 · 조가 바뀐다.
  endless: {
    title: 'Infinite Loop', style: 'chiptune-drive', key: 'G', mode: 'minor',
    bass: 'drive', bassVoice: 'tri', comp: 'arp', snare: 'snare', echo: 0.1, loop: 8, mix: 0.7,
    parts: {
      A: {
        ch: 'Gm|Eb|Bb|F|Gm|Eb|Cm|D',
        mel: [
          'G5:2 Bb5:2 D6:2 G5:2 Bb5:2 D6:2 C6:2 Bb5:2',
          'G5:2 Bb5:2 Eb6:4 D6:2 C6:2 Bb5:4',
          'F5:2 Bb5:2 D6:2 F6:2 Eb6:2 D6:2 C6:2 Bb5:2',
          'A5:4 C6:4 F6:4 C6:4',
          'G6:4 F6:2 D6:2 Bb5:2 D6:2 G6:4',
          'G6:2 F6:2 Eb6:2 Bb5:2 G5:4 Bb5:4',
          'C6:2 Eb6:2 G6:4 F6:2 Eb6:2 C6:4',
          'D6:4 F#6:4 A6:4 F#6:2 D6:2',
        ],
      },
      B: {
        ch: 'Gm|Eb|Bb|F|Gm|Eb|Cm|D',
        mel: [
          'D6:1 D6:1 .:2 D6:2 Bb5:2 G5:2 Bb5:2 D6:2 G6:2',
          'Eb6:1 Eb6:1 .:2 Eb6:2 Bb5:2 G5:2 Bb5:2 Eb6:2 G6:2',
          'F6:1 F6:1 .:2 F6:2 D6:2 Bb5:2 D6:2 F6:2 Bb6:2',
          'A6:4 G6:2 F6:2 C6:4 A5:4',
          'Bb6:2 A6:2 G6:2 D6:2 Bb5:2 D6:2 G6:4',
          'G6:2 Bb6:2 G6:4 F6:2 Eb6:2 Bb5:4',
          'C7:2 Bb6:2 G6:2 Eb6:2 C6:2 Eb6:2 G6:4',
          'A6:2 F#6:2 D6:2 A5:2 F#6:2 A6:2 D6:4',
        ],
      },
      C: {
        ch: 'Gm|Eb|Bb|F|Gm|Eb|Cm|D',
        mel: [
          'G5:6 A5:2 Bb5:4 D6:4',
          'Eb6:6 D6:2 Bb5:8',
          'D6:6 C6:2 Bb5:4 F5:4',
          'A5:6 Bb5:2 C6:8',
          'G6:6 F6:2 D6:4 Bb5:4',
          'Eb6:6 F6:2 G6:8',
          'C6:4 Eb6:4 G6:4 Eb6:4',
          'F#6:4 A6:4 D7:4 .:4',
        ],
      },
    },
  },
};

/* ---------- 악보 읽기 (가져올 때 한 번 — 순수 계산) ---------- */
const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const QUAL = { '': [0, 4, 7], m: [0, 3, 7], 7: [0, 4, 7, 10], m7: [0, 3, 7, 10], maj7: [0, 4, 7, 11], dim: [0, 3, 6], sus4: [0, 5, 7], sus2: [0, 2, 7] };
const LEAD_TOP = 98; // D7 — 이보다 높으면 한 옥타브 내린다(폰 스피커에서 귀가 아프다)
const ARP_PATS = [[0, 1, 2, 3], [3, 2, 1, 0], [0, 2, 1, 3], [0, 1, 2, 1]];
const PROBLEMS = [];

const mod12 = (x) => ((x % 12) + 12) % 12;
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

function pcOf(s) {
  let p = PC[s[0]];
  for (let i = 1; i < s.length; i++) p += s[i] === '#' ? 1 : s[i] === 'b' ? -1 : 0;
  return p;
}
function midiOf(name, where) {
  const r = /^([A-G][#b]?)(\d)$/.exec(name);
  if (!r) { PROBLEMS.push(`${where}: 음 이름 «${name}»`); return 60; }
  return 12 * (Number(r[2]) + 1) + pcOf(r[1]);
}
function chordOf(sym, where) {
  const r = /^([A-G][#b]?)(maj7|m7|m|7|dim|sus4|sus2)?$/.exec(sym);
  if (!r) { PROBLEMS.push(`${where}: 화음 «${sym}»`); return { sym, root: 0, iv: QUAL[''] }; }
  return { sym, root: mod12(pcOf(r[1])), iv: QUAL[r[2] || ''] };
}
function barOf(str, where) {
  const mel = new Array(16).fill(null);
  let s = 0;
  for (const tok of str.trim().split(/\s+/)) {
    const [n, l] = tok.split(':');
    const len = l ? Number(l) : 2;
    if (!(len > 0)) PROBLEMS.push(`${where}: 길이 «${tok}»`);
    if (n !== '.' && s < 16) mel[s] = { m: midiOf(n, where), l: len };
    s += len;
  }
  if (s !== 16) PROBLEMS.push(`${where}: 마디 길이 ${s}칸 (16칸이어야 한다)`);
  return mel;
}
function parseSong(id, S) {
  const parts = {};
  for (const [key, P] of Object.entries(S.parts)) {
    const chs = P.ch.split('|');
    const mels = P.mel || [];
    if (mels.length && mels.length !== chs.length) PROBLEMS.push(`${id}.${key}: 화음 ${chs.length}마디 · 선율 ${mels.length}마디`);
    const bars = chs.map((c, i) => {
      const w = `${id}.${key}[${i}]`;
      const cs = c.trim().split(/\s+/).map((x) => chordOf(x, w));
      return { c0: cs[0], c1: cs[1] || cs[0], split: cs.length > 1, mel: mels[i] ? barOf(mels[i], w) : null };
    });
    parts[key] = { key, bars, comp: P.comp || null, arpPat: P.arpPat || null };
  }
  return {
    id, title: S.title, style: S.style, key: S.key, mode: S.mode, src: S, parts,
    end: S.end ? { c: chordOf(S.end.ch, `${id}.end`), m: midiOf(S.end.m, `${id}.end`) } : null,
  };
}
const PARSED = {};
for (const id of Object.keys(SONGS)) PARSED[id] = parseSong(id, SONGS[id]);

/** 악보 오류 목록 (점검용) — 비어 있어야 한다 */
export function songProblems() { return PROBLEMS.slice(); }
/** 곡 정보 (오디션 페이지 · 점검용) */
export function songInfo(id) {
  const P = PARSED[id];
  return P ? { id, title: P.title, style: P.style, key: P.key, mode: P.mode, parts: Object.keys(P.parts) } : null;
}

/* ---------- 음 고르기 ---------- */
const wrapUp = (pc, lo) => lo + mod12(pc - lo); // lo 이상 한 옥타브 안
const tones = (c, tr, lo) => c.iv.map((i) => wrapUp(c.root + tr + i, lo)).sort((a, b) => a - b);
const bassRoot = (c, tr) => wrapUp(c.root + tr, 40); // E2~D#3 — 폰 스피커에서도 배음이 들리는 높이
const padTones = (c, tr) => tones(c, tr, 57);
const stabTones = (c, tr) => tones(c, tr, 62);
const sparkTones = (c, tr) => tones(c, tr, 84);
function arpTones(c, tr) {
  const t = tones(c, tr, 72);
  if (t.length < 4) t.push(t[0] + 12);
  return t;
}
function capLead(m) { while (m > LEAD_TOP) m -= 12; return m; }
const octUp = (m) => (m + 12 <= LEAD_TOP ? m + 12 : m - 12);
// 화성 리드: 선율 아래 3~9반음 안의 가장 가까운 화음 구성음 → 언제나 화음과 어울린다
function harmBelow(m, c, tr) {
  const pcs = c.iv.map((i) => mod12(c.root + tr + i));
  for (let k = m - 3; k >= m - 9; k--) if (pcs.includes(mod12(k))) return k;
  return 0;
}

/* ---------- 구간 ---------- */
const KIND = { intro: 'intro', break: 'break', bridge: 'break', build: 'build', final: 'final', outro: 'outro' };
const kindOf = (label) => KIND[label] || 'main';
function partFor(P, label, kind) {
  const ps = P.parts;
  const base = String(label).replace(/\d+$/, '');
  const chain = [label, base];
  if (kind === 'break') chain.push('break', 'bridge');
  if (kind === 'final') chain.push('final', 'chorus', 'C', 'B');
  if (kind === 'build') chain.push('build', 'B');
  if (kind === 'outro') chain.push('outro');
  if (kind === 'intro') chain.push('intro');
  chain.push('A', Object.keys(ps)[0]);
  for (const k of chain) if (ps[k]) return ps[k];
  return null;
}
// 무한: 8마디 한 바퀴마다 변주 — 선율 A·B·C · 세기 · 아르페지오 모양 · 조 바꿈(4바퀴마다 위로)
function loopSection(L) {
  if (L <= 0) return { label: 'C', energy: 1, tr: 0, arpPat: ARP_PATS[0], comp: 'arp' };
  const i = (L - 1) % 4;
  return {
    label: ['A', 'B', 'C', 'B'][i],
    energy: [2, 3, 2, 3][i],
    tr: [0, 2, 3, 5][Math.floor((L - 1) / 4) % 4],
    arpPat: ARP_PATS[L % ARP_PATS.length],
    comp: i === 2 ? 'stab' : 'arp',
  };
}

/**
 * 곡 계획 — 시간표(steps)와 구간을 정한다. AudioContext 가 없어도 된다(순수).
 * @param {string} id  training|arena|cross|double|world|endless
 * @param {{ tempo?, bars?, sections? }} o  tempo · bars 를 안 주면 stages.js 값
 */
export function planSong(id, o = {}) {
  const P = PARSED[id] || PARSED.training;
  const endless = P.id === 'endless';
  const stage = STAGES.find((x) => x.id === P.id) || null;
  const bars = Math.max(1, Math.round(o.bars || (stage ? stage.bars : 64)));
  const tempo = o.tempo && o.tempo.length ? o.tempo : endless ? ENDLESS.tempoUntil(bars) : stage.tempo;
  const steps = buildSteps(tempo, bars);
  let secs = null;
  if (!endless) {
    const src = o.sections || (stage && stage.sections) || [{ from: 0, to: bars, label: 'A', energy: 2 }];
    secs = src.map((x) => ({ from: x.from, to: x.to, label: x.label, energy: Math.max(0, Math.min(3, x.energy | 0)), kind: kindOf(x.label) }))
      .sort((a, b) => a.from - b.from);
  }
  return { id: P.id, P, tempo, bars, steps, n: steps.length - 1, duration: steps[steps.length - 1], endless, secs, cache: new Map() };
}

/** 마디 정보 (구간 · 파트 · 화음 · 선율) — 계획마다 기억해 둔다 */
export function barInfo(plan, bar) {
  let b = plan.cache.get(bar);
  if (b) return b;
  const P = plan.P;
  let sec, next = null, tr = 0, arpPat = null, comp = null;
  if (plan.endless) {
    const len = P.src.loop || 8;
    const L = Math.floor(bar / len);
    const ls = loopSection(L), ln = loopSection(L + 1);
    sec = { from: L * len, to: (L + 1) * len, label: ls.label, energy: ls.energy, kind: 'main' };
    next = { kind: 'main', energy: ln.energy };
    tr = ls.tr; arpPat = ls.arpPat; comp = ls.comp;
  } else {
    const S = plan.secs;
    let i = S.findIndex((x) => bar >= x.from && bar < x.to);
    if (i < 0) i = bar < S[0].from ? 0 : S.length - 1;
    sec = S[i];
    next = S[i + 1] || null;
  }
  const part = partFor(P, sec.label, sec.kind);
  const nb = Math.max(1, sec.to - sec.from);
  const bi = Math.max(0, bar - sec.from);
  const pb = part.bars[bi % part.bars.length];
  b = {
    bar, label: sec.label, kind: sec.kind, E: sec.energy, bi, nb, first: bi === 0, last: bi === nb - 1,
    next: next ? { kind: next.kind, E: next.energy } : null,
    c0: pb.c0, c1: pb.c1, split: pb.split, mel: pb.mel, tr,
    comp: comp || part.comp || P.src.comp || 'arp',
    arpPat: arpPat || part.arpPat || P.src.arpPat || ARP_PATS[0],
  };
  if (plan.cache.size > 4096) plan.cache.clear(); // 무한을 아주 오래 돌려도 기억이 끝없이 늘지 않게
  plan.cache.set(bar, b);
  return b;
}

/* 펑크 베이스 — 칸: [근음에서 반음, 길이]. 엇박(6·14)은 옥타브 «퐁» = ROPE 박 */
const FUNK = { 0: [0, 2.5], 3: [0, 0.8], 6: [12, 1], 7: [0, 0.8], 8: [0, 2], 10: [7, 1], 11: [12, 0.8], 14: [12, 1] };
const FUNK_LITE = { 0: [0, 2.5], 6: [12, 1], 8: [0, 2], 10: [7, 1], 14: [12, 1] };
const BRASS = { 0: [3, 1], 6: [2, 0.7], 10: [2, 0.7], 14: [1, 0.5] };
const FILL = { 8: 0.45, 10: 0.55, 12: 0.65, 13: 0.72, 14: 0.82, 15: 0.95 };
const TOMS = { 8: 'hi', 10: 'hi', 12: 'mid', 13: 'mid', 14: 'lo' };

/**
 * 한 칸(16분음표)에서 울릴 음 목록 — 순수 함수.
 *   { v: 목소리, m?: MIDI, ms?: [MIDI…], len?: 칸 수, vel: 0~1, … }
 * 연주부는 시각 = T0 + timeAtStep(steps, 칸), 길이 = 그 칸부터 len 칸 뒤까지의 시간으로 바꾼다.
 */
export function stepEvents(plan, s, opt = {}) {
  const out = [];
  if (!plan.endless && s >= plan.n) { if (s === plan.n) endEvents(plan, out); return out; }
  if (s < 0) return out;
  const bar = Math.floor(s / 16), pos = s - bar * 16;
  const B = barInfo(plan, bar);
  const P = plan.P, X = P.src;
  const ch = pos < 8 ? B.c0 : B.c1;
  const { E, kind, tr } = B;
  const beat = pos % 4 === 0, off8 = pos % 4 === 2;
  const fade = kind === 'outro' ? Math.max(0.5, 1 - 0.35 * ((B.bi + pos / 16) / B.nb)) : 1;
  const push = (e) => out.push(e);

  // 1) 리드 — 펄스 25%
  const n = B.mel && B.mel[pos];
  if (n) {
    const m = capLead(n.m + tr);
    push({ v: 'lead', m, len: n.l, vel: (kind === 'break' ? 0.8 : E >= 2 ? 1 : 0.9) * fade });
    if (E >= 3 && kind !== 'break') push({ v: 'lead2', m: octUp(m), len: n.l, vel: kind === 'final' ? 1 : 0.8 });
    if ((kind === 'final' || (X.harm && E >= 3)) && n.l >= 2) {
      const h = harmBelow(m, ch, tr);
      if (h) push({ v: 'harm', m: h, len: n.l, vel: 1 });
    }
    if (opt.fever && !(E >= 3 && kind !== 'break')) push({ v: 'fever', m: octUp(m), len: n.l, vel: 1 });
  }

  // 2) 화음 · 아르페지오 — 펄스 12.5% / 25%
  const comp = kind === 'break' ? 'pad' : B.comp;
  const cv = (E >= 2 ? 1 : E === 1 ? 0.85 : 0.65) * fade;
  if (comp === 'stab') {
    if (off8) push({ v: 'stab', ms: stabTones(ch, tr), len: 1, vel: cv });
    else if (X.stab16 && E >= 2 && (pos === 3 || pos === 11 || pos === 15)) push({ v: 'stab', ms: stabTones(ch, tr), len: 0.6, vel: cv * 0.4 });
  } else if (comp === 'pad') {
    if (pos === 0 || (pos === 8 && B.split)) {
      push({ v: 'pad', ms: padTones(ch, tr), len: B.split ? 8 : 16, vel: cv, slow: kind === 'break' || kind === 'intro', pump: !!X.pump && kind !== 'break' && kind !== 'intro' });
    }
  } else if (comp === 'brass') {
    if (E >= 2) { const b = BRASS[pos]; if (b) push({ v: 'brass', ms: stabTones(ch, tr), len: b[0], vel: b[1] * cv }); }
    else if (pos === 0 || (pos === 8 && B.split)) push({ v: 'brass', ms: stabTones(ch, tr), len: 6, vel: 0.7 * cv });
  }
  const arpOn = kind !== 'break' && (comp === 'arp' || E >= (X.arpAt ?? 3) || (kind === 'intro' && comp === 'pad'));
  if (arpOn) {
    const fast = comp === 'arp' ? E >= 2 : E >= 3;
    const rate = fast ? 1 : 2;
    if (pos % rate === 0) {
      const tt = arpTones(ch, tr), pat = B.arpPat;
      const k = pat[(pos / rate) % pat.length];
      push({ v: 'arp', m: tt[k % tt.length] + (k >= tt.length ? 12 : 0), len: rate * 0.9, vel: (comp === 'arp' ? 1 : 0.6) * cv });
    }
  }

  // 3) 베이스
  const r = bassRoot(ch, tr);
  const bv = (E >= 2 ? 1 : 0.85) * fade;
  const bass = (m, len, vel) => push({ v: 'bass', m, len, vel });
  if (kind === 'intro' || kind === 'break') { // 길게 이어 붙인다(레가토) — 가벼운 구간에서도 소리 바닥이 끊기지 않게
    if (pos === 0) bass(r, B.split || kind === 'intro' ? 8.6 : 16.6, 0.75);
    else if (pos === 8 && (B.split || kind === 'intro')) bass(r, 8.6, 0.75);
  } else {
    switch (X.bass) {
      case 'bounce': if (beat) bass(r, 1.6, bv); else if (off8) bass(r + 12, 1.4, bv * 0.8); break;
      case 'funk': {
        const f = (E >= 2 ? FUNK : FUNK_LITE)[pos];
        if (f) bass(r + f[0], f[1], bv * (f[0] === 0 ? 1 : 0.85));
        else if (pos === 15 && E >= 2) bass(bassRoot(barInfo(plan, bar + 1).c0, barInfo(plan, bar + 1).tr) - 1, 0.8, bv * 0.75); // 다음 마디 근음으로 반음 미끄럼
        break;
      }
      case 'offbeat': if (off8) bass(r, 1.6, bv); else if (E >= 3 && !beat) bass(r, 0.8, bv * 0.6); break; // E3 = 구르는 베이스(킥 뒤 세 칸)
      case 'eighths': if (pos % 2 === 0) bass(E >= 3 && off8 ? r + 12 : r, 1.7, beat ? bv : bv * 0.85); break;
      case 'gallop':
        if (beat) bass(r, 1.6, bv);
        else if (off8) bass(E >= 3 ? r + 12 : r, 0.9, bv * 0.85);
        else if (pos % 4 === 3) bass(r, 0.9, bv * 0.8);
        break;
      case 'drive': if (pos % 2 === 0) bass(beat ? r : r + 12, 1.6, beat ? bv : bv * 0.85); break;
      default: if (beat) bass(r, 2, bv);
    }
  }

  // 4) 북 — 킥 = 박(JUMP), 오픈 하이햇 = 엇박(ROPE). 이 둘은 세기 1 이상이면 빠지지 않는다.
  const fill = B.last && B.next && (kind === 'main' || kind === 'final') && (B.next.kind === 'main' || B.next.kind === 'final' || B.next.kind === 'build') && E >= 1;
  if (beat) {
    const kv = kind === 'intro' ? 0.45 : kind === 'break' ? 0.55 : E >= 3 ? 0.95 : E === 2 ? 0.88 : E === 1 ? 0.78 : pos === 0 ? 0.5 : 0;
    if (kv) push({ v: 'kick', vel: kv * fade });
  }
  if (off8) push({ v: 'ohat', vel: (kind === 'intro' ? 0.45 : kind === 'break' ? 0.5 : E >= 2 ? 0.85 : 0.7) * fade });
  if (pos % 2 === 1 && E >= 2 && kind !== 'break' && kind !== 'intro') push({ v: 'hat', vel: X.hat16 ? 0.6 : 0.35 });
  if (X.hat16 && E === 1 && kind === 'main' && pos % 2 === 1) push({ v: 'hat', vel: 0.3 });
  // 백비트(2·4박) — 박 위라 JUMP 와 같은 편. 빌드 · 브레이크 · 인트로에는 없다
  if ((pos === 4 || pos === 12) && E >= 1 && kind !== 'intro' && kind !== 'break' && kind !== 'build' && !(fill && pos === 12)) {
    const sv = (E >= 2 ? 0.85 : 0.5) * fade;
    push({ v: X.snare === 'clap' ? 'clap' : 'snare', vel: sv });
    if (X.clapLayer && E >= 2) push({ v: 'clap', vel: sv * 0.6 });
  }
  if (X.ghost && E >= 2 && kind !== 'break' && (pos === 7 || pos === 9)) push({ v: 'snare', vel: 0.14 });
  // 크래시 — 구간 첫 박 · 세기 3 은 4마디마다
  if (pos === 0 && ((B.first && (E >= 2 || kind === 'break')) || (E >= 3 && !B.first && B.bi % 4 === 0))) push({ v: 'crash', vel: kind === 'break' ? 0.6 : B.first ? 1 : 0.6 });
  // 필 — 다음 구간으로 넘어가는 마지막 마디 후반
  if (fill && FILL[pos]) {
    if (X.toms && TOMS[pos]) push({ v: 'tom', k: TOMS[pos], vel: FILL[pos] });
    else push({ v: 'snare', vel: FILL[pos] });
  }
  if (kind === 'intro' && B.last && (pos === 14 || pos === 15)) push({ v: 'snare', vel: pos === 14 ? 0.35 : 0.5 });
  // 빌드 — 4분 → 8분 → 16분으로 조여 드는 스네어
  if (kind === 'build') {
    const rate = B.bi < B.nb - 2 ? 4 : B.bi < B.nb - 1 ? 2 : 1;
    if (pos % rate === 0) push({ v: 'snare', vel: 0.25 + 0.65 * ((B.bi * 16 + pos) / (B.nb * 16)) });
  }
  // 브레이크 마지막 마디 — 다시 달려 나가기 직전 몰아치기
  if (kind === 'break' && B.last && (pos >= 8 || pos % 4 === 0)) push({ v: 'snare', vel: pos >= 8 ? 0.2 + (pos - 8) * 0.08 : 0.22 });
  // 라이저(잡음이 솟는 소리)
  if (pos === 0) {
    if (kind === 'build' && B.bi === B.nb - 2) push({ v: 'riser', len: 32, vel: 1 });
    else if (kind === 'break' && B.last) push({ v: 'riser', len: 16, vel: 1 });
    else if (kind === 'intro' && B.last && B.next && B.next.E >= 2) push({ v: 'riser', len: 16, vel: 0.7 });
  }

  // 5) 결승(final)은 가장 화려하게 — 8분 반짝이 층을 늘 얹는다
  if (kind === 'final' && pos % 2 === 0) {
    const sh = sparkTones(ch, tr);
    push({ v: 'shine', m: sh[(pos / 2) % sh.length], len: 1.6, vel: off8 ? 1 : 0.7 });
  }
  // 6) 피버 층 — 높은 반짝이 16분
  if (opt.fever) {
    const sp = sparkTones(ch, tr);
    push({ v: 'spark', m: sp[pos % sp.length], len: 0.8, vel: off8 ? 1 : 0.6 });
  }
  return out;
}

// 곡 끝(마지막 칸 = duration) — 마침 화음
function endEvents(plan, out) {
  const E = plan.P.end;
  if (!E) return;
  out.push(
    { v: 'kick', vel: 1 }, { v: 'crash', vel: 1 },
    { v: 'brass', ms: stabTones(E.c, 0), len: 10, vel: 1 },
    { v: 'pad', ms: padTones(E.c, 0), len: 16, vel: 1, slow: false, pump: false },
    { v: 'lead', m: E.m, len: 12, vel: 1 },
    { v: 'lead2', m: octUp(E.m), len: 12, vel: 0.7 },
    { v: 'bass', m: bassRoot(E.c, 0), len: 14, vel: 1 },
  );
}

/* ===================================================================== *
 * 연주부 (Web Audio)
 * ===================================================================== */
const MASTER = 0.9;
const MUSIC_BASE = 0.7; // 효과음(버스 1.0)이 음악에 묻히지 않게 한 단 낮춘다
const SFX_BASE = 1;
const LOOKAHEAD = 0.15; // 이만큼 앞까지 예약 (초)
const LOOKAHEAD_HIDDEN = 1.0; // 탭이 가려지면 타이머가 느려지니 더 멀리
const TICK_MS = 25;
const LATE = 0.03; // 이보다 늦은 칸은 건너뛴다 — 밀려서 몰아 울리면 박이 무너진다
const KICK_F0 = 150; // 킥 시작 주파수 (점검 스크립트가 킥을 알아보는 표시)
const VOL = {
  lead: 0.13, lead2: 0.045, harm: 0.06, fever: 0.05, arp: 0.04, spark: 0.032, pad: 0.03, stab: 0.036, brass: 0.048,
  bassTri: 0.34, bassSynth: 0.1, bassPulse: 0.1, bassSq: 0.085,
  kick: 0.62, snare: 0.2, clap: 0.15, hat: 0.04, ohat: 0.075, crash: 0.06, riser: 0.045, tom: 0.32,
};

const off = (n) => { try { n.disconnect(); } catch (e) { /* 이미 끊김 */ } };
const quiet = (p) => { if (p && typeof p.then === 'function') p.then(null, () => {}); return p; };
const VIB = [];
// k번 흔들리는 비브라토 곡선(센트) — 노드 없이 detune 자동화로 건다
function vibCurve(k) {
  if (VIB[k]) return VIB[k];
  const n = k * 16 + 1, c = new Float32Array(n);
  for (let i = 0; i < n; i++) c[i] = 11 * Math.sin((2 * Math.PI * k * i) / (n - 1)) * Math.min(1, i / 20);
  return (VIB[k] = c);
}

export function createMusic() {
  let ctx = null, comp = null, master = null, musicBus = null, sfxBus = null, nbuf = null;
  const W = {};
  let musicVol = 1, sfxVol = 1, enabled = true, fever = false;
  let plan = null, T0 = 0, nextStep = 0, lastStep = -1, playing = false, paused = false;
  let cur = null; // 지금 곡(또는 메트로놈)의 노드 묶음 — stop 이면 통째로 끊는다
  let timer = 0;
  const lastHit = {};

  /* ---------- 공용 부품 ---------- */
  function gainOf(v, dest) { const g = ctx.createGain(); g.gain.value = v; if (dest) g.connect(dest); return g; }
  function filt(type, f, q, t) {
    const b = ctx.createBiquadFilter();
    b.type = type;
    b.frequency.setValueAtTime(f, t);
    b.Q.value = q == null ? 0.7 : q;
    return b;
  }
  function oscOf(wave, f, t, stopAt) {
    const o = ctx.createOscillator();
    if (typeof wave === 'string') o.type = wave; else if (wave) o.setPeriodicWave(wave); else o.type = 'square';
    o.frequency.setValueAtTime(f, t);
    o.start(t);
    o.stop(stopAt);
    return o;
  }
  // 0.0001 → v → (유지) → 0.0001 : 딸깍 없는 타악 엔벨로프
  function env(p, t, a, v, hold, dur) {
    v = Math.max(v, 0.0002);
    a = Math.max(0.0005, Math.min(a, dur * 0.5));
    hold = Math.max(0, Math.min(hold, dur - a - 0.002));
    p.setValueAtTime(0.0001, t);
    p.exponentialRampToValueAtTime(v, t + a);
    if (hold > 0) p.setValueAtTime(v, t + a + hold);
    p.exponentialRampToValueAtTime(0.0001, t + Math.max(dur, a + hold + 0.004));
  }
  // 어택 → 감쇠 → 유지 → 끝에서 풀림 (선율용)
  function adsr(p, t, v, a, dec, sus, end, rel) {
    v = Math.max(v, 0.0002);
    const ta = t + a;
    const td = Math.max(ta + 0.001, Math.min(ta + dec, end - 0.001));
    end = Math.max(end, td + 0.001);
    p.setValueAtTime(0.0001, t);
    p.exponentialRampToValueAtTime(v, ta);
    p.exponentialRampToValueAtTime(Math.max(0.0002, v * sus), td);
    p.setValueAtTime(Math.max(0.0002, v * sus), end);
    p.exponentialRampToValueAtTime(0.0001, end + rel);
    return end + rel;
  }
  // 걸러진 잡음은 세기가 크게 준다 — 대역폭만큼 되돌려 준다
  function ncomp(type, f, q) {
    const ny = ctx.sampleRate / 2;
    const bw = type === 'bandpass' ? f / Math.max(q, 0.05) : type === 'lowpass' ? f : type === 'highpass' ? ny - f : ny;
    return Math.min(8, Math.sqrt(ny / Math.max(30, Math.min(ny, bw))));
  }
  function nsrc(t, dur, dest) {
    const s = ctx.createBufferSource();
    s.buffer = nbuf;
    const loop = dur > 0.9;
    s.loop = loop;
    s.connect(dest);
    s.start(t, Math.random() * (loop ? 0.9 : Math.max(0, 0.96 - dur)));
    s.stop(t + dur + 0.03);
    return s;
  }
  // 음 하나: { type|wave, f, f2, glide, dur, a, hold, vol, out }
  function tone(t, o) {
    const os = oscOf(o.wave || o.type || 'sine', o.f, t, t + o.dur + 0.03);
    if (o.f2) os.frequency.exponentialRampToValueAtTime(o.f2, t + (o.glide || o.dur));
    const g = ctx.createGain();
    env(g.gain, t, o.a || 0.003, o.vol, o.hold || 0, o.dur);
    os.connect(g); g.connect(o.out || sfxBus);
    os.onended = () => { off(os); off(g); };
  }
  // 걸러진 잡음: { type, f, f2, glide, q, dur, a, hold, vol, out }
  function noise(t, o) {
    const type = o.type || 'bandpass';
    const q = o.q == null ? (type === 'bandpass' ? 1 : 0.7) : o.q;
    const fl = filt(type, o.f, q, t);
    if (o.f2) fl.frequency.exponentialRampToValueAtTime(o.f2, t + (o.glide || o.dur));
    const g = ctx.createGain();
    env(g.gain, t, o.a || 0.002, o.vol * ncomp(type, o.f, q), o.hold || 0, o.dur);
    fl.connect(g); g.connect(o.out || sfxBus);
    const s = nsrc(t, o.dur, fl);
    s.onended = () => { off(s); off(fl); off(g); };
  }
  function bell(t, f, dur, vol, out) {
    tone(t, { f, dur, a: 0.0015, vol, out });
    tone(t, { f: f * 2.76, dur: dur * 0.35, a: 0.001, vol: vol * 0.25, out });
  }

  function makeWaves() {
    // 듀티 d 펄스의 n차 배음 = (2/(nπ))·sin(nπd) — NES 음색의 핵심 (src/audio/synth.js 와 같은 식)
    const pulse = (d) => {
      const N = 32, re = new Float32Array(N), im = new Float32Array(N);
      for (let k = 1; k < N; k++) im[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * d);
      return ctx.createPeriodicWave(re, im);
    };
    try { W.p125 = pulse(0.125); W.p25 = pulse(0.25); W.p50 = pulse(0.5); } catch (e) { W.p125 = W.p25 = W.p50 = null; }
  }

  function build() {
    const AC = typeof window !== 'undefined' ? window.AudioContext || window.webkitAudioContext : null;
    if (!AC) return false;
    try { ctx = new AC({ latencyHint: 'interactive' }); } catch (e) { ctx = new AC(); }
    comp = ctx.createDynamicsCompressor(); // 부드러운 리미터 — 효과음이 겹쳐도 찢어지지 않게
    comp.threshold.value = -10;
    comp.knee.value = 8;
    comp.ratio.value = 6;
    comp.attack.value = 0.002;
    comp.release.value = 0.14;
    master = gainOf(enabled ? MASTER : 0, ctx.destination);
    comp.connect(master);
    musicBus = gainOf(MUSIC_BASE * musicVol, comp);
    sfxBus = gainOf(SFX_BASE * sfxVol, comp);
    const len = ctx.sampleRate; // 1초 백색잡음 (한 번만 — 결정적 난수)
    nbuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = nbuf.getChannelData(0);
    let seed = 0x2f6e2b1;
    for (let i = 0; i < len; i++) { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; d[i] = ((seed >>> 0) / 0xffffffff) * 2 - 1; }
    makeWaves();
    try { // 예전 iOS: 제스처 안에서 소리를 한 번 틀어야 풀린다
      const b = ctx.createBufferSource();
      b.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
      b.connect(ctx.destination);
      b.start(0);
      b.onended = () => off(b);
    } catch (e) { /* 무시 */ }
    return true;
  }

  // 곡마다 새 묶음: 출구 · 피버 층 · 리드 메아리(점8분) · 카운트(효과음 버스)
  function newBus() {
    const t = ctx.currentTime;
    const B = { nodes: [] };
    const N = (n) => { B.nodes.push(n); return n; };
    B.out = N(gainOf(plan ? plan.P.src.mix || 1 : 1, musicBus)); // 곡마다 크기를 맞춘다(실측 RMS)
    B.fev = N(ctx.createGain());
    B.fev.gain.setValueAtTime(fever ? 1 : 0.0001, t);
    B.fev.connect(B.out);
    B.echo = N(gainOf(1));
    B.dl = N(ctx.createDelay(1.5));
    B.dl.delayTime.value = 0.3;
    const lp = N(filt('lowpass', 2400, 0.5, t));
    const fb = N(gainOf(0.32));
    B.ret = N(gainOf(plan ? plan.P.src.echo || 0 : 0, B.out));
    B.echo.connect(B.dl); B.dl.connect(lp); lp.connect(fb); fb.connect(B.dl); lp.connect(B.ret);
    B.cnt = N(gainOf(1, sfxBus));
    return B;
  }
  function killBus(B) {
    if (!B) return;
    try {
      const t = ctx.currentTime;
      for (const g of [B.out, B.cnt]) { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.setTargetAtTime(0, t, 0.012); }
    } catch (e) { /* 무시 */ }
    setTimeout(() => B.nodes.forEach(off), 150); // 꼬리를 살짝 줄인 뒤 끊는다 (딸깍 방지)
  }

  /* ---------- 곡 목소리 ---------- */
  const tAt = (s) => T0 + timeAtStep(plan.steps, s);

  // 선율 한 음 — 펄스파, 길면 비브라토, 메아리로 보낼 수 있다
  function mel(t, d, m, v, wave, o) {
    const end = t + Math.max(0.03, d * (o.gate || 0.92));
    const g = ctx.createGain();
    const fin = adsr(g.gain, t, v, 0.004, Math.min(0.09, d * 0.4), 0.72, end, 0.05);
    const f = hz(m);
    const o1 = oscOf(wave, f, t, fin + 0.02);
    const os = [o1];
    if (o.det) { const o2 = oscOf(wave, f, t, fin + 0.02); o1.detune.value = -o.det; o2.detune.value = o.det; os.push(o2); }
    else if (o.vib && end - t > 0.32) {
      const t1 = t + 0.14, dur = end - t1, k = Math.max(1, Math.min(24, Math.round(dur * 5.5)));
      o1.detune.setValueCurveAtTime(vibCurve(k), t1, dur);
    }
    for (const x of os) x.connect(g);
    g.connect(o.out);
    if (o.echo) g.connect(o.echo);
    o1.onended = () => { os.forEach(off); off(g); };
  }
  function blip(t, d, m, v, wave, out) {
    const dur = Math.max(0.03, Math.min(d * 0.95, 0.18));
    const o = oscOf(wave, hz(m), t, t + dur + 0.02);
    const g = ctx.createGain();
    env(g.gain, t, 0.002, v, Math.min(0.02, dur * 0.3), dur);
    o.connect(g); g.connect(out);
    o.onended = () => { off(o); off(g); };
  }
  function chord(t, d, ms, v, wave, a, sus, cut, out) {
    const end = t + Math.max(0.03, d * 0.92);
    const g = ctx.createGain();
    const fin = adsr(g.gain, t, v, a, 0.08, sus, end, 0.06);
    const lp = filt('lowpass', cut, 0.7, t);
    g.connect(lp); lp.connect(out);
    const os = ms.map((m) => { const o = oscOf(wave, hz(m), t, fin + 0.02); o.connect(g); return o; });
    os[0].onended = () => { os.forEach(off); off(g); off(lp); };
  }

  const VOICE = {
    lead(t, d, e) {
      const X = plan.P.src;
      mel(t, d, e.m, VOL.lead * e.vel, W.p25, { out: cur.out, echo: X.echo ? cur.echo : null, gate: X.gate, vib: X.vib, det: X.detune ? 9 : 0 });
    },
    lead2(t, d, e) { mel(t, d, e.m, VOL.lead2 * e.vel, W.p125, { out: cur.out, gate: plan.P.src.gate }); },
    harm(t, d, e) { mel(t, d, e.m, VOL.harm * e.vel, W.p25, { out: cur.out, echo: cur.echo, gate: plan.P.src.gate, vib: true }); },
    fever(t, d, e) { mel(t, d, e.m, VOL.fever * e.vel, W.p125, { out: cur.fev, gate: 0.8 }); },
    arp(t, d, e) { blip(t, d, e.m, VOL.arp * e.vel, W.p125, cur.out); },
    spark(t, d, e) { blip(t, d, e.m, VOL.spark * e.vel, 'triangle', cur.fev); },
    shine(t, d, e) { blip(t, d, e.m, VOL.spark * e.vel, 'triangle', cur.out); },
    stab(t, d, e) { chord(t, Math.min(d, 0.09), e.ms, VOL.stab * e.vel, W.p125, 0.002, 0.4, 3600, cur.out); },
    brass(t, d, e) { chord(t, d, e.ms, VOL.brass * e.vel, W.p125, 0.008, 0.6, 3000, cur.out); },
    pad(t, d, e, s) {
      const v = VOL.pad * e.vel, end = t + d * 0.98;
      const g = ctx.createGain(), p = g.gain;
      const lp = filt('lowpass', e.slow ? 1300 : 2000, 0.7, t);
      let fin;
      if (e.pump) { // 박마다 눌렸다가 엇박에 부풀어 오른다 (사이드체인 흉내 — 엇박 = ROPE 가 느껴진다)
        p.setValueAtTime(0.0001, t);
        for (let k = 0; k < e.len - 0.01; k += 4) {
          const bt = Math.max(t, tAt(s + k)), pk = Math.min(end, tAt(s + k + 2.4));
          p.setValueAtTime(v * 0.1, bt);
          if (pk > bt) p.linearRampToValueAtTime(v, pk);
        }
        p.setValueAtTime(v, end);
        p.exponentialRampToValueAtTime(0.0001, end + 0.08);
        fin = end + 0.08;
      } else fin = adsr(p, t, v, e.slow ? 0.3 : 0.05, 0.2, 0.8, end, e.slow ? 0.4 : 0.25);
      g.connect(lp); lp.connect(cur.out);
      const os = [];
      for (const m of e.ms) for (const det of [-7, 7]) {
        const o = oscOf(W.p125, hz(m), t, fin + 0.02);
        o.detune.value = det;
        o.connect(g); os.push(o);
      }
      os[0].onended = () => { os.forEach(off); off(g); off(lp); };
    },
    bass(t, d, e) {
      const kind = plan.P.src.bassVoice, f = hz(e.m), end = t + Math.max(0.03, d * 0.9);
      const g = ctx.createGain();
      const os = [];
      let lp = null;
      if (kind === 'tri') { // 세모파(NES 베이스) + 폰 스피커용 옥타브 위 펄스 한 겹
        adsr(g.gain, t, VOL.bassTri * e.vel, 0.003, 0.06, 0.8, end, 0.03);
        os.push(oscOf('triangle', f, t, end + 0.05));
        const g2 = gainOf(0.1, g), l2 = filt('lowpass', 1300, 0.7, t);
        const o2 = oscOf(W.p25, f * 2, t, end + 0.05);
        o2.connect(l2); l2.connect(g2); os.push(o2);
        os[1].onended = () => { off(o2); off(l2); off(g2); };
      } else {
        const vol = kind === 'synth' ? VOL.bassSynth : kind === 'pulse' ? VOL.bassPulse : VOL.bassSq;
        adsr(g.gain, t, vol * e.vel, 0.003, kind === 'pulse' ? 0.05 : 0.1, kind === 'pulse' ? 0.5 : 0.75, end, 0.03);
        lp = filt('lowpass', kind === 'synth' ? 280 : kind === 'pulse' ? 1100 : 900, kind === 'synth' ? 5 : 1.5, t);
        if (kind === 'synth') { // 사각(펄스 50%) + 공명 필터 «뭉」 — 신스웨이브 · EDM 베이스
          lp.frequency.exponentialRampToValueAtTime(1700, t + 0.012);
          lp.frequency.exponentialRampToValueAtTime(460, t + Math.min(0.16, d));
        }
        os.push(oscOf(kind === 'pulse' ? W.p25 : W.p50, f, t, end + 0.05));
        os[0].connect(lp); lp.connect(g);
      }
      if (kind === 'tri') os[0].connect(g);
      g.connect(cur.out);
      os[0].onended = () => { off(os[0]); off(g); if (lp) off(lp); };
    },
    kick(t, d, e) {
      const v = VOL.kick * e.vel;
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(KICK_F0, t);
      o.frequency.exponentialRampToValueAtTime(44, t + 0.11);
      const g = ctx.createGain();
      env(g.gain, t, 0.002, v, 0.01, 0.24);
      o.connect(g); g.connect(cur.out);
      o.start(t); o.stop(t + 0.27);
      o.onended = () => { off(o); off(g); };
      tone(t, { type: 'triangle', f: 1100, f2: 380, dur: 0.016, a: 0.0006, vol: v * 0.16, out: cur.out }); // 딸깍 — 폰 스피커에서도 박이 들리게
    },
    snare(t, d, e) {
      const v = VOL.snare * e.vel, big = plan.P.src.bigSnare;
      noise(t, { f: 1800, q: 0.8, dur: big ? 0.26 : 0.13, a: 0.001, vol: v, out: cur.out });
      tone(t, { type: 'triangle', f: 195, f2: 150, dur: 0.07, a: 0.001, vol: v * 0.9, out: cur.out });
      if (big) noise(t, { type: 'highpass', f: 3000, dur: 0.4, a: 0.002, vol: v * 0.22, out: cur.echo }); // 크게 울리는 꼬리
    },
    clap(t, d, e) {
      const v = VOL.clap * e.vel * ncomp('bandpass', 1150, 1.1);
      const fl = filt('bandpass', 1150, 1.1, t), g = ctx.createGain(), p = g.gain;
      p.setValueAtTime(0.0001, t);
      for (let i = 0; i < 3; i++) { // 손바닥 세 번 «짜자작»
        const s0 = t + i * 0.01;
        p.exponentialRampToValueAtTime(v, s0 + 0.0015);
        p.exponentialRampToValueAtTime(v * 0.15, s0 + 0.009);
      }
      p.exponentialRampToValueAtTime(v * 0.55, t + 0.034);
      p.exponentialRampToValueAtTime(0.0001, t + 0.15);
      fl.connect(g); g.connect(cur.out);
      const s = nsrc(t, 0.16, fl);
      s.onended = () => { off(s); off(fl); off(g); };
    },
    hat(t, d, e) { noise(t, { type: 'highpass', f: 7500, dur: 0.03, a: 0.0008, vol: VOL.hat * e.vel, out: cur.out }); },
    ohat(t, d, e) { noise(t, { type: 'highpass', f: 6200, dur: 0.11, a: 0.001, hold: 0.015, vol: VOL.ohat * e.vel, out: cur.out }); },
    crash(t, d, e) {
      noise(t, { type: 'highpass', f: 4500, dur: 1.3, a: 0.002, vol: VOL.crash * e.vel, out: cur.out });
      noise(t, { f: 8000, q: 0.9, dur: 0.5, a: 0.002, vol: VOL.crash * 0.6 * e.vel, out: cur.out });
    },
    tom(t, d, e) {
      const f = e.k === 'hi' ? 230 : e.k === 'mid' ? 175 : 130;
      tone(t, { f, f2: f * 0.55, dur: 0.2, a: 0.002, vol: VOL.tom * e.vel, out: cur.out });
      noise(t, { type: 'lowpass', f: 1200, dur: 0.05, a: 0.001, vol: VOL.tom * 0.3 * e.vel, out: cur.out });
    },
    riser(t, d, e) { // 잡음이 솟아오르며 커진다 — 다음 구간이 터지기 직전
      const fl = filt('bandpass', 350, 1.4, t);
      fl.frequency.exponentialRampToValueAtTime(6500, t + d);
      const g = ctx.createGain(), p = g.gain, v = VOL.riser * e.vel * 3;
      p.setValueAtTime(0.0001, t);
      p.exponentialRampToValueAtTime(v, t + d);
      p.exponentialRampToValueAtTime(0.0001, t + d + 0.05);
      fl.connect(g); g.connect(cur.out);
      const s = nsrc(t, d + 0.05, fl);
      s.onended = () => { off(s); off(fl); off(g); };
    },
  };

  function playStep(s) {
    const t0 = tAt(s);
    if (s % 4 === 0) { // 메아리 = 점8분(3칸) — 템포가 바뀌면 따라간다
      try { cur.dl.delayTime.setTargetAtTime(Math.min(1.2, tAt(s + 3) - t0), t0, 0.03); } catch (e) { /* 무시 */ }
    }
    if (!enabled || musicVol <= 0.001) return; // 소리는 꺼도 곡 시계는 간다
    const evs = stepEvents(plan, s, { fever });
    for (const e of evs) {
      const t = e.off ? tAt(s + e.off) : t0;
      const d = e.len ? tAt(s + (e.off || 0) + e.len) - t : 0;
      try { VOICE[e.v](t, d, e, s); } catch (err) { /* 음 하나 실패해도 곡은 간다 */ }
    }
  }

  const hiddenDoc = () => { try { return typeof document !== 'undefined' && document.visibilityState === 'hidden'; } catch (e) { return false; } };

  // 예약: 지금 + 0.15초 안에 들어오는 칸을 전부. 칸 시각은 언제나 T0 + steps[칸] 에서 새로 잰다.
  function tick() {
    if (!ctx || !cur || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    if (playing && plan) {
      const horizon = now + (hiddenDoc() ? LOOKAHEAD_HIDDEN : LOOKAHEAD);
      let guard = 0;
      while (nextStep <= lastStep && guard++ < 512) {
        const t = tAt(nextStep);
        if (t >= horizon) break;
        if (t >= now - LATE) playStep(nextStep);
        nextStep++;
      }
      if (nextStep > lastStep && now > tAt(lastStep) + 3) { playing = false; stopTimer(); } // 곡 끝 · 꼬리까지 다 울렸다
    }
  }
  function startTimer() { if (!timer) timer = setInterval(tick, TICK_MS); }
  function stopTimer() { if (timer) clearInterval(timer); timer = 0; }

  /* ---------- 효과음 ---------- */
  const SFX = {
    // 손: 마른 나무 «딱» + 줄 «휘익»
    rope(t, o) {
      const k = o.k || 1;
      noise(t, { f: 3600, q: 1.4, dur: 0.014, a: 0.0005, vol: 0.34 * k });
      tone(t, { type: 'triangle', f: 1850, f2: 1350, dur: 0.05, a: 0.0006, vol: 0.2 * k });
      tone(t, { f: 920, f2: 700, dur: 0.035, a: 0.0006, vol: 0.1 * k });
      noise(t + 0.004, { f: 1400, f2: 5200, q: 2.2, dur: 0.075, a: 0.02, vol: 0.12 * k });
    },
    // 발: 묵직한 «쿵» + 줄 «찰싹»
    jump(t, o) {
      const k = o.k || 1;
      tone(t, { f: 175, f2: 46, glide: 0.1, dur: 0.22, a: 0.001, vol: 0.85 * k });
      tone(t, { type: 'triangle', f: 980, f2: 260, dur: 0.022, a: 0.0005, vol: 0.14 * k });
      noise(t, { type: 'lowpass', f: 380, dur: 0.07, a: 0.001, vol: 0.26 * k });
      noise(t + 0.006, { f: 2700, q: 0.9, dur: 0.03, a: 0.0005, vol: 0.26 * k });
    },
    both(t) { SFX.jump(t, { k: 0.82 }); SFX.rope(t, { k: 0.82 }); },
    hold(t) { // 위로 솟는 «휘이익»
      noise(t, { f: 500, f2: 4200, glide: 0.28, q: 1.6, dur: 0.32, a: 0.05, hold: 0.1, vol: 0.2 });
      tone(t, { type: 'triangle', f: 260, f2: 780, glide: 0.28, dur: 0.3, a: 0.01, hold: 0.12, vol: 0.12 });
      tone(t, { wave: W.p125, f: 520, f2: 1560, glide: 0.28, dur: 0.26, a: 0.01, hold: 0.08, vol: 0.035 });
    },
    perfect(t) { // 반짝
      bell(t, 2093, 0.16, 0.12);
      bell(t + 0.035, 3136, 0.2, 0.09);
      noise(t, { type: 'highpass', f: 9000, dur: 0.06, a: 0.002, vol: 0.035 });
    },
    great(t) { bell(t, 1568, 0.12, 0.1); bell(t + 0.03, 2349, 0.08, 0.045); },
    good(t) { tone(t, { type: 'triangle', f: 1175, dur: 0.07, a: 0.002, vol: 0.07 }); },
    miss(t) { // 둔탁 «퍽»
      tone(t, { type: 'triangle', f: 150, f2: 88, dur: 0.13, a: 0.002, vol: 0.25 });
      noise(t, { type: 'lowpass', f: 420, dur: 0.09, a: 0.002, vol: 0.2 });
      tone(t, { wave: W.p50, f: 104, f2: 92, dur: 0.09, a: 0.002, vol: 0.045 });
    },
    trip(t) { // 줄에 걸려 «차르륵» → 넘어지며 «쿵»
      for (let i = 0; i < 3; i++) noise(t + i * 0.035, { f: 2400 - i * 400, q: 2, dur: 0.02, a: 0.001, vol: 0.18 });
      tone(t, { wave: W.p25, f: 520, f2: 130, glide: 0.32, dur: 0.36, a: 0.005, hold: 0.1, vol: 0.07 });
      tone(t + 0.18, { f: 120, f2: 40, glide: 0.18, dur: 0.26, a: 0.002, vol: 0.6 });
      noise(t + 0.18, { type: 'lowpass', f: 600, f2: 150, dur: 0.26, a: 0.003, vol: 0.34 });
    },
    combo(t, o) { // 상승 아르페지오 — 콤보가 클수록 높게 시작
      const k = Math.max(1, Math.floor((o.n || 10) / 10));
      const base = 72 + Math.min(10, (k - 1) * 2);
      [0, 4, 7, 12].forEach((iv, i) => tone(t + i * 0.035, { wave: W.p25, f: hz(base + iv), dur: 0.06, a: 0.002, hold: 0.02, vol: 0.15 }));
      bell(t + 0.14, hz(base + 24), 0.22, 0.12);
    },
    fever(t) { // 스윕 + 반짝이 폭포
      const lp = filt('lowpass', 700, 2, t);
      lp.frequency.exponentialRampToValueAtTime(6500, t + 0.45);
      const g = gainOf(1, sfxBus); lp.connect(g);
      tone(t, { wave: W.p25, f: 220, f2: 1760, glide: 0.45, dur: 0.5, a: 0.01, hold: 0.3, vol: 0.2, out: lp });
      tone(t, { wave: W.p25, f: 330, f2: 2640, glide: 0.45, dur: 0.5, a: 0.01, hold: 0.3, vol: 0.1, out: lp });
      setTimeout(() => { off(lp); off(g); }, 1200);
      noise(t, { type: 'highpass', f: 1500, f2: 9000, glide: 0.45, dur: 0.5, a: 0.3, vol: 0.06 });
      [2093, 2637, 3136, 4186].forEach((f, i) => bell(t + 0.4 + i * 0.05, f, 0.3, 0.09));
    },
    tech(t) { // 짧은 팡파레 «빠빠밤!»
      [784, 1047, 1319].forEach((f, i) => tone(t + i * 0.06, { wave: W.p25, f, dur: 0.07, a: 0.003, hold: 0.03, vol: 0.09 }));
      [1047, 1319, 1568].forEach((f) => tone(t + 0.18, { wave: W.p25, f, dur: 0.3, a: 0.005, hold: 0.12, vol: 0.06 }));
      noise(t + 0.18, { f: 1800, q: 0.8, dur: 0.12, a: 0.001, vol: 0.14 });
      bell(t + 0.2, 2637, 0.3, 0.05);
    },
    count(t, o) { // 카운트 — 마지막(1)은 한 옥타브 위
      const last = (o.n || 1) <= 1;
      tone(t, { wave: W.p25, f: last ? 1760 : 880, dur: 0.09, a: 0.002, hold: 0.03, vol: 0.17, out: o.out });
      noise(t, { type: 'highpass', f: 5000, dur: 0.012, a: 0.0005, vol: 0.16, out: o.out });
    },
    go(t) {
      [1047, 1319, 1568].forEach((f) => tone(t, { wave: W.p25, f, dur: 0.3, a: 0.003, hold: 0.1, vol: 0.07 }));
      tone(t, { f: 160, f2: 50, dur: 0.18, a: 0.001, vol: 0.32 });
      noise(t, { type: 'highpass', f: 4500, dur: 0.45, a: 0.002, vol: 0.08 });
    },
    clear(t) { // 승리 팡파레 (오리지널)
      const L = [[67, 0, 0.09], [72, 0.1, 0.09], [76, 0.2, 0.09], [79, 0.3, 0.2], [76, 0.52, 0.09], [79, 0.62, 0.09], [84, 0.74, 0.7]];
      L.forEach(([m, s, d]) => tone(t + s, { wave: W.p25, f: hz(m), dur: d + 0.04, a: 0.003, hold: d * 0.6, vol: 0.1 }));
      [[64, 0.3, 0.2], [67, 0.74, 0.7], [76, 0.74, 0.7]].forEach(([m, s, d]) => tone(t + s, { wave: W.p125, f: hz(m), dur: d + 0.04, a: 0.004, hold: d * 0.6, vol: 0.06 }));
      [[48, 0, 0.28], [55, 0.3, 0.2], [48, 0.74, 0.7]].forEach(([m, s, d]) => tone(t + s, { type: 'triangle', f: hz(m), dur: d, a: 0.003, hold: d * 0.5, vol: 0.3 }));
      [0.52, 0.57, 0.62, 0.67].forEach((s, i) => noise(t + s, { f: 1800, q: 0.8, dur: 0.1, a: 0.001, vol: 0.08 + i * 0.03 }));
      noise(t + 0.74, { type: 'highpass', f: 4500, dur: 1.1, a: 0.002, vol: 0.09 });
      [2093, 2637, 3136, 4186].forEach((f, i) => bell(t + 0.85 + i * 0.06, f, 0.4, 0.05));
    },
    fail(t) { // 내려앉는 네 음 + 길게 처지는 끝음
      [[76, 0], [75, 0.17], [74, 0.34], [73, 0.51]].forEach(([m, s]) => tone(t + s, { type: 'triangle', f: hz(m), dur: 0.16, a: 0.006, hold: 0.06, vol: 0.18 }));
      tone(t + 0.7, { type: 'triangle', f: hz(72), f2: hz(70), glide: 0.6, dur: 0.7, a: 0.01, hold: 0.3, vol: 0.18 });
      tone(t + 0.7, { f: 90, f2: 50, dur: 0.3, a: 0.003, vol: 0.4 });
    },
    ui(t) {
      tone(t, { wave: W.p50, f: 1200, dur: 0.025, a: 0.0008, vol: 0.07 });
      noise(t, { type: 'highpass', f: 4000, dur: 0.008, a: 0.0004, vol: 0.06 });
    },
    click(t, o) { // 메트로놈 — 첫 박만 높게. 발음이 짧고 날카로워야 귀가 박을 정확히 짚는다
      const acc = !!o.acc;
      tone(t, { wave: W.p50, f: acc ? 1760 : 1320, dur: 0.035, a: 0.0005, vol: 0.12, out: o.out });
      noise(t, { type: 'highpass', f: 5000, dur: 0.01, a: 0.0004, vol: 0.14, out: o.out });
      tone(t, { f: KICK_F0 + 10, f2: 60, dur: 0.08, a: 0.001, vol: 0.3, out: o.out });
    },
  };

  /* ---------- 바깥 API ---------- */
  const lat = () => (ctx ? ctx.outputLatency || ctx.baseLatency || 0 : 0);

  const api = {
    get ctx() { return ctx; },

    /** 사용자 제스처 안에서. 여러 번 불러도 된다(만들기 · 깨우기) */
    init() {
      try {
        if (ctx && ctx.state === 'closed') ctx = null;
        if (!ctx && !build()) return false;
        if (ctx.state !== 'running' && !paused) quiet(ctx.resume());
        return true;
      } catch (e) { return false; } // 소리 없이도 게임은 돈다
    },

    /** 곡 고르기 — 시간표는 채보와 같은 buildSteps(tempo, bars). 무한은 ENDLESS.tempoUntil(bars) 를 넘긴다 */
    prepare(songId, o = {}) {
      api.stop();
      plan = planSong(SONG_IDS.includes(songId) ? songId : 'training', o);
      return { steps: plan.steps, duration: plan.duration };
    },

    /**
     * 곡 시작. 리드인 동안 첫 bpm 으로 4박 카운트, 돌려주는 T0 = 곡 0칸이 울리는 ctx 시각.
     * 첫 bpm 이 느려 4박이 leadIn 에 안 들어가면(예: 92bpm 은 2.6초) T0 가 그만큼 뒤로 간다.
     */
    start(leadIn = 1.6) {
      if (!ctx) api.init();
      if (!ctx) return 0;
      if (!plan) api.prepare('training');
      if (cur) { killBus(cur); cur = null; }
      if (paused) { paused = false; quiet(ctx.resume()); }
      const beat = 60 / bpmAt(plan.tempo, 0);
      T0 = ctx.currentTime + Math.max(leadIn, 4 * beat + 0.05);
      cur = newBus();
      if (enabled) for (let k = 4; k >= 1; k--) SFX.count(T0 - k * beat, { n: k, out: cur.cnt });
      nextStep = 0;
      lastStep = plan.endless ? Infinity : plan.n;
      playing = true;
      startTimer();
      tick();
      return T0;
    },

    stop() {
      playing = false;
      stopTimer();
      if (cur) { killBus(cur); cur = null; }
      if (paused && ctx) { paused = false; quiet(ctx.resume()); } // 멈춘 채 나가면 단추 소리도 안 난다
    },

    /** 일시정지 = ctx.suspend → 곡 시계도 같이 멈춘다 (이미 예약된 음도 그 자리에서 기다린다) */
    pause() {
      if (!ctx || paused) return quiet(Promise.resolve());
      paused = true;
      return quiet(ctx.suspend());
    },
    resume() {
      if (!ctx) return quiet(Promise.resolve());
      paused = false;
      const p = quiet(ctx.resume());
      tick();
      return p;
    },

    /** 지금 «들리는» 곡 시각(초) — 리드인 동안은 음수 */
    songTime() { return ctx ? ctx.currentTime - T0 - lat() : 0; },

    /** performance.now() 기준 입력 시각(ms) → 그 순간 들리던 곡 시각(초) */
    eventSongTime(perfMs) {
      if (!ctx) return 0;
      const nowP = typeof performance !== 'undefined' ? performance.now() : perfMs;
      const fb = ctx.currentTime - lat() - T0 - (nowP - perfMs) / 1000;
      try {
        const ts = ctx.getOutputTimestamp ? ctx.getOutputTimestamp() : null;
        if (ts && ts.performanceTime > 0 && ts.contextTime > 0 && ctx.state === 'running') {
          // contextTime = performanceTime 순간 스피커로 나가던 표본의 ctx 시각
          const v = ts.contextTime + (perfMs - ts.performanceTime) / 1000 - T0;
          if (Number.isFinite(v) && Math.abs(v - fb) < 0.2) return v; // 값이 이상한 브라우저는 대체 식
        }
      } catch (e) { /* 대체 식 */ }
      return fb;
    },

    /** 누르는 즉시 효과음. opt.at 을 주면 그 ctx 시각에 */
    hit(name, opt = {}) {
      try {
        if (!ctx || !enabled || paused || sfxVol <= 0.001) return; // 멈춘 시계에 쌓였다가 재개할 때 한꺼번에 터지지 않게
        let key = String(name || ''), o = opt || {};
        const r = /^([a-z]+)(\d+)$/.exec(key); // 'combo30' · 'count3' 도 받는다
        if (r && !SFX[key]) { key = r[1]; o = Object.assign({ n: Number(r[2]) }, o); }
        const fn = SFX[key];
        if (!fn || key === 'click') return;
        if (ctx.state !== 'running') quiet(ctx.resume());
        const now = ctx.currentTime;
        if (o.at == null && lastHit[key] != null && now - lastHit[key] < 0.012 && now >= lastHit[key]) return; // 같은 소리 겹침(터치+마우스) 방지
        lastHit[key] = now;
        fn(o.at != null ? o.at : now + 0.002, o);
      } catch (e) { /* 소리는 절대 게임을 멈추지 않는다 */ }
    },

    setFever(on) {
      fever = !!on;
      if (ctx && cur) { const t = ctx.currentTime; cur.fev.gain.cancelScheduledValues(t); cur.fev.gain.setTargetAtTime(fever ? 1 : 0.0001, t, 0.04); }
    },
    setMusicVolume(v) {
      musicVol = Math.max(0, Math.min(1, Number(v) || 0));
      if (ctx) musicBus.gain.setTargetAtTime(MUSIC_BASE * musicVol, ctx.currentTime, 0.02);
    },
    setSfxVolume(v) {
      sfxVol = Math.max(0, Math.min(1, Number(v) || 0));
      if (ctx) sfxBus.gain.setTargetAtTime(SFX_BASE * sfxVol, ctx.currentTime, 0.02);
    },
    /** 소리 전체 켜기/끄기 — 꺼도 곡 시계는 그대로 간다(판정은 계속) */
    setEnabled(on) {
      enabled = !!on;
      if (ctx) master.gain.setTargetAtTime(enabled ? MASTER : 0, ctx.currentTime, 0.02);
    },

    /**
     * 타이밍 맞추기: T0 부터 bpm 클릭 beats 번. 곡은 멈추고, 곡 시계 기준을 첫 클릭으로 옮긴다 —
     * eventSongTime(입력) 이 «첫 클릭으로부터 초» 가 되니 i·60/bpm 과 바로 빼면 어긋남이다.
     */
    metronome(bpm = 120, beats = 8) {
      if (!ctx) api.init();
      if (!ctx) return 0;
      api.stop();
      const b = 60 / Math.max(30, Math.min(300, Number(bpm) || 120));
      T0 = ctx.currentTime + Math.max(0.4, b);
      cur = newBus();
      if (enabled) for (let i = 0; i < Math.max(0, beats | 0); i++) SFX.click(T0 + i * b, { acc: i % 4 === 0, out: cur.cnt });
      return T0;
    },

    close() {
      api.stop();
      try { if (ctx) { off(master); off(comp); off(musicBus); off(sfxBus); quiet(ctx.close()); } } catch (e) { /* 무시 */ }
      ctx = comp = master = musicBus = sfxBus = nbuf = null;
      plan = null; paused = false;
    },
  };
  return api;
}
