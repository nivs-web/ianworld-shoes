/**
 * 멀티 판 시뮬레이터 (진단 전용) — `npm run sim:multi`
 *
 * ## 왜 만들었나
 *
 * "두 명이 게임 중에 나가기를 했는데 신발이 안 넘어가고 튕긴다" 같은 버그는
 * **실기기 두 대 + 계정 두 개**가 있어야 재현된다. 그게 없으면 추측만 하게 된다.
 * 그래서 서버(RTDB)를 메모리로 흉내 내고, **진짜 `multiplayer.js`·`multiSettle.js` 를
 * 그대로 불러** 여러 사람의 순서를 재생한다. 여기서 재현되는 것만 진짜 버그로 본다.
 *
 * 검사하는 것은 하나다 — **신발 총량은 절대 변하지 않는다.**
 * (지갑 합계 + 항아리 = 판 시작 전 합계)
 */

import { FakeDb, clock, advance } from './_sim/rtdb.mjs';
import { CTX } from './_sim/firebase.js';

// ── 사람마다 다른 localStorage ─────────────────
const stores = new Map();
let active = new Map();
globalThis.localStorage = {
  getItem: (k) => (active.has(k) ? active.get(k) : null),
  setItem: (k, v) => active.set(k, String(v)),
  removeItem: (k) => active.delete(k),
};

const Room = await import('../src/services/multiplayer.js');
const Settle = await import('../src/services/multiSettle.js');
const L = await import('../src/services/storageLocal.js');
const M = await import('../src/services/matchRules.js');
const { MULTI } = await import('../src/config/balance.js');

/** 신호가 확실히 끊긴 것으로 보이는 시간 */
const 끊김 = (MULTI.staleSeconds + 30) * 1000;

let fails = 0;
const eq = (label, got, want) => {
  const a = JSON.stringify(got), b = JSON.stringify(want);
  if (a === b) return console.log(`  ok   ${label}`);
  fails++;
  console.log(`  FAIL ${label}\n       got  ${a}\n       want ${b}`);
};

