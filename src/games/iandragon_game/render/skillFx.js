/**
 * 필살기 연출 (화면 전용 · 11/12 대표님 «각각의 필살기들이 화면을 확 감싸는 압도적인 연출 · 모든 필살기는 다 화려해야»)
 * 전투 코어 상태 S 를 읽기만 한다 — 판정 · 난수에 손대지 않는다(멀티 · 다시 보기 결정성 그대로).
 *
 *  공통   발동 0.45초 : 화면이 어둡게 깔리고 가운데 띠 + 이름 도장 «얼음!» «돌풍!» «으르렁!» «브레스!» «운석!»
 *         (글씨는 DOM — 오락실 «캔버스 글씨 금지» · Pretendard 900 + 딱딱한 8방향 외곽선 · 흐린 그림자 없음) — 전투는 멈추지 않는다.
 *  얼음   화면 가장자리부터 성에 도트가 칸칸이 번짐 · 눈 · 차가운 빛 · 얼어붙은 캐릭터마다 몸을 따라 반투명 얼음 껍질(외곽선 · 결정 · 반짝)
 *         · 풀리기 직전 금 · 떨림 → 깨져 조각이 튀고 땅에 떨어져 깜박이다 사라짐(투명 페이드 없음)
 *  돌풍   도트 회오리가 화면을 가로질러 지나감 · 바람 줄 · 흙먼지 · 나뭇잎 · 뼈 조각 · 맞은 좀비 휘청(빙글 · 들림) · 흔들림
 *  으르렁 대장 드래곤만 고개 젖히고 입 크게(rig 'roar') · 우리 용들은 0.3초 멈춰 서기만(기획 13.2 · 입 안 벌림) · 쿵 · 쿵 · 쿵 세 번 · 입에서 도트 음파 고리 · 좀비 움찔(떨림 · 느낌표 · 땀)
 *  브레스 (기획 13.1) 누르면 캐슬 위 대장 드래곤이 앞 땅으로 폴짝 → 정수 배로 쑥 · 쑥 커짐 → 0.4초에 입에서 굵은 불기둥(코어가 이때 피해)
 *         · 밀리고 떨림 → 줄어 캐슬 위로 돌아가 알 품기 · 화면 가장자리 붉게 · 불똥 · 맞은 좀비 불탐 · 쓰러지면 재 더미(깜박이다 사라짐)
 *
 * 성능 : 입자는 한 장 흰 텍스처 스프라이트(한 번에 그려짐) · 전체 상한 MAXP · 얼음 껍질 상한 · 끝나면 전부 destroy.
 */
import { Container, Graphics, Sprite, AnimatedSprite, Texture } from 'pixi.js';
import { whiteTex } from './texPix.js';
import { ROAR_TIME } from './rig.js';
import * as Audio from '../audio/index.js';
import FONT from '../../../data/font.generated.json';   /* 프로젝트 비트맵 픽셀 글꼴 (갈무리11 볼드 · pixelfont.js 와 같은 것) — 필살기 제목 */
/* 필살기 연출 박자 효과음 9종 (겜팀장 61ba902 · audio/sfx.js ult_*) — gap 초 안에 같은 소리는 한 번만 (여럿이 한꺼번에 깨지고 · 타도 귀 아프지 않게) */
const sndAt = new Map();
const snd = (id, gap = 0) => { const t = performance.now() / 1000; if (gap && t - (sndAt.get(id) ?? -1e9) < gap) return; sndAt.set(id, t); try { Audio.play(id); } catch { /* 소리 실패는 연출과 무관 */ } };

/* [이름, (예전 DOM 글씨 색), 띠 색, { hl 하이라이트 · band 위→아래 4단 · dark 계단 두께 }] — 색 띠는 필살기마다 (11/13 대표님 3차) */
const NAMES = {
  frost: ['얼음!', '#c8f4ff', 0x7fd8ff, { hl: 0xffffff, band: [0xe8fbff, 0x9fe4ff, 0x4fb8f0, 0x2a7ad0], dark: 0x163a78 }],
  gust: ['돌풍!', '#e6ffb8', 0xb8e07a, { hl: 0xffffff, band: [0xeaffb0, 0xb8f06a, 0x6cc83a, 0x3a9a2a], dark: 0x1a4a1a }],
  meteor: ['운석!', '#ffc070', 0xff8a2a, { hl: 0xfff0d0, band: [0xffd08a, 0xff9a4a, 0xe8602a, 0xb8301a], dark: 0x5a120a }],
  rage: ['으르렁!', '#ffe070', 0xffc83a, { hl: 0xffffff, band: [0xfff07a, 0xffc83a, 0xff9a2a, 0xd86a1a], dark: 0x6a2a0a }],
  breath: ['브레스!', '#ffa04a', 0xff5a1a, { hl: 0xfffbe0, band: [0xffe14a, 0xffb02a, 0xff7a1a, 0xd8401a], dark: 0x7a1a0a }],
};
const OUT = '#2a1238', OUT_N = 0x2a1238;
const BANNER_T = 0.7;   /* 제목 글씨가 머무는 시간 */
const MAXP = 360, MAX_ICE = 24, MAX_BURN = 14;
/* 갈래마다 상한 (눈이 자리를 다 차지해 얼음 조각이 안 나오는 일 없게) */
const CAP = { snow: 90, wind: 60, ember: 70 };
const step = (v, n) => Math.round(v * n) / n;

/*
 * 브레스 «내려와서 · 커져서 · 뿜는다» 시간표 (기획 13.1 · 초 = 단추 누른 때부터) — 코어 breathWind(p.st.wind) 사건을 보고 시작, 불(p.st.breath)은 코어가 12틱 뒤에 낸다.
 *  0 ~ hop 폴짝 뛰어내림 · grow1 · grow2 정수 배로 쑥 · 쑥 · fire 입 벌리고 뿜기(밀리고 떨림) · end 줄기 시작 · small 원래 크기 · back 캐슬 위로 돌아가 알 품기
 */
const DV = { hop: 0.2, grow1: 0.24, grow2: 0.32, fire: 0.4, end: 1.2, small: 1.26, back: 1.5, wait: 1.4 };

