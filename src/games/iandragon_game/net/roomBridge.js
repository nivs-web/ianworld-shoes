/**
 * 서버(RTDB 방) 통로 (3차 멀티 · 2026-11-11 · 멀티 기획 3.4 · M3) — localTransport 와 같은 모양 { send, onMessage, close }.
 * 내 묶음은 `rooms/$code/players/$me/lk` 에 덮어쓰고, 방을 구독해 다른 사람 `lk` 가 바뀌면 그 자리 번호로 넘긴다.
 * 자리 번호 = 방에 들어온 순서(joinedAt) → 같으면 uid 순 (두 기기가 같은 번호를 얻는다 · seatsOf).
 * ⏳ 서버 규칙(idragon · ld/lk) 게시 전에는 쓰기가 거부된다 — 그때는 묶음이 안 가고 상대 화면이 «연결 확인 중»에 머문다.
 */
import { subscribeRoom, publishIdg } from '../../../services/multiplayer.js';

/** 방 선수들 → uid 순서 배열 (자리 번호 = 배열 위치) */
export function seatsOf(room) {
  return Object.entries(room?.players || {})
    .sort((a, b) => (a[1]?.joinedAt ?? 0) - (b[1]?.joinedAt ?? 0) || a[0].localeCompare(b[0]))
    .map(([uid]) => uid);
}

export function createRoomTransport(code, uids, mySeat) {
  const fns = [], leaves = [], last = new Map(), gone = new Set();
  const off = subscribeRoom(code, (room) => {
    if (!room) return;
    /* 방에서 빠진 사람 → 나감 (M4) */
    uids.forEach((u, s) => { if (s !== mySeat && !gone.has(s) && !room.players?.[u]) { gone.add(s); for (const f of leaves) f(s); } });
    for (const [uid, p] of Object.entries(room.players || {})) {
      const seat = uids.indexOf(uid);
      if (seat < 0 || seat === mySeat || typeof p?.lk !== 'string' || p.lk === last.get(uid)) continue;
      last.set(uid, p.lk);
      for (const f of fns) f(seat, p.lk);
    }
  });
  return {
    send(str) { publishIdg(code, { lk: str }).catch?.(() => {}); },
    onMessage(fn) { fns.push(fn); },
    onLeave(fn) { leaves.push(fn); },
    close() { off(); },
  };
}
