/**
 * "쓰는데 임포트 안 된 이름" 을 훑는다.
 *
 * ★ 왜 필요한가 (2026-08-26)
 * `vite build` 는 이걸 **못 잡는다.** 번들러는 모듈 경계만 보고, 파일 안에서
 * 어디서도 안 온 이름을 부르는 것은 **실행할 때가 되어서야** ReferenceError 로 터진다.
 * 실제로 `UserCard.js` 가 `confirmDialog` 를 임포트 없이 쓰고 있었는데 빌드는 통과했다 —
 * 대결 신청을 누르는 사람만 화면이 죽는 종류의 사고다.
 *
 *     node tools/_imports.mjs
 */
import fs from 'fs';
import path from 'path';

const DIRS = ['src/screens', 'src/screens/multi', 'src/services', 'src/game'];

/** 화면 코드가 자주 쓰는, 반드시 어딘가에서 와야 하는 이름들 */
const KNOWN = [
  'confirmDialog', 'segmented', 'title', 'toast', 'backButton', 'screen',
  'presentOverlay', 'lazyScreen', 'crownImg', 'openUserCard', 'button', 'el',
];

const files = [];
for (const d of DIRS) {
  if (!fs.existsSync(d)) continue;
  for (const f of fs.readdirSync(d)) if (f.endsWith('.js')) files.push(path.join(d, f));
}

let bad = 0;
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');

  /** 이 파일이 알고 있는 이름들 — 임포트 + 이 파일이 직접 만든 것 */
  const have = new Set();
  for (const m of src.matchAll(/import\s*\{([^}]*)\}\s*from/g))
    for (const part of m[1].split(','))
      have.add(part.trim().split(/\s+as\s+/).pop());
  for (const m of src.matchAll(/(?:function|const|let|var|class)\s+([A-Za-z_$][\w$]*)/g))
    have.add(m[1]);

  for (const name of KNOWN) {
    if (have.has(name)) continue;
    // `foo(` 는 잡고 `obj.foo(` 는 넘긴다 — 남의 것을 부르는 건 문제가 아니다
    const re = new RegExp(String.raw`(?<![\w.$])${name}\s*\(`);
    if (re.test(src)) { console.log('★', f, '—', name, '을(를) 쓰는데 어디서도 안 왔다'); bad++; }
  }
}

console.log(bad ? `${bad}건 발견` : `${files.length}개 파일 — 전부 정상`);
process.exit(bad ? 1 : 0);
