/**
 * 공개 녹음에서 «고리(loop) 배경음악» 한 곡 만들기 — 겜팀장 (2026-11-12 · 로비 곡 «마녀들의 밤의 꿈»)
 *   node tools/idg-music-loop.mjs <원본> <출력 이름(확장자 없이)> <시작 후보 from> <to> <길이 최소> <최대> [lufs=-16] [opus kbps=48] [aac kbps=64]
 * 1) 원본을 11kHz 모노로 풀어 0.1초마다 24칸 주파수 모양을 뽑는다.
 * 2) 시작 후보 S 마다, S+최소 ~ S+최대 안에서 «끝 직전 2초»가 «S 직전 2초»와 가장 닮은 끝 E 를 고른다(이음매가 안 들리게).
 * 3) [S, E] 를 자르고 끝 0.3초에 S 직전 0.3초를 겹쳐(크로스페이드) 고리로 만든다 → loudnorm → ogg(opus) · m4a(aac).
 * 내려받은 원본은 tools/_out/music_src 에 두고 커밋하지 않는다.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';

const [src, out, sFrom, sTo, lMin, lMax, lufs = '-16', opus = '48', aac = '64'] = process.argv.slice(2);
if (!src || !out) { console.error('사용법: node tools/idg-music-loop.mjs <원본> <출력> <S from> <S to> <길이 최소> <최대>'); process.exit(1); }
const SR = 11000, HOP = SR / 10, N = 1024, BANDS = 24;   // HOP 이 정수(1100)여야 한다
const pcm = execFileSync('ffmpeg', ['-v', 'error', '-i', src, '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-'], { maxBuffer: 1 << 30 });
const x = new Float32Array(pcm.buffer, pcm.byteOffset, pcm.byteLength / 4);

/* 0.1초마다 24칸 (단순 DFT 대신 칸마다 고르첼 묶음 — 정확도보다 «닮음» 비교용) */
const edges = Array.from({ length: BANDS + 1 }, (_, i) => 60 * Math.pow(4000 / 60, i / BANDS));
const frames = [];
const win = Float32Array.from({ length: N }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1)));
for (let p = 0; p + N < x.length; p += HOP) {
  const f = new Float32Array(BANDS);
  for (let b = 0; b < BANDS; b++) {
    let e = 0;
    for (const hz of [edges[b], (edges[b] + edges[b + 1]) / 2]) {
      const w = (2 * Math.PI * hz) / SR, c = 2 * Math.cos(w); let s1 = 0, s2 = 0;
      for (let i = 0; i < N; i++) { const s0 = x[p + i] * win[i] + c * s1 - s2; s2 = s1; s1 = s0; }
      e += s1 * s1 + s2 * s2 - c * s1 * s2;
    }
    f[b] = Math.log(1e-9 + Math.max(0, e));
  }
  const m = f.reduce((a, v) => a + v, 0) / BANDS; for (let b = 0; b < BANDS; b++) f[b] -= m;   // 크기 차이는 빼고 모양만
  frames.push(f);
}
const ctx = 20;   // 2초
const dist = (a, b) => { let d = 0; for (let k = 1; k <= ctx; k++) { const A = frames[a - k], B = frames[b - k]; if (!A || !B) return 1e9; for (let i = 0; i < BANDS; i++) d += (A[i] - B[i]) ** 2; } return d / ctx; };
let best = null; const all = [];
for (let s = Math.round(+sFrom * 10); s <= Math.round(+sTo * 10); s++) for (let e = s + Math.round(+lMin * 10); e <= s + Math.round(+lMax * 10); e++) { const d = dist(e, s); all.push(d); if (!best || d < best.d) best = { s, e, d }; }
const S = best.s / 10, E = best.e / 10, len = +(E - S).toFixed(2), XF = 0.3;
all.sort((a, b) => a - b); console.log(`이음매 차이: 고른 것 ${best.d.toFixed(0)} · 후보 중간값 ${all[all.length >> 1].toFixed(0)} · 하위 10% ${all[Math.floor(all.length * 0.1)].toFixed(0)}`);
console.log(`고른 구간 ${S.toFixed(1)}초 – ${E.toFixed(1)}초 (길이 ${len}초 · 이음매 차이 ${best.d.toFixed(2)})`);

const tmp = out + '.loop.wav';
const fc = `[0:a]atrim=${S}:${E},asetpts=PTS-STARTPTS,afade=t=out:st=${(len - XF).toFixed(3)}:d=${XF}[a];` +
  `[0:a]atrim=${(S - XF).toFixed(3)}:${S},asetpts=PTS-STARTPTS,afade=t=in:d=${XF},adelay=${Math.round((len - XF) * 1000)}|${Math.round((len - XF) * 1000)}[b];` +
  `[a][b]amix=inputs=2:normalize=0:duration=first,loudnorm=I=${lufs}:TP=-1.5:LRA=11,aresample=48000,atrim=0:${len}[o]`;
execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', src, '-filter_complex', fc, '-map', '[o]', '-ac', '2', tmp]);
/* loudnorm 한 번으로는 목표에서 1~2dB 벗어나서, 재고 남은 만큼 맞춘다 */
const meas = spawnSync('ffmpeg', ['-hide_banner', '-i', tmp, '-af', 'ebur128=framelog=quiet', '-f', 'null', '-'], { encoding: 'utf8' }).stderr;
const I = Number((meas.match(/I:\s+(-?[\d.]+) LUFS/g) || []).pop()?.match(/-?[\d.]+/)[0] ?? lufs);
const gain = (+lufs - I).toFixed(2);
console.log('음량 ' + I + ' LUFS → ' + gain + 'dB 보정');
execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', tmp, '-af', 'volume=' + gain + 'dB', '-c:a', 'libopus', '-b:a', `${opus}k`, '-vbr', 'on', out + '.ogg']);
execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', tmp, '-af', 'volume=' + gain + 'dB', '-ar', '44100', '-c:a', 'aac', '-b:a', `${aac}k`, out + '.m4a']);
fs.rmSync(tmp);
for (const e of ['ogg', 'm4a']) console.log(`${out}.${e} ${(fs.statSync(`${out}.${e}`).size / 1024).toFixed(0)}KB`);
console.log(JSON.stringify({ start: S, end: E, seconds: len }));
