/**
 * 배경 «조용히 살아 있게» 미리보기 (그림 담당 · 2026-11-11 · 대표님 «월드 1 로 A안 · B안 보여 줘»)
 *  still : 지금 게임 (통그림 한 장 + 반딧불)
 *  A     : 통그림 그대로 + 코드 숨결 — 달 빛무리 숨쉬기 · 화로 불빛 깜빡 + 불티 · 창문 반짝 · 땅 안개 띠 흐름 · 옅은 구름 자락
 *  B     : AI 두 겹 — 하늘 겹(0.35배 느리게) + 앞 겹(그대로) + A 의 숨결 → 카메라가 움직이면 깊이가 생긴다
 * 카메라는 게임처럼 좌우로 천천히 오간다(깊이 비교용). 빛 자리표 = LIGHTS (배경 그림 좌표, 540 높이).
 * 게임 코드는 import 만 (ambient.js 반딧불).
 */
import { Application, AnimatedSprite, Assets, Container, Graphics, Rectangle, Sprite, Texture, TilingSprite } from 'pixi.js';
import { createAmbient } from '/src/games/iandragon_game/render/ambient.js';
import { createAmbientX } from './ambient-610.js';

const VW = 1260, VH = 540;
/** 월드별 빛 자리표 — 겜부장에게 넘길 자료 (좌표 = 540 높이 배경 그림 기준) */
export const LIGHTS = {
  1: {
    moon: { x: 790, y: 110, r: 150, color: 0xd8c8ff },
    fires: [{ x: 140, y: 312, r: 70, color: 0x7dff6a }, { x: 600, y: 292, r: 46, color: 0x7dff6a }],
    windows: [{ x: 722, y: 186 }, { x: 1155, y: 262 }, { x: 628, y: 214 }, { x: 760, y: 222 }, { x: 1062, y: 250 }, { x: 905, y: 238 }],
    fog: { y: 392, h: 60, color: 0xb9a8ff, alpha: 0.16 },
    clouds: { y0: 130, y1: 230, color: 0xcbb8ff },
  },
};

/**
 * 확정안(B + A 숨결 + 움직이는 불꽃)의 빛 자리표 — 두 겹 그림 기준 (540 높이)
 *  sky   : 하늘 겹 (0.35배로 느리게 움직임) — 달 빛무리 · 먼 성 창문 · 구름 자락 · 먼 안개
 *  front : 앞 겹 (카메라 그대로) — 화로(움직이는 불꽃 · 불빛 · 불티) · 땅 안개
 *  fires[].s = 불꽃 크기 배율 (불꽃 한 장 72칸 기준) · x, y = 불꽃 밑동 가운데 (화로 위)
 */
export const LIGHTS_B = {
  1: {
    sky: { moon: { x: 780, y: 120, r: 165, color: 0xd8c8ff }, windows: [{ x: 585, y: 347 }, { x: 605, y: 343 }, { x: 615, y: 322 }, { x: 645, y: 311 }, { x: 680, y: 342 }, { x: 698, y: 355 }], clouds: { y0: 140, y1: 300, color: 0xcbb8ff }, fog: { y: 352, h: 40, color: 0xc8b8ff, alpha: 0.1 } },
    front: { fire: 'fire_green', fires: [{ x: 64, y: 361, s: 1, color: 0x7dff6a }, { x: 272, y: 348, s: 1.05, color: 0x7dff6a }, { x: 773, y: 321, s: 0.62, color: 0x7dff6a }], fog: { y: 400, h: 60, color: 0xb9a8ff, alpha: 0.15 } },
  },
};

let lightsP = null;
/** 월드 2~10 자리표 = ai/bg/layers/lights.json (tools/idg-bg-lights.mjs 가 만듦) · 월드 1 = 위 LIGHTS_B */
async function lightsFor(world) {
  if (LIGHTS_B[world]) return LIGHTS_B[world];
  lightsP ||= fetch('/assets/iandragon_game/ai/bg/layers/lights.json?v=' + Date.now()).then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
  return (await lightsP)[String(world).padStart(2, '0')] || null;
}

