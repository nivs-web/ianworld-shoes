/**
 * 재미있는 요소 (2026-11-11 대표님 확정 17개) — 게임 규칙과 상관없는 눈요기 배경 이벤트.
 *
 * «재미 감독»이 1.0~1.5초마다 하나씩 꺼낸다. 규칙 (기획서 IAN_DRAGON_FUN.md §1):
 *  · 배경 층에만 그린다(두더지만 앞쪽 흙 띠 — 발 줄 아래라 유닛을 가리지 않는다)
 *  · 동시에 최대 3개 · «큰 볼거리»(자전거 · 번개 · 빗자루 둘)는 하나씩만
 *  · 같은 요소 연달아 X · 요소마다 쉬는 시간(cd)
 *  · hush(초) — 보스 등장 · 성 무너짐 · 승패 화면에서 잠깐 멈춘다
 * 그림 = public/assets/iandragon_game/ai/fun/ (제미나이 시트 4장에서 잘라 낸 조각). 번개 · 별똥별 · 실은 코드로 그린다.
 */
import { Assets, Container, Sprite, Graphics } from 'pixi.js';

const BASE = '/assets/iandragon_game/ai/fun/';

export { W1_SPOTS, SPOTS } from './funSpots.js';
import { W1_SPOTS } from './funSpots.js';

export async function loadFun() {
  const meta = await (await fetch(BASE + 'fun.json')).json();
  const tex = {};
  await Promise.all(Object.keys(meta.parts).map(async (n) => { tex[n] = await Assets.load(BASE + n + '.png'); tex[n].source.scaleMode = 'nearest'; }));
  return tex;
}

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const smooth = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };
const outBack = (t) => { t = clamp(t); const c = 1.7; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2; };
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];
/** 나타났다(a초) · 머물고 · 사라지는(b초) 투명도 */
const env = (t, dur, a = 0.3, b = 0.4) => Math.min(clamp(t / a), clamp((dur - t) / b));

function sp(tex, x, y, ax = 0.5, ay = 0.5) { const s = new Sprite(tex); s.anchor.set(ax, ay); s.position.set(x, y); return s; }
/** 땅(줄 y) 아래를 가리는 마스크를 단 그릇 — 땅에서 솟아오르는 것들 */
function maskedBox(parent, x, y, w = 140) {
  const box = new Container(); parent.addChild(box);
  const m = new Graphics().rect(x - w / 2, y - 400, w, 400).fill(0xffffff);
  box.addChild(m); box.mask = m;
  return box;
}
/** 작은 조각(흙 · 뼈 · 반짝이) — 날아가고 떨어지고 사라진다 */
function bits(parent) {
  const list = [];
  return {
    add(obj, vx, vy, { g = 600, spin = 0, life = 1.2, floor = null, fade = true } = {}) { parent.addChild(obj); list.push({ obj, vx, vy, g, spin, life, t: 0, floor, fade }); },
    update(dt) {
      for (let i = list.length - 1; i >= 0; i--) {
        const b = list[i]; b.t += dt;
        b.vy += b.g * dt; b.obj.x += b.vx * dt; b.obj.y += b.vy * dt; b.obj.rotation += b.spin * dt;
        if (b.floor != null && b.obj.y > b.floor) { b.obj.y = b.floor; b.vy *= -0.35; b.vx *= 0.6; b.spin *= 0.5; }
        if (b.fade) b.obj.alpha = clamp((b.life - b.t) / 0.4);
        if (b.t > b.life) { b.obj.destroy(); list.splice(i, 1); }
      }
    },
  };
}
const dot = (color, r = 1.5, alpha = 1) => new Graphics().circle(0, 0, r).fill({ color, alpha });

/* ───────────── 요소 17개 ───────────── */

