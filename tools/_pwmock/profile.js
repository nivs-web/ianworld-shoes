/* 보조 D 시험용 (커밋 안 함) — 로그인 없이 로비 · 저장은 localStorage 그대로 */
export * from '/tools/_dragon-stub.js';
import { loadProfile, patchProfile } from '/src/services/storageLocal.js';
export function get() { return loadProfile(); }
export function patch(o) { return patchProfile(o); }
