/**
 * 좀비와 드래곤 — 명예의 전당 (2026-11-11, 코드 id `iandragon`)
 *
 * 점프 피아노(`pianoRank.js` · `pianoPlayers`)와 같은 방식 — **다른 게임 기록과 섞지 않는다.**
 *
 * ## 계정당 한 장 — `idgPlayers/{uid}`
 * 순위에 보일 값만 담은 공개 문서다. 보안 규칙이 «기록이 내려가지 않는다» · 값 상한을 강제한다
 * (규칙 초안은 `docs/FIREBASE_RULES.md` 에 얹을 `idgInt` ~ `match /idgPlayers` 블록).
 * 문서 = { nickname, look, title, cleared, stars, hard, kills, coop, pvpW, pvpL, raid, lv, at }
 *   cleared 깬 스테이지 순번(≤100) · stars 별 합계(≤300) · hard 어려움 붉은 별 합계(≤300)
 *   kills 쓰러뜨린 좀비 · coop 같이 깨기 이긴 판 · pvpW / pvpL 용 대결 승 / 패
 *   look 꾸미기 글자(≤64) · title 칭호 id(≤24) — 둘 다 아직 안 생겼으면 ''
 *   lv 계정 레벨(1 ~ 999 · 보통 + 붉은 + 보라 별 합 ÷ 5 — 11/13 IDG_DIFFICULTY_PLAN §D-4)
 *     규칙(`hasOnly`)에 lv 가 아직 없으면 쓰기가 permission-denied → lv 를 빼고 한 번 다시 쓰고, 그 세션 동안은 lv 없이 쓴다.
 *     읽을 때 lv 가 없으면 `1 + floor((stars + hard) / 5)` 로 계산한다(`lvOf`).
 * ★ 초고수 기록(보라 별 · 초고수 깬 판)은 이 문서에 절대 넣지 않는다(§D-3) — 보라 별은 lv 숫자 안에만 섞인다.
 * ★ 색인이 필요 없다 — 모든 조회가 필드 하나로만 정렬한다(정복왕의 «별» 순서는 받은 뒤 이 화면에서 정한다).
 *
 * 순위표 넷: 'conquer'(깬 스테이지 → 별) · 'hard'(붉은 별) · 'coop'(같이 깬 판) · 'pvp'(대결 승, 승률은 10판부터)
 *
 * ⏳ 규칙이 콘솔에 게시되기 전에는 쓰기·읽기가 거부된다 — 그때는 화면이 «준비 중»을 띄우고
 *    내 기록은 이 기기·계정(`users/{uid}.idg`)에 그대로 쌓인다(게시되면 다음 판에 저절로 올라간다).
 *    실패해도 게임은 멈추지 않는다(모든 호출이 조용히 false / {ok:false}).
 */

import { getStore, configured, withTimeout } from './firebase.js';
import { currentUser } from './auth.js';
import * as L from './storageLocal.js';
import { normIdg } from './iandragonGameState.js';
import * as G from './iandragonGame.js';   // levelOf(g) — 보조 D 가 만든다(없으면 아래 levelFallback)

const COL = 'idgPlayers';
const TOP = 50;
const ci = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(Number(v) || 0)));
const sumStars = (s) => [...(typeof s === 'string' ? s : '')].reduce((a, c) => a + (Number(c) || 0), 0);

/** 순위표 → 정렬 필드 */
export const BOARD_FIELD = { conquer: 'cleared', hard: 'hard', coop: 'coop', pvp: 'pvpW', raid: 'raid' };
/** 승률을 보여 주는 최소 판 수 */
export const PVP_RATE_MIN = 10;
/** 계정 레벨 상한 (§C-2) */
export const LV_MAX = 999;

/** D 의 levelOf 가 아직 없을 때만 쓰는 같은 공식 (보통 + 붉은 + 보라 별 ÷ 5) */
const levelFallback = (g, raw) => Math.min(LV_MAX, 1 + Math.floor((sumStars(g.stars) + sumStars(g.hardStars) + sumStars(g.masterStars ?? raw?.masterStars)) / 5));
/** 순위 줄의 레벨 — 문서에 lv 가 있으면 그것, 없으면(규칙 게시 전 · 옛 문서) 보통 + 붉은 별로 계산 */
export const lvOf = (r) => (Number.isInteger(r?.lv) && r.lv >= 1 ? Math.min(LV_MAX, r.lv) : Math.min(LV_MAX, 1 + Math.floor(((r?.stars | 0) + (r?.hard | 0)) / 5)));

