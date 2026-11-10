/**
 * 그림 공장 시험판 장면 (2026-11-11) — 대표님 화풍 배경 · 대표님 성 그림(자동으로 잘라 냄) · 제미나이 부품 캐릭터(꼬물이 · 어슬렁 좀비).
 * 전투 계산 없음 (B2 에서 코어를 붙인다). 용과 좀비가 걸어와 맞붙고, 때리고, 밀려난다.
 */
import { Assets, Container, Sprite, ColorMatrixFilter } from 'pixi.js';
import { createWorld } from './world.js';
import { loadRig, createRigged } from './rig.js';

const AI = '/assets/iandragon_game/ai/';
const GY = 440;                       // 배경 그림의 풀 높이(437) 에 맞춘 발 줄

export async function startPilot(ctx, T) {
  const { app, view } = ctx;
  const nearest = (t) => { t.source.scaleMode = 'nearest'; return t; };
  /* 월드 1 캐릭터 — 그림 공장에서 나온 것만 (아직 없는 것은 건너뜀) */
  const tryRig = (id) => loadRig(id).catch(() => null);
  const DRAGON_IDS = ['kkomul', 'doldeung', 'bulttong', 'twetwe', 'ssaeng', 'kkomul_2'];
  const ZOMBIE_IDS = ['walker', 'cone', 'pup', 'archer', 'helmet', 'fart', 'gold'];
  const [bgTex, nestTex, towerTex, dr, zr, giant, leaderRig] = await Promise.all([
    Assets.load(AI + 'bg/w01_panel.png').then(nearest), Assets.load(AI + 'castles/nest_hp0.png'), Assets.load(AI + 'castles/tower_hp0.png'),
    Promise.all(DRAGON_IDS.map(tryRig)), Promise.all(ZOMBIE_IDS.map(tryRig)), tryRig('bossGiant'), tryRig('novart'),
  ]);
  const dragons = dr.filter(Boolean), zombies = zr.filter(Boolean);
  let iD = 0, iZ = 0, bossDone = false, t = 0, next = 0, breathAt = 5;
  const FIELD = view.w + 300;
  const world = createWorld(ctx, T, { layers: [], front: [], lights: {} });   // 박쥐 · 유령 · 반딧불만
  const bg = new Sprite(bgTex); bg.scale.set(540 / bgTex.height);
  const stage = new Container();
  app.stage.addChild(bg, world.back, stage, world.front);

  const nest = new Sprite(nestTex); nest.anchor.set(0.5, 1); nest.position.set(130, GY + 10);
  const tower = new Sprite(towerTex); tower.anchor.set(0.5, 1); tower.position.set(FIELD - 130, GY + 10);
  const units = new Container();
  stage.addChild(nest, tower, units);

  const white = new ColorMatrixFilter();
  white.matrix = [0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0];
  const live = [];
  const spawn = (side) => {
    const boss = side && giant && !bossDone && t > 12;
    if (boss) bossDone = true;
    const R = boss ? createRigged(giant, 1, -1) : side ? createRigged(zombies[iZ++ % zombies.length], 1, -1) : createRigged(dragons[iD++ % dragons.length], 1, 1);
    R.speed = side ? 0.9 : 1.1;
    const u = { R, side, x: side ? FIELD - 230 : 230, hp: boss ? 20 : side ? 3 : 4, kb: 0, cd: 0, flash: 0, boss };
    R.root.position.set(u.x, GY); units.addChild(R.root); live.push(u);
  };
  for (let k = 0; k < 3; k++) { spawn(0); spawn(1); live[live.length - 2].x -= k * 60; live[live.length - 1].x += k * 60; }

  /* 성 위 리더 (불 뿜기) */
  let leader = null;
  if (leaderRig) { leader = createRigged(leaderRig, 1, 1); leader.set('idle'); leader.root.position.set(nest.x + 4, GY + 10 - nest.height + 58); stage.addChild(leader.root); }
  const tick = (ticker) => {
    const dt = Math.min(0.05, ticker.deltaMS / 1000); t += dt;
    const cam = window.__idgCamX ?? ((Math.sin(t * 0.22) + 1) / 2) * (FIELD - view.w);
    stage.x = -Math.round(cam); bg.x = -Math.round(cam); world.setCamera(cam); world.update(dt);
    if ((next -= dt) <= 0) { spawn(live.filter((u) => !u.side).length <= live.filter((u) => u.side).length ? 0 : 1); next = 1.5; }
    for (const u of live) {
      const foe = live.filter((f) => f.side !== u.side && f.hp > 0).sort((a, b) => Math.abs(a.x - u.x) - Math.abs(b.x - u.x))[0];
      const d = foe ? Math.abs(foe.x - u.x) : 1e9;
      if (u.kb > 0) { u.kb -= dt; u.x -= (u.side ? -1 : 1) * 110 * dt; if (u.kb <= 0) u.R.set('walk'); }
      else if (u.hp > 0 && d < 52) {
        u.cd -= dt;
        if (u.R.state === 'walk') { u.R.set('fore'); u.cd = 0.35; }
        else if (u.R.state === 'fore' && u.cd <= 0) { u.R.set('hit'); foe.hp--; foe.flash = 0.07; if (Math.random() < 0.35 || foe.hp <= 0) { foe.kb = 0.35; foe.R.set('kb'); } }
        else if (u.R.state === 'hit' && u.R.st > 0.12) u.R.set('back');
        else if (u.R.state === 'back' && u.R.st > 0.45) { u.R.set('fore'); u.cd = 0.4 + Math.random() * 0.3; }
      } else if (u.R.state !== 'walk' && u.R.state !== 'kb') u.R.set('walk');
      if (u.R.state === 'walk') u.x += (u.side ? -1 : 1) * (u.side ? 36 : 50) * dt;
      u.R.update(dt);
      u.flash -= dt; u.R.root.filters = u.flash > 0 ? [white] : null;
      u.R.root.x = Math.round(u.x);
      if (u.hp <= 0 && u.kb <= 0) u.dead = true;
    }
    for (let i = live.length - 1; i >= 0; i--) { const u = live[i]; if (u.dead || u.x < 170 || u.x > FIELD - 170) { u.R.root.destroy({ children: true }); live.splice(i, 1); } }
    units.children.sort((a, b) => a.x - b.x);
    if (leader) { if ((breathAt -= dt) <= 0) { leader.set('hit'); breathAt = 6; } else if (leader.state === 'hit' && leader.st > 1.4) leader.set('idle'); leader.update(dt); }
  };
  app.ticker.add(tick);
  return { destroy() { app.ticker?.remove(tick); } };
}
