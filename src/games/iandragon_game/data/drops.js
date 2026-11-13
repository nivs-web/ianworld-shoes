/**
 * 좀비와 드래곤 — 보상 · 떨어짐 계산 (모으기 진행 로직 · 2026-11-13 · IDG_UPGRADES_SPEC §8 · IDG_COLLECTION_PLAN §3 · §8 · §10)
 *
 * 화면 · 저장 · 전투 코어를 모르는 순수 함수 — `battle.js` 결과 처리가 판이 끝난 뒤에 동적 import 로 받는다(따로 묶음 · 전투 시작 속도에 영향 없음).
 * 난수는 **전투 씨앗과 따로** : 결과 때 `계정 id + 난이도 + 보스 판 다시 깬 횟수` 로 만든다 → 다시 하기 · 기기 바꿔 뽑기로 결과를 바꿀 수 없고, 전투 결정론도 건드리지 않는다.
 *
 * 받을 자격은 진행에서 계산한다(`grantProgress`) — 첫 클리어 확정 보상은 «조건이 참인데 안 가진 것»을 넣는 멱등 함수라
 * 합치기 · 기기 바꿈 · 놓친 보상도 다음 결과 때 저절로 채워진다.
 */
import { CATALOG, LEAD_FORMS, MYSTERY, TIER_KO, condMet, seesMaster } from './catalog.js';
import { MASTER_ON } from './features.js';   // 초고수 보류(11/13) : false 면 신화 · 보라 모습 · myth · 신화 다시 깨기 · 초고수 게이지가 절대 안 나온다(코드는 남김)

/** 떨어짐 숫자 (SPEC §8 · §6) */
export const DROP = {
  hard: { from: 'hardReplay', p: 0.03, gauge: 25 },       // 어려움 보스 판 다시 깨기 : 전설 3% · 보물 게이지 25
  master: { from: 'masterReplay', p: 0.01, gauge: 60 },   // 초고수 보스 판 다시 깨기 : 신화 1% · 보물 게이지 60
  plus: 0.05,                                             // 어려움 보스 판 다시 깨기에서 가진 어려움 «?» 드래곤 하나에 «+1» (초고수는 «+» 무효라 없음)
  plusMax: 10,
  allDoneGems: 50,                                        // 다시 깨기 풀을 다 가졌을 때 «떨어질 차례»에 대신 받는 젬
  mysteryLv: 21,                                          // «?» 드래곤을 처음 얻을 때 레벨 (어려움 출전 바닥 Lv21 · 초고수도 같음)
};

