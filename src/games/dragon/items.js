/**
 * 드래곤 스트라이커 아이템 도감 — 네 자리에 다섯 개씩, 스무 개.
 *
 * ★ **가격의 근거** (2026-08-26, 사용자 지정)
 * "1스테이지부터 20스테이지까지 안 죽고 깨면 아이템 하나 살 정도" 가 기준이다.
 * 완주 한 번에 대략 3,500~4,500 금화가 모이므로 비싼 무장 하나가 그 한 판이다.
 * 스무 개를 전부 모으려면 70,000 금화 — 열댓 판을 완주해야 하는 분량이다.
 *
 * ★ **머리무장과 다리무장은 세면 안 된다** (사용자 지정)
 * 그래서 이 둘은 공격력을 **한 톨도** 올리지 않는다. 하는 일은 금화를 끌어당기고
 * 조금 빨리 움직이는 것, 그리고 무엇보다 **화려하게 보이는 것**이다.
 * 세지 않은 대신 가장 비싸다 — 자랑하려고 사는 물건이다.
 */

/* 불꽃 색. PAL.fire 와 같은 7단계(밝음→어두움) 배열이다. */
export const FLAME_PALS = {
  red:    ['#fff6c2','#ffd24a','#ffa32e','#ff7a1e','#f0451f','#c81f2e','#8f1230'],
  ember:  ['#fff0d0','#ffc25a','#ff8c2e','#ff5a14','#e02810','#a81420','#700a18'],
  blue:   ['#eaf7ff','#aee2ff','#5bb8ff','#2e8cff','#1f5ff0','#1a33c8','#12208f'],
  yellow: ['#fffde8','#fff3a0','#ffe14a','#ffc61e','#ffa500','#e07800','#a04d00'],
  green:  ['#f0ffe8','#c9ff9a','#7ef04a','#3fd42e','#1fae1f','#128f30','#0a5c28'],
  abyss:  ['#fbe8ff','#e0a8ff','#c05bff','#9b2eff','#6f1ff0','#4a12b0','#2a0a70'],
};

/**
 * 자리 넷.
 * `pick` 은 착용 효과를 한 줄로 설명한 것이고, 실제 수치는 아이템마다 다르다.
 */
export const SLOTS = [
  { key:'mask',  ko:'마스크',   note:'맞을 때 받는 피해를 줄여준다' },
  { key:'flame', ko:'불꽃',     note:'기본 공격의 색과 위력이 바뀐다' },
  { key:'head',  ko:'머리무장', note:'장식이다 — 금화를 끌어당긴다' },
  { key:'leg',   ko:'다리무장', note:'장식이다 — 더 빠르게 움직인다' },
];

/**
 * 아이템 하나.
 *   id     저장에 쓰는 열쇠 (바꾸면 산 사람의 물건이 사라진다 — 절대 바꾸지 말 것)
 *   ko     이름            price 금화
 *   eff    효과 (아래 EFFECT_ZERO 의 열쇠들)
 *   tint   상점 카드와 드래곤 장식에 쓰는 색
 */
