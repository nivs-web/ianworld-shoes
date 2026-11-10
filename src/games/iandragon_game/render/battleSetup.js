/**
 * 판 준비 (B2 · 2026-11-11 야간) — 스테이지 + 저장 → 전투 코어에 넣을 loads.
 *
 * 해금 : 스테이지의 `unlocks` 글(«용 「돌등이」» · «스킬 「운석」» · «덱 칸 +1»)을 앞 스테이지부터 모은다.
 * 레벨 : 훈련소(B4) 전이라 «저장된 레벨»과 «그 스테이지 권장 레벨(expLevel)» 중 큰 값으로 나간다 — 결정 D1 (OVERNIGHT_LOG).
 * 덱 · 리더 · 보너스 : 연구소 · 보물(B4) 전이라 밸런스 계산기의 «기준 출전»(docs/sim/stages.js refLoad)을 그대로 따른다 — 결정 D3.
 *   덱 = 꼬물이 · 돌등이 · 그 월드 필수 용 · 우선순위 순 · 칸 수만큼 / 리더 = 월드마다 정해진 리더 / 보너스 = 연구소 (월드−1)레벨 + 지난 월드 보물 2단계
 */
import { UNITS } from '../data/units.js';
import { SKILLS } from '../data/skills.js';
import { STAGES } from '../data/stages/index.js';
import { LEADERS } from '../data/leaders.js';
import { ENEMIES } from '../data/enemies.js';

/** 용이 열리는 차례 (기획서 9.5) */
export const DRAGON_ORDER = ['kkomul', 'doldeung', 'bulttong', 'twetwe', 'ssaeng', 'bangul', 'dungsil', 'giljjuk', 'eoreum', 'jjirit', 'banjjak', 'kungkwang'];
const byName = (table, name) => Object.keys(table).find((k) => table[k].name === name);

/** 순번 g 스테이지를 시작할 때 열려 있는 것 (그 앞 스테이지들을 깨서 얻은 것) */
export function unlockedBefore(g) {
  const dragons = new Set(['kkomul']), skills = [];
  let deckCap = 5, speedMax = 1;
  for (const st of STAGES) {
    if (st.g >= g) break;
    for (const txt of st.unlocks || []) {
      const d = txt.match(/^용 「(.+)」/); if (d) { const id = byName(UNITS, d[1]); if (id) dragons.add(id); }
      const s = txt.match(/^스킬 「(.+)」/); if (s) { const id = byName(SKILLS, s[1]); if (id && !skills.includes(id)) skills.push(id); }
      if (/덱 칸 \+1/.test(txt)) deckCap++;
      if (txt === '2배속') speedMax = Math.max(speedMax, 2);
      if (txt === '3배속') speedMax = 3;
    }
  }
  return { dragons: DRAGON_ORDER.filter((id) => dragons.has(id)), skills: skills.slice(-2), deckCap: Math.min(10, deckCap), speedMax };
}

/* 계산기 기준 출전 (docs/sim/stages.js) — 월드 1~10 */
const MUST = [[], ['bangul'], ['dungsil'], ['bulttong', 'eoreum'], ['jjirit'], ['banjjak'], ['giljjuk', 'kungkwang'], ['banjjak', 'eoreum'], ['jjirit', 'kungkwang'], []];
const LEADER_AT = ['novart', 'aquantis', 'forestia', 'crimsonde', 'volttail', 'solaris', 'sandscale', 'shadowfen', 'volttail', 'aquantis'];
const PRIORITY = ['kungkwang', 'giljjuk', 'dungsil', 'twetwe', 'banjjak', 'jjirit', 'eoreum', 'bangul', 'bulttong', 'ssaeng'];
function pickDeck(dragons, cap, w, costMax) {
  const want = ['kkomul', 'doldeung', ...(MUST[w - 1] || []), ...PRIORITY].filter((id, i, a) => a.indexOf(id) === i && dragons.includes(id));
  return (costMax ? want.filter((id) => UNITS[id].cost <= costMax) : want).slice(0, cap);
}
export function refBonus(w) {   // 연구소 = (월드−1) 레벨, 지난 월드 보물 = 2단계
  const lab = w - 1, T = (j) => (w > j ? 2 : 0);
  return {
    income: (1 + 0.02 * lab) * (1 + 0.04 * T(1)), walletMax: (1 + 0.05 * lab) * (1 + 0.10 * T(5)), startMoney: 20 * lab + 50 * T(10) / 2,
    baseHp: (1 + 0.05 * lab) * (1 + 0.10 * T(4)), breathDmg: (1 + 0.05 * lab) * (1 + 0.10 * T(9)), breathCharge: (1 + 0.02 * lab) * (1 + 0.05 * T(7)),
    cooldown: 1 + 0.03 * T(3), bounty: (1 + 0.03 * lab) * (1 + 0.05 * T(6)), atk: 1 + 0.03 * T(2), hp: 1 + 0.03 * T(8),
  };
}