/** 재현 가능한 난수 (mulberry32) — 무작위 순서를 검사하려면 고정할 수 있어야 한다 */
function rng(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

class World {
  constructor() {
    this.db = new FakeDb();
    this.players = new Map();
  }

  player(uid, { shoes = 10, nickname = uid } = {}) {
    stores.set(uid, new Map());
    const p = {
      uid,
      act: async (fn) => {
        CTX.db = this.db; CTX.uid = uid;
        active = stores.get(uid);
        Room.resetProgressThrottle();
        return fn();
      },
      wallet: () => {
        active = stores.get(uid);
        return L.loadProfile().shoesOwned ?? 0;
      },
    };
    this.players.set(uid, p);
    // 지갑 채우기
    active = stores.get(uid);
    L.resetAll();
    L.loadProfile();
    L.addShoes(Array.from({ length: shoes }, (_, i) => i % 130));
    L.patchProfile({ nickname, uid });
    this.players.set(uid, p);
    return p;
  }

  /**
   * 지갑 합계 + **아직 아무도 못 걷은** 항아리 = 총량.
   *
   * 걷은 신발은 승자 지갑에도 들어가고 `given` 에도 남는다(도장이 곧 영수증이다).
   * 그대로 더하면 두 번 세게 되므로, 서버 도장(`result/settled` 비트마스크)이
   * 찍힌 몫은 뺀다 — 정산 코드가 보는 것과 똑같은 기준이다.
   */
  total(code) {
    let sum = 0;
    for (const p of this.players.values()) sum += p.wallet();
    const room = this.db.read(`rooms/${code}`) ?? {};
    const given = room.result?.given ?? {};
    const winner = room.result?.rankings?.[0];
    const 걷은양 = winner ? Room.claimedCounts(room, winner) : {};
    for (const [uid, v] of Object.entries(given)) {
      sum += Math.max(0, (v ?? []).length - (걷은양[uid] ?? 0));
    }
    return sum;
  }
}

/** 한 판을 시작한 상태까지 만든다 */
async function startRound(w, hostP, others) {
  const code = await hostP.act(() => Room.createRoom({}));
  for (const o of others) await o.act(() => Room.joinRoom(code));
  await hostP.act(() => Room.startCountdown(code));
  return code;
}

/** 게임 중 '기권하고 나가기' — GameScene.leave(멀티) 가 하는 일 그대로 */
async function quitMidGame(p, code, { stairs = 0, shoesFound = 0 } = {}) {
  await p.act(async () => {
    await Room.reportDeath(code, { stairs, shoesFound });
    await Room.markOut(code);
  });
  // startMultiGame.onFinish
  await p.act(() => Room.finalizeResult(code).catch(() => null));
}

/** 결과 화면이 하는 일 — 순위가 있으면 정산, 없으면 끝낼 수 있으면 끝낸다 */
async function resultScreen(p, code, { leave = true } = {}) {
  await p.act(async () => {
    const r = await Room.readRoom(code);
    if (r && !r.result?.rankings && M.roundOver(r, Date.now() + Room.serverOffsetSync())) {
      await Room.finalizeResult(code).catch(() => null);
    }
    await Settle.settleRoom(code).catch(() => null);
    if (leave) await Room.leaveRoom(code).catch(() => {});
  });
}

/** 앱을 껐다 켠 다음 도는 청산 */
async function reboot(p) {
  await p.act(() => Settle.sweepUnsettled());
}

// ═══════════════════════════════════════════════
console.log('S1) 두 명이 게임 중에 둘 다 나가기 — 신발이 넘어가야 한다');
{
  const w = new World();
  const A = w.player('A', { shoes: 20 });
  const B = w.player('B', { shoes: 20 });
  const code = await startRound(w, A, [B]);
  const before = w.total(code);

  // A 가 12계단에서 기권, B 는 5계단에서 기권
  await quitMidGame(A, code, { stairs: 12 });
  await quitMidGame(B, code, { stairs: 5 });

  await resultScreen(A, code);
  await resultScreen(B, code);
  await reboot(A);            // 승자는 패자가 늦게 내면 다음 접속에 걷는다

  const room = w.db.read(`rooms/${code}`);
  eq('순위가 박혔다', room?.result?.rankings ?? null, ['A', 'B']);
  eq('총량 보존', w.total(code), before);
  eq('승자 A 가 1켤레 얻었다', A.wallet(), 21);
  eq('패자 B 가 1켤레 잃었다', B.wallet(), 19);
}

console.log('\nS2) 나가기 → 곧바로 로비로 (결과 화면을 스쳐 지나감)');
{
  const w = new World();
  const A = w.player('A', { shoes: 20 });
  const B = w.player('B', { shoes: 20 });
  const code = await startRound(w, A, [B]);
  const before = w.total(code);

  await quitMidGame(A, code, { stairs: 3 });
  // A 가 결과를 안 보고 즉시 로비로 (정산 안 함)
  await A.act(() => Room.leaveRoom(code).catch(() => {}));
  await quitMidGame(B, code, { stairs: 9 });
  await B.act(() => Room.leaveRoom(code).catch(() => {}));

  // 둘 다 다음 접속에 청산
  await reboot(A);
  await reboot(B);

  eq('총량 보존', w.total(code), before);
  eq('승자 B 가 1켤레 얻었다', B.wallet(), 21);
  eq('패자 A 가 1켤레 잃었다', A.wallet(), 19);
}

console.log('\nS3) 한 명이 튕겼다(아무 쓰기도 없이 사라짐) — 판이 끝나야 한다');
{
  const w = new World();
  const A = w.player('A', { shoes: 20 });
  const B = w.player('B', { shoes: 20 });
  const code = await startRound(w, A, [B]);
  const before = w.total(code);

  await A.act(() => Room.publishProgress(code, { stairs: 7, shoesFound: 0 }, true));
  // B 는 여기서 통신이 끊긴다 (alive:true 로 남는다)
  await quitMidGame(A, code, { stairs: 7 });
  advance(끊김);                       // 신호가 끊긴 채 한참
  await resultScreen(A, code);
  await reboot(A);

  const room = w.db.read(`rooms/${code}`);
  eq('판이 끝났다', !!room?.result?.rankings, true);
  eq('총량 보존', w.total(code), before);
}

console.log('\nS4) 부활 100켤레를 걸었는데 상대가 튕겼다');
{
  const w = new World();
  const A = w.player('A', { shoes: 120 });
  const B = w.player('B', { shoes: 20 });
  const code = await startRound(w, A, [B]);
  const before = w.total(code);

  for (let i = 0; i < 5; i++) {
    await A.act(async () => {
      await Room.reportDeath(code, { stairs: 10 + i });
      const picked = M.pickPenaltyShoes(L.loadProfile().shoesByIndex ?? {}, MULTI.reviveCost);
      L.removeShoesByIndex(picked);
      const floor = await Room.reviveMe(code, picked);
      if (floor == null) L.addShoes(picked);
    });
  }
  eq('항아리에 100켤레', (w.db.read(`rooms/${code}/result/given/A`) ?? []).length, 100);

  // B 가 튕긴다 → A 가 기권하고 나온다
  await quitMidGame(A, code, { stairs: 40 });
  advance(끊김);
  await resultScreen(A, code);
  await reboot(A);

  eq('총량 보존', w.total(code), before);
  eq('A 지갑이 사라지지 않았다 (100켤레가 증발하면 여기서 걸린다)', A.wallet() >= 120, true);
}

console.log('\nS5) 마지막 사람이 나가도 방이 남아 정산이 가능하다');
{
  const w = new World();
  const A = w.player('A', { shoes: 20 });
  const B = w.player('B', { shoes: 20 });
  const code = await startRound(w, A, [B]);

  await quitMidGame(A, code, { stairs: 1 });
  await quitMidGame(B, code, { stairs: 2 });
  await A.act(() => Room.leaveRoom(code).catch(() => {}));
  await B.act(() => Room.leaveRoom(code).catch(() => {}));
  const room = w.db.read(`rooms/${code}`);
  eq('순위가 남아 있다', !!room?.result?.rankings, true);
}

console.log('\nS6) 먼저 나간 사람은 판이 끝날 때까지 방에 남는다 (순위에서 사라지면 안 된다)');
{
  const w = new World();
  const A = w.player('A', { shoes: 20 });
  const B = w.player('B', { shoes: 20 });
  const code = await startRound(w, A, [B]);
  const before = w.total(code);

  await quitMidGame(A, code, { stairs: 4 });
  const r = await A.act(() => Room.leaveRoom(code));
  eq('아직 뛰는 사람이 있으면 자리를 지킨다', r, 'kept');
  eq('방에 그대로 있다', !!w.db.read(`rooms/${code}/players/A`), true);

  // B 가 계속 오르다 죽는다
  await B.act(() => Room.publishProgress(code, { stairs: 30, shoesFound: 2 }, true));
  await quitMidGame(B, code, { stairs: 30, shoesFound: 2 });
  await resultScreen(B, code);
  await reboot(A);
  await reboot(B);

  eq('순위는 계단 순', w.db.read(`rooms/${code}/result/rankings`), ['B', 'A']);
  eq('총량 보존', w.total(code), before);
  eq('도망친 A 도 신발을 냈다', A.wallet(), 19);
  eq('B 가 가져갔다', B.wallet(), 21);
}

console.log('\nS7) 일시정지로 30초를 멈춰도 판에서 빠지지 않는다 (생존 신호)');
{
  const w = new World();
  const A = w.player('A', { shoes: 20 });
  const B = w.player('B', { shoes: 20 });
  const code = await startRound(w, A, [B]);

  await quitMidGame(A, code, { stairs: 2 });
  // B 는 일시정지 상태 — 계단은 안 오르지만 생존 신호는 보낸다
  for (let i = 0; i < 6; i++) { advance(5000); await B.act(() => Room.heartbeat(code)); }
  const now = Date.now();
  eq('B 는 아직 판 안에 있다', M.outOfRound({ ...w.db.read(`rooms/${code}/players/B`) }, now), false);
  eq('판은 안 끝났다', M.roundOver(w.db.read(`rooms/${code}`), now), false);

  advance(끊김);   // 신호가 끊긴 채 한참
  eq('신호가 끊기면 빠진다', M.outOfRound({ ...w.db.read(`rooms/${code}/players/B`) }, Date.now()), true);
}

console.log('\nS8) 3인 — 둘이 나가고 한 명이 끝까지 오른다');
{
  const w = new World();
  const A = w.player('A', { shoes: 20 });
  const B = w.player('B', { shoes: 20 });
  const C = w.player('C', { shoes: 20 });
  const code = await startRound(w, A, [B, C]);
  const before = w.total(code);

  await quitMidGame(B, code, { stairs: 5 });
  await quitMidGame(C, code, { stairs: 8 });
  await quitMidGame(A, code, { stairs: 50 });
  for (const p of [A, B, C]) await resultScreen(p, code);
  for (const p of [A, B, C]) await reboot(p);

  eq('순위', w.db.read(`rooms/${code}/result/rankings`), ['A', 'C', 'B']);
  eq('총량 보존', w.total(code), before);
  eq('1등 +2', A.wallet(), 22);
  eq('2등 -1', C.wallet(), 19);
  eq('3등 -1', B.wallet(), 19);
}

console.log('\nS9) 정산을 여러 번 돌려도 지갑은 한 번만 움직인다');
{
  const w = new World();
  const A = w.player('A', { shoes: 20 });
  const B = w.player('B', { shoes: 20 });
  const code = await startRound(w, A, [B]);
  const before = w.total(code);

  await quitMidGame(A, code, { stairs: 9 });
  await quitMidGame(B, code, { stairs: 1 });
  for (let i = 0; i < 3; i++) { await resultScreen(A, code, { leave: false }); await resultScreen(B, code, { leave: false }); }
  for (let i = 0; i < 3; i++) { await reboot(A); await reboot(B); }

  eq('총량 보존', w.total(code), before);
  eq('승자는 한 켤레만', A.wallet(), 21);
  eq('패자도 한 켤레만', B.wallet(), 19);
}

console.log('\nS10) 부활 판돈은 이긴 사람이 통째로 가져간다');
{
  const w = new World();
  const A = w.player('A', { shoes: 60 });
  const B = w.player('B', { shoes: 60 });
  const code = await startRound(w, A, [B]);
  const before = w.total(code);

  // A 가 두 번, B 가 한 번 부활한다
  const revive = async (p, stairs) => p.act(async () => {
    await Room.reportDeath(code, { stairs });
    const picked = M.pickPenaltyShoes(L.loadProfile().shoesByIndex ?? {}, MULTI.reviveCost);
    L.removeShoesByIndex(picked);
    const floor = await Room.reviveMe(code, picked);
    if (floor == null) L.addShoes(picked);
  });
  await revive(A, 10);
  await revive(B, 12);
  await revive(A, 20);

  eq('항아리 = 60 + 기본 1', M.potShoes(w.db.read(`rooms/${code}`)), 61);

  await quitMidGame(A, code, { stairs: 80 });
  await quitMidGame(B, code, { stairs: 30 });
  for (const p of [A, B]) await resultScreen(p, code);
  for (const p of [A, B]) await reboot(p);

  eq('총량 보존', w.total(code), before);
  eq('A(승) = 60 - 40 + 61', A.wallet(), 81);
  eq('B(패) = 60 - 20 - 1', B.wallet(), 39);
}

console.log('\nS11) 둘 다 판 도중에 앱이 죽었다 — 다음 접속에 스스로 정리돼야 한다');
{
  const w = new World();
  const A = w.player('A', { shoes: 20 });
  const B = w.player('B', { shoes: 20 });
  const code = await startRound(w, A, [B]);
  const before = w.total(code);

  await A.act(() => Room.publishProgress(code, { stairs: 11, shoesFound: 0 }, true));
  await B.act(() => Room.publishProgress(code, { stairs: 4, shoesFound: 0 }, true));
  // 여기서 둘 다 앱이 죽는다 — 사망 보고도, 나가기도 없다
  advance(끊김);

  await reboot(A);
  await reboot(B);
  await reboot(A);

  eq('판이 끝났다', w.db.read(`rooms/${code}/result/rankings`), ['A', 'B']);
  eq('총량 보존', w.total(code), before);
  eq('계단 많은 A 가 이겼다', A.wallet(), 21);
  eq('B 가 냈다', B.wallet(), 19);
}

console.log('\nS12) 방에 남아 다음 판 — 초기화되고 다시 정상 정산된다');
{
  const w = new World();
  const A = w.player('A', { shoes: 20 });
  const B = w.player('B', { shoes: 20 });
  const code = await startRound(w, A, [B]);
  const before = w.total(code);

  await quitMidGame(A, code, { stairs: 6 });
  await quitMidGame(B, code, { stairs: 2 });
  await resultScreen(A, code, { leave: false });
  await resultScreen(B, code, { leave: false });
  await resultScreen(A, code, { leave: false });   // 승자 화면의 재수령 폴링

  const r1 = await A.act(() => Room.resetRoom(code));
  eq('되돌리기 성공', r1, 'ok');

  // 두 번째 판
  await A.act(() => Room.startCountdown(code));
  await quitMidGame(B, code, { stairs: 30 });
  await quitMidGame(A, code, { stairs: 5 });
  await resultScreen(B, code, { leave: false });
  await resultScreen(A, code, { leave: false });
  await reboot(B);
  await reboot(A);

  eq('두 번째 판 순위', w.db.read(`rooms/${code}/result/rankings`), ['B', 'A']);
  eq('총량 보존', w.total(code), before);
  eq('A 는 한 판 이기고 한 판 져서 제자리', A.wallet(), 20);
  eq('B 도 제자리', B.wallet(), 20);
}

console.log('\nS13) 먼저 나간 사람을 다음 판에 끌고 가지 않는다 (자동 꼴찌 방지)');
{
  const w = new World();
  const A = w.player('A', { shoes: 20 });
  const B = w.player('B', { shoes: 20 });
  const code = await startRound(w, A, [B]);

  await quitMidGame(A, code, { stairs: 2 });
  const kept = await A.act(() => Room.leaveRoom(code));
  eq('순위가 없으면 자리를 지킨다', kept, 'kept');
  await quitMidGame(B, code, { stairs: 9 });
  await resultScreen(B, code, { leave: false });

  // A 는 앱을 껐다 — 신호가 끊긴 채 4분이 지난다 (미납 대기 시간도 지난다)
  advance(Math.max(끊김, 240000));
  await B.act(() => Room.heartbeat(code));
  await resultScreen(B, code, { leave: false });

  const r = await B.act(() => Room.resetRoom(code));
  eq('되돌리기 성공', r, 'ok');
  eq('자리에 없는 A 는 빠졌다', Object.keys(w.db.read(`rooms/${code}/players`) ?? {}), ['B']);

  // 두 번째 판을 B 혼자 돌린다 — A 는 참가자가 아니므로 아무 손해도 없어야 한다
  const 전 = A.wallet();
  await B.act(() => Room.startCountdown(code));
  await quitMidGame(B, code, { stairs: 3 });
  await resultScreen(B, code, { leave: false });
  await reboot(A);
  eq('A 는 두 번째 판에서 아무것도 잃지 않았다', A.wallet(), 전);
}

console.log('\nS14) 대기방에 앉아 있어도 판이 시작되지 않는다 (신호가 낡아도)');
{
  const w = new World();
  const A = w.player('A', { shoes: 20 });
  const B = w.player('B', { shoes: 20 });
  const code = await A.act(() => Room.createRoom({}));
  await B.act(() => Room.joinRoom(code));
  advance(300000);                                // 5분 동안 대기방에서 수다

  const room = w.db.read(`rooms/${code}`);
  eq('대기방은 끝난 판이 아니다', Room.roundOverNow(room), false);
  const fin = await A.act(() => Room.finalizeResult(code));
  eq('순위를 박을 수 없다', fin, null);
  eq('신발은 그대로', [A.wallet(), B.wallet()], [20, 20]);
}

console.log('\nS15) 튕겼다 돌아온 사람 — 이미 끝난 판에 다시 걸 수 없다');
{
  const w = new World();
  const A = w.player('A', { shoes: 60 });
  const B = w.player('B', { shoes: 60 });
  const code = await startRound(w, A, [B]);
  const before = w.total(code);

  await quitMidGame(A, code, { stairs: 15 });
  advance(끊김);                                  // B 가 튕긴 채 한참
  await resultScreen(A, code, { leave: false });
  eq('판이 끝났다', !!w.db.read(`rooms/${code}/result/rankings`), true);

  // B 가 돌아와 부활을 시도한다
  const floor = await B.act(async () => {
    const picked = M.pickPenaltyShoes(L.loadProfile().shoesByIndex ?? {}, MULTI.reviveCost);
    L.removeShoesByIndex(picked);
    const f = await Room.reviveMe(code, picked);
    if (f == null) L.addShoes(picked);
    return f;
  });
  eq('끝난 판에는 못 건다', floor, null);
  await reboot(B);
  await reboot(A);
  eq('총량 보존', w.total(code), before);
}

console.log('\nS16) 옛 클라이언트가 찍어 둔 비트 도장을 새 코드가 다시 걷지 않는다');
{
  const w = new World();
  const A = w.player('A', { shoes: 20 });
  const B = w.player('B', { shoes: 20 });
  const code = await startRound(w, A, [B]);
  const before = w.total(code);

  await quitMidGame(A, code, { stairs: 9 });
  await quitMidGame(B, code, { stairs: 1 });
  await resultScreen(B, code, { leave: false });     // B 가 먼저 낸다

  // 옛 클라이언트가 한 것처럼 **비트마스크만** 찍고 신발을 걷어 간 상태를 만든다
  const given = w.db.read(`rooms/${code}/result/given`);
  await A.act(async () => {
    L.addShoes(given.B);
    await Room.markSettledRemote(code, null, 1 << 1);   // claims 없이 비트만
  });
  w.db.write(`rooms/${code}/result/claims`, null);

  eq('옛 도장 상태의 총량', w.total(code), before);
  await resultScreen(A, code, { leave: false });       // 새 코드로 다시 정산
  await reboot(A);
  eq('다시 걷지 않았다 (복제 없음)', A.wallet(), 21);
  eq('총량 보존', w.total(code), before);
}

console.log('\nS17) 나눠 낸 신발 — 부활 20켤레 걷은 뒤 기본 1켤레가 늦게 올라온다');
{
  const w = new World();
  const A = w.player('A', { shoes: 40 });
  const B = w.player('B', { shoes: 40 });
  const code = await startRound(w, A, [B]);
  const before = w.total(code);

  await B.act(async () => {
    await Room.reportDeath(code, { stairs: 5 });
    const picked = M.pickPenaltyShoes(L.loadProfile().shoesByIndex ?? {}, MULTI.reviveCost);
    L.removeShoesByIndex(picked);
    const floor = await Room.reviveMe(code, picked);
    if (floor == null) L.addShoes(picked);
  });
  await quitMidGame(A, code, { stairs: 90 });
  await quitMidGame(B, code, { stairs: 30 });

  await resultScreen(A, code, { leave: false });   // 승자가 20켤레를 먼저 걷는다
  eq('먼저 20켤레', A.wallet(), 60);
  await resultScreen(B, code, { leave: false });   // 패자가 기본 1켤레를 뒤늦게 낸다
  await resultScreen(A, code, { leave: false });   // 폴링으로 뒷돈을 걷는다
  eq('뒷돈 1켤레까지', A.wallet(), 61);
  eq('총량 보존', w.total(code), before);
  eq('B = 40 - 20 - 1', B.wallet(), 19);
}

console.log('\nS18) 아무 순서로나 섞어도 신발은 생기지도 사라지지도 않는다 (무작위 60판)');
{
  let 어긋난판 = 0;
  let 안끝난판 = 0;
  let 최악 = null;
  for (let seed = 0; seed < 60; seed++) {
    const rnd = rng(seed * 7919 + 13);
    const w = new World();
    const names = ['A', 'B', 'C'].slice(0, 2 + Math.floor(rnd() * 2));
    const ps = names.map((n) => w.player(n, { shoes: 60 }));
    const code = await startRound(w, ps[0], ps.slice(1));
    const before = w.total(code);

    // 무작위 부활
    for (const p of ps) {
      const n = Math.floor(rnd() * 3);
      for (let i = 0; i < n; i++) {
        await p.act(async () => {
          await Room.reportDeath(code, { stairs: 5 + i });
          const picked = M.pickPenaltyShoes(L.loadProfile().shoesByIndex ?? {}, MULTI.reviveCost);
          if (picked.length < MULTI.reviveCost) return;
          L.removeShoesByIndex(picked);
          const floor = await Room.reviveMe(code, picked);
          if (floor == null) L.addShoes(picked);
        });
      }
    }
    // 무작위 이탈 — 어떤 사람은 그냥 튕긴다(아무 쓰기 없이)
    const shuffled = [...ps].sort(() => rnd() - 0.5);
    for (const p of shuffled) {
      const r = rnd();
      if (r < 0.3) continue;                                   // 튕김
      await quitMidGame(p, code, { stairs: Math.floor(rnd() * 100) });
      if (rnd() < 0.5) await p.act(() => Room.leaveRoom(code).catch(() => {}));
    }
    advance(끊김);                                             // 튕긴 사람의 신호가 끊긴다
    for (const p of shuffled) await resultScreen(p, code, { leave: rnd() < 0.5 });
    for (const p of shuffled) await reboot(p);
    for (const p of shuffled) await reboot(p);

    const after = w.total(code);
    if (after !== before) { 어긋난판++; 최악 = { seed, before, after }; }
    // 판이 안 끝나면 아무도 정산을 못 한다 — 총량은 맞아도 신발이 묶인다
    const room = w.db.read(`rooms/${code}`);
    if (room && !room.result?.rankings) 안끝난판++;
  }
  eq('60판 전부 총량 보존', 어긋난판, 0);
  eq('안 끝난 판 없음', 안끝난판, 0);
  if (최악) console.log('       예:', JSON.stringify(최악));
}

console.log('\nS19) 이긴 사람이 다음 판의 방장이 된다');
{
  const w = new World();
  const A = w.player('A', { shoes: 20 });   // 방을 만든 사람 = 처음 방장
  const B = w.player('B', { shoes: 20 });
  const code = await startRound(w, A, [B]);
  eq('처음엔 만든 사람이 방장', w.db.read(`rooms/${code}/hostUid`), 'A');

  await quitMidGame(A, code, { stairs: 3 });
  await quitMidGame(B, code, { stairs: 40 });          // B 가 이긴다
  await resultScreen(A, code, { leave: false });
  await resultScreen(B, code, { leave: false });

  eq('이긴 B 가 방장', w.db.read(`rooms/${code}/hostUid`), 'B');
  eq('순위', w.db.read(`rooms/${code}/result/rankings`), ['B', 'A']);
}

console.log('\nS20) 한 명이 튕기면 — 계단이 높은 쪽이 걸린 신발을 전부 가져간다');
{
  const w = new World();
  const A = w.player('A', { shoes: 60 });
  const B = w.player('B', { shoes: 60 });
  const code = await startRound(w, A, [B]);
  const before = w.total(code);

  // 둘 다 한 번씩 걸었다 (항아리 40 + 기본 1)
  const revive = (p, stairs) => p.act(async () => {
    await Room.reportDeath(code, { stairs });
    const picked = M.pickPenaltyShoes(L.loadProfile().shoesByIndex ?? {}, MULTI.reviveCost);
    L.removeShoesByIndex(picked);
    const floor = await Room.reviveMe(code, picked);
    if (floor == null) L.addShoes(picked);
  });
  await revive(A, 8);
  await revive(B, 12);

  // A 가 70계단까지 올라간 뒤 **B 가 튕긴다**(30계단에서 아무 쓰기 없이 사라짐)
  await B.act(() => Room.publishProgress(code, { stairs: 30, shoesFound: 0 }, true));
  await A.act(() => Room.publishProgress(code, { stairs: 70, shoesFound: 0 }, true));
  advance(끊김);

  await resultScreen(A, code, { leave: false });
  await reboot(B);        // B 가 나중에 다시 접속한다
  await resultScreen(A, code, { leave: false });

  eq('계단 높은 A 가 1등', w.db.read(`rooms/${code}/result/rankings`), ['A', 'B']);
  eq('총량 보존', w.total(code), before);
  eq('A = 60 - 20 + (40 + 1)', A.wallet(), 81);
  eq('B = 60 - 20 - 1', B.wallet(), 39);
}

console.log(fails ? `\n실패 ${fails}건` : '\n시뮬레이션 이상 없음');
process.exit(fails ? 1 : 0);
