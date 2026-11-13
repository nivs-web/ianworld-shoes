/**
 * 아이템 샵 칸 4개(드래곤 · 브레스 · 드래곤캐슬 · 장비)가 함께 쓰는 값 · 저장 도우미 (겜보조 2 · 11/13)
 *
 *  ★ 임시 파일 — 숫자는 기획서(iandragon/docs/IDG_DRAGON_CASTLE_PLAN.md §5.1 · 5.2 · 5.5 · 6.1 · 6.2) 표 그대로.
 *    핵심 보조가 data/upgrades.js 를 만들면 이 파일의 표만 그쪽 import 로 바꾸면 된다(칸 파일 4개는 이 파일만 본다).
 *  저장 모양(§11.1) :  lead = { own: [id…], lv: { id: n } } · castle = { lv, skin, gear: { id: n }, slots: [id|null …] } · breathUp = { power, range }
 *  save(part) 는 최상위 키 통째로 덮는다 → 늘 «원래 객체를 펼친 새 객체» 를 넘긴다.
 *  화면 글(UI 문구) · 아이콘 경로도 한 곳(S · ICON)에 모았다.
 */
import { LEADERS } from '../../games/iandragon_game/data/leaders.js';

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
  sells: '아이템 샵에서 팔아요', goShop: '샵 가기', auto: '자동', autoSub: '월드 추천', autoNow: '지금은',
  rangeFoot: '처음엔 60% · 드래곤 레벨과 브레스 색으로도 넓어져요',
};

/* ── 아이콘 : 새 그림이 오기 전 임시(기존 그림). 바꿀 땐 여기 한 곳 ── */
export const ICON = {
  lock: `${AI}lobby/ico_lock.png`,
  castle: `${AI}castles/nest_hp0.webp`,
  gear: { cannon: `${AI}lobby/ico_raid.png`, fence: `${AI}lobby/ico_seal.png`, repair: `${AI}lobby/ico_nest.png`, bell: `${AI}lobby/ico_music.png` },
  face: (id) => `${AI}${id}/head.png`,
};

/* ── §5.1 · 5.2 드래곤 ── */
/** 샵에 나오는 드래곤 8마리 : 월드 w 를 깨면 열림 · 코인 또는 젬 (기본 2마리 노바트 · 아쿠안티스는 늘 가짐) */
export const LEAD_SHOP = {
  forestia: { world: 1, coin: 8000, gem: 40 }, crimsonde: { world: 2, coin: 15000, gem: 70 }, volttail: { world: 3, coin: 25000, gem: 110 },
  solaris: { world: 4, coin: 40000, gem: 160 }, sandscale: { world: 5, coin: 60000, gem: 220 }, shadowfen: { world: 6, coin: 80000, gem: 280 },
  frostwing: { world: 7, coin: 100000, gem: 340 }, goldrex: { world: 8, coin: 150000, gem: 450 },
};
export const LEAD_BASE = ['novart', 'aquantis'];
export const LEAD_ORDER = [...LEAD_BASE, ...Object.keys(LEAD_SHOP)];
export const LEAD_MAX = 10;
/** 드래곤 Lv(n) → Lv(n+1) 값 : 인덱스 = 올라갈 레벨(2 ~ 10) */
export const LEAD_LV_COST = { 2: { coin: 2000 }, 3: { coin: 4000 }, 4: { coin: 7000 }, 5: { coin: 11000 }, 6: { coin: 16000, gem: 10 }, 7: { coin: 23000, gem: 20 }, 8: { coin: 32000, gem: 30 }, 9: { coin: 44000, gem: 40 }, 10: { coin: 60000, gem: 50 } };
export const LEAD_FLAME_PER_LV = 15;   /* 수호 불꽃 피해 +15% / 레벨 */
export const LEAD_AURA_PER_LV = 5;     /* 출전 카드 공격 +5% / 레벨 */
export const LEAD_RANGE_AT = [4, 7, 10];   /* 이 레벨마다 브레스 사거리 +4% */

/* ── §5.5 브레스 ── */
export const BREATH_POWER = {   /* 단계 1 ~ 8 */
  pct: [8, 16, 24, 32, 40, 48, 56, 64],
  coin: [3000, 6000, 10000, 15000, 22000, 30000, 40000, 55000],
  gem: [0, 0, 0, 0, 10, 20, 30, 40],
};
export const BREATH_RANGE = {   /* 단계 1 ~ 5 · 시작 60% · 단계마다 +5% */
  base: 60, pct: [5, 10, 15, 20, 25],
  coin: [3000, 6000, 10000, 15000, 22000],
  gem: [0, 0, 0, 0, 10],
};

