/**
 * 좀비와 드래곤 — 꾸미기 · 용 시장 데이터 (META 기획서 2 · 3장 · 2026-11-11)
 * 원칙 : 꾸미기는 능력치에 영향 없음 · 현금 없음 · 정가 판매만(뽑기 없음) · 편의품은 판마다 1개 · 혼자 하기만.
 * 이 파일은 순수 데이터 + 계산 함수뿐 (화면 · 저장 모름) — 전투 코어가 불러도 안전하다.
 */

/** 칸 이름 (저장 글자 순서 · 화면 순서) */
import { MASTER_ON } from './features.js';
export const SLOTS = ['hat', 'neck', 'breath', 'flag', 'frame', 'title'];
export const SLOT_NAME = { hat: '모자', neck: '목 장식', breath: '브레스 색', flag: '드래곤캐슬 깃발', frame: '테두리', title: '칭호' };
/** 저장 글자의 칸 머리글 (h3.n1.b2.f4.r0.t7) */
/* 11/13 모으기 기획 §10 : 새 칸(드래곤 오라 · 펫 · 드래곤캐슬 지붕 · 문 · 마당)의 머리글자 — 물건은 아직 없음 · 옛 글자는 그대로 읽힌다 */
export const NEW_SLOTS = ['aura', 'pet', 'roof', 'gate', 'yard'];
export const ALL_SLOTS = [...SLOTS, ...NEW_SLOTS];
const LETTER = { hat: 'h', neck: 'n', breath: 'b', flag: 'f', frame: 'r', title: 't', aura: 'a', pet: 'p', roof: 'o', gate: 'g', yard: 'y' };
const SLOT_OF = Object.fromEntries(Object.entries(LETTER).map(([s, l]) => [l, s]));

/**
 * 아이템 표 — price 가 코인, gem:true 면 같은 숫자가 젬. price 가 없으면 상점에서 안 판다
 * (테두리 = 명예의 전당 보상 · 칭호 = TITLES 로 따로 · 브레스 basic = 기본으로 늘 가짐).
 * 순서가 곧 저장 번호(순서+1)이므로 **새 아이템은 맨 뒤에만 추가**한다 (중간에 끼우면 남의 꾸미기가 바뀐다).
 * 그림 : public/assets/iandragon_game/ai/meta/<slot>_<id>.png (칭호는 badge_<id>.png)
 */
