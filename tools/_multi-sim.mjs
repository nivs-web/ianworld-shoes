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
const 끊김 = (MULTI.absentSeconds + 30) * 1000;

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
  /**
   * ★ 게임 화면이 시작할 때 하는 일을 **여기서도 한다.** (2026-08-19 8차)
   * `startMultiGame` 은 판이 시작되면 자동 이탈 예약을 끄고(`holdRoomSeat`)
   * 자리 지킴을 건다(`armPresence`). 시뮬이 그걸 빼먹으면 **실제와 다른 상태**로
   * 검사하게 된다 — 실제로 이걸 넣자마자 "끊기면 방에서 통째로 사라진다"가 재현됐다.
   */
  for (const p of [hostP, ...others]) {
    await p.act(async () => { await Room.holdRoomSeat(code); await Room.armPresence(code); });
  }
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
console.log('S1) 1:1 — 둘 다 나가면 계단이 높은 쪽이 가져간다');
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
  // 계단이 승부다 — 먼저 기권했어도 12계단 A 가 5계단 B 를 이긴다 (2026-08-19 재확정)
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

  // 1:1 은 한 명이 빠지는 순간 끝나므로, 그 시점의 진행도가 그대로 순위가 된다
  await B.act(() => Room.publishProgress(code, { stairs: 9, shoesFound: 0 }, true));
  await quitMidGame(A, code, { stairs: 3 });
  await quitMidGame(B, code, { stairs: 9 });
  // 둘 다 결과를 안 보고 즉시 로비로 (정산은 다음 접속에)
  await A.act(() => Room.leaveRoom(code).catch(() => {}));
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

  // B 가 튕긴다 → 한참 뒤에 A 가 기권하고 나온다 (그 사이 B 의 신호가 끊긴다)
  advance(끊김);
  await quitMidGame(A, code, { stairs: 40 });
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

console.log('\nS6) 3인 — 먼저 나간 사람은 판이 끝날 때까지 방에 남는다');
{
  const w = new World();
  const A = w.player('A', { shoes: 20 });
  const B = w.player('B', { shoes: 20 });
  const C = w.player('C', { shoes: 20 });
  const code = await startRound(w, A, [B, C]);
  const before = w.total(code);

  await quitMidGame(A, code, { stairs: 4 });
  const r = await A.act(() => Room.leaveRoom(code));
  eq('아직 뛰는 사람이 있으면 자리를 지킨다', r, 'kept');
  eq('방에 그대로 있다', !!w.db.read(`rooms/${code}/players/A`), true);

  // 셋 이상은 한 명이 빠져도 판이 계속된다
  await B.act(() => Room.publishProgress(code, { stairs: 30, shoesFound: 2 }, true));
  await quitMidGame(C, code, { stairs: 10 });
  await quitMidGame(B, code, { stairs: 30, shoesFound: 2 });
  for (const p of [A, B, C]) await resultScreen(p, code, { leave: false });
  for (const p of [A, B, C]) await reboot(p);

  eq('전원이 빠진 뒤에는 계단 순', w.db.read(`rooms/${code}/result/rankings`), ['B', 'C', 'A']);
  eq('총량 보존', w.total(code), before);
  eq('도망친 A 도 신발을 냈다', A.wallet(), 19);
  eq('B 가 둘 몫을 가져갔다', B.wallet(), 22);
}

