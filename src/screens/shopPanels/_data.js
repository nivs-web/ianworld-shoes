/**
 * 아이템 샵 칸 4개(드래곤 · 브레스 · 드래곤캐슬 · 장비)와 꾸미기 창이 함께 쓰는 값 · 저장 도우미 (겜보조 2 · 11/13)
 *
 *  숫자는 모두 data/upgrades.js(핵심 보조 ④) 표에서 가져온다 — 여기에는 표를 두지 않고 «화면용 모양»으로만 바꾼다.
 *  저장 모양(IDG_UPGRADES_SPEC §1) : lead = { own, lv, form } · castle = { lv, skin, gear, slots[3] } · breathUp = { pow, rng, old }
 *  save(part) 는 최상위 키 통째로 덮는다 → 늘 «원래 객체를 펼친 새 객체» 를 넘긴다. 필드가 없던 계정에는 처음 쓸 때
 *  옮기기 규칙 값(own · old)을 같이 적는다(안 적으면 저장 정리가 0 으로 읽어 덤을 잃는다).
 *  화면 글(UI 문구) · 아이콘 경로도 한 곳(S · ICON)에 모았다.
 */
import { LEADERS } from '../../games/iandragon_game/data/leaders.js';
import * as U from '../../games/iandragon_game/data/upgrades.js';

export const AI = '/assets/iandragon_game/ai/';

/* ── 글 (낱말 규칙 : «드래곤» «드래곤캐슬» 만 · «비용» 대신 «불씨» · 재화는 아이콘 + 숫자라 글자 없음) ── */
export const S = {
  lockWorld: (w) => `월드 ${w} 을 깨면 열려요`,
  lockPrev: (n) => `${n}단계를 먼저 올리세요`,
  owned: '가졌어요', maxed: '최고 단계', buy: '사기', up: '올리기', lvUp: '레벨업', enhance: '강화', max: '최고',
  poor: '모자라요', done: '샀어요', bought: '레벨이 올랐어요',
  leadNote: '가진 드래곤은 레벨을 올려요. 대장으로 세운 드래곤이 힘을 써요.',
  leadNote2: '못 산 드래곤은 월드를 깰 때마다 하나씩 열려요.',
  breathNote: '브레스는 가진 모든 드래곤이 함께 써요.',
  castleNote: '드래곤캐슬은 한 단계씩 차례로 올려요. 코인과 젬이 둘 다 들어요.',
  gearNote: (n) => `지금 끼울 수 있는 칸 ${n}개 · 끼우는 건 꾸미기 창에서 해요.`,
  gearGo: '꾸미기에서 끼우기',
  statFlame: '불꽃', statAura: '기운', statHp: '체력', statGuard: '가호',
  power: '브레스 힘', range: '브레스 사거리', step: '단계', next: '다음', start: '처음',
  lead: '대장', curCastle: '내 드래곤캐슬', slots: (n) => `장비 칸 ${n}`,
  gearLv: (n) => (n ? `Lv ${n}` : '아직 없어요'),
  reco: '추천 강화', sells: '아이템 샵에서 팔아요', goShop: '샵 가기', auto: '자동', autoSub: '월드 추천', autoNow: '지금은',
  form: '모습', formBase: '기본 모습',
  rangeFoot: '처음엔 60% · 드래곤 레벨과 브레스 색으로도 넓어져요',
};

/* ── 아이콘 : 새 그림이 오기 전 임시(기존 그림). 바꿀 땐 여기 한 곳 ── */
export const ICON = {
  lock: `${AI}lobby/ico_lock.png`,
  castle: `${AI}castles/nest_hp0.webp`,
  gear: { cannon: `${AI}lobby/ico_raid.png`, fence: `${AI}lobby/ico_seal.png`, repair: `${AI}lobby/ico_nest.png`, bell: `${AI}lobby/ico_music.png` },
  face: (id) => `${AI}${id}/head.png`,
};

