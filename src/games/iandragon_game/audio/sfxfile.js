/**
 * 좀비와 드래곤 — 파일 효과음 (겜팀장 · 2026-11-11). 합성으로 내기 어려운 «목소리 같은» 소리(좀비 으어어 · 꾸엑)를 파일로.
 * public/assets/iandragon_game/sfx/sfx.json = { 묶음 id: 개수 } · 파일 = <묶음>_<번호>.ogg (+ .m4a 아이폰)
 * play('zombie_die') 처럼 묶음 이름으로 부르면 그 안에서 무작위로 고른다(방금 낸 것은 피함). 파일이 없으면 조용히 넘어간다.
 */
import { audio } from './synth.js';

const BASE = '/assets/iandragon_game/sfx/';
let groups = null, counts = null;          // groups = 목록 받는 Promise · counts = 받은 { id: 개수 }
const cache = new Map(), last = new Map();
const ext = () => (typeof Audio !== 'undefined' && new Audio().canPlayType('audio/ogg; codecs="opus"') ? 'ogg' : 'm4a');
const list = () => (groups ??= (typeof fetch === 'function' ? fetch(`${BASE}sfx.json`).then((r) => (r.ok ? r.json() : {})) : Promise.resolve({}))
  .catch(() => ({})).then((L) => (counts = L)));
function load(name) {
  if (!cache.has(name)) {
    const A = audio();
    cache.set(name, fetch(`${BASE}${name}.${ext()}`).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject()))
      .then((b) => A.ctx.decodeAudioData(b)).then((buf) => { cache.set(name, buf); return buf; }).catch(() => { cache.set(name, null); return null; }));
  }
  return cache.get(name);
}

/** 묶음 목록을 받고, 좀비 소리는 미리 받아 둔다 (전투에 자주 나오므로) */
export async function preloadSfxFiles() {
  const L = await list();
  for (const [id, n] of Object.entries(L)) if (id.startsWith('zombie')) for (let i = 0; i < n; i++) load(`${id}_${i}`);
}
/** 파일 묶음이 있는지 (목록을 받은 뒤에만 true — init 에서 preloadSfxFiles 로 받는다) */
export const hasFileSfx = (id) => !!counts?.[id];

/** 묶음에서 무작위로 하나 — 볼륨 vol(기본 0.8) · 높낮이를 조금씩 흔들어 같은 소리도 다르게 */
export function playFileSfx(id, vol = 0.8) {
  const n = counts?.[id]; if (!n) return false;
  let i = Math.floor(Math.random() * n);
  if (n > 1 && i === last.get(id)) i = (i + 1) % n;
  last.set(id, i);
  const go = (buf) => {
    if (!buf) return;
    const A = audio(); if (!A) return;
    const s = A.ctx.createBufferSource(), g = A.ctx.createGain();
    s.buffer = buf; s.playbackRate.value = 0.92 + Math.random() * 0.16; g.gain.value = vol;
    s.connect(g); g.connect(A.sfxBus); s.start();
  };
  const c = load(`${id}_${i}`);
  if (c instanceof Promise) c.then(go); else go(c);
  return true;
}
