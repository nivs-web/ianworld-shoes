/**
 * 드래곤캐슬 한 채를 작은 Pixi 캔버스에 (겜보조 2 · 11/13) — 꾸미기 미리보기 · 로비 «드래곤캐슬 보기»가 같이 쓴다.
 *  그림 · 지붕 · 성문 · 앞마당 · 장비 · 깃발은 전투와 같은 castleKit 함수 하나(깃발 높이 = 캐슬 높이의 60% · 오른쪽 밑동).
 *  캐슬 밑동 가운데 = 캔버스 아래 가운데. 캔버스 하나를 닫힐 때까지 다시 쓰고, 바꿔 그릴 때는 올린 물체만 지운다(그림은 캐시).
 *  show(decoOf(저장값) 모양) — { skin, roof, gate, yard, flag, gear:[{id,lv}] }. 안 가진 것은 호출하는 쪽이 이미 걸러서 넘긴다.
 */
import { Application, Container, Sprite } from 'pixi.js';
import { img, keepBase, anchorsOf, loadDecoTex, buildDeco, makeFlag, wave } from './castleKit.js';

export function liveCastle(host, { W = 420, H = 330, cls = 'idg-castle-live' } = {}) {
  let app = null, appP = null, gen = 0, dead = false, world = null, cloths = [];
  const tick = () => {
    if (!host.isConnected) return;   // 탭을 바꿔 잠깐 빠져 있는 동안은 쉰다 (치우는 건 부른 쪽이 kill)
    for (const c of cloths) wave(c);
  };
  function ensureApp() {
    if (!appP) appP = (async () => {
      const a = new Application();
      await a.init({ width: W, height: H, backgroundAlpha: 0, antialias: false, resolution: 1, autoDensity: false, preference: 'webgl' });
      a.ticker.maxFPS = 30; a.ticker.add(tick);
      a.canvas.className = cls; a.canvas.setAttribute('aria-hidden', 'true');
      app = a; return a;
    })();
    return appP;
  }
  async function show(d) {
    const my = ++gen;
    const [A, tex, body] = await Promise.all([anchorsOf(d.skin), loadDecoTex(d), img(keepBase(d.skin, 'hp0'))]);
    const a = await ensureApp();
    if (my !== gen || dead || !body) return;
    const w = new Container(), sp = new Sprite(body), fl = [];
    sp.anchor.set(0.5, 1); sp.scale.set(A.k); w.addChild(sp);
    const D = buildDeco(A, d, tex);
    w.addChild(D.front, D.top);
    if (tex.flag) { const f = makeFlag(tex.flag, A.h, { dir: 1 }); f.box.position.set(Math.round(A.w / 2) + 2, 0); w.addChild(f.box); fl.push(f.cloth); }
    /* 칸에 꼭 맞게 : 높이는 캐슬 + 깃대 꼭지 · 너비는 앞마당(왼쪽) ~ 깃발(오른쪽) 약 1.5배 — 줄이기만 하고 늘리지 않는다(도트 그대로) */
    const s = Math.min(1, (H - 8) / (A.h + 6), (W - 8) / (A.w * 1.5));
    w.scale.set(s); w.position.set(Math.round(W / 2), H - 3);
    if (world) { a.stage.removeChild(world); world.destroy({ children: true }); }
    world = w; cloths = fl; a.stage.addChild(w);
    if (a.canvas.parentNode !== host) host.replaceChildren(a.canvas);
  }
  function kill() {
    if (dead) return; dead = true; gen++;
    const a = app; app = null; world = null; cloths = [];
    if (a) { try { a.destroy(true, { children: true }); } catch { /* */ } }
    else if (appP) appP.then((x) => { try { x.destroy(true, { children: true }); } catch { /* */ } }).catch(() => {});
  }
  return { show, kill };
}
