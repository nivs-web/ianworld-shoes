/**
 * 프로필 — 화면이 유일하게 바라보는 계정 상태 창구.
 *
 * 원본은 **항상 로컬**이다. Firebase는 뒤에서 밀어 올리고 끌어내릴 뿐이라
 * 네트워크가 끊겨도 화면은 멈추지 않는다. (CLAUDE.md §6-4 "모든 쓰기는 실패를 가정한다")
 */

import { getStore, configured } from './firebase.js';
import { currentUser } from './auth.js';
import * as L from './storageLocal.js';
import { NICKNAME } from '../config/balance.js';
import * as Dex from './collection.js';

export const get = L.loadProfile;
export const dexUnique = L.dexUnique;
export const collection = L.loadCollection;

/** 원격 문서 경로 */
function userDoc(fb, uid) {
  return fb.storeMod.doc(fb.db, 'users', uid);
}

/** 로컬을 먼저 고치고, 원격에는 조용히 밀어 올린다 */
export function patch(patchObj) {
  const p = L.patchProfile(patchObj);
  pushRemote(patchObj).catch(() => { /* 다음 기회에 */ });
  return p;
}

async function pushRemote(patchObj) {
  const u = currentUser();
  if (!configured() || !u || u.guest) return;
  const fb = await getStore();
  if (!fb) return;
  await fb.storeMod.setDoc(userDoc(fb, u.uid), patchObj, { merge: true });
}

/** 로그인 직후 — 프로필과 도감을 함께 끌어내린다 */
export async function pullAll() {
  const p = await pullRemote();
  await Dex.pullAndMerge().catch(() => {});
  return p;
}

/** 로그인 직후 — 원격 값이 있으면 로컬로 끌어내린다 */
export async function pullRemote() {
  const u = currentUser();
  if (!configured() || !u || u.guest) return L.loadProfile();
  const fb = await getStore();
  if (!fb) return L.loadProfile();

  const snap = await fb.storeMod.getDoc(userDoc(fb, u.uid));
  if (!snap.exists()) {
    // 첫 로그인 — 지금까지의 로컬 기록을 그대로 올린다
    const local = L.loadProfile();
    await fb.storeMod.setDoc(userDoc(fb, u.uid), { ...local, uid: u.uid, email: u.email }, { merge: true });
    return local;
  }
  const remote = snap.data();
  // 기록류는 큰 쪽을 남긴다 — 다른 기기에서 더 잘한 판이 있을 수 있다
  const local = L.loadProfile();
  const merged = {
    ...local,
    ...remote,
    bestStairs: Math.max(local.bestStairs ?? 0, remote.bestStairs ?? 0),
    shoesOwned: Math.max(local.shoesOwned ?? 0, remote.shoesOwned ?? 0),
    totalPlays: Math.max(local.totalPlays ?? 0, remote.totalPlays ?? 0),
  };
  L.saveProfile(merged);
  return merged;
}

// ─────────────────────────────────────────────
// 화면이 실제로 부르는 것들
// ─────────────────────────────────────────────

export const setDifficulty = (d) => patch({ difficulty: d });
export const setControlMode = (m) => patch({ controlMode: m });
export const setCharacter = (id) => patch({ selectedCharacter: id });

/** @returns {{ok:boolean, profile:object}} */
export function buyCharacter(id) {
  const r = L.unlockCharacter(id);
  if (r.ok) {
    pushRemote({
      unlockedCharacters: r.profile.unlockedCharacters,
      shoesOwned: r.profile.shoesOwned,
      shoesByTier: r.profile.shoesByTier,
    }).catch(() => {});
  }
  return r;
}

/** 한 판 종료 반영 */
export function finishRun(result) {
  const r = L.commitRun(result);
  pushRemote({
    bestStairs: r.profile.bestStairs,
    bestByDifficulty: r.profile.bestByDifficulty,
    totalStairs: r.profile.totalStairs,
    totalPlays: r.profile.totalPlays,
    shoesOwned: r.profile.shoesOwned,
    shoesByTier: r.profile.shoesByTier,
  }).catch(() => {});
  // 도감은 별도 컬렉션이라 따로 올린다 (실패해도 로컬에는 이미 있다)
  Dex.pushFound(result.shoeIndices).catch(() => {});
  // M6에서 랭킹 서버로 보낼 큐
  L.queueScore({ stairs: result.floor, difficulty: result.difficulty, shoesFound: result.shoeIndices.length });
  return r;
}

/** 닉네임 규칙 검사 — 한글 2~4자 (기획서 §8) */
export function validateNickname(v) {
  return NICKNAME.pattern.test(String(v ?? '').trim());
}

/** 중복 확인이 이 시간을 넘으면 그냥 통과시킨다 — 네트워크 때문에 가입이 멈추면 안 된다 */
const NICK_CHECK_TIMEOUT_MS = 4000;

/**
 * 닉네임 중복 확인.
 *
 * **로그인한 사용자에게만 의미가 있다.** 게스트 닉네임은 이 브라우저에만 있고
 * 서버에 올라가지 않으므로 남의 이름과 겹쳐도 아무 일도 일어나지 않는다.
 * 게스트를 막으면 아무 이득 없이 Firestore(93KB)만 내려받게 된다.
 */
export async function isNicknameTaken(nickname) {
  const u = currentUser();
  if (!configured() || !u || u.guest) return false;

  const check = (async () => {
    const fb = await getStore();
    if (!fb) return false;
    const q = fb.storeMod.query(
      fb.storeMod.collection(fb.db, 'users'),
      fb.storeMod.where('nicknameLower', '==', nickname.trim().toLowerCase()),
      fb.storeMod.limit(1)
    );
    const snap = await fb.storeMod.getDocs(q);
    return snap.docs.some((d) => d.id !== u.uid);
  })();

  const timeout = new Promise((r) => setTimeout(() => r(false), NICK_CHECK_TIMEOUT_MS));
  return Promise.race([check, timeout]);
}

export function saveNickname(nickname) {
  const v = nickname.trim();
  return patch({ nickname: v, nicknameLower: v.toLowerCase() });
}