/* ── 드래곤 (upgrades.js LEAD_SHOP · LEAD_LV) ── */
/** 샵에 나오는 드래곤 : 월드 w 를 깨면 열림 · 코인 또는 젬 (기본 2마리는 늘 가짐) */
export const LEAD_SHOP = Object.fromEntries(U.LEAD_SHOP.map((x) => [x.id, { world: x.world, coin: x.coin, gem: x.gem }]));
export const LEAD_BASE = U.LEAD_START;
export const LEAD_ORDER = [...LEAD_BASE, ...Object.keys(LEAD_SHOP)];
export const LEAD_MAX = U.LEAD_LV.max;
/** 드래곤 Lv(lv) → Lv(lv+1) 값 (없으면 null) */
export const leadUpCost = (lv) => { const c = U.leadLvCost(lv); return c ? { coin: c.coin, gem: c.gem } : null; };
export const LEAD_FLAME_PER_LV = Math.round(U.LEAD_LV.guard * 100);   /* 수호 불꽃 피해 +% / 레벨 */
export const LEAD_AURA_PER_LV = Math.round(U.LEAD_LV.aura * 100);     /* 출전 카드 공격 +% / 레벨 */
export const LEAD_RANGE_AT = U.LEAD_LV.rangeAt;                       /* 이 레벨마다 브레스 사거리 + */

/* ── 브레스 (upgrades.js BREATH_UP · 단계 k 의 값 = [k-1]) ── */
const stepPct = (T) => Array.from({ length: T.max }, (_, i) => Math.round(T.step * 100 * (i + 1)));
export const BREATH_POWER = { pct: stepPct(U.BREATH_UP.pow), coin: U.BREATH_UP.pow.coin, gem: U.BREATH_UP.pow.gem };
export const BREATH_RANGE = { base: Math.round(U.BREATH_UP.rng.base * 100), pct: stepPct(U.BREATH_UP.rng), coin: U.BREATH_UP.rng.coin, gem: U.BREATH_UP.rng.gem };

/* ── 드래곤캐슬 10단계 (hp = 체력 + % 로 바꿔 둠) ── */
export const CASTLE_LV = U.CASTLE_LV.map((c) => ({ lv: c.lv, name: c.name, world: c.world, coin: c.coin, gem: c.gem, hp: Math.round(c.hp * 100), slots: c.slots }));
export const CASTLE_GUARD_PER_LV = Math.round(U.CASTLE_AURA * 100);   /* 「캐슬의 가호」 단계마다 출전 카드 체력 +% */

/* ── 장비 4종 (Lv1 = 구매) — 자리 이름 · 효과 글은 화면 규칙(«성» 글자 없음)에 맞춰 여기서 만든다 ── */
export const GEAR_MAX = 5;
export const GEAR_COST = Array.from({ length: GEAR_MAX }, (_, i) => { const c = U.gearCost(i + 1); return { coin: c.coin, gem: c.gem }; });
const pc = (v) => `${Math.round(v * 1000) / 10}`;
export const GEAR = [
  { id: 'cannon', name: U.GEAR.cannon.name, place: '지붕', line: (lv) => `${U.GEAR.cannon.every}초마다 가장 앞선 좀비에게 포탄 · 피해 ${U.GEAR.cannon.dmg[lv - 1]}` },
  { id: 'fence', name: U.GEAR.fence.name, place: '드래곤캐슬 문 앞', line: (lv) => `받는 피해 −${pc(U.GEAR.fence.cut[lv - 1])}% · 때린 좀비에게 ${pc(U.GEAR.fence.thorns[lv - 1])}% 되돌림` },
  { id: 'repair', name: U.GEAR.repair.name, place: '꼬물이 수리공', line: (lv) => `1초에 드래곤캐슬 체력 ${pc(U.GEAR.repair.regen[lv - 1])}% 회복` },
  { id: 'bell', name: U.GEAR.bell.name, place: '종탑', line: (lv) => `체력이 절반 아래가 되면 적 전부를 밀치고 ${U.GEAR.bell.freeze[lv - 1]}초 얼림${lv === GEAR_MAX ? ' · 25%에서 한 번 더' : ''}` },
];

/* ── 저장값 읽기 (없으면 기본값 · IDG_UPGRADES_SPEC §2 옮기기 규칙) ── */
export const worldsCleared = (g) => Math.floor((g?.cleared || 0) / 10);

