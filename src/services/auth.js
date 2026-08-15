/**
 * 인증 — 구글 로그인 전용.
 *
 * **게스트 모드는 없다.** (2026-08-15) 이 게임은 멀티플레이가 본체인데
 * 게스트는 uid 가 전부 'guest' 라 서버에서 두 사람이 한 사람으로 취급되고,
 * 방·랭킹 보안 규칙도 전부 `auth != null` 을 요구한다.
 * 로그인하지 않으면 아무 화면에도 들어갈 수 없다.
 */

import { getFirebase, configured } from './firebase.js';
import { loadProfile, patchProfile } from './storageLocal.js';

/** @type {{uid:string,nickname:string,email:string,guest:boolean}|null} */
let current = null;
const listeners = new Set();

function emit() {
  for (const fn of listeners) fn(current);
}

/** @param {(user:object|null)=>void} fn @returns {()=>void} 해제 함수 */
export function onUserChanged(fn) {
  listeners.add(fn);
  fn(current);
  return () => listeners.delete(fn);
}

export function currentUser() {
  return current;
}

export const isGuest = () => !!current?.guest;
export const canSignIn = () => configured();

/**
 * 부팅이 Firebase를 기다리다 멈추면 안 된다.
 * 지하철·기내처럼 네트워크가 느린 곳에서 SDK 청크 하나 때문에 흰 화면이
 * 몇 초씩 떠 있는 게 제일 나쁘다.
 */
const AUTH_BOOT_TIMEOUT_MS = 3000;

/**
 * 앱 시작 시 1회. 저장된 세션이 있으면 복원한다.
 *
 * 타임아웃이 있는 이유는 **화면을 띄우기 위해서**지 로그인을 건너뛰기 위해서가 아니다.
 * 시간이 지나면 일단 로그인 화면을 보여주고, 뒤늦게 세션이 확인되면
 * onUserChanged 구독자에게 알려 자동으로 넘어간다.
 */
export async function initAuth() {
  if (!configured()) {
    current = null;
    emit();
    return null;
  }

  const watch = (async () => {
    const fb = await getFirebase();
    if (!fb) return null;
    return new Promise((resolve) => {
      fb.authMod.onAuthStateChanged(fb.auth, (u) => {
        current = u
          ? { uid: u.uid, nickname: loadProfile().nickname, email: u.email ?? '', guest: false }
          : null;
        emit(); // 타임아웃 뒤에 도착해도 구독자는 갱신된다
        resolve(current);
      });
    });
  })();

  const timeout = new Promise((resolve) => setTimeout(() => resolve(null), AUTH_BOOT_TIMEOUT_MS));
  await Promise.race([watch, timeout]);
  return current;
}

/** 구글 로그인. 모바일에서는 팝업이 막히는 일이 잦아 리다이렉트로 폴백한다. */
export async function signInGoogle() {
  const fb = await getFirebase();
  if (!fb) throw new Error('not-configured');

  const provider = new fb.authMod.GoogleAuthProvider();
  try {
    const res = await fb.authMod.signInWithPopup(fb.auth, provider);
    current = { uid: res.user.uid, nickname: loadProfile().nickname, email: res.user.email ?? '', guest: false };
    patchProfile({ uid: current.uid, email: current.email });
    emit();
    return current;
  } catch (e) {
    if (e?.code === 'auth/popup-blocked' || e?.code === 'auth/operation-not-supported-in-this-environment') {
      await fb.authMod.signInWithRedirect(fb.auth, provider);
      return null; // 리다이렉트 후 initAuth가 이어받는다
    }
    throw e;
  }
}

export async function signOut() {
  const fb = await getFirebase();
  if (fb) await fb.authMod.signOut(fb.auth);
  current = null;
  emit();
}

/** 로그인 후 닉네임이 정해졌을 때 */
export function setNickname(nickname) {
  if (current) current.nickname = nickname;
  patchProfile({ nickname });
  emit();
}
