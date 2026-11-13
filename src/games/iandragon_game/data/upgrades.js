/**
 * 좀비와 드래곤 — 드래곤 · 드래곤캐슬 키우기 숫자 (IDG_DRAGON_CASTLE_PLAN §5 · §6 · §11 · 2026-11-13 핵심 보조 ④)
 *
 * 순수 데이터 + 계산 함수뿐 (화면 · 저장 모름) — 전투 준비(battleSetup)가 판 시작 때 `upgradeLoad` 를 **한 번** 부른다.
 * 값은 기획서 표 그대로 (바꾸고 싶으면 표만 고친다). 이름은 «드래곤» · «드래곤캐슬».
 *
 * 저장 필드 (IDG_UPGRADES_SPEC.md §1) :
 *   lead     { own: ['novart','aquantis',…], lv: { novart: 3 }, form: { novart: 'red' } }
 *   castle   { lv: 1~10, skin: 1~10, gear: { cannon: 2, … }, slots: ['cannon', null, null] }
 *   breathUp { pow: 0~8, rng: 0~5, old: 0~8 }   // old = 업데이트 전에 깬 월드 수 덤 (한 번 정해지면 그대로)
 *   leader   'auto' | 드래곤 id (지금 필드 그대로)
 */
import { LEADERS } from './leaders.js';
import { lookBonus } from './lookFx.js';

/* ───────── 대장 드래곤 사기 (§5.1) ───────── */
/** 처음부터 가진 대장 드래곤 */
export const LEAD_START = ['novart', 'aquantis'];
/** 월드 world 를 깨면 샵에 나온다 — 코인 또는 젬 하나로 산다 */
export const LEAD_SHOP = [
  { id: 'forestia', world: 1, coin: 8000, gem: 40 },
  { id: 'crimsonde', world: 2, coin: 15000, gem: 70 },
  { id: 'volttail', world: 3, coin: 25000, gem: 110 },
  { id: 'solaris', world: 4, coin: 40000, gem: 160 },
  { id: 'sandscale', world: 5, coin: 60000, gem: 220 },
  { id: 'shadowfen', world: 6, coin: 80000, gem: 280 },
  { id: 'frostwing', world: 7, coin: 100000, gem: 340 },
  { id: 'goldrex', world: 8, coin: 150000, gem: 450 },
];
/** 월드 9 · 10 자리 — 새 드래곤 2마리는 2차(12장 결정 2). 그때까지 샵에 안 나온다 */
export const LEAD_SHOP_LATER = [{ id: null, world: 9, coin: 200000, gem: 600 }, { id: null, world: 10, coin: 200000, gem: 600 }];
export const leadShopOf = (id) => LEAD_SHOP.find((x) => x.id === id) || null;
/** 업데이트 전 계정 : 지금 열린 대장 드래곤(LEADERS.unlock ≤ 깬 월드 수)은 그대로 가진 것으로 (12장 결정 1) */
export const leadOwnFrom = (cleared) => {
  const open = Math.floor((Number(cleared) || 0) / 10);
  return [...new Set([...LEAD_START, ...Object.keys(LEADERS).filter((id) => LEADERS[id].unlock <= open)])];
};

/* ───────── 드래곤 레벨 Lv1 ~ 10 (§5.2) ───────── */
/** cost[n] = Lv n → n+1 값 (n = 1 ~ 9) */
export const LEAD_LV = {
  max: 10,
  coin: [0, 2000, 4000, 7000, 11000, 16000, 23000, 32000, 44000, 60000],
  gem: [0, 0, 0, 0, 0, 10, 20, 30, 40, 50],
  guard: 0.15,              // 수호 불꽃 피해 +15% / 레벨
  aura: 0.05,               // 「드래곤의 기운」 출전 카드 전체 공격 +5% / 레벨
  rangeAt: [4, 7, 10],      // 이 레벨이 될 때마다 그 드래곤 브레스 사거리 +4%
  rangeStep: 0.04,
};
export const leadLvCost = (lv) => (lv >= 1 && lv < LEAD_LV.max ? { coin: LEAD_LV.coin[lv], gem: LEAD_LV.gem[lv] } : null);

/* ───────── 수호 불꽃 (§5.3) ───────── */
export const GUARD = { dmg: 45, every: 2.5, range: 450, splash: 60 };

