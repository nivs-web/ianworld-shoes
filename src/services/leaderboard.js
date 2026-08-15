/**
 * 명예의 전당 — 기록 제출과 랭킹 조회. (기획서 §5-9, S07)
 *
 * **집계 서버 없이 클라이언트 쿼리만으로 돌린다.**
 * 기획서는 Cloud Functions 가 `leaderboards/*` 를 굽는 그림이었지만, 그건 유료 요금제가
 * 필요하다. 대신 두 갈래로 나눠서 지금 구조 그대로 정확한 순위를 낸다:
 *
 *   신발왕 · 역대  → `users` 를 바로 정렬한다. 계정당 한 줄이라 중복이 없다.
 *   주간 · 월간 · 연간 → `scores` 를 기간으로 걸러 정렬한다.
 *
 * 기간 조회에 부등호(`createdAt >= 시작`)를 쓰면 Firestore 는 **부등호를 건 필드로 먼저
 * 정렬하라**고 요구한다. 그러면 "계단 수 상위"를 못 뽑는다. 그래서 제출할 때 기간 키를
 * 미리 문자열로 박아 둔다(`wk`·`mo`·`yr`) — 등호 비교라 계단 수로 바로 정렬할 수 있다.
 *
 * ## `scores` 는 판마다 한 장이 아니다
 *
 * 문서 ID를 `uid_난이도_기간키` 로 **못 박고**, 그 기간의 최고기록 한 장만 남긴다.
 * 판마다 한 장씩 쌓던 예전 방식과 견주면:
 *
 *   - **닉네임을 바꾸면 즉시 반영된다.** 고칠 문서가 지금 기간 3장뿐이다.
 *     판마다 쌓으면 수백 장을 고쳐야 해서 사실상 옛 이름이 박제된다 — 200켤레를 내고
 *     이름을 바꿨는데 순위표에 옛 이름이 남으면 산 게 아니다.
 *   - **읽기가 1/3이다.** 한 사람이 도배하는 걸 막으려고 300건을 받아 uid로 접던 것이
 *     계정당 한 줄이 보장되니 100건이면 끝난다.
 *   - **내 순위는 쿼리가 아니라 문서 하나 읽기다.** 색인도 필요 없다.
 *   - **점수가 오를 때만 덮어쓴다**를 보안 규칙이 강제하므로, 클라이언트를 조작해도
 *     자기 기록을 낮출 수 없다. (`docs/FIREBASE_RULES.md`)
 */

import { getStore, configured, withTimeout } from './firebase.js';
import { currentUser } from './auth.js';
import * as L from './storageLocal.js';
import { LEADERBOARD } from '../config/balance.js';
import { PERIODS, PERIOD_BY_TAB, DIFFICULTIES, scoreDocId, currentKeys } from './periodKeys.js';

export { weekKey, monthKey, yearKey, PERIODS, DIFFICULTIES, scoreDocId } from './periodKeys.js';

/**
 * 네트워크가 없을 때 Firestore 는 **예외를 던지지 않고** 로컬 캐시로 답한다.
 * 캐시가 비어 있으면 빈 결과가 오는데, 그대로 그리면 연결이 끊긴 사람에게
 * "아직 기록이 없습니다"라고 거짓말을 하게 된다. 그래서 둘을 구분한다.
 */
const offline = (snap) => snap.metadata?.fromCache && snap.empty;

// ─────────────────────────────────────────────
// 제출
// ─────────────────────────────────────────────

/**
 * 한 판의 기록을 올린다. 기간 3종(주·월·연)에 각각 한 장씩, **기존보다 높을 때만**.
 * 실패해도 게임은 멈추지 않는다 — 로컬 큐(`sf_pendingScores`)에 남아 다음 접속에 다시 올라간다.
 *
 * @param {{stairs:number, difficulty:string, shoesFound:number, mode?:string, at?:number}} entry
 * @returns {Promise<boolean>} 더 시도할 일이 남지 않았는지 (false면 큐에 남긴다)
 */
