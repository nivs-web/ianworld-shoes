/**
 * Firebase 싱글턴. 화면 코드는 이 파일을 직접 쓰지 않는다 —
 * auth.js / profile.js / collection.js 만 경유한다. (CLAUDE.md §6-4)
 *
 * **설정값이 없어도 게임은 돌아간다.**
 * .env 에 VITE_FIREBASE_* 가 없으면 `configured()` 가 false가 되고,
 * 상위 서비스들이 전부 로컬 저장으로 폴백한다. 그래서 Firebase 프로젝트를
 * 만들기 전에도 로비·도감·캐릭터 선택을 그대로 개발하고 배포할 수 있다.
 *
 * SDK는 **필요할 때 동적 import** 한다. 정적으로 넣으면 로그인을 안 쓰는
 * 사용자도 수백 KB를 내려받게 된다.
 */

const CFG = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
};

/** 최소한 이 둘이 있어야 의미가 있다 */
export function configured() {
  return !!(CFG.apiKey && CFG.projectId);
}

/**
 * 절반만 채워진 상태를 조용히 넘기지 않는다.
 * projectId 는 있는데 apiKey 가 없으면 "설정한 줄 알았는데 게스트로 돌던" 상황이 생긴다.
 */
if (!configured() && (CFG.projectId || CFG.authDomain || CFG.databaseURL)) {
  const missing = Object.entries({
    VITE_FIREBASE_API_KEY: CFG.apiKey,
    VITE_FIREBASE_PROJECT_ID: CFG.projectId,
  }).filter(([, v]) => !v).map(([k]) => k);
  console.warn(`[firebase] 설정이 덜 채워져 게스트 모드로 돕니다. 빠진 값: ${missing.join(', ')}`);
}

/**
 * SDK는 **쓰는 시점이 서로 다르다.** 한 덩어리로 붙이면 로그인 한 번 하려고
 * Firestore·RTDB까지 같이 내려받는다. 그래서 세 개로 나눠 뒀다.
 *
 *   getFirebase() — app + auth : 부팅 직후 (세션 복원)      ~71KB gzip
 *   getStore()    — + firestore: 로그인 후 (프로필·도감)     ~93KB gzip
 *   getRtdb()     — + database : 멀티 방 입장 (M7)
 *
 * 전부 실패를 삼키고 null 을 돌려준다. 화면은 null 을 "로컬로만 돈다"로 읽는다.
 */

/** @template T @param {()=>Promise<T>} make @returns {()=>Promise<T|null>} 1회 캐시 + 실패 시 재시도 허용 */
function once(make, label) {
  let p = null;
  return () => {
    if (p) return p;
    p = make().catch((e) => {
      console.error(`[firebase] ${label} 초기화 실패 — 로컬 모드로 계속합니다`, e);
      p = null; // 다음에 다시 시도할 수 있게 캐시를 비운다
      return null;
    });
    return p;
  };
}

/** @type {()=>Promise<{app:any, auth:any, authMod:any}|null>} 미설정이면 null */
export const getFirebase = (() => {
  const load = once(async () => {
    const [{ initializeApp }, authMod] = await Promise.all([
      import('firebase/app'),
      import('firebase/auth'),
    ]);
    const app = initializeApp(CFG);
    return { app, auth: authMod.getAuth(app), authMod };
  }, 'app/auth');
  return () => (configured() ? load() : Promise.resolve(null));
})();

/**
 * Firestore — 프로필·도감·랭킹. 로그인한 뒤에야 의미가 있으므로 그때 붙인다.
 * @type {()=>Promise<{app:any, auth:any, authMod:any, db:any, storeMod:any}|null>}
 */
export const getStore = (() => {
  const load = once(async () => {
    const fb = await getFirebase();
    if (!fb) return null;
    const storeMod = await import('firebase/firestore');
    return { ...fb, db: storeMod.getFirestore(fb.app), storeMod };
  }, 'firestore');
  return () => (configured() ? load() : Promise.resolve(null));
})();

/**
 * Realtime Database — **멀티플레이(M7)에서만** 쓴다.
 * @type {()=>Promise<{rtdb:any, dbMod:any}|null>}
 */
export const getRtdb = (() => {
  const load = once(async () => {
    const fb = await getFirebase();
    if (!fb) return null;
    const dbMod = await import('firebase/database');
    return { rtdb: dbMod.getDatabase(fb.app), dbMod };
  }, 'rtdb');
  return () => (configured() && CFG.databaseURL ? load() : Promise.resolve(null));
})();

export const projectId = () => CFG.projectId ?? null;
