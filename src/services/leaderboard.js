/**
 * 명예의 전당 — 기록 제출과 랭킹 조회. (기획서 §5-9, S07)
 *
 * **집계 서버 없이 클라이언트 쿼리만으로 돌린다.**
 * 기획서는 Cloud Functions 가 `leaderboards/*` 를 굽는 그림이었지만, 그건 유료 요금제가
 * 필요하다. 대신 두 갈래로 나눠서 지금 구조 그대로 정확한 순위를 낸다:
 *
 *   신발왕 · 역대  → `users` 를 바로 정렬한다. 계정당 한 줄이라 중복이 없다.
 *   주간 · 월간 · 연간 → `scores` 원장을 기간으로 걸러 정렬한다.
 *
 * 기간 조회에 부등호(`createdAt >= 시작`)를 쓰면 Firestore 는 **부등호를 건 필드로 먼저
 * 정렬하라**고 요구한다. 그러면 "계단 수 상위"를 못 뽑는다. 그래서 제출할 때 기간 키를
 * 미리 문자열로 박아 둔다(`wk`·`mo`·`yr`) — 등호 비교라 계단 수로 바로 정렬할 수 있다.
 */

import { getStore, configured } from './firebase.js';
import { currentUser } from './auth.js';
import * as L from './storageLocal.js';
import { LEADERBOARD } from '../config/balance.js';

/** 한 계정이 순위표를 도배하지 않도록 넉넉히 받아 uid로 접은 뒤 상위 N만 남긴다 */
const FETCH_MULTIPLIER = 3;

/**
 * 네트워크가 없을 때 Firestore 는 **예외를 던지지 않고** 로컬 캐시로 답한다.
 * 캐시가 비어 있으면 빈 결과가 오는데, 그대로 그리면 연결이 끊긴 사람에게
 * "아직 기록이 없습니다"라고 거짓말을 하게 된다. 그래서 둘을 구분한다.
 */
const offline = (snap) => snap.metadata?.fromCache && snap.empty;

// ─────────────────────────────────────────────
// 기간 키 — 제출 시점에 박아 둔다
// ─────────────────────────────────────────────

/** ISO 주차. 목요일이 속한 해를 그 주의 해로 본다(연말연시가 갈리지 않게). */
export function weekKey(d = new Date()) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t - yearStart) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export const monthKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

export const yearKey = (d = new Date()) => String(d.getFullYear());

/** 탭 → scores 문서의 기간 필드 이름. 'alltime'·'shoeking' 은 users 를 쓴다. */
const PERIOD_FIELD = { weekly: 'wk', monthly: 'mo', yearly: 'yr' };

// ─────────────────────────────────────────────
// 제출
// ─────────────────────────────────────────────

/**
 * 한 판의 기록을 원장에 남긴다. 실패해도 게임은 멈추지 않는다 —
 * 로컬 큐(`sf_pendingScores`)에 남아 다음 접속에 다시 올라간다.
 * @param {{stairs:number, difficulty:string, shoesFound:number, mode?:string, at?:number}} entry
 * @returns {Promise<boolean>} 실제로 올라갔는지
 */
export async function submitScore(entry) {
  const u = currentUser();
  if (!configured() || !u || u.guest) return false;
  const fb = await getStore();
  if (!fb) return false;

  const p = L.loadProfile();
  const when = entry.at ? new Date(entry.at) : new Date();
  try {
    await fb.storeMod.addDoc(fb.storeMod.collection(fb.db, 'scores'), {
      uid: u.uid,
      nickname: p.nickname ?? '',
      characterId: p.selectedCharacter ?? '',
      stairs: entry.stairs | 0,
      shoesFound: entry.shoesFound | 0,
      difficulty: entry.difficulty,
      mode: entry.mode ?? 'single',
      wk: weekKey(when),
      mo: monthKey(when),
      yr: yearKey(when),
      createdAt: fb.storeMod.serverTimestamp(),
    });
    return true;
  } catch (e) {
    console.warn('[랭킹] 기록 제출 실패 — 큐에 남긴다', e);
    return false;
  }
}

/**
 * 오프라인 동안 쌓인 기록을 몰아서 올린다 (로그인 직후).
 * 하나라도 실패하면 **남은 것까지 통째로 되돌려** 다음 기회에 다시 시도한다 —
 * 절반만 올라간 상태를 만들면 어디까지 올렸는지 알 수 없다.
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

// ─────────────────────────────────────────────
// 조회
// ─────────────────────────────────────────────

/** @typedef {{uid:string, nickname:string, characterId:string, value:number, rank:number}} Row */

