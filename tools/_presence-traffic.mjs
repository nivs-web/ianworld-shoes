/**
 * 접속 목록 전송량 재기 (진단 전용, 2026-11-04 — 권반장 전달 "요금 폭탄")
 *
 *   node --import ./tools/_sim-loader.mjs tools/_presence-traffic.mjs
 *
 * 가짜 서버에 접속자 N명의 카드를 깔고, **진짜 `multiplayer.js`** 로
 *   ① 대기방 청소 한 번(`purgeAbsent` — 대기방에 앉은 사람마다 5초에 한 번)
 *   ② 방 목록 한 번(`listRooms` — 목록을 열 때마다)
 * 을 돌리면서 서버가 내려 준 바이트(JSON 길이)를 센다.
 */
import { FakeDb, advance } from './_sim/rtdb.mjs';
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

/* 서버가 내려 보낸 양 = 읽힌 값의 JSON 길이 (규칙상 읽기는 전부 db.read 를 지난다) */
let bytes = 0;
const read0 = FakeDb.prototype.read;
FakeDb.prototype.read = function (p) {
  const v = read0.call(this, p);
  if (counting) bytes += v == null ? 4 : JSON.stringify(v).length;
  return v;
};
let counting = false;
const measure = async (fn) => { bytes = 0; counting = true; await fn(); counting = false; return bytes; };

function card(i, now) {
  return { nickname: `손님${i}`, characterId: 'ian', shoesOwned: 120, multiWins: 3, multiLosses: 2,
    state: 'lobby', game: 'dragon', coins: 5000, dragon: 3, at: now, lastActive: now };
}

async function run(N) {
  const db = new FakeDb();
  const as = (uid) => { CTX.db = db; CTX.uid = uid; if (!stores.has(uid)) stores.set(uid, new Map()); active = stores.get(uid); };
  as('A'); L.resetAll(); L.loadProfile(); L.patchProfile({ nickname: 'A', uid: 'A' });
  const now = Date.now() + 3500;   // 재기 직전에 살아 있게
  for (let i = 0; i < N; i++) db.write(`presence/u${i}`, card(i, now));
  db.write('presence/A', card('A', now));
  db.write('presence/B', card('B', now));
  const code = await Room.createRoom({ game: 'dragon' });
  as('B'); L.resetAll(); L.loadProfile(); L.patchProfile({ nickname: 'B', uid: 'B' });
  await Room.joinRoom(code, undefined, 'dragon');
  as('A');
  advance(3500);     // 접속 목록 3초 캐시가 비게 (가짜 서버의 시계)
  const purge = await measure(() => Room.purgeAbsent(code));
  advance(3500);
  const list = await measure(() => Room.listRooms('dragon'));
  return { N, purge, list, card: JSON.stringify(card(0, now)).length };
}

const rows = [];
for (const N of [10, 100, 1000, 5000]) rows.push(await run(N));
console.log('접속자N\t대기방청소1회(B)\t방목록1회(B)\t카드1장(B)');
for (const r of rows) console.log(`${r.N}\t${r.purge}\t${r.list}\t${r.card}`);
process.exit(0);
