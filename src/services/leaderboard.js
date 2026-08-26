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
 * 미리 문자열로 박아 둔다(`dy`·`wk`·`mo`) — 등호 비교라 계단 수로 바로 정렬할 수 있다.
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
import { PERIODS, PERIOD_BY_TAB, DIFFICULTIES, scoreDocId, currentKeys, currentKeyMap, winsFromSortKey } from './periodKeys.js';
import { MULTI } from '../config/balance.js';
/**
 * 승률왕 자격 판정은 **순수 계산이라 `matchRules.js` 에 둔다** — 이 파일은
 * `firebase.js` 를 물어서 노드에서 부르는 순간 죽는다(§9-0-5 의 그 제약).
 * 검사가 브라우저 없이 규칙을 확인할 수 있어야 한다.
 */
import { rateEligible } from './matchRules.js';
/**
 * ★ 순위표 줄에 **착용한 아이템**을 같이 싣는다. (2026-08-21 30차, 사용자 지정)
 *
 * `data/items.js` 는 표 하나뿐인 순수 모듈이라 서비스가 물어도 안전하다
 * (`game/**` 을 물면 canvas·assets 가 딸려 와 노드 검사가 그 자리에서 죽는다).
 */
import { packItems, parseItems, ITEMS_MAX } from '../data/items.js';

/** 계정 문서(`users`)의 `equippedItems` → 아이템 id 배열 */
const wornOf = (v) => Object.values(v?.equippedItems ?? {}).filter(Boolean);

export { dayKey, weekKey, monthKey, PERIODS, DIFFICULTIES, scoreDocId } from './periodKeys.js';

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
        // 착용 모습은 **한 줄 문자열**로 싣는다 — 슬롯이 늘어도 규칙을 안 고친다
        items: packItems(p.equippedItems).slice(0, ITEMS_MAX),
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

  /**
   * ★ **큐를 먼저 비우지 않는다.** (2026-08-16)
   *
   * 예전에는 `takeQueuedScores()` 로 통째로 꺼내고(=비우고) 하나씩 올린 뒤
   * 실패한 것만 되돌려 넣었다. 그런데 한 건에 최대 12초(타임아웃)가 걸리므로
   * 여러 건이면 전송에만 1분이 넘게 걸린다. **그 사이에 앱을 닫으면 대기 중이던
   * 기록이 통째로 사라졌다** — 오프라인에서 열심히 쌓은 기록일수록 잘 날아간다.
   *
   * 지금은 읽기만 하고, **성공한 것만** 하나씩 지운다.
   */
  const queued = L.peekQueuedScores();
  if (!queued.length) return 0;

  let sent = 0;
  for (const q of queued) {
    const ok = await submitScore({
      stairs: q.stairs,
      difficulty: q.difficulty,
      shoesFound: q.shoesFound,
      at: q.queuedAt,
    });
    if (!ok) continue;
    sent++;
    L.dropQueuedScores([q]);   // 한 건 성공할 때마다 곧바로 지운다
  }
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
  const patch = {
    nickname: p.nickname ?? '',
    characterId: p.selectedCharacter ?? '',
    // 아이템도 같이 맞춘다 — 개명과 마찬가지로 **지금 모습**이 순위표에 떠야 한다
    items: packItems(p.equippedItems).slice(0, ITEMS_MAX),
  };

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

/** @typedef {{uid:string, nickname:string, characterId:string, items:string[], value:number, rank:number|null}} Row */

/**
 * 순위표 한 장.
 * @param {'shoeking'|'alltime'|'daily'|'weekly'|'monthly'} tab
 * @param {'easy'|'normal'|'hard'} [difficulty] 신발왕에는 쓰이지 않는다
 * @returns {Promise<{rows:Row[], me:Row|null, error:string|null}>}
 *   error: null 성공 / 'auth' 로그인 안 됨 / 'offline' 연결 불가 / 'failed' 조회 실패.
 *   **왜 비었는지 구분해서 돌려준다** — 예전에는 셋 다 null 이라 화면이
 *   전부 "아직 기록이 없습니다"로 거짓말을 했다.
 */
