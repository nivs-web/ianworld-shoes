/**
 * 좀비와 드래곤 — 곡 · 효과음 녹음 (사람이 들어 보려고 뽑는 산출물 · 게임은 이 파일을 쓰지 않는다) · 겜팀장
 *   node tools/idg-audio-record.mjs [초=24] [id,id,...]   → tools/_out/audio_rec/<종류>_<id>.webm   (id 를 주면 그 곡·소리만 녹음)
 * vite 를 코드 안에서 띄우고 → 플레이라이트 크롬에서 게임의 실제 소리 그래프(master)를 MediaRecorder 로 녹음한다.
 */
import fs from 'node:fs';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const SEC = Number(process.argv[2] || 24);
const ONLY = process.argv[3] ? process.argv[3].split(',') : null;
const OUT = 'tools/_out/audio_rec';
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync('tools/_out/_audio_rec.html', `<!doctype html><meta charset="utf-8"><script type="module">
import { audio } from '/src/games/iandragon_game/audio/synth.js';
import { startTrack, stopTrack } from '/src/games/iandragon_game/audio/music.js';
import { SFX, FUN_SFX } from '/src/games/iandragon_game/audio/sfx.js';
window.rec = async (kind, id, ms) => {
  const A = audio(); await A.ctx.resume();
  const dest = A.ctx.createMediaStreamDestination(); A.master.connect(dest);
  const mr = new MediaRecorder(dest.stream, { mimeType: 'audio/webm;codecs=opus' }); const parts = [];
  mr.ondataavailable = (e) => parts.push(e.data); const done = new Promise((r) => (mr.onstop = r));
  mr.start();
  if (kind === 'track') startTrack(id, 1);
  else if (kind === 'fun') { const f = FUN_SFX[id]; (Array.isArray(f) ? f[0] : f)?.(); }
  else SFX[id]?.();
  await new Promise((r) => setTimeout(r, ms));
  stopTrack(); mr.stop(); await done; A.master.disconnect(dest);
  const b = new Uint8Array(await new Blob(parts).arrayBuffer()); let s = ''; for (const x of b) s += String.fromCharCode(x); return btoa(s);
};
window.ready = true;
</script>`);

const server = await createServer({ server: { port: 5199, strictPort: false, hmr: false, watch: null }, logLevel: 'error' });   // 녹음 중 파일이 바뀌어도 새로고침 안 함
await server.listen();
const url = server.resolvedUrls.local[0];
let browser;
try { browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] }); }
catch { browser = await chromium.launch({ channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required'] }); }
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('페이지 오류', e.message));
await page.goto(`${url}tools/_out/_audio_rec.html`);
await page.waitForFunction(() => window.ready);
const jobs = [
  ...['w1', 'w2', 'w3', 'w4', 'w5', 'w6', 'w7', 'w8', 'w9', 'w10', 'ending', 'lobby', 'battleA', 'boss'].map((id) => ['track', id, SEC * 1000]),
  ...['egg_shake', 'egg_crack', 'hatch_reveal_rare', 'hatch_reveal_super', 'hatch_reveal_legend', 'deploy_s', 'deploy_m', 'deploy_l', 'summon_rare', 'hit_zombie_squish', 'breath_charge', 'breath_fire', 'win_fanfare', 'lose_womp', 'boss_warn', 'button_back', 'button_deny'].map((id) => ['sfx', id, 3200]),
];
const funSrc = fs.readFileSync('src/games/iandragon_game/audio/sfx.js', 'utf8');
const funIds = [...funSrc.slice(funSrc.indexOf('export const FUN_SFX')).matchAll(/^\s{2}([a-z_]+):/gm)].map((m) => m[1]);
for (const id of funIds) jobs.push(['fun', id, 1400]);
for (const [kind, id, ms] of jobs.filter(([, id]) => !ONLY || ONLY.includes(id))) {
  const b64 = await page.evaluate(([k, i, m]) => window.rec(k, i, m), [kind, id, ms]);
  fs.writeFileSync(`${OUT}/${kind}_${id}.webm`, Buffer.from(b64, 'base64'));
  console.log('녹음', kind, id);
}
await browser.close(); await server.close();
