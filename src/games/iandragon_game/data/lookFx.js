/**
 * 좀비와 드래곤 — 꾸미기 효과 (전투용 · 작게) — IDG_COLLECTION_PLAN §3.3 · §10 · 2026-11-13 핵심 보조 ④
 *
 * 물건 열쇠 'slot:id' → { slot, tier, fx } 만 둔다. 이름 · 값 · 얻는 곳은 샵 · 도감용 `catalog.js`(따로 묶음).
 * 효과 = 기획값의 1/5 (아주 미세) · 입은 것 같은 효과 합 +5% 상한 · 가진 것 하나마다 +0.1% (상한 +3%) · 초고수 · 대결 · 주간 습격에서는 0.
 * 계산은 판 시작 때 한 번 (`lookBonus` → `upgradeLoad` 가 부른다). 전투 중에는 부르지 않는다.
 *
 * ## 저장 번호 (중요)
 * 아래 `T` 의 칸마다 순서 = 꾸미기 글자의 번호(순서+1). 앞 26개는 `looks.js` LOOKS 와 같은 순서(브레스는 basic 이 1번).
 * **새 물건은 그 칸 맨 뒤에만** 붙인다 — 중간에 끼우면 남의 입은 모습이 바뀐다. 숫자 = 등급(1 보통 … 6 신화 · 0 = 기본 불꽃).
 */

/** 등급 6단계 (번호 1 ~ 6 · 별 ★1 ~ ★6) */
export const TIERS = ['common', 'fine', 'rare', 'hero', 'legend', 'myth'];
export const TIER_KO = { common: '보통', fine: '고급', rare: '희귀', hero: '영웅', legend: '전설', myth: '신화' };
/** 드래곤 칸 · 드래곤캐슬 칸 (깃발은 지금처럼 `look` 글자 · 지붕 · 성문 · 앞마당은 `clook` 글자) */
export const DRAGON_SLOTS = ['hat', 'neck', 'breath', 'aura', 'pet'];
export const CASTLE_SLOTS = ['flag', 'roof', 'gate', 'yard'];
export const LOOK_SLOTS = [...DRAGON_SLOTS, ...CASTLE_SLOTS];
/** 꾸미기 글자 머리글 — look : h n b f r t a p / clook : o g y (r · t = 테두리 · 칭호, 효과 없음) */
export const LETTER = { hat: 'h', neck: 'n', breath: 'b', flag: 'f', frame: 'r', title: 't', aura: 'a', pet: 'p', roof: 'o', gate: 'g', yard: 'y' };
const SLOT_OF = Object.fromEntries(Object.entries(LETTER).map(([s, l]) => [l, s]));

/* 칸마다 'id등급' — 순서 = 저장 번호 (맨 뒤에만 추가) */
const T = {
  hat: 'crown4 pirate2 wizard2 pumpkin1 helmet1 ribbon1 party1 viking2 acorn1 nightcap3 moonhelm4 moonstar6 lavacone2 phoenixcrest5 aviator2 wingcap3 stormcrown5 earmuff1 minerhelm2 drillhat3 jewelhelm4 turban2 pharaoh3 lilypad1 witchhat5 crystalcap2 gemtiara3 flamecrown5 cometcrown6 starcrown6',
  neck: 'cape2 scarf1 medal2 skull4 bow1 bell1 leafscarf2 emberscarf1 lavachain3 cloudscarf2 featherboa4 icescarf3 frostmedal5 coalpouch1 rubyamulet5 bonechain2 ghostcape3 sunscarab6 frogbead3 vinecape4 crystalbead1 knightcape2 dragonheart5 starnecklace6',
  breath: 'basic0 rainbow2 ghost2 gold4 ice2 magma2 skyblue3 copper4 starforge6 soulfire3 sand1 toxic2 amethyst3 royal2 blackfire5 whitefire5 cosmic6',
  aura: 'grass1 firefly3 fullmoon5 lavaring4 sunflare6 breeze1 snowflake2 gearaura3 fog1 spiritring5 sandstorm2 bubbles3 spores4 prism2 gemring3 galaxy6 goldring5 nebula6',
  pet: 'owl2 moonbunny4 emberpup1 salamander3 firebird5 cloudwhale5 skyspirit6 penguin3 mole2 scarab3 camel4 froggy1 gemfairy5 minidragon2 griffin3 goldegg5 starcat6 cometfox6',
  flag: 'dragon1 moon1 skull4 star1 heart1 flame1 crown2 rainbow1 moonhill2 volcano2 kite3 aurora4 pickflag3 batflag1 nightking6 oasis2 sunflag3 froglord5 gemflag4 banner1 lionflag3 dragonking5 legendflag5 rainbowstar6',
  roof: 'windmill3 moontower5 weathervane1 balloon3 skyship4 icicle2 starfrost6 chimney3 crowroof2 belltower5 pyramid3 sundome5 shardroof1 crystalspire2 geode3 diamondroof4 dragonstatue5 starwing6',
  gate: 'vinegate3 lavagate3 firegate4 cloudgate2 snowarch1 icegate3 glaciergate5 geargate2 irongate5 tombgate3 sandarch1 sphinxgate4 reedgate2 mossgate3 portcullis3 royalgate5 stargate6 dragongate5',
  yard: 'haystack1 brazier3 snowman2 igloo3 icestatue4 minecart1 pumpkinlamp2 gravestone3 obelisk5 mushrooms2 lotuspond3 lotusthrone6 crystaltree5 torches1 fountain2 knightstatue3 treasure5 starfountain6',
};
/** 칸마다 id 순서 (저장 번호 = 순서+1) */
export const SLOT_IDS = Object.fromEntries(Object.entries(T).map(([s, str]) => [s, str.split(' ').map((x) => x.replace(/\d$/, ''))]));