/* ───────── 브레스 힘 8단계 · 사거리 5단계 (§5.5) ───────── */
export const BREATH_UP = {
  pow: { max: 8, step: 0.08, coin: [3000, 6000, 10000, 15000, 22000, 30000, 40000, 55000], gem: [0, 0, 0, 0, 10, 20, 30, 40] },   // 단계 k(1~8) 값 = [k-1]
  rng: { max: 5, base: 0.6, step: 0.05, coin: [3000, 6000, 10000, 15000, 22000], gem: [0, 0, 0, 0, 10] },
  colorAdd: 0.05,     // 기본이 아닌 브레스 색을 입음 (lookFx BREATH_COLOR_RANGE)
  oldStep: 0.05,      // 업데이트 전에 깬 월드 하나마다 (최대 8)
  cap: 1,             // 100% 를 넘지 않는다
  bossCap: 0.6,       // 브레스 한 번이 보스에게 주는 피해 ≤ 보스 최대 체력 × 0.6
};
export const breathUpCost = (kind, k) => { const t = BREATH_UP[kind]; return t && k >= 1 && k <= t.max ? { coin: t.coin[k - 1], gem: t.gem[k - 1] } : null; };

/* ───────── 드래곤캐슬 10단계 (§6.1 · 이름 = 그림 지시서 §1.2) ───────── */
/** hp = 드래곤캐슬 체력 + (비율) · slots = 장비 칸 · world = 이 월드를 깨면 살 수 있다 (차례대로만) */
export const CASTLE_LV = [
  { lv: 1, name: '둥지 탑', world: 0, coin: 0, gem: 0, hp: 0, slots: 0 },
  { lv: 2, name: '돌담 둥지', world: 1, coin: 5000, gem: 10, hp: 0.10, slots: 1 },
  { lv: 3, name: '망루 캐슬', world: 2, coin: 10000, gem: 20, hp: 0.20, slots: 1 },
  { lv: 4, name: '성벽 캐슬', world: 3, coin: 20000, gem: 30, hp: 0.35, slots: 1 },
  { lv: 5, name: '쌍탑 캐슬', world: 4, coin: 35000, gem: 50, hp: 0.50, slots: 2 },
  { lv: 6, name: '드래곤 문장 캐슬', world: 5, coin: 55000, gem: 70, hp: 0.70, slots: 2 },
  { lv: 7, name: '강철 캐슬', world: 6, coin: 80000, gem: 100, hp: 0.90, slots: 2 },
  { lv: 8, name: '화산 캐슬', world: 7, coin: 120000, gem: 140, hp: 1.15, slots: 3 },
  { lv: 9, name: '수정 캐슬', world: 8, coin: 170000, gem: 180, hp: 1.45, slots: 3 },
  { lv: 10, name: '황금 드래곤 캐슬', world: 9, coin: 250000, gem: 250, hp: 1.80, slots: 3 },
];
/** 「캐슬의 가호」 — 단계마다 출전 카드 전체 체력 +4% (2단계 +4% … 10단계 +36%) */
export const CASTLE_AURA = 0.04;
export const castleOf = (lv) => CASTLE_LV[Math.max(1, Math.min(10, Number(lv) || 1)) - 1];

/* ───────── 드래곤캐슬 장비 4종 Lv1 ~ 5 (§6.2) ───────── */
export const GEAR_IDS = ['cannon', 'fence', 'repair', 'bell'];
export const GEAR = {
  cannon: { name: '대포', at: '지붕', every: 6, splash: 80, kb: 0.3, dmg: [80, 110, 140, 170, 200] },
  fence: { name: '가시 울타리', at: '성문 앞', cut: [0.06, 0.09, 0.12, 0.15, 0.18], thorns: [0.2, 0.3, 0.4, 0.5, 0.6] },
  repair: { name: '수리 둥지', at: '캐슬 왼쪽 아래', regen: [0.002, 0.003, 0.004, 0.005, 0.006] },   // 1초에 최대 체력의 비율
  bell: { name: '경보 종', at: '종탑', freeze: [2, 2.5, 3, 3.5, 4], at1: 0.5, at2: 0.25 },          // 50% 아래로 처음 → 한 번 · Lv5 는 25% 에서 한 번 더
};
/** cost[k] = Lv k 로 (k = 1 은 구매) */
export const GEAR_COST = { coin: [15000, 10000, 20000, 40000, 80000], gem: [30, 10, 20, 40, 80] };
export const gearCost = (k) => (k >= 1 && k <= 5 ? { coin: GEAR_COST.coin[k - 1], gem: GEAR_COST.gem[k - 1] } : null);

