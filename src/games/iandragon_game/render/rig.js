/**
 * 부품 애니메이션 (그림 공장 · 2026-11-11 대표님 결정 «움직임은 부품 방식»)
 *
 * 그림 AI 가 캐릭터를 부품(머리 · 깜빡 머리 · 몸통 · 팔 · 다리 · 날개 · 꼬리 · 턱)으로 그려 주면,
 * rig.json(부품마다 붙는 자리 · 회전 축)을 따라 조립하고 코드가 움직인다 — 그림을 프레임마다 다시 그리지 않으니
 * 화풍이 흔들리지 않고 API 비용도 캐릭터당 부품 시트 1장이면 된다.
 *
 * 움직임 (움직임 규칙서 v2) : 숨쉬기 · 깜빡임 · 걷기(다리 교차 · 팔 엇박자 · 몸 통통) · 날개 퍼덕 · 꼬리 흔들 ·
 * 좀비 고개 까딱 · 턱 덜렁 · 공격(젖혔다 휘두르기) · 맞음(뒤로 젖힘). 캐릭터마다 위상이 달라 엇박자.
 */
import { Assets, Container, Sprite, Graphics, Texture, Rectangle } from 'pixi.js';
import { texPixels } from './texPix.js';

const BASE = '/assets/iandragon_game/ai/';
/*
 * 11/12 속도 : Pixi 기본은 그림을 워커(CPU 코어 수만큼 · 폰은 보통 8)로 받고 줄을 거꾸로(LIFO) 처리해, 전투 그림 100여 장이 코어 수씩 끊겨 받혔다.
 * 메인 스레드 fetch + createImageBitmap 으로 받으면 브라우저가 한꺼번에 받는다(해독은 그래도 다른 스레드). 받는 그림 · 결과 텍스처는 같다.
 */
Assets.setPreferences({ preferWorkers: false });

/** 캐릭터 하나의 부품 텍스처 + rig 를 받는다 */
/** 부품 자리 보정 (2026-11-11 대표님 «리더 용 날개가 등이 아니라 뒤통수에 붙은 것 같다») — { 캐릭터: { 부품: [x, y] } } */
const RIG_FIX = { novart: { wing: [-10, -47] } };
/*
 * 날개 · 꼬리 자리 표 (11/11 밤 대표님 «노란 용 날개 · 꼬리가 이상하다 · 하나만 말고 전부 · 파란 리더 비율로») — 보조 ai/meta/rigfix.json (43종 · _2 진화형 포함)
 *  { id: { wing: [x, y], tail: [x, y], files?: { wing: 'wing_v2', … } } } — files = 새로 그린 부품 그림 이름 (rig.json · 옛 그림은 R2 1년 캐시라 그대로 두고 새 이름)
 * 전투(loadRig) · 로비 프로필 · 도감(idgDressed · idgCodex)이 같은 표를 쓴다.
 */
