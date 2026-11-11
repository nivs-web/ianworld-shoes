/**
 * 땅 · 소품 요소 : 무덤 손 · 까꿍 · 고양이 · 부엉이 · 호박 · 십자가 좀비 · 창문 춤 · 두더지 (재미있는 요소 · 2026-11-11 야간 · 300줄 규칙으로 나눔)
 * 요소 하나 = make(E) → { update(t, dt) → 계속이면 true, destroy() }.
 * E = 재미 감독(fun.js)이 넘겨주는 { tex, back, front, S(자리표), cam, viewW, owl, pump, inSafe, safeX }.
 */
import { Container, Graphics } from 'pixi.js';
import { clamp, smooth, outBack, rnd, pick, env, sp, maskedBox, bits, dot } from './funKit.js';

/** 자리가 없어 이번엔 쉬는 요소 (바로 끝난다) */
const NONE = { update: () => false, destroy() {} };

/** 5 무덤 손 인사 — 쑥 올라와 손을 흔들고(가끔 꽃) 쏙 */
export function hand(E) {
  const cam = E.cam(), xs = E.S.graves.filter((x) => E.inSafe(x) && x > cam + 40 && x < cam + E.viewW() - 40 && !E.busy(x));
  if (!xs.length) return NONE;   // 빈 자리가 없으면 이번엔 안 나온다 (다른 요소와 겹치지 않게 · 대표님 11/11)
  const x = pick(xs) + rnd(-20, 20), y = E.S.ground;
  const c = new Container(); E.back.addChild(c);
  const box = maskedBox(c, x, y), fx = bits(c), flower = Math.random() < 0.35;
  const h = box.addChild(sp(flower ? E.tex.hand_flower : E.tex.hand_open, x, y + 60, 0.5, 1));
  for (let i = 0; i < 6; i++) fx.add(Object.assign(dot(0x4a3020, 2), { x: x + rnd(-10, 10), y }), rnd(-60, 60), rnd(-160, -80), { life: 0.6 });
  return {
    zone: x,
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
  const cam = E.cam(), xs = E.S.graves.concat(E.S.fence ? [E.S.fence.x0 + 60, E.S.fence.x1 - 60] : []).filter((x) => E.inSafe(x) && x > cam + 40 && x < cam + E.viewW() - 40 && !E.busy(x));
  if (!xs.length) return NONE;
  const x = pick(xs), y = E.S.ground - 4, c = new Container(); E.back.addChild(c);
  const box = maskedBox(c, x, y), g = box.addChild(sp(E.tex.boo, x, y + 50, 0.5, 1));
  c.alpha = 0.8;   // 대표님 «유령은 20% 더 투명하게» (11/11)
  return {
    zone: x,
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
  const tail = c.addChild(sp(E.tex.cat_tail, -24, -31, 0.32, 0.95)); tail.scale.x = -1;   /* 피벗 = 꼬리 뿌리(그림 왼쪽 아래) → 뒤집으면 엉덩이에서 뒤로 말려 올라간다 */
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
      c.alpha = env(t, 5.2, 0.5, 0.6) * 0.6;   // 0.78 → 0.6 (대표님 «고양이가 너무 선명하다» · 11/11)
      return t < 5.2;
    },
    destroy() { c.destroy({ children: true }); },
  };
}

/**
 * 부엉이 눈꺼풀 — owl.png(37×44 · 발 가운데 기준)의 두 눈 자리에 깃털색 판을 위에서 내린다. set(k) : 0 뜸 ~ 1 감음.
 * 재미 감독(fun.js)이 하나 만들어 평소 깜빡임에 쓰고, 부엉이 요소(owl)도 같은 것을 쓴다 (E.owlLids).
 */