/* ───────── 합계 (샵 · 계산기 참고) ───────── */
const sum = (a) => a.reduce((x, y) => x + y, 0);
export const TOTALS = {
  castle: { coin: sum(CASTLE_LV.map((c) => c.coin)), gem: sum(CASTLE_LV.map((c) => c.gem)) },          // 745,000 · 850
  gearOne: { coin: sum(GEAR_COST.coin), gem: sum(GEAR_COST.gem) },                                       // 165,000 · 180
  leadLv: { coin: sum(LEAD_LV.coin), gem: sum(LEAD_LV.gem) },                                            // 199,000 · 150
  breath: { coin: sum(BREATH_UP.pow.coin) + sum(BREATH_UP.rng.coin), gem: sum(BREATH_UP.pow.gem) + sum(BREATH_UP.rng.gem) },   // 237,000 · 110
  leads: { coin: sum(LEAD_SHOP.map((x) => x.coin)), gem: sum(LEAD_SHOP.map((x) => x.gem)) },               // 478,000 · 1,670
};

/* ───────── 권장 키우기 (샵 맨 위 «추천 강화» 카드 · 계산기 · 돈 맞춤이 같은 표를 쓴다) ───────── */
const st = (castle, lead, gn, gl, pow, rng) => ({ castle, lead, gear: [gn, gl], pow, rng });
/** 보통 — 월드 w 를 깬 뒤(= 월드 w+1 앞) 갖출 것 (제안 · §5.5 «사거리는 월드마다 1단계» → 계산기 92.2% · 끝은 어려움 1 권장) */
export const REC_NORMAL = [null,
  st(1, 1, 0, 0, 0, 1), st(1, 1, 0, 0, 0, 2), st(1, 1, 0, 0, 0, 3), st(2, 1, 0, 0, 0, 4), st(2, 2, 0, 0, 0, 5),
  st(2, 2, 0, 0, 0, 5), st(3, 2, 0, 0, 0, 5), st(3, 3, 0, 0, 0, 5), st(3, 3, 1, 1, 0, 5), st(3, 3, 1, 1, 0, 5)];
/** 어려움 — 월드 w 에 들어가기 전에 (§8.3 표 · 브레스 힘 = w−2 · 사거리 = 5) */
export const REC_HARD = [null,
  st(3, 3, 1, 1, 0, 5), st(4, 4, 1, 2, 0, 5), st(5, 5, 2, 2, 1, 5), st(6, 6, 2, 2, 2, 5), st(7, 7, 2, 3, 3, 5),
  st(7, 8, 2, 3, 4, 5), st(8, 8, 3, 3, 5, 5), st(9, 9, 3, 4, 6, 5), st(9, 10, 3, 4, 7, 5), st(10, 10, 3, 5, 8, 5)];
/** 어떤 상태(위 표 한 줄)까지의 누적 값 (드래곤 1마리만 키울 때) */
export function recCost(s) {
  let coin = 0, gem = 0;
  for (let i = 1; i < s.castle; i++) { coin += CASTLE_LV[i].coin; gem += CASTLE_LV[i].gem; }
  for (let n = 1; n < s.lead; n++) { coin += LEAD_LV.coin[n]; gem += LEAD_LV.gem[n]; }
  for (let k = 0; k < s.gear[1]; k++) { coin += GEAR_COST.coin[k] * s.gear[0]; gem += GEAR_COST.gem[k] * s.gear[0]; }
  for (let k = 0; k < s.pow; k++) { coin += BREATH_UP.pow.coin[k]; gem += BREATH_UP.pow.gem[k]; }
  for (let k = 0; k < s.rng; k++) { coin += BREATH_UP.rng.coin[k]; gem += BREATH_UP.rng.gem[k]; }
  return { coin, gem };
}

