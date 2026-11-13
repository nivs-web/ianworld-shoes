/* 생성 파일 — tools/idg-import-data.mjs 가 계산기(engine.js)에서 만든다. 손으로 고치지 말 것. */
/* 이안 드래곤 전투 코어 — 한 틱 (1/30초). 화면 · 소리 · 시계 · Pixi 를 모른다 (기획서 15.3). */
import { TICK, K, mulberry32, levelMul, formOf, formMul, powerMul, resolveDef, hasTrait, ZERO_BONUS, targetable, knock, countSide, distFromBase } from './rules.js';
import { makeUnit, applyHit, applyCommand } from './battle.js';

function step(S, cmds) {
  if (S.over) return;
  const D = S.D, L = S.L, stage = S.stage, units = S.units;
  S.t += TICK;
  const time = S.t;
  const fever = time >= S.feverAt + K.FEVER_GAP ? K.FEVER2 : time >= S.feverAt ? K.FEVER1 : 1;

  // ── 1. 자원 · 충전
  for (const p of S.players) {
    const w = D.wallet[p.wl];
    p.money = Math.min(w.max * p.B.walletMax, p.money + w.income * p.B.income * TICK);
    for (let i = 0; i < p.cd.length; i++) if (p.cd[i] > 0) p.cd[i] -= TICK;
    if (p.breathT < p.breathCharge) p.breathT += TICK;
    for (const s of p.skills) if (s.cdT > 0) s.cdT -= TICK;
    if (p.rageT > 0) p.rageT -= TICK;
  }

  // ── 2. 스테이지 적 등장
  for (const ln of S.lines) {
    if (!ln.armed) {
      if (ln.baseHpBelow != null && (S.base[1].hp <= S.base[1].maxHp * ln.baseHpBelow || (ln.orAfter != null && time >= ln.orAfter))) { ln.armed = true; ln.next = time + (ln.delay || 0); }
      else if (ln.bossHpBelow != null && S.boss && (!S.boss.alive || S.boss.hp <= S.boss.maxHp * ln.bossHpBelow)) { ln.armed = true; ln.next = time + (ln.delay || 0); }
    }
    if (ln.armed && ln.left > 0 && time >= ln.next && countSide(S, 1) < K.CAP_STAGE) {
      const u = makeUnit(S, D.enemies[ln.id], 1, (ln.mag || 1) * (stage.mag || 1), -1, (ln.mag || 1) * (stage.atkMag || stage.mag || 1));
      units.push(u); ln.left--; S.st.enemySpawned++;
      ln.next = time + (Array.isArray(ln.every) ? ln.every[0] + S.rnd() * (ln.every[1] - ln.every[0]) : (ln.every || 999));
      if (ln.boss) {
        u.boss = true; S.boss = u; S.st.bossAt = time;
        if (stage.bossShock !== false) for (const a of units) if (targetable(a) && a.side === 0) knock(a, K.SHOCK_MUL);   // 등장 충격파
      }
    }
  }

  // ── 3. 플레이어 명령 (먼저 : 누른 지 K.BREATH_WIND 틱이 된 브레스가 불을 뿜는다)
  for (let pi = 0; pi < S.players.length; pi++) {
    const p = S.players[pi];
    if (p.windT > 1) p.windT--;
    else if (p.windT === 1) applyCommand(S, { p: pi, type: 'breathFire' });
  }
  if (cmds) for (const c of cmds) applyCommand(S, c);

  // ── 4. 유닛 갱신 (타격은 모았다가 5에서 한꺼번에)
  const A = [], E = [];                                              // 조준 가능한 유닛 : A = side0 (x 큰 순), E = side1 (x 작은 순)
  for (const u of units) if (targetable(u)) (u.side === 0 ? A : E).push(u);
  A.sort((a, b) => b.x - a.x || a.id - b.id); E.sort((a, b) => a.x - b.x || a.id - b.id);
  const front0 = A.length ? A[0].x : 0;
  const hits = [];
  const rageSide = [false, false];
  for (const p of S.players) if (p.rageT > 0) rageSide[p.side] = true;
  for (const u of units) {
    if (!u.alive) continue;
    if (u.corpseT > 0) {                                             // 유령 : 쓰러졌다가 되살아난다
      u.corpseT -= TICK;
      if (u.corpseT <= 0) { u.hp = Math.max(1, Math.round(u.maxHp * u.def.revive.hp)); u.state = 'walk'; }
      continue;
    }
    if (u.burrowT > 0) {                                             // 땅굴 : 상대 전선 뒤로 솟아오른다
      u.burrowT -= TICK;
      if (u.burrowT <= 0) u.x = Math.max(60, Math.min(u.x, front0 - u.def.burrow));
      continue;
    }
    if (u.freezeT > 0) { u.freezeT -= TICK; continue; }
    const slow = u.slowT > 0; if (slow) u.slowT -= TICK;
    const weak = u.weakT > 0; if (weak) u.weakT -= TICK;
    const dir = u.side === 0 ? 1 : -1;
    if (u.state === 'kb') {
      u.x -= dir * (K.KB_DIST / K.KB_TIME) * TICK * (u.boss ? 0.5 : 1);
      u.x = Math.max(K.SPAWN_X, Math.min(L - K.SPAWN_X, u.x));
      u.t -= TICK; if (u.t <= 0) u.state = 'walk';
      continue;
    }
    let nd = 1e9, found = false;                                     // 가장 가까운 적까지의 거리
    if (u.side === 0) { for (const f of E) if (f.x >= u.x - K.BEHIND) { nd = Math.max(0, f.x - u.x); found = true; break; } }
    else { for (const f of A) if (f.x <= u.x + K.BEHIND) { nd = Math.max(0, u.x - f.x); found = true; break; } }
    const bd = u.side === 0 ? L - u.x : u.x;                         // 상대 기지 앞면까지
    const def = u.def;
    if (def.burrow && !u.burrowed && u.side === 1 && found && nd <= K.BURROW_SEE) { u.burrowed = true; u.burrowT = K.BURROW_TIME; continue; }
    if (u.state === 'walk') {
      if ((found && nd <= def.range) || bd <= def.range) { u.state = 'fore'; u.t = def.fore; }
      else {
        const sm = (u.side === 0 ? (stage.allySpeed || 1) : (stage.enemySpeed || 1)) * (slow ? K.SLOW_MUL : 1) * (rageSide[u.side] ? K.RAGE_SPEED : 1);
        u.x += dir * def.speed * sm * TICK;
      }
    } else if (u.state === 'fore') {                                 // 선딜 → 타격 → 후딜
      u.t -= TICK;
      if (u.t <= 0) { hits.push({ u, weak }); u.state = 'back'; u.t = def.back; }
    } else if (u.state === 'back') {
      u.t -= TICK; if (u.t <= 0) u.state = 'walk';
    }
  }

  // ── 5. 타격 적용
  for (const h of hits) {
    const u = h.u, def = u.def;
    if (!u.alive) continue;
    const dmg = u.atk * fever * (h.weak ? K.WEAK_MUL : 1) * (rageSide[u.side] ? K.RAGE_ATK : 1);
    const lo = def.ld ? def.ld[0] : -K.BEHIND;
    const hi = def.ld ? def.ld[1] : def.range + (def.area ? (def.splash || 0) : 0);
    const bd = u.side === 0 ? L - u.x : u.x;
    const list = [];
    for (const f of units) {
      if (f.side === u.side || !targetable(f)) continue;
      const ahead = u.side === 0 ? f.x - u.x : u.x - f.x;
      if (def.blast) { if (Math.abs(ahead) <= def.blast) list.push([ahead, f]); }
      else if (ahead >= lo && ahead <= hi) list.push([ahead, f]);
      else if (def.wave && ahead > hi && ahead <= hi + def.wave) list.push([ahead + 1e6, f]);
    }
    list.sort((a, b) => a[0] - b[0] || a[1].id - b[1].id);
    let hitBase = false;
    if (def.area || def.blast) {
      for (const [, f] of list) applyHit(S, u, f, dmg);
      hitBase = bd <= hi;
    } else if (list.length && list[0][0] < 1e6) {
      applyHit(S, u, list[0][1], dmg);
      for (const [a, f] of list) if (a >= 1e6) applyHit(S, u, f, dmg);       // 파동 : 사거리 밖 wave 까지 뒤따라 맞는다
    } else hitBase = bd <= def.range;
    if (hitBase) {
      const b = S.base[1 - u.side], d = dmg * (def.baseKiller ? 4 : 1);
      const before = b.hp;
      b.hp -= d;
      if (u.side === 0 && S.st.firstHit == null) S.st.firstHit = time;
      for (const p of S.players) if (p.side === 1 - u.side) {                // 기지가 맞으면 분노가 찬다
        p.rage = Math.min(K.RAGE_MAX, p.rage + K.RAGE_BASE * 100 * (before - Math.max(0, b.hp)) / b.maxHp);
      }
    }
    if (def.blast) { u.alive = false; u.killer = null; u.selfKill = true; }
  }

  // ── 6. 죽음 처리
  for (let i = units.length - 1; i >= 0; i--) {
    const u = units[i];
    if (u.alive) continue;
    if (u.def.revive && !u.revived && !u.killPurify && !u.selfKill) {          // 유령 부활(정화로 쓰러지면 안 일어난다)
      u.revived = true; u.alive = true; u.hp = 1; u.corpseT = u.def.revive.delay; u.killer = null; u.state = 'walk';
      continue;
    }
    const foes = S.players.filter(p => p.side !== u.side);
    if (u.owner < 0) {                                                         // 스테이지 적 → 처치 불씨(같은 편이 나눠 갖는다)
      S.st.kills++;
      for (const p of foes) {
        const gain = (u.def.bounty || 0) * p.B.bounty * (u.killBounty || 1) / foes.length;
        p.money = Math.min(D.wallet[p.wl].max * p.B.walletMax, p.money + gain); p.st.earned += gain;
      }
      if (u.def.onDeath) for (let n = 0; n < (u.def.onDeath.count || 1); n++) {
        const c = makeUnit(S, D.enemies[u.def.onDeath.id], 1, u.mul, -1, u.amul); c.x = Math.min(L - K.SPAWN_X, u.x + n * 14); units.push(c);
      }
    } else {
      const me = S.players[u.owner];
      if (!u.selfKill) { me.st.lost++; me.rage = Math.min(K.RAGE_MAX, me.rage + K.RAGE_DEATH); }
      for (const p of foes) {                                                  // 대전 : 상대 유닛을 잡으면 비용의 20%
        const gain = u.def.cost * K.PVP_BOUNTY;
        p.money = Math.min(D.wallet[p.wl].max * p.B.walletMax, p.money + gain); p.st.earned += gain;
      }
    }
    units.splice(i, 1);
  }

  // ── 통계(전선 흔들림)
  for (let pi = 0; pi < S.players.length; pi++) { const n = countSide(S, S.players[pi].side, pi); if (n > S.players[pi].st.peak) S.players[pi].st.peak = n; }
  let ef = L; for (const u of units) if (u.alive && u.side === 1 && u.x < ef) ef = u.x;
  if (ef < S.st.minFront) S.st.minFront = ef;
  if (time >= S.st._sampleT) {
    S.st._sampleT = time + 1;
    if (S.st._dir === 0) { S.st._ext = ef; S.st._dir = 1; }
    else if (S.st._dir === 1) { if (ef > S.st._ext) S.st._ext = ef; else if (ef < S.st._ext - 150) { S.st._dir = -1; S.st._ext = ef; S.st.swings++; } }
    else { if (ef < S.st._ext) S.st._ext = ef; else if (ef > S.st._ext + 150) { S.st._dir = 1; S.st._ext = ef; S.st.swings++; } }
  }

  // ── 7. 승패
  if (S.base[1].hp <= 0 && S.base[0].hp <= 0) S.over = { winner: -1 };
  else if (S.base[1].hp <= 0) S.over = { winner: 0 };
  else if (S.base[0].hp <= 0) S.over = { winner: 1 };
  else if (time >= (stage.limit || 300)) {
    const a = S.base[0].hp / S.base[0].maxHp, b = S.base[1].hp / S.base[1].maxHp;
    S.over = { winner: stage.pvp ? (a > b ? 0 : a < b ? 1 : -1) : 1, timeout: true };
  }
}


export { step };
