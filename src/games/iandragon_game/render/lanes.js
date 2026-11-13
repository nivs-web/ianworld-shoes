/**
 * 월드마다 바닥 · 캐릭터가 서는 높이 (11/12 대표님 «좋아! 이걸로 확정» · 그림 담당 ai/meta/lanes.json · 커밋 83f42e8)
 *
 *  front   = 그 월드 앞 겹 그림 (1 · 3 · 6 · 10 = 다시 그린 wNN_front_v3, 나머지 = 원래 wNN_front)
 *  spawnY  = [위, 아래] — 용 · 좀비 발 높이는 이 사이에서 고르게 무작위, 나온 뒤 걷는 동안 그대로. 그리기 순서는 y 가 클수록 앞.
 *  castleY = 성(둥지 · 좀비 성) 밑동 y (예전 GY + 10 = 450)
 *  nestY · towerY = 내 드래곤캐슬(둥지) · 좀비 기지 그림을 실제로 두는 y (그림 밑 가운데 · 11/13 대표님 «캐슬이 공중에 떠 있다» — 둥지 그림은 밑 15줄이 비어
 *                   castleY 에 두면 떠 보였다 → 맵마다 내림 · tools/_castle-seat-shot.mjs 로 점검). 없으면 castleY. 그리기 전용.
 *  floor   = 바닥 그림 위 · 아래 끝 (참고용)
 *
 * 발 높이는 «화면 전용»이다 — 코어(core/**)는 x 만 쓰고 y 를 모른다. 무작위는 Math.random 이 아니라 유닛 id(코어가 차례로 매김) 해시라
 * 같은 판(멀티 두 기기 · 다시 보기)이면 누구 화면이든 같은 유닛이 같은 줄에 선다. 코어의 씨앗 난수(S.rnd)는 건드리지 않는다.
 * lanes.json 을 못 받으면(오프라인 · R2 올리기 전) 아래 표를 쓴다 — lanes.json 을 고치면 이 표도 맞춰 둘 것.
 */
const AI = '/assets/iandragon_game/ai/';
const W = (front, floor, spawnY, castleY, nestY = castleY, towerY = castleY) => ({ front, floor, spawnY, castleY, nestY, towerY });
export const LANES = {
  '01': W('w01_front_v3.png', [436, 481], [440, 476], 450, 465, 464),
  '02': W('w02_front.png', [385, 450], [390, 436], 440, 455, 440),
  '03': W('w03_front_v3.png', [436, 481], [440, 476], 450, 465, 474),
  '04': W('w04_front.png', [390, 436], [400, 432], 432, 447, 432),   // lanes.json 과 맞춤 (위 끝 400)
  '05': W('w05_front.png', [432, 470], [434, 460], 450, 465),
  '06': W('w06_front_v3.png', [436, 481], [440, 476], 450, 465),
  '07': W('w07_front.png', [428, 480], [440, 476], 450, 465),
  '08': W('w08_front.png', [436, 462], [438, 460], 450, 465),
  '09': W('w09_front.png', [434, 472], [438, 452], 450, 465),
  '10': W('w10_front_v3.png', [436, 481], [440, 476], 450, 465),
};
let lanesP = null;
const ok = (w) => w && typeof w.front === 'string' && Array.isArray(w.spawnY) && w.spawnY.length === 2 && w.spawnY.every(Number.isFinite) && Number.isFinite(w.castleY);
/** 그 월드 줄 정보 (lanes.json 우선 · 없거나 틀리면 위 표) */
export function lanesFor(world) {
  const n = String(world).padStart(2, '0');
  lanesP ||= fetch(`${AI}meta/lanes.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  return lanesP.then((j) => { const w = j?.worlds?.[n]; return ok(w) ? { ...LANES[n], ...w } : LANES[n] || LANES['01']; });
}
/** 유닛 id → 0 이상 1 미만 (고르게 퍼지는 정수 해시 · mulberry32 한 번) */
function hash01(a) {
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
/** 발 높이 : spawnY 사이 고르게 (같은 id · 같은 월드면 언제나 같은 값) */
export function laneY(id, world, [y0, y1]) {
  return Math.round(y0 + hash01(Math.imul(id | 0, 0x9e3779b1) ^ (world * 7919)) * (y1 - y0));
}
