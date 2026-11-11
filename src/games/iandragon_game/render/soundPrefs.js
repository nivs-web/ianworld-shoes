/**
 * 좀비와 드래곤 «음향 설정» (2026-11-11 대표님 — 기획 IAN_DRAGON_MENU_CODEX_PLAN.md 3장)
 *  배경음악 · 효과음 · 목소리 크기(막대 0~100) · 좀비 소리 켜기/끄기 · 전체 소리 끄기
 *
 * - 크기 · 좀비 소리 = 겜팀장 소리 엔진(audio/index.js setVolume · getVolumes · setZombieSound — 기기에 저장)
 * - 전체 끄기 = 이 게임만 (localStorage 'idgMute') → Audio.setMuted
 * - 막대를 움직이면 그 자리에서 바로 들린다 : 효과음 막대는 놓을 때 «띵», 목소리 막대는 놓을 때 짧은 대사 한 줄.
 * 같은 판(soundPanel)을 로비 «더보기 → 음향 설정»과 전투 «일시정지»에서 함께 쓴다.
 */
import * as Audio from '../audio/index.js';
import { isOn } from '../../../services/switches.js';

/* 배경음악 풍 (대표님 11/11 «클래식 오케스트라 / 오케스트라 EDM 중 고르게 · 기본 오케스트라») — 기기 저장 · 운영자 «오락실» 스위치가 꺼져 있으면(=오락실) 그쪽이 우선 */
const STYLE_KEY = 'idgBgmStyle';
export const bgmPick = () => { try { return localStorage.getItem(STYLE_KEY) === 'edm' ? 'edm' : 'orchestra'; } catch { return 'orchestra'; } };
/** 실제로 쓸 풍 : 운영자 오락실 > 아이 선택(오케스트라 / EDM) */
export const bgmStyleNow = () => (isOn('zdBgm', 'orchestra') ? bgmPick() : 'arcade');

const MUTE_KEY = 'idgMute';
const isMuted = () => { try { return localStorage.getItem(MUTE_KEY) === '1'; } catch { return false; } };

/** { mute, music, sfx, voice (0~1), zombie } */
export function soundPrefs() { return { mute: isMuted(), ...Audio.getVolumes() }; }

/** 지금 설정을 소리 장치에 반영 (전투 시작 · 일시정지 풀 때) */
export function applySound() {
  const v = Audio.getVolumes();
  Audio.setMuted(isMuted());
  for (const k of ['music', 'sfx', 'voice']) Audio.setVolume(k, v[k]);
}

export function setBgmPick(v) { try { localStorage.setItem(STYLE_KEY, v === 'edm' ? 'edm' : 'orchestra'); } catch { /* */ } Audio.setBgmStyle(bgmStyleNow()); }

export function setMuteAll(on) { try { localStorage.setItem(MUTE_KEY, on ? '1' : '0'); } catch { /* */ } Audio.setMuted(!!on); }

/**
 * 음향 설정 판 (DOM). h = (tag, cls, text) 만드는 함수 · onChange({ mute }) = 전체 끄기가 바뀌면(곡 다시 틀기 등)
 */
export function soundPanel(h, onChange = () => {}) {
  const wrap = h('div', 'idg-sound');
  const slider = (label, kind, test) => {
    const r = h('div', 'idg-sound-row'), rg = h('input'), val = h('b', 'val');
    rg.type = 'range'; rg.min = '0'; rg.max = '100'; rg.step = '5';
    rg.value = String(Math.round(Audio.getVolumes()[kind] * 100)); val.textContent = rg.value;
    rg.oninput = () => { Audio.setVolume(kind, Number(rg.value) / 100); val.textContent = rg.value; };
    rg.onchange = () => { if (!isMuted()) test(); };
    r.append(h('span', 'lb', label), rg, val); return r;
  };
  const toggle = (label, get, set) => {
    const r = h('div', 'idg-sound-row tg'), b = h('button', 'idg-sound-on'); b.type = 'button';
    const draw = () => { const on = get(); b.textContent = on ? '켜짐' : '꺼짐'; b.classList.toggle('off', !on); };
    b.onclick = () => { set(!get()); draw(); };
    draw(); r.append(h('span', 'lb', label), b); return r;
  };
  /* 배경음악 풍 고르기 (두 칸 단추) */
  const styleRow = h('div', 'idg-sound-row st'), pick = h('div', 'idg-sound-pick');
  const mkPick = (v, label) => { const b = h('button', 'idg-sound-opt', label); b.type = 'button'; b.onclick = () => { setBgmPick(v); drawPick(); onChange({ style: v }); }; return b; };
  const bO = mkPick('orchestra', '클래식\n오케스트라'), bE = mkPick('edm', '오케스트라\nEDM');
  const drawPick = () => { const v = bgmPick(); bO.classList.toggle('on', v === 'orchestra'); bE.classList.toggle('on', v === 'edm'); };
  pick.append(bO, bE); drawPick(); styleRow.append(h('span', 'lb', '음악 풍'), pick);
  wrap.append(
    styleRow,
    slider('배경음악', 'music', () => {}),
    slider('효과음', 'sfx', () => Audio.play('star')),
    slider('목소리', 'voice', () => Audio.voice('name/kkomul')),
    toggle('좀비 소리', () => Audio.getVolumes().zombie, (on) => { Audio.setZombieSound(on); if (on) Audio.play('zombie_spawn'); }),
    toggle('전체 소리', () => !isMuted(), (on) => { setMuteAll(!on); onChange({ mute: !on }); }),
  );
  return wrap;
}
