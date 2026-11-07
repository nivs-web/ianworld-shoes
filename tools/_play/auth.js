/** 원격 시험판 전용 auth.js 대역 — 로그인 없이 */
export function onUserChanged() { return () => {}; }
export function currentUser() { return null; }
export const isGuest = () => true;
export const canSignIn = () => false;
export async function initAuth() { return null; }
export async function signInGoogle() { return null; }
export async function signOut() {}
export function setNickname() {}
