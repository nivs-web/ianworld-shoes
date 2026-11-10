/**
 * 전장 뒤 세계 — 겹 배경 · 빛무리 · 분위기 생물 (그림 v3 · 화면 전용, 전투 계산과 무관)
 *
 * env/<월드>.json 의 meta.layers 대로 겹을 깔고, 카메라가 움직이면 겹마다 다른 빠르기로 따라간다 (원근).
 * 빛 자리(meta.lights · baseLights)에는 흰 빛무리(amb/glow)를 색칠해 더하기 섞기로 얹고, 횃불은 깜빡인다.
 * 박쥐 · 유령 · 반딧불 · 안개는 여기서 돌린다. 화면 효과라 Math.random 을 써도 된다 (코어가 아님).
 */
import { Container, Sprite, TilingSprite } from 'pixi.js';

const rnd = (a, b) => a + Math.random() * (b - a);

/**
 * @param {{app, view}} ctx  render/app.js
 * @param {(name:string)=>import('pixi.js').Texture} T  그림 이름 → 텍스처 (여러 시트에서 찾는다)
 * @param {object} meta  env/<월드>.json 의 meta (layers · front · lights · groundY)
 */
export function createWorld(ctx, T, meta) {
  const { view } = ctx;
  const back = new Container();     // 캐릭터 뒤
  const front = new Container();    // 캐릭터 앞 (앞 장식)
  const glows = [];                 // { s, base, flicker, layer, lx, ly }
  const layers = [];
  const ambient = new Container();

  const addGlow = (parent, x, y, r, color, flicker) => {
    const s = new Sprite(T('amb/glow'));
    s.anchor.set(0.5); s.blendMode = 'add'; s.tint = color; s.alpha = 0.55;
    s.scale.set((r * 2) / 64); s.position.set(x, y);
    parent.addChild(s);
    glows.push({ s, base: (r * 2) / 64, flicker: !!flicker, t: rnd(0, 10) });
  };

  for (const L of meta.layers) {
    const tex = T(L.name);
    let node;
    if (L.tile) {
      node = new TilingSprite({ texture: tex, width: view.w + 4, height: tex.height });
      node.y = L.y;
      if (L.fog) { node.alpha = 0.35; node.blendMode = 'add'; }
    } else {
      node = new Sprite(tex);
      node.position.set(L.x, L.y);
    }
    back.addChild(node);
    const entry = { L, node, glowBox: null };
    const lights = meta.lights?.[L.name];
    if (lights?.length) {                                    // 그 겹을 따라 움직이는 빛무리 묶음
      const box = new Container();
      box.y = L.tile ? L.y : L.y - tex.height * (tex.defaultAnchor?.y ?? 0);
      const reps = L.tile ? Math.ceil((view.w + tex.width) / tex.width) + 1 : 1;
      for (let k = 0; k < reps; k++) for (const g of lights) addGlow(box, g.x + k * tex.width - (L.tile ? 0 : tex.width * (tex.defaultAnchor?.x ?? 0)), g.y, g.r, g.color, g.flicker);
      back.addChild(box);
      entry.glowBox = box;
    }
    layers.push(entry);
    if (L.name.includes('/castle')) back.addChild(ambient);  // 박쥐 · 유령은 성 앞 · 언덕 뒤
  }
  /* 달 빛무리 (크게 · 은은하게) */
  const moonL = layers.find((e) => e.L.name.includes('/moon'));
  if (moonL) { addGlow(back, moonL.L.x, moonL.L.y, 150, 0x8a7cff, false); back.setChildIndex(back.children[back.children.length - 1], back.getChildIndex(moonL.node)); }

  /* 앞 장식 */
  const fronts = (meta.front || []).map((F) => {
    const s = new Sprite(T(F.name));
    front.addChild(s);
    const lights = meta.lights?.[F.name] || [];
    const box = new Container(); front.addChild(box);
    for (const g of lights) addGlow(box, g.x, g.y, g.r, g.color, g.flicker);
    return { F, s, box };
  });
  const placeFront = () => {
    for (const { F, s, box } of fronts) {
      const x = F.side === 'left' ? 0 : view.w - s.width;
      s.anchor.set(0, 0); s.position.set(x, view.h - s.height);
      box.position.set(x, view.h - s.height);
    }
  };
  placeFront();

  /* 분위기 생물 */
  const bats = Array.from({ length: 5 }, () => {
    const s = new Sprite(T('amb/bat/0')); s.anchor.set(0.5); ambient.addChild(s);
    return { s, x: rnd(0, view.w), y: rnd(60, 220), vx: rnd(0.6, 1.4) * (Math.random() < 0.5 ? -1 : 1), ph: rnd(0, 6), f: 0 };
  });
  const ghosts = Array.from({ length: 2 }, (_, i) => {
    const s = new Sprite(T('amb/ghost/0')); s.anchor.set(0.5); s.alpha = 0.7; ambient.addChild(s);
    return { s, x: 300 + i * 420, y: 300 - i * 30, ph: rnd(0, 6) };
  });
  const flies = Array.from({ length: 34 }, () => {
    const s = new Sprite(T('amb/firefly')); s.anchor.set(0.5); s.blendMode = 'add'; back.addChild(s);
    return { s, x: rnd(0, view.w), y: rnd(330, 445), ph: rnd(0, 6), sp: rnd(0.3, 0.8) };
  });

  let cam = 0, time = 0;
  return {
    back, front,
    /** 카메라 x (전장 칸) */
    setCamera(x) { cam = x; },
    resize() { placeFront(); for (const e of layers) if (e.L.tile) e.node.width = view.w + 4; },
    update(dt) {
      time += dt;
      for (const e of layers) {
        const shift = -cam * e.L.par + (e.L.drift ? -time * e.L.drift : 0);
        if (e.L.tile) { e.node.tilePosition.x = shift; if (e.glowBox) e.glowBox.x = ((shift % e.node.texture.width) - e.node.texture.width); }
        else { e.node.x = e.L.x + shift; if (e.glowBox) e.glowBox.x = e.L.x + shift; }
      }
      for (const g of glows) {
        g.t += dt;
        if (g.flicker) { const f = 0.85 + Math.sin(g.t * 11) * 0.06 + Math.sin(g.t * 23.7) * 0.05 + rnd(-0.03, 0.03); g.s.scale.set(g.base * f); g.s.alpha = 0.5 * f + 0.1; }
        else g.s.alpha = 0.45 + Math.sin(g.t * 1.3) * 0.05;
      }
      for (const b of bats) {
        b.x += b.vx; b.ph += dt * 3; if (b.x < -20) b.x = view.w + 20; if (b.x > view.w + 20) b.x = -20;
        b.f = (b.f + dt * 12) % 3;
        b.s.texture = T(`amb/bat/${Math.floor(b.f)}`); b.s.position.set(Math.round(b.x), Math.round(b.y + Math.sin(b.ph) * 8)); b.s.scale.x = b.vx < 0 ? -1 : 1;
      }
      for (const g of ghosts) {
        g.ph += dt; g.s.texture = T(`amb/ghost/${Math.floor(g.ph * 2) % 2}`);
        g.s.position.set(Math.round(g.x - cam * 0.15 + Math.sin(g.ph * 0.7) * 30), Math.round(g.y + Math.sin(g.ph * 1.6) * 6));
        g.s.alpha = 0.55 + Math.sin(g.ph * 2.1) * 0.2;
      }
      for (const f of flies) {
        f.ph += dt * f.sp; f.x += Math.cos(f.ph * 1.7) * 0.3; f.y += Math.sin(f.ph * 2.3) * 0.2;
        if (f.x < 0) f.x += view.w; if (f.x > view.w) f.x -= view.w;
        f.s.position.set(Math.round(f.x), Math.round(f.y)); f.s.alpha = Math.max(0, Math.sin(f.ph * 3) * 0.9);
      }
    },
  };
}
