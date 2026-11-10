/**
 * 기준 장면 (그림 v3 확인용 · 전투 계산 없음) — 달밤 초록 언덕 · 양쪽 성 · 빛 · 분위기 생물 · 캐릭터 움직임.
 * 용과 좀비가 걸어와 맞붙고, 때리고, 밀려나고, 쓰러진다. 성 위 리더가 가끔 불을 뿜는다. 카메라가 천천히 오간다.
 * B2 에서 전투 코어를 붙이면 이 파일의 "가짜 싸움"은 지우고 world.js · anim.js 는 그대로 쓴다.
 */
import { Container, Sprite, ColorMatrixFilter } from 'pixi.js';
import { createWorld } from './world.js';
import { createAnim, makeFramePicker } from './anim.js';

let FIELD = 1400;                    // 장면 전체 넓이 (칸) — 화면 폭 + 260 (양쪽 성이 번갈아 보이게)
const CHAR_SCALE = 1.5;              // 640 크기로 그린 지금 캐릭터를 960 화면에 맞춤 (겜팀장 v3 크기가 오면 1)
const DRAGONS = ['kkomul', 'doldeung', 'bulttong', 'twetwe', 'ssaeng'];
const ZOMBIES = ['walker', 'chubby', 'pup', 'shield', 'archer', 'fart'];

