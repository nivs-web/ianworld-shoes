/**
 * 게임 그림 · 소리를 R2 에 올린다 — `npm run r2:sync -- idg` (게임 id 생략 = 설정의 모든 게임)
 *
 * 열쇠는 이 컴퓨터의 `.env.r2.local` 에서 읽는다(깃에 안 올라감 · 대표님이 값을 넣음):
 *   R2_ACCOUNT_ID=…   R2_ACCESS_KEY_ID=…   R2_SECRET_ACCESS_KEY=…     (버킷은 r2-assets.json 의 bucket)
 * 이미 같은 내용(MD5)이 있으면 건너뛴다 → 몇 번을 돌려도 안전. 판 번호(ver) 폴더 아래에만 쓴다(다른 판 · 온스토리 버킷은 못 건드림).
 * 머리글 : Content-Type(확장자) · Cache-Control 1년 immutable (판 번호 폴더라 안전)
 * 끝나면 공개 주소 점검(tools/r2-check.mjs 와 같은 것)까지 돌린다.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { ROOT, CONFIG, localFiles, keyOf, typeOf, pool, checkLive } from './r2-assets.mjs';

function readEnv() {
  const f = path.join(ROOT, '.env.r2.local');
  if (!fs.existsSync(f)) { console.error('✘ .env.r2.local 이 없습니다 (R2_ACCOUNT_ID · R2_ACCESS_KEY_ID · R2_SECRET_ACCESS_KEY)'); process.exit(1); }
  const env = {};
  for (const line of fs.readFileSync(f, 'utf8').split(/\r?\n/)) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, ''); }
  for (const k of ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY']) if (!env[k]) { console.error('✘ .env.r2.local 에 ' + k + ' 가 비었습니다'); process.exit(1); }
  return env;
}

/* ── S3 서명(SigV4) — R2 는 지역 auto · 서비스 s3 ── */
const sha256 = (b) => crypto.createHash('sha256').update(b).digest('hex');
const hmac = (k, s) => crypto.createHmac('sha256', k).update(s).digest();
const enc = (s) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
function signed(env, method, key, { query = {}, body = Buffer.alloc(0), headers = {} } = {}) {
  const host = `${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  const now = new Date(), amz = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''), day = amz.slice(0, 8);
  const canonPath = '/' + CONFIG.bucket + (key ? '/' + key.split('/').map(enc).join('/') : '');
  const qs = Object.keys(query).sort().map((k) => `${enc(k)}=${enc(query[k])}`).join('&');
  const h = { host, 'x-amz-date': amz, 'x-amz-content-sha256': sha256(body), ...Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), String(v)])) };
  const names = Object.keys(h).sort();
  const canon = [method, canonPath, qs, names.map((n) => `${n}:${h[n].trim()}\n`).join(''), names.join(';'), h['x-amz-content-sha256']].join('\n');
  const scope = `${day}/auto/s3/aws4_request`;
  const sts = ['AWS4-HMAC-SHA256', amz, scope, sha256(canon)].join('\n');
  const kSig = hmac(hmac(hmac(hmac('AWS4' + env.R2_SECRET_ACCESS_KEY, day), 'auto'), 's3'), 'aws4_request');
  h.authorization = `AWS4-HMAC-SHA256 Credential=${env.R2_ACCESS_KEY_ID}/${scope}, SignedHeaders=${names.join(';')}, Signature=${crypto.createHmac('sha256', kSig).update(sts).digest('hex')}`;
  delete h.host;
  return fetch(`https://${host}${canonPath}${qs ? '?' + qs : ''}`, { method, headers: h, body: method === 'PUT' ? body : undefined });
}

