/**
 * 이안 드래곤 게임 — 저장 묶음 `idg` 읽기 · 쓰기. (2026-11-10)
 *
 * 화면은 Firebase 를 직접 부르지 않고 여기를 거친다 (오락실 규칙).
 * 쓰기는 `profile.patch` — 기기에 먼저 쓰고 서버에는 뒤에서 병합(`setDoc merge`)으로 올린다.
 * 서버 값 이름은 묶음 하나(`idg`)뿐이다 (기획서 14장).
 */

import * as L from './storageLocal.js';
import { patch } from './profile.js';
import { normIdg } from './iandragonGameState.js';
import { pickGift, GIFT_EVERY, GIFT_LAST } from '../games/iandragon_game/data/looks.js';

/** 지금 값 (항상 안전한 모양) */
export const idg = () => normIdg(L.loadProfile().idg);

/** 일부만 바꿔 저장 — 바뀐 전체 묶음을 돌려준다 */
export function saveIdg(part) {
  const next = normIdg({ ...idg(), ...part });
  patch({ idg: next });
  return next;
}

/** 별 개수 합 (로비 · 카드 표시용) */
export const totalStars = (g = idg()) => [...g.stars].reduce((a, c) => a + (Number(c) || 0), 0);

const sumStr = (s) => [...(typeof s === 'string' ? s : '')].reduce((a, c) => a + (Number(c) || 0), 0);
/** 계정 레벨에 세는 별 = 보통 + 붉은 별 + 보라 별 (같은 값 · IDG_DIFFICULTY_PLAN §C-2) */
export const allStars = (g = idg()) => sumStr(g?.stars) + sumStr(g?.hardStars) + sumStr(g?.masterStars);
/** 계정 레벨 — 공식 그대로(별 5개 = 1레벨) · 상한 999 (명예의 전당 보조 H 가 가져다 쓴다 · 이름 바꾸지 말 것) */
export const levelOf = (g = idg()) => Math.min(999, 1 + Math.floor(allStars(g) / 5));

/**
 * 레벨 선물 (§C-5) — Lv10 · 20 … 180 마다 꾸미기 1개 + 젬. 아직 안 받은 레벨들 (작은 것부터).
 * 업데이트 전에 이미 지난 사람은 지나간 몫이 한꺼번에 나온다 (Lv45 → 10 · 20 · 30 · 40 = 4개).
 */
export const pendingGifts = (g = idg()) => {
  const top = Math.min(GIFT_LAST, Math.floor(levelOf(g) / GIFT_EVERY) * GIFT_EVERY), out = [];
  for (let lv = GIFT_EVERY; lv <= top; lv += GIFT_EVERY) if (!g.lvGifts?.[String(lv)]) out.push(lv);
  return out;
};
/** 밀린 선물을 모두 뽑아 저장 — 씨앗 = 계정 id + 레벨 (로그인 안 했으면 'guest') · 돌려줌 [{ lv, key, tier, gems }] */
export function claimGifts(uid) {
  let g = idg();
  const list = pendingGifts(g);
  if (!list.length) return [];
  const got = [], owned = [...g.owned], rec = { ...g.lvGifts };
  let gems = g.gems;
  for (const lv of list) {
    const r = pickGift({ ...g, owned, lvGifts: rec }, lv, uid || 'guest');
    got.push(r); gems += r.gems;
    rec[String(lv)] = r.key || 'gem';
    if (r.key && !r.key.startsWith('title:') && !owned.includes(r.key)) owned.push(r.key);   // 칭호는 lvGifts 기록이 곧 «가짐»
  }
  g = saveIdg({ owned, lvGifts: rec, gems });
  return got;
}

/** 지금 도전할 스테이지 순번 (1~) — 깬 마지막 다음 */
export const nextStage = (g = idg()) => g.cleared + 1;

/** 순번 → "월드-번호" (1 → "1-1", 15 → "2-5") */
export const stageLabel = (no) => `${Math.floor((no - 1) / 10) + 1}-${((no - 1) % 10) + 1}`;

/** 로비에서 고른 스테이지(순번) — 게임 화면이 한 번 읽고 지운다 (2026-11-11 야간 · B4 최소판) */
let picked = null;
export const pickStage = (no) => { picked = no; };
export const takePickedStage = () => { const n = picked; picked = null; return n; };
/** 멀티(친구랑 같이 깨기)로 들어갈 때 방 정보 { code, seed, uids, seat } — 게임 화면이 한 번 읽고 지운다 */
let pickedNet = null;
export const pickNet = (n) => { pickedNet = n; };
export const takePickedNet = () => { const n = pickedNet; pickedNet = null; return n; };
/** 멀티 «한 판 더» — 판이 끝나고 같은 방 대기실로 돌아갈 때 방 번호 */
let rejoin = null;
export const pickRejoin = (c) => { rejoin = c; };
export const takeRejoin = () => { const c = rejoin; rejoin = null; return c; };
/** 주간 습격으로 들어갈 때 (명예의 전당 · 로비 타일) */
let pickedRaid = false;
export const pickRaid = () => { pickedRaid = true; };
export const takePickedRaid = () => { const n = pickedRaid; pickedRaid = false; return n; };