export async function submitScore(entry) {
  const u = currentUser();
  if (!configured() || !u || u.guest) return false;
  const fb = await getStore();
  if (!fb) return false;

  const p = L.loadProfile();
  const when = entry.at ? new Date(entry.at) : new Date();
  const stairs = entry.stairs | 0;
  const difficulty = entry.difficulty;
  const keep = currentKeys(when);

  let settled = true;
  for (const period of PERIODS) {
    const key = period.keyOf(when);
    const id = scoreDocId(u.uid, difficulty, key);
    // 이 기간에 이미 더 높은 기록을 올려 뒀다면 규칙이 어차피 막는다 — 헛품을 아낀다
    if (stairs <= L.periodBest(id)) continue;

    try {
      await withTimeout(fb.storeMod.setDoc(fb.storeMod.doc(fb.db, 'scores', id), {
        uid: u.uid,
        nickname: p.nickname ?? '',
        characterId: p.selectedCharacter ?? '',
        stairs,
        shoesFound: entry.shoesFound | 0,
        difficulty,
        mode: entry.mode ?? 'single',
        period: period.field,
        key,
        [period.field]: key,
        updatedAt: fb.storeMod.serverTimestamp(),
      }), undefined, '기록 제출');
      L.notePeriodBest(id, stairs, keep);
    } catch (e) {
      /**
       * 규칙이 막았다면 **다른 기기에서 더 높은 기록을 올린 것**이다(규칙은 `>=` 만 통과시킨다).
       * 즉 서버 값이 이 점수보다 확실히 크므로, 로컬 하한을 여기까지 올려 두면
       * 같은 점수로 다시 두드리지 않는다. 재시도할 일도 아니다.
       */
      if (e?.code === 'permission-denied') {
        L.notePeriodBest(id, stairs, keep);
        continue;
      }
      console.warn('[랭킹] 기록 제출 실패 — 큐에 남긴다', e);
      settled = false;
    }
  }
  return settled;
}

/**
 * 오프라인 동안 쌓인 기록을 몰아서 올린다 (로그인 직후).
 * 실패분만 큐로 되돌린다 — 성공한 것까지 되돌리면 다음에 또 올려 쓰기만 낭비한다.
 */
export async function flushQueued() {
  const u = currentUser();
  if (!configured() || !u || u.guest) return 0;

  const queued = L.takeQueuedScores();
  if (!queued.length) return 0;

  const failed = [];
  let sent = 0;
  for (const q of queued) {
    const ok = await submitScore({
      stairs: q.stairs,
      difficulty: q.difficulty,
      shoesFound: q.shoesFound,
      at: q.queuedAt,
    });
    if (ok) sent++;
    else failed.push(q);
  }
  for (const q of failed) L.queueScore(q);
  return sent;
}

/**
 * 닉네임·캐릭터를 **이미 올라간 기간 기록에도** 반영한다.
 *
 * 신발왕·역대 탭은 `users` 를 읽으므로 저절로 최신이지만, 주간·월간·연간은
 * `scores` 에 박아 둔 값을 그대로 보여 준다. 이걸 안 맞추면 이름을 바꿔도
 * 순위표에는 옛 이름이 남고, 하단 '내 순위'만 새 이름이라 더 이상해 보인다.
 *
 * 고칠 문서는 **지금 기간 × 난이도 3종**뿐이다. 지난 주 문서는 어떤 화면에도 안 나온다.
 * 올린 적 없는 문서는 건너뛴다 — 없는 문서에 updateDoc 을 날려도 실패만 한다.
 */
export async function syncIdentity() {
  const u = currentUser();
  if (!configured() || !u || u.guest) return 0;
  const fb = await getStore();
  if (!fb) return 0;

  const p = L.loadProfile();
  const patch = { nickname: p.nickname ?? '', characterId: p.selectedCharacter ?? '' };

  let n = 0;
  for (const difficulty of DIFFICULTIES) {
    for (const period of PERIODS) {
      const id = scoreDocId(u.uid, difficulty, period.keyOf());
      if (!L.hasPeriodBest(id)) continue;
      try {
        await withTimeout(fb.storeMod.updateDoc(fb.storeMod.doc(fb.db, 'scores', id), patch), undefined, '이름 동기화');
        n++;
      } catch {
        // 문서가 없거나 규칙에 막혔다 — 순위표가 조금 늦게 맞을 뿐 게임에는 지장 없다
      }
    }
  }
  return n;
}

// ─────────────────────────────────────────────
// 조회
// ─────────────────────────────────────────────

/** @typedef {{uid:string, nickname:string, characterId:string, value:number, rank:number|null}} Row */

