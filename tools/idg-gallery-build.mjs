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
execSync('npx vite build --config tools/idg-gallery/vite.build.mjs', { cwd: ROOT, stdio: 'inherit' });
const built = path.join(OUT, 'tools/idg-gallery.html');
fs.renameSync(built, path.join(OUT, 'index.html'));
fs.rmSync(path.join(OUT, 'tools'), { recursive: true, force: true });
fs.writeFileSync(path.join(OUT, 'README.txt'), '좀비와 드래곤 에셋 갤러리 (관리자용) — 자동 생성물. 고칠 때는 tools/idg-gallery* 를 고치고 node tools/idg-gallery-build.mjs 로 다시 만든다.\n');
console.log('→ public/admin/idg-gallery/index.html');