/** 가진 대장 드래곤 (lead.own 이 없으면 옮기기 규칙과 같은 값) */
export const leadOwn = (g) => U.ownedLeads(g);
export const leadLv = (g, id) => U.leadLvOf(g, id);
/** lead 묶음 통째(쓰기용) — own 은 늘 채워서 적는다 */
export const leadSave = (g) => ({ own: leadOwn(g), lv: { ...(g?.lead?.lv || {}) }, form: { ...(g?.lead?.form || {}) } });
/** 브레스 강화 { pow, rng, old } — old 는 필드가 없는 계정만 «깬 월드 수»로 한 번 정한다 */
export const breathUp = (g) => {
  const b = g?.breathUp;
  return { pow: Math.max(0, Math.min(U.BREATH_UP.pow.max, Number(b?.pow) || 0)), rng: Math.max(0, Math.min(U.BREATH_UP.rng.max, Number(b?.rng) || 0)),
    old: b && typeof b === 'object' ? Math.max(0, Math.min(8, Number(b.old) || 0)) : Math.min(8, worldsCleared(g)) };
};
/** castle 묶음 { lv, skin, gear, slots[3] } */
export const castleOf = (g) => {
  const c = g?.castle || {};
  const lv = Math.max(1, Math.min(CASTLE_LV.length, Number(c.lv) || 1));
  const sl = Array.isArray(c.slots) ? c.slots : [];
  return { lv, skin: Math.max(1, Math.min(lv, Number(c.skin) || lv)), gear: { ...(c.gear || {}) }, slots: [0, 1, 2].map((i) => (typeof sl[i] === 'string' && sl[i] ? sl[i] : null)) };
};
export const gearLv = (g, id) => Math.max(0, Math.min(GEAR_MAX, Number(castleOf(g).gear[id]) || 0));

/* ── 사기 · 값 도우미 ── */
export const canPay = (g, cost) => (g?.coins || 0) >= (cost.coin || 0) && (g?.gems || 0) >= (cost.gem || 0);
export const pay = (g, cost) => ({ coins: (g?.coins || 0) - (cost.coin || 0), gems: (g?.gems || 0) - (cost.gem || 0) });

/**
 * 저장 한 번 : save(part) 는 새 저장값을 돌려준다(없으면 undefined) → ctx.g 를 바꿔 두어 다음 읽기가 최신이 되게 한다.
 * @returns {boolean} 저장했는가
 */
export function commit(ctx, part) {
  const next = ctx.save(part);
  if (next && typeof next === 'object') { try { ctx.g = next; } catch { /* g 가 읽기 전용이면 refresh 가 새로 준다 */ } }
  return true;
}

/* ── 키우기 한 걸음 (패널 · «추천 강화» 카드가 함께 쓴다) : 저장할 part 와 값을 돌려준다. 못 하면 null ── */
export function stepOf(g, kind, id) {
  if (kind === 'rng' || kind === 'pow') {
    const up = breathUp(g), n = up[kind], T = kind === 'pow' ? BREATH_POWER : BREATH_RANGE;
    if (n >= T.pct.length) return null;
    return { cost: { coin: T.coin[n], gem: T.gem[n] }, part: { breathUp: { ...up, [kind]: n + 1 } } };
  }
  if (kind === 'castle') {
    const c = castleOf(g), def = CASTLE_LV[c.lv];
    if (!def || worldsCleared(g) < def.world) return null;
    return { cost: { coin: def.coin, gem: def.gem }, part: { castle: { ...c, lv: def.lv, skin: def.lv } } };
  }
  if (kind === 'lead') {
    const lv = leadLv(g, id), cost = leadUpCost(lv);
    if (!cost) return null;
    const L = leadSave(g);
    return { cost, part: { lead: { ...L, lv: { ...L.lv, [id]: lv + 1 } } } };
  }
  if (kind === 'gear') {
    const lv = gearLv(g, id);
    if (lv >= GEAR_MAX) return null;
    const c = castleOf(g);
    return { cost: GEAR_COST[lv], part: { castle: { ...c, gear: { ...c.gear, [id]: lv + 1 } } } };
  }
  return null;
}
