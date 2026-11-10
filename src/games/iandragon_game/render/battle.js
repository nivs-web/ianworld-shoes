/**
 * 전투 한 판 (B2 · 2026-11-11 야간) — 코어 + 그리기 + HUD 를 묶는다.
 *
 * 고정 간격 루프 (기획서 15.3) : 화면은 매 프레임, 코어는 1/30초씩. 한 프레임 최대 6걸음(×2배속이면 12).
 * 명령(덱 · 화로 · 브레스 · 스킬 · 포효)은 모았다가 다음 걸음에 넣는다 — 코어가 정한 대로만 움직인다.
 * 판이 끝나면 별 · 코인을 저장(onSave)하고 결과 판을 띄운다.
 */
import { TICK, createBattle, step, aiCommands, hashState } from '../core/index.js';
import { createLockstep } from '../net/lockstep.js';
import { D } from '../data/battleData.js';
import { createBattleView, tagArt } from './battleView.js';
import { createHud } from './hud.js';
import { createBattleSound } from './battleSound.js';
import { makeLoads, starsFor, stageByNo, LAST_STAGE, pvpStage, pvpLoad, PVP_DAY, DIFF, diffFor } from './battleSetup.js';
import { isOn } from '../../../services/switches.js';
import { decodeLook, CONSUMABLES } from '../data/looks.js';
import { ECON } from '../data/econ.js';
import { tunes } from '../../../services/tuning.js';

tagArt(D);

/** opts = { stageNo, save, onSave(part), onExit(), restart(stageNo), text, net? }
 *  net = { seat, seats, seed, transport } — 멀티(3차 · 같이 깨기). 두 기기가 같은 씨앗 · 같은 편성으로 만들고 명령만 주고받는다(net/lockstep.js). */
