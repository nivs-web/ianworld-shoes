/**
 * 에셋 갤러리 웹 빌드 (그림 담당 · 2026-11-11)
 *   node tools/idg-gallery-build.mjs
 * vite 로 tools/idg-gallery.html 을 묶어 public/admin/idg-gallery/ 에 넣고, 페이지를 index.html 로 옮긴다.
 * 갤러리를 고친 뒤 다시 돌려 커밋하면 다음 배포에 반영된다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const OUT = path.join(ROOT, 'public/admin/idg-gallery');
/*
 * 그림 판 번호(ver)는 빌드할 때 r2-assets.json 에서 읽어 박힌다 (vite.config.js r2Assets). 11/12 : 배포된 갤러리가 옛 판(20261111e)을 보고 있었다 —
 * ver 를 올리면 이 빌드를 다시 돌려야 한다. 아래에서 결과물이 지금 판만 가리키는지 확인하고, 다르면 멈춘다.
 */
const VER = JSON.parse(fs.readFileSync(path.join(ROOT, 'r2-assets.json'), 'utf8')).games.idg.ver;
execSync('npx vite build --config tools/idg-gallery/vite.build.mjs', { cwd: ROOT, stdio: 'inherit' });
const built = path.join(OUT, 'tools/idg-gallery.html');
fs.renameSync(built, path.join(OUT, 'index.html'));
fs.renameSync(path.join(OUT, 'tools/idg-gallery/rigcheck.html'), path.join(OUT, 'rigcheck.html'));   // 조립 점검 화면 → /admin/idg-gallery/rigcheck.html
fs.rmSync(path.join(OUT, 'tools'), { recursive: true, force: true });
const seen = new Set();
for (const fn of fs.readdirSync(path.join(OUT, 'assets'))) for (const m of fs.readFileSync(path.join(OUT, 'assets', fn), 'utf8').matchAll(/(?:onstori\.com|["'`(]\/g)\/idg\/([0-9a-z]+)\//g)) seen.add(m[1]);   // R2(host=r2) 든 같은 사이트 /g/idg/<ver>/(host=vercel · 11/12) 든
if ([...seen].some((v) => v !== VER)) throw new Error(`갤러리가 다른 그림 판을 가리킴: ${[...seen].join(', ')} (지금 판 ${VER})`);
fs.writeFileSync(path.join(OUT, 'README.txt'), `좀비와 드래곤 에셋 갤러리 (관리자용) — 자동 생성물. 고칠 때는 tools/idg-gallery* 를 고치고 node tools/idg-gallery-build.mjs 로 다시 만든다.\n그림 판 idg/${VER} — r2-assets.json 의 ver 를 올리면 이 빌드를 다시 돌린다.\n`);
console.log(`→ public/admin/idg-gallery/index.html · 그림 판 idg/${VER}${seen.size ? '' : ' (판 폴더 꺼짐 — 같은 서버 /assets)'}`);
