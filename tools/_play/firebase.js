/** 원격 시험판(tools/_play) 전용 firebase.js 대역 — 서버 없이(혼자 하기 · 이 기기 저장만) */
export const multiplayerReady = () => false;
export function configured() { return false; }
export const WRITE_TIMEOUT_MS = 12000;
export function withTimeout(promise) { return promise; }
export const getRtdb = async () => null;
export const getFirebase = async () => null;
export const getStore = async () => null;
export const projectId = () => null;