const fail = (error) => ({ rows: [], me: null, error, mePromise: null });

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
      const snap = await withTimeout(getDocs(
        query(collection(fb.db, 'users'), orderBy(field, 'desc'), limit(top))
      ), undefined, '순위표 조회');
      if (offline(snap)) return fail('offline');
      rows = snap.docs.map((d) => {
        const v = d.data();
        return {
          uid: d.id,
          nickname: v.nickname ?? '',
          characterId: v.selectedCharacter ?? '',
          items: wornOf(v),
          value: (tab === 'shoeking' ? v.shoesOwned : v.bestByDifficulty?.[difficulty]) ?? 0,
          /**
           * ★ 신발왕 탭에 **멀티 승률**을 같이 싣는다. (2026-08-19 11차, 사용자 요청)
           * *"신발 많은 사람이 몇 승 했나 보이도록"*. 이 두 값은 이미 계정 문서에
           * 올라와 있으므로(`multiSettle.pushWallet`) 조회가 더 늘지 않는다.
           */
          shoesOwned: v.shoesOwned ?? 0,
          multiWins: v.multiWins ?? 0,
          multiLosses: v.multiLosses ?? 0,
        };
      });
    } else {
      // 문서 하나 = 사람 하나의 그 기간 최고기록. 중복이 없으니 그대로 상위 100장이다
      const period = PERIOD_BY_TAB[tab];
      const snap = await withTimeout(getDocs(
        query(
          collection(fb.db, 'scores'),
          where('difficulty', '==', difficulty),
          where(period.field, '==', period.keyOf()),
          orderBy('stairs', 'desc'),
          limit(top)
        )
      ), undefined, '순위표 조회');
      if (offline(snap)) return fail('offline');
      rows = snap.docs.map((d) => {
        const v = d.data();
        return {
          uid: v.uid,
          nickname: v.nickname ?? '',
          characterId: v.characterId ?? '',
          items: parseItems(v.items),
          value: v.stairs ?? 0,
        };
      });
    }

    rows.forEach((r, i) => { r.rank = i + 1; });

    /**
     * 100위 밖이면 하단 고정 행을 위해 내 값을 따로 구한다 (순위는 알 수 없어 null).
     *
     * **이걸 기다렸다가 목록을 그리면 안 된다.** 조회가 한 번 더 나가는데,
     * 순위표는 이미 손에 있다. 기다리면 "눌렀는데 한참 뒤에 뜬다"가 된다.
     * 그래서 목록은 즉시 돌려주고 내 줄은 `mePromise` 로 따로 흘려보낸다.
     */
    const u = currentUser();
    const mine = rows.find((r) => r.uid === u?.uid);
    return {
      rows,
      me: mine ?? null,
      error: null,
      mePromise: mine || !u ? null : myRow(fb, tab, difficulty, u).catch(() => null),
    };
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
    items: wornOf(p),
    // 하단 고정 줄도 목록과 **같은 칸**을 그린다 — 없으면 내 줄만 승률 칸이 비어 보인다
    shoesOwned: p.shoesOwned ?? 0,
    multiWins: p.multiWins ?? 0,
    multiLosses: p.multiLosses ?? 0,
  };

  if (tab === 'shoeking') return { ...base, value: p.shoesOwned ?? 0 };
  if (tab === 'alltime') return { ...base, value: p.bestByDifficulty?.[difficulty] ?? 0 };

  const period = PERIOD_BY_TAB[tab];
  const id = scoreDocId(u.uid, difficulty, period.keyOf());
  const snap = await withTimeout(fb.storeMod.getDoc(fb.storeMod.doc(fb.db, 'scores', id)), undefined, '내 순위');
  return { ...base, value: snap.exists() ? (snap.data().stairs ?? 0) : 0 };
}

