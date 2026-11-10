/**
 * 땅 · 소품 요소 : 무덤 손 · 까꿍 · 고양이 · 부엉이 · 호박 · 십자가 좀비 · 창문 춤 · 두더지 (재미있는 요소 · 2026-11-11 야간 · 300줄 규칙으로 나눔)
 * 요소 하나 = make(E) → { update(t, dt) → 계속이면 true, destroy() }.
 * E = 재미 감독(fun.js)이 넘겨주는 { tex, back, front, S(자리표), cam, viewW, owl, pump, inSafe, safeX }.
 */
import { Container, Graphics } from 'pixi.js';
import { clamp, smooth, outBack, rnd, pick, env, sp, maskedBox, bits, dot } from './funKit.js';

/** 5 무덤 손 인사 — 쑥 올라와 손을 흔들고(가끔 꽃) 쏙 */
export function hand(E) {
  const cam = E.cam(), xs = E.S.graves.filter((x) => E.inSafe(x) && x > cam + 40 && x < cam + E.viewW() - 40);
  const x = (xs.length ? pick(xs) : cam + E.viewW() / 2) + rnd(-20, 20), y = E.S.ground;
  const c = new Container(); E.back.addChild(c);
  const box = maskedBox(c, x, y), fx = bits(c), flower = Math.random() < 0.35;
  const h = box.addChild(sp(flower ? E.tex.hand_flower : E.tex.hand_open, x, y + 60, 0.5, 1));
  for (let i = 0; i < 6; i++) fx.add(Object.assign(dot(0x4a3020, 2), { x: x + rnd(-10, 10), y }), rnd(-60, 60), rnd(-160, -80), { life: 0.6 });
  return {
    update(t, dt) {
      const up = t < 0.5 ? outBack(t / 0.5) : t > 2.4 ? 1 - smooth((t - 2.4) / 0.5) : 1;
      h.y = y + 60 - 58 * up;
      if (!flower) h.texture = t > 0.6 && t < 2.3 && Math.floor(t * 4) % 2 ? E.tex.hand_wave : E.tex.hand_open;
      h.rotation = t > 0.5 && t < 2.4 ? Math.sin(t * 8) * 0.12 : 0;
      fx.update(dt);
      return t < 3;
    },
    destroy() { c.destroy({ children: true }); },
  };
}

/** 8 유령 까꿍 — 땅에서 쑥 «까꿍!» 하고 쏙 */
export function boo(E) {
  const cam = E.cam(), xs = E.S.graves.concat(E.S.fence ? [E.S.fence.x0 + 60, E.S.fence.x1 - 60] : []).filter((x) => E.inSafe(x) && x > cam + 40 && x < cam + E.viewW() - 40);
  const x = xs.length ? pick(xs) : cam + E.viewW() * 0.6, y = E.S.ground - 4, c = new Container(); E.back.addChild(c);
  const box = maskedBox(c, x, y), g = box.addChild(sp(E.tex.boo, x, y + 50, 0.5, 1));
  return {
    update(t) {
      const up = t < 0.25 ? outBack(t / 0.25) : t > 1.6 ? 1 - smooth((t - 1.6) / 0.4) : 1;
      g.y = y + 50 - 50 * up;
      const boing = t > 0.3 && t < 0.7 ? 1 + 0.18 * Math.sin((t - 0.3) / 0.4 * Math.PI) : 1;
      g.scale.set(boing, 2 - boing); g.rotation = t > 0.7 && t < 1.6 ? Math.sin(t * 10) * 0.08 : 0;
      return t < 2;
    },
    destroy() { c.destroy({ children: true }); },
  };
}

