/**
 * B0 임시 장면 — 그림 시트 · 정수배 도트 · 가로 화면이 제대로 붙었는지 눈으로 확인하는 용도.
 * 전투 계산은 없다 (전투 코어는 B1, 진짜 전장은 B2). **B2 에서 이 파일은 지운다.**
 */

import { Container, Sprite, TilingSprite } from 'pixi.js';

const GROUND_Y = 300;            // 발이 닿는 줄 (칸)
const DRAGONS = ['kkomul', 'doldeung', 'bulttong', 'twetwe', 'ssaeng'];
const ZOMBIES = ['walker', 'pup', 'chubby', 'archer', 'shield', 'fart'];

export function startDemo(ctx, sheet) {
  const { app, view } = ctx;
  const T = (name) => sheet.textures[name];
  const root = new Container();
  app.stage.addChild(root);

  /* 배경 4겹 — 가로로 이어 붙는 타일 */
  const layers = [
    ['bg/w01/sky', 0, 0.0],
    ['bg/w01/far', GROUND_Y - 140, 0.2],
    ['bg/w01/near', GROUND_Y - 80, 0.5],
    ['bg/w01/ground', GROUND_Y, 1.0],
  ].map(([name, y, speed]) => {
    const t = new TilingSprite({ texture: T(name), width: view.w, height: T(name).height });
    t.y = y;
    root.addChild(t);
    return { t, speed };
  });

  const nest = new Sprite(T('base/nest/0/hp0'));
  const tower = new Sprite(T('base/tower/w01/hp1'));
  const leader = new Sprite(T('leader/novart/0/idle0'));
  root.addChild(nest, tower, leader);

  const units = new Container();
  root.addChild(units);
  const live = [];
  let t = 0, spawnD = 0, spawnZ = 30, iD = 0, iZ = 0;

  const place = () => {
    nest.position.set(56, GROUND_Y);
    leader.position.set(56, GROUND_Y - 156);
    tower.position.set(view.w - 56, GROUND_Y);
    for (const l of layers) l.t.width = view.w;
  };
  place();
  ctx.onResize(place);

  const spawn = (kind) => {
    const id = kind === 'd' ? `dragon/${DRAGONS[iD++ % DRAGONS.length]}/${1 + (iD % 2)}` : `zombie/${ZOMBIES[iZ++ % ZOMBIES.length]}/0`;
    const s = new Sprite(T(`${id}/walk0`));
    s.x = kind === 'd' ? 100 : view.w - 100;
    s.y = GROUND_Y;
    units.addChild(s);
    live.push({ s, id, dir: kind === 'd' ? 1 : -1, speed: kind === 'd' ? 0.5 : 0.4 });
  };

  const tick = () => {
    t++;
    if (--spawnD <= 0) { spawn('d'); spawnD = 70; }
    if (--spawnZ <= 0) { spawn('z'); spawnZ = 90; }
    for (const l of layers) l.t.tilePosition.x = -t * 0.25 * l.speed;
    for (let i = live.length - 1; i >= 0; i--) {
      const u = live[i];
      u.s.x += u.dir * u.speed;
      u.s.texture = T(`${u.id}/walk${(t >> 3) & 1}`);
      if (u.s.x < 60 || u.s.x > view.w - 60) { u.s.destroy(); live.splice(i, 1); }
    }
    /* 발 위치가 같은 줄이므로 정렬은 x 로 충분 (임시) */
  };
  app.ticker.add(tick);

  return {
    destroy() { app.ticker?.remove(tick); },
  };
}
