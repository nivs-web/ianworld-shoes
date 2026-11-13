/**
 * 드래곤캐슬 연출 (화면 전용 · 2026-11-13 핵심 보조 ⑤) — 코어가 내보낸 사건 S.ev 만 읽는다. 계산에 손대지 않는다.
 *
 *  'gs' 수호 불꽃 쏨 : 대장 드래곤 입 앞 불꽃(guard_fx_breath) + 날아가는 불덩이(guard_fx_ball · 사건의 t 초 동안 살짝 포물선)
 *  'gh' 수호 불꽃 떨어짐 : 터지는 불(guard_fx_hit 5장)
 *  'cs' · 'ch' 대포 : 지붕에서 포탄(gear_fx_ball · 높은 포물선) → 쾅(gear_fx_boom 4장)
 *  'bell' 경보 종 : 종탑에서 퍼지는 소리 고리(gear_fx_ring 3장)
 * 브레스 색 꾸미기(기본 불꽃 아님)는 흰 그림(guard_fx_w_*) + tint. 색 필터 없음.
 * 물체는 미리 만든 것을 돌려 쓴다(풀) — 종류마다 한 번에 보이는 수 상한, 넘치면 그 연출은 건너뛴다(계산과 무관).
 *
 * createGuardFx({ layer, M, gy, rigs:[왼쪽 리더, 오른쪽 리더], castles:[내 둥지, 오른쪽 탑], breath:[왼쪽 브레스 색 id, 오른쪽], pal:{id:[색…]} })
 *   → { update(S, dt), destroy() }
 */
import { Assets, Container, Sprite } from 'pixi.js';

const AI = '/assets/iandragon_game/ai/castles/';
const nearest = (t) => { if (t) t.source.scaleMode = 'nearest'; return t; };
const load = (n) => Assets.load(`${AI}${n}.webp`).then(nearest).catch(() => null);
const seq = (n, k) => Promise.all(Array.from({ length: k }, (_, i) => load(`${n}_${i + 1}`)));
/** 한 번에 보이는 수 상한 */
const CAP = { ball: 6, hit: 6, mouth: 2, cball: 3, boom: 3, ring: 2 };
/** 입 · 지붕 · 종탑 자리 (리더 발 · 캐슬 밑동 기준, 들판 쪽 = +) */
const MOUTH = { dx: 30, dy: -46 }, ROOF = { dx: 18, dy: 34 }, BELL = { dx: -26, dy: 26 };

