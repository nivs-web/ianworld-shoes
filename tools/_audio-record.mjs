/**
 * 사운드 미리듣기 녹음 (진단 전용) — 게임의 실제 오디오 그래프를 그대로 녹음한다.
 * 게임에는 오디오 파일이 0개다. 이건 **사람이 들어보려고** 뽑는 산출물이다.
 *
 *   node tools/_audio-record.mjs bgm   → 10트랙 각 6초
 *   node tools/_audio-record.mjs sfx   → 효과음 전량 순서대로
 */
import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';

const mode = process.argv[2] ?? 'sfx';

const b = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--autoplay-policy=no-user-gesture-required'],
});
const p = await b.newPage({ viewport: { width: 540, height: 960 } });
await p.goto('http://127.0.0.1:4173/');
await p.waitForTimeout(2500);
await p.mouse.click(270, 880);
await p.waitForTimeout(500);

const base64 = await p.evaluate(async (m) => {
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
    const ids = ['sfx_step', 'sfx_step_alt', 'sfx_step', 'sfx_step_alt',
      'sfx_shoe_get', 'sfx_shoe_rare', 'sfx_turn', 'sfx_fall', 'sfx_death', 'sfx_revive',
      'sfx_menu_move', 'sfx_menu_select', 'sfx_menu_back', 'sfx_purchase', 'sfx_denied',
      'sfx_countdown', 'sfx_countdown', 'sfx_countdown', 'sfx_go', 'sfx_win', 'sfx_lose'];
    for (const id of ids) { Sfx.play(id); await wait(id.startsWith('sfx_step') ? 200 : 900); }
    for (const c of ['ian', 'denny', 'lisa', 'jenny', 'ipo']) {
      Sfx.resetShoutGate(); Sfx.playShout(c); await wait(800);
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
}, mode);

await writeFile(`/tmp/audio_${mode}.webm`, Buffer.from(base64, 'base64'));
console.log(`/tmp/audio_${mode}.webm`);
await b.close();
