/** 시뮬레이터용 firebase.js 대역 — 로더가 진짜 대신 물려 준다 */
import { makeFb } from './rtdb.mjs';

/** 시뮬레이터가 매 동작 전에 "지금 누구인가"를 갈아 끼운다 */
export const CTX = { db: null, uid: null };

export const multiplayerReady = () => true;
export function configured() { return true; }
export const WRITE_TIMEOUT_MS = 12000;
export function withTimeout(promise, ms = WRITE_TIMEOUT_MS, label = 'sim') {
  return Promise.race([
    promise,
    new Promise((_, rej) => setTimeout(() => rej(new Error(`시한 초과: ${label}`)), ms)),
  ]);
}
export const getRtdb = async () => (CTX.db ? makeFb(CTX.db, CTX.uid) : null);
export const getFirebase = async () => null;
export const getStore = async () => null;
export const projectId = () => 'sim';
