/**
 * 배포 · r2:sync 뒤 R2 엣지 데우기 (2026-11-12 · 대표님 «R2 를 빠르게» · 겜팀장 실측 «첫 판 그림 MISS»)
 *   npm run assets:warm                  (= idg · ui · fonts 의 «먼저 받는 것»만 · GET 으로 몸통까지 받아 확실히 데움)
 *   node tools/warm-assets.mjs --all     (그 게임 파일 전부)
 *   node tools/warm-assets.mjs --game idg,ui --head   (HEAD 만)
 * 주소 = R2 판 주소 oraksil.onstori.com/<게임id>/<ver>/<상대 경로> (r2-assets.json · liveBase). 에셋은 R2 에만 있다(Vercel 에 사본 없음 · 모든 게임 strip:true).
 * 이 컴퓨터(한국)에서 돌리면 한국 사람들이 붙는 Cloudflare 엣지가 데워진다. Cloudflare 무료 창고는 잘 안 쓰는 파일을 금방 비우므로 «배포 직후 첫 방문자»용.
 * json · m4a 가 DYNAMIC 으로 나오면 Cloudflare 캐시 규칙이 아직 없는 것(대표님 로그인 필요).
 */
import { CONFIG, localFiles, liveBase, typeOf, pool } from './r2-assets.mjs';

const args = process.argv.slice(2);
const flag = (k) => args.includes(k);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const method = flag('--head') ? 'HEAD' : 'GET';
const N = Number(opt('--n')) || 16;
const games = opt('--game') ? opt('--game').split(',') : ['idg', 'ui', 'fonts'];

/* 기본 = 로비 + 모험시작 → 첫 판 + 로비 미리 받기 목록 (겜팀장 11/12 warm-r2.mjs 의 WANT 와 같은 범위) · --all = 전부 */
const IDG_CORE = /^(ui\/|ai\/(lobby|lobby2|result|meta|hud|fx|castles|kkomul|walker|novart|fun|kit|ui|eggs)\/|ai\/bg\/layers\/w01|music\/(music\.json|edm\/music\.json|lobby_lt\.|w1_lt\.|win_lt\.|boss_lt\.)|voice\/(title|start|win|lose|name_)|sfx\/|atlas\.|env\/)/;
const isCore = (id, f) => (id !== 'idg' ? true : IDG_CORE.test(f.rel) && !/\.(md|txt)$/.test(f.rel));

let bad = 0;
for (const id of games) {
  if (!CONFIG.games[id]) { console.log(`[warm] 없는 게임 id : ${id}`); bad++; continue; }
  const files = flag('--all') ? localFiles(id) : localFiles(id).filter((f) => isCore(id, f)), t0 = Date.now();
  const st = {}, cache = {}, wrongType = [], fail = [];
  let bytes = 0;
  console.log(`[warm] ${CONFIG.games[id].name} : ${files.length}개 → ${liveBase(id)} (${method} · 동시 ${N})`);
  await pool(files, N, async (f, k) => {
    const url = liveBase(id) + f.rel.split('/').map(encodeURIComponent).join('/');
    let r = null;
    for (let t = 0; t < 3 && !r; t++) {
      try {
        r = await fetch(url, { method });
        if (method === 'GET') { const b = (await r.arrayBuffer()).byteLength; bytes += b; }   // bytes += await … 는 동시에 돌 때 값이 덮인다
      } catch { r = null; await new Promise((ok) => setTimeout(ok, 500 * (t + 1))); }
    }
    if (!r) { fail.push(f.rel); return; }
    st[r.status] = (st[r.status] || 0) + 1;
    if (r.status !== 200) { fail.push(`${r.status} ${f.rel}`); return; }
    const c = r.headers.get('cf-cache-status') || '-'; cache[c] = (cache[c] || 0) + 1;
    const want = typeOf(f.rel).split(';')[0], got = (r.headers.get('content-type') || '').split(';')[0];
    if (want !== 'application/octet-stream' && got !== want && !(want === 'audio/mp4' && got === 'audio/x-m4a')) wrongType.push(`${f.rel} (${got})`);
    if (k % 300 === 299) console.log(`  … ${k + 1}/${files.length}`);
  });
  const sec = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`  상태 ${JSON.stringify(st)} · 캐시 ${JSON.stringify(cache)} · ${method === 'GET' ? (bytes / 1048576).toFixed(1) + 'MB · ' : ''}${sec}초`);
  if (fail.length) console.log(`  ✗ 실패 ${fail.length} : ${fail.slice(0, 10).join(', ')}${fail.length > 10 ? ' …' : ''}`);
  if (wrongType.length) console.log(`  ! 형식 다름 ${wrongType.length} : ${wrongType.slice(0, 10).join(', ')}${wrongType.length > 10 ? ' …' : ''}`);
  bad += fail.length;
}
process.exit(bad ? 1 : 0);
