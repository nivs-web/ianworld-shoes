/**
 * 이안 드래곤 게임 — 계정에 저장하는 값 한 묶음(`profile.idg`)의 모양 · 고치기 · 병합. (2026-11-10)
 *
 * `profile.js` 의 `pullRemote` 가 부르므로 **부팅 번들에 들어간다** — 게임 코드 · 표를 물지 않는
 * 작은 순수 함수만 둔다 (줄넘기 `jumpropeState.js` 와 같은 방식). 모양은 기획서 14장.
 *
 * ## 병합 규칙 (줄넘기 · 드래곤과 같은 방침)
 * 줄지 않는 값(진행 · 별 · 레벨 · 연구 · 도감 비트)은 큰 쪽 / 합집합, 지갑(코인 · 젬)도 큰 쪽
 * — 한 기기에서 번 것이 옛 값에 덮여 사라지는 것보다 쓴 것이 되살아나는 쪽이 낫다.
 * 고른 것(리더 · 스킬 · 덱 · 배속)은 마지막에 고른 쪽(원격)을 따른다.
 */

const CAP = 1e9;
const STAGES = 200;          // 100스테이지 → 나중에 200 (기획서 17장)
const LAB_N = 7;
const ID = /^[a-zA-Z][a-zA-Z0-9]{0,23}$/;

const n0 = (v, hi = CAP) => {
  const x = Math.round(Number(v) || 0);
  return x < 0 ? 0 : x > hi ? hi : x;
};
const str = (v, max, def) => (typeof v === 'string' && v.length <= max ? v : def);
const ids = (a, max) => [...new Set((Array.isArray(a) ? a : []).filter((s) => typeof s === 'string' && ID.test(s)))].slice(0, max);
/** 스테이지마다 별 0~3 — 문자열 한 줄 ('0'~'3') */
const starsStr = (s) => (typeof s === 'string' ? s : '').slice(0, STAGES).replace(/[^0-3]/g, '0');
/** 비트 문자열(도감 · 과제) — 0/1 만 */
const bits = (s, max) => (typeof s === 'string' ? s : '').slice(0, max).replace(/[^01]/g, '0');

/**
 * 한 번만 보는 안내 (난이도 4단계 · 11/13) — `seen` 비트 문자열의 뒤쪽 칸을 쓴다 (앞쪽은 도감 · 튜토리얼 몫으로 남겨 둠).
 * 병합은 비트 합집합이라 한 기기에서 본 안내는 다른 기기에서도 다시 안 뜬다.
 */
export const SEEN = { hardOpen: 500, masterOpen: 501, hardV2: 502, lv100: 503 };
export const seenBit = (g, i) => (g?.seen || '')[i] === '1';
/** 그 비트를 켠 새 seen 문자열 (모자라면 0 으로 채움) */
export const withSeen = (seen, i) => { const s = (typeof seen === 'string' ? seen : '').padEnd(i + 1, '0').split(''); s[i] = '1'; return s.join(''); };

function units(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return { kkomul: [1, 0] };
  for (const [k, v] of Object.entries(raw)) {
    if (!ID.test(k) || !Array.isArray(v)) continue;
    out[k] = [Math.max(1, n0(v[0], 99)), n0(v[1], 99)];   // [레벨, +]
  }
  if (!out.kkomul) out.kkomul = [1, 0];
  return out;
}

/** 쌓인 기록 : 쓰러뜨린 좀비 · 이긴 판 · 브레스 · 화로 최고 단계 · 보스 · 알 */
/* 용 시장 · 꾸미기 (META 2 · 3장) */
/* 11/13 모으기 기획 §10 : 새 칸(aura · pet · roof · gate · yard)도 버리지 않게 · 가진 것 512개까지 */
const KEY = /^(hat|neck|breath|flag|frame|aura|pet|roof|gate|yard):[a-z0-9_]{1,24}$/;
const OWNED_MAX = 512;
const ownedKeys = (a) => [...new Set((Array.isArray(a) ? a : []).filter((s) => typeof s === 'string' && KEY.test(s)))].slice(0, OWNED_MAX);
const CONS_IDS = ['ember50', 'brazier', 'basehp'];
const consObj = (o) => Object.fromEntries(CONS_IDS.map((k) => [k, n0(o && typeof o === 'object' ? o[k] : 0, 99)]));
const lookStr = (s) => (typeof s === 'string' && /^[a-z0-9.]{0,80}$/.test(s) ? s : '');   // 입은 모습 글자 80자까지 (새 칸 머리글자 a · p · o · g · y)
const STAT_KEYS = ['kills', 'wins', 'breath', 'maxWl', 'boss', 'hatch', 'coop'];   // coop = 같이 깨기 이긴 판 (명예의 전당)
function stats(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  return Object.fromEntries(STAT_KEYS.map((k) => [k, n0(r[k], 1e9)]));
}

