/**
 * 부화장 검사 (B6 합격 기준) — node tools/idg-hatch-qa.mjs
 * ① 10만 번 뽑아(1만 번이면 ±1% 가 2σ 라 가끔 떨어진다) 희귀 70 · 슈퍼 25 · 전설 5% (±1%) ② 천장 : 어떤 운이어도 50번 안에 전설 ③ 젬 모자라면 못 깸 · 겹치면 + 1 (최대 10)
 */
import { roll, hatch, RATES, PITY } from '../src/services/iandragonHatch.js';

let bad = 0;
const ok = (c, msg) => { console.log(`${c ? '✔' : '✘'} ${msg}`); if (!c) bad++; };
/* ① 확률 (천장이 끼어들지 않게 매번 pity 0 에서) */
const N = 100000, cnt = { rare: 0, super: 0, legend: 0 };
for (let i = 0; i < N; i++) cnt[roll(0).rar]++;
for (const r of Object.keys(RATES)) ok(Math.abs(cnt[r] / N - RATES[r]) <= 0.01, `${r} ${(cnt[r] / N * 100).toFixed(1)}% (기대 ${RATES[r] * 100}%)`);
/* ② 천장 — 가장 나쁜 운(늘 희귀가 나오는 난수)으로도 50번째에 전설 */
let p = 0, at = -1;
for (let i = 1; i <= 60; i++) { const r = roll(p, () => 0.99); p = r.pity; if (r.rar === 'legend') { at = i; break; } }
ok(at > 0 && at <= PITY, `가장 나쁜 운에서 전설이 ${at}번째에 나옴 (천장 ${PITY})`);
/* ③ 젬 · 겹침 */
ok(hatch({ gems: 99 }, 1) === null, '젬 99 → 알 1개 못 깸');
ok(hatch({ gems: 899 }, 10) === null, '젬 899 → 10개 못 깸');
const h = hatch({ gems: 900, cleared: 15, units: { kkomul: [3, 0] } }, 10, () => 0.5);
ok(h && h.part.gems === 0 && h.results.length === 10, '젬 900 → 10개 · 젬 0');
const dupes = h.results.filter((r) => r.dup).length;
ok(dupes === 9 && h.part.units[h.results[0].id][1] === 9, `같은 용 10번 → 새 1 + 겹침 9 (+${h.part.units[h.results[0].id][1]})`);
const h2 = hatch({ gems: 100000, cleared: 15, units: {} }, 10, () => 0.5);
let s = h2.part; for (let i = 0; i < 5; i++) s = { ...s, cleared: 15, ...hatch({ ...s, cleared: 15 }, 10, () => 0.5).part };
ok(Object.values(s.units).every((u) => u[1] <= 10), '「+」 최대 10');
console.log(bad ? `✘ ${bad}개 실패` : '✔ 부화장 검사 통과');
process.exit(bad ? 1 : 0);
