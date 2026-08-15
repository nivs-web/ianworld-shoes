/**
 * 노드에서 `src/**` 를 그대로 import 하기 위한 로더 훅.
 *
 * Vite 는 `import data from './x.json'` 을 알아서 처리하지만 노드는
 * `with { type: 'json' }` 을 요구한다. 게임 코드에 노드 사정 때문에
 * 어트리뷰트를 붙이고 싶지는 않아서, 진단 스크립트 쪽에서 흡수한다.
 *
 *   node --import ./tools/_json-import.mjs tools/_wallet-qa.mjs
 */
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

register(
  'data:text/javascript,' +
    encodeURIComponent(`
      export async function load(url, context, next) {
        if (url.endsWith('.json')) {
          return next(url, { ...context, importAttributes: { type: 'json' } });
        }
        return next(url, context);
      }
    `),
  pathToFileURL('./')
);
