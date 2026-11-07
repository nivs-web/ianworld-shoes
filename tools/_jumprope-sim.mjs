/**
 * 줄넘기 챔피언 엔진 시험 (화면 없이 node 로). `node tools/_jumprope-sim.mjs`
 *
 *  1) 스테이지 10개 x 난이도 3 — «딱 맞게 누르면» 전부 통과하는가(공중에 있을 때 다시 누를 일이 없는가)
 *  2) 조금 흔들려 누르면(±0.06초) 등급이 어떻게 나오나
 *  3) 무한 줄넘기 300번 — 사람이 넘을 수 있는 박자인가
 *  4) 스테이지 코드 왕복 · 이상한 코드 거부
 *  5) 두 기기 병합(mergeJr) · 레벨 표
 */
import * as E from '../src/games/jumprope/engine.js';
import { STAGES, DIFFS, DIFF_KEYS, ROPES, LOOK_PARTS, encodeLook, decodeLook } from '../src/games/jumprope/data.js';
import { mergeJr, normJr } from '../src/services/jumpropeState.js';

let fails = 0;
const ok = (cond, msg) => { if (!cond) { fails++; console.log('  ✗', msg); } };

const shift = (seg, dv) => {
  const c = (v) => Math.max(E.SPEED_MIN, Math.min(E.SPEED_MAX, v + dv));
  const o = { ...seg };
  if (o.v != null) o.v = c(o.v); if (o.a != null) o.a = c(o.a); if (o.b != null) o.b = c(o.b);
  return o;
};
const playStage = (st, diff) => {
  const D = DIFFS[diff];
  return { ...st, judge: D.judge, hearts: Math.max(1, Math.min(5, st.hearts + D.hearts)), ring: D.ring ?? st.ring, segs: st.segs.map((s) => shift(s, D.speed)) };
};

/** 박자표를 정해진 누르기 오차로 넘어 본다 */
function run(beats, margin, noise = () => 0) {
  let jump = null, landed = -9, miss = 0, minGap = 9, airborneSkips = 0;
  const g = { perfect: 0, great: 0, good: 0 };
  for (let i = 0; i < beats.length; i++) {
    const b = beats[i];
    if (b.kind !== 'd2') {
      const air = b.kind === 'd1' ? E.AIR_HIGH : E.AIR;
      const t = E.idealPress(b) + noise(i);
      if (t < landed) airborneSkips++;          // 아직 공중이라 못 누른다
      else { minGap = Math.min(minGap, t - landed); jump = { t, air }; landed = t + air; }
    }
    const r = E.judgeCrossing(b.t, jump && jump.t <= b.t ? jump : null, margin, b.apex);
    if (r.ok) g[r.grade]++; else { miss++; jump = null; landed = -9; }
  }
  return { miss, minGap, airborneSkips, ...g };
}

console.log('1) 스테이지 x 난이도 — 딱 맞게 누르기');
for (const st of STAGES) {
  const line = [];
  for (const d of DIFF_KEYS) {
    const ps = playStage(st, d);
    const beats = E.buildBeats(ps, 7 + st.no * 13);
    const r = run(beats, E.JUDGE[ps.judge]);
    ok(r.miss === 0 && r.airborneSkips === 0, `${st.no}.${st.name} ${d}: 걸림 ${r.miss} · 공중 ${r.airborneSkips}`);
    ok(r.perfect === beats.length, `${st.no} ${d}: PERFECT ${r.perfect}/${beats.length}`);
    ok(r.minGap > 0.05, `${st.no} ${d}: 땅에 있는 틈 ${r.minGap.toFixed(3)}초`);
    line.push(`${DIFFS[d].label} ${beats.length}박 ${beats[beats.length - 1].t.toFixed(1)}초 틈${r.minGap.toFixed(2)}`);
  }
  ok(E.stageCount(st) === E.buildBeats(st).length, `${st.no}: stageCount`);
  console.log(`  ${st.no}. ${st.name.padEnd(7, ' ')} ${line.join(' | ')}`);
}

