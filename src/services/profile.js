/**
 * 프로필 — 화면이 유일하게 바라보는 계정 상태 창구.
 *
 * 원본은 **항상 로컬**이다. Firebase는 뒤에서 밀어 올리고 끌어내릴 뿐이라
 * 네트워크가 끊겨도 화면은 멈추지 않는다. (CLAUDE.md §6-4 "모든 쓰기는 실패를 가정한다")
 */

import { getStore, configured, withTimeout } from './firebase.js';
import { currentUser } from './auth.js';
import * as L from './storageLocal.js';
import { NICKNAME } from '../config/balance.js';
import * as Dex from './collection.js';
import * as Rank from './leaderboard.js';

export const get = L.loadProfile;
export const dexUnique = L.dexUnique;
export const collection = L.loadCollection;

/** 원격 문서 경로 */
function userDoc(fb, uid) {
  return fb.storeMod.doc(fb.db, 'users', uid);
}

/**
 * 지갑 병합 — 신발별로 **많은 쪽**을 남긴다.
 *
 * 예전에는 `shoesOwned` 만 max 로 합치고 `shoesByTier` 는 원격 값을 통째로 덮어써서
 * 합계와 티어별이 서로 안 맞을 수 있었다. 이제 신발별 보유량 하나만 병합하고
 * 합계·티어별은 거기서 다시 계산하니 세 숫자가 어긋날 수가 없다.
 *
 * max 인 이유: 기기 A에서 주운 신발이 기기 B의 오래된 값에 덮여 사라지면 안 된다.
 * 대신 한쪽에서 쓴 신발이 되살아날 수는 있다 — 잃는 쪽보다 낫다고 봤다.
 */
function mergeWallet(a = {}, b = {}) {
  const out = { ...a };
  for (const [k, n] of Object.entries(b)) out[k] = Math.max(out[k] ?? 0, n ?? 0);
  for (const k of Object.keys(out)) if (!(out[k] > 0)) delete out[k];
  return out;
}

/**
 * 이름 병합 — **빈 값은 절대 이기지 못한다.**
 * 원격이 비어 있으면 로컬을 쓰고, 둘 다 있으면 원격(다른 기기에서 바꿨을 수 있다).
 */
const pickName = (local, remote) => (remote || local || '');

/** 뱃지 도장 병합 — 0은 "아직"이라 절대 이기지 못한다 */
function earliestStamp(a, b) {
  const list = [a, b].filter((v) => v > 0);
  return list.length ? Math.min(...list) : 0;
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
  await withTimeout(fb.storeMod.setDoc(userDoc(fb, u.uid), patchObj, { merge: true }), undefined, '계정 저장');
}

/** 로그인 직후 — 프로필과 도감을 함께 끌어내린다 */
export async function pullAll() {
  /**
   * ★ **둘을 동시에 당긴다.** (2026-08-19 8차)
   *
   * 계정 문서(`users/{uid}`)와 도감(`users/{uid}/collection`)은 **서로를 안 본다** —
   * 각각 `sf_profile` 과 `sf_collection` 에 쓴다. 그런데 순서대로 기다리고 있었다:
   * 각 호출의 시한이 12초(`WRITE_TIMEOUT_MS`)라 느린 회선에서는 두 배로 늦어진다.
   * 병렬로 돌리면 **둘 중 느린 쪽**만큼만 걸린다.
   *
   * 뒤따르는 `ensureDexBadge()` 는 도감이 합쳐진 뒤여야 하므로 여기서 기다린다.
   */
  await Promise.all([
    pullRemote(),
    Dex.pullAndMerge().catch(() => {}),
  ]);
  /**
   * 도감을 합친 **뒤에** 뱃지 도장을 확인한다. 다른 기기에서 채운 종류가 지금 막
   * 내려왔을 수 있고, 개정 전에 이미 130종을 채운 사람은 도장이 아예 없다.
   */
  const stamped = L.ensureDexBadge();
  if (stamped.dexBadgeAt) pushRemote({ dexBadgeAt: stamped.dexBadgeAt }).catch(() => {});
  /**
   * 이름 되살리기 — 이미 빈 이름으로 박제된 계정 문서를 고친다.
   * 이 사람들은 판을 한 번 더 돌기 전까지 순위표에 `???` 로 보인다.
   */
  if (stamped.nickname) {
    pushRemote({
      nickname: stamped.nickname,
      nicknameLower: stamped.nickname.toLowerCase(),
      selectedCharacter: stamped.selectedCharacter ?? '',
    }).catch(() => {});
  }
  // 오프라인 동안 쌓인 기록을 이제 올린다
  Rank.flushQueued().catch(() => {});
  return stamped;
}

