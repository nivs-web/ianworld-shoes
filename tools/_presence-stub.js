/**
 * `services/presence.js` 대역 — 미리보기·검사용. (2026-08-19 21차)
 *
 * 받은 메세지함과 메세지 수신 설정을 **진짜 화면 코드 그대로** 띄우기 위한 것이다.
 * 마크업을 손으로 베낀 미리보기는 언젠가 거짓말을 한다(§9-0-33·§9-0-44 에서 두 번 데였다).
 *
 * `import map` 으로 이 파일이 `presence.js` 자리에 들어간다 —
 * `tools/_msgscreen-preview.html` 참고. 화면 코드는 한 줄도 안 바꾼다.
 *
 * 상태는 주소 뒤에 붙인다: `?accept=0` 이면 수신차단, `?accept=1` 이면 허용.
 */

const q = new URLSearchParams(location.search);
const accept = q.get('accept') !== '0';

const NOW = 1755600000000;   // 고정 시각 — 미리보기가 매번 달라지면 눈으로 비교할 수 없다
const MSGS = [
  { id: 'm1', out: false, from: 'u1', fromName: '다섯글자님', text: '지금 한 판 어때요? 방 만들게요', at: NOW - 60e3, read: false },
  { id: 'm2', out: true, to: 'u2', toName: '이안', text: '좋아요 바로 갈게요', at: NOW - 3600e3, read: true },
  { id: 'm3', out: false, from: 'u3', fromName: '로', text: '아까 그 신발 어디서 주웠어요? 3티어 같던데', at: NOW - 86400e3 * 2, read: true },
  { id: 'm4', out: false, from: 'u4', fromName: '아빠게임왕', text: '내일도 같이 해요', at: NOW - 86400e3 * 3, read: true },
];

/** u3 는 차단해 둔 사람 — 목록에서 빨간 [차단] 배지가 붙어야 한다 */
const BLOCKED = { u3: true };

export function subscribeInbox(cb) { cb(MSGS); return () => {}; }
export function subscribeMyPrefs(cb) { cb({ accept, blocked: BLOCKED }); return () => {}; }
export async function setBlocked() { return true; }
export async function setAccept() { return true; }
export async function drop() { return true; }
export async function markRead() { return true; }
export async function sendMessage() { return 'ok'; }
export const ACTIVITY_TIMEOUT_MS = 60000;
