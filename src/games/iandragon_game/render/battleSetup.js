/**
 * 판 준비 (B2 · 2026-11-11 야간) — 스테이지 + 저장 → 전투 코어에 넣을 loads.
 *
 * 해금 : 스테이지의 `unlocks` 글(«용 「돌등이」» · «스킬 「운석」» · «덱 칸 +1»)을 앞 스테이지부터 모은다.
 * 레벨 : 훈련소(B4) 전이라 «저장된 레벨»과 «그 스테이지 권장 레벨(expLevel)» 중 큰 값으로 나간다 — 결정 D1 (OVERNIGHT_LOG).
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
  let deckCap = 5;
  for (const st of STAGES) {
    if (st.g >= g) break;
    for (const txt of st.unlocks || []) {
      const d = txt.match(/^용 「(.+)」/); if (d) { const id = byName(UNITS, d[1]); if (id) dragons.add(id); }
      const s = txt.match(/^스킬 「(.+)」/); if (s) { const id = byName(SKILLS, s[1]); if (id && !skills.includes(id)) skills.push(id); }
      if (/덱 칸 \+1/.test(txt)) deckCap++;
    }
  }
  return { dragons: DRAGON_ORDER.filter((id) => dragons.has(id)), skills: skills.slice(0, 2), deckCap: Math.min(10, deckCap) };
}

/** 덱 : 칸이 모자라면 싼 방패 둘(꼬물이 · 돌등이) + 가장 최근에 연 용들 */
function pickDeck(dragons, cap) {
  if (dragons.length <= cap) return dragons;
  const keep = dragons.slice(0, 2), rest = dragons.slice(2);
  return keep.concat(rest.slice(rest.length - (cap - 2)));
}

export function makeLoads(stage, save) {
  const un = unlockedBefore(stage.g);
  const lvOf = (id) => Math.max(save?.units?.[id]?.[0] || 1, stage.expLevel || 1);
  const deck = pickDeck(un.dragons, un.deckCap).map((id) => ({ id, lv: lvOf(id) }));
  return {
    deck,
    skills: un.skills,
    loads: [{ side: 0, deck, leader: 'novart', leaderLv: Math.max(1, stage.expLevel || 1), skills: un.skills }],
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
