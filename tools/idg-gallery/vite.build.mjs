/**
 * 에셋 갤러리 → 웹 정적 페이지 빌드 (그림 담당 · 2026-11-11 · 대표님 «관리자 페이지에서 에셋 갤러리를 열어 보고 싶다»)
 *   node tools/idg-gallery-build.mjs      (= vite build --config tools/idg-gallery/vite.build.mjs + index.html 로 옮기기)
 * 결과 : public/admin/idg-gallery/index.html (+ assets/*.js) → 배포하면 /admin/idg-gallery/ (관리자 단추는 겜부장이 붙임)
 * 그림은 /assets/... 를 그대로 읽는다 (원본 시트 /idg-sheets/ 는 개발 서버 전용이라 웹에서는 빠진다).
 */
import path from 'node:path';
import { mergeConfig } from 'vite';
import base from '../../vite.config.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '../..');

export default mergeConfig(base, {
  base: '/admin/idg-gallery/',
  publicDir: false,                                                              // public 을 통째로 복사하지 않음 (결과가 public 안이라)
  build: {
    outDir: path.join(ROOT, 'public/admin/idg-gallery'),
    emptyOutDir: true,
    rollupOptions: { input: path.join(ROOT, 'tools/idg-gallery.html') },
  },
});
