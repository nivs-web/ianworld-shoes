/**
 * 인증 — 구글 로그인. Firebase 미설정이면 **게스트 모드**로 동작한다.
 *
 * 게스트도 게임의 모든 기능을 쓸 수 있다. 다른 점은 기록이 이 브라우저에만
 * 남는다는 것뿐이다. 로그인은 "기기 사이에 이어서 하기"를 위한 것이지
 * 플레이의 전제 조건이 아니다.
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
 * 몇 초씩 떠 있는 게 로그인 상태를 아는 것보다 훨씬 나쁘다.
 * 시간이 지나면 일단 로컬 상태로 화면을 띄우고, 뒤늦게 세션이 확인되면
 * onUserChanged 구독자에게 알려 준다.
 */
const AUTH_BOOT_TIMEOUT_MS = 3000;

/** 앱 시작 시 1회. 저장된 세션이 있으면 복원한다. */
export async function initAuth() {
  const p = loadProfile();

  // 로컬에 닉네임이 있으면 우선 그걸로 화면을 띄운다 (게스트 취급)
  const localFallback = () =>
    (p.nickname ? { uid: 'guest', nickname: p.nickname, email: '', guest: true } : null);

  if (!configured()) {
    current = localFallback();
    emit();
    return current;
  }

  let settled = false;
  const watch = (async () => {
    const fb = await getFirebase();
    if (!fb) return null;
    return new Promise((resolve) => {
      fb.authMod.onAuthStateChanged(fb.auth, (u) => {
        current = u
          ? { uid: u.uid, nickname: loadProfile().nickname, email: u.email ?? '', guest: false }
          : (settled ? current : null);
        emit(); // 타임아웃 뒤에 도착해도 구독자는 갱신된다
        resolve(current);
      });
    });
  })();

  const timeout = new Promise((resolve) =>
    setTimeout(() => resolve(localFallback()), AUTH_BOOT_TIMEOUT_MS)
  );

  const first = await Promise.race([watch, timeout]);
  settled = true;
  if (current === null && first) { current = first; emit(); }
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

/** 로그인 없이 시작 — 닉네임만 정하면 바로 플레이 */
export function continueAsGuest(nickname) {
  current = { uid: 'guest', nickname, email: '', guest: true };
  patchProfile({ uid: 'guest', nickname });
  emit();
  return current;
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
