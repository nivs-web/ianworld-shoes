/**
 * services 계층 오용 검사 (진단 전용) — `node tools/_lint-services.mjs`
 *
 * 왜 이게 필요한가: firebase.js 를 셋(auth / store / rtdb)으로 쪼개면서
 * `getFirebase()` 의 반환값에서 `db` · `storeMod` 가 빠졌다. 그런데 화면 QA는
 * **게스트 경로만** 걷기 때문에(도감 동기화는 로그인 사용자만 탄다) 옛 호출이
 * 남아 있어도 조용히 통과한다. 실제로 collection.js 가 그렇게 배포될 뻔했다.
 *
 * 그래서 "무엇을 부르고 무엇을 쓰는가"를 텍스트로 대조한다.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** getter 별로 **없는** 속성을 쓰면 런타임 TypeError 다 */
const FORBIDDEN = {
  getFirebase: ['db', 'storeMod', 'rtdb', 'dbMod'],
  getStore: ['rtdb', 'dbMod'],
  getRtdb: ['db', 'storeMod', 'auth', 'authMod'],
};

function walk(dir, out = []) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (n.endsWith('.js')) out.push(p);
  }
  return out;
}

const problems = [];
for (const file of walk('src')) {
  if (file.endsWith('services/firebase.js')) continue; // 정의 파일 자체는 제외
  const src = readFileSync(file, 'utf8');
  for (const [getter, banned] of Object.entries(FORBIDDEN)) {
    if (!new RegExp(`\\b${getter}\\s*\\(`).test(src)) continue;
    // 같은 파일에서 다른 getter 도 쓰면 판정이 애매하다 — 그때만 사람이 본다
    const others = Object.keys(FORBIDDEN).filter((g) => g !== getter && new RegExp(`\\b${g}\\s*\\(`).test(src));
    for (const prop of banned) {
      const m = src.match(new RegExp(`^.*\\.${prop}\\b.*$`, 'm'));
      if (!m) continue;
      if (others.length) {
        problems.push(`? ${file}: ${getter}() 와 ${others.join('/')}() 를 같이 쓴다 — .${prop} 이 어느 쪽인지 직접 확인할 것`);
      } else {
        problems.push(`X ${file}: ${getter}() 는 .${prop} 을 주지 않는다\n     ${m[0].trim()}`);
      }
    }
  }
}

if (problems.length) {
  console.error('services 오용 발견:\n' + problems.join('\n'));
  process.exit(1);
}
console.log('services 계층 이상 없음');