export async function startBattle(ctx, opts) {
  /* 운영자 난이도 (50 = 그대로 · 높을수록 어렵게) — 코어는 그대로, 판에 넣는 숫자만 바꾼다 */
  const tz = opts.net ? { hp: 1, atk: 1, ember: 1, base: 1 } : tunes('zd');   // 멀티는 두 기기 숫자가 같아야 해서 운영자 손잡이를 쓰지 않는다
  const pvp = !!opts.net?.pvp;   // 용 대결 (3차 M5)
  const base0 = pvp ? pvpStage() : stageByNo(opts.stageNo);
  /* 난이도 : 혼자 할 때만 (멀티는 두 기기 숫자가 같아야 해서 보통) */
  const dk = opts.net ? 'normal' : diffFor(base0.g, opts.save, isOn('zdOpt', 'diff')), DF = DIFF[dk];
  const stage = { ...base0, mag: base0.mag * tz.hp * DF.mag, atkMag: (base0.atkMag || base0.mag) * tz.atk * DF.mag, diff: dk };
  const { deck, skills, loads, speedMax } = makeLoads(stage, opts.save);
  loads[0].bonus = { ...loads[0].bonus, income: loads[0].bonus.income / tz.ember, baseHp: loads[0].bonus.baseHp / tz.base };
  /* 멀티 : 자리마다 같은 편성을 하나씩 (같이 깨기 = 모두 side 0) */
  const net = opts.net || null, me = net ? net.seat : 0;
  /* 같이 깨기 : 좀비 세기 1.5배 (멀티 기획 2.1 · 계산기 2인 자동 28판 = 26승 — 혼자 26승과 같은 손맛) */
  const coop = !!net && !pvp && net.seats > 1;
  if (coop) { stage.mag *= 1.5; stage.atkMag *= 1.5; }
  if (net) { const one = loads[0]; loads.length = 0; for (let i = 0; i < net.seats; i++) loads.push(pvp ? pvpLoad(net.loads?.[i] || one, i) : { ...(net.loads?.[i] || one), side: 0 }); }   // 대결 = 0번 왼쪽 · 1번 오른쪽   // 서버 방 = 자리마다 받은 편성(ld) · 탭 시험 = 같은 편성
  const myDeck = pvp ? loads[me].deck : net?.loads?.[me]?.deck || deck;
  const allDragons = pvp || net?.loads ? [...new Map(loads.flatMap((l) => l.deck).map((d) => [d.id, d])).values()] : deck;
  const mirror = pvp && me === 1;   // 대결 : 누구나 자기가 왼쪽 (오른쪽 편은 화면만 뒤집는다)
  const S = createBattle(stage, loads, D, net ? net.seed : (Date.now() % 1e9) | 0);
  const ls = net ? createLockstep({ seat: me, seats: net.seats }) : null;
  const NET_GIVEUP = 12;   // 초 — 이만큼 아무 소식이 없으면 그 친구는 나간 것으로 보고 혼자 계속 (M4)
  const leave = (s) => { ls.drop(s); ui.netNote = '친구가 나갔어요 — 혼자 계속해요!'; ui.netNoteT = 4; };
  if (net) { net.transport.onMessage((from, str) => ls.receive(from, str)); net.transport.onLeave?.(leave); }
  let tickN = 0, sendT = 0, nextHash = 150, waitT = 0;
  const enemyIds = [...new Set(stage.lines.map((l) => l.id))];
  const view = await createBattleView(ctx, { world: stage.w, L: stage.length, dragons: allDragons, enemies: enemyIds, leader: loads[0].leader, pvp, mirror, foeLeader: pvp ? loads[1].leader : null, look: decodeLook(pvp ? (me === 0 ? opts.save?.look : net.loads?.[0]?.look) || '' : opts.save?.look || ''), lookR: decodeLook(pvp ? (me === 1 ? opts.save?.look : net.loads?.[1]?.look) || '' : '') });   // 내 대장 용 꾸미기 (모자 · 목 · 브레스 색)

  const sound = createBattleSound(stage, me);
  /* 멀티는 1배속 고정 */
  const ui = { me, side: pvp ? me : 0, net: !!net, speed: net ? 1 : Math.min(opts.save?.speed || 1, speedMax), paused: false, warn: 0, done: false, auto: false, intro: true };
  /* 자동 전투 (B6) : 별을 1개 이상 딴 스테이지만 — 기준 AI(코어 aiCommands)가 대신 누른다 */
  const canAuto = (Number((opts.save?.stars || '')[stage.g - 1]) || 0) > 0;
  const autoPol = { walletTarget: 3, useSkills: true, useRage: true }, autoMem = {};
  const cmds = [];
  let acc = 0, bossSeen = false, gone = false;
  const hud = createHud(ctx.host || opts.hudHost, { stage, deck: myDeck, leader: loads[me].leader, cons: net ? null : CONSUMABLES.filter((c) => (opts.save?.cons?.[c.id] || 0) > 0).map((c) => ({ ...c, n: opts.save.cons[c.id] })), foeDeck: pvp ? loads[1 - me].deck : null, foeLeader: pvp ? loads[1 - me].leader : null, skills: pvp ? loads[me].skills : net?.loads?.[me]?.skills || skills, text: opts.text, speedMax, canAuto }, {
    cmd(c) { if (S.over) return; if (net) { if (!ui.intro) ls.press(c, tickN); } else if (!ui.paused) cmds.push({ p: 0, ...c }); },
    go(useCons) {
      ui.intro = false; ui.paused = false; hud.hidePanel(); sound.start();
      /* 편의품 (META 3장 · 판마다 1개 · 혼자 하기만) — 판을 시작하며 1개 쓴다 · 도중에 나가도 돌려주지 않는다 */
      const have = opts.save?.cons?.[useCons] || 0;
      if (!net && useCons && have > 0) {
        const P = S.players[0];
        if (useCons === 'ember50') P.money += 50;
        else if (useCons === 'brazier') P.wl = Math.max(P.wl, Math.min(1, S.D.wallet.length - 1));
        else if (useCons === 'basehp') { S.base[0].maxHp = Math.round(S.base[0].maxHp * 1.05); S.base[0].hp = S.base[0].maxHp; }
        try { opts.save = opts.onSave?.({ cons: { ...opts.save.cons, [useCons]: have - 1 } }) || opts.save; } catch { /* */ }
      }
    },
    pause() { if (ui.done || ui.intro || net) return; ui.paused = !ui.paused; sound.pause(ui.paused); if (ui.paused) hud.showPanel('pause'); else hud.hidePanel(); },
    speed() { if (net) return; ui.speed = ui.speed >= speedMax ? 1 : ui.speed + 1; try { opts.save = opts.onSave?.({ speed: ui.speed }) || opts.save; } catch { /* */ } },   // 2배속 = 1-5 · 3배속 = 3-10 을 깨면 · 고른 배속은 기억
    auto() { if (canAuto) ui.auto = !ui.auto; },
    exit() { opts.onExit(); },
    retry() { opts.restart(stage.g); },
    next() { opts.restart(Math.min(LAST_STAGE, stage.g + 1)); },
    look(f) { view.setCam((mirror ? 1 - f : f) * view.FIELD - ctx.view.w / 2); },
  });

  /* 처음 하는 아이를 위한 한 줄 안내 (튜토리얼 최소판) — 해당 행동을 하면 사라진다 */
  const TIPS = [
    { g: 1, at: 'deck', text: '용 버튼을 눌러서 꼬물이를 내보내요!', done: () => S.players[me].st.spawned >= 2 },
    { g: 1, at: 'breath', text: '브레스가 꽉 찼어요! 눌러서 좀비를 태워요!', when: () => S.players[me].breathT >= S.players[me].breathCharge, done: () => S.players[me].st.breath > 0 },
    { g: 2, at: 'wallet', text: '화로를 올리면 불씨가 더 빨리 모여요!', when: () => S.players[me].money >= S.D.wallet[0].cost, done: () => S.players[me].wl > 0 },
    { g: 7, at: 'skill', text: '새 스킬 «운석»! 좀비가 몰려오면 눌러요.', when: () => S.t > 8, done: () => S.players[me].st.skill > 0 },
  ].filter((q) => q.g === stage.g && !(opts.save?.cleared >= stage.g));
  let tipT = 0;
  function tips(dt) {
    const q = TIPS.find((x) => !x.gone && (!x.when || x.shown || x.when()));
    if (!q) { ui.tip = ''; return; }
    q.shown = true; tipT += dt;
    if (q.done() || tipT > 12) { q.gone = true; tipT = 0; ui.tip = ''; return; }
    ui.tip = q.text; ui.tipAt = q.at;
  }

  function finish() {
    ui.done = true;
    if (pvp) { finishPvp(); return; }
    const win = S.over.winner === 0;
    const info = { t: S.t, hasNext: stage.g < LAST_STAGE, final: win && stage.g === LAST_STAGE };
    /* 쌓인 기록 (도전 과제) — 이겨도 져도 */
    const P0 = S.players[me], st0 = opts.save?.stat || {};
    const stat = { ...st0, kills: (st0.kills || 0) + S.st.kills, breath: (st0.breath || 0) + P0.st.breath, maxWl: Math.max(st0.maxWl || 0, P0.wl + 1),
      wins: (st0.wins || 0) + (win ? 1 : 0), boss: (st0.boss || 0) + (win && stage.s === 10 ? 1 : 0), hatch: st0.hatch || 0, coop: (st0.coop || 0) + (win && coop ? 1 : 0) };
    if (!win) { try { opts.save = opts.onSave?.({ stat }) || opts.save; } catch { /* */ } }
    if (win) {
      info.stars = starsFor(stage, S.t);
      const save = opts.save || {};
      /* 같이 깨기 보상 : 끌어 주기(내 다음 차례 판 = 별 1개로 첫 클리어) · 내 차례보다 뒤 판 = 다시 깨기 코인만(진행 안 건너뜀) · 별 2·3개는 혼자만 · 우정 +10% */
      const ahead = coop && stage.g > (save.cleared || 0) + 1, pull = coop && stage.g === (save.cleared || 0) + 1;
      if (coop) info.stars = pull ? 1 : 0;
      info.stars = Math.min(info.stars, DF.maxStar); info.diff = dk;
      if (dk === 'hard') {   /* 어려움 : 붉은 별은 따로 · 진행 · 보통 별은 그대로 · 코인 ×1.5 · 첫 어려움 클리어 젬 +5 */
        const hs = (save.hardStars || '').padEnd(stage.g, '0').split(''), hOld = Number(hs[stage.g - 1]) || 0;
        hs[stage.g - 1] = String(Math.max(hOld, info.stars));
        const base = ECON.coin(stage.g);
        info.coins = Math.round(base * (hOld ? ECON.replay : 1) * DF.coin); info.gems = hOld ? 0 : 5; info.red = true;
        const part = { hardStars: hs.join(''), coins: (save.coins || 0) + info.coins, gems: (save.gems || 0) + info.gems, stat };
        try { opts.save = opts.onSave?.(part) || { ...save, ...part }; } catch (e) { console.warn('[좀비와 드래곤] 저장 실패', e); }
        setTimeout(() => { if (gone) return; hud.showPanel('win', info); sound.stars(info.stars); }, 1600);
        return;
      }
      const stars = (save.stars || '').padEnd(stage.g, '0').split('');
      const old = Number(stars[stage.g - 1]) || 0, first = old === 0 && !ahead, newStars = Math.max(0, info.stars - old);
      stars[stage.g - 1] = String(Math.max(old, info.stars));
      /* 보상 (기획서 10장 ECON) : 첫 클리어 코인 · 다시 깨면 40% · 새 별 하나마다 +25% / 젬 : 새 별 5 · 중간 보스 20 · 월드 보스 50 (첫 클리어) */
      const base = ECON.coin(stage.g);
      info.coins = Math.round((base * (first ? 1 : ECON.replay) + base * ECON.starBonus * newStars) * (coop ? 1.1 : 1) * DF.coin);
      info.gems = newStars * ECON.gem.star + (first && stage.s === 5 ? ECON.gem.mid : 0) + (first && stage.s === 10 ? ECON.gem.boss : 0);
      /* 매일 첫 승리 : 젬 10 (한국 날짜) */
      const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
      if (save.daily !== today) { info.gems += 10; info.daily = true; }
      const part = { cleared: Math.max(save.cleared || 0, ahead ? 0 : stage.g), stars: (ahead ? save.stars || '' : stars.join('')), coins: (save.coins || 0) + info.coins, gems: (save.gems || 0) + info.gems, daily: today, stat };
      try { opts.save = opts.onSave?.(part) || { ...save, ...part }; } catch (e) { console.warn('[좀비와 드래곤] 저장 실패', e); }
    } else info.hint = loseHint(S, me);
    if (net && ls.mismatch() >= 0) info.hint = '연결이 어긋났어요 — 이 판은 기록하지 않아요. 한 판 더?';
    setTimeout(() => { if (gone) return; hud.showPanel(win ? 'win' : 'lose', info); if (win) sound.stars(info.stars); }, win ? 1600 : 900);
  }

  /* 용 대결 끝 : 승 200 · 무 120 · 패 80 코인 (하루 PVP_DAY 판까지) · 젬 없음 · 전적만 기록 */
  function finishPvp() {
    /* 시간 끝 · 둥지 체력이 같으면 → 잃은 용이 적은 쪽 승 (AI 대 AI 40판 : 무승부 38 → 0 · 좌우 20 : 20) */
    let w = S.over.winner;
    if (w === -1) { const l0 = S.players[0].st.lost, l1 = S.players[1].st.lost; w = l0 < l1 ? 0 : l1 < l0 ? 1 : -1; }
    const win = w === me, draw = w === -1, bad = ls.mismatch() >= 0;
    const save = opts.save || {}, today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
    const pv = { w: 0, l: 0, d: 0, n: 0, ...(save.pvp || {}) }; if (pv.day !== today) { pv.day = today; pv.n = 0; }
    const coins = bad || pv.n >= PVP_DAY ? 0 : win ? 200 : draw ? 120 : 80;
    if (!bad) {
      const rec = { w: pv.w + (win ? 1 : 0), l: pv.l + (!win && !draw ? 1 : 0), d: pv.d + (draw ? 1 : 0), day: today, n: pv.n + 1 };
      try { opts.save = opts.onSave?.({ coins: (save.coins || 0) + coins, pvp: rec }) || { ...save, pvp: rec }; } catch (e) { console.warn('[좀비와 드래곤] 저장 실패', e); }
    }
    const r = opts.save?.pvp || pv;
    const info = { t: S.t, pvp: true, coins, title: win ? '승리!' : draw ? '무승부' : '아쉬워요…',
      rec: `전적 ${r.w}승 ${r.l}패${r.d ? ` ${r.d}무` : ''}${pv.n >= PVP_DAY && !bad ? ' · 오늘 보상은 다 받았어요' : ''}`,
      hint: bad ? '연결이 어긋났어요 — 이 판은 기록하지 않아요.' : S.over.timeout ? '시간 끝 — 둥지 체력이 많은 쪽, 같으면 잃은 용이 적은 쪽이 이겨요.' : '' };
    setTimeout(() => { if (!gone) hud.showPanel(win ? 'win' : 'lose', info); }, 1400);
  }

  const tick = (ticker) => {
    const dt = Math.min(0.1, ticker.deltaMS / 1000);
    if (!ui.paused) {
      acc += dt * ui.speed;
      let n = 0;
      if (net) {   /* 멀티 : 모든 자리가 약속한 틱까지만 계산 (늦으면 기다렸다가 빨리 감기) */
        let waited = false;
        while (acc >= TICK && n < 6 && !S.over) { if (!ls.ready(tickN + 1)) { waited = true; break; } tickN++; step(S, ls.commandsAt(tickN)); acc -= TICK; n++; }
        if (acc > TICK * 90) acc = TICK * 90;
        waitT = waited ? waitT + dt : 0; ui.netWait = waitT;
        if (ui.netNote && (ui.netNoteT -= dt) < 0) ui.netNote = '';
        if (waitT > NET_GIVEUP) { for (const s of ls.late(tickN + 1)) leave(s); waitT = 0; }
        if ((sendT += dt) >= 0.2) { sendT = 0; let h = null; if (tickN >= nextHash) { h = [tickN, hashState(S)]; nextHash = tickN + 150; } net.transport.send(ls.packet(tickN, h)); }
      } else {
        while (acc >= TICK && n < 6 * ui.speed) { if (ui.auto && !S.over) cmds.push(...aiCommands(S, 0, autoPol, autoMem)); step(S, cmds.splice(0)); acc -= TICK; n++; }
        if (acc > TICK * 6) acc = 0;
      }
      if (S.boss && !bossSeen) { bossSeen = true; ui.warn = 0.9; }
      ui.warn -= dt;
      if (S.over && !ui.done) finish();
      tips(dt);
      view.update(S, dt);
      sound.update(S, view);
      let a = 0, b = stage.length;
      for (const u of S.units) { if (!u.alive) continue; if (u.side === 0) a = Math.max(a, u.x); else b = Math.min(b, u.x); }
      const F = view.FIELD;
      ui.mini = mirror ? { a: F - (b + 170), b: F - (a + 170), cam: F - view.cam - ctx.view.w, w: ctx.view.w, F } : { a: a + 170, b: b + 170, cam: view.cam, w: ctx.view.w, F };
    }
    hud.update(S, ui);
  };
  ctx.app.ticker.add(tick);
  ui.paused = true; hud.showPanel('intro');   // 스테이지 카드 → «출격!»
  if (net) setTimeout(() => { if (!gone && ui.intro) { ui.intro = false; ui.paused = false; hud.hidePanel(); sound.start(); } }, pvp ? 3000 : 4000);   // 멀티 : 카드를 잠깐 보여 주고 둘이 같이 시작 (한쪽만 기다리지 않게)
  const onHide = () => { if (document.hidden && !net && !ui.done && !ui.paused) { ui.paused = true; sound.pause(true); hud.showPanel('pause'); } };   // 앱을 내리면 일시정지
  document.addEventListener('visibilitychange', onHide);
  if (import.meta.env.DEV) window.__idgBattle = { S, view, ui, cmds };

  return {
    destroy() { gone = true; net?.transport.close(); document.removeEventListener('visibilitychange', onHide); ctx.app.ticker?.remove(tick); hud.destroy(); view.destroy(); sound.destroy(); },
    /** 세로로 돌림 · 앱 내림 : 일시정지 판 (카드가 떠 있으면 그대로 둔다) */
    pause() { if (!ui.intro && !ui.done && !ui.paused) { ui.paused = true; sound.pause(true); hud.showPanel('pause'); } },
    /** 뒤로가기 · ESC : 카드에서는 나가기, 전투 중에는 일시정지 판 (코드 검토 9) */
    back() { if (ui.intro) { opts.onExit(); return; } this.pause(); },
  };
}

/** 졌을 때 힌트 (기획서 11.6) — 가장 그럴듯한 이유 하나 */
function loseHint(S, me = 0) {
  const p = S.players[me];
  if (p.st.walletUps === 0) return '화로를 올리면 불씨가 더 빨리 모여요!';
  if (p.st.breath === 0) return '브레스가 차면 꾹 눌러요! 앞에 있는 좀비를 한꺼번에 태워요.';
  if (p.st.spawned < 15) return '용을 더 자주 내보내 보세요. 싼 꼬물이로 앞을 막아요.';
  return '돌등이처럼 튼튼한 용으로 앞을 막고, 뒤에서 퉤퉤로 공격해요.';
}