/**
 * 순위표 한 장.
 * @param {'shoeking'|'alltime'|'weekly'|'monthly'|'yearly'} tab
 * @param {'easy'|'normal'|'hard'} [difficulty] 신발왕에는 쓰이지 않는다
 * @returns {Promise<{rows:Row[], me:Row|null, error:string|null}>}
 *   error: null 성공 / 'auth' 로그인 안 됨 / 'offline' 연결 불가 / 'failed' 조회 실패.
 *   **왜 비었는지 구분해서 돌려준다** — 예전에는 셋 다 null 이라 화면이
 *   전부 "아직 기록이 없습니다"로 거짓말을 했다.
 */
const fail = (error) => ({ rows: [], me: null, error });

export async function fetchBoard(tab, difficulty) {
  if (!configured()) return fail('offline');
  if (!currentUser()) return fail('auth');
  const fb = await getStore();
  if (!fb) return fail('offline');
  const { collection, query, orderBy, where, limit, getDocs } = fb.storeMod;
  const top = LEADERBOARD.topN;

  try {
    let rows;
    if (tab === 'shoeking' || tab === 'alltime') {
      // 계정 문서를 바로 정렬한다 — 계정당 한 줄이라 접을 필요가 없다
      const field = tab === 'shoeking' ? 'shoesOwned' : `bestByDifficulty.${difficulty}`;
      const snap = await getDocs(
        query(collection(fb.db, 'users'), orderBy(field, 'desc'), limit(top))
      );
      if (offline(snap)) return fail('offline');
      rows = snap.docs.map((d) => {
        const v = d.data();
        return {
          uid: d.id,
          nickname: v.nickname ?? '',
          characterId: v.selectedCharacter ?? '',
          value: (tab === 'shoeking' ? v.shoesOwned : v.bestByDifficulty?.[difficulty]) ?? 0,
        };
      });
    } else {
      // 문서 하나 = 사람 하나의 그 기간 최고기록. 중복이 없으니 그대로 상위 100장이다
      const period = PERIOD_BY_TAB[tab];
      const snap = await getDocs(
        query(
          collection(fb.db, 'scores'),
          where('difficulty', '==', difficulty),
          where(period.field, '==', period.keyOf()),
          orderBy('stairs', 'desc'),
          limit(top)
        )
      );
      if (offline(snap)) return fail('offline');
      rows = snap.docs.map((d) => {
        const v = d.data();
        return {
          uid: v.uid,
          nickname: v.nickname ?? '',
          characterId: v.characterId ?? '',
          value: v.stairs ?? 0,
        };
      });
    }

    rows.forEach((r, i) => { r.rank = i + 1; });

    // 100위 밖이면 하단 고정 행을 위해 내 값을 따로 구한다 (순위는 알 수 없어 null)
    const u = currentUser();
    const mine = rows.find((r) => r.uid === u?.uid);
    const me = mine ?? (u ? await myRow(fb, tab, difficulty, u) : null);
    return { rows, me, error: null };
  } catch (e) {
    // 색인이 없으면 Firestore 가 만들 링크를 콘솔에 찍어 준다
    console.warn('[랭킹] 조회 실패', e?.code, e);
    return fail(e?.code === 'permission-denied' ? 'auth' : 'failed');
  }
}

/**
 * 순위표에 못 든 나.
 *
 * 신발왕·역대는 로컬 프로필에 같은 값이 있으므로 그냥 읽는다.
 * **주간·월간·연간은 다르다** — 로컬에는 기간별 최고 기록이 없다.
 * `bestByDifficulty`(역대 최고)를 대신 쓰면 이번 주에 한 판도 안 한 사람에게
 * 작년 기록이 이번 주 순위처럼 보인다. 그래서 그 기간 문서를 직접 읽는다.
 * 문서 ID가 정해져 있으므로 쿼리가 아니라 **읽기 한 번**이면 된다.
 */
async function myRow(fb, tab, difficulty, u) {
  const p = L.loadProfile();
  const base = {
    uid: u.uid, nickname: p.nickname ?? '', characterId: p.selectedCharacter ?? '', rank: null,
  };

  if (tab === 'shoeking') return { ...base, value: p.shoesOwned ?? 0 };
  if (tab === 'alltime') return { ...base, value: p.bestByDifficulty?.[difficulty] ?? 0 };

  const period = PERIOD_BY_TAB[tab];
  const id = scoreDocId(u.uid, difficulty, period.keyOf());
  const snap = await fb.storeMod.getDoc(fb.storeMod.doc(fb.db, 'scores', id));
  return { ...base, value: snap.exists() ? (snap.data().stairs ?? 0) : 0 };
}
