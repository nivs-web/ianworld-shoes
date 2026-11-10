/**
 * 에셋 갤러리 전용 개발 서버 설정 (그림 담당 · 2026-11-11)
 *   npx vite --config tools/idg-gallery/vite.config.mjs --port 5330 --strictPort
 * 기본 vite.config.js 를 그대로 쓰고, 원본 시트 폴더를 /idg-sheets/<파일> 로 읽을 수 있게만 더한다(개발 서버 전용 · 배포 빌드와 무관).
 * 시트 폴더는 환경변수 IDG_SHEETS 로 바꿀 수 있다. 이 설정 없이 `npx vite` 로 열어도 갤러리는 열리고, 원본 시트 그림만 빠진다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { mergeConfig } from 'vite';
import base from '../../vite.config.js';

const SHEETS = process.env.IDG_SHEETS || 'C:/Users/ariancepc/Desktop/cowork/iandragon/docs/style_refs/gen';

export default mergeConfig(base, {
  plugins: [{
    name: 'idg-sheets',
    configureServer(server) {
      server.middlewares.use('/idg-sheets/', (req, res, next) => {
        const name = path.basename(decodeURIComponent((req.url || '').split('?')[0]));
        const file = path.join(SHEETS, name);
        if (!/\.(png|webp|jpg)$/i.test(name) || !fs.existsSync(file)) return next();
        res.setHeader('Content-Type', name.endsWith('.png') ? 'image/png' : 'image/webp');
        res.setHeader('Cache-Control', 'no-cache');
        fs.createReadStream(file).pipe(res);
      });
    },
  }],
});
