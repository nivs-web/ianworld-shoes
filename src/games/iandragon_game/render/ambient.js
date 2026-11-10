/**
 * 월드 분위기 입자 (2026-11-11 야간 · 재미 요소 월드별 색 Q8) — 배경 위에 늘 조금씩 흐르는 것.
 *  1 달밤 언덕 : 반딧불(초록 점이 깜빡이며 떠다님) · 2 화산 : 불티(아래에서 위로) · 3 하늘섬 : 작은 구름 조각(옆으로)
 *  4 얼음골 : 눈송이(위에서 아래로, 살랑) · 5 고철 광산 : 불꽃 튐 + 연기(위로 퍼짐)
 * 화면 안(카메라 근처)에만 만든다. 개수 상한 40. 계산과 무관.
 */
import { Graphics } from 'pixi.js';

const KIND = {
  1: { n: 14, make: (x) => ({ x, y: 300 + Math.random() * 120, vx: 6, vy: -4, r: 1.6, c: 0xb8ff6a, life: 4 + Math.random() * 3, blink: true }) },
  2: { n: 30, make: (x) => ({ x, y: 440 + Math.random() * 20, vx: 8 - Math.random() * 16, vy: -40 - Math.random() * 40, r: 1.4 + Math.random(), c: Math.random() < 0.5 ? 0xff8a2a : 0xffd04a, life: 3 + Math.random() * 3, wob: 1 }) },
  3: { n: 10, make: (x) => ({ x, y: 60 + Math.random() * 260, vx: 12 + Math.random() * 10, vy: 0, r: 6 + Math.random() * 8, c: 0xe8e0ff, a: 0.18, life: 9, cloud: true }) },
  4: { n: 40, make: (x) => ({ x, y: -10, vx: -6 + Math.random() * 12, vy: 22 + Math.random() * 20, r: 1.2 + Math.random() * 1.4, c: 0xffffff, life: 14, wob: 2 }) },
  5: { n: 24, make: (x) => (Math.random() < 0.6
    ? { x, y: 430, vx: -30 + Math.random() * 60, vy: -90 - Math.random() * 60, g: 160, r: 1.3, c: 0xffd27a, life: 1.2 }
    : { x, y: 380 + Math.random() * 40, vx: 4, vy: -14, r: 5 + Math.random() * 6, c: 0x6b6475, a: 0.22, life: 6, grow: 3 }) },
};

export function createAmbient(layer, world, getCam, viewW) {
  const K = KIND[world] || KIND[1];
  const list = [];
  let acc = 0;
  return {
    update(dt) {
      acc += dt * K.n / 4;
      while (acc >= 1 && list.length < 40) {
        acc -= 1;
        const p = K.make(getCam() + Math.random() * viewW());
        p.g = p.g || 0; p.t = 0; p.a = p.a ?? 0.9;
        p.node = new Graphics().circle(0, 0, p.r).fill({ color: p.c }); p.node.alpha = 0; p.node.position.set(p.x, p.y);
        if (!p.cloud) p.node.blendMode = 'add';
        layer.addChild(p.node); list.push(p);
      }
      if (acc > 1) acc = 1;
      for (let i = list.length - 1; i >= 0; i--) {
        const p = list[i]; p.t += dt;
        p.vy += (p.g || 0) * dt;
        p.x += (p.vx + (p.wob ? Math.sin(p.t * 2 + p.y) * 8 * p.wob : 0)) * dt; p.y += p.vy * dt;
        const k = p.t / p.life, fade = Math.min(1, p.t / 0.5, (p.life - p.t) / 0.6);
        p.node.position.set(p.x, p.y);
        p.node.alpha = Math.max(0, fade) * p.a * (p.blink ? 0.5 + 0.5 * Math.sin(p.t * 5) : 1);
        if (p.grow) p.node.scale.set(1 + k * p.grow);
        if (p.t >= p.life || p.y > 560) { p.node.destroy(); list.splice(i, 1); }
      }
    },
    destroy() { for (const p of list) p.node.destroy(); list.length = 0; },
  };
}