/**
 * 프로필 → 순위 문서 (순수 계산). look · title · coop 은 아직 저장 모양(normIdg)에 없어도 원본에서 읽는다.
 * @param {object} p 프로필 (`profile.idg` 안에 값이 있다)
 */
export function idgDoc(p, at = Date.now()) {
  const raw = p?.idg && typeof p.idg === 'object' ? p.idg : {};
  const g = normIdg(raw);
  const look = g.look ?? raw.look, title = g.title ?? raw.title;
  /* 같이 깬 판은 stat.coop 에 쌓인다(옛 코드는 g.coop 를 읽어 늘 0 — 11/13 버그 1). 혹시 옛 저장에 맨 위 coop 가 있으면 큰 쪽 */
  const coop = Math.max(Number(g.stat?.coop) || 0, Number(raw.stat?.coop) || 0, Number(raw.coop) || 0);
  const lv = typeof G.levelOf === 'function' ? G.levelOf(g) : levelFallback(g, raw);
  return {
    nickname: String(p?.nickname || '').slice(0, 16),
    look: typeof look === 'string' ? look.slice(0, 64) : '',
    title: typeof title === 'string' ? title.slice(0, 24) : '',
    cleared: ci(g.cleared, 0, 100),
    stars: ci(sumStars(g.stars), 0, 300),
    hard: ci(sumStars(g.hardStars), 0, 300),
    kills: ci(g.stat?.kills, 0, 1e8),
    coop: ci(coop, 0, 1e6),
    raid: ci((g.raid?.w || 0) * 100 + (g.raid?.best || 0), 0, 1e9),   // 주간 습격 (주 번호×100 + 웨이브)
    pvpW: ci(g.pvp?.w, 0, 1e6),
    pvpL: ci(g.pvp?.l, 0, 1e6),
    lv: ci(lv, 1, LV_MAX),
    at: Math.round(at),
  };
}

let timer = 0;
/** 이 세션에서 lv 를 보내도 되나 — 규칙이 lv 를 거부하면 false (다음 세션에 다시 해 본다) */
let lvOk = true;
/** 몰아서 한 번 — 한 판 끝에 기록이 한꺼번에 오른다 (기본 3초) */
export function syncIdgPlayerSoon(ms = 3000) {
  clearTimeout(timer);
  timer = setTimeout(() => { syncIdgPlayer().catch(() => { /* 다음 판에 다시 (규칙 게시 전이면 거부된다) */ }); }, ms);
}

/** 내 순위 문서를 지금 프로필로 맞춘다. 한 번도 안 한 사람은 올리지 않는다 */
export async function syncIdgPlayer() {
  try {
    const u = currentUser();
    if (!configured() || !u || u.guest) return false;
    const p = L.loadProfile();
    if (!p.nickname || !p.idg) return false;
    const d = idgDoc(p);
    if (!(d.cleared > 0 || d.kills > 0 || d.coop > 0 || d.pvpW + d.pvpL > 0)) return false;
    const fb = await getStore();
    if (!fb) return false;
    const { doc, setDoc } = fb.storeMod;
    const put = (x) => withTimeout(setDoc(doc(fb.db, COL, u.uid), x), undefined, '드래곤 순위 올리기');
    if (!lvOk) delete d.lv;
    try {
      await put(d);
    } catch (e) {
      if (e?.code !== 'permission-denied' || !('lv' in d)) throw e;
      /* 규칙에 lv 가 아직 없다(콘솔 게시 전) → lv 를 빼고 한 번 더. 그래도 거부면 lv 탓이 아니었으니 되돌린다 */
      lvOk = false;
      const { lv, ...rest } = d;
      try { await put(rest); } catch (e2) { lvOk = true; throw e2; }
      console.warn('[드래곤 순위] 규칙에 lv 가 아직 없어 이번 세션은 lv 없이 올립니다');
    }
    return true;
  } catch (e) {
    console.warn('[드래곤 순위] 올리기 실패', e?.code || e);
    return false;
  }
}

