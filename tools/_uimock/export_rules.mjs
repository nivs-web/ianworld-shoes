/**
 * 디자인 규칙표 → 한 폴더(index.html + img/)로 뽑기 (11/14 대표님 «onstori.com/oraksil/rule 에서 늘 보게»)
 *  쓰는 법 : (dev 서버 5397 켠 채) node tools/_uimock/export_rules.mjs <내보낼 폴더>
 *  규칙표를 고치면 rules.html 을 고치고 → 이 도구로 다시 뽑아 → onstori 저장소 public/oraksil-rule 에 덮어씀
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
const OUT = process.argv[2];
const BASE = process.argv[3] || '';   /* 올리는 곳 주소 폴더 (예 /oraksil-rule/) — onstori 는 주소가 /oraksil/rule 이라 그림 경로가 어긋나서 <base> 로 고정 */ if (!OUT) { console.error('폴더를 주세요'); process.exit(1); }
const ORIGIN = 'http://127.0.0.1:5397';
fs.mkdirSync(path.join(OUT, 'img'), { recursive: true });
const b = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
const got = new Map();
p.on('response', async (r) => { const u = r.url(); if (!u.startsWith(ORIGIN)) return; const t = r.headers()['content-type'] || ''; if (/^(image|font)\//.test(t) || /\.(png|webp|jpe?g|svg|gif|woff2?|ttf)(\?|$)/.test(u)) { try { got.set(new URL(u).pathname, await r.body()); } catch { /* */ } } });
await p.goto(`${ORIGIN}/tools/_uimock/rules.html`, { waitUntil: 'networkidle' });
await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); } });
await p.waitForTimeout(1500);
const kit = fs.readFileSync(new URL('./kit.css', import.meta.url), 'utf8');   /* dev 서버는 css 를 js 로 줘서 파일에서 직접 읽음 */
let html = await p.evaluate(() => { document.querySelectorAll('script').forEach((s) => s.remove()); document.querySelector('link[href="kit.css"]')?.remove(); return '<!doctype html>\n' + document.documentElement.outerHTML; });
/* kit.css 속 그림도 받기 */
for (const m of kit.matchAll(/url\((['"]?)(\/[^)'"]+)\1\)/g)) if (!got.has(m[2])) { const r = await fetch(ORIGIN + m[2]); if (r.ok) got.set(m[2], Buffer.from(await r.arrayBuffer())); }
for (const m of html.matchAll(/(?:src="|url\((?:&quot;|['"])?)(\/(?:assets|tools|fonts)\/[^"')&]+)/g)) if (!got.has(m[1])) { const r = await fetch(ORIGIN + m[1]); if (r.ok) got.set(m[1], Buffer.from(await r.arrayBuffer())); }
const rename = new Map();
const flat = (u) => 'img/' + u.replace(/^\//, '').replace(/[\/]/g, '__');
/* 큰 그림(300KB 넘는 png)은 webp 로 줄여 담음 — 규칙표가 빨리 뜨게 */
const sharp = (await import('sharp').catch(() => null))?.default;
for (const [u, buf] of [...got]) {
  if (sharp && /\.png$/i.test(u) && buf.length > 300_000) { const w = u.replace(/\.png$/i, '.__s.webp'); got.delete(u); got.set(u, null); fs.writeFileSync(path.join(OUT, flat(w)), await sharp(buf).webp({ quality: 82 }).toBuffer()); rename.set(u, w); continue; }
  fs.writeFileSync(path.join(OUT, flat(u)), buf);
}
const swap = (s) => { for (const u of [...got.keys()].sort((a, c) => c.length - a.length)) s = s.split(u).join(flat(rename.get(u) || u)); return s; };
html = swap(html).replace("<head>", `<head><meta name="robots" content="noindex"><style>
${swap(kit)}
</style>`);   /* kit.css 는 원래처럼 규칙표 글보다 앞에 (뒤에 두면 overflow:hidden 이 이겨서 아래가 잘림) */
html = html.replace(/<link[^>]*kit\.css[^>]*>/g, '');
if (BASE) html = html.replace('<head>', `<head><base href="${BASE}">`);
html = html.replace(/<title>[^<]*<\/title>/, '').replace('<meta charset="utf-8">', '<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>디자인 규칙표 · 좀비와 드래곤</title>');
fs.writeFileSync(path.join(OUT, 'index.html'), html);
const left = [...html.matchAll(/["'(]\/(assets|tools)\/[^"')]+/g)].map((m) => m[0]);
console.log('그림', got.size, '개 · 남은 옛 주소', left.length, left.slice(0, 5));
await b.close();
