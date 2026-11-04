/** 두 창 시험용 firebase.js 대역 — 부모 창의 가짜 서버(FakeDb)를 같이 쓴다 */
const uid = new URLSearchParams(location.search).get('uid');
export const multiplayerReady = () => true;
export function configured() { return true; }
export const WRITE_TIMEOUT_MS = 12000;
export function withTimeout(promise, ms = WRITE_TIMEOUT_MS, label = 'rm') {
  return Promise.race([promise, new Promise((_, rej) => setTimeout(() => rej(new Error(`시한 초과: ${label}`)), ms))]);
}

let fbCache = null;
export const getRtdb = async () => {
  if (fbCache) return fbCache;
  const fb = parent.__SIM.makeFb(parent.__SIM.db, uid);
  /* 가짜 서버에 없는 두 가지(방 채팅이 쓴다)만 덧댄다 */
  fb.dbMod.limitToLast ??= (n) => ({ t: 'limitLast', n });
  fb.dbMod.push ??= (r, v) => {
    const key = 'k' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const child = { path: `${r.path}/${key}`, key };
    const p = v === undefined ? Promise.resolve() : fb.dbMod.set(child, v);
    return Object.assign(p, child);
  };
  /* 진짜 SDK 처럼 콜백은 나중에 부른다 — 가짜 서버는 그 자리에서 불러서
     "const un = onValue(...)" 안의 un() 이 초기화 전에 불렸다 */
  const ov = fb.dbMod.onValue;
  fb.dbMod.onValue = (r, cb, err) => {
    let on = true;
    const off = ov(r, (snap) => {
      const v = snap.val();
      setTimeout(() => {
        if (on) cb({ val: () => v, forEach: (f) => Object.entries(v ?? {}).forEach(([key, c]) => f({ key, val: () => c })) });
      }, 0);
    }, err);
    return () => { on = false; off(); };
  };
  fbCache = fb;
  return fb;
};
export const getFirebase = async () => null;
export const getStore = async () => null;
export const projectId = () => 'rm';