/** 판 폴더 아래 이미 있는 것 { key: etag(md5) } */
async function listRemote(env, prefix) {
  const out = {}; let token = '';
  for (;;) {
    const q = { 'list-type': '2', prefix, 'max-keys': '1000' }; if (token) q['continuation-token'] = token;
    const r = await signed(env, 'GET', '', { query: q });
    const x = await r.text(); if (r.status !== 200) throw new Error('목록 실패 ' + r.status + ' ' + x.slice(0, 200));
    for (const m of x.matchAll(/<Contents>[\s\S]*?<Key>([^<]+)<\/Key>[\s\S]*?<ETag>&quot;([0-9a-f]+)&quot;<\/ETag>[\s\S]*?<\/Contents>/g)) out[m[1].replace(/&amp;/g, '&')] = m[2];
    const t = x.match(/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/); if (!t) break; token = t[1];
  }
  return out;
}

async function syncGame(env, id) {
  const g = CONFIG.games[id], files = localFiles(id);
  const remote = await listRemote(env, `${id}/${g.ver}/`);
  const todo = files.filter((f) => remote[keyOf(id, f.rel)] !== crypto.createHash('md5').update(fs.readFileSync(f.abs)).digest('hex'));
  /* ★ 같은 판 번호에 «이미 있는 파일을 다른 내용으로» 덮어쓰면 1년 캐시 때문에 사람들은 옛 그림을 계속 본다 → 판 번호(ver)를 올리라고 멈춘다 */
  const changed = todo.filter((f) => remote[keyOf(id, f.rel)]);
  if (changed.length && !process.argv.includes('--force')) { console.error(`✘ ${g.name} : 판 ${g.ver} 에 이미 올라간 파일 ${changed.length}개가 바뀌었습니다(예: ${changed.slice(0, 3).map((f) => f.rel).join(', ')}).
  r2-assets.json 의 ver 를 올린 뒤 다시 돌리세요 (같은 판에 덮어쓰면 1년 캐시 때문에 옛 그림이 보임).`); return false; }
  const mb = (n) => (n / 1048576).toFixed(1) + ' MB';
  console.log(`▶ ${g.name} (${id}) 판 ${g.ver} : 로컬 ${files.length}개 · R2 에 이미 ${Object.keys(remote).length}개 · 올릴 것 ${todo.length}개 (${mb(todo.reduce((a, f) => a + f.size, 0))})`);
  let done = 0, fail = [];
  await pool(todo, 8, async (f) => {
    const body = fs.readFileSync(f.abs);
    for (let t = 0; t < 3; t++) {
      try {
        const r = await signed(env, 'PUT', keyOf(id, f.rel), { body, headers: { 'Content-Type': typeOf(f.rel), 'Cache-Control': 'public, max-age=31536000, immutable' } });
        if (r.status === 200) { if (++done % 200 === 0) console.log(`  … ${done}/${todo.length}`); return; }
        if (t === 2) fail.push(`${f.rel} (${r.status} ${(await r.text()).slice(0, 80)})`);
      } catch (e) { if (t === 2) fail.push(`${f.rel} (${e.message})`); }
      await new Promise((ok) => setTimeout(ok, 800 * (t + 1)));
    }
  });
  if (fail.length) { console.error(`✘ 올리기 실패 ${fail.length}개:\n  ` + fail.slice(0, 20).join('\n  ')); return false; }
  console.log(`  ✔ 올림 ${done}개 — 공개 주소 점검 중…`);
  const c = await checkLive(id, { log: console.log });
  if (!c.ok) { console.error(`✘ 점검 실패 — 없음 ${c.missing.length} · 크기 다름 ${c.badSize.length} · CORS 없음 ${c.noCors.length}\n  ` + [...c.missing, ...c.badSize, ...c.noCors].slice(0, 15).join('\n  ')); return false; }
  console.log(`  ✔ 공개 주소 ${c.total}개 모두 200 · 크기 같음 · CORS 있음`);
  return true;
}

const env = readEnv();
const ids = process.argv.slice(2).filter((a) => !a.startsWith('-'));
let ok = true;
for (const id of ids.length ? ids : Object.keys(CONFIG.games)) ok = (await syncGame(env, id)) && ok;
process.exit(ok ? 0 : 1);
