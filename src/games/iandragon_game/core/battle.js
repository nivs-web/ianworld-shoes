/* 생성 파일 — tools/idg-import-data.mjs 가 계산기(engine.js)에서 만든다. 손으로 고치지 말 것. */
/* 이안 드래곤 전투 코어 — 판 만들기 · 유닛 · 피해 · 명령. 화면 · 소리 · 시계 · Pixi 를 모른다 (기획서 15.3). */
import { TICK, K, mulberry32, levelMul, formOf, formMul, powerMul, resolveDef, hasTrait, ZERO_BONUS, targetable, knock, countSide, distFromBase } from './rules.js';

/* stage  = { length, baseHp, mag(적 체력 배율), atkMag(적 공격 배율, 없으면 mag), lines:[{id,count,start,every,baseHpBelow,orAfter,bossHpBelow,delay,mag,boss}],
              bossShock, fever, capAlly, walletLock, costMax, startMoney, allySpeed, enemySpeed, limit, pvp }
   loads  = [{ side, deck:[{id,lv}], bonus, leader, leaderLv, skills:[id] }]   // PvE 1인 = 1개, 협동 = side 0 둘, 대전 = side 0 / side 1
   D      = { units, enemies, wallet, leaders, skills, startMoney, playerBaseHp }  */
function createBattle(stage, loads, D, seed) {
  const S = {
    t: 0, L: stage.length, stage, D, rnd: mulberry32(seed || 1), uid: 0, units: [],
    base: [{ hp: 0, maxHp: 0 }, { hp: 0, maxHp: 0 }], players: [], lines: [], over: null, boss: null,
    feverAt: stage.fever || 120,
    st: { enemySpawned: 0, kills: 0, bossAt: null, firstHit: null, minFront: stage.length, swings: 0, _dir: 0, _ext: 0, _sampleT: 0 },
  };
  const perSide = [0, 0];
  for (const ld of loads) perSide[ld.side]++;
  for (const ld of loads) {
    const B = Object.assign({}, ZERO_BONUS, ld.bonus || {});
    const leader = D.leaders[ld.leader || 'novart'];
    if (leader.passive) for (const k in leader.passive) { if (k === 'startMoney') B[k] += leader.passive[k]; else B[k] *= leader.passive[k]; }   // 리더 패시브
    const lmul = powerMul(ld.leaderLv || 1);
    const wl0 = stage.walletLock != null ? stage.walletLock : 0;
    S.players.push({
      side: ld.side, B, leader, lmul, wl: wl0,
      deck: ld.deck.map(d => ({ id: d.id, lv: d.lv, def: resolveDef(D.units[d.id], d.lv), mul: powerMul(d.lv) })),
      cd: ld.deck.map(() => 0),
      money: D.startMoney + B.startMoney + (stage.startMoney || 0),
      breathT: 0, breathCharge: leader.charge / B.breathCharge,
      skills: (ld.skills || []).map(id => ({ id, def: D.skills[id], left: D.skills[id].charges, cdT: D.skills[id].first || 0 })),
      rage: 0, rageT: 0,
      cap: Math.floor((stage.capAlly || K.CAP_UNITS) / perSide[ld.side]) + (perSide[ld.side] > 1 ? 1 : 0),
      st: { spawned: 0, lost: 0, breath: 0, walletUps: 0, skill: 0, rageUse: 0, earned: 0, spent: 0, peak: 0 },
    });
    // 기지 체력 : 리더 레벨을 따른다. 같은 편이 둘이면 더 높은 쪽 ×1.5
    const hp = Math.round(D.playerBaseHp * lmul * B.baseHp);
    const b = S.base[ld.side];
    b.maxHp = b.maxHp === 0 ? hp : Math.round(Math.max(b.maxHp, hp) * 1.5);
    b.hp = b.maxHp;
  }
  if (perSide[1] === 0) { S.base[1].hp = S.base[1].maxHp = stage.baseHp; }
  S.lines = (stage.lines || []).map(e => ({ ...e, left: e.count, next: e.start || 0, armed: e.baseHpBelow == null && e.bossHpBelow == null }));
  return S;
}

