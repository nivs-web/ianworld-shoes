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

/** 게임에 들어갈 때 자주 쓰는 줄만 미리 받는다 (출격 · 보스 · 승패) */
export function preloadVoices() {
  for (const [k, lines] of Object.entries(VOICE_LINES)) if (/^(title|deploy|boss|win|lose|roar|fever)/.test(k)) lines.forEach((_, i) => load(fileName(k, i)));
}

let playing = null;
export function playVoice(id) {
  const key = keyOf(id); if (!key) return;
  const lines = VOICE_LINES[key], A = audio(); if (!A || !lines.length) return;
  let i = Math.floor(Math.random() * lines.length);
  if (lines.length > 1 && i === lastIdx.get(key)) i = (i + 1) % lines.length;
  lastIdx.set(key, i);
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
