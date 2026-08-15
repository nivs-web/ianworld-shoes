/**
 * 로컬 저장 — 게스트 플레이와 오프라인 캐시를 모두 담당한다. (기획서 §8-3)
 *
 * 설계 원칙: **화면은 여기와 Firebase를 구분하지 않는다.**
 * profile.js / collection.js 가 앞단이고, 이 파일은 그 뒤의 한 겹이다.
 * 로그인 전이거나 네트워크가 끊겨도 게임이 그대로 돌아가야 하므로
 * 모든 상태의 원본은 항상 로컬에 있고, Firebase는 동기화 대상일 뿐이다.
 */

import { DEFAULT_DIFFICULTY, UNLOCK_COST, SHOE_TIERS, DEX_BADGE_REQUIRED } from '../config/balance.js';
import { DEFAULT_CHARACTER, FREE_CHARACTERS } from '../data/characters.js';

const KEY = {
  profile: 'sf_profile',
  collection: 'sf_collection',
  settings: 'sf_settings',
  pending: 'sf_pendingScores',
  periodBest: 'sf_periodBest',
  settled: 'sf_settledMatches',
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
    /**
     * 신발별 **보유 켤레** — 도감(sf_collection)과 다른 것이다.
     *   도감 count = 지금까지 주운 누적 횟수. 절대 줄지 않는다. (기획서 §5-2)
     *   여기 값   = 지금 들고 있는 수. 캐릭터 구매·엘리베이터로 줄어든다.
     * 셋(shoesOwned / shoesByTier / shoesByIndex)은 항상 서로 맞아야 하고,
     * 맞추는 책임은 이 파일에만 있다. 화면은 읽기만 한다.
     * @type {Record<string, number>}
     */
    shoesByIndex: {},
    /** 0 = 신발별 보유량이 없던 옛 구조. loadProfile 이 한 번 복원한다 */
    walletVersion: 0,
    bestStairs: 0,
    bestByDifficulty: { easy: 0, normal: 0, hard: 0 },
    totalStairs: 0,
    totalPlays: 0,
    multiWins: 0,
    multiLosses: 0,
    elevatorUses: 0,
    /**
     * 도감완성 뱃지를 **딴 시각**(ms). 0 = 아직.
     * 한 번 찍히면 어떤 경우에도 지우지 않는다 — `stampDexBadge` 주석 참고.
     */
    dexBadgeAt: 0,
  };
}

export function loadProfile() {
  const p = { ...defaultProfile(), ...read(KEY.profile, {}) };
  if (p.walletVersion !== WALLET_VERSION) {
    migrateWallet(p);
    saveProfile(p); // 한 번만 돌면 되는 계산이라 결과를 굳힌다
    return p;
  }
  /**
   * 합계·티어별은 **읽을 때마다** 신발별 보유량에서 다시 만든다.
   * 쓰기 시점에만 맞추면, 원격에서 내려온 문서나 손으로 고친 저장값처럼
   * 밖에서 들어온 프로필이 어긋난 채로 화면에 뜬다. 130개 훑는 계산이라 공짜다.
   */
  return reconcile(p);
}

/** 지갑 구조 버전. 올리면 다음 실행 때 migrateWallet 이 한 번 더 돈다. */
const WALLET_VERSION = 1;

/**
 * shoesByIndex 가 생기기 전(2026-08-15 이전)에 만들어진 프로필을 채워 넣는다.
 *
 * 근거: 도감 count 는 "주운 횟수"라 **항상 보유 수 이상**이다. 그래서 도감을 출발점으로
 * 잡고 티어별 보유 수(shoesByTier)에 맞을 때까지 깎으면 원래 지갑이 복원된다.
 * 깎는 순서는 소비 규칙과 같다 — 많이 가진 신발부터.
 *
 * "비어 있으면 복원"이 아니라 **버전 표시**로 판단한다. 신발을 전부 써서 지갑이
 * 정상적으로 빈 사람까지 매번 다시 계산하게 되기 때문이다.
 */
function migrateWallet(p) {
  const dex = read(KEY.collection, {});
  const held = {};
  for (const [k, rec] of Object.entries(dex)) held[k] = rec?.count ?? 1;

  for (const t of SHOE_TIERS) {
    const keys = Object.keys(held).filter((k) => tierOf(Number(k)) === t.tier);
    const target = p.shoesByTier?.[`t${t.tier}`] ?? 0;
    let have = keys.reduce((n, k) => n + held[k], 0);
    while (have > target) {
      // 가장 많이 가진 신발부터 한 켤레씩 (동점이면 index 작은 쪽 — 결과가 매번 같아야 한다)
      const k = keys.reduce((a, b) => (held[b] > held[a] ? b : a));
      if (!held[k]) break;
      held[k]--;
      if (!held[k]) delete held[k];
      have--;
    }
  }

  p.shoesByIndex = held;
  p.walletVersion = WALLET_VERSION;
  reconcile(p); // 도감이 모자란 손상된 프로필이면 여기서 숫자끼리 아귀를 맞춘다
  return p;
}

