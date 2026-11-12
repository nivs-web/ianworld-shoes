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
import { superData } from './breathInfo.js';
import { earlyCastle, makeLoads, starsFor, stageByNo, LAST_STAGE, pvpStage, pvpLoad, PVP_DAY, DIFF, diffFor, raidStage, raidWaves, weekKey } from './battleSetup.js';
import { isOn } from '../../../services/switches.js';
import { decodeLook, CONSUMABLES } from '../data/looks.js';
import { sendChat, subscribeChat, leaveRoom } from '../../../services/multiplayer.js';
import { pickRejoin } from '../../../services/iandragonGame.js';

/** 빠른 말 4개 (멀티 기획 2.1 · 글자 입력 없음 · 오락실 방 채팅을 그대로 쓴다) */
const TALK = { coop: ['방패 부탁!', '브레스 간다!', '화로 올릴게!', '최고!'], pvp: ['잘 부탁해!', '간다~!', '앗 따가워!', '최고!'] };
import { ECON } from '../data/econ.js';
import { tunes } from '../../../services/tuning.js';

tagArt(D);

/** opts = { stageNo, save, onSave(part), onExit(), restart(stageNo), text, net? }
 *  net = { seat, seats, seed, transport } — 멀티(3차 · 같이 깨기). 두 기기가 같은 씨앗 · 같은 편성으로 만들고 명령만 주고받는다(net/lockstep.js). */