/**
 * 유저상태창에 필요한 남의 계정 값. (2026-08-19 11차)
 *
 * ★ **`getDoc` 이 아니라 쿼리다.** Firestore 규칙이 `users` 를 `get: isMe(uid)` /
 * `list: signedIn()` 으로 갈라 뒀다 — 남의 문서를 **직접 읽으면 거부**되지만, 쿼리
 * (=list)는 로그인한 사람에게 열려 있다(닉네임 중복 확인 때문에 원래 그렇다).
 * 그래서 문서 ID 로 거르는 쿼리 한 번으로 받는다.
 *
 * 주간·월간·연간 탭의 줄에는 신발·승패가 없다(그 줄은 `scores` 에서 온다). 그래서
 * 명예의 전당에서 아무 줄이나 눌러도 카드가 채워지려면 이 조회가 필요하다.
 *
 * @returns {Promise<{nickname:string, characterId:string, shoesOwned:number,
 *                    multiWins:number, multiLosses:number}|null>}
 */
export async function fetchUserCard(uid) {
  if (!uid || !configured() || !currentUser()) return null;
  const fb = await getStore();
  if (!fb) return null;
  const { collection, query, where, limit, getDocs, documentId } = fb.storeMod;
  try {
    const snap = await withTimeout(getDocs(
      query(collection(fb.db, 'users'), where(documentId(), '==', uid), limit(1))
    ), undefined, '유저 카드');
    const d = snap.docs[0];
    if (!d) return null;
    const v = d.data();
    return {
      nickname: v.nickname ?? '',
      characterId: v.selectedCharacter ?? '',
      shoesOwned: v.shoesOwned ?? 0,
      multiWins: v.multiWins ?? 0,
      multiLosses: v.multiLosses ?? 0,
      // 유저상태창 맨 아래 줄 (2026-08-19 12차)
      lastLoginAt: v.lastLoginAt ?? 0,
    };
  } catch { return null; }
}

// ─────────────────────────────────────────────
// 멀티게임순위 (2026-08-19 23차)
// ─────────────────────────────────────────────

/**
 * 멀티게임순위 다섯 탭. 명예의 전당과 **같은 뼈대**를 쓰되 보는 값이 다르다.
 *
 *   승리왕  `multiWins`  내림차순
 *   승률왕  `winRate`    내림차순 — **10판 미만은 그 필드가 아예 없어서 빠진다**
 *   오늘·주간·월간  `mwDy`·`mwWk`·`mwMo` (= `"기간키#뒤집은승수"`) 범위 조회
 *
 * ## 복합 색인을 하나도 안 쓴다
 *
 * `where(기간키) + orderBy(승수)` 로 짰다면 복합 색인 3개를 콘솔에서 손으로 만들어야
 * 하고, 하나라도 빠지면 그 탭이 **빈 채로** 뜬다(원인이 화면에 안 보인다). 기간 키와
 * 승수를 한 필드에 담아 **같은 필드로 범위 조회 + 정렬**하면 Firestore 가 모든 필드에
 * 자동으로 만들어 두는 단일 색인만으로 끝난다 — 콘솔 작업이 없다는 뜻이다.
 *
 * @param {'wins'|'rate'|'daily'|'weekly'|'monthly'} tab
 */
/**
 * 승률왕은 걸러 낸 뒤에 100명을 채워야 하므로 넉넉히 받는다.
 * 300은 §9-0-5 이전에 `scores` 를 uid 로 접을 때 쓰던 것과 같은 크기다 — 한 번의
 * 조회로 감당되는 선이고, 잠든 사람이 그보다 많이 위에 쌓이는 상황은 사실상 없다.
 */
const RATE_FETCH = 300;