/** 10 유령 고양이 담장 산책 — 걷다 멈춰 하품, 꼬리 살랑 */
export function cat(E) {
  const { fence } = E.S, c = new Container(); E.back.addChild(c);
  const tail = c.addChild(sp(E.tex.cat_tail, -22, -34, 0.85, 0.9)); tail.scale.x = -1;
  const body = c.addChild(sp(E.tex.cat, 0, 0, 0.5, 1));
  const xa = fence.x0 + 10, xb = fence.x1 - 10, mid = (xa + xb) / 2;
  return {
    update(t) {
      const x = t < 2.2 ? xa + (mid - xa) * (t / 2.2) : t < 3.3 ? mid : mid + (xb - mid) * ((t - 3.3) / 1.9);
      const walking = t < 2.2 || t > 3.3;
      c.position.set(x, fence.y - (walking ? Math.abs(Math.sin(t * 9)) * 1.5 : 0));
      const yawn = !walking ? Math.sin(clamp((t - 2.2) / 1.1) * Math.PI) : 0;
      body.scale.set(1 + yawn * 0.04, 1 + yawn * 0.08);
      tail.rotation = Math.sin(t * (walking ? 5 : 2.5)) * 0.25;
      c.alpha = env(t, 5.2, 0.5, 0.6) * 0.78;
      return t < 5.2;
    },
    destroy() { c.destroy({ children: true }); },
  };
}

/** 11 부엉이 — 나무 위에 늘 앉아 있다가 눈 감고 고개 홱 */
export function owl(E) {
  const o = E.owl, y0 = o.y;
  return {
    update(t) {
      const turned = t > 0.2 && t < 1.5;
      o.texture = turned ? E.tex.owl_turn : E.tex.owl;
      o.y = y0 - (t < 0.2 ? Math.sin(t / 0.2 * Math.PI) * 4 : 0);
      o.rotation = turned ? Math.sin(t * 12) * 0.05 : 0;
      return t < 2;
    },
    destroy() { o.texture = E.tex.owl; o.y = y0; o.rotation = 0; },
  };
}

/** 12 호박 등불 — 깜빡깜빡하다 씨익 */
export function pumpkin(E) {
  const p = E.pump, glow = new Graphics().circle(p.x, p.y - 14, 26).fill({ color: 0xff9a2e, alpha: 1 });
  glow.blendMode = 'add'; glow.alpha = 0; E.back.addChildAt(glow, E.back.getChildIndex(p));
  return {
    update(t) {
      const flick = t < 0.5 ? Math.floor(t * 20) % 2 : 0, grin = t >= 0.5 && t < 1.9;
      p.texture = grin || flick ? E.tex.pumpkin_grin : E.tex.pumpkin;
      const b = grin ? 1 + 0.12 * Math.sin(clamp((t - 0.5) / 0.3) * Math.PI) : 1; p.scale.set(b, 2 - b);
      glow.alpha = grin ? 0.35 + 0.1 * Math.sin(t * 14) : flick * 0.25;
      return t < 2.1;
    },
    destroy() { p.texture = E.tex.pumpkin; p.scale.set(1); glow.destroy(); },
  };
}

