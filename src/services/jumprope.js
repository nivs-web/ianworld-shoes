/**
 * 줄넘기 챔피언 — 계정 상태 창구. (2026-11-07, 이안오락실 5번째 게임)
 *
 * 화면(로비 · 상점 · 꾸미기 · 명예의 전당)과 게임 래퍼가 이것만 부른다.
 * 값은 프로필의 `jr` 한 묶음에 있다(`jumpropeState.js`) — 고칠 때는 언제나 묶음째 `patch` 한다.
 *
 * ## 얻는 것
 * · 줄넘기: 처음 3개 · 레벨 보상 15개 · 상점 6개 · 업적 3개(스테이지 10 · 무한 100개 · 별 30개)
 *   — 레벨·업적 줄넘기는 **저장하지 않고 계산한다**(경험치·기록이 곧 증거라 두 기기 병합이 저절로 맞는다).
 *   산 것만 `owned` 에 `rope:아이디` 로 적는다. 꾸미기 부품은 `부품:번호`.
 * · 별사탕(지갑): 판 결과로 받고 상점에서 쓴다.
 *
 * ## 내가 만든 스테이지
 * 이 기기에만 둔다(localStorage) — 친구에게는 코드 한 줄로 보낸다. 서버 0원(새 게임 공식).
 */

import * as L from './storageLocal.js';
import { patch } from './profile.js';
import { normJr } from './jumpropeState.js';
import { ROPES, ROPE_BY_ID, LOOK_PARTS, STAGES, DIFFS, DIFF_KEYS, ITEMS, ITEM_MAX, decodeLook, encodeLook } from '../games/jumprope/data.js';
import { levelFromXp, xpFor, starsFor, sanitizeStage, SPEED_MIN, SPEED_MAX, XP } from '../games/jumprope/engine.js';
import { syncJumpPlayerSoon } from './jumpRank.js';

export const jr = () => normJr(L.loadProfile().jr);
const save = (next) => patch({ jr: next });

/* ---------- 계산값 ---------- */
export const levelOf = (j = jr()) => levelFromXp(j.xp);
export const starsIn = (j, diff) => (j.stars[diff] || []).reduce((a, b) => a + b, 0);
export const bestStars = (j) => Math.max(...DIFF_KEYS.map((d) => starsIn(j, d)));
export const stage10Cleared = (j) => DIFF_KEYS.some((d) => (j.stars[d][9] | 0) > 0);
export const bestEndless = (j) => Math.max(j.endless.easy, j.endless.normal, j.endless.hard);

export function hasRope(id, j = jr()) {
  const r = ROPE_BY_ID[id];
  if (!r) return false;
  const g = r.get || {};
  if (g.start) return true;
  if (g.lv) return levelOf(j).level >= g.lv;
  if (g.price) return j.owned.includes('rope:' + id);
  if (g.stage10) return stage10Cleared(j);
  if (g.endless100) return bestEndless(j) >= 100;
  if (g.stars30) return bestStars(j) >= 30;
  return false;
}
export const ownedRopes = (j = jr()) => ROPES.filter((r) => hasRope(r.id, j));

export function hasPart(key, idx, j = jr()) {
  const part = LOOK_PARTS.find((p) => p.key === key);
  const it = part?.list[idx];
  if (!it) return false;
  const g = it.get;
  if (!g) return true;
  if (g.lv) return levelOf(j).level >= g.lv;
  if (g.price) return j.owned.includes(`${key}:${idx}`);
  return false;
}

/** 순위 문서에 싣는 계산값 */
export function derive(p) {
  const j = normJr(p?.jr);
  return { level: levelOf(j).level, ropes: ownedRopes(j).length, stars: bestStars(j) };
}

export const look = (j = jr()) => decodeLook(j.look);
export const rope = (j = jr()) => (hasRope(j.rope, j) ? ROPE_BY_ID[j.rope] : ROPE_BY_ID.red);

/** 다음 레벨에 받는 것들 (로비 · 결과 화면) */
export function rewardsAt(lv) {
  const out = [];
  for (const r of ROPES) if (r.get?.lv === lv) out.push({ kind: 'rope', id: r.id, name: r.name });
  for (const p of LOOK_PARTS) p.list.forEach((it, i) => { if (it.get?.lv === lv) out.push({ kind: 'part', key: p.key, idx: i, name: it.name }); });
  return out;
}
export function nextReward(j = jr()) {
  const { level } = levelOf(j);
  for (let lv = level + 1; lv <= 20; lv++) {
    const r = rewardsAt(lv);
    if (r.length) return { lv, list: r };
  }
  return null;
}

export function stageUnlocked(no, diff, j = jr()) {
  return no <= 1 || (j.stars[diff]?.[no - 2] | 0) > 0;
}