export async function fetchMultiBoard(tab) {
  if (!configured()) return fail('offline');
  if (!currentUser()) return fail('auth');
  const fb = await getStore();
  if (!fb) return fail('offline');
  const { collection, query, orderBy, where, limit, getDocs } = fb.storeMod;
  const top = LEADERBOARD.topN;

  const base = (v, uid) => ({
    uid,
    nickname: v.nickname ?? '',
    characterId: v.selectedCharacter ?? '',
    items: wornOf(v),
    multiWins: v.multiWins ?? 0,
    multiLosses: v.multiLosses ?? 0,
    shoesOwned: v.shoesOwned ?? 0,
  });

  try {
    let rows;
    if (tab === 'wins' || tab === 'rate') {
      const field = tab === 'wins' ? 'multiWins' : 'winRate';
      /**
       * ★ 승률왕만 **넉넉히 받아서 거른다.** (2026-08-19 24차)
       *
       * 자격이 둘이다 — ①10게임 이상 ②최근 일주일 안에 한 판. ②는 **시간이 지나면
       * 저절로 성립하지 않게 되는 조건**이라 서버 필드로 못 박을 수가 없다: 잠든
       * 사람은 앱을 안 열고, 그러면 그 사람의 문서를 아무도 안 고친다.
       * 부등호를 걸면(`where(lastMultiAt >= …)`) Firestore 가 **그 필드로 먼저
       * 정렬하라**고 요구해서 "승률 순"을 못 뽑는다(§9-0-4 의 그 제약).
       *
       * 그래서 승률 상위 `FETCH` 장을 받아 **읽는 쪽에서 거르고** 100명을 남긴다.
       * 잠든 사람이 300명 넘게 위에 쌓이지 않는 한 순위는 정확하다.
       */
      const want = tab === 'rate' ? RATE_FETCH : top;
      const snap = await withTimeout(getDocs(
        query(collection(fb.db, 'users'), orderBy(field, 'desc'), limit(want))
      ), undefined, '멀티 순위 조회');
      if (offline(snap)) return fail('offline');
      rows = snap.docs.map((d) => {
        const v = d.data();
        const wins = v.multiWins ?? 0;
        const games = wins + (v.multiLosses ?? 0);
        return {
          ...base(v, d.id),
          value: tab === 'wins' ? wins : (v.winRate ?? 0),
          games,
          lastMultiAt: v.lastMultiAt ?? 0,
        };
      });
      if (tab === 'rate') rows = rows.filter(rateEligible).slice(0, top);
    } else {
      const field = { daily: 'mwDy', weekly: 'mwWk', monthly: 'mwMo' }[tab];
      const key = currentKeyMap()[{ daily: 'dy', weekly: 'wk', monthly: 'mo' }[tab]];
      const snap = await withTimeout(getDocs(
        query(
          collection(fb.db, 'users'),
          // `키#` 로 시작하는 것만 — `#`(0x23) 다음 글자가 `$`(0x24) 라 딱 그 구간이다
          where(field, '>=', `${key}#`),
          where(field, '<', `${key}$`),
          orderBy(field, 'asc'),
          limit(top)
        )
      ), undefined, '멀티 순위 조회');
      if (offline(snap)) return fail('offline');
      rows = snap.docs
        .map((d) => {
          const v = d.data();
          return { ...base(v, d.id), value: v[`${field}N`] ?? winsFromSortKey(v[field]) };
        })
        // 0승은 순위표에 올릴 게 없다 (진 판만 있으면 칸이 0으로 남는다)
        .filter((r) => r.value > 0);
    }

    rows.forEach((r, i) => { r.rank = i + 1; });

    const u = currentUser();
    const mine = rows.find((r) => r.uid === u?.uid);
    return {
      rows,
      me: mine ?? null,
      error: null,
      // 내 줄은 로컬 프로필에 다 있다 — 조회를 한 번 더 할 이유가 없다
      mePromise: mine || !u ? null : Promise.resolve(myMultiRow(tab, u)),
    };
  } catch (e) {
    console.warn('[멀티순위] 조회 실패', e?.code, e);
    return fail(e?.code === 'permission-denied' ? 'auth' : 'failed');
  }
}