export function startDemo(ctx, T, has, envMeta, commonMeta) {
  const { app, view } = ctx;
  const pick = makeFramePicker(T, has);
  const world = createWorld(ctx, T, envMeta);
  const GY = envMeta.groundY;
  FIELD = view.w + 260;
  const stage = new Container();           // 전장 (카메라를 따라 움직임)
  app.stage.addChild(world.back, stage, world.front);

  const white = new ColorMatrixFilter();
  white.matrix = [0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0];   // 맞은 순간 하얗게

  /* 양쪽 성 + 성 빛무리 */
  const glowAt = (parent, g, ox, oy) => {
    const s = new Sprite(T('amb/glow')); s.anchor.set(0.5); s.blendMode = 'add'; s.tint = g.color; s.alpha = 0.55; s.scale.set((g.r * 2) / 64);
    s.position.set(ox + g.x, oy + g.y); parent.addChild(s); return { s, base: (g.r * 2) / 64, flicker: g.flicker };
  };
  const castle = (name, x, lights) => {
    const s = new Sprite(T(name)); s.anchor.set(0.5, 1); s.position.set(x, GY + 6); stage.addChild(s);
    const gs = (lights || []).map((g) => glowAt(stage, g, x - s.width / 2, GY + 6 - s.height));
    return { s, gs };
  };
  const nest = castle('base/nest/0/hp0', 120, commonMeta.baseLights.nest);
  const tower = castle('base/tower/w01/hp1', FIELD - 120, commonMeta.baseLights.tower);
  const leader = new Sprite(T('leader/novart/0/idle0')); leader.anchor.set(0.5, 1); leader.scale.set(CHAR_SCALE);
  leader.position.set(124, GY + 6 - nest.s.height + commonMeta.nestFeetY); stage.addChild(leader);
  const leaderA = createAnim('leader/novart/0', pick);

  /* 캐릭터 */
  const units = new Container(); stage.addChild(units);
  const live = [];
  let iD = 0, iZ = 0;
  const spawn = (side) => {
    const prefix = side === 0 ? `dragon/${DRAGONS[iD++ % DRAGONS.length]}/${1 + (iD % 3 === 0 ? 1 : 0)}` : `zombie/${ZOMBIES[iZ++ % ZOMBIES.length]}/0`;
    const s = new Sprite(); s.anchor.set(0.5, 1); s.scale.set(CHAR_SCALE * (side ? -1 : 1), CHAR_SCALE);
    s.position.set(side ? FIELD - 200 : 200, GY + 2);
    units.addChild(s);
    const u = { s, side, hp: side ? 2 + Math.floor(Math.random() * 3) : 4 + Math.floor(Math.random() * 3), x: s.x, a: createAnim(prefix, pick, { speed: side ? 55 : 80 }), cd: 0, kb: 0 };
    u.a.set('walk'); live.push(u);
  };
  for (let k = 0; k < 4; k++) { spawn(0); spawn(1); live[live.length - 2].x -= k * 50; live[live.length - 1].x += k * 50; }

  /* 불 뿜기 입자 */
  const fire = new Container(); stage.addChild(fire);
  const flames = [];
  let t = 0, nextSpawn = 0, nextBreath = 4, breathing = 0;

  const tick = (ticker) => {
    const dt = Math.min(0.05, ticker.deltaMS / 1000);
    t += dt;
    /* 카메라 : 전장을 천천히 오간다 */
    const camX = window.__idgCamX ?? ((Math.sin(t * 0.25) + 1) / 2) * (FIELD - view.w);   // __idgCamX : 미리보기 점검용
    stage.x = -Math.round(camX); world.setCamera(camX); world.update(dt);

    if ((nextSpawn -= dt) <= 0) { spawn(live.filter((u) => u.side === 0).length <= live.filter((u) => u.side === 1).length ? 0 : 1); nextSpawn = 1.4; }
    for (const u of live) {
      const foes = live.filter((f) => f.side !== u.side && f.hp > 0);
      const front = foes.reduce((best, f) => (best == null || Math.abs(f.x - u.x) < Math.abs(best.x - u.x) ? f : best), null);
      const dist = front ? Math.abs(front.x - u.x) : 1e9;
      if (u.kb > 0) { u.kb -= dt; u.x -= (u.side ? -1 : 1) * 90 * dt; if (u.kb <= 0) u.a.set('walk'); }
      else if (u.hp <= 0) { /* 쓰러지는 중 */ }
      else if (dist < 46) {
        u.cd -= dt;
        if (u.a.state === 'walk' || u.a.state === 'idle') { u.a.set('fore'); u.cd = 0.35 + Math.random() * 0.2; }
        else if (u.a.state === 'fore' && u.cd <= 0) { u.a.set('hit'); front.hp--; front.a.flash(); if (Math.random() < 0.35 || front.hp <= 0) { front.kb = 0.35; front.a.set('kb'); } }
        else if (u.a.state === 'hit' && u.a.st > 0.1) u.a.set('back');
        else if (u.a.state === 'back' && u.a.st > 0.5) u.a.set('idle');
        else if (u.a.state === 'idle' && u.a.st > 0.3) u.a.set('fore');
      } else if (u.a.state !== 'walk') u.a.set('walk');
      if (u.a.state === 'walk') u.x += (u.side ? -1 : 1) * (u.side ? 34 : 48) * dt;
      u.s.texture = u.a.frame(dt);
      u.s.filters = u.a.flashT > 0 ? [white] : null;
      u.s.x = Math.round(u.x);
      if (u.hp <= 0 && u.kb <= 0) u.dead = true;
    }
    for (let i = live.length - 1; i >= 0; i--) {
      const u = live[i];
      if (u.dead || u.x < 150 || u.x > FIELD - 150) {
        if (u.dead) for (let k = 0; k < 6; k++) flames.push(puff(fire, T, u.x, GY - 20, 0xd8d0ff, (Math.random() - 0.5) * 60, -30 - Math.random() * 40));
        u.s.destroy(); live.splice(i, 1);
      }
    }
    units.children.sort((a, b) => a.y - b.y || a.x - b.x);

    /* 리더 : 쉬기 · 깜빡임 · 가끔 불 뿜기 */
    if ((nextBreath -= dt) <= 0 && breathing <= 0) { breathing = 1.2; leaderA.set('breath'); nextBreath = 6 + Math.random() * 3; }
    if (breathing > 0) {
      breathing -= dt;
      if (leaderA.st > 0.45) for (let k = 0; k < 3; k++) flames.push(puff(fire, T, leader.x + 40, leader.y - 46, [0xffd23f, 0xff8a2a, 0xff5a1a][k], 260 + Math.random() * 120, (Math.random() - 0.3) * 50));
      if (breathing <= 0) leaderA.set('idle');
    }
    leader.texture = leaderA.frame(dt);
    for (const c of [nest, tower]) for (const g of c.gs) if (g.flicker) { const f = 0.85 + Math.sin(t * 11 + g.base * 50) * 0.08 + (Math.random() - 0.5) * 0.06; g.s.scale.set(g.base * f); g.s.alpha = 0.45 * f + 0.1; }
    for (let i = flames.length - 1; i >= 0; i--) {
      const f = flames[i]; f.life -= dt;
      f.s.x += f.vx * dt; f.s.y += f.vy * dt; f.vy += 30 * dt; f.s.alpha = Math.max(0, f.life / f.max); f.s.scale.set(f.sc * (0.6 + f.life / f.max));
      if (f.life <= 0) { f.s.destroy(); flames.splice(i, 1); }
    }
  };
  app.ticker.add(tick);
  ctx.onResize(() => world.resize());
  return { destroy() { app.ticker?.remove(tick); } };
}

function puff(parent, T, x, y, color, vx, vy) {
  const s = new Sprite(T('amb/glow')); s.anchor.set(0.5); s.blendMode = 'add'; s.tint = color; s.position.set(x, y);
  parent.addChild(s);
  const life = 0.5 + Math.random() * 0.4, sc = 0.25 + Math.random() * 0.25;
  s.scale.set(sc);
  return { s, vx, vy, life, max: life, sc };
}
