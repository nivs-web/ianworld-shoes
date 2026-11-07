/**
 * 줄넘기 챔피언 명예의 전당 (2026-11-07, 이안오락실 5번째 게임)
 *
 * ## 계정당 한 장 — `jumpPlayers/{uid}` (캐치볼 `catchPlayers` 와 같은 방식)
 * 순위에 보일 값만 담은 공개 문서다. `users` 를 바로 정렬하면 남의 계정 문서가 통째로 내려가므로
 * 따로 둔다. 보안 규칙이 «기록이 내려가지 않는다» · 상한을 강제한다(`docs/FIREBASE_RULES.md`).
 * ★ 색인이 필요 없다 — 모든 조회가 필드 하나로만 정렬한다.
 *
 * 순위표 다섯: 무한 줄넘기 쉬움 · 보통 · 어려움 최고 개수 / 레벨(경험치) / 모은 줄넘기 수
 * (+ 총 넘은 횟수는 줄마다 작게 보여 준다)
 *
 * ⏳ 규칙이 콘솔에 게시되기 전에는 쓰기·읽기가 거부된다 — 그때는 화면이 «준비 중»을 띄우고
 *    내 기록은 이 기기·계정에 그대로 쌓인다(게시되면 다음 판에 저절로 올라간다).
 */

import { getStore, configured, withTimeout } from './firebase.js';
import { currentUser } from './auth.js';
import * as L from './storageLocal.js';
import { normJr } from './jumpropeState.js';

const COL = 'jumpPlayers';
const TOP = 50;
const ci = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(Number(v) || 0)));

/**
 * 프로필 → 순위 문서 (순수 계산 — 검사 도구가 노드에서 부른다)
 * @param {string} uid @param {object} p 프로필 @param {{level:number, ropes:number, stars:number}} derived 계산값
 */
export function jumpDoc(uid, p, derived, at = Date.now()) {
  const jr = normJr(p?.jr);
  return {
    uid,
    nickname: String(p?.nickname || '').slice(0, 24),
    look: jr.look.slice(0, 32),
    rope: jr.rope.slice(0, 24),
    level: ci(derived?.level, 1, 20),
    xp: ci(jr.xp, 0, 1e7),
    bestEasy: ci(jr.endless.easy, 0, 99999),
    bestNormal: ci(jr.endless.normal, 0, 99999),
    bestHard: ci(jr.endless.hard, 0, 99999),
    ropes: ci(derived?.ropes, 0, 100),
    stars: ci(derived?.stars, 0, 90),
    jumps: ci(jr.jumps, 0, 1e8),
    at: Math.round(at),
  };
}

let timer = 0;
/** 몰아서 한 번 — 한 판 끝에 기록·경험치·줄넘기가 한꺼번에 오른다 */
export function syncJumpPlayerSoon(derive, ms = 1500) {
  clearTimeout(timer);
  timer = setTimeout(() => { syncJumpPlayer(derive).catch(() => { /* 다음 판에 다시 */ }); }, ms);
}

/** 내 순위 문서를 지금 프로필로 맞춘다. 한 번도 안 한 사람은 올리지 않는다 */
export async function syncJumpPlayer(derive) {
  const u = currentUser();
  if (!configured() || !u || u.guest) return false;
  const p = L.loadProfile();
  if (!p.nickname || !p.jr || !((p.jr.plays | 0) > 0)) return false;
  const fb = await getStore();
  if (!fb) return false;
  const { doc, setDoc } = fb.storeMod;
  await withTimeout(setDoc(doc(fb.db, COL, u.uid), jumpDoc(u.uid, p, derive(p))), undefined, '줄넘기 순위 올리기');
  return true;
}

export const BOARD_FIELD = { easy: 'bestEasy', normal: 'bestNormal', hard: 'bestHard', level: 'xp', ropes: 'ropes' };

/** 순위표 한 장 — @param {'easy'|'normal'|'hard'|'level'|'ropes'} board */
export async function fetchJumpBoard(board) {
  if (!configured()) return { ok: false, reason: 'offline' };
  if (!currentUser()) return { ok: false, reason: 'auth' };
  const fb = await getStore();
  if (!fb) return { ok: false, reason: 'offline' };
  const field = BOARD_FIELD[board] || 'bestNormal';
  const { collection, query, orderBy, limit, getDocs } = fb.storeMod;
  try {
    const snap = await withTimeout(getDocs(query(collection(fb.db, COL), orderBy(field, 'desc'), limit(TOP))), undefined, '줄넘기 순위 조회');
    if (snap.metadata?.fromCache && snap.empty) return { ok: false, reason: 'offline' };
    const rows = snap.docs.map((d) => {
      const v = d.data();
      return {
        uid: v.uid || d.id, nickname: v.nickname || '', look: v.look || '', rope: v.rope || 'red',
        level: v.level | 0, xp: v.xp | 0, ropes: v.ropes | 0, jumps: v.jumps | 0, stars: v.stars | 0,
        value: v[field] | 0,
      };
    }).filter((r) => r.value > 0);
    return { ok: true, rows, field };
  } catch (e) {
    console.warn('[줄넘기 순위] 조회 실패', e);
    return { ok: false, reason: e?.code === 'permission-denied' ? 'rules' : 'error' };
  }
}
