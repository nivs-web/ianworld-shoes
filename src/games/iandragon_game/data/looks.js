/**
 * 좀비와 드래곤 — 꾸미기 · 용 시장 데이터 (META 기획서 2 · 3장 · 2026-11-11)
 * 원칙 : 꾸미기는 능력치에 영향 없음 · 현금 없음 · 정가 판매만(뽑기 없음) · 편의품은 판마다 1개 · 혼자 하기만.
 * 이 파일은 순수 데이터 + 계산 함수뿐 (화면 · 저장 모름) — 전투 코어가 불러도 안전하다.
 */

/** 칸 이름 (저장 글자 순서 · 화면 순서) */
export const SLOTS = ['hat', 'neck', 'breath', 'flag', 'frame', 'title'];
export const SLOT_NAME = { hat: '모자', neck: '목 장식', breath: '브레스 색', flag: '성 깃발', frame: '테두리', title: '칭호' };
/** 저장 글자의 칸 머리글 (h3.n1.b2.f4.r0.t7) */
const LETTER = { hat: 'h', neck: 'n', breath: 'b', flag: 'f', frame: 'r', title: 't' };
const SLOT_OF = Object.fromEntries(Object.entries(LETTER).map(([s, l]) => [l, s]));

/**
 * 아이템 표 — price 가 코인, gem:true 면 같은 숫자가 젬. price 가 없으면 상점에서 안 판다
 * (테두리 = 명예의 전당 보상 · 칭호 = TITLES 로 따로 · 브레스 basic = 기본으로 늘 가짐).
 * 순서가 곧 저장 번호(순서+1)이므로 **새 아이템은 맨 뒤에만 추가**한다 (중간에 끼우면 남의 꾸미기가 바뀐다).
 * 그림 : public/assets/iandragon_game/ai/meta/<slot>_<id>.png (칭호는 badge_<id>.png)
 */
export const LOOKS = {
  hat: [
    { id: 'crown', name: '왕관', price: 150, gem: true },
    { id: 'pirate', name: '해적 모자', price: 8000 },
    { id: 'wizard', name: '마법사 고깔', price: 12000 },
    { id: 'pumpkin', name: '호박 모자', price: 3000 },
    { id: 'helmet', name: '헬멧', price: 6000 },
    { id: 'ribbon', name: '리본', price: 3000 },
    { id: 'party', name: '파티 고깔', price: 4000 },
    { id: 'viking', name: '바이킹 투구', price: 10000 },
  ],
  neck: [
    { id: 'cape', name: '망토', price: 8000 },
    { id: 'scarf', name: '목도리', price: 3000 },
    { id: 'medal', name: '메달', price: 10000 },
    { id: 'skull', name: '해골 목걸이', price: 80, gem: true },
    { id: 'bow', name: '나비 리본', price: 3000 },
    { id: 'bell', name: '방울', price: 4000 },
  ],
  breath: [
    { id: 'basic', name: '기본 불꽃', price: 0 },       // 늘 가짐 (판매 X)
    { id: 'rainbow', name: '무지개 브레스', price: 15000 },
    { id: 'ghost', name: '보라 유령불', price: 12000 },
    { id: 'gold', name: '황금 브레스', price: 200, gem: true },
    { id: 'ice', name: '얼음 파랑', price: 10000 },
  ],
  flag: [
    { id: 'fire', name: '불꽃 깃발', price: 6000 },
    { id: 'moon', name: '달 깃발', price: 4000 },
    { id: 'skull', name: '해골 깃발', price: 50, gem: true },
    { id: 'star', name: '별 깃발', price: 4000 },
    { id: 'heart', name: '하트 깃발', price: 3000 },
    { id: 'leaf', name: '나뭇잎 깃발', price: 3000 },
    { id: 'wave', name: '물결 깃발', price: 5000 },
    { id: 'bolt', name: '번개 깃발', price: 5000 },
  ],
  frame: [   // 명예의 전당 시즌 보상 — 상점 판매 X (price 없음)
    { id: 'wood', name: '나무 테두리' },
    { id: 'silver', name: '은 테두리' },
    { id: 'gold', name: '금 테두리' },
    { id: 'fire', name: '불꽃 테두리' },
  ],
  title: [],   // 아래 TITLES 로 채운다 (퀘스트 보상 — 상점 판매 X)
};

