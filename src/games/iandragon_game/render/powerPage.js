/**
 * 한 페이지 파워업 (2026-11-11 대표님 «1개 페이지로 가로 · 세로 모두 한 페이지에서 쉽게 슬롯 끼고 빼고 업글도 가능하게»)
 *
 *  머리: 왼쪽 «출전 n / 10칸» · 가운데 빨간 리본 «파워업» · 오른쪽 금화 | 젬 지갑 + 보라 «닫기 X» (11/12 대표님 2시간 플레이 뒤)
 *  슬롯: 출전 칸(덱) 1 · 2 … 10 번호 = 전투 카드 줄 순서 = 단축키(1~9 · 0) 번호.
 *        칸을 누르면 «고름» → 다른 칸을 누르면 둘이 자리 바꿈 · 빈 칸을 누르면 맨 뒤(첫 빈 칸)로 옮김 · 고른 칸을 한 번 더 누르면 빠짐.
 *        손가락(마우스)으로 칸을 끌어 다른 칸에 놓아도 자리 바꿈. 덱은 늘 빈틈 없이 앞에서부터 채운다(번호 = 단축키가 어긋나지 않게).
 *  목록: 가진 용 전체 카드. 대기 카드를 누르면 첫 빈 칸으로(칸을 골라 두었으면 그 칸과 바꿈) · 꽉 찼으면 바꿀 칸을 고르게 한다. 출전 카드를 누르면 빠짐.
 *  출전은 전부 뺄 수 있다. 2개 미만이면 저장하지 않고(저장된 덱은 마지막으로 2개 이상이던 덱), 닫기 · 전투 단추를 누르면
 *        «최소 2개 이상의 용을 넣어 주세요» 토스트만 뜨고 창이 닫히지 않는다 → 덱이 2 미만인 채로 전투에 들어가는 길이 없다.
 *  아래: 앞으로 가는 단추만 (전투 안 = «전투 개시!» · «다시하기») — main 이 아닌 단추(닫기 · 돌아가기)는 오른쪽 위 «닫기 X» 하나로.
 *  배치 : .land(가로 = 왼쪽 슬롯 + 오른쪽 목록) · .port(세로) — 전투 틀을 돌려 그릴 때도 맞도록 media query 대신 «게임 화면 방향»으로 정한다.
 *  규칙은 로비 «파워업»(옛 용 둥지)과 같다 : ECON.lvCost · 레벨 상한 ECON.capAt · 덱 2칸 이상 · 칸 수 un.deckCap.
 *  소리 : 끼우기 deploy_s · 빼기 button_back · 레벨업 levelup · 진화 evolve + voice evolve · 코인 부족 button_deny (겜팀장)
 */
import * as Audio from '../audio/index.js';
import { UNITS } from '../data/units.js';
import { LEADERS } from '../data/leaders.js';
import { ECON } from '../data/econ.js';
import { powerMul } from '../core/rules.js';
import { unlockedBefore, stageByNo, LAST_STAGE, makeLoads } from './battleSetup.js';
import { breathStats } from './breathInfo.js';
import { money } from './money.js';
import { rotated } from './rot.js';
import { moreDown } from '../../../screens/idgMore.js';   /* «아래로 더 있음» 화살표 공용 (11/13) */
import { kitGauge } from '../../../screens/idgKit.js';   /* 키트 픽셀 게이지 (11/12 서브창2 · 체력 초록 · 공격 주황 · 사거리 파랑) */

