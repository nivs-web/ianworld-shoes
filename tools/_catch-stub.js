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
  catchBestEasy: 31, catchBestHard: 9, catchDifficulty: q.get('diff') ?? 'normal',
});

export function finishCatchRun(r) { const p = baseGet(); return basePatch({ catchBest: Math.max(p.catchBest | 0, r?.score | 0) }); }
export function catchCombos(p) { return { easy: p.catchComboEasy | 0, normal: p.catchComboNormal | 0, hard: p.catchComboHard | 0 }; }
export function catchProgress(p) { return { bestLevel: Math.max(1, p.catchBestLevel | 0), bestStrikes: p.catchBestStrikes | 0, hats: p.catchHats || [0], balls: p.catchBalls || [0] }; }
export function saveCatchProgress(pr) { const p = baseGet(); return basePatch({ catchBestLevel: Math.max(p.catchBestLevel | 0, pr?.bestLevel | 0), catchBestStrikes: Math.max(p.catchBestStrikes | 0, pr?.bestStrikes | 0) }); }
export function saveCatchOwned(o) { return basePatch({ catchHats: o?.hats || [0], catchBalls: o?.balls || [0] }); }
export function setCatchLook(code, team) { return basePatch({ catchLook: code, ...(team ? { catchTeam: team } : {}) }); }
export function recordCatchDuel(win) { const p = baseGet(); return basePatch(win ? { catchWins: (p.catchWins | 0) + 1 } : { catchLosses: (p.catchLosses | 0) + 1 }); }
export function setCatchTeam(team) { return basePatch({ catchTeam: team }); }
export function setCatchDifficulty(d) { return basePatch({ catchDifficulty: d }); }
export function catchBests(p) { return { easy: p.catchBestEasy | 0, normal: Math.max(p.catchBestNormal | 0, p.catchBest | 0), hard: p.catchBestHard | 0 }; }