/* 연구소 7항목 (기획서 10장 · 저장 lab[0..6] 순서) · 보물 (10.5 · 월드 별 10/20/30 → 1/2/3단계) */
export const LAB = [
  { k: 'income', name: '불씨 생산', per: 0.02, pct: true }, { k: 'walletMax', name: '불씨 최대', per: 0.05, pct: true }, { k: 'startMoney', name: '시작 불씨', per: 20 },
  { k: 'baseHp', name: '기지 체력', per: 0.05, pct: true }, { k: 'breathDmg', name: '브레스 피해', per: 0.05, pct: true }, { k: 'breathCharge', name: '브레스 충전', per: 0.02, pct: true }, { k: 'bounty', name: '현상금', per: 0.03, pct: true },
];
export const TREASURE = [
  { k: 'income', name: '불씨 생산', per: 0.04 }, { k: 'atk', name: '공격', per: 0.03 }, { k: 'cooldown', name: '재생산', per: 0.03 }, { k: 'baseHp', name: '기지 체력', per: 0.10 }, { k: 'walletMax', name: '불씨 최대', per: 0.10 },
  { k: 'bounty', name: '현상금', per: 0.05 }, { k: 'breathCharge', name: '브레스 충전', per: 0.05 }, { k: 'hp', name: '체력', per: 0.03 }, { k: 'breathDmg', name: '브레스 피해', per: 0.10 }, { k: 'startMoney', name: '시작 불씨', per: 25, flat: true },
];
/** 월드 w 의 보물 단계 : 그 월드 별 합 10 · 20 · 30 */
export const treasureLv = (stars, w) => { let n = 0; for (let i = (w - 1) * 10; i < w * 10; i++) n += Number(stars?.[i]) || 0; return n >= 30 ? 3 : n >= 20 ? 2 : n >= 10 ? 1 : 0; };
/** 내가 실제로 쌓은 보너스 (연구소 + 보물) */
export function realBonus(save) {
  const B = { income: 1, walletMax: 1, startMoney: 0, baseHp: 1, breathDmg: 1, breathCharge: 1, cooldown: 1, bounty: 1, atk: 1, hp: 1 };
  LAB.forEach((L, i) => { const n = save?.lab?.[i] || 0; if (L.pct) B[L.k] *= 1 + L.per * n; else B[L.k] += L.per * n; });
  TREASURE.forEach((T, j) => { const n = treasureLv(save?.stars, j + 1); if (T.flat) B[T.k] += T.per * n; else B[T.k] *= 1 + T.per * n; });
  return B;
}
/** 결정 D7 : 기준(계산기)과 내 것 중 항목마다 큰 값 — 연구소를 안 해도 기준만큼은, 하면 더 세게 */
export function bonusFor(w, save) {
  const ref = refBonus(w), mine = realBonus(save), out = {};
  for (const k of Object.keys(ref)) out[k] = Math.max(ref[k], mine[k] ?? ref[k]);
  return out;
}
/** 리더 : 저장값 'auto' 면 월드 추천 리더, 아니면 고른 리더(연 것만 · 결정 D8) */
export const leaderFor = (stage, save) => { const want = save?.leader; const open = Math.floor((save?.cleared || 0) / 10); return want && want !== 'auto' && LEADERS[want] && LEADERS[want].unlock <= open ? want : LEADER_AT[stage.w - 1] || 'novart'; };

