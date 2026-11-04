/** 두 창 시험 전용 vite 설정 — firebase.js·auth.js 만 대역으로 바꿔 끼운다 */
import { defineConfig } from 'vite';
import { resolve } from 'node:path';
const ROOT = resolve(import.meta.dirname, '../..');
const MAP = { '/src/services/firebase.js': '/tools/_rm/firebase.js', '/src/services/auth.js': '/tools/_rm/auth.js' };
export default defineConfig({
  root: ROOT,
  define: { __BUILD_ID__: '"rm"' },
  server: { port: 5199, strictPort: true, host: '127.0.0.1' },
  plugins: [{
    name: 'rm-stub', enforce: 'pre',
    async resolveId(src, importer, opt) {
      const r = await this.resolve(src, importer, { ...opt, skipSelf: true });
      if (!r) return null;
      const id = r.id.split(String.fromCharCode(92)).join('/');
      for (const [from, to] of Object.entries(MAP)) if (id.endsWith(from)) return resolve(ROOT, '.' + to);
      return null;
    },
  }],
});