export function createSkillFx({ app, fx, view, M, FIELD, GC, S1, mirror, getCam, shake, torchFx, leaders, stage, units, castles, flagTop }) {
  const W = () => view.w;
  const topY = () => Math.max(0, Math.round((view.topRow || 0) - (view.lift || 0)));
  const sx = (x) => (mirror ? getCam() + view.w - x : x - getCam());
  /** 필살기 때 대장 드래곤이 화면 밖(캐슬이 화면 왼쪽 너머)이면 몸의 2/3 쯤이 화면 가장자리에 보이게 옆으로 당긴다 (대표님 11/13 «용은 안 보이는데 불만 뿜으니 이상해») — 화면 전용 · 돌려줄 값 = 당긴 전장 거리 */
  function peek(R) {
    const g = R.root.getBounds(), Wg = app.screen?.width || view.w, w = g.width, k = R.root.parent?.worldTransform?.a || 1;
    if (!w || !k) return 0;
    const seen = Math.min(g.x + w, Wg) - Math.max(g.x, 0);
    if (seen >= w * 0.66) return 0;
    const d = g.x < 0 ? w * 0.66 - (g.x + w) : Wg - w * 0.66 - g.x;   /* 화면 px */
    const dw = d / k; R.root.x += dw; return dw;
  }
  const sy = (y) => y - (view.lift || 0);

  /* ── 화면 고정 층 (카메라를 따라가지 않음 · 보스 컷인 위) */
  const layer = new Container(); app.stage.addChild(layer);
  const tint = new Graphics(), frostBox = new Container(), fireBox = new Container(), scr = new Container(), tornG = new Graphics(), dim = new Graphics(), strip = new Graphics();
  layer.addChild(tint, fireBox, frostBox, tornG, scr, dim, strip);
  /* ── 전장 층 (fx 위) : 음파 고리 · 얼음 조각 · 재 · 불기둥 · 불타는 불꽃 */
  const wl = new Container(); fx.addChild(wl);
  const beamG = new Graphics(); wl.addChild(beamG);
  const ps = [];   // 입자 { s, vx, vy, g, life, t, kind, ... }
  const rings = [];

  function sq(parent, x, y, w, h, color) {
    if (ps.length >= MAXP) return null;
    const s = new Sprite(Texture.WHITE); s.width = w; s.height = h; s.tint = color; s.position.set(Math.round(x), Math.round(y)); s.anchor.set(0.5); parent.addChild(s);
    return s;
  }
  const nK = { snow: 0, wind: 0, ember: 0 };
  function addP(parent, x, y, w, h, color, o) {
    const k = o && o.kind; if (k in nK && nK[k] >= CAP[k]) return null;
    const s = sq(parent, x, y, w, h, color); if (!s) return null;
    const q = { s, vx: 0, vy: 0, g: 0, life: 1, t: 0, ...o }; ps.push(q); if (k in nK) nK[k]++; return q;
  }

  /*
   * ── 필살기 제목 (모든 필살기 공통 · 11/13 대표님 3차) — 게임 타이틀 로고 같은 큰 픽셀 글씨
   *  · 글꼴 = 프로젝트 비트맵 픽셀 글꼴(갈무리11 볼드 · src/data/font.generated.json — pixelfont.js 와 같은 것) 을 1칸씩 TS 배(정수)로 네모를 찍는다
   *    (캔버스 fillText · 흐린 그림자 · 글로우 없음 · 픽셀이 뭉개지지 않게)
   *  · 칠 = 위 → 아래 4단 색 띠(부드러운 그라데이션 아님) + 각 획의 맨 위 칸 흰 하이라이트 한 줄 · 필살기마다 다른 색 띠
   *  · 검은 두꺼운 테두리(1칸 = TS 화면 칸 · 8방향) + 아래 · 오른쪽으로 2칸 계단식 두께(진한 색 → 검정)
   *  · 자리 = 화면 거의 정중앙 · 뒤 띠(폭 46% · 높이 BAN_H)는 그대로, 글씨만 띠 밖으로 살짝 넘침
   *  · 나타나는 법 = 1장면에 «딱» → BANNER_T 동안 그대로 → 1장면에 «싹» (크기 · 접힘 · 떨림 · 깜박 · 페이드 없음)
   */
  const titleG = new Graphics(); layer.addChild(titleG);
  let banT = -1, banC = 0xffffff, banK = '', banKey = '';
  const BAN_H = 80, TS_MAX = 7;   /* 글씨 1칸 = 최대 7칸 (띠 80칸보다 살짝 넘침) */
  function titleGrid(str) {   /* 글씨 칸 격자 : 0 빈칸 · 1 글씨 · 2 테두리 · 3 · 4 계단 두께 */
    const gl = [...str].map((c) => FONT.glyphs[c] || FONT.glyphs['?']).filter(Boolean), H = FONT.h, P = 3;
    const w0 = gl.reduce((a, g) => a + g.w, 0), gw = w0 + P * 2, gh = H + P * 2;
    const G = Array.from({ length: gh }, () => new Uint8Array(gw));
    let ox = P;
    for (const g of gl) { for (let y = 0; y < H; y++) for (let x = 0; x < g.w; x++) if ((g.r[y] >> (g.w - 1 - x)) & 1) G[y + P][ox + x] = 1; ox += g.w; }
    const at = (x, y) => (y >= 0 && y < gh && x >= 0 && x < gw ? G[y][x] : 0);
    for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) if (!G[y][x]) { for (let dy = -1; dy <= 1 && !G[y][x]; dy++) for (let dx = -1; dx <= 1; dx++) if (at(x + dx, y + dy) === 1) { G[y][x] = 2; break; } }
    for (const d of [1, 2]) for (let y = gh - 1; y >= 0; y--) for (let x = gw - 1; x >= 0; x--) if (!G[y][x]) { const s = at(x - d, y - d); if (s === 1 || s === 2) G[y][x] = 2 + d; }
    return { G, gw, gh, P, H };
  }
  function drawTitle(kind, w, mid) {
    const n = NAMES[kind]; titleG.clear(); if (!n) return;
    const { G, gw, gh, P, H } = titleGrid(n[0]), pal = n[3];
    const TS = Math.max(3, Math.min(TS_MAX, Math.floor((w * 0.94) / gw)));
    const x0 = Math.round((w - gw * TS) / 2), y0 = Math.round(mid - (gh * TS) / 2);
    for (let y = 0; y < gh; y++) {
      let run = 0, rc = -1;
      const flush = (xe) => { if (rc >= 0 && run) titleG.rect(x0 + (xe - run) * TS, y0 + y * TS, run * TS, TS).fill(rc); };
      for (let x = 0; x <= gw; x++) {
        const v = x < gw ? G[y][x] : 0, ty = y - P;
        let c = -1;
        if (v === 1) c = y > 0 && G[y - 1][x] !== 1 && ty <= 6 ? pal.hl : pal.band[Math.min(3, Math.floor((ty / H) * 4))];
        else if (v === 2) c = 0x120a12;
        else if (v === 3) c = pal.dark;
        else if (v === 4) c = 0x120a12;
        if (c === rc) { run++; continue; }
        flush(x); rc = c; run = c >= 0 ? 1 : 0;
      }
    }
  }
  function banner(kind) {
    if (!NAMES[kind]) return;
    banC = NAMES[kind][2]; banT = 0; banK = kind; banKey = '';
    snd('ult_stamp', 0.2);   /* 이름 도장 «쾅» */
  }
  function drawBanner(dt) {
    if (banT < 0) return;
    banT += dt;
    if (banT >= BANNER_T) { banT = -1; dim.clear(); strip.clear(); titleG.clear(); banKey = ''; return; }   /* 싹 (1장면) */
    const w = W(), top = topY(), mid = Math.round(top + (540 - top) * 0.46), key = `${w}|${mid}|${banK}`;   /* 거의 화면 정중앙 (3차) */
    if (key === banKey) return;   /* 머무는 동안은 그대로 (움직임 없음) — 화면 크기가 바뀔 때만 다시 그림 */
    banKey = key;
    const a = banK === 'breath' ? 0 : 0.3;
    dim.clear(); if (a) dim.rect(0, 0, w, 540).fill({ color: 0x0a0618, alpha: a });
    const bw = Math.round(w * 0.46), bh = BAN_H, x0 = Math.round((w - bw) / 2), y0 = Math.round(mid - bh / 2);
    strip.clear().rect(x0, y0, bw, bh).fill({ color: 0x000000, alpha: 0.38 })
      .rect(x0, y0 - 4, bw, 4).fill(banC).rect(x0, y0 + bh, bw, 4).fill(banC)
      .rect(x0, y0 - 8, bw, 2).fill(0xffffff).rect(x0, y0 + bh + 6, bw, 2).fill(0xffffff);
    drawTitle(banK, w, mid);
  }

  /* ── 가장자리 띠 (성에 · 불) : 칸(cell) 단위로 미리 그린 겹 N 장을 칸칸이 보였다 숨김 — 매 장면 다시 그리지 않는다 */
  function makeBands(box, pal, depth, cell, seedSparse) {
    const N = pal.length, gs = pal.map(() => { const g = new Graphics(); box.addChild(g); return g; });
    let key = '';
    function build() {
      const w = W(), top = Math.floor(topY() / 12) * 12, bot = 540, k = `${w}|${top}`;   /* 위 끝은 12칸 단위 — 조금 움직여도 다시 그리지 않게 */
      if (k === key) return; key = k;
      for (const g of gs) g.clear();
      const cols = Math.ceil(w / cell), rows = Math.ceil((bot - top) / cell);
      /* 가장자리마다 들쭉날쭉(값 잡음 + 가끔 고드름처럼 길게) */
      const noise = (n) => { const a = []; let v = Math.random(); for (let i = 0; i <= n; i++) { if (i % 4 === 0) v = Math.random(); a.push(v); } const o = []; for (let i = 0; i < n; i++) { const i0 = i - (i % 4), f = (i % 4) / 4; o.push((a[i0] * (1 - f) + (a[Math.min(n, i0 + 4)] ?? a[i0]) * f) * 0.6 + (Math.random() < 0.12 ? 0.55 : 0)); } return o; };
      const nL = noise(rows), nR = noise(rows), nT = noise(cols), nB = noise(cols);
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const x = c * cell, y = top + r * cell;
        const dL = x - nL[r] * depth * 0.6, dR = w - x - cell - nR[r] * depth * 0.6, dT = (y - top) - nT[c] * depth * 0.45, dB = bot - y - cell - nB[c] * depth * 0.45;
        const d = Math.min(dL, dR, dT * 1.3, dB * 1.3);
        if (d >= depth) continue;
        const b = Math.max(0, Math.floor((d / depth) * N));
        if (b >= N - 2 && Math.random() < seedSparse) continue;   // 끝은 듬성듬성 (번지는 끝)
        gs[b].rect(x, y, cell, cell).fill({ color: pal[b][0], alpha: pal[b][1] });
      }
    }
    return { build, show(n) { for (let i = 0; i < N; i++) gs[i].visible = i < n; }, N, reset() { key = ''; } };
  }
  const frostB = makeBands(frostBox, [[0xffffff, 0.92], [0xeafcff, 0.85], [0xcdf3ff, 0.75], [0xaee6ff, 0.6], [0x8fd6ff, 0.45], [0x9fe0ff, 0.32], [0xc8f4ff, 0.25]], 92, 7, 0.5);
  const fireB = makeBands(fireBox, [[0x9a1a06, 0.5], [0xd0300c, 0.42], [0xff5a14, 0.34], [0xff8a2a, 0.26], [0xffb040, 0.19], [0xffd860, 0.13]], 76, 8, 0.55);
  frostB.show(0); fireB.show(0);
  let gone = false;
  setTimeout(() => { if (!gone) { frostB.build(); fireB.build(); } }, 1600);   /* 성에 · 불 테두리는 전투가 뜬 뒤 미리 한 번 그려 둠 (발동 순간 끊김 없게) */

  /* ── 얼음 */
  let frost = null;   // { t, dur }
  const tintA = { frost: 0, fire: 0 }, tintK = { k: '' };
  function drawTint() {   /* 화면 빛 : 얼음(푸름) 이 브레스(붉음) 보다 먼저 · 값이 바뀔 때만 다시 그림 */
    const k = tintA.frost ? `f${tintA.frost}|${W()}` : tintA.fire ? `r${tintA.fire}|${W()}` : '';
    if (k === tintK.k) return; tintK.k = k; tint.clear();
    if (tintA.frost) tint.rect(0, 0, W(), 540).fill({ color: 0x6ec8ff, alpha: tintA.frost });
    else if (tintA.fire) tint.rect(0, 0, W(), 540).fill({ color: 0xff3a10, alpha: tintA.fire });
  }
  const glintG = new Graphics(); frostBox.addChild(glintG);
  function startFrost(dur) {
    frost = { t: 0, dur: Math.max(1.5, dur) };
    snd('ult_ice_spread');   /* «쩌저적» */
    frostB.build();
    for (let i = 0; i < 14; i++) addP(scr, Math.random() * W(), topY() + Math.random() * 120, 3, 3, 0xffffff, { vx: (Math.random() - 0.5) * 40, vy: 60 + Math.random() * 50, life: 3, kind: 'snow', ph: Math.random() * 6 });
  }
  function frostUpdate(dt) {
    if (!frost) { frostB.show(0); glintG.clear(); tintA.frost = 0; return; }
    frost.t += dt; const t = frost.t, D = frost.dur, N = frostB.N;
    frostB.build();
    /* 번짐 : 0.4초에 칸칸이 다 → 1.6초까지 가득 → 얇은 테두리로 물러나 얼음이 풀릴 때까지 → 칸칸이 물러남 */
    const n = t < 0.42 ? Math.ceil((t / 0.42) * N) : t < 1.6 ? N : t < D - 0.35 ? 3 : Math.max(0, Math.ceil(3 * (D - t) / 0.35));
    frostB.show(n);
    tintA.frost = t < 0.12 ? 0.2 : t < 1.6 ? 0.13 : t < D ? 0.06 : 0;   /* 차가운 빛 (아주 은은하게 · 칸칸이) */
    glintG.clear();
    if (n >= 3) for (let i = 0; i < 10; i++) {   /* 성에 속 반짝 (깜박이는 십자) */
      if ((Math.floor(t * 8) + i) % 3) continue;
      const side = i % 4, w = W(), top = topY();
      const x = side === 0 ? 8 + (i * 13) % 40 : side === 1 ? w - 12 - (i * 17) % 40 : (i * 97) % w, y = side < 2 ? top + 30 + (i * 53) % Math.max(40, 500 - top) : side === 2 ? top + 6 + (i * 7) % 20 : 520 - (i * 7) % 20;
      glintG.rect(x - 1, y - 4, 2, 8).fill(0xffffff).rect(x - 4, y - 1, 8, 2).fill(0xffffff);
    }
    if (t < 3.2) for (let i = 0; i < 2; i++) addP(scr, Math.random() * (W() + 80) - 40, topY() - 4, Math.random() < 0.4 ? 4 : 3, Math.random() < 0.4 ? 4 : 3, Math.random() < 0.8 ? 0xffffff : 0xcdf3ff, { vx: (Math.random() - 0.5) * 40, vy: 55 + Math.random() * 60, life: 6, kind: 'snow', ph: Math.random() * 6 });
    if (t >= D) { frost = null; tintA.frost = 0; }
  }

  /* 얼음 껍질 : 몸 부품을 하얀 실루엣으로 복사 — 뒤에 4방향 2칸 외곽선(반투명) + 앞에 푸른 막 + 결정 · 발밑 얼음판 · 반짝 */
  let iceN = 0, iceBudget = 4;   /* 한 장면에 껍질 4개까지만 새로 (많이 얼면 앞에서부터 물결처럼 · 폰 끊김 방지) */
  function copyBody(body, tintC, alpha) {
    const c = new Container(); c.position.copyFrom(body.position); c.rotation = body.rotation;
    for (const s of body.children) {
      if (!(s instanceof Sprite) || !s.visible || !s.renderable) continue;
      const q = new Sprite(whiteTex(s.texture) || s.texture); q.anchor.copyFrom(s.anchor); q.position.copyFrom(s.position); q.rotation = s.rotation; q.scale.copyFrom(s.scale); q.tint = tintC; q.alpha = alpha; c.addChild(q);
    }
    return c;
  }
  function iceOn(v) {
    const R = v.R, body = R.root.children[0]; if (!body || iceN >= MAX_ICE) return;
    const back = new Container(), front = new Container();
    const offs = [[-2, 0], [2, 0], [0, -2], [0, 2]];
    for (let i = 0; i < offs.length; i++) back.addChild(copyBody(body, 0xe8fbff, 0.62));
    front.addChild(copyBody(body, 0x8fdcff, 0.4));
    const b = body.getLocalBounds(), bx = body.x + b.x, by = body.y + b.y, bw = b.width, bh = b.height;
    const cr = new Graphics();   /* 결정 (뾰족 얼음) */
    const spikes = [[0.2, 0, -1], [0.55, 0, -1], [0.85, 0.15, -1], [1, 0.45, 1], [0, 0.5, 1]];
    for (const [fx0, fy0, up] of spikes) {
      const x = bx + bw * fx0, y = by + bh * fy0, s = 4 + Math.random() * 4;
      if (up < 0) cr.poly([x - s * 0.6, y + 2, x, y - s * 1.6, x + s * 0.6, y + 2]).fill({ color: 0xc8f4ff, alpha: 0.85 }).rect(Math.round(x) - 1, Math.round(y - s * 1.2), 1, s).fill(0xffffff);
      else cr.poly([x, y - s * 0.6, x + (fx0 > 0.5 ? s * 1.4 : -s * 1.4), y, x, y + s * 0.6]).fill({ color: 0xc8f4ff, alpha: 0.8 });
    }
    cr.rect(bx - 3, -3, bw + 6, 5).fill({ color: 0xbfefff, alpha: 0.85 }).rect(bx - 3, -3, bw + 6, 1).fill(0xffffff);   /* 발밑 얼음판 */
    const gl = new Graphics();
    front.addChild(cr, gl);
    R.root.addChildAt(back, 0); R.root.addChild(front);
    v.ice = { back, front, gl, body, crack: null, t: 0, bx, by, bw, bh };
    v.flash = Math.max(v.flash || 0, 0.06); iceN++;
  }
  function iceOff(v, shatter) {
    const I = v.ice; if (!I) return; v.ice = null; iceN--;
    if (!I.back.destroyed) I.back.destroy({ children: true });
    if (!I.front.destroyed) I.front.destroy({ children: true });
    if (!shatter) return;
    snd('ult_ice_shatter', 0.4);   /* «쨍그랑» — 한꺼번에 깨지면 한 번 */
    const h = v.h || 50, w = Math.max(16, h * 0.7);
    for (let i = 0; i < 16; i++) {   /* 깨진 조각 : 튀고 → 떨어져 땅에 눕고 → 깜박이다 사라짐 */
      const x = v.x + (Math.random() - 0.5) * w, y = v.y - Math.random() * h, big = Math.random() < 0.45;
      const q = addP(wl, x, y, big ? 7 : 4, big ? 5 : 3, [0xe8fbff, 0x9fdcff, 0x5ab4ec, 0xffffff][i % 4], { vx: (x - v.x) * 4 + (Math.random() - 0.5) * 80, vy: -100 - Math.random() * 120, g: 620, life: 1.6, kind: 'shard', floor: v.y + Math.random() * 6 - 2 });
      if (q) q.s.rotation = (Math.floor(Math.random() * 4) * Math.PI) / 4;
    }
    for (let i = 0; i < 8; i++) addP(wl, v.x + (Math.random() - 0.5) * w, v.y - Math.random() * h, 3, 3, 0xffffff, { vx: (Math.random() - 0.5) * 160, vy: -70 - Math.random() * 70, g: 200, life: 0.3 });
  }
  function iceUpdate(u, v, dt, o) {
    const frozen = u.alive && u.freezeT > 0;
    if (frozen && !v.ice && iceBudget > 0) { iceBudget--; iceOn(v); }
    const I = v.ice; if (!I) return;
    if (!frozen) { iceOff(v, true); return; }
    I.t += dt;
    const d = I.t < 0.05 ? 0 : I.t < 0.1 ? 1 : 2;   /* 쩡 : 외곽선이 칸칸이 자람 */
    I.back.children.forEach((c, i) => c.position.set(I.body.x + [-1, 1, 0, 0][i] * d, I.body.y + [0, 0, -1, 1][i] * d));
    I.gl.clear();
    for (let i = 0; i < 3; i++) if ((Math.floor(I.t * 6) + i * 2) % 5 === 0) { const x = Math.round(I.bx + I.bw * [0.25, 0.7, 0.45][i]), y = Math.round(I.by + I.bh * [0.3, 0.55, 0.8][i]); I.gl.rect(x - 1, y - 3, 2, 6).fill(0xffffff).rect(x - 3, y - 1, 6, 2).fill(0xffffff); }
    if (u.freezeT < 0.4) {   /* 풀리기 직전 : 금 · 떨림 */
      if (!I.crack) {
        const g = new Graphics(); let x = I.bx + I.bw * 0.4, y = I.by + 2; g.moveTo(x, y);
        for (let i = 0; i < 5; i++) { x += (i % 2 ? 4 : -3); y += I.bh / 5; g.lineTo(x, y); }
        g.moveTo(I.bx + I.bw * 0.7, I.by + I.bh * 0.3).lineTo(I.bx + I.bw * 0.55, I.by + I.bh * 0.5).lineTo(I.bx + I.bw * 0.8, I.by + I.bh * 0.65);
        g.stroke({ width: 1, color: 0xffffff }); I.front.addChild(g); I.crack = g;
      }
      o.dx += Math.floor(I.t * 30) % 2 ? 1 : -1;
    }
  }

  /* ── 돌풍 */
  let torn = null;
  function startGust(side) {
    const dir = (side === 0 ? 1 : -1) * (mirror ? -1 : 1), w = W();
    snd('ult_gust_pass');   /* «휘이이잉» */
    torn = { t: 0, dur: 0.8, dir, x0: dir > 0 ? -90 : w + 90, x1: dir > 0 ? w + 90 : -90, side, swept: new Set(), deb: [] };
    for (let i = 0; i < 18; i++) {
      const bone = i % 3 === 0;
      const s = sq(scr, 0, 0, bone ? 9 : 6, bone ? 3 : 4, bone ? 0xf2ead8 : [0x6bbf3a, 0xd89a2a, 0x9a6a2a, 0x4f9a2a][i % 4]);
      if (s) torn.deb.push({ s, a: Math.random() * 6.28, h: 10 + Math.random() * 240, sp: 7 + Math.random() * 5, bone });
    }
    shake(0.3);
  }
  function gustUpdate(dt) {
    tornG.clear();
    if (!torn) return;
    const T = torn; T.t += dt; const t = T.t, k = Math.min(1, t / T.dur), x = T.x0 + (T.x1 - T.x0) * k, base = Math.round(sy(S1 + 2));
    if (t < 1.1) for (let i = 0; i < 3; i++) {   /* 바람 줄 : 화면 전체를 가로지르는 흰 줄 */
      const y = topY() + 20 + Math.random() * (base - topY() - 20), len = 24 + Math.random() * 46;
      addP(scr, T.dir > 0 ? -len : W() + len, y, len, 2, 0xffffff, { vx: T.dir * (900 + Math.random() * 500), vy: 0, life: 1.4, kind: 'wind' });
    }
    if (k < 1) {
      /* 회오리 (도트) : 위로 갈수록 넓어지는 고리 18줄 — 줄마다 뒤 호(어두움) · 속(반투명) · 앞 호(밝음 · 도는 흰 줄무늬) · 몸통이 S 자로 흔들림 */
      const P4 = 6;
      for (let i = 15; i >= 0; i--) {
        const y = base - 6 - i * 17, hw = Math.min(150, 7 + i * 3 + i * i * 0.45), cx = x + Math.sin(t * 8 + i * 0.45) * (2 + i * 1.5) + (i > 11 ? T.dir * (i - 11) * 3 : 0);
        const cv = 2 + i * 0.28;
        for (let xx = -hw; xx < hw; xx += P4) {
          const u = xx / hw, arc = Math.round((1 - u * u) * cv), X = Math.round(cx + xx);
          const lit = ((((u + 1) * 1.6 + t * 6 + i * 0.35) % 2) + 2) % 2 < 0.7;
          tornG.rect(X, y - arc - 2, P4, 3).fill({ color: 0x6e7c86, alpha: 0.9 });                          /* 뒤 호 */
          if (arc > 0) tornG.rect(X, y - arc + 1, P4, arc * 2).fill({ color: 0xc4d0d6, alpha: 0.42 });      /* 속 */
          tornG.rect(X, y + arc, P4, 4).fill({ color: lit ? 0xffffff : 0xd8e2e6, alpha: 0.95 });            /* 앞 호 */
        }
        tornG.rect(Math.round(cx - hw) - 2, y - 1, 3, 4).fill(0x56636c).rect(Math.round(cx + hw), y - 1, 3, 4).fill(0x56636c);   /* 양 끝 테 */
      }
      for (const d of T.deb) {   /* 휩쓸리는 나뭇잎 · 뼈 */
        d.a += d.sp * dt; const r = 12 + d.h * 0.42;
        d.s.position.set(Math.round(x + Math.cos(d.a) * r), Math.round(base - d.h + Math.sin(d.a) * 4)); d.s.rotation = Math.floor(d.a * 2) * (Math.PI / 4);
      }
      if (Math.random() < 0.9) for (let i = 0; i < 2; i++) addP(scr, x + (Math.random() - 0.5) * 50, base - Math.random() * 10, 5, 5, Math.random() < 0.5 ? 0xa0805a : 0x7a6048, { vx: (Math.random() - 0.5) * 160 - T.dir * 60, vy: -40 - Math.random() * 60, g: 80, life: 0.5 });
      shake(0.05);
    } else if (T.deb.length) {   /* 다 지나가면 조각은 화면 밖으로 휙 */
      for (const d of T.deb) { const q = { s: d.s, vx: T.dir * (500 + Math.random() * 300), vy: -200 - Math.random() * 200, g: 500, life: 0.8, t: 0 }; ps.push(q); }
      T.deb = [];
    }
    T.x = x;
    if (t > 1.4) torn = null;
  }

  /* ── 으르렁 */
  let roar = null;   // { t, side, beats }
  let offY = 0;
  function startRage(side, S, V) {
    roar = { t: 0, side, beats: 0 };
    snd('ult_roar_thumps');   /* «쿵 · 쿵 · 쿵» 0.12 · 0.42 · 0.72 (아래 beatAt 와 같은 박자) */
    if (S.units.some((u) => u.alive && u.side !== side)) snd('ult_zombie_flinch', 0.5);   /* 좀비 «히익!» */
    for (const u of S.units) { const v = V.get(u.id); if (!v || !u.alive) continue; if (u.side === side) v.roarT = 0; else v.scareT = -0.12; }
    const L = leaders()[side]; if (L) { L.set('roar'); roar.lead = L; roar.hx = L.root.x; }
  }
  function ring(x, y, r1, life, col) {
    if (rings.length > 30) return;
    const g = new Graphics(); wl.addChild(g); rings.push({ g, x, y, r1, life, t: 0, col });
  }
  function rageUpdate(dt, S, V) {
    if (!roar) return;
    const R0 = roar; R0.t += dt;
    const beatAt = [0.12, 0.42, 0.72];
    while (R0.beats < 3 && R0.t >= beatAt[R0.beats]) {   /* 쿵! : 화면 아래로 쿵 · 흔들림 · 입에서 음파 고리 */
      R0.beats++; offY = 7; shake(0.14);
      let n = 0;
      const cx = getCam() + W() / 2;
      const mine = S.units.filter((u) => u.alive && u.side === R0.side).sort((a, b) => Math.abs(M + a.x - cx) - Math.abs(M + b.x - cx));
      for (const u of mine) { const v = V.get(u.id); if (!v || n >= 10) continue; n++; const f = u.side === 0 ? 1 : -1; ring(v.x + f * (v.h || 50) * 0.3, v.y - (v.h || 50) * 0.8, 80, 0.45, 0xffffff); }
      if (R0.lead) { const f = R0.side === 0 ? 1 : -1; ring(R0.lead.root.x + f * 24, R0.lead.root.y - 70, 420, 0.6, 0xffffff); }
      for (const u of S.units) { const v = V.get(u.id); if (v && u.alive && u.side !== R0.side) addP(wl, v.x + (Math.random() - 0.5) * 10, v.y - (v.h || 50) - 12, 2, 3, 0xbfe8ff, { vx: (Math.random() - 0.5) * 60, vy: -60, g: 300, life: 0.4 }); }   /* 식은땀 */
    }
    if (R0.lead && !R0.lead.dive) { R0.lead.root.x = R0.hx; if (R0.t <= ROAR_TIME + 0.05) R0.lead.root.x = Math.round(R0.hx + peek(R0.lead)); }   /* 화면 밖이면 2/3 보이게 · 끝나면 제자리 */
    if (R0.lead && R0.t > ROAR_TIME + 0.05) { R0.lead.set('idle'); R0.lead = null; }
    if (R0.t > ROAR_TIME + 0.2) roar = null;
  }

  /*
   * ── 브레스 : 캐슬 위 대장 드래곤이 내려와서 · 커져서 · 뿜는다 (기획 13.1 · 시간표 = 위 DV)
   * 알은 캐슬 위에 그대로 (battleView brood 는 캐슬을 따라가고 드래곤만 내려온다) · 커질 때는 정수 배(텍스처 1칸 = 화면 n칸)로 두 번 쑥 · 쑥.
   * 내려와 있는 동안은 캐슬 앞 · 출전 용(units) 뒤 층. 투명 페이드 · 글로우 없음. 게임은 멈추지 않는다(화면 전용).
   */
  const dives = [null, null];
  function dust(x, y, n, spread) {   /* 도트 흙먼지 : 네모 조각이 양옆으로 튀고 떨어진다 */
    for (let i = 0; i < n; i++) {
      const d = i % 2 ? 1 : -1, big = i % 3 === 0;
      addP(wl, x + d * Math.random() * spread, y - Math.random() * 6, big ? 8 : 5, big ? 8 : 5, [0xb89a72, 0x8c7458, 0xd8c09a, 0x6e5a46][i % 4], { vx: d * (80 + Math.random() * 200), vy: -60 - Math.random() * 140, g: 520, life: 0.45 + Math.random() * 0.25 });
    }
  }
  function startDive(side) {
    const R = leaders()[side], c = castles?.()[side];
    if (!R || !c || !stage || !units || R.root.destroyed || !c.texture) return;
    const D0 = dives[side];
    if (D0) { if (D0.t > DV.fire) { D0.t = DV.fire; D0.fired = false; D0.hold = 0; } return; }   /* 이미 내려와 있음(협동 둘이 연달아) : 커진 채 다시 뿜기 */
    const b = R.root.children[0].getLocalBounds();
    const s0 = Math.abs(R.root.scale.y), sx = Math.sign(R.root.scale.x) || 1, out = side ? -1 : 1;
    /*
     * 커지는 크기 (11/13 대표님 2차 «캐슬 전체가 아니라 1층 = 깃발 높이 정도까지만») : 키 상한 = 캐슬 밑동 ~ 땅 깃발 꼭지.
     * 픽셀이 고르게 보이는 배율만 쓴다 — 그림 1칸 = 화면 n칸(정수) 또는 앉은 크기의 k배(정수 · 앉은 용과 같은 칸 모양을 k배로).
     * 그중 상한을 넘지 않는 가장 큰 것 = 마지막, 그 아래 가장 큰 것 = 중간(쑥 · 쑥). 깃발이 없으면 캐슬 높이의 절반.
     */
    const cap = Math.max(40, (flagTop != null ? c.y - flagTop : Math.abs(c.height) * 0.5) * 1.04), hgt = Math.max(20, b.height);
    const cands = [1, 2, 3, 4, 2 * s0, 3 * s0, 4 * s0].filter((k) => k > s0 * 1.15).sort((x, y) => x - y);
    const fit = cands.filter((k) => k * hgt <= cap);
    const big = fit.length ? fit[fit.length - 1] : cands[0], below = cands.filter((k) => k < big - 0.05);
    const mid = below.length ? below[below.length - 1] : (s0 + big) / 2;
    const idx = stage.getChildIndex(R.root), next = stage.children[idx + 1] || null;
    stage.setChildIndex(R.root, Math.max(0, stage.getChildIndex(units) - 1));   /* 캐슬 · 알 · 앞 짚 앞, 출전 용 뒤 */
    /*
     * 내려앉는 자리 (11/13 대표님 3차 «깃발 옆으로 나가지 말고 거의 아래로 떨어져 성문 앞(캐슬 가운데)에서») : 캐슬 가로 가운데에서 앞으로 6% 만.
     * 그리고 커진 입이 좀비가 설 수 있는 가장 앞자리(코어 사거리 최소 30 → 기지 앞 20칸)보다 뒤에 오게 — 입 왼쪽 좀비가 타는 일이 없게.
     * 입 자리 = 그 용의 머리 그림에서 잼(rig mouth) · 캐슬 자리 · 크기는 코드에서 읽는다(숫자를 박지 않음).
     */
    const mg = R.mouth?.(), mp = mg ? stage.toLocal(mg) : null;
    const mouthOff = mp ? Math.max(0, ((mp.x - R.root.x) / R.root.scale.x) * sx) * big + 4 : 50;
    const lx = out > 0 ? Math.min(c.x + Math.abs(c.width) * 0.06, M + 20 - mouthOff) : Math.max(c.x - Math.abs(c.width) * 0.06, FIELD - M - 20 + mouthOff);
    const D = { R, t: 0, s0, sx, out, big, mid, cap, hgt, foot: b.y + b.height, hx: R.root.x, hy: R.root.y, lx: Math.round(lx), ly: Math.round(c.y), next, fired: false, hold: 0 };
    dives[side] = D; R.dive = D;
    if (import.meta.env?.DEV) window.__idgDive = { big, mid, s0, hgt: Math.round(hgt), cap: Math.round(cap), giantH: Math.round(big * hgt) };   /* 점검용 (tools/_breath-gif.mjs) */
    R.set('jump'); shake(0.12);   /* 누르자마자 «쿵» 한 번 */
  }
  function diveFire(side) {   /* 코어가 불을 냈다 (누른 지 12틱) — 화면이 늦었으면 커진 자세로 바로 */
    const D = dives[side]; if (!D) return;
    D.fired = true; if (D.t < DV.fire) D.t = DV.fire;
  }
  function diveUpdate(dt) {
    for (let side = 0; side < 2; side++) {
      const D = dives[side]; if (!D) continue;
      const R = D.R;
      if (R.root.destroyed) { dives[side] = null; continue; }
      const t0 = D.t;
      let t = t0 + dt;
      if (!D.fired && t >= DV.fire && (D.hold += dt) < 0.6) t = DV.fire - 1e-4;   /* 불(코어)이 아직이면 커진 채 기다림 (멀티 기다림 등 · 0.6초까지) */
      D.t = t;
      const cross = (at) => t0 < at && t >= at;
      if (t >= DV.back) {   /* 제자리 : 캐슬 위에서 다시 알 품기 */
        R.root.position.set(D.hx, D.hy); R.root.scale.set(D.sx * D.s0, D.s0); R.set('idle');
        if (D.next && D.next.parent === stage) stage.setChildIndex(R.root, stage.getChildIndex(D.next));
        dives[side] = null; R.dive = null;
        continue;
      }
      let x, y, s, st;
      if (t < DV.hop) {   /* 툭 떨어짐 : 살짝 뛰어올랐다가(첫 25%) 거의 수직으로 가속하며 떨어진다 (3차) */
        const k = t / DV.hop, ty = D.ly - D.foot * D.s0; s = D.s0; st = 'jump';
        x = D.hx + (D.lx - D.hx) * Math.min(1, k * 1.4);
        if (k < 0.25) { const u = k / 0.25; y = D.hy - 14 * u * (2 - u); } else { const u = (k - 0.25) / 0.75; y = D.hy - 14 + (ty - D.hy + 14) * u * u; }
      } else if (t < DV.small) {   /* 땅 : 쑥 · 쑥 → 뿜기 → 한 번 줄고 */
        s = t < DV.grow1 ? D.s0 : t < DV.grow2 ? D.mid : t < DV.end ? D.big : D.mid;
        st = t >= DV.fire && t < DV.end ? 'fire' : 'idle';
        x = D.lx; y = D.ly - D.foot * s;
        if (st === 'fire') {   /* 뒤로 살짝 밀림 + 떨림 (칸 단위) */
          const k = Math.min(1, (t - DV.fire) / 0.3), f = Math.floor(t * 30);
          x += -D.out * Math.round(12 * k) + (f % 2 ? 3 : -3); y += f % 3 === 0 ? 2 : 0;
        }
      } else {   /* 원래 크기로 캐슬 위로 폴짝 */
        const k = (t - DV.small) / (DV.back - DV.small); s = D.s0; st = 'jump';
        x = D.lx + (D.hx - D.lx) * k; y = D.ly - D.foot * s + (D.hy - (D.ly - D.foot * s)) * k - 44 * 4 * k * (1 - k);
      }
      R.root.position.set(Math.round(x), Math.round(y)); R.root.scale.set(D.sx * s, s); R.set(st);
      if (t < DV.small) R.root.x = Math.round(R.root.x + peek(R));   /* 화면 밖이면 2/3 보이게 (폴짝 돌아갈 때는 제자리로) */
      if (cross(DV.hop)) { dust(D.lx, D.ly, 30, 46); shake(0.24); }                                /* 쿵 (내려앉음) */
      if (cross(DV.grow1) || cross(DV.grow2)) { dust(D.lx, D.ly, 10, 26 * s); shake(0.1); }       /* 쑥 · 쑥 */
      if (cross(DV.end) || cross(DV.small)) dust(D.lx, D.ly, 6, 20 * s);                          /* 줄어듦 */
    }
  }
  /** 커진(또는 앉은) 대장 드래곤의 입 자리 (전장 좌표) — 없으면 null */
  function mouthOf(side) {
    const R = leaders()[side], g = R?.root && !R.root.destroyed ? R.mouth?.() : null;
    if (!g) return null;
    const p = wl.toLocal(g); return { x: p.x, y: p.y };
  }

  /*
   * ── 브레스 불 (11/13 대표님 2차) — 코어가 불을 낸 때(누른 지 0.4초)부터 0.8초 = 시간표 0.40 ~ 1.20
   * 화염방사기처럼 입 높이에서 앞으로 «수평» 일자로 사거리 끝(코어 leader.range → battleView x1)까지. 땅으로 꺾이지 않는다.
   *  · 앞머리가 0.18초 만에 빠르게 뻗어 나감 · 입 쪽은 가늘게 나와 굵어지고 · 끝 32% 는 점점 가늘고 듬성(체크무늬)해지며 색이
   *    흰노랑 → 주황 → 빨강 → 검붉음 → 연기 조각으로 (투명 흐림 없음 · 칼로 자른 끝 없음)
   *  · 꺼질 때(0.6초~) 입 쪽부터 끊겨 앞으로 밀려나가고, 지나간 자리에 잔불 · 연기 조각이 잠깐 남았다 깜박이며 사라짐
   * 칸 = BC(6칸) 네모 · 화면 전체를 붉게 · 어둡게 물들이지 않는다(커진 드래곤이 어두워지지 않게 · 2차 [5]).
   */
  const BC = 6;
  const shade = (c, k) => (Math.round(((c >> 16) & 255) * k) << 16) | (Math.round(((c >> 8) & 255) * k) << 8) | Math.round((c & 255) * k);
  const hash = (a, b, c) => { let h = (a * 73856093) ^ (b * 19349663) ^ (c * 83492791); h = Math.imul(h ^ (h >>> 13), 0x5bd1e995); return ((h ^ (h >>> 15)) >>> 0) / 4294967296; };
  let br = null;   // { t, x0, y0, x1, cols, side, lo, hi, left }
  function startBreath({ side, x0, y0, x1, cols, S, V }) {
    const m = mouthOf(side); if (m) { x0 = m.x; y0 = m.y; }
    snd('ult_breath_pillar');   /* «화르르르» */
    br = { t: 0, x0, y0, x1, cols, side, lo: Math.min(x0, x1, side ? Infinity : M - 40) - 30, hi: Math.max(x0, x1, side ? FIELD - M + 40 : -Infinity) + 30, left: false };   /* 타는 구간 = 캐슬 앞부터(입이 앞으로 나와 있어도) */
    let n = 0;
    for (const u of S.units) { const v = V.get(u.id); if (!v || !u.alive || u.side === side) continue; if (v.x < br.lo || v.x > br.hi || (v.x - x0) * (x1 >= x0 ? 1 : -1) < 0) continue; if (n++ < MAX_BURN) v.burnT = -reach(v.x); }   /* 입보다 뒤에 있는 것은 불붙지 않는다 (3차) */   /* 살아남은 좀비 · 보스 : 불이 닿는 순간부터 잠깐 불붙음 */
  }
  /** 불 앞머리가 x 에 닿기까지 걸리는 초 (0 ~ FRONT_T) */
  function reach(x) {
    const B = br; if (!B) return 0;
    const L = Math.max(40, Math.abs(B.x1 - B.x0)), s = (x - B.x0) * (B.x1 >= B.x0 ? 1 : -1);
    if (s <= 0) return 0;
    const f = Math.min(1, s / L);   /* 앞머리 = L × (1 − (1 − t/FRONT_T)²) 의 거꿀셈 */
    return FRONT_T * (1 - Math.sqrt(1 - f));
  }
  const FRONT_T = 0.18, CUT_AT = 0.6, CUT_T = 0.2;
  function drawFlame(B, t) {
    const g = beamG, dir = B.x1 >= B.x0 ? 1 : -1, L = Math.max(40, Math.abs(B.x1 - B.x0));
    const c0 = B.cols[0], c1 = B.cols[1] || B.cols[0];
    const k0 = Math.min(1, t / FRONT_T), front = L * (1 - (1 - k0) * (1 - k0)) + (k0 >= 1 ? L * 0.12 : 0);   /* 다 뻗으면 끝 너머 연기 12% */
    const cut = t > CUT_AT ? L * 1.15 * Math.min(1, (t - CUT_AT) / CUT_T) : 0;
    const fr = Math.floor(t * 30), HM = 30, y0 = Math.round(B.y0);
    for (let s = Math.floor(cut / BC) * BC; s < front; s += BC) {
      const f = s / L, col = Math.round(s / BC);
      const tail = f < 0.68 ? 0 : Math.min(1.4, (f - 0.68) / 0.32);   /* 0 = 몸통 · 1 = 사거리 끝 · 1 넘음 = 연기 */
      let h = f < 0.22 ? 8 + (HM - 8) * (f / 0.22) : HM;              /* 입에서 가늘게 나와 굵어짐 */
      if (tail > 0) h *= Math.max(0.18, 1 - tail * 0.78);              /* 끝으로 갈수록 가늘게 */
      if (cut > 0 && s - cut < 36) h *= Math.max(0.35, (s - cut) / 36);   /* 끊긴 꼬리도 뭉툭하지 않게 */
      if (front - s < 30 && k0 < 1) h *= Math.max(0.4, (front - s) / 30);  /* 뻗어 나가는 앞머리 */
      const wob = Math.round(Math.sin(col * 0.8 + t * 26) * 2), x = Math.round(B.x0 + dir * s - (dir < 0 ? BC : 0));
      const rows = Math.max(1, Math.ceil(h / BC)), down = Math.max(1, Math.ceil((h * (1 + 1.25 * Math.min(1, f / 0.3))) / BC));   /* 위 끝은 일자 · 아래쪽만 조금 더 퍼져 좀비 머리에 닿음 (화염방사기 불꽃 퍼짐) */
      for (let r = -rows; r < down; r++) {
        const q = r < 0 ? Math.abs(r + 0.5) / rows : (r + 0.5) / down, hh = hash(col, r, fr);
        if (q > 0.75 && hh < 0.4) continue;                                       /* 들쭉날쭉한 겉 */
        if (tail > 0 && hh < Math.min(0.85, tail * 0.62)) continue;               /* 끝으로 갈수록 듬성 */
        if (tail > 0.45 && ((col + r) & 1)) continue;                             /* 체크무늬(디더) */
        let c;
        if (tail > 1) c = hh < 0.5 ? 0x3a3036 : 0x4e4248;                         /* 연기 조각 */
        else if (tail > 0.78) c = q < 0.5 ? shade(c0, 0.55) : 0x4a1a16;          /* 검붉음 */
        else if (tail > 0.45) c = q < 0.45 ? c0 : shade(c0, 0.7);                 /* 빨강 쪽 */
        else if (tail > 0.15) c = q < 0.3 ? c1 : q < 0.7 ? c0 : shade(c0, 0.8);   /* 주황 */
        else c = q < 0.3 ? 0xfff4c8 : q < 0.62 ? c1 : c0;                         /* 흰노랑 심 · 속 · 겉 */
        g.rect(x, y0 + wob + r * BC, BC, BC).fill(c);
      }
      if (hash(col, 7, fr) < 0.05) addP(wl, x + 3, y0 - h, 4, 4, tail > 0.6 ? 0x4a4248 : hash(col, 9, fr) < 0.5 ? c1 : 0xfff0a0, { vx: dir * 40, vy: -70 - hash(col, 3, fr) * 90, g: 60, life: 0.35, kind: tail > 0.6 ? 'smoke' : undefined });   /* 불티 · 연기 */
    }
  }
  function breathUpdate(dt) {
    beamG.clear();
    if (!br) { fireB.show(0); tintA.fire = 0; return; }
    const B = br; B.t += dt; const t = B.t;
    const m = mouthOf(B.side); if (m && t < CUT_AT) { B.x0 = m.x; B.y0 = m.y; }   /* 불은 커진 드래곤 입에서 (밀리고 떨리면 따라감) */
    fireB.build();
    fireB.show(0);   /* 화면 가장자리 불띠 · 붉은 물듦 없음 (3차 · 과한 빛번짐 금지) */
    tintA.fire = 0;
    if (t < CUT_AT + CUT_T) { drawFlame(B, t); if (t < CUT_AT) shake(0.05); }
    if (!B.left && t >= CUT_AT) {   /* 꺼짐 : 지나간 자리에 잔불 · 연기 조각 (잠깐 남았다 깜박이며 사라짐) */
      B.left = true;
      const dir = B.x1 >= B.x0 ? 1 : -1, L = Math.abs(B.x1 - B.x0);
      for (let s = 20; s < L * 1.05; s += 22) {
        const smoke = s > L * 0.6 || Math.random() < 0.45, big = Math.random() < 0.4;
        addP(wl, B.x0 + dir * s + (Math.random() - 0.5) * 12, B.y0 + (Math.random() - 0.5) * 30, big ? 8 : 5, big ? 8 : 5, smoke ? (Math.random() < 0.5 ? 0x3a3036 : 0x5a4e54) : (Math.random() < 0.5 ? B.cols[0] : 0xffd04a),
          { vx: dir * 20 + (Math.random() - 0.5) * 20, vy: -25 - Math.random() * 35, life: 0.45 + Math.random() * 0.35, kind: 'smoke', delay: (s / L) * CUT_T });
      }
    }
    if (t >= 0.1 && t < 0.9) for (let i = 0; i < 2; i++) addP(scr, Math.random() * W(), 545, Math.random() < 0.4 ? 4 : 2, Math.random() < 0.4 ? 4 : 2, [0xffd04a, 0xff8a2a][i], { vx: (Math.random() - 0.5) * 60, vy: -180 - Math.random() * 200, life: 1.6, kind: 'ember' });
    if (t > 1.6) { br = null; fireB.show(0); }
  }
  /* 살아남은 좀비 · 보스가 맞음 : 불이 닿는 순간부터 1초 — 주황 · 검붉게 깜박 · 몸 위 불꽃 · 검은 연기 */
  function burnUpdate(u, v, dt, o) {
    if (v.burnT == null) return;
    v.burnT += dt;
    if (v.burnT < 0) return;
    if (!u.alive || v.burnT > 1.0) { v.burnT = null; v.flame?.destroy(); v.flame = null; return; }
    o.tint = Math.floor(v.burnT * 12) % 2 ? 0xff9a5a : 0x8a4a3a;
    if (import.meta.env?.DEV && br && (v.x - br.x0) * (br.x1 >= br.x0 ? 1 : -1) < 0) window.__idgBurnBad = (window.__idgBurnBad || 0) + 1;
    if (!v.flame && torchFx) { const f = new AnimatedSprite(torchFx.frames); f.anchor.set(0.5, 1); f.scale.set(u.boss ? 0.8 : 0.5); f.animationSpeed = torchFx.meta.fps / 60; f.play(); wl.addChild(f); v.flame = f; }
    if (v.flame) v.flame.position.set(Math.round(v.x), Math.round(v.y - (v.h || 50) * 0.35));
    if (Math.random() < 0.3) addP(wl, v.x + (Math.random() - 0.5) * 14, v.y - (v.h || 50) * 0.8, 4, 4, Math.random() < 0.5 ? 0x2a2224 : 0x4a4044, { vx: (Math.random() - 0.5) * 20, vy: -50, life: 0.5 });
  }
  /* 재 더미 : 무너진 자리에 · 불씨 몇 점 · 0.8초 뒤 깜박이다 사라짐 (투명 페이드 없음) */
  function ash(v, big) {
    snd('ult_ash_crumble', 0.2);   /* «푸스스» */
    const g = new Graphics(), x = Math.round(v.x), y = Math.round(v.y);
    g.rect(-12, -3, 24, 3).fill(0x3a3438).rect(-9, -6, 18, 3).fill(0x4a4448).rect(-5, -9, 10, 3).fill(0x5e585c).rect(-2, -11, 4, 2).fill(0x6e686c)
      .rect(-7, -4, 2, 1).fill(0xff8a2a).rect(4, -7, 2, 1).fill(0xffc04a).rect(1, -3, 1, 1).fill(0xff5a1a);
    if (big) g.scale.set(2);
    g.position.set(x, y); wl.addChild(g);
    ps.push({ s: g, vx: 0, vy: 0, g: 0, life: 1.3, t: 0, kind: 'ash' });
    for (let i = 0; i < 8; i++) addP(wl, x + (Math.random() - 0.5) * 22, y - 4 - Math.random() * 10, i % 3 ? 4 : 6, i % 3 ? 4 : 6, [0x3a3236, 0x6e5a46, 0x1e1a1c][i % 3], { vx: (Math.random() - 0.5) * 120, vy: -40 - Math.random() * 60, g: 300, life: 0.45 });   /* 무너질 때 먼지 · 잿조각 */
  }
  /*
   * 브레스에 쓰러진 좀비 (11/13 대표님 2차 «한 번에 싹 사라지지 않게») — 코어에서는 이미 죽었다 · 화면만 남은 몸(v.R)으로 :
   *  불이 닿을 때까지 그대로 → ① 0.14초 깜짝(튀어 오름 · 느낌표 · 놀란 얼굴) → ② 0.7초 불탐(몸에 불꽃 · 주황→검게 그을림 · 허우적 · 연기)
   *  → ③ 0.12초 무너짐(두 칸 납작) → 재 더미 · 잿조각 (잠깐 남았다 깜박이며 사라짐). 투명 페이드 없음.
   */
  const C_SHOCK = 0.14, C_BURN = 0.84, C_FALL = 0.96;
  function corpse(v, dt) {
    const R = v.R.root, h = v.h || 50, c = v.burn;
    c.t += dt; const t = c.t;
    R.filters = null;   /* 맞은 순간의 흰 번쩍 필터가 남지 않게 */
    if (t < 0) return false;
    const f = v.side === 0 ? 1 : -1;
    if (t < C_SHOCK) {   /* ① 깜짝 */
      if (!c.snd) { c.snd = 1; snd('ult_zombie_burn', 0.15); }   /* «치익» */
      v.R.set('kb'); v.R.update(dt);
      if (c.tx != null) v.x += (c.tx - v.x) * Math.min(1, t / C_SHOCK + 0.25);
      if (!c.bang) { c.bang = new Graphics().rect(-4, -17, 8, 13).fill(OUT_N).rect(-4, -3, 8, 6).fill(OUT_N).rect(-2, -15, 4, 9).fill(0xffe040).rect(-2, -1, 4, 2).fill(0xffe040); wl.addChild(c.bang); }
      const dy = -Math.round(Math.sin((t / C_SHOCK) * Math.PI) * 12);
      R.position.set(Math.round(v.x), Math.round(v.y + dy)); R.tint = 0xffffff;
      c.bang.position.set(Math.round(v.x), Math.round(v.y + dy - h - 14));
      return false;
    }
    if (c.bang) { c.bang.destroy(); c.bang = null; }
    if (c.tx != null) { v.x = c.tx; c.tx = null; }
    if (t < C_BURN) {   /* ② 불탐 */
      const k = (t - C_SHOCK) / (C_BURN - C_SHOCK), fl = Math.floor(t * 12) % 2;
      v.R.set(Math.floor(t * 9) % 2 ? 'hit' : 'kb'); v.R.update(dt * 1.6);
      R.tint = k < 0.35 ? (fl ? 0xff9a5a : 0xc0603a) : k < 0.7 ? (fl ? 0x9a4a30 : 0x5a3028) : (fl ? 0x3a2422 : 0x2a1c1c);
      R.rotation = Math.sin(t * 30) * 0.16 * f;
      if (import.meta.env?.DEV && br && (v.x - br.x0) * (br.x1 >= br.x0 ? 1 : -1) < 0) window.__idgBurnBad = (window.__idgBurnBad || 0) + 1;   /* 점검용 : 입 뒤에서 타는 장면 수 (tools/_breath-gif.mjs) */
      R.position.set(Math.round(v.x + (Math.floor(t * 20) % 2 ? 1 : -1)), Math.round(v.y));
      if (!c.fl && torchFx) {
        c.fl = [0, 1].slice(0, v.big ? 2 : 1).map((i) => { const a = new AnimatedSprite(torchFx.frames); a.anchor.set(0.5, 1); a.scale.set(v.big ? 0.75 : 0.5); a.animationSpeed = torchFx.meta.fps / 60; a.gotoAndPlay(i * 3); wl.addChild(a); return a; });
      }
      c.fl?.forEach((a, i) => a.position.set(Math.round(v.x + (i ? -10 : 4) * f), Math.round(v.y - h * (i ? 0.2 : 0.38))));
      if (Math.random() < 0.45) addP(wl, v.x + (Math.random() - 0.5) * 16, v.y - h * (0.5 + Math.random() * 0.5), 4, 4, Math.random() < 0.5 ? 0x2a2224 : 0x4a4044, { vx: (Math.random() - 0.5) * 24, vy: -60, life: 0.5, kind: 'smoke' });
      if (Math.random() < 0.25) addP(wl, v.x + (Math.random() - 0.5) * 16, v.y - h * Math.random(), 3, 3, Math.random() < 0.5 ? 0xffd04a : 0xff7a1a, { vx: (Math.random() - 0.5) * 50, vy: -80, g: 120, life: 0.35 });
      return false;
    }
    c.fl?.forEach((a) => a.destroy()); c.fl = null;
    if (t < C_FALL) {   /* ③ 무너짐 : 두 칸에 걸쳐 납작 (발밑 기준) */
      if (c.sy == null) c.sy = R.scale.y;
      R.rotation = 0; R.tint = 0x2a1c1c; R.position.set(Math.round(v.x), Math.round(v.y));
      R.scale.y = c.sy * (t < (C_BURN + C_FALL) / 2 ? 0.6 : 0.3);
      return false;
    }
    R.visible = false; ash(v, v.big);
    return true;
  }

  /* ── 매 장면 */
  const seen = { sl: null, rage: null, br: null, wind: null };
  let brPend = null;   // 브레스가 막 나간 순간 { side, lo, hi, t } — 같은 걸음에 쓰러져 사라진 좀비도 재가 되게 (syncUnits 보다 먼저 봄)
  const O = { dx: 0, dy: 0, rot: 0, pose: null, tint: null };
  function detect(S, V) {
    const P = S.players;
    if (!seen.sl) { seen.sl = P.map((p) => p.skills.map((s) => s.left)); seen.rage = P.map((p) => p.st.rageUse); return; }
    P.forEach((p, i) => {
      p.skills.forEach((s, k) => {
        const was = seen.sl[i][k]; seen.sl[i][k] = s.left;
        if (was != null && s.left < was) {
          if (NAMES[s.id]) banner(s.id);
          if (s.id === 'frost') startFrost(s.def.freeze || 4);
          else if (s.id === 'gust') startGust(p.side);
        }
      });
      if (p.st.rageUse > seen.rage[i]) { banner('rage'); startRage(p.side, S, V); }
      seen.rage[i] = p.st.rageUse;
    });
  }

  return {
    get offY() { return Math.round(offY); },
    /** battleView 브레스 불(코어 st.breath · 누른 지 0.4초) 때 : 커진 드래곤 입에서 불기둥 · 붉은 화면 · 불타는 좀비 (제목 띠는 누른 때 detect 에서) */
    breath(o) { diveFire(o.side); startBreath(o); },
    /** 그 편 대장 드래곤이 내려와 있는 중인가 (battleView : 자세 · 자리를 건드리지 않게) */
    diving(side) { return !!dives[side]; },
    /** 유닛마다 (syncUnits 안) — 화면 위치 덧셈 · 자세 · 색 · 멈춤(v.hold) */
    unit(u, v, dt) {
      O.dx = 0; O.dy = 0; O.rot = 0; O.pose = null; O.tint = null;
      v.side = u.side; v.u = u;   /* 쓰러진 뒤에도 누가 쓰러뜨렸는지(killer) 보려고 */
      iceUpdate(u, v, dt, O);
      if (v.roarT != null) { v.roarT += dt; if (v.roarT > 0.3 || !u.alive) { v.roarT = null; v.hold = false; } else v.hold = true; }   /* 기획 13.2 : 출전 카드(아군 용)는 입을 벌리지 않고 그 자리에 0.3초 멈춰 서기만 (화면만) */
      if (v.scareT != null) {   /* 움찔 : 떨림 · 머리 위 도트 느낌표 */
        v.scareT += dt;
        if (v.scareT > 1.0 || !u.alive) { v.scareT = null; v.bang?.destroy(); v.bang = null; }
        else if (v.scareT > 0) {
          O.dx += Math.floor(v.scareT * 36) % 2 ? 1.5 : -1.5; O.tint = 0xdcd8ff;
          if (!v.bang) { const g = new Graphics().rect(-4, -17, 8, 13).fill(OUT_N).rect(-4, -3, 8, 6).fill(OUT_N).rect(-2, -15, 4, 9).fill(0xffe040).rect(-2, -1, 4, 2).fill(0xffe040); wl.addChild(g); v.bang = g; }   /* 도트 느낌표 (외곽선) */
          v.bang.position.set(Math.round(v.x), Math.round(v.y - (v.h || 50) - 16 - (v.scareT < 0.1 ? 4 : 0)));
        }
      }
      if (torn && torn.x != null && u.side !== torn.side && u.alive && !torn.swept.has(u.id)) {   /* 회오리가 지나가는 순간 휘청 */
        const px = sx(v.x); if ((torn.dir > 0 && px <= torn.x) || (torn.dir < 0 && px >= torn.x)) { torn.swept.add(u.id); v.gustT = 0; }
      }
      if (v.gustT != null) {
        v.gustT += dt; const k = v.gustT / 0.7;
        if (k >= 1) v.gustT = null;
        else { O.rot += Math.sin(v.gustT * 38) * 0.38 * (1 - k); O.dy -= Math.sin(k * Math.PI) * 22; }
      }
      burnUpdate(u, v, dt, O);
      return O;
    },
    /** 매 장면 맨 처음 (syncUnits 보다 먼저) : 브레스 발동을 미리 알아 둔다 */
    pre(S, dt) {
      iceBudget = 4;
      /* breathWind (누른 틱 · 코어 p.st.wind) : 제목 띠 바로 · 드래곤 내려오기 시작 (기획 13.1 · 13.3) — 불(st.breath)을 보는 battleView effects 보다 먼저 */
      const w = S.players.map((p) => p.st.wind || 0);
      if (seen.wind) S.players.forEach((p, i) => { if (w[i] > seen.wind[i]) { banner('breath'); startDive(p.side); } });
      seen.wind = w;
      const n = S.players.map((p) => p.st.breath);
      if (seen.br) S.players.forEach((p, i) => { if (n[i] > seen.br[i]) { const lo = M - 40, hi = M + p.leader.range + 40; brPend = { side: p.side, lo: p.side ? FIELD - hi : lo, hi: p.side ? FIELD - lo : hi, t: 0 }; } });
      seen.br = n;
      if (brPend && (brPend.t += dt) > 0.6) brPend = null;
    },
    /** 쓰러지기 시작할 때 : true = 브레스에 쓰러짐 → battleView 가 몸을 지우지 않고 매 장면 corpse(v) 를 부른다(놀람 → 불탐 → 재) */
    die(v) {
      if (v.ice) iceOff(v, true);
      v.bang?.destroy(); v.bang = null; v.flame?.destroy(); v.flame = null;
      const B = br && br.t < 0.6 ? br : brPend, u = v.u;
      const byBreath = !u || (u.killer == null && u.killOwner != null && u.killOwner >= 0);   /* 때린 유닛 없이(브레스) 쓰러진 것만 — 보통 전투로 쓰러진 것은 기존대로 */
      if (!byBreath || !B || v.side === B.side || v.x < B.lo || v.x > B.hi) return false;
      v.big = !!(u && u.boss) || (v.h || 0) > 90;
      v.R.root.filters = null;   /* 맞은 순간의 흰 번쩍이 남지 않게 */
      v.burn = { t: 0, bang: null, fl: null, sy: null, wait: true };   /* 불 앞머리가 닿는 때는 불(br)이 시작된 뒤에 정함 (corpse) */
      return true;
    },
    /** 브레스에 쓰러진 몸 (매 장면) — true = 끝(재 더미가 남음 · 몸은 지워도 됨) */
    corpse(v, dt) {
      const c = v.burn; if (!c) return true;
      if (c.wait) {
        if (!br) return false;
        c.wait = false; c.t = -reach(v.x);
        const dir = br.x1 >= br.x0 ? 1 : -1;   /* 입보다 뒤(또는 바로 앞)에 쓰러진 좀비는 깜짝 뛰어오르며 입 앞으로 튕겨 나온 뒤에 탄다 — 입 뒤에서 타는 장면이 없게 (3차) */
        if ((v.x - br.x0) * dir < 12) c.tx = br.x0 + dir * (16 + Math.random() * 14);
      }
      const done = corpse(v, dt);
      if (done) { c.bang?.destroy(); c.fl?.forEach((x) => x.destroy()); }
      return done;
    },
    update(S, dt, V) {
      detect(S, V);
      drawBanner(dt); frostUpdate(dt); gustUpdate(dt); rageUpdate(dt, S, V); diveUpdate(dt); breathUpdate(dt); drawTint();
      offY = offY > 0.5 ? offY * Math.max(0, 1 - dt * 14) : 0;
      for (let i = rings.length - 1; i >= 0; i--) {   /* 도트 음파 고리 : 네모 점이 원을 따라 퍼짐 */
        const r = rings[i]; r.t += dt; const k = r.t / r.life;
        if (k >= 1) { r.g.destroy(); rings.splice(i, 1); continue; }
        const rad = 8 + (r.r1 - 8) * (1 - (1 - k) * (1 - k)), n = Math.max(14, Math.min(90, Math.round(rad * 0.7))), sz = k < 0.55 ? 5 : 3;
        r.g.clear();
        for (let j = 0; j < n; j++) {   /* 두 겹 : 바깥 흰 · 안 금빛 (도트 네모 · 군데군데 빔) */
          if ((j + Math.floor(r.t * 20)) % 5 === 4) continue;
          const a = (j / n) * Math.PI * 2, c = Math.cos(a), s2 = Math.sin(a) * 0.8;
          r.g.rect(Math.round(r.x + c * rad) - sz / 2, Math.round(r.y + s2 * rad) - sz / 2, sz, sz).fill(r.col);
          if (rad > 14) r.g.rect(Math.round(r.x + c * (rad - 7)) - 1, Math.round(r.y + s2 * (rad - 7)) - 1, 3, 3).fill(0xffc83a);
        }
      }
      for (let i = ps.length - 1; i >= 0; i--) {
        const q = ps[i]; q.t += dt;
        if (q.kind === 'snow') { q.s.x += (q.vx + Math.sin(q.t * 3 + q.ph) * 20) * dt; q.s.y += q.vy * dt; if (q.s.y > 545) q.t = q.life; }
        else if (q.kind === 'shard') {
          if (!q.landed) { q.vy += q.g * dt; q.s.x += q.vx * dt; q.s.y += q.vy * dt; if (q.vy > 0 && q.s.y >= q.floor) { q.s.y = q.floor; q.landed = q.t; q.s.rotation = 0; } }
          else if (q.t - q.landed > 0.5) q.s.visible = Math.floor((q.t - q.landed) * 12) % 2 === 0;   /* 땅에서 깜박 */
        } else if (q.kind === 'ash') { q.s.visible = q.t < 0.8 || Math.floor(q.t * 12) % 2 === 0; }
        else if (q.kind === 'smoke' && q.delay > 0) { q.s.visible = false; q.delay -= dt; q.t -= dt; }   /* 잔불 · 연기 : 꺼지는 꼬리가 지나간 뒤에 나타남 */
        else if (q.kind === 'smoke') { q.s.visible = q.life - q.t > 0.2 || Math.floor(q.t * 14) % 2 === 0; q.s.x += q.vx * dt; q.s.y += q.vy * dt; }
        else { q.vy += (q.g || 0) * dt; q.s.x += q.vx * dt; q.s.y += q.vy * dt; }
        if (q.t >= q.life) { q.s.destroy(); ps.splice(i, 1); if (q.kind in nK) nK[q.kind]--; }
      }
    },
    destroy() {
      gone = true;
      for (const q of ps) if (!q.s.destroyed) q.s.destroy();
      ps.length = 0; rings.length = 0; nK.snow = nK.wind = nK.ember = 0;
      if (!layer.destroyed) layer.destroy({ children: true });
    },
  };
}
