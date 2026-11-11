/**
 * 좀비와 드래곤 소리 설정 (2026-11-11 대표님 «게임 중에도 배경음 · 효과음을 따로 켜고 끄고, 소리 크기도 따로 · 배경음은 10% 더 크게»)
 *
 * - 켜고 끄기는 오락실 공용 설정(audio/audio.js bgmEnabled · sfxEnabled)을 그대로 쓴다 → 로비 · 다른 게임과 같은 스위치.
 * - 크기는 이 게임만 (localStorage 'idgVol' = { m: 배경음 0~1.5, s: 효과음 0~1.5 }).
 * - 겜팀장 소리 엔진(audio/synth.js)의 세 버스 크기만 바꾼다 : 곡 = musicBus · 효과음 = sfxBus · 목소리 = voiceBus(효과음 쪽으로 묶음).
 *   예전엔 효과음을 끄면 setMuted 로 곡까지 꺼졌다 → 이제 버스 크기를 0 으로 해서 따로 끈다.
 */
import { audio } from '../audio/synth.js';
import { getSettings, setEnabled } from '../../../audio/audio.js';

/** 버스 기본 크기 (synth.js 처음 값) · 곡은 대표님 말씀대로 10% 키움 */
const BASE = { music: 0.32 * 1.1, sfx: 0.55, voice: 0.95 };
const KEY = 'idgVol';

function readVol() {
  try { const v = JSON.parse(localStorage.getItem(KEY) || '{}'); return { m: num(v.m), s: num(v.s) }; } catch { return { m: 1, s: 1 }; }
}
const num = (x) => (Number.isFinite(x) ? Math.max(0, Math.min(1.5, x)) : 1);

/** { music: 켜짐?, sfx: 켜짐?, m: 배경음 크기, s: 효과음 크기 } */
export function soundPrefs() {
  const set = getSettings(), v = readVol();
  return { music: set.bgmEnabled !== false, sfx: set.sfxEnabled !== false, m: v.m, s: v.s };
}

/** 지금 설정을 소리 버스에 바로 반영 */
export function applySound() {
  const A = audio(); if (!A) return;
  const p = soundPrefs(), t = A.ctx.currentTime;
  A.musicBus.gain.setTargetAtTime(p.music ? BASE.music * p.m : 0, t, 0.03);
  A.sfxBus.gain.setTargetAtTime(p.sfx ? BASE.sfx * p.s : 0, t, 0.03);
  A.voiceBus.gain.setTargetAtTime(p.sfx ? BASE.voice * p.s : 0, t, 0.03);
}

/** 켜고 끄기 (bus = 'bgm' | 'sfx') */
export function setSoundOn(bus, on) { setEnabled(bus, !!on); applySound(); }

/** 크기 (which = 'm' | 's', 0~1.5) */
export function setSoundVol(which, val) {
  const v = readVol(); v[which] = num(val);
  try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* 저장 못 해도 이번 판엔 적용 */ }
  applySound();
}