export function owlLids(E) {
  const o = E.owl, g = new Graphics(); o.parent.addChildAt(g, o.parent.getChildIndex(o) + 1);   /* 부엉이가 있는 겹(하늘 겹일 수 있다) */
  const EYES = [[-4, -31], [10.5, -31]], R = 5;
  return {
    set(k) {
      g.clear(); g.position.copyFrom(o.position); g.rotation = o.rotation; g.scale.copyFrom(o.scale);
      if (k <= 0.02 || o.texture !== E.tex.owl) return;
      for (const [ex, ey] of EYES) {
        g.rect(ex - R, ey - R, R * 2, R * 2 * k).fill(0x9a6448);
        g.rect(ex - R, ey - R + R * 2 * k - 1.2, R * 2, 1.4).fill(0x3a2010);   // 눈꺼풀 끝 줄
      }
    },
    destroy() { g.destroy(); },
  };
}

/** 픽셀 «Z» 한 글자 */
const zGlyph = (s) => new Graphics().moveTo(0, 0).lineTo(s, 0).lineTo(0, s).lineTo(s, s).stroke({ width: 2, color: 0xeee6ff });

/**
 * 11 부엉이 — 나무 위에 늘 앉아 있다(평소엔 fun.js 가 몇 초마다 깜빡이게 한다). 나올 때마다 셋 중 하나 :
 *  졸기(꾸벅꾸벅 + Z z z 가 피어오르다 화들짝 깸) · 고개 홱(뒤돌아봄) · 두 번 깜빡 + 갸웃 (대표님 «부엉이가 가만히 있어 재미없다» · 11/11)
 */
export function owl(E) {
  const o = E.owl, x0 = o.x, y0 = o.y, lids = E.owlLids, mode = pick(['doze', 'doze', 'turn', 'blink']);
  const T = mode === 'doze' ? 6.4 : mode === 'turn' ? 2 : 1.8;
  const zc = new Container(); o.parent.addChild(zc);
  const zs = [];
  return {
    update(t, dt) {
      let k = 0;
      if (mode === 'turn') {
        const turned = t > 0.2 && t < 1.5;
        o.texture = turned ? E.tex.owl_turn : E.tex.owl;
        o.y = y0 - (t < 0.2 ? Math.sin(t / 0.2 * Math.PI) * 4 : 0);
        o.rotation = turned ? Math.sin(t * 12) * 0.05 : 0;
      } else if (mode === 'blink') {
        k = (t > 0.2 && t < 0.34) || (t > 0.5 && t < 0.64) ? 1 : 0;
        o.rotation = t > 0.8 && t < 1.6 ? Math.sin(clamp((t - 0.8) / 0.8) * Math.PI) * 0.16 : 0;   // 갸웃
        o.y = y0 - (t > 0.75 && t < 0.95 ? Math.sin((t - 0.75) / 0.2 * Math.PI) * 3 : 0);
      } else {
        /* 졸기 : 0~0.9 눈이 스르르(가물가물) → 0.9~5 꾸벅꾸벅(천천히 숙였다 번쩍) + Z → 5~5.4 화들짝 깸 → 두리번 */
        if (t < 0.9) k = Math.min(1, t / 0.9) * (0.75 + 0.25 * (Math.floor(t * 8) % 2));
        else if (t < 5) {
          k = 1;
          const n = ((t - 0.9) * 0.75) % 1, dip = n < 0.8 ? smooth(n / 0.8) : 1 - (n - 0.8) / 0.2;
          o.rotation = dip * 0.2; o.y = y0 + dip * 2.5; o.x = x0 + dip * 2;
          if (zs.length < Math.floor((t - 0.9) / 0.7) + 1) { const z = zc.addChild(zGlyph(4 + (zs.length % 3) * 2)); z.born = t; zs.push(z); }
        } else if (t < 5.4) { k = 0; o.rotation = Math.sin((t - 5) * 40) * 0.08; o.y = y0 - Math.sin((t - 5) / 0.4 * Math.PI) * 7; o.x = x0; }
        else { k = t > 5.9 && t < 6.02 ? 1 : 0; o.rotation = 0; o.y = y0; }
        for (const z of zs) {
          const a = t - z.born; z.position.set(x0 + 14 + a * 9 + Math.sin(a * 3) * 3, y0 - 44 - a * 14);
          z.scale.set(0.7 + a * 0.25); z.alpha = t > 5 ? Math.max(0, z.alpha - dt * 5) : clamp(a * 3) * clamp((2.4 - a) / 0.6);
        }
      }
      lids.set(k);
      return t < T;
    },
    destroy() { o.texture = E.tex.owl; o.x = x0; o.y = y0; o.rotation = 0; lids.set(0); zc.destroy({ children: true }); },
  };
}