export async function startBattle(ctx, opts) {
  /* 운영자 난이도 (50 = 그대로 · 높을수록 어렵게) — 코어는 그대로, 판에 넣는 숫자만 바꾼다 */
  const tz = opts.net ? { hp: 1, atk: 1, ember: 1, base: 1 } : tunes('zd');   // 멀티는 두 기기 숫자가 같아야 해서 운영자 손잡이를 쓰지 않는다
  const pvp = !!opts.net?.pvp;   // 용 대결 (3차 M5)
  const raid = !opts.net && opts.raid ? weekKey() : null;   // 주간 좀비 습격 (혼자 · 모두 같은 조건)
  const base0 = pvp ? pvpStage() : raid ? raidStage(raid.key) : stageByNo(opts.stageNo);
  /* 난이도 : 혼자 할 때만 (멀티는 두 기기 숫자가 같아야 해서 보통) */
  const dk = opts.net || raid ? 'normal' : diffFor(base0.g, opts.save, isOn('zdOpt', 'diff')), DF = DIFF[dk];
  const stage = { ...base0, mag: base0.mag * tz.hp * DF.mag, atkMag: (base0.atkMag || base0.mag) * tz.atk * DF.mag, diff: dk, ...earlyCastle(base0, pvp || raid) };
  const { deck, skills, loads, speedMax: speedMax0 } = makeLoads(raid ? stageByNo(Math.max(20, Math.min(LAST_STAGE, opts.save?.cleared || 1))) : stage, opts.save);
  if (raid) { const one = pvpLoad(loads[0], 0); loads.length = 0; loads.push(one); }   // 습격 = 내 덱 6칸 · 모두 Lv20 · 보너스 없음
  /* 습격 · 대결 편성은 보너스가 비어 있다({}) — 없는 값을 나누면 NaN 이 돼 불씨 «NaN/2800» · 성 체력이 사라졌다 (대표님 11/11 «주간 습격 안 죽어») */
  loads[0].bonus = { ...loads[0].bonus, income: (loads[0].bonus.income ?? 1) / tz.ember, baseHp: (loads[0].bonus.baseHp ?? 1) / tz.base };
  /* 멀티 : 자리마다 같은 편성을 하나씩 (같이 깨기 = 모두 side 0) */
  const net = opts.net || null, me = net ? net.seat : 0;
  /* 같이 깨기 : 좀비 세기 1.5배 (멀티 기획 2.1 · 계산기 2인 자동 28판 = 26승 — 혼자 26승과 같은 손맛) */
  const coop = !!net && !pvp && net.seats > 1;
  if (coop) { stage.mag *= 1.5; stage.atkMag *= 1.5; }
  if (net) { const one = loads[0]; loads.length = 0; for (let i = 0; i < net.seats; i++) loads.push(pvp ? pvpLoad(net.loads?.[i] || one, i) : { ...(net.loads?.[i] || one), side: 0 }); }   // 대결 = 0번 왼쪽 · 1번 오른쪽   // 서버 방 = 자리마다 받은 편성(ld) · 탭 시험 = 같은 편성
  const myDeck = pvp ? loads[me].deck : net?.loads?.[me]?.deck || deck;
  const allDragons = pvp || net?.loads ? [...new Map(loads.flatMap((l) => l.deck).map((d) => [d.id, d])).values()] : deck;
  const mirror = pvp && me === 1;   // 대결 : 누구나 자기가 왼쪽 (오른쪽 편은 화면만 뒤집는다)
  const S = createBattle(stage, loads, superData(D), net ? net.seed : (Date.now() % 1e9) | 0);   /* 초강력 브레스 (breathInfo.js · 대표님 11/11) */
  /* 부화장 «+» (겹친 용 하나당 체력 · 공격 +2% · 최대 +10 = +20%) — 혼자 하는 스테이지만 (멀티 · 습격은 모두 같은 조건) */
  if (!net && !raid) for (const d of S.players[0].deck) { const p = opts.save?.units?.[d.id]?.[1] || 0; if (p > 0) d.mul *= 1 + 0.02 * Math.min(10, p); }
  const ls = net ? createLockstep({ seat: me, seats: net.seats }) : null;
  /* 빠른 말 : 서버 방에서만 (탭 시험은 code 없음) — 상대 말은 친구 띠 아래 말풍선 2.5초 */
  const talkOff = net?.code ? subscribeChat(net.code, (rows) => {
    const last = rows && rows[rows.length - 1]; if (!last || last.id === ui.talkSeen) return; ui.talkSeen = last.id;
    if (last.uid !== net.uids?.[me] && Date.now() - (last.at || 0) < 8000) { ui.talk = last.text; ui.talkT = 2.5; }
  }) : null;
  const NET_GIVEUP = 10;   // 초 — 이만큼 아무 소식이 없으면 그 친구는 나간 것으로 보고 혼자 계속 (M4)
  const leave = (s) => {
    ls.drop(s);
    if (pvp && !S.over) { S.over = { winner: me, forfeit: true }; return; }   // 대결 : 상대가 나가면 남은 사람 승 (멀티 기획 3.6)
    ui.netNote = '친구가 나갔어요 — 혼자 계속해요!'; ui.netNoteT = 4;
  };
  if (net) { net.transport.onMessage((from, str) => ls.receive(from, str)); net.transport.onLeave?.(leave); }
  let tickN = 0, sendT = 0, nextHash = 150, waitT = 0;
  const enemyIds = [...new Set(stage.lines.map((l) => l.id))];
  const view = await createBattleView(ctx, { world: stage.w, L: stage.length, dragons: allDragons, enemies: enemyIds, leader: loads[0].leader, pvp, mirror, foeLeader: pvp ? loads[1].leader : null, look: decodeLook(pvp ? (me === 0 ? opts.save?.look : net.loads?.[0]?.look) || '' : opts.save?.look || ''), lookR: decodeLook(pvp ? (me === 1 ? opts.save?.look : net.loads?.[1]?.look) || '' : '') });   // 내 대장 용 꾸미기 (모자 · 목 · 브레스 색)
  view.onZoom = (d) => hud.zoomBy(d); view.me = me;   /* 맵 확대 · 축소 (두 손가락 · 휠) */

  const sound = createBattleSound(stage, me);
  /* 멀티는 1배속 고정 */
  const speedMax = 2;   /* ×2 배속 단추 (대표님 11/11 «다시 작동») — 처음부터 ×2 까지 · 운영자 스위치로 끌 수 있다 */
  const ui = { me, side: pvp ? me : 0, net: !!net, speed: net ? 1 : Math.min(opts.save?.speed || 1, speedMax), paused: false, warn: 0, done: false, auto: false, intro: true };
  /* 자동 전투 (B6) : 별을 1개 이상 딴 스테이지만 — 기준 AI(코어 aiCommands)가 대신 누른다 */
  const canAuto = (Number((opts.save?.stars || '')[stage.g - 1]) || 0) > 0;
  const autoPol = { walletTarget: 3, useSkills: true, useRage: true }, autoMem = {};
  const cmds = [];
  let acc = 0, bossSeen = false, gone = false, goldKills = 0;
  const goldSeen = new Set();   // 황금 좀비 쓰러뜨린 수 (판 끝 코인 +5% 씩)
  const hud = createHud(ctx.host || opts.hudHost, { stage, isNet: !!net, deck: myDeck, leader: loads[me].leader, cons: net || raid ? null : CONSUMABLES.filter((c) => (opts.save?.cons?.[c.id] || 0) > 0).map((c) => ({ ...c, n: opts.save.cons[c.id] })), foeDeck: pvp ? loads[1 - me].deck : null, talk: net?.code ? TALK[pvp ? 'pvp' : 'coop'] : null, foeLeader: pvp ? loads[1 - me].leader : null, skills: pvp ? loads[me].skills : net?.loads?.[me]?.skills || skills, text: opts.text, speedMax, canAuto }, {
    cmd(c) {
      if (S.over) return;
      sound.touch();
      if (c.type === 'spawn' && !ui.intro && !ui.paused) {   /* 누르는 순간 소리 (계산과 같은 조건을 미리 봄 · 소리 전용) */
        const P = S.players[me], d = P?.deck[c.i];
        const ok = !!d && P.cd[c.i] <= 0 && P.money >= d.def.cost && !(S.stage.costMax && d.def.cost > S.stage.costMax);
        sound.pressSpawn(ok, d?.def._art);
      }
      if (net) { if (!ui.intro) ls.press(c, tickN); } else if (!ui.paused) cmds.push({ p: 0, ...c });
    },
    go(useCons) {
      ui.intro = false; ui.paused = false; hud.hidePanel(); sound.start(raid ? 'raid' : coop ? 'coop' : '', myDeck.map((d) => d.id));
      /* 편의품 (META 3장 · 판마다 1개 · 혼자 하기만) — 판을 시작하며 1개 쓴다 · 도중에 나가도 돌려주지 않는다 */
      const have = opts.save?.cons?.[useCons] || 0;
      if (!net && !raid && useCons && have > 0) {
        const P = S.players[0];
        if (useCons === 'ember50') P.money += 50;
        else if (useCons === 'brazier') P.wl = Math.max(P.wl, Math.min(1, S.D.wallet.length - 1));
        else if (useCons === 'basehp') { S.base[0].maxHp = Math.round(S.base[0].maxHp * 1.05); S.base[0].hp = S.base[0].maxHp; }
        try { opts.save = opts.onSave?.({ cons: { ...opts.save.cons, [useCons]: have - 1 } }) || opts.save; } catch { /* */ }
      }
    },
    music(on) { sound.setMusic(on); },
    soundRefresh() { sound.refresh(); },
    pause() { if (ui.done || ui.intro || net) return; ui.paused = !ui.paused; sound.pause(ui.paused); if (ui.paused) hud.showPanel('pause'); else hud.hidePanel(); },
    speed() { if (net) return; ui.speed = ui.speed >= speedMax ? 1 : ui.speed + 1; try { opts.save = opts.onSave?.({ speed: ui.speed }) || opts.save; } catch { /* */ } },   // 2배속 = 1-5 · 3배속 = 3-10 을 깨면 · 고른 배속은 기억
    auto() { if (canAuto) ui.auto = !ui.auto; },
    exit() { if (net?.code) leaveRoom(net.code).catch?.(() => {}); opts.onExit(); },   // 멀티 : 방에서도 나간다 (방 정리)
    rejoin() { if (net?.code) pickRejoin(net.code); opts.onExit(); },   // 한 판 더 : 같은 방 대기실로
    retry() { opts.restart(raid ? 'raid' : stage.g, true); },
    next() { opts.restart(Math.min(LAST_STAGE, stage.g + 1)); },
    /* 판 사이 파워 업 : 저장 읽기 · 쓰기 (로비 «용 둥지»와 같은 저장) */
    puSave: () => opts.save || {},
    puWrite: (part) => { try { opts.save = opts.onSave?.(part) || { ...opts.save, ...part }; } catch (e) { console.warn('[좀비와 드래곤] 저장 실패', e); } return opts.save; },
    aim(on) { view.aim = !!on; },   /* 브레스 단추를 누르고 있는 동안 사거리 */
    talk(t) { if (net?.code) { sendChat(net.code, t).catch?.(() => {}); ui.myTalk = t; ui.myTalkT = 1.6; } },
    look(f) { view.setCam((mirror ? 1 - f : f) * view.FIELD - ctx.view.w / 2); },
  });

  /* 처음 하는 아이를 위한 한 줄 안내 (튜토리얼 최소판) — 해당 행동을 하면 사라진다 */
  const TIPS = [
    { g: 1, at: 'deck', text: '용 버튼을 눌러서 꼬물이를 내보내요!', done: () => S.players[me].st.spawned >= 2 },
    { g: 1, at: 'breath', text: '브레스가 꽉 찼어요! 눌러서 좀비를 태워요!', when: () => S.players[me].breathT >= S.players[me].breathCharge, done: () => S.players[me].st.breath > 0 },
    { g: 2, at: 'wallet', text: '화로를 올리면 불씨가 더 빨리 모여요!', when: () => S.players[me].money >= S.D.wallet[0].cost, done: () => S.players[me].wl > 0 },
    { g: 7, at: 'skill', text: '새 스킬 «운석»! 좀비가 몰려오면 눌러요 — 맨 앞 좀비 무리에 운석이 쾅! (한 판 2번)', when: () => S.t > 8, done: () => S.players[me].st.skill > 0 },
  ].filter((q) => q.g === stage.g && !(opts.save?.cleared >= stage.g));
  let tipT = 0;
  function tips(dt) {
    const q = TIPS.find((x) => !x.gone && (!x.when || x.shown || x.when()));
    if (!q) { ui.tip = ''; return; }
    q.shown = true; tipT += dt;
    if (q.done() || tipT > 12) { q.gone = true; tipT = 0; ui.tip = ''; return; }
    ui.tip = q.text; ui.tipAt = q.at;
  }

  const END_MS = 3200;   /* 결과 창은 성 무너짐(폭발 → 깜박 → 와르르 → 잔해 2.1초)을 다 보여 준 뒤 (대표님 11/11) */
  function finish() {
    ui.done = true;
    if (pvp) { finishPvp(); return; }
    if (raid) { finishRaid(); return; }
    if (net && ls.mismatch() >= 0) { setTimeout(() => { if (!gone) hud.showPanel('lose', { t: S.t, pvp: true, coins: 0, title: '판이 어긋났어요', rec: '이 판은 기록하지 않아요', hint: '연결이 어긋났어요 — 한 판 더 해요!' }); }, 900); return; }   // 기획 3.6 : 무효
    const win = S.over.winner === 0;
    const info = { t: S.t, hasNext: stage.g < LAST_STAGE, final: win && stage.g === LAST_STAGE };
    { const fb = S.base[1]; if (fb && fb.maxHp) info.foeHp = Math.max(0, Math.round((fb.hp / fb.maxHp) * 100)); }   // 결과 창 «좀비 성 남은 체력» (11/12)
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
        setTimeout(() => { if (gone) return; hud.showPanel('win', info); sound.stars(info.stars); }, END_MS);
        return;
      }
      const stars = (save.stars || '').padEnd(stage.g, '0').split('');
      const old = Number(stars[stage.g - 1]) || 0, first = old === 0 && !ahead, newStars = Math.max(0, info.stars - old);
      stars[stage.g - 1] = String(Math.max(old, info.stars));
      /* 보상 (기획서 10장 ECON) : 첫 클리어 코인 · 다시 깨면 40% · 새 별 하나마다 +25% / 젬 : 새 별 5 · 중간 보스 20 · 월드 보스 50 (첫 클리어) */
      const base = ECON.coin(stage.g);
      if (first && Array.isArray(stage.unlocks) && stage.unlocks.length) info.unlocks = stage.unlocks;   // 결과 창에 «새로 열림»
      if (goldKills) info.gold = Math.round(base * ECON.goldBonus * goldKills);   // 황금 좀비
      info.coins = (info.gold || 0) + Math.round((base * (first ? 1 : ECON.replay) + base * ECON.starBonus * newStars) * (coop ? 1.1 : 1) * DF.coin);
      info.gems = newStars * ECON.gem.star + (first && stage.s === 5 ? ECON.gem.mid : 0) + (first && stage.s === 10 ? ECON.gem.boss : 0);
      /* 매일 첫 승리 : 젬 10 (한국 날짜) */
      const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
      if (save.daily !== today) { info.gems += 10; info.daily = true; }
      const part = { cleared: Math.max(save.cleared || 0, ahead ? 0 : stage.g), stars: (ahead ? save.stars || '' : stars.join('')), coins: (save.coins || 0) + info.coins, gems: (save.gems || 0) + info.gems, daily: today, stat };
      try { opts.save = opts.onSave?.(part) || { ...save, ...part }; } catch (e) { console.warn('[좀비와 드래곤] 저장 실패', e); }
    } else info.hint = loseHint(S, me);
    if (net && ls.mismatch() >= 0) info.hint = '연결이 어긋났어요 — 이 판은 기록하지 않아요. 한 판 더?';
    setTimeout(() => { if (gone) return; hud.showPanel(win ? 'win' : 'lose', info); if (win) sound.stars(info.stars); }, END_MS);
  }

  /* 주간 습격 끝 : 버틴 웨이브 · 이번 주 최고면 웨이브당 코인 20 (늘어난 만큼만) · 명예의 전당 «주간 습격» */
  function finishRaid() {
    const waves = S.over.winner === 0 || S.over.timeout ? 40 : raidWaves(S.t);
    const save = opts.save || {}, old = save.raid?.w === raid.idx ? save.raid.best || 0 : 0;
    const coins = Math.max(0, waves - old) * 20;
    const fire = waves >= 40 && !(save.owned || []).includes('frame:fire');   // 끝까지 버티면 불꽃 테두리 (META 2장)
    try { opts.save = opts.onSave?.({ raid: { w: raid.idx, best: Math.max(old, waves) }, coins: (save.coins || 0) + coins, ...(fire ? { owned: [...(save.owned || []), 'frame:fire'] } : {}) }) || opts.save; } catch (e) { console.warn('[좀비와 드래곤] 저장 실패', e); }
    const info = { t: S.t, pvp: true, coins, title: waves >= 40 ? '끝까지 버텼다!' : `${waves} 웨이브!`, rec: `${raid.key} · 이번 주 최고 ${Math.max(old, waves)} 웨이브${waves > old ? ' (새 기록!)' : ''}${fire ? ' · 불꽃 테두리 획득!' : ''}`, hint: '명예의 전당 «주간 습격»에서 순위를 볼 수 있어요.' };
    if (waves > old) sound.say('raid/record');
    setTimeout(() => { if (!gone) hud.showPanel(waves > old ? 'win' : 'lose', info); }, 1200);
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
      hint: bad ? '연결이 어긋났어요 — 이 판은 기록하지 않아요.' : S.over.forfeit ? '상대가 나갔어요 — 승리!' : S.over.timeout ? '시간 끝 — 둥지 체력이 많은 쪽, 같으면 잃은 용이 적은 쪽이 이겨요.' : '' };
    if (!bad) sound.say(win ? 'duel/win' : draw ? 'duel/win' : 'duel/lose');   // 대결 끝 대사 (진 쪽도 기죽지 않는 말투)
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
        if (ui.talk && (ui.talkT -= dt) < 0) ui.talk = '';
        if (ui.myTalk && (ui.myTalkT -= dt) < 0) ui.myTalk = '';
        if (waitT > NET_GIVEUP) { for (const s of ls.late(tickN + 1)) leave(s); waitT = 0; }
        if ((sendT += dt) >= 0.2) { sendT = 0; let h = null; if (tickN >= nextHash) { h = [tickN, hashState(S)]; nextHash = tickN + 150; } net.transport.send(ls.packet(tickN, h)); }
      } else {
        while (acc >= TICK && n < 6 * ui.speed) { if (ui.auto && !S.over) cmds.push(...aiCommands(S, 0, autoPol, autoMem)); step(S, cmds.splice(0)); acc -= TICK; n++; }
        if (acc > TICK * 6) acc = 0;
      }
      if (S.boss && !bossSeen) { bossSeen = true; ui.warn = 0.9; }
      for (const u of S.units) if (u.side !== (pvp ? me : 0) && !u.alive && u.def._art === 'gold' && !goldSeen.has(u.id)) { goldSeen.add(u.id); goldKills++; }
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
  if (opts.quick && !net) setTimeout(() => { if (!gone && ui.intro) { ui.intro = false; ui.paused = false; hud.hidePanel(); sound.start(raid ? 'raid' : '', myDeck.map((d) => d.id)); } }, 50);   // 다시 하기 = 1터치 (기획 GDD 137)
  if (net) setTimeout(() => { if (!gone && ui.intro) { ui.intro = false; ui.paused = false; hud.hidePanel(); sound.start(raid ? 'raid' : coop ? 'coop' : '', myDeck.map((d) => d.id)); } }, pvp ? 3000 : 4000);   // 멀티 : 카드를 잠깐 보여 주고 둘이 같이 시작 (한쪽만 기다리지 않게)
  const onHide = () => { if (document.hidden && !net && !ui.done && !ui.paused) { ui.paused = true; sound.pause(true); hud.showPanel('pause'); } };   // 앱을 내리면 일시정지
  document.addEventListener('visibilitychange', onHide);
  if (import.meta.env.DEV) window.__idgBattle = { S, view, ui, cmds };

  return {
    destroy() { gone = true; net?.transport.close(); talkOff?.(); document.removeEventListener('visibilitychange', onHide); ctx.app.ticker?.remove(tick); hud.destroy(); view.destroy(); sound.destroy(); },
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
  if (p.skills?.length && p.st.skill === 0) return '스킬 단추(오른쪽 위)를 눌러 봐요! 좀비가 몰려올 때 한 번에 쓸어요.';
  if (p.st.rageUse === 0 && S.t > 40) return '«으르렁!» 게이지가 차면 눌러요 — 잠깐 모든 용이 세져요.';
  if (p.st.spawned < 15) return '용을 더 자주 내보내 보세요. 싼 꼬물이로 앞을 막아요.';
  return Math.random() < 0.5 ? '돌등이처럼 튼튼한 용으로 앞을 막고, 뒤에서 퉤퉤로 공격해요.' : '둥지에서 용을 레벨업하거나, 별을 딴 판을 «자동»으로 돌려 코인을 모아 봐요.';
}
