/** 원격 시험판 빌드 — 줄넘기 챔피언 혼자 하기만, 서버 없이. `npx vite build --config tools/_play/vite.config.mjs` */
import { defineConfig } from 'vite';
import { resolve } from 'node:path';
const ROOT = resolve(import.meta.dirname, '../..');
const MAP = { '/src/services/firebase.js': '/tools/_play/firebase.js', '/src/services/auth.js': '/tools/_play/auth.js' };
export default defineConfig({
  root: ROOT,
  base: './',
  publicDir: false,
  define: { __BUILD_ID__: '"play"' },
  build: {
    outDir: resolve(ROOT, 'tools/_out/play-dist'),
    emptyOutDir: true,
    rollupOptions: { input: resolve(ROOT, 'tools/_play/index.html') },
    chunkSizeWarningLimit: 4000,
  },
  plugins: [{
    name: 'play-stub', enforce: 'pre',
    async resolveId(src, importer, opt) {
      const r = await this.resolve(src, importer, { ...opt, skipSelf: true });
      if (!r) return null;
      const id = r.id.split(String.fromCharCode(92)).join('/');
      for (const [from, to] of Object.entries(MAP)) if (id.endsWith(from)) return resolve(ROOT, '.' + to);
      return null;
    },
  }],
});