/** 순위표에 못 든 나 — 값은 전부 로컬 프로필에 있다 */
function myMultiRow(tab, u) {
  const p = L.loadProfile();
  const wins = p.multiWins ?? 0;
  const games = wins + (p.multiLosses ?? 0);
  const base = {
    uid: u.uid, nickname: p.nickname ?? '', characterId: p.selectedCharacter ?? '', rank: null,
    items: wornOf(p),
    multiWins: wins, multiLosses: p.multiLosses ?? 0, shoesOwned: p.shoesOwned ?? 0, games,
  };
  if (tab === 'wins') return { ...base, value: wins };
  if (tab === 'rate') {
    /**
     * 자격이 없으면 **순위 자체가 없다** — 0% 라고 쓰면 "내 승률이 0" 이라는 거짓말이 된다.
     * 잠들어서 빠진 경우도 같다: 숫자를 보여 주면 목록에 있는 줄 안다.
     */
    const me = { ...base, lastMultiAt: p.lastMultiAt ?? 0 };
    return { ...me, value: rateEligible(me) ? Math.round((wins / games) * 10000) : null };
  }
  const field = { daily: 'dy', weekly: 'wk', monthly: 'mo' }[tab];
  return { ...base, value: L.periodWins(field, currentKeyMap()[field]) };
}

/**
 * ★ **내가 1·2·3위인가.** (2026-08-19 23차, 사용자 지정 — 로비 딱지)
 *
 * *"만약 신발왕이면 보유신발에 [신발왕] 딱지가 (…) 딱지 붙이고 싶은 사람은 경쟁하게끔"*
 *
 * 상위 3장만 읽는다. 내 순위를 정확히 알 필요가 없다 — 4위부터는 딱지가 없으므로
 * **거기 있느냐 없느냐**만 보면 된다. 두 탭(신발왕·승리왕)을 합쳐 문서 6장이다.
 *
 * @returns {Promise<{shoes:number, wins:number}|null>} 1·2·3 또는 0(딱지 없음)
 */
export async function fetchMyCrowns() {
  const u = currentUser();
  if (!configured() || !u || u.guest) return null;
  const fb = await getStore();
  if (!fb) return null;
  const { collection, query, orderBy, limit, getDocs } = fb.storeMod;

  const rankIn = async (field) => {
    const snap = await withTimeout(getDocs(
      query(collection(fb.db, 'users'), orderBy(field, 'desc'), limit(3))
    ), undefined, '왕관 확인');
    const i = snap.docs.findIndex((d) => d.id === u.uid);
    // 값이 0이면 딱지를 주지 않는다 — 아무도 안 한 항목의 1위는 1위가 아니다
    return i < 0 || !(snap.docs[i].data()?.[field] > 0) ? 0 : i + 1;
  };

  try {
    const [shoes, wins] = await Promise.all([rankIn('shoesOwned'), rankIn('multiWins')]);
    return { shoes, wins };
  } catch { return null; }
}

/**
 * 드래곤 스트라이커의 딱지 — 점수왕 · 금화왕 · 승리왕.
 *
 * 신발게임의 `fetchMyCrowns` 와 **같은 방식**이다: `users` 를 단일 필드로 정렬하므로
 * Firestore 가 색인을 자동으로 만들어 준다 — **콘솔에서 할 일이 없다.**
 * (기간별 순위는 복합 색인이 필요해서 별도 단계로 미뤄 뒀다)
 */
// ─────────────────────────────────────────────
// 드래곤 스트라이커 순위 (E단계)
// ─────────────────────────────────────────────

