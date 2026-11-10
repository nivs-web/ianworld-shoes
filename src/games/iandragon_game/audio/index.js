/**
 * 좀비와 드래곤 (옛 이름 이안 드래곤) — 소리 (효과음 · 곡 · 음성). **겜팀장 담당 폴더** (팀 계획서 2.2).
 * 게임 코드는 아래 함수만 부른다 : init() · play(id) · bgm(id, {rate}) · worldBgm(world, {rate}) · stopBgm() · voice(id) ·
 *   fun(id) · setFun(on) · setMuted(on)
 * - 효과음 · 곡: 파형 합성(파일 없음). 음성: 보이스 스튜디오로 만든 한국어 파일(이 게임만 예외, 2026-11-10 대표님).
 * - 없는 id 는 조용히 무시한다. 같은 효과음은 0.05초 안에 한 번만. 소리는 화면 전용 — 전투 계산에 영향 없음.
 * - fun(id) = 배경 재미 요소 작은 소리 (FUN_SFX · 기본 꺼 둠 — 대표님이 고른 뒤 setFun(true)).
 */
import { audio } from './synth.js';
import { SFX, playFun, setFunSfx } from './sfx.js';
import { startTrack, stopTrack, trackForWorld } from './music.js';
import { playVoice, preloadVoices } from './voice.js';

let muted = false;
const lastAt = new Map();

/** 첫 터치 뒤에 불러 소리 장치를 깨운다 (브라우저 자동재생 규칙) */
export function init() {
  const A = audio(); if (!A) return;
  if (A.ctx.state === 'suspended') A.ctx.resume().catch(() => {});
  preloadVoices();
}

export function play(id) {
  if (muted) return;
  const f = SFX[id]; if (!f) return;
  const A = audio(); if (!A) return;
  const now = A.ctx.currentTime;
  if (now - (lastAt.get(id) ?? -1) < 0.05) return;
  lastAt.set(id, now);
  try { f(); } catch { /* 소리 실패는 게임과 무관 */ }
}

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