/** shoesByIndex 를 진실로 삼아 합계·티어별을 다시 계산한다 */
export function reconcile(p) {
  const byTier = { t1: 0, t2: 0, t3: 0, t4: 0, t5: 0 };
  let total = 0;
  for (const [k, n] of Object.entries(p.shoesByIndex ?? {})) {
    if (!(n > 0)) continue;
    byTier[`t${tierOf(Number(k))}`] += n;
    total += n;
  }
  p.shoesByTier = byTier;
  p.shoesOwned = total;
  return p;
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
    const k = String(i);
    p.shoesByIndex[k] = (p.shoesByIndex[k] ?? 0) + 1;
  }
  reconcile(p);
  saveProfile(p);
  return p;
}

/** @param {number} shoeIndex → 지금 들고 있는 켤레 수 */
export function heldOf(shoeIndex) {
  return loadProfile().shoesByIndex?.[String(shoeIndex)] ?? 0;
}

/**
 * 신발 차감 — **높은 티어부터** 소진한다. (기획서 §5-8 "티어가 높은 신발부터 사라집니다")
 *
 * 같은 티어 안에서는 **많이 가진 신발부터** 뺀다. 종류를 지키는 쪽이 도감 게임에 맞고,
 * 동점이면 index 작은 쪽으로 고정해 같은 상황에서 항상 같은 결과가 나오게 했다.
 *
 * @param {number} n 차감할 켤레 수
 * @returns {boolean} 성공 여부 (부족하면 아무것도 건드리지 않는다)
 */
export function consumeShoes(n) {
  const p = loadProfile();
  if (p.shoesOwned < n) return false;

  let left = n;
  for (const t of SHOE_TIERS) {
    if (left <= 0) break;
    const keys = Object.keys(p.shoesByIndex).filter((k) => tierOf(Number(k)) === t.tier);
    while (left > 0 && keys.length) {
      let pick = null;
      for (const k of keys) {
        if (!(p.shoesByIndex[k] > 0)) continue;
        if (pick === null || p.shoesByIndex[k] > p.shoesByIndex[pick]) pick = k;
      }
      if (pick === null) break;
      p.shoesByIndex[pick]--;
      if (!p.shoesByIndex[pick]) delete p.shoesByIndex[pick];
      left--;
    }
  }

  reconcile(p);
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
  stampDexBadge(p);
  saveProfile(p);

  return { profile: p, newDex };
}

/**
 * 도감완성 뱃지는 **한 번 따면 영원히 남는다.** (2026-08-15 개정)
 *
 * 예전에는 "지금 들고 있는 종류가 130종"으로 판정했다. 그러면 캐릭터를 사거나
 * 엘리베이터를 타서 신발이 한 켤레라도 빠지는 순간 뱃지가 사라졌다 —
 * 130종을 다 모은 사람이 신발을 쓸 때마다 훈장을 뺏기는 셈이라 쓸 수가 없다.
 *
 * 이제 기준은 **도감**이다. 도감은 "주운 적 있는가"라서 절대 줄지 않는다(기획서 §5-2).
 * 게다가 판정 결과를 프로필에 도장으로 찍어 둔다 — 도감 데이터가 어떤 이유로든
 * 비어 버려도(기기 교체 중 동기화 실패 등) 뱃지는 남는다.
 *
 * `dexBadgeAt` 은 딴 시각(ms). 한 번 값이 들어가면 **다시 지우지 않는다.**
 */
export function stampDexBadge(p) {
  if (p.dexBadgeAt) return p;                       // 이미 땄다 — 다시 볼 필요 없다
  if (dexUnique() < DEX_BADGE_REQUIRED) return p;
  p.dexBadgeAt = Date.now();
  return p;
}

/**
 * 도감이 이미 130종인데 도장이 없는 프로필을 구제한다.
 * 개정 전에 도감을 다 채운 사람은 `dexBadgeAt` 이 없다 —
 * 그 사람들이 판을 한 번 더 돌아야 뱃지를 되찾는 건 말이 안 된다.
 */