export function makeLoads(stage, save) {
  const un = unlockedBefore(Math.max(stage.g, Math.min(LAST_STAGE, (save?.cleared || 0) + 1)));   // 다시 하기도 지금까지 연 만큼 (코드 검토 4)
  const lvOf = (id) => Math.max(save?.units?.[id]?.[0] || 1, stage.expLevel || 1);
  /* 내가 고른 덱(둥지에서 «출전») — 2마리 이상 골랐으면 그것, 아니면 기준 덱. 고른 덱도 칸 수 · 비용 제한을 따른다 */
  const owned = (id) => un.dragons.includes(id) || (UNITS[id]?.rar !== 'story' && save?.units?.[id]);
  const mine = (save?.deck || []).filter((id) => UNITS[id] && owned(id) && (!stage.costMax || UNITS[id].cost <= stage.costMax)).slice(0, un.deckCap);
  const ids = mine.length >= 2 ? mine : pickDeck(un.dragons, un.deckCap, stage.w, stage.costMax);
  const deck = ids.map((id) => ({ id, lv: lvOf(id) }));
  const leader = leaderFor(stage, save);
  return {
    deck,
    skills: un.skills,
    speedMax: un.speedMax,
    loads: [{ side: 0, deck, leader, leaderLv: Math.max(1, stage.expLevel || 1), skills: un.skills, bonus: bonusFor(stage.w, save) }],
  };
}

/** 난이도 (META 4장) — 적 체력 · 공격 배율 · 코인 배율 · 별 상한. 어려움은 그 월드를 보통으로 다 깨면 열린다 */
export const DIFF = {
  easy: { name: '쉬움', mag: 0.75, coin: 0.7, maxStar: 2 },
  normal: { name: '보통', mag: 1, coin: 1, maxStar: 3 },
  hard: { name: '어려움', mag: 1.35, coin: 1.5, maxStar: 3 },
};
export const hardOpen = (g, save) => (save?.cleared || 0) >= Math.ceil(g / 10) * 10;
/** 이 판에서 실제로 쓸 난이도 (운영자가 끄면 · 어려움이 아직 안 열렸으면 보통) */
export function diffFor(g, save, enabled = true) {
  const d = enabled ? save?.diff || 'normal' : 'normal';
  return d === 'hard' && !hardOpen(g, save) ? 'normal' : DIFF[d] ? d : 'normal';
}

/**
 * 주간 좀비 습격 (META 5장 · 명예의 전당 핵심) — 끝없는 웨이브. 20초마다 웨이브 · 웨이브마다 13% 세짐 · 5웨이브마다 보스 · 최대 40웨이브.
 * 모두 같은 조건 : 주(한국 시간 ISO 주)마다 같은 씨앗 → 같은 좀비 순서, 내 덱 6칸 · 모두 Lv20 · 연구소/보물 미적용.
 * 자동 전투(기준 AI) 5주 : 20~23 웨이브.
 */
export const RAID_WAVE = 20, RAID_MAX = 40;
export function weekKey(now = Date.now()) {
  const d = new Date(now + 9 * 3600e3); d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + 3 - ((d.getUTCDay() + 6) % 7));
  const y = d.getUTCFullYear(), w = 1 + Math.round(((d - Date.UTC(y, 0, 4)) / 864e5 - 3 + ((new Date(Date.UTC(y, 0, 4)).getUTCDay() + 6) % 7)) / 7);
  return { key: `${y}-W${String(w).padStart(2, '0')}`, idx: y * 100 + w };
}
export function raidStage(key) {
  let h = 0; for (const c of key) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  let s = h || 1; const r = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const pool = Object.keys(ENEMIES).filter((k) => !ENEMIES[k].boss && k !== 'gold'), boss = Object.keys(ENEMIES).filter((k) => ENEMIES[k].boss);
  const pick = (a) => a[Math.floor(r() * a.length)], lines = [];
  for (let wv = 0; wv < RAID_MAX; wv++) {
    const t0 = 3 + wv * RAID_WAVE, mag = 3 * Math.pow(1.13, wv);
    lines.push({ id: pick(pool), count: 4 + (wv >> 2), start: t0, every: [1.2, 2.2], mag });
    lines.push({ id: pick(pool), count: 2 + (wv >> 3), start: t0 + 6, every: [2, 3.5], mag });
    if (wv % 5 === 4) lines.push({ id: pick(boss), count: 1, start: t0 + 10, every: 999, mag: mag * 0.35 });
  }
  return { id: '습격', name: '주간 좀비 습격', g: 0, w: 1 + (h % 10), s: 0, gim: null, raid: key, length: 1100, mag: 1, atkMag: 1, baseHp: 1e9, limit: 3 + RAID_MAX * RAID_WAVE + 30, fever: 9999, star2: 0, star3: 0, lines };
}
export const raidWaves = (t) => Math.max(0, Math.min(RAID_MAX, Math.floor((t - 3) / RAID_WAVE)));

