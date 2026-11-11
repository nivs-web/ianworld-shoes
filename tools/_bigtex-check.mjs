/* 큰 텍스처 점검 (11/11 긴급 · 태블릿 배경 안 보임) : 판 하나를 열어 GPU 에 올라간 텍스처 중 가장 넓은 것 · 화면 캡처
 *   node tools/_bigtex-check.mjs <판 번호> <출력.png> [w] [h] */
import { chromium } from 'playwright';
const [no = '24', out = 'tools/_out/bigtex.png', W = '1280', H = '800'] = process.argv.slice(2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch({ channel: 'chrome' });
const p = await (await b.newContext({ viewport: { width: +W, height: +H }, deviceScaleFactor: 2 })).newPage(); const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
await p.goto(`http://127.0.0.1:5320/tools/idg-gallery/lobby.html?idgStage=${no}`); await sleep(2000);
await p.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.textContent.includes('모험 시작'))?.click()); await sleep(4500);
await p.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.textContent.includes('출격'))?.click()); await sleep(3000);
console.log(await p.evaluate(() => { let max = 0, who = ''; const walk = (o) => { const t = o.texture; if (t && t.source && t.source.width > max) { max = t.source.width; who = t.source.label || t.source.resource?.src || ''; } for (const c of o.children || []) walk(c); }; walk(window.__idgApp.stage); const gl = window.__idgApp.renderer.gl; return `가장 넓은 텍스처 ${max}px ${who} · GPU 한도 ${gl ? gl.getParameter(gl.MAX_TEXTURE_SIZE) : '?'}`; }));
await p.screenshot({ path: out }); console.log('오류', errs.length, errs[0] || ''); await b.close();