/**
 * 브레스 색 → 전투 브레스 입자 색(0xRRGGBB 여러 개 · 입자마다 하나씩 돌려 쓴다). null = 원래 색 그대로.
 * 피해량 · 범위는 그대로다 (순수 꾸미기).
 */
export const BREATH_COLORS = {
  basic: null,
  rainbow: [0xff4d4d, 0xffa94d, 0xffe14d, 0x6bdc6b, 0x4da6ff, 0xa56bff],
  ghost: [0xc08bff, 0x8a5cff, 0xe0c8ff, 0x5a3aa0],
  gold: [0xffd84a, 0xffc93c, 0xfff1a0, 0xe0a020],
  ice: [0x9fe0ff, 0x6fb7ff, 0xe6f8ff, 0x4aa0e0],
};

/* ───────── 칭호 12개 (퀘스트 · 기록으로만 얻음) — has(g) : g = idg 저장값 ───────── */
const sumStars = (s) => [...(typeof s === 'string' ? s : '')].reduce((a, c) => a + (Number(c) || 0), 0);
const st = (g, k) => Number(g?.stat?.[k]) || 0;
export const TITLES = [
  { id: 'zombie_hunter', name: '좀비 사냥꾼', how: '좀비 1,000마리 쓰러뜨리기', has: (g) => st(g, 'kills') >= 1000 },
  { id: 'star_collector', name: '별 수집가', how: '별 100개 모으기', has: (g) => sumStars(g?.stars) >= 100 },
  { id: 'hundred_dragon', name: '백 판의 용', how: '스테이지 100개 모두 깨기', has: (g) => (g?.cleared || 0) >= 100 },
  { id: 'hard_conqueror', name: '어려움 정복자', how: '어려움 붉은 별 50판 이상', has: (g) => [...(g?.hardStars || '')].filter((c) => c !== '0').length >= 50 },
  { id: 'coop_friend', name: '같이 깨기 친구', how: '친구랑 같이 10판 이기기', has: (g) => st(g, 'coop') >= 10 },
  { id: 'boss_slayer', name: '보스 사냥꾼', how: '보스 50마리 쓰러뜨리기', has: (g) => st(g, 'boss') >= 50 },
  { id: 'breath_master', name: '브레스 달인', how: '브레스 1,000번 뿜기', has: (g) => st(g, 'breath') >= 1000 },
  { id: 'egg_rich', name: '알 부자', how: '알 50개 부화하기', has: (g) => st(g, 'hatch') >= 50 },
  { id: 'brazier_master', name: '화로 달인', how: '화로 Lv8 만들기', has: (g) => st(g, 'maxWl') >= 8 },
  { id: 'duelist', name: '용 대결 용사', how: '용 대결 10번 이기기', has: (g) => (Number(g?.pvp?.w) || 0) >= 10 },
  { id: 'first_world', name: '첫 모험가', how: '월드 1 깨기 (스테이지 10)', has: (g) => (g?.cleared || 0) >= 10 },
  { id: 'hundred_wins', name: '백전백승', how: '100판 이기기', has: (g) => st(g, 'wins') >= 100 },
];
LOOKS.title = TITLES.map((t) => ({ id: t.id, name: t.name }));
export const titleOf = (id) => TITLES.find((t) => t.id === id) || null;