/**
 * ★ **복합 색인을 하나도 안 쓴다.**
 *
 * `where(난이도) + where(기간) + orderBy(점수)` 는 Firestore 가 복합 색인을 요구한다.
 * 그건 콘솔에서 손으로 만들어야 하고, 없으면 그 탭이 통째로 빈 채로 뜬다 —
 * 게다가 탭 x 난이도 조합마다 하나씩이라 열 개 넘게 만들어야 한다.
 *
 * 그래서 신발게임의 멀티 순위가 쓰는 수법을 그대로 가져왔다:
 * **난이도 · 기간키 · 점수를 한 필드에 담는다.**
 *
 *     hard|2026-08-26#9871600      (점수 128,400)
 *
 * 앞부분이 같은 것만 범위로 집어내고 같은 필드로 정렬하니
 * **자동으로 생기는 단일 필드 색인만으로** 돌아간다. 콘솔에서 할 일이 규칙뿐이다.
 *
 * 점수는 `최대값 - 점수` 로 뒤집어 넣는다 — 오름차순이 곧 '높은 점수 순'이다.
 * 자릿수를 채워야 문자열 비교가 숫자 비교와 같아진다(`999` < `99` 같은 사고 방지).
 */
const DG_SCORE_MAX = 9999999;      // 7자리 (한 판 상한 100만)
const DG_COIN_MAX = 999999;        // 6자리 (한 판 상한 2만)

const dgKey = (difficulty, key, value, max) => {
  const digits = String(max).length;
  const inv = max - Math.min(max, Math.max(0, value | 0));
  return `${difficulty}|${key}#${String(inv).padStart(digits, '0')}`;
};
const dgValue = (sk, max) => {
  const n = Number(String(sk ?? '').split('#')[1]);
  return Number.isFinite(n) ? max - n : 0;
};

/** 두 순위표의 차이를 한 곳에 모아 둔다 — 늘릴 때 여기만 본다 */
const DG_BOARDS = {
  score: { col: 'dragonScores', max: DG_SCORE_MAX, cache: 'dgs', field: 'score',
           allField: 'dragonBest' },
  coin:  { col: 'dragonCoins',  max: DG_COIN_MAX,  cache: 'dgc', field: 'coins',
           allField: 'dragonCoinsTotal' },
};

/**
 * 드래곤 한 판의 기록을 올린다. 점수판과 금화판에 각각, 기간 3종에 각각.
 *
 * ★ **점수와 금화를 다른 문서에 넣는 이유**
 * 점수가 잘 나온 판과 금화를 많이 먹은 판은 보통 다른 판이다. 한 문서에 같이 넣으면
 * "점수는 올랐는데 금화는 줄었다" 는 갱신을 규칙이 통째로 막아 버린다.
 * 따로 두면 각자 "내려가지 않는다" 만 지키면 된다.
 *
 * 실패해도 게임은 멈추지 않는다 — 다음 판이 끝날 때 더 높은 기록으로 다시 올라간다.
 *
 * @param {{score:number, coins:number, stage:number, difficulty:string, dragon:number, at?:number}} run
 */
export async function submitDragonRun(run) {
  const u = currentUser();
  if (!configured() || !u || u.guest) return false;
  const fb = await getStore();
  if (!fb) return false;

  const prof = L.loadProfile();
  const when = run.at ? new Date(run.at) : new Date();
  const difficulty = DIFFICULTIES.includes(run.difficulty) ? run.difficulty : 'normal';
  const keep = currentKeys(when);

  let settled = true;
  for (const [kind, B] of Object.entries(DG_BOARDS)) {
    const value = Math.max(0, Math.min(B.max, (kind === 'score' ? run.score : run.coins) | 0));
    for (const period of PERIODS) {
      const key = period.keyOf(when);
      const id = scoreDocId(u.uid, difficulty, key);
      const cacheId = `${B.cache}_${id}`;
      /* 이 기간에 이미 더 높은 값을 올려 뒀으면 규칙이 어차피 막는다 — 헛품을 아낀다 */
      if (value <= L.periodBest(cacheId)) continue;

      try {
        await withTimeout(fb.storeMod.setDoc(fb.storeMod.doc(fb.db, B.col, id), {
          uid: u.uid,
          nickname: prof.nickname ?? '',
          dragon: prof.dragonCharacter | 0,
          difficulty,
          key,
          period: period.field,
          [period.field]: key,
          sk: dgKey(difficulty, key, value, B.max),
          [B.field]: value,
          stage: run.stage | 0,
          updatedAt: fb.storeMod.serverTimestamp(),
        }), undefined, '드래곤 기록 제출');
        L.notePeriodBest(cacheId, value, keep.map((k) => k));
      } catch (e) {
        /* 규칙이 막았다면 다른 기기에서 더 높은 기록을 올린 것이다 — 재시도할 일이 아니다 */
        if (e?.code === 'permission-denied') { L.notePeriodBest(cacheId, value); continue; }
        console.warn('[드래곤 순위] 제출 실패', e);
        settled = false;
      }
    }
  }
  return settled;
}

