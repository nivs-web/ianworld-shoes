/**
 * 도감 동기화 — `users/{uid}/collection/{shoeId}`.
 *
 * 도감은 **한 번 찾으면 절대 사라지지 않는다** (기획서 §5-2). 그래서 동기화 규칙도 단순하다:
 * 양쪽을 합칠 때 **합집합**을 취하고, 최초 획득일은 **더 이른 쪽**, 누적 횟수는 **큰 쪽**을 남긴다.
 * 어느 기기에서 먼저 찾았든 기록이 사라지지 않는다.
 */

/**
 * ★ **원격 호출은 전부 `withTimeout` 으로 감싼다.** (2026-08-16)
 *
 * 파이어스토어는 연결이 막히면 **거절하지 않고 영원히 기다린다**(CLAUDE.md §9-0-7).
 * `profile.js` · `leaderboard.js` 는 그래서 전부 감쌌는데 이 파일만 빠져 있었다.
 * 그 결과 파이어스토어가 막히는 환경에서 로그인하면 `pullAll()` → `pullAndMerge()` 의
 * `getDocs` 가 안 끝나고, `SplashLogin.onGoogle` 의 `finally { busy = false }` 에
 * 도달하지 못해 **로그인 버튼이 완전히 죽었다.** 새로 고치는 것 말고는 방법이 없었다.
 */
import { getStore, configured, withTimeout } from './firebase.js';
import { currentUser } from './auth.js';
import * as L from './storageLocal.js';
import shoesData from '../data/shoes.json';

/** 아틀라스 index → 문서 ID (`t5_017` 형식, 기획서 §8-1) */
function shoeDocId(index) {
  return shoesData.shoes[index]?.id ?? `idx_${index}`;
}

function colRef(fb, uid) {
  return fb.storeMod.collection(fb.db, 'users', uid, 'collection');
}

function active() {
  const u = currentUser();
  return configured() && u && !u.guest ? u : null;
}

/**
 * 이번 판에서 주운 신발들을 원격 도감에 올린다.
 * 실패해도 로컬에는 이미 들어가 있으므로 다음 접속에 다시 시도된다.
 * @param {number[]} indices
 */
export async function pushFound(indices) {
  const u = active();
  if (!u || !indices.length) return;
  const fb = await getStore();
  if (!fb) return;

  const local = L.loadCollection();
  const batch = fb.storeMod.writeBatch(fb.db);
  // 같은 신발을 한 판에 여러 번 주울 수 있으니 종류별로 묶는다
  for (const index of [...new Set(indices)]) {
    const rec = local[String(index)];
    if (!rec) continue;
    const ref = fb.storeMod.doc(colRef(fb, u.uid), shoeDocId(index));
    batch.set(ref, {
      shoeId: shoeDocId(index),
      index,
      tier: L.tierOf(index),
      firstFoundAt: rec.firstFoundAt,
      count: rec.count,
    }, { merge: true });
  }
  await withTimeout(batch.commit(), undefined, '도감 올리기');
}

/**
 * 로그인 직후 — 원격 도감을 끌어내려 로컬과 합친다.
 * @returns {Promise<number>} 합친 뒤의 고유 종류 수
 */
export async function pullAndMerge() {
  const u = active();
  if (!u) return L.dexUnique();
  const fb = await getStore();
  if (!fb) return L.dexUnique();

  const snap = await withTimeout(fb.storeMod.getDocs(colRef(fb, u.uid)), undefined, '도감 읽기');
  const local = L.loadCollection();
  const merged = { ...local };
  const onlyLocal = [];

  for (const d of snap.docs) {
    const r = d.data();
    const k = String(r.index);
    const mine = local[k];
    merged[k] = mine
      ? {
          firstFoundAt: Math.min(mine.firstFoundAt, r.firstFoundAt ?? Infinity),
          count: Math.max(mine.count ?? 0, r.count ?? 0),
        }
      : { firstFoundAt: r.firstFoundAt ?? Date.now(), count: r.count ?? 1 };
  }
  // 원격에 없는 로컬 기록은 올려준다 (게스트로 모은 것들)
  const remoteKeys = new Set(snap.docs.map((d) => String(d.data().index)));
  for (const k of Object.keys(local)) if (!remoteKeys.has(k)) onlyLocal.push(Number(k));

  L.saveCollection(merged);
  if (onlyLocal.length) await pushFound(onlyLocal).catch(() => {});
  return Object.keys(merged).length;
}
