/**
 * 살아 있는 두 겹 배경 (2026-11-11 · 대표님이 갤러리에서 고른 확정안 «B 두 겹 + A 숨결 + 움직이는 불꽃» — 그림 담당 tools/idg-gallery/living.js 를 게임으로 옮김)
 *  - 하늘 겹 ai/bg/layers/wNN_sky.png : 카메라의 0.35배로 느리게 → 깊이
 *  - 앞 겹 ai/bg/layers/wNN_front.png : 카메라 그대로 (땅 · 화로 · 성)
 *  - 숨결 : 달 빛무리 숨쉬기 · 창문 반짝 · 구름 자락 · 안개 띠 흐름 · 화로 불꽃(제미나이 12프레임 · ai/fx/fire_*.png) + 불빛 + 불티
 * 그림 높이는 1080(2배 선명) 이어도 좌표는 540 기준 — 스프라이트 배율 = 540 / 그림 높이.
 * 자리표 = 월드 1 은 아래 W1 · 2~10 은 ai/bg/layers/lights.json (그림 담당 tools/idg-bg-lights.mjs).
 */
import { AnimatedSprite, Assets, Container, Graphics, Rectangle, Sprite, Texture, TilingSprite } from 'pixi.js';

const BASE = '/assets/iandragon_game/';
const W1 = {
  sky: { moon: { x: 780, y: 120, r: 165, color: 0xd8c8ff }, windows: [{ x: 585, y: 347 }, { x: 605, y: 343 }, { x: 615, y: 322 }, { x: 645, y: 311 }, { x: 680, y: 342 }, { x: 698, y: 355 }], clouds: { y0: 140, y1: 300, color: 0xcbb8ff }, fog: { y: 352, h: 40, color: 0xc8b8ff, alpha: 0.1 } },
  front: { fire: 'fire_green', fires: [{ x: 64, y: 361, s: 1, color: 0x7dff6a }, { x: 272, y: 348, s: 1.05, color: 0x7dff6a }, { x: 773, y: 321, s: 0.62, color: 0x7dff6a }], fog: { y: 400, h: 60, color: 0xb9a8ff, alpha: 0.15 } },
};

let lightsP = null;
export async function lightsFor(world) {
  if (world === 1) return W1;
  lightsP ||= fetch(`${BASE}ai/bg/layers/lights.json`).then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
  return (await lightsP)[String(world).padStart(2, '0')] || null;
}

const fxCache = {};
/* 11/12 속도 : 표(json)와 그림을 동시에 받는다 — 그림 이름은 늘 ai/fx/<이름>.png 라 미리 받고, 표가 다른 이름을 말하면 그걸 받는다. 같은 효과를 동시에 불러도 한 번만 */
export function fxFrames(name) {
  if (!fxCache[name]) {
    const guess = `ai/fx/${name}.png`, early = Assets.load(`${BASE}${guess}`).catch(() => null);
    fxCache[name] = fetch(`${BASE}ai/fx/${name}.json`).then((r) => r.json()).then(async (meta) => {
      const tex = (meta.file === guess && await early) || await Assets.load(`${BASE}${meta.file}`); tex.source.scaleMode = 'nearest';
      const frames = Array.from({ length: meta.frames }, (_, k) => new Texture({ source: tex.source, frame: new Rectangle(k * meta.w, 0, meta.w, meta.h) }));
      return { frames, meta };
    });
    fxCache[name].catch(() => { delete fxCache[name]; });
  }
  return fxCache[name];
}

let glowTex = null;
function glow() {   // 부드러운 둥근 빛 (빛무리 · 불빛)
  if (glowTex) return glowTex;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return (glowTex = Texture.from(c));
}
let fogTex = null;
function fog() {   // 가로로 이어지는 뭉게 안개 띠
  if (fogTex) return fogTex;
  const c = document.createElement('canvas'); c.width = 512; c.height = 64;
  const g = c.getContext('2d');
  for (let i = 0; i < 26; i++) {
    const x = (i / 26) * 512, y = 32 + Math.sin(i * 1.7) * 10, r = 22 + (i * 37 % 18);
    for (const dx of [-512, 0, 512]) { const gr = g.createRadialGradient(x + dx, y, 0, x + dx, y, r); gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(x + dx - r, y - r, r * 2, r * 2); }
  }
  return (fogTex = Texture.from(c));
}

