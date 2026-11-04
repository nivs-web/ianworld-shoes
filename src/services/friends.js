/**
 * 친구 — "한쪽 추가"(즐겨찾기형). (2026-11-04, 대표님 지시 · 권반장 전달)
 *
 * *"게임 뒤 채팅방에서 «친구 추가» · «접속한 친구만 보기»(친구 목록만 구독 → 비용 작게) ·
 *   친구끼리 같이 게임하기"*
 *
 * ## 왜 한쪽 추가인가
 *
 * 상대 수락 절차가 없어 화면·규칙이 단순하다. 쪽지·대결 신청은 지금처럼 **상대의 수신 거부·
 * 차단(`prefs`)을 서버 규칙이 막으므로** 친구로 추가했다고 그 벽이 뚫리지 않는다.
 * 추가하면 상대에게 «OO님이 친구로 추가했어요» 쪽지가 한 통 간다(받는 쪽이 막아 두었으면 안 간다).
 *
 * ## 서버에 남는 것
 *
 *   friends/{내uid}/{친구uid} = { n: 이름, at: 추가한 시각 }   ← 나만 읽고 쓴다
 *
 * ## 비용
 *
 * 접속 여부는 **구독하지 않는다.** «친구» 화면을 열 때(그리고 떠 있는 동안 30초마다)
 * 친구 수만큼 `presence/{친구}` 를 한 번씩 읽는다 — 친구 20명이면 4KB 남짓.
 * 예전 현재접속자 화면은 접속자 **전원**의 15초 신호를 실시간으로 받았다.
 */

import { getRtdb, configured, withTimeout } from './firebase.js';
import { currentUser } from './auth.js';
import * as Presence from './presence.js';
import * as L from './storageLocal.js';
import S from '../config/strings.ko.js';

const FRIENDS = 'friends';
/** 친구 수 상한 — 화면 한 번 열 때 읽는 양의 상한이기도 하다 */
export const FRIENDS_MAX = 100;
const path = (...p) => p.join('/');

async function rt() {
  if (!configured()) return null;
  const u = currentUser();
  if (!u || u.guest) return null;
  const fb = await getRtdb();
  return fb ? { ...fb, uid: u.uid } : null;
}

/** 내 친구 목록 (로그인마다 한 번 읽고 들고 있는다) — uid → { n, at } */
let cache = null;
let cacheUid = null;

/** @returns {Promise<Array<{uid:string, nickname:string, at:number}>|null>} null = 못 읽음 */
export async function list(force = false) {
  const fb = await rt();
  if (!fb) return null;
  if (!force && cache && cacheUid === fb.uid) return toRows(cache);
  try {
    const snap = await withTimeout(fb.dbMod.get(fb.dbMod.ref(fb.rtdb, path(FRIENDS, fb.uid))), 8000, '친구 목록');
    cache = snap.val() ?? {};
    cacheUid = fb.uid;
    return toRows(cache);
  } catch { return null; }
}

const toRows = (m) => Object.entries(m ?? {})
  .map(([uid, v]) => ({ uid, nickname: v?.n ?? '', at: v?.at ?? 0 }))
  .sort((a, b) => String(a.nickname).localeCompare(String(b.nickname), 'ko'));

/** 이미 친구인가 (목록을 아직 안 읽었으면 읽는다) */
export async function isFriend(uid) {
  if (!uid) return false;
  await list();
  return !!cache?.[uid];
}

/**
 * 친구 추가. 상대에게 알림 쪽지를 한 통 보낸다(막혀 있으면 조용히 넘어간다).
 * @returns {Promise<'ok'|'full'|'self'|'error'>}
 */
export async function add(uid, nickname) {
  const fb = await rt();
  if (!fb || !uid) return 'error';
  if (uid === fb.uid) return 'self';
  await list();
  if (cache?.[uid]) return 'ok';
  if (Object.keys(cache ?? {}).length >= FRIENDS_MAX) return 'full';
  const rec = { n: String(nickname || '').slice(0, 16), at: Date.now() };
  try {
    await withTimeout(fb.dbMod.set(fb.dbMod.ref(fb.rtdb, path(FRIENDS, fb.uid, uid)), rec), undefined, '친구 추가');
  } catch { return 'error'; }
  cache = { ...(cache ?? {}), [uid]: rec };
  const me = L.loadProfile().nickname || '';
  Presence.sendSystem(uid, S.friendAddedNotice(me), rec.n).catch?.(() => {});
  return 'ok';
}

export async function remove(uid) {
  const fb = await rt();
  if (!fb || !uid) return false;
  try {
    await withTimeout(fb.dbMod.remove(fb.dbMod.ref(fb.rtdb, path(FRIENDS, fb.uid, uid))), undefined, '친구 삭제');
  } catch { return false; }
  if (cache) { const { [uid]: _, ...rest } = cache; cache = rest; }
  return true;
}

/**
 * 친구들의 지금 상태 — 한 사람씩 한 번 읽는다(구독 없음).
 * @returns {Promise<Array<{uid, nickname, status:'lobby'|'playing'|'offline', game:string, card:object|null}>>}
 */
export async function withStatus(rows) {
  const out = await Promise.all((rows ?? []).slice(0, FRIENDS_MAX).map(async (f) => {
    const card = await Presence.readOne(f.uid).catch(() => null);
    const status = !card ? 'offline' : card.state === 'playing' ? 'playing' : 'lobby';
    return { ...f, nickname: card?.nickname || f.nickname, status, game: card?.game ?? '', card };
  }));
  /* 접속 중인 친구가 위로 — 같이 할 수 있는 사람(로비)이 맨 위 */
  const rank = { lobby: 0, playing: 1, offline: 2 };
  return out.sort((a, b) => rank[a.status] - rank[b.status]
    || String(a.nickname).localeCompare(String(b.nickname), 'ko'));
}