/**
 * 순위표 한 장 — @param {'conquer'|'hard'|'coop'|'pvp'} kind
 * @returns {Promise<{ok:true, rows:object[], field:string}|{ok:false, reason:'offline'|'auth'|'rules'|'error'}>}
 *   줄 = { uid, nickname, look, title, cleared, stars, hard, kills, coop, pvpW, pvpL, value, rate }
 *   value = 그 순위표의 기록(정복왕은 깬 스테이지), rate = 용 대결 승률 % (10판 미만이면 null)
 */
export async function fetchIdgBoard(kind, n = TOP) {
  if (!configured()) return { ok: false, reason: 'offline' };
  if (!currentUser()) return { ok: false, reason: 'auth' };
  const fb = await getStore();
  if (!fb) return { ok: false, reason: 'offline' };
  const field = BOARD_FIELD[kind] || 'cleared';
  const { collection, query, orderBy, limit, getDocs } = fb.storeMod;
  try {
    const snap = await withTimeout(getDocs(query(collection(fb.db, COL), orderBy(field, 'desc'), limit(ci(n, 1, 100)))), undefined, '드래곤 순위 조회');
    if (snap.metadata?.fromCache && snap.empty) return { ok: false, reason: 'offline' };
    const rows = snap.docs.map((d) => {
      const v = d.data();
      const w = v.pvpW | 0, l = v.pvpL | 0;
      return {
        uid: d.id, nickname: v.nickname || '', look: v.look || '', title: v.title || '',
        raid: v.raid | 0, cleared: v.cleared | 0, stars: v.stars | 0, hard: v.hard | 0, kills: v.kills | 0, coop: v.coop | 0, pvpW: w, pvpL: l,
        lv: Number.isInteger(v.lv) ? v.lv : null,
        value: v[field] | 0,
        rate: w + l >= PVP_RATE_MIN ? Math.round((w / (w + l)) * 100) : null,
      };
    }).filter((r) => r.value > 0);
    /* 정복왕은 깬 스테이지가 같으면 별이 많은 쪽이 위 (같은 값이 한도 끝에서 잘릴 수는 있다) */
    if (kind === 'conquer') rows.sort((a, b) => b.cleared - a.cleared || b.stars - a.stars);
    return { ok: true, rows, field };
  } catch (e) {
    console.warn('[드래곤 순위] 조회 실패', e);
    return { ok: false, reason: e?.code === 'permission-denied' ? 'rules' : 'error' };
  }
}

/**
 * 주간 습격 «내 자리» — 상위 50명 목록이 아니라 서버에서 «나보다 높은 사람 수»를 센다 (11/13 버그 2 · 51위 아래도 자기 자리를 안다).
 * 내 문서(`idgPlayers/{uid}`)의 raid 를 읽고, 같은 주 안에서 그보다 큰 문서 수를 count() 집계 질의 1번으로 센다.
 * 같은 웨이브는 같은 자리(공동 순위). 색인 추가 없음(필드 하나 · 같은 필드의 범위 둘).
 * @param {number} weekIdx 주 번호(`weekKey().idx`)
 * @returns {Promise<{ok:true, place:number}|{ok:false, reason:string}>} place = 0부터(0 = 1위) · 그 주 기록이 없으면 -1
 */
export async function fetchIdgRaidPlace(weekIdx) {
  if (!configured()) return { ok: false, reason: 'offline' };
  const u = currentUser();
  if (!u || u.guest) return { ok: false, reason: 'auth' };
  const fb = await getStore();
  if (!fb) return { ok: false, reason: 'offline' };
  const { doc, getDoc, collection, query, where, getCountFromServer } = fb.storeMod;
  try {
    const me = await withTimeout(getDoc(doc(fb.db, COL, u.uid)), undefined, '드래곤 습격 내 기록');
    const raid = me.exists() ? me.data().raid | 0 : 0;
    if (Math.floor(raid / 100) !== weekIdx || raid % 100 <= 0) return { ok: true, place: -1 };
    const snap = await withTimeout(getCountFromServer(query(collection(fb.db, COL), where('raid', '>', raid), where('raid', '<', (weekIdx + 1) * 100))), undefined, '드래곤 습격 자리');
    return { ok: true, place: snap.data().count | 0 };
  } catch (e) {
    console.warn('[드래곤 순위] 습격 자리 실패', e?.code || e);
    return { ok: false, reason: e?.code === 'permission-denied' ? 'rules' : 'error' };
  }
}
