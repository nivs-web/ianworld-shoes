/**
 * 전투 화면 그리기 (B2 · 2026-11-11 야간) — 전투 코어 상태 S 를 읽어서 그리기만 한다. 계산에 손대지 않는다(기획서 15.3).
 *
 * 1칸 = 1wu. 코어 x=0(내 기지) → 화면 x=M, 코어 x=L(좀비 탑) → M+L. 전장 너비 FIELD = M + L + M.
 * 배경은 540 높이로 맞추고, 전장이 더 길면 좌우로 뒤집은 복사본을 이어 붙인다(이음새가 보이지 않게).
 * 유닛 = 부품 캐릭터(rig.js). 코어 상태 walk · fore · back · kb → 그림 상태 walk · fore · hit(0.12초) · back · kb.
 * 연출(맞음 번쩍 · 불꽃 · 쓰러짐 별가루 · 기지 흔들림/금 · 브레스 불줄기 · 보스 충격파 · 승리 때 탑 무너짐)은 전부 화면 전용.
 */
import { Assets, AnimatedSprite, Container, Sprite, Graphics, ColorMatrixFilter } from 'pixi.js';
import { loadRig, createRigged } from './rig.js';
import { loadFun, createFun, FUN_SOUND } from './fun.js';
import * as Audio from '../audio/index.js';
import { offKeys, isOn, nums } from '../../../services/switches.js';
import { SPOTS } from './funSpots.js';
import { px } from './rot.js';
import { createAmbient } from './ambient.js';
import { createBossFx } from './bossFx.js';
import { createSkillFx } from './skillFx.js';
import { BREATH_COLORS } from '../data/looks.js';
import { lightsFor, fxFrames, makeBreath, tileMirror } from './living.js';
import { lanesFor, laneY } from './lanes.js';

const AI = '/assets/iandragon_game/ai/';
/** 예전 한 줄 땅 높이 (11/12 부터 전투는 월드마다 lanes.js — 발 높이 spawnY · 성 밑동 castleY). 밖에서 쓰는 곳을 위해 남겨 둠 */
export const GY = 440;
export const M = 170;
/** 코어 id → 그림 id (이름이 다른 것만) */
const ART = { chubby: 'cone', shield: 'helmet', bossFat: 'bossGiant', shieldFirm: 'helmet', lavaFirm: 'lava', gearFirm: 'gear', shroomFirm: 'shroom' };   // *Firm = 초고수 굳센 좀비(원본 그림 그대로)
const artOf = (id) => ART[id] || id;
const nearest = (t) => { t.source.scaleMode = 'nearest'; return t; };
const tryLoad = (url) => Assets.load(url).then(nearest).catch(() => null);

