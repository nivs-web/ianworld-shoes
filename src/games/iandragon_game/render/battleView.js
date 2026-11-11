/**
 * 전투 화면 그리기 (B2 · 2026-11-11 야간) — 전투 코어 상태 S 를 읽어서 그리기만 한다. 계산에 손대지 않는다(기획서 15.3).
 *
 * 1칸 = 1wu. 코어 x=0(내 기지) → 화면 x=M, 코어 x=L(좀비 탑) → M+L. 전장 너비 FIELD = M + L + M.
 * 배경은 540 높이로 맞추고, 전장이 더 길면 좌우로 뒤집은 복사본을 이어 붙인다(이음새가 보이지 않게).
 * 유닛 = 부품 캐릭터(rig.js). 코어 상태 walk · fore · back · kb → 그림 상태 walk · fore · hit(0.12초) · back · kb.
 * 연출(맞음 번쩍 · 불꽃 · 쓰러짐 별가루 · 기지 흔들림/금 · 브레스 불줄기 · 보스 충격파 · 승리 때 탑 무너짐)은 전부 화면 전용.
 */
import { Assets, Container, Sprite, Graphics, ColorMatrixFilter } from 'pixi.js';
import { loadRig, createRigged } from './rig.js';
import { loadFun, createFun, FUN_SOUND } from './fun.js';
import * as Audio from '../audio/index.js';
import { offKeys, isOn, nums } from '../../../services/switches.js';
import { SPOTS } from './funSpots.js';
import { createAmbient } from './ambient.js';
import { createBossFx } from './bossFx.js';
import { BREATH_COLORS } from '../data/looks.js';

const AI = '/assets/iandragon_game/ai/';
export const GY = 440;
export const M = 170;
/** 코어 id → 그림 id (이름이 다른 것만) */
const ART = { chubby: 'cone', shield: 'helmet', bossFat: 'bossGiant' };
const artOf = (id) => ART[id] || id;
const nearest = (t) => { t.source.scaleMode = 'nearest'; return t; };
const tryLoad = (url) => Assets.load(url).then(nearest).catch(() => null);