/** 움직이는 불꽃 (ai/fx/<이름>.png 가로 띠 + .json) */
const fxCache = {};
async function fxFrames(name) {
  if (fxCache[name]) return fxCache[name];
  const meta = await (await fetch(`/assets/iandragon_game/ai/fx/${name}.json`)).json();
  const tex = await Assets.load(`/assets/iandragon_game/${meta.file}`); tex.source.scaleMode = 'nearest';
  const frames = Array.from({ length: meta.frames }, (_, k) => new Texture({ source: tex.source, frame: new Rectangle(k * meta.w, 0, meta.w, meta.h) }));
  return (fxCache[name] = { frames, meta });
}

let glowTex = null;
function glow() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return (glowTex = Texture.from(c));
}
let fogTex = null;
function fog() {                                                                   // 가로로 이어지는 뭉게 안개 띠 (코드로 그림)
  if (fogTex) return fogTex;
  const c = document.createElement('canvas'); c.width = 512; c.height = 64;
  const g = c.getContext('2d');
  for (let i = 0; i < 26; i++) {
    const x = (i / 26) * 512, y = 32 + Math.sin(i * 1.7) * 10, r = 22 + (i * 37 % 18);
    for (const dx of [-512, 0, 512]) { const gr = g.createRadialGradient(x + dx, y, 0, x + dx, y, r); gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(x + dx - r, y - r, r * 2, r * 2); }
  }
  return (fogTex = Texture.from(c));
}
const nearest = async (url) => { const t = await Assets.load(url); t.source.scaleMode = 'nearest'; return t; };

/** 숨결 층 (A · B 공통) — 그릇 하나에 빛 · 안개 · 불티를 얹고 update(dt) */
function makeBreath(layer, L, fx = null) {
  const box = new Container(); layer.addChild(box);
  if (fx) for (const f of L.fires || []) {                                       // 움직이는 불꽃 (화로마다 시작 프레임을 달리해 엇박자)
    const a = new AnimatedSprite(fx.frames); a.anchor.set(0.5, 1); a.position.set(f.x, f.y); a.scale.set(f.s || 1);
    a.animationSpeed = fx.meta.fps / 60 * (0.9 + Math.random() * 0.2); a.gotoAndPlay((Math.random() * fx.frames.length) | 0); box.addChild(a);
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
  for (const g of L.glows || []) add(g.x, g.y, g.r, g.color, 0.35, 'glow', { sp: 0.7 + Math.random() * 0.6 });   // 버섯 · 수정 · 등불 빛 맥박
  /* 안개 띠 두 겹 (서로 다른 빠르기) */
  const fogs = [];
  if (L.fog) for (const [sp, a, dy] of [[9, 1, 0], [-5, 0.7, 14]]) {
    const t = new TilingSprite({ texture: fog(), width: 3200, height: 64 }); t.position.set(-200, L.fog.y + dy - 32); t.tint = L.fog.color; t.alpha = L.fog.alpha * a; t.blendMode = 'add';
    box.addChild(t); fogs.push({ t, sp });
  }
  /* 옅은 구름 자락 (하늘 띠에서 아주 천천히) */
  const clouds = [];
  if (L.clouds) for (let i = 0; i < 4; i++) {
    const s = new Sprite(glow()); s.anchor.set(0.5); s.tint = L.clouds.color; s.alpha = 0.07; s.scale.set(3.2, 0.7);
    s.position.set(i * 380 + Math.random() * 200, L.clouds.y0 + Math.random() * (L.clouds.y1 - L.clouds.y0)); box.addChild(s); clouds.push({ s, sp: 4 + Math.random() * 4 });
  }
  /* 화로 불티 */
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
      for (const f of fogs) { f.t.tilePosition.x += f.sp * dt; }
      for (const c of clouds) { c.s.x += c.sp * dt; if (c.s.x > 2600) c.s.x = -300; }
      for (const f of L.fires || []) if (Math.random() < dt * 5) {
        const r = f.r || 70 * (f.s || 1), cy = f.r ? f.y - r * 0.2 : f.y - 55 * (f.s || 1);
        const g = new Graphics().rect(-1, -1, 2, 2).fill(Math.random() < 0.5 ? 0xb8ff8a : 0xeaffc8); g.position.set(f.x + (Math.random() - 0.5) * r * 0.4, cy); box.addChild(g);
        sparks.push({ g, vx: (Math.random() - 0.5) * 10, vy: -25 - Math.random() * 25, life: 1.4 + Math.random() });
      }
      for (let i = sparks.length - 1; i >= 0; i--) { const p = sparks[i]; p.life -= dt; p.g.x += p.vx * dt; p.g.y += p.vy * dt; p.g.alpha = Math.min(1, p.life); if (p.life <= 0) { p.g.destroy(); sparks.splice(i, 1); } }
    },
  };
}