export function createGuardFx({ layer, M, gy, rigs = [], castles = [], breath = [], pal = {} }) {
  const box = new Container(); layer.addChild(box);
  const T = {};                                           // 받은 그림 (없으면 그 연출은 건너뜀)
  const want = new Set();
  const need = (k, p) => { if (want.has(k)) return; want.add(k); p.then((v) => { T[k] = v; }); };
  const tintOf = (side) => { const id = breath[side]; return id && id !== 'basic' && pal[id] ? pal[id][0] : null; };
  /* 풀 : 종류마다 Sprite 를 CAP 개 미리 만들어 두고 돌려 쓴다 */
  const pools = {};
  for (const [k, n] of Object.entries(CAP)) pools[k] = Array.from({ length: n }, () => { const s = new Sprite(); s.anchor.set(0.5, 0.5); s.visible = false; box.addChild(s); return { s, on: false }; });
  const take = (k) => { const o = pools[k].find((x) => !x.on); if (!o) return null; o.on = true; o.s.visible = true; o.s.alpha = 1; o.s.rotation = 0; o.s.scale.set(1); o.s.tint = 0xffffff; return o; };
  const free = (o) => { o.on = false; o.s.visible = false; };
  const live = [];                                        // 움직이는 것 { o, kind, t, life, frames, … }
  let seen = 0, started = false, scanT = 1;

  const sideX = (side) => (side ? -1 : 1);
  const mouth = (side) => { const R = rigs[side]?.root, c = castles[side]; if (R) return { x: R.x + sideX(side) * MOUTH.dx, y: R.y + MOUTH.dy }; return c ? { x: c.x, y: c.y - c.height + 20 } : { x: M, y: gy - 120 }; };
  const spot = (side, P) => { const c = castles[side]; return c ? { x: c.x + sideX(side) * P.dx, y: c.y - c.height + P.dy } : { x: M, y: gy - 120 }; };

  /* 그림은 판에 그 장비가 있을 때만 받는다 (판 시작 때 · 혹시 도중에 생기면 첫 사건 때) */
  const ensure = { guard() { need('ball', seq('guard_fx_ball', 4)); need('hit', seq('guard_fx_hit', 5)); need('mouth', seq('guard_fx_breath', 3));
    if ([0, 1].some((s) => tintOf(s) != null)) { need('wball', seq('guard_fx_w_ball', 4)); need('whit', seq('guard_fx_w_hit', 5)); need('wmouth', seq('guard_fx_w_breath', 3)); } },
  cannon() { need('cball', load('gear_fx_ball').then((t) => [t])); need('boom', seq('gear_fx_boom', 4)); }, bell() { need('ring', seq('gear_fx_ring', 3)); } };
  const EV_KIND = { gs: 'guard', gh: 'guard', cs: 'cannon', ch: 'cannon', bell: 'bell' };
  function start(S) {
    started = true;
    if (S.players.some((p) => p.guard)) ensure.guard();
    if (S.players.some((p) => p.cannon)) ensure.cannon();
    if (S.base.some((b) => b.bell)) ensure.bell();
  }
  const frames = (k, side) => { const tn = side != null ? tintOf(side) : null; const f = tn != null && T['w' + k]?.[0] ? T['w' + k] : T[k]; return f && f[0] ? { f, tn } : null; };
  function spawn(kind, pool, side, x, y, life, fps, extra) {
    const F = frames(kind, side); if (!F) return null;
    const o = take(pool); if (!o) return null;
    o.s.texture = F.f[0]; o.s.position.set(x, y); if (F.tn != null) o.s.tint = F.tn; o.s.scale.x = sideX(side ?? 0);
    const it = { o, f: F.f, t: 0, life, fps, ...extra }; live.push(it); return it;
  }

  function onEvent(e) {
    if (EV_KIND[e.k]) ensure[EV_KIND[e.k]]();
    const tx = M + e.x;
    if (e.k === 'gs') {
      const m = mouth(e.side);
      spawn('mouth', 'mouth', e.side, m.x + sideX(e.side) * 8, m.y, 0.24, 12, { stick: e.side });
      spawn('ball', 'ball', e.side, m.x, m.y, e.t, 14, { fly: { x0: m.x, y0: m.y, x1: tx, y1: gy - 14, arc: 26 } });
    } else if (e.k === 'gh') spawn('hit', 'hit', e.side, tx, gy - 22, 0.36, 14);
    else if (e.k === 'cs') { const r = spot(e.side, ROOF); spawn('cball', 'cball', null, r.x, r.y, e.t, 1, { fly: { x0: r.x, y0: r.y, x1: tx, y1: gy - 10, arc: 90 }, spin: 9 }); }
    else if (e.k === 'ch') spawn('boom', 'boom', null, tx, gy - 30, 0.4, 10);
    else if (e.k === 'bell') { const b = spot(e.side, BELL); for (let i = 0; i < 2; i++) spawn('ring', 'ring', null, b.x, b.y - i * 6, 0.9, 8, { grow: true, delay: i * 0.22 }); }
  }

  function update(S, dt) {
    if (!S.ev) return;
    if (!started || (scanT -= dt) < 0) { start(S); scanT = 1; }   // 판 시작 + 1초마다 다시 봄(이미 받은 그림은 다시 안 받음)
    if (S.evN > seen) { for (const e of S.ev) if (e.n > seen) onEvent(e); seen = S.evN; }
    for (let i = live.length - 1; i >= 0; i--) {
      const it = live[i], s = it.o.s;
      if (it.delay > 0) { it.delay -= dt; s.visible = false; continue; }
      s.visible = true; it.t += dt;
      const k = Math.min(1, it.t / it.life);
      s.texture = it.f[Math.min(it.f.length - 1, Math.floor(it.t * it.fps) % (it.fly ? it.f.length : 1e9))];
      if (it.fly) {
        const F = it.fly, x = F.x0 + (F.x1 - F.x0) * k, y = F.y0 + (F.y1 - F.y0) * k - F.arc * 4 * k * (1 - k);
        const dx = (F.x1 - F.x0) / it.life, dy = (F.y1 - F.y0) / it.life - F.arc * 4 * (1 - 2 * k) / it.life;
        s.position.set(x, y);
        s.rotation = it.spin ? s.rotation + it.spin * dt : Math.atan2(dy, Math.abs(dx)) * Math.sign(dx || 1);
      } else if (it.stick != null) { const m = mouth(it.stick); s.position.set(m.x + sideX(it.stick) * 8, m.y); }
      if (it.grow) { s.scale.set(1 + k * 1.6); s.y -= dt * 30; s.alpha = 1 - k * k; }
      if (it.t >= it.life) { free(it.o); live.splice(i, 1); }
    }
  }

  return {
    update,
    destroy() { live.length = 0; box.destroy({ children: true }); },
  };
}
