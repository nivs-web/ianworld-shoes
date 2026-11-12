/**
 * 좀비와 드래곤 (옛 이름 이안 드래곤) — 소리 (효과음 · 곡 · 음성). **겜팀장 담당 폴더** (팀 계획서 2.2).
 * 게임 코드는 아래 함수만 부른다 : init() · play(id) · bgm(id, {rate}) · worldBgm(world, {rate}) · stopBgm() · voice(id) ·
 *   fun(id) · setFun(on) · setBgmStyle('orchestra' | 'arcade') · bgmStyle() · setMuted(on) ·
 *   음향 설정: setVolume('music' | 'sfx' | 'voice', 0~1) · getVolumes() · setZombieSound(on)
 *   말 많기: setVoiceLevel(0~5) · getVoiceLevel() · voiceLevelStats() · VOICE_LEVELS (관리자 페이지 · 음향 설정 창)
 * - 효과음 · 곡: 파형 합성(파일 없음). 음성: 보이스 스튜디오로 만든 한국어 파일(이 게임만 예외, 2026-11-10 대표님).
 * - 없는 id 는 조용히 무시한다. 같은 효과음은 0.05초 안에 한 번만. 소리는 화면 전용 — 전투 계산에 영향 없음.
 * - fun(id) = 배경 재미 요소 작은 소리 (FUN_SFX · 기본 꺼 둠 — 대표님이 고른 뒤 setFun(true)).
 */
import { audio } from './synth.js';
import { SFX, playFun, setFunSfx } from './sfx.js';
import { startTrack, stopTrack, trackForWorld, preloadMusic, setMusicStyle, getMusicStyle } from './music.js';
import { playVoice, preloadVoices, setVoiceLevel as setVL, getVoiceLevel, voiceLevelStats, hasUserVoiceLevel } from './voice.js';
import { preloadSfxFiles, hasFileSfx, playFileSfx } from './sfxfile.js';

let muted = false;
const lastAt = new Map();
const recent = [];
let lastZombie = -1;

/* ───── 음향 설정 (2026-11-11 대표님: «더보기 → 음향 설정» — 배경음악 · 효과음 · 목소리 크기 · 좀비 소리) ─────
 * 기기에 저장(localStorage) · 서버 저장 없음. 0~1. 버스 기본 크기(synth.js)에 곱한다. */
const VOL_KEY = 'idg_audio_v1';
/* 11/11 저녁 대표님 «소리가 전체적으로 넘 시끄럽고 귀가 아파서 주변 사람들이 다 끄고 한다» → 전부 낮춤
 * (배경음악 0.37→0.30 · 효과음 0.55→0.40 · 목소리 0.95→0.80. 배경음악:효과음 비율은 +15% 때 그대로) */
const BASE = { music: 0.30, sfx: 0.40, voice: 0.80 };
const vol = { music: 1, sfx: 1, voice: 1, zombie: true };   /* 처음 기본 = 모두 100 (대표님 11/11 밤 · 줄이는 건 자유) */
try { Object.assign(vol, JSON.parse(localStorage.getItem(VOL_KEY) || '{}')); } catch { /* 저장소가 없어도 기본값으로 */ }
const saveVol = () => { try { localStorage.setItem(VOL_KEY, JSON.stringify(vol)); } catch { /* */ } };
function applyVol() {
  const A = audio(); if (!A) return;
  const t = A.ctx.currentTime;
  A.musicBus.gain.setTargetAtTime(BASE.music * vol.music, t, 0.05);
  A.sfxBus.gain.setTargetAtTime(BASE.sfx * vol.sfx, t, 0.05);
  A.voiceBus.gain.setTargetAtTime(BASE.voice * vol.voice, t, 0.05);
}
/** 크기 바꾸기 — kind: 'music' | 'sfx' | 'voice', v: 0~1 (바로 들림 · 저장) */
export function setVolume(kind, v) {
  if (!(kind in BASE)) return;
  vol[kind] = Math.max(0, Math.min(1, Number(v) || 0)); saveVol(); applyVol();
}
/** 지금 설정 { music, sfx, voice, zombie } — 음향 설정 창이 처음 그릴 때 */
export const getVolumes = () => ({ ...vol });
/** 좀비 소리 켜기/끄기 (zombie_* 효과음 묶음 전체) */
export function setZombieSound(on) { vol.zombie = !!on; saveVol(); }

/** 첫 터치 뒤에 불러 소리 장치를 깨운다 (브라우저 자동재생 규칙) */
export function init() {
  const A = audio(); if (!A) return;
  if (A.ctx.state === 'suspended') A.ctx.resume().catch(() => {});
  applyVol();
  preloadVoices();   /* 시작 멘트만 — 용 이름은 전투 시작 때 덱만 (preloadBattleVoices) */
  preloadMusic(['lobby']).catch(() => {});   /* 로비 곡만 (예전엔 로비 · 월드1 · 보스 · 승리 2.8MB 를 한꺼번에 받아 첫 화면이 느렸다 — 11/11 밤) */
  /* 좀비 소리 파일(29개 · 약 0.3MB)은 로비에서 받지 않는다 — 전투 화면이 뜰 때 preloadSfx() (battleView) · 11/12 속도 */
}