/* ───────── 저장값 읽기 (모양이 어떻든 안전하게) ───────── */
const int = (v, lo, hi) => { const n = Math.round(Number(v) || 0); return n < lo ? lo : n > hi ? hi : n; };
/** 가진 대장 드래곤 (저장에 lead.own 이 없으면 옮기기 규칙과 같은 값) */
export const ownedLeads = (save) => {
  const own = Array.isArray(save?.lead?.own) ? save.lead.own.filter((id) => LEADERS[id]) : leadOwnFrom(save?.cleared);
  return [...new Set([...LEAD_START, ...own])];
};
export const leadLvOf = (save, id) => int(save?.lead?.lv?.[id] ?? 1, 1, LEAD_LV.max);
/** 이번 판 대장 드래곤 — 고른 것을 가졌으면 그것, 아니면 추천(want)을 가졌으면 그것, 아니면 가진 것 중 맨 앞 */
export const resolveLeader = (save, want) => {
  const own = ownedLeads(save), pick = save?.leader;
  if (pick && pick !== 'auto' && own.includes(pick)) return pick;
  return want && own.includes(want) ? want : own[0];
};
/** 끼운 장비 — 가진 것만 · 겹침 없이 · 캐슬 단계의 칸 수까지 */
export function equippedGear(save) {
  const lv = int(save?.castle?.lv ?? 1, 1, 10), n = castleOf(lv).slots, gear = save?.castle?.gear || {}, out = [];
  for (const id of Array.isArray(save?.castle?.slots) ? save.castle.slots : []) {
    if (out.length >= n) break;
    const g = int(gear[id], 0, 5);
    if (GEAR[id] && g >= 1 && !out.some((x) => x.id === id)) out.push({ id, lv: g });
  }
  return out;
}
/** 브레스 사거리 비율 (0.6 ~ 1) — 꾸미기 덤(lookAdd)은 lookBonus().breathRange */
export function breathRangeOf(save, leaderId, lookAdd = 0) {
  const b = save?.breathUp || {}, lv = leadLvOf(save, leaderId), R = BREATH_UP.rng;
  const marks = LEAD_LV.rangeAt.filter((x) => lv >= x).length;
  const v = R.base + R.step * int(b.rng, 0, R.max) + LEAD_LV.rangeStep * marks + lookAdd + BREATH_UP.oldStep * int(b.old, 0, 8);
  return Math.min(BREATH_UP.cap, Math.round(v * 1000) / 1000);
}

/**
 * «추천 강화» 한 장 — 지금 진행에서 권장표에 모자란 것 중 맨 앞 하나 (사거리 → 캐슬 → 드래곤 레벨 → 장비 → 브레스 힘 순서).
 * 돌려줌 { kind: 'rng'|'pow'|'castle'|'lead'|'gear', to: 다음 단계, id?(gear · lead), cost: {coin, gem} } | null(다 갖춤)
 * 살 수 없는 것(캐슬 단계의 월드 조건 · 장비 칸 없음)은 건너뛴다.
 */
export function recommendNext(save, leaderId) {
  const cleared = Number(save?.cleared) || 0, worlds = Math.floor(cleared / 10);
  let hw = 0; const hs = typeof save?.hardStars === 'string' ? save.hardStars : '';
  while (hw < 100 && Number(hs[hw]) > 0) hw++;
  const want = cleared >= 100 ? REC_HARD[Math.min(10, Math.floor(hw / 10) + 1)] : worlds >= 1 ? REC_NORMAL[worlds] : null;
  if (!want) return null;
  const b = save?.breathUp || {}, lead = resolveLeader(save, leaderId), lv = leadLvOf(save, lead), cl = int(save?.castle?.lv ?? 1, 1, 10), gear = save?.castle?.gear || {};
  const rng = int(b.rng, 0, 5), pow = int(b.pow, 0, 8);
  if (rng < want.rng) return { kind: 'rng', to: rng + 1, cost: breathUpCost('rng', rng + 1) };
  if (cl < want.castle && worlds >= CASTLE_LV[cl].world) return { kind: 'castle', to: cl + 1, cost: { coin: CASTLE_LV[cl].coin, gem: CASTLE_LV[cl].gem } };
  if (lv < want.lead) return { kind: 'lead', id: lead, to: lv + 1, cost: leadLvCost(lv) };
  const [gn, gl] = want.gear, have = GEAR_IDS.map((id) => [id, int(gear[id], 0, 5)]).sort((x, y) => y[1] - x[1]);
  for (let i = 0; i < Math.min(gn, castleOf(cl).slots); i++) {
    const [id, n] = have[i];
    if (n < gl) return { kind: 'gear', id, to: n + 1, cost: gearCost(n + 1) };
  }
  if (pow < want.pow) return { kind: 'pow', to: pow + 1, cost: breathUpCost('pow', pow + 1) };
  return null;
}