export async function createLivingStage(host, mode, world = 1) {
  const app = new Application();
  await app.init({ width: VW, height: VH, backgroundColor: 0x120c24, antialias: false, resolution: 1 });
  host.appendChild(app.canvas);
  app.canvas.style.cssText = 'width:100%;height:auto;display:block;border-radius:10px';
  const L = LIGHTS[world] || {};
  const sky = new Container(), world0 = new Container();
  app.stage.addChild(sky, world0);
  let bgW = VW;
  const n = String(world).padStart(2, '0');
  if (mode === 'B') {
    const st = await nearest(`/assets/iandragon_game/ai/bg/layers/w${n}_sky.png`), fr = await nearest(`/assets/iandragon_game/ai/bg/layers/w${n}_front.png`);
    const ks = VH / st.height;
    for (let i = 0; i < 3; i++) { const s = new Sprite(st); s.scale.set(i % 2 ? -ks : ks, ks); s.x = i % 2 ? (i + 1) * st.width * ks : i * st.width * ks; sky.addChild(s); }
    const kf = VH / fr.height, f = new Sprite(fr); f.scale.set(kf); world0.addChild(f); bgW = fr.width * kf;
  } else {
    const t = await nearest(`/assets/iandragon_game/ai/bg/w${n}_panel.png`);
    const k = VH / t.height, s = new Sprite(t); s.scale.set(k); world0.addChild(s); bgW = t.width * k;
  }
  const breathLayer = new Container(); world0.addChildAt(breathLayer, 1);
  const LB = await lightsFor(world);
  let breath = null, frontBreath = null;
  if (mode === 'B' && LB) {                                                        // 확정안 : 하늘 겹 숨결 + 앞 겹 숨결 · 움직이는 불꽃
    breath = makeBreath(sky, LB.sky);
    frontBreath = makeBreath(world0, LB.front, LB.front.fire ? await fxFrames(LB.front.fire) : null);
  } else if (mode === 'A') breath = makeBreath(breathLayer, L);
  const amb = (world >= 6 ? createAmbientX : createAmbient)(world0, world, () => cam, () => VW);   // 6~10 = 그림 담당 제안 입자
  let cam = 0, t = 0;
  const maxCam = Math.max(0, Math.min(bgW, 1710) - VW);
  app.ticker.add((tk) => {
    const dt = Math.min(0.05, tk.deltaMS / 1000); t += dt;
    cam = maxCam * (0.5 - 0.5 * Math.cos(t * 0.25));                               // 좌우로 천천히 (약 25초 왕복)
    world0.x = -cam; sky.x = mode === 'B' ? -cam * 0.35 : -cam;
    breath?.update(dt); frontBreath?.update(dt); amb.update(dt);
  });
  return { get bgW() { return bgW; }, destroy() { app.destroy(true, { children: true }); } };
}