/** 좀비 소리 같은 파일 효과음을 받아 둔다 (한 번만 · 전투 화면이 그림을 다 받은 뒤 부른다) */
let sfxP = null;
export function preloadSfx() { if (!audio()) return Promise.resolve(); return (sfxP ||= preloadSfxFiles().catch(() => { sfxP = null; })); }

/** 효과음 — 합성(SFX) 또는 파일 묶음(zombie_spawn · zombie_idle · zombie_die · zombie_big · zombie_ghost) */
export function play(id) {
  if (muted) return;
  if (!vol.zombie && id.startsWith('zombie_')) return;
  const f = SFX[id], file = !f && hasFileSfx(id);
  if (!f && !file) { if (id.startsWith('zombie_')) preloadSfx(); return; }   // 목록을 아직 안 받았으면 지금 받기 시작 (다음 소리부터 난다)
  const A = audio(); if (!A) return;
  const now = A.ctx.currentTime;
  if (now - (lastAt.get(id) ?? -1) < (file ? 0.6 : 0.05)) return;          // 좀비 소리는 같은 종류 0.6초에 한 번
  if (file && now - lastZombie < 0.25) return;                          // 좀비 소리끼리도 0.25초 간격
  while (recent.length && now - recent[0] > 0.5) recent.shift();
  if (recent.length >= 6) return;                                       // 0.5초에 효과음 6개까지 (떼로 몰려도 귀 안 아프게)
  recent.push(now); lastAt.set(id, now); if (file) lastZombie = now;
  try { if (f) f(); else playFileSfx(id, FILE_VOL[id] ?? 0.8); } catch { /* 소리 실패는 게임과 무관 */ }
}
/* 좀비 소리 볼륨 (대표님 11/11 두 번째: «너무 은은하게 말고 일반 소리로» → 여기서 키우고 줄인다) */
const FILE_VOL = { zombie_idle: 0.8, zombie_spawn: 0.8, zombie_die: 0.85, zombie_big: 0.9, zombie_ghost: 0.8 };

export function bgm(id, opt = {}) {
  if (muted) return;
  try { startTrack(id, opt.rate ?? 1); } catch { /* */ }
}
/** 월드 번호로 곡 고르기 (1~5 = 월드 곡, 그 밖 = battleA) */
export function worldBgm(world, opt = {}) { bgm(trackForWorld(world), opt); }
export function stopBgm() { stopTrack(); }

export function fun(id) {
  if (muted) return;
  try { playFun(id); } catch { /* */ }
}
export function setFun(on) { setFunSfx(on); }

export function voice(id) {
  if (muted) return;
  playVoice(id);
}

/* ───── 말 많기 6단계 (11/11 대표님 «관리자 페이지에 음성 메뉴 신설 · 6단계 · 하나씩 실험해 볼게») ───── */
/** 단계 이름 · 설명 — 관리자 페이지 · 음향 설정 창이 그대로 보여 준다 */
export const VOICE_LEVELS = [
  { n: 0, name: '0단계 · 말 없음', desc: '목소리를 아예 안 냅니다. 효과음과 음악만.' },
  { n: 1, name: '1단계 · 이름만', desc: '시작 멘트 한 줄 + 용을 누르면 그 용이 자기 이름을 말해요. (예: «꼬물이!»)' },
  { n: 2, name: '2단계 · 아주 짧게', desc: '이름과 «꼬물이 출격!»을 번갈아 · 시작 · 승패 같은 짧은 해설도 조금. — 기본' },
  { n: 3, name: '3단계 · 중요한 순간', desc: '보스 등장 · 보스 격파 · 브레스 · 부화 때 한 문장.' },
  { n: 4, name: '4단계 · 대부분', desc: '진화 · 포효 · 좀비 떼 경고 · 습격 · 대결 말까지.' },
  { n: 5, name: '5단계 · 전부', desc: '모든 대사 (예전 그대로 · 보스 중간 말까지).' },
];
/** 전투가 시작된 뒤 : 내 덱 용 이름 · 출격 말과 승리 · 보스 곡을 뒤에서 받아 둔다 */
export function preloadBattle(arts = []) { preloadSfx(); preloadVoices(arts.flatMap((a) => [`name/${a}`, `deploy/${a}`])); setTimeout(() => preloadMusic(['win', 'boss']).catch(() => {}), 4000); }
/** 사용자가 고른 단계 (기기에 저장) */
export function setVoiceLevel(n) { setVL(n); }
/** 관리자 기본값 — 사용자가 직접 고른 적이 없을 때만 적용 (저장 안 함) */
export function setDefaultVoiceLevel(n) { if (!hasUserVoiceLevel()) setVL(n, { save: false }); }
export { getVoiceLevel, voiceLevelStats };

export function setMuted(on) {
  muted = !!on;
  const A = audio(); if (!A) return;
  A.master.gain.setTargetAtTime(muted ? 0 : 0.8, A.ctx.currentTime, 0.02);
  if (muted) stopTrack();
}

/** 배경음악 풍 — 'orchestra'(공개 오케스트라 녹음, 기본) · 'edm'(오케스트라 EDM 편곡) · 'arcade'(합성 오락실 풍) */
export function setBgmStyle(s) { try { setMusicStyle(s); } catch { /* */ } }
export const bgmStyle = () => getMusicStyle();