const AI = '/assets/iandragon_game/ai/';
const capOf = (cleared) => ECON.capAt.reduce((c, [g, cap]) => (cleared >= g ? cap : c), 10);
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const play = (n) => { try { Audio.init(); Audio.play(n); } catch { /* */ } };
export const MIN_DECK = 2;
/* 다시하기 = 도트 되돌리기 화살표 (흰 + 짙은 보라 외곽선 · tools 에서 계산해 만든 14×16 칸) */
const RETRY_SVG = '<svg viewBox="0 0 14 16" shape-rendering="crispEdges" aria-hidden="true"><path fill="#2a1238" d="M0 6h1v1h-1zM0 7h1v1h-1zM0 8h1v1h-1zM0 9h1v1h-1zM0 10h1v1h-1zM0 11h1v1h-1zM1 4h1v1h-1zM1 5h1v1h-1zM1 6h1v1h-1zM1 11h1v1h-1zM1 12h1v1h-1zM1 13h1v1h-1zM2 3h1v1h-1zM2 4h1v1h-1zM2 13h1v1h-1zM2 14h1v1h-1zM3 3h1v1h-1zM3 14h1v1h-1zM4 2h1v1h-1zM4 3h1v1h-1zM4 7h1v1h-1zM4 8h1v1h-1zM4 9h1v1h-1zM4 10h1v1h-1zM4 14h1v1h-1zM4 15h1v1h-1zM5 2h1v1h-1zM5 6h1v1h-1zM5 7h1v1h-1zM5 10h1v1h-1zM5 11h1v1h-1zM5 15h1v1h-1zM6 2h1v1h-1zM6 6h1v1h-1zM6 11h1v1h-1zM6 15h1v1h-1zM7 0h1v1h-1zM7 1h1v1h-1zM7 2h1v1h-1zM7 6h1v1h-1zM7 7h1v1h-1zM7 8h1v1h-1zM7 11h1v1h-1zM7 15h1v1h-1zM8 0h1v1h-1zM8 8h1v1h-1zM8 10h1v1h-1zM8 11h1v1h-1zM8 15h1v1h-1zM9 0h1v1h-1zM9 1h1v1h-1zM9 7h1v1h-1zM9 8h1v1h-1zM9 9h1v1h-1zM9 10h1v1h-1zM9 14h1v1h-1zM9 15h1v1h-1zM10 1h1v1h-1zM10 2h1v1h-1zM10 6h1v1h-1zM10 7h1v1h-1zM10 8h1v1h-1zM10 14h1v1h-1zM11 2h1v1h-1zM11 3h1v1h-1zM11 5h1v1h-1zM11 6h1v1h-1zM11 8h1v1h-1zM11 13h1v1h-1zM11 14h1v1h-1zM12 3h1v1h-1zM12 4h1v1h-1zM12 5h1v1h-1zM12 8h1v1h-1zM12 11h1v1h-1zM12 12h1v1h-1zM12 13h1v1h-1zM13 8h1v1h-1zM13 9h1v1h-1zM13 10h1v1h-1zM13 11h1v1h-1z"/><path fill="#fff" d="M1 7h1v1h-1zM1 8h1v1h-1zM1 9h1v1h-1zM1 10h1v1h-1zM2 5h1v1h-1zM2 6h1v1h-1zM2 7h1v1h-1zM2 8h1v1h-1zM2 9h1v1h-1zM2 10h1v1h-1zM2 11h1v1h-1zM2 12h1v1h-1zM3 4h1v1h-1zM3 5h1v1h-1zM3 6h1v1h-1zM3 7h1v1h-1zM3 8h1v1h-1zM3 9h1v1h-1zM3 10h1v1h-1zM3 11h1v1h-1zM3 12h1v1h-1zM3 13h1v1h-1zM4 4h1v1h-1zM4 5h1v1h-1zM4 6h1v1h-1zM4 11h1v1h-1zM4 12h1v1h-1zM4 13h1v1h-1zM5 3h1v1h-1zM5 4h1v1h-1zM5 5h1v1h-1zM5 12h1v1h-1zM5 13h1v1h-1zM5 14h1v1h-1zM6 3h1v1h-1zM6 4h1v1h-1zM6 5h1v1h-1zM6 12h1v1h-1zM6 13h1v1h-1zM6 14h1v1h-1zM7 3h1v1h-1zM7 4h1v1h-1zM7 5h1v1h-1zM7 12h1v1h-1zM7 13h1v1h-1zM7 14h1v1h-1zM8 1h1v1h-1zM8 2h1v1h-1zM8 3h1v1h-1zM8 4h1v1h-1zM8 5h1v1h-1zM8 6h1v1h-1zM8 7h1v1h-1zM8 12h1v1h-1zM8 13h1v1h-1zM8 14h1v1h-1zM9 2h1v1h-1zM9 3h1v1h-1zM9 4h1v1h-1zM9 5h1v1h-1zM9 6h1v1h-1zM9 11h1v1h-1zM9 12h1v1h-1zM9 13h1v1h-1zM10 3h1v1h-1zM10 4h1v1h-1zM10 5h1v1h-1zM10 9h1v1h-1zM10 10h1v1h-1zM10 11h1v1h-1zM10 12h1v1h-1zM10 13h1v1h-1zM11 4h1v1h-1zM11 9h1v1h-1zM11 10h1v1h-1zM11 11h1v1h-1zM11 12h1v1h-1zM12 9h1v1h-1zM12 10h1v1h-1z"/></svg>';
/* 안내 줄 앞 도트 아이콘 (4차) : 카드 넣고 빼기 = 카드 + ⇄ · 순서 바꾸기 = ⇅ */
const ICO_INOUT = '<svg viewBox="0 0 13 8" shape-rendering="crispEdges" aria-hidden="true"><path fill="#7a3a12" d="M0 0h1v1h-1zM1 0h1v1h-1zM2 0h1v1h-1zM3 0h1v1h-1zM4 0h1v1h-1zM0 1h1v1h-1zM4 1h1v1h-1zM10 1h1v1h-1zM0 2h1v1h-1zM4 2h1v1h-1zM6 2h1v1h-1zM7 2h1v1h-1zM8 2h1v1h-1zM9 2h1v1h-1zM10 2h1v1h-1zM11 2h1v1h-1zM0 3h1v1h-1zM4 3h1v1h-1zM10 3h1v1h-1zM0 4h1v1h-1zM4 4h1v1h-1zM0 5h1v1h-1zM4 5h1v1h-1zM7 5h1v1h-1zM0 6h1v1h-1zM4 6h1v1h-1zM6 6h1v1h-1zM7 6h1v1h-1zM8 6h1v1h-1zM9 6h1v1h-1zM10 6h1v1h-1zM11 6h1v1h-1zM0 7h1v1h-1zM1 7h1v1h-1zM2 7h1v1h-1zM3 7h1v1h-1zM4 7h1v1h-1zM7 7h1v1h-1z"/></svg>';
const ICO_ORDER = '<svg viewBox="0 0 12 8" shape-rendering="crispEdges" aria-hidden="true"><path fill="#7a3a12" d="M2 0h1v1h-1zM8 0h1v1h-1zM1 1h1v1h-1zM2 1h1v1h-1zM3 1h1v1h-1zM8 1h1v1h-1zM0 2h1v1h-1zM1 2h1v1h-1zM2 2h1v1h-1zM3 2h1v1h-1zM4 2h1v1h-1zM8 2h1v1h-1zM2 3h1v1h-1zM8 3h1v1h-1zM2 4h1v1h-1zM8 4h1v1h-1zM2 5h1v1h-1zM6 5h1v1h-1zM7 5h1v1h-1zM8 5h1v1h-1zM9 5h1v1h-1zM10 5h1v1h-1zM2 6h1v1h-1zM7 6h1v1h-1zM8 6h1v1h-1zM9 6h1v1h-1zM2 7h1v1h-1zM8 7h1v1h-1z"/></svg>';
const EMBER = '/assets/iandragon_game/ui/hud_ember_s.png';   /* 전투 HUD 불씨 마크 (hud.js .idg-ico-ember 와 같은 그림) */
export const MIN_DECK_MSG = '최소 2개 이상의 용을 넣어 주세요';
const SLOT_MAX = 10;   /* 출전 칸은 늘 10칸을 보여 준다 · 아직 안 열린 칸 = 빈 칸 + 자물쇠 (11/13 대표님) */
/* 카드 정렬 (가로만) : 불씨 = 처음 누르면 싼 순서(▼) · 체력 · 공격 · 사거리 = 처음 누르면 높은 순서(▲) · 한 번 더 = 반대 */
const SORTS = [['cost', '불씨', true], ['hp', '체력', false], ['atk', '공격', false], ['range', '사거리', false]];   /* [키, 글씨, 처음 = 낮은 순?] */
/* 도트 화살표 7×4 (▲ 높은 순 · ▼ 낮은 순) */
const ARW_UP = '<svg viewBox="0 0 7 4" shape-rendering="crispEdges" aria-hidden="true"><path fill="currentColor" d="M3 0h1v1H3zM2 1h3v1H2zM1 2h5v1H1zM0 3h7v1H0z"/></svg>';
const ARW_DN = '<svg viewBox="0 0 7 4" shape-rendering="crispEdges" aria-hidden="true"><path fill="currentColor" d="M0 0h7v1H0zM1 1h5v1H1zM2 2h3v1H2zM3 3h1v1H3z"/></svg>';
/* 닫기 X : 도트 X 아이콘 (10칸 · 흰 X + 짙은 보라 1칸 외곽선) */
const X_SVG = '<svg viewBox="0 0 10 10" shape-rendering="crispEdges" aria-hidden="true"><path fill="#2a1238" d="M0 0h3v1h1v1h2V1h1V0h3v3H9v1H8v2h1v1h1v3H7V9H6V8H4v1H3v1H0V7h1V6h1V4H1V3H0z"/><path fill="#fff" d="M1 1h2v1h1v1h2V2h1V1h2v2H8v1H7v2h1v1h1v2H7V8H6V7H4v1H3v1H1V7h1V6h1V4H2V3H1z"/></svg>';
/** 게임 화면이 가로인가 (전투 틀을 시계 방향으로 돌려 그리면 기기는 세로여도 가로) */
const isLand = () => { const r = rotated(); return r === 'cw' ? true : r === 'ccw' ? false : innerWidth > innerHeight; };
/** 게임 화면 높이 (돌려 그리면 기기 폭) — 낮은 가로(폰 가로 · 브라우저 아래 막대가 남은 아주 긴 가로)면 .short 로 더 촘촘히 */
const gameH = () => (rotated() ? innerWidth : innerHeight);
const fitCls = (box) => { const l = isLand(); box.classList.toggle('land', l); box.classList.toggle('port', !l); box.classList.toggle('short', l && gameH() <= 460); };

