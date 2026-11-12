/**
 * 좀비와 드래곤 — «용 시장» (META 기획서 3장 · 2026-11-11)
 * 탭 3개 : 꾸미기 · 오늘의 특가 · 편의품.
 * 정가 판매만(뽑기 없음) · 현금 없음 · 꾸미기는 능력치 영향 없음 · 편의품은 판마다 1개, 혼자 하기(스테이지)만.
 * 저장 필드 : owned (가진 꾸미기 열쇠 배열, 예 'hat:crown') · cons ({ember50: 개수, ...}) · coins / gems 차감.
 * showShop({ idg, save }) — idg = 지금 저장값(G.idg() 결과), save(part) = 저장 후 새 idg 를 돌려주는 함수(G.saveIdg).
 */
import { el, button, presentOverlay } from './ui.js';
import * as Sfx from '../audio/sfx.js';
import { kitWallet, kitTabs, kitPaper, kitSection, kitRow, kitPriceBtn, kitBtn } from './idgKit.js';   /* UI 키트 (11/12 · docs/IDG_DESIGN_STYLESHEET.md) */
import { SLOT_NAME, LOOKS, CONSUMABLES, CONS_MAX, SELLABLE, keyOf, parseKey, priceOf, dealPrice, dealsFor, todayKst, artOf } from '../games/iandragon_game/data/looks.js';

const META = '/assets/iandragon_game/ai/meta/';
const fmt = (n) => Number(n || 0).toLocaleString('en-US');
const TABS = [['look', '꾸미기'], ['deal', '오늘의 특가'], ['cons', '편의품']];
const ICON = { width: '40px', height: '40px', display: 'grid', placeItems: 'center', flex: '0 0 40px', fontSize: '10px', color: '#bba', textAlign: 'center', overflow: 'hidden' };

/** 아이템 그림 — 그림 파일이 아직 없으면 글자(이름 첫 글자들)로 보인다 */
export function itemIcon(slot, id, name) {
  const wrap = el('span', { style: ICON });
  const img = el('img', { src: artOf(slot, id), alt: '', style: 'width:100%;height:100%;object-fit:contain' });
  img.onerror = () => { wrap.replaceChildren(document.createTextNode(String(name || id).slice(0, 4))); };
  wrap.append(img);
  return wrap;
}

