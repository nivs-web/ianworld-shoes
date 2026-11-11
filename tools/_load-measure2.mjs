/* 로딩 무게 2 : 응답 머리의 content-length 로 (body 못 읽는 것까지) — 로비 · 전투 각각 큰 것 순 */
import { chromium } from 'playwright';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch({ channel: 'chrome' }); const ctx = await b.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.6 }); const p = await ctx.newPage();
const got = []; p.on('requestfinished', async (rq) => { const u = rq.url(); if (!/\/assets\//.test(u)) return; const s = await rq.sizes().catch(() => null); got.push({ u: u.replace(/^.*\/assets\//, ''), n: s ? s.responseBodySize : 0 }); });
await p.goto('http://127.0.0.1:5320/tools/idg-gallery/lobby.html'); await sleep(3000);
const L = got.length;
await p.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.textContent.includes('모험'))?.click()); await sleep(5000);
await p.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.textContent.includes('출격'))?.click()); await sleep(5000);
const show = (a, nm) => { const s = a.reduce((x, y) => x + y.n, 0); const g = {}; for (const x of a) { const k = /voice|\.mp3|\.ogg|\.m4a/.test(x.u) ? 'voice/music' : x.u.split('/').slice(0, 3).join('/'); g[k] = (g[k] || 0) + x.n; } console.log(`${nm} ${a.length}개 ${(s / 1e6).toFixed(2)}MB`); console.log('  ', Object.entries(g).sort((a, c) => c[1] - a[1]).slice(0, 10).map(([k, v]) => `${k} ${(v / 1e3) | 0}KB`).join(' | ')); };
show(got.slice(0, L), '로비'); show(got.slice(L), '전투');
await b.close();