/** 숨결 층 — layer 에 빛 · 안개 · 불티를 얹고 update(dt). width = 이 겹이 깔린 너비(안개 띠 길이) */
export function makeBreath(layer, L, fx = null, width = 3200) {
  const box = new Container(); layer.addChild(box);
  if (fx) for (const f of L.fires || []) {
    const a = new AnimatedSprite(fx.frames); a.anchor.set(0.5, 1); a.position.set(f.x, f.y); a.scale.set(f.s || 1);
    a.animationSpeed = (fx.meta.fps / 60) * (0.9 + Math.random() * 0.2); a.gotoAndPlay((Math.random() * fx.frames.length) | 0); box.addChild(a);
  }
  const items = [];
  const add = (x, y, r, color, alpha, kind, extra = {}) => {
    const s = new Sprite(glow()); s.anchor.set(0.5); s.position.set(x, y); s.tint = color; s.blendMode = 'add';
    s.scale.set((r * 2) / 128); s.alpha = alpha; box.addChild(s);
    items.push({ s, base: alpha, r, kind, t: Math.random() * 10, ...extra });
  };
  if (L.moon) add(L.moon.x, L.moon.y, L.moon.r, L.moon.color, 0.28, 'moon');
  for (const f of L.fires || []) { const r = f.r || 70 * (f.s || 1), cy = f.r ? f.y : f.y - 30 * (f.s || 1); add(f.x, cy, r, f.color, 0.45, 'fire'); add(f.x, cy - r * 0.2, r * 0.45, 0xeaffd0, 0.3, 'fire'); }
  for (const w of L.windows || []) add(w.x, w.y, 9, 0xffd27a, 0.6, 'win', { sp: 0.6 + Math.random() * 0.8 });
  for (const g of L.glows || []) add(g.x, g.y, g.r, g.color, 0.35, 'glow', { sp: 0.7 + Math.random() * 0.6 });
  const fogs = [];
  if (L.fog) for (const [sp, a, dy] of [[9, 1, 0], [-5, 0.7, 14]]) {
    const t = new TilingSprite({ texture: fog(), width: width + 400, height: 64 }); t.position.set(-200, L.fog.y + dy - 32); t.tint = L.fog.color; t.alpha = L.fog.alpha * a; t.blendMode = 'add';
    box.addChild(t); fogs.push({ t, sp });
  }
  const clouds = [];
  if (L.clouds) for (let i = 0; i < 4; i++) {
    const s = new Sprite(glow()); s.anchor.set(0.5); s.tint = L.clouds.color; s.alpha = 0.07; s.scale.set(3.2, 0.7);
    s.position.set(i * 380 + Math.random() * 200, L.clouds.y0 + Math.random() * (L.clouds.y1 - L.clouds.y0)); box.addChild(s); clouds.push({ s, sp: 4 + Math.random() * 4 });
  }
  const sparks = [];
  return {
    update(dt) {
      for (const it of items) {
        it.t += dt;
        if (it.kind === 'moon') { const k = 1 + Math.sin(it.t * 0.9) * 0.06; it.s.scale.set((it.r * 2 * k) / 128); it.s.alpha = it.base + Math.sin(it.t * 0.9) * 0.06; }
        else if (it.kind === 'fire') it.s.alpha = it.base * (0.8 + 0.2 * Math.sin(it.t * 9) + 0.15 * Math.sin(it.t * 23));
        else if (it.kind === 'win') it.s.alpha = it.base * (0.65 + 0.35 * Math.max(0, Math.sin(it.t * it.sp)));
        else if (it.kind === 'glow') it.s.alpha = it.base * (0.6 + 0.4 * Math.sin(it.t * it.sp));
      }
      for (const f of fogs) f.t.tilePosition.x += f.sp * dt;
      for (const c of clouds) { c.s.x += c.sp * dt; if (c.s.x > width) c.s.x = -300; }
      for (const f of L.fires || []) if (Math.random() < dt * 5) {
        const r = f.r || 70 * (f.s || 1), cy = f.r ? f.y - r * 0.2 : f.y - 55 * (f.s || 1);
        const g = new Graphics().rect(-1, -1, 2, 2).fill(Math.random() < 0.5 ? (f.color === 0x7dff6a ? 0xb8ff8a : 0xffc070) : 0xfff0c8); g.position.set(f.x + (Math.random() - 0.5) * r * 0.4, cy); box.addChild(g);
        sparks.push({ g, vx: (Math.random() - 0.5) * 10, vy: -25 - Math.random() * 25, life: 1.4 + Math.random() });
      }
      for (let i = sparks.length - 1; i >= 0; i--) { const p = sparks[i]; p.life -= dt; p.g.x += p.vx * dt; p.g.y += p.vy * dt; p.g.alpha = Math.min(1, p.life); if (p.life <= 0) { p.g.destroy(); sparks.splice(i, 1); } }
    },
  };
}

/** 그림 한 장을 540 높이로 맞춰 좌우 거울로 이어 깔기 (전장이 그림보다 길 때) → 깐 너비 */
/*
 * 큰 배경 조각내기 (11/11 긴급 · 대표님 «내 태블릿에서 배경이 안 보여») : 월드 3 · 8 · 9 · 10 배경은 폭 4060~4698px 이라
 * 태블릿 GPU 의 텍스처 한도(MAX_TEXTURE_SIZE 4096 · 기기에 따라 더 작음)를 넘어 아무 말 없이 까맣게 나왔다.
 * → 폭 SLICE(2048) 넘는 그림은 캔버스로 잘라 여러 장의 텍스처로 올리고 나란히 붙인다 (그림 하나당 한 번만 자름).
 */
const SLICE = 2048, sliced = new WeakMap();
function slicesOf(tex) {
  if (tex.width <= SLICE) return null;
  if (sliced.has(tex)) return sliced.get(tex);
  const img = tex.source.resource, out = [];
  for (let x = 0; x < tex.width; x += SLICE) {
    const w = Math.min(SLICE, tex.width - x), c = document.createElement('canvas'); c.width = w; c.height = tex.height;
    c.getContext('2d').drawImage(img, x, 0, w, tex.height, 0, 0, w, tex.height);
    const t = Texture.from(c); t.source.scaleMode = 'nearest'; out.push([t, x]);
  }
  sliced.set(tex, out); return out;
}
export function tileMirror(box, tex, width) {
  const k = 540 / tex.height, bw = tex.width * k, parts = slicesOf(tex);
  for (let i = 0; i * bw < width + bw; i++) {
    let s;
    if (parts) { s = new Container(); for (const [t, x] of parts) { const q = new Sprite(t); q.x = x; s.addChild(q); } }
    else s = new Sprite(tex);
    s.scale.set(i % 2 ? -k : k, k); s.x = i % 2 ? (i + 1) * bw : i * bw; box.addChild(s);
  }
  return bw;
}
