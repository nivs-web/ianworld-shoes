/**
 * 점프 피아노 — 계정 상태 창구. (2026-11-07, 이안오락실 6번째 게임)
 *
 * > 대표님: «줄넘기 챔피언에 있는 기능 싹 다 점프 피아노에 집어넣어 — 복사해서 이름만 바꿔서.
 * > 단 점프 피아노의 멀티게임은 다음주에 개발.»
 *
 * 줄넘기 챔피언의 `services/jumprope.js` 를 복사해 이름만 바꿨다. **두 게임은 따로 가는 프로젝트**라
 * 저장 · 지갑 · 기록 · 순위를 섞지 않는다:
 *   · 값은 프로필의 `jp` 한 묶음(`jumppianoState.js`) — 챔피언은 `jr`
 *   · 순위 문서는 `pianoPlayers/{uid}`(`pianoRank.js`) — 챔피언은 `jumpPlayers`
 *   · 내가 만든 스테이지는 `jumppiano.myStages.v1`(이 기기) — 챔피언은 `jumprope.myStages.v1`
 * 표(줄넘기 · 꾸미기 · 아이템 · 난이도)는 챔피언 것(`games/jumprope/data.js`)을 그대로 읽어 쓴다.
 *
 * ## 얻는 것
 * · 줄넘기: 처음 3개 · 레벨 보상 · 상점 · 업적 3개(마지막 대회 · 무한 100개 · 별 15개)
 *   — 레벨·업적 줄넘기는 **저장하지 않고 계산한다**. 산 것만 `owned` 에 `rope:아이디` 로 적는다.
 * · 별사탕(지갑): 판 결과로 받고 상점에서 쓴다. (챔피언 별사탕과 다른 지갑이다)
 */

import * as L from './storageLocal.js';
import { patch } from './profile.js';
import { normJp } from './jumppianoState.js';
import { ROPES, ROPE_BY_ID, LOOK_PARTS, STAGES, DIFFS, DIFF_KEYS, ITEMS, ITEM_MAX, decodeLook, encodeLook } from '../games/jumprope/data.js';
import { levelFromXp, sanitizeStage } from '../games/jumprope/engine.js';
import { syncPianoPlayerSoon } from './pianoRank.js';

/* 예전 줄인 로비(`jp.v1`, 이 기기 localStorage)에 남은 방식 · 난이도 · 대회 최고 점수를 처음 한 번 옮긴다 */
const OLD_KEY = 'jp.v1';
function fromOld() {
  let o = null;
  try { o = JSON.parse(localStorage.getItem(OLD_KEY) || 'null'); } catch { o = null; }
  if (!o || typeof o !== 'object') return null;
  const scores = {};
  for (const d of DIFF_KEYS) {
    scores[d] = Array.from({ length: 10 }, (_, i) => Math.max(o.best?.[`jump:${d}:${i + 1}`] | 0, o.best?.[`both:${d}:${i + 1}`] | 0));
  }
  return { diff: o.diff, scores, opts: { ctrl: o.ctrl } };
}

export const jp = () => {
  const raw = L.loadProfile().jp;
  if (raw) return normJp(raw);
  const old = fromOld();
  return normJp(old);
};
const save = (next) => patch({ jp: next });

/* ---------- 계산값 ---------- */
export const levelOf = (j = jp()) => levelFromXp(j.xp);
export const starsIn = (j, diff) => (j.stars[diff] || []).reduce((a, b) => a + b, 0);
export const bestStars = (j) => Math.max(...DIFF_KEYS.map((d) => starsIn(j, d)));
/* 대회 5개 — 챔피언과 같은 곡표(beat/stages.js) */
export const CHAMP_STAGES = 5;
export const stage10Cleared = (j) => DIFF_KEYS.some((d) => (j.stars[d][CHAMP_STAGES - 1] | 0) > 0);
export const bestEndless = (j) => Math.max(j.endless.easy, j.endless.normal, j.endless.hard);

export function hasRope(id, j = jp()) {
  const r = ROPE_BY_ID[id];
  if (!r) return false;
  const g = r.get || {};
  if (g.start) return true;
  if (g.lv) return levelOf(j).level >= g.lv;
  if (g.price) return j.owned.includes('rope:' + id);
  if (g.stage10) return stage10Cleared(j);
  if (g.endless100) return bestEndless(j) >= 100;
  if (g.stars30) return bestStars(j) >= CHAMP_STAGES * 3;
  return false;
}
export const ownedRopes = (j = jp()) => ROPES.filter((r) => hasRope(r.id, j));