/** 로그인 직후 — 원격 값이 있으면 로컬로 끌어내린다 */
export async function pullRemote() {
  const u = currentUser();
  if (!configured() || !u || u.guest) return L.loadProfile();
  const fb = await getStore();
  if (!fb) return L.loadProfile();

  const snap = await withTimeout(fb.storeMod.getDoc(userDoc(fb, u.uid)), undefined, '계정 읽기');
  if (!snap.exists()) {
    // 첫 로그인 — 지금까지의 로컬 기록을 그대로 올린다
    const local = L.loadProfile();
    await withTimeout(
      fb.storeMod.setDoc(userDoc(fb, u.uid), { ...local, uid: u.uid, email: u.email }, { merge: true }),
      undefined, '계정 최초 생성');
    return local;
  }
  const remote = snap.data();
  // 기록류는 큰 쪽을 남긴다 — 다른 기기에서 더 잘한 판이 있을 수 있다
  const local = L.loadProfile();
  const merged = {
    ...local,
    ...remote,
    /**
     * ★ 이름은 **빈 값이 이기면 안 된다.**
     *
     * `...remote` 가 `...local` 을 덮으므로, 원격 문서의 닉네임이 빈 문자열이면
     * 로컬 닉네임까지 지워졌다. 계정 문서는 **첫 로그인 시점**에 만들어지는데
     * 그때는 아직 닉네임을 정하기 전이라 `''` 로 박히는 경로가 있다 — 그 뒤로
     * 이름이 영영 빈 채로 남고, 명예의 전당에는 `???` 로 나온다.
     * (실제 증상: 순위표 아이디가 전부 물음표)
     */
    nickname: pickName(local.nickname, remote.nickname),
    nicknameLower: pickName(local.nicknameLower, remote.nicknameLower),
    selectedCharacter: remote.selectedCharacter || local.selectedCharacter,
    bestStairs: Math.max(local.bestStairs ?? 0, remote.bestStairs ?? 0),
    totalPlays: Math.max(local.totalPlays ?? 0, remote.totalPlays ?? 0),
    // 지갑은 신발별 보유량이 진실이고 합계는 거기서 나온다 (아래 reconcile)
    shoesByIndex: mergeWallet(local.shoesByIndex, remote.shoesByIndex),
    /**
     * 뱃지 도장은 **한쪽에만 있어도 남긴다.** 0(없음)이 살아남으면
     * 아직 못 딴 기기에 로그인했을 때 훈장이 사라진다.
     * 둘 다 있으면 **이른 쪽** — 처음 해낸 시각이 진실이다.
     */
    dexBadgeAt: earliestStamp(local.dexBadgeAt, remote.dexBadgeAt),
  };
  L.reconcile(merged);
  L.saveProfile(merged);
  return merged;
}

// ─────────────────────────────────────────────
// 화면이 실제로 부르는 것들
// ─────────────────────────────────────────────

export const setDifficulty = (d) => patch({ difficulty: d });
export const setControlMode = (m) => patch({ controlMode: m });
/** 싱글 게임 배경 — 'random' 또는 BUILDINGS 의 id (2026-08-19) */
export const setSingleBg = (id) => patch({ singleBg: id });