export async function createBattleView(ctx, { world, L, dragons, enemies, leader = 'novart', pvp = false, mirror = false, foeLeader = null, look = {}, lookR = {} }) {   // look = 왼쪽(0번 편) · lookR = 오른쪽(대결 상대)
  const { app, view } = ctx;
  const FIELD = M + L + M;
  /* ── 그림 받기 */
  const ids = [...new Set([...dragons.flatMap((d) => (d.lv >= 10 ? [d.id, d.id + '_2'] : [d.id])), ...enemies.map(artOf), leader, ...(foeLeader ? [foeLeader] : []), 'kkomul', 'walker'])];
  const rigs = {};
  const wN = String(world).padStart(2, '0');
  /* 배경 : 살아 있는 두 겹(하늘 · 앞)이 있으면 그것, 없으면 예전 통그림 (2026-11-11 대표님 «배경이 밋밋하다» → 갤러리 확정안 연결) */
  /* WebP 먼저 (11/11 밤 «로딩이 엄청 느려졌다» — 배경 · 성 PNG 33MB → WebP 9MB · 하늘 한 장 1.1MB → 0.14MB · tools/idg-webp-bg.mjs), 없으면 PNG */
  const img = (base) => tryLoad(`${base}.webp`).then((t) => t || tryLoad(`${base}.png`));
  const towerImg = (n) => (wN === '01' ? img(`${AI}castles/tower_${n}`) : img(`${AI}castles/tower_w${wN}_${n}`).then((t) => t || img(`${AI}castles/tower_${n}`)));
  /* 드래곤캐슬(둥지) = 꼭대기 빨간 해골 깃발 · 깃대를 지운 _noflag 그림 (11/13 대표님 «깃발이 왜 2개야» — 깃발은 캐슬 앞 땅 깃발 하나만 · tools/_nest-noflag.py) · 못 받으면(R2 올리기 전) 원래 그림 */
  const nestImg = (n) => img(`${AI}castles/nest_${n}_noflag`).then((t) => t || img(`${AI}castles/nest_${n}`));
  /*
   * 11/12 속도 : 서로 기다릴 필요 없는 것은 한꺼번에 받기 시작한다. 예전엔 캐릭터 → 배경 → 성 → 체력 바 → 운석 → 횃불 → 꾸미기 → 상태 아이콘을
   * 하나씩 기다려(차례 12번) R2 첫 방문 때 전투가 뜨기까지 오래 걸렸다. 받는 그림 · 쓰는 자리 · 없을 때 대신하는 방법은 그대로.
   */
  const rigsP = Promise.all(ids.map((id) => loadRig(id).then((r) => { rigs[id] = r; }).catch(() => {})));
  /* 앞 겹 = lanes.json 의 그 월드 front (1 · 3 · 6 · 10 = 다시 그린 _v3 · 11/12 대표님 확정) — 못 받으면 원래 wNN_front */
  const lanesP = lanesFor(world);
  const layersP = Promise.all([img(`${AI}bg/layers/w${wN}_sky`), lanesP.then((ln) => img(`${AI}bg/layers/${ln.front.replace(/\.(png|webp)$/, '')}`)).then((t) => t || img(`${AI}bg/layers/w${wN}_front`))]);
  const nestP = nestImg('hp0'), towerP = towerImg('hp0');
  const eggP = Promise.all(['egg_rare', 'egg_super'].map((n) => tryLoad(`${AI}eggs/${n}.png`)));   /* 둥지에서 품는 알 = 부화장 알 그림 재사용 (아래 brood) */
  const hpP = Promise.all([...['hp_unit_frame', 'hp_unit_fill_me', 'hp_unit_fill_foe', 'hp_castle_frame', 'hp_castle_fill'].map((n) => tryLoad(`${AI}hud/${n}.png`)), fetch(`${AI}hud/hp_bars.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null)]);
  const fxP = Promise.all([tryLoad(`${AI}fx/meteor.png`), fxFrames('boom').catch(() => null)]);
  const torchP = fxFrames('fire_orange').catch(() => null);
  const WEARP = fetch('/assets/iandragon_game/ai/meta/wear.json').then((r) => r.json()).catch(() => null);
  const ST = ['weaken', 'revive', 'shield', 'noknock', 'poison', 'purify'];
  const stP = Promise.all(ST.map(async (k) => [k, await tryLoad(`/assets/iandragon_game/ui/hud_st_${k}_xs.png`)]));
  /* 꾸미기 그림(깃발 · 모자 · 모자용 머리 · 목 장식)도 미리 받아 둔다 — 아래 wearRig · dress 가 같은 주소를 부르면 이미 받은 것을 쓴다 */
  const prefetchLook = (art, lk) => {
    if (!lk) return;
    tryLoad(`${AI}meta/flag_${lk.flag || 'pumpkin'}.png`);   /* 안 달았으면 호박 깃발 (dress) */
    WEARP.then((W) => {
      const Lw = W?.leaders?.[art]; if (!Lw) return;
      const hk = 'hat_' + lk.hat, nk = 'neck_' + lk.neck, it = lk.neck && W.items?.[nk], fs = [];
      if (lk.hat && W.items?.[hk] && Lw.hat?.[hk]) fs.push(W.items[hk].file, ...Object.values(Lw.hat[hk].head || {}));
      if (it) fs.push(it.file, it.files?.front, it.files?.back);
      for (const f of fs) if (typeof f === 'string' && f) tryLoad('/assets/iandragon_game/' + f);
    });
  };
  prefetchLook(leader, look);
  if (pvp && foeLeader) prefetchLook(foeLeader, lookR);
  await rigsP;
  const [skyTex, frontTex] = await layersP;
  const layered = !!(skyTex && frontTex);
  /*
   * 땅 (11/12 · 예전 한 줄 GY 440 대신 월드마다) : S0~S1 = 발 높이 범위 · CY = 성 밑동 · GC = 가운데(땅 효과 기준 · 예전 GY 자리).
   * 발 높이는 화면 전용(코어는 x 만) · 유닛 id 해시라 멀티 · 다시 보기에서도 같은 자리 (lanes.js).
   */
  const LN = await lanesP;
  const [S0, S1] = LN.spawnY, CY = LN.castleY, GC = Math.round((S0 + S1) / 2);
  /* 캐슬 그리는 자리 (11/13 대표님 «캐슬이 공중에 떠 있다») : 둥지 그림은 밑에 빈 줄이 15칸 있어 castleY 에 두면 땅에서 떠 보였다 → 맵마다 lanes.json nestY · towerY
   * (그림 앵커 = 밑 가운데 · 없으면 castleY · 대결은 오른쪽도 둥지라 nestY). 그리기 전용 — 코어 거리 · 판정 · 땅 깃발(S0) 은 그대로. 횃불 · 리더 · 알 · 무너짐이 같이 따라간다 */
  const NY = LN.nestY ?? CY, TY = pvp ? NY : LN.towerY ?? CY;
  /* 싸움 줄은 늘 단추 줄 위 (11/12 대표님 «어떤 월드 · 확대 · 가로 · 세로에서도 단추에 캐릭터가 가려지지 않게») : 가장 아래 발(S1 + 보스 6칸)을 화면 맞춤(app.js footFit)에 알린다
   * → 넘치면 캔버스를 올리고, 그래도 모자라면 view.lift 칸만큼 전장을 올려 그린다(아래 camera · underBox). 그리기 전용 — 코어는 x 만 쓴다. */
  ctx.setFoot?.(S1 + 6);
  /* 들어 올리기에 상한이 걸리면(app.js LIFT_MAX) 남은 view.squeeze 칸만큼 세 줄 범위 아래쪽을 위로 눌러 담는다 : [S0, S1+6] → [S0, S1+6−squeeze] (위 끝 · 순서 그대로) */
  const laneMap = (y) => { const q = Math.min(view.squeeze || 0, S1 - S0); if (!q || y <= S0) return y; const lo = S1 + 6; return S0 + (y - S0) * (lo - q - S0) / (lo - S0); };
  const [bgTex, nestT, towerT] = await Promise.all([
    layered ? null : tryLoad(`${AI}bg/w${wN}_panel.png`).then((t) => t || tryLoad(`${AI}bg/w01_panel.png`)),
    nestP.then((t) => [t, null, null, null]),   /* 성은 멀쩡한 그림만 먼저 · 부서진 그림(hp1~3)은 전투가 뜬 뒤 뒤에서 */
    towerP.then((t) => [t, null, null, null]),
  ]);
  const funP = loadFun().catch(() => null);   /* 재미 요소 그림(약 0.4MB)은 기다리지 않는다 — 전투가 뜬 뒤 오면 그때부터 (11/11 밤 속도) */
  setTimeout(() => { for (const i of [1, 2, 3]) { nestImg(`hp${i}`).then((t) => { nestT[i] = t; if (pvp) towerT[i] = t; }); if (!pvp) towerImg(`hp${i}`).then((t) => { towerT[i] = t; }); } }, 800);

  /* 체력 바 도트 그림 (그림 담당 hp_bars.json · 2026-11-11 대표님 «생명 게이지가 도트가 아니다») — 없으면 예전 막대 */
  const [hpUF, hpUMe, hpUFoe, hpCF, hpCFill, hpMeta] = await hpP;
  const hpArt = !!(hpUF && hpUMe && hpUFoe && hpMeta);
  /* 운석 · 폭발 그림 (그림 담당 ai/fx/meteor · boom — 없으면 입자로) */
  const [meteorT, boomFx] = await fxP;
  /* 무너지는 중간 그림 (보조 11/11 : fall0 기울어짐 · fall1 무너지는 중) · 도트 연기 6종 */
  /*
   * 판이 끝날 때만 쓰는 무너짐 그림(기울어짐 · 무너지는 중 · 잔해 · 먼지 띠 · 연기 약 2MB)은 전투를 띄운 뒤 뒤에서 받는다
   * (11/11 밤 대표님 «로딩이 엄청 느려졌다» — 전투 시작 전에 다 받느라 늦었다). 오기 전에 판이 끝나면 hp3 · 그림 연기 없이 진행.
   */
  let towerFallT = [], nestFallT = [], smokeT = [], towerRubT = null, nestRubT = null, crumbleFx = null;
  const torchFx = await torchP;
  setTimeout(() => {
    Promise.all([
      Promise.all([0, 1].map((i) => towerImg(`fall${i}`))),
      Promise.all([0, 1].map((i) => nestImg(`fall${i}`))),
      Promise.all([0, 1, 2, 3, 4, 5].map((i) => tryLoad(`${AI}fx/smoke_${i}.png`))).then((a) => a.filter(Boolean)),
      towerImg('rubble'), img(`${AI}castles/nest_rubble`), fxFrames('crumble').catch(() => null),
    ]).then(([a, b2, c, d, e, f]) => { towerFallT = a; nestFallT = b2; smokeT = c; towerRubT = d; nestRubT = e; crumbleFx = f; }).catch(() => {});
  }, 1500);
  /** 도트 체력 바 하나 : 테두리 + 채움(왼쪽 맞춤 · 비율만큼 가로로 줄임). W = 화면 너비 */
  function makeBar(frameT, fillT, m, W) {
    const c = new Container(), k = W / m.frame[0];
    const fr = new Sprite(frameT); fr.scale.set(k); fr.x = -W / 2;
    const fl = new Sprite(fillT); fl.position.set(-W / 2 + m.fill.x * k, m.fill.y * k);
    c.addChild(fr, fl);   // 테두리 안쪽 홈이 칠해져 있어 채움을 위에
    c.set = (f) => { fl.scale.set((m.fill.w * k * Math.max(0, Math.min(1, f))) / fillT.width, (m.fill.h * k) / fillT.height); };
    c.set(1); return c;
  }

  if (pvp) towerT.splice(0, 4, ...nestT);   // 대결 : 양쪽 다 용 둥지
  /* ── 층 : 배경 · 재미(뒤) · 성 · 유닛 · 효과 · 재미(앞) */
  const root = new Container(); app.stage.addChild(root);
  const bgBox = new Container(), funBack = new Container(), stage = new Container(), units = new Container(), fx = new Container(), funFront = new Container();
  units.sortableChildren = true;
  root.addChild(bgBox, funBack, stage, funFront);
  const skyBox = new Container(), funSky = new Container(), frontBox = new Container();   // 하늘 겹은 카메라의 0.35배 (아래 update 에서 skyBox.x)
  /* 앞 겹 아래 끝(540) 밑 = 앞 겹을 위아래로 뒤집어 이어 그림 (전장을 lift 칸 올렸을 때 카드 사이로 빈 곳이 보이지 않게 · 540 에서 이음새 없이 맞닿음) */
  const underBox = new Container(); underBox.scale.y = -1; underBox.y = 540 * 2; underBox.visible = false;
  bgBox.addChild(skyBox, frontBox, underBox);
  let living = null;
  if (layered) {
    tileMirror(skyBox, skyTex, FIELD); skyBox.addChild(funSky);
    const fw = tileMirror(frontBox, frontTex, FIELD);
    tileMirror(underBox, frontTex, FIELD);
    lightsFor(world).then(async (LB) => {
      if (!LB || root.destroyed) return;
      const fx0 = LB.front?.fire ? await fxFrames(LB.front.fire).catch(() => null) : null;
      if (root.destroyed) return;
      living = [LB.sky && makeBreath(skyBox, LB.sky, null, fw), LB.front && makeBreath(frontBox, LB.front, fx0, fw)].filter(Boolean);
      skyBox.addChild(funSky);   // 달 얼굴 · 자전거 · 박쥐는 숨결 위
    });
  } else if (bgTex) { tileMirror(frontBox, bgTex, FIELD); tileMirror(underBox, bgTex, FIELD); }
  const nest = new Sprite(nestT[0]); nest.anchor.set(0.5, 1); nest.position.set(M - 40, NY);
  const tower = new Sprite(towerT[0]); tower.anchor.set(0.5, 1); tower.position.set(M + L + 40, TY); if (pvp) tower.scale.x = -1;
  stage.addChild(nest, tower, units, fx);
  const torches = [];
  if (torchFx && !pvp) for (const lx of [28, 177]) { const a = new AnimatedSprite(torchFx.frames); a.anchor.set(0.5, 1); a.scale.set(0.62); a.animationSpeed = (torchFx.meta.fps / 60) * (0.9 + Math.random() * 0.2); a.gotoAndPlay((Math.random() * torchFx.frames.length) | 0); a.position.set(nest.x - nest.width / 2 + lx, NY - nest.height + 197); stage.addChildAt(a, stage.getChildIndex(nest) + 1); torches.push(a); }
  const castleBars = [];   /* 성 체력 게이지는 HUD 위 숫자 옆으로 옮김 (11/11 · 떠 있는 HUD) — 성 위 캔버스 바는 쓰지 않음 */
  const shade = new Graphics().rect(-50, -50, FIELD + 100, 700).fill(0x000000); shade.alpha = 0; root.addChild(shade);
  /* 안개 기믹 : 내 맨 앞 + 260칸 너머를 짙은 안개로 (화면 전용) */
  const fog = new Graphics(); root.addChildAt(fog, root.getChildIndex(funFront));
  const flashG = new Graphics(); flashG.blendMode = 'add'; root.addChild(flashG); let flashT = 0, flashC = 0xffffff;   // 포효 · 스킬 번쩍

  /* ── 재미있는 요소 (자리표가 없는 월드는 하늘 요소만) */
  const spots = { ...(SPOTS[world] || { sky: [50, 200], ground: 437, dirtY: 494 }) };
  if (layered && world === 1) spots.moon = { x: 779, y: 112, d: 222 };
  if (layered && world === 1) spots.fence = { x0: 1010, x1: 1250, y: 398 };   /* 대표님 11/11 «고양이가 공중에» : 앞 겹 울타리 실제 자리 (그림 픽셀로 잼) */
  if (layered && world === 1) spots.owl = { x: 300, y: 136 };   /* 확대하면 윗가지 부엉이가 위 HUD 글씨와 겹친다 → 아래 굵은 가지로 */   // 월드 1 하늘 겹은 다시 편집돼 달 자리가 통그림과 다르다 (그림 픽셀로 잼)
  /*
   * 앉는 재미 요소 자리 (11/11 대표님 «첫판부터 부엉이가 엉뚱한 곳») : 두 겹 배경의 앞 겹 그림에서 발밑 실제 윗면을 픽셀로 잼 (tools/_owl-layer.mjs).
   * 월드 1 부엉이는 두 가지 사이 빈 곳(y 136)에 떠 있었다 → 아래 굵은 가지 윗면 159. 가지가 없거나(월드 7 부엉이) 울타리가 울퉁불퉁하면(월드 6 · 7 고양이) 끈다 (D2).
   */
  if (layered) {
    const OWL_Y = { 1: 159, 2: 199, 3: 183, 4: 217, 5: 180, 6: 207, 8: 235, 9: 256, 10: 158 }, FENCE_Y = { 1: 386, 2: 335, 3: 390, 4: 351, 5: 324, 8: 306, 9: 378, 10: 368 };
    if (spots.owl) { if (OWL_Y[world]) spots.owl = { ...spots.owl, y: OWL_Y[world] }; else delete spots.owl; }
    if (spots.fence) { if (FENCE_Y[world]) spots.fence = { ...spots.fence, y: FENCE_Y[world] }; else delete spots.fence; }
  }
  if (layered) spots.ground = S0 - 3;   /* 땅에서 나오는 재미(손 · 유령) = 발 높이 범위 바로 뒤 (월드 1 · 7 은 예전 437 그대로 · 2 · 4 처럼 바닥이 높은 월드는 그 바닥 위) */
  if (layered) delete spots.window;   /* 대표님 3차 «좀비 성 근처 갈색 네모 안 검은 사람» = 먼 성 창문 춤 — 두 겹 배경은 먼 성 자리가 달라 허공에 떴다 → 자리를 다시 잴 때까지 끔 */
  spots.safe = [260, FIELD - 260];
  if (spots.sky) spots.sky = [Math.max(spots.sky[0], 78), Math.max(spots.sky[1], 160)];   /* 확대해도 하늘 요소가 화면 위에 잘리지 않게 (위 HUD 아래부터) */
  const skyBase = spots.sky ? [...spots.sky] : null;   /* 싸움 줄을 올리면(app.js footFit) 하늘이 더 잘린다 → 그만큼 하늘 요소 높이도 내린다 (아래 camera · 예전 기준 = 위 33칸 잘림 + HUD 45칸) */
  let camX = 0, viewW = view.w;
  const funStub = { update() {}, hush() {}, ids: [], usable: [], trigger() {}, setOff() {} };
  let fun = funStub;
  const makeFun = (funTex) => createFun(funTex, { back: funBack, sky: layered ? funSky : null, front: funFront, spots, getCam: () => camX, viewW: () => viewW, onStart: (id) => FUN_SOUND[id] && isOn('zdFunSound', id) && Audio.fun(FUN_SOUND[id]), every: nums('zdFunEvery') });
  funP.then((t) => { if (!t || root.destroyed) return; fun = makeFun(t); fun.setOff(offKeys('zdFun')); if (import.meta.env.DEV) window.__idgFun = fun; });   // 운영자가 끈 재미 요소 (관리자 화면) · 미리보기 점검용 __idgFun
  Audio.setFun(offKeys('zdFunSound').length < 17);   // 재미 소리 — 하나라도 켜져 있으면 소리 장치를 연다(켜진 것만 난다)
  const amb = createAmbient(funBack, world, () => camX, () => viewW);   // 월드 분위기 입자 (불티 · 눈 · 구름 · 불꽃)

  /* ── 리더 (내 기지 위) */
  /* 덮는 모자(cover) : 그 대장 용의 머리 텍스처(head · blink · breath)를 뿔 · 볏을 지운 그림으로 바꿔 끼운다 (보조 3차 · 대표님 «모자가 이마를 덮고 뿔이 뚫으면 안 됨») · WEARP = 위에서 미리 받기 시작 */
  async function wearRig(data, art, lk) {
    if (!data || !lk?.hat) return data;
    const e = (await WEARP)?.leaders?.[art]?.hat?.['hat_' + lk.hat];
    if (!e?.head) return data;
    const tex = { ...data.tex };
    for (const [n, file] of Object.entries(e.head)) { const t = await tryLoad('/assets/iandragon_game/' + file); if (t) tex[n] = t; }
    return { rig: data.rig, tex };
  }
  const ldRig = await wearRig(rigs[leader] || null, leader, look);
  const LEAD_K = 0.74;   /* 리더 용을 일반 용 크기로 (대표님 «둥지 위 용이 너무 크다») */
  const lead = ldRig ? createRigged(ldRig, LEAD_K, 1) : null;
  const lead2 = pvp && foeLeader && rigs[foeLeader] ? createRigged(await wearRig(rigs[foeLeader], foeLeader, lookR), LEAD_K, -1) : null;   // 대결 : 오른쪽 둥지 위 상대 리더
  /* 리더 발 = 둥지 그림 위에서 66px (짚 가운데 · 대표님 11/11 «둥지와 용을 조금 아래로») — 대결 상대도 같은 자리(좌우 대칭) */
  const LEAD_FEET = 66;
  if (lead2) { lead2.set('idle'); lead2.root.position.set(tower.x - 4, TY - tower.height + LEAD_FEET); stage.addChildAt(lead2.root, stage.getChildIndex(units)); }
  /* 꾸미기 (META 2장) : 대장 용 머리 위 모자 · 목 장식 + 성 꼭대기 깃발 — 그림은 보조 ai/meta/*, 없으면 안 붙인다 */
  /* 착용 부품 (보조 2차 · 대표님 «상점 아이콘과 용이 쓴 모습은 달라야») — ai/meta/wear/ 옆모습 부품을 head · torso 부품에 붙인다.
     좌표 = ai/meta/wear.json (tools/idg-wear-fit.mjs 가 대장 용마다 계산) · 예시 tools/idg-gallery/viewer.js attachWear */
  async function wear(R, art, lk) {
    const body = R?.root.children[0], data = rigs[art], W = await WEARP, L = W?.leaders?.[art];
    if (!body || !data || !L) return;
    const idx = (n) => data.rig.parts.findIndex((p) => p.n === n);
    const torso = body.children[idx('torso')], head = body.children[idx('head')];
    const wt = (file) => tryLoad('/assets/iandragon_game/' + file);
    const hk = 'hat_' + lk.hat, nk = 'neck_' + lk.neck;   // 표 열쇠 = 그림 이름
    if (lk.hat && W.items[hk] && L.hat?.[hk] && head) { const t = await wt(W.items[hk].file); if (t && !head.destroyed) { const sp = new Sprite(t); sp.position.set(L.hat[hk].x, L.hat[hk].y); head.addChild(sp); } }
    const it = lk.neck && W.items[nk];
    if (it && torso) {
      const at = it.layer === 'behind' ? L.nape : L.neck;
      const mk = async (file) => { const t = await wt(file); if (!t) return null; const sp = new Sprite(t); sp.anchor.set(it.anchor[0], it.anchor[1]); sp.position.set(at.x, at.y); return sp; };
      const behind = async (file) => { const sp = await mk(file); if (!sp || torso.destroyed || torso.parent !== body) return; const box = new Container(); box.addChild(sp); body.addChildAt(box, body.getChildIndex(torso)); box.position.copyFrom(torso.position); follow.push([box, torso]); };
      if (it.layer === 'split') { const fr = await mk(it.files.front); if (fr && !torso.destroyed) torso.addChild(fr); await behind(it.files.back); }
      else await behind(it.file);
    }
  }
  async function dress(rig, lk, castle, art) {
    /* 안 달았으면 호박 깃발 (11/12 대표님 «성 오른쪽 깃발이 안 보인다» — 로비 무대 idgLobbyFun 과 같은 규칙 · 대결 상대도) · 장착 깃발 그림을 못 받으면 호박으로 */
    const flagT = castle ? (lk?.flag && (await tryLoad(`${AI}meta/flag_${lk.flag}.png`))) || (await tryLoad(`${AI}meta/flag_pumpkin.png`)) : null;
    if (rig) await wear(rig, art, lk);
    if (flagT && castle) groundFlag(castle, flagT);
  }
  const flags = [], follow = [], flagBox = [];   // follow = 몸통 뒤 층 장식이 torso 를 따라가게 [상자, torso] · flagBox[편] = 땅 깃발 (진 편은 기운다)
  /* 깃발 위 끝 최소 높이 (11/12 대표님 «깃발은 게임에서도 가리더니») : 떠 있는 HUD 의 위 체력 막대가 폰 가로 · PC 에서 땅 y 약 105 까지 덮는다 */
  const FLAG_TOP = 112;
  /*
   * 깃발 = 성 앞 땅에 꽂는다 (11/12 대표님 «깃발이 몸통(대장 용)에 가려지면 안 된다 · 성 아래 땅, 좀비가 오는 쪽에»). 성 꼭대기 · 리더 머리 위 깃발은
   * 리더 몸 · 위 체력 막대와 계속 다퉜다. 깃대 밑동 = 그 월드 발 높이 범위 맨 뒤(lanes spawnY[0]) — 세 줄 유닛은 늘 깃발 앞을 지나가고,
   * 천은 밑동 위 FLAG_H 라 서 있는 보통 유닛 머리보다 높다. 내 성 = 성 오른쪽 · 천은 들판 쪽으로 펄럭 / 대결 상대 성 = 좌우 대칭.
   * FLAG_SIDE -1 = 성 왼쪽 안(비교용 · 화면 왼쪽 끝 · 왼쪽 화로와 겹쳐 오른쪽을 기본으로).
   */
  const FLAG_SIDE = 1, FLAG_H = 150, FLAG_W = 44, FLAG_HH = 64;
  function groundFlag(castle, flagT) {
    const me = castle === nest, out = me ? 1 : -1;   // out = 그 성에서 들판 쪽
    const dx = FLAG_SIDE > 0 ? 108 : -84, dir = FLAG_SIDE > 0 ? out : -out;   // 깃대 자리 · 천 방향 (오른쪽 안 : 오른쪽 화로 바로 바깥 — 세로 화면에서도 천이 다 보이게 · 왼쪽 안 : 성 왼쪽 기둥 앞, 천은 바깥으로)
    const baseY = S0 + 1, h = Math.min(FLAG_H, baseY - FLAG_TOP - 8);
    const box = new Container(); box.position.set(Math.round(castle.x + out * dx), baseY);
    const pole = new Graphics()
      .rect(-5, -2, 10, 3).fill(0x3a2a1e)                                   /* 꽂힌 자리 흙 */
      .rect(-2, -h, 4, h).fill(0x3a2410).rect(-1, -h, 2, h).fill(0x6a4424)  /* 깃대 */
      .rect(-3, -h - 5, 6, 6).fill(0x5a3a10).rect(-2, -h - 4, 4, 4).fill(0xe0b040);   /* 꼭지 */
    const f = new Sprite(flagT); f.anchor.set(0, 0); f.width = FLAG_W; f.height = FLAG_HH; if (dir < 0) f.scale.x *= -1; f.position.set(dir * 2, -h + 2);
    box.addChild(pole, f); stage.addChildAt(box, stage.getChildIndex(units)); flags.push(f); flagBox[me ? 0 : 1] = box;
  }
  await Promise.all([dress(lead, look, nest, leader), dress(lead2, lookR, pvp ? tower : null, foeLeader)]);
  if (lead) { lead.set('idle'); lead.root.position.set(nest.x + 4, NY - nest.height + LEAD_FEET); stage.addChildAt(lead.root, stage.getChildIndex(units)); lead.baseY = lead.root.y; }
  if (lead2) lead2.baseY = lead2.root.y;
  /*
   * 알 품기 (11/12 대표님 «알을 품고 있는 느낌이 전혀 없다» · 오래 반복) : 둥지 그림 속 알(작다)이 리더 몸에 다 가렸다.
   * 부화장 알 그림(ai/eggs)을 더 크게 둥지에 올리고 층을 둥지 → 뒤 알 2개 → 리더 → 앞 알 → 둥지 앞 짚 순서로 :
   * 뒤 알 윗부분이 용 배 아래 · 다리 사이 · 몸 양옆으로 보이고, 앞 알은 둥지 가장자리로 삐져나온다. 용 발 · 알 밑은 짚 속에 묻힌다.
   * 앞 짚 = 같은 둥지 그림을 짚 띠만 잘라(가림) 같은 자리에 한 번 더 — 성이 맞아 금 가는 그림(hp1~3) · 흔들림 · 깜박임을 그대로 따라간다.
   * 좌표 = 둥지 그림(212×300) 픽셀 · 대결 오른쪽 둥지는 좌우 뒤집힘.
   */
  const eggT = await eggP, broods = [];
  const EGG_BACK = [[0, 104, 72, 38], [1, 127, 75, 32]], EGG_FRONT = [[0, 83, 80, 32]], LIP = [64, 63, 80, 24];   // [그림, 가운데 x, 밑 y, 높이] · 짚 띠 [x, y, 너비, 높이] (hp0 그림 픽셀)
  /* 금 간 둥지 그림(hp1 · hp2 · hp3 · 기울어짐 fall0)은 크기가 달라 짚 자리가 옮겨 간다 (hp0 짚 조각을 맞춰 잼) — 알 · 앞 짚 · 리더가 함께 따라간다 */
  const NEST_OFF = [[0, 0], [6, 5], [8, 0], [12, 20]], FALL0_OFF = [44, 24];
  function brood(castle, R) {
    if (!R || !eggT[0] || !castle.texture) return;
    const tw = castle.texture.width, th = castle.texture.height, at = (x, y) => [x - tw / 2, y - th];   // hp0 그림 픽셀 → 성 자리(가운데 · 밑) 기준
    const egg = ([i, x, y, h]) => { const t = eggT[i] || eggT[0], e = new Sprite(t); e.anchor.set(0.5, 1); e.scale.set(h / t.height); e.position.set(...at(x, y)); return e; };
    const back = new Container(), front = new Container(), eggsB = new Container(), eggsF = new Container();
    back.scale.x = front.scale.x = castle.scale.x;
    for (const q of EGG_BACK) eggsB.addChild(egg(q));
    for (const q of EGG_FRONT) eggsF.addChild(egg(q));
    const lip = new Sprite(castle.texture); lip.anchor.set(0.5, 1);
    const mask = new Graphics().rect(...at(LIP[0], LIP[1]), LIP[2], LIP[3]).fill(0xffffff); lip.mask = mask;
    back.addChild(eggsB); front.addChild(eggsF, lip, mask);
    stage.addChildAt(back, stage.getChildIndex(R.root)); stage.addChildAt(front, stage.getChildIndex(R.root) + 1);
    back.position.set(castle.x, castle.y); front.position.copyFrom(back.position);
    broods.push({ c: castle, R, back, front, lip, move: [eggsB, eggsF, mask], T: castle === nest ? nestT : towerT, off: [0, 0] });
  }
  /** 매 장면 : 성 흔들림 · 금 간 그림 · 깜박임을 따라간다 (리더는 흔들리지 않고 짚 자리만 따라감 · 대결 승리 깡충은 그대로) */
  function broodUpdate() {
    for (const b of broods) {
      const on = b.R.root.visible, tex = b.c.texture, k = b.T.indexOf(tex);
      const o = k >= 0 ? NEST_OFF[k] : b.c === nest && tex === nestFallT[0] ? FALL0_OFF : b.off;
      if (o !== b.off) {
        const sx = Math.sign(b.c.scale.x) || 1, dx = (o[0] - b.off[0]) * sx, dy = o[1] - b.off[1];
        if (b.R.dive) { b.R.dive.hx += dx; b.R.dive.hy += dy; } else { b.R.root.x += dx; b.R.root.y += dy; }   /* 브레스로 내려가 있으면 돌아올 자리만 옮김 (skillFx) */
        if (b.R.baseY != null) b.R.baseY += dy;
        for (const m of b.move) m.position.set(o[0], o[1]);
        b.off = o;
      }
      for (const c of [b.back, b.front]) { c.visible = on; c.position.set(b.c.x, b.c.y); }
      b.lip.texture = tex; b.lip.tint = b.c.tint;
    }
  }
  brood(nest, lead); brood(tower, lead2);

  const white = new ColorMatrixFilter();
  white.matrix = [0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0];
  const V = new Map();      // 코어 유닛 id → 그림
  const parts = [];         // 작은 효과 조각 { g, vx, vy, life, t, grav }
  const shakes = { nest: 0, tower: 0, screen: 0 };
  const seen = { breath: 0, bossAt: null, baseHp: [null, null], over: false };
  let breathFx = 0, overT = 0, bSide = 0, bP = null, bBS = null;
  const mets = [];   // 떨어지는 운석들
  seen.by = [];
  const bx = (x) => (bSide ? FIELD - x : x);
  const rangeG = new Graphics(); stage.addChildAt(rangeG, stage.getChildIndex(units));   /* 브레스 사거리 바닥 표시 */   // 오른쪽 편 브레스는 좌우 반대로
  /* 리더마다 다른 브레스 (화면 전용) : 색 · 위로/아래로 · 크기 · 특수(번개 줄기 · 햇살 기둥) */
  const BREATH = {
    novart: { c: [0xff7a1a, 0xffd04a], vy: -40, g: 0, r: 6 },
    aquantis: { c: [0x4fc3ff, 0xbff0ff, 0xffffff], vy: -90, g: 380, r: 5 },
    forestia: { c: [0x6bd64a, 0xb8f07a, 0x2f8f3a], vy: -20, g: 30, r: 5, spin: true },
    crimsonde: { c: [0xff3a1a, 0xff8a2a, 0xffe08a], vy: -170, g: 0, r: 8 },
    volttail: { c: [0xfff35a, 0xc08bff], vy: -10, g: 0, r: 4, bolt: true },
    solaris: { c: [0xfff6c0, 0xffd84a], vy: -20, g: 0, r: 5, ray: true },
  };
  const BS = BREATH[leader] || BREATH.novart;
  const bossFx = createBossFx({ layer: app.stage, fx, M, GY: GC, band: [S0 - 10, S1 + 8], view, artOf: (def) => artOf(def._art), shake: (t) => { shakes.screen = Math.max(shakes.screen, t); } });   // 보스 컷인 · 큰 공격 경고 (bossFx.js)
  /* 필살기 연출 (11/12 대표님 «화면을 확 감싸는 압도적인 연출») — 이름 도장 · 얼음 · 돌풍 · 으르렁 · 브레스 더하기 (skillFx.js · 화면 전용) */
  const sfx = createSkillFx({ app, fx, view, M, FIELD, GC, S1, mirror, getCam: () => camX, shake: (t) => { shakes.screen = Math.max(shakes.screen, t); }, torchFx, leaders: () => [lead, lead2], stage, units, castles: () => [nest, tower], flagTop: S0 + 1 - Math.min(FLAG_H, S0 + 1 - FLAG_TOP - 8) - 5 });   // stage · units · castles = 브레스 때 대장 드래곤이 캐슬 앞으로 내려와 커지는 자리 · 층 (기획 13.1) · flagTop = 땅 깃발 꼭지 y (커진 키 상한 · 11/13 대표님 «1층 = 깃발 높이까지만»)

  /* 상태 아이콘 : 약해짐(보라) > 되살아날 유령 > 방패 > 안 밀림 > 독 공격 > 정화 공격 */
  const stTex = Object.fromEntries(await stP);   // ST · stP = 위에서 미리 받기 시작
  Audio.preloadSfx?.();   /* 좀비 소리 파일은 로비가 아니라 여기서 (전투 그림을 다 받은 뒤 · 11/12 속도) */
  const badges = new Container(); stage.addChild(badges);
  const stOf = (u) => (u.weakT > 0 ? 'weaken' : u.def.revive && !u.revived ? 'revive' : u.barrier > 0 ? 'shield' : u.def.kbImmune ? 'noknock' : u.def.poison ? 'poison' : u.def.purify ? 'purify' : null);
  const rigFor = (u) => {
    const art = u.def._art;
    if (u.side === 0 || pvp) { const lv = dragons.find((d) => d.id === art)?.lv || 1; return (lv >= 10 && rigs[art + '_2']) || rigs[art] || rigs.kkomul; }
    return rigs[artOf(art)] || rigs.walker;
  };
  function puff(x, y, color, n = 6, spd = 80, life = 0.4, r = 2) {
    for (let i = 0; i < n; i++) {
      const g = new Graphics().circle(0, 0, r).fill(color); g.position.set(x, y); g.blendMode = 'add'; fx.addChild(g);
      const a = Math.random() * Math.PI * 2;
      parts.push({ g, vx: Math.cos(a) * spd * (0.5 + Math.random()), vy: Math.sin(a) * spd * (0.5 + Math.random()) - 30, life, t: 0, grav: 120 });
    }
  }
  function shot(from, to, color, area) {
    const g = new Graphics().circle(0, 0, 3).fill(color).circle(0, 0, 6).fill({ color, alpha: 0.3 }); g.blendMode = 'add'; fx.addChild(g);
    parts.push({ g, x0: from.x, y0: from.y, x1: to.x, y1: to.y, life: 0.22, t: 0, shot: true, color, area });
  }

  function syncUnits(S, dt) {
    const alive = new Set();
    for (const u of S.units) {
      alive.add(u.id);
      let v = V.get(u.id);
      if (!v) {
        /* 대표님 11/11 «센 보스(고깔 대장 등)가 너무 작다 · 보스가 땅 위에 떠 있다» : 보통 좀비가 보스로 나오면 1.45배 · 보스는 발 밑 빈칸(그림 4px)만큼 내려 땅에 딛게 */
        const mid = u.boss && !u.def.boss;
        const R = createRigged(rigFor(u), mid ? 1.45 : 1, u.side === 0 ? 1 : -1);
        R.speed = u.side === 0 ? 1.1 : 0.9;
        /* 발 높이 (11/12 대표님 «냥코처럼 위아래로 퍼져 나오게») : 그 월드 spawnY 사이 고르게 · 걷는 동안 그대로 · 아래(y 큼)일수록 앞(zIndex) · 판정은 코어가 x 만 */
        v = { R, x: M + u.x, hp: u.hp, st: u.state, hitT: 0, flash: 0, kbT: 0, y0: laneY(u.id, world, LN.spawnY) + (u.boss ? 6 : 0), dieT: -1 };
        v.y = laneMap(v.y0);
        R.root.position.set(v.x, v.y); R.root.zIndex = v.y0 + (u.boss ? -20 : 0); units.addChild(R.root); V.set(u.id, v);
        v.h = Math.min(220, R.root.height || 60);
      }
      v.y = Math.round(laneMap(v.y0));   // 화면 맞춤이 바뀌면(확대 · 회전) 눌러 담기도 따라감
      if (!v.flee && !v.hold) v.x += (M + u.x - v.x) * Math.min(1, dt * 18);   // 도망치는 좀비는 코어 위치를 안 따름 · 으르렁 중인 용은 그 자리에 멈춰 섬(끝나면 따라잡음)
      const R = v.R, o = sfx.unit(u, v, dt);   // 필살기 연출 : 얼음 껍질 · 휘청 · 움찔 · 불탐 · 으르렁 자세
      if (u.hp < v.hp) { api.hits++; api.bigHit = v.hp - u.hp > u.maxHp * 0.25; v.flash = 0.08; if (u.hp > 0) puff(v.x, v.y - 30, u.side ? 0xfff0a0 : 0xffffff, 4, 60, 0.25, 1.6); }
      v.hp = u.hp;
      if (u.state !== v.st) {
        if (u.state === 'back' && v.st === 'fore') { v.hitT = 0.12; if ((u.def.range || 0) > 100) aim(u, v); }
        if (u.state === 'kb') v.kbT = 0;
        v.st = u.state;
      }
      const st = u.state === 'back' && v.hitT > 0 ? 'hit' : u.state;
      R.set(o.pose || st); v.hitT -= dt;
      const frozen = u.freezeT > 0, buried = u.burrowT > 0 || u.burrowed, corpse = u.corpseT > 0;
      R.root.tint = o.tint ?? (frozen ? 0x9fe8ff : u.weakT > 0 ? 0xc9a0ff : 0xffffff);
      if (!frozen && !corpse) R.update(dt * (u.slowT > 0 ? 0.5 : 1));
      let dy = 0;
      if (u.state === 'kb') { v.kbT += dt; dy = -Math.sin(Math.min(1, v.kbT / 0.35) * Math.PI) * (u.boss ? 6 : 14); }
      R.root.alpha = buried ? 0 : corpse ? 0.5 : 1;
      R.root.rotation = corpse ? (u.side ? -1.3 : 1.3) : o.rot;
      R.root.position.set(Math.round(v.x + o.dx), Math.round(v.y + dy + o.dy));
      v.flash -= dt; R.root.filters = v.flash > 0 ? [white] : null;
      if (u.hp < u.maxHp && v.flash > 0) v.barT = 1.5;
      if ((v.barT = (v.barT || 0) - dt) > 0 && u.alive && !buried) {   // 체력바 : 맞으면 잠깐
        const w = u.boss ? 72 : 38, f = Math.max(0, u.hp / u.maxHp), mine = u.side === (mirror ? 1 : 0);
        if (!v.bar) { v.bar = hpArt ? makeBar(hpUF, mine ? hpUMe : hpUFoe, hpMeta.unit, w) : new Graphics(); badges.addChild(v.bar); }
        if (hpArt) v.bar.set(f);
        else v.bar.clear().rect(-w / 2, 0, w, 4).fill({ color: 0x000000, alpha: 0.6 }).rect(-w / 2, 0, w * f, 4).fill(mine ? 0x6bdc6b : 0xff5a4a);
        v.bar.visible = true; v.bar.alpha = Math.min(1, v.barT * 2); v.bar.position.set(Math.round(v.x), Math.round(v.y + dy - (v.h || 60) - 4));
      } else if (v.bar) v.bar.visible = false;
      const sk = u.alive && !buried ? stOf(u) : null, tx = sk && stTex[sk];
      if (tx) {
        if (!v.badge) { v.badge = new Sprite(tx); v.badge.anchor.set(0.5, 1); v.badge.width = v.badge.height = 20; badges.addChild(v.badge); }
        if (v.badge.texture !== tx) { v.badge.texture = tx; v.badge.width = v.badge.height = 20; }
        v.badge.visible = true; v.badge.alpha = corpse ? 0.6 : 0.95; v.badge.position.set(Math.round(v.x), Math.round(v.y + dy - v.h - 10));
      } else if (v.badge) v.badge.visible = false;
    }
    for (const [id, v] of V) {
      if (alive.has(id) && v.dieT < 0) continue;
      if (v.dieT < 0) { v.dieT = 0; v.ash = sfx.die(v); if (!v.ash) puff(v.x, v.y - 30, 0xfff6c0, 10, 110, 0.5, 2); }   /* 브레스에 쓰러지면 재 더미 (skillFx) */
      if (v.badge) v.badge.visible = false;
      if (v.bar) v.bar.visible = false;
      v.dieT += dt;
      if (v.ash) {   /* 브레스에 쓰러짐 : 깜짝 → 불탐 → 무너져 재 더미 (skillFx corpse · 투명 페이드 없음) — 끝나면 몸을 지운다 */
        if (sfx.corpse(v, dt)) { v.R.root.destroy({ children: true }); v.badge?.destroy(); v.bar?.destroy(); V.delete(id); }
        continue;
      }
      v.R.root.alpha = Math.max(0, 1 - v.dieT / 0.35); v.R.root.y = v.y - v.dieT * 30;
      if (v.dieT > 0.35) { v.R.root.destroy({ children: true }); v.badge?.destroy(); v.bar?.destroy(); V.delete(id); }
    }
  }
  /** 원거리 : 가장 가까운 상대에게 불덩이 / 침을 날린다 (그림 전용) */
  function aim(u, v) {
    let best = null, bd = 1e9;
    for (const q of lastS.units) { if (q.side === u.side || !q.alive) continue; const d = Math.abs(q.x - u.x); if (d < bd) { bd = d; best = q; } }
    const tx = best ? M + best.x : v.x + (u.side ? -1 : 1) * Math.min(u.def.range, 300);
    shot({ x: v.x + (u.side ? -14 : 14), y: v.y - 40 }, { x: tx, y: v.y - 30 }, u.side ? 0x9cff6a : 0xffa040, !!u.def.area);
  }
  let lastS = { units: [] };

  function bases(S, dt) {
    for (const side of [0, 1]) {
      if (S.over && !pvp && S.over.winner >= 0 && side === 1 - S.over.winner && colMask) continue;   /* 무너지는 중 · 잔해 : collapse() 가 맡는다 */
      const b = S.base[side], prev = seen.baseHp[side];
      if (prev != null && b.hp < prev) { shakes[side ? 'tower' : 'nest'] = 0.18; shakes.screen = Math.max(shakes.screen, 0.1); }
      seen.baseHp[side] = b.hp;
      const r = b.maxHp ? b.hp / b.maxHp : 1, i = r > 0.75 ? 0 : r > 0.5 ? 1 : r > 0.25 ? 2 : 3;
      const spr = side ? tower : nest, T = side ? towerT : nestT;
      if (T[i]) spr.texture = T[i];
      const key = side ? 'tower' : 'nest'; shakes[key] -= dt;
      spr.x = (side ? M + L + 40 : M - 40) + (shakes[key] > 0 ? (Math.random() * 4 - 2) : 0);
      const cb = castleBars[side]; if (cb) { cb.set(r); cb.position.set(side ? M + L + 40 : M - 40, (side ? TY : NY) - spr.height - ((side ? lead2 : lead) ? 96 : 16)); cb.visible = !S.stage.raid || !side; cb.scale.x = mirror ? -1 : 1; }   /* 리더 용이 서 있으면 그 머리 위 */
    }
  }
  function effects(S, dt) {
    const p = S.players[0];
    const allBreath = S.players.reduce((a, q) => a + q.st.breath, 0);   // 멀티 : 누가 쏘든 브레스 연출
    if (p && allBreath > seen.breath) {
      let who = 0; S.players.forEach((q, i) => { if (q.st.breath > (seen.by[i] || 0)) who = i; seen.by[i] = q.st.breath; });
      seen.breath = allBreath; breathFx = 0.001; bP = S.players[who]; bSide = pvp ? bP.side : 0; const lkB = bSide ? lookR : look; bBS = BREATH_COLORS[lkB.breath] ? { ...((bSide && BREATH[foeLeader]) || BS), c: BREATH_COLORS[lkB.breath] } : (bSide && BREATH[foeLeader]) || BS;   // 브레스 색 꾸미기 (양쪽)   // 내 브레스 색 꾸미기
      const L0 = bSide ? lead2 : lead; if (L0 && !sfx.diving(bSide)) L0.set('hit');   /* 보통은 캐슬 앞으로 내려와 커진 드래곤이 뿜는다(skillFx 13.1) — 못 내려왔을 때만 앉은 채 입 벌림 */
      /* 불 (11/13 2차) : 커진 드래곤 입에서 수평으로 사거리 끝(코어 leader.range)까지 · 끝은 가늘고 듬성하게 · 맞은 좀비 깜짝 → 불탐 → 재 (skillFx) */
      const rch = M + (bP ? bP.leader.range : 600), f0 = bSide ? -1 : 1;
      sfx.breath({ side: bSide, x0: L0 ? L0.root.x + f0 * 26 : bx(M), y0: L0 ? L0.root.y - 62 : GC - 80, x1: bx(rch), cols: bBS.c, S, V });
    }
    if (breathFx > 0) {
      const b0 = breathFx; breathFx += dt;
      const reach = M + (bP ? bP.leader.range : 600);
      /*
       * 2차 (11/13 대표님) : 화면을 어둡게 덮는 그늘 · 번쩍 · 땅을 따라 가는 큰 불길 · 들판 불티를 뺐다 — 커진 드래곤이 어두워지지 않고,
       * 불은 skillFx 의 «입에서 수평으로 쭉» 하나만. 0.2초(소리 «쾅»)의 크게 흔들림만 남김.
       */
      if (b0 < 0.2 && breathFx >= 0.2) shakes.screen = 0.6;
      if (breathFx < 0.5 && (bBS.bolt || bBS.ray) && Math.random() < 0.35) {   // 번개 줄기 · 햇살 기둥
        const x = M + 200 + (reach - M - 200) * Math.random();   /* 커진 드래곤 앞에서만 */
        const g = new Graphics();
        if (bBS.bolt) { let px = bx(x), py = 30; g.moveTo(px, py); while (py < S1) { px += Math.random() * 24 - 12; py += 26 + Math.random() * 20; g.lineTo(px, py); } g.stroke({ width: 3, color: 0xfffbe0 }).stroke({ width: 8, color: 0xc08bff, alpha: 0.35 }); }
        else g.rect(bx(x) - 10, 0, 20, S1).fill({ color: 0xfff1a0, alpha: 0.35 });
        g.blendMode = 'add'; fx.addChild(g); parts.push({ g, vx: 0, vy: 0, life: 0.22, t: 0, grav: 0 });
      }
      if (breathFx > 1.4) { breathFx = 0; if (lead && !sfx.diving(0)) lead.set('idle'); if (lead2 && !sfx.diving(1)) lead2.set('idle'); }
    }
    /*
     * 브레스 사거리 (대표님 11/11 «필살기 사거리가 나왔으면») : 준비되면 바닥에 도트 불꽃 테두리 — 반투명 띠가 아니라 4px 칸 불꽃이 끝까지 줄지어 깜박이고, 끝에 불꽃 말뚝.
     * 단추를 누르고 있는 동안(api.aim)도 보인다.
     */
    const me = S.players[api.me || 0], ready = me && me.breathT >= me.breathCharge;
    rangeG.clear(); rangeG.visible = !S.over && (ready || api.aim) && !pvp;
    if (rangeG.visible) {
      const R = M + me.leader.range, ph = Math.floor(performance.now() / 140) % 2, cols = BREATH_COLORS[look.breath] || BS.c;
      for (let x = M - 20, i = 0; x < R; x += 12, i++) { const on = (i + ph) % 2 === 0; rangeG.rect(x, S1 + 2, 8, 4).fill(on ? cols[0] : cols[cols.length - 1]); if (on) rangeG.rect(x + 2, S1 - 2, 4, 4).fill(cols[1] || cols[0]); }
      for (let y = S1 - 68; y < S1 + 6; y += 8) rangeG.rect(R - 3, y, 6, 4).fill(((y / 8 + ph) | 0) % 2 ? cols[0] : 0xffffff);   /* 끝 말뚝 */
      rangeG.rect(R - 9, S1 - 74, 18, 8).fill(cols[0]).rect(R - 5, S1 - 82, 10, 8).fill(cols[1] || cols[0]);
    }
    { const rg = S.players.reduce((a, q) => a + q.st.rageUse, 0), sk = S.players.reduce((a, q) => a + q.st.skill, 0);
      if (rg > (seen.rage || 0)) { flashT = 0.12; flashC = 0xffd84a; shakes.screen = Math.max(shakes.screen, 0.2); }   // 포효 : 금빛 번쩍 (GDD 660 · 짧게 — 쿵 쿵 쿵 · 음파 고리는 skillFx)
      if (sk > (seen.skill || 0)) {   // 스킬 : 짧은 번쩍 · 운석은 하늘에서 떨어져 쾅 (대표님 11/11 «운석을 눌러도 아무 반응이 없다») · 얼음 · 돌풍 연출은 skillFx
        flashT = 0.1; flashC = 0x9fd8ff; shakes.screen = Math.max(shakes.screen, 0.15);
        const who = S.players.find((q) => q.skills.some((k) => k.id === 'meteor' && k.cdT > k.def.cd - 0.2));
        if (who) { let fx0 = null; for (const u of S.units) if (u.alive && u.side !== who.side && (fx0 == null || (who.side ? u.x > fx0 : u.x < fx0))) fx0 = u.x; if (fx0 != null) mets.push({ x: M + fx0, t: 0 }); flashT = 0; }
      }
      seen.rage = rg; seen.skill = sk;
      if (flashT > 0) { flashT -= dt; flashG.clear().rect(-50, -50, FIELD + 100, 700).fill({ color: flashC, alpha: Math.max(0, flashT) * 0.9 }); } else if (flashG.width) flashG.clear(); }
    if (S.st.bossAt != null && seen.bossAt == null) {
      seen.bossAt = S.st.bossAt; fun.hush(4); shakes.screen = 0.5;
      const ring = new Graphics().circle(0, 0, 20).stroke({ width: 6, color: 0xffe08a }); ring.position.set(M + L - 20, GC - 30); fx.addChild(ring);
      parts.push({ g: ring, ring: true, life: 0.7, t: 0 });
    }
    /* 운석 : 0.5초 동안 왼쪽 위에서 비스듬히 떨어지고(불꼬리) → 땅에 닿으면 주황 번쩍 · 흔들 · 불똥 · 먼지 고리 */
    for (let i = mets.length - 1; i >= 0; i--) {
      const m = mets[i]; m.t += dt; const k = Math.min(1, m.t / 0.5);
      if (!m.g) {
        if (meteorT) { m.g = new Sprite(meteorT); m.g.anchor.set(0.25, 0.72); }   // 불꼬리가 오른쪽 위 → 오른쪽 위에서 왼쪽 아래로
        else { m.g = new Graphics().circle(0, 0, 13).fill(0xffe08a).circle(0, 0, 9).fill(0xff7a1a); }
        fx.addChild(m.g);
      }
      const px = m.x + 220 * (1 - k), py = -40 + (GC - 10 + 40) * k * k;
      m.g.position.set(px, py); m.g.scale.set(meteorT ? 0.55 + k * 0.25 : 1 + k * 0.6);
      if (k < 1 && !meteorT) puff(px, py, Math.random() < 0.5 ? 0xff9a2e : 0xffd84a, 2, 30, 0.35, 3);
      else {
        m.g.destroy(); mets.splice(i, 1);
        flashT = 0.12; flashC = 0xff8a2a; shakes.screen = Math.max(shakes.screen, 0.4);   /* 번쩍은 짧고 약하게 (빛번짐 규칙) */
        if (boomFx) { const b = new AnimatedSprite(boomFx.frames); b.anchor.set(0.5, 0.5); b.scale.set(1.5); b.position.set(m.x, GC - 40); b.loop = false; b.animationSpeed = boomFx.meta.fps / 60; b.onComplete = () => b.destroy(); fx.addChild(b); b.play(); puff(m.x, GC - 6, 0x8a6a5a, 8, 110, 0.6, 3); }
        else { puff(m.x, GC - 6, 0xffb03a, 26, 260, 0.6, 3); puff(m.x, GC - 6, 0x8a6a5a, 14, 120, 0.8, 4); }
        if (!boomFx) { const ring = new Graphics().circle(0, 0, 20).stroke({ width: 4, color: 0xffd84a }); ring.position.set(m.x, GC - 4); ring.blendMode = 'add'; fx.addChild(ring); parts.push({ g: ring, ring: true, life: 0.5, t: 0 }); }
      }
    }
    for (let i = parts.length - 1; i >= 0; i--) {
      const q = parts[i]; q.t += dt; const k2 = q.t / q.life;
      if (q.shot) { q.g.position.set(q.x0 + (q.x1 - q.x0) * k2, q.y0 + (q.y1 - q.y0) * k2 - Math.sin(k2 * Math.PI) * 18); }
      else if (q.ring) { q.g.scale.set(1 + k2 * 14); q.g.alpha = 1 - k2; }
      else { q.vy += (q.grav || 0) * dt; q.g.x += q.vx * dt; q.g.y += q.vy * dt; q.g.alpha = 1 - k2; }
      if (q.t >= q.life) { if (q.shot) puff(q.x1, q.y1, q.color, q.area ? 10 : 5, q.area ? 90 : 60, 0.3, 2); q.g.destroy(); parts.splice(i, 1); }
    }
  }
  /* 도트 연기 덩어리 (4px 칸 · 짙은 회색 · 왼쪽 위 밝은 면 · 어두운 테두리) — 원 세 개를 겹친 구름 모양 */
  function smokeBlob(r) {
    if (smokeT.length) { const sp = new Sprite(smokeT[(Math.random() * smokeT.length) | 0]); sp.anchor.set(0.5); const c = new Container(); sp.scale.set((r * 2.6) / Math.max(sp.texture.width, sp.texture.height)); if (Math.random() < 0.5) sp.scale.x *= -1; c.addChild(sp); return c; }
    const g = new Graphics(), C = 3, blobs = [[0, 0, r]];
    for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2 + Math.random() * 0.8; blobs.push([Math.cos(a) * r * 0.75, Math.sin(a) * r * 0.55, r * (0.5 + Math.random() * 0.25)]); }   /* 몽글몽글 구름 */
    const inside = (x, y, pad) => blobs.some(([bx, by, br]) => (x - bx) ** 2 + (y - by) ** 2 <= (br - pad) ** 2);
    for (let y = -r * 1.4; y <= r * 1.4; y += C) for (let x = -r * 1.6; x <= r * 1.6; x += C) {
      if (!inside(x, y, 0)) continue;
      const col = !inside(x, y, C) ? 0x1e1a24 : !inside(x - C, y - C, C) ? 0x77707f : x + y < -r * 0.2 ? 0x524b5a : 0x3a3442;   /* 테두리 · 왼쪽 위 밝은 테 · 몸 · 그늘 */
      g.rect(Math.round(x / C) * C, Math.round(y / C) * C, C, C).fill(col);
    }
    return g;
  }
  const smokes = [];
  let colMask = null, colDone = false, colY0 = 0, colX0 = null, colN = 0;
  /*
   * 성 무너짐 (대표님 11/11 · 냥코 참고 «바바바바박 하면서 상대 성에 먼지가 막 생겨») — 소리 castle_collapse 와 같은 박자 :
   *  ① 0 ~ 1.26초 : 0.09초 간격 14번 도트 연기 덩어리가 성 위 여기저기 «펑» (작게 흔들림 · 성은 깜박깜박) — 연기는 0.4초쯤 남았다가 툭 꺼진다
   *  ② 1.25초 : 와르르 — 흔들리며 땅으로 꺼지고 먼지 · 돌조각
   *  ③ 2.2초 : 잔해가 남는다 (잔해 그림 · 없으면 무너진 성을 반쯤 묻어 둠). 투명하게 사라지기 금지.
   */
  function collapse(spr, rubT, dt, fallT = []) {
    for (let i = smokes.length - 1; i >= 0; i--) { const m = smokes[i]; m.t += dt; m.g.scale.set(Math.min(1, 0.55 + m.t * 6) * m.k); m.g.y -= dt * 6; if (m.t > m.life) { m.g.destroy(); smokes.splice(i, 1); } }
    const t = overT - 0.4, cx = colX0 ?? spr.x, gY = spr === nest ? NY : TY, top = gY - spr.height;   /* 0.4초 : 카메라가 성으로 가는 동안 */
    if (t < 0) return;
    if (!colMask) { colY0 = spr.y; colX0 = spr.x; colMask = new Graphics().rect(cx - 260, -2000, 520, gY + 4 + 2000).fill(0xffffff); stage.addChild(colMask); spr.mask = colMask; }   /* 땅 아래로는 안 보이게(투명 아님 · 묻힘) */
    while (colN < 14 && t >= colN * 0.09 + (colN % 3) * 0.012) {   /* ① 바바바박 */
      for (let j = 0; j < 2; j++) {   /* 한 번에 두 덩이 · 앞 덩이가 남아 있는 동안 쌓인다 */
        const g = smokeBlob(18 + Math.random() * 14), k = 0.9 + Math.random() * 0.4;
        g.position.set(Math.round(cx + (Math.random() - 0.5) * spr.width * 0.85), Math.round(top + spr.height * (0.1 + Math.random() * 0.8)));
        fx.addChild(g); smokes.push({ g, t: 0, k, life: 0.45 + Math.random() * 0.3 });
      }
      if (colN === 0) { flashT = 0.12; flashC = 0xffd080; if (boomFx) { const b = new AnimatedSprite(boomFx.frames); b.anchor.set(0.5); b.scale.set(1.6); b.position.set(cx, top + spr.height * 0.45); b.loop = false; b.animationSpeed = boomFx.meta.fps / 60; b.onComplete = () => b.destroy(); fx.addChildAt(b, 0); b.play(); } }
      shakes.screen = Math.max(shakes.screen, 0.07); colN++;
    }
    if (t < 1.25) { spr.tint = Math.floor(t * 14) % 2 ? 0xffffff : 0xff7a60; if (t >= 0.55 && fallT[0] && spr.texture !== fallT[0]) spr.texture = fallT[0]; }   /* 깜박깜박 · 반쯤에서 기울어짐 */
    else if (t < 2.2) {   /* ② 와르르 */
      spr.tint = 0xffffff;
      if (fallT[1] && spr.texture !== fallT[1]) spr.texture = fallT[1];   /* 무너지는 중 */
      const k = (t - 1.25) / 0.95; if (!rubT) spr.y = colY0 + spr.height * 0.38 * k * k; spr.x = cx + Math.sin(t * 60) * 1.2; shakes.screen = 0.12;   /* 잔해 그림이 없을 때만 묻는다 */
      if (crumbleFx && t - dt < 1.25) { const c = new AnimatedSprite(crumbleFx.frames); c.anchor.set(0.5, 1); c.scale.set(spr.width / crumbleFx.meta.w); c.position.set(cx, gY + 2); c.loop = false; c.animationSpeed = crumbleFx.meta.fps / 60; c.onComplete = () => c.destroy(); fx.addChild(c); c.play(); }
      if (Math.random() < 0.6) puff(cx + (Math.random() - 0.5) * spr.width * 0.8, gY - 10 - Math.random() * 30, 0x8c7c74, 3, 90, 0.9, 4);
      if (Math.random() < 0.3) puff(cx + (Math.random() - 0.5) * spr.width * 0.6, top + spr.height * (0.2 + k * 0.6), 0x5a4c58, 2, 160, 0.7, 5);   /* 돌조각 */
      if (Math.random() < 0.25) { const g = smokeBlob(10 + Math.random() * 8); g.position.set(Math.round(cx + (Math.random() - 0.5) * spr.width), gY - 16); fx.addChild(g); smokes.push({ g, t: 0, k: 1, life: 0.35 }); }   /* 땅 먼지 */
    } else if (!colDone) {   /* ③ 잔해가 남는다 */
      colDone = true; spr.tint = 0xffffff; spr.x = cx;
      if (rubT) { spr.mask = null; colMask.visible = false; spr.texture = rubT; spr.y = colY0; }   /* 잔해 그림 (그림 담당) */
      else spr.y = colY0 + spr.height * 0.38;   /* 잔해 그림이 오기 전 : 무너진 성을 반쯤 묻어 둔다 */
      for (let i = 0; i < 4; i++) { const g = smokeBlob(12 + i * 3); g.position.set(Math.round(cx + (i - 1.5) * spr.width * 0.25), gY - 14); fx.addChild(g); smokes.push({ g, t: 0, k: 1, life: 0.3 + i * 0.05 }); }
    }
  }
  function ending(S, dt) {
    if (!S.over) return;
    overT += dt;
    if (S.over.winner === 0 && !pvp) for (const u of S.units) { const v = V.get(u.id); if (v && u.side === 1 && u.alive) { v.flee = true; v.x += dt * 260; v.R.root.scale.x = Math.abs(v.R.root.scale.x); } }   // 좀비들 줄행랑 (오른쪽으로 도망)
    /* 성 무너짐 (대표님 «폭발 → 깜박깜박 → 와르르 무너지며 먼지 → 잔해가 남는다 · 투명하게 사라지는 것 금지») */
    if (S.over.winner === 0 && !pvp) collapse(tower, towerRubT, dt, towerFallT);
    else if (S.over.winner === 1 && !pvp) { collapse(nest, nestRubT, dt, nestFallT); for (const t of torches) t.visible = false; if (lead) lead.root.visible = overT < 1.5; }
    else if (overT < 1) shakes.nest = 0.1;
    /* 진 편 땅 깃발은 성이 무너질 때 성 쪽으로 기운다 (사라지지 않음 · 투명 금지 규칙) */
    if (S.over.winner >= 0) { const fb = flagBox[1 - S.over.winner]; if (fb && overT > 1.3) fb.rotation = (S.over.winner === 1 ? -1 : 1) * Math.min(0.42, (overT - 1.3) * 1.4); }
    /* 대결 : 이긴 쪽 리더가 깡충깡충 (멀티 기획 5장) */
    if (pvp && S.over.winner >= 0) { const w = S.over.winner === 0 ? lead : lead2; if (w) { w.root.y = w.baseY - Math.abs(Math.sin(overT * 7)) * 18; if (overT < 0.05) w.set('hit'); } }
  }

  /* ── 카메라 : 전선 따라가기 + 끌어서 보기(손 떼고 3초 뒤 복귀) */
  let drag = null, handT = 0;
  const canvas = app.canvas;
  const toWorld = (dx) => dx * (view.w / canvas.clientWidth);
  /* 냥코처럼 (대표님 11/11) : 한 손가락 끌기 = 옆으로 이동 · 두 손가락 오므리기 · 벌리기 = 확대 · 축소 (PC 는 휠) → api.onZoom (HUD 가 확대 정도를 맡는다) */
  const fingers = new Map(); let pinch = 0, zoomF = 0.5, lastW = view.w;   /* zoomF = 확대 · 축소 기준점 (캔버스 가로 비율 · 두 손가락 가운데 / 휠은 마우스 자리) */
  const fracX = (clientX) => { const r = canvas.getBoundingClientRect(); return r.width ? Math.max(0, Math.min(1, (clientX - r.left) / r.width)) : 0.5; };
  const gap = () => { const [a, b] = [...fingers.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
  /* 아래 단추 줄 근처에서 시작한 손가락은 맵을 움직이지 않는다 (대표님 11/13 «출전 단추를 누르다 실수로 맵을 건드리면 화면이 돌아간다») : api.guard(clientX, clientY) = HUD 가 알려 주는 «단추 줄 + 위로 40px» 안인지 */
  const onDown = (e) => { if (api.guard?.(e.clientX, e.clientY)) return; fingers.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (fingers.size === 2) { drag = null; pinch = gap(); } else drag = { x: px(e), cam: camX }; handT = 3; };
  const onMove = (e) => {
    if (fingers.has(e.pointerId)) fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (fingers.size >= 2 && pinch) { const g = gap(); if (g > 0 && Math.abs(Math.log(g / pinch)) > 0.02) { const [a, b] = [...fingers.values()]; zoomF = fracX((a.x + b.x) / 2); api.onZoom?.(Math.log(g / pinch) * 3); pinch = g; } handT = 3; return; }
    if (!drag || !fingers.has(e.pointerId)) return; camX = Math.max(0, Math.min(FIELD - view.w, drag.cam - (mirror ? -1 : 1) * toWorld(px(e) - drag.x))); handT = 3;
  };
  const onUp = (e) => { if (e?.pointerId != null && !fingers.has(e.pointerId)) return; if (e?.pointerId != null) fingers.delete(e.pointerId); else fingers.clear(); if (fingers.size < 2) pinch = 0; drag = null; };
  const onWheel = (e) => { e.preventDefault(); zoomF = fracX(e.clientX); api.onZoom?.(-Math.sign(e.deltaY) * Math.min(1, Math.abs(e.deltaY) / 100) * 0.25); handT = 3; };
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.style.touchAction = 'none';
  canvas.addEventListener('pointerdown', onDown); window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp); window.addEventListener('blur', onUp);   // iOS 제스처 · 알림으로 끊겨도 카메라가 멈추지 않게 (코드 검토 8)

  function camera(S, dt) {
    viewW = view.w;
    /* 보이는 폭이 바뀌면(확대 · 축소) 기준점 아래의 땅이 그대로 있게 카메라를 옮긴다 (예전엔 왼쪽 끝 기준이라 한쪽으로 쏠렸다) */
    if (view.w !== lastW) { camX = Math.max(0, Math.min(FIELD - view.w, camX + (mirror ? 1 - zoomF : zoomF) * (lastW - view.w))); lastW = view.w; }
    if (!drag) handT -= dt;
    if (S.over && !pvp && S.over.winner >= 0) {   /* 끝 : 무너지는 성을 비춘다 */
      const c = S.over.winner === 0 ? tower : nest, target = Math.max(0, Math.min(FIELD - view.w, c.x - view.w / 2));
      camX += (target - camX) * Math.min(1, dt * 9);
    } else if (!drag && handT <= 0) {
      let a = 0, b = L;
      for (const u of S.units) { if (!u.alive) continue; if (u.side === 0) a = Math.max(a, u.x); else b = Math.min(b, u.x); }
      const target = Math.max(0, Math.min(FIELD - view.w, M + (a + b) / 2 - view.w / 2));
      camX += (target - camX) * Math.min(1, dt * 2.5);
    }
    shakes.screen -= dt;
    const sx = shakes.screen > 0 ? Math.round(Math.random() * 4 - 2) : 0, sy = shakes.screen > 0 ? Math.round(Math.random() * 2 - 1) : 0;
    const lift = view.lift || 0; underBox.visible = lift > 0;   /* 싸움 줄을 단추 줄 위로 (app.js footFit) */
    if (skyBase) { const d = Math.max(0, Math.round((view.topRow || 0) + 45 - skyBase[0])); if (spots.sky[0] !== skyBase[0] + d) spots.sky = [skyBase[0] + d, skyBase[1] + d]; }
    if (mirror) { root.scale.x = -1; root.position.set(Math.round(camX + view.w) + sx, sy - lift + sfx.offY); }   // sfx.offY = 으르렁 쿵 (아래로 툭)   // 오른쪽 편 = 좌우 뒤집어 그린다
    else root.position.set(-Math.round(camX) + sx, sy - lift + sfx.offY);
    skyBox.x = Math.round(camX * 0.65);   // 하늘 겹 = 카메라의 0.35배 (뒤집힌 편도 같은 식)
  }

  const api = {
    FIELD, hits: 0, bigHit: false,
    update(S, dt) {
      lastS = S;
      if (S.stage.fog) { let a = 0; for (const u of S.units) if (u.alive && u.side === 0) a = Math.max(a, u.x); const fx0 = M + a + 260; fog.clear(); for (let i = 0; i < 6; i++) fog.rect(fx0 + i * 30, 0, FIELD, 660).fill({ color: 0x8a90b8, alpha: 0.16 }); }
      sfx.pre(S, dt); syncUnits(S, dt); bases(S, dt); effects(S, dt); sfx.update(S, dt, V); ending(S, dt); camera(S, dt);
      fun.update(dt); amb.update(dt); bossFx.update(S, dt, V); if (living) for (const b of living) b.update(dt);
      if (lead) lead.update(dt);
      if (lead2) lead2.update(dt);
      broodUpdate();   // 알 · 앞 짚 · 리더가 둥지(흔들림 · 금 간 그림)를 따라감
      for (const [b, t] of follow) { if (b.destroyed || t.destroyed) continue; b.position.copyFrom(t.position); b.rotation = t.rotation; }
      for (const f of flags) f.skew.y = Math.sin(performance.now() / 260 + f.x) * 0.06;   // 깃발 펄럭
    },
    /** 미니맵 · 시작 위치 */
    setCam(x) { camX = Math.max(0, Math.min(FIELD - view.w, x)); handT = 3; },
    get cam() { return camX; },
    /** 싸움 줄을 단추 줄 위로 올린 칸 (app.js footFit · 점검용) */
    get lift() { return view.lift || 0; },
    laneMap,
    get fun() { return fun; },
    destroy() {
      canvas.removeEventListener('pointerdown', onDown); canvas.removeEventListener('wheel', onWheel); window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp); window.removeEventListener('blur', onUp);
      bossFx.destroy(); sfx.destroy(); root.destroy({ children: true });
    },
  };
  return api;
}
/** 코어 유닛 def 에 그림 id 를 달아 둔다 (유닛 표에서 키를 찾아서) */
export function tagArt(D) {
  for (const [id, d] of Object.entries(D.units)) d._art = id;
  for (const [id, d] of Object.entries(D.enemies)) d._art = id;
}
