/**
 * 좀비와 드래곤 — 좀비 소리 굽기 (겜팀장 · 2026-11-11 대표님: «좀비가 죽는 소리 · 등장하는 소리 · 가끔 내뱉는 소리»)
 *   node tools/idg-zombie-gen.mjs
 * 보이스 스튜디오로 «으어어 · 꾸르륵 · 꾸엑» 같은 소리를 녹음하고 → 좀비 효과(음 내림 · 그르렁 떨림 · 침 튀는 잡음)를 입혀
 * public/assets/iandragon_game/sfx/<묶음>_<번호>.ogg + .m4a 와 sfx.json({ 묶음: 개수 })을 낸다.
 * 아이들 게임이라 무섭기보다 «웃긴 좀비» 쪽. 한 묶음에 여러 벌 → 게임이 무작위로 고른다(같은 소리 반복 X).
 */
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const API = 'http://127.0.0.1:3900';
const FF = process.env.FFMPEG || 'C:/Users/ariancepc/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0.1-full_build/bin/ffmpeg.exe';
const TMP = 'tools/_out/zombie', OUT = 'public/assets/iandragon_game/sfx';
fs.mkdirSync(TMP, { recursive: true }); fs.mkdirSync(OUT, { recursive: true });

const rb = (p, t = 1, f = 'shifted') => `rubberband=pitch=${p}:tempo=${t}:formant=${f}:pitchq=quality`;
const FX = {
  /* 보통 좀비: 조금 낮게 · 목 긁는 떨림 · 살짝 지글 */
  groan: `${rb(0.82, 0.9, 'preserved')},vibrato=f=7:d=0.35,acrusher=bits=11:mix=0.25,bass=g=3,highpass=f=70`,
  /* 쓰러짐: 끝이 축 처지게 더 느리게 */
  die: `${rb(0.86, 0.95, 'preserved')},vibrato=f=9:d=0.3,acrusher=bits=11:mix=0.2,highpass=f=70`,
  /* 덩치 · 골렘: 아주 낮고 울리게 */
  big: `${rb(0.6, 0.9, 'preserved')},vibrato=f=5:d=0.25,bass=g=8,aecho=0.8:0.7:70:0.3,acompressor=threshold=-16dB:ratio=4`,
  /* 유령: 떨리는 메아리 */
  ghost: `${rb(1.1, 0.9, 'preserved')},vibrato=f=5:d=0.5,aecho=0.8:0.85:200|400:0.45|0.3,highpass=f=180`,
};
/* 목소리: st = Supertonic 기본 목소리 · vx = VoxCPM2 설명 */
const ZV = { st: ['M1', 'M3', 'M5', 'F5'], vx: 'A silly cartoon zombie, slow groaning raspy voice' };
const SETS = {
  zombie_spawn: { fx: 'groan', lines: ['으어어어어…', '우어어어!', '끄어어어…', '어버버버버…', '배고파아아…', '으어? 으어어!'] },
  zombie_idle: { fx: 'groan', lines: ['꾸르르륵…', '어어… 어어…', '흐으으음…', '냠냠… 쩝쩝…', '으으… 졸려…', '끄르륵 꺽!'] },
  zombie_die: { fx: 'die', lines: ['꾸엑!', '으억… 털썩!', '끼야아앙…', '뿌엑!', '으어… 어… 어…', '꽥!'] },
  zombie_big: { fx: 'big', lines: ['우오오오오…', '크어어엉!', '쿠워어어…'] },
  zombie_ghost: { fx: 'ghost', lines: ['우우우우우~', '후우우우…', '부우우우~'] },
};

async function gen(dst, text, p) {
  if (fs.existsSync(dst)) return true;
  const fd = new FormData(); fd.set('text', text); fd.set('language', 'Korean');
  for (const [k, v] of Object.entries(p)) fd.set(k, String(v));
  const r = await fetch(`${API}/generate`, { method: 'POST', body: fd }).catch(() => null);
  if (!r?.ok) { console.log('  생성 실패', text, r?.status); return false; }
  const b = Buffer.from(await r.arrayBuffer()); if (b.length < 4000) return false;
  fs.writeFileSync(dst, b); return true;
}
const ff = (args) => execFileSync(FF, ['-y', '-loglevel', 'error', ...args]);

const counts = {};
for (const [set, { fx, lines }] of Object.entries(SETS)) {
  let n = 0;
  for (let i = 0; i < lines.length; i++) {
    /* 줄마다 Supertonic 하나(돌아가며 다른 목소리) + 반은 VoxCPM2 도 하나 → 묶음 안에서 목소리가 섞인다 */
    const takes = [{ id: 'st', p: { engine: 'supertonic3', preset_voice: ZV.st[i % ZV.st.length], speed: 0.85 } }];
    if (i % 2 === 0) takes.push({ id: 'vx', p: { engine: 'voxcpm2', instruct: ZV.vx, seed: 1 + i } });
    for (const t of takes) {
      const raw = `${TMP}/${set}_${i}.${t.id}.wav`;
      if (!(await gen(raw, lines[i], t.p))) continue;
      const fxw = raw.replace(/\.wav$/, '.fx.wav');
      ff(['-i', raw, '-af', `${FX[fx]},silenceremove=start_periods=1:start_threshold=-42dB:stop_periods=-1:stop_threshold=-42dB:stop_duration=0.2,afade=t=out:st=1.6:d=0.2,atrim=0:1.8,loudnorm=I=-18:TP=-2`, '-ar', '48000', '-ac', '1', fxw]);
      const name = `${set}_${n}`;
      ff(['-i', fxw, '-c:a', 'libopus', '-b:a', '48k', `${OUT}/${name}.ogg`]);
      ff(['-i', fxw, '-c:a', 'aac', '-b:a', '64k', `${OUT}/${name}.m4a`]);
      console.log('✓', name, t.id, lines[i]); n++;
    }
  }
  counts[set] = n;
}
fs.writeFileSync(`${OUT}/sfx.json`, JSON.stringify(counts, null, 1));
console.log('끝', JSON.stringify(counts));