/* ── §6.1 드래곤캐슬 10단계 ── */
export const CASTLE_LV = [
  { lv: 1, name: '나무 둥지', world: 0, coin: 0, gem: 0, hp: 0, slots: 0 },
  { lv: 2, name: '돌담 둥지', world: 1, coin: 5000, gem: 10, hp: 10, slots: 1 },
  { lv: 3, name: '망루 캐슬', world: 2, coin: 10000, gem: 20, hp: 20, slots: 1 },
  { lv: 4, name: '돌 캐슬', world: 3, coin: 20000, gem: 30, hp: 35, slots: 1 },
  { lv: 5, name: '쌍탑 캐슬', world: 4, coin: 35000, gem: 50, hp: 50, slots: 2 },
  { lv: 6, name: '드래곤 문장 캐슬', world: 5, coin: 55000, gem: 70, hp: 70, slots: 2 },
  { lv: 7, name: '강철 캐슬', world: 6, coin: 80000, gem: 100, hp: 90, slots: 2 },
  { lv: 8, name: '화산 캐슬', world: 7, coin: 120000, gem: 140, hp: 115, slots: 3 },
  { lv: 9, name: '수정 캐슬', world: 8, coin: 170000, gem: 180, hp: 145, slots: 3 },
  { lv: 10, name: '황금 드래곤캐슬', world: 9, coin: 250000, gem: 250, hp: 180, slots: 3 },
];
export const CASTLE_GUARD_PER_LV = 4;   /* 「캐슬의 가호」 단계마다 출전 카드 체력 +4% */

/* ── §6.2 장비 4종 (Lv1 = 구매) ── */
export const GEAR_MAX = 5;
export const GEAR_COST = [{ coin: 15000, gem: 30 }, { coin: 10000, gem: 10 }, { coin: 20000, gem: 20 }, { coin: 40000, gem: 40 }, { coin: 80000, gem: 80 }];
const f1 = (n) => String(n);
export const GEAR = [
  { id: 'cannon', name: '대포', place: '지붕', line: (lv) => `6초마다 가장 앞선 좀비에게 포탄 · 피해 ${[80, 110, 140, 170, 200][lv - 1]}` },
  { id: 'fence', name: '가시 울타리', place: '드래곤캐슬 문 앞', line: (lv) => `받는 피해 −${[6, 9, 12, 15, 18][lv - 1]}% · 때린 좀비에게 ${[20, 30, 40, 50, 60][lv - 1]}% 되돌림` },
  { id: 'repair', name: '수리 둥지', place: '꼬물이 수리공', line: (lv) => `1초에 드래곤캐슬 체력 ${f1([0.2, 0.3, 0.4, 0.5, 0.6][lv - 1])}% 회복` },
  { id: 'bell', name: '경보 종', place: '종탑', line: (lv) => `체력이 절반 아래가 되면 적 전부를 밀치고 ${f1([2, 2.5, 3, 3.5, 4][lv - 1])}초 얼림${lv === GEAR_MAX ? ' · 25%에서 한 번 더' : ''}` },
];

/* ── 저장값 읽기 (없으면 기본값 · 11.1 옮기기 규칙) ── */
export const worldsCleared = (g) => Math.floor((g?.cleared || 0) / 10);

/** 가진 대장 드래곤 : 저장에 lead.own 이 있으면 그대로 · 없으면 기본 2마리 + 이미 열어 둔 드래곤(결정 1) */
export function leadOwn(g) {
  if (Array.isArray(g?.lead?.own)) return g.lead.own;
  const open = worldsCleared(g);
  return Object.entries(LEADERS).filter(([id, L]) => LEAD_BASE.includes(id) || L.unlock <= open).map(([id]) => id);
}
export const leadLv = (g, id) => Math.max(1, Math.min(LEAD_MAX, Number(g?.lead?.lv?.[id]) || 1));
export const breathUp = (g) => ({ power: Math.max(0, Math.min(BREATH_POWER.pct.length, Number(g?.breathUp?.power) || 0)), range: Math.max(0, Math.min(BREATH_RANGE.pct.length, Number(g?.breathUp?.range) || 0)) });
export const castleOf = (g) => {
  const c = g?.castle || {};
  const lv = Math.max(1, Math.min(CASTLE_LV.length, Number(c.lv) || 1));
  return { lv, skin: Number(c.skin) || lv, gear: { ...(c.gear || {}) }, slots: Array.isArray(c.slots) ? c.slots.slice() : [] };
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