/** 효과 크기 (등급 1 ~ 6) — 모자 · 펫 = 수호 불꽃 공격 / 목 · 오라 = 브레스 충전 / 깃발 · 지붕 · 성문 · 앞마당 = 드래곤캐슬 체력 */
export const TIER_PCT = [0.005, 0.01, 0.015, 0.02, 0.025, 0.03];
const KIND = { hat: 'guard', pet: 'guard', neck: 'charge', aura: 'charge', flag: 'baseHp', roof: 'baseHp', gate: 'baseHp', yard: 'baseHp' };
/** 브레스 색 특수 효과 (1/5) — slow = 수호 불꽃 맞은 적 느려짐(초) · vs = 유령 · 그림자에 피해 + · dmg = 브레스 피해 + · bounty = 불로 잡으면 불씨 + */
const BREATH_KIND = { rainbow: 'dmg', ghost: 'vs', gold: 'bounty', ice: 'slow', magma: 'dmg', skyblue: 'slow', copper: 'bounty', starforge: 'dmg', soulfire: 'vs', sand: 'slow', toxic: 'vs', amethyst: 'dmg', royal: 'bounty', blackfire: 'vs', whitefire: 'slow', cosmic: 'bounty' };
const BREATH_VAL = {   // 등급 1 ~ 6 (옛 4종 = §5.4 값의 1/5 : 얼음 0.2초 · 유령 +6% · 무지개 +3% · 황금 +10%)
  slow: [0.1, 0.2, 0.25, 0.3, 0.35, 0.4], vs: [0.04, 0.06, 0.07, 0.08, 0.09, 0.1],
  dmg: [0.02, 0.03, 0.035, 0.04, 0.045, 0.05], bounty: [0.04, 0.06, 0.08, 0.1, 0.12, 0.14],
};
/** 기본이 아닌 브레스 색을 입으면 브레스 사거리 + (IDG_DRAGON_CASTLE_PLAN §5.5 ③) */
export const BREATH_COLOR_RANGE = 0.05;
/** 새 브레스 색의 입자 색 (옛 4종은 looks.js BREATH_COLORS) — 합칠 때 BREATH_COLORS 에 더한다 */
export const BREATH_PAL = {
  magma: [0xff5a1f, 0xff9a2e, 0xffd04a, 0xb8321a], skyblue: [0x8fd8ff, 0xc8eeff, 0x5ab0ff, 0xffffff], copper: [0xd9823b, 0xf0a860, 0xa8582a, 0xffd0a0],
  starforge: [0xfff3a0, 0xffb84a, 0xffffff, 0x8a6cff], soulfire: [0x7af0ff, 0x4ac0e0, 0xc8ffff, 0x3a70c0], sand: [0xe8c47a, 0xd8a85a, 0xfff0c0, 0xb08040],
  toxic: [0x8ef04a, 0x5ac02a, 0xd8ff8a, 0x3a8a2a], amethyst: [0xb87aff, 0xe0b8ff, 0x8a4ae0, 0xffffff], royal: [0xffd84a, 0xd03a4a, 0xfff1a0, 0x4a5ad0],
  blackfire: [0x3a2a4a, 0x6a4a8a, 0x1a1020, 0xa07ad0], whitefire: [0xffffff, 0xe8f4ff, 0xc8d8f0, 0xfff8e0], cosmic: [0x4a3aa0, 0xa06cff, 0xffffff, 0x3ac0ff],
};