/** 편의품 — 판마다 1개 · 혼자 하기(스테이지)만. 능력치가 아주 약하게만 오른다 (저장 cons[id] = 가진 개수) */
export const CONSUMABLES = [
  { id: 'ember50', name: '시작 불씨 +50', price: 300, desc: '이번 판 시작 불씨 +50' },
  { id: 'brazier', name: '화로 1단계 무료', price: 500, desc: '이번 판 화로가 Lv2 로 시작' },
  { id: 'basehp', name: '성 체력 +5%', price: 800, desc: '이번 판 성 체력 +5%' },
];
export const CONS_MAX = 99;

/* ───────── 꾸미기 글자 ───────── */
/** { hat, neck, breath, flag, frame, title } (id 또는 null) → 'h3.n1.b2.f4.r0.t7' (번호 = 표 순서+1, 0 = 없음) */
export function encodeLook(look = {}) {
  return SLOTS.map((s) => {
    const i = LOOKS[s].findIndex((x) => x.id === look?.[s]);
    return `${LETTER[s]}${i + 1}`;
  }).join('.');
}
/** 글자 → { hat, neck, breath, flag, frame, title } (id 또는 null). 이상한 값은 무시(없음) */
export function decodeLook(str) {
  const out = Object.fromEntries(SLOTS.map((s) => [s, null]));
  if (typeof str !== 'string' || str.length > 60) return out;
  for (const part of str.split('.')) {
    const m = /^([hnbfrt])(\d{1,3})$/.exec(part);
    if (!m) continue;
    const slot = SLOT_OF[m[1]], n = Number(m[2]);
    if (n >= 1 && n <= LOOKS[slot].length) out[slot] = LOOKS[slot][n - 1].id;
  }
  return out;
}

/* ───────── 아이템 열쇠 'hat:crown' ───────── */
export const keyOf = (slot, id) => `${slot}:${id}`;
export function parseKey(key) {
  const m = /^(hat|neck|breath|flag|frame|title):([a-z0-9_]{1,24})$/.exec(String(key));
  if (!m) return null;
  const item = LOOKS[m[1]].find((x) => x.id === m[2]);
  return item ? { slot: m[1], id: m[2], item } : null;
}
/** 상점에서 파는 꾸미기 열쇠들 (가격이 있고 0 보다 큰 모자 · 목 · 브레스 · 깃발) */
export const SELLABLE = ['hat', 'neck', 'breath', 'flag'].flatMap((s) => LOOKS[s].filter((x) => x.price > 0).map((x) => keyOf(s, x.id)));
/** 이 열쇠의 정가 (판매 안 하면 null) */
export const priceOf = (key) => { const p = parseKey(key); return p && p.item.price > 0 ? { price: p.item.price, gem: !!p.item.gem } : null; };
/** 할인가 (30% 할인 · 반올림 · 최소 1) */
export const DEAL_RATE = 0.7;
export const dealPrice = (price) => Math.max(1, Math.round(price * DEAL_RATE));

/** 이 칸의 이 id 를 가졌나 — 브레스 basic 은 늘 가짐, 칭호는 조건(has) · 나머지는 owned 배열 */
export function hasItem(g, slot, id) {
  if (slot === 'breath' && id === 'basic') return true;
  if (slot === 'title') return !!titleOf(id)?.has(g);
  return Array.isArray(g?.owned) && g.owned.includes(keyOf(slot, id));
}

/* ───────── 오늘의 특가 ───────── */
/** 한국 날짜 'YYYY-MM-DD' (한국 시간 자정에 바뀐다) */
export const todayKst = (now = Date.now()) => new Date(now + 9 * 3600 * 1000).toISOString().slice(0, 10);
function mulberry(a) {
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/** 날짜 문자열 → 꾸미기 열쇠 3개 (같은 날짜면 누구나 같은 3개 · 결정적 무작위) */
export function dealsFor(dateStr) {
  let h = 2166136261;
  for (const c of `idg-deal:${dateStr}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const rnd = mulberry(h >>> 0), pool = SELLABLE.slice();
  const out = [];
  while (out.length < 3 && pool.length) out.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
  return out;
}
