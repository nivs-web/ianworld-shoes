/**
 * 갤러리 뷰어 — 게임 코드(rig.js · fun.js · funSpots.js)를 그대로 import 해서 실제 게임처럼 움직여 본다. (src 는 읽기만)
 *  createCharStage : 캐릭터 한 마리 (걷기 · 공격 · 맞음 · 쉬기 · 방향 · 배율)
 *  createBgStage   : 배경 + 재미 요소 (자리표 겹쳐 보기 · 하나씩 띄우기 · 카메라)
 *  makeThumb       : 카드용 정지 그림 (같은 rig 를 쉬는 자세로 한 번 그려 dataURL 로)
 */
import { Application, Assets, Container, Graphics, Sprite, Text } from 'pixi.js';
import { loadRig, createRigged } from '/src/games/iandragon_game/render/rig.js';
import { createFun, loadFun } from '/src/games/iandragon_game/render/fun.js';
import { SPOTS } from '/src/games/iandragon_game/render/funSpots.js';
import { A } from './lists.js';

const rigCache = new Map();
export const getRig = (art) => { if (!rigCache.has(art)) rigCache.set(art, loadRig(art)); return rigCache.get(art); };

/* ───────── 카드 썸네일 ───────── */
let thumbApp = null, thumbQueue = Promise.resolve();
export function makeThumb(art, want, scale = 3) {
  const job = thumbQueue.then(async () => {
    if (!thumbApp) { thumbApp = new Application(); await thumbApp.init({ width: 4, height: 4, backgroundAlpha: 0, antialias: false }); }
    const data = await getRig(art);
    const R = createRigged(data, scale, want);
    R.set('idle'); R.update(0.01);
    const canvas = thumbApp.renderer.extract.canvas({ target: R.root, resolution: 1, antialias: false });
    const url = canvas.toDataURL('image/png');
    R.root.destroy({ children: true });
    return url;
  });
  thumbQueue = job.catch(() => {});
  return job;
}