/** 대결 · 주간 습격 : 모두 같은 조건 (§9) — 수호 불꽃 기본 · 장비 없음 · 배율 1 · 브레스 사거리 지금 그대로(100%) */
const FLAT = Object.freeze({
  leader: null, leadLv: 1, castleLv: 1, guard: { ...GUARD, slow: 0, vs: 0 }, gear: [],
  atk: 1, hp: 1, baseHp: 1, guardDmg: 1, breathDmg: 1, breathCharge: 1, breathRange: 1, bossCap: BREATH_UP.bossCap,
  baseArmor: 1, thorns: 0, baseRegen: 0, cannon: null, bell: null, bounty: 1,
});

/**
 * 판 시작 숫자 — 저장값에서 전투에 넘길 배율을 **한 번** 만든다.
 * opt = { diff: 'easy'|'normal'|'hard'|'master', mode: 'stage'|'coop'|'pvp'|'raid', leader: 이번 판 대장 드래곤 id(없으면 resolveLeader) }
 * 돌려줌 :
 *   leader · leadLv · castleLv · gear[{id,lv}] · guard{dmg,every,range,splash,slow,vs}
 *   atk(출전 카드 공격 ×) · hp(출전 카드 체력 ×) · baseHp(드래곤캐슬 체력 ×) · guardDmg · breathDmg · breathCharge(빠르기 ×) · breathRange(0.6~1) · bossCap
 *   baseArmor(받는 피해 ×) · thorns(되돌림 비율) · baseRegen(초당 최대 체력 비율) · cannon{dmg,every,splash,kb}|null · bell{freeze,at:[0.5(,0.25)]}|null · bounty(불로 잡은 불씨 ×)
 * 전투 쪽 사용 : bonus.atk *= atk · bonus.hp *= hp · bonus.baseHp *= baseHp · bonus.breathDmg *= breathDmg · bonus.breathCharge *= breathCharge (§11.3 · 11.4)
 */
export function upgradeLoad(save, opt = {}) {
  const mode = opt.mode || 'stage';
  if (mode === 'pvp' || mode === 'raid') return { ...FLAT, guard: { ...FLAT.guard }, gear: [] };
  const diff = opt.diff || save?.diff || 'normal';
  const L = lookBonus(save, diff);
  const leader = opt.leader && ownedLeads(save).includes(opt.leader) ? opt.leader : resolveLeader(save, opt.leader);
  const leadLv = leadLvOf(save, leader), castleLv = int(save?.castle?.lv ?? 1, 1, 10);
  const gear = equippedGear(save), G = Object.fromEntries(gear.map((x) => [x.id, x.lv]));
  const pow = int(save?.breathUp?.pow, 0, BREATH_UP.pow.max);
  return {
    leader, leadLv, castleLv, gear,
    guard: { ...GUARD, slow: L.slow, vs: L.vs },
    atk: 1 + LEAD_LV.aura * (leadLv - 1),
    hp: 1 + CASTLE_AURA * (castleLv - 1),
    baseHp: (1 + castleOf(castleLv).hp) * L.baseHp,
    guardDmg: (1 + LEAD_LV.guard * (leadLv - 1)) * L.guard,
    breathDmg: (1 + BREATH_UP.pow.step * pow) * L.breathDmg,
    breathCharge: L.charge,
    breathRange: breathRangeOf(save, leader, L.breathRange),
    bossCap: BREATH_UP.bossCap,
    baseArmor: G.fence ? 1 - GEAR.fence.cut[G.fence - 1] : 1,
    thorns: G.fence ? GEAR.fence.thorns[G.fence - 1] : 0,
    baseRegen: G.repair ? GEAR.repair.regen[G.repair - 1] : 0,
    cannon: G.cannon ? { dmg: GEAR.cannon.dmg[G.cannon - 1], every: GEAR.cannon.every, splash: GEAR.cannon.splash, kb: GEAR.cannon.kb } : null,
    bell: G.bell ? { freeze: GEAR.bell.freeze[G.bell - 1], at: G.bell >= 5 ? [GEAR.bell.at1, GEAR.bell.at2] : [GEAR.bell.at1] } : null,
    bounty: L.bounty,
  };
}