/** 1 달 앞 자전거 — 그림자로 달을 가로지르며 가운데서 붕 뜬다 */
function bike(E) {
  const { moon } = E.S, c = new Container(); E.back.addChild(c);
  const SIL = 0x1a0f30, dir = Math.random() < 0.8 ? 1 : -1;
  const wr = sp(E.tex.wheel, -33, 30), wf = sp(E.tex.wheel, 31, 28), body = sp(E.tex.bike, 0, 0);
  for (const s of [wr, wf, body]) { s.tint = SIL; c.addChild(s); }
  c.scale.x = dir;
  return {
    update(t, dt) {
      const k = t / 5, x = moon.x + dir * (-280 + 560 * k), hop = t > 2.1 && t < 2.9 ? Math.sin((t - 2.1) / 0.8 * Math.PI) * 26 : 0;
      c.position.set(x, moon.y + 38 - hop); c.rotation = dir * (hop ? -0.12 * Math.cos((t - 2.1) / 0.8 * Math.PI) : 0);
      wr.rotation += dt * 9; wf.rotation += dt * 9;
      c.alpha = env(t, 5, 0.5, 0.5);
      return t < 5;
    },
    destroy() { c.destroy({ children: true }); },
  };
}

/** 2 도깨비불 한 바퀴 — 셋이 서로 쫓으며 돌고 «퐁» */
function wisps(E) {
  const p = pick(E.S.wisps), c = new Container(); E.back.addChild(c);
  const fx = bits(c), fl = [0, 1, 2].map(() => { const s = sp(E.tex.wisp1, p.x, p.y, 0.5, 0.7); s.blendMode = 'add'; s.tint = E.S.wispTint ?? 0xffffff; c.addChild(s); return s; });   // 월드별 색 (화산 = 붉은 불)
  let trail = 0;
  return {
    update(t, dt) {
      const a = env(t, 3, 0.4, 0.3), pop = t > 2.7 ? 1 + (t - 2.7) * 3 : 1;
      fl.forEach((s, i) => {
        const ang = t * 2.6 + i * 2.09;
        s.position.set(p.x + Math.cos(ang) * 34, p.y + Math.sin(ang) * 14 - t * 8);
        s.texture = E.tex['wisp' + (1 + ((Math.floor(t * 9) + i) % 3))];
        s.alpha = a * 0.9; s.scale.set((0.8 + 0.15 * Math.sin(t * 9 + i)) * pop);
      });
      if ((trail -= dt) <= 0 && t < 2.6) { trail = 0.05; for (const s of fl) fx.add(Object.assign(dot(0x7ff5d0, 2, 0.6), { x: s.x, y: s.y - 6, blendMode: 'add' }), 0, -10, { g: 0, life: 0.45 }); }
      fx.update(dt);
      return t < 3;
    },
    destroy() { c.destroy({ children: true }); },
  };
}

/** 3 번개 + 해골 구름 — 배경만 번쩍, 0.3초 동안 구름이 해골 얼굴 */
function lightning(E) {
  const cam = E.cam(), cx = rnd(cam + 150, cam + E.viewW() - 150), cy = rnd(70, 110);
  const c = new Container(); E.back.addChild(c);
  const flash = new Graphics().rect(-200, -50, 3400, 640).fill(0xe8e0ff); flash.alpha = 0;
  const cloud = sp(E.tex.skull_cloud, cx, cy); cloud.alpha = 0;
  const bolt = new Graphics();
  let px = cx, py = cy + 30; bolt.moveTo(px, py);
  while (py < 330) { px += rnd(-18, 18); py += rnd(18, 34); bolt.lineTo(px, py); }
  bolt.stroke({ width: 4, color: 0xfffbe0 }).stroke({ width: 9, color: 0xb388ff, alpha: 0.35 });
  c.addChild(flash, cloud, bolt);
  return {
    update(t) {
      flash.alpha = t < 0.07 ? 0.5 : t < 0.14 ? 0.08 : t < 0.2 ? 0.38 : Math.max(0, 0.38 - (t - 0.2) * 1.1);
      bolt.visible = t < 0.08 || (t > 0.14 && t < 0.3);
      cloud.alpha = t < 0.05 ? 0 : t < 0.5 ? 1 : clamp(1 - (t - 0.5) / 0.4);
      cloud.scale.set(1 + 0.04 * Math.sin(t * 30) * (t < 0.5));
      return t < 1.2;
    },
    destroy() { c.destroy({ children: true }); },
  };
}

