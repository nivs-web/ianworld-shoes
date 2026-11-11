/**
 * 월드 분위기 입자 (2026-11-11 야간 · 재미 요소 월드별 색 Q8) — 배경 위에 늘 조금씩 흐르는 것.
 *  1 달밤 언덕 : 반딧불(초록 점이 깜빡이며 떠다님) · 2 화산 : 불티(아래에서 위로) · 3 하늘섬 : 작은 구름 조각(옆으로)
 *  4 얼음골 : 눈송이(위에서 아래로, 살랑) · 5 고철 광산 : 불꽃 튐 + 연기(위로 퍼짐)
 *  6 도깨비불 + 땅 안개 · 7 모래바람 + 먼지 · 8 기포 + 초록 안개 · 9 수정 가루 · 10 잿가루 + 붉은 불티
 * 화면 안(카메라 근처)에만 만든다. 개수 상한 40. 계산과 무관.
 */
import { Graphics } from 'pixi.js';

const R = Math.random, pick = (a) => a[(R() * a.length) | 0];

const KIND = {
  1: { n: 14, make: (x) => ({ x, y: 300 + Math.random() * 120, vx: 6, vy: -4, r: 1.6, c: 0xb8ff6a, life: 4 + Math.random() * 3, blink: true }) },
  2: { n: 30, make: (x) => ({ x, y: 440 + Math.random() * 20, vx: 8 - Math.random() * 16, vy: -40 - Math.random() * 40, r: 1.4 + Math.random(), c: Math.random() < 0.5 ? 0xff8a2a : 0xffd04a, life: 3 + Math.random() * 3, wob: 1 }) },
  3: { n: 10, make: (x) => ({ x, y: 60 + Math.random() * 260, vx: 12 + Math.random() * 10, vy: 0, r: 6 + Math.random() * 8, c: 0xe8e0ff, a: 0.18, life: 9, cloud: true }) },
  4: { n: 40, make: (x) => ({ x, y: -10, vx: -6 + Math.random() * 12, vy: 22 + Math.random() * 20, r: 1.2 + Math.random() * 1.4, c: 0xffffff, life: 14, wob: 2 }) },
  5: { n: 24, make: (x) => (Math.random() < 0.6
    ? { x, y: 430, vx: -30 + Math.random() * 60, vy: -90 - Math.random() * 60, g: 160, r: 1.3, c: 0xffd27a, life: 1.2 }
    : { x, y: 380 + Math.random() * 40, vx: 4, vy: -14, r: 5 + Math.random() * 6, c: 0x6b6475, a: 0.22, life: 6, grow: 3 }) },
  /* 월드 6~10 (겜부장 보조 · 대표님 «사막에 반딧불 없게») */
  /* 6 으스스 유령 묘지 : 도깨비불(청록 빛이 흔들리며 천천히 떠오름) + 땅 안개 덩이 */
  6: { n: 18, make: (x) => (R() < 0.65
    ? { x, y: 350 + R() * 70, vx: 3, vy: -7 - R() * 6, r: 2 + R() * 1.2, c: R() < 0.7 ? 0x7dffd8 : 0xb6ff9a, life: 4 + R() * 3, blink: true, wob: 1.6 }
    : { x, y: 418 + R() * 22, vx: 6 + R() * 6, vy: 0, r: 9 + R() * 9, c: 0xa8d8c0, a: 0.13, life: 9, cloud: true, grow: 1.2 }) },
  /* 7 모래바람 사막 : 가로로 휙 지나가는 모래 알갱이 + 낮게 깔리는 먼지 구름 */
  7: { n: 34, make: (x) => (R() < 0.8
    ? { x: x - 300, y: 240 + R() * 200, vx: 70 + R() * 50, vy: -4 + R() * 8, r: 0.9 + R() * 0.8, c: pick([0xf0d7a0, 0xe2b878, 0xfff0c8]), a: 0.75, life: 5, wob: 0.6 }
    : { x: x - 200, y: 400 + R() * 40, vx: 28 + R() * 14, vy: -2, r: 10 + R() * 10, c: 0xd9b27a, a: 0.12, life: 8, cloud: true, grow: 1.6 }) },
  /* 8 끈적끈적 독 늪 : 늪에서 퐁퐁 올라오는 기포 + 초록 안개 */
  8: { n: 22, make: (x) => (R() < 0.72
    ? { x, y: 432 + R() * 12, vx: 0, vy: -16 - R() * 12, r: 1.4 + R() * 1.8, c: pick([0x9dff6a, 0xc8ff8a, 0x6ee04a]), a: 0.8, life: 1.8 + R() * 1.4, wob: 1 }
    : { x, y: 405 + R() * 30, vx: 5, vy: -1, r: 11 + R() * 8, c: 0x8fd06a, a: 0.12, life: 9, cloud: true, grow: 1 }) },
  /* 9 반짝반짝 수정 동굴 : 공중에서 반짝이며 떠도는 수정 가루 (파랑 · 보라 · 흰) */
  9: { n: 22, make: (x) => ({ x, y: 70 + R() * 360, vx: -3 + R() * 6, vy: -4 - R() * 4, r: 1 + R() * 1.1, c: pick([0x9fe8ff, 0xd6a8ff, 0xffffff, 0x7fc8ff]), a: 0.95, life: 3 + R() * 2, blink: true, wob: 0.5 }) },
  /* 10 좀비 드래곤 성 : 위에서 흩날려 내리는 잿가루 + 땅에서 튀어 오르는 붉은 불티 */
  10: { n: 30, make: (x) => (R() < 0.7
    ? { x, y: -10, vx: -8 + R() * 12, vy: 18 + R() * 16, r: 1.2 + R() * 1, c: pick([0x8a8090, 0xb0a8b8, 0x6e6878]), a: 0.65, life: 14, wob: 1.6, cloud: true }
    : { x, y: 438, vx: -20 + R() * 40, vy: -70 - R() * 50, g: 120, r: 1.2, c: pick([0xff5a3a, 0xff8a4a]), a: 0.9, life: 1.4 }) },
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