let fixP = null;
export const rigFixTable = () => (fixP ||= fetch(`${BASE}meta/rigfix.json`).then((r) => (r.ok ? r.json() : {})).catch(() => ({})));
/** rig 에 자리 보정을 넣고, 부품 그림 이름 바꾸기 표(n → 파일 이름)를 돌려준다 */
export async function applyRigFix(id, rig) {
  const F = { ...(RIG_FIX[id] || {}), ...((await rigFixTable())[id] || {}) }, files = F.files || {};
  for (const [n, pos] of Object.entries(F)) { if (n === 'files' || !Array.isArray(pos)) continue; const q = rig.parts.find((x) => x.n === n); if (q) q.p = pos; }
  /* 보스 조립 보정 (11/12 겜보조 2 · ai/meta/rigfix_boss.json · 규칙 = tools/idg-rigcheck.mjs applyFix)
   *  { id: { order?: [뒤→앞], parts: { 이름: { p?, a?, flip? } } } } — 부품 값 덮어쓰기 → order 로 다시 줄 세움(order 에 없는 부품은 뒤에 원래 순서) */
  /* 일반 좀비 · 용 보정 (11/12 겜보조 · ai/meta/rigfix_zombie.json · 34종) 도 같은 형식 — 순서 : rigfix.json → rigfix_boss → rigfix_zombie (표끼리 같은 키 없음) */
  /* 용 보정 (11/12 대표님 «날개 거꾸로 · 귀 투명 · 눈 · 솜뭉치 · 큰 용은 더 크게» · ai/meta/rigfix_dragon.json · 새 파일) — 같은 형식 + scale(크기 배수) · files(고친 부품 그림 새 이름) */
  const [TB, TZ, TD] = await Promise.all([id.startsWith('boss') ? rigFixBossTable() : {}, rigFixZombieTable(), rigFixDragonTable()]);
  let all = files;
  for (const B of [TB[id], TZ[id], TD[id]]) if (B) {
    for (const [n, o] of Object.entries(B.parts || {})) { const q = rig.parts.find((x) => x.n === n); if (q) Object.assign(q, o); }
    if (Array.isArray(B.order)) rig.parts = [...B.order.map((n) => rig.parts.find((p) => p.n === n)).filter(Boolean), ...rig.parts.filter((p) => !B.order.includes(p.n))];
    if (B.files) all = { ...all, ...B.files };
    if (typeof B.scale === 'number' && B.scale > 0) rig.scale = (rig.scaleBase ??= rig.scale || 1) * B.scale;
  }
  return all;
}
let bossP = null;
export const rigFixBossTable = () => (bossP ||= fetch(`${BASE}meta/rigfix_boss.json`).then((r) => (r.ok ? r.json() : {})).catch(() => ({})));
let zombP = null;
export const rigFixZombieTable = () => (zombP ||= fetch(`${BASE}meta/rigfix_zombie.json`).then((r) => (r.ok ? r.json() : {})).catch(() => ({})));
let dragP = null;
export const rigFixDragonTable = () => (dragP ||= fetch(`${BASE}meta/rigfix_dragon.json`).then((r) => (r.ok ? r.json() : {})).catch(() => ({})));

/*
 * rig.json 은 캐릭터마다 한 번만 받는다 (11/12 속도 — 로비 프로필 · 도감 · 전투가 같은 rig 를 몇 번씩 받았다).
 * applyRigFix 는 같은 값을 다시 넣을 뿐이라 여러 번 불러도 안전하다. 실패하면 기억을 지워 다음에 다시 받는다.
 */
const rigJsonP = new Map();
export function rigJson(id) {
  if (!rigJsonP.has(id)) {
    const p = fetch(`${BASE}${id}/rig.json`).then((r) => r.json());
    p.catch(() => rigJsonP.delete(id));
    rigJsonP.set(id, p);
  }
  return rigJsonP.get(id);
}

const rigP = new Map();
export function loadRig(id) {
  if (!rigP.has(id)) {
    const p = loadRigNow(id);
    p.catch(() => rigP.delete(id));
    rigP.set(id, p);
  }
  return rigP.get(id);
}
async function loadRigNow(id) {
  /* rig.json 과 자리 보정 표(rigfix.json)를 동시에 받는다 (예전엔 rig → 표 → 부품 그림 세 번 기다렸다) */
  const [rig] = await Promise.all([rigJson(id), rigFixTable()]);
  const files = await applyRigFix(id, rig);   // 자리 보정 (R2 1년 캐시라 rig.json 대신 여기서)
  const names = new Set(rig.parts.flatMap((p) => [p.n, p.blink, p.breath].filter(Boolean)));
  const tex = {};
  await Promise.all([...names].map(async (n) => { tex[n] = await Assets.load(`${BASE}${id}/${files[n] || n}.png`); tex[n].source.scaleMode = 'nearest'; }));
  return { rig, tex };
}

/*
 * 으르렁 입 벌리기 (11/12 대표님 «진짜 으르렁 — 용들이 입을 제일 크게 벌리고 포효») : 일반 용은 턱 부품 · 벌린 입 그림이 없다.
 * 머리 그림을 입 줄에서 세 조각으로 나눠(같은 그림의 일부 = 화풍 그대로) 위턱은 뒤로 젖히고 아래턱은 내린다 — 사이로 도트 입속(혀 · 이빨).
 * 입 줄 = 주둥이 끝 열들의 위 · 아래 끝 사이 60% (알파를 읽어 캐릭터마다 잼) · 경첩 = 머리 폭의 42% 지점. 못 읽으면 머리만 젖힌다.
 */
