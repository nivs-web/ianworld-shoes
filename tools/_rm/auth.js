/** 두 창 시험용 auth.js 대역 — 주소의 uid 로 로그인한 것으로 친다 */
const uid = new URLSearchParams(location.search).get('uid');
const me = { uid, guest: false, displayName: uid };
export function currentUser() { return me; }
export function onUserChanged(fn) { try { fn(me); } catch {} return () => {}; }
export const isGuest = () => false;
export const canSignIn = () => true;
export async function initAuth() { return me; }
export async function signInGoogle() { return me; }
export async function signOut() {}
export function setNickname() {}
