/**
 * 이안 드래곤 게임 — 한국어 음성 재생 (겜팀장). 파일: public/assets/iandragon_game/voice/<id 의 / 를 _ 로>.ogg (+ .m4a — 아이폰)
 * 음성 목록은 voice-lines.js (대사표). 파일이 아직 없으면 조용히 넘어간다.
 */
import { audio } from './synth.js';
import { VOICE_LINES } from './voice-lines.js';

const BASE = '/assets/iandragon_game/voice/';
const cache = new Map();            // id → AudioBuffer | Promise | null(없음)
let ext = null;
const fileExt = () => {
  if (ext) return ext;
  const a = typeof Audio !== 'undefined' ? new Audio() : null;
  ext = a && a.canPlayType('audio/ogg; codecs="vorbis"') ? 'ogg' : 'm4a';
  return ext;
};

function load(id) {
  if (cache.has(id)) return cache.get(id);
  const A = audio(); if (!A) return null;
  const pr = fetch(`${BASE}${id.replace(/\//g, '_')}.${fileExt()}`)
    .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error('없음'))))
    .then((b) => A.ctx.decodeAudioData(b))
    .then((buf) => { cache.set(id, buf); return buf; })
    .catch(() => { cache.set(id, null); return null; });
  cache.set(id, pr);
  return pr;
}

/** 게임에 들어갈 때 자주 쓰는 대사만 미리 (출격 · 보스 · 승패) */
export function preloadVoices() {
  for (const id of Object.keys(VOICE_LINES)) if (/^(deploy|boss|win|lose|roar|fever)/.test(id)) load(id);
}

let playing = null;
export function playVoice(id) {
  if (!VOICE_LINES[id]) return;
  const A = audio(); if (!A) return;
  const go = (buf) => {
    if (!buf) return;
    try { playing?.stop(); } catch { /* */ }
    const s = A.ctx.createBufferSource(); s.buffer = buf; s.connect(A.voiceBus); s.start();
    playing = s; s.onended = () => { if (playing === s) playing = null; };
  };
  const c = load(id);
  if (c instanceof Promise) c.then(go); else go(c);
}