/** 'slot:id' → { slot, tier(1~6), fx } — fx 는 { guard | charge | baseHp : 비율 } 또는 브레스 { range, slow | vs | dmg | bounty } */
export const LOOK_FX = (() => {
  const out = {};
  for (const [slot, str] of Object.entries(T)) {
    for (const tok of str.split(' ')) {
      const id = tok.slice(0, -1), tier = Number(tok.slice(-1));
      if (!tier) continue;   // 기본 불꽃
      let fx;
      if (slot === 'breath') { const k = BREATH_KIND[id]; fx = { range: BREATH_COLOR_RANGE, [k]: BREATH_VAL[k][tier - 1] }; } else fx = { [KIND[slot]]: TIER_PCT[tier - 1] };
      out[`${slot}:${id}`] = { slot, tier, fx };
    }
  }
  return out;
})();
export const fxOf = (key) => LOOK_FX[key] || null;

/** 상한 — 입은 것 같은 효과 합 · 가진 것 하나마다 · 가진 것 합 (드래곤 쪽 · 드래곤캐슬 쪽 따로) */
export const WORN_CAP = 0.05, OWN_STEP = 0.001, OWN_CAP = 0.03;
/** 꾸미기 효과가 없는 판 (초고수 = 실력만 · 대결 · 주간 습격 = 모두 같은 조건) */
export const NO_LOOK_FX = ['master', 'pvp', 'raid'];

/** 꾸미기 글자 하나 → { slot: id } (모르는 머리글 · 번호는 버림). look · clook 둘 다 이 함수로 읽는다 */
export function decodeWear(str) {
  const out = {};
  if (typeof str !== 'string' || str.length > 80) return out;
  for (const part of str.split('.')) {
    const m = /^([a-z])(\d{1,3})$/.exec(part);
    const slot = m && SLOT_OF[m[1]];
    if (!slot || !SLOT_IDS[slot]) continue;
    const id = SLOT_IDS[slot][Number(m[2]) - 1];
    if (id) out[slot] = id;
  }
  return out;
}

const ZERO = Object.freeze({ guard: 1, charge: 1, baseHp: 1, breathRange: 0, breathDmg: 1, slow: 0, vs: 0, bounty: 1, worn: Object.freeze([]) });

/**
 * 판 시작 꾸미기 효과. save = idg 저장값(owned · look · clook), diff = 'easy'|'normal'|'hard'|'master'|'pvp'|'raid'.
 * 돌려줌(모두 곱하기 배율, breathRange · slow · vs 는 더하기) :
 *   guard(수호 불꽃 피해) · charge(브레스 충전 빠르기) · baseHp(드래곤캐슬 체력) · breathRange(+0.05) · breathDmg · slow(초) · vs(유령 · 그림자 +) · bounty(불로 잡은 불씨) · worn(입은 열쇠)
 * 입었어도 owned 에 없는 것은 세지 않는다(브레스 basic 은 효과 없음).
 */
export function lookBonus(save, diff = 'normal') {
  if (NO_LOOK_FX.includes(diff)) return ZERO;
  const owned = new Set(Array.isArray(save?.owned) ? save.owned : []);
  const wear = { ...decodeWear(save?.look), ...decodeWear(save?.clook) };
  const sum = { guard: 0, charge: 0, baseHp: 0 }, worn = [];
  let breath = null;
  for (const slot of LOOK_SLOTS) {
    const id = wear[slot];
    if (!id) continue;
    const key = `${slot}:${id}`, f = LOOK_FX[key];
    if (!f || !owned.has(key)) continue;
    worn.push(key);
    if (slot === 'breath') breath = f.fx;
    else for (const k in f.fx) sum[k] += f.fx[k];
  }
  let ownD = 0, ownC = 0;
  for (const key of owned) { const f = LOOK_FX[key]; if (f) { if (CASTLE_SLOTS.includes(f.slot)) ownC++; else ownD++; } }
  const cap = (v) => Math.min(WORN_CAP, v), own = (n) => Math.min(OWN_CAP, n * OWN_STEP);
  return {
    guard: 1 + cap(sum.guard) + own(ownD),
    charge: 1 + cap(sum.charge),
    baseHp: 1 + cap(sum.baseHp) + own(ownC),
    breathRange: breath ? breath.range : 0,
    breathDmg: 1 + (breath?.dmg || 0),
    slow: breath?.slow || 0,
    vs: breath?.vs || 0,
    bounty: 1 + (breath?.bounty || 0),
    worn,
  };
}
