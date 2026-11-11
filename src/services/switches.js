/**
 * 운영자 켜기/끄기 스위치 (2026-11-11 · 대표님 «관리자 페이지에서 재미 요소 17종을 체크박스로 켜고 끄게»)
 *
 * 난이도 설정(services/tuning.js)과 같은 방식이다 :
 *   config/switches/{group}/{key} = true | false     (없으면 그 칸의 기본값)
 *   쓰기는 운영자만(서버 규칙 docs/rtdb-rules.json) · 읽기는 앱에 들어올 때 한 번 → localStorage 캐시 → 게임은 동기로 읽는다.
 *   운영자가 바꾸면 그 화면엔 곧바로, 다른 사람은 다음 접속부터.
 * 여기에 키를 더하면 서버 규칙(config/switches)에도 같이 더한다 — `node tools/_rules-qa.mjs` 가 대조한다.
 */
import { getRtdb, configured, withTimeout } from './firebase.js';
import { currentUser } from './auth.js';

/** 좀비와 드래곤 재미 요소 17종 (id = render/fun.js 의 요소 id) */
const FUN = [
  ['bike', '달 앞 자전거'], ['wisps', '도깨비불 한 바퀴'], ['lightning', '번개 + 해골 구름'], ['bats', '박쥐 떼'], ['hand', '무덤 손 인사'],
  ['witch', '빗자루 마녀 좀비'], ['skelBroom', '빗자루 해골 좀비'], ['moon', '달님 표정'], ['boo', '유령 까꿍'], ['star', '별똥별'],
  ['cat', '유령 고양이'], ['owl', '부엉이'], ['pumpkin', '호박 등불'], ['cross', '십자가 좀비'], ['spider', '거미'], ['window', '성 창문 그림자 춤'], ['mole', '두더지 좀비'],
];

const SOUND_ON = ['owl', 'boo', 'lightning', 'bats', 'wisps', 'skelBroom', 'bike'];
/** 그룹 → { name, keys:[{key,name,def?}], def } — 칸마다 def 가 있으면 그것이 먼저 */
export const SWITCHES = {
  zdFun: { name: '좀비와 드래곤 · 재미 요소 (보이기)', def: true, keys: FUN.map(([key, name]) => ({ key, name })) },
  /* 소리 기본값 : 겜팀장 추천 7개만 켬 (대표님 11/11 «추천대로») — 다 켜면 시끄럽다 */
  zdFunSound: { name: '좀비와 드래곤 · 재미 요소 (소리)', def: false, keys: FUN.map(([key, name]) => ({ key, name, def: SOUND_ON.includes(key) })) },
  /* 대표님 2026-11-11 «오락실 풍 / 오케스트라 풍을 토글로 켜고 끄며 해 보고 정하겠다» — 켜짐 = 오케스트라(공개 녹음) · 꺼짐 = 오락실(합성) */
  /* 대표님 2026-11-11 «난이도를 관리자 페이지에서 켜고 끄게» — 꺼지면 모두 보통 · 고르기 단추 숨김 / 좀비 소리도 여기서 */
  zdOpt: { name: '좀비와 드래곤 · 기능', def: true, keys: [{ key: 'diff', name: '난이도 고르기 (쉬움 · 보통 · 어려움)' }, { key: 'zombieSfx', name: '좀비 소리 (등장 · 중얼 · 쓰러짐)' }, { key: 'speed2', name: '배속 단추 (×2) — 기본 켜짐 (11/11 대표님 «×2 배속 단추 다시 작동»)', def: true }] },
  /* 출격 이름 외침 (2026-11-11 대표님 «처음 15초만 이름, 그 뒤엔 다양한 출격 대사 · 관리자에서 10/15/20초 · 켜기/끄기/계속 켜기를 바꿔 보며 시험») */
  zdVoice: { name: '좀비와 드래곤 · 출격 이름 외침', def: true, keys: [{ key: 'nameOn', name: '이름 외침 켜기 (끄면 누를 때 옛 출격 대사만)' }, { key: 'nameAlways', name: '판 내내 이름 외침 (끄면 처음 몇 초만 · 시간은 아래 숫자)', def: false }] },
  zdBgm: { name: '좀비와 드래곤 · 배경음악', def: true, keys: [{ key: 'orchestra', name: '오케스트라 풍 (끄면 오락실 풍 — 운영자 시험용, 끄면 모두 오락실)' }, { key: 'edmDefault', name: '기본 배경음악 EDM (끄면 클래식) — 아이가 음향 설정에서 고르지 않았을 때', def: false }] },
};

/* 등장 빈도 (초) — 대표님 2026-11-11 «몇 초에 한 번씩 등장할지 관리자가 설정». 기본값 = 지금 게임 값 (render/fun.js DEFS 의 쉬는 시간) */
const EVERY = { bike: 40, wisps: 8, lightning: 30, bats: 7, hand: 10, witch: 35, skelBroom: 35, moon: 25, boo: 9, star: 5, cat: 30, owl: 15, pumpkin: 12, cross: 28, spider: 25, window: 30, mole: 20 };
/** 그룹 → { name, keys:[{key,name,def,min,max,step}] } — config/switches/{group}/{key} = 숫자 */
export const NUMBERS = {
  zdVoiceNum: { name: '좀비와 드래곤 · 목소리', keys: [{ key: 'nameSec', name: '판 시작 뒤 몇 초까지 이름 외침 (10 · 15 · 20)', def: 15, min: 10, max: 20, step: 5 }, { key: 'level', name: '음성(목소리) 말 많기 기본값 0~5 (0 말 없음 · 1 낱말만 · 2 아주 짧게 · 3 중요한 순간 · 4 대부분 · 5 전부) — 사용자가 고르면 그게 먼저', def: 2, min: 0, max: 5, step: 1 }] },
  zdFunEvery: {
    name: '좀비와 드래곤 · 재미 요소 등장 빈도 (초)',
    keys: [
      { key: 'all', name: '다음 요소가 나오기까지 (전체 간격)', def: 1.25, min: 0.5, max: 30, step: 0.25 },
      ...FUN.map(([key, name]) => ({ key, name: `${name} — 다시 나오기까지`, def: EVERY[key], min: 3, max: 300, step: EVERY[key] >= 20 ? 5 : 1 })),
    ],
  },
};