/* ───────── 캐릭터 무대 ───────── */
export async function createCharStage(host, W = 640, H = 380) {
  const app = new Application();
  await app.init({ width: W, height: H, backgroundAlpha: 0, antialias: false, resolution: Math.min(2, window.devicePixelRatio || 1), autoDensity: true });
  host.appendChild(app.canvas);
  app.canvas.style.cssText = 'width:100%;height:auto;display:block';
  const GY = H - 60;
  const floor = new Graphics().rect(0, GY, W, H - GY).fill({ color: 0x2b2147 }).moveTo(0, GY).lineTo(W, GY).stroke({ width: 2, color: 0x5b4a8a });
  app.stage.addChild(floor);
  const holder = new Container(); app.stage.addChild(holder);
  const S = { art: null, data: null, R: null, scale: 3, want: 1, base: 'walk', move: false, x: W / 2, seq: null, timing: { fore: 0.3, back: 0.6, kb: 0.45 } };
  const build = () => {
    if (!S.data) return;
    S.R?.root.destroy({ children: true });
    S.R = createRigged(S.data, S.scale, S.want);
    holder.addChild(S.R.root);
    S.R.set(S.base);
    attachLook();
  };
  /** 꾸미기 미리보기 : 모자 = 머리 부품 위 가운데(그림 아래 가운데가 붙는 점) · 목 장식 = 몸통 위 가운데(그림 위 가운데) — 부품의 자식이라 같이 움직인다 */
  async function attachLook() {
    const R = S.R, body = R?.root.children[0];
    if (!body || !S.look) return;
    const part = (n) => body.children[S.data.rig.parts.findIndex((p) => p.n === n)];
    for (const [slot, partName, ay, k] of [['neck', 'torso', 0, 1.15], ['hat', 'head', 1, 0.95]]) {
      const id = S.look[slot], host = part(partName);
      if (!id || !host) continue;
      const tex = await Assets.load(`/assets/iandragon_game/ai/meta/${id}.png`);
      if (S.R !== R) return;
      const s = new Sprite(tex), w = host.texture.width, h = host.texture.height, a = host.anchor;
      s.anchor.set(0.5, ay);
      s.scale.set((w * k) / 256);
      s.position.set((0.5 - a.x) * w, -a.y * h + (slot === 'hat' ? h * 0.3 : h * 0.12));
      host.addChild(s);
    }
  }
  app.ticker.add((tk) => {
    const dt = Math.min(0.05, tk.deltaMS / 1000);
    if (!S.R) return;
    if (S.seq) {
      S.seq.t += dt;
      const cur = S.seq.steps[S.seq.i];
      if (S.seq.t >= cur[1]) {
        S.seq.i++; S.seq.t = 0;
        if (S.seq.i >= S.seq.steps.length) { S.seq = null; S.R.set(S.base); } else S.R.set(S.seq.steps[S.seq.i][0]);
      }
    }
    if (S.move && S.base === 'walk' && !S.seq) { S.x += S.want * 46 * dt; if (S.x > W - 50) S.x = 50; if (S.x < 50) S.x = W - 50; }
    S.R.update(dt);
    S.R.root.position.set(S.move ? S.x : W / 2, GY);
  });
  return {
    async load(art, want, timing = {}) {
      S.art = art; S.data = await getRig(art); S.want = want; S.timing = { ...S.timing, ...timing }; S.seq = null; S.x = W / 2;
      S.scale = /^boss/.test(art) ? 2 : 3;
      build();
      return S;
    },
    get scale() { return S.scale; },
    get want() { return S.want; },
    get rig() { return S.data?.rig; },
    setScale(v) { S.scale = v; build(); },
    setLook(look) { S.look = look; build(); },
    setWant(v) { S.want = v; build(); },
    setMove(v) { S.move = v; S.x = W / 2; },
    base(b) { S.base = b; S.seq = null; S.R?.set(b); },
    attack() { const t = S.timing; S.seq = { i: 0, t: 0, steps: [['fore', t.fore], ['hit', 0.16], ['back', t.back]] }; S.R?.set('fore'); },
    hit() { S.seq = { i: 0, t: 0, steps: [['kb', S.timing.kb]] }; S.R?.set('kb'); },
    destroy() { app.destroy(true, { children: true }); },
  };
}

/* ───────── 배경 무대 (+ 재미 요소) ───────── */
const VW = 1260, VH = 540;
const worldNo = (n) => String(n).padStart(2, '0');
let funTex = null;

