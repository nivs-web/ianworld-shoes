/**
 * 줄넘기 멀티 서바이벌 — 3명 · 8명 한 판 + 한 판 더 시뮬 (진단 전용, 2026-11-07)
 *
 *   node --import ./tools/_sim-loader.mjs tools/_jump-survival-sim.mjs
 *
 * 가짜 서버(`_sim/rtdb.mjs`)는 진짜 규칙처럼 **남의 칸이 바뀌는 것**을 막는다.
 * 방 만들기(정원 8) → 입장 → 레디 → 시작 → 각자 내 칸(하트 · 점수 · 콤보 · 생존)을 올림 →
 * 차례로 탈락 → 마지막 한 명 = 우승(모든 화면이 같은 답) → 판 끝 → 같은 방에서 한 판 더.
 */
import { FakeDb, advance, now } from './_sim/rtdb.mjs';
import { CTX } from './_sim/firebase.js';

const stores = new Map();
let active = new Map();
globalThis.localStorage = {
  getItem: (k) => (active.has(k) ? active.get(k) : null),
  setItem: (k, v) => active.set(k, String(v)),
  removeItem: (k) => active.delete(k),
};

const Room = await import('../src/services/multiplayer.js');
const L = await import('../src/services/storageLocal.js');
const { survivalStatus, lookLine, SURVIVAL } = await import('../src/games/jumprope/beat/survival.js');
const Settle = await import('../src/services/multiSettle.js');

let fails = 0;
const eq = (label, got, want) => {
  const a = JSON.stringify(got), b = JSON.stringify(want);
  if (a === b) return console.log(`  ok   ${label}`);
  fails++;
  console.log(`  FAIL ${label}\n       got  ${a}\n       want ${b}`);
};

async function run(n) {
  console.log(`\n── ${n}명 ──`);
  const db = new FakeDb();
  const players = [];
  for (let i = 0; i < n; i++) {
    const uid = `P${i + 1}`;
    stores.set(uid, new Map());
    active = stores.get(uid);
    L.resetAll(); L.loadProfile();
    L.patchProfile({ nickname: `선수${i + 1}`, uid });
    players.push({ uid, act: async (fn) => { CTX.db = db; CTX.uid = uid; active = stores.get(uid); return fn(); } });
  }
  const [host] = players;
  const room = () => db.read(`rooms/${code}`);
  const code = await host.act(() => Room.createRoom({ game: Room.GAME_JUMP, maxPlayers: 8, difficulty: 'normal' }));
  eq('방이 만들어졌다', typeof code, 'string');
  eq('정원 8 · 게임 jump', [room().maxPlayers, room().game], [8, 'jump']);
  for (const p of players.slice(1)) await p.act(() => Room.joinRoom(code, undefined, Room.GAME_JUMP));
  eq(`${n}명 모두 방에 있다`, Object.keys(room().players).length, n);
  for (const p of players.slice(1)) await p.act(() => Room.setReady(code, true));
  /* 대기방에서 각자 모습 · 하트를 싣는다 (WaitingRoom 이 하는 것) */
  for (const p of players) await p.act(() => Room.publishJump(code, { jl: lookLine('a1b2', 'red'), lives: SURVIVAL.hearts }));

  async function round(label) {
    await host.act(() => Room.startCountdown(code));
    eq(`${label}: 시작했다`, ['countdown', 'playing'].includes(room().state), true);
    for (const p of players) await p.act(() => Room.holdRoomSeat(code));
    for (const p of players) await p.act(() => Room.publishJump(code, { lives: 3, score: 0, jc: 0, alive: true, done: false }));
    let st = survivalStatus(room(), now());
    eq(`${label}: 생존 ${n}/${n}`, [st.aliveCount, st.total, st.over], [n, n, false]);
    /* 뒤에서부터 차례로 탈락 — 마지막 사람(P1 = 방장)만 남는다. 점수는 오래 버틸수록 크게 */
    for (let i = n - 1; i >= 1; i--) {
      advance(4000);
      const p = players[i];
      await p.act(() => Room.publishJump(code, { lives: 2, score: 1000 * (n - i), jc: 3 }));
      await p.act(async () => Room.publishJump(code, { lives: 0, alive: false, deadAt: await Room.serverNow(), score: 1200 * (n - i) }));
      for (const q of players.slice(0, i)) await q.act(() => Room.heartbeat(code).catch(() => {}));
      st = survivalStatus(room(), now());
      eq(`${label}: ${p.uid} 탈락 → 생존 ${i}`, st.aliveCount, i);
    }
    eq(`${label}: 판이 끝났다(한 명 남음)`, st.over, true);
    eq(`${label}: 우승 = 방장 P1`, st.winner, 'P1');
    /* 순위: 우승 → 늦게 걸린 순 */
    eq(`${label}: 순위`, st.ranking.map((x) => x.uid), players.map((p) => p.uid));
    /* 모든 화면이 같은 답을 낸다 — 각자 읽은 방으로 */
    const answers = new Set();
    for (const p of players) await p.act(async () => { answers.add(JSON.stringify(survivalStatus(room(), now()).ranking.map((x) => x.uid))); });
    eq(`${label}: ${n}개 화면 순위가 같다`, answers.size, 1);
    for (const p of players) await p.act(() => Room.publishJump(code, { done: true }));
    await host.act(() => Room.endJumpRound(code));
    eq(`${label}: 방이 판 끝 상태`, room().state, 'finished');
    /* 친선 판 — 신발 정산이 끼어들지 않는다 */
    const s = await players[n - 1].act(() => Settle.settleOnce?.(code));
    eq(`${label}: 신발 정산 안 함(순위 기록 없음)`, !!room().result?.rankings, false);
    void s;
  }

  await round('1판');
  const r = await host.act(() => Room.resetRoom(code));
  eq('한 판 더: 방을 다시 열었다', r, 'ok');
  eq('한 판 더: 대기 상태', room().state, 'waiting');
  for (const p of players.slice(1)) await p.act(() => Room.setReady(code, true));
  await round('2판');
  eq('거부된 쓰기 없음', db.denyLog.length, 0);
  if (db.denyLog.length) console.log(db.denyLog.slice(0, 5));
}

await run(3);
await run(8);
console.log(fails ? `\n✗ ${fails}개 실패` : '\n✓ 3명 · 8명 서바이벌 시뮬 통과');
process.exit(fails ? 1 : 0);
