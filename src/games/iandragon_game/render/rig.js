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
import { Assets, Container, Sprite } from 'pixi.js';

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
  const [TB, TZ] = await Promise.all([id.startsWith('boss') ? rigFixBossTable() : {}, rigFixZombieTable()]);
  for (const B of [TB[id], TZ[id]]) if (B) {
    for (const [n, o] of Object.entries(B.parts || {})) { const q = rig.parts.find((x) => x.n === n); if (q) Object.assign(q, o); }
    if (Array.isArray(B.order)) rig.parts = [...B.order.map((n) => rig.parts.find((p) => p.n === n)).filter(Boolean), ...rig.parts.filter((p) => !B.order.includes(p.n))];
  }
  return files;
}
let bossP = null;
export const rigFixBossTable = () => (bossP ||= fetch(`${BASE}meta/rigfix_boss.json`).then((r) => (r.ok ? r.json() : {})).catch(() => ({})));
let zombP = null;
export const rigFixZombieTable = () => (zombP ||= fetch(`${BASE}meta/rigfix_zombie.json`).then((r) => (r.ok ? r.json() : {})).catch(() => ({})));

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
      const atk = R.state === 'fore' ? Math.min(1, R.st / 0.3) : R.state === 'hit' ? -1 : R.state === 'back' ? Math.max(0, 1 - R.st / 0.4) * -0.6 : 0;
      const kb = R.state === 'kb' ? 1 : 0;
      body.rotation = atk * -0.12 * rig.face + kb * -0.25 * rig.face + (z && walking ? Math.sin(ph * 0.5) * 0.04 : 0);
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
        s.position.set(P.x + dx, P.y + dy);
        s.rotation = rot;
        if (d.breath && R.state === 'hit') s.texture = tex[d.breath];
        else if (d.blink) s.texture = R.blinkT > 0 || kb ? tex[d.blink] : tex[d.n];
      }
    },
  };
  return R;
}
