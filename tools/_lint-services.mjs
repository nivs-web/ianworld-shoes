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

/**
 * 짝이 맞아야 하는 호출들.
 *
 * `signInWithRedirect` 만 부르고 `getRedirectResult` 를 안 부르면, 구글에서
 * 돌아와도 로그인이 **끝나지 않는다.** 화면은 넘어가는데 계정이 안 붙어서
 * 프로필·도감·순위표가 서버에 한 줄도 안 올라간다. 게다가 팝업이 막히는
 * 모바일에서는 이 경로가 기본이라 사실상 모바일 전체가 죽는다.
 * 실제로 그렇게 배포돼 있었고, 증상이 "명예의 전당이 안 나온다"였다.
 */
const MUST_PAIR = [
  ['signInWithRedirect', 'getRedirectResult',
   '리다이렉트 로그인은 돌아온 뒤 getRedirectResult() 로 마무리해야 완성된다'],
];
{
  const all = walk('src').map((f) => readFileSync(f, 'utf8')).join('\n');
  for (const [a, b, hint] of MUST_PAIR) {
    if (new RegExp(`\\b${a}\\s*\\(`).test(all) && !new RegExp(`\\b${b}\\s*\\(`).test(all)) {
      problems.push(`X ${a}() 를 쓰면서 ${b}() 를 안 부른다\n     ${hint}`);
    }
  }
}

/**
 * 원격 호출은 **반드시 `withTimeout` 으로 감싼다.**
 *
 * 파이어스토어는 연결이 막히면 거절하지 않고 **영원히 기다린다**(CLAUDE.md §9-0-7).
 * `await` 가 안 끝나니 `finally` 도 안 돌고, 화면은 버튼이 죽은 채로 멈춘다.
 * 실제로 `collection.js` 하나만 이걸 빠뜨려서, 파이어스토어가 막히는 환경에서
 * **로그인 버튼이 영구히 죽는** 상태로 배포돼 있었다. 사람이 매번 기억할 수 없으므로 여기서 막는다.
 */
const REMOTE_CALLS = [
  'getDoc', 'getDocs', 'setDoc', 'updateDoc', 'deleteDoc', 'addDoc',
  'commit', 'runTransaction',
  'dbMod.get', 'dbMod.set', 'dbMod.update', 'dbMod.remove',
];
for (const file of walk('src/services')) {
  if (file.endsWith('firebase.js')) continue; // withTimeout 을 정의하는 파일
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    if (line.trim().startsWith('*') || line.trim().startsWith('//')) return; // 주석
    const hit = REMOTE_CALLS.find((c) => line.includes(`${c}(`));
    if (!hit) return;
    // 여러 줄로 쓴 경우가 있어 앞 두 줄까지 같이 본다
    const near = lines.slice(Math.max(0, i - 2), i + 1).join('\n');
    if (near.includes('withTimeout')) return;
    problems.push(`X ${file}:${i + 1}: ${hit}() 가 withTimeout 없이 불린다\n     ${line.trim()}`);
  });
}

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
