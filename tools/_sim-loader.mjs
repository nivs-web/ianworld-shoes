/**
 * 시뮬레이터 로더 — `src/services/{firebase,auth,profile}.js` 를 대역으로 바꿔치기하고
 * JSON import 를 허용한다.
 *
 *   node --import ./tools/_sim-loader.mjs tools/_multi-sim.mjs
 */
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

register(
  'data:text/javascript,' +
    encodeURIComponent(`
      const MAP = {
        '/src/services/firebase.js': '/tools/_sim/firebase.js',
        '/src/services/auth.js':     '/tools/_sim/auth.js',
        '/src/services/profile.js':  '/tools/_sim/profile.js',
      };
      export async function resolve(spec, context, next) {
        const r = await next(spec, context);
        for (const [from, to] of Object.entries(MAP)) {
          if (r.url.endsWith(from)) return { ...r, url: r.url.replace(from, to) };
        }
        return r;
      }
      export async function load(url, context, next) {
        if (url.endsWith('.json')) return next(url, { ...context, importAttributes: { type: 'json' } });
        return next(url, context);
      }
    `),
  pathToFileURL('./')
);
