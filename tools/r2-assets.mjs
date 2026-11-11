/**
 * 게임 그림 · 소리 → Cloudflare R2 (oraksil.onstori.com) 공용 도구 (2026-11-11 · 대표님 «오락실 에셋은 전부 R2 로 · GitHub · Vercel 용량 절약»)
 *
 * 구조 : 설정 r2-assets.json 의 게임마다  로컬 폴더(dir)  ⇄  R2 열쇠 `<게임id>/<ver>/<상대 경로>`  ⇄  공개 주소 `origin/<게임id>/<ver>/<상대 경로>`
 *  - 개발(이 컴퓨터 · 보조 · 겜팀장)은 지금처럼 public/assets/… 를 그대로 쓴다.
 *  - 운영 빌드만 vite.config.js 가 prefix 를 공개 주소로 바꿔 끼운다(live=true 일 때).
 *  - ver(판 번호) 폴더라 R2 파일은 1년 캐시해도 안전하다. 그림을 고치면 ver 를 올리고 다시 올린다.
 * 쓰는 곳 : vite.config.js(빌드) · tools/r2-sync.mjs(올리기) · tools/r2-check.mjs(점검)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const CONFIG = JSON.parse(fs.readFileSync(path.join(ROOT, 'r2-assets.json'), 'utf8'));

/** R2 에 올리지 않는 것 (점검 · 문서 · 숨김 파일) */
const SKIP = (rel) => /(^|\/)\./.test(rel) || /\.(md|txt)$/i.test(rel) && !/CREDITS\.md$/i.test(rel);

/** 게임 폴더의 파일 목록 [{ rel, abs, size }] (상대 경로는 / 로) */
export function localFiles(id) {
  const g = CONFIG.games[id]; if (!g) throw new Error('설정에 없는 게임 ' + id);
  const base = path.join(ROOT, g.dir), out = [];
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const a = path.join(d, e.name); if (e.isDirectory()) walk(a); else { const rel = path.relative(base, a).split(path.sep).join('/'); if (!SKIP(rel)) out.push({ rel, abs: a, size: fs.statSync(a).size }); } } };
  walk(base);
  return out.sort((a, b) => a.rel.localeCompare(b.rel));
}

export const keyOf = (id, rel) => `${id}/${CONFIG.games[id].ver}/${rel}`;
export const urlOf = (id, rel) => `${CONFIG.origin}/${keyOf(id, rel)}`;
/** 운영 빌드에서 prefix 대신 쓸 주소 (끝에 /) */
export const liveBase = (id) => `${CONFIG.origin}/${id}/${CONFIG.games[id].ver}/`;

const TYPES = { png: 'image/png', webp: 'image/webp', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', svg: 'image/svg+xml', json: 'application/json', m4a: 'audio/mp4', mp4: 'audio/mp4', aac: 'audio/aac', ogg: 'audio/ogg', opus: 'audio/ogg', mp3: 'audio/mpeg', wav: 'audio/wav', md: 'text/markdown; charset=utf-8', txt: 'text/plain; charset=utf-8', woff2: 'font/woff2' };
export const typeOf = (rel) => TYPES[rel.split('.').pop().toLowerCase()] || 'application/octet-stream';

/** 한 번에 n 개씩 */
export async function pool(items, n, fn) {
  const res = []; let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) { const k = i++; res[k] = await fn(items[k], k); } }));
  return res;
}

/**
 * 공개 주소 점검 — 모든 로컬 파일이 R2 에 있고 크기가 같으며 CORS 머리글이 붙는지 (열쇠 없이 바깥에서 본다)
 * @returns {{ ok:boolean, total:number, missing:string[], badSize:string[], noCors:string[] }}
 */
export async function checkLive(id, { origin = 'https://ianworld.vercel.app', log = () => {} } = {}) {
  const files = localFiles(id), missing = [], badSize = [], noCors = [];
  await pool(files, 24, async (f, k) => {
    let r = null;
    for (let t = 0; t < 3 && !r; t++) { try { r = await fetch(urlOf(id, f.rel), { method: 'HEAD', headers: { Origin: origin } }); } catch { await new Promise((ok) => setTimeout(ok, 500)); } }
    if (!r || r.status !== 200) missing.push(f.rel);
    else {
      if (Number(r.headers.get('content-length')) !== f.size) badSize.push(f.rel);
      if (!r.headers.get('access-control-allow-origin')) noCors.push(f.rel);
    }
    if (k % 400 === 399) log(`  … ${k + 1}/${files.length}`);
  });
  return { ok: !missing.length && !badSize.length && !noCors.length, total: files.length, missing, badSize, noCors };
}
