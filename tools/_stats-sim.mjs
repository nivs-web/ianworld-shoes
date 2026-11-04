/**
 * 운영자 통계 시뮬 (진단 전용, 2026-11-04) — 진짜 stats.js + 가짜 서버.
 *   node --import ./tools/_sim-loader.mjs tools/_stats-sim.mjs
 */
import { FakeDb } from './_sim/rtdb.mjs';
import { CTX } from './_sim/firebase.js';

let fails = 0;
const eq = (label, got, want) => {
  const a = JSON.stringify(got), b = JSON.stringify(want);
  if (a === b) return console.log(`  ok   ${label}`);
  fails++; console.log(`  FAIL ${label}\n       got  ${a}\n       want ${b}`);
};
const db = new FakeDb();
const St = await import('../src/services/stats.js');
/* 사람마다 자기 기기 = 자기 모듈 (하루 한 번 표시가 모듈 안에 있다) */
const mods = {};
const mod = async (u) => (mods[u] ??= await import(`../src/services/stats.js?u=${u}`));
const as = (uid) => { CTX.db = db; CTX.uid = uid; };
const day = St.dayKey();

/* ★ 운영 버그(2026-11-05) 그대로: stats 칸이 아예 없는 새 서버에서 첫 사람이 붙는다 */
eq('처음엔 stats 칸이 없다', db.read('stats'), null);
for (const u of ['A', 'B', 'C']) { as(u); await (await mod(u)).onConnected(); }
eq('★ 빈 서버에서도 첫 사람부터 센다 (예전엔 −1 예약이 거부돼 전부 0)', db.read('stats/live') > 0, true);
eq('★ 끊기면 −1 예약이 걸려 있다 (사람마다 하나)', [...db.disconnects.values()].filter((d) => d.path === 'stats/live').length, 3);
eq('세 명이 붙으면 동시접속 3', db.read('stats/live'), 3);
eq('오늘 접속자 3', db.read(`stats/days/${day}/n`), 3);
eq('오늘 최대 3', db.read(`stats/days/${day}/peak`), 3);

db.dropConnection('B');
eq('B 가 끊기면 서버가 −1 → 2', db.read('stats/live'), 2);
db.restoreConnection('B');
as('B'); await (await mod('B')).onConnected();
eq('B 가 다시 붙으면 3', db.read('stats/live'), 3);
eq('★ 같은 날 다시 와도 접속자는 그대로 3', db.read(`stats/days/${day}/n`), 3);
eq('최대는 그대로 3', db.read(`stats/days/${day}/peak`), 3);

as('A'); eq('운영자가 아니면 메뉴 없음', await St.isAdmin(), false);
db.write('admins/A', true);
const St2 = await import('../src/services/stats.js?admin');
eq('admins/A 가 있으면 운영자', await St2.isAdmin(), true);
const r = await St2.readStats(7);
eq('통계: 지금 3 · 오늘 3명 · 최대 3', [r.live, r.days[0].n, r.days[0].peak], [3, 3, 3]);
eq('7일치', r.days.length, 7);

console.log('\n— 하나가 실패해도 나머지는 센다 —');
{
  const db2 = new FakeDb();
  CTX.db = db2; CTX.uid = 'X';
  db2.write('stats/live', 200000);          // 상한에 닿아 +1 이 거부되는 상황
  const Sx = await import('../src/services/stats.js?x=1');
  await Sx.onConnected();
  eq('동시접속 +1 이 거부돼도', db2.read('stats/live'), 200000);
  eq('★ 오늘 접속자는 따로 센다', db2.read(`stats/days/${day}/n`), 1);
  eq('끊기면 −1 예약도 안 남긴다 (+1 을 못 했으니)', [...db2.disconnects.values()].filter((d) => d.path === 'stats/live').length, 0);
}
{
  const db3 = new FakeDb();
  CTX.db = db3; CTX.uid = 'Y';
  /* 예약만 거부되는 상황 — +1 을 되돌려 유령이 안 남아야 한다 */
  const Sy = await import('../src/services/stats.js?y=1');
  const { makeFb } = await import('./_sim/rtdb.mjs');
  const fb = makeFb(db3, 'Y');
  const od = fb.dbMod.onDisconnect;
  fb.dbMod.onDisconnect = (r) => ({ ...od(r), set: () => Promise.reject(new Error('PERMISSION_DENIED')) });
  await Sy.onConnected({ ...fb, uid: 'Y' });
  eq('★ 예약이 실패하면 +1 을 되돌린다 (유령 0)', db3.read('stats/live'), 0);
  eq('오늘 접속자는 그래도 센다', db3.read(`stats/days/${day}/n`), 1);
}

console.log(fails ? `\n실패 ${fails}건` : '\n시뮬레이션 이상 없음');
process.exit(fails ? 1 : 0);
