/**
 * 드래곤캐슬 그리기 도구 (겜보조 2 · 11/13) — 전투 · 로비 · 꾸미기 미리보기가 같이 쓴다 (깃발 버그 : 모두 같은 함수 하나).
 *
 *  좌표 약속 : 캐슬 «밑동 가운데» = (0, 0), 위쪽 = 마이너스. 단계마다 크기가 달라서 기준점은 ai/meta/castle_anchor.json
 *  (hp0 그림 픽셀 · 왼쪽 위 원점) 에서 읽어 (x − w/2, y − h) 로 바꾼다.
 *  그림 : 1단계 = 지금 nest_*(깃발 없는 그림) · 2 ~ 10단계 = keep_sNN_* (hp0 ~ hp3 · fall0 · fall1 · rubble · ruin · 8상태).
 *  decoOf(save) = 저장값 → 그릴 것(단계 · 지붕 · 성문 · 앞마당 · 깃발 · 오라 · 펫 · 끼운 장비). 가진 것만 그린다.
 *  속도 : 입은 것 그림만 받는다 · 시트 1장은 칸으로 잘라 쓴다 · 색 필터 없음.
 */
import { Assets, Container, Sprite, AnimatedSprite, Graphics, Texture, Rectangle } from 'pixi.js';
import { decodeWear } from '../data/lookFx.js';
import { equippedGear } from '../data/upgrades.js';

export const AI = '/assets/iandragon_game/ai/';
const nearest = (t) => { if (t?.source) t.source.scaleMode = 'nearest'; return t; };
const tryLoad = (url) => Assets.load(url).then(nearest).catch(() => null);
/** webp 먼저 · 없으면 png */
export const img = (base) => tryLoad(`${base}.webp`).then((t) => t || tryLoad(`${base}.png`));

/* ── 저장값 → 그릴 것 ── */
const own = (g, slot, id) => !!id && Array.isArray(g?.owned) && g.owned.includes(`${slot}:${id}`);
/** 캐슬 단계(모습) : 가진 단계 안에서 고른 것 · 없으면 1 */
export function skinOf(g) {
  const lv = Math.max(1, Math.min(10, Number(g?.castle?.lv) || 1)), s = Number(g?.castle?.skin) || lv;
  return Math.max(1, Math.min(lv, s));
}
/** 저장값 g → { skin, roof, gate, yard, flag, aura, pet, gear:[{id,lv}] } (안 입었거나 안 가진 것은 null) */
export function decoOf(g) {
  const w = { ...decodeWear(g?.look), ...decodeWear(g?.clook) }, pick = (s) => (own(g, s, w[s]) ? w[s] : null);
  return { skin: skinOf(g), roof: pick('roof'), gate: pick('gate'), yard: pick('yard'), flag: pick('flag'), aura: pick('aura'), pet: pick('pet'), gear: equippedGear(g) };
}
/** 판에서 필요한 그림 이름 묶음 (미리 받기용) */
/** 1단계 = 옛 둥지 탑에서 깃발만 뺀 그림(_noflag · 깃발은 코드가 땅에 세운다) · 부서진 잔해(rubble · ruin)는 원래 깃발이 없다 */
const NOFLAG = ['hp0', 'hp1', 'hp2', 'hp3', 'fall0', 'fall1'];
export const keepBase = (skin, state) => (skin <= 1 ? `${AI}castles/nest_${state}${NOFLAG.includes(state) ? '_noflag' : ''}` : `${AI}castles/keep_s${String(skin).padStart(2, '0')}_${state}`);

/* ── 기준점 ── */
let anchorP = null;
export const loadAnchors = () => anchorP || (anchorP = fetch(`${AI}meta/castle_anchor.json`).then((r) => r.json()).then((j) => j.skins).catch(() => ({})));
const FALLBACK = { w: 212, h: 300, seat: [110, 66], roof: [72, 92, 50], gate: [103, 86], ledgeL: [56, 176], ledgeR: [156, 176] };
/** 화면에 그리는 캐슬 최대 높이 — 키 큰 캐슬(2~10단계 · 최대 360)은 위가 체력 막대에 가리지 않게 이 높이로 줄여 그린다 (1단계 둥지 탑 = 300 = 그대로) */
export const FIT_H = 300;
/** 단계 skin 의 기준점을 «밑동 가운데 (0,0)» 좌표 · 줄인 크기 기준으로 : { k(줄인 비율), w, h, seat, roof, roofW, gate, gateW, ledgeL, ledgeR } */
export async function anchorsOf(skin) {
  const a = (await loadAnchors())[String(skin)] || FALLBACK, k = Math.min(1, FIT_H / a.h), c = (p) => [(p[0] - a.w / 2) * k, (p[1] - a.h) * k];
  return { k, w: a.w * k, h: a.h * k, seat: c(a.seat), roof: c(a.roof), roofW: a.roof[2] * k, gate: [(a.gate[0] - a.w / 2) * k, 0], gateW: a.gate[1] * k, ledgeL: c(a.ledgeL), ledgeR: c(a.ledgeR) };
}