export function showShop({ idg, save, onClose }) {
  Sfx.play('sfx_menu_select');
  let cur = idg, tab = 'look';
  const body = el('div.idg-lab-sec');
  /* 상점 = 지갑 판 → 고풍 탭 → 종이 안내 → 소제목 → 목록 줄(끝에 가격 단추) → 보라 «닫기» (키트 규칙 8장) */
  const head = kitWallet({ coins: cur.coins, gems: cur.gems }), help = el('div.idg-shop-help');
  const tabs = kitTabs({ old: true, label: '상점 칸', tabs: TABS.map(([id, label]) => ({ id, label })), value: tab, onPick: (k) => { tab = k; draw(); } });
  const have = (key) => Array.isArray(cur.owned) && cur.owned.includes(key);
  const afford = (p, price) => (p.gem ? cur.gems : cur.coins) >= price;

  /** 꾸미기 한 줄 — price 를 따로 받아 특가(할인가)도 같은 줄을 쓴다 */
  function lookRow(key, sale) {
    const { slot, id, item } = parseKey(key), p = priceOf(key), price = sale ? dealPrice(p.price) : p.price, got = have(key);
    const buy = () => {
      const now = cur;   // 최신값으로 다시 확인 (두 번 눌러도 한 번만)
      if (Array.isArray(now.owned) && now.owned.includes(key)) return;
      if ((p.gem ? now.gems : now.coins) < price) { Sfx.play('sfx_denied'); return; }
      const next = save({ owned: [...(now.owned || []), key], ...(p.gem ? { gems: now.gems - price } : { coins: now.coins - price }) });
      if (next) cur = next;
      Sfx.play('sfx_purchase'); draw();
    };
    /* 값은 단추에만 (아이콘 + 숫자) — 아래 줄은 종류 · 특가면 정가 줄긋기 */
    return kitRow({ icon: itemIcon(slot, id, item.name), title: item.name, hi: sale,
      sub: el('span.idg-shop-price', null, sale ? [SLOT_NAME[slot], ' · ', el('s', fmt(p.price)), ' ', el('em.idg-sale', '30% 할인')] : [SLOT_NAME[slot]]),
      right: got ? kitBtn({ kind: 'purple', text: '가졌어요', size: 'sm', disabled: true }) : kitPriceBtn({ [p.gem ? 'gem' : 'coin']: price, size: 'sm', poor: !afford(p, price), label: '', onClick: buy }) });
  }

  function lookTab() {
    help.replaceChildren(kitPaper(['꾸미기는 멋만 내요. 힘은 세지지 않아요.', el('small', '테두리는 명예의 전당 보상 · 칭호는 도전 과제로 얻어요')]));
    const out = [];
    for (const slot of ['hat', 'neck', 'breath', 'flag']) {
      out.push(kitSection(SLOT_NAME[slot]));
      for (const x of LOOKS[slot]) {
        const key = keyOf(slot, x.id);
        if (!SELLABLE.includes(key)) {   // 기본 불꽃 — 늘 가짐
          out.push(kitRow({ icon: itemIcon(slot, x.id, x.name), title: x.name, sub: SLOT_NAME[slot], right: kitBtn({ kind: 'purple', text: '처음부터 있어요', size: 'sm', disabled: true }) }));
          continue;
        }
        out.push(lookRow(key, false));
      }
    }
    return out;
  }

  function dealTab() {
    const day = todayKst(), keys = dealsFor(day);
    help.replaceChildren(kitPaper([`오늘(${day})의 특가 — 꾸미기 3개가 `, el('b', '30% 싸요'), '.', el('small', '한국 시간 자정에 바뀌어요.')]));
    return keys.map((k) => lookRow(k, true));
  }

  function consTab() {
    help.replaceChildren(kitPaper(['편의품은 한 판에 ', el('b', '하나만'), ' 쓸 수 있어요. 혼자 하기(스테이지)에서만 써요.', el('small', '명예의 전당 도전 · 같이 깨기 · 용 대결에서는 못 써요.')]));
    return [
      ...CONSUMABLES.map((c) => {
        const n = Number(cur.cons?.[c.id]) || 0, can = cur.coins >= c.price && n < CONS_MAX;
        return kitRow({ title: `${c.name} (가진 수 ${n})`, sub: c.desc,
          right: n >= CONS_MAX ? kitBtn({ kind: 'purple', text: '가득 찼어요', size: 'sm', disabled: true }) : kitPriceBtn({
            coin: c.price, size: 'sm', poor: !can,
            onClick: () => {
              const now = cur, have0 = Number(now.cons?.[c.id]) || 0;
              if (now.coins < c.price || have0 >= CONS_MAX) { Sfx.play('sfx_denied'); return; }
              const next = save({ coins: now.coins - c.price, cons: { ...(now.cons || {}), [c.id]: have0 + 1 } });
              if (next) cur = next;
              Sfx.play('sfx_purchase'); draw();
            },
          }) });
      }),
    ];
  }

  function draw() {
    head.update({ coins: cur.coins, gems: cur.gems });
    body.replaceChildren(...(tab === 'look' ? lookTab() : tab === 'deal' ? dealTab() : consTab()));
  }
  draw();

  const box = el('div.dialog.idg-shop.idg-lab.idg-k', { onclick: (e) => e.stopPropagation() }, [el('div.idg-how-title', '드래곤샵'),
    /* 왼쪽 묶음(가로) = 주인 · 지갑 · 종이 안내 | 오른쪽 = 탭 · 목록 (세로는 위에서 아래로 그대로) */
    el('div.idg-shop-side', null, [el('img.idg-shopkeeper', { src: '/assets/iandragon_game/ai/meta/shopkeeper.png', alt: '', onerror: (e) => { e.target.style.display = 'none'; } }), head, help]),
    tabs, body, button('닫기', () => close())]);
  const overlay = el('div.dialog-overlay', { onclick: () => close() }, [box]);
  const closeO = presentOverlay(overlay);
  const close = () => { closeO(); onClose?.(); };   // 닫으면 로비 코인 · 젬 다시 그리기
}
