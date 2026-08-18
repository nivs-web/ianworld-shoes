/** 시뮬레이터용 profile.js 대역 — 원격 밀어올리기는 기록만 하고 끝낸다 */
import * as L from '../../src/services/storageLocal.js';
export const get = L.loadProfile;
export const dexUnique = L.dexUnique;
export const collection = L.loadCollection;
export const pushed = [];
export function patch(patchObj) { pushed.push(patchObj); return L.patchProfile(patchObj); }
export async function pullAll() {}
export async function pullRemote() {}
export function finishRun(result) { return L.commitRun(result); }