export const LOOKS = {
  hat: [
    { id: 'crown', name: '왕관', price: 150, gem: true, tier: 'epic' },
    { id: 'pirate', name: '해적 모자', price: 8000, tier: 'uncommon' },
    { id: 'wizard', name: '마법사 고깔', price: 12000, tier: 'rare' },
    { id: 'pumpkin', name: '호박 모자', price: 3000, tier: 'common' },
    { id: 'helmet', name: '헬멧', price: 6000, tier: 'uncommon' },
    { id: 'ribbon', name: '리본', price: 3000, tier: 'common' },
    { id: 'party', name: '파티 고깔', price: 4000, tier: 'common' },
    { id: 'viking', name: '바이킹 투구', price: 10000, tier: 'rare' },
  ],
  neck: [
    { id: 'cape', name: '망토', price: 8000, tier: 'uncommon' },
    { id: 'scarf', name: '목도리', price: 3000, tier: 'common' },
    { id: 'medal', name: '메달', price: 10000, tier: 'rare' },
    { id: 'skull', name: '해골 목걸이', price: 80, gem: true, tier: 'epic' },
    { id: 'bow', name: '나비 리본', price: 3000, tier: 'common' },
    { id: 'bell', name: '방울', price: 4000, tier: 'common' },
  ],
  breath: [
    { id: 'basic', name: '기본 불꽃', price: 0 },       // 늘 가짐 (판매 X)
    { id: 'rainbow', name: '무지개 브레스', price: 15000, tier: 'rare' },
    { id: 'ghost', name: '보라 유령불', price: 12000, tier: 'rare' },
    { id: 'gold', name: '황금 브레스', price: 200, gem: true, tier: 'epic' },
    { id: 'ice', name: '얼음 파랑', price: 10000, tier: 'rare' },
  ],
  flag: [
    { id: 'dragon', name: '드래곤 깃발', price: 6000, tier: 'uncommon' },     /* 보조 그림 이름에 맞춤 (11/11) */
    { id: 'moon', name: '달 깃발', price: 4000, tier: 'common' },
    { id: 'skull', name: '해골 깃발', price: 50, gem: true, tier: 'epic' },
    { id: 'star', name: '별 깃발', price: 4000, tier: 'common' },
    { id: 'heart', name: '하트 깃발', price: 3000, tier: 'common' },
    { id: 'flame', name: '불꽃 깃발', price: 5000, tier: 'uncommon' },
    { id: 'crown', name: '왕관 깃발', price: 8000, tier: 'uncommon' },
    { id: 'rainbow', name: '무지개 깃발', price: 5000, tier: 'uncommon' },
  ],
  frame: [   // 명예의 전당 시즌 보상 — 상점 판매 X (price 없음)
    { id: 'wood', name: '나무 테두리' },
    { id: 'silver', name: '은 테두리' },
    { id: 'gold', name: '금 테두리' },
    { id: 'fire', name: '불꽃 테두리' },
    /* 11/13 난이도 4단계 · 레벨 선물 (맨 뒤에만 추가) — 그림은 아직 없어 기존 테두리 그림 + 색 필터(FRAME_ART) */
    { id: 'red', name: '붉은 테두리' },          // 어려움 10-10 처음
    { id: 'violet', name: '보라 불꽃 테두리' },   // 초고수 10-10 처음 (그 계정에만 생김)
    { id: 'lvstar', name: '별빛 테두리', tier: 'rare', gift: true },   // 레벨 선물 전용
    { id: 'lvgem', name: '보석 테두리', tier: 'rare', gift: true },    // 레벨 선물 전용
  ],
  title: [],   // 아래 TITLES 로 채운다 (퀘스트 보상 — 상점 판매 X)
  aura: [], pet: [], roof: [], gate: [], yard: [],   // 새 칸 (모으기 묶음에서 채움 · 맨 뒤에만 추가)
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
const starAt = (s, g) => Number((typeof s === 'string' ? s : '')[g - 1]) > 0;
/** 초고수 관련 항목을 보여도 되는 계정 (보통 10-10 을 깸) */
export const SEES_MASTER = (g) => MASTER_ON && (g?.cleared || 0) >= 100;   // 초고수 꺼짐이면 늘 false (11/13)
const MW = ['hill', 'volcano', 'sky', 'ice', 'mine', 'grave', 'desert', 'swamp', 'crystal', 'castle'];
const LV_TITLES = [
  { id: 'lv_spark', name: '반짝반짝 성장왕', tier: 'common', gift: true }, { id: 'lv_moon', name: '달빛 모험가', tier: 'common', gift: true }, { id: 'lv_rocket', name: '쑥쑥 로켓', tier: 'common', gift: true }, { id: 'lv_crown', name: '별빛 왕관', tier: 'common', gift: true },
];
export const TITLES = [
  { id: 'zombie_hunter', name: '좀비 사냥꾼', how: '좀비 1,000마리 쓰러뜨리기', has: (g) => st(g, 'kills') >= 1000 },
  { id: 'star_collector', name: '별 수집가', how: '별 100개 모으기', has: (g) => sumStars(g?.stars) >= 100 },
  { id: 'hundred_dragon', name: '백 판의 드래곤', how: '스테이지 100개 모두 깨기', has: (g) => (g?.cleared || 0) >= 100 },
  { id: 'hard_conqueror', name: '어려움 정복자', how: '어려움 붉은 별 50판 이상', has: (g) => [...(g?.hardStars || '')].filter((c) => c !== '0').length >= 50 },
  { id: 'coop_friend', name: '같이 깨기 친구', how: '친구랑 같이 10판 이기기', has: (g) => st(g, 'coop') >= 10 },
  { id: 'boss_slayer', name: '보스 사냥꾼', how: '보스 판 50번 이기기', has: (g) => st(g, 'boss') >= 50 },
  { id: 'breath_master', name: '브레스 달인', how: '브레스 1,000번 뿜기', has: (g) => st(g, 'breath') >= 1000 },
  { id: 'egg_rich', name: '알 부자', how: '알 50개 부화하기', has: (g) => st(g, 'hatch') >= 50 },
  { id: 'brazier_master', name: '화로 달인', how: '화로 Lv8 만들기', has: (g) => st(g, 'maxWl') >= 8 },
  { id: 'duelist', name: '드래곤 대결 용사', how: '드래곤 대결 10번 이기기', has: (g) => (Number(g?.pvp?.w) || 0) >= 10 },
  { id: 'first_world', name: '첫 모험가', how: '월드 1 깨기 (스테이지 10)', has: (g) => (g?.cleared || 0) >= 10 },
  { id: 'hundred_wins', name: '백전백승', how: '100판 이기기', has: (g) => st(g, 'wins') >= 100 },
  { id: 'week_hero', name: '이번 주 용사', how: '주간 좀비 습격 10위 안에 들기', has: (g) => (g?.weekTop || 0) > 0 },   // 맨 뒤에만 더한다 (꾸미기 번호)
  /* ── 11/13 난이도 4단계 (§A-4) — 맨 뒤에만 ── */
  /* 어려움 칭호는 «새 어려움»(11/13 · hardWon)으로 깨야 받는다 — 옛 붉은 별로는 미리 주지 않음 (별 · 레벨은 그대로) */
  { id: 'hard_lord', name: '붉은 별의 주인', how: '어려움 10-10 깨기', has: (g) => (g?.hardWon || '')[99] === '1' },
  { id: 'hard_perfect', name: '완벽한 정복자', how: '붉은 별 300개 모으기 (어려움 100판 모두 깨기)', has: (g) => sumStars(g?.hardStars) >= 300 && !/0/.test((g?.hardWon || '').padEnd(100, '0')) },
  /* 초고수 칭호 : vis = 보통 10-10 을 깬 계정에만 목록에 보인다 (그 전에는 «초고수»라는 글자가 어디에도 없어야 함) */
  { id: 'master_top', name: '초고수', how: '초고수 10-10 깨기', has: (g) => starAt(g?.masterStars, 100), vis: SEES_MASTER },
  { id: 'master_legend', name: '전설의 드래곤 조련사', how: '보라 별 300개 모으기', has: (g) => sumStars(g?.masterStars) >= 300, vis: SEES_MASTER },
  ...['달밤 언덕', '부글 화산', '구름 하늘섬', '꽁꽁 얼음골', '덜컹 쇠 광산', '으스스 묘지', '모래바람 사막', '끈적 독 늪', '반짝 수정 동굴', '좀비 드래곤캐슬'].map((nm, i) => (
    { id: `mw_${MW[i]}`, name: `${nm}의 전설`, how: `초고수 ${i + 1}-10 깨기`, has: (g) => starAt(g?.masterStars, (i + 1) * 10), vis: SEES_MASTER })),
  /* 레벨 선물 전용 (§C-5 · 상점 판매 X · 받으면 lvGifts 에 'title:<id>' 로 남는다) */
  ...LV_TITLES.map((t) => ({ ...t, how: '레벨 선물에서 나와요', has: (g) => Object.values(g?.lvGifts || {}).includes(`title:${t.id}`) })),
];
LOOKS.title = TITLES.map((t) => ({ id: t.id, name: t.name, ...(t.tier ? { tier: t.tier } : {}), ...(t.gift ? { gift: true } : {}), ...(t.vis ? { vis: t.vis } : {}) }));
/** 그림 경로 — 보조 파일 이름과 다른 것만 따로 (브레스 기본 = breath_default · 칭호 = badge_<그림 이름>) */
const BADGE = { zombie_hunter: 'hunter', star_collector: 'stars', hundred_dragon: 'hundred', hard_conqueror: 'hard', coop_friend: 'buddies', boss_slayer: 'boss', breath_master: 'breath', egg_rich: 'egg', brazier_master: 'nest', duelist: 'duel', first_world: 'explorer', hundred_wins: 'wins', week_hero: 'weekhero',
  /* 11/13 새 칭호 — 전용 배지 그림이 나올 때까지 남는 배지 그림을 빌려 쓴다 (겜부장 그림 목록) */
  hard_lord: 'hard', hard_perfect: 'flaghill', master_top: 'storm', master_legend: 'claw', lv_spark: 'sunrise', lv_moon: 'moon', lv_rocket: 'thumbs', lv_crown: 'rich',
  ...Object.fromEntries(MW.map((w) => [`mw_${w}`, 'boss'])) };
/** 새 테두리 = 기존 테두리 그림 + 색 필터 (전용 그림이 나오면 이 표에서 빼면 된다) */
export const FRAME_ART = { red: ['fire', 'hue-rotate(-28deg) saturate(1.5)'], violet: ['fire', 'hue-rotate(-110deg) saturate(1.3)'], lvstar: ['silver', 'hue-rotate(190deg) saturate(2)'], lvgem: ['gold', 'hue-rotate(110deg) saturate(1.4)'] };
/** 그림이 .webp 로만 있는 물건 (11/13 새 꾸미기 · 파일 이름 = <칸>_<id>) — 나머지는 .png. 새 그림이 들어오면 여기에 더한다
 *  (다시 뽑기 : ai/meta 에서 .png 없이 .webp 만 있는 hat_ · neck_ · aura_ · pet_ · flag_ · roof_ · gate_ · yard_ 이름) */
const WEBP = new Set(`breath_magma breath_skyblue breath_copper breath_starforge breath_soulfire breath_sand breath_toxic breath_amethyst breath_royal breath_blackfire breath_whitefire breath_cosmic aura_breeze aura_bubbles aura_firefly aura_fog aura_fullmoon aura_galaxy aura_gearaura aura_gemring aura_goldring aura_grass aura_lavaring aura_nebula aura_prism aura_sandstorm aura_snowflake aura_spiritring aura_spores aura_sunflare flag_aurora flag_banner flag_batflag flag_dragonking flag_froglord flag_gemflag flag_kite flag_legendflag flag_lionflag flag_moonhill flag_nightking flag_oasis flag_pickflag flag_rainbowstar flag_sunflag flag_volcano gate_cloudgate gate_dragongate gate_firegate gate_geargate gate_glaciergate gate_icegate gate_irongate gate_lavagate gate_mossgate gate_portcullis gate_reedgate gate_royalgate gate_sandarch gate_snowarch gate_sphinxgate gate_stargate gate_tombgate gate_vinegate hat_acorn hat_aviator hat_cometcrown hat_crystalcap hat_drillhat hat_earmuff hat_flamecrown hat_gemtiara hat_jewelhelm hat_lavacone hat_lilypad hat_minerhelm hat_moonhelm hat_moonstar hat_nightcap hat_pharaoh hat_phoenixcrest hat_starcrown hat_stormcrown hat_turban hat_wingcap hat_witchhat neck_bonechain neck_cloudscarf neck_coalpouch neck_crystalbead neck_dragonheart neck_emberscarf neck_featherboa neck_frogbead neck_frostmedal neck_ghostcape neck_icescarf neck_knightcape neck_lavachain neck_leafscarf neck_rubyamulet neck_starnecklace neck_sunscarab neck_vinecape pet_camel pet_cloudwhale pet_cometfox pet_emberpup pet_firebird pet_froggy pet_gemfairy pet_goldegg pet_griffin pet_minidragon pet_mole pet_moonbunny pet_owl pet_penguin pet_salamander pet_scarab pet_skyspirit pet_starcat roof_balloon roof_belltower roof_chimney roof_crowroof roof_crystalspire roof_diamondroof roof_dragonstatue roof_geode roof_icicle roof_moontower roof_pyramid roof_shardroof roof_skyship roof_starfrost roof_starwing roof_sundome roof_weathervane roof_windmill yard_brazier yard_crystaltree yard_fountain yard_gravestone yard_haystack yard_icestatue yard_igloo yard_knightstatue yard_lotuspond yard_lotusthrone yard_minecart yard_mushrooms yard_obelisk yard_pumpkinlamp yard_snowman yard_starfountain yard_torches yard_treasure`.split(' '));
const metaExt = (name) => (WEBP.has(name) ? 'webp' : 'png');
export const artOf = (slot, id) => { const n = slot === 'title' ? `badge_${BADGE[id] || id}` : slot === 'breath' && id === 'basic' ? 'breath_default' : slot === 'frame' && FRAME_ART[id] ? `frame_${FRAME_ART[id][0]}` : `${slot}_${id}`; return `/assets/iandragon_game/ai/meta/${n}.${metaExt(n)}`; };
/** 그림에 씌울 CSS 필터 (없으면 '') */
export const artFilter = (slot, id) => (slot === 'frame' && FRAME_ART[id] ? FRAME_ART[id][1] : '');
/** 칭호 목록에 보여도 되나 (초고수 칭호는 보통 10-10 을 깬 계정에만) */
export const titleVisible = (t, g) => !!t && (!t.vis || t.vis(g));
export const titleOf = (id) => TITLES.find((t) => t.id === id) || null;

/** 편의품 — 판마다 1개 · 혼자 하기(스테이지)만. 능력치가 아주 약하게만 오른다 (저장 cons[id] = 가진 개수) */
export const CONSUMABLES = [
  { id: 'ember50', name: '시작 불씨 +50', price: 300, desc: '이번 판 시작 불씨 +50' },
  { id: 'brazier', name: '화로 1단계 무료', price: 500, desc: '이번 판 화로가 Lv2 로 시작' },
  { id: 'basehp', name: '드래곤캐슬 체력 +5%', price: 800, desc: '이번 판 드래곤캐슬 체력 +5%' },
];
export const CONS_MAX = 99;

/* ───────── 꾸미기 글자 ───────── */
/** { hat, neck, breath, flag, frame, title } (id 또는 null) → 'h3.n1.b2.f4.r0.t7' (번호 = 표 순서+1, 0 = 없음) */
export function encodeLook(look = {}) {
  const parts = SLOTS.map((s) => `${LETTER[s]}${LOOKS[s].findIndex((x) => x.id === look?.[s]) + 1}`);
  for (const s of NEW_SLOTS) { const i = LOOKS[s].findIndex((x) => x.id === look?.[s]); if (i >= 0) parts.push(`${LETTER[s]}${i + 1}`); }   // 새 칸은 고른 것만 (옛 기기 · 멀티 글자 길이 그대로)
  return parts.join('.');
}
/** 글자 → { hat, neck, breath, flag, frame, title } (id 또는 null). 이상한 값은 무시(없음) */
export function decodeLook(str) {
  const out = Object.fromEntries(ALL_SLOTS.map((s) => [s, null]));
  if (typeof str !== 'string' || str.length > 120) return out;
  for (const part of str.split('.')) {
    const m = /^([hnbfrtapogy])(\d{1,3})$/.exec(part);
    if (!m) continue;
    const slot = SLOT_OF[m[1]], n = Number(m[2]);
    if (n >= 1 && n <= LOOKS[slot].length) out[slot] = LOOKS[slot][n - 1].id;
  }
  return out;
}

/* ───────── 아이템 열쇠 'hat:crown' ───────── */
export const keyOf = (slot, id) => `${slot}:${id}`;
/** 샵 목록(catalog.js · 따로 묶음)에서 온 새 물건 이름 — 레벨 선물이 catalog 를 받을 때 채운다(꾸미기 표 LOOKS 는 옛 26개만 · 새 물건은 저장 번호를 lookFx 가 맡는다) */
const EXTRA = {};
export const rememberLooks = (rows) => { for (const r of rows || []) if (!LOOKS[r.slot]?.some((x) => x.id === r.id)) EXTRA[r.key] = { id: r.id, name: r.name }; };
export function parseKey(key) {
  const m = /^(hat|neck|breath|flag|frame|title|aura|pet|roof|gate|yard):([a-z0-9_]{1,24})$/.exec(String(key));
  if (!m) return null;
  const item = LOOKS[m[1]].find((x) => x.id === m[2]) || EXTRA[String(key)];
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

/* ───────── 레벨 선물 (IDG_DIFFICULTY_PLAN §C-5 · 대표님 11/13 · 모으기 기획 §10 정리) ─────────
 *  Lv10 · 20 … 180 마다 꾸미기 1개(랜덤) + 젬 20 (Lv100 = 젬 50). 이번 묶음은 멋 · 젬만 (능력치 효과 없음).
 *  후보 = 상점 꾸미기 26개 + 레벨 선물 전용 칭호 4 · 테두리 2 — 물건마다 tier 를 따로 적는다(값으로 나누지 않음) · 보이는(열린) 것만.
 *  등급 : 보통 60 · 고급 28 · 희귀 10 · 영웅 2. 가진 것은 안 나옴 → 뽑힌 등급이 비면 아래 등급으로만 → 다 비면 젬 50.
 *  씨앗 = 계정 id + 레벨 → 다시 뽑기 · 기기 바꿔 뽑기 없음 (결과는 저장 lvGifts 에 남는다). */
export const GIFT_EVERY = 10, GIFT_LAST = 180, GIFT_ALL_GEMS = 50;
export const GIFT_TIERS = [
  { id: 'common', name: '보통', p: 60, stars: 1 },     // 색 : 회색 (샵 카드와 같게 · 모으기 기획 §1)
  { id: 'uncommon', name: '고급', p: 28, stars: 2 },   // 초록
  { id: 'rare', name: '희귀', p: 10, stars: 3 },       // 파랑
  { id: 'epic', name: '영웅', p: 2, stars: 4 },        // 보라
];
export const GIFT_ODDS = GIFT_TIERS.map((t) => `${t.name} ${t.p}`).join(' · ');
export const giftGems = (lv) => (lv === 100 ? 50 : 20);
/** 이 계정에 보여도 되는 꾸미기 (칸마다 · 물건에 vis 가 있으면 그 조건 · 지금은 초고수 칭호만 걸림) — 거르는 곳은 여기 한 곳 */
export const visibleLooks = (g) => Object.fromEntries(Object.entries(LOOKS).map(([slot, list]) => [slot, list.filter((x) => !x.vis || x.vis(g))]));
/** 레벨 선물 후보 열쇠 (등급별) — 샵에 **열린 것**(catalog.giftCandidates(g) · 안 가진 것 · 전설 · 신화 · 변신 모습 없음) + 레벨 선물 전용 칭호(보통) · 테두리(희귀).
 *  cat = { common, fine, rare, hero } (catalog.giftCandidates) — 등급 이름은 선물 창이 쓰는 대로(고급 = uncommon · 영웅 = epic). cat 이 없으면 옛 26개 표(LOOKS)로 */
export function giftPool(g, cat) {
  const P = Object.fromEntries(GIFT_TIERS.map((t) => [t.id, []])), V = visibleLooks(g);
  if (cat) { P.common.push(...cat.common); P.uncommon.push(...cat.fine); P.rare.push(...cat.rare); P.epic.push(...cat.hero); }
  for (const [slot, list] of Object.entries(V)) for (const x of list) if (x.tier && P[x.tier] && (cat ? x.gift : x.gift || x.price > 0)) P[x.tier].push(keyOf(slot, x.id));
  return P;
}
/** 이 열쇠를 이미 가졌나 (칭호는 조건 · 나머지는 owned) */
export const hasKey = (g, key) => { const p = parseKey(key); return !!p && hasItem(g, p.slot, p.id); };
/** 선물 하나 뽑기 (결정적) — g = 지금 저장값(앞 선물까지 반영) · seed = 계정 id 글자 · cat = catalog.giftCandidates(g) (없으면 옛 표) */
export function pickGift(g, lv, seed, cat) {
  let h = 2166136261;
  for (const c of `idg-gift:${seed}:${lv}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const rnd = mulberry(h >>> 0), roll = rnd() * 100, pick = rnd();
  let acc = 0, ti = GIFT_TIERS.length - 1;
  for (let i = 0; i < GIFT_TIERS.length; i++) { acc += GIFT_TIERS[i].p; if (roll < acc) { ti = i; break; } }
  const P = giftPool(g, cat), has = (k) => hasKey(g, k) || (Array.isArray(g?.owned) && g.owned.includes(k));
  for (let i = ti; i >= 0; i--) {   // 뽑힌 등급 → 아래 등급으로만 (위로 올라가지 않는다) → 다 비면 젬
    const left = P[GIFT_TIERS[i].id].filter((k) => !has(k));
    if (left.length) return { lv, key: left[Math.floor(pick * left.length)], tier: GIFT_TIERS[i].id, gems: giftGems(lv) };
  }
  return { lv, key: null, tier: null, gems: giftGems(lv) + GIFT_ALL_GEMS };
}
