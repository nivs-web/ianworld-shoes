/**
 * 결투 판정 QA (진단 전용) — `node tools/_duel-qa.mjs`
 *
 * 여기 계산은 **남의 재산을 움직인다.** 서버가 심판을 안 보므로 두 사람이
 * 각자 세고 **같은 답**을 내야 한다. 한쪽만 자기가 이겼다고 세면 금화가
 * 복제되거나 증발한다. 그래서 순위 규칙은 전수로 본다.
 *
 * 규칙 (2026-08-27, 사용자 지정):
 *   ① 살아남았는가  ② 금화  ③ 점수  ④ uid
 */

const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
};

const { duelRanking } = await import('../src/services/duelRules.js');

let fails = 0;
const eq = (label, got, want) => {
  const a = JSON.stringify(got), b = JSON.stringify(want);
  if (a === b) return console.log(`  ok   ${label}`);
  fails++;
  console.log(`  FAIL ${label}\n       got  ${a}\n       want ${b}`);
};

const P = (o) => ({ nickname: 'x', ...o });

console.log('=== 순위 규칙 ===');

eq('죽은 사람이 진다 (금화가 더 많아도)',
  duelRanking({ a: P({ alive: false, coins: 900 }), b: P({ alive: true, coins: 10 }) }),
  ['b', 'a']);

eq('둘 다 살아 있으면 금화가 많은 사람이 이긴다',
  duelRanking({ a: P({ alive: true, coins: 120 }), b: P({ alive: true, coins: 310 }) }),
  ['b', 'a']);

eq('금화가 같으면 점수',
  duelRanking({ a: P({ alive: true, coins: 100, score: 10 }),
                b: P({ alive: true, coins: 100, score: 99 }) }),
  ['b', 'a']);

eq('전부 같으면 uid — 비기는 경우를 남기지 않는다',
  duelRanking({ z: P({ alive: true, coins: 5, score: 5 }),
                a: P({ alive: true, coins: 5, score: 5 }) }),
  ['a', 'z']);

eq('둘 다 죽었으면 그래도 금화로 가른다',
  duelRanking({ a: P({ alive: false, coins: 10 }), b: P({ alive: false, coins: 80 }) }),
  ['b', 'a']);

eq('`alive` 가 없는 옛 판은 살아 있는 것으로 본다',
  duelRanking({ a: P({ coins: 10 }), b: P({ alive: false, coins: 80 }) }),
  ['a', 'b']);

eq('대기자는 순위에 안 들어간다',
  duelRanking({ a: P({ alive: true, coins: 10 }),
                w: P({ alive: true, coins: 999, waiting: true }) }),
  ['a']);

console.log('=== 양쪽이 같은 답을 내는가 ===');
{
  /**
   * 같은 방을 **키 순서만 바꿔** 넣어도 답이 같아야 한다.
   * 자바스크립트 객체의 열거 순서는 보장이 약하고, 두 사람의 Firebase 응답이
   * 같은 순서로 온다는 보장이 없다 — 정렬이 완전히 결정적이어야 하는 이유다.
   */
  const A = { u1: P({ alive: true, coins: 50, score: 7 }),
              u2: P({ alive: true, coins: 50, score: 7 }) };
  const B = { u2: A.u2, u1: A.u1 };
  eq('키 순서가 달라도 같은 답', duelRanking(A), duelRanking(B));
}
{
  const room = {};
  const rnd = (s) => { let t = s >>> 0; return () => (t = (t + 0x6D2B79F5) >>> 0,
    ((t ^ (t >>> 15)) * (1 | t) >>> 0) / 4294967296); };
  const r = rnd(7);
  let same = true;
  for (let n = 0; n < 400; n++) {
    const mk = () => P({ alive: r() > 0.5, coins: Math.floor(r() * 300),
                         score: Math.floor(r() * 3000) });
    room.aaa = mk(); room.bbb = mk();
    const flipped = { bbb: room.bbb, aaa: room.aaa };
    if (JSON.stringify(duelRanking(room)) !== JSON.stringify(duelRanking(flipped))) same = false;
  }
  eq('무작위 400판에서도 순서에 안 흔들린다', same, true);
}

console.log(fails === 0 ? '\n전부 통과' : `\n${fails}군데 실패`);
process.exit(fails ? 1 : 0);
