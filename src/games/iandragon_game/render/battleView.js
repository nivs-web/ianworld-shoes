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

const AI = '/assets/iandragon_game/ai/';
export const GY = 440;
export const M = 170;
/** 코어 id → 그림 id (이름이 다른 것만) */
const ART = { chubby: 'cone', shield: 'helmet', bossFat: 'bossGiant' };
const artOf = (id) => ART[id] || id;
const nearest = (t) => { t.source.scaleMode = 'nearest'; return t; };
const tryLoad = (url) => Assets.load(url).then(nearest).catch(() => null);

export async function createBattleView(ctx, { world, L, dragons, enemies, leader = 'novart' }) {
  const { app, view } = ctx;
  const FIELD = M + L + M;
  /* ── 그림 받기 */
  const ids = [...new Set([...dragons.flatMap((d) => (d.lv >= 10 ? [d.id, d.id + '_2'] : [d.id])), ...enemies.map(artOf), leader, 'kkomul', 'walker'])];
  const rigs = {};
  await Promise.all(ids.map((id) => loadRig(id).then((r) => { rigs[id] = r; }).catch(() => {})));
  const wN = String(world).padStart(2, '0');
  const [bgTex, nestT, towerT, funTex] = await Promise.all([
    tryLoad(`${AI}bg/w${wN}_panel.png`).then((t) => t || tryLoad(`${AI}bg/w01_panel.png`)),
    Promise.all([0, 1, 2, 3].map((i) => tryLoad(`${AI}castles/nest_hp${i}.png`))),
    Promise.all([0, 1, 2, 3].map((i) => tryLoad(`${AI}castles/tower_w${wN}_hp${i}.png`).then((t) => t || tryLoad(`${AI}castles/tower_hp${i}.png`)))),
    loadFun().catch(() => null),   // 재미 그림이 없어도 전투는 연다 (코드 검토 2)
  ]);

  /* ── 층 : 배경 · 재미(뒤) · 성 · 유닛 · 효과 · 재미(앞) */
  const root = new Container(); app.stage.addChild(root);
  const bgBox = new Container(), funBack = new Container(), stage = new Container(), units = new Container(), fx = new Container(), funFront = new Container();
  units.sortableChildren = true;
  root.addChild(bgBox, funBack, stage, funFront);
  const k = bgTex ? 540 / bgTex.height : 1, bw = bgTex ? bgTex.width * k : FIELD;
  if (bgTex) for (let i = 0; i * bw < FIELD + bw; i++) { const s = new Sprite(bgTex); s.scale.set(i % 2 ? -k : k, k); s.x = i % 2 ? (i + 1) * bw : i * bw; bgBox.addChild(s); }
  const nest = new Sprite(nestT[0]); nest.anchor.set(0.5, 1); nest.position.set(M - 40, GY + 10);
  const tower = new Sprite(towerT[0]); tower.anchor.set(0.5, 1); tower.position.set(M + L + 40, GY + 10);
  stage.addChild(nest, tower, units, fx);
  const shade = new Graphics().rect(-50, -50, FIELD + 100, 700).fill(0x000000); shade.alpha = 0; root.addChild(shade);
  /* 안개 기믹 : 내 맨 앞 + 260칸 너머를 짙은 안개로 (화면 전용) */
  const fog = new Graphics(); root.addChildAt(fog, root.getChildIndex(funFront));

  /* ── 재미있는 요소 (자리표가 없는 월드는 하늘 요소만) */
  const spots = { ...(SPOTS[world] || { sky: [50, 200], ground: 437, dirtY: 494 }) };
  spots.safe = [260, FIELD - 260];
  let camX = 0, viewW = view.w;
  const fun = funTex ? createFun(funTex, { back: funBack, front: funFront, spots, getCam: () => camX, viewW: () => viewW, onStart: (id) => FUN_SOUND[id] && isOn('zdFunSound', id) && Audio.fun(FUN_SOUND[id]), every: nums('zdFunEvery') }) : { update() {}, hush() {}, ids: [], usable: [], trigger() {}, setOff() {} };
  fun.setOff(offKeys('zdFun'));   // 운영자가 끈 재미 요소 (관리자 화면 · services/switches.js)
  Audio.setFun(offKeys('zdFunSound').length < 17);   // 재미 소리 — 하나라도 켜져 있으면 소리 장치를 연다(켜진 것만 난다)
  const amb = createAmbient(funBack, world, () => camX, () => viewW);   // 월드 분위기 입자 (불티 · 눈 · 구름 · 불꽃)

  /* ── 리더 (내 기지 위) */
  const ldRig = rigs[leader] || null;
  const lead = ldRig ? createRigged(ldRig, 1, 1) : null;
  if (lead) { lead.set('idle'); lead.root.position.set(nest.x + 4, GY + 10 - nest.height + 58); stage.addChildAt(lead.root, stage.getChildIndex(units)); }

  const white = new ColorMatrixFilter();
  white.matrix = [0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0];
  const V = new Map();      // 코어 유닛 id → 그림
  const parts = [];         // 작은 효과 조각 { g, vx, vy, life, t, grav }
  const shakes = { nest: 0, tower: 0, screen: 0 };
  const seen = { breath: 0, bossAt: null, baseHp: [null, null], over: false };
  let breathFx = 0, overT = 0;
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

  const rigFor = (u) => {
    const art = u.def._art;
    if (u.side === 0) { const lv = dragons.find((d) => d.id === art)?.lv || 1; return (lv >= 10 && rigs[art + '_2']) || rigs[art] || rigs.kkomul; }
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
      }
      v.x += (M + u.x - v.x) * Math.min(1, dt * 18);
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
    }
    for (const [id, v] of V) {
      if (alive.has(id) && v.dieT < 0) continue;
      if (v.dieT < 0) { v.dieT = 0; puff(v.x, v.y - 30, 0xfff6c0, 10, 110, 0.5, 2); }
      v.dieT += dt; v.R.root.alpha = Math.max(0, 1 - v.dieT / 0.35); v.R.root.y = v.y - v.dieT * 30;
      if (v.dieT > 0.35) { v.R.root.destroy({ children: true }); V.delete(id); }
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
    if (p && p.st.breath > seen.breath) { seen.breath = p.st.breath; breathFx = 0.001; if (lead) lead.set('hit'); }
    if (breathFx > 0) {
      breathFx += dt;
      shade.alpha = breathFx < 0.2 ? 0.35 : Math.max(0, 0.35 - (breathFx - 0.2) * 1.2);
      const reach = M + (p ? p.leader.range : 600);
      if (breathFx < 0.6) for (let i = 0; i < 6; i++) {
        const x = M - 20 + (reach - M + 20) * Math.min(1, breathFx / 0.5) * Math.random();
        const col = BS.c[(Math.random() * BS.c.length) | 0];
        const g = BS.spin ? new Graphics().ellipse(0, 0, BS.r + 3, BS.r - 1).fill(col) : new Graphics().circle(0, 0, BS.r - 2 + Math.random() * 6).fill(col);
        g.blendMode = 'add'; g.position.set(x, GY - 20 - Math.random() * 50); fx.addChild(g);
        parts.push({ g, vx: 60, vy: BS.vy * (0.6 + Math.random() * 0.8), life: 0.45, t: 0, grav: BS.g });
      }
      if (breathFx < 0.5 && (BS.bolt || BS.ray) && Math.random() < 0.35) {   // 번개 줄기 · 햇살 기둥
        const x = M + 40 + (reach - M - 40) * Math.random();
        const g = new Graphics();
        if (BS.bolt) { let px = x, py = 30; g.moveTo(px, py); while (py < GY) { px += Math.random() * 24 - 12; py += 26 + Math.random() * 20; g.lineTo(px, py); } g.stroke({ width: 3, color: 0xfffbe0 }).stroke({ width: 8, color: 0xc08bff, alpha: 0.35 }); }
        else g.rect(x - 10, 0, 20, GY).fill({ color: 0xfff1a0, alpha: 0.35 });
        g.blendMode = 'add'; fx.addChild(g); parts.push({ g, vx: 0, vy: 0, life: 0.22, t: 0, grav: 0 });
      }
      if (breathFx > 1.2) { breathFx = 0; if (lead) lead.set('idle'); }
    }
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
    if (S.over.winner === 0) {   // 좀비 탑이 무너지고 좀비들이 줄행랑
      tower.y = GY + 10 + Math.min(60, overT * 40); tower.alpha = Math.max(0, 1 - overT / 1.6); if (overT < 1.2) { shakes.screen = 0.1; if (Math.random() < 0.5) puff(tower.x + (Math.random() - 0.5) * 80, GY - Math.random() * 60, 0x9a8c80, 2, 50, 0.6, 3); }
    } else if (overT < 1) shakes.nest = 0.1;
  }

  /* ── 카메라 : 전선 따라가기 + 끌어서 보기(손 떼고 3초 뒤 복귀) */
  let drag = null, handT = 0;
  const canvas = app.canvas;
  const toWorld = (dx) => dx * (view.w / canvas.clientWidth);
  const onDown = (e) => { drag = { x: e.clientX, cam: camX }; handT = 3; };
  const onMove = (e) => { if (!drag) return; camX = Math.max(0, Math.min(FIELD - view.w, drag.cam - toWorld(e.clientX - drag.x))); handT = 3; };
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
    root.position.set(-Math.round(camX) + sx, sy);
  }

  const api = {
    FIELD, hits: 0, bigHit: false,
    update(S, dt) {
      lastS = S;
      if (S.stage.fog) { let a = 0; for (const u of S.units) if (u.alive && u.side === 0) a = Math.max(a, u.x); const fx0 = M + a + 260; fog.clear(); for (let i = 0; i < 6; i++) fog.rect(fx0 + i * 30, 0, FIELD, 540).fill({ color: 0x8a90b8, alpha: 0.16 }); }
      syncUnits(S, dt); bases(S, dt); effects(S, dt); ending(S, dt); camera(S, dt);
      fun.update(dt); amb.update(dt); bossFx.update(S, dt, V);
      if (lead) lead.update(dt);
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
