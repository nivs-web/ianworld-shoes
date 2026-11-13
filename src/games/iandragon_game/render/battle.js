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
import { decoOf } from './castleKit.js';
import { createHud } from './hud.js';
import { createBattleSound } from './battleSound.js';
import { superData } from './breathInfo.js';
import { earlyCastle, makeLoads, starsFor, stageByNo, LAST_STAGE, pvpStage, pvpLoad, PVP_DAY, DIFF, diffFor, raidStage, raidWaves, weekKey } from './battleSetup.js';
import { isOn } from '../../../services/switches.js';
import { currentUser } from '../../../services/auth.js';
import { stampOf } from '../../../services/iandragonGameState.js';   // 도감 도장 (부팅 묶음의 작은 순수 함수)
import { decodeLook, CONSUMABLES, TITLES } from '../data/looks.js';
import { bpFor, bpKey, BP_MIN } from '../data/breathUp.js';   // 브레스 UP (11/13) — 같은 판 연속 패배 아이템
import { loadDiffStages } from '../data/stages/diffLoad.js';   // 어려움 · 초고수 판 100개 (보조 S · 필요할 때만 받음)
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
  let dk = opts.net || raid ? 'normal' : diffFor(base0.g, opts.save, isOn('zdOpt', 'diff'));
  /* 어려움 · 초고수 = 판 정의를 통째로 바꿔 끼운다 (계산기 맞춤 100판 · mag · atkMag · 성 · 제한 시간 · 별 시간이 최종값 → DF.mag 를 또 곱하지 않음 · 초반 성 바닥도 안 씀)
     판 자료를 못 받으면 조용히 보통 (별 · 보상도 보통) */
  let ds = null;
  if (DIFF[dk].stages) { try { ds = (await loadDiffStages(dk))?.[base0.g - 1] || null; } catch (e) { console.warn('[좀비와 드래곤] 난이도 판 자료를 못 읽었다', e); } if (!ds) dk = 'normal'; }
  const DF = DIFF[dk];
  const stage = ds
    ? { ...base0, ...ds, unlocks: undefined, mag: ds.mag * tz.hp, atkMag: (ds.atkMag || ds.mag) * tz.atk, diff: dk }   // 운영자 손잡이(tz)는 그대로 곱한다
    : { ...base0, mag: base0.mag * tz.hp * DF.mag, atkMag: (base0.atkMag || base0.mag) * tz.atk * DF.mag, diff: dk, ...earlyCastle(base0, pvp || raid) };
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
  if (!net && !raid && !DF.noPlus) for (const d of S.players[0].deck) { /* 초고수 = «+» 무효 (§E) */ const p = opts.save?.units?.[d.id]?.[1] || 0; if (p > 0) d.mul *= 1 + 0.02 * Math.min(10, p); }
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
  const view = await createBattleView(ctx, { world: stage.w, L: stage.length, dragons: allDragons, enemies: enemyIds, leader: loads[0].leader, pvp, mirror, foeLeader: pvp ? loads[1].leader : null, look: decodeLook(pvp ? (me === 0 ? opts.save?.look : net.loads?.[0]?.look) || '' : opts.save?.look || ''), lookR: decodeLook(pvp ? (me === 1 ? opts.save?.look : net.loads?.[1]?.look) || '' : ''), deco: pvp || !opts.save ? null : decoOf(opts.save) });   // 내 대장 용 꾸미기 (모자 · 목 · 브레스 색)
  view.onZoom = (d) => hud.zoomBy(d); view.guard = (x, y) => hud.inGuard(x, y); view.me = me;   /* 맵 확대 · 축소 (두 손가락 · 휠) */

  const sound = createBattleSound(stage, me);
  /* 멀티는 1배속 고정 */
  const speedMax = 2;   /* ×2 배속 단추 (대표님 11/11 «다시 작동») — 처음부터 ×2 까지 · 운영자 스위치로 끌 수 있다 */
  const ui = { me, side: pvp ? me : 0, net: !!net, speed: net ? 1 : Math.min(opts.save?.speed || 1, speedMax), paused: false, warn: 0, done: false, auto: false, intro: true };
  /* 자동 전투 (B6) : 별을 1개 이상 딴 스테이지만 — 기준 AI(코어 aiCommands)가 대신 누른다 */
  const canAuto = (Number((opts.save?.[DF.star || 'stars'] || '')[stage.g - 1]) || 0) > 0;   // 어려움 · 초고수는 그 난이도 별을 딴 판만
  const autoPol = { walletTarget: 3, useSkills: true, useRage: true }, autoMem = {};
  const cmds = [];
  let acc = 0, bossSeen = false, gone = false, goldKills = 0;
  const goldSeen = new Set();   // 황금 좀비 쓰러뜨린 수 (판 끝 코인 +5% 씩)
  /* 브레스 UP (대표님 11/13) : 이 판 전용으로 산 것이 있으면 판을 시작할 때 자동으로 쓴다 — 코어는 그대로, 리더 자료(이 판 사본)의 공격력 · 사거리 × m · 차는 시간 ÷ m */
  const bp = !net && !raid && !DF.noItems ? bpFor(opts.save, dk, stage.g) : null;
  let bpUsed = false;
  const useBp = () => {
    if (!bp || bpUsed || S.over) return;
    bpUsed = true;
    const P = S.players[0], L = P.leader;
    P.leader = { ...L, dmg: L.dmg * bp.mul, range: Math.round(L.range * bp.mul) };
    P.breathCharge = P.breathCharge / bp.mul;
    try { opts.save = opts.onSave?.({ bpUp: '' }) || opts.save; } catch { /* */ }   // 쓰면 없어진다 (이기든 지든)
  };
  const hud = createHud(ctx.host || opts.hudHost, { stage, isNet: !!net, deck: myDeck, leader: loads[me].leader, cons: net || raid ? null : [...CONSUMABLES.filter((c) => (opts.save?.cons?.[c.id] || 0) > 0).map((c) => ({ ...c, n: opts.save.cons[c.id] })), ...(bp ? [{ id: 'bp', name: bp.name, auto: true }] : [])], consOff: !!DF.noItems, foeDeck: pvp ? loads[1 - me].deck : null, talk: net?.code ? TALK[pvp ? 'pvp' : 'coop'] : null, foeLeader: pvp ? loads[1 - me].leader : null, skills: pvp ? loads[me].skills : net?.loads?.[me]?.skills || skills, text: opts.text, speedMax, canAuto }, {
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
      if (!pvp && !raid) setTimeout(loadDrops, 3000);   // 모으기 보상 계산은 싸움이 자리 잡은 뒤에 조용히 받아 둔다
      /* 편의품 (혼자 하기만 · 종류마다 1개씩 최대 3개 — 대표님 11/13 «B») — 판을 시작하며 고른 것을 1개씩 쓴다 · 도중에 나가도 돌려주지 않는다 */
      if (!net && !raid && !DF.noItems && Array.isArray(useCons) && useCons.length) {   // 초고수 = 편의품 무효 (단추 회색)
        const P = S.players[0], left = { ...(opts.save?.cons || {}) };
        for (const id of new Set(useCons)) {
          if (!((left[id] || 0) > 0)) continue;
          if (id === 'ember50') P.money += 50;
          else if (id === 'brazier') P.wl = Math.max(P.wl, Math.min(1, S.D.wallet.length - 1));
          else if (id === 'basehp') { S.base[0].maxHp = Math.round(S.base[0].maxHp * 1.05); S.base[0].hp = S.base[0].maxHp; }
          else continue;
          left[id] -= 1;
        }
        try { opts.save = opts.onSave?.({ cons: left }) || opts.save; } catch { /* */ }
      }
      useBp();
    },
    music(on) { sound.setMusic(on); },
    soundRefresh() { sound.refresh(); },
    pause() { if (ui.done || ui.intro || net) return; ui.paused = !ui.paused; sound.pause(ui.paused); if (ui.paused) hud.showPanel('pause'); else hud.hidePanel(); },
    speed() { if (net) return; ui.speed = ui.speed >= speedMax ? 1 : ui.speed + 1; try { opts.save = opts.onSave?.({ speed: ui.speed }) || opts.save; } catch { /* */ } },   // 2배속 = 1-5 · 3배속 = 3-10 을 깨면 · 고른 배속은 기억
    auto() { if (canAuto) ui.auto = !ui.auto; },
    exit() { if (net?.code) leaveRoom(net.code).catch?.(() => {}); opts.onExit(); },   // 멀티 : 방에서도 나간다 (방 정리)
    hall() { import('../../../screens/idgHall.js').then((m) => m.showHall('raid')).catch((e) => console.warn('[좀비와 드래곤] 명예의 전당을 열지 못했다', e)); },   // 습격 결과 창 «명예의 전당» = 주간 습격 탭으로
    rejoin() { if (net?.code) pickRejoin(net.code); opts.onExit(); },   // 한 판 더 : 같은 방 대기실로
    retry() { opts.restart(raid ? 'raid' : stage.g, true); },
    next() { opts.restart(Math.min(LAST_STAGE, stage.g + 1)); },
    /* 판 사이 파워 업 : 저장 읽기 · 쓰기 (로비 «용 둥지»와 같은 저장) */
    consNow: () => [...CONSUMABLES.filter((c) => (opts.save?.cons?.[c.id] || 0) > 0).map((c) => ({ ...c, n: opts.save.cons[c.id] })), ...(bp && !bpUsed ? [{ id: 'bp', name: bp.name, auto: true }] : [])],   /* 시작 창에서 아이템샵을 다녀온 뒤 편의품 줄 다시 */
    shop(done) { const write = (part) => { try { opts.save = opts.onSave?.(part) || { ...opts.save, ...part }; } catch (e) { console.warn('[좀비와 드래곤] 저장 실패', e); } return opts.save; }; import('../../../screens/idgShop.js').then((m) => m.showShop({ idg: opts.save || {}, save: write, tab: 'cons', onClose: () => done?.() })).catch((e) => console.warn('[좀비와 드래곤] 아이템샵을 열지 못했다', e)); },   // 판 사이 파워업 «아이템샵» → 편의품 칸 (11/13 대표님)
    puSave: () => opts.save || {},
    puWrite: (part) => { try { opts.save = opts.onSave?.(part) || { ...opts.save, ...part }; } catch (e) { console.warn('[좀비와 드래곤] 저장 실패', e); } return opts.save; },
    aim(on) { view.aim = !!on; },   /* 브레스 단추를 누르고 있는 동안 사거리 */
    talk(t) { if (net?.code) { sendChat(net.code, t).catch?.(() => {}); ui.myTalk = t; ui.myTalkT = 1.6; } },
    look(f) { view.setCam((mirror ? 1 - f : f) * view.FIELD - ctx.view.w / 2); },
    pan(d) { view.setCam(view.cam + d * ctx.view.w * (mirror ? -1 : 1)); },   /* 키보드 ← → : d = 화면 폭 비율(오른쪽 +) */
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
  /* 모으기 보상 계산(drops.js · 따로 묶음) — 전투를 시작하면 뒤에서 받아 두고, 결과에서 기다린다 (못 받으면 모으기 보상만 건너뜀) */
  let dropsP = null;
  const loadDrops = () => (dropsP ||= import('../data/drops.js').catch((e) => { console.warn('[좀비와 드래곤] 보상 계산을 못 받았다', e); return null; }));
  /** 모으기 보상 한 묶음 : 첫 클리어 확정 · 별 900 · 다시 깨기(보물 게이지 · «?» +1) · 도감 도장(10개마다 젬 10) — 계산은 drops.js, 여기서는 owned(제자리) · 젬 · 글을 붙인다.
   *  난수는 전투 씨앗과 따로(drops.js — 계정 id + 판 + 횟수) → 전투 결정론을 건드리지 않는다. 돌려줌 { part(저장에 더할 것), gems, lines } */
  function giveDrops(drops, after, owned, first, base = owned.length) {
    const out = { part: {}, gems: 0, lines: [] };
    if (!drops) return out;
    try {
      const r = drops.resultDrops({ ...after, owned }, { dk, w: stage.w, s: stage.s, first, uid: currentUser()?.uid });
      for (const k of r.keys) if (!owned.includes(k)) owned.push(k);
      out.gems += r.gems; out.lines.push(...r.lines);
      if (r.units) out.part.units = { ...(after.units || {}), ...r.units };
      if (r.bossGauge) out.part.bossGauge = r.bossGauge;
      if (r.gauge) out.gauge = r.gauge;
      if (r.awake.length) out.awake = r.awake;
      if (owned.length > base) {   // 새 물건이 생긴 판만 도장 (샵에서 산 것도 owned 의 stampN 번째 뒤라 같이 찍힌다)
        const st = stampOf(after.stampN, owned);
        out.part.stampN = st.stampN;
        if (st.gems) { out.gems += st.gems; out.lines.push(`도감 도장 ${st.stampN}개 · 젬 +${st.gems}`); }
      }
    } catch (e) { console.warn('[좀비와 드래곤] 모으기 보상 계산 실패', e); }
    return out;
  }
  async function finish() {
    ui.done = true;
    if (pvp) { finishPvp(); return; }
    if (raid) { finishRaid(); return; }
    if (net && ls.mismatch() >= 0) { setTimeout(() => { if (!gone) hud.showPanel('lose', { mode: 'void', t: S.t, coins: 0, gems: 0, plate: '판이 어긋났어요', big: '기록 없음', line: '연결이 어긋났어요 · 이 판은 기록하지 않아요 — 한 판 더 해요!' }); }, 900); return; }   // 기획 3.6 : 무효
    const win = S.over.winner === 0;
    /* 같은 판 연속 패배 세기 (브레스 UP · 대표님 11/13) — 혼자 하기 보통 · 쉬움 · 어려움만 · 드래곤캐슬이 무너지거나 시간이 다 돼 진 것만(중간에 나간 판 · 비김은 안 셈) · 그 판을 이기면 0 */
    let lossN = 0;
    if (!net && dk !== 'master' && (win || S.over.winner === 1)) {
      const lk = bpKey(dk, stage.g), run = { ...(opts.save?.lossRun || {}) };
      if (win) { if (lk in run) { delete run[lk]; try { opts.save = opts.onSave?.({ lossRun: run, ...(opts.save?.lossAt === lk ? { lossAt: '' } : {}) }) || opts.save; } catch { /* */ } } }
      else { lossN = Math.min(99, (run[lk] || 0) + 1); delete run[lk]; run[lk] = lossN; try { opts.save = opts.onSave?.({ lossRun: run, lossAt: lk }) || opts.save; } catch { /* */ } }
    }
    const info = { t: S.t, hasNext: stage.g < LAST_STAGE, final: win && stage.g === LAST_STAGE, ...(coop ? { mode: 'coop' } : {}) };
    { const fb = S.base[1]; if (fb && fb.maxHp) info.foeHp = Math.max(0, Math.round((fb.hp / fb.maxHp) * 100)); }   // 결과 창 «좀비 성 남은 체력» (11/12)
    /* 쌓인 기록 (도전 과제) — 이겨도 져도 */
    const P0 = S.players[me], st0 = opts.save?.stat || {};
    const stat = { ...st0, kills: (st0.kills || 0) + S.st.kills, breath: (st0.breath || 0) + P0.st.breath, maxWl: Math.max(st0.maxWl || 0, P0.wl + 1),
      wins: (st0.wins || 0) + (win ? 1 : 0), boss: (st0.boss || 0) + (win && stage.s === 10 ? 1 : 0), hatch: st0.hatch || 0, coop: (st0.coop || 0) + (win && coop ? 1 : 0) };
    if (!win) { try { opts.save = opts.onSave?.({ stat }) || opts.save; } catch { /* */ } }
    if (win) {
      info.stars = starsFor(stage, S.t);
      const drops = await loadDrops();   // 모으기 보상 계산 (전투 시작 때 받아 둠 · 거의 바로 끝남)
      const save = opts.save || {};
      /* 같이 깨기 보상 : 끌어 주기(내 다음 차례 판 = 별 1개로 첫 클리어) · 내 차례보다 뒤 판 = 다시 깨기 코인만(진행 안 건너뜀) · 별 2·3개는 혼자만 · 우정 +10% */
      const ahead = coop && stage.g > (save.cleared || 0) + 1, pull = coop && stage.g === (save.cleared || 0) + 1;
      if (coop) info.stars = pull ? 1 : 0;
      info.stars = Math.min(info.stars, DF.maxStar); info.diff = dk;
      if (DF.stages) {   /* 어려움 · 초고수 (§A-4) : 별은 따로(붉은 · 보라) · 보통 진행 · 별은 그대로 · 코인 = 보통의 1.5 / 2배 · 젬 = 새 별 8 / 10 · x-5 처음 40 / 80 · x-10 처음 100 / 200 */
        /* «처음» = 새 어려움(11/13 · hardWon)으로 처음 깸 — 옛 붉은 별이 있던 판도 새 어려움으로 깨면 젬 40 / 100 · 칭호 · 테두리를 받는다 (별은 더 높을 때만 갱신) */
        const key = DF.star, hs = (save[key] || '').padEnd(stage.g, '0').split(''), hOld = Number(hs[stage.g - 1]) || 0;
        const won = dk === 'hard' ? (save.hardWon || '').padEnd(100, '0').split('') : null, first = won ? won[stage.g - 1] !== '1' : hOld === 0;
        if (won) won[stage.g - 1] = '1';
        hs[stage.g - 1] = String(Math.max(hOld, info.stars));
        const base = ECON.coin(stage.g), newStars = Math.max(0, info.stars - hOld);
        /* 코인 = 보통과 같은 식(첫 클리어 1 · 다시 40% + 새 별 하나마다 25% 덤 · 황금 좀비 따로) × 1.5(어려움) / × 2(초고수) — 11/13 겜부장 돈 맞춤 */
        if (goldKills) info.gold = Math.round(base * ECON.goldBonus * goldKills);
        info.coins = (info.gold || 0) + Math.round((base * (hOld ? ECON.replay : 1) + base * ECON.starBonus * newStars) * DF.coin);
        info.gems = newStars * DF.gem.star + (first && stage.s === 5 ? DF.gem.mid : 0) + (first && stage.s === 10 ? DF.gem.boss : 0);
        info.red = dk === 'hard'; info.purple = dk === 'master'; info.final = false;   // «모든 모험 끝» 글은 보통 10-10 에서만
        /* 칭호 · 테두리 : 10-10 처음 = 붉은 테두리 / 보라 불꽃 테두리 · 칭호는 조건으로 얻는다(looks.js TITLES) → 이번 판으로 새로 얻은 것만 결과 창 «새로 열림» */
        const owned = [...(save.owned || [])], fr = first && stage.g === LAST_STAGE ? (dk === 'hard' ? 'frame:red' : 'frame:violet') : null;
        if (fr && !owned.includes(fr)) owned.push(fr);
        const after = { ...save, [key]: hs.join(''), ...(won ? { hardWon: won.join('') } : {}) }, tGot = save.tGot || [];
        const fresh = TITLES.filter((t) => t.has(after) && !t.has(save) && !tGot.includes(t.id));
        /* 모으기 보상 (11/13) : 어려움 x-5 · x-10 첫 클리어 전설 확정 · x-10 붉은 모습 · 3-10 · 6-10 · 9-10 «?» 드래곤 / 초고수 x-10 신화 · 보라 모습 · 4-10 · 7-10 · 10-10 «?» 드래곤 / 다시 깨기 전설 3% · 신화 1% + 보물 게이지 · 도감 도장 */
        const dr = giveDrops(drops, { ...after, owned }, owned, first, (save.owned || []).length);
        info.gems += dr.gems;
        if (dr.gauge) info.gauge = dr.gauge;      // 결과 창 보물 게이지 칸 { kind, fill, cap, full }
        if (dr.awake) info.awake = dr.awake;      // 깨어난 «?» 드래곤 id (봉인된 돌 연출용)
        const got = [...fresh.map((t) => `칭호 «${t.name}»`), ...(fr && !(save.owned || []).includes(fr) ? [dk === 'hard' ? '붉은 테두리' : '보라 불꽃 테두리'] : []), ...dr.lines];
        if (got.length) info.unlocks = got;
        const part = { [key]: hs.join(''), ...(won ? { hardWon: won.join('') } : {}), coins: (save.coins || 0) + info.coins, gems: (save.gems || 0) + info.gems, stat,
          ...(owned.length !== (save.owned || []).length ? { owned } : {}), ...(fresh.length ? { tGot: [...tGot, ...fresh.map((t) => t.id)] } : {}), ...dr.part };
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
      /* 모으기 보상 (11/13) : 보통에서는 별 900 «별의 왕관» · 놓친 첫 클리어 보상 채우기 · 도감 도장 — 난수 없음 */
      const owned = [...(save.owned || [])], clearedNow = Math.max(save.cleared || 0, ahead ? 0 : stage.g), starsNow = ahead ? save.stars || '' : stars.join('');
      const dr = giveDrops(drops, { ...save, cleared: clearedNow, stars: starsNow, owned }, owned, first);
      info.gems += dr.gems; if (dr.awake) info.awake = dr.awake;
      if (dr.lines.length) info.unlocks = [...(info.unlocks || []), ...dr.lines];
      const part = { cleared: clearedNow, stars: starsNow, coins: (save.coins || 0) + info.coins, gems: (save.gems || 0) + info.gems, daily: today, stat, ...(owned.length !== (save.owned || []).length ? { owned } : {}), ...dr.part };
      try { opts.save = opts.onSave?.(part) || { ...save, ...part }; } catch (e) { console.warn('[좀비와 드래곤] 저장 실패', e); }
    } else {
      info.hint = loseHint(S, me);
      /* «파워업 먼저» : 같은 판 3연패 이상인데 출전 카드 평균 레벨이 이 판 권장(카드의 «권장 n»)보다 낮으면 안내 줄을 바꾼다 */
      if (lossN >= BP_MIN && myDeck.length) { const avg = myDeck.reduce((a, d) => a + (opts.save?.units?.[d.id]?.[0] || 1), 0) / myDeck.length; if (avg < (base0.expLevel || 1)) info.hint = '카드 레벨이 권장보다 낮아요 → 파워업 먼저!'; }
    }
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
    const best = Math.max(old, waves);
    const info = { mode: 'raid', t: S.t, coins, gems: 0, plate: '주간 습격', big: waves, bigSub: waves >= 40 ? '끝까지 버텼다! 웨이브' : '웨이브',
      line: `이번 주 최고 ${best} 웨이브${waves > old ? ' · 새 기록!' : ''}${fire ? ' · 불꽃 테두리 획득!' : ''}` };   // 주 번호(2026-W46) 대신 «이번 주» · 글자 «코인» 없이 아이콘 + 숫자
    if (waves > old) sound.say('raid/record');
    setTimeout(() => { if (!gone) hud.showPanel('win', info); }, 1200);   // 습격은 늘 «버틴 웨이브» 창 (승리 장면 · 새 기록 여부는 한 줄로만)
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
    const note = bad ? '연결이 어긋났어요 · 이 판은 기록하지 않아요' : S.over.forfeit ? '상대가 나갔어요 — 승리!' : S.over.timeout ? '시간 끝 — 드래곤캐슬 체력이 많은 쪽 승!' : '';
    const info = { mode: 'pvp', t: S.t, coins, gems: 0, ...(draw ? { plate: '무승부' } : {}), big: `${r.w}승 ${r.l}패${r.d ? ` ${r.d}무` : ''}`, bigSub: '내 전적',
      line: [note, pv.n >= PVP_DAY && !bad ? '오늘 보상은 다 받았어요' : ''].filter(Boolean).join(' · ') };
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
      if (S.over && !ui.done) finish().catch((e) => console.warn('[좀비와 드래곤] 결과 처리 실패', e));
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
  ui.paused = true; hud.showPanel('intro', { best: raid && opts.save?.raid?.w === raid.idx ? opts.save.raid.best || 0 : 0 });   // 스테이지 카드 → «출격!»
  /* 다시 하기도 늘 시작 창을 띄운다 (대표님 11/13 «편의품이 없어도 무조건 시작 창» — 옛 1터치 빠른 시작은 뺌) */
  if (net) setTimeout(() => { if (!gone && ui.intro) { ui.intro = false; ui.paused = false; hud.hidePanel(); sound.start(raid ? 'raid' : coop ? 'coop' : '', myDeck.map((d) => d.id)); } }, pvp ? 3000 : 4000);   // 멀티 : 카드를 잠깐 보여 주고 둘이 같이 시작 (한쪽만 기다리지 않게)
  const onHide = () => { if (document.hidden && !net && !ui.done && !ui.paused) { ui.paused = true; sound.pause(true); hud.showPanel('pause'); } };   // 앱을 내리면 일시정지
  document.addEventListener('visibilitychange', onHide);
  if (import.meta.env.DEV) { window.__idgBattle = { S, view, ui, cmds }; window.__idgHud = hud; }

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