/* ───────── 계정 id 씨앗 (전투 씨앗과 별개) ───────── */
function mulberry(a) {
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/** 글자 → 난수 함수 (같은 글자면 같은 순서) */
export function rngOf(text) {
  let h = 2166136261;
  for (const c of String(text)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return mulberry(h >>> 0);
}

const owns = (g, key) => Array.isArray(g?.owned) && g.owned.includes(key);
const stageNo = (w, s) => (w - 1) * 10 + s;
const bitAt = (s, n) => (typeof s === 'string' ? s : '')[n - 1] === '1';
const starAt = (s, n) => Number((typeof s === 'string' ? s : '')[n - 1]) > 0;

/** «?» 드래곤 첫 클리어 자격 (어려움 3-10 · 6-10 · 9-10 = hardWon · 초고수 4-10 · 7-10 · 10-10 = masterStars) */
export function mysteryDue(m, g) {
  if (g?.units?.[m.id]) return false;
  if (m.from === 'hardFirstX10') return bitAt(g?.hardWon, stageNo(m.w, 10));
  if (m.from === 'masterFirstX10') return seesMaster(g) && starAt(g?.masterStars, stageNo(m.w, 10));
  return false;
}

/**
 * 받을 자격이 있는데 아직 안 가진 것 (멱등) — g = 이번 판 결과까지 반영한 저장값.
 * 돌려줌 { rows: 꾸미기 줄들(전설 · 신화 · 별의 왕관), mystery: «?» 드래곤 줄들 }
 * 변신 모습(붉은 · 보라)은 진행(hardWon · masterStars)에서 계산이라 가질 것이 없다 — 글자는 formsFor 로.
 */
export function grantProgress(g) {
  const rows = CATALOG.filter((r) => r.from !== 'hardReplay' && r.from !== 'masterReplay' && !/^(normal|hardW)/.test(r.from) && r.from !== 'start'
    && !owns(g, r.key) && (r.vis === 'all' || seesMaster(g)) && condMet(r, g));
  return { rows, mystery: MYSTERY.filter((m) => mysteryDue(m, g)) };
}

/** 이번 판 x-10 첫 클리어로 새로 생긴 변신 모습 줄 (붉은 = 어려움 · 보라 = 초고수) — 저장 없음 · 결과 창 글자용 */
export function formsFor(dk, w) {
  const kind = dk === 'hard' ? 'red' : dk === 'master' && MASTER_ON ? 'purple' : null;
  return kind ? LEAD_FORMS.find((f) => f.kind === kind && f.w === w) || null : null;
}

/* ───────── 다시 깨기 (보스 판 x-5 · x-10 을 이미 깬 뒤) ───────── */
/** 같은 판(`kind` 'hard' | 'master')에서 지금 떨어질 수 있는 다시 깨기 풀 — 안 가진 것만 */
export const replayPool = (g, kind) => (kind === 'master' && !MASTER_ON ? [] : CATALOG.filter((r) => r.from === DROP[kind].from && !owns(g, r.key)));

/**
 * 보스 판 다시 깨기 한 번 (순수) — g = 지금 저장값 · kind = 'hard' | 'master' · uid = 계정 id.
 * 게이지 n 이 올라가고 « 3%(어려움) · 1%(초고수) » 또는 «n − at ≥ 25 · 60» 이면 안 가진 것 하나 확정 → at = n.
 * 풀을 다 가졌으면 게이지는 0 으로 멈춘 채(칸 = n − at = 0) 떨어질 차례에 젬 50.
 * 난수 순서는 고정(전설 굴림 → 고르기 → «+» 굴림 → «+» 고르기)이라 같은 (uid · kind · n) 이면 결과가 같다.
 * 돌려줌 { gauge: {n, at}, row|null, gems, full: 풀을 다 가짐, plus: {id, to}|null, fill: 지금 칸 수, cap }
 */
export function replayDrop(g, kind, uid) {
  if (kind === 'master' && !MASTER_ON) return { gauge: { ...(g?.bossGauge?.master || { n: 0, at: 0 }) }, row: null, gems: 0, full: false, plus: null, fill: 0, cap: DROP.master.gauge, off: true };   // 꺼짐 : 아무것도 안 바뀐다
  const D = DROP[kind], g0 = g?.bossGauge?.[kind] || { n: 0, at: 0 };
  const n = g0.n + 1, rnd = rngOf(`idg-drop:${uid || 'guest'}:${kind}:${n}`);
  const roll = rnd(), pick = rnd(), plusRoll = rnd(), plusPick = rnd();
  const pool = replayPool(g, kind);
  let row = null, gems = 0, at = g0.at;
  const full = pool.length === 0;
  if (full) { if (roll < D.p) gems = DROP.allDoneGems; at = n; }   // 다 모았다 : 게이지는 멈춤(0 칸) · 떨어질 차례엔 젬
  else if (roll < D.p || n - g0.at >= D.gauge) { row = pool[Math.floor(pick * pool.length)]; at = n; }
  let plus = null;
  if (kind === 'hard' && plusRoll < DROP.plus) {
    const own = MYSTERY.filter((m) => m.rar === 'secret' && g?.units?.[m.id] && (g.units[m.id][1] || 0) < DROP.plusMax);
    if (own.length) { const m = own[Math.floor(plusPick * own.length)]; plus = { id: m.id, name: m.name, to: (g.units[m.id][1] || 0) + 1 }; }
  }
  return { gauge: { n, at }, row, gems, full, plus, fill: n - at, cap: D.gauge };
}

/**
 * 이번 판 결과에서 받는 것 전부 (battle.js 가 부른다 · 순수).
 *  - after : 이번 판 별 · 첫 클리어 표시까지 반영한 저장값 (owned 는 이번 판 전)
 *  - ctx   : { dk, w, s, first, uid } — first = 이 난이도에서 새로 처음 깸
 * 돌려줌 { keys: [꾸미기 열쇠…], units: { id: [레벨, +] } | null, gems, lines: [«새로 열림» 글…], bossGauge: {…} | null, gauge: {kind, fill, cap} | null }
 * (도감 도장은 계산하지 않는다 — owned 에 붙인 뒤 battle.js 가 stampOf 로)
 */
export function resultDrops(after, ctx) {
  const out = { keys: [], units: null, gems: 0, lines: [], bossGauge: null, gauge: null, awake: [] };
  const { dk, w, s, first, uid } = ctx;
  const diffMode = dk === 'hard' || (dk === 'master' && MASTER_ON);
  /* 첫 클리어 확정 · 별 900 (조건이 참인데 안 가진 것 — 놓친 것도 같이 채움) */
  const due = grantProgress(after);
  for (const r of due.rows) { out.keys.push(r.key); out.lines.push(`${TIER_KO[r.tier]} «${r.name}»`); }
  for (const m of due.mystery) { (out.units ||= {})[m.id] = [DROP.mysteryLv, 0]; out.awake.push(m.id); out.lines.push(`드래곤 «${m.name}»`); }
  if (diffMode && first && s === 10) { const f = formsFor(dk, w); if (f && (f.vis === 'all' || seesMaster(after))) out.lines.push(`${f.kind === 'red' ? '붉은' : '보라'} 모습 «${f.name}»`); }
  /* 다시 깨기 : 어려움 · 초고수 보스 판(x-5 · x-10) · 첫 클리어가 아닐 때 */
  if (diffMode && !first && (s === 5 || s === 10)) {
    const kind = dk === 'hard' ? 'hard' : 'master', r = replayDrop(after, kind, uid);
    out.bossGauge = { ...(after.bossGauge || {}), [kind]: r.gauge };
    out.gauge = { kind, fill: r.fill, cap: r.cap, full: r.full };
    if (r.row) { out.keys.push(r.row.key); out.lines.push(`${TIER_KO[r.row.tier]} «${r.row.name}»`); }
    if (r.gems) { out.gems += r.gems; out.lines.push(`다 모았어요 · 젬 +${r.gems}`); }
    if (r.plus) { out.units = { ...(out.units || {}), [r.plus.id]: [after.units[r.plus.id][0], r.plus.to] }; out.lines.push(`드래곤 «${r.plus.name}» +1`); }
  }
  return out;
}

/* ───────── «?» 드래곤 실루엣 밝히기 (§10 더 하는 재미 ②) ───────── */
/**
 * 실루엣 밝기 단계 0 ~ 10 — 그 드래곤의 `span` 판(예 붉은별 = 어려움 1 ~ 30)에서 깬 판 수 ÷ 판 수를 10조각으로.
 * 어려움 «?» = 어려움을 새로 깬 판(hardWon) · 초고수 «?» = 보라 별을 딴 판. 얻었으면 10, 아직 «?» 카드 · 안 보이는 단계면 0.
 */
export function mysteryStep(g, id) {
  const m = MYSTERY.find((x) => x.id === id);
  if (!m) return 0;
  if (g?.units?.[id]) return 10;
  if (m.rar === 'myth' && !MASTER_ON) return 0;   // 초고수 꺼짐
  const isHard = m.rar === 'secret', [a, b] = m.span;
  let n = 0;
  for (let i = a; i <= b; i++) if (isHard ? bitAt(g?.hardWon, i) : starAt(g?.masterStars, i)) n++;
  return Math.floor((n / (b - a + 1)) * 10 + 1e-9);   // 10조각 (실루엣을 보여 주는지는 mysteryView 가 따로 정한다)
}
