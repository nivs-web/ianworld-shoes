/**
 * 개발 서버를 «R2 시험 모드»로 띄운다 — 좀비와 드래곤 그림 · 소리를 oraksil.onstori.com 에서 받아 실제 화면으로 확인할 때만.
 * node tools/dev-r2.mjs [vite 인자…]   (R2_DEV=1 · R2_LIVE=idg 를 켜고 vite 를 그대로 실행)
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { ROOT } from './r2-assets.mjs';

const vite = path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
const child = spawn(process.execPath, [vite, ROOT, ...process.argv.slice(2)], { stdio: 'inherit', env: { ...process.env, R2_DEV: '1', R2_LIVE: process.env.R2_LIVE || 'idg' } });
child.on('exit', (code) => process.exit(code ?? 0));
