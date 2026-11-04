/**
 * 드래곤 결투 "계속하기" 3판 연속 시뮬 (진단 전용, 2026-11-04)
 *
 *   node --import ./tools/_sim-loader.mjs tools/_dragon-rematch-sim.mjs
 *
 * 신고: *"드래곤 스트라이커 멀티 '한 판 더' 누르면 연속으로 안 되고 게임이 튕김
 *        → 다시 방 만들고 입장해야 함"*
 *
 * 두 사람(A 방장, B)이 한 방에서 세 판을 잇달아 한다. 판마다 누가 먼저
 * "계속하기"를 누르는지 바꾼다 — 이긴 방장 먼저 / 진 사람 먼저 / 방장이 진 판.
 * 가짜 서버(`_sim/rtdb.mjs`)는 진짜 규칙처럼 **남의 칸이 바뀌는 것**을 막는다.
 */
import { FakeDb } from './_sim/rtdb.mjs';
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

let fails = 0;
const eq = (label, got, want) => {
  const a = JSON.stringify(got), b = JSON.stringify(want);
  if (a === b) return console.log(`  ok   ${label}`);
  fails++;
  console.log(`  FAIL ${label}\n       got  ${a}\n       want ${b}`);
};

const db = new FakeDb();
function player(uid, dragon) {
  stores.set(uid, new Map());
  active = stores.get(uid);
  L.resetAll(); L.loadProfile();
  L.patchProfile({ nickname: uid, uid, dragonCharacter: dragon, dragonCoins: 5000 });
  return {
    uid,
    act: async (fn) => { CTX.db = db; CTX.uid = uid; active = stores.get(uid); Room.resetProgressThrottle?.(); return fn(); },
  };
}
const A = player('A', 3);
const B = player('B', 7);
const room = (code) => db.read(`rooms/${code}`);
/** 대기방의 시작 단추가 보는 것 그대로 (`WaitingRoom.render`) */
const allReady = (r) => {
  const inRound = Object.entries(r.players ?? {}).filter(([, v]) => !v.waiting);
  return inRound.length >= 2 && inRound.every(([u, v]) => v.ready || u === r.hostUid);
};

const code = await A.act(() => Room.createRoom({ game: 'dragon' }));
await B.act(() => Room.joinRoom(code, undefined, 'dragon'));
await B.act(() => Room.setReady(code, true));

/** 한 판: 시작 → 진행 → loser 가 죽는다 → 둘 다 끝 → 결과 화면 */
async function playRound(n, loser) {
  const winner = loser === A ? B : A;
  eq(`${n}판: 전원 레디라 방장이 시작할 수 있다`, allReady(room(code)), true);
  await A.act(() => Room.startCountdown(code));
  const seed = room(code).seed;
  for (const p of [A, B]) await p.act(() => Room.holdRoomSeat(code));
  eq(`${n}판: 두 사람 모두 판에 있다`, Object.keys(room(code).players).sort(), ['A', 'B']);
  await winner.act(() => Room.publishDuelProgress(code, { score: 900, coins: 40, bosses: 1, now: true }));
  await loser.act(() => Room.publishDuelProgress(code, { score: 300, coins: 10, bosses: 0, alive: false, now: true }));
  await loser.act(() => Room.publishDuelProgress(code, { score: 300, coins: 10, bosses: 0, alive: false }, true));
  await winner.act(() => Room.publishDuelProgress(code, { score: 900, coins: 40, bosses: 1 }, true));
  /* 결과 화면이 뜨면서 하는 일 */
  for (const p of [A, B]) await p.act(() => Room.rearmRoomSeat(code));
  return seed;
}

/** 결과 화면의 "계속하기" */
const again = (p, seed) => p.act(() => Room.resetRoom(code, { round: seed }));

const orders = [
  { name: '이긴 방장이 먼저 누름', loser: B, first: A, second: B },
  { name: '진 사람(B)이 먼저 누름', loser: B, first: B, second: A },
  { name: '방장이 진 판, 이긴 B 가 먼저 누름', loser: A, first: B, second: A },
];

for (const [i, o] of orders.entries()) {
  const n = i + 1;
  console.log(`\n${n}판) ${o.name}`);
  const seed = await playRound(n, o.loser);
  const r1 = await again(o.first, seed);
  eq(`${n}판: 먼저 누른 ${o.first.uid} 의 계속하기가 된다`, r1, 'ok');
  eq(`${n}판: 방이 다음 판 대기로 돌아왔다`, room(code).state, 'waiting');
  eq(`${n}판: 두 사람 모두 방에 남아 있다`, Object.keys(room(code).players).sort(), ['A', 'B']);
  if (o.second !== A) eq(`${n}판: 아직 안 누른 ${o.second.uid} 는 레디가 아니다 (결과 화면에 둔 채 시작 못 함)`, room(code).players[o.second.uid].ready, false);
  if (o.second !== A) eq(`${n}판: 그래서 방장이 아직 시작할 수 없다`, allReady(room(code)), false);
  eq(`${n}판: 드래곤 얼굴이 그대로다`, [room(code).players.A.dragon, room(code).players.B.dragon], [3, 7]);
  const r2 = await again(o.second, seed);
  eq(`${n}판: 뒤에 누른 ${o.second.uid} 도 된다`, r2, 'ok');
  eq(`${n}판: 이제 둘 다 준비됐다`, allReady(room(code)), true);
}

console.log('\n4판) 남들이 이미 다음 판을 시작했는데 늦게 누른 경우 — 돌고 있는 판을 안 깬다');
{
  const seed = await playRound(4, B);
  await again(A, seed);
  /* B 가 결과 화면에 오래 머무는 동안 B 가 방에서 치워졌다고 하자 (30초 넘게 신호 없음) */
  db.write(`rooms/${code}/players/B`, null);
  /* 혼자 남은 A 에게 새 사람 C 가 들어와 다음 판을 시작했다 */
  const C = player('C', 1);
  await C.act(() => Room.joinRoom(code, undefined, 'dragon'));
  await C.act(() => Room.setReady(code, true));
  await A.act(() => Room.startCountdown(code));
  const live = room(code).seed;
  const r = await again(B, seed);
  eq('늦게 누른 B 의 계속하기도 실패로 안 뜬다', r, 'ok');
  eq('★ 돌고 있는 판은 그대로다 (되돌리지 않는다)', [room(code).state, room(code).seed], ['countdown', live]);
  eq('★ B 는 다음 판 대기자로 앉았다', room(code).players.B?.waiting, true);
}

console.log(fails ? `\n실패 ${fails}건` : '\n시뮬레이션 이상 없음');
process.exit(fails ? 1 : 0);
