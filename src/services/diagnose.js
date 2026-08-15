/**
 * 자가 진단 — `await window.__dbg.selftest()` 로 브라우저 콘솔에서 부른다.
 *
 * 왜 필요한가: 이 앱은 **모든 원격 쓰기가 실패를 삼킨다**(CLAUDE.md §6-4).
 * 네트워크가 끊겨도 게임이 멈추지 않게 하려는 설계지만, 그 대가로 서버에 아무것도
 * 안 올라가는데 화면은 멀쩡해 보이는 상태가 생긴다. 실제로 명예의 전당이 계속 비어
 * 있는데 원인이 로그인인지·규칙인지·연결인지 알 방법이 없었다.
 *
 * 그래서 **같은 경로를 일부러 한 번 걸어 보고 어디서 멈추는지 되돌려 준다.**
 * 쓰레기 데이터를 남기지 않는다 — 계정 문서 갱신과 밀린 기록 올리기는
 * 어차피 평소에도 일어나야 하는 일이고, 점수를 새로 지어내지 않는다.
 */

import { getStore, configured, projectId } from './firebase.js';
import { currentUser } from './auth.js';
import * as L from './storageLocal.js';
import * as Rank from './leaderboard.js';

/** 실패 원인을 사람이 읽을 수 있는 한 줄로 */
const why = (e) => `${e?.code ?? e?.name ?? 'error'}: ${e?.message ?? e}`;

export async function selftest() {
  const steps = [];
  const step = (name, ok, detail) => {
    steps.push({ name, ok, detail });
    console.log(`${ok ? '✅' : '❌'} ${name}`, detail ?? '');
    return ok;
  };

  // 1. 빌드에 Firebase 설정이 박혀 있는가 (Vercel 환경변수)
  if (!step('설정값', configured(), projectId() ?? '없음 — VITE_FIREBASE_* 미설정')) return steps;

  // 2. 지금 로그인 상태인가
  const u = currentUser();
  if (!step('로그인', !!u && !u.guest, u ? `uid=${u.uid}` : '로그인 안 됨')) return steps;

  // 3. Firestore 청크가 실제로 붙었는가 (여기서 막히면 콘솔에 [firebase] 오류가 있다)
  const fb = await getStore();
  if (!step('Firestore 연결', !!fb, fb ? 'ok' : 'getStore() 가 null')) return steps;

  // 4. 계정 문서 쓰기 — 규칙(users)이 살아 있는지 본다
  try {
    const p = L.loadProfile();
    await fb.storeMod.setDoc(
      fb.storeMod.doc(fb.db, 'users', u.uid),
      { uid: u.uid, nickname: p.nickname ?? '', nicknameLower: (p.nickname ?? '').toLowerCase(),
        selectedCharacter: p.selectedCharacter ?? '', shoesOwned: p.shoesOwned ?? 0,
        bestStairs: p.bestStairs ?? 0, bestByDifficulty: p.bestByDifficulty ?? {} },
      { merge: true }
    );
    step('계정 문서 쓰기', true);
  } catch (e) {
    step('계정 문서 쓰기', false, why(e));
    return steps;
  }

  // 5. 밀린 기록 올리기 — 큐에 갇혀 있던 판이 여기서 풀린다
  const queuedBefore = L.loadPendingCount();
  try {
    const sent = await Rank.flushQueued();
    step('밀린 기록 제출', L.loadPendingCount() === 0,
      `큐 ${queuedBefore}건 중 ${sent}건 올림, 남은 ${L.loadPendingCount()}건`);
  } catch (e) {
    step('밀린 기록 제출', false, why(e));
  }

  // 6. 조회 — 여기서 null 이면 색인이나 오프라인 문제다
  try {
    const board = await Rank.fetchBoard('weekly', L.loadProfile().difficulty ?? 'easy');
    step('순위표 조회', !!board, board ? `${board.rows.length}줄, 내 기록 ${board.me?.value ?? '-'}` : 'null');
  } catch (e) {
    step('순위표 조회', false, why(e));
  }

  return steps;
}