export function ensureDexBadge() {
  const p = loadProfile();
  if (p.dexBadgeAt) return p;
  if (dexUnique() < DEX_BADGE_REQUIRED) return p;
  p.dexBadgeAt = Date.now();
  saveProfile(p);
  return p;
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

/** 아직 못 올린 판이 몇 개인가 (진단용) */
export function loadPendingCount() {
  return read(KEY.pending, []).length;
}

// ─────────────────────────────────────────────
// 멀티 정산 (M7)
// ─────────────────────────────────────────────

/**
 * 지정한 신발을 **정확히 그것만** 뺀다 — 멀티 패배 정산용.
 *
 * `consumeShoes()` 와 다르다. 그쪽은 캐릭터 구매용이라 높은 티어부터 깎지만,
 * 멀티 패배는 무작위로 뽑힌 그 신발이 그대로 나가야 한다(기획서 §5-7).
 * 도감은 건드리지 않는다 — 종류 기록은 남고 수량만 줄어든다.
 *
 * @param {number[]} indices
 * @returns {number[]} 실제로 빠진 신발들 (없던 건 조용히 빠진다)
 */
export function removeShoesByIndex(indices = []) {
  const p = loadProfile();
  const gone = [];
  for (const i of indices) {
    const k = String(i);
    if ((p.shoesByIndex[k] ?? 0) <= 0) continue;
    p.shoesByIndex[k] -= 1;
    if (p.shoesByIndex[k] <= 0) delete p.shoesByIndex[k];
    gone.push(Number(i));
  }
  reconcile(p);
  saveProfile(p);
  return gone;
}

/**
 * 이미 정산한 방 목록. **같은 방을 두 번 정산하면 안 된다.**
 * 결과는 여러 경로로 도착할 수 있다 — 게임 직후 화면, 다음 접속의 미정산 청산,
 * 승자가 패자별로 나눠 받는 경우까지. 그래서 방+상대 단위로 도장을 찍는다.
 */
export function isSettled(tag) {
  return !!read(KEY.settled, {})[tag];
}

export function markSettled(tag) {
  const m = read(KEY.settled, {});
  m[tag] = Date.now();
  // 무한 증식 방지 — 최근 200건만 남긴다
  const keys = Object.keys(m);
  if (keys.length > 200) {
    keys.sort((a, b) => m[a] - m[b]).slice(0, keys.length - 200).forEach((k) => delete m[k]);
  }
  write(KEY.settled, m);
  return m;
}

/**
 * 멀티에 한 번이라도 들어간 적이 있는가.
 * 접속할 때 RTDB(192KB)를 받을지 말지를 이걸로 가른다 — 싱글만 하는 사람은 안 받는다.
 */
export function everPlayedMulti() {
  const p = loadProfile();
  if ((p.multiWins ?? 0) + (p.multiLosses ?? 0) > 0) return true;
  return Object.keys(read(KEY.settled, {})).length > 0 || !!p.joinedMultiAt;
}

/** 방에 들어간 순간 남기는 흔적 (아직 정산 기록이 없어도 청산 대상이 되게) */
export function noteMultiJoin() {
  const p = loadProfile();
  if (p.joinedMultiAt) return p;
  p.joinedMultiAt = Date.now();
  saveProfile(p);
  return p;
}

/** 멀티 전적 */
export function recordMatch(won) {
  const p = loadProfile();
  if (won) p.multiWins = (p.multiWins ?? 0) + 1;
  else p.multiLosses = (p.multiLosses ?? 0) + 1;
  saveProfile(p);
  return p;
}

// ─────────────────────────────────────────────
// 기간별 최고기록 흔적 (M6 랭킹)
// ─────────────────────────────────────────────

/**
 * "이 기간 문서에 내가 얼마를 올려 뒀는가"를 기억한다.
 *
 * 순위표 문서는 사람×난이도×기간마다 한 장이고 **점수가 오를 때만** 덮어쓴다.
 * 이 기록이 없으면 판이 끝날 때마다 세 장을 무조건 다시 써서, 대부분은
 * 규칙에 막히면서 헛되이 쓰기 한도만 먹는다.
 *
 * 어디까지나 **아낌용 힌트**다. 다른 기기에서 더 높은 기록을 올렸다면 여기 값은
 * 낮게 남아 있지만, 그때는 규칙이 막아 주므로 결과가 틀어지지는 않는다.
 * @type {Record<string, number>}
 */
export function loadPeriodBest() {
  return read(KEY.periodBest, {});
}

export function periodBest(docId) {
  return loadPeriodBest()[docId] ?? -1;
}

export function hasPeriodBest(docId) {
  return docId in loadPeriodBest();
}

/**
 * @param {string[]} keepKeys 지금 기간의 키들 — 여기 없는 항목은 버린다.
 *   지난 주·지난 달 문서는 어떤 화면에도 안 나오므로 들고 있을 이유가 없다.
 */
export function notePeriodBest(docId, stairs, keepKeys = null) {
  const m = loadPeriodBest();
  m[docId] = Math.max(m[docId] ?? 0, stairs | 0);
  write(KEY.periodBest, keepKeys ? prunePeriodBest(m, keepKeys) : m);
  return m;
}

export function prunePeriodBest(map, keepKeys) {
  const out = {};
  for (const [id, v] of Object.entries(map)) {
    if (keepKeys.some((k) => id.endsWith(`_${k}`))) out[id] = v;
  }
  return out;
}

/** 테스트·초기화용 */
export function resetAll() {
  for (const k of Object.values(KEY)) {
    try { localStorage.removeItem(k); } catch { /* 무시 */ }
  }
}
