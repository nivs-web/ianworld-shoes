/**
 * 재미있는 요소 (2026-11-11 대표님 확정 17개) — 게임 규칙과 상관없는 눈요기 배경 이벤트.
 *
 * «재미 감독»이 1.0~1.5초마다 하나씩 꺼낸다. 규칙 (기획서 IAN_DRAGON_FUN.md §1):
 *  · 배경 층에만 그린다(두더지만 앞쪽 흙 띠 — 발 줄 아래라 유닛을 가리지 않는다)
 *  · 동시에 최대 3개 · «큰 볼거리»(자전거 · 번개 · 빗자루 둘)는 하나씩만
 *  · 같은 요소 연달아 X · 요소마다 쉬는 시간(cd)
 *  · hush(초) — 보스 등장 · 성 무너짐 · 승패 화면에서 잠깐 멈춘다
 * 그림 = public/assets/iandragon_game/ai/fun/ (제미나이 시트 4장에서 잘라 낸 조각). 번개 · 별똥별 · 실은 코드로 그린다.
 */
import { Assets } from 'pixi.js';

const BASE = '/assets/iandragon_game/ai/fun/';

export { W1_SPOTS, SPOTS } from './funSpots.js';
import { W1_SPOTS } from './funSpots.js';

export async function loadFun() {
  const meta = await (await fetch(BASE + 'fun.json')).json();
  const tex = {};
  await Promise.all(Object.keys(meta.parts).map(async (n) => { tex[n] = await Assets.load(BASE + n + '.png'); tex[n].source.scaleMode = 'nearest'; }));
  return tex;
}

import { sp, rnd } from './funKit.js';
import { bike, wisps, lightning, bats, broom, moonFace, star, spider } from './funSky.js';
import { hand, boo, cat, owl, pumpkin, cross, windowDance, mole } from './funGround.js';

/** [이름, 무게(자주 나오는 정도), 쉬는 시간(초), 큰 볼거리] */
const DEFS = [
  ['bike', bike, 3, 40, true, ['moon']], ['wisps', wisps, 5, 8, false, ['wisps']], ['lightning', lightning, 2, 30, true, ['sky']], ['bats', bats, 5, 7, false, ['moon']],
  ['hand', hand, 4, 10, false, ['graves', 'ground']], ['witch', broom('witch', [0xfff3a0, 0xc9a7ff, 0xffffff]), 2, 35, true, ['sky']],
  ['skelBroom', broom('skel_broom', [0xd8d2c0, 0x9a9488, 0xc9a7ff]), 2, 35, true, ['sky']], ['moon', moonFace, 3, 25, false, ['moon', 'moonFace']],
  ['boo', boo, 4, 9, false, ['graves', 'ground']], ['star', star, 6, 5, false, []], ['cat', cat, 2, 30, false, ['fence']], ['owl', owl, 3, 15, false, ['owl']],
  ['pumpkin', pumpkin, 3, 12, false, ['pumpkin']], ['cross', cross, 3, 28, false, ['ground', 'safe']], ['spider', spider, 2, 25, false, []],
  ['window', windowDance, 2, 30, false, ['window']], ['mole', mole, 3, 20, false, ['dirtY', 'safe']],
].map(([id, make, w, cd, big, needs]) => ({ id, make, w, cd, big, needs }));

/**
 * back : 배경 바로 위 그릇(카메라와 함께 움직인다) · front : 유닛 위 그릇(두더지 전용, 발 줄 아래에만 그린다)
 * getCam() : 지금 카메라 x · viewW() : 화면 너비(월드 칸)
 */
/** 재미 요소 → 겜팀장 재미 소리 id (audio fun() · 기본 꺼짐 — 대표님이 켜실지 고르신다) */
export const FUN_SOUND = { bike: 'bike_bell', wisps: 'firefly', lightning: 'thunder', bats: 'bat', hand: 'grave_hand', witch: 'witch', skelBroom: 'skull_chatter', moon: 'moon_yawn', boo: 'ghost_pop', cat: 'ghost_cat', owl: 'owl', pumpkin: 'cauldron', cross: 'bones', spider: 'chain', window: 'wind', mole: 'grave_creak' };

/** every = { all: 다음 요소까지 간격(초), [요소 id]: 다시 나오기까지(초) } — 운영자 «등장 빈도» (services/switches.js NUMBERS) */
export function createFun(tex, { back, front, spots = W1_SPOTS, getCam, viewW, onStart, every = {} }) {
  const S = spots;
  const owlS = S.owl ? back.addChild(sp(tex.owl, S.owl.x, S.owl.y, 0.5, 1)) : null;
  const pumpS = S.pumpkin ? back.addChild(sp(tex.pumpkin, S.pumpkin.x, S.pumpkin.y, 0.5, 1)) : null;
  const inSafe = (x) => !S.safe || (x >= S.safe[0] && x <= S.safe[1]);
  /** 지금 화면 안 + 안전 범위 안에서 x 하나 (여백 m) */
  const safeX = (m) => { const cam = getCam(), a = Math.max(cam + m, S.safe ? S.safe[0] : -1e9), b = Math.min(cam + viewW() - m, S.safe ? S.safe[1] : 1e9); return a < b ? rnd(a, b) : (a + b) / 2; };
  const E = { tex, back, front, S, cam: getCam, viewW, owl: owlS, pump: pumpS, inSafe, safeX };
  /** 이 월드 자리표로 나올 수 있는 요소만 (자리 규칙) */
  const usable = DEFS.filter((d) => d.needs.every((k) => S[k] != null && S[k] !== false));
  const active = [], rest = {};
  let next = 0.6, hush = 0, last = null, off = new Set();

  const gap = every.all > 0 ? every.all : 1.25;
  function start(d) { rest[d.id] = every[d.id] > 0 ? every[d.id] : d.cd; last = d.id; active.push({ d, t: 0, ev: d.make(E) }); onStart?.(d.id); }
  function choose() {
    if (active.length >= 3) return;
    const bigOn = active.some((a) => a.d.big);
    const pool = usable.filter((d) => !off.has(d.id) && !(rest[d.id] > 0) && d.id !== last && !active.some((a) => a.d.id === d.id) && !(d.big && bigOn));
    if (!pool.length) return;
    let r = Math.random() * pool.reduce((s, d) => s + d.w, 0);
    for (const d of pool) { if ((r -= d.w) <= 0) { start(d); return; } }
  }
  return {
    ids: DEFS.map((d) => d.id),
    /** 이 월드에서 실제로 쓰이는 요소 (자리표가 허락한 것) */
    usable: usable.map((d) => d.id),
    update(dt) {
      hush = Math.max(0, hush - dt);
      for (const k in rest) rest[k] -= dt;
      if ((next -= dt) <= 0) { next = gap * (0.8 + Math.random() * 0.4); if (!hush) choose(); }   // 기본 1.25초 → 1.0~1.5초
      for (let i = active.length - 1; i >= 0; i--) {
        const a = active[i]; a.t += dt;
        if (!a.ev.update(a.t, dt)) { a.ev.destroy(); active.splice(i, 1); }
      }
    },
    /** 잠깐 멈춤(새 요소를 꺼내지 않는다 — 돌던 것은 끝까지) */
    hush(sec) { hush = Math.max(hush, sec); },
    /** 대표님 «이건 빼자» → 이름으로 끄기 */
    setOff(ids) { off = new Set(ids); },
    /** 확인용 — 이름으로 바로 띄우기 */
    trigger(id) { const d = usable.find((q) => q.id === id); if (d) start(d); },
  };
}
