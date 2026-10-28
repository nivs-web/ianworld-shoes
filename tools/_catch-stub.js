/**
 * `services/profile.js` 대역 — 캐치볼 화면 미리보기용 (`_catchscreen-preview.html`).
 * 드래곤 대역을 그대로 쓰고 캐치볼 칸과 함수만 얹는다.
 * `?cbest=N` 최고 기록 · `?cw=N` 대결 승 · `?cl=N` 대결 패
 */
import { get as baseGet, patch as basePatch } from './_dragon-stub.js';
export * from './_dragon-stub.js';

const q = new URLSearchParams(location.search);
basePatch({
  catchBest: Number(q.get('cbest') ?? 23),
  catchWins: Number(q.get('cw') ?? 4),
  catchLosses: Number(q.get('cl') ?? 2),
  catchTeam: q.get('team') ?? 'red',
});

export function finishCatchRun(score) { const p = baseGet(); return basePatch({ catchBest: Math.max(p.catchBest | 0, score | 0) }); }
export function recordCatchDuel(win) { const p = baseGet(); return basePatch(win ? { catchWins: (p.catchWins | 0) + 1 } : { catchLosses: (p.catchLosses | 0) + 1 }); }
export function setCatchTeam(team) { return basePatch({ catchTeam: team }); }
