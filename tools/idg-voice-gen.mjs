/**
 * 이안 드래곤 게임 — 한국어 대사 굽기 (겜팀장). 보이스 스튜디오(127.0.0.1:3900)가 떠 있어야 한다.
 *   node tools/idg-voice-gen.mjs [key필터]     예) node tools/idg-voice-gen.mjs deploy/kkomul
 * 1단계 녹음: 줄마다 VoxCPM2(감정 큰 목소리) 3벌 + Supertonic-3(또박또박) 1벌
 * 2단계 고르기: Whisper 받아쓰기로 발음을 재서, 온전한 VoxCPM2 가 있으면 그것(감정 우선), 아니면 Supertonic
 *   → 캐릭터 효과(ffmpeg: 아기 = 음 올림, 보스 = 음 내림 + 울림, 로봇 = 금속음) → public/assets/iandragon_game/voice/<파일>.ogg + .m4a
 * 8GB GPU 에 받아쓰기 모델까지 같이 올리면 VoxCPM2 가 버벅여서 단계를 나눈다.
 * 중간 파일: tools/_out/voice/ (다시 돌리면 이미 만든 후보 · 받아쓰기는 건너뛴다)
 */
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { VOICE_LINES } from '../src/games/iandragon_game/audio/voice-lines.js';
import { fileName } from '../src/games/iandragon_game/audio/voice.js';

const API = 'http://127.0.0.1:3900';
const FF = process.env.FFMPEG || 'C:/Users/ariancepc/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0.1-full_build/bin/ffmpeg.exe';
const TMP = 'tools/_out/voice', OUT = 'public/assets/iandragon_game/voice';
fs.mkdirSync(TMP, { recursive: true }); fs.mkdirSync(OUT, { recursive: true });

/* 성우 설계: vx = VoxCPM2 목소리 설명(길면 한국어를 빼먹어서 짧게) · st = Supertonic 기본 목소리 · fx = 효과 사슬 · sp = 빠르기 */
const VC = {
  babyHi:     { vx: 'A tiny excited child, very high pitch, bouncy', st: 'F4', fx: 'babyHi' },
  babySleepy: { vx: 'A sleepy slow child, drowsy', st: 'M1', fx: 'babySleepy', sp: 0.9 },
  babyBold:   { vx: 'A brave shouting little boy, loud', st: 'M4', fx: 'baby' },
  babyGoofy:  { vx: 'A goofy silly little boy, giggly', st: 'M3', fx: 'babyMid' },
  babyFast:   { vx: 'A hyper child, very fast, breathless', st: 'F5', fx: 'baby', sp: 1.2 },
  babySweet:  { vx: 'A sweet little girl, bright and clear', st: 'F3', fx: 'baby' },
  babyDreamy: { vx: 'A dreamy soft little girl, slow', st: 'F5', fx: 'babyDreamy', sp: 0.92 },
  babyProud:  { vx: 'A proud show-off little boy, pompous', st: 'M5', fx: 'babyMid' },
  babyCool:   { vx: 'A cool confident little girl, crisp', st: 'F4', fx: 'babyCool' },
  babyZappy:  { vx: 'A zappy energetic child, short bursts', st: 'F3', fx: 'babyZappy', sp: 1.1 },
  bossDeep:   { vx: 'A fat greedy monster, deep growling voice', st: 'M1', fx: 'bossDeep', sp: 0.95 },
  bossGiant:  { vx: 'A giant monster, booming deep voice, slow', st: 'M4', fx: 'bossGiant', sp: 0.92 },
  bossCold:   { vx: 'An icy monster, low cold creepy voice', st: 'M5', fx: 'bossCold', sp: 0.9 },
  bossShrill: { vx: 'A cocky villain, high screechy voice', st: 'M3', fx: 'bossShrill', sp: 1.08 },
  bossRobot:  { vx: 'A cold robot, flat mechanical monotone', st: 'M3', fx: 'bossRobot', sp: 0.95 },
  caster:     { vx: 'An excited male game announcer, loud and fast', st: 'M4', fx: 'caster', sp: 1.1 },
};

