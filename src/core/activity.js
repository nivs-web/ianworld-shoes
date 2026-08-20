/**
 * "사람이 지금 여기 있는가" — **활동 시각 한 개**만 들고 있는다. (2026-08-19 19차)
 *
 * ## 왜 연결과 따로 재나
 *
 * 접속 표시는 그동안 **소켓이 살아 있는가**만 봤다(`onDisconnect`). 그런데 그 둘은
 * 다른 것이다 — 탭을 열어 둔 채 폰을 주머니에 넣으면 소켓은 멀쩡히 살아 있고 서버는
 * 끊긴 걸 알 방법이 없다. 사용자 신고가 정확히 그것이었다:
 *
 * > *"게임이 들어와 있지 않은 사람이 현재접속자로 뜨는건 문제가 있는 것 같아 (…)
 * >  60초 동안 움직임이 없고 메뉴도 누르지 않고 아무런 행동도 하지 않으면,
 * >  그 사용자는 나간 사용자라고 판단하자"*
 *
 * 업계 표준도 같은 구조다 — Zulip 은 `last_connected_time`(연결)과 `last_active_time`
 * (활동)을 **컬럼 두 개로 나눠** 들고 있고, Xbox Live 는 "로그인은 했지만 어떤 타이틀에서도
 * 활동 중이 아님"을 `Away` 라는 1급 상태로 둔다.
 *
 * ## 왜 core 에 있나
 *
 * 활동은 **엔진(캔버스 입력·게임패드)에서도** 생긴다. `services/` 를 엔진이 물면
 * 계층이 뒤집히므로, 아무것도 의존하지 않는 이 파일을 양쪽이 물게 했다.
 */

/** 마지막으로 "사람이 뭔가 했다"고 확인된 시각 */
let lastAt = Date.now();

/** 뭔가 했다 — 입력·터치·키·게임패드·메뉴 클릭 어디서든 부른다 */
export function markActive() {
  lastAt = Date.now();
}

/** 마지막 활동으로부터 지난 시간(ms) */
export function msSinceActive() {
  return Date.now() - lastAt;
}

export const lastActiveAt = () => lastAt;

/**
 * 브라우저 입력을 활동으로 친다. 부팅에서 **한 번만** 부른다.
 *
 * `passive: true` 인 이유: 이 리스너는 아무것도 막지 않으므로 브라우저가 스크롤을
 * 기다릴 필요가 없다. `capture: true` 인 이유: 화면 코드가 `stopPropagation()` 을
 * 부르는 곳이 있어도 활동은 잡아야 한다.
 *
 * `mousemove` 는 **일부러 뺐다.** 마우스가 살짝 흔들리는 것만으로 "사람이 있다"고
 * 치면 자리를 비운 PC 사용자가 영원히 접속 중으로 남는다.
 */
export function bindActivity() {
  if (typeof window === 'undefined') return;
  const on = () => markActive();
  for (const ev of ['pointerdown', 'keydown', 'touchstart', 'wheel']) {
    window.addEventListener(ev, on, { passive: true, capture: true });
  }
  /**
   * 화면으로 **돌아온 것**은 그 자체가 활동이다. 이게 없으면 폰을 다시 켠 직후
   * 60초 동안 "나간 사람"으로 남아 목록에서 사라진다.
   */
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) markActive();
  });
  window.addEventListener('focus', on);
}
