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

/**
 * 로그인 상태를 반영하는 **유일한 통로.**
 * 팝업·리다이렉트·세션 복원 세 경로가 전부 여기로 모인다.
 *
 * 예전에는 팝업 경로에서만 `patchProfile` 을 불렀다. 그래서 리다이렉트로 들어온
 * 사람은 로컬 프로필의 `uid` 가 옛 `'guest'` 인 채로 남았다 — 실제로 배포본에서
 * 그 상태를 확인했다.
 */
function adopt(u) {
  current = u
    ? { uid: u.uid, nickname: loadProfile().nickname, email: u.email ?? '', guest: false }
    : null;
  if (u) patchProfile({ uid: u.uid, email: u.email ?? '' });
  emit();
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

    /**
     * ★ 리다이렉트 로그인은 **여기서 결과를 받아야 완성된다.**
     *
     * 팝업이 막히면 `signInGoogle` 이 `signInWithRedirect` 로 넘어간다. 구글에서
     * 돌아오면 그 결과를 `getRedirectResult()` 로 거둬야 하는데, 그 호출이
     * 저장소 어디에도 없었다. 모바일 브라우저는 팝업을 거의 항상 막으므로
     * **모바일 로그인이 통째로 미완성 상태로 끝나고 있었다** — 화면은 넘어가는데
     * 계정이 안 붙으니 프로필도 도감도 순위표도 서버에 한 줄도 안 올라간다.
     * (실제로 Firestore 문서가 0개, 사용량도 읽기/쓰기 0건이었다.)
     */
    try {
      const res = await fb.authMod.getRedirectResult(fb.auth);
      if (res?.user) adopt(res.user);
    } catch (e) {
      console.warn('[auth] 리다이렉트 로그인 마무리 실패', e);
    }

    return new Promise((resolve) => {
      // 타임아웃 뒤에 도착해도 구독자는 갱신된다
      fb.authMod.onAuthStateChanged(fb.auth, (u) => resolve(adopt(u)));
    });
  })();

  const timeout = new Promise((resolve) => setTimeout(() => resolve(null), AUTH_BOOT_TIMEOUT_MS));
  await Promise.race([watch, timeout]);
  return current;
}

/** 팝업이 안 되는 환경 — 리다이렉트로 넘어가야 하는 오류들 */
const NEEDS_REDIRECT = new Set([
  'auth/popup-blocked',
  'auth/operation-not-supported-in-this-environment',
  'auth/cancelled-popup-request',
  'auth/web-storage-unsupported',
]);

/**
 * 구글 로그인. 모바일에서는 팝업이 막히는 일이 잦아 리다이렉트로 폴백한다.
 * 리다이렉트 뒤처리는 `initAuth` 의 `getRedirectResult` 가 맡는다 — 그게 없으면
 * 구글에서 돌아와도 로그인이 끝나지 않는다.
 */
export async function signInGoogle() {
  const fb = await getFirebase();
  if (!fb) throw new Error('not-configured');

  const provider = new fb.authMod.GoogleAuthProvider();
  try {
    const res = await fb.authMod.signInWithPopup(fb.auth, provider);
    return adopt(res.user);
  } catch (e) {
    if (NEEDS_REDIRECT.has(e?.code)) {
      await fb.authMod.signInWithRedirect(fb.auth, provider);
      return null; // 페이지가 구글로 넘어간다. 돌아오면 initAuth 가 이어받는다
    }
    // 사용자가 창을 직접 닫은 건 실패가 아니다 — 조용히 제자리
    if (e?.code === 'auth/popup-closed-by-user') return null;
    console.warn('[auth] 구글 로그인 실패', e?.code, e);
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
