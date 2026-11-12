/**
 * 인증 — 구글 로그인 전용.
 *
 * **게스트 모드는 없다.** (2026-08-15) 이 게임은 멀티플레이가 본체인데
 * 게스트는 uid 가 전부 'guest' 라 서버에서 두 사람이 한 사람으로 취급되고,
 * 방·랭킹 보안 규칙도 전부 `auth != null` 을 요구한다.
 * 로그인하지 않으면 아무 화면에도 들어갈 수 없다.
 *
 * (2026-11-11) 대신 **손님 = Firebase 익명 로그인**을 더했다(`signInGuest`). 기기마다 진짜 uid 라
 * 위 문제가 없다. 시크릿 · 앱 안 브라우저에서 구글 리다이렉트가 하얀 오류로 끝나는 것을 피하는 입구다.
 * 손님은 `guest:true` 라 서버 동기화 · 순위 · 멀티는 지금처럼 꺼진다(기록은 이 기기에만).
 */

import { getFirebase, configured } from './firebase.js';
import { loadProfile, patchProfile, resetAll } from './storageLocal.js';

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
  if (u) dropForeignData(u.uid);
  current = u
    ? { uid: u.uid, nickname: loadProfile().nickname, email: u.email ?? '', guest: !!u.isAnonymous, created: Date.parse(u.metadata?.creationTime || '') || 0, name: u.displayName || '' }
    : null;
  if (u) patchProfile({ uid: u.uid, email: u.email ?? '' });
  emit();
  return current;
}

/**
 * ★ **다른 계정의 데이터를 물려받지 않는다.** (2026-08-16)
 *
 * 로컬 저장이 원본인 구조라(§6-4) 계정이 바뀌어도 지갑·도감·기록이 그대로 남아 있었다.
 * A로 신발 80켤레를 모으고 로그아웃한 뒤 B로 로그인하면:
 *   1. `uid` 만 갈아끼워져 **A의 재산이 B의 것이 된다**
 *   2. 남아 있는 A의 닉네임 때문에 닉네임 설정 화면을 건너뛰어 B가 A 이름으로 들어간다
 *   3. B가 신규 계정이면 `pullRemote` 의 최초 생성 분기가 **A의 로컬을 통째로 B 문서로 업로드**한다
 *      — 서버까지 오염되고, 명예의 전당에 같은 기록이 두 계정으로 올라간다
 *
 * 그래서 **로그인 시점에** 저장된 uid 와 다르면 로컬을 비우고 시작한다.
 * 로그아웃을 거치지 않고 계정만 바뀌는 경로(세션 복원, 다른 기기 로그인)까지 함께 막힌다.
 * 비우고 나면 곧바로 `pullAll()` 이 그 계정의 진짜 데이터를 서버에서 당겨온다.
 */