/** 13 십자가 좀비 — 십자가가 솟아 흔들리다 와장창, 해골 좀비가 «짠!» 하더니 픽 와르르 */
export function cross(E) {
  const x = E.safeX(120), y = E.S.ground - 2;
  const c = new Container(); E.back.addChild(c);
  const box = maskedBox(c, x, y, 120), fx = bits(c);
  const cr = box.addChild(sp(E.tex.cross, x, y + 64, 0.5, 1));
  const rise = box.addChild(sp(E.tex.rise, x, y + 70, 0.5, 1)); rise.visible = false;
  const pile = c.addChild(sp(E.tex.bonepile, x, y + 2, 0.5, 1)); pile.visible = false;
  let broke = false, fell = false;
  return {
    update(t, dt) {
      if (t < 1.0) {
        cr.y = y + 64 - 60 * outBack(clamp(t / 0.4));
        cr.rotation = t > 0.4 ? Math.sin(t * 40) * 0.06 * ((t - 0.4) / 0.6) : 0;
      } else if (!broke) {
        broke = true; cr.visible = false;
        fx.add(sp(E.tex.cross_b1, x - 6, y - 40), rnd(-160, -90), rnd(-260, -200), { spin: -8, life: 1.3, floor: y });
        fx.add(sp(E.tex.cross_b2, x + 6, y - 40), rnd(90, 160), rnd(-260, -200), { spin: 8, life: 1.3, floor: y });
        for (let i = 0; i < 8; i++) fx.add(Object.assign(dot(0x4a3020, rnd(1.5, 2.5)), { x: x + rnd(-12, 12), y }), rnd(-90, 90), rnd(-200, -90), { life: 0.7 });
        rise.visible = true;
      }
      if (broke && !fell) {
        const k = t - 1.0;
        rise.y = y + 70 - 70 * outBack(clamp(k / 0.5));
        rise.rotation = k > 0.5 ? Math.sin(k * 14) * 0.06 : 0;
        rise.scale.set(1 + (k > 0.5 && k < 0.8 ? 0.08 * Math.sin((k - 0.5) / 0.3 * Math.PI) : 0));
        if (k > 1.7) {
          fell = true; rise.visible = false; pile.visible = true;
          fx.add(sp(E.tex.skull, x, y - 50), rnd(-40, 40), -220, { spin: rnd(-6, 6), life: 2.2, floor: y - 6, fade: false });
          for (let i = 0; i < 6; i++) fx.add(sp(E.tex.bone, x + rnd(-14, 14), y - rnd(20, 50)), rnd(-110, 110), rnd(-260, -120), { spin: rnd(-12, 12), life: 2.2, floor: y - 4, fade: false });
        }
      }
      if (fell) c.alpha = clamp((5.5 - t) / 0.8);
      fx.update(dt);
      return t < 5.5;
    },
    destroy() { c.destroy({ children: true }); },
  };
}

/** 16 성 창문 그림자 춤 — 멀리 창문에 불이 켜지고 그림자가 춤춘다 */
export function windowDance(E) {
  const { window: w } = E.S, c = new Container(); E.back.addChild(c);
  const lit = c.addChild(new Graphics().rect(w.x - 11, w.y - 14, 22, 28).fill(0xffc860));
  const d = c.addChild(sp(E.tex.dancer1, w.x, w.y + 13, 0.5, 1)); d.scale.set(0.95);
  c.alpha = 0;
  return {
    update(t) {
      c.alpha = env(t, 3.6, 0.2, 0.3);
      const f = Math.floor(t * 4) % 2; d.texture = f ? E.tex.dancer2 : E.tex.dancer1; d.x = w.x + (f ? 2 : -2);
      lit.alpha = 0.85 + 0.15 * Math.sin(t * 20);
      return t < 3.6;
    },
    destroy() { c.destroy({ children: true }); },
  };
}

/** 19 두더지 좀비 — 앞쪽 흙에서 흙더미가 솟고 머리가 쏙, 두리번 */
export function mole(E) {
  const x = E.safeX(120), y = E.S.dirtY;
  const c = new Container(); E.front.addChild(c);
  const box = maskedBox(c, x, y - 12, 90), m = box.addChild(sp(E.tex.mole, x, y + 30, 0.5, 1)), mound = c.addChild(sp(E.tex.mound, x, y, 0.5, 1));
  return {
    update(t) {
      mound.scale.set(t < 0.3 ? outBack(t / 0.3) : t > 2.7 ? 1 - smooth((t - 2.7) / 0.3) : 1);
      const up = t < 0.3 ? 0 : t < 0.7 ? outBack((t - 0.3) / 0.4) : t > 2.2 ? 1 - smooth((t - 2.2) / 0.4) : 1;
      m.y = y + 30 - 40 * up; m.scale.x = t > 0.9 && t < 2.2 && Math.floor(t * 2.5) % 2 ? -1 : 1;
      return t < 3;
    },
    destroy() { c.destroy({ children: true }); },
  };
}