export function emptyIdg() { return normIdg(null); }

/** 저장된 값이 어떤 모양이든 안전한 모양으로 */
export function normIdg(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const lab = Array.from({ length: LAB_N }, (_, i) => n0(Array.isArray(r.lab) ? r.lab[i] : 0, 99));
  const deck = ids(r.deck, 10);
  return {
    v: 1,
    coins: n0(r.coins),
    gems: n0(r.gems),
    cleared: n0(r.cleared, STAGES),          // 깬 마지막 스테이지 순번 (차례로만 열린다)
    stars: starsStr(r.stars),
    units: units(r.units),
    squadLv: Math.max(1, n0(r.squadLv, 99)),
    lab,
    leader: str(r.leader, 24, 'auto'),          // 'auto' = 월드마다 추천 리더 (2026-11-11 결정 D8)
    skills: ids(r.skills, 2),
    deck: deck.length ? deck : ['kkomul'],
    pity: n0(r.pity, 999),                    // 전설이 안 나온 연속 횟수
    seen: bits(r.seen, 512),                  // 도감 · 튜토리얼 표시
    quests: bits(r.quests, 256),              // 도전 과제
    daily: str(r.daily, 10, ''),              // 마지막 첫 승리 날짜 (YYYY-MM-DD, KST)
    speed: [1, 2, 3].includes(r.speed) ? r.speed : 1,
    stat: stats(r.stat),                      // 쌓인 기록 (도전 과제용 · 2026-11-11 야간)
    owned: ownedKeys(r.owned),                // 가진 꾸미기 'hat:crown' (용 시장 · 명예의 전당 보상)
    cons: consObj(r.cons),                    // 편의품 개수
    look: lookStr(r.look),                    // 꾸민 모습 'h3.n1.b2.f4.r0.t7'
    clook: lookStr(r.clook),                  // 드래곤캐슬 꾸미기 (자리만 · 모으기 묶음에서 씀)
    title: str(r.title, 24, ''),              // 단 칭호 id
    tGot: [...new Set((Array.isArray(r.tGot) ? r.tGot : []).filter((x) => typeof x === 'string' && /^[a-z_]{1,24}$/.test(x)))].slice(0, 64),                    // 알림을 보여 준 칭호들 (새로 얻으면 로비에서 «칭호 획득!»)
    frameW: n0(r.frameW, 999999),
    weekTop: n0(r.weekTop, 999999),            // 주간 습격 10위 안에 든 주 (칭호 «이번 주 용사»)             // 주간 습격 테두리를 받은 주 (한 주에 한 번)
    raid: { w: n0(r.raid?.w, 999999), best: n0(r.raid?.best, 40) },   // 주간 습격 : 주 번호(년×100+주) · 그 주 최고 웨이브
    diff: ['easy', 'normal', 'hard', 'master'].includes(r.diff) ? r.diff : 'normal',   // 고른 난이도 (META 4장 · 잠긴 값은 battleSetup diffFor 가 조용히 보통으로)
    hardStars: starsStr(r.hardStars),           // 어려움 «붉은 별» (판마다 0~3)
    hardWon: bits(r.hardWon, 100),              // 새 어려움(11/13 · 2회차)으로 깬 판 — 옛 붉은 별로는 첫 클리어 보상(젬 · 칭호 · 초고수 열림)을 미리 주지 않는다
    masterStars: starsStr(r.masterStars),       // 초고수 «보라 별» (판마다 0~3 · 11/13)
    lvGifts: gifts(r.lvGifts),                  // 레벨 선물 받은 기록 { "10": "hat:ribbon", "20": "gem" } (§C-5 · 11/13)
    pvp: { w: n0(r.pvp?.w), l: n0(r.pvp?.l), d: n0(r.pvp?.d), day: str(r.pvp?.day, 10, ''), n: n0(r.pvp?.n, 99) },   // 드래곤 대결 전적 · 오늘 보상 판 수 (3차 M5)
  };
}