function makeUnit(S, def, side, mul, owner, amul) {
  const hp = Math.max(1, Math.round(def.hp * mul));
  if (amul == null) amul = mul;                                     // 공격 배율을 따로 주지 않으면 체력 배율과 같다
  return {
    id: ++S.uid, def, side, owner, mul, amul, hp, maxHp: hp, atk: Math.round(def.atk * amul),
    x: side === 0 ? K.SPAWN_X : S.L - K.SPAWN_X,
    state: 'walk', t: 0, slowT: 0, freezeT: 0, weakT: 0, boss: !!def.boss,
    barrier: def.barrier ? Math.round(def.barrier * mul) : 0,
    revived: false, survived: false, burrowed: false, burrowT: 0, corpseT: 0,
    alive: true, killer: null, killOwner: -1, selfKill: false,
  };
}

// 피해 한 번. src = 때린 유닛(없으면 브레스 · 스킬), o = { trueDmg, purify, pi(가해 플레이어) }
function applyHit(S, src, tgt, raw, o) {
  if (!targetable(tgt)) return;
  const sd = src ? src.def : null, td = tgt.def;
  let d = raw;
  if (sd) {
    if (hasTrait(td.traits, sd.strong)) d *= 1.5;
    if (hasTrait(td.traits, sd.massive)) d *= 3;
    if (td.strong && hasTrait(sd.traits, td.strong)) d *= 0.5;
    if (td.tough && hasTrait(sd.traits, td.tough)) d *= 0.25;
  }
  let crit = !!(o && o.trueDmg);
  if (sd && sd.crit && S.rnd() < sd.crit) { crit = true; d *= 2; }
  if (td.metal && !crit) d = 1;                                    // 강철 : 치명타가 아니면 1
  if (tgt.barrier > 0) {                                           // 방어막 : 한 방이 방어막 이상이어야 깨진다(그 한 방은 흡수)
    const breaker = sd && sd.breaker && S.rnd() < sd.breaker;
    if (d >= tgt.barrier || breaker || (o && o.trueDmg)) tgt.barrier = 0;
    return;
  }
  if (sd && sd.poison && !tgt.boss && !td.poisonImmune) d += tgt.maxHp * sd.poison;   // 독 : 최대 체력 비례 추가 피해
  const before = tgt.hp;
  tgt.hp -= d;
  if (tgt.hp <= 0 && td.survive && !tgt.survived) { tgt.survived = true; tgt.hp = 1; }
  if (tgt.hp <= 0) {
    tgt.alive = false; tgt.killer = sd; tgt.killOwner = src ? src.owner : (o && o.pi != null ? o.pi : -1);
    tgt.killPurify = !!((sd && sd.purify) || (o && o.purify)); tgt.killBounty = (sd && sd.bounty2) ? 2 : (o && o.bountyMul) || 1;
    return;
  }
  if (!td.kbImmune) {
    const step = tgt.maxHp / (td.kb || 1);                          // 넉백 : 최대 체력의 1/kb 를 잃을 때마다
    const crossed = Math.floor((tgt.maxHp - tgt.hp) / step) - Math.floor((tgt.maxHp - before) / step);
    if (crossed > 0) knock(tgt, 1);
    else if (sd && sd.knock && !tgt.boss && (!sd.knockVs || hasTrait(td.traits, sd.knockVs)) && S.rnd() < sd.knock) knock(tgt, 1);
  }
  const half = tgt.boss ? 0.5 : 1;                                  // 보스는 상태 이상 시간 절반
  if (sd && sd.slow && !td.slowImmune && S.rnd() < sd.slow.chance) tgt.slowT = Math.max(tgt.slowT, sd.slow.time * half);
  if (sd && sd.freeze && !td.freezeImmune && S.rnd() < sd.freeze.chance) tgt.freezeT = Math.max(tgt.freezeT, sd.freeze.time * half);
  if (sd && sd.weaken && !td.weakImmune && S.rnd() < sd.weaken.chance) tgt.weakT = Math.max(tgt.weakT, sd.weaken.time * half);
}


