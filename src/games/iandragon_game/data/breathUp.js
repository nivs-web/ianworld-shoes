/**
 * «브레스 UP» 아이템 (대표님 11/13) — 같은 판(같은 난이도 · 같은 판 번호)을 드래곤캐슬이 무너져 연속으로 지면 아이템샵 편의품 칸에 나타난다.
 *
 * 저장 (profile.idg) — 모두 작은 칸 :
 *   lossRun : { 'normal:95': 3 }   «난이도:판번호(g)» → 연속으로 진 수 (이긴 판은 키를 지운다)
 *   lossAt  : 'normal:95'          가장 마지막에 진 판 (여러 판이 3연패 이상일 때 이 판 것을 보여 준다)
 *   bpUp    : 'normal:95:3'        산 아이템 «난이도:판번호:단계(1~3)» — 한 번에 1개 · 그 판을 시작하면 자동으로 쓰고 지운다
 * 효과는 코어를 건드리지 않고 판을 만들 때 리더 숫자(공격력 · 사거리 · 차는 시간)만 바꿔 넣는다 (render/battle.js).
 */
import { ECON } from './econ.js';

export const BP_MIN = 3;                       // 이만큼 연속으로 져야 보인다
export const BP_DIFFS = ['easy', 'normal', 'hard'];   // 초고수 · 멀티 · 대결 · 습격은 안 센다
export const BP_MULS = { easy: [1.3, 1.35, 1.4], normal: [1.3, 1.35, 1.4], hard: [1.15, 1.2, 1.25] };   // 3연패 · 4연패 · 5연패 이상 — 배율 · 이름(브레스N%UP)은 이 표 하나에서만 나온다
const COIN = { easy: 0.7, normal: 1, hard: 1.5 };   // battleSetup.js DIFF.coin 과 같은 값 (데이터 파일이 무거운 표를 물지 않게 복사 — tools 검사에서 대조)
const PRICE_K = [0.5, 0.75, 1];                // 단계 1 · 2 · 3 = 다시 깨기 코인의 50% · 75% · 100%
const DIFF_KO = { easy: '쉬움', normal: '보통', hard: '어려움' };

export const bpKey = (dk, g) => `${dk}:${g}`;
/** 'normal:95' → { dk, g } (이상한 값은 null) */
export function bpParse(key) {
  const m = /^(easy|normal|hard):(\d{1,3})(?::([123]))?$/.exec(String(key || ''));
  if (!m) return null;
  const g = Number(m[2]);
  return g >= 1 && g <= 200 ? { dk: m[1], g, tier: m[3] ? Number(m[3]) : 0 } : null;
}
/** 연속 패배 수 → 단계 (0 = 아직 안 보임) · 5연패부터는 6번째도 같은 최고 단계 */
export const bpTier = (n) => (n >= 5 ? 3 : n >= 4 ? 2 : n >= BP_MIN ? 1 : 0);
export const bpMul = (dk, tier) => BP_MULS[dk]?.[tier - 1] || 1;
export const bpPct = (dk, tier) => Math.round((bpMul(dk, tier) - 1) * 100);
export const bpName = (dk, tier) => `브레스${bpPct(dk, tier)}%UP`;
/** «보통 10-5» */
export const bpLabel = (dk, g) => `${DIFF_KO[dk] || ''} ${Math.floor((g - 1) / 10) + 1}-${((g - 1) % 10) + 1}`;
/** 값 (코인) — R = 바로 앞 판(g-1 · 1-1 이면 g)을 별을 다 받은 뒤 다시 깼을 때 받는 코인 × 단계 비율 · 10 단위 내림 */
export function bpPrice(dk, g, tier) {
  const R = ECON.coin(g > 1 ? g - 1 : g) * ECON.replay * (COIN[dk] || 1);
  return Math.floor((R * (PRICE_K[tier - 1] || 1)) / 10) * 10;
}
/** 지금 아이템샵에 보일 것 (한 번에 하나) : 가장 마지막에 진 판이 3연패 이상이면 그 판 · 아니면 3연패 이상 중 가장 많이 진 판 · 없으면 null */
export function bpOffer(idg) {
  const run = idg?.lossRun || {};
  let key = null;
  const at = bpParse(idg?.lossAt);
  if (at && (Number(run[idg.lossAt]) || 0) >= BP_MIN) key = idg.lossAt;
  else {
    let best = 0;
    for (const [k, v] of Object.entries(run)) { const n = Number(v) || 0; if (bpParse(k) && n >= BP_MIN && n >= best) { best = n; key = k; } }
  }
  if (!key) return null;
  const { dk, g } = bpParse(key), n = Number(run[key]), tier = bpTier(n);
  return { key, dk, g, n, tier, mul: bpMul(dk, tier), name: bpName(dk, tier), price: bpPrice(dk, g, tier), label: bpLabel(dk, g) };
}
/** 가지고 있는 아이템 (없으면 null) */
export function bpOwned(idg) {
  const p = bpParse(idg?.bpUp);
  if (!p || !p.tier) return null;
  return { key: bpKey(p.dk, p.g), dk: p.dk, g: p.g, tier: p.tier, mul: bpMul(p.dk, p.tier), name: bpName(p.dk, p.tier), label: bpLabel(p.dk, p.g), raw: idg.bpUp };
}
/** 이 판(난이도 · 판 번호)에서 쓸 아이템 (없으면 null) */
export const bpFor = (idg, dk, g) => { const o = bpOwned(idg); return o && o.dk === dk && o.g === g ? o : null; };
