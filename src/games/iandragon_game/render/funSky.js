/**
 * 하늘 · 달 요소 : 자전거 · 도깨비불 · 번개 · 박쥐 · 빗자루 둘 · 달님 · 별똥별 · 거미 (재미있는 요소 · 2026-11-11 야간 · 300줄 규칙으로 나눔)
 * 요소 하나 = make(E) → { update(t, dt) → 계속이면 true, destroy() }.
 * E = 재미 감독(fun.js)이 넘겨주는 { tex, back, front, S(자리표), cam, viewW, owl, pump, inSafe, safeX }.
 */
import { Container, Graphics } from 'pixi.js';
import { clamp, smooth, outBack, rnd, pick, env, sp, maskedBox, bits, dot } from './funKit.js';

/* ───────────── 요소 17개 ───────────── */

/** 1 달 앞 자전거 — 그림자로 달을 가로지르며 가운데서 붕 뜬다 */
export function bike(E) {
  const { moon } = E.S, c = new Container(); E.sky.addChild(c);   // 달 따라 하늘 겹에
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
export function wisps(E) {
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
export function lightning(E) {
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
export function bats(E) {
  const { moon } = E.S, dir = Math.random() < 0.5 ? 1 : -1, c = new Container(); E.sky.addChild(c);
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

/**
 * 5b 검은 박쥐 떼 (대표님 11/11 «박쥐만 날아다니니 검은 그림자 박쥐 떼가 떼거지로») — 30마리 안팎이 물결치며 하늘을 가로지른다.
 * 그림 = 보조 도트 실루엣(batswarm_a/b)이 있으면 그것, 없으면 제미나이 박쥐(bat_up/down)를 새까맣게 물들여 쓴다.
 */
export function swarm(E) {
  const cam = E.cam(), W = E.viewW(), dir = Math.random() < 0.5 ? 1 : -1, c = new Container(); E.back.addChild(c);
  const A = E.tex.batswarm_a || E.tex.bat_up, B = E.tex.batswarm_b || E.tex.bat_down, black = !E.tex.batswarm_a;
  const [sy0, sy1] = E.S.sky || [50, 200], yMid = rnd(sy0 + 20, sy1 - 10), n = 26 + Math.floor(Math.random() * 10);
  const bs = Array.from({ length: n }, () => {
    const s = c.addChild(sp(A, 0, 0)); if (black) s.tint = 0x0a0612;
    const k = rnd(0.32, 0.6); s.scale.set(k * dir, k);
    return { s, k, ox: rnd(-150, 40), oy: rnd(-34, 34), ph: rnd(0, 6), sp: rnd(7, 12), amp: rnd(4, 12) };
  });
  const T = 4.6;
  return {
    update(t) {
      const lead = dir > 0 ? cam - 120 + (W + 400) * (t / T) : cam + W + 120 - (W + 400) * (t / T);
      for (const b of bs) {
        const wave = Math.sin(t * 2.2 + b.ox * 0.03) * 22;   // 떼 전체가 물결치듯 오르내림
        b.s.position.set(lead + dir * b.ox + Math.sin(t * 3 + b.ph) * 8, yMid + b.oy + wave + Math.sin(t * 5 + b.ph) * b.amp);
        b.s.texture = Math.floor(t * b.sp + b.ph) % 2 ? A : B;
      }
      c.alpha = env(t, T, 0.5, 0.6) * 0.92;
      return t < T;
    },
    destroy() { c.destroy({ children: true }); },
  };
}

/** 6 · 6b 빗자루 마녀 좀비 / 빗자루 해골 좀비 — 하늘을 가로지르며 가루를 뿌리고 가끔 비틀 */
export function broom(texName, dustColor) {
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
export function moonFace(E) {
  const { moon } = E.S, which = pick(['moon_smile', 'moon_wink', 'moon_yawn']);
  /*
   * 대표님 «달 얼굴이 달과 딱 맞지 않고 떠 보인다 · 약간 투명해야 무섭다» (11/11)
   *  - 곱하기(multiply)로 겹친다 → 크림색 얼굴판은 달 색에 녹아 사라지고 눈 · 입 · 그늘만 달 표면에 «비쳐» 보인다.
   *  - 얼굴판 테두리(검은 원)는 달보다 조금 작은 원으로 잘라 낸다 → 자리가 몇 칸 어긋나도 테두리가 따로 떠 보이지 않는다.
   */
  const box = new Container(); E.sky.addChildAt(box, 0);   // 맨 뒤 — 자전거 · 박쥐가 달 앞을 지나가게
  const s = box.addChild(sp(E.tex[which], moon.x, moon.y)); s.scale.set(moon.d / 247); s.blendMode = 'multiply';
  const mask = box.addChild(new Graphics().circle(moon.x, moon.y, moon.d * 0.46).fill(0xffffff)); s.mask = mask;
  box.alpha = 0;
  return {
    update(t) {
      box.alpha = env(t, 2.6, 0.35, 0.45) * 0.6;
      if (which === 'moon_yawn') s.scale.set(moon.d / 247 * (1 + 0.025 * Math.sin(clamp(t / 2.6) * Math.PI)));
      return t < 2.6;
    },
    destroy() { box.destroy({ children: true }); },
  };
}

/** 9 별똥별 — 반짝이 꼬리, 가끔 두 개 */
export function star(E) {
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

/** 14 거미 — 화면 위에서 실 타고 내려와 대롱대롱, 다시 올라간다 */
export function spider(E) {
  const cam = E.cam(), x = rnd(cam + 80, cam + E.viewW() - 80), low = rnd(110, 160);
  const c = new Container(); E.back.addChild(c);
  const thread = c.addChild(new Graphics()), s = c.addChild(sp(E.tex.spider, x, -30, 0.5, 0.45));
  /*
   * 대표님 «거미줄 위에 하얀 줄이 겹쳐 보인다 · 그냥 사라지지 말고 리액션을» (11/11)
   *  - 줄 : spider.png 안에 이미 진보라 줄(위 18칸)이 있다 → 같은 색 · 같은 굵기로 그림 위 끝까지만 이어 그려 한 줄로 보이게.
   *  - 움직임 : 툭 떨어짐(줄 탱) → 번지점프 두 번 → 흔들흔들 + 다리 꼼지락 → 줄 타고 쏙
   */
  return {
    update(t) {
      let yy, sway = 0;
      if (t < 0.9) yy = -30 + (low + 30) * outBack(t / 0.9);
      else if (t < 2.2) { const k = (t - 0.9) / 1.3; yy = low - 38 * Math.abs(Math.sin(k * Math.PI * 2)) * (1 - k * 0.4); }
      else if (t < 3.4) { yy = low + Math.sin((t - 2.2) * 6) * 3; sway = Math.sin((t - 2.2) * 4) * 14; }
      else yy = low - (low + 60) * smooth((t - 3.4) / 1.0);
      const wig = t > 2.2 && t < 3.4 ? 1 + 0.08 * Math.sin(t * 30) : 1;
      s.scale.set(wig, 2 - wig);
      s.position.set(x + sway, yy); s.rotation = -sway * 0.02;
      const top = 18 * s.scale.y;   // 그림 속 줄의 위 끝 (기준점에서 위로 18칸)
      thread.clear().moveTo(x, -40).lineTo(s.x + Math.sin(s.rotation) * top, s.y - Math.cos(s.rotation) * top).stroke({ width: 1, color: 0x620064 });
      return t < 4.4;
    },
    destroy() { c.destroy({ children: true }); },
  };
}
