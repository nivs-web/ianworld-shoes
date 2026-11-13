#!/usr/bin/env node
/**
 * 좀비와 드래곤 — 돈 맞춤 검사 (핵심 보조 ④ · 2026-11-13)
 *   node tools/idg-econ-check.mjs
 *
 * 하는 일
 *  1. 꾸미기 목록(catalog.js) 검사 : 184개 · 칸별 · 등급별 개수 · 얻는 곳 없는 물건 0 · lookFx 와 같은 id/등급 · «초고수» 글자 0 · 신화 = vis 'master'
 *  2. 구간별 벌이 (보통 = data/stages 보상 · 어려움 ×1.5 · 별 젬 8 · x-5 40 · x-10 100 · 초고수 ×2 · 10 · 80 · 200)를 별 평균 2 / 전부 3 으로
 *  3. 쓸 곳 (권장 키우기 = upgrades.js 값 · 꾸미기 = catalog 값) 과 대어 표로 — 목표(IDG_COLLECTION_PLAN §3.2 · §10)를 맞췄는지
 *  4. «?» 드래곤 숫자 카드 초안이 지금 전설 3마리와 같은 힘의 띠인지
 * 구조 검사(1 · 4)가 틀리면 exit 1. 돈 목표는 표로 보이고 «맞음 / 안 맞음»만 적는다(기획 판단).
 *
 * 값은 바꾸지 않는다 : 보통 보상 · 대장 드래곤 · 캐슬 · 장비 · 브레스 값은 기획서 표 그대로 — 꾸미기 값으로만 맞춘다.
 */
import { ECON } from '../src/games/iandragon_game/data/econ.js';
import { STAGES } from '../src/games/iandragon_game/data/stages/index.js';
import { UNITS } from '../src/games/iandragon_game/data/units.js';
import { CATALOG, MYSTERY, LEAD_FORMS, TIERS } from '../src/games/iandragon_game/data/catalog.js';
import { LOOK_FX, SLOT_IDS, lookBonus } from '../src/games/iandragon_game/data/lookFx.js';
import { TOTALS, REC_NORMAL, REC_HARD, recCost, recommendNext, upgradeLoad } from '../src/games/iandragon_game/data/upgrades.js';

