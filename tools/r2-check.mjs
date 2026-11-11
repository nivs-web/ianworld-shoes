/**
 * R2 공개 주소 점검 — `npm run r2:check -- idg` (열쇠 필요 없음 · 바깥에서 본다)
 * 로컬 파일이 하나도 빠짐없이 oraksil.onstori.com 에 있고, 크기가 같고, CORS 머리글(그림 · 소리에 꼭 필요)이 붙는지.
 * 운영 빌드에서 strip=true 인 게임은 vite.config.js 가 이 점검을 돌리고, 실패하면 빌드를 멈춘다(깨진 채로 배포 안 됨).
 */
import { CONFIG, checkLive } from './r2-assets.mjs';

const ids = process.argv.slice(2).filter((a) => !a.startsWith('-'));
let ok = true;
for (const id of ids.length ? ids : Object.keys(CONFIG.games)) {
  const g = CONFIG.games[id];
  console.log(`▶ ${g.name} (${id}) 판 ${g.ver} 점검 — ${CONFIG.origin}/${id}/${g.ver}/`);
  const c = await checkLive(id, { log: console.log });
  if (c.ok) console.log(`  ✔ ${c.total}개 모두 200 · 크기 같음 · CORS 있음`);
  else { ok = false; console.error(`  ✘ 없음 ${c.missing.length} · 크기 다름 ${c.badSize.length} · CORS 없음 ${c.noCors.length}\n    ` + [...c.missing, ...c.badSize, ...c.noCors].slice(0, 15).join('\n    ')); }
}
process.exit(ok ? 0 : 1);
