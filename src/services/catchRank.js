/**
 * 캐치볼 명예의 전당 (2026-10-29, 사용자 지정)
 *
 * > *"명예의 전당 누르면 쉬움 보통 어려움 순위 나오게 만들어. 순위는 콤보기록(연속갯수)
 * >  최고기록(종합갯수)으로 나눠서 만들어. 1대1순위도 만들어. 종합순위도 만들어.
 * >  순위에 캐릭터 이름. 이모티콘과 글러브 모양 같이 꼭 뜨게 만들어"*
 *
 * ## 계정당 한 장 — `catchPlayers/{uid}`
 * 기간이 없는 순위라 판마다 쌓을 까닭이 없다. 한 사람에 한 장이라 줄이 겹치지 않고,
 * 닉네임·꾸미기를 바꾸면 그 한 장만 고치면 된다.
 *
 * `users` 를 바로 정렬하지 않는 이유: `users` 는 `list` 가 한 건으로 묶여 있다
 * (2026-08-29 보안 점검 — 남의 계정 문서를 통째로 훑지 못하게). 순위에 보일 값만
 * 골라 담은 공개 문서를 따로 두는 쪽이 안전하다.
 *
 * ★ 색인이 필요 없다 — 모든 조회가 **필드 하나**로만 정렬한다(단일 필드 색인은 저절로 있다).
 * ★ 보안 규칙이 '기록이 내려가지 않는다' · 상한 · 종합점수 계산식을 강제한다 (`docs/FIREBASE_RULES.md`).
 *
 * 이 파일은 그림 모듈(`games/catch/art.js`)을 물지 않는다 — 꾸미기는 문자열 그대로 싣는다.
 */

import { getStore, configured, withTimeout } from './firebase.js';
import { currentUser } from './auth.js';
import * as L from './storageLocal.js';

const COL = 'catchPlayers';
const CAP = 9999;
const TOP = 50;
const ci = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(Number(v) || 0)));

/**
 * ★ 종합 점수 — 어려운 판일수록, 대결에서 이길수록 무겁다.
 * 보안 규칙이 같은 식으로 검사하니 **바꾸면 규칙도 같이** 바꿔야 한다.
 */
export const totalOf = (d) => d.bestEasy + d.bestNormal * 2 + d.bestHard * 3 + d.wins * 5;
export const TOTAL_RULE = '쉬움 최고 ×1 + 보통 최고 ×2 + 어려움 최고 ×3 + 1:1 승리 ×5';

/** 프로필 → 순위 문서 (순수 계산 — 검사 도구가 노드에서 부른다) */
export function catchDoc(uid, p, at = Date.now()) {
  const d = {
    uid,
    nickname: String(p?.nickname || '').slice(0, 24),
    look: typeof p?.catchLook === 'string' && p.catchLook.length <= 64 ? p.catchLook : '',
    bestEasy: ci(p?.catchBestEasy, 0, CAP),
    bestNormal: ci(Math.max(p?.catchBestNormal | 0, p?.catchBest | 0), 0, CAP),
    bestHard: ci(p?.catchBestHard, 0, CAP),
    comboEasy: ci(p?.catchComboEasy, 0, CAP),
    comboNormal: ci(p?.catchComboNormal, 0, CAP),
    comboHard: ci(p?.catchComboHard, 0, CAP),
    strikes: ci(p?.catchBestStrikes, 0, CAP),
    level: ci(p?.catchBestLevel, 1, 10),
    wins: ci(p?.catchWins, 0, 100000),
    losses: ci(p?.catchLosses, 0, 100000),
    at: Math.round(at),
  };
  d.total = totalOf(d);
  return d;
}

let timer = 0;
/** 몰아서 한 번 — 한 판 끝에 기록·레벨·스트라이크가 한꺼번에 오른다 */
export function syncCatchPlayerSoon(ms = 1500) {
  clearTimeout(timer);
  timer = setTimeout(() => { syncCatchPlayer().catch(() => { /* 다음 판에 다시 */ }); }, ms);
}

/** 내 순위 문서를 지금 프로필로 맞춘다. 캐치볼을 한 번도 안 한(꾸미지도 않은) 사람은 올리지 않는다 */
export async function syncCatchPlayer() {
  const u = currentUser();
  if (!configured() || !u || u.guest) return false;
  const p = L.loadProfile();
  if (!p.nickname) return false;
  /* 꾸미기만 해 둔 사람도 올린다 — 대결 상대 화면이 이 문서에서 내 모습을 읽는다 (순위표는 0점 줄을 거른다) */
  if (!((p.catchPlays | 0) > 0 || (p.catchWins | 0) + (p.catchLosses | 0) > 0 || p.catchLook)) return false;
  const fb = await getStore();
  if (!fb) return false;
  const { doc, setDoc } = fb.storeMod;
  await withTimeout(setDoc(doc(fb.db, COL, u.uid), catchDoc(u.uid, p)), undefined, '캐치볼 순위 올리기');
  return true;
}

/**
 * 순위표 한 장
 * @param {'best'|'combo'|'duel'|'total'} kind
 * @param {'easy'|'normal'|'hard'} [diff]  best · combo 에서만
 */
export const FIELD = {
  best: { easy: 'bestEasy', normal: 'bestNormal', hard: 'bestHard' },
  combo: { easy: 'comboEasy', normal: 'comboNormal', hard: 'comboHard' },
};
export async function fetchCatchBoard(kind, diff = 'normal') {
  if (!configured()) return { ok: false, reason: 'offline' };
  if (!currentUser()) return { ok: false, reason: 'auth' };
  const fb = await getStore();
  if (!fb) return { ok: false, reason: 'offline' };
  const field = kind === 'duel' ? 'wins' : kind === 'total' ? 'total' : (FIELD[kind] || FIELD.best)[diff] || 'bestNormal';
  const { collection, query, orderBy, limit, getDocs } = fb.storeMod;
  try {
    const snap = await withTimeout(getDocs(query(collection(fb.db, COL), orderBy(field, 'desc'), limit(TOP))), undefined, '캐치볼 순위 조회');
    if (snap.metadata?.fromCache && snap.empty) return { ok: false, reason: 'offline' };
    const rows = snap.docs.map((d) => {
      const v = d.data();
      return {
        uid: v.uid || d.id,
        nickname: v.nickname || '',
        look: v.look || '',
        value: v[field] | 0,
        wins: v.wins | 0,
        losses: v.losses | 0,
        level: v.level | 0,
        strikes: v.strikes | 0,
      };
    }).filter((r) => r.value > 0);
    return { ok: true, rows, field };
  } catch (e) {
    console.warn('[캐치볼 순위] 조회 실패', e);
    return { ok: false, reason: 'error' };
  }
}

/** 대결 상대의 꾸미기 — 순위 문서에서 읽는다 (없으면 null) */
export async function fetchCatchLook(uid) {
  if (!uid || !configured()) return null;
  const fb = await getStore();
  if (!fb) return null;
  const { doc, getDoc } = fb.storeMod;
  try {
    const snap = await withTimeout(getDoc(doc(fb.db, COL, uid)), 6000, '캐치볼 상대 꾸미기');
    return snap.exists() ? (snap.data().look || null) : null;
  } catch (e) {
    return null;
  }
}
