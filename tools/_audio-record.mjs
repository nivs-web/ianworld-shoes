/**
 * 사운드 미리듣기 녹음 (진단 전용) — 게임의 실제 오디오 그래프를 그대로 녹음한다.
 * 게임에는 오디오 파일이 0개다. 이건 **사람이 들어보려고** 뽑는 산출물이다.
 *
 *   node tools/_audio-record.mjs bgm   → 10트랙 각 6초
 *   node tools/_audio-record.mjs sfx   → 효과음 전량 순서대로
 *   node tools/_audio-record.mjs sfx sfx_rival_fell,sfx_rival_revive → 고른 것만
 */
import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';

const mode = process.argv[2] ?? 'sfx';
/**
 * ★ 효과음 목록을 **소스에서 긁는다** (2026-08-19).
 * 손으로 적어 두면 새로 만든 소리가 미리듣기에서 조용히 빠진다 — 실제로 그랬다.
 * 세 번째 인자를 주면 그것만 뽑는다(새 소리 두 개만 들어 볼 때).
 */
const ALL = [...readFileSync('src/audio/sfx.js', 'utf8').matchAll(/^\s{2}(sfx_[a-z_]+):/gm)]
  .map((m) => m[1])
  .filter((k) => k !== 'sfx_shout');
const PICK = process.argv[3] ? process.argv[3].split(',').filter((k) => ALL.includes(k)) : null;
if (process.argv[3] && !PICK.length) { console.error('그런 효과음이 없다'); process.exit(1); }

const b = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--autoplay-policy=no-user-gesture-required'],
});
const p = await b.newPage({ viewport: { width: 540, height: 960 } });
await p.goto('http://127.0.0.1:4173/');
await p.waitForTimeout(2500);
await p.mouse.click(270, 880);
await p.waitForTimeout(500);
// 클릭이 빈 곳에 떨어져도 잠금은 풀려야 한다 (_audio-qa.mjs 와 같은 이유)
if (!(await p.evaluate(() => window.__dbg.Audio.isUnlocked()))) {
  await p.evaluate(() => window.__dbg.Audio.unlock());
  await p.waitForTimeout(200);
}

const base64 = await p.evaluate(async ([m, list, pick]) => {
  const A = window.__dbg.Audio;
  const { Sfx, Bgm } = window.__dbg;
  const ctx = A.audioCtx();
  const dest = ctx.createMediaStreamDestination();
  A.masterOut().connect(dest);

  const rec = new MediaRecorder(dest.stream, { mimeType: 'audio/webm;codecs=opus' });
  const chunks = [];
  rec.ondataavailable = (e) => chunks.push(e.data);
  const done = new Promise((r) => { rec.onstop = r; });
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  Bgm.stopBgm();
  rec.start();

  if (m === 'bgm') {
    for (let t = 1; t <= 10; t++) {
      Bgm.forceTrack(t);
      Bgm.startBgm();
      await wait(6000);
      Bgm.stopBgm();
      await wait(400);
    }
  } else {
    for (const id of list) { Sfx.play(id); await wait(id.startsWith('sfx_step') ? 200 : 1000); }
    if (!pick) {
      for (const c of ['ian', 'denny', 'lisa', 'jenny', 'ipo']) {
        Sfx.resetShoutGate(); Sfx.playShout(c); await wait(800);
      }
    }
  }

  await wait(500);
  rec.stop();
  await done;

  const blob = new Blob(chunks, { type: 'audio/webm' });
  const buf = new Uint8Array(await blob.arrayBuffer());
  let s = '';
  for (let i = 0; i < buf.length; i++) s += String.fromCharCode(buf[i]);
  return btoa(s);
}, [mode, PICK ?? ALL, !!PICK]);

const out = `tools/_out/audio_${PICK ? PICK.join('+') : mode}.webm`;
await writeFile(out, Buffer.from(base64, 'base64'));
console.log(out);
await b.close();
