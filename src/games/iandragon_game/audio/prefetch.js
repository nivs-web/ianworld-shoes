/**
 * 로비에서 조용히 소리 미리 받기 (겜팀장 · 11/12 대표님 «효과음 · 보이스 · 배경음악 때문에 속도가 느려지지 않았으면»)
 *
 * 로비의 그림 미리 받기(render/prefetch.js)가 **끝난 뒤** 부른다 — 그림이 먼저 대역폭을 쓰게.
 *   prefetchSounds({ world, arts })  world = 다음 판 월드 번호 · arts = 덱 용 id 목록
 * 받는 것 : 그 월드 곡 1곡(0.4~0.66MB · 한 번 받으면 이 접속 동안 다시 안 받음) · 시작 멘트 · 덱 용 이름 · 출격 말(지금 말 많기 단계 줄만) · 좀비 효과음 29개(0.29MB)
 * 곡 · 좀비 효과음은 낮은 우선(music.js · sfxfile.js)으로 받는다. 효과음 대부분은 코드로 합성이라 받을 것이 없다.
 * 소리 장치가 아직 없으면(첫 터치 전) 아무것도 안 하고, 그때는 전투 시작 때(preloadBattle) 받는다.
 */
import { audio } from './synth.js';
import { preloadMusic, trackForWorld } from './music.js';
import { preloadVoices } from './voice.js';
import { preloadSfxFiles } from './sfxfile.js';

const done = new Set();

export function prefetchSounds({ world = 1, arts = [] } = {}) {
  if (!audio()) return;
  const key = `${world}|${arts.join(',')}`;
  if (done.has(key)) return;
  done.add(key);
  preloadMusic([trackForWorld(world)]).catch(() => {});
  preloadVoices(['start', ...arts.flatMap((a) => [`name/${a}`, `deploy/${a}`])]);
  preloadSfxFiles().catch(() => {});
}
