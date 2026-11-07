/**
 * 운영자 난이도 설정 — 게임마다 손잡이 몇 개를 1~99 로 맞춘다. (2026-11-07, 권반장 지시)
 *
 * *"현재 적용된 건 다 50 으로 기본 셋팅. 1칸씩 올리면 중간 난이도 기준으로 아주 조금씩
 *   어려워지고, 그 비율에 맞춰 어려움 · 쉬움도 같이 어려워지는 거지"*
 *
 * ## 숫자 → 배율
 *
 *   배율 = 1.015 ^ (단계 − 50)      50 = 1.00(지금 그대로) · 1칸 ≈ 1.5% · 99 ≈ 2.07 · 1 ≈ 0.48
 *
 * **배율이 1보다 크면 어려워지는 쪽**이다. 게임은 이 배율을 자기 난이도 표(쉬움 · 보통 · 어려움)
 * 전부에 같이 곱하거나 나눈다 — 판정 창은 나누고, 적 속도는 곱한다. 그래서 50 은 언제나
 * "고치기 전 그대로" 이고, 쉬움 · 어려움 사이의 간격(비율)도 그대로 유지된다.
 *
 * ## 서버에 남는 것
 *
 *   config/tuning/{game}/{key} = 1~99 정수     (없으면 50)
 *
 * 쓰기는 **운영자만** — `admins/{uid}: true` 를 서버 규칙이 본다(`docs/rtdb-rules.json`).
 *
 * ## 읽기는 앱에 들어올 때 한 번 (비용 원칙)
 *
 * 구독하지 않는다. 접속이 붙은 뒤 한 번 읽어 localStorage 에 넣고(`loadTuning`), 게임은
 * 그 캐시를 **동기로** 읽는다(`tune`) — 판을 시작할 때 서버를 기다리지 않는다.
 * 오프라인이면 지난 캐시, 캐시도 없으면 전부 50.
 * 그래서 운영자가 바꾸면 **그 운영자 화면에는 곧바로**, 다른 사람은 **다음 접속부터** 먹는다.
 *
 * 이 파일은 DOM 을 모른다. 실패해도 게임에는 아무 영향이 없다(전부 50 으로 돈다).
 */

import { getRtdb, configured, withTimeout } from './firebase.js';
import { currentUser } from './auth.js';

export const TUNE_MIN = 1;
export const TUNE_MAX = 99;
export const TUNE_MID = 50;
/** 1칸에 곱해지는 값 */
export const TUNE_STEP = 1.015;

/**
 * 게임별 손잡이. `key` 는 서버 칸 이름이자 게임이 `tune(game, key)` 로 부르는 이름이다.
 * 여기에 키를 더하면 서버 규칙(`config/tuning`)에도 같이 더해야 한다 — 모르는 키는 규칙이 거부한다.
 * (`node tools/_rules-qa.mjs` 가 둘을 대조한다)
 */
export const TUNING = {
  catch: [
    { key: 'throw', name: '던지기', desc: '초록 칸 · 흰 줄 · 옆 휨 폭' },
    { key: 'catch', name: '받기', desc: '글러브 크기 · 잡는 타이밍 · 공 퍼짐' },
    { key: 'speed', name: '스피드', desc: '공 빠르기 · 화살표 빠르기' },
  ],
  dragon: [
    { key: 'enemy', name: '적 속도·공격', desc: '좀비 · 화살 빠르기 · 맞으면 아픈 정도' },
    { key: 'hp', name: '적 체력', desc: '잡몹 · 중간보스 · 보스 맷집' },
    { key: 'spawn', name: '적 출현', desc: '한 번에 나오는 수 · 물결 간격' },
  ],
  jump: [
    { key: 'timing', name: '판정', desc: '박자 판정 엄격함' },
    { key: 'density', name: '줄 촘촘함', desc: '줄과 줄 사이 간격' },
    { key: 'speed', name: '곡 빠르기', desc: '곡 · 줄 빠르기' },
    { key: 'damage', name: '피해', desc: '걸렸을 때 깎이는 양' },
    { key: 'scroll', name: '내려오는 속도 · 간격', desc: '동그라미가 떨어지는 빠르기 — 빠를수록 동그라미 사이 간격도 넓어짐' },
  ],
  /* 점프 피아노 (2026-11-07) — 줄넘기 챔피언과 따로 맞춘다 */
  piano: [
    { key: 'timing', name: '판정', desc: '박자 판정 엄격함' },
    { key: 'density', name: '타일 촘촘함', desc: '타일과 타일 사이 간격' },
    { key: 'speed', name: '곡 빠르기', desc: '곡 · 타일 빠르기' },
    { key: 'damage', name: '피해', desc: '놓쳤을 때 깎이는 양' },
    { key: 'scroll', name: '내려오는 속도 · 간격', desc: '타일이 떨어지는 빠르기 — 빠를수록 타일 사이 간격도 넓어짐' },
  ],
};

/** 운영자 화면에 묶어 보여 줄 순서와 이름 */
export const TUNING_GAMES = [
  { id: 'catch', name: '캐치볼' },
  { id: 'dragon', name: '드래곤 스트라이커' },
  { id: 'jump', name: '줄넘기 챔피언' },
  { id: 'piano', name: '점프 피아노' },
];