console.log('\nS7) 일시정지로 30초를 멈춰도 판에서 빠지지 않는다 (생존 신호)');
{
  const w = new World();
  const A = w.player('A', { shoes: 20 });
  const B = w.player('B', { shoes: 20 });
  const C = w.player('C', { shoes: 20 });
  const code = await startRound(w, A, [B, C]);

  await quitMidGame(A, code, { stairs: 2 });
  await quitMidGame(C, code, { stairs: 1 });
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

  await quitMidGame(A, code, { stairs: 9 });     // 계단이 높으니 먼저 나가도 승리
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

  // 계단이 승부다 — 80계단 A 가 30계단 B 를 이긴다
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

  await A.act(() => Room.publishProgress(code, { stairs: 6, shoesFound: 0 }, true));
  await quitMidGame(B, code, { stairs: 2 });   // 계단이 낮은 B 가 진다
  await quitMidGame(A, code, { stairs: 6 });
  await resultScreen(A, code, { leave: false });
  await resultScreen(B, code, { leave: false });
  await resultScreen(A, code, { leave: false });   // 승자 화면의 재수령 폴링

  const r1 = await A.act(() => Room.resetRoom(code));
  eq('되돌리기 성공', r1, 'ok');

  // 두 번째 판
  await A.act(() => Room.startCountdown(code));
  await B.act(() => Room.publishProgress(code, { stairs: 30, shoesFound: 0 }, true));
  await quitMidGame(A, code, { stairs: 5 });    // 계단이 낮은 A 가 진다
  await quitMidGame(B, code, { stairs: 30 });
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
  const C = w.player('C', { shoes: 20 });
  const code = await startRound(w, A, [B, C]);

  await quitMidGame(A, code, { stairs: 2 });
  const kept = await A.act(() => Room.leaveRoom(code));
  eq('순위가 없으면 자리를 지킨다', kept, 'kept');
  await quitMidGame(C, code, { stairs: 4 });
  await quitMidGame(B, code, { stairs: 9 });
  await resultScreen(B, code, { leave: false });
  await resultScreen(C, code, { leave: true });

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

  await A.act(() => Room.publishProgress(code, { stairs: 9, shoesFound: 0 }, true));
  await quitMidGame(B, code, { stairs: 1 });        // 계단이 낮은 B 가 패자
  await quitMidGame(A, code, { stairs: 9 });
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
  await A.act(() => Room.publishProgress(code, { stairs: 90, shoesFound: 0 }, true));
  await quitMidGame(B, code, { stairs: 30 });     // 계단이 낮은 B 가 패자
  await quitMidGame(A, code, { stairs: 90 });

  await resultScreen(A, code, { leave: false });   // 승자가 20켤레를 먼저 걷는다
  eq('먼저 20켤레', A.wallet(), 60);
  await resultScreen(B, code, { leave: false });   // 패자가 기본 1켤레를 뒤늦게 낸다
  await resultScreen(A, code, { leave: false });   // 폴링으로 뒷돈을 걷는다
  eq('뒷돈 1켤레까지', A.wallet(), 61);
  eq('총량 보존', w.total(code), before);
  eq('B = 40 - 20 - 1', B.wallet(), 19);
}

/**
 * 판 수와 시작 시드를 밖에서 정할 수 있다 — `SIM_ROUNDS=300 SIM_SEED=1000 npm run sim:multi`.
 * 고정 60판만 돌면 **매번 똑같은 60판**이라 반복 실행에 아무 의미가 없다.
 * 시드를 옮겨 가며 수백 판을 돌려야 순서 버그가 드러난다.
 */
