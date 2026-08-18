/**
 * "지금 새로고침하면 안 된다"는 표시.
 *
 * 새 배포를 감지하면 `services/pwa.js` 가 페이지를 한 번 새로고침한다(§9-0-21 ⑨).
 * 그런데 캔버스 게임만 피하면 되는 게 아니다 — **대기방과 결과 화면은 DOM 화면이라
 * 씬 스택이 비어 있는데도** 서버 상태를 들고 있다. 그 자리에서 새로고침하면
 * 다시 켜 둔 `onDisconnect` 가 방에서 나를 빼 버리고(자리 상실), 정산이
 * "지갑에서 뺀 뒤 서버에 올리기 전"에 끊길 수도 있다.
 *
 * 그래서 그런 화면은 들어올 때 `hold()`, 나갈 때 그 반환값을 부른다.
 */
let held = 0;

/** @returns {() => void} 풀어 주는 함수 (여러 번 불러도 한 번만 센다) */
export function hold() {
  held++;
  let done = false;
  return () => { if (!done) { done = true; held--; } };
}

/** 지금 새로고침해도 되나 */
export const canReload = () => held <= 0;