const rb = (p, t = 1, f = 'shifted') => `rubberband=pitch=${p}:tempo=${t}:formant=${f}:pitchq=quality`;
const FX = {
  baby: `${rb(1.3, 1.06)},highpass=f=120,acompressor=threshold=-18dB:ratio=3`,
  babyHi: `${rb(1.4, 1.08)},highpass=f=150,acompressor=threshold=-18dB:ratio=3`,
  babyMid: `${rb(1.25, 1.04)},highpass=f=100`,
  babySleepy: `${rb(1.18, 0.95)},lowpass=f=7000`,
  babyDreamy: `${rb(1.3, 0.98)},chorus=0.6:0.9:50:0.3:0.25:2`,
  babyZappy: `${rb(1.38, 1.08)},vibrato=f=14:d=0.2,highpass=f=150`,
  babyCool: `${rb(1.32, 1.04)},aecho=0.8:0.6:40:0.2`,
  bossDeep: `${rb(0.74, 0.97, 'preserved')},bass=g=6,aecho=0.8:0.7:60|120:0.3|0.18,acompressor=threshold=-16dB:ratio=4`,
  bossGiant: `${rb(0.68, 0.95, 'preserved')},bass=g=8,aecho=0.8:0.8:90|180:0.35|0.22,acompressor=threshold=-16dB:ratio=4`,
  bossCold: `${rb(0.8, 0.95, 'preserved')},aecho=0.8:0.85:180|360:0.4|0.25,highpass=f=90`,
  bossShrill: `${rb(1.18, 1.06)},aphaser=type=t:speed=0.6,acompressor=threshold=-18dB:ratio=3`,
  bossRobot: `${rb(0.85, 1.0, 'preserved')},flanger=delay=2:depth=4:regen=40:speed=0.5,acrusher=bits=10:mix=0.35,aecho=0.8:0.5:30:0.25`,
  caster: 'highpass=f=80,acompressor=threshold=-20dB:ratio=4:makeup=3,aecho=0.8:0.4:25:0.12',
};
const ff = (args) => execFileSync(FF, ['-y', '-loglevel', 'error', ...args]);
const fxApply = (src, dst, chain) => ff(['-i', src, '-af',
  `${FX[chain]},silenceremove=start_periods=1:start_threshold=-45dB:stop_periods=-1:stop_threshold=-45dB:stop_duration=0.3,loudnorm=I=-16:TP=-1.5:LRA=11`,
  '-ar', '48000', '-ac', '1', dst]);

async function gen(dst, text, p) {
  if (fs.existsSync(dst)) return true;
  for (let tries = 0; tries < 2; tries++) {
    const fd = new FormData(); fd.set('text', text); fd.set('language', 'Korean');
    for (const [k, v] of Object.entries(p)) fd.set(k, String(v));
    const r = await fetch(`${API}/generate`, { method: 'POST', body: fd }).catch((e) => ({ ok: false, status: 0, text: async () => String(e) }));
    if (r.ok) { const b = Buffer.from(await r.arrayBuffer()); if (b.length > 4000) { fs.writeFileSync(dst, b); return true; } }
    else console.log('  생성 실패', r.status, (await r.text()).slice(0, 160));
  }
  return false;
}
const norm = (s) => s.replace(/[^가-힣]/g, '').replace(/(.)\1+/g, '$1');
const lev = (a, b) => { const d = Array.from({ length: a.length + 1 }, (_, i) => [i]); for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[a.length][b.length]; };
async function asr(file, want) {
  const fd = new FormData(); fd.set('audio', new Blob([fs.readFileSync(file)]), 'a.wav'); fd.set('language', 'ko');
  const j = await (await fetch(`${API}/transcribe`, { method: 'POST', body: fd })).json().catch(() => ({}));
  const got = j.text ?? ''; const a = norm(want), b = norm(got);
  return { acc: a.length ? Math.max(0, 1 - lev(a, b) / a.length) : 0, got };
}
const unload = (id) => fetch(`${API}/model/unload/${id}`, { method: 'POST' }).catch(() => {});