/** 4 박쥐 떼 — V자로 달을 건너고 한 마리가 늦게 허둥지둥 */
function bats(E) {
  const { moon } = E.S, dir = Math.random() < 0.5 ? 1 : -1, c = new Container(); E.back.addChild(c);
  const form = [[0, 0], [-30, -16], [-30, 16], [-60, -32], [-60, 32], [-90, -46]];
  const bs = form.map(([fx, fy]) => ({ s: c.addChild(sp(E.tex.bat_up, 0, 0)), fx, fy, ph: Math.random() * 6 }));
  const late = { s: c.addChild(sp(E.tex.bat_down, 0, 0)), fx: -170, fy: 6, ph: 0, late: true };
  bs.push(late);
  const y0 = moon.y - 20 + rnd(-30, 30);
  return {
    update(t) {
      const lead = moon.x + dir * (-420 + 840 * (t / 4));
      for (const b of bs) {
        const wob = b.late ? Math.sin(t * 13) * 7 : Math.sin(t * 6 + b.ph) * 2;
        b.s.position.set(lead + dir * b.fx + (b.late ? Math.sin(t * 5) * 14 : 0), y0 + b.fy + wob);
        b.s.texture = Math.floor((t + b.ph) * (b.late ? 14 : 8)) % 2 ? E.tex.bat_up : E.tex.bat_down;
        b.s.scale.x = dir;
      }
      c.alpha = env(t, 4, 0.4, 0.4);
      return t < 4;
    },
    destroy() { c.destroy({ children: true }); },
  };
}