console.log('2) 흔들려 누르기 (±0.06초, 보통)');
for (const st of [STAGES[0], STAGES[5], STAGES[9]]) {
  const ps = playStage(st, 'normal');
  const beats = E.buildBeats(ps, 3);
  const rnd = E.seeded(99);
  const r = run(beats, E.JUDGE[ps.judge], () => (rnd() - 0.5) * 0.12);
  console.log(`  ${st.no}. P${r.perfect} G${r.great} g${r.good} 걸림${r.miss} / ${beats.length}`);
}
{
  /* 너무 일찍 · 너무 늦게는 걸려야 한다 */
  const beats = E.buildBeats({ segs: [{ k: 's', n: 5, v: 3 }] });
  ok(run(beats, E.JUDGE.n, () => -0.3).miss === 5, '0.3초 일찍 누르면 전부 걸림');
  ok(run(beats, E.JUDGE.n, () => +0.22).miss === 5, '0.22초 늦게 누르면 전부 걸림');
  ok(run(beats, E.JUDGE.e, () => +0.17).miss === 0, '넉넉 판정: 0.17초 늦어도 통과');
  ok(run(beats, E.JUDGE.h, () => +0.13).miss === 5, '빡빡 판정: 0.13초 늦으면 걸림');
  /* 2단 뛰기를 짧게 뛰면 둘째 줄에 걸린다 */
  const d = E.buildBeats({ segs: [{ k: 'd', n: 1, v: 3 }] });
  const short = { t: E.idealPress(d[0]), air: E.AIR };
  ok(E.judgeCrossing(d[1].t, short, E.JUDGE.n, d[1].apex).ok === false, '2단 뛰기를 짧게 뛰면 둘째 줄에 걸림');
  /* 멈칫: 박자대로(멈칫 무시) 뛰면 걸린다 */
  const f = E.buildBeats({ segs: [{ k: 's', n: 2, v: 3 }, { k: 'f', n: 1, v: 3 }] });
  const naive = { t: f[1].t + E.rotT(3) - E.AIR / 2, air: E.AIR };
  ok(E.judgeCrossing(f[2].t, naive, E.JUDGE.n, f[2].apex).ok === false, '멈칫을 무시하고 원래 박자로 뛰면 걸림');
}

console.log('3) 무한 줄넘기 300박 (난이도별)');
for (const d of DIFF_KEYS) {
  const rand = E.seeded(5);
  const beats = [];
  let seg = 0;
  while (beats.length < 300) {
    const last = beats[beats.length - 1];
    beats.push(...E.expandSeg(shift(E.endlessSeg(beats.length, rand), DIFFS[d].speed), last ? last.t : 0, rand, seg++, seg > 1));
  }
  const r = run(beats, E.JUDGE[DIFFS[d].judge]);
  ok(r.miss === 0 && r.airborneSkips === 0, `무한 ${d}: 걸림 ${r.miss} 공중 ${r.airborneSkips}`);
  const kinds = beats.reduce((m, b) => ((m[b.kind] = (m[b.kind] || 0) + 1), m), {});
  console.log(`  ${DIFFS[d].label}: ${beats.length}박 ${beats[beats.length - 1].t.toFixed(0)}초 · 땅 틈 최소 ${r.minGap.toFixed(2)}초 · ${JSON.stringify(kinds)}`);
}