const filter = process.argv[2];
const jobs = [];
for (const [key, lines] of Object.entries(VOICE_LINES)) {
  if (filter && !key.startsWith(filter)) continue;
  lines.forEach(({ text, v }, i) => { if (VC[v]) jobs.push({ name: fileName(key, i), text, v, spoken: text.replace(/—/g, '…'), c: VC[v] }); else console.log('목소리 설계 없음', v); });
}

/* 1단계: 녹음 */
await unload('capture-asr');
for (const j of jobs) {
  j.cands = [];
  for (const seed of [1, 2, 3]) { const raw = `${TMP}/${j.name}.vx${seed}.wav`; if (await gen(raw, j.spoken, { engine: 'voxcpm2', instruct: j.c.vx, seed })) j.cands.push({ id: `vx${seed}`, raw }); }
  const raw = `${TMP}/${j.name}.st.wav`; if (await gen(raw, j.spoken, { engine: 'supertonic3', preset_voice: j.c.st, speed: j.c.sp ?? 1.05 })) j.cands.push({ id: 'st', raw });
  console.log('녹음', j.name, j.cands.length);
}
await unload('sidecar:voxcpm2');

/* 2단계: 받아쓰기로 고르기 → 캐릭터 효과 → ogg + m4a */
const report = fs.existsSync(`${TMP}/_report.json`) ? JSON.parse(fs.readFileSync(`${TMP}/_report.json`, 'utf8')) : {};
const asrCache = fs.existsSync(`${TMP}/_asr.json`) ? JSON.parse(fs.readFileSync(`${TMP}/_asr.json`, 'utf8')) : {};
for (const { name, text, v, c, cands } of jobs) {
  for (const k of cands) {   // 발음 검사는 원본으로 (효과 입힌 아기 고음은 Whisper 가 못 알아듣는다)
    const ck = `${k.raw}|${fs.statSync(k.raw).size}`;
    asrCache[ck] ??= await asr(k.raw, text); Object.assign(k, asrCache[ck]);
  }
  fs.writeFileSync(`${TMP}/_asr.json`, JSON.stringify(asrCache));
  cands.sort((a, b) => b.acc - a.acc);
  const st = cands.find((k) => k.id === 'st'), vx = cands.find((k) => k.id !== 'st');
  let pick = cands[0];
  if (vx && vx.acc >= 0.85 && vx.acc >= (st?.acc ?? 0) - 0.1) pick = vx;   // 온전하면 감정 큰 VoxCPM2 를 우선
  else if (st && (!vx || vx.acc < st.acc + 0.15)) pick = st;               // 아니면 또박또박 Supertonic (의성어는 Whisper 가 못 알아들어 점수가 같게 낮다)
  if (!pick) { console.log('✗', name, '후보 없음'); continue; }
  pick.fx = pick.raw.replace(/\.wav$/, '.fx.wav'); fxApply(pick.raw, pick.fx, c.fx);
  ff(['-i', pick.fx, '-c:a', 'libopus', '-b:a', '40k', `${OUT}/${name}.ogg`]);
  ff(['-i', pick.fx, '-c:a', 'aac', '-b:a', '64k', `${OUT}/${name}.m4a`]);
  report[name] = { text, v, pick: pick.id, acc: +pick.acc.toFixed(2), got: pick.got, all: cands.map((k) => `${k.id}:${k.acc.toFixed(2)}`).join(' ') };
  console.log(pick.acc < 0.7 ? '⚠' : '✓', name.padEnd(28), pick.id, Math.round(pick.acc * 100) + '%', '|', pick.got);
  fs.writeFileSync(`${TMP}/_report.json`, JSON.stringify(report, null, 1));
}
const vals = Object.values(report);
console.log(`끝: ${vals.length}줄 · vx ${vals.filter((r) => r.pick !== 'st').length} · st ${vals.filter((r) => r.pick === 'st').length} · 70% 미만 ${vals.filter((r) => r.acc < 0.7).length}`);
