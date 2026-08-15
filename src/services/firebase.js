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

/**
 * 로그인 핸들러를 **우리 도메인에서 직접 받을지** 여부.
 *
 * 기본값(`<project>.firebaseapp.com`)은 우리 도메인과 다른 사이트다. 요즘 브라우저는
 * 사이트가 다르면 저장소를 칸막이로 나눠 버려서(third-party storage partitioning),
 * `signInWithRedirect` 로 로그인하고 돌아와도 **자격증명이 저쪽 칸에 갇힌다.**
 * 그러면 `getRedirectResult()` 가 아무 오류 없이 `null` 을 돌려준다 — 실제로 이 게임에서
 * 리다이렉트 로그인을 끝까지 돌려 확인했다(세션·IndexedDB 전부 비어 있었다).
 * 팝업이 막히는 모바일은 이 경로가 기본이라 사실상 모바일 로그인이 통째로 죽는다.
 *
 * `vercel.json` 이 `/__/auth/*` 를 firebaseapp.com 으로 프록시하므로, authDomain 을
 * 우리 호스트로 바꾸면 로그인 핸들러가 **같은 출처**가 되어 칸막이가 사라진다.
 *
 * **선행 조건은 2026-08-15 에 전부 끝났고 실측으로 확인했다** (CLAUDE.md §9-0-10):
 *   1. Firebase → Authentication → 승인된 도메인에 `ianworld-shoes.vercel.app`
 *   2. Google Cloud → OAuth 클라이언트 → 승인된 리디렉션 URI 에
 *      `https://ianworld-shoes.vercel.app/__/auth/handler`
 *      (기존 firebaseapp.com 항목은 그대로 두고 **추가**했다 — 지우면 기존 경로가 끊긴다)
 *   3. `vercel.json` 의 `/__/auth/*` 프록시 배포
 * 그래서 이제 **기본값이 켜짐**이다. 새 도메인을 붙일 때는 위 2·3을 먼저 해야 한다.
 * 급히 되돌려야 하면 `VITE_FIREBASE_SELF_AUTH=0` 으로 끌 수 있다.
 */
function resolveAuthDomain() {
  const fromEnv = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN;
  const flag = import.meta.env.VITE_FIREBASE_SELF_AUTH;
  if (flag === '0' || typeof location === 'undefined') return fromEnv;
  // 개발 서버(localhost)에는 프록시가 없으므로 손대지 않는다
  if (/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) return fromEnv;
  return location.host;
}

/**
 * ★ **환경변수는 반드시 다듬어서 쓴다.** (2026-08-15, CLAUDE.md §9-0-13)
 *
 * 버셀 환경변수에 붙은 **줄바꿈 하나** 때문에 파이어스토어가 통째로 죽어 있었다.
 * `VITE_FIREBASE_PROJECT_ID` 가 `"find-shoes-f5c55\n"` 으로 구워져서 모든 요청이
 * `projects/find-shoes-f5c55%0A/databases/(default)` 로 나갔고, 백엔드가 스트리밍
 * 채널을 503으로 끊었다. SDK 는 오류를 던지지 않고 **그냥 응답을 안 준다** —
 * 12초 뒤 우리 타임아웃만 터진다. 증상은 "명예의 전당이 안 나온다" 였다.
 *
 * 눈으로는 절대 안 보인다. 콘솔에도 `find-shoes-f5c55` 로 멀쩡히 찍힌다.
 * 그래서 값을 믿지 않고 전부 `trim()` 하고, 모양이 이상하면 소리를 지른다.
 */
const clean = (v) => (typeof v === 'string' ? v.trim() : v);

const CFG = {
  apiKey: clean(import.meta.env.VITE_FIREBASE_API_KEY),
  authDomain: clean(resolveAuthDomain()),
  projectId: clean(import.meta.env.VITE_FIREBASE_PROJECT_ID),
  storageBucket: clean(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET),
  messagingSenderId: clean(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID),
  appId: clean(import.meta.env.VITE_FIREBASE_APP_ID),
  databaseURL: clean(import.meta.env.VITE_FIREBASE_DATABASE_URL),
};