/**
 * @param {(tag:string, cls?:string, text?:string)=>HTMLElement} h
 * @param {{ save:()=>object, write:(part:object)=>object, leader?:string, buttons:[string,Function,string?][], cls?:string }} o
 *   buttons 중 cls 에 'main' 이 없는 마지막 단추 = 오른쪽 위 «닫기 X» (누르는 함수 그대로). 나머지는 아래 줄.
 * @returns {HTMLElement & { deckShort:()=>boolean, warnShort:()=>void, guard:(fn:Function)=>Function }}
 */
export function powerPage(h, o) {
  const box = h('div', (o.cls || 'idg-pp') + ' pp2');
  /** 카드 글줄 (2차 · 5차 «비용» 대신 «불씨») : 1줄 «Lv 10 (권장 14)» · 2줄 «불씨 [불꽃] 50» — 전투에서 쓰는 불씨 */
  /** «파워업» 로고 (3차 · 4차 대표님) : 금색 굵은 «파워업» 글씨만 · 1px 도트 외곽선 — 리본 제목 대신 */
  const logo = () => { const lg = h('div', 'idg-pp-logo'); lg.setAttribute('role', 'heading'); lg.setAttribute('aria-level', '2'); lg.append(h('b', null, '파워업')); return lg; };   /* 4차 : 화살표 빼고 글씨만 */
  /** 고정 안내 2줄 (3차 → 4차 문구 «카드를 슬롯에 넣고 빼세요» · «카드 순서를 바꿀 수 있어요») */
  const guide = () => { const gd = h('div', 'idg-pp-guide'); const ln = (ico, t) => { const p = h('p'); const i = h('i', 'gi'); i.innerHTML = ico; p.append(i, h('span', null, t)); return p; }; gd.append(ln(ICO_INOUT, '카드를 슬롯에 넣고 빼세요'), ln(ICO_ORDER, '카드 순서를 바꿀 수 있어요')); return gd; };   /* 4차 문구 · 줄 앞 도트 아이콘 */
  /** 가로 안내 : 10번 칸 옆 빈 2칸 자리에 들어가는 글씨만 (11/13 대표님 · 그림 없음 · 굵게 아님 · 종이 판 위) */
  const guideCell = () => { const gd = h('div', 'idg-pp-guide cell'); gd.append(h('p', null, '카드를 슬롯에 넣고 빼세요'), h('p', null, '순서도 바꿀 수 있어요')); return gd; };
  /** «나가기» = 로비로 (결과 창 «나가기» 와 같은 동작 · 전투 판 사이만 o.exit) */
  const exitBtn = (extra = '') => { const b = h('button', 'idg-btn idg-pp-exit' + extra); b.type = 'button'; const ic = h('img', 'ico'); ic.src = `${AI}result/ico_exit.svg`; ic.alt = ''; ic.draggable = false; b.append(ic, h('span', 'lb', '나가기')); b.onclick = guard(() => o.exit()); return b; };
  const lvLine = (lv, exp, cost) => { const sp = h('span', 'lv'); const c = h('span', 'cost'), im = h('img'); im.src = EMBER; im.alt = '불씨'; im.draggable = false; c.append('불씨 ', im, h('b', null, String(cost))); sp.append(h('span', 'l1', `Lv ${lv}${exp > lv ? ` (권장 ${exp})` : ''}`), c); return sp; };
  let swapFor = null;   /* 꽉 찼을 때 넣으려는 용 → 바꿀 칸을 고르는 중 */
  let sel = null;       /* 고른 출전 칸 번호 (0부터) */
  let work = null;      /* 지금 화면의 덱 (2개 미만이어도 여기에만 · 저장은 2개 이상일 때만) */
  let lastCoins = null, toastT = 0, eatClick = 0;
  let sortBy = null;    /* 가로 카드 정렬 { k: 'cost'|'hp'|'atk'|'range', low: 낮은 순이면 true } · 처음엔 없음(원래 순서) */
  let need = MIN_DECK;  /* 꼭 넣어야 하는 수 = 2 (가진 용이 1마리뿐인 처음에는 1 — 창이 영영 안 닫히지 않게) */
  const closeIdx = (() => { for (let k = o.buttons.length - 1; k >= 0; k--) if (!/\bmain\b/.test(o.buttons[k][2] || '')) return k; return -1; })();

  const deckShort = () => (work ? work.length : need) < need;
  function warnShort() {
    play('button_deny');
    let t = box.querySelector(':scope > .idg-pp-toast');
    if (!t) { t = h('div', 'idg-pp-toast'); t.setAttribute('role', 'alert'); box.appendChild(t); }
    t.textContent = MIN_DECK_MSG; t.classList.remove('on'); void t.offsetWidth; t.classList.add('on');
    clearTimeout(toastT); toastT = setTimeout(() => t.remove(), 1900);
  }
  /** 창을 떠나는 단추 = 덱이 2개 미만이면 토스트만 */
  const guard = (fn) => (...a) => { if (deckShort()) { warnShort(); return undefined; } return fn(...a); };
  const setDeck = (d) => { work = d; if (d.length >= need) o.write({ deck: d }); };

  function draw() {
    const g = o.save(), cleared = g.cleared || 0, next = stageByNo(Math.min(LAST_STAGE, cleared + 1));
    const un = unlockedBefore(cleared + 1), cap = capOf(cleared), exp = next.expLevel || 1;
    const ids = [...new Set([...un.dragons, ...Object.keys(g.units || {}).filter((id) => UNITS[id] && UNITS[id].rar !== 'story')])].filter((id) => UNITS[id]);
    if (!work) work = (g.deck || []).filter((id) => ids.includes(id)).length >= MIN_DECK ? g.deck.filter((id) => ids.includes(id)).slice(0, un.deckCap) : makeLoads(next, g).deck.map((d) => d.id);
    work = [...new Set(work.filter((id) => ids.includes(id)))].slice(0, un.deckCap);
    const deck = work;
    need = Math.min(MIN_DECK, ids.filter((id) => !(next.costMax && UNITS[id].cost > next.costMax)).length || 1);
    if (sel != null && sel >= deck.length) sel = null;
    const ld = o.leader || makeLoads(next, g).loads[0].leader;
    fitCls(box);

    /* 머리 : 왼쪽 출전 칸 수 · 가운데 리본 · 오른쪽 지갑 + 닫기 X */
    const head = h('div', 'idg-pp-head');
    const wallet = h('div', 'idg-pp-band'), coinEl = money('coin', g.coins || 0);
    wallet.append(coinEl, h('i', 'sep'), money('gem', g.gems || 0));
    /* 레벨업으로 금화가 줄면 숫자가 통 튀고 깜박 + «-900» 이 떠올랐다 사라짐 (11/12 대표님 «레벨업 할 때마다 금화가 줄어드는 게 바로 보이게») */
    if (lastCoins != null && (g.coins || 0) < lastCoins) { coinEl.classList.add('drop'); wallet.appendChild(h('i', 'idg-pp-minus', `-${fmt(lastCoins - (g.coins || 0))}`)); }
    lastCoins = g.coins || 0;
    const right = h('div', 'idg-pp-hr'); right.append(wallet);
    const landNow = box.classList.contains('land');
    if (closeIdx >= 0 && landNow) {   /* 닫기 X 는 가로에서만 (11/12 대표님 2차 · 세로는 아래 단추 줄 그대로) */
      const [label, fn] = o.buttons[closeIdx];
      const x = h('button', 'idg-pp-x'); x.type = 'button'; x.setAttribute('aria-label', label); x.title = label;
      x.innerHTML = X_SVG; x.append(h('span', null, '닫기'));
      x.onclick = guard(fn); right.append(x);
    }
    head.append(logo(), right);   /* 3차 : 리본 제목 → «파워업 + UP 화살표» 로고 (가로 · 세로 통일) */

    const bs = breathStats(ld, g), lead = h('div', 'idg-pp-lead');
    const face = h('img'); face.src = `${AI}${ld}/head.png`; face.alt = '';
    lead.append(face, h('b', null, `${LEADERS[ld]?.ko || '리더'} 브레스`), h('span', null, `사거리 ${bs.range} · 위력 ${fmt(bs.power)} · 밀어내기 ${bs.push} · 충전 ${bs.charge}초`));

    /* 출전 칸 (번호 = 단축키) */
    const slots = h('div', 'idg-pp-slots' + (swapFor ? ' pick' : '') + (sel != null ? ' has-sel' : ''));
    for (let i = 0; i < SLOT_MAX; i++) {
      if (i >= un.deckCap) { const lk = h('div', 'idg-pp-slot empty locked'); lk.append(h('i', 'no', String(i + 1)), h('i', 'lock')); lk.setAttribute('role', 'img'); lk.setAttribute('aria-label', `${i + 1}번 칸 잠김`); slots.appendChild(lk); continue; }
      const id = deck[i], b = h('button', 'idg-pp-slot' + (id ? '' : ' empty') + (sel === i ? ' sel' : '')); b.type = 'button'; b.dataset.i = String(i);
      b.append(h('i', 'no', String(i + 1)));
      if (id) {
        const im = h('img'); im.src = `${AI}${id}/head.png`; im.alt = UNITS[id].name; im.draggable = false;
        b.append(im, h('em', null, `Lv${Math.max(g.units?.[id]?.[0] || 1, exp)}`));
        if (sel === i) b.append(h('span', 'tag', '고름'));
        b.setAttribute('aria-label', `${i + 1}번 칸 ${UNITS[id].name}${sel === i ? ' (고름)' : ''}`);
        b.addEventListener('pointerdown', (e) => startDrag(e, i, im.src));
      } else { b.append(h('b', null, '+')); b.setAttribute('aria-label', `${i + 1}번 빈 칸`); }
      b.onclick = () => { if (performance.now() - eatClick < 400) return; tapSlot(i, deck); };
      slots.appendChild(b);
    }
    const short = deck.length < need;
    const hint = h('p', 'idg-pp-hint' + (short ? ' bad' : ''), swapFor ? `«${UNITS[swapFor].name}» 과 바꿀 칸을 고르세요`
      : short ? MIN_DECK_MSG
        : sel != null ? `${sel + 1}번 칸을 골랐어요 · 다른 칸을 누르면 자리 바꿈 · 한 번 더 누르면 빠져요`
          : '');   /* 평소 안내는 고정 2줄(guide) · 여기는 고름 · 바꾸기 · 모자람 때만 */
    if (!hint.textContent) hint.hidden = true;
    const limit = next.costMax ? h('p', 'idg-pp-limit', `다음 판 ${next.id} : 불씨 ${next.costMax} 이하만`) : null;

    /* 용 목록 */
    const list = h('div', 'idg-pp-list');
    const statOf = (id) => { const U = UNITS[id], m = powerMul(Math.max(g.units?.[id]?.[0] || 1, exp)); return { cost: U.cost, hp: U.hp * m, atk: U.atk * m, range: U.range || 40 }; };
    const shown = box.classList.contains('land') && sortBy ? ids.map((id, n) => [id, n, statOf(id)[sortBy.k]]).sort((a, b) => (sortBy.low ? a[2] - b[2] : b[2] - a[2]) || a[1] - b[1]).map((r) => r[0]) : ids;
    for (const id of shown) {
      const U = UNITS[id], lv = g.units?.[id]?.[0] || 1, cost = ECON.lvCost(lv), max = lv >= cap, poor = (g.coins || 0) < cost;
      const on = deck.includes(id), over = next.costMax && U.cost > next.costMax;
      const evo = (lv + 1 === 10 && U.forms?.[1]) || (lv + 1 === 20 && U.forms?.[2]);
      const form = lv >= 20 ? U.forms?.[2] : lv >= 10 ? U.forms?.[1] : null;
      const m = powerMul(Math.max(lv, exp));
      const card = h('div', 'idg-pp-card' + (on ? ' on' : '') + (over ? ' over' : '') + (swapFor === id ? ' sel' : ''));
      const im = h('img'); im.src = `${AI}${lv >= 10 ? `${id}_2` : id}/head.png`; im.alt = ''; im.onerror = () => { im.onerror = null; im.src = `${AI}${id}/head.png`; };
      const bar = (lb, v, mx, color) => { const r = h('div', 'st'); r.append(h('span', null, lb), kitGauge({ value: v, max: mx, color, floor: 0.05, size: 'sm', label: lb })); return r; };
      const top = h('div', 'idg-pp-pick');
      top.append(im, h('b', 'nm', form?.name || U.name), lvLine(lv, exp, U.cost), on ? h('em', 'tag', `출전 ${deck.indexOf(id) + 1}`) : h('em', 'tag off', over ? '불씨 초과' : '대기'));
      /* 카드 전체(레벨업 단추만 빼고)를 누르면 출전 ↔ 대기 (대표님 11/11 «직관적으로 빠르게 넣고 빼게») */
      card.onclick = () => {
        if (on) { sel = null; setDeck(deck.filter((x) => x !== id)); play('button_back'); draw(); return; }
        if (over) { play('button_deny'); return; }
        if (sel != null) { const d = deck.slice(); d[sel] = id; sel = null; swapFor = null; setDeck(d); play('deploy_s'); draw(); return; }
        if (deck.length < un.deckCap) { setDeck([...deck, id]); play('deploy_s'); swapFor = null; draw(); return; }
        swapFor = swapFor === id ? null : id; play('button'); draw();
      };
      /* 레벨업 = 결과 창 초록 단추 · 진화 = 빨간 단추 · 값은 금화 아이콘 + 숫자 · 최고 = 평범한 보라 (11/12 대표님 «노란 네모 단추 없애기») */
      const up = h('button', 'idg-btn idg-pp-up idg-buy ' + (max ? 'plain' : evo ? 'red evo' : 'green')); up.type = 'button';
      if (max) { up.textContent = `최고 (상한 ${cap})`; up.disabled = true; }
      else { up.append(h('span', 'idg-buy-label', evo ? '진화' : '레벨업'), money('coin', cost)); if (poor) up.classList.add('poor'); }
      up.onclick = (e) => {
        e.stopPropagation();
        const cur = o.save(), now = cur.units?.[id]?.[0] || 1, c = ECON.lvCost(now);
        if (now >= capOf(cur.cleared || 0)) return;
        if ((cur.coins || 0) < c) { play('button_deny'); return; }
        o.write({ coins: cur.coins - c, units: { ...cur.units, [id]: [now + 1, cur.units?.[id]?.[1] || 0] } });
        const ev = now + 1 === 10 || now + 1 === 20;
        play(ev ? 'evolve' : 'levelup'); if (ev) { try { Audio.voice('evolve'); } catch { /* */ } }
        draw();
        const again = box.querySelector(`.idg-pp-list [data-id="${id}"]`); if (again) { again.classList.add('pop'); }
      };
      card.dataset.id = id;
      card.append(top, bar('체력', U.hp * m, 6000, 'green'), bar('공격', U.atk * m, 900, 'orange'), bar('사거리', U.range || 40, 400, 'blue'), up);
      list.appendChild(card);
    }
    const mains = o.buttons.filter((_, k) => k !== closeIdx);
    const mkBtn = ([label, fn, cls], extra = '') => { const b = h('button', 'idg-btn ' + (cls || '') + extra, label); b.type = 'button'; b.onclick = guard(fn); return b; };
    const keep = box.querySelector('.idg-pp-body')?.scrollTop || 0, keepS = box.querySelector('.idg-pp-sbody')?.scrollTop || 0;
    const t = box.querySelector(':scope > .idg-pp-toast');
    const body = h('div', 'idg-pp-body');
    let row = null;
    if (box.classList.contains('land')) {
      /* ── 가로 = 대표님 포토샵 시안 (11/12 · images/37 · 스타일 시트 예외) ──
       *  맨 위 : 왼쪽 작은 지갑 알약 · 오른쪽 큰 «닫기 X» (리본 제목 없음) → 금 줄
       *  왼쪽 칸 : 머리 판 «출전 카드 < 출전 n/10 >» (고정) + 번호 붙은 3열 출전 칸(넘치면 이 칸만 스크롤) + 순서 바꾸기 안내
       *  가운데 칸 : 머리 판 «파워업 카드 < n카드 보유 >» (고정) + 한 줄에 카드 3개 (이 칸만 스크롤)
       *  오른쪽 띠 (전투 판 사이만) : 큰 빨간 «다시하기» · «전투 개시!» + 아래 «돌아가기» — 로비는 띠 없이 카드 칸이 넓어짐 */
      /* 3차 : 가운데 리본 제목 없음 · 전투 판 사이 = 로고는 오른쪽 띠 맨 위 · 로비 = 띠가 없으니 로고를 머리 줄 오른쪽(닫기 X 왼쪽)에 */
      const top = h('div', 'idg-pp-top2'); top.append(wallet, logo(), right.querySelector('.idg-pp-x') || h('i'));   /* 11/13 : «파워업» 제목은 늘 머리 줄 정중앙 (전투 판 사이도 띠 위가 아니라 여기) */
      const plate = (a, b) => { const p = h('div', 'idg-pp-plate'); p.append(h('b', null, a), h('span', null, `< ${b} >`)); return p; };
      const sScroll = h('div', 'idg-pp-sbody'); sScroll.append(slots);
      slots.append(guideCell());   /* 10번 칸 옆 빈 2칸 */
      const sCol = h('div', 'idg-pp-col slots'); sCol.append(plate('출전 카드', `출전 ${deck.length}/${un.deckCap}`), sScroll, h('i', 'idg-dlg-more'), hint); if (limit) sCol.append(limit);
      if (deck.length < need) sCol.firstChild.classList.add('short');
      body.append(list);
      const cPlate = plate('파워업 카드', `${ids.length}카드 보유`); cPlate.classList.add('sorts');
      const sortBar = h('div', 'idg-pp-sort'); sortBar.append(h('b', null, '정렬:'));
      for (const [k, lb, lowFirst] of SORTS) {
        const on = sortBy?.k === k, low = on ? sortBy.low : lowFirst;
        const sb = h('button', 'idg-pp-sortb' + (on ? ' on' : '')); sb.type = 'button'; sb.dataset.k = k; sb.setAttribute('aria-pressed', on ? 'true' : 'false');
        sb.setAttribute('aria-label', `${lb} ${on ? (low ? '낮은 순' : '높은 순') : (low ? '낮은 순으로' : '높은 순으로')} 정렬`);
        const ar = h('i', 'ar'); ar.innerHTML = low ? ARW_DN : ARW_UP; sb.append(h('span', null, lb), ar);
        sb.onclick = () => { sortBy = on ? { k, low: !sortBy.low } : { k, low: lowFirst }; play('button'); draw(); const bd = box.querySelector('.idg-pp-body'); if (bd) bd.scrollTop = 0; };
        sortBar.append(sb);
      }
      cPlate.append(sortBar);
      const cCol = h('div', 'idg-pp-col cards'); cCol.append(cPlate, body, h('i', 'idg-dlg-more'));
      const grid = h('div', 'idg-pp-grid' + (mains.length ? ' has-strip' : '')); grid.append(sCol, cCol);
      if (mains.length) {
        const strip = h('div', 'idg-pp-strip');
        mains.forEach((bt, k) => { const b = mkBtn(bt, k === 0 ? ' idg-pp-go' : ''); if (k === 0) { const ic = h('span', 'ico'); if (/전투/.test(bt[0])) { const im = h('img'); im.src = `${AI}result/ico_fight.webp`; im.alt = ''; im.draggable = false; ic.append(im); } else ic.innerHTML = RETRY_SVG; b.replaceChildren(ic, h('span', 'lb', bt[0])); } strip.append(b); });
        /* 11/13 대표님 : 전투 개시 아래로 · 길게 → «로비로»(나가기 그림) → 맨 아래 «X 창닫기»(결과 창으로 · 오른쪽 위 닫기 X 와 같은 동작) — 둘 다 금테 없는 보라 단추 */
        const sub = h('div', 'idg-pp-subs');
        if (o.exit) { const lb = exitBtn(' idg-pp-back'); lb.querySelector('.lb').textContent = '로비로'; sub.append(lb); }
        if (closeIdx >= 0) { const cb = mkBtn(o.buttons[closeIdx], ' idg-pp-back idg-pp-close'); const ic = h('i', 'ico'); ic.innerHTML = X_SVG; cb.replaceChildren(ic, h('span', 'lb', '창닫기')); sub.append(cb); }
        strip.append(sub);   /* 3차 : «돌아가기» → «나가기»(로비) · 결과 창으로는 오른쪽 위 닫기 X */
        grid.append(strip);
      }
      box.replaceChildren(top, grid, ...(t ? [t] : []));
      box.classList.toggle('more-host', false);
    } else {
      if (o.buttons.length) { row = h('div', 'idg-row idg-pp-row'); for (const [k, bt] of o.buttons.entries()) row.appendChild(o.exit && k === closeIdx ? exitBtn() : mkBtn(bt)); }   /* 3차 : 전투 판 사이 세로도 «돌아가기» → «나가기»(로비) */   /* 세로 = 예전 단추 줄 (로비 «닫기» · 전투 «전투 개시!/다시하기» + «돌아가기») */
      const side = h('div', 'idg-pp-side'); side.append(lead, slots, hint, guide()); if (limit) side.append(limit);
      /* 고정 틀 : 머리는 위에 고정 · 가운데만 스크롤 · (전투 안) 앞으로 가는 단추 한 줄은 아래에 고정
       * 가운데 칸은 겉 상자(.idg-pp-bodyw) 안에서 스크롤 → 금 도트 줄(겉 상자 위 · 아래 테)은 스크롤 칸 밖이라 내용이 줄을 넘어 그려지지 않는다 (11/12 대표님) */
      const bodyW = h('div', 'idg-pp-bodyw');
      bodyW.appendChild(body); body.append(side, list);
      box.replaceChildren(head, bodyW, h('i', 'idg-dlg-more'), ...(row ? [row] : []), ...(t ? [t] : []));   /* idg-dlg-more = 스크롤 화살표 표(가운데 칸 아래 금 테에 걸침) */
    }
    box.classList.toggle('no-foot', !row);
    { const sb = box.querySelector('.idg-pp-sbody'); if (sb) { if (keepS) { sb.scrollTop = keepS; requestAnimationFrame(() => { sb.scrollTop = keepS; }); }
      /* 왼쪽 출전 칸도 넘치면 스크롤 + 아래 «더 있음» 화살표 (2차) */
      const col = sb.parentElement, u2 = () => { const ov = sb.scrollHeight - sb.clientHeight; col.classList.toggle('more-down', moreDown(sb)); };
      sb.addEventListener('scroll', u2, { passive: true }); sb.addEventListener('load', u2, true); requestAnimationFrame(() => requestAnimationFrame(u2)); setTimeout(u2, 400); } }
    /* 스크롤 그대로 (11/12 서브창2 · 레벨업 · 끼우기 뒤 맨 위로 튀지 않게) : 내용을 넣은 바로 뒤 + 다음 그림 직전 + 머리 그림이 늦게 들어올 때 */
    { const t0 = performance.now(); const hold = keep > 0; let on = hold;
      const back = () => { if (on && performance.now() - t0 < 700 && Math.abs(body.scrollTop - keep) > 1) body.scrollTop = keep; };
      if (hold) { body.scrollTop = keep; requestAnimationFrame(back); body.addEventListener('load', back, true); body.addEventListener('pointerdown', () => { on = false; }, { once: true }); } }
    /* 스크롤 표시 (11/12 대표님) : 아래가 더 있으면 금 화살표 · 넘치면 금 도트 줄 — 모양은 idg-subwin.css */
    { const upd = () => { const over = body.scrollHeight - body.clientHeight; box.classList.toggle('scrolls', over > 2); box.classList.toggle('more-down', moreDown(body)); };
      body.addEventListener('scroll', upd, { passive: true }); body.addEventListener('load', upd, true); requestAnimationFrame(() => requestAnimationFrame(upd)); setTimeout(upd, 400); }
  }

  /* 칸 누르기 : 고름 → 바꿈 · 빈 칸 = 맨 뒤로 · 고른 칸 다시 = 빼기 */
  function tapSlot(i, deck) {
    const id = deck[i];
    if (swapFor) { if (id) { const d = deck.slice(); d[i] = swapFor; setDeck(d); play('deploy_s'); } swapFor = null; sel = null; draw(); return; }
    if (!id) { if (sel != null) { moveSlot(sel, i); sel = null; play('deploy_s'); } draw(); return; }
    if (sel == null) { sel = i; play('button'); draw(); return; }
    if (sel === i) { sel = null; setDeck(deck.filter((x) => x !== id)); play('button_back'); draw(); return; }
    moveSlot(sel, i); sel = null; play('deploy_s'); draw();
  }
  /** i 칸을 j 칸으로 : 둘 다 차 있으면 맞바꿈 · j 가 빈 칸이면 맨 뒤(첫 빈 칸)로 */
  function moveSlot(i, j) {
    const d = work.slice();
    if (i === j || i >= d.length) return;
    if (j < d.length) [d[i], d[j]] = [d[j], d[i]]; else d.push(d.splice(i, 1)[0]);
    setDeck(d);
  }
  /* 끌어 놓기 (손가락 · 마우스) : 8px 넘게 움직이면 떠 있는 얼굴이 따라오고, 놓은 칸과 자리 바꿈 */
  function startDrag(e, i, src) {
    if (e.button > 0 || swapFor) return;
    const x0 = e.clientX, y0 = e.clientY, el = e.currentTarget;
    let ghost = null, over = null;
    const at = (ev) => document.elementFromPoint(ev.clientX, ev.clientY)?.closest?.('.idg-pp-slot:not(.locked)');
    const move = (ev) => {
      if (!ghost) {
        if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < 8) return;
        ghost = document.createElement('img'); ghost.className = 'idg-pp-ghost'; ghost.src = src; ghost.alt = '';
        const r = el.getBoundingClientRect(), s = Math.max(r.width, r.height), rt = rotated();
        Object.assign(ghost.style, { width: `${s}px`, height: `${s}px`, transform: `translate(-50%, -50%)${rt === 'cw' ? ' rotate(90deg)' : rt === 'ccw' ? ' rotate(-90deg)' : ''}` });
        document.body.appendChild(ghost); el.classList.add('drag');
      }
      if (ev.cancelable) ev.preventDefault();
      ghost.style.left = `${ev.clientX}px`; ghost.style.top = `${ev.clientY}px`;
      const t = at(ev); if (t !== over) { over?.classList.remove('drop-on'); over = t && t !== el && box.contains(t) ? t : null; over?.classList.add('drop-on'); }
    };
    const end = (ev) => {
      removeEventListener('pointermove', move); removeEventListener('pointerup', end); removeEventListener('pointercancel', end);
      if (!ghost) return;
      ghost.remove(); el.classList.remove('drag'); over?.classList.remove('drop-on');
      eatClick = performance.now();
      const t = ev.type === 'pointerup' ? at(ev) : null;
      if (t && t !== el && box.contains(t)) { moveSlot(i, Number(t.dataset.i)); sel = null; play('deploy_s'); }
      draw();
    };
    addEventListener('pointermove', move, { passive: false }); addEventListener('pointerup', end); addEventListener('pointercancel', end);
  }

  /* 화면을 돌리면 가로 · 세로 배치를 다시 (창이 떠 있는 동안만) */
  let lastLand = isLand();
  const onRs = () => { if (!box.isConnected) { if (lastLand !== null) { removeEventListener('resize', onRs); lastLand = null; } return; } fitCls(box); if (isLand() !== lastLand) { lastLand = isLand(); draw(); } };
  addEventListener('resize', onRs);
  draw();
  return Object.assign(box, { deckShort, warnShort, guard });
}
