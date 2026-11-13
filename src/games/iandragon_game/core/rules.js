/* 생성 파일 — tools/idg-import-data.mjs 가 계산기(engine.js)에서 만든다. 손으로 고치지 말 것. */
/* 이안 드래곤 전투 코어 — 상수 · 난수 · 레벨 배율 · 작은 도우미. 화면 · 소리 · 시계 · Pixi 를 모른다 (기획서 15.3). */
const TICK = 1 / 30;
const K = {
  KB_DIST: 90, KB_TIME: 0.35,       // 넉백 : 0.35초 동안 90wu 밀려난다(그동안 무적 · 조준 불가). 보스는 절반
  CAP_UNITS: 25, CAP_STAGE: 40,     // 진영당 필드 유닛 상한(플레이어) · 스테이지 적 상한
  SLOW_MUL: 0.4,                    // 감속 : 이동 속도 ×0.4
  WEAK_MUL: 0.5,                    // 약화 : 공격력 ×0.5
  BEHIND: 30,                       // 이만큼 지나친 적까지는 때릴 수 있다
  SPAWN_X: 10,                      // 기지 앞 10wu 에서 나온다
  DANGER: 450,                      // (AI 용) 적이 내 기지 450wu 안 = 위험
  FEVER1: 1.5, FEVER2: 2, FEVER_GAP: 30,   // 불꽃 타임 : 양쪽 공격력 ×1.5 → 30초 뒤 ×2
  RAGE_MAX: 100, RAGE_DEATH: 3, RAGE_BASE: 1,   // 분노 : 아군 1마리 쓰러질 때 +3, 기지 체력 1% 잃을 때 +1
  RAGE_TIME: 8, RAGE_ATK: 1.5, RAGE_SPEED: 1.3, // 포효 : 적 전체 넉백 + 8초간 아군 공격 ×1.5 · 이동 ×1.3
  BURROW_SEE: 220, BURROW_TIME: 1.2,            // 땅굴 : 아군이 220wu 안에 보이면 1.2초 숨었다가 전선 뒤로
  SHOCK_MUL: 2,                     // 보스 등장 충격파 : 넉백 시간 2배(=180wu)
  GUARD_FLY: 0.3, CANNON_FLY: 0.5,  // 드래곤캐슬 : 수호 불꽃 · 포탄이 날아가는 시간(쏜 자리에 떨어져 둘레를 친다)
  GUARD_VS: ['ghost', 'shadow'],    // 브레스 색 «유령 · 그림자에 +» 가 붙는 속성
  PVP_BOUNTY: 0.2,                  // 대전 : 상대 유닛 처치 시 그 유닛 비용의 20%
};

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 레벨 배율 : Lv1~10 +20%/레벨, Lv11~20 +10%/레벨, Lv21~30 +5%/레벨
function levelMul(lv) {
  if (lv <= 10) return 1 + 0.2 * (lv - 1);
  if (lv <= 20) return 2.8 + 0.1 * (lv - 10);
  return 3.8 + 0.05 * (lv - 20);
}
// 진화 : 2단(Lv10~) ×1.2, 3단(Lv20~) ×1.5 — 능력은 def.forms[1], def.forms[2] 가 덮어쓴다
function formOf(lv) { return lv >= 20 ? 2 : lv >= 10 ? 1 : 0; }
function formMul(lv) { return [1, 1.2, 1.5][formOf(lv)]; }
function powerMul(lv) { return levelMul(lv) * formMul(lv); }
function resolveDef(def, lv) {
  const f = formOf(lv);
  if (!def.forms || f === 0) return def;
  let out = { ...def };
  for (let i = 1; i <= f; i++) if (def.forms[i]) out = { ...out, ...def.forms[i] };
  return out;
}
function hasTrait(list, tr) {
  if (!tr || !list) return false;
  if (Array.isArray(tr)) { for (const t of tr) if (list.includes(t)) return true; return false; }
  return list.includes(tr);
}

// 드래곤캐슬 키우기(2026-11-13) 키 : guardDmg 수호 불꽃 × · breathRange 브레스 사거리 × · bossCap 브레스 한 번이 보스에게 주는 피해 ≤ 보스 최대 체력 × (0 = 없음)
//   baseArmor 기지가 받는 피해 × · baseRegen 기지 초당 회복(최대 체력 비율) · thorns 기지를 때린 적에게 되돌림 비율 · guardBounty 불(수호 불꽃 · 브레스)로 잡은 불씨 ×
const ZERO_BONUS = { income: 1, walletMax: 1, startMoney: 0, baseHp: 1, breathDmg: 1, breathCharge: 1, cooldown: 1, bounty: 1, atk: 1, hp: 1,
  guardDmg: 1, breathRange: 1, bossCap: 0, baseArmor: 1, baseRegen: 0, thorns: 0, guardBounty: 1 };

const targetable = u => u.alive && u.corpseT <= 0 && u.burrowT <= 0 && u.state !== 'kb';
function knock(u, mult) { if (u.def.kbImmune) return; u.state = 'kb'; u.t = K.KB_TIME * (mult || 1); }
function countSide(S, side, owner) { let n = 0; for (const u of S.units) if (u.alive && u.side === side && (owner == null || u.owner === owner)) n++; return n; }

const distFromBase = (S, side, u) => side === 0 ? u.x : S.L - u.x;      // side 기지에서 u 까지

export { TICK, K, mulberry32, levelMul, formOf, formMul, powerMul, resolveDef, hasTrait, ZERO_BONUS, targetable, knock, countSide, distFromBase };