// 플레이어 명령. cmd = { p, type:'spawn'|'wallet'|'breath'|'skill'|'rage', i }
function applyCommand(S, cmd) {
  const p = S.players[cmd.p]; if (!p) return false;
  const D = S.D, foe = 1 - p.side;
  if (cmd.type === 'spawn') {
    const d = p.deck[cmd.i]; if (!d || p.cd[cmd.i] > 0 || p.money < d.def.cost) return false;
    if (S.stage.costMax && d.def.cost > S.stage.costMax) return false;   // 기믹 : 비용 제한
    if (countSide(S, p.side, cmd.p) >= p.cap) return false;
    p.money -= d.def.cost; p.st.spent += d.def.cost; p.cd[cmd.i] = d.def.cd / p.B.cooldown;
    const u = makeUnit(S, d.def, p.side, d.mul, cmd.p);
    u.hp = u.maxHp = Math.round(u.maxHp * p.B.hp); u.atk = Math.round(u.atk * p.B.atk);
    S.units.push(u); p.st.spawned++;
    return true;
  }
  if (cmd.type === 'wallet') {
    if (S.stage.walletLock != null) return false;
    const w = D.wallet[p.wl]; if (p.wl >= D.wallet.length - 1 || p.money < w.cost) return false;
    p.money -= w.cost; p.st.spent += w.cost; p.wl++; p.st.walletUps++;
    return true;
  }
  if (cmd.type === 'breath') {                                       // 리더 브레스 : 내 기지 앞 range 안의 적 전부
    if (p.breathT < p.breathCharge) return false;
    const ld = p.leader, dmg = ld.dmg * p.lmul * p.B.breathDmg;
    let top = null;
    for (const u of S.units) if (targetable(u) && u.side === foe && distFromBase(S, p.side, u) <= ld.range && (!top || u.hp > top.hp)) top = u;
    for (const u of S.units) {
      if (!targetable(u) || u.side !== foe || distFromBase(S, p.side, u) > ld.range) continue;
      let d = dmg;
      if (ld.focus && u === top) d *= ld.focus;
      if (ld.strongVs && hasTrait(u.def.traits, ld.strongVs)) d *= 2;
      const half = u.boss ? 0.5 : 1;
      applyHit(S, null, u, d, { trueDmg: ld.trueDmg, purify: ld.purify, pi: cmd.p, bountyMul: ld.bountyMul });
      if (!u.alive) continue;
      if (ld.kb) knock(u, ld.kb);
      if (ld.slow) u.slowT = Math.max(u.slowT, ld.slow * half);
      if (ld.freeze) u.freezeT = Math.max(u.freezeT, ld.freeze * half);
      if (ld.weaken) u.weakT = Math.max(u.weakT, ld.weaken * half);
    }
    p.breathT = 0; p.st.breath++;
    return true;
  }
  if (cmd.type === 'skill') {                                        // 장착 스킬 : 판마다 횟수 제한
    const s = p.skills[cmd.i]; if (!s || s.left <= 0 || s.cdT > 0) return false;
    const sk = s.def;
    let front = null;                                                // 내 기지에 가장 가까운 적
    for (const u of S.units) if (targetable(u) && u.side === foe && (!front || distFromBase(S, p.side, u) < distFromBase(S, p.side, front))) front = u;
    for (const u of S.units) {
      if (!targetable(u) || u.side !== foe) continue;
      if (sk.radius && front && Math.abs(u.x - front.x) > sk.radius) continue;
      const half = u.boss ? 0.5 : 1;
      if (sk.dmg) applyHit(S, null, u, sk.dmg * p.lmul, { pi: cmd.p });
      if (!u.alive) continue;
      if (sk.kb) knock(u, sk.kb);
      if (sk.freeze) u.freezeT = Math.max(u.freezeT, sk.freeze * half);
      if (sk.slow) u.slowT = Math.max(u.slowT, sk.slow * half);
    }
    s.left--; s.cdT = sk.cd; p.st.skill++;
    return true;
  }
  if (cmd.type === 'rage') {                                         // 분노 포효
    if (p.rage < K.RAGE_MAX) return false;
    for (const u of S.units) if (targetable(u) && u.side === foe) knock(u, 1);
    p.rage = 0; p.rageT = K.RAGE_TIME; p.st.rageUse++;
    return true;
  }
  return false;
}


export { createBattle, makeUnit, applyHit, applyCommand };
