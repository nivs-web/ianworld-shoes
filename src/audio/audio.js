/**
 * 오디오 코어 — AudioContext 싱글턴과 게인 버스.
 *
 * 오디오 파일은 **0개**다. 모든 소리를 Web Audio 파형으로 만든다. (기획서 §9-7)
 *
 * 브라우저는 사용자 제스처 전에는 AudioContext를 재생하지 않는다.
 * 그래서 컨텍스트를 만들어만 두고, 첫 입력에서 unlock() 을 부른다.
 * 게임 로직은 이 파일의 상태를 몰라도 되게 sfx/bgm 쪽에서만 참조한다.
 */

import { AUDIO } from '../config/balance.js';

/** @type {AudioContext|null} */
let ctx = null;
/** @type {GainNode|null} */
let master = null;
/** @type {GainNode|null} */
let bgmBus = null;
/** @type {GainNode|null} */
let sfxBus = null;
let unlocked = false;

const SETTINGS_KEY = 'sf_settings';

const settings = {
  bgmEnabled: true,
  sfxEnabled: true,
};

loadSettings();

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return;
    const s = JSON.parse(raw);
    if (typeof s.bgmEnabled === 'boolean') settings.bgmEnabled = s.bgmEnabled;
    if (typeof s.sfxEnabled === 'boolean') settings.sfxEnabled = s.sfxEnabled;
  } catch {
    /* 저장소가 막혀 있어도 소리는 나야 한다 */
  }
}

function saveSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    const prev = raw ? JSON.parse(raw) : {};
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...prev, ...settings }));
  } catch {
    /* 무시 */
  }
}

/** 컨텍스트를 만든다 (아직 소리는 안 난다). 여러 번 불러도 안전. */
export function initAudio() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = AUDIO.masterVolume;
  master.connect(ctx.destination);

  bgmBus = ctx.createGain();
  bgmBus.gain.value = settings.bgmEnabled ? AUDIO.bgmVolume : 0;
  bgmBus.connect(master);

  sfxBus = ctx.createGain();
  sfxBus.gain.value = settings.sfxEnabled ? AUDIO.sfxVolume : 0;
  sfxBus.connect(master);
  return ctx;
}

/**
 * 사용자 제스처 안에서 호출한다. 이 시점부터 실제로 소리가 난다.
 * @returns {boolean} 이번 호출로 잠금이 풀렸으면 true
 */
export function unlock() {
  initAudio();
  if (!ctx) return false;
  if (ctx.state === 'suspended') ctx.resume();
  const first = !unlocked;
  unlocked = true;
  return first;
}

export function isUnlocked() {
  return unlocked && !!ctx && ctx.state === 'running';
}

/** 소리를 낼 수 있는 상태인지 — 각 재생 함수의 첫 줄 가드 */
export function ready() {
  return isUnlocked();
}

export const audioCtx = () => ctx;
export const now = () => (ctx ? ctx.currentTime : 0);
export const masterOut = () => master;
export const bgmOut = () => bgmBus;
export const sfxOut = () => sfxBus;

export function getSettings() {
  return { ...settings };
}

/** @param {'bgm'|'sfx'} bus */
export function setEnabled(bus, on) {
  if (bus === 'bgm') {
    settings.bgmEnabled = on;
    if (bgmBus) bgmBus.gain.value = on ? AUDIO.bgmVolume : 0;
  } else {
    settings.sfxEnabled = on;
    if (sfxBus) sfxBus.gain.value = on ? AUDIO.sfxVolume : 0;
  }
  saveSettings();
}

/** @param {'bgm'|'sfx'} bus */
export function toggle(bus) {
  const on = bus === 'bgm' ? !settings.bgmEnabled : !settings.sfxEnabled;
  setEnabled(bus, on);
  return on;
}

/** 탭이 백그라운드로 갈 때 — 배터리와 발열을 아낀다 */
export function suspendAudio() {
  if (ctx && ctx.state === 'running') ctx.suspend();
}

export function resumeAudio() {
  if (ctx && unlocked && ctx.state === 'suspended') ctx.resume();
}