/** 용 대결 (3차 M5 · 멀티 기획 2.2) — 좀비 없음 · 길이 1000 · 180초 · 불꽃 타임 90초 · 모두 Lv20 · 덱 6칸 · 연구소/보물 미적용 */
export const PVP_OPEN = 20;   // 2-10 을 깨면 열린다 (덱 6칸이 열릴 때)
export const PVP_DAY = 5;     // 하루 보상 판 수
export function pvpStage() {
  const b = stageByNo(PVP_OPEN);
  return { ...b, id: 'VS', name: '용 대결', g: 0, s: 0, gim: null, fog: false, pvp: true, lines: [], length: 1000, baseHp: 3000, limit: 180, fever: 90, star2: 0, star3: 0 };
}
export function pvpLoad(ld, side) {
  const seen = new Set(); let legend = 0;
  const deck = ld.deck.filter((d) => { if (seen.has(d.id)) return false; if (UNITS[d.id]?.rar === 'legend' && legend++) return false; seen.add(d.id); return true; }).slice(0, 6).map((d) => ({ id: d.id, lv: 20 }));
  return { side, deck, leader: ld.leader, leaderLv: 20, skills: (ld.skills || []).slice(0, 2), bonus: {} };
}

/** 멀티 버전 (멀티 기획 3.5) — 전투 숫자(데이터)의 짧은 해시. 두 기기가 다르면 계산이 어긋나므로 시작하지 않는다 */
export const NET_V = (() => { const s = JSON.stringify([UNITS, ENEMIES, LEADERS, SKILLS, STAGES.length]); let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); })();

/** 멀티 편성 → 글자 (방 `players/$uid/ld` · 500자 이하) */
export function loadToLd(load, look = '') {
  const b = {}; for (const [k, v] of Object.entries(load.bonus || {})) b[k] = Math.round(v * 1000) / 1000;
  return JSON.stringify({ v: NET_V, o: String(look || '').slice(0, 40), d: load.deck.map((x) => [x.id, x.lv]), l: load.leader, q: load.leaderLv, k: load.skills || [], b });
}
/** 글자 → 편성 (받은 값은 범위 안으로 자르고 확인 · 이상하면 null → 시작하지 않는다) */
export function ldToLoad(str) {
  let o; try { o = JSON.parse(str); } catch { return null; }
  if (!o || !Array.isArray(o.d) || o.d.length < 1 || o.d.length > 10) return null;
  const seen = new Set(), deck = [];
  for (const [id, lv] of o.d) { if (!UNITS[id] || seen.has(id)) return null; seen.add(id); deck.push({ id, lv: Math.max(1, Math.min(30, Math.round(lv) || 1)) }); }
  if (!LEADERS[o.l]) return null;
  const skills = (Array.isArray(o.k) ? o.k : []).filter((id) => SKILLS[id]).slice(0, 2);
  const bonus = {}; for (const [k, v] of Object.entries(o.b || {})) if (Number.isFinite(v)) bonus[k] = Math.max(0, Math.min(k === 'startMoney' ? 2000 : 5, v));
  return { side: 0, deck, leader: o.l, leaderLv: Math.max(1, Math.min(30, Math.round(o.q) || 1)), skills, bonus, v: String(o.v || ''), look: typeof o.o === 'string' && /^[a-z0-9.]{0,40}$/.test(o.o) ? o.o : '' };
}

/** 별 : ★ 깨면 · ★★ star2 초 안 · ★★★ star3 초 안 (1배속 전투 시간) */
export function starsFor(stage, t) {
  if (t <= stage.star3) return 3;
  if (t <= stage.star2) return 2;
  return 1;
}

export const stageByNo = (g) => STAGES.find((s) => s.g === g) || STAGES[0];
/** 범위 = 월드 1~10 (100판 · 2차 2026-11-11 결정 D10) */
export const LAST_STAGE = 100;