/**
 * 다듬는 것만으로는 부족하다 — **다듬어야 했다는 사실 자체를 알려야** 다음 사람이 안 당한다.
 * 값마다 허용 모양을 정해 두고 어긋나면 경고한다. (게임은 그대로 계속된다)
 */
{
  const RAW = {
    VITE_FIREBASE_API_KEY: import.meta.env.VITE_FIREBASE_API_KEY,
    VITE_FIREBASE_PROJECT_ID: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    VITE_FIREBASE_STORAGE_BUCKET: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    VITE_FIREBASE_MESSAGING_SENDER_ID: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    VITE_FIREBASE_APP_ID: import.meta.env.VITE_FIREBASE_APP_ID,
    VITE_FIREBASE_DATABASE_URL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  };
  const dirty = Object.entries(RAW).filter(([, v]) => typeof v === 'string' && v !== v.trim());
  if (dirty.length) {
    console.warn(
      `[firebase] 환경변수에 공백·줄바꿈이 섞여 있습니다: ${dirty.map(([k]) => k).join(', ')}\n` +
        '          코드에서 잘라내고 계속하지만, 배포 환경변수를 다시 저장해 주세요.'
    );
  }
  // 프로젝트 ID 는 소문자·숫자·하이픈만 쓴다. 여기가 어긋나면 파이어스토어가 전부 막힌다
  if (CFG.projectId && !/^[a-z0-9-]+$/.test(CFG.projectId)) {
    console.error(`[firebase] projectId 모양이 잘못됐습니다: ${JSON.stringify(CFG.projectId)}`);
  }
}

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
    /**
     * 그냥 `getFirestore()` 다.
     *
     * 한때 `initializeFirestore(app, { experimentalAutoDetectLongPolling: true })` 를
     * 썼다. "WebChannel 이 막혀서 쓰기가 안 올라간다"는 가설 때문이었는데,
     * **그 가설은 틀렸다** — 진짜 원인은 로그인이었다(§9-0-9). 그런데 자동 감지는
     * 첫 연결에서 스트리밍이 되는지 **실패를 기다려 보는** 단계를 넣기 때문에,
     * 멀쩡한 회선에서도 첫 조회가 눈에 띄게 늦어진다. 실제로 명예의 전당이
     * "누르고 10초쯤 뒤에 뜬다"는 증상으로 돌아왔다.
     * 없어진 문제를 위한 대비를 남겨 두고 매번 값을 치를 이유가 없다.
     */
    return { ...fb, db: storeMod.getFirestore(fb.app), storeMod };
  }, 'firestore');
  return () => (configured() ? load() : Promise.resolve(null));
})();

/**
 * 원격 쓰기에 **시한**을 건다.
 *
 * Firestore 의 쓰기 프라미스는 서버에 닿아야 resolve 한다. 못 닿으면 reject 가
 * 아니라 **영원히 pending** 이다. 그래서 시간을 안 걸면 "실패했다"는 사실 자체를
 * 알 수 없고, 큐에 넣고 재시도하는 장치가 전부 무력해진다.
 * 시한이 지나면 거절해서, 호출한 쪽이 큐에 남기고 다음에 다시 올리게 한다.
 * (SDK 는 그 뒤에도 자기 대기열에 들고 있다가 연결이 돌아오면 마저 보낸다.
 *  문서 ID가 고정이라 두 번 써도 결과가 같다.)
 */
export const WRITE_TIMEOUT_MS = 12000;

export function withTimeout(promise, ms = WRITE_TIMEOUT_MS, label = 'firestore') {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => {
        const e = new Error(`${label} 응답 없음 (${ms}ms) — 연결이 막혔을 수 있습니다`);
        e.code = 'deadline-exceeded';
        reject(e);
      }, ms)
    ),
  ]);
}

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
