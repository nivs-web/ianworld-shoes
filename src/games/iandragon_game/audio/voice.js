/**
 * 좀비와 드래곤 (옛 이름 이안 드래곤) — 한국어 음성 재생 v2 (겜팀장)
 * - 한 id 에 여러 줄: 무작위로 고르되 방금 한 줄은 피한다(반복 지루함 방지).
 * - 출격 deploy/<용>/0 · /1 은 그 용의 줄 전체에서 고른다.
 * - 줄마다 효과음을 겹친다(sfx · at: 'start' = 말과 동시, 'end' = 말 끝에 «뿡!»).
 * 파일: public/assets/iandragon_game/voice/<id 의 / 를 _ 로>_<줄 번호>.ogg (+ .m4a — 아이폰). 없으면 조용히 넘어간다.
 */
import { audio } from './synth.js';
import { SFX } from './sfx.js';
import { VOICE_LINES } from './voice-lines.js';

const BASE = '/assets/iandragon_game/voice/';
const cache = new Map();            // file → AudioBuffer | Promise | null
const lastIdx = new Map();
let ext = null;
const fileExt = () => {
  if (ext) return ext;
  const a = typeof Audio !== 'undefined' ? new Audio() : null;
  ext = a && a.canPlayType('audio/ogg; codecs="opus"') ? 'ogg' : 'm4a';
  return ext;
};
const keyOf = (id) => (VOICE_LINES[id] ? id : VOICE_LINES[id.replace(/\/\d+$/, '')] ? id.replace(/\/\d+$/, '') : null);
export const fileName = (key, i) => `${key.replace(/\//g, '_')}_${i}`;

/* ───── 말 많기 6단계 (2026-11-11 대표님: «너무 시끄러워서 겜하는 사람들이 다 소리 끄고 한다 · 진짜 엄선») ─────
 *  0 = 말 안 함 (효과음 · 음악만)
 *  1 = 가장 짧은 낱말만 (용 이름 «꼬물이!» 같은 한두 마디)
 *  2 = 아주 짧은 문장 (짧은 출격 말 · 짧은 승패 말)
 *  3 = 중요한 순간만 (보스 등장 · 보스 격파 · 브레스 · 부화 · 튜토리얼)
 *  4 = 대부분 (진화 · 포효 · 무리 경고 · 습격 · 대결 …)
 *  5 = 전부 (예전 그대로 · 보스 중간 말까지)
 * 줄마다 단계 = max(종류 단계, 길이 단계). 고른 단계보다 높은 줄은 안 나온다. 낮은 단계일수록 말 사이 쉬는 틈도 길다. */