const fails = [];
const ok = (cond, msg) => { if (!cond) fails.push(msg); return cond; };
const num = (v) => Math.round(v).toLocaleString('en-US');
const pct = (v) => `${Math.round(v * 100)}%`;
const table = (head, rows) => [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n');
const P = (...a) => console.log(...a);
const sum = (a) => a.reduce((x, y) => x + y, 0);

/* ═════════ 1. 꾸미기 목록 검사 ═════════ */
const WANT_SLOT = { hat: 30, neck: 24, breath: 16, aura: 18, pet: 18, flag: 24, roof: 18, gate: 18, yard: 18 };
const WANT_TIER = { common: 34, fine: 40, rare: 40, hero: 20, legend: 30, myth: 20 };
const OLD26 = ['hat:crown', 'hat:pirate', 'hat:wizard', 'hat:pumpkin', 'hat:helmet', 'hat:ribbon', 'hat:party', 'hat:viking', 'neck:cape', 'neck:scarf', 'neck:medal', 'neck:skull', 'neck:bow', 'neck:bell',
  'breath:rainbow', 'breath:ghost', 'breath:gold', 'breath:ice', 'flag:dragon', 'flag:moon', 'flag:skull', 'flag:star', 'flag:heart', 'flag:flame', 'flag:crown', 'flag:rainbow'];
const OLD_GEM = ['hat:crown', 'neck:skull', 'breath:gold', 'flag:skull'];
const count = (list, f) => list.reduce((o, r) => ((o[f(r)] = (o[f(r)] || 0) + 1), o), {});
const bySlot = count(CATALOG, (r) => r.slot), byTier = count(CATALOG, (r) => r.tier);
ok(CATALOG.length === 184, `물건 수 ${CATALOG.length} ≠ 184`);
for (const [k, v] of Object.entries(WANT_SLOT)) ok(bySlot[k] === v, `칸 ${k} : ${bySlot[k]} ≠ ${v}`);
for (const [k, v] of Object.entries(WANT_TIER)) ok(byTier[k] === v, `등급 ${k} : ${byTier[k]} ≠ ${v}`);
ok(new Set(CATALOG.map((r) => r.key)).size === CATALOG.length, '열쇠 겹침');
for (const k of OLD26) ok(CATALOG.some((r) => r.key === k), `옛 물건 빠짐 : ${k}`);
for (const k of OLD_GEM) ok(CATALOG.find((r) => r.key === k)?.tier === 'hero' && CATALOG.find((r) => r.key === k)?.from === 'start', `옛 젬 품목은 영웅 · 처음부터 판매 : ${k}`);
ok(Object.keys(LOOK_FX).length === 184 && Object.values(SLOT_IDS).flat().length === 185, 'lookFx 개수(184 + 기본 불꽃)');
for (const r of CATALOG) {
  const f = LOOK_FX[r.key];
  ok(f && TIERS[f.tier - 1] === r.tier && f.slot === r.slot, `lookFx 와 다름 : ${r.key}`);
  ok(!/초고수/.test(r.name) && !/master/i.test(r.id), `«초고수» 글자 : ${r.key}`);
  ok((r.tier === 'myth') === (r.vis === 'master'), `신화 ↔ vis master : ${r.key}`);
  ok(/^[a-z0-9_]{1,24}$/.test(r.id), `id 모양 : ${r.key}`);
  ok(r.name && r.name.length <= 12, `이름 길이(12자 이하) : ${r.key} «${r.name}»`);
  if (r.tier === 'legend' || r.tier === 'myth') ok(r.price === null, `전설 · 신화는 판매 안 함 : ${r.key}`);
  else ok(r.price && (r.price.coin > 0 || r.price.gem > 0), `값 없음 : ${r.key}`);
  if (r.tier === 'rare') ok(r.price.gem >= 60 && r.price.coin <= 5000, `희귀 = 젬 위주(젬 60+ · 코인 5,000 이하) : ${r.key}`);
  if (r.tier === 'hero' && !OLD_GEM.includes(r.key)) ok(r.price.coin === 0 && r.price.gem >= 150 && r.price.gem <= 250, `영웅 = 젬 150 ~ 250 : ${r.key}`);
}
/* 얻는 곳 합계 — 모든 물건이 정확히 하나의 얻는 곳(그리고 그 얻는 곳이 실제로 있는 판 · 조건)을 가진다 */
const FROM_OK = (r) => {
  const f = r.from;
  if (f === 'start' || f === 'hardReplay' || f === 'masterReplay' || f === 'stars900') return true;
  let m = /^normalW(\d+)(x5)?$/.exec(f); if (m) return +m[1] >= 1 && +m[1] <= 10 && r.w === +m[1];
  m = /^hardW(\d+)x(5|10)$/.exec(f); if (m) return +m[1] >= 1 && +m[1] <= 10 && r.w === +m[1];
  if (/^(hardFirstX5|hardFirstX10|masterFirstX10)$/.test(f)) return r.w >= 1 && r.w <= 10;
  return false;
};
const noFrom = CATALOG.filter((r) => !FROM_OK(r));
ok(noFrom.length === 0, `얻는 곳 없는 물건 ${noFrom.length}개 : ${noFrom.map((r) => r.key).join(', ')}`);
/* 진행표(§3.1) — 월드마다 보통 2 · 고급 2(+x-5 고급 1) / 희귀 4 / 영웅 2 / 첫 클리어 전설 x-5 1 · x-10 1 / 신화 x-10 1 */
const fromCount = count(CATALOG, (r) => `${r.from.replace(/\d+/, 'N')}:${r.tier}`);
for (let w = 1; w <= 10; w++) {
  const of = (f) => CATALOG.filter((r) => r.w === w && f(r));
  const nc = of((r) => r.from === `normalW${w}` && r.tier === 'common').length, nf = of((r) => r.from === `normalW${w}` && r.tier === 'fine').length;
  ok(nc === 2 && nf === (w === 10 ? 3 : 2), `보통 월드 ${w} 묶음 = 보통 2 · 고급 2 (월드 10 고급 3) : ${nc} · ${nf}`);
  ok(of((r) => r.from === `normalW${w}x5`).length === 1, `보통 ${w}-5 고급 1`);
  ok(of((r) => r.from === `hardW${w}x5` && r.tier === 'rare').length === 4, `어려움 ${w}-5 «붉은» 희귀 4`);
  const heroes = CATALOG.filter((r) => r.tier === 'hero' && (r.w === w || (r.from === 'start' && r.theme === ['hill', 'volcano', 'sky', 'ice', 'mine', 'grave', 'desert', 'swamp', 'crystal', 'castle'][w - 1])));
  ok(heroes.length === 2, `월드 ${w} 영웅 2 (어려움 ${w}-10 · 옛 젬 품목 포함) : ${heroes.length}`);
  ok(of((r) => r.from === 'hardFirstX5').length === 1 && of((r) => r.from === 'hardFirstX10').length === 1, `어려움 ${w}-5 · ${w}-10 첫 클리어 전설 1 · 1`);
  ok(of((r) => r.from === 'masterFirstX10').length === 1, `초고수 ${w}-10 첫 클리어 신화 1`);
}
ok(fromCount['hardReplay:legend'] === 10 && fromCount['masterReplay:myth'] === 9 && fromCount['starsN:myth'] === 1, '다시 깨기 전설 10 · 신화 9 · 별 900개 1');
ok(LEAD_FORMS.length === 20 && LEAD_FORMS.filter((f) => f.kind === 'purple').every((f) => f.vis === 'master'), '변신 모습 20 (보라 = vis master)');
ok(MYSTERY.length === 6 && MYSTERY.filter((m) => m.rar === 'secret').length === 3 && MYSTERY.filter((m) => m.rar === 'myth').length === 3, '«?» 드래곤 6 (secret 3 · myth 3)');
ok(MYSTERY.every((m) => !UNITS[m.id]), '«?» 드래곤 id 가 지금 카드와 겹치지 않음');

P('## 1. 꾸미기 목록 검사');
P(table(['칸', ...Object.keys(WANT_SLOT), '합'], [['개수', ...Object.keys(WANT_SLOT).map((k) => bySlot[k]), CATALOG.length], ['목표', ...Object.values(WANT_SLOT), 184]]));
P('');
P(table(['등급', ...Object.keys(WANT_TIER), '합'], [['개수', ...Object.keys(WANT_TIER).map((k) => byTier[k]), CATALOG.length], ['목표', ...Object.values(WANT_TIER), 184]]));
P('');
const fc = count(CATALOG, (r) => r.from.replace(/\d+/, 'N'));
P(table(['얻는 곳', ...Object.keys(fc), '없음'], [['개수', ...Object.values(fc), noFrom.length]]));
P('');

/* ═════════ 2. 벌이 ═════════ */
const W = Array.from({ length: 10 }, (_, i) => i + 1);
const stagesOf = (w) => STAGES.filter((s) => s.w === w);
const DIFF = {
  normal: { coin: 1, starCoin: ECON.starBonus, gemStar: ECON.gem.star, mid: ECON.gem.mid, boss: ECON.gem.boss },
  hard: { coin: 1.5, starCoin: 0, gemStar: 8, mid: 40, boss: 100 },        // 난이도 §A-4 (별 코인 덤 없음 — battle.js 어려움 · 초고수 계산 그대로)
  master: { coin: 2, starCoin: 0, gemStar: 10, mid: 80, boss: 200 },
};
/** 월드 w 첫 클리어 벌이 (stars = 판마다 별 평균) — 코인 · 젬 */
function earn(w, d, stars) {
  const D = DIFF[d];
  let coin = 0, gem = 0;
  for (const s of stagesOf(w)) {
    const base = s.reward.coins;   // = ECON.coin(g)
    coin += base * D.coin + base * D.starCoin * stars * D.coin;
    gem += D.gemStar * stars + (s.s === 5 ? D.mid : 0) + (s.s === 10 ? D.boss : 0);
  }
  return { coin, gem };
}
ok(STAGES.every((s) => s.reward.coins === ECON.coin(s.g)), 'stages 보상 = ECON.coin(g)');

/* 기존 키우기(출전 카드 레벨 · 용사단 · 연구소) — 계산기 gen-docs.js needAt 과 같은 셈 (참고 열) */
const UNLOCK = [['kkomul', 0], ['doldeung', 1], ['bulttong', 2], ['twetwe', 4], ['ssaeng', 7], ['bangul', 11], ['dungsil', 21], ['giljjuk', 26], ['eoreum', 31], ['jjirit', 41], ['banjjak', 51], ['kungkwang', 61]];   // docs/sim/stages.js
const expLevel = (g) => Math.floor(1 + 0.21 * (g - 1));
const sumLv = (a, b, mul = 1) => { let t = 0; for (let n = a; n < b; n++) t += ECON.lvCost(n) * mul; return t; };
const sumLab = (lv) => { let t = 0; for (let n = 0; n < Math.min(lv, ECON.labMax); n++) t += ECON.labCost(n); return t; };
function needAt(g) {
  const lv = expLevel(g), w = Math.ceil(g / 10);
  let units = 0;
  for (const u of UNLOCK) if (u[1] < g) units += sumLv(ECON.joinLv[Math.max(0, Math.ceil(Math.max(1, u[1] + 1) / 10) - 1)], lv);
  return units + sumLv(1, lv, ECON.squadMul) + ECON.labStats * sumLab(w - 1);
}

/* ═════════ 3. 쓸 곳 — 권장 키우기 ═════════ */
/* 권장 표 · 누적 값은 upgrades.js 와 같은 것 (REC_NORMAL = 보통 제안 · REC_HARD = §8.3) */
const costOf = recCost, REC_N = REC_NORMAL, REC_H = REC_HARD;

/* ═════════ 4. 쓸 곳 — 꾸미기 ═════════ */
const priceC = (r) => r.price?.coin || 0, priceG = (r) => r.price?.gem || 0;
const normalBundle = (w) => CATALOG.filter((r) => r.from === `normalW${w}` || r.from === `normalW${w}x5`);
const startNew = CATALOG.filter((r) => r.from === 'start' && !OLD26.includes(r.key));
const startOld = CATALOG.filter((r) => OLD26.includes(r.key));

/* ── 보통 ── */
P('## 2. 보통 한 바퀴 (100판 첫 클리어 · 별 평균 2 / 전부 3)');
P('');
let cum2 = 0, cum3 = 0, cumGem2 = 0, cumGem3 = 0, prevNeed = 0, prevRec = { coin: 0, gem: 0 };
const rowsN = [];
let themeTotal = 0, ruleBad = [];
for (const w of W) {
  const e2 = earn(w, 'normal', 2), e3 = earn(w, 'normal', 3);
  cum2 += e2.coin; cum3 += e3.coin; cumGem2 += e2.gem; cumGem3 += e3.gem;
  const need = needAt(10 * w + 1), dNeed = need - prevNeed; prevNeed = need;
  const rec = costOf(REC_N[w]), dRec = { coin: rec.coin - prevRec.coin, gem: rec.gem - prevRec.gem }; prevRec = rec;
  const b = sum(normalBundle(w).map(priceC)); themeTotal += b;
  const share2 = b / e2.coin, share3 = b / e3.coin;
  if (share2 < 0.25 || share2 > 0.35) ruleBad.push(`월드 ${w} 묶음 ${pct(share2)}`);
  const pc = CATALOG.find((r) => r.from === `normalW${w}` && r.tier === 'common'), pf = CATALOG.find((r) => r.from === `normalW${w}` && r.tier === 'fine');
  rowsN.push([w, num(e2.coin), num(e3.coin), `${num(e2.gem)} / ${num(e3.gem)}`, num(dNeed), `${num(dRec.coin)}${dRec.gem ? ` · 젬 ${dRec.gem}` : ''}`, `${num(priceC(pc))} / ${num(priceC(pf))}`, num(b), `${pct(share2)} / ${pct(share3)}`]);
}
P(table(['월드', '벌이 코인 ★2', '★3', '젬 ★2 / ★3', '기존 키우기(카드 · 연구소)', '권장 키우기(제안)', '값 보통 / 고급', '테마 묶음 합', '묶음 ÷ 벌이 ★2 / ★3'], rowsN));
const needAll = needAt(101), recN = costOf(REC_N[10]), startNewCost = sum(startNew.map(priceC)), oldCost = sum(startOld.map(priceC));
const theme70 = 0.7 * (themeTotal + startNewCost);
P('');
P(table(['', '★2', '★3'], [
  ['벌이 (코인)', num(cum2), num(cum3)],
  ['− 기존 키우기 (출전 카드 Lv21 · 용사단 · 연구소 — 계산기 needAt)', num(needAll), num(needAll)],
  ['− 권장 키우기 (사거리 5 · 캐슬 3 · 드래곤 Lv3 · 장비 1개 Lv1)', num(recN.coin), num(recN.coin)],
  ['= 꾸미기에 쓸 수 있는 돈', num(cum2 - needAll - recN.coin), num(cum3 - needAll - recN.coin)],
  ['보통 테마 묶음 합 (새 51개 + 처음 오라 1)', num(themeTotal + startNewCost), num(themeTotal + startNewCost)],
  ['  → 그중 살 수 있는 몫', pct((cum2 - needAll - recN.coin) / (themeTotal + startNewCost)), pct((cum3 - needAll - recN.coin) / (themeTotal + startNewCost))],
  ['(참고) 기존 키우기를 빼고 본 몫 (기획서 §7 셈)', pct((cum2 - recN.coin) / (themeTotal + startNewCost)), pct((cum3 - recN.coin) / (themeTotal + startNewCost))],
  ['젬 벌이 (별 · 중간 보스 · 월드 보스)', num(cumGem2), num(cumGem3)],
]));
P('');
P(`- 목표 «보통 한 바퀴 = 권장 + 보통 테마 약 70%» : 기존 키우기까지 넣으면 ★3 에서 ${pct((cum3 - needAll - recN.coin) / (themeTotal + startNewCost))} (★2 는 ${pct((cum2 - needAll - recN.coin) / (themeTotal + startNewCost))} — 나머지는 다시 깨기 40% · 황금 좀비 · 매일 보상으로) · 기존 키우기를 빼면 ★2 에서도 다 산다.`);
P(`- 규칙 «한 월드 묶음 = 그 월드 보통 벌이의 25 ~ 35%» : ${ruleBad.length ? `벗어남 — ${ruleBad.join(' · ')}` : '10개 월드 모두 안 (★2 기준 · ★3 기준으로도 25% 안팎)'}`);
P(`- 옛 26개 중 코인 품목 22개 합 ${num(oldCost)} (처음부터 판매 · 값 그대로) · 대장 드래곤 8마리 ${num(TOTALS.leads.coin)} (또는 젬 ${num(TOTALS.leads.gem)}) 는 «모으기» 여윳돈 몫.`);
P('');

/* ── 어려움 : 젬으로 희귀 · 영웅을 몇 판마다 하나 사나 ── */
P('## 3. 어려움 한 바퀴 — 권장 키우기 + 희귀 · 영웅 «몇 판마다 1개»');
P('');
function runHard(stars) {
  let coinBal = 0, gemBal = 0, prev = { coin: recN.coin, gem: recN.gem }, bought = 0, coinPart = 0;
  const owned = new Set(), rows = [];
  for (const w of W) {
    const rec = costOf(REC_H[w]), d = { coin: Math.max(0, rec.coin - prev.coin), gem: Math.max(0, rec.gem - prev.gem) }; prev = rec;
    coinBal -= d.coin; gemBal -= d.gem;   // 들어가기 전에 권장을 산다 (젬이 모자라면 권장이 먼저)
    const e = earn(w, 'hard', stars);
    coinBal += e.coin; gemBal += e.gem;
    /* 이 월드를 깨며 열린 것 = 어려움 w-5 희귀 4 · w-10 영웅 + 앞 월드에서 못 산 것. 싼 것부터 젬으로 */
    const shop = CATALOG.filter((r) => (r.tier === 'rare' || (r.tier === 'hero' && r.from !== 'start')) && r.w <= w && !owned.has(r.key)).sort((a, b) => priceG(a) - priceG(b));
    let n = 0;
    for (const r of shop) { if (gemBal < priceG(r)) break; gemBal -= priceG(r); coinPart += priceC(r); owned.add(r.key); n++; }
    bought += n;
    rows.push([w, num(e.coin), num(e.gem), `${num(d.coin)} · 젬 ${d.gem}`, num(coinBal), n, bought, num(gemBal)]);
  }
  return { rows, bought, coinBal, gemBal, owned, coinPart };
}
const H2 = runHard(2), H3 = runHard(3);
P('별 평균 2 (그 판들의 붉은 별 첫 획득 젬 8 · 보스 젬 40 / 100 · 코인 ×1.5 — 어려움은 별 코인 덤 없음)');
P('');
P(table(['어려움 월드', '벌이 코인', '벌이 젬', '권장 키우기 더 삼(§8.3)', '코인 누계(권장 뒤 · 보통 남은 돈 0 에서)', '산 희귀 · 영웅', '누계', '남은 젬'], H2.rows));
P('');
const rareHeroAll = CATALOG.filter((r) => r.tier === 'rare' || (r.tier === 'hero' && r.from !== 'start'));
const rhGem = sum(rareHeroAll.map(priceG)), rhCoin = sum(rareHeroAll.map(priceC));
P(table(['', '★2', '★3'], [
  ['어려움 100판 동안 산 희귀 · 영웅 (젬으로 · 싼 것부터)', `${H2.bought}개`, `${H3.bought}개`],
  ['→ 몇 판마다 1개', (100 / H2.bought).toFixed(1), (100 / H3.bought).toFixed(1)],
  ['희귀 · 영웅(새 56개) 중 몫', pct(H2.bought / rareHeroAll.length), pct(H3.bought / rareHeroAll.length)],
  ['그 물건들의 코인 몫 (희귀 코인 조금)', num(H2.coinPart), num(H3.coinPart)],
  ['코인 누계 (어려움 끝 · 권장 뒤 · 꾸미기 코인 빼기 전)', num(H2.coinBal), num(H3.coinBal)],
]));
P('');
P(`- 희귀 40 + 영웅(새) 16 전부 = 젬 ${num(rhGem)} · 코인 ${num(rhCoin)}. 권장 키우기(§8.3 · 10월드 끝) 누계 = 코인 ${num(costOf(REC_H[10]).coin)} · 젬 ${num(costOf(REC_H[10]).gem)}.`);
P(`- 목표 «희귀 · 영웅을 약 4 ~ 5판마다 1개» : ★2 ${(100 / H2.bought).toFixed(1)}판 · ★3 ${(100 / H3.bought).toFixed(1)}판 → ${100 / H2.bought >= 3.5 && 100 / H2.bought <= 5.5 ? '맞음' : '안 맞음'}`);
P(`- 코인 : 어려움 권장 키우기는 어려움 100판 코인(${num(sum(W.map((w) => earn(w, 'hard', 2).coin)))})보다 ${num(-H2.coinBal)} 더 든다 — 꾸미기로는 못 메운다(키우기 값은 기획서 그대로 두라는 지시). 다시 깨기 · 초고수 코인으로 채우는 구조(기획서 §7 «끝까지 다 갖추려면 다시 깨기»).`);
P('');

/* ── 초고수 : 젬이 크게 남지 않나 ── */
P('## 4. 초고수 한 바퀴 — 젬이 크게 남지 않나');
P('');
const M2 = sum(W.map((w) => earn(w, 'master', 2).gem)), M3 = sum(W.map((w) => earn(w, 'master', 3).gem));
const Mc = sum(W.map((w) => earn(w, 'master', 2).coin));
const leftRH2 = sum(rareHeroAll.filter((r) => !H2.owned.has(r.key)).map(priceG)), leftRH3 = sum(rareHeroAll.filter((r) => !H3.owned.has(r.key)).map(priceG));
const leadGemAlt = TOTALS.leads.gem;
P(table(['', '★2', '★3'], [
  ['초고수 100판 젬', num(M2), num(M3)],
  ['+ 어려움 끝에 남은 젬', num(H2.gemBal), num(H3.gemBal)],
  ['− 아직 안 산 희귀 · 영웅', num(leftRH2), num(leftRH3)],
  ['= 남는 젬 (부화장 · 대장 드래곤 젬 값 · 옛 젬 품목으로 갈 몫)', num(M2 + H2.gemBal - leftRH2), num(M3 + H3.gemBal - leftRH3)],
  ['(참고) 대장 드래곤 8마리를 젬으로 사면', num(leadGemAlt), num(leadGemAlt)],
  ['초고수 100판 코인 (×2)', num(Mc), num(Mc)],
]));
P('');
P(`- 목표 «초고수 젬이 크게 남지 않게» : 남는 젬 ★2 ${num(M2 + H2.gemBal - leftRH2)} · ★3 ${num(M3 + H3.gemBal - leftRH3)} = 알 ${Math.floor((M2 + H2.gemBal - leftRH2) / 100)} ~ ${Math.floor((M3 + H3.gemBal - leftRH3) / 100)}개 분량 — 초고수에서는 «+» 가 무효라 알은 새 카드 모으기용. 대장 드래곤 젬 값(${num(leadGemAlt)})과 겹치면 거의 0.`);
P('');

/* ═════════ 5. 꾸미기 효과 상한 · 판 시작 숫자 (보기) ═════════ */
P('## 5. 꾸미기 효과 · 판 시작 숫자 (보기)');
P('');
const allKeys = CATALOG.map((r) => r.key);
const full = { owned: allKeys, look: 'h30.n24.b17.a18.p18.f24', clook: 'o18.g18.y18', lead: { own: ['novart'], lv: { novart: 10 } }, castle: { lv: 10, gear: { cannon: 5, fence: 5, bell: 5 }, slots: ['cannon', 'fence', 'bell'] }, breathUp: { pow: 8, rng: 5, old: 0 }, cleared: 100 };
const lbN = lookBonus(full, 'hard'), lbM = lookBonus(full, 'master');
ok(lbN.guard <= 1.0801 && lbN.charge <= 1.0501 && lbN.baseHp <= 1.0801, `꾸미기 상한 (입은 것 5% + 가진 것 3%) : ${JSON.stringify(lbN)}`);
ok(lbM.guard === 1 && lbM.baseHp === 1 && lbM.breathRange === 0, '초고수 = 꾸미기 효과 0');
const u0 = upgradeLoad({}, { diff: 'normal' }), uF = upgradeLoad(full, { diff: 'hard', leader: 'novart' }), uP = upgradeLoad(full, { mode: 'pvp' });
ok(u0.breathRange === 0.6 && uF.breathRange === 1 && uP.breathRange === 1 && uP.guardDmg === 1, '브레스 사거리 : 처음 60% · 끝 100% · 대결 = 그대로');
const r1 = recommendNext({ cleared: 10 }), r2 = recommendNext({ ...full, cleared: 100, hardStars: '3'.repeat(100) }), r3 = recommendNext({ cleared: 100, breathUp: { rng: 5 } });
ok(r1?.kind === 'rng' && r1.to === 1 && r2 === null && r3?.kind === 'castle' && r3.to === 2, `추천 강화 : ${JSON.stringify([r1, r2, r3])}`);
const f2 = (v) => (typeof v === 'number' ? (Math.round(v * 1000) / 1000).toString() : v === null ? '—' : JSON.stringify(v));
P(table(['', '처음', '끝까지(어려움)', '끝까지(초고수)', '대결 · 주간'], ['atk', 'hp', 'baseHp', 'guardDmg', 'breathDmg', 'breathCharge', 'breathRange', 'baseArmor', 'thorns', 'baseRegen', 'cannon', 'bell'].map((k) => [k, f2(u0[k]), f2(uF[k]), f2(upgradeLoad(full, { diff: 'master', leader: 'novart' })[k]), f2(uP[k])])));
P('');

/* ═════════ 6. «?» 드래곤 힘의 띠 ═════════ */
P('## 6. «?» 드래곤 숫자 카드 초안 — 지금 전설 3마리와 같은 힘의 띠');
P('');
const legends = Object.entries(UNITS).filter(([, u]) => u.rar === 'legend');
const power = (u) => (u.hp * (u.revive ? 1 + u.revive.hp : 1) + (u.barrier || 0)) * (u.atk / (u.fore + u.back)) / u.cost;
const KEYS = ['cost', 'cd', 'hp', 'atk', 'range'];
const band = Object.fromEntries(KEYS.map((k) => [k, [Math.min(...legends.map(([, u]) => u[k])), Math.max(...legends.map(([, u]) => u[k]))]]));
const pBand = [Math.min(...legends.map(([, u]) => power(u))), Math.max(...legends.map(([, u]) => power(u)))];
const ABIL = ['area', 'splash', 'ld', 'wave', 'knock', 'slow', 'freeze', 'weaken', 'poison', 'purify', 'revive', 'barrier', 'kbImmune', 'survive', 'crit', 'bounty2'];
const abil = (u) => ABIL.filter((k) => u[k] != null && u[k] !== false).map((k) => (typeof u[k] === 'object' ? `${k}${JSON.stringify(u[k]).replace(/"/g, '')}` : u[k] === true ? k : `${k} ${u[k]}`)).join(' · ');
const KNOWN = new Set(['name', 'rar', 'role', 'keep', 'cost', 'cd', 'hp', 'atk', 'range', 'speed', 'fore', 'back', 'kb', 'forms', ...ABIL, 'strong', 'massive', 'tough', 'breaker', 'baseKiller', 'blast', 'knockVs']);
const rowsM = [];
for (const [id, u] of legends) rowsM.push([`(전설) ${u.name}`, ...KEYS.map((k) => u[k]), power(u).toFixed(0), abil(u)]);
for (const m of MYSTERY) {
  const c = m.card;
  for (const k of KEYS) ok(c[k] >= band[k][0] && c[k] <= band[k][1], `«?» ${m.name} ${k} ${c[k]} 이 전설 띠 ${band[k].join('~')} 밖`);
  ok(power(c) >= pBand[0] * 0.95 && power(c) <= pBand[1] * 1.05, `«?» ${m.name} 힘 지수 ${power(c).toFixed(0)} 이 전설 띠 밖`);
  for (const k of Object.keys(c)) ok(KNOWN.has(k), `«?» ${m.name} : 없는 효과 ${k}`);
  rowsM.push([`${m.rar === 'secret' ? '어려움' : '초고수'} ${m.name} (${m.id})`, ...KEYS.map((k) => c[k]), power(c).toFixed(0), abil(c)]);
}
P(table(['카드', ...KEYS, '힘 지수', '재주 (이미 있는 효과만)'], rowsM));
P('');
P(`힘 지수 = 체력(되살아남 · 방패 포함) × 한 번에 주는 피해 ÷ 공격 주기 ÷ 비용 — 전설 띠 ${pBand.map((v) => v.toFixed(0)).join(' ~ ')}`);
P('');

/* ═════════ 끝 ═════════ */
if (fails.length) { P(`## 검사 실패 ${fails.length}건`); for (const f of fails) P(`- ${f}`); process.exit(1); }
P('## 검사 : 모두 통과');