/** 12 호박 등불 — 깜빡깜빡하다 씨익 */
export function pumpkin(E) {
  /*
   * 대표님 «호박이 빛날 때 도트가 아닌 둥근 층이 뜬다» (11/11) → 코드로 그린 원형 빛을 없앴다.
   * 빛은 제미나이 도트 후광(pumpkin_glow.png · 보조 제작 중)이 있을 때만 깐다. 없으면 눈에 불 들어온 그림(pumpkin_grin)만.
   */
  const p = E.pump, glowT = E.tex.pumpkin_glow;
  const glow = glowT ? sp(glowT, p.x, p.y - p.height / 2) : null;   // 99칸 그림 가운데 33칸 = 호박 자리
  if (glow) { glow.alpha = 0; glow.blendMode = 'add'; E.back.addChildAt(glow, E.back.getChildIndex(p)); }
  return {
    zone: p.x,
    update(t) {
      const flick = t < 0.5 ? Math.floor(t * 20) % 2 : 0, grin = t >= 0.5 && t < 1.9;
      p.texture = grin || flick ? E.tex.pumpkin_grin : E.tex.pumpkin;
      const b = grin ? 1 + 0.12 * Math.sin(clamp((t - 0.5) / 0.3) * Math.PI) : 1; p.scale.set(b, 2 - b);
      if (glow) glow.alpha = grin ? 0.28 + 0.06 * Math.sin(t * 14) : flick * 0.15;   /* 빛번짐은 아주 은은하게 (대표님 규칙) */
      return t < 2.1;
    },
    destroy() { p.texture = E.tex.pumpkin; p.scale.set(1); glow?.destroy(); },
  };
}

/** 13 십자가 좀비 — 십자가가 솟아 흔들리다 와장창, 해골 좀비가 «짠!» 하더니 픽 와르르 */
export function cross(E) {
  const x = E.freeX(120); if (x == null) return NONE;
  const y = E.S.ground - 2;
  const c = new Container(); E.back.addChild(c);
  const box = maskedBox(c, x, y, 120), fx = bits(c);
  const cr = box.addChild(sp(E.tex.cross, x, y + 64, 0.5, 1));
  const rise = box.addChild(sp(E.tex.rise, x, y + 70, 0.5, 1)); rise.visible = false;
  const pile = c.addChild(sp(E.tex.bonepile, x, y + 2, 0.5, 1)); pile.visible = false;
  let broke = false, fell = false;
  return {
    zone: x,
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
  const x = E.freeX(120); if (x == null) return NONE;
  const y = E.S.dirtY;
  const c = new Container(); E.front.addChild(c);
  const box = maskedBox(c, x, y - 12, 90), m = box.addChild(sp(E.tex.mole, x, y + 30, 0.5, 1)), mound = c.addChild(sp(E.tex.mound, x, y, 0.5, 1));
  return {
    zone: x,
    update(t) {
      mound.scale.set(t < 0.3 ? outBack(t / 0.3) : t > 2.7 ? 1 - smooth((t - 2.7) / 0.3) : 1);
      const up = t < 0.3 ? 0 : t < 0.7 ? outBack((t - 0.3) / 0.4) : t > 2.2 ? 1 - smooth((t - 2.2) / 0.4) : 1;
      m.y = y + 30 - 40 * up; m.scale.x = t > 0.9 && t < 2.2 && Math.floor(t * 2.5) % 2 ? -1 : 1;
      return t < 3;
    },
    destroy() { c.destroy({ children: true }); },
  };
}

