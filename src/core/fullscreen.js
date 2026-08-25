/**
 * 전체화면 — 게임에 들어갈 때 주소창·브라우저 테두리를 지운다.
 *
 * 반드시 **사용자 제스처 안에서** 불러야 한다. 버튼 클릭 핸들러에서 부르는 건 되고,
 * 그 뒤 비동기 콜백에서 부르면 브라우저가 거절한다.
 *
 * iOS 사파리(아이폰)는 Fullscreen API 자체가 없다. 실패해도 게임은 그대로 돌아가고,
 * 홈 화면에 추가해 PWA로 실행하면 같은 효과가 난다 — 그래서 조용히 넘어간다.
 */

const el = () => document.documentElement;

export function isFullscreen() {
  return !!(document.fullscreenElement ?? document.webkitFullscreenElement);
}

/** @returns {Promise<boolean>} 실제로 들어갔는지 */
export async function enterFullscreen() {
  if (isFullscreen()) return true;
  const req = el().requestFullscreen ?? el().webkitRequestFullscreen;
  if (!req) return false; // iOS 사파리 등
  try {
    await req.call(el(), { navigationUI: 'hide' });
    return true;
  } catch {
    return false; // 사용자가 거절했거나 제스처 밖에서 불렸다
  }
}

export async function exitFullscreen() {
  if (!isFullscreen()) return;
  const exit = document.exitFullscreen ?? document.webkitExitFullscreen;
  try {
    await exit?.call(document);
  } catch { /* 이미 나가 있으면 무시 */ }
}

/**
 * 화면 방향 고정.
 *
 * ★ **방향은 오락실이 아니라 "게임"이 정한다.** (2026-08-26)
 *
 * 예전에는 전체화면에 들어갈 때 무조건 세로로 잠갔다. 게임이 신발을 찾아서 하나뿐일
 * 때는 맞는 처리였지만, 드래곤 스트라이커는 **가로** 게임이다. 오락실 화면에서 세로로
 * 잠가 버리면 드래곤은 시작하자마자 화면이 눕는다.
 *
 * 그래서 오락실은 전체화면만 켜고 방향은 건드리지 않는다. 각 게임이 시작할 때
 * 자기 방향을 걸고, 끝나면 푼다.
 *
 * 안드로이드 크롬만 지원하고 **전체화면이 아니면 실패한다** — 둘 다 조용히 넘어간다.
 */
export async function lockPortrait() { return lockOrientation('portrait'); }
export async function lockLandscape() { return lockOrientation('landscape'); }

async function lockOrientation(dir) {
  try {
    await screen.orientation?.lock?.(dir);
  } catch { /* 지원 안 하거나 전체화면이 아니면 실패한다 — 무시 */ }
}

/** 게임에서 나올 때 — 오락실·로비는 폰을 돌리는 대로 따라가는 게 낫다 */
export function unlockOrientation() {
  try {
    screen.orientation?.unlock?.();
  } catch { /* 지원 안 하면 무시 */ }
}
