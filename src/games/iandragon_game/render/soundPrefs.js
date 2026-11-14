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
import { ORIENTS, lobbyOrientPref, setLobbyOrientPref, GAME_ORIENT, LOBBY_FORCE_LAND } from './rot.js';
import { el, toast } from '../../../screens/ui.js';
import { kitRow, kitSlider, kitToggle, kitTabs } from '../../../screens/idgKit.js';   /* UI 키트 (11/12) */

/*
 * 배경음악 풍 (대표님 11/11 «클래식 · EDM 중 고르게 · 기본은 클래식 · 관리자 페이지에서 기본 음악을 정하게»)
 *  아이 선택(기기 저장) → 없으면 운영자 기본값(관리자 «기본 배경음악 EDM» 스위치 · 처음 꺼짐 = 클래식)
 *  운영자 «오케스트라 풍» 스위치가 꺼져 있으면(오락실 시험) 모두 오락실
 */
const STYLE_KEY = 'idgBgmStyle';
export const bgmPick = () => { let v = null; try { v = localStorage.getItem(STYLE_KEY); } catch { /* */ } return v === 'edm' || v === 'orchestra' ? v : 'orchestra'; };
/** 실제로 쓸 풍 : 운영자 오락실 시험 > 아이 선택 > 운영자 기본값 */
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
export function soundPanel(h, onChange = () => {}, opt = {}) {   /* opt.screen === false = 화면 방향 줄을 뺀다 (로비 «설정 → 음향» 탭 · 화면 방향은 «화면» 탭 · 11/13) */
  /* UI 키트로 통일 (11/12 대표님 «설정 토글 · 슬라이더 · 탭까지 전부 같은 모양» · docs/IDG_DESIGN_STYLESHEET.md 8장)
   *  한 줄 = [이름] ……… [키트 탭 · 슬라이더 · 토글]. 전투 일시정지에서도 쓰므로 판 자체가 .idg-k 뿌리. h 는 옛 호출과 맞추려고 받기만 한다. */
  void h;
  const wrap = el('div.idg-sound.idg-k');
  const row = (title, right, cls = '') => { const r = kitRow({ title, right }); r.classList.add('idg-sound-row2'); if (cls) r.classList.add(cls); return r; };
  /* 막대 0~100 (놓으면 시험 소리) */
  const slider = (label, kind, test) => {
    const v0 = Math.round(Audio.getVolumes()[kind] * 100), val = el('b.idg-sound-val', String(v0));
    const sl = kitSlider({ value: v0, min: 0, max: 100, step: 5, label, onInput: (v) => { Audio.setVolume(kind, v / 100); val.textContent = String(v); }, onChange: () => { if (!isMuted()) test(); } });
    return row(label, [sl, val], 'sl');
  };
  /* 켜짐 / 꺼짐 = 키트 토글 */
  const toggle = (label, get, set) => row(label, kitToggle({ on: get(), label, onChange: (on) => set(on) }));
  /* 배경음악 풍 (대표님 «클래식, EDM 중 고르는 걸로») */
  const styleTabs = kitTabs({ label: '배경음악', tabs: [{ id: 'orchestra', label: '클래식' }, { id: 'edm', label: 'EDM' }], value: bgmPick(), onPick: (v) => { setBgmPick(v); onChange({ style: v }); } });
  /* 화면 방향 = 로비화면 · 게임화면 두 줄 (11/12 대표님 · rot.js)
   *  로비화면 : 기본 세로 · 자동 · 가로 고를 수 있음 / 게임화면 : 지금은 가로만 — «자동» · «세로» 는 흐린 잠금 모양, 누르면 안내만 */
  /** 화면 방향 두 줄 (일시정지 판 = 그대로 · 로비 설정은 «화면» 탭이 따로 만든다) */
  const screenRows = () => {
    const lobbyTabs = kitTabs({ label: '로비화면 방향', tabs: ORIENTS.map(({ v, label }) => ({ id: v, label })), value: lobbyOrientPref(),
      onPick: (v) => { if (!LOBBY_FORCE_LAND) return setLobbyOrientPref(v); if (v !== 'land') { lobbyTabs.set('land'); toast('지금은 가로만 할 수 있어요', 1800); } } });
    if (LOBBY_FORCE_LAND) lobbyTabs.querySelectorAll('.idg-k-tab').forEach((b) => { if (b.dataset.id !== 'land') { b.classList.add('locked'); b.setAttribute('aria-disabled', 'true'); b.title = '지금은 가로만 할 수 있어요'; } });
    const gameTabs = kitTabs({ label: '게임화면 방향', tabs: ORIENTS.map(({ v, label }) => ({ id: v, label })), value: GAME_ORIENT,
      onPick: (v) => { if (v !== GAME_ORIENT) { gameTabs.set(GAME_ORIENT); toast('지금은 가로만 할 수 있어요', 1800); } } });
    gameTabs.querySelectorAll('.idg-k-tab').forEach((b) => { if (b.dataset.id !== GAME_ORIENT) { b.classList.add('locked'); b.setAttribute('aria-disabled', 'true'); b.title = '지금은 가로만 할 수 있어요'; } });
    return [row('로비화면', lobbyTabs, 'pick'), row('게임화면', gameTabs, 'pick')];
  };
  /* 목소리 말 많기 0~5 (겜팀장 VOICE_LEVELS · 대표님 «말 많기 6단계») */
  const vlDesc = el('p.idg-sound-desc.idg-k-t4');
  const descOf = (n) => { const L = Audio.VOICE_LEVELS.find((x) => x.n === n); vlDesc.textContent = L ? `${L.name} — ${L.desc}` : ''; };
  const vlTabs = kitTabs({ label: '말 많기', tabs: Audio.VOICE_LEVELS.map(({ n }) => ({ id: String(n), label: String(n) })), value: String(Audio.getVoiceLevel()),
    onPick: (id) => { const n = Number(id); Audio.setVoiceLevel(n); descOf(n); if (n > 0 && !isMuted()) Audio.voice('name/kkomul'); } });
  descOf(Audio.getVoiceLevel());
  wrap.append(
    row('배경음악', styleTabs, 'pick'), ...(opt.screen === false ? [] : screenRows()), row('말 많기', vlTabs, 'pick'), vlDesc,
    slider('음악 크기', 'music', () => {}),
    slider('효과음', 'sfx', () => Audio.play('star')),
    slider('목소리', 'voice', () => Audio.voice('name/kkomul')),
    toggle('좀비 소리', () => Audio.getVolumes().zombie, (on) => { Audio.setZombieSound(on); if (on) Audio.play('zombie_spawn'); }),
    toggle('전체 소리', () => !isMuted(), (on) => { setMuteAll(!on); onChange({ mute: !on }); }),
  );
  return wrap;
}
