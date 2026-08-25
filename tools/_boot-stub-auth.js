/**
 * `services/auth.js` 대역 — 부팅 라우팅 검사용. (2026-08-26 A단계)
 *
 * "로그인이 되어 있으면 첫 화면이 오락실(포털)인가" 를 확인하려면 진짜 세션이 필요한데,
 * 검사에서 구글 로그인을 할 수는 없다. 세션이 있는 척만 해 준다.
 */
window.__authStubLoaded = true;
const USER = { uid: 'testuid123', nickname: '아빠게임왕', email: 't@t.com', guest: false };

export function onUserChanged(fn) { fn(USER); return () => {}; }
export function currentUser() { return USER; }
export const isGuest = () => false;
export const canSignIn = () => true;
export async function initAuth() { return USER; }
export async function signInGoogle() { return USER; }
export async function signOut() {}
export function setNickname() {}