/**
 * 순위표 한 장.
 * @param {'score'|'coin'} kind
 * @param {'daily'|'weekly'|'monthly'|'alltime'} tab
 * @param {string} difficulty 역대 탭에서는 무시된다 (계정 최고는 난이도 구분이 없다)
 */
export async function fetchDragonBoard(kind, tab, difficulty) {
  const B = DG_BOARDS[kind];
  if (!B) return fail('offline');
  if (!configured()) return fail('offline');
  if (!currentUser()) return fail('auth');
  const fb = await getStore();
  if (!fb) return fail('offline');
  const { collection, query, orderBy, where, limit, getDocs } = fb.storeMod;
  const top = LEADERBOARD.topN;

  try {
    let rows;
    if (tab === 'alltime') {
      /* 계정 문서를 그대로 정렬한다 — 한 사람에 한 줄이라 접을 필요가 없다 */
      const snap = await withTimeout(getDocs(
        query(collection(fb.db, 'users'), orderBy(B.allField, 'desc'), limit(top))
      ), undefined, '드래곤 순위 조회');
      if (offline(snap)) return fail('offline');
      rows = snap.docs.map((d) => {
        const v = d.data();
        return {
          uid: d.id,
          nickname: v.nickname ?? '',
          dragon: v.dragonCharacter | 0,
          value: v[B.allField] ?? 0,
          stage: v.dragonBestStage ?? 0,
        };
      });
    } else {
      const period = PERIOD_BY_TAB[tab];
      if (!period) return fail('offline');
      /* 앞부분이 `난이도|기간키#` 인 것만 — 범위 조회 + 같은 필드 정렬이라 색인이 저절로 생긴다 */
      const pre = `${difficulty}|${period.keyOf()}#`;
      const snap = await withTimeout(getDocs(
        query(
          collection(fb.db, B.col),
          where('sk', '>=', pre),
          where('sk', '<', `${pre}\uffff`),
          orderBy('sk'),
          limit(top)
        )
      ), undefined, '드래곤 순위 조회');
      if (offline(snap)) return fail('offline');
      rows = snap.docs.map((d) => {
        const v = d.data();
        return {
          uid: v.uid,
          nickname: v.nickname ?? '',
          dragon: v.dragon | 0,
          value: v[B.field] ?? dgValue(v.sk, B.max),
          stage: v.stage ?? 0,
        };
      });
    }
    rows.sort((a, b) => b.value - a.value);
    return { ok: true, rows: rows.slice(0, top) };
  } catch (e) {
    console.warn('[드래곤 순위] 조회 실패', e);
    return fail('error');
  }
}