export async function createBattleView(ctx, { world, L, dragons, enemies, leader = 'novart', pvp = false, mirror = false, foeLeader = null, look = {}, lookR = {} }) {   // look = 왼쪽(0번 편) · lookR = 오른쪽(대결 상대)
  const { app, view } = ctx;
  const FIELD = M + L + M;
  /* ── 그림 받기 */
  const ids = [...new Set([...dragons.flatMap((d) => (d.lv >= 10 ? [d.id, d.id + '_2'] : [d.id])), ...enemies.map(artOf), leader, ...(foeLeader ? [foeLeader] : []), 'kkomul', 'walker'])];
  const rigs = {};
  await Promise.all(ids.map((id) => loadRig(id).then((r) => { rigs[id] = r; }).catch(() => {})));
  const wN = String(world).padStart(2, '0');
  const [bgTex, nestT, towerT, funTex] = await Promise.all([
    tryLoad(`${AI}bg/w${wN}_panel.png`).then((t) => t || tryLoad(`${AI}bg/w01_panel.png`)),
    Promise.all([0, 1, 2, 3].map((i) => tryLoad(`${AI}castles/nest_hp${i}.png`))),
    Promise.all([0, 1, 2, 3].map((i) => tryLoad(`${AI}castles/tower_w${wN}_hp${i}.png`).then((t) => t || tryLoad(`${AI}castles/tower_hp${i}.png`)))),
    loadFun().catch(() => null),   // 재미 그림이 없어도 전투는 연다 (코드 검토 2)
  ]);

  if (pvp) towerT.splice(0, 4, ...nestT);   // 대결 : 양쪽 다 용 둥지
  /* ── 층 : 배경 · 재미(뒤) · 성 · 유닛 · 효과 · 재미(앞) */
  const root = new Container(); app.stage.addChild(root);
  const bgBox = new Container(), funBack = new Container(), stage = new Container(), units = new Container(), fx = new Container(), funFront = new Container();
  units.sortableChildren = true;
  root.addChild(bgBox, funBack, stage, funFront);
  const k = bgTex ? 540 / bgTex.height : 1, bw = bgTex ? bgTex.width * k : FIELD;
  if (bgTex) for (let i = 0; i * bw < FIELD + bw; i++) { const s = new Sprite(bgTex); s.scale.set(i % 2 ? -k : k, k); s.x = i % 2 ? (i + 1) * bw : i * bw; bgBox.addChild(s); }
  const nest = new Sprite(nestT[0]); nest.anchor.set(0.5, 1); nest.position.set(M - 40, GY + 10);
  const tower = new Sprite(towerT[0]); tower.anchor.set(0.5, 1); tower.position.set(M + L + 40, GY + 10); if (pvp) tower.scale.x = -1;
  stage.addChild(nest, tower, units, fx);
  const shade = new Graphics().rect(-50, -50, FIELD + 100, 700).fill(0x000000); shade.alpha = 0; root.addChild(shade);
  /* 안개 기믹 : 내 맨 앞 + 260칸 너머를 짙은 안개로 (화면 전용) */
  const fog = new Graphics(); root.addChildAt(fog, root.getChildIndex(funFront));
  const flashG = new Graphics(); flashG.blendMode = 'add'; root.addChild(flashG); let flashT = 0, flashC = 0xffffff;   // 포효 · 스킬 번쩍

  /* ── 재미있는 요소 (자리표가 없는 월드는 하늘 요소만) */
  const spots = { ...(SPOTS[world] || { sky: [50, 200], ground: 437, dirtY: 494 }) };
  spots.safe = [260, FIELD - 260];
  let camX = 0, viewW = view.w;
  const fun = funTex ? createFun(funTex, { back: funBack, front: funFront, spots, getCam: () => camX, viewW: () => viewW, onStart: (id) => FUN_SOUND[id] && isOn('zdFunSound', id) && Audio.fun(FUN_SOUND[id]), every: nums('zdFunEvery') }) : { update() {}, hush() {}, ids: [], usable: [], trigger() {}, setOff() {} };
  if (import.meta.env.DEV) window.__idgFun = fun;   // 미리보기 점검용 (__idgFun.trigger('owl'))
  fun.setOff(offKeys('zdFun'));   // 운영자가 끈 재미 요소 (관리자 화면 · services/switches.js)
  Audio.setFun(offKeys('zdFunSound').length < 17);   // 재미 소리 — 하나라도 켜져 있으면 소리 장치를 연다(켜진 것만 난다)
  const amb = createAmbient(funBack, world, () => camX, () => viewW);   // 월드 분위기 입자 (불티 · 눈 · 구름 · 불꽃)

  /* ── 리더 (내 기지 위) */
  /* 덮는 모자(cover) : 그 대장 용의 머리 텍스처(head · blink · breath)를 뿔 · 볏을 지운 그림으로 바꿔 끼운다 (보조 3차 · 대표님 «모자가 이마를 덮고 뿔이 뚫으면 안 됨») */
  const WEARP = fetch('/assets/iandragon_game/ai/meta/wear.json').then((r) => r.json()).catch(() => null);
  async function wearRig(data, art, lk) {
    if (!data || !lk?.hat) return data;
    const e = (await WEARP)?.leaders?.[art]?.hat?.['hat_' + lk.hat];
    if (!e?.head) return data;
    const tex = { ...data.tex };
    for (const [n, file] of Object.entries(e.head)) { const t = await tryLoad('/assets/iandragon_game/' + file); if (t) tex[n] = t; }
    return { rig: data.rig, tex };
  }
  const ldRig = await wearRig(rigs[leader] || null, leader, look);
  const lead = ldRig ? createRigged(ldRig, 1, 1) : null;
  const lead2 = pvp && foeLeader && rigs[foeLeader] ? createRigged(await wearRig(rigs[foeLeader], foeLeader, lookR), 1, -1) : null;   // 대결 : 오른쪽 둥지 위 상대 리더
  if (lead2) { lead2.set('idle'); lead2.root.position.set(tower.x - 16, GY + 10 - tower.height + 58); stage.addChildAt(lead2.root, stage.getChildIndex(units)); }
  /* 꾸미기 (META 2장) : 대장 용 머리 위 모자 · 목 장식 + 성 꼭대기 깃발 — 그림은 보조 ai/meta/*, 없으면 안 붙인다 */
  /* 착용 부품 (보조 2차 · 대표님 «상점 아이콘과 용이 쓴 모습은 달라야») — ai/meta/wear/ 옆모습 부품을 head · torso 부품에 붙인다.
     좌표 = ai/meta/wear.json (tools/idg-wear-fit.mjs 가 대장 용마다 계산) · 예시 tools/idg-gallery/viewer.js attachWear */
  async function wear(R, art, lk) {
    const body = R?.root.children[0], data = rigs[art], W = await WEARP, L = W?.leaders?.[art];
    if (!body || !data || !L) return;
    const idx = (n) => data.rig.parts.findIndex((p) => p.n === n);
    const torso = body.children[idx('torso')], head = body.children[idx('head')];
    const wt = (file) => tryLoad('/assets/iandragon_game/' + file);
    const hk = 'hat_' + lk.hat, nk = 'neck_' + lk.neck;   // 표 열쇠 = 그림 이름
    if (lk.hat && W.items[hk] && L.hat?.[hk] && head) { const t = await wt(W.items[hk].file); if (t && !head.destroyed) { const sp = new Sprite(t); sp.position.set(L.hat[hk].x, L.hat[hk].y); head.addChild(sp); } }
    const it = lk.neck && W.items[nk];
    if (it && torso) {
      const at = it.layer === 'behind' ? L.nape : L.neck;
      const mk = async (file) => { const t = await wt(file); if (!t) return null; const sp = new Sprite(t); sp.anchor.set(it.anchor[0], it.anchor[1]); sp.position.set(at.x, at.y); return sp; };
      const behind = async (file) => { const sp = await mk(file); if (!sp || torso.destroyed || torso.parent !== body) return; const box = new Container(); box.addChild(sp); body.addChildAt(box, body.getChildIndex(torso)); box.position.copyFrom(torso.position); follow.push([box, torso]); };
      if (it.layer === 'split') { const fr = await mk(it.files.front); if (fr && !torso.destroyed) torso.addChild(fr); await behind(it.files.back); }
      else await behind(it.file);
    }
  }
  async function dress(rig, lk, castle, art) {
    const flagT = lk.flag ? await tryLoad(`${AI}meta/flag_${lk.flag}.png`) : null;
    if (rig) await wear(rig, art, lk);
    if (flagT && castle) {   // 성 깃발 : 깃대 + 펄럭이는 깃발 (성 뒤 왼쪽 위)
      const side = castle === tower ? -1 : 1, top = GY + 10 - castle.height;
      const pole = new Graphics().rect(-1.5, -64, 3, 64).fill(0x5a3a1a); pole.position.set(castle.x - side * castle.width * 0.32, top + 18);
      const f = new Sprite(flagT); f.anchor.set(0, 0); f.width = 30; f.height = 44; f.scale.x *= side; f.position.set(pole.x + side * 1.5, pole.y - 62);
      stage.addChildAt(pole, stage.getChildIndex(castle)); stage.addChildAt(f, stage.getChildIndex(castle)); flags.push(f);
    }
  }
  const flags = [], follow = [];   // follow = 몸통 뒤 층 장식이 torso 를 따라가게 [상자, torso]
  await Promise.all([dress(lead, look, nest, leader), dress(lead2, lookR, pvp ? tower : null, foeLeader)]);
  if (lead) { lead.set('idle'); lead.root.position.set(nest.x + 16, GY + 10 - nest.height + 58); stage.addChildAt(lead.root, stage.getChildIndex(units)); lead.baseY = lead.root.y; }
  if (lead2) lead2.baseY = lead2.root.y;

  const white = new ColorMatrixFilter();
  white.matrix = [0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0];
  const V = new Map();      // 코어 유닛 id → 그림
  const parts = [];         // 작은 효과 조각 { g, vx, vy, life, t, grav }
  const shakes = { nest: 0, tower: 0, screen: 0 };
  const seen = { breath: 0, bossAt: null, baseHp: [null, null], over: false };
  let breathFx = 0, overT = 0, bSide = 0, bP = null, bBS = null;
  seen.by = [];
  const bx = (x) => (bSide ? FIELD - x : x);   // 오른쪽 편 브레스는 좌우 반대로
  /* 리더마다 다른 브레스 (화면 전용) : 색 · 위로/아래로 · 크기 · 특수(번개 줄기 · 햇살 기둥) */
  const BREATH = {
    novart: { c: [0xff7a1a, 0xffd04a], vy: -40, g: 0, r: 6 },
    aquantis: { c: [0x4fc3ff, 0xbff0ff, 0xffffff], vy: -90, g: 380, r: 5 },
    forestia: { c: [0x6bd64a, 0xb8f07a, 0x2f8f3a], vy: -20, g: 30, r: 5, spin: true },
    crimsonde: { c: [0xff3a1a, 0xff8a2a, 0xffe08a], vy: -170, g: 0, r: 8 },
    volttail: { c: [0xfff35a, 0xc08bff], vy: -10, g: 0, r: 4, bolt: true },
    solaris: { c: [0xfff6c0, 0xffd84a], vy: -20, g: 0, r: 5, ray: true },
  };
  const BS = BREATH[leader] || BREATH.novart;
  const bossFx = createBossFx({ layer: app.stage, fx, M, GY, view, artOf: (def) => artOf(def._art), shake: (t) => { shakes.screen = Math.max(shakes.screen, t); } });   // 보스 컷인 · 큰 공격 경고 (bossFx.js)

  /* 상태 아이콘 : 약해짐(보라) > 되살아날 유령 > 방패 > 안 밀림 > 독 공격 > 정화 공격 */
  const ST = ['weaken', 'revive', 'shield', 'noknock', 'poison', 'purify'];
  const stTex = Object.fromEntries(await Promise.all(ST.map(async (k) => [k, await tryLoad(`/assets/iandragon_game/ui/hud_st_${k}_xs.png`)])));
  const badges = new Container(); stage.addChild(badges);
  const stOf = (u) => (u.weakT > 0 ? 'weaken' : u.def.revive && !u.revived ? 'revive' : u.barrier > 0 ? 'shield' : u.def.kbImmune ? 'noknock' : u.def.poison ? 'poison' : u.def.purify ? 'purify' : null);
  const rigFor = (u) => {
    const art = u.def._art;
    if (u.side === 0 || pvp) { const lv = dragons.find((d) => d.id === art)?.lv || 1; return (lv >= 10 && rigs[art + '_2']) || rigs[art] || rigs.kkomul; }
    return rigs[artOf(art)] || rigs.walker;
  };
  function puff(x, y, color, n = 6, spd = 80, life = 0.4, r = 2) {
    for (let i = 0; i < n; i++) {
      const g = new Graphics().circle(0, 0, r).fill(color); g.position.set(x, y); g.blendMode = 'add'; fx.addChild(g);
      const a = Math.random() * Math.PI * 2;
      parts.push({ g, vx: Math.cos(a) * spd * (0.5 + Math.random()), vy: Math.sin(a) * spd * (0.5 + Math.random()) - 30, life, t: 0, grav: 120 });
    }
  }
  function shot(from, to, color, area) {
    const g = new Graphics().circle(0, 0, 3).fill(color).circle(0, 0, 6).fill({ color, alpha: 0.3 }); g.blendMode = 'add'; fx.addChild(g);
    parts.push({ g, x0: from.x, y0: from.y, x1: to.x, y1: to.y, life: 0.22, t: 0, shot: true, color, area });
  }

  function syncUnits(S, dt) {
    const alive = new Set();
    for (const u of S.units) {
      alive.add(u.id);
      let v = V.get(u.id);
      if (!v) {
        const R = createRigged(rigFor(u), u.boss ? 1 : 1, u.side === 0 ? 1 : -1);
        R.speed = u.side === 0 ? 1.1 : 0.9;
        v = { R, x: M + u.x, hp: u.hp, st: u.state, hitT: 0, flash: 0, kbT: 0, y: GY + ((u.id * 37) % 13) - 6, dieT: -1 };
        R.root.position.set(v.x, v.y); R.root.zIndex = v.y + (u.boss ? -20 : 0); units.addChild(R.root); V.set(u.id, v);
        v.h = Math.min(220, R.root.height || 60);
      }
      if (!v.flee) v.x += (M + u.x - v.x) * Math.min(1, dt * 18);   // 도망치는 좀비는 코어 위치를 안 따름
      const R = v.R;
      if (u.hp < v.hp) { api.hits++; api.bigHit = v.hp - u.hp > u.maxHp * 0.25; v.flash = 0.08; if (u.hp > 0) puff(v.x, v.y - 30, u.side ? 0xfff0a0 : 0xffffff, 4, 60, 0.25, 1.6); }
      v.hp = u.hp;
      if (u.state !== v.st) {
        if (u.state === 'back' && v.st === 'fore') { v.hitT = 0.12; if ((u.def.range || 0) > 100) aim(u, v); }
        if (u.state === 'kb') v.kbT = 0;
        v.st = u.state;
      }
      const st = u.state === 'back' && v.hitT > 0 ? 'hit' : u.state;
      R.set(st); v.hitT -= dt;
      const frozen = u.freezeT > 0, buried = u.burrowT > 0 || u.burrowed, corpse = u.corpseT > 0;
      R.root.tint = frozen ? 0x9fe8ff : u.weakT > 0 ? 0xc9a0ff : 0xffffff;
      if (!frozen && !corpse) R.update(dt * (u.slowT > 0 ? 0.5 : 1));
      let dy = 0;
      if (u.state === 'kb') { v.kbT += dt; dy = -Math.sin(Math.min(1, v.kbT / 0.35) * Math.PI) * (u.boss ? 6 : 14); }
      R.root.alpha = buried ? 0 : corpse ? 0.5 : 1;
      R.root.rotation = corpse ? (u.side ? -1.3 : 1.3) : 0;
      R.root.position.set(Math.round(v.x), Math.round(v.y + dy));
      v.flash -= dt; R.root.filters = v.flash > 0 ? [white] : null;
      if (u.hp < u.maxHp && v.flash > 0) v.barT = 1.5;
      if ((v.barT = (v.barT || 0) - dt) > 0 && u.alive && !buried) {   // 체력바 : 맞으면 잠깐
        if (!v.bar) { v.bar = new Graphics(); badges.addChild(v.bar); }
        const w = u.boss ? 60 : 30, f = Math.max(0, u.hp / u.maxHp);
        v.bar.clear().rect(-w / 2, 0, w, 4).fill({ color: 0x000000, alpha: 0.6 }).rect(-w / 2, 0, w * f, 4).fill(u.side === (mirror ? 1 : 0) ? 0x6bdc6b : 0xff5a4a);
        v.bar.visible = true; v.bar.alpha = Math.min(1, v.barT * 2); v.bar.position.set(Math.round(v.x), Math.round(v.y + dy - (v.h || 60) - 4));
      } else if (v.bar) v.bar.visible = false;
      const sk = u.alive && !buried ? stOf(u) : null, tx = sk && stTex[sk];
      if (tx) {
        if (!v.badge) { v.badge = new Sprite(tx); v.badge.anchor.set(0.5, 1); v.badge.width = v.badge.height = 20; badges.addChild(v.badge); }
        if (v.badge.texture !== tx) { v.badge.texture = tx; v.badge.width = v.badge.height = 20; }
        v.badge.visible = true; v.badge.alpha = corpse ? 0.6 : 0.95; v.badge.position.set(Math.round(v.x), Math.round(v.y + dy - v.h - 10));
      } else if (v.badge) v.badge.visible = false;
    }
    for (const [id, v] of V) {
      if (alive.has(id) && v.dieT < 0) continue;
      if (v.dieT < 0) { v.dieT = 0; puff(v.x, v.y - 30, 0xfff6c0, 10, 110, 0.5, 2); }
      if (v.badge) v.badge.visible = false;
      if (v.bar) v.bar.visible = false;
      v.dieT += dt; v.R.root.alpha = Math.max(0, 1 - v.dieT / 0.35); v.R.root.y = v.y - v.dieT * 30;
      if (v.dieT > 0.35) { v.R.root.destroy({ children: true }); v.badge?.destroy(); v.bar?.destroy(); V.delete(id); }
    }
  }
  /** 원거리 : 가장 가까운 상대에게 불덩이 / 침을 날린다 (그림 전용) */
  function aim(u, v) {
    let best = null, bd = 1e9;
    for (const q of lastS.units) { if (q.side === u.side || !q.alive) continue; const d = Math.abs(q.x - u.x); if (d < bd) { bd = d; best = q; } }
    const tx = best ? M + best.x : v.x + (u.side ? -1 : 1) * Math.min(u.def.range, 300);
    shot({ x: v.x + (u.side ? -14 : 14), y: v.y - 40 }, { x: tx, y: v.y - 30 }, u.side ? 0x9cff6a : 0xffa040, !!u.def.area);
  }
  let lastS = { units: [] };

  function bases(S, dt) {
    for (const side of [0, 1]) {
      const b = S.base[side], prev = seen.baseHp[side];
      if (prev != null && b.hp < prev) { shakes[side ? 'tower' : 'nest'] = 0.18; shakes.screen = Math.max(shakes.screen, 0.1); }
      seen.baseHp[side] = b.hp;
      const r = b.maxHp ? b.hp / b.maxHp : 1, i = r > 0.75 ? 0 : r > 0.5 ? 1 : r > 0.25 ? 2 : 3;
      const spr = side ? tower : nest, T = side ? towerT : nestT;
      if (T[i]) spr.texture = T[i];
      const key = side ? 'tower' : 'nest'; shakes[key] -= dt;
      spr.x = (side ? M + L + 40 : M - 40) + (shakes[key] > 0 ? (Math.random() * 4 - 2) : 0);
    }
  }
  function effects(S, dt) {
    const p = S.players[0];
    const allBreath = S.players.reduce((a, q) => a + q.st.breath, 0);   // 멀티 : 누가 쏘든 브레스 연출
    if (p && allBreath > seen.breath) {
      let who = 0; S.players.forEach((q, i) => { if (q.st.breath > (seen.by[i] || 0)) who = i; seen.by[i] = q.st.breath; });
      seen.breath = allBreath; breathFx = 0.001; bP = S.players[who]; bSide = pvp ? bP.side : 0; const lkB = bSide ? lookR : look; bBS = BREATH_COLORS[lkB.breath] ? { ...((bSide && BREATH[foeLeader]) || BS), c: BREATH_COLORS[lkB.breath] } : (bSide && BREATH[foeLeader]) || BS;   // 브레스 색 꾸미기 (양쪽)   // 내 브레스 색 꾸미기
      const L0 = bSide ? lead2 : lead; if (L0) L0.set('hit');
    }
    if (breathFx > 0) {
      breathFx += dt;
      shade.alpha = breathFx < 0.2 ? 0.35 : Math.max(0, 0.35 - (breathFx - 0.2) * 1.2);
      const reach = M + (bP ? bP.leader.range : 600);
      if (breathFx < 0.6) for (let i = 0; i < 6; i++) {
        const x = M - 20 + (reach - M + 20) * Math.min(1, breathFx / 0.5) * Math.random();
        const col = bBS.c[(Math.random() * bBS.c.length) | 0];
        const g = bBS.spin ? new Graphics().ellipse(0, 0, bBS.r + 3, bBS.r - 1).fill(col) : new Graphics().circle(0, 0, bBS.r - 2 + Math.random() * 6).fill(col);
        g.blendMode = 'add'; g.position.set(bx(x), GY - 20 - Math.random() * 50); fx.addChild(g);
        parts.push({ g, vx: bSide ? -60 : 60, vy: bBS.vy * (0.6 + Math.random() * 0.8), life: 0.45, t: 0, grav: bBS.g });
      }
      if (breathFx < 0.5 && (bBS.bolt || bBS.ray) && Math.random() < 0.35) {   // 번개 줄기 · 햇살 기둥
        const x = M + 40 + (reach - M - 40) * Math.random();
        const g = new Graphics();
        if (bBS.bolt) { let px = bx(x), py = 30; g.moveTo(px, py); while (py < GY) { px += Math.random() * 24 - 12; py += 26 + Math.random() * 20; g.lineTo(px, py); } g.stroke({ width: 3, color: 0xfffbe0 }).stroke({ width: 8, color: 0xc08bff, alpha: 0.35 }); }
        else g.rect(bx(x) - 10, 0, 20, GY).fill({ color: 0xfff1a0, alpha: 0.35 });
        g.blendMode = 'add'; fx.addChild(g); parts.push({ g, vx: 0, vy: 0, life: 0.22, t: 0, grav: 0 });
      }
      if (breathFx > 1.2) { breathFx = 0; if (lead) lead.set('idle'); if (lead2) lead2.set('idle'); }
    }
    { const rg = S.players.reduce((a, q) => a + q.st.rageUse, 0), sk = S.players.reduce((a, q) => a + q.st.skill, 0);
      if (rg > (seen.rage || 0)) { flashT = 0.35; flashC = 0xffd84a; shakes.screen = Math.max(shakes.screen, 0.2); }   // 포효 : 금빛 번쩍 (GDD 660)
      if (sk > (seen.skill || 0)) { flashT = 0.25; flashC = 0x9fd8ff; shakes.screen = Math.max(shakes.screen, 0.15); }   // 스킬 : 푸른 번쩍
      seen.rage = rg; seen.skill = sk;
      if (flashT > 0) { flashT -= dt; flashG.clear().rect(-50, -50, FIELD + 100, 700).fill({ color: flashC, alpha: Math.max(0, flashT) * 0.9 }); } else if (flashG.width) flashG.clear(); }
    if (S.st.bossAt != null && seen.bossAt == null) {
      seen.bossAt = S.st.bossAt; fun.hush(4); shakes.screen = 0.5;
      const ring = new Graphics().circle(0, 0, 20).stroke({ width: 6, color: 0xffe08a }); ring.position.set(M + L - 20, GY - 30); fx.addChild(ring);
      parts.push({ g: ring, ring: true, life: 0.7, t: 0 });
    }
    for (let i = parts.length - 1; i >= 0; i--) {
      const q = parts[i]; q.t += dt; const k2 = q.t / q.life;
      if (q.shot) { q.g.position.set(q.x0 + (q.x1 - q.x0) * k2, q.y0 + (q.y1 - q.y0) * k2 - Math.sin(k2 * Math.PI) * 18); }
      else if (q.ring) { q.g.scale.set(1 + k2 * 14); q.g.alpha = 1 - k2; }
      else { q.vy += (q.grav || 0) * dt; q.g.x += q.vx * dt; q.g.y += q.vy * dt; q.g.alpha = 1 - k2; }
      if (q.t >= q.life) { if (q.shot) puff(q.x1, q.y1, q.color, q.area ? 10 : 5, q.area ? 90 : 60, 0.3, 2); q.g.destroy(); parts.splice(i, 1); }
    }
  }
  function ending(S, dt) {
    if (!S.over) return;
    overT += dt;
    if (S.over.winner === 0 && !pvp) for (const u of S.units) { const v = V.get(u.id); if (v && u.side === 1 && u.alive) { v.flee = true; v.x += dt * 260; v.R.root.scale.x = Math.abs(v.R.root.scale.x); } }   // 좀비들 줄행랑 (오른쪽으로 도망)
    if (S.over.winner === 0) {   // 좀비 탑이 무너지고 좀비들이 줄행랑
      tower.y = GY + 10 + Math.min(60, overT * 40); tower.alpha = Math.max(0, 1 - overT / 1.6); if (overT < 1.2) { shakes.screen = 0.1; if (Math.random() < 0.5) puff(tower.x + (Math.random() - 0.5) * 80, GY - Math.random() * 60, 0x9a8c80, 2, 50, 0.6, 3); }
    } else if (overT < 1) shakes.nest = 0.1;
    /* 대결 : 이긴 쪽 리더가 깡충깡충 (멀티 기획 5장) */
    if (pvp && S.over.winner >= 0) { const w = S.over.winner === 0 ? lead : lead2; if (w) { w.root.y = w.baseY - Math.abs(Math.sin(overT * 7)) * 18; if (overT < 0.05) w.set('hit'); } }
  }

  /* ── 카메라 : 전선 따라가기 + 끌어서 보기(손 떼고 3초 뒤 복귀) */
  let drag = null, handT = 0;
  const canvas = app.canvas;
  const toWorld = (dx) => dx * (view.w / canvas.clientWidth);
  const onDown = (e) => { drag = { x: e.clientX, cam: camX }; handT = 3; };
  const onMove = (e) => { if (!drag) return; camX = Math.max(0, Math.min(FIELD - view.w, drag.cam - (mirror ? -1 : 1) * toWorld(e.clientX - drag.x))); handT = 3; };
  const onUp = () => { drag = null; };
  canvas.addEventListener('pointerdown', onDown); window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp); window.addEventListener('blur', onUp);   // iOS 제스처 · 알림으로 끊겨도 카메라가 멈추지 않게 (코드 검토 8)

  function camera(S, dt) {
    viewW = view.w;
    if (!drag) handT -= dt;
    if (!drag && handT <= 0) {
      let a = 0, b = L;
      for (const u of S.units) { if (!u.alive) continue; if (u.side === 0) a = Math.max(a, u.x); else b = Math.min(b, u.x); }
      const target = Math.max(0, Math.min(FIELD - view.w, M + (a + b) / 2 - view.w / 2));
      camX += (target - camX) * Math.min(1, dt * 2.5);
    }
    shakes.screen -= dt;
    const sx = shakes.screen > 0 ? Math.round(Math.random() * 4 - 2) : 0, sy = shakes.screen > 0 ? Math.round(Math.random() * 2 - 1) : 0;
    if (mirror) { root.scale.x = -1; root.position.set(Math.round(camX + view.w) + sx, sy); }   // 오른쪽 편 = 좌우 뒤집어 그린다
    else root.position.set(-Math.round(camX) + sx, sy);
  }

  const api = {
    FIELD, hits: 0, bigHit: false,
    update(S, dt) {
      lastS = S;
      if (S.stage.fog) { let a = 0; for (const u of S.units) if (u.alive && u.side === 0) a = Math.max(a, u.x); const fx0 = M + a + 260; fog.clear(); for (let i = 0; i < 6; i++) fog.rect(fx0 + i * 30, 0, FIELD, 540).fill({ color: 0x8a90b8, alpha: 0.16 }); }
      syncUnits(S, dt); bases(S, dt); effects(S, dt); ending(S, dt); camera(S, dt);
      fun.update(dt); amb.update(dt); bossFx.update(S, dt, V);
      if (lead) lead.update(dt);
      if (lead2) lead2.update(dt);
      for (const [b, t] of follow) { if (b.destroyed || t.destroyed) continue; b.position.copyFrom(t.position); b.rotation = t.rotation; }
      for (const f of flags) f.skew.y = Math.sin(performance.now() / 260 + f.x) * 0.06;   // 깃발 펄럭
    },
    /** 미니맵 · 시작 위치 */
    setCam(x) { camX = Math.max(0, Math.min(FIELD - view.w, x)); handT = 3; },
    get cam() { return camX; },
    fun,
    destroy() {
      canvas.removeEventListener('pointerdown', onDown); window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp); window.removeEventListener('blur', onUp);
      bossFx.destroy(); root.destroy({ children: true });
    },
  };
  return api;
}
/** 코어 유닛 def 에 그림 id 를 달아 둔다 (유닛 표에서 키를 찾아서) */
export function tagArt(D) {
  for (const [id, d] of Object.entries(D.units)) d._art = id;
  for (const [id, d] of Object.entries(D.enemies)) d._art = id;
}
