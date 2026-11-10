/**
 * 재미 요소 공용 도구 — 부드러운 움직임 · 땅 마스크 · 작은 조각 (재미있는 요소 · 2026-11-11 야간 · 300줄 규칙으로 나눔)
 * 요소 하나 = make(E) → { update(t, dt) → 계속이면 true, destroy() }.
 * E = 재미 감독(fun.js)이 넘겨주는 { tex, back, front, S(자리표), cam, viewW, owl, pump, inSafe, safeX }.
 */
import { Container, Sprite, Graphics } from 'pixi.js';

export const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const smooth = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };
export const outBack = (t) => { t = clamp(t); const c = 1.7; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2; };
export const rnd = (a, b) => a + Math.random() * (b - a);
export const pick = (arr) => arr[(Math.random() * arr.length) | 0];
/** 나타났다(a초) · 머물고 · 사라지는(b초) 투명도 */
export const env = (t, dur, a = 0.3, b = 0.4) => Math.min(clamp(t / a), clamp((dur - t) / b));

export function sp(tex, x, y, ax = 0.5, ay = 0.5) { const s = new Sprite(tex); s.anchor.set(ax, ay); s.position.set(x, y); return s; }
/** 땅(줄 y) 아래를 가리는 마스크를 단 그릇 — 땅에서 솟아오르는 것들 */
export function maskedBox(parent, x, y, w = 140) {
  const box = new Container(); parent.addChild(box);
  const m = new Graphics().rect(x - w / 2, y - 400, w, 400).fill(0xffffff);
  box.addChild(m); box.mask = m;
  return box;
}
/** 작은 조각(흙 · 뼈 · 반짝이) — 날아가고 떨어지고 사라진다 */
export function bits(parent) {
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
export const dot = (color, r = 1.5, alpha = 1) => new Graphics().circle(0, 0, r).fill({ color, alpha });