/* ---------- 난이도를 입힌 스테이지 ---------- */
const clampV = (v) => Math.max(SPEED_MIN, Math.min(SPEED_MAX, v));
function shiftSeg(seg, dv) {
  if (!dv) return { ...seg };
  const o = { ...seg };
  if (o.v != null) o.v = clampV(o.v + dv);
  if (o.a != null) o.a = clampV(o.a + dv);
  if (o.b != null) o.b = clampV(o.b + dv);
  return o;
}
/** 기본 스테이지 + 난이도 → 실제로 도는 스테이지. 도우미 링 설정(켜기·끄기)도 여기서 입힌다 */
export function playStage(stage, diff, custom = false, j = jr()) {
  const D = DIFFS[diff] || DIFFS.normal;
  const st = custom
    ? { ...stage, segs: stage.segs.map((s) => ({ ...s })) }
    : {
        ...stage,
        judge: D.judge,
        hearts: Math.max(1, Math.min(5, (stage.hearts || 3) + D.hearts)),
        ring: D.ring ?? stage.ring,
        segs: stage.segs.map((s) => shiftSeg(s, D.speed)),
      };
  if (j.opts.ring === 'on') st.ring = true;
  if (j.opts.ring === 'off') st.ring = false;
  return st;
}
export const endlessShift = (diff) => (DIFFS[diff] || DIFFS.normal).speed;

/* ---------- 고르기 · 설정 ---------- */
export function setRope(id) {
  const j = jr();
  if (!hasRope(id, j) || j.rope === id) return;
  save({ ...j, rope: id });
  syncSoon();
}
export function setLook(lookObj) {
  const j = jr();
  const code = encodeLook(lookObj);
  if (code === j.look) return;
  save({ ...j, look: code });
  syncSoon(3000);
}
export function setDiff(d) {
  const j = jr();
  if (!DIFFS[d] || j.diff === d) return;
  save({ ...j, diff: d });
}
export function setOpt(k, v) {
  const j = jr();
  save({ ...j, opts: { ...j.opts, [k]: v } });
}

/* ---------- 상점 ---------- */
function spend(j, price) {
  if (j.candy < price) return { ok: false, short: price - j.candy };
  return { ok: true, j: { ...j, candy: j.candy - price } };
}
export function buyRope(id) {
  const r = ROPE_BY_ID[id];
  const j = jr();
  if (!r?.get?.price || hasRope(id, j)) return { ok: false };
  const s = spend(j, r.get.price);
  if (!s.ok) return s;
  save({ ...s.j, owned: [...j.owned, 'rope:' + id], rope: id });
  syncSoon();
  return { ok: true };
}
export function buyPart(key, idx) {
  const it = LOOK_PARTS.find((p) => p.key === key)?.list[idx];
  const j = jr();
  if (!it?.get?.price || hasPart(key, idx, j)) return { ok: false };
  const s = spend(j, it.get.price);
  if (!s.ok) return s;
  save({ ...s.j, owned: [...j.owned, `${key}:${idx}`] });
  return { ok: true };
}
export function buyItem(id) {
  const it = ITEMS.find((x) => x.id === id);
  const j = jr();
  if (!it) return { ok: false };
  if (j.items[id] >= ITEM_MAX) return { ok: false, full: true };
  const s = spend(j, it.price);
  if (!s.ok) return s;
  save({ ...s.j, items: { ...j.items, [id]: j.items[id] + 1 } });
  return { ok: true };
}
/** 판을 시작할 때 고른 아이템을 쓴다(나가도 돌려주지 않는다). 실제로 쓴 것만 돌려준다 */
export function useItems(sel) {
  const j = jr();
  const used = {};
  const items = { ...j.items };
  for (const it of ITEMS) if (sel?.[it.id] && items[it.id] > 0) { items[it.id] -= 1; used[it.id] = true; }
  if (Object.keys(used).length) save({ ...j, items });
  return used;
}

/* ---------- 한 판 끝 ---------- */
const XP_MULT = { easy: 1, normal: 1.25, hard: 1.5 };
const CAP_COUNT = 99999;
const ci = (v, hi = CAP_COUNT) => Math.max(0, Math.min(hi, Math.round(Number(v) || 0)));

/**
 * @param {{mode:'stage'|'endless'|'test', diff:string, stageNo?:number, cleared?:boolean, heartsLost?:number,
 *          perfect:number, great:number, good:number, score:number, maxCombo:number, count:number, total?:number,
 *          used?:{candy2?:boolean}}} r
 * @returns 결과 화면에 보여 줄 요약
 */
