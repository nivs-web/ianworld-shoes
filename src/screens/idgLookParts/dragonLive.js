/**
 * 꾸미기 창 미리보기 — 살아 있는 드래곤 한 마리 (idgLook.js 에서 옮김 · 내용 그대로)
 * 로비 myDragon · liveRig 와 같은 방법 : rig idle + wear.json 모자 · 목 장식. Pixi 캔버스 하나를 창이 닫힐 때까지 다시 쓴다.
 */
import { dressedCanvas } from '../idgDressed.js';
import { decodeLook } from '../../games/iandragon_game/data/looks.js';
import { loadDecoTex, makeAura, makePet } from '../../games/iandragon_game/render/castleKit.js';

const B = '/assets/iandragon_game/';
export const CW = 360, CH = 300;
const PET_Y = Math.round(CH * 0.66);   // 미리보기 캔버스 속 크기 (CSS 가 칸에 맞춰 늘림 · 도트 그대로)

/**
 * 살아 있는 용 한 마리 (로비 myDragon · liveRig 와 같은 방법 : rig idle + wear.json 모자 · 목 장식) — Pixi 캔버스 하나를 창이 닫힐 때까지 다시 쓴다.
 * WebGL 이 안 되면 꾸민 정지 그림(dressedCanvas)으로.
 */
export function liveDragon(host) {
  let app = null, appP = null, gen = 0, R = null, follow = [], dead = false, fxs = [], pet = null;
  const tick = (tk) => {
    if (!host.isConnected) return;   // 탭을 바꿔 잠깐 빠져 있는 동안은 쉰다 (창이 닫히면 idgLook 이 kill)
    if (R) { R.update(Math.min(0.1, tk.deltaMS / 1000)); for (const [bx, t] of follow) bx.position.copyFrom(t.position); }
    if (pet) pet.y = PET_Y - (Math.floor(performance.now() / 420) % 2) * 3;   // 둥둥 : 3칸 오르내림 (보간 없이)
  };
  function ensureApp(Application) {
    if (!appP) appP = (async () => {
      const a = new Application();
      await a.init({ width: CW, height: CH, backgroundAlpha: 0, antialias: false, resolution: 1, autoDensity: false, preference: 'webgl' });
      a.ticker.maxFPS = 30; a.ticker.add(tick);
      a.canvas.className = 'idg-lk-dragon live'; a.canvas.setAttribute('aria-hidden', 'true');
      app = a; return a;
    })();
    return appP;
  }
  async function build(ld, look) {
    const [{ Application, Assets, Container, Sprite }, { loadRig, createRigged }] = await Promise.all([import('pixi.js'), import('../../games/iandragon_game/render/rig.js')]);
    const [data, Wr] = await Promise.all([loadRig(ld), fetch(`${B}ai/meta/wear.json`).then((r) => r.json()).catch(() => null)]);
    const lk = decodeLook(look || ''), L = Wr?.leaders?.[ld], hk = 'hat_' + lk.hat, nk = 'neck_' + lk.neck;
    const wt = (f) => Assets.load(B + f).then((t) => { t.source.scaleMode = 'nearest'; return t; }).catch(() => null);
    const hatE = lk.hat && Wr?.items?.[hk] && L?.hat?.[hk];
    let rd = data;
    if (hatE?.head) { const tex = { ...data.tex }; for (const [n, f] of Object.entries(hatE.head)) { const t = await wt(f); if (t) tex[n] = t; } rd = { rig: data.rig, tex }; }   // 덮는 모자 = 모자용 머리
    const r = createRigged(rd, 1, 1); r.set('idle');
    const body = r.root.children[0], idx = (n) => data.rig.parts.findIndex((q) => q.n === n);
    const head = body.children[idx('head')], torso = body.children[idx('torso')], fl = [];
    if (hatE && head) { const t = await wt(Wr.items[hk].file); if (t) { const sp = new Sprite(t); sp.position.set(hatE.x, hatE.y); head.addChild(sp); } }
    const it = lk.neck && L && Wr?.items?.[nk];
    if (it && torso) {
      const at = it.layer === 'behind' ? L.nape : L.neck;
      const mk = async (f) => { const t = await wt(f); if (!t) return null; const sp = new Sprite(t); sp.anchor.set(it.anchor[0], it.anchor[1]); sp.position.set(at.x, at.y); return sp; };
      const behind = async (f) => { const sp = await mk(f); if (!sp) return; const bx = new Container(); bx.addChild(sp); body.addChildAt(bx, body.getChildIndex(torso)); fl.push([bx, torso]); };
      if (it.layer === 'split') { const fr = await mk(it.files.front); if (fr) torso.addChild(fr); await behind(it.files.back); } else await behind(it.file);
    }
    r.update(0); for (const [bx, t] of fl) bx.position.copyFrom(t.position);
    /* 크기 : 용마다 키가 달라도 칸에 꼭 맞게 · 발(rig 원점) = 캔버스 아래 가운데 = 석판 위 · 날개를 펄럭여도 안 잘리게 6% 여유 */
    const bd = r.root.getLocalBounds(), up = -bd.y, half = Math.max(-bd.x, bd.x + bd.width), pad = 3;
    const k = Math.min((CH - pad * 2) / up, (CW / 2 - pad) / half) * 0.94;
    r.root.scale.set(k * r.root.scale.x, k * r.root.scale.y); r.root.position.set(CW / 2, CH - pad);
    return { r, fl, Application };
  }
  function still(ld, look, my) {
    dressedCanvas(ld, look, { fit: true, W: CW, H: CH, pad: 3 }).then((c) => {
      if (my !== gen || dead) return;
      c.className = 'idg-lk-dragon still'; c.setAttribute('aria-hidden', 'true');
      host.replaceChildren(c);
    }).catch(() => {});
  }
  async function show(ld, look, fx = {}) {
    const my = ++gen;
    try {
      const [{ r, fl, Application }, tex] = await Promise.all([build(ld, look), fx.aura || fx.pet ? loadDecoTex({ aura: fx.aura, pet: fx.pet, gear: [] }) : null]);
      const a = await ensureApp(Application);
      if (my !== gen || dead) { r.root.destroy({ children: true }); return; }
      if (R) { a.stage.removeChild(R.root); R.root.destroy({ children: true }); }
      for (const o of fxs) { a.stage.removeChild(o); o.destroy(); }
      fxs = []; pet = null;
      /* 오라 = 발밑(용 뒤) · 펫 = 용 옆에 둥둥 — 로비 · 전투와 같은 castleKit 함수 */
      if (tex?.aura) { const o = makeAura(tex.aura, Math.round(CW * 0.5)); o.position.set(CW / 2, CH - 14); a.stage.addChild(o); fxs.push(o); }
      R = r; follow = fl; a.stage.addChild(r.root);
      if (tex?.pet) { pet = makePet(tex.pet, Math.round(CW * 0.2)); pet.position.set(Math.round(CW * 0.82), PET_Y); a.stage.addChild(pet); fxs.push(pet); }
      if (a.canvas.parentNode !== host) host.replaceChildren(a.canvas);
    } catch {
      if (my === gen && !dead) still(ld, look, my);
    }
  }
  function kill() {
    if (dead) return; dead = true; gen++;
    const a = app; app = null; R = null; follow = [];
    if (a) { try { a.destroy(true, { children: true }); } catch { /* */ } }
    else if (appP) appP.then((x) => { try { x.destroy(true, { children: true }); } catch { /* */ } }).catch(() => {});
  }
  return { show, kill };
}