/** 5 무덤 손 인사 — 쑥 올라와 손을 흔들고(가끔 꽃) 쏙 */
function hand(E) {
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

/** 6 · 6b 빗자루 마녀 좀비 / 빗자루 해골 좀비 — 하늘을 가로지르며 가루를 뿌리고 가끔 비틀 */
function broom(texName, dustColor) {
  return (E) => {
    const cam = E.cam(), dir = Math.random() < 0.5 ? 1 : -1, c = new Container(); E.back.addChild(c);
    const fx = bits(c), s = c.addChild(sp(E.tex[texName], 0, 0)); s.scale.x = dir;
    const y0 = rnd(E.S.sky[0] + 10, E.S.sky[1] - 30), x0 = dir > 0 ? cam - 120 : cam + E.viewW() + 120, span = E.viewW() + 240;
    let dust = 0;
    return {
      update(t, dt) {
        const k = t / 5, wob = t > 2.2 && t < 2.8 ? Math.sin((t - 2.2) * 30) * 0.25 : 0;
        s.position.set(x0 + dir * span * k, y0 + Math.sin(t * 3) * 10 + (wob ? 6 : 0));
        s.rotation = Math.sin(t * 3 + 1) * 0.05 + wob;
        if ((dust -= dt) <= 0) { dust = 0.04; fx.add(Object.assign(dot(pick(dustColor), rnd(1, 2.2)), { x: s.x - dir * 40, y: s.y + 18 }), -dir * rnd(10, 40), rnd(-10, 20), { g: 40, life: 0.8 }); }
        fx.update(dt);
        return t < 5.6;
      },
      destroy() { c.destroy({ children: true }); },
    };
  };
}

/** 7 달님 표정 — 웃음 · 윙크 · 하품 */
function moonFace(E) {
  const { moon } = E.S, which = pick(['moon_smile', 'moon_wink', 'moon_yawn']);
  const s = sp(E.tex[which], moon.x, moon.y); s.scale.set(moon.d / 247); s.alpha = 0; E.back.addChildAt(s, 0);   // 맨 뒤 — 자전거 · 박쥐가 달 앞을 지나가게
  return {
    update(t) {
      s.alpha = env(t, 2.6, 0.35, 0.45) * 0.95;
      if (which === 'moon_yawn') s.scale.set(moon.d / 247 * (1 + 0.025 * Math.sin(clamp(t / 2.6) * Math.PI)));
      return t < 2.6;
    },
    destroy() { s.destroy(); },
  };
}

/** 8 유령 까꿍 — 땅에서 쑥 «까꿍!» 하고 쏙 */
function boo(E) {
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

/** 9 별똥별 — 반짝이 꼬리, 가끔 두 개 */
function star(E) {
  const cam = E.cam(), g = new Graphics(); E.back.addChild(g);
  const n = Math.random() < 0.3 ? 2 : 1, dir = Math.random() < 0.5 ? 1 : -1;
  const ss = Array.from({ length: n }, (_, i) => ({ x: rnd(cam + 100, cam + E.viewW() - 100), y: rnd(15, 70), d: i * 0.35 }));
  return {
    update(t) {
      g.clear();
      for (const s of ss) {
        const k = t - s.d; if (k < 0 || k > 0.9) continue;
        const hx = s.x + dir * 380 * k, hy = s.y + 170 * k, a = clamp((0.9 - k) / 0.3);
        for (let i = 6; i >= 1; i--) g.circle(hx - dir * i * 9, hy - i * 4, 2.4 - i * 0.3).fill({ color: 0xfff8c0, alpha: a * (1 - i / 7) });
        g.circle(hx, hy, 3).fill({ color: 0xffffff, alpha: a });
      }
      return t < 1.3 + (n - 1) * 0.35;
    },
    destroy() { g.destroy(); },
  };
}

/** 10 유령 고양이 담장 산책 — 걷다 멈춰 하품, 꼬리 살랑 */
function cat(E) {
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
function owl(E) {
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
function pumpkin(E) {
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
function cross(E) {
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

/** 14 거미 — 화면 위에서 실 타고 내려와 대롱대롱, 다시 올라간다 */
function spider(E) {
  const cam = E.cam(), x = rnd(cam + 80, cam + E.viewW() - 80), low = rnd(90, 140);
  const c = new Container(); E.back.addChild(c);
  const thread = c.addChild(new Graphics()), s = c.addChild(sp(E.tex.spider, x, -20, 0.5, 0.45));
  return {
    update(t) {
      const yy = t < 1 ? -20 + (low + 20) * outBack(t) : t < 2.6 ? low + Math.sin((t - 1) * 5) * 4 : low - (low + 30) * smooth((t - 2.6) / 0.9);
      const sway = t > 1 && t < 2.6 ? Math.sin((t - 1) * 3.5) * 10 : 0;
      s.position.set(x + sway, yy); s.rotation = -sway * 0.02;
      thread.clear().moveTo(x, -40).lineTo(x + sway, yy - 12).stroke({ width: 1, color: 0xd8d0f0, alpha: 0.7 });
      return t < 3.5;
    },
    destroy() { c.destroy({ children: true }); },
  };
}

/** 16 성 창문 그림자 춤 — 멀리 창문에 불이 켜지고 그림자가 춤춘다 */
function windowDance(E) {
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
function mole(E) {
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

/** [이름, 무게(자주 나오는 정도), 쉬는 시간(초), 큰 볼거리] */
const DEFS = [
  ['bike', bike, 3, 40, true, ['moon']], ['wisps', wisps, 5, 8, false, ['wisps']], ['lightning', lightning, 2, 30, true, ['sky']], ['bats', bats, 5, 7, false, ['moon']],
  ['hand', hand, 4, 10, false, ['graves', 'ground']], ['witch', broom('witch', [0xfff3a0, 0xc9a7ff, 0xffffff]), 2, 35, true, ['sky']],
  ['skelBroom', broom('skel_broom', [0xd8d2c0, 0x9a9488, 0xc9a7ff]), 2, 35, true, ['sky']], ['moon', moonFace, 3, 25, false, ['moon', 'moonFace']],
  ['boo', boo, 4, 9, false, ['graves', 'ground']], ['star', star, 6, 5, false, []], ['cat', cat, 2, 30, false, ['fence']], ['owl', owl, 3, 15, false, ['owl']],
  ['pumpkin', pumpkin, 3, 12, false, ['pumpkin']], ['cross', cross, 3, 28, false, ['ground', 'safe']], ['spider', spider, 2, 25, false, []],
  ['window', windowDance, 2, 30, false, ['window']], ['mole', mole, 3, 20, false, ['dirtY', 'safe']],
].map(([id, make, w, cd, big, needs]) => ({ id, make, w, cd, big, needs }));

/**
 * back : 배경 바로 위 그릇(카메라와 함께 움직인다) · front : 유닛 위 그릇(두더지 전용, 발 줄 아래에만 그린다)
 * getCam() : 지금 카메라 x · viewW() : 화면 너비(월드 칸)
 */
export function createFun(tex, { back, front, spots = W1_SPOTS, getCam, viewW }) {
  const S = spots;
  const owlS = S.owl ? back.addChild(sp(tex.owl, S.owl.x, S.owl.y, 0.5, 1)) : null;
  const pumpS = S.pumpkin ? back.addChild(sp(tex.pumpkin, S.pumpkin.x, S.pumpkin.y, 0.5, 1)) : null;
  const inSafe = (x) => !S.safe || (x >= S.safe[0] && x <= S.safe[1]);
  /** 지금 화면 안 + 안전 범위 안에서 x 하나 (여백 m) */
  const safeX = (m) => { const cam = getCam(), a = Math.max(cam + m, S.safe ? S.safe[0] : -1e9), b = Math.min(cam + viewW() - m, S.safe ? S.safe[1] : 1e9); return a < b ? rnd(a, b) : (a + b) / 2; };
  const E = { tex, back, front, S, cam: getCam, viewW, owl: owlS, pump: pumpS, inSafe, safeX };
  /** 이 월드 자리표로 나올 수 있는 요소만 (자리 규칙) */
  const usable = DEFS.filter((d) => d.needs.every((k) => S[k] != null && S[k] !== false));
  const active = [], rest = {};
  let next = 0.6, hush = 0, last = null, off = new Set();

  function start(d) { rest[d.id] = d.cd; last = d.id; active.push({ d, t: 0, ev: d.make(E) }); }
  function choose() {
    if (active.length >= 3) return;
    const bigOn = active.some((a) => a.d.big);
    const pool = usable.filter((d) => !off.has(d.id) && !(rest[d.id] > 0) && d.id !== last && !active.some((a) => a.d.id === d.id) && !(d.big && bigOn));
    if (!pool.length) return;
    let r = Math.random() * pool.reduce((s, d) => s + d.w, 0);
    for (const d of pool) { if ((r -= d.w) <= 0) { start(d); return; } }
  }
  return {
    ids: DEFS.map((d) => d.id),
    /** 이 월드에서 실제로 쓰이는 요소 (자리표가 허락한 것) */
    usable: usable.map((d) => d.id),
    update(dt) {
      hush = Math.max(0, hush - dt);
      for (const k in rest) rest[k] -= dt;
      if ((next -= dt) <= 0) { next = 1.0 + Math.random() * 0.5; if (!hush) choose(); }
      for (let i = active.length - 1; i >= 0; i--) {
        const a = active[i]; a.t += dt;
        if (!a.ev.update(a.t, dt)) { a.ev.destroy(); active.splice(i, 1); }
      }
    },
    /** 잠깐 멈춤(새 요소를 꺼내지 않는다 — 돌던 것은 끝까지) */
    hush(sec) { hush = Math.max(hush, sec); },
    /** 대표님 «이건 빼자» → 이름으로 끄기 */
    setOff(ids) { off = new Set(ids); },
    /** 확인용 — 이름으로 바로 띄우기 */
    trigger(id) { const d = usable.find((q) => q.id === id); if (d) start(d); },
  };
}
