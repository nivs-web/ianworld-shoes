/**
 * 로컬 저장 — 게스트 플레이와 오프라인 캐시를 모두 담당한다. (기획서 §8-3)
 *
 * 설계 원칙: **화면은 여기와 Firebase를 구분하지 않는다.**
 * profile.js / collection.js 가 앞단이고, 이 파일은 그 뒤의 한 겹이다.
 * 로그인 전이거나 네트워크가 끊겨도 게임이 그대로 돌아가야 하므로
 * 모든 상태의 원본은 항상 로컬에 있고, Firebase는 동기화 대상일 뿐이다.
 */

import { DEFAULT_DIFFICULTY, UNLOCK_COST, SHOE_TIERS } from '../config/balance.js';
import { DEFAULT_CHARACTER, FREE_CHARACTERS } from '../data/characters.js';

const KEY = {
  profile: 'sf_profile',
  collection: 'sf_collection',
  settings: 'sf_settings',
  pending: 'sf_pendingScores',
};

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false; // 사파리 프라이빗 모드 등 — 저장 실패해도 플레이는 계속된다
  }
}

// ─────────────────────────────────────────────
// 프로필
// ─────────────────────────────────────────────

/** @returns {object} 기획서 §8-1 users/{uid} 와 같은 모양 */
export function defaultProfile() {
  return {
    uid: null,
    nickname: '',
    email: '',
    selectedCharacter: DEFAULT_CHARACTER,
    unlockedCharacters: [...FREE_CHARACTERS],
    controlMode: 1,
    difficulty: DEFAULT_DIFFICULTY,
    shoesOwned: 0,
    shoesByTier: { t1: 0, t2: 0, t3: 0, t4: 0, t5: 0 },
    bestStairs: 0,
    bestByDifficulty: { easy: 0, normal: 0, hard: 0 },
    totalStairs: 0,
    totalPlays: 0,
    multiWins: 0,
    multiLosses: 0,
    elevatorUses: 0,
  };
}

export function loadProfile() {
  return { ...defaultProfile(), ...read(KEY.profile, {}) };
}

export function saveProfile(p) {
  return write(KEY.profile, p);
}

/** 부분 갱신 — 화면에서 매번 전체를 들고 다니지 않게 */
export function patchProfile(patch) {
  const p = { ...loadProfile(), ...patch };
  saveProfile(p);
  return p;
}

// ─────────────────────────────────────────────
// 도감 — 한 번 찾은 신발은 절대 사라지지 않는다 (기획서 §5-2)
// ─────────────────────────────────────────────

/** @returns {Record<string, {count:number, firstFoundAt:number}>} 키는 신발 index */
export function loadCollection() {
  return read(KEY.collection, {});
}

/** 원격과 합친 결과를 통째로 덮어쓸 때만 쓴다 (services/collection.js) */
export function saveCollection(c) {
  return write(KEY.collection, c);
}

/**
 * 신발 획득 기록.
 * @param {number} shoeIndex 0~129
 * @returns {boolean} 이번에 **처음** 찾은 신발이면 true
 */
export function recordShoe(shoeIndex) {
  const c = loadCollection();
  const k = String(shoeIndex);
  const isNew = !c[k];
  c[k] = isNew
    ? { count: 1, firstFoundAt: Date.now() }
    : { ...c[k], count: c[k].count + 1 };
  write(KEY.collection, c);
  return isNew;
}

/** 도감에 등록된 고유 종류 수 (0~130) */
export function dexUnique() {
  return Object.keys(loadCollection()).length;
}

/** @param {number} shoeIndex → 티어 1~5 */
export function tierOf(shoeIndex) {
  for (const t of SHOE_TIERS) {
    if (shoeIndex >= t.offset && shoeIndex < t.offset + t.count) return t.tier;
  }
  return 5;
}

// ─────────────────────────────────────────────
// 신발 자산 — 도감과 달리 **줄어든다**
// ─────────────────────────────────────────────

/** 이번 판에서 얻은 신발들을 자산에 반영 */
export function addShoes(indices) {
  const p = loadProfile();
  for (const i of indices) {
    const t = `t${tierOf(i)}`;
    p.shoesByTier[t] = (p.shoesByTier[t] ?? 0) + 1;
    p.shoesOwned++;
  }
  saveProfile(p);
  return p;
}

/**
 * 신발 차감 — **높은 티어부터** 소진한다. (기획서 §5-8 "티어가 높은 신발부터 사라집니다")
 * @param {number} n 차감할 켤레 수
 * @returns {boolean} 성공 여부 (부족하면 아무것도 건드리지 않는다)
 */
export function consumeShoes(n) {
  const p = loadProfile();
  if (p.shoesOwned < n) return false;
  let left = n;
  for (const t of ['t1', 't2', 't3', 't4', 't5']) {
    if (left <= 0) break;
    const take = Math.min(left, p.shoesByTier[t] ?? 0);
    p.shoesByTier[t] -= take;
    left -= take;
  }
  p.shoesOwned -= n - left;
  saveProfile(p);
  return left === 0;
}

/** 캐릭터 구매 — 비용만큼 차감하고 해금 목록에 넣는다 */
export function unlockCharacter(id) {
  const cost = UNLOCK_COST[id] ?? 0;
  const p = loadProfile();
  if (p.unlockedCharacters.includes(id)) return { ok: true, profile: p };
  if (p.shoesOwned < cost) return { ok: false, profile: p };
  consumeShoes(cost);
  const next = loadProfile();
  next.unlockedCharacters = [...next.unlockedCharacters, id];
  saveProfile(next);
  return { ok: true, profile: next };
}

// ─────────────────────────────────────────────
// 판 종료 반영
// ─────────────────────────────────────────────

/**
 * 한 판이 끝났을 때 호출. 기록·자산·도감을 한 번에 정리한다.
 * @param {{floor:number, difficulty:string, shoeIndices:number[]}} result
 */
export function commitRun(result) {
  const newDex = result.shoeIndices.filter((i) => recordShoe(i)).length;
  addShoes(result.shoeIndices);

  const p = loadProfile();
  p.totalPlays++;
  p.totalStairs += result.floor;
  if (result.floor > p.bestStairs) p.bestStairs = result.floor;
  const d = result.difficulty;
  if (result.floor > (p.bestByDifficulty[d] ?? 0)) p.bestByDifficulty[d] = result.floor;
  saveProfile(p);

  return { profile: p, newDex };
}

// ─────────────────────────────────────────────
// 오프라인 점수 큐 (M6 랭킹에서 소비)
// ─────────────────────────────────────────────

export function queueScore(entry) {
  const q = read(KEY.pending, []);
  q.push({ ...entry, queuedAt: Date.now() });
  write(KEY.pending, q.slice(-50)); // 무한 증식 방지
}

export function takeQueuedScores() {
  const q = read(KEY.pending, []);
  write(KEY.pending, []);
  return q;
}

/** 테스트·초기화용 */
export function resetAll() {
  for (const k of Object.values(KEY)) {
    try { localStorage.removeItem(k); } catch { /* 무시 */ }
  }
}
