/**
 * 시크릿 · 앱 안 브라우저 로그인 갈래 검사 (2026-11-11) — 구글 로그인 창을 열지 않는다.
 *
 *   node tools/_auth-private-qa.mjs
 *
 * services/firebase.js 를 가짜로 바꿔 끼우고(팝업 실패 · 리다이렉트 기록 · 익명 로그인),
 * 브라우저 전역(sessionStorage · navigator.storage · userAgent)을 흉내 내서
 *   1) 일반 창 + 팝업 막힘 → 리다이렉트로 간다
 *   2) 시크릿(저장 한도 작음) + 팝업 막힘 → 리다이렉트 안 함, app/private-window
 *   3) sessionStorage 막힘 + 팝업 막힘 → app/private-window
 *   4) 네이버 앱 안 브라우저 + 팝업 막힘 → app/private-window
 *   5) 손님 시작 → 익명 uid 로 들어감(guest:true) · 익명 꺼짐이면 app/guest-disabled
 * 를 확인한다.
 */
import { register } from 'node:module';
import assert from 'node:assert/strict';

/* ── 가짜 firebase.js ── */
globalThis.__fake = { popupError: 'auth/popup-blocked', redirected: 0, anonError: null };
const FAKE = `
  export const configured = () => true;
  export const getFirebase = async () => ({
    auth: { config: { authDomain: globalThis.location.host } },
    authMod: {
      GoogleAuthProvider: class {},
      signInWithPopup: async () => { const e = new Error('x'); e.code = globalThis.__fake.popupError; throw e; },
      signInWithRedirect: async () => { globalThis.__fake.redirected++; },
      signInAnonymously: async () => {
        if (globalThis.__fake.anonError) { const e = new Error('x'); e.code = globalThis.__fake.anonError; throw e; }
        return { user: { uid: 'anon-123', isAnonymous: true, email: null, metadata: {} } };
      },
      getRedirectResult: async () => null,
      onAuthStateChanged: () => () => {},
      signOut: async () => {},
    },
  });
  export const getStore = async () => null;
  export const getRtdb = async () => null;
  export const multiplayerReady = () => false;
  export const projectId = () => 'fake';
  export const WRITE_TIMEOUT_MS = 12000;
  export const withTimeout = (p) => p;
`;
register('data:text/javascript,' + encodeURIComponent(`
  const FAKE = ${JSON.stringify(FAKE)};
  export async function resolve(spec, ctx, next) {
    if (spec.endsWith('/firebase.js') && ctx.parentURL && ctx.parentURL.includes('/services/')) return { url: 'data:text/javascript,' + encodeURIComponent(FAKE), shortCircuit: true };
    return next(spec, ctx);
  }
  export async function load(url, ctx, next) {
    if (url.endsWith('.json')) return next(url, { ...ctx, importAttributes: { type: 'json' } });
    return next(url, ctx);
  }
`), import.meta.url);

/* ── 브라우저 전역 흉내 ── */
const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), clear: () => m.clear(), key: (i) => [...m.keys()][i] ?? null, get length() { return m.size; } }; };
globalThis.localStorage = mem();
globalThis.location = { host: 'ianworld.vercel.app', hostname: 'ianworld.vercel.app', origin: 'https://ianworld.vercel.app' };
let ua = 'Mozilla/5.0 (Linux; Android 14) Chrome/130 Mobile Safari/537.36';
let quota = 50 * 1024 ** 3;
let ssBroken = false;
Object.defineProperty(globalThis, 'navigator', { configurable: true, get: () => ({ userAgent: ua, storage: { estimate: async () => ({ quota, usage: 0 }) } }) });
const ss = mem();
Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, get: () => { if (ssBroken) throw new Error('SecurityError'); return ss; } });

const auth = await import('../src/services/auth.js');

async function tryGoogle() {
  try { const r = await auth.signInGoogle(); return { ok: true, r }; } catch (e) { return { ok: false, code: e.code }; }
}
const results = [];
const check = async (name, setup, expect) => {
  ua = 'Mozilla/5.0 (Linux; Android 14) Chrome/130 Mobile Safari/537.36'; quota = 50 * 1024 ** 3; ssBroken = false;
  globalThis.__fake.redirected = 0; globalThis.__fake.popupError = 'auth/popup-blocked'; globalThis.__fake.anonError = null;
  setup();
  const out = await expect();
  results.push(name);
  console.log('✓', name, out ?? '');
};

await check('1) 일반 창 · 팝업 막힘 → 리다이렉트', () => {}, async () => {
  const r = await tryGoogle(); assert.equal(r.ok, true); assert.equal(globalThis.__fake.redirected, 1); return '리다이렉트 1번';
});
await check('2) 시크릿(저장 한도 100MB) · 팝업 막힘 → 리다이렉트 안 함', () => { quota = 100 * 1024 ** 2; }, async () => {
  const r = await tryGoogle(); assert.equal(r.code, 'app/private-window'); assert.equal(globalThis.__fake.redirected, 0); return r.code;
});
await check('3) sessionStorage 막힘 · 팝업 막힘 → 안내', () => { ssBroken = true; }, async () => {
  const r = await tryGoogle(); assert.equal(r.code, 'app/private-window'); assert.equal(globalThis.__fake.redirected, 0); return r.code;
});
await check('4) 네이버 앱 안 브라우저 · 지원 안 됨 → 안내', () => { ua += ' NAVER(inapp; search; 1000; 12.0.0)'; globalThis.__fake.popupError = 'auth/operation-not-supported-in-this-environment'; }, async () => {
  const r = await tryGoogle(); assert.equal(r.code, 'app/private-window'); assert.equal(globalThis.__fake.redirected, 0); return r.code;
});
await check('4b) 카카오톡 · 인스타 · 페이스북 판별', () => {}, async () => {
  for (const u of ['KAKAOTALK 10.4.5', 'Instagram 300.0', 'FBAN/FBIOS', 'Line/13.0']) assert.equal(auth.isInAppBrowser('Mozilla/5.0 ' + u), true, u);
  for (const u of ['Chrome/130 Mobile Safari/537.36', 'SamsungBrowser/25.0', 'Whale/3.2 Mobile', 'Version/17.0 Mobile/15E148 Safari/604.1']) assert.equal(auth.isInAppBrowser('Mozilla/5.0 ' + u), false, u);
  return '4종 걸림 · 일반 4종 통과';
});
await check('5) 손님 시작 → 익명 uid · guest:true (시크릿 · 저장소 막힘에서도)', () => { quota = 100 * 1024 ** 2; ssBroken = true; }, async () => {
  const u = await auth.signInGuest(); assert.equal(u.uid, 'anon-123'); assert.equal(u.guest, true); return u.uid;
});
await check('6) 익명 로그인이 콘솔에서 꺼져 있으면 → app/guest-disabled', () => { globalThis.__fake.anonError = 'auth/admin-restricted-operation'; }, async () => {
  try { await auth.signInGuest(); assert.fail('던져야 함'); } catch (e) { assert.equal(e.code, 'app/guest-disabled'); return e.code; }
});
console.log(`끝: ${results.length}개 통과`);
