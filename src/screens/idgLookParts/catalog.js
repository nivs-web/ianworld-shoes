/**
 * 꾸미기 창의 «물건 목록 어댑터» (겜보조 2 · 11/13)
 *
 *  ★ 임시 — 겜보조 1 의 src/screens/shopCatalog.js 가 오면 이 파일의 catalogFor() 만 그쪽 import 로 바꾼다.
 *  물건 모양(같은 모양을 맞춘다) : { slot, id, name, rarity(1~6), price, gem, fx(한 줄), lock(조건 글), art(그림 경로|null), vis }
 *  지금 데이터(looks.js)는 모자 8 · 목 6 · 브레스 색 5 · 깃발 8 — 오라 · 펫 · 지붕 · 정문 · 앞마당은 아직 물건이 없다(빈 목록 = 자리만).
 *  이 파일은 입은 모습 글자(clook · outfits) 만들기 · 읽기도 맡는다 (looks.js 의 글자 한도 · 칸 목록은 건드리지 않는다).
 */
import { LOOKS, artOf, hasItem } from '../../games/iandragon_game/data/looks.js';

/** 등급 6단계 : 색 테 + 별 수 (IDG_COLLECTION_PLAN §1 · §10) */
export const RARITY = [
  { n: '보통', c: '#9aa3b0' }, { n: '고급', c: '#5fd35f' }, { n: '희귀', c: '#4da6ff' },
  { n: '영웅', c: '#b06bff' }, { n: '전설', c: '#ff9a3c' }, { n: '신화', c: '#ff7ad0' },
];
export const stars = (r) => '★'.repeat(r);

/** 큰 칸 → 작은 칸 (id · 이름) */
export const DRAGON_TABS = [['dragon', '대장'], ['hat', '모자'], ['neck', '목 장식'], ['breath', '브레스 색'], ['aura', '오라'], ['pet', '펫']];
export const CASTLE_TABS = [['skin', '캐슬 모습'], ['flag', '깃발'], ['roof', '지붕'], ['gate', '정문'], ['yard', '앞마당'], ['gear', '장비']];
/** 입은 모습에 들어가는 칸 (look 글자에 있는 4개 + clook 글자의 새 5개) */
export const WORN = ['hat', 'neck', 'breath', 'flag', 'aura', 'pet', 'roof', 'gate', 'yard'];
const CLOOK = ['aura', 'pet', 'roof', 'gate', 'yard'];
const L = { hat: 'h', neck: 'n', breath: 'b', flag: 'f', aura: 'a', pet: 'p', roof: 'o', gate: 'g', yard: 'y', skin: 's' };

/* ── 임시 값 : 등급 → 효과 크기 (기획 §3.3 «+0.5 · 1 · 1.5 · 2 · 2.5 · 3%») ── */
const pct = (r) => { const v = 0.5 * r; return Number.isInteger(v) ? String(v) : v.toFixed(1); };
const rarityOf = (it) => (it.gem ? 4 : it.price >= 8000 ? 2 : 1);
const BREATH_FX = { basic: '효과 없음 · 처음부터 있어요', rainbow: '브레스 피해 +3% · 사거리 +5%', ghost: '유령 · 그림자에 +6% · 사거리 +5%', gold: '불로 잡으면 불씨 +10% · 사거리 +5%', ice: '맞은 적이 0.2초 느려져요 · 사거리 +5%' };
const fxOf = (slot, it, r) => (slot === 'hat' ? `수호 불꽃 공격 +${pct(r)}%` : slot === 'neck' ? `브레스 충전 +${pct(r)}%` : slot === 'flag' ? `드래곤캐슬 체력 +${pct(r)}%` : BREATH_FX[it.id] || '');
const nameOf = (n) => n.replace('용 깃발', '드래곤 깃발');   /* 낱말 규칙 : «용» 안 씀 */

/** 이 칸의 물건 전부 (안 가진 것 포함 · 보이는 것만) */
export function catalogFor(slot) {
  const src = LOOKS[slot];
  if (!src || !['hat', 'neck', 'breath', 'flag'].includes(slot)) return [];
  return src.map((it) => {
    const rarity = rarityOf(it);
    return { slot, id: it.id, name: nameOf(it.name), rarity, price: it.price || 0, gem: !!it.gem, fx: fxOf(slot, it, rarity), lock: '아이템 샵에서 팔아요', art: artOf(slot, it.id), vis: true };
  }).filter((x) => x.vis);
}
/** 숨김 함수 자리 — 초고수 · 비밀 물건을 계정에 따라 거른다 (지금은 전부 보임) */
export const visibleLooks = (g, slot) => catalogFor(slot);   // eslint-disable-line no-unused-vars

/** 가졌나 — 새 칸은 owned 배열의 'slot:id' 열쇠 */
export const owns = (g, slot, id) => (['hat', 'neck', 'breath', 'flag'].includes(slot) ? hasItem(g, slot, id) : Array.isArray(g?.owned) && g.owned.includes(`${slot}:${id}`));

/* ── 입은 모습 글자 ── */
const idxOf = (slot, id) => catalogFor(slot).findIndex((x) => x.id === id) + 1;
const idAt = (slot, n) => catalogFor(slot)[n - 1]?.id || null;

/** clook : 새 칸 5개 'a0.p0.o0.g0.y0' (번호 = 목록 순서 + 1) */
export const encodeClook = (w) => CLOOK.map((s) => `${L[s]}${idxOf(s, w?.[s])}`).join('.');
export function decodeClook(str) {
  const out = Object.fromEntries(CLOOK.map((s) => [s, null]));
  if (typeof str !== 'string' || str.length > 80) return out;
  for (const part of str.split('.')) {
    const m = /^([apogy])(\d{1,3})$/.exec(part);
    const slot = m && CLOOK.find((s) => L[s] === m[1]);
    if (slot) out[slot] = idAt(slot, Number(m[2]));
  }
  return out;
}

/** 코디 한 칸 : 입은 모습 전부 + 캐슬 모습 번호 'h3.n1.b2.f4.a0.p0.o0.g0.y0.s3' (한도 80 안) */
export const encodeOutfit = (w) => [...WORN.map((s) => `${L[s]}${idxOf(s, w?.[s])}`), `s${Number(w?.skin) || 0}`].join('.');
/** 코디 글자 → 입은 모습 · 가진 것만 남긴다(없는 것은 벗음). 읽을 수 없으면 null */
export function decodeOutfit(str, g, castleLv) {
  if (typeof str !== 'string' || !str || str.length > 80) return null;
  const w = Object.fromEntries(WORN.map((s) => [s, null])); w.skin = 0;
  for (const part of str.split('.')) {
    const m = /^([hnbfapogys])(\d{1,3})$/.exec(part);
    if (!m) continue;
    const n = Number(m[2]);
    if (m[1] === 's') { if (n >= 1 && n <= castleLv) w.skin = n; continue; }
    const slot = WORN.find((s) => L[s] === m[1]), id = slot && idAt(slot, n);
    if (id && owns(g, slot, id)) w[slot] = id;
  }
  return w;
}