/* ---------- 콤보 선물 가면 ----------
 * 챔피언과 같은 기준(30 · 60 · 90 · 150 · 200 · 250 · 300) — 보통 · 어려움에서 세운 콤보 기록만. */
export const COMBO_GIFTS = [30, 60, 90, 150, 200, 250, 300];
export const maskNeed = (idx) => COMBO_GIFTS[idx - 1] ?? Infinity;
export const comboOf = (j = jp()) => j.comboRec | 0;

export function hasPart(key, idx, j = jp()) {
  const part = LOOK_PARTS.find((p) => p.key === key);
  const it = part?.list[idx];
  if (!it) return false;
  if (key === 'mask') return idx === 0 || comboOf(j) >= maskNeed(idx);
  const g = it.get;
  if (!g) return true;
  if (g.lv) return levelOf(j).level >= g.lv;
  if (g.price) return j.owned.includes(`${key}:${idx}`);
  return false;
}

/** 순위 문서에 싣는 계산값 */
export function derive(p) {
  const j = normJp(p?.jp);
  return { level: levelOf(j).level, ropes: ownedRopes(j).length, stars: bestStars(j) };
}

export const look = (j = jp()) => decodeLook(j.look);
export const rope = (j = jp()) => (hasRope(j.rope, j) ? ROPE_BY_ID[j.rope] : ROPE_BY_ID.red);

/** 다음 레벨에 받는 것들 (로비 · 결과 화면) */
export function rewardsAt(lv) {
  const out = [];
  for (const r of ROPES) if (r.get?.lv === lv) out.push({ kind: 'rope', id: r.id, name: r.name });
  for (const p of LOOK_PARTS) p.list.forEach((it, i) => { if (it.get?.lv === lv) out.push({ kind: 'part', key: p.key, idx: i, name: it.name }); });
  return out;
}
export function nextReward(j = jp()) {
  const { level } = levelOf(j);
  for (let lv = level + 1; lv <= 20; lv++) {
    const r = rewardsAt(lv);
    if (r.length) return { lv, list: r };
  }
  return null;
}

/* ---------- 고르기 · 설정 ---------- */
export function setRope(id) {
  const j = jp();
  if (!hasRope(id, j) || j.rope === id) return;
  save({ ...j, rope: id });
  syncSoon();
}
export function setLook(lookObj) {
  const j = jp();
  const code = encodeLook(lookObj);
  if (code === j.look) return;
  save({ ...j, look: code });
  syncSoon(3000);
}
export function setDiff(d) {
  const j = jp();
  if (!DIFFS[d] || j.diff === d) return;
  save({ ...j, diff: d });
}
export function setOpt(k, v) {
  const j = jp();
  save({ ...j, opts: { ...j.opts, [k]: v } });
}