/**
 * 순위표 한 장.
 * @param {'shoeking'|'alltime'|'weekly'|'monthly'|'yearly'} tab
 * @param {'easy'|'normal'|'hard'} [difficulty] 신발왕에는 쓰이지 않는다
 * @returns {Promise<{rows:Row[], me:Row|null}|null>} null = 연결 불가(오프라인·미로그인)
 */
export async function fetchBoard(tab, difficulty) {
  if (!configured()) return null;
  const fb = await getStore();
  if (!fb) return null;
  const { collection, query, where, orderBy, limit, getDocs } = fb.storeMod;
  const top = LEADERBOARD.topN;

  try {
    let rows;
    if (tab === 'shoeking' || tab === 'alltime') {
      // 계정 문서를 바로 정렬한다 — 계정당 한 줄이라 접을 필요가 없다
      const field = tab === 'shoeking' ? 'shoesOwned' : `bestByDifficulty.${difficulty}`;
      const snap = await getDocs(
        query(collection(fb.db, 'users'), orderBy(field, 'desc'), limit(top))
      );
      if (offline(snap)) return null;
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
      const field = PERIOD_FIELD[tab];
      const key = { weekly: weekKey(), monthly: monthKey(), yearly: yearKey() }[tab];
      const snap = await getDocs(
        query(
          collection(fb.db, 'scores'),
          where('difficulty', '==', difficulty),
          where(field, '==', key),
          orderBy('stairs', 'desc'),
          limit(top * FETCH_MULTIPLIER)
        )
      );
      if (offline(snap)) return null;
      // 계단 수 내림차순이므로 uid를 처음 만났을 때가 그 사람의 최고 기록이다
      const seen = new Set();
      rows = [];
      for (const d of snap.docs) {
        const v = d.data();
        if (seen.has(v.uid)) continue;
        seen.add(v.uid);
        rows.push({
          uid: v.uid, nickname: v.nickname ?? '', characterId: v.characterId ?? '', value: v.stairs ?? 0,
        });
        if (rows.length >= top) break;
      }
    }

    rows.forEach((r, i) => { r.rank = i + 1; });

    // 100위 밖이면 하단 고정 행을 위해 내 값을 따로 구한다 (순위는 알 수 없어 null)
    const u = currentUser();
    const mine = rows.find((r) => r.uid === u?.uid);
    const me = mine ?? (u ? await myRow(fb, tab, difficulty, u) : null);
    return { rows, me };
  } catch (e) {
    // 색인이 없으면 Firestore 가 만들 링크를 콘솔에 찍어 준다
    console.warn('[랭킹] 조회 실패', e);
    return null;
  }
}

/**
 * 순위표에 못 든 나.
 *
 * 신발왕·역대는 로컬 프로필에 같은 값이 있으므로 그냥 읽는다.
 * **주간·월간·연간은 다르다** — 로컬에는 기간별 최고 기록이 없다.
 * `bestByDifficulty`(역대 최고)를 대신 쓰면 이번 주에 한 판도 안 한 사람에게
 * 작년 기록이 이번 주 순위처럼 보인다. 그래서 그 기간만 따로 한 번 더 조회한다.
 */
async function myRow(fb, tab, difficulty, u) {
  const p = L.loadProfile();
  const base = {
    uid: u.uid, nickname: p.nickname ?? '', characterId: p.selectedCharacter ?? '', rank: null,
  };

  if (tab === 'shoeking') return { ...base, value: p.shoesOwned ?? 0 };
  if (tab === 'alltime') return { ...base, value: p.bestByDifficulty?.[difficulty] ?? 0 };

  const { collection, query, where, orderBy, limit, getDocs } = fb.storeMod;
  const field = PERIOD_FIELD[tab];
  const key = { weekly: weekKey(), monthly: monthKey(), yearly: yearKey() }[tab];
  const snap = await getDocs(
    query(
      collection(fb.db, 'scores'),
      where('uid', '==', u.uid),
      where('difficulty', '==', difficulty),
      where(field, '==', key),
      orderBy('stairs', 'desc'),
      limit(1)
    )
  );
  return { ...base, value: snap.docs[0]?.data()?.stairs ?? 0 };
}
