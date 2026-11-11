/**
 * 좀비와 드래곤 (옛 이름 이안 드래곤) — 소리 (효과음 · 곡 · 음성). **겜팀장 담당 폴더** (팀 계획서 2.2).
 * 게임 코드는 아래 함수만 부른다 : init() · play(id) · bgm(id, {rate}) · worldBgm(world, {rate}) · stopBgm() · voice(id) ·
 *   fun(id) · setFun(on) · setBgmStyle('orchestra' | 'arcade') · bgmStyle() · setMuted(on) ·
 *   음향 설정: setVolume('music' | 'sfx' | 'voice', 0~1) · getVolumes() · setZombieSound(on)
 * - 효과음 · 곡: 파형 합성(파일 없음). 음성: 보이스 스튜디오로 만든 한국어 파일(이 게임만 예외, 2026-11-10 대표님).
 * - 없는 id 는 조용히 무시한다. 같은 효과음은 0.05초 안에 한 번만. 소리는 화면 전용 — 전투 계산에 영향 없음.
 * - fun(id) = 배경 재미 요소 작은 소리 (FUN_SFX · 기본 꺼 둠 — 대표님이 고른 뒤 setFun(true)).
 */
import { audio } from './synth.js';
import { SFX, playFun, setFunSfx } from './sfx.js';
import { startTrack, stopTrack, trackForWorld, preloadMusic, setMusicStyle, getMusicStyle } from './music.js';
import { playVoice, preloadVoices } from './voice.js';
import { preloadSfxFiles, hasFileSfx, playFileSfx } from './sfxfile.js';

let muted = false;
const lastAt = new Map();

/* ───── 음향 설정 (2026-11-11 대표님: «더보기 → 음향 설정» — 배경음악 · 효과음 · 목소리 크기 · 좀비 소리) ─────
 * 기기에 저장(localStorage) · 서버 저장 없음. 0~1. 버스 기본 크기(synth.js)에 곱한다. */
const VOL_KEY = 'idg_audio_v1';
const BASE = { music: 0.32, sfx: 0.55, voice: 0.95 };
const vol = { music: 0.8, sfx: 0.8, voice: 0.9, zombie: true };
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
  preloadVoices();
  preloadMusic(['lobby', 'w1', 'boss', 'win']).catch(() => {});   // 녹음 곡이 있으면 미리 받기
  preloadSfxFiles().catch(() => {});                                 // 좀비 소리 같은 파일 효과음
}

/** 효과음 — 합성(SFX) 또는 파일 묶음(zombie_spawn · zombie_idle · zombie_die · zombie_big · zombie_ghost) */
export function play(id) {
  if (muted) return;
  if (!vol.zombie && id.startsWith('zombie_')) return;
  const f = SFX[id], file = !f && hasFileSfx(id); if (!f && !file) return;
  const A = audio(); if (!A) return;
  const now = A.ctx.currentTime;
  if (now - (lastAt.get(id) ?? -1) < 0.05) return;
  lastAt.set(id, now);
  try { if (f) f(); else playFileSfx(id, FILE_VOL[id] ?? 0.8); } catch { /* 소리 실패는 게임과 무관 */ }
}
/* 좀비 소리 볼륨 (대표님 11/11 두 번째: «너무 은은하게 말고 일반 소리로» → 여기서 키우고 줄인다) */
const FILE_VOL = { zombie_idle: 1.0, zombie_spawn: 0.95, zombie_die: 1.0, zombie_big: 1.0, zombie_ghost: 0.95 };

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

export function setMuted(on) {
  muted = !!on;
  const A = audio(); if (!A) return;
  A.master.gain.setTargetAtTime(muted ? 0 : 0.8, A.ctx.currentTime, 0.02);
  if (muted) stopTrack();
}

/** 배경음악 풍 — 'orchestra'(공개 오케스트라 녹음, 기본) · 'edm'(오케스트라 EDM 편곡) · 'arcade'(합성 오락실 풍) */
export function setBgmStyle(s) { try { setMusicStyle(s); } catch { /* */ } }
export const bgmStyle = () => getMusicStyle();