/**
 * 캐릭터 교체. 순위표에 박혀 있는 얼굴도 같이 갈아 준다 —
 * 로비에서는 새 캐릭터인데 주간 순위표에만 옛 얼굴이 남으면 남의 기록처럼 보인다.
 */
export function setCharacter(id) {
  const p = patch({ selectedCharacter: id });
  Rank.syncIdentity().catch(() => { /* 다음 기록 제출 때 맞춰진다 */ });
  return p;
}

/** @returns {{ok:boolean, profile:object}} */
export function buyCharacter(id) {
  const r = L.unlockCharacter(id);
  if (r.ok) {
    pushRemote({
      unlockedCharacters: r.profile.unlockedCharacters,
      shoesOwned: r.profile.shoesOwned,
      shoesByTier: r.profile.shoesByTier,
      shoesByIndex: r.profile.shoesByIndex,
    }).catch(() => {});
  }
  return r;
}

/** 한 판 종료 반영 */
export function finishRun(result) {
  const r = L.commitRun(result);
  pushRemote({
    /**
     * ★ 이름·캐릭터를 **매 판마다 같이 올린다.**
     *
     * 신발왕·역대 탭은 `users` 문서의 이름을 그대로 읽는다. 그런데 이 필드를
     * 쓰는 곳이 `saveNickname` 하나뿐이라, 그 한 번이 실패하면(예전에 로그인이
     * 깨져 있던 동안 실제로 그랬다) 계정 문서의 이름이 영영 빈 채로 남는다.
     * 판이 끝날 때마다 같이 실어 보내면 저절로 복구된다.
     */
    nickname: r.profile.nickname ?? '',
    nicknameLower: (r.profile.nickname ?? '').toLowerCase(),
    selectedCharacter: r.profile.selectedCharacter ?? '',
    bestStairs: r.profile.bestStairs,
    bestByDifficulty: r.profile.bestByDifficulty,
    totalStairs: r.profile.totalStairs,
    totalPlays: r.profile.totalPlays,
    shoesOwned: r.profile.shoesOwned,
    shoesByTier: r.profile.shoesByTier,
    shoesByIndex: r.profile.shoesByIndex,
    dexBadgeAt: r.profile.dexBadgeAt ?? 0,
  }).catch(() => {});
  // 도감은 별도 컬렉션이라 따로 올린다 (실패해도 로컬에는 이미 있다)
  Dex.pushFound(result.shoeIndices).catch(() => {});
  /**
   * 명예의 전당 제출. 먼저 큐에 넣고 바로 올린다 —
   * 성공하면 큐에서 빠지고, 실패하면 남아서 다음 접속에 다시 올라간다.
   * 넣기 전에 올리면 앱이 그 사이에 닫혔을 때 기록이 통째로 사라진다.
   */
  const entry = {
    stairs: result.floor,
    difficulty: result.difficulty,
    shoesFound: result.shoeIndices.length,
  };
  L.queueScore(entry);
  Rank.flushQueued().catch(() => {});
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
    const snap = await withTimeout(fb.storeMod.getDocs(q), undefined, '닉네임 중복 확인');
    return snap.docs.some((d) => d.id !== u.uid);
  })();

  const timeout = new Promise((r) => setTimeout(() => r(false), NICK_CHECK_TIMEOUT_MS));
  return Promise.race([check, timeout]);
}

/**
 * 닉네임 저장.
 *
 * 이름을 바꾸면 **이미 올라간 이번 주·달·해 기록의 이름도 함께 고친다.**
 * 신발 200켤레를 내고 바꿨는데 순위표에 옛 이름이 그대로면 산 게 아니다.
 * (`leaderboard.syncIdentity` — 고칠 문서는 최대 9장이라 부담이 없다)
 */
export function saveNickname(nickname) {
  const v = nickname.trim();
  const p = patch({ nickname: v, nicknameLower: v.toLowerCase() });
  Rank.syncIdentity().catch(() => { /* 다음 기록 제출 때 맞춰진다 */ });
  return p;
}