export function finishRun(r) {
  const before = jr();
  const diff = DIFFS[r?.diff] ? r.diff : 'normal';
  const D = DIFFS[diff];
  const perfect = ci(r.perfect), great = ci(r.great), good = ci(r.good);
  const count = ci(r.count), maxCombo = ci(r.maxCombo);
  const ropesBefore = new Set(ownedRopes(before).map((x) => x.id));
  const lvBefore = levelOf(before).level;

  const j = { ...before, endless: { ...before.endless }, stars: { ...before.stars }, scores: { ...before.scores } };
  j.plays += 1;
  j.jumps += count;
  j.perfects += perfect;
  j.bestCombo = Math.max(j.bestCombo, maxCombo);

  let xp = 0, candy = 0, stars = 0, prevStars = 0, newBest = false, firstClear = false;
  if (r.mode === 'stage') {
    const i = Math.max(0, Math.min(9, (r.stageNo | 0) - 1));
    const no = i + 1;
    prevStars = before.stars[diff][i] | 0;
    stars = starsFor({ cleared: !!r.cleared, heartsLost: ci(r.heartsLost), perfect, total: ci(r.total) });
    firstClear = !!r.cleared && prevStars === 0;
    xp = Math.round(xpFor({ perfect, great, good, cleared: !!r.cleared, stageNo: no, firstClear }) * XP_MULT[diff]);
    candy = r.cleared ? 5 + no * 2 + Math.floor(perfect / 2) : Math.floor(perfect / 4);
    if (firstClear) candy += 20;
    if (stars === 3 && prevStars < 3) candy += 15;
    candy = Math.round(candy * D.reward);
    const sc = [...j.stars[diff]]; sc[i] = Math.max(sc[i], stars); j.stars[diff] = sc;
    const bs = [...j.scores[diff]];
    if (ci(r.score, 9999999) > bs[i]) { bs[i] = ci(r.score, 9999999); newBest = !!r.cleared; }
    j.scores[diff] = bs;
  } else if (r.mode === 'endless') {
    xp = Math.round((perfect * XP.perfect + great * XP.great + good * XP.good + Math.floor(count / 10) * 5) * XP_MULT[diff]);
    candy = Math.round(Math.floor(count / 3) * D.reward);
    if (count > j.endless[diff]) { j.endless[diff] = count; newBest = true; }
  } else {
    /* 내가 만든 스테이지 — 아무 박자표나 만들 수 있으니 보상은 판정 경험치의 절반만, 별사탕 없음 */
    xp = Math.floor((perfect * XP.perfect + great * XP.great + good * XP.good) / 2);
  }
  if (r.used?.candy2) candy *= 2;
  j.xp += xp;
  j.candy += candy;
  j.candyTotal += candy;
  save(j);

  const lvAfter = levelOf(j).level;
  const newRopes = ownedRopes(j).filter((x) => !ropesBefore.has(x.id));
  const newParts = [];
  for (let lv = lvBefore + 1; lv <= lvAfter; lv++) for (const it of rewardsAt(lv)) if (it.kind === 'part') newParts.push(it);
  syncSoon();
  return { xp, candy, stars, prevStars, newBest, firstClear, lvBefore, lvAfter, newRopes, newParts, level: levelOf(j) };
}

function syncSoon(ms) { syncJumpPlayerSoon(derive, ms); }

/* ---------- 내가 만든 스테이지 (이 기기) ---------- */
const MY_KEY = 'jumprope.myStages.v1';
export const MY_MAX = 20;
export function myStages() {
  try {
    const a = JSON.parse(localStorage.getItem(MY_KEY) || '[]');
    return (Array.isArray(a) ? a : []).map((x) => {
      const st = sanitizeStage(x);
      return st ? { id: String(x.id || Math.random().toString(36).slice(2)), ...st } : null;
    }).filter(Boolean).slice(0, MY_MAX);
  } catch { return []; }
}
function writeMy(list) {
  try { localStorage.setItem(MY_KEY, JSON.stringify(list.slice(0, MY_MAX))); return true; } catch { return false; }
}
/** 새로 넣거나(id 없음) 고친다. 돌려주는 값 = 저장된 스테이지(또는 null: 꽉 참·잘못된 값) */
export function saveMyStage(stage) {
  const st = sanitizeStage(stage);
  if (!st) return null;
  const list = myStages();
  const id = stage.id || `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  const i = list.findIndex((x) => x.id === id);
  const rec = { id, ...st };
  if (i >= 0) list[i] = rec;
  else { if (list.length >= MY_MAX) return null; list.push(rec); }
  return writeMy(list) ? rec : null;
}
export function deleteMyStage(id) { writeMy(myStages().filter((x) => x.id !== id)); }

export { STAGES };