function dropForeignData(uid) {
  const prev = loadProfile().uid;
  if (!prev || prev === uid || prev === 'guest') return;
  console.warn('[auth] 계정이 바뀌어 로컬 데이터를 비웁니다', prev, '→', uid);
  resetAll();
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
 * 리다이렉트 로그인을 **써도 되는 환경인가.**
 *
 * 로그인 핸들러가 우리 도메인과 다른 사이트면(기본값 `*.firebaseapp.com`),
 * 요즘 브라우저의 저장소 칸막이 때문에 돌아와도 자격증명이 사라진다.
 * 그 상태에서 리다이렉트를 태우면 **사용자는 구글까지 갔다가 아무 일도 없이
 * 로그인 화면으로 돌아온다** — 오류도 안 뜨니 "눌러도 아무 반응이 없다"가 된다.
 * 실제로 이 게임이 그 상태였다. 그럴 바엔 차라리 팝업을 허용해 달라고 말하는 게 낫다.
 * (services/firebase.js 의 `resolveAuthDomain` 주석 참고)
 */
function redirectIsUsable(fb) {
  try {
    const handler = fb?.auth?.config?.authDomain ?? '';
    return typeof location !== 'undefined' && handler === location.host;
  } catch {
    return false;
  }
}

/**
 * ★ **시크릿 · 비밀 모드 · 앱 안 브라우저에서는 리다이렉트를 태우지 않는다.** (2026-11-11)
 *
 * 대표님이 시크릿 모드에서 «Google로 시작하기»를 누르자 구글까지 갔다가
 * `/__/auth/handler` 에서 하얀 영어 화면(«missing initial state … sessionStorage …
 * storage-partitioned browser environment»)으로 끝났다. 리다이렉트는 떠나기 전에
 * sessionStorage 에 적어 둔 상태를 돌아와서 읽어야 하는데, 이런 창은 그걸 막거나 지운다.
 * 그래서 이런 창으로 보이면 리다이렉트 대신 한국어 안내 + «손님으로 시작»을 보여 준다.
 *
 * 판별(하나라도 걸리면 «리다이렉트 위험»):
 *   1) 앱 안 브라우저 — 네이버 앱 · 카카오톡 · 인스타그램 · 페이스북 · 라인 · 다음 · 밴드
 *   2) sessionStorage 를 쓰고 읽을 수 없다
 *   3) 크로미움 시크릿(삼성 인터넷 비밀 모드 포함) — 저장 공간 한도가 아주 작다(약 120MB 이하)
 *   4) 사파리 비공개 — 저장 공간 견적을 못 주거나 0
 * 판별이 틀려 일반 창을 위험으로 보더라도 팝업은 그대로 먼저 시도하므로 잃는 것이 없다.
 */
const IN_APP_UA = /NAVER\(inapp|KAKAOTALK|Instagram|FBAN|FBAV|FB_IAB|Line\/|DaumApps|BAND\//i;
export function isInAppBrowser(ua = typeof navigator !== 'undefined' ? navigator.userAgent : '') {
  return IN_APP_UA.test(ua || '');
}
function sessionStorageWorks() {
  try {
    const k = '__oh_ss_probe__';
    sessionStorage.setItem(k, '1');
    const ok = sessionStorage.getItem(k) === '1';
    sessionStorage.removeItem(k);
    return ok;
  } catch {
    return false;
  }
}
const PRIVATE_QUOTA_MAX = 160 * 1024 * 1024;
/** 시크릿 창으로 보이는가 — 크로미움은 저장 공간 한도로, 견적을 못 주면 «모름(false)» */
async function looksPrivate() {
  try {
    const est = await navigator.storage?.estimate?.();
    if (!est || !est.quota) return false;
    return est.quota < PRIVATE_QUOTA_MAX;
  } catch {
    return false;
  }
}
/** @returns {Promise<boolean>} 리다이렉트 로그인이 빈손(하얀 오류 화면)으로 끝날 가능성이 큰 창 */
export async function redirectLikelyBroken() {
  if (isInAppBrowser()) return true;
  if (!sessionStorageWorks()) return true;
  return looksPrivate();
}

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
      if (!redirectIsUsable(fb)) {
        // 리다이렉트를 태워도 빈손으로 돌아온다 — 헛걸음시키지 말고 사실대로 말한다
        const blocked = new Error('popup-required');
        blocked.code = 'app/popup-required';
        throw blocked;
      }
      if (await redirectLikelyBroken()) {
        // 시크릿 · 앱 안 브라우저 — 구글에 보냈다가 하얀 영어 오류로 끝나게 두지 않는다
        const priv = new Error('private-window');
        priv.code = 'app/private-window';
        throw priv;
      }
      await fb.authMod.signInWithRedirect(fb.auth, provider);
      return null; // 페이지가 구글로 넘어간다. 돌아오면 initAuth 가 이어받는다
    }
    // 사용자가 창을 직접 닫은 건 실패가 아니다 — 조용히 제자리
    if (e?.code === 'auth/popup-closed-by-user') return null;
    /**
     * ★ **승인 안 된 도메인은 화면이 사실대로 말해야 한다.** (2026-08-26)
     * 새 주소로 옮기면 Firebase 가 이 코드로 거부하는데, 예전에는 '로그인 실패' 로만
     * 보여서 사장님도 사용자도 무엇을 고쳐야 하는지 알 수 없었다.
     */
    if (e?.code === 'auth/unauthorized-domain') {
      const blocked = new Error('domain-not-authorized');
      blocked.code = 'app/domain-blocked';
      throw blocked;
    }
    console.warn('[auth] 구글 로그인 실패', e?.code, e);
    throw e;
  }
}

/**
 * ★ **손님으로 시작** (2026-11-11 권반장 · 대표님 — 시크릿 · 앱 안 브라우저 대비)
 *
 * 옛 «게스트»는 uid 가 전부 'guest' 라 서버에서 한 사람으로 뭉쳤다(맨 위 주석).
 * 손님은 Firebase **익명 로그인**으로 기기마다 진짜 uid 를 받으므로, 보안 규칙의
 * `auth != null` 도 그대로 통과하고 서로 섞이지 않는다. 리다이렉트도 팝업도 쓰지 않아
 * 어떤 브라우저에서도 막히지 않는다(저장소가 막힌 창이면 그 탭이 살아 있는 동안만 유지).
 *
 * Firebase 콘솔에서 «익명» 로그인 제공자가 꺼져 있으면 `app/guest-disabled` 로 알린다
 * (켜기는 콘솔 일 — 대표님 확인 뒤).
 */
export async function signInGuest() {
  const fb = await getFirebase();
  if (!fb) throw new Error('not-configured');
  try {
    const res = await fb.authMod.signInAnonymously(fb.auth);
    return adopt(res.user);
  } catch (e) {
    if (e?.code === 'auth/admin-restricted-operation' || e?.code === 'auth/operation-not-allowed') {
      const off = new Error('guest-disabled');
      off.code = 'app/guest-disabled';
      throw off;
    }
    console.warn('[auth] 손님 시작 실패', e?.code, e);
    throw e;
  }
}

/**
 * 로그아웃.
 *
 * **로컬 저장은 일부러 안 지운다.** 같은 계정으로 다시 들어오는 경우가 훨씬 흔한데,
 * 여기서 지워 버리면 마지막 판이 아직 서버에 안 올라갔을 때(오프라인·쓰기 실패)
 * 그대로 사라진다. 계정이 **바뀌는** 경우는 로그인 시점의 `dropForeignData()` 가 잡는다.
 */
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