/* ---------- 상점 ---------- */
function spend(j, price) {
  if (j.candy < price) return { ok: false, short: price - j.candy };
  return { ok: true, j: { ...j, candy: j.candy - price } };
}
export function buyRope(id) {
  const r = ROPE_BY_ID[id];
  const j = jp();
  if (!r?.get?.price || hasRope(id, j)) return { ok: false };
  const s = spend(j, r.get.price);
  if (!s.ok) return s;
  save({ ...s.j, owned: [...j.owned, 'rope:' + id], rope: id });
  syncSoon();
  return { ok: true };
}
export function buyPart(key, idx) {
  const it = LOOK_PARTS.find((p) => p.key === key)?.list[idx];
  const j = jp();
  if (!it?.get?.price || hasPart(key, idx, j)) return { ok: false };
  const s = spend(j, it.get.price);
  if (!s.ok) return s;
  save({ ...s.j, owned: [...j.owned, `${key}:${idx}`] });
  return { ok: true };
}
export function buyItem(id) {
  const it = ITEMS.find((x) => x.id === id);
  const j = jp();
  if (!it) return { ok: false };
  if (j.items[id] >= ITEM_MAX) return { ok: false, full: true };
  const s = spend(j, it.price);
  if (!s.ok) return s;
  save({ ...s.j, items: { ...j.items, [id]: j.items[id] + 1 } });
  return { ok: true };
}
/** 판을 시작할 때 고른 아이템을 쓴다(나가도 돌려주지 않는다). 실제로 쓴 것만 돌려준다 */
export function useItems(sel) {
  const j = jp();
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
 * 점프 피아노 한 판 끝 — 챔피언 `finishBeat` 와 같은 보상표, 저장만 `jp` 에.
 * @param {{mode:'stage'|'endless'|'test', diff:string, ctrl?:string, stageNo?:number, cleared:boolean, stars?:number, score:number,
 *          perfect:number, great:number, good:number, miss:number, maxCombo:number, count:number,
 *          gold?:number, missions?:number, used?:{candy2?:boolean}}} r
 */
export function finishBeat(r) {
  const before = jp();
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
  const masksBefore = comboOf(before);
  if (r.mode !== 'test' && diff !== 'easy') j.comboRec = Math.max(j.comboRec | 0, maxCombo);
  /* 한 손(3칸) 모드는 타일이 절반쯤이라 한 타일 경험치를 1.6배로 — 한 곡에 버는 양이 비슷하게 */
  const noteK = r.ctrl === 'jump' ? 1.6 : 1;
  let xp = Math.round((perfect * 1 + great * 0.6 + good * 0.3) * noteK);
  let candy = 0, stars = 0, prevStars = 0, newBest = false, firstClear = false;
  if (r.mode === 'stage') {
    const i = Math.max(0, Math.min(CHAMP_STAGES - 1, (r.stageNo | 0) - 1));
    const no = i + 1;
    prevStars = before.stars[diff][i] | 0;
    stars = r.cleared ? Math.max(1, Math.min(3, r.stars | 0)) : 0;
    firstClear = !!r.cleared && prevStars === 0;
    if (r.cleared) xp += 30 + no * 25 + (firstClear ? 50 : 0);
    candy = r.cleared ? 10 + no * 6 + Math.floor(perfect / 5) : Math.floor(perfect / 10);
    if (firstClear) candy += 25;
    if (stars === 3 && prevStars < 3) candy += 20;
    const sc = [...j.stars[diff]]; sc[i] = Math.max(sc[i], stars); j.stars[diff] = sc;
    const bs = [...j.scores[diff]];
    if (ci(r.score, 9999999) > bs[i]) { bs[i] = ci(r.score, 9999999); newBest = true; }
    j.scores[diff] = bs;
  } else if (r.mode === 'endless') {
    xp += Math.floor(count / 10) * 4;
    candy = Math.floor(count / 4);
    if (count > j.endless[diff]) { j.endless[diff] = count; newBest = true; }
  } else {
    xp = Math.floor(xp / 2);      // 내 스테이지 — 판정 경험치 절반, 별사탕 없음
  }
  xp = Math.round(xp * XP_MULT[diff]);
  candy = Math.round(candy * D.reward) * (r.used?.candy2 ? 2 : 1);
  if (r.ctrl === 'both') candy = Math.round(candy * 1.5);   // 두 손(6칸) — 별사탕 1.5배
  candy += ci(r.gold) * 2 + ci(r.missions) * 5;              // 황금 타일 · 미션 성공
  j.xp += xp;
  j.candy += candy;
  j.candyTotal += candy;
  save(j);
  const lvAfter = levelOf(j).level;
  const newRopes = ownedRopes(j).filter((x) => !ropesBefore.has(x.id));
  const newParts = [];
  for (let lv = lvBefore + 1; lv <= lvAfter; lv++) for (const it of rewardsAt(lv)) if (it.kind === 'part') newParts.push(it);
  syncSoon();
  return { xp, candy, stars, prevStars, newBest, firstClear, lvBefore, lvAfter, newRopes, newParts, newMasks: newMasksBetween(masksBefore, comboOf(j)), level: levelOf(j) };
}

/** 콤보 기록이 a → b 로 오르며 새로 받은 가면들 */
export function newMasksBetween(a, b) {
  const part = LOOK_PARTS.find((p) => p.key === 'mask');
  const out = [];
  COMBO_GIFTS.forEach((need, i) => { if (a < need && b >= need) out.push({ idx: i + 1, need, name: part?.list[i + 1]?.name || `가면 ${i + 1}` }); });
  return out;
}

/* ---------- 방식: «한 손»(3칸 · 기본) · «두 손»(6칸) ---------- */
export const ctrlMode = (j = jp()) => (j.opts.ctrl === 'both' ? 'both' : 'jump');

/** 대회 n 이 열렸나 — 앞 대회를 완주(별 1개+)해야 열린다 */
export const champUnlocked = (no, diff, j = jp()) => no <= 1 || (j.stars[diff]?.[no - 2] | 0) > 0;
export const champStars = (j, diff) => (j.stars[diff] || []).slice(0, CHAMP_STAGES).reduce((a, b) => a + b, 0);

function syncSoon(ms) { syncPianoPlayerSoon(derive, ms); }

/* ---------- 내가 만든 스테이지 (이 기기 — 챔피언 것과 따로) ---------- */
const MY_KEY = 'jumppiano.myStages.v1';
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
