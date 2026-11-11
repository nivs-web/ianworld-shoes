/**
 * 에셋 갤러리 «소리» 탭 (그림 담당 · 2026-11-11 · 대표님 «관리자 에셋 페이지에서 효과음 · 배경음 · 목소리를 모두 들어 볼 수 있게»)
 * 겜팀장 소리 코드는 import 만 한다 (고치지 않음).
 *  배경음  = /assets/iandragon_game/music/music.json (실행 때 읽음) → <audio>
 *  효과음  = 합성 SFX · FX · 재미 요소 FUN_SFX (sfx.js 그대로 울림) + 파일 효과음 sfx/sfx.json
 *  목소리  = voice-lines.js 의 대사 · 파일 voice/<id 의 / 를 _>_<줄>.m4a|ogg
 */
import { SFX, FX, FUN_SFX } from '../../src/games/iandragon_game/audio/sfx.js';
import { VOICE_LINES, VOICES } from '../../src/games/iandragon_game/audio/voice-lines.js';
import { audio } from '../../src/games/iandragon_game/audio/synth.js';

const BASE = '/assets/iandragon_game/';
const EXT = typeof Audio !== 'undefined' && new Audio().canPlayType('audio/ogg; codecs="opus"') ? 'ogg' : 'm4a';
const MUSIC_NAME = { lobby: '로비', battleA: '전투 A', battleB: '전투 B', boss: '보스', win: '승리', ending: '엔딩' };
const VOICE_GROUP = { deploy: '출격 (용)', boss: '월드 보스', tut: '튜토리얼', wave: '파도 알림', hatch: '부화', raid: '습격 · 대결' };

let player = null;
/** 파일 하나 재생 (다른 소리는 멈춤) */
function playFile(url, btn) {
  player?.pause();
  player = new Audio(url);
  document.querySelectorAll('.snd.on').forEach((b) => b.classList.remove('on'));
  btn?.classList.add('on');
  player.onended = player.onerror = () => btn?.classList.remove('on');
  player.play().catch(() => btn?.classList.remove('on'));
}
/** 합성 소리 (클릭 = 사용자 동작이라 소리 장치를 깨울 수 있다) */
function playSynth(fn) { const A = audio(); A?.ctx.resume?.(); try { fn(); } catch { /* 소리 실패는 무시 */ } }

export async function renderSound(h) {
  const css = h('style', {}, `
    .sndsec{margin:0 0 26px}.sndsec h3{margin:0 0 8px;font-size:17px}.sndsec h4{margin:14px 0 6px;color:var(--acc2);font-size:14px}
    .sndgrid{display:flex;flex-wrap:wrap;gap:6px}
    .snd{background:var(--panel2);color:var(--ink);border:1px solid var(--line);border-radius:8px;padding:6px 10px;font:inherit;font-size:13px;cursor:pointer;text-align:left}
    .snd:hover{border-color:var(--acc)}.snd.on{background:var(--acc);color:#1a1030}
    .snd small{color:var(--dim);margin-left:6px}.snd.on small{color:#1a1030}
    .trk{display:flex;align-items:center;gap:12px;background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:8px 12px;margin:0 0 6px}
    .trk b{min-width:110px}.trk audio{height:32px;flex:1;max-width:520px}
    .vline{display:flex;gap:8px;align-items:baseline;margin:3px 0}.vline .snd{flex:none}.vline span{font-size:14px}.vline em{color:var(--dim);font-size:12px;font-style:normal}`);
  const out = [css, h('div', { class: 'tabhead' }, h('b', {}, '소리'), h('span', { class: 'hint' }, '단추를 누르면 바로 들립니다 · 배경음은 재생 막대로 · 파일 소리는 다른 소리를 누르면 멈춥니다'))];

  /* 배경음 */
  const music = await fetch(BASE + 'music/music.json?v=' + Date.now()).then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
  const trk = Object.entries(music).map(([id, m]) => {
    const name = MUSIC_NAME[id] || (/^w\d+$/.test(id) ? `월드 ${id.slice(1)}` : id);
    const au = h('audio', { controls: true, preload: 'none' }, h('source', { src: `${BASE}music/${m.file || id}.m4a`, type: 'audio/mp4' }), h('source', { src: `${BASE}music/${m.file || id}.ogg`, type: 'audio/ogg' }));
    au.addEventListener('play', () => { player?.pause(); document.querySelectorAll('.trk audio').forEach((a) => a !== au && a.pause()); });
    return h('div', { class: 'trk' }, h('b', {}, name), au, h('small', { class: 'hint' }, `${m.file || id} · ${m.seconds ? Math.round(m.seconds) + '초' : ''}${m.loop ? ' · 반복' : ''}`));
  });
  out.push(h('section', { class: 'sndsec' }, h('h3', {}, `🎵 배경음 (${trk.length})`), trk.length ? trk : h('p', { class: 'hint' }, 'music.json 을 읽지 못했습니다')));

  /* 효과음 */
  const sfxFiles = await fetch(BASE + 'sfx/sfx.json?v=' + Date.now()).then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
  const synthBtns = (obj) => h('div', { class: 'sndgrid' }, Object.entries(obj).map(([id, fn]) => h('button', { class: 'snd', onclick: () => playSynth(() => fn()) }, '▶ ' + id)));
  out.push(h('section', { class: 'sndsec' }, h('h3', {}, `🔊 효과음`),
    h('h4', {}, `게임 효과음 (${Object.keys(SFX).length} · 합성)`), synthBtns(SFX),
    h('h4', {}, `대사와 같이 터지는 소리 (${Object.keys(FX).length} · 합성)`), synthBtns(FX),
    h('h4', {}, `좀비 목소리 같은 파일 효과음 (${Object.values(sfxFiles).reduce((a, b) => a + b, 0)})`),
    h('div', { class: 'sndgrid' }, Object.entries(sfxFiles).flatMap(([id, n]) => Array.from({ length: n }, (_, i) => { const b = h('button', { class: 'snd', onclick: () => playFile(`${BASE}sfx/${id}_${i}.${EXT}`, b) }, `▶ ${id} ${i + 1}`); return b; }))),
    h('h4', {}, `배경 재미 요소 소리 후보 (${Object.keys(FUN_SFX).length}종 × 2 · 게임에서는 꺼 둠)`),
    h('div', { class: 'sndgrid' }, Object.entries(FUN_SFX).flatMap(([id, vs]) => vs.map((fn, i) => h('button', { class: 'snd', onclick: () => playSynth(fn) }, `▶ ${id}`, h('small', {}, i ? 'B' : 'A')))))));

  /* 목소리 */
  const groups = {};
  for (const [id, lines] of Object.entries(VOICE_LINES)) (groups[id.split('/')[0]] ||= []).push([id, lines]);
  const nLines = Object.values(VOICE_LINES).reduce((a, l) => a + l.length, 0);
  out.push(h('section', { class: 'sndsec' }, h('h3', {}, `🗣 목소리 (${nLines}줄)`),
    Object.entries(groups).map(([g, list]) => [h('h4', {}, VOICE_GROUP[g] || g),
      list.map(([id, lines]) => h('div', { style: 'margin:0 0 8px' }, h('div', { class: 'hint' }, id),
        lines.map((L, i) => { const b = h('button', { class: 'snd', onclick: () => playFile(`${BASE}voice/${id.replace(/\//g, '_')}_${i}.${EXT}`, b) }, '▶');
          return h('div', { class: 'vline' }, b, h('span', {}, L.text), h('em', { title: VOICES[L.v] || '' }, `${L.v}${L.sfx ? ' + ' + L.sfx : ''}`)); })))])));
  return out;
}