const CAT = [
  [/^name\//, 1],
  [/^(deploy\/|win$|lose$|title$|start$|tut\/)/, 2],
  [/^(boss\/[^/]+$|bossdown$|breath$|hatch\/|ending$)/, 3],
  [/^(evolve|roar|fever|star3|danger|wave\/|brazier|raid\/|duel\/|coop\/|boss\/[^/]+\/die)/, 4],
];
const catLevel = (key) => { for (const [re, lv] of CAT) if (re.test(key)) return lv; return 5; };
const lenLevel = (text) => { const n = text.replace(/[\s.,!?~…—\-'"]/g, '').length; return n <= 4 ? 1 : n <= 8 ? 2 : n <= 14 ? 3 : n <= 22 ? 4 : 5; };
/* 11/11 밤 대표님 «1단계 = 시작 멘트 «좀비와 드래곤! 지금 시작합니다!» 한 줄 + 용이 자기 이름만 — 랜덤으로 안 하면 안 됨 · 이름은 꼭» :
 * 용 이름(name/*)은 길이와 상관없이 1단계 · 타이틀 중 «지금 시작합니다» 줄도 1단계 */
export const lineLevel = (key, line) => (key.startsWith('name/') ? 1 : key === 'title' && /지금 시작합니다/.test(line.text) ? 1 : Math.max(catLevel(key), lenLevel(line.text)));
const GAP = [0, 4.0, 3.0, 2.0, 1.2, 0];          // 단계별 말 사이 최소 쉬는 틈(초)
const ALWAYS = /^(win|lose|ending|title|name[/].+)$/;      /* 용 이름은 쉬는 틈 무시 — 누를 때마다 꼭 말한다 (겹치면 앞 말을 끊고) */      // 승패 · 엔딩 · 타이틀은 쉬는 틈 무시 (단계는 지킨다)
const LV_KEY = 'idg_voice_level_v1';
let level = 1;                                    // 기본 1단계 (대표님 11/11 밤 · 관리자 페이지에서 바꿈)
try { const v = localStorage.getItem(LV_KEY); if (v !== null && v !== '') level = Math.max(0, Math.min(5, Number(v) | 0)); } catch { /* */ }
let lastSaid = -99;
/** 말 많기 단계 0~5 (기기에 저장). 관리자 기본값만 넣을 땐 setVoiceLevel(n, { save: false }) */
export function setVoiceLevel(n, opt = {}) {
  level = Math.max(0, Math.min(5, Number(n) | 0));
  if (opt.save !== false) { try { localStorage.setItem(LV_KEY, String(level)); } catch { /* */ } }
  if (level === 0) { try { playing?.stop(); } catch { /* */ } }
}
export const getVoiceLevel = () => level;
/** 사용자가 직접 고른 적이 있나 — 없으면 관리자 기본값을 따른다 */
export const hasUserVoiceLevel = () => { try { return localStorage.getItem(LV_KEY) !== null; } catch { return false; } };
/** 단계마다 실제로 나올 수 있는 줄 수 [0단계, 1단계, …, 5단계] — 관리자 페이지 설명용 */
export function voiceLevelStats() {
  const out = [0, 0, 0, 0, 0, 0];
  for (const [k, lines] of Object.entries(VOICE_LINES)) for (const l of lines) for (let lv = lineLevel(k, l); lv <= 5; lv++) out[lv]++;
  return out;
}

function load(file) {
  if (cache.has(file)) return cache.get(file);
  const A = audio(); if (!A) return null;
  const pr = fetch(`${BASE}${file}.${fileExt()}`)
    .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error('없음'))))
    .then((b) => A.ctx.decodeAudioData(b))
    .then((buf) => { cache.set(file, buf); return buf; })
    .catch(() => { cache.set(file, null); return null; });
  cache.set(file, pr);
  return pr;
}

/**
 * 미리 받기 (11/11 밤 «로딩이 엄청 느려졌다» — 예전엔 로비에서 목소리 180개를 한꺼번에 받았다)
 *  keys 를 주면 그 종류만 (전투 시작 때 내 덱 용 이름 · 출격), 안 주면 시작 멘트만.
 */
export function preloadVoices(keys = ['title']) {
  for (const k of keys) { const lines = VOICE_LINES[k]; if (lines) lines.forEach((l, i) => { if (level && lineLevel(k, l) <= level) load(fileName(k, i)); }); }
}

let playing = null;
export function playVoice(id) {
  const key = keyOf(id); if (!key) return;
  const all = VOICE_LINES[key], A = audio(); if (!A || !all.length || level === 0) return;
  const ok = all.map((l, j) => j).filter((j) => lineLevel(key, all[j]) <= level);
  if (!ok.length) return;                                            // 이 단계에선 안 하는 말
  const now = A.ctx.currentTime;
  if (!ALWAYS.test(key) && now - lastSaid < GAP[level]) return;      // 말이 너무 잦으면 건너뜀
  lastSaid = now;
  let i = ok[Math.floor(Math.random() * ok.length)];
  if (ok.length > 1 && i === lastIdx.get(key)) i = ok[(ok.indexOf(i) + 1) % ok.length];
  lastIdx.set(key, i);
  const lines = all;
  const line = lines[i];
  const go = (buf) => {
    if (line.sfx && line.at === 'start') SFX[line.sfx]?.();
    if (!buf) { if (line.sfx && line.at !== 'start') SFX[line.sfx]?.(); return; }   // 파일이 아직 없어도 효과음은 낸다
    try { playing?.stop(); } catch { /* */ }
    const s = A.ctx.createBufferSource(); s.buffer = buf; s.connect(A.voiceBus); s.start();
    playing = s; s.onended = () => { if (playing === s) playing = null; };
    if (line.sfx && line.at !== 'start') setTimeout(() => SFX[line.sfx]?.(), Math.max(0, buf.duration - 0.08) * 1000);
  };
  const c = load(fileName(key, i));
  if (c instanceof Promise) c.then(go); else go(c);
}
