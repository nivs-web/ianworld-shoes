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
 * 화면 방향을 세로로 고정한다. 세로 전용 게임이라 가로로 돌아가면 계단이 안 보인다.
 * 안드로이드 크롬만 지원한다 — 없으면 그냥 넘어간다.
 */
export async function lockPortrait() {
  try {
    await screen.orientation?.lock?.('portrait');
  } catch { /* 지원 안 하거나 전체화면이 아니면 실패한다 — 무시 */ }
}
