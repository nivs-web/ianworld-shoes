/* 로딩 무게 재기 (11/11 밤 «로딩이 엄청 느려졌다») : 로비 → 모험시작 → 전투 화면이 뜰 때까지 받은 파일 수 · 크기 (종류별 · 큰 것 순) */
import { chromium } from 'playwright';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch({ channel: 'chrome' }); const ctx = await b.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.6 }); const p = await ctx.newPage();
const got = []; p.on('response', async (r) => { try { const u = r.url(); if (!/\/assets\/iandragon_game\//.test(u)) return; const buf = await r.body().catch(() => null); got.push({ u: u.replace(/^.*\/assets\/iandragon_game\//, ''), n: buf ? buf.length : 0, t: performance.now() }); } catch { /* */ } });
await p.goto('http://127.0.0.1:5320/tools/idg-gallery/lobby.html'); await sleep(2500);
const lobbyN = got.length, lobbyB = got.reduce((a, x) => a + x.n, 0);
const t0 = Date.now(); await p.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.textContent.includes('모험'))?.click());
await p.waitForFunction(() => [...document.querySelectorAll('button')].some((x) => x.textContent.includes('출격')), null, { timeout: 60000 }); const tReady = Date.now() - t0;
await sleep(3000);
const bat = got.slice(lobbyN), sum = (a) => (a.reduce((s, x) => s + x.n, 0) / 1e6).toFixed(2) + 'MB';
const by = {}; for (const x of bat) { const k = x.u.split('/').slice(0, 2).join('/').replace(/\.(png|webp|json|mp3|ogg|m4a)$/, ''); const g = /^voice|audio/.test(x.u) ? 'voice/audio' : /bg\//.test(x.u) ? 'bg' : /fx\//.test(x.u) ? 'fx' : /castles/.test(x.u) ? 'castles' : /music/.test(x.u) ? 'music' : 'rigs/etc'; (by[g] ||= []).push(x); }
console.log(`로비 ${lobbyN}개 ${(lobbyB / 1e6).toFixed(2)}MB · 전투 준비 ${tReady}ms · 전투 ${bat.length}개 ${sum(bat)}`);
for (const [g, a] of Object.entries(by)) console.log(` ${g}: ${a.length}개 ${sum(a)}`);
console.log(' 큰 것:', bat.sort((a, c) => c.n - a.n).slice(0, 10).map((x) => `${x.u} ${(x.n / 1e3) | 0}KB`).join(' | '));
await b.close();