const ROOT = 'config/tuning';
const CACHE_KEY = 'sf_tuning';
const READ_TIMEOUT_MS = 8000;

const isKey = (game, key) => !!TUNING[game]?.some((t) => t.key === key);

/** 1~99 정수로. 숫자가 아니면 null */
export function clampLevel(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.min(TUNE_MAX, Math.max(TUNE_MIN, Math.round(n)));
}

/** 단계 → 배율 (50 = 1) */
export function factor(lv) {
  const n = clampLevel(lv);
  return Math.pow(TUNE_STEP, (n ?? TUNE_MID) - TUNE_MID);
}

/**
 * 밖에서 들어온 값(서버 · 캐시)을 아는 칸만 남긴다.
 * 정수가 아니거나 범위를 벗어난 값은 **버린다**(50 으로 돈다) — 반올림해 살리면 규칙을 우회한
 * 값이 엉뚱한 난이도로 먹는다.
 */
function sanitize(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const game of Object.keys(TUNING)) {
    const g = raw[game];
    if (!g || typeof g !== 'object') continue;
    for (const { key } of TUNING[game]) {
      const v = g[key];
      if (typeof v === 'number' && Number.isInteger(v) && v >= TUNE_MIN && v <= TUNE_MAX) {
        (out[game] ??= {})[key] = v;
      }
    }
  }
  return out;
}

/* ---------- 캐시 (이 기기) ---------- */
let levels = null;

function readCache() {
  try { return sanitize(JSON.parse(localStorage.getItem(CACHE_KEY) || 'null')?.v); } catch { return {}; }
}
function writeCache() {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ v: levels, at: Date.now() })); } catch { /* 막힌 환경 */ }
}
function mem() {
  if (!levels) levels = readCache();
  return levels;
}

/** 지금 단계 (1~99, 없으면 50) */
export function level(game, key) {
  return mem()[game]?.[key] ?? TUNE_MID;
}

/** 지금 배율 — 1보다 크면 어렵게 */
export function tune(game, key) {
  return factor(level(game, key));
}

/** 한 게임의 배율을 한꺼번에 `{ key: 배율 }` — 게임을 띄울 때 opts 로 넘긴다 */
export function tunes(game) {
  const out = {};
  for (const { key } of TUNING[game] ?? []) out[key] = tune(game, key);
  return out;
}

/* ---------- 서버 ---------- */
async function rt() {
  if (!configured()) return null;
  const u = currentUser();
  if (!u || u.guest) return null;
  return getRtdb();
}

/** 서버에서 한 번 읽어 캐시를 통째로 바꾼다. 못 읽었으면 undefined (캐시 그대로) */
async function fetchRemote() {
  const fb = await rt();
  if (!fb) return undefined;
  try {
    const snap = await withTimeout(fb.dbMod.get(fb.dbMod.ref(fb.rtdb, ROOT)), READ_TIMEOUT_MS, '난이도 설정 읽기');
    levels = sanitize(snap.val());
    writeCache();
    return levels;
  } catch {
    return undefined;
  }
}

let loading = null;

/**
 * 앱에 들어와 접속이 붙은 뒤 **한 번** 부른다(`main.js`). 몇 번을 불러도 서버는 한 번만 읽는다.
 * 못 읽었으면(로그인 전 · 오프라인) 다음에 부를 때 다시 해 본다.
 * @returns {Promise<object>} 지금 단계들 (못 읽었으면 캐시)
 */
export function loadTuning() {
  if (!loading) {
    loading = fetchRemote().then((v) => {
      if (v === undefined) loading = null;
      return mem();
    });
  }
  return loading;
}

/**
 * 운영자 화면이 열릴 때 — 한 번 더 읽는다(다른 기기에서 바꿨을 수도 있다). 운영자 한 명만 부른다.
 * @returns {Promise<boolean>} 읽었는가
 */
export async function refreshTuning() {
  const v = await fetchRemote();
  if (v !== undefined) loading = Promise.resolve(levels);
  return v !== undefined;
}

/**
 * 한 칸 쓰기 — **운영자만**(서버 규칙이 막는다). 이 기기 캐시는 곧바로 바꾸고,
 * 서버가 거부하면 원래 값으로 되돌린다.
 * @returns {Promise<boolean>} 서버에 저장됐는가
 */
export async function setLevel(game, key, v) {
  const lv = clampLevel(v);
  if (lv === null || !isKey(game, key)) return false;
  const m = mem();
  const prev = m[game]?.[key];
  (m[game] ??= {})[key] = lv;
  writeCache();
  const fb = await rt();
  let ok = false;
  if (fb) {
    try {
      await withTimeout(fb.dbMod.set(fb.dbMod.ref(fb.rtdb, `${ROOT}/${game}/${key}`), lv), READ_TIMEOUT_MS, '난이도 설정 저장');
      ok = true;
    } catch { ok = false; }
  }
  if (!ok && m[game]?.[key] === lv) {
    if (prev === undefined) delete m[game][key]; else m[game][key] = prev;
    writeCache();
  }
  return ok;
}
