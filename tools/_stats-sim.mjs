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

for (const u of ['A', 'B', 'C']) { as(u); await (await mod(u)).onConnected(); }
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

console.log(fails ? `\n실패 ${fails}건` : '\n시뮬레이션 이상 없음');
process.exit(fails ? 1 : 0);
