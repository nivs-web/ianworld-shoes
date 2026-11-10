/* 생성 파일 — tools/idg-import-data.mjs 가 계산기(engine.js)에서 만든다. 손으로 고치지 말 것. */
/* 이안 드래곤 전투 코어 — 기준 AI(자동 전투) · 한 판 돌리기 · 상태 해시. 화면 · 소리 · 시계 · Pixi 를 모른다 (기획서 15.3). */
import { TICK, K, mulberry32, levelMul, formOf, formMul, powerMul, resolveDef, hasTrait, ZERO_BONUS, targetable, knock, countSide, distFromBase } from './rules.js';
import { createBattle } from './battle.js';
import { step } from './step.js';

/* ── 시험용 플레이어(AI). 사람 대신 단추를 누른다. 게임 본체에서는 "자동 전투"와 대전 봇으로 그대로 쓸 수 있다.
   pol = { walletTarget, react, sloppy, breathMin, useSkills, useRage }  */
function aiCommands(S, pi, pol, mem) {
  const p = S.players[pi], D = S.D, foe = 1 - p.side, out = [];
  mem.t = (mem.t || 0) - TICK;
  if (mem.t > 0) return out;
  mem.t = pol.react || 0.5;
  let near = 1e9, bossIn = false, nFoe = 0, foeFront = null;
  for (const u of S.units) {
    if (!targetable(u) || u.side !== foe) continue;
    const d = distFromBase(S, p.side, u);
    nFoe++; if (d < near) { near = d; foeFront = u; }
    if (u.boss) bossIn = true;
  }
  const danger = near < K.DANGER, calm = near > S.L * 0.6;
  const w = D.wallet[p.wl], maxMoney = w.max * p.B.walletMax;
  const wantWallet = S.stage.walletLock == null && p.wl < Math.min(pol.walletTarget == null ? 2 : pol.walletTarget, D.wallet.length - 1);
  let acted = false;
  if (wantWallet && !danger && p.money >= w.cost) { out.push({ p: pi, type: 'wallet' }); acted = true; }
  const saving = wantWallet && calm && S.t < 25;                       // 초반 : 적이 멀면 화로부터
  if (!acted && !saving && countSide(S, p.side, pi) < p.cap) {
    const ok = i => p.cd[i] <= 0 && p.money >= p.deck[i].def.cost && !(S.stage.costMax && p.deck[i].def.cost > S.stage.costMax);
    let pick = -1;
    if (pol.sloppy) {                                                  // 서툰 플레이 : 되는 대로 누른다
      const c = []; for (let i = 0; i < p.deck.length; i++) if (ok(i)) c.push(i);
      if (c.length) pick = c[Math.floor(S.rnd() * c.length)];
    } else {
      // 1) 방패 유지 : keep 마리까지. 방패에 쓰는 돈은 전체의 45% 까지(위험하면 제한 없음)
      if (danger || (mem.shield || 0) <= 0.45 * ((mem.total || 0) + 300)) {
        let best = -1;
        for (let i = 0; i < p.deck.length; i++) {
          const def = p.deck[i].def; if (!def.keep || !ok(i)) continue;
          let n = 0; for (const u of S.units) if (u.alive && u.side === p.side && u.owner === pi && u.def === def) n++;
          if (n < def.keep && (best < 0 || def.cost < p.deck[best].def.cost)) best = i;
        }
        pick = best;
      }
      // 2) 딜러 : 싼 것부터 차례로 "다음에 뽑을 것"을 정해 놓고 돈을 모은다
      if (pick < 0) {
        const dps = [];
        for (let i = 0; i < p.deck.length; i++) { const def = p.deck[i].def; if (!def.keep && def.cost <= maxMoney && !(S.stage.costMax && def.cost > S.stage.costMax)) dps.push(i); }
        dps.sort((a, b) => p.deck[a].def.cost - p.deck[b].def.cost || a - b);
        mem.wi = mem.wi || 0;
        for (let k = 0; k < dps.length; k++) {
          const i = dps[(mem.wi + k) % dps.length];
          if (p.cd[i] > 1.5) continue;                                 // 쿨타임이 한참 남았으면 다음 것
          if (ok(i)) { pick = i; mem.wi = (mem.wi + k + 1) % dps.length; }
          break;
        }
        if (pick < 0 && (danger || dps.length === 0 || p.money >= maxMoney * 0.9)) {   // 위험 · 딜러 없음 · 돈이 넘친다 : 지금 되는 것 중 제일 비싼 것
          for (let i = 0; i < p.deck.length; i++) if (ok(i) && (pick < 0 || p.deck[i].def.cost > p.deck[pick].def.cost)) pick = i;
        }
      }
    }
    if (pick >= 0) {
      out.push({ p: pi, type: 'spawn', i: pick });
      const c = p.deck[pick].def.cost; mem.total = (mem.total || 0) + c; if (p.deck[pick].def.keep) mem.shield = (mem.shield || 0) + c;
    }
  }
  if (p.breathT >= p.breathCharge) {
    let n = 0, b = false;
    for (const u of S.units) if (targetable(u) && u.side === foe && distFromBase(S, p.side, u) <= p.leader.range) { n++; if (u.boss) b = true; }
    if (n >= (pol.breathMin || 3) || b) out.push({ p: pi, type: 'breath' });
  }
  if (pol.useSkills) {
    for (let i = 0; i < p.skills.length; i++) {
      const s = p.skills[i]; if (s.left <= 0 || s.cdT > 0) continue;
      const sk = s.def;
      let n = 0;
      if (foeFront) for (const u of S.units) if (targetable(u) && u.side === foe && (!sk.radius || Math.abs(u.x - foeFront.x) <= sk.radius)) n++;
      const push = near < S.L * 0.4;
      if ((sk.dmg && (n >= 5 || (bossIn && n >= 2))) || (!sk.dmg && (push || (bossIn && near < S.L * 0.55)) && n >= 3)) { out.push({ p: pi, type: 'skill', i }); break; }
    }
  }
  if (pol.useRage !== false && p.rage >= K.RAGE_MAX && nFoe >= 3 && (near < S.L * 0.6 || bossIn)) out.push({ p: pi, type: 'rage' });
  return out;
}