function buildJaw(P, face) {
  const T = P.s.texture, px = texPixels(T); if (!px) return null;
  const { w, h, d } = px, A = (x, y) => d[(y * w + x) * 4 + 3] > 40;
  let x0 = w, x1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (A(x, y)) { if (x < x0) x0 = x; if (x > x1) x1 = x; }
  if (x1 - x0 < 8) return null;
  const f = face >= 0 ? 1 : -1, span = x1 - x0 + 1, n = Math.max(2, Math.round(span * 0.18));
  let st = 0, sb = 0, c = 0;
  for (let i = 0; i < n; i++) {
    const x = f > 0 ? x1 - i : x0 + i; let top = -1, bot = -1;
    for (let y = 0; y < h; y++) if (A(x, y)) { if (top < 0) top = y; bot = y; }
    if (top >= 0) { st += top; sb += bot; c++; }
  }
  if (!c) return null;
  const cut = Math.max(Math.round(h * 0.45), Math.min(h - 3, Math.round(st / c + (sb / c - st / c) * 0.72)));
  const hx = Math.round(f > 0 ? x0 + span * 0.34 : x1 - span * 0.34);
  let fx = f > 0 ? x1 : x0;   /* 입 줄 위 주둥이 끝 */
  for (let i = 0; i < span; i++) { const x = f > 0 ? x1 - i : x0 + i; if (A(x, cut) || A(x, cut - 1)) { fx = x + (f > 0 ? 1 : 0); break; } }
  const sub = (x, y, ww, hh) => new Texture({ source: T.source, frame: new Rectangle(T.frame.x + x, T.frame.y + y, Math.max(1, ww), Math.max(1, hh)) });
  const box = new Container(), inner = new Container(); box.addChild(inner);
  inner.position.set(-P.s.anchor.x * w, -P.s.anchor.y * h);
  const mouth = new Graphics();
  const upper = new Container(); upper.pivot.set(hx, cut); upper.position.set(hx, cut); upper.addChild(new Sprite(sub(0, 0, w, cut)));
  const jaw = new Container(); jaw.pivot.set(hx, cut); jaw.position.set(hx, cut);
  const jx = f > 0 ? hx : 0, jw = f > 0 ? w - hx : hx, bx = f > 0 ? 0 : hx, bw = f > 0 ? hx : w - hx;
  const js = new Sprite(sub(jx, cut, jw, h - cut)); js.position.set(jx, cut); jaw.addChild(js);
  const back = new Sprite(sub(bx, cut, bw, h - cut)); back.position.set(bx, cut);
  inner.addChild(mouth, back, jaw, upper);
  P.s.parent.addChildAt(box, P.s.parent.getChildIndex(P.s) + 1);
  box.visible = false;
  return { box, mouth, upper, jaw, hx, cut, dx: fx - hx, f };
}
/** 턱 벌림 k(0~1) : 위턱 젖힘 · 아래턱 내림 · 입속(짙은 빨강) · 혀 · 이빨 (도트 네모) */
function openJaw(J, k) {
  const au = -0.26 * k * J.f, aj = 0.5 * k * J.f, L = J.dx;
  J.upper.rotation = au; J.jaw.rotation = aj;
  const P = (s, a) => [J.hx + L * s * Math.cos(a), J.cut + L * s * Math.sin(a)];
  const g = J.mouth.clear();
  if (k < 0.08) return;
  const [ux, uy] = P(0.92, au), [jx, jy] = P(0.92, aj);
  g.poly([J.hx, J.cut, ux, uy, jx, jy]).fill(0x2a1238);                                                   /* 외곽선 (오락실 테두리 색) */
  g.poly([...P(0.12, (au + aj) / 2), ...P(0.86, au * 0.86), ...P(0.86, aj * 0.88)]).fill(0x5a0a1c);      /* 목구멍 */
  g.poly([...P(0.3, aj * 0.7), ...P(0.82, aj * 0.74), ...P(0.78, aj * 0.9), ...P(0.34, aj * 0.92)]).fill(0xd8506a);   /* 혀 */
  if (k > 0.3) for (const s of [0.5, 0.66, 0.82]) {   /* 이빨 (위 셋 · 아래 둘) */
    const [tx, ty] = P(s, au * 0.92); g.rect(Math.round(tx) - 1, Math.round(ty), 2, s > 0.8 ? 3 : 2).fill(0xffffff);
    if (s > 0.6) { const [bx2, by2] = P(s, aj * 0.92); g.rect(Math.round(bx2) - 1, Math.round(by2) - 2, 2, 2).fill(0xffffff); }
  }
}
/** 으르렁 자세의 벌림 정도 (R.st 초) : 0.15초 젖히며 벌림 → 1.0초까지 최대 · 떨림 → 0.2초에 다뭄 */
export const ROAR_TIME = 1.2;
export const roarOpen = (st) => (st < 0.15 ? st / 0.15 : st < 1.0 ? 1 : Math.max(0, 1 - (st - 1.0) / 0.2));