console.log('4) 스테이지 코드');
{
  const st = { name: '우리 반 대회', theme: 4, hearts: 2, judge: 'h', ring: false, segs: [{ k: 's', n: 9, v: 3 }, { k: 'r', n: 7, a: 5, b: 2 }, { k: 'u', n: 6, a: 6, b: 3 }, { k: 'f', n: 2, v: 4 }, { k: 'd', n: 3, v: 5 }] };
  const code = E.encodeStage(st);
  const back = E.decodeStage(`친구야 이거 해봐! ${code} 끝`);
  ok(code.startsWith('JR1-'), '코드 머리말');
  ok(back && back.name === st.name && back.theme === 4 && back.hearts === 2 && back.judge === 'h' && back.ring === false, '코드 왕복: 설정');
  ok(back && back.segs.length === 5 && back.segs[1].a === 2 && back.segs[1].b === 5, '코드 왕복: 랜덤 범위는 작은 쪽부터');
  ok(E.decodeStage('JR1-!!!!') === null && E.decodeStage('hello') === null && E.decodeStage('JR1-' + btoa('{"s":[]}')) === null, '이상한 코드 거부');
  const huge = E.sanitizeStage({ name: '<b>너무너무너무너무긴이름</b>', theme: 99, hearts: 50, judge: 'x', segs: Array.from({ length: 50 }, () => ({ k: 'd', n: 999, v: 99 })) });
  ok(huge.segs.length <= E.LIMITS.segs && E.stageCount(huge) <= E.LIMITS.total && huge.theme === 9 && huge.hearts === 5 && huge.judge === 'n' && !huge.name.includes('<'), `상한 자르기 (총 ${E.stageCount(huge)}박)`);
  console.log(`  코드 길이 ${code.length}자: ${code.slice(0, 40)}…`);
}

console.log('5) 병합 · 레벨 · 표');
{
  const a = normJr({ xp: 500, candy: 30, owned: ['rope:lemon'], stars: { normal: [3, 2, 0] }, endless: { hard: 40 }, rope: 'lemon', items: { shield: 2 } });
  const b = normJr({ xp: 300, candy: 80, owned: ['shirt:5'], stars: { normal: [1, 3, 1] }, endless: { hard: 12, easy: 70 }, rope: 'blue', items: { shield: 1, heart: 3 } });
  const m = mergeJr(a, b);
  ok(m.xp === 500 && m.candy === 80, '병합: 경험치 · 별사탕 큰 쪽');
  ok(m.owned.includes('rope:lemon') && m.owned.includes('shirt:5'), '병합: 산 것 합집합');
  ok(m.stars.normal.slice(0, 3).join() === '3,3,1', '병합: 별은 칸마다 큰 쪽');
  ok(m.endless.hard === 40 && m.endless.easy === 70, '병합: 무한 기록 큰 쪽');
  ok(m.rope === 'blue', '병합: 고른 줄넘기는 원격');
  ok(m.items.shield === 2 && m.items.heart === 3, '병합: 아이템 수 큰 쪽');
  ok(mergeJr(undefined, undefined) === undefined && mergeJr({ xp: 5 }, undefined).xp === 5, '병합: 한쪽만 있을 때');
  ok(normJr({ xp: -5, candy: 'abc', rope: 123, diff: 'evil' }).xp === 0 && normJr({ rope: 123 }).rope === 'red', '이상한 값 고치기');
  const lv = [];
  for (let n = 2; n <= 20; n += 3) lv.push(`Lv${n}=${E.xpToReach(n)}`);
  console.log('  레벨 표:', lv.join(' '));
  ok(E.levelFromXp(0).level === 1 && E.levelFromXp(E.xpToReach(20)).level === 20 && E.levelFromXp(1e9).level === 20, '레벨 1~20');
  const xpOne = E.xpFor({ perfect: 15, great: 4, good: 1, cleared: true, stageNo: 1, firstClear: true });
  console.log(`  스테이지 1 처음 깨면 경험치 약 ${xpOne} → Lv.${E.levelFromXp(xpOne).level}`);
  ok(new Set(ROPES.map((r) => r.id)).size === ROPES.length, '줄넘기 아이디 겹침 없음');
  const look = { skin: 2, hair: 3, hairColor: 5, eyes: 3, shirt: 9, pants: 5, shoes: 5, hat: 8, emoji: 9 };
  ok(JSON.stringify(decodeLook(encodeLook(look))) === JSON.stringify(look), '모습 한 줄 왕복');
  ok(LOOK_PARTS.every((p) => p.list.length <= 36), '꾸미기 부품 36개 이하(한 글자)');
  console.log(`  줄넘기 ${ROPES.length}개 · 레벨 보상 ${ROPES.filter((r) => r.get.lv).length} · 상점 ${ROPES.filter((r) => r.get.price).length} · 업적 3`);
}

console.log(fails ? `\n✗ 실패 ${fails}건` : '\n✓ 전부 통과');
process.exit(fails ? 1 : 0);