const 판수 = Number(process.env.SIM_ROUNDS ?? 60);
const 시드시작 = Number(process.env.SIM_SEED ?? 0);
console.log(`\nS18) 아무 순서로나 섞어도 신발은 생기지도 사라지지도 않는다 (무작위 ${판수}판, 시드 ${시드시작}~)`);
{
  let 어긋난판 = 0;
  let 안끝난판 = 0;
  let 최악 = null;
  for (let seed = 시드시작; seed < 시드시작 + 판수; seed++) {
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
    /**
     * ★ **무작위 끊김·복귀** (2026-08-19 8차, 사용자 신고 반영)
     * 전화를 받거나 앱을 전환하는 것이 실제 대전에서 제일 흔한 사건인데
     * 시뮬에는 그 사건이 아예 없었다 — 없는 사건은 검사도 못 한다.
     */
    for (const p of ps) {
      const r = rnd();
      if (r < 0.25) {
        w.db.dropConnection(p.uid);
        advance(Math.floor(rnd() * 40000));              // 잠깐 자리를 비운다
        if (rnd() < 0.7) {                                // 대부분은 돌아온다
          w.db.restoreConnection(p.uid);
          await p.act(async () => {
            await new Promise((res) => setTimeout(res, 0));
            await Room.rejoinIfDropped(code, { stairs: 5 }).catch(() => {});
            await Room.heartbeat(code).catch(() => {});
          });
        }
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
  eq(`${판수}판 전부 총량 보존`, 어긋난판, 0);
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

  await B.act(() => Room.publishProgress(code, { stairs: 40, shoesFound: 0 }, true));
  await quitMidGame(A, code, { stairs: 3 });
  await quitMidGame(B, code, { stairs: 40 });          // 계단이 높은 B 가 이긴다
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

console.log('\nS21) 1:1 — 부활 창이 지나면 판이 끝나고, 계단이 높은 쪽이 가져간다');
{
  const w = new World();
  const A = w.player('A', { shoes: 20 });
  const B = w.player('B', { shoes: 20 });
  const code = await startRound(w, A, [B]);
  const before = w.total(code);

  // B 가 앞선 상태에서 A 가 떨어지고, 부활도 하지 않는다
  await A.act(() => Room.publishProgress(code, { stairs: 12, shoesFound: 0 }, true));
  await B.act(() => Room.publishProgress(code, { stairs: 90, shoesFound: 0 }, true));
  await A.act(() => Room.reportDeath(code, { stairs: 12, shoesFound: 0 }));

  const 죽은직후 = w.db.read(`rooms/${code}`);
  eq('부활 창 동안은 안 끝난다', M.roundOver(죽은직후, Date.now()), false);

  advance((MULTI.reviveWindowSeconds + 1) * 1000);
  eq('창이 지나면 끝난다', M.roundOver(w.db.read(`rooms/${code}`), Date.now()), true);

  await resultScreen(B, code, { leave: false });
  await resultScreen(A, code, { leave: false });
  await reboot(B);

  eq('계단이 높은 B 가 1등', w.db.read(`rooms/${code}/result/rankings`), ['B', 'A']);
  eq('총량 보존', w.total(code), before);
  eq('A 가 신발을 뺏겼다', A.wallet(), 19);
  eq('B 가 가져갔다', B.wallet(), 21);
}

console.log('\nS22-pre) "계속하기" 후 다음 판 — 기존 참가자는 레디가 자동으로 켜진다 (2026-08-19)');
{
  const w = new World();
  const A = w.player('A', { shoes: 20 });
  const B = w.player('B', { shoes: 20 });
  const code = await startRound(w, A, [B]);

  await quitMidGame(B, code, { stairs: 2 });
  await quitMidGame(A, code, { stairs: 6 });
  await resultScreen(A, code, { leave: false });
  await resultScreen(B, code, { leave: false });

  await A.act(() => Room.resetRoom(code));
  const players = w.db.read(`rooms/${code}/players`);
  /**
   * 예전에는 둘 다 `ready: false` 로 돌아가 매 판마다 다시 레디를 눌러야 했다.
   * "계속하기"를 누른 시점에 이미 다음 판 의사를 밝힌 것이므로, 기존 참가자는
   * 레디가 자동으로 켜진 채로 대기방에 들어가야 한다 — 방장만 [시작하기]를 누르면 된다.
   */
  eq('A(방장)도 자동 레디', players.A.ready, true);
  eq('B(참가자)도 자동 레디', players.B.ready, true);

  // 새로 들어오는 사람은 여전히 스스로 레디해야 한다 — 자동 레디가 아니다
  const C = w.player('C', { shoes: 20 });
  await C.act(() => Room.joinRoom(code));
  eq('신규 참가자는 레디가 꺼진 채로 들어온다', w.db.read(`rooms/${code}/players/C/ready`), false);
}

console.log('\nS22) 판 도중 주운 신발도 1등이 가져간다 — 개수만큼 새로 굴려 받는다 (2026-08-19)');
{
  const w = new World();
  const A = w.player('A', { shoes: 20 }); // 패자, 판 중에 5개 주웠다
  const B = w.player('B', { shoes: 20 }); // 승자, 판 중에 0개
  const code = await startRound(w, A, [B]);
  const before = w.total(code);

  await A.act(() => Room.publishProgress(code, { stairs: 10, shoesFound: 5 }, true));
  await B.act(() => Room.publishProgress(code, { stairs: 40, shoesFound: 0 }, true));
  await A.act(() => Room.reportDeath(code, { stairs: 10, shoesFound: 5 }));
  advance((MULTI.reviveWindowSeconds + 1) * 1000);

  await resultScreen(B, code, { leave: false });
  await resultScreen(A, code, { leave: false });
  await reboot(B); // A 가 늦게 낸 기본 1켤레를 B 가 마저 걷는다 (S21과 같은 패턴)

  eq('계단 높은 B 가 1등', w.db.read(`rooms/${code}/result/rankings`), ['B', 'A']);
  /**
   * ★ **여기서는 "총량 보존"이 아니라 "총량이 정확히 5만큼 늘어난다"를 본다.**
   * 패자가 주운 5개는 실물이 아무 지갑에도 없었으므로(개수만 방으로 왔다) 승자에게
   * 그대로 옮길 수 없다 — 그 개수만큼 새로 굴려 승자 지갑에 넣는 게 이 기능이다.
   * 그래서 A+B 지갑 합이 이전보다 정확히 5 늘어야 정상이고, 그대로면(=5 안 늘면)
   * 패자가 주운 신발이 다시 증발하고 있다는 뜻이다.
   */
  eq('패자가 낸 기본 1켤레 + 주운 5개 = 승자 지갑이 6 늘었다', B.wallet(), 26);
  eq('패자는 기본 1켤레만 잃는다(주운 건 원래 자기 지갑에 없었다)', A.wallet(), 19);
  eq('총량이 주운 개수(5)만큼 늘었다 — 사라지지 않고 승자에게 새로 갔다', w.total(code), before + 5);
}

console.log('\nS22-b) ★ 패자가 **먼저 방을 나가도** 주운 신발이 승자에게 간다 (2026-08-19 신고)');
{
  /**
   * S22 는 패자가 방에 **남아 있는** 상태에서만 검사해서 통과했다. 그런데 실제 대전에서는
   * 패자가 결과 화면에서 곧장 나간다(`leaveRoom` 이 `players/<uid>` 를 통째로 지운다).
   * `shoesFound` 는 `players` 안에만 있으므로, 그 순간 **승자가 셀 근거가 사라진다.**
   * 사용자가 "게임 중에 먹은 신발이 어디로 사라지는지 모르겠다"고 여러 번 신고한 게 이것이다.
   */
  const w = new World();
  const A = w.player('A', { shoes: 20 }); // 패자, 판 중에 5개 주웠다
  const B = w.player('B', { shoes: 20 }); // 승자
  const code = await startRound(w, A, [B]);
  const before = w.total(code);

  await A.act(() => Room.publishProgress(code, { stairs: 10, shoesFound: 5 }, true));
  await B.act(() => Room.publishProgress(code, { stairs: 40, shoesFound: 3 }, true));
  await A.act(() => Room.reportDeath(code, { stairs: 10, shoesFound: 5 }));
  advance((MULTI.reviveWindowSeconds + 1) * 1000);

  // 패자가 **먼저** 결과 화면을 보고 그대로 나간다 (실제 사용자 행동)
  await resultScreen(A, code, { leave: true });
  // 그 뒤에야 승자가 정산한다
  await resultScreen(B, code, { leave: false });
  await reboot(B);

  eq('계단 높은 B 가 1등', w.db.read(`rooms/${code}/result/rankings`), ['B', 'A']);
  eq('패자가 나갔어도 주운 5개가 승자에게 갔다', B.wallet(), 26);
  eq('총량이 주운 개수(5)만큼 늘었다', w.total(code), before + 5);
}

console.log('\nS22-c) ★ 4인 — 주운 신발 전부가 1등에게. 각자 나가는 시점이 제각각이다');
{
  /**
   * 사용자 신고: "여러 명이서 동시에 계산해 보면 안 맞는다."
   * 실제 4인 판을 그대로 흉내 낸다 — 죽는 순서도, 나가는 시점도 제각각이다.
   *
   *   A 주움 4 · B 주움 2 · C 주움 3 · D(승자) 주움 5
   *   승자가 받을 것 = 판돈(기본 1×3) + 남들이 주운 것(4+2+3 = 9)
   */
  const w = new World();
  const A = w.player('A', { shoes: 20 });
  const B = w.player('B', { shoes: 20 });
  const C = w.player('C', { shoes: 20 });
  const D = w.player('D', { shoes: 20 });
  const code = await startRound(w, A, [B, C, D]);
  const before = w.total(code);

  await A.act(() => Room.publishProgress(code, { stairs: 10, shoesFound: 4 }, true));
  await B.act(() => Room.publishProgress(code, { stairs: 14, shoesFound: 2 }, true));
  await C.act(() => Room.publishProgress(code, { stairs: 18, shoesFound: 3 }, true));
  await D.act(() => Room.publishProgress(code, { stairs: 40, shoesFound: 5 }, true));

  // 셋이 차례로 죽고 부활을 포기한다
  await A.act(() => Room.reportDeath(code, { stairs: 10, shoesFound: 4 }));
  await B.act(() => Room.reportDeath(code, { stairs: 14, shoesFound: 2 }));
  await C.act(() => Room.reportDeath(code, { stairs: 18, shoesFound: 3 }));
  // 셋 이상이면 마지막 한 명은 계속 오른다(§9-0-28) — D 도 끝나야 판이 닫힌다
  await D.act(() => Room.reportDeath(code, { stairs: 40, shoesFound: 5 }));
  advance((MULTI.reviveWindowSeconds + 1) * 1000);

  // 나가는 시점이 제각각 — A 는 결과도 안 보고 바로, B 는 보고 나가고, C 는 남는다
  await A.act(() => Room.leaveRoom(code).catch(() => {}));
  await resultScreen(B, code, { leave: true });
  await resultScreen(C, code, { leave: false });
  await resultScreen(D, code, { leave: false });
  await reboot(D);

  eq('계단 최고 D 가 1등', w.db.read(`rooms/${code}/result/rankings`)?.[0], 'D');
  /**
   * A 는 결과 화면도 안 보고 나갔으므로 아직 기본 1켤레를 안 냈다 — **잃은 게 아니라
   * 미납**이다. 다음 접속의 청산(`sweepUnsettled`)이 받아 내고 승자가 마저 걷는다.
   */
  eq('아직은 판돈 2 + 주운 9 (A 미납)', D.wallet(), 31);
  await reboot(A);            // A 가 다시 접속 → 밀린 1켤레를 낸다
  await reboot(D);            // D 가 그것을 걷는다
  // D = 20 + 판돈 3 + 남들이 주운 9 = 32
  eq('A 가 재접속하면 판돈 3 + 주운 9 가 전부 모인다', D.wallet(), 32);
  eq('A 는 기본 1켤레만 잃는다', A.wallet(), 19);
  eq('B·C 도 기본 1켤레씩만', [B.wallet(), C.wallet()], [19, 19]);
  eq('총량이 남들이 주운 만큼(9) 늘었다', w.total(code), before + 9);
}

console.log('\nS22-d) ★ 화면에 뜬 판돈 = 1등이 실제로 얻는 양 (표시와 정산이 같은 식)');
{
  /**
   * 사용자 신고: "계산해 보면 안 맞는다."
   * 화면 하단 `1등하면 신발 N켤레!` 는 판돈만 세고 **주운 신발을 빼먹고 있었다.**
   * 그런데 1등은 주운 것까지 전부 가져가므로 실제 수령액이 늘 더 컸다.
   * 이제 둘이 같은 식을 쓴다 — 그것을 여기서 못 박는다.
   */
  const w = new World();
  const A = w.player('A', { shoes: 60 });
  const B = w.player('B', { shoes: 60 });
  const C = w.player('C', { shoes: 60 });
  const code = await startRound(w, A, [B, C]);
  const beforeB = B.wallet();

  await A.act(() => Room.publishProgress(code, { stairs: 10, shoesFound: 4 }, true));
  await C.act(() => Room.publishProgress(code, { stairs: 12, shoesFound: 3 }, true));
  await B.act(() => Room.publishProgress(code, { stairs: 30, shoesFound: 6 }, true));
  // A 가 한 번 부활한다 (판돈 20켤레 추가)
  await A.act(() => Room.reportDeath(code, { stairs: 10, shoesFound: 4 }));
  await A.act(async () => {
    const picked = M.pickPenaltyShoes(L.loadProfile().shoesByIndex ?? {}, MULTI.reviveCost);
    L.removeShoesByIndex(picked);           // ★ 지갑에서 먼저 뺀다 (실제 순서와 같게)
    const floor = await Room.reviveMe(code, picked);
    if (floor == null) L.addShoes(picked);  // 실패하면 되돌린다
  });
  await A.act(() => Room.publishProgress(code, { stairs: 50, shoesFound: 4 }, true));

  await A.act(() => Room.reportDeath(code, { stairs: 50, shoesFound: 4 }));
  await C.act(() => Room.reportDeath(code, { stairs: 12, shoesFound: 3 }));
  await B.act(() => Room.reportDeath(code, { stairs: 30, shoesFound: 6 }));
  advance((MULTI.reviveWindowSeconds + 1) * 1000);

  // 순위가 박히기 직전, 화면이 보여 주던 숫자를 그대로 잰다
  const roomBefore = await Room.readRoom(code);
  const 화면 = M.potShoes(roomBefore);

  await resultScreen(A, code, { leave: true });
  await resultScreen(C, code, { leave: true });
  await resultScreen(B, code, { leave: false });
  await reboot(A);   // 승자가 늦게 올라온 판돈을 마저 걷는다 (S21·S22 와 같은 패턴)

  const winner = w.db.read(`rooms/${code}/result/rankings`)?.[0];
  eq('부활한 A 가 계단 50 으로 1등', winner, 'A');

  /**
   * 검산. **정산이 주는 것 + 내가 주운 것 = 화면에 뜬 숫자** 여야 한다.
   *
   * 시뮬레이터는 `finishRun`(승자 자신의 판 기록 반영)을 돌리지 않는다 — 그건 화면
   * (`MultiResult.js`)의 일이라 여기 범위 밖이다. 그래서 승자 자신이 주운 4켤레는
   * 지갑에 안 들어와 있고, 그만큼을 더해야 화면 숫자와 맞는다.
   *
   *   화면 = 판돈 22 + 모두가 주운 것 13 = 35
   *   정산 = 판돈 22 + 남이 주운 것 9  = 31,  거기에 내가 주운 4 = 35 ✓
   */
  const 정산으로얻은양 = A.wallet() - (60 - MULTI.reviveCost);
  const 내가주운것 = w.db.read(`rooms/${code}/result/found/A`);
  eq('정산 + 내 습득 = 화면에 뜬 판돈', 정산으로얻은양 + 내가주운것, 화면);
  eq('총량은 남들이 주운 만큼(3+6=9) 늘었다', w.total(code), 180 + 9);
}

console.log('\nS23) 판 도중 주운 신발 — 승자 자신의 몫은 중복으로 세지 않는다');
{
  const w = new World();
  const A = w.player('A', { shoes: 20 }); // 승자, 자기가 3개 주웠다 — finishRun 이 별도로 반영
  const B = w.player('B', { shoes: 20 }); // 패자, 0개
  const code = await startRound(w, A, [B]);
  const before = w.total(code);

  await A.act(() => Room.publishProgress(code, { stairs: 40, shoesFound: 3 }, true));
  await B.act(() => Room.publishProgress(code, { stairs: 10, shoesFound: 0 }, true));
  await B.act(() => Room.reportDeath(code, { stairs: 10, shoesFound: 0 }));
  advance((MULTI.reviveWindowSeconds + 1) * 1000);

  await resultScreen(A, code, { leave: false });
  await resultScreen(B, code, { leave: false });
  await reboot(A); // B 가 늦게 낸 기본 1켤레를 A 가 마저 걷는다

  eq('계단 높은 A 가 1등', w.db.read(`rooms/${code}/result/rankings`), ['A', 'B']);
  /**
   * A 의 3개는 이 시뮬레이터가 흉내내지 않는 `finishRun(runResult.shoeIndices)` 몫이라
   * (그건 GameScene/profile.js 쪽 코드다) 여기서는 정산이 그 3개를 **또** 굴리지 않는지만
   * 본다 — 늘어나는 건 패자 몫(0)뿐이므로 판돈(기본 1켤레)만큼만 옮겨가야 한다.
   */
  eq('패자 몫(0)만 더해졌다 — 승자는 판돈 1켤레만 받는다', A.wallet(), 21);
  eq('패자는 1켤레를 잃는다', B.wallet(), 19);
  eq('총량 보존 (패자의 주운 개수가 0 이므로 새로 굴린 신발도 0)', w.total(code), before);
}

console.log('\nS24) 30초 안에 돌아오면 계속 게임할 수 있다');
{
  /**
   * ★ 사용자 신고: **"전화를 받거나 창 밖으로 잠깐 빠져나갔다가 돌아오면 거의 튕긴다"**
   *
   * 브라우저는 탭이 뒤로 가면 `setInterval` 을 1분에 한 번으로 조이고, 폰은 페이지를
   * 아예 얼린다 — 그동안 `seenAt` 이 안 나간다. 예전 기준(90초)이면 2분짜리 통화 한 번에
   * 판에서 빠졌다. 이제 **소켓이 살아 있으면(=`offAt` 이 없으면) 조용해도 자리를 지킨다.**
   */
  const w = new World();
  const A = w.player('A', { shoes: 20 });
  const B = w.player('B', { shoes: 20 });
  const code = await startRound(w, A, [B]);

  await A.act(() => Room.publishProgress(code, { stairs: 40, shoesFound: 0 }, true));
  await B.act(() => Room.publishProgress(code, { stairs: 60, shoesFound: 0 }, true));

  // B 가 20초 동안 아무 신호도 못 보낸다 (문자를 확인하고 돌아온다)
  advance(20000);
  const 지금 = Date.now();
  const room1 = w.db.read(`rooms/${code}`);
  eq('30초 안이면 판에서 안 빠진다', M.outOfRound({ uid: 'B', ...room1.players.B }, 지금), false);
  eq('그래서 판도 안 끝난다', M.roundOver(room1, 지금), false);

  // 돌아왔다 — 신호를 보내고 계속 뛴다
  await B.act(() => Room.heartbeat(code));
  await B.act(() => Room.publishProgress(code, { stairs: 75, shoesFound: 2 }, true));
  const room2 = w.db.read(`rooms/${code}`);
  eq('돌아와서 계속 오른다', room2.players.B.stairs, 75);
  eq('여전히 판 안에 있다', M.outOfRound({ uid: 'B', ...room2.players.B }, Date.now()), false);
}

console.log('\nS25) 정말 끊겼다 — 서버가 찍은 시각부터 유예가 흐른다');
{
  /**
   * 자리 지킴의 반대쪽. 소켓이 죽으면 **서버가 그 순간을 `offAt` 에 찍는다.**
   * 그러면 어림할 필요가 없다 — 유예(45초)가 지나면 판에서 뺀다.
   * 예전 방식(마지막 신호로부터 90초)보다 **빠르고 정확하다.**
   */
  const w = new World();
  const A = w.player('A', { shoes: 20 });
  const B = w.player('B', { shoes: 20 });
  const code = await startRound(w, A, [B]);

  await A.act(() => Room.publishProgress(code, { stairs: 70, shoesFound: 0 }, true));
  await B.act(() => Room.publishProgress(code, { stairs: 30, shoesFound: 0 }, true));

  w.db.dropConnection('B');                        // 소켓이 죽었다
  const 끊긴직후 = w.db.read(`rooms/${code}`);
  eq('서버가 끊긴 시각을 찍었다', typeof 끊긴직후.players.B.offAt, 'number');
  eq('끊기자마자 빼지는 않는다', M.outOfRound({ uid: 'B', ...끊긴직후.players.B }, Date.now()), false);

  advance((MULTI.absentSeconds + 5) * 1000);
  const 유예후 = w.db.read(`rooms/${code}`);
  eq('유예가 지나면 판에서 빠진다', M.outOfRound({ uid: 'B', ...유예후.players.B }, Date.now()), true);
  eq('1:1 이라 판이 끝난다', M.roundOver(유예후, Date.now()), true);

  // 계단이 높은 A 가 가져간다 (§9-0-30 사용자 확정 규칙)
  const before = w.total(code);
  await A.act(() => Room.finalizeResult(code));
  const room = w.db.read(`rooms/${code}`);
  eq('순위는 계단 순', room.result.rankings, ['A', 'B']);
  await resultScreen(A, code);
  await reboot(B);
  eq('총량 보존', w.total(code), before);
}

console.log('\nS26) 돌아와서 다시 붙으면 끊김 표시가 지워진다');
{
  const w = new World();
  const A = w.player('A', { shoes: 20 });
  const B = w.player('B', { shoes: 20 });
  const code = await startRound(w, A, [B]);
  w.db.dropConnection('B');
  advance(20000);                                   // 유예(45초) 안에 돌아온다
  eq('아직 판 안에 있다',
    M.outOfRound({ uid: 'B', ...w.db.read(`rooms/${code}`).players.B }, Date.now()), false);

  // 다시 붙었다 — `.info/connected` 가 true 로 돌아오면 클라이언트가 알아서 정리한다
  await B.act(async () => { w.db.restoreConnection('B'); await new Promise((r) => setTimeout(r, 0)); });
  const room = w.db.read(`rooms/${code}`);
  eq('끊김 표시가 지워졌다', room.players.B.offAt ?? null, null);
  await B.act(() => Room.heartbeat(code));
  advance(20000);
  eq('그 뒤로는 30초 안이면 안 빠진다',
    M.outOfRound({ uid: 'B', ...w.db.read(`rooms/${code}`).players.B }, Date.now()), false);
}

console.log('\nS27) 끊긴 사이에 방에서 지워졌다 — 돌아오면 자리를 되찾는다');
{
  /**
   * 옛 클라이언트가 걸어 둔 `onDisconnect(...).remove()` 나, 취소가 서버에 닿기 전에
   * 끊긴 경우 — **잠깐 끊긴 것만으로 `players/<나>` 가 통째로 지워진다.**
   * 돌아와도 방에 내가 없으니 순위에도 못 들고 판돈도 못 받는다.
   * 게임 화면의 생존 신호가 그 상태를 발견하면 **지금 진행도 그대로** 다시 넣는다.
   */
  const w = new World();
  const A = w.player('A', { shoes: 20 });
  const B = w.player('B', { shoes: 20 });
  const code = await startRound(w, A, [B]);
  await B.act(() => Room.publishProgress(code, { stairs: 44, shoesFound: 3 }, true));

  // 옛 예약이 남아 있었다고 치고 강제로 지운다
  w.db.write(`rooms/${code}/players/B`, null);
  eq('방에서 사라졌다', w.db.read(`rooms/${code}/players/B`), null);

  const 되찾음 = await B.act(() => Room.rejoinIfDropped(code, { stairs: 44, shoesFound: 3, alive: true }));
  eq('자리를 되찾았다', 되찾음, true);
  const me = w.db.read(`rooms/${code}/players/B`);
  eq('진행도가 그대로', [me?.stairs, me?.shoesFound], [44, 3]);
  eq('판에도 다시 들어갔다', M.playersInRound(w.db.read(`rooms/${code}`).players).length, 2);
}

console.log('\nS28) 이미 끝난 판에는 다시 들어가지 않는다');
{
  const w = new World();
  const A = w.player('A', { shoes: 20 });
  const B = w.player('B', { shoes: 20 });
  const code = await startRound(w, A, [B]);
  await quitMidGame(A, code, { stairs: 30 });
  await quitMidGame(B, code, { stairs: 10 });
  eq('순위가 박혔다', !!w.db.read(`rooms/${code}`).result?.rankings, true);

  w.db.write(`rooms/${code}/players/B`, null);
  const 되찾음 = await B.act(() => Room.rejoinIfDropped(code, { stairs: 10 }));
  eq('끝난 판에는 안 들어간다', 되찾음, false);
  eq('명단도 그대로', w.db.read(`rooms/${code}/players/B`), null);
}

console.log('\nS29) 방만 만들고 창을 닫은 사람 — 유령으로 안 남는다');
{
  /**
   * ★ 사용자 신고: *"게임을 안하는 유저가 방 만들고 창을 닫거나 내려두면 (…)
   * 유령처럼 남아있는 버그가 존재함"*
   *
   * `onDisconnect` 는 **소켓이 죽어야** 발동한다. 창을 내려두기만 하면 소켓은 살아
   * 있으니 서버는 그 사람을 접속 중으로 본다 — 영원히 앉아서 레디를 안 누른다.
   * 그래서 **방을 보고 있는 사람이 치운다.**
   */
  const w = new World();
  const A = w.player('A', { shoes: 20 });     // 방만 만들고 창을 내려둔 사람
  const B = w.player('B', { shoes: 20 });
  const code = await A.act(() => Room.createRoom({}));
  await B.act(() => Room.joinRoom(code));

  advance((MULTI.absentSeconds + 5) * 1000);  // A 의 신호가 끊긴 채 30초를 넘긴다
  await B.act(() => Room.heartbeat(code));    // B 는 화면을 보고 있다

  const 치움 = await B.act(() => Room.purgeAbsent(code));
  eq('유령 한 명을 치웠다', 치움, 1);
  const room = w.db.read(`rooms/${code}`);
  eq('A 가 방에서 빠졌다', room.players?.A ?? null, null);
  eq('B 는 그대로', !!room.players?.B, true);
  eq('방장도 B 로 넘어갔다', room.hostUid, 'B');
  eq('자리가 났으니 다시 열린다', room.open, true);
}

console.log('\nS30) 판이 도는 중에는 자리를 지운다 (순위·정산의 근거가 사라진다)');
{
  const w = new World();
  const A = w.player('A', { shoes: 20 });
  const B = w.player('B', { shoes: 20 });
  const code = await startRound(w, A, [B]);    // state = countdown/playing
  await A.act(() => Room.publishProgress(code, { stairs: 10, shoesFound: 0 }, true));
  advance((MULTI.absentSeconds + 5) * 1000);

  const 치움 = await A.act(() => Room.purgeAbsent(code));
  eq('대기 중이 아니면 아무도 안 치운다', 치움, 0);
  eq('B 는 방에 그대로 있다', !!w.db.read(`rooms/${code}`).players?.B, true);
  // 대신 판정으로 빠진다 — 자리는 남기고 순위에서만 뺀다
  eq('그래도 판에서는 빠진다',
    M.outOfRound({ uid: 'B', ...w.db.read(`rooms/${code}`).players.B }, Date.now() ), true);
}

console.log('\nS31) 판이 끝나 신발이 오가면 카드의 보유 신발 수도 따라간다');
{
  /**
   * ★ 사용자 신고: *"신발 200개를 갖고 있는 사람이 150개를 잃으면 (…)
   * 이전 신발 갯수가 그대로 노출됨"*
   * `shoesOwned` 는 입장 시점 스냅샷이라 판이 끝나도 안 바뀐다.
   */
  const w = new World();
  const A = w.player('A', { shoes: 20 });
  const B = w.player('B', { shoes: 20 });
  const code = await startRound(w, A, [B]);
  eq('입장 시점 스냅샷', w.db.read(`rooms/${code}/players/B`).shoesOwned, 20);

  await quitMidGame(A, code, { stairs: 30 });
  await quitMidGame(B, code, { stairs: 5 });
  await resultScreen(A, code, { leave: false });
  await resultScreen(B, code, { leave: false });   // B 가 1켤레 잃는다

  eq('지갑은 실제로 줄었다', B.wallet(), 19);
  eq('그런데 카드는 아직 옛 숫자', w.db.read(`rooms/${code}/players/B`).shoesOwned, 20);

  const 갱신 = await B.act(() => Room.refreshMyCard(code));
  eq('갱신했다', 갱신, true);
  eq('카드도 새 숫자', w.db.read(`rooms/${code}/players/B`).shoesOwned, 19);

  // 값이 같으면 헛쓰기를 하지 않는다 (대기방이 스냅샷마다 부른다)
  eq('두 번째는 안 쓴다', await B.act(() => Room.refreshMyCard(code)), false);
}

console.log(fails ? `\n실패 ${fails}건` : '\n시뮬레이션 이상 없음');
process.exit(fails ? 1 : 0);