/** want : 화면에서 바라볼 방향 (+1 오른쪽 = 용 · -1 왼쪽 = 좀비). 그림 방향과 다르면 통째로 뒤집는다 */
export function createRigged({ rig, tex }, scale = 1, want = rig.face) {
  const root = new Container();
  const body = new Container(); root.addChild(body);
  const parts = rig.parts.map((d) => {
    const s = new Sprite(tex[d.n]);
    s.anchor.set(d.a[0], d.a[1]);
    s.position.set(d.p[0], d.p[1]);
    if (d.flip) s.scale.x = -1;
    body.addChild(s);
    return { d, s, x: d.p[0], y: d.p[1] };
  });
  root.scale.set(scale * (rig.scale || 1) * (want === rig.face ? 1 : -1), scale * (rig.scale || 1));
  const headP = parts.find((P) => P.d.move === 'head');
  let jawJ;   // undefined = 아직 안 만듦 · null = 못 만듦(머리만 젖힘)
  const R = {
    root, state: 'walk', t: Math.random() * 10, st: 0,
    blinkAt: 1 + Math.random() * 3, blinkT: 0, speed: 1,
    set(st) { if (st !== R.state) { R.state = st; R.st = 0; } },
    update(dt) {
      R.t += dt; R.st += dt;
      const z = rig.kind === 'zombie', t = R.t;
      const walking = R.state === 'walk', ph = t * (z ? 5.5 : 8) * R.speed;
      const step = walking ? Math.sin(ph) : 0;
      const bob = walking ? Math.abs(Math.sin(ph)) * (z ? 1.5 : 2.5) : Math.sin(t * 2.4) * 0.8;   // 걷기 통통 · 쉬기 숨쉬기
      /* 'jump' = 폴짝 (고개 듦 · 날개 위로 퍼덕 · 다리 접음) · 'fire' = 브레스 뿜기 (입 크게 · 몸 살짝 앞으로) — 기획 13.1 «내려와서 뿜는 브레스» (skillFx) */
      const jump = R.state === 'jump', fire = R.state === 'fire';
      const atk = R.state === 'fore' ? Math.min(1, R.st / 0.3) : R.state === 'hit' ? -1 : fire ? -0.5 : R.state === 'back' ? Math.max(0, 1 - R.st / 0.4) * -0.6 : 0;
      const kb = R.state === 'kb' ? 1 : 0;
      const roar = R.state === 'roar', rk = roar ? roarOpen(R.st) : fire && headP && !headP.d.breath ? 1 : 0, rq = rk > 0.95 ? Math.sin(t * 70) * 0.025 : 0;   // 으르렁 : 뒤로 젖힘 + 떨림 (벌린 입 그림이 없는 용은 뿜을 때도 턱을 나눠 벌림)
      body.rotation = atk * -0.12 * rig.face + kb * -0.25 * rig.face + (z && walking ? Math.sin(ph * 0.5) * 0.04 : 0) - rk * 0.2 * rig.face + rq;
      body.x = (atk < 0 ? -atk * 5 : -atk * 2) * rig.face;
      if (R.blinkT > 0) R.blinkT -= dt;
      else if ((R.blinkAt -= dt) <= 0) { R.blinkT = 0.13; R.blinkAt = 2 + Math.random() * 3; }
      for (const P of parts) {
        const { d, s } = P;
        let rot = 0, dy = 0, dx = 0;
        switch (d.move) {
          case 'body': dy = -bob; break;
          case 'head': dy = -bob * 1.15 - (walking ? 0 : Math.sin(t * 2.4 - 0.6) * 0.5); rot = z ? (walking ? Math.sin(ph * 0.5 + 1) * 0.14 + (Math.sin(t * 7.3) > 0.97 ? 0.2 : 0) : Math.sin(t * 1.3) * 0.08) : Math.sin(t * 2.4) * 0.04; rot += atk * 0.15 * rig.face - kb * 0.3 * rig.face; break;
          case 'jaw': dy = -bob * 1.15 + (walking ? Math.max(0, Math.sin(ph * 0.5)) * 2 : 0) + (atk < 0 ? 3 : 0); rot = (walking ? Math.sin(ph) * 0.1 : 0) - (atk < 0 ? 0.4 : 0) * rig.face; break;
          case 'hair': dy = -bob * 1.2; rot = Math.sin(t * 6) * 0.15; break;
          case 'legF': rot = step * 0.45; dy = 0; break;
          case 'legB': rot = -step * 0.45; break;
          case 'armF': dy = -bob; rot = z ? Math.sin(ph * 0.9) * 0.18 * rig.face - (atk < 0 ? 0.6 : atk * -0.4) * rig.face : -step * 0.5 + atk * 0.9 - (atk < 0 ? 0.9 : 0); break;
          case 'armB': dy = -bob; rot = z ? Math.sin(ph * 0.9 + 1.7) * 0.18 * rig.face : step * 0.5; break;
          case 'wing': dy = -bob; rot = Math.sin(t * (walking ? 14 : 4)) * (walking ? 0.35 : 0.12) - 0.1; break;
          case 'tail': dy = -bob * 0.5; rot = Math.sin(t * 3 + 1) * 0.18 - step * 0.1; break;
        }
        if (rk) {   /* 으르렁 : 머리 젖힘 · 턱 내림 · 팔 들고 · 꼬리 치켜듦 */
          if (d.move === 'head') rot -= 0.42 * rk * rig.face;
          else if (d.move === 'jaw') rot += 0.6 * rk * rig.face;
          else if (d.move === 'armF' || d.move === 'armB') rot -= 0.7 * rk * rig.face;
          else if (d.move === 'tail') rot -= 0.3 * rk * rig.face;
          else if (d.move === 'wing') rot -= 0.25 * rk;
        }
        if (jump) {   /* 폴짝 : 고개 들고 · 날개 위로 빠르게 퍼덕 · 다리 접고 · 꼬리 치켜듦 */
          if (d.move === 'head') rot -= 0.28 * rig.face;
          else if (d.move === 'wing') rot = -0.55 + Math.sin(t * 34) * 0.35;
          else if (d.move === 'legF') rot = -0.55 * rig.face;
          else if (d.move === 'legB') rot = 0.45 * rig.face;
          else if (d.move === 'tail') rot -= 0.35 * rig.face;
        } else if (fire) {   /* 뿜기 : 날개 활짝 · 꼬리 치켜듦 */
          if (d.move === 'wing') rot = -0.45 + Math.sin(t * 22) * 0.08;
          else if (d.move === 'tail') rot -= 0.3 * rig.face;
        }
        s.position.set(P.x + dx, P.y + dy);
        s.rotation = rot;
        if (d.breath && (R.state === 'hit' || fire || rk > 0.3)) s.texture = tex[d.breath];
        else if (d.blink) s.texture = (R.blinkT > 0 || kb) && !rk ? tex[d.blink] : tex[d.n];
      }
      /* 벌린 입 그림이 없는 머리(일반 용) : 머리 그림을 나눠 턱을 벌린다 */
      if (headP && !headP.d.breath && rig.kind === 'dragon') {
        if (rk > 0 && jawJ === undefined) jawJ = buildJaw(headP, rig.face);
        if (jawJ) {
          const on = rk > 0;
          jawJ.box.visible = on; headP.s.renderable = !on;
          if (on) { jawJ.box.position.copyFrom(headP.s.position); jawJ.box.rotation = headP.s.rotation; jawJ.box.scale.copyFrom(headP.s.scale); openJaw(jawJ, rk); }
        }
      }
    },
    /** 입 자리 (전역 좌표) — 브레스 불기둥이 나가는 곳. 머리 그림의 주둥이 쪽 86% · 위에서 62% (벌린 입 그림 6종을 보고 잼) */
    mouth() {
      if (!headP || headP.s.destroyed) return null;
      const s = headP.s, T = s.texture, right = (rig.face >= 0) !== !!headP.d.flip;
      return s.toGlobal({ x: ((right ? 0.86 : 0.14) - s.anchor.x) * T.width, y: (0.62 - s.anchor.y) * T.height });
    },
  };
  return R;
}