export async function createBgStage(host) {
  const app = new Application();
  await app.init({ width: VW, height: VH, backgroundColor: 0x120c24, antialias: false, resolution: 1 });
  host.appendChild(app.canvas);
  app.canvas.style.cssText = 'width:100%;height:auto;display:block;border-radius:10px';
  funTex ||= await loadFun();
  const world = new Container(); app.stage.addChild(world);
  const S = { world: 0, cam: 0, bgW: VW, overlay: false, auto: false, fun: null, parts: null, spots: {}, onUsable: null };
  const rebuildFun = () => {
    if (!S.parts) return;
    S.fun = createFun(funTex, { back: S.parts.back, front: S.parts.front, spots: S.spots, getCam: () => S.cam, viewW: () => VW });
    if (!S.auto) S.fun.hush(1e9);
    S.onUsable?.(S.fun.usable);
  };
  app.ticker.add((tk) => S.fun?.update(Math.min(0.05, tk.deltaMS / 1000)));

  function drawOverlay(g, labels) {
    const sp = S.spots, ground = sp.ground || 437;
    const L = (x, y, t, c) => {
      const tx = new Text({ text: t, style: { fontFamily: 'sans-serif', fontSize: 13, fontWeight: '700', fill: c, stroke: { color: 0x000000, width: 3 } } });
      tx.position.set(x + 6, y - 20); labels.addChild(tx);
    };
    if (sp.safe) { g.rect(0, ground - 60, sp.safe[0], 60).fill({ color: 0xff0000, alpha: 0.25 }); g.rect(sp.safe[1], ground - 60, 3000, 60).fill({ color: 0xff0000, alpha: 0.25 }); L(4, ground - 40, '금지(성 앞)', 0xff8888); }
    if (sp.moon) { g.circle(sp.moon.x, sp.moon.y, sp.moon.d / 2).stroke({ width: 3, color: 0xffee00 }); L(sp.moon.x, sp.moon.y - sp.moon.d / 2 + 14, `달 ${sp.moonFace ? '(얼굴 OK)' : '(얼굴 X)'}`, 0xffee00); }
    if (sp.ground) { g.moveTo(0, ground).lineTo(3000, ground).stroke({ width: 2, color: 0x44ff44 }); L(4, ground, '땅 줄', 0x44ff44); }
    for (const x of sp.graves || []) g.circle(x, ground, 6).fill(0x44ff44);
    if (sp.fence) { g.moveTo(sp.fence.x0, sp.fence.y).lineTo(sp.fence.x1, sp.fence.y).stroke({ width: 4, color: 0x44ccff }); L(sp.fence.x0, sp.fence.y, '울타리(고양이)', 0x44ccff); }
    if (sp.owl) { g.circle(sp.owl.x, sp.owl.y, 7).fill(0xffa500); L(sp.owl.x, sp.owl.y, '부엉이', 0xffa500); }
    if (sp.pumpkin) { g.circle(sp.pumpkin.x, sp.pumpkin.y, 7).fill(0xffa500); L(sp.pumpkin.x, sp.pumpkin.y, '호박', 0xffa500); }
    if (sp.window) { g.rect(sp.window.x - 11, sp.window.y - 14, 22, 28).stroke({ width: 3, color: 0xff66cc }); L(sp.window.x, sp.window.y - 14, '창문', 0xff66cc); }
    for (const p of sp.wisps || []) g.circle(p.x, p.y, 6).fill(0x33ddff);
    if (sp.dirtY) { g.moveTo(0, sp.dirtY).lineTo(3000, sp.dirtY).stroke({ width: 2, color: 0xcc8844 }); L(4, sp.dirtY + 18, '흙 띠(두더지)', 0xcc8844); }
    if (sp.sky) { g.rect(2, sp.sky[0], 8, sp.sky[1] - sp.sky[0]).fill(0x99ccff); L(10, sp.sky[0] + 20, '하늘 띠', 0x99ccff); }
  }

  const api = {
    get worldNo() { return S.world; },
    get usable() { return S.fun?.usable || []; },
    get maxCam() { return Math.max(0, Math.round(S.bgW - VW)); },
    /** 월드 번호 → 배경 · 자리표 · 재미 감독을 새로 짠다. 배경 그림이 없으면 false */
    async setWorld(n) {
      for (const c of world.removeChildren()) c.destroy({ children: true });
      S.world = n; S.cam = 0; world.x = 0; S.fun = null; S.parts = null;
      let tex;
      try { tex = await Assets.load(`${A}bg/w${worldNo(n)}_panel.png`); } catch { return false; }
      if (!tex?.width) return false;
      tex.source.scaleMode = 'nearest';
      const bg = new Sprite(tex); const k = VH / tex.height; bg.scale.set(k); world.addChild(bg);
      S.bgW = tex.width * k;
      const back = new Container(), front = new Container(), ov = new Container();
      world.addChild(back, front, ov);
      const g = new Graphics(), labels = new Container(); ov.addChild(g, labels);
      S.spots = SPOTS[n] || {};
      drawOverlay(g, labels);
      ov.visible = S.overlay;
      S.parts = { back, front, ov, hasSpots: !!SPOTS[n] };
      rebuildFun();
      return true;
    },
    hasSpots() { return !!S.parts?.hasSpots; },
    setOverlay(v) { S.overlay = v; if (S.parts) S.parts.ov.visible = v; },
    setCam(x) { S.cam = Math.max(0, Math.min(x, api.maxCam)); world.x = -S.cam; },
    setAuto(v) { S.auto = v; rebuildFun(); },
    trigger(id) { S.fun?.trigger(id); },
    onUsable(fn) { S.onUsable = fn; },
    destroy() { app.destroy(true, { children: true }); },
  };
  return api;
}