/* 한 판 돌리기. policies[i] 가 없으면 그 플레이어는 가만히 있는다.
   돌려주는 값 : { win, time, baseLeft, enemyBaseLeft, timeout, ...통계 }  (win = side 0 승리) */
function simulate(stage, loads, D, policies, seed, onTick) {
  if (!Array.isArray(loads)) loads = [Object.assign({ side: 0 }, loads)];
  if (!Array.isArray(policies)) policies = [policies];
  const S = createBattle(stage, loads, D, seed);
  const mem = loads.map(() => ({}));
  while (!S.over) {
    const cmds = [];
    for (let i = 0; i < loads.length; i++) if (policies[i]) for (const c of aiCommands(S, i, policies[i], mem[i])) cmds.push(c);
    step(S, cmds);
    if (onTick) onTick(S);
  }
  const p0 = S.players[0].st;
  return {
    win: S.over.winner === 0, timeout: !!S.over.timeout, time: S.t,
    baseLeft: Math.max(0, S.base[0].hp) / S.base[0].maxHp, enemyBaseLeft: Math.max(0, S.base[1].hp) / S.base[1].maxHp,
    wl: S.players[0].wl, spawned: p0.spawned, lost: p0.lost, peak: p0.peak, breath: p0.breath, skill: p0.skill, rage: p0.rageUse,
    walletUps: p0.walletUps, earned: p0.earned, spent: p0.spent,
    enemySpawned: S.st.enemySpawned, kills: S.st.kills, bossAt: S.st.bossAt, firstHit: S.st.firstHit,
    minFront: S.st.minFront / S.L, swings: S.st.swings, players: S.players.map(p => p.st),
  };
}

// 상태 해시(멀티 동기 확인용) : 두 기기가 같은 틱에 같은 값을 내야 한다
function hashState(S) {
  let h = 2166136261 >>> 0;
  const mix = v => { h ^= (Math.round(v * 16) | 0); h = Math.imul(h, 16777619) >>> 0; };
  mix(S.base[0].hp); mix(S.base[1].hp);
  for (const p of S.players) { mix(p.money); mix(p.wl); mix(p.rage); }
  for (const u of S.units) { mix(u.id); mix(u.x); mix(u.hp); }
  return h;
}


export { aiCommands, simulate, hashState };