export const ITEMS = [
  /* ---------------- 마스크 : 7,000 ---------------- */
  { id:'mask1', slot:'mask', ko:'가죽 마스크',   price:  800, tint:'#a4703c', eff:{ dmgCut:0.03 }, desc:'받는 피해 3% 감소' },
  { id:'mask2', slot:'mask', ko:'무쇠 마스크',   price:1100, tint:'#8c94a8', eff:{ dmgCut:0.05 }, desc:'받는 피해 5% 감소' },
  { id:'mask3', slot:'mask', ko:'은빛 마스크',   price:1400, tint:'#d8e2f0', eff:{ dmgCut:0.07 }, desc:'받는 피해 7% 감소' },
  { id:'mask4', slot:'mask', ko:'흑요석 마스크', price:1700, tint:'#5a4a70', eff:{ dmgCut:0.09 }, desc:'받는 피해 9% 감소' },
  { id:'mask5', slot:'mask', ko:'용왕의 마스크', price:2000, tint:'#ffd24a', eff:{ dmgCut:0.12 }, desc:'받는 피해 12% 감소' },

  /* ---------------- 불꽃 : 18,000 ---------------- */
  { id:'fire1', slot:'flame', ko:'달군 불꽃',   price:2600, tint:'#ff8c2e', pal:'ember',  eff:{ atk:1.06 }, desc:'공격력 6% · 붉게 달아오른 불' },
  { id:'fire2', slot:'flame', ko:'파란 불꽃',   price:3100, tint:'#5bb8ff', pal:'blue',   eff:{ atk:1.10 }, desc:'공격력 10% · 푸른 불' },
  { id:'fire3', slot:'flame', ko:'노란 불꽃',   price:3600, tint:'#ffe14a', pal:'yellow', eff:{ atk:1.14 }, desc:'공격력 14% · 노란 불' },
  { id:'fire4', slot:'flame', ko:'초록 불꽃',   price:4100, tint:'#7ef04a', pal:'green',  eff:{ atk:1.18 }, desc:'공격력 18% · 초록 불' },
  { id:'fire5', slot:'flame', ko:'심연의 불꽃', price:4600, tint:'#c05bff', pal:'abyss',  eff:{ atk:1.24 }, desc:'공격력 24% · 보랏빛 불' },

  /* ---------------- 머리무장 : 23,000 (세지 않다. 화려하다) ---------------- */
  { id:'head1', slot:'head', ko:'뿔 장식',      price:3600, tint:'#c8a44a', eff:{ magnet: 40 }, desc:'금화를 40 거리에서 끌어당김' },
  { id:'head2', slot:'head', ko:'황금 뿔',      price:4100, tint:'#e8ae1e', eff:{ magnet: 60 }, desc:'금화를 60 거리에서 끌어당김' },
  { id:'head3', slot:'head', ko:'서리 왕관',    price:4600, tint:'#9fe8ff', eff:{ magnet: 85 }, desc:'금화를 85 거리에서 끌어당김' },
  { id:'head4', slot:'head', ko:'번개 뿔',      price:5100, tint:'#fff36b', eff:{ magnet:110 }, desc:'금화를 110 거리에서 끌어당김' },
  { id:'head5', slot:'head', ko:'용왕의 관',    price:5600, tint:'#ff6bd6', eff:{ magnet:140, coinBonus:0.05 }, desc:'금화를 140 거리에서 끌어당기고 금화 점수 5% 추가' },

  /* ---------------- 다리무장 : 22,000 (세지 않다. 화려하다) ---------------- */
  { id:'leg1', slot:'leg', ko:'강철 발톱',   price:3400, tint:'#9aa6bd', eff:{ speed:1.03 }, desc:'이동 속도 3% 증가' },
  { id:'leg2', slot:'leg', ko:'질풍 각반',   price:3900, tint:'#7ef0d0', eff:{ speed:1.05 }, desc:'이동 속도 5% 증가' },
  { id:'leg3', slot:'leg', ko:'화염 각반',   price:4400, tint:'#ff7a3c', eff:{ speed:1.07 }, desc:'이동 속도 7% 증가' },
  { id:'leg4', slot:'leg', ko:'서리 각반',   price:4900, tint:'#8fd0ff', eff:{ speed:1.09 }, desc:'이동 속도 9% 증가' },
  { id:'leg5', slot:'leg', ko:'용왕의 다리', price:5400, tint:'#ffb04a', eff:{ speed:1.12, magnet:30 }, desc:'이동 속도 12% 증가 · 금화를 30 거리에서 끌어당김' },
];

/** 자리별로 묶어 둔 것 — 상점이 그대로 그린다 */
export const BY_SLOT = SLOTS.map((s) => ({ ...s, items: ITEMS.filter((i) => i.slot === s.key) }));

const BY_ID = new Map(ITEMS.map((i) => [i.id, i]));
export const itemById = (id) => BY_ID.get(id) || null;

/** 아무것도 안 낀 상태 */
export const EFFECT_ZERO = { dmgCut:0, atk:1, magnet:0, coinBonus:0, speed:1, pal:null,
                             mask:null, head:null, leg:null };

/**
 * 착용 중인 것들을 하나의 효과로 합친다.
 * 자리마다 하나씩만 낄 수 있으므로 곱하거나 더할 일이 겹치지 않는다.
 * @param {object} equip { mask:'mask3', flame:'fire2', ... }
 */
export function effectsOf(equip) {
  const e = { ...EFFECT_ZERO };
  if (!equip) return e;
  for (const slot of SLOTS) {
    const it = itemById(equip[slot.key]);
    if (!it) continue;
    const f = it.eff || {};
    if (f.dmgCut)    e.dmgCut    += f.dmgCut;
    if (f.atk)       e.atk       *= f.atk;
    if (f.magnet)    e.magnet    += f.magnet;
    if (f.coinBonus) e.coinBonus += f.coinBonus;
    if (f.speed)     e.speed     *= f.speed;
    if (it.pal)      e.pal        = it.pal;
    /* 장식 색도 같이 넘긴다 — 게임은 도감을 몰라도 되게 수치와 색만 받는다 */
    if (slot.key === 'head') e.head = it.tint;
    if (slot.key === 'leg')  e.leg  = it.tint;
    if (slot.key === 'mask') e.mask = it.tint;
  }
  /* 안전장치 — 도감을 잘못 고쳐도 게임이 망가지지 않게 상한을 둔다 */
  e.dmgCut = Math.min(0.20, e.dmgCut);
  e.atk    = Math.min(1.30, e.atk);
  e.speed  = Math.min(1.15, e.speed);
  e.magnet = Math.min(200,  e.magnet);
  return e;
}

/** 도감 전체를 사는 데 드는 금화 (기획 확인용) */
export const TOTAL_PRICE = ITEMS.reduce((s, i) => s + i.price, 0);