/* ── 그림 받기 ── */
const gearTier = (lv) => (lv >= 5 ? 5 : lv >= 3 ? 3 : 1);   /* Lv2 = Lv1 · Lv4 = Lv3 모습 */
/** 입은 것 + 끼운 장비 그림만 받는다 */
export async function loadDecoTex(d) {
  const jobs = {
    roof: d.roof && img(`${AI}meta/roof_${d.roof}`), gate: d.gate && img(`${AI}meta/gate_${d.gate}`), yard: d.yard && img(`${AI}meta/yard_${d.yard}`),
    flag: d.flag && img(`${AI}meta/flag_${d.flag}`), aura: d.aura && img(`${AI}meta/aura_${d.aura}`), pet: d.pet && img(`${AI}meta/pet_${d.pet}`),
  };
  const gear = await Promise.all(d.gear.map((x) => img(`${AI}castles/gear_${x.id}_lv${gearTier(x.lv)}`)));
  const out = { gear: Object.fromEntries(d.gear.map((x, i) => [x.id, gear[i]])) };
  await Promise.all(Object.entries(jobs).map(async ([k, p]) => { out[k] = p ? await p : null; }));
  return out;
}

/* ── 장식 (캐슬 밑동 가운데 = 0,0) ── */
function put(c, tex, x, y, w, ay = 1) { const s = new Sprite(tex); s.anchor.set(0.5, ay); s.scale.set(w / tex.width); s.position.set(Math.round(x), Math.round(y)); c.addChild(s); return s; }
/**
 * 지붕 · 성문 · 앞마당 · 장비 → { back, front, top } 컨테이너 (캐슬 그림 앞에 얹는다 · 뒤는 앞마당 뒤 비움)
 *  앞마당 = 캐슬 왼쪽 땅 · 성문 = 문 위에 덧씌움 · 지붕 = 탑 윗면 왼쪽 · 대포 = 오른쪽 위 · 경보 종 = 왼쪽 위 · 가시 울타리 = 성문 앞 땅 · 수리 둥지 = 왼쪽 아래
 */
export function buildDeco(A, d, tex) {
  const front = new Container(), back = new Container(), top = new Container(), W = A.w;
  if (tex.yard) put(front, tex.yard, -W * 0.5, 4, W * 0.34 * 256 / 230 * 0.9);
  if (tex.gear.repair) put(front, tex.gear.repair, -W * 0.26, 2, tex.gear.repair.width * A.k);
  if (tex.gate) put(front, tex.gate, A.gate[0], 2, A.gateW * 256 / 250, 0.975);
  if (tex.roof) put(top, tex.roof, A.roof[0], A.roof[1], A.roofW * 256 / 230, 0.975);
  if (tex.gear.bell) put(front, tex.gear.bell, A.ledgeL[0], A.ledgeL[1], tex.gear.bell.width * A.k);
  if (tex.gear.cannon) put(front, tex.gear.cannon, A.ledgeR[0], A.ledgeR[1], tex.gear.cannon.width * A.k);
  if (tex.gear.fence) put(front, tex.gear.fence, A.gate[0], 10, tex.gear.fence.width * A.k);
  return { back, front, top };   /* top = 지붕(알 품은 둥지 앞 · 용 · 짚 띠 위로 얹어야 가려지지 않는다) */
}

/* ── 깃발 (미리보기 · 로비 · 전투가 같은 함수) ──
 *  깃대 높이 = 캐슬 높이의 약 60% (상한 poleMax) · 천 = 캐슬 높이의 22% · 캐슬 오른쪽 밑동에 서 있다. 모든 깃발 같은 크기. */
export const FLAG = { pole: 0.6, cloth: 0.22 };
export function makeFlag(tex, castleH, { poleMax = Infinity, dir = 1 } = {}) {
  const h = Math.max(24, Math.min(Math.round(castleH * FLAG.pole), poleMax)), ch = Math.round(castleH * FLAG.cloth), cw = Math.round(ch * 2 / 3);
  const box = new Container();
  const pole = new Graphics()
    .rect(-5, -2, 10, 3).fill(0x3a2a1e)                                   /* 꽂힌 자리 흙 */
    .rect(-2, -h, 4, h).fill(0x3a2410).rect(-1, -h, 2, h).fill(0x6a4424)  /* 깃대 */
    .rect(-3, -h - 5, 6, 6).fill(0x5a3a10).rect(-2, -h - 4, 4, 4).fill(0xe0b040);   /* 꼭지 */
  const cloth = new Sprite(tex); cloth.anchor.set(0, 0); cloth.width = cw; cloth.height = ch; if (dir < 0) cloth.scale.x *= -1; cloth.position.set(dir * 2, -h + 2);
  box.addChild(pole, cloth);
  return { box, cloth, h };
}
/** 깃발 펄럭임 (보간 없이 skew 만 · 매 장면 불러 준다) */
export const wave = (cloth) => { cloth.skew.y = Math.sin(performance.now() / 260 + cloth.x) * 0.06; };

/* ── 오라 · 펫 (대장 드래곤 발 기준 · 시트에서 칸 잘라 씀) ── */
const cut = (tex, w, h, n) => Array.from({ length: n }, (_, i) => new Texture({ source: tex.source, frame: new Rectangle(i * w, 0, w, h) }));
/** 오라 : 발밑 납작한 타원 4칸(256×128) · width = 화면 폭 */
export function makeAura(tex, width) {
  const a = new AnimatedSprite(cut(tex, 256, 128, 4)); a.anchor.set(0.5, 0.5); a.scale.set(width / 256); a.animationSpeed = 6 / 60; a.play();
  return a;
}
/** 펫 : 2칸(160×160) 둥둥 · width = 그려지는 폭(칸 폭 기준) */
export function makePet(tex, width) {
  const a = new AnimatedSprite(cut(tex, 160, 160, 2)); a.anchor.set(0.5, 1); a.scale.set(width / 160); a.animationSpeed = 3 / 60; a.play();
  return a;
}
