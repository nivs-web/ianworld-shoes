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

/** 용이 열리는 차례 (기획서 9.5) */
export const DRAGON_ORDER = ['kkomul', 'doldeung', 'bulttong', 'twetwe', 'ssaeng', 'bangul', 'dungsil', 'giljjuk', 'eoreum', 'jjirit'];
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

/* 계산기 기준 출전 (docs/sim/stages.js) — 월드 1~5 */
const MUST = [[], ['bangul'], ['dungsil'], ['bulttong', 'eoreum'], ['jjirit']];
const LEADER_AT = ['novart', 'aquantis', 'forestia', 'crimsonde', 'volttail'];
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

export function makeLoads(stage, save) {
  const un = unlockedBefore(stage.g);
  const lvOf = (id) => Math.max(save?.units?.[id]?.[0] || 1, stage.expLevel || 1);
  const deck = pickDeck(un.dragons, un.deckCap, stage.w, stage.costMax).map((id) => ({ id, lv: lvOf(id) }));
  const leader = LEADER_AT[stage.w - 1] || 'novart';
  return {
    deck,
    skills: un.skills,
    speedMax: un.speedMax,
    loads: [{ side: 0, deck, leader, leaderLv: Math.max(1, stage.expLevel || 1), skills: un.skills, bonus: refBonus(stage.w) }],
  };
}

/** 별 : ★ 깨면 · ★★ star2 초 안 · ★★★ star3 초 안 (1배속 전투 시간) */
export function starsFor(stage, t) {
  if (t <= stage.star3) return 3;
  if (t <= stage.star2) return 2;
  return 1;
}

export const stageByNo = (g) => STAGES.find((s) => s.g === g) || STAGES[0];
/** 1차 범위 = 월드 1~5 (50판) */
export const LAST_STAGE = 50;
