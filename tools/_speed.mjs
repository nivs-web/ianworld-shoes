/* 속도 점검 (11/11 밤 대표님 «로딩이 엄청 느려졌다») — 폰 4G 정도(12Mbps · 지연 70ms)로 흉내 내고
 * ① 로비가 뜰 때까지 ② «모험시작» → 판 카드(출격) ③ «출격» → 전투가 움직일 때까지 시간과, 그 사이 받은 파일 크기를 잰다. */
import { chromium } from 'playwright';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch({ channel: 'chrome' }); const ctx = await b.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.6 }); const p = await ctx.newPage();
const cdp = await ctx.newCDPSession(p); await cdp.send('Network.enable'); await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 70, downloadThroughput: 1.5e6, uploadThroughput: 0.5e6 });
let bytes = 0; const big = []; p.on('requestfinished', async (rq) => { if (!rq.url().includes('/assets/')) return; const s = await rq.sizes().catch(() => null); const n = s ? s.responseBodySize : 0; bytes += n; if (n > 150e3) big.push(`${rq.url().replace(/^.*\/assets\//, '').slice(-45)} ${(n / 1e3) | 0}KB`); });
const mark = (nm, t0, b0) => { console.log(`${nm} ${((Date.now() - t0) / 1000).toFixed(1)}초 · ${((bytes - b0) / 1e6).toFixed(2)}MB`); };
let t = Date.now(), b0 = bytes; await p.goto('http://127.0.0.1:5320/tools/idg-gallery/lobby.html');
await p.waitForFunction(() => [...document.querySelectorAll('button')].some((x) => /모험/.test(x.textContent)), null, { timeout: 120000 }); mark('① 로비', t, b0);
t = Date.now(); b0 = bytes; await p.evaluate(() => [...document.querySelectorAll('button')].find((x) => /모험/.test(x.textContent))?.click());
await p.waitForFunction(() => [...document.querySelectorAll('button')].some((x) => x.textContent.includes('출격')), null, { timeout: 120000 }); mark('② 판 카드', t, b0);
t = Date.now(); b0 = bytes; await p.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.textContent.includes('출격'))?.click());
await p.waitForFunction(() => window.__idgBattle && window.__idgBattle.S.t > 0.5, null, { timeout: 120000 }); mark('③ 전투 시작', t, b0);
await sleep(8000); console.log(`전투 시작 후 8초 동안 더 받은 양 ${((bytes - b0) / 1e6).toFixed(2)}MB`);
console.log('큰 파일:', big.join(' | '));
await b.close();