/**
 * 드래곤 왕 순위 넷. (2026-08-26, 사용자 지정)
 *
 *   금화왕  `dragonCoinsTotal`  지금까지 주운 금화를 모두 더한 값
 *   싱글왕  `dragonPlays`       싱글게임을 많이 한 사람
 *   멀티왕  `dragonMultiWins`   멀티게임을 많이 이긴 사람
 *   승률왕  승률                 이긴 비율
 *
 * ★ **넷 다 난이도도 기간도 없다.** 계정에 쌓인 값이라 나눌 것이 없다 —
 * "역대" 라는 탭조차 필요 없어서 아예 안 만든다.
 *
 * 넷 모두 `users` 문서를 **한 필드로만** 정렬한다. 단일 필드 색인은 Firestore 가
 * 저절로 만들어 주므로 콘솔에서 할 일이 없다.
 *
 * 승률왕만 예외적으로 넉넉히 받아 **읽는 쪽에서 계산하고 거른다** —
 * 승률은 저장된 필드가 아니라 승/패로 그때 계산하는 값이라 서버가 정렬해 줄 수 없다.
 * (신발게임 승률왕과 같은 방식이다.)
 *
 * @param {'coin'|'single'|'multi'|'rate'} tab
 */
const DG_CROWN = {
  coin:   { field: 'dragonCoinsTotal', unit: '금화' },
  single: { field: 'dragonPlays',      unit: '게임' },
  multi:  { field: 'dragonMultiWins',  unit: '승' },
  rate:   { field: 'dragonMultiWins',  unit: '%' },   // 넉넉히 받아 승률로 다시 세운다
};

/** 승률왕 자격 — 최소 판수를 넘겨야 한 판 이겨서 100% 가 되는 일이 없다 */
const DG_RATE_MIN_GAMES = 10;
const DG_RATE_FETCH = 300;

export async function fetchDragonCrownBoard(tab) {
  const C = DG_CROWN[tab];
  if (!C) return fail('offline');
  if (!configured()) return fail('offline');
  if (!currentUser()) return fail('auth');
  const fb = await getStore();
  if (!fb) return fail('offline');
  const { collection, query, orderBy, limit, getDocs } = fb.storeMod;
  const top = LEADERBOARD.topN;
  const want = tab === 'rate' ? DG_RATE_FETCH : top;

  try {
    const snap = await withTimeout(getDocs(
      query(collection(fb.db, 'users'), orderBy(C.field, 'desc'), limit(want))
    ), undefined, '드래곤 왕 순위 조회');
    if (offline(snap)) return fail('offline');

    let rows = snap.docs.map((d) => {
      const v = d.data();
      const wins = v.dragonMultiWins ?? 0;
      const games = wins + (v.dragonMultiLosses ?? 0);
      return {
        uid: d.id,
        nickname: v.nickname ?? '',
        dragon: v.dragonCharacter | 0,
        wins,
        games,
        value: tab === 'rate'
          ? (games >= DG_RATE_MIN_GAMES ? Math.round((wins / games) * 1000) / 10 : null)
          : (v[C.field] ?? 0),
      };
    });

    if (tab === 'rate') rows = rows.filter((r) => r.value !== null);
    rows.sort((a, b) => b.value - a.value);
    return { ok: true, rows: rows.slice(0, top), unit: C.unit };
  } catch (e) {
    console.warn('[드래곤 왕 순위] 조회 실패', e);
    return fail('error');
  }
}

export async function fetchDragonCrowns() {
  const u = currentUser();
  if (!configured() || !u || u.guest) return null;
  const fb = await getStore();
  if (!fb) return null;
  const { collection, query, orderBy, limit, getDocs } = fb.storeMod;

  const rankIn = async (field) => {
    const snap = await withTimeout(getDocs(
      query(collection(fb.db, 'users'), orderBy(field, 'desc'), limit(3))
    ), undefined, '드래곤 딱지 확인');
    const i = snap.docs.findIndex((d) => d.id === u.uid);
    // 값이 0이면 딱지를 주지 않는다 — 아무도 안 한 항목의 1위는 1위가 아니다
    return i < 0 || !(snap.docs[i].data()?.[field] > 0) ? 0 : i + 1;
  };

  try {
    const [score, coins, wins] = await Promise.all([
      rankIn('dragonBest'), rankIn('dragonCoinsTotal'), rankIn('dragonMultiWins'),
    ]);
    return { score, coins, wins };
  } catch { return null; }
}
