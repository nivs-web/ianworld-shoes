/**
 * 같은 컴퓨터의 브라우저 탭 둘을 잇는 통로 (3차 멀티 시험용 · 2026-11-11) — BroadcastChannel.
 * 서버(RTDB) 통로와 같은 모양 : { send(str), onMessage(fn(from, str)), close() }.
 * 서버 규칙 게시 전에도 진짜 전투 화면으로 «같이 깨기»를 해 볼 수 있다(개발 서버 전용 주소 ?idgNet=coop&seat=0 / 1).
 */
export function createLocalTransport(room, seat) {
  const ch = new BroadcastChannel(`idg-net-${room}`);
  const fns = [];
  ch.onmessage = (e) => { const m = e.data; if (m && m.from !== seat && typeof m.str === 'string') for (const f of fns) f(m.from, m.str); };
  return {
    send(str) { ch.postMessage({ from: seat, str }); },
    onMessage(fn) { fns.push(fn); },
    close() { ch.close(); },
  };
}