/** 레벨 선물 기록 : 열쇠 = 10 · 20 … 180 · 값 = 꾸미기 열쇠('hat:ribbon' · 'title:lv_moon') 또는 'gem'(다 가져서 젬) */
const GIFT_VAL = /^(gem|(hat|neck|breath|flag|frame|title|aura|pet|roof|gate|yard):[a-z0-9_]{1,24})$/;
function gifts(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [k, v] of Object.entries(raw)) { const n = Number(k); if (Number.isInteger(n) && n >= 10 && n <= 180 && n % 10 === 0 && typeof v === 'string' && GIFT_VAL.test(v)) out[String(n)] = v; }
  return out;
}

const maxStars = (a, b) => {
  const n = Math.max(a.length, b.length);
  let s = '';
  for (let i = 0; i < n; i++) s += String(Math.max(Number(a[i] || 0), Number(b[i] || 0)));
  return s;
};
const orBits = (a, b) => {
  const n = Math.max(a.length, b.length);
  let s = '';
  for (let i = 0; i < n; i++) s += a[i] === '1' || b[i] === '1' ? '1' : '0';
  return s;
};

/** 두 기기의 값 합치기 — 위 «병합 규칙» */
export function mergeIdg(localRaw, remoteRaw) {
  if (!remoteRaw) return localRaw ? normIdg(localRaw) : undefined;
  const a = normIdg(localRaw), b = normIdg(remoteRaw);
  const unitsOut = { ...a.units };
  for (const [k, v] of Object.entries(b.units)) {
    const u = unitsOut[k];
    unitsOut[k] = u ? [Math.max(u[0], v[0]), Math.max(u[1], v[1])] : v;
  }
  return {
    v: 1,
    coins: Math.max(a.coins, b.coins),
    gems: Math.max(a.gems, b.gems),
    cleared: Math.max(a.cleared, b.cleared),
    stars: maxStars(a.stars, b.stars),
    units: unitsOut,
    squadLv: Math.max(a.squadLv, b.squadLv),
    lab: a.lab.map((x, i) => Math.max(x, b.lab[i])),
    leader: remoteRaw.leader ? b.leader : a.leader,
    skills: remoteRaw.skills ? b.skills : a.skills,
    deck: remoteRaw.deck ? b.deck : a.deck,
    pity: remoteRaw.pity != null ? b.pity : a.pity,
    seen: orBits(a.seen, b.seen),
    quests: orBits(a.quests, b.quests),
    daily: a.daily > b.daily ? a.daily : b.daily,
    speed: remoteRaw.speed ? b.speed : a.speed,
    stat: Object.fromEntries(STAT_KEYS.map((k) => [k, Math.max(a.stat[k], b.stat[k])])),
    owned: [...new Set([...a.owned, ...b.owned])].slice(0, OWNED_MAX),   // 합집합 (산 걸 잃지 않게)
    cons: remoteRaw.cons ? b.cons : a.cons,
    look: remoteRaw.look ? b.look : a.look,
    clook: remoteRaw.clook ? b.clook : a.clook,
    title: remoteRaw.title ? b.title : a.title,
    tGot: [...new Set([...a.tGot, ...b.tGot])].slice(0, 64),
    frameW: Math.max(a.frameW, b.frameW),
    weekTop: Math.max(a.weekTop, b.weekTop),
    raid: a.raid.w !== b.raid.w ? (a.raid.w > b.raid.w ? a.raid : b.raid) : { w: a.raid.w, best: Math.max(a.raid.best, b.raid.best) },
    diff: remoteRaw.diff ? b.diff : a.diff,
    hardStars: maxStars(a.hardStars, b.hardStars),
    hardWon: orBits(a.hardWon, b.hardWon),
    masterStars: maxStars(a.masterStars, b.masterStars),
    lvGifts: { ...b.lvGifts, ...a.lvGifts },   // 합집합 (같은 레벨이면 이 기기 값 — 씨앗이 같아 보통 같은 값)
    pvp: { w: Math.max(a.pvp.w, b.pvp.w), l: Math.max(a.pvp.l, b.pvp.l), d: Math.max(a.pvp.d, b.pvp.d), day: a.pvp.day > b.pvp.day ? a.pvp.day : b.pvp.day,
      n: a.pvp.day === b.pvp.day ? Math.max(a.pvp.n, b.pvp.n) : a.pvp.day > b.pvp.day ? a.pvp.n : b.pvp.n },
  };
}
