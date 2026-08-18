/** 시뮬레이터용 auth.js 대역 */
import { CTX } from './firebase.js';
export function currentUser() { return CTX.uid ? { uid: CTX.uid, guest: false } : null; }
export function onUserChanged() { return () => {}; }
export const isGuest = () => false;
export const canSignIn = () => true;
export async function initAuth() { return currentUser(); }
export async function signInGoogle() { return currentUser(); }
export async function signOut() {}
export function setNickname() {}