const ROOT = 'config/switches';
const CACHE_KEY = 'sf_switches';
const TIMEOUT_MS = 8000;
const isKey = (g, k) => !!SWITCHES[g]?.keys.some((x) => x.key === k);
const numDef = (g, k) => NUMBERS[g]?.keys.find((x) => x.key === k);

function sanitize(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const g of Object.keys(SWITCHES)) {
    const src = raw[g];
    if (!src || typeof src !== 'object') continue;
    for (const { key } of SWITCHES[g].keys) if (typeof src[key] === 'boolean') (out[g] ??= {})[key] = src[key];
  }
  for (const g of Object.keys(NUMBERS)) {
    const src = raw[g];
    if (!src || typeof src !== 'object') continue;
    for (const { key, min, max } of NUMBERS[g].keys) if (typeof src[key] === 'number' && src[key] >= min && src[key] <= max) (out[g] ??= {})[key] = src[key];
  }
  return out;
}

let vals = null;
function readCache() { try { return sanitize(JSON.parse(localStorage.getItem(CACHE_KEY) || 'null')?.v); } catch { return {}; } }
function writeCache() { try { localStorage.setItem(CACHE_KEY, JSON.stringify({ v: vals, at: Date.now() })); } catch { /* 막힌 환경 */ } }
function mem() { if (!vals) vals = readCache(); return vals; }

/** 지금 켜져 있나 (없으면 그룹 기본값) */
export function isOn(group, key) {
  const v = mem()[group]?.[key];
  if (typeof v === 'boolean') return v;
  const k = SWITCHES[group]?.keys.find((x) => x.key === key);
  return typeof k?.def === 'boolean' ? k.def : !!SWITCHES[group]?.def;
}
/** 그룹에서 꺼진 키 목록 */
export function offKeys(group) { return (SWITCHES[group]?.keys || []).filter(({ key }) => !isOn(group, key)).map(({ key }) => key); }
/** 숫자 설정 (없으면 기본값) */
export function num(group, key) { const v = mem()[group]?.[key]; return typeof v === 'number' ? v : numDef(group, key)?.def; }
/** 숫자 그룹 전부 { key: 값 } */
export function nums(group) { return Object.fromEntries((NUMBERS[group]?.keys || []).map(({ key }) => [key, num(group, key)])); }
/** 숫자 쓰기 — 운영자만. 범위 밖이면 거절 */
export async function setNum(group, key, v) {
  const d = numDef(group, key); if (!d || typeof v !== 'number' || v < d.min || v > d.max) return false;
  const m = mem(), prev = m[group]?.[key];
  (m[group] ??= {})[key] = v; writeCache();
  const fb = await rt(); let ok = false;
  if (fb) { try { await withTimeout(fb.dbMod.set(fb.dbMod.ref(fb.rtdb, `${ROOT}/${group}/${key}`), v), TIMEOUT_MS, '빈도 저장'); ok = true; } catch { ok = false; } }
  if (!ok) { if (prev === undefined) delete m[group][key]; else m[group][key] = prev; writeCache(); }
  return ok;
}
/** 그룹에서 켜진 키 목록 */
export function onKeys(group) { return (SWITCHES[group]?.keys || []).filter(({ key }) => isOn(group, key)).map(({ key }) => key); }

async function rt() {
  if (!configured()) return null;
  const u = currentUser();
  if (!u || u.guest) return null;
  return getRtdb();
}
async function fetchRemote() {
  const fb = await rt();
  if (!fb) return undefined;
  try {
    const snap = await withTimeout(fb.dbMod.get(fb.dbMod.ref(fb.rtdb, ROOT)), TIMEOUT_MS, '스위치 읽기');
    vals = sanitize(snap.val()); writeCache();
    return vals;
  } catch { return undefined; }
}

let loading = null;
/** 앱에 들어와 접속이 붙은 뒤 한 번 (main.js) */
export function loadSwitches() {
  if (!loading) loading = fetchRemote().then((v) => { if (v === undefined) loading = null; return mem(); });
  return loading;
}
/** 운영자 화면이 열릴 때 한 번 더 */
export async function refreshSwitches() {
  const v = await fetchRemote();
  if (v !== undefined) loading = Promise.resolve(vals);
  return v !== undefined;
}
/** 한 칸 쓰기 — 운영자만(서버 규칙). 거부되면 이 기기 값도 되돌린다 */
export async function setSwitch(group, key, on) {
  if (!isKey(group, key)) return false;
  const m = mem(), prev = m[group]?.[key];
  (m[group] ??= {})[key] = !!on; writeCache();
  const fb = await rt();
  let ok = false;
  if (fb) {
    try { await withTimeout(fb.dbMod.set(fb.dbMod.ref(fb.rtdb, `${ROOT}/${group}/${key}`), !!on), TIMEOUT_MS, '스위치 저장'); ok = true; } catch { ok = false; }
  }
  if (!ok) { if (prev === undefined) delete m[group][key]; else m[group][key] = prev; writeCache(); }
  return ok;
}
