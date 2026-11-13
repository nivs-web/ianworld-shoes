/**
 * 좀비와 드래곤 — 아이템 샵 (11/13 · 겜보조 1 · 기획 IDG_COLLECTION_PLAN §4)
 *
 * 큰 메뉴 4개(드래곤 · 드래곤캐슬 · 특가 · 편의품) → 하위 메뉴(가로로 넘치면 좌우로만) → 격자(세로 3칸 · 가로 5칸) → 카드.
 * 카드 = 그림 · 이름 · 등급 테(6색) · 효과 한 줄 · 값(아이콘 + 숫자). 순서 : 살 수 있음 → 잠김(조건 한 줄) → 가짐.
 * 샵은 사기만 한다 — 산 직후에만 «바로 입기». 정가 판매만(뽑기 없음) · 현금 없음.
 *
 * 물건 자료 = shopCatalog.js(어댑터) · «드래곤 · 강화 · 캐슬 단계 · 장비» 칸은 shopPanels/<이름>.js 가 그린다(겜보조 2 — 없으면 «준비 중»).
 *   패널 : export default function render(box, ctx) — box 는 빈 칸, 돌려준 함수는 칸을 떠날 때 부른다(없어도 됨).
 *   ctx  : { g(지금 저장값 · 읽기 전용 getter), save(part) → 새 저장값, refresh() 샵 다시 그리기, toast(msg), openLook(slot) 꾸미기 창, sfx(name), wallet 은 save 가 알아서 갱신 }
 *
 * showShop({ idg, save, onClose }) — idg = 지금 저장값(G.idg()), save(part) = 저장 후 새 idg 를 돌려주는 함수(G.saveIdg).
 * 저장 필드 : owned(가진 꾸미기 열쇠 배열 'hat:crown') · cons({ember50: 개수}) · look(입은 것) · coins / gems.
 */
import '../styles/idg-shop.css';
import { el, presentOverlay, toast as uiToast } from './ui.js';
import * as Sfx from '../audio/sfx.js';
import { kitWallet, kitTabs, kitPaper, kitRow, kitBtn, kitCheck, kitScroll, kitLock, kitCoin, kitGem, kitFmt, kitClose } from './idgKit.js';
import { CONSUMABLES, CONS_MAX, todayKst } from '../games/iandragon_game/data/looks.js';
import { SHOP_SLOT, RARITY, itemsOf, dealsOf, dealPrice, isOwned, isWorn, stateOf, canPay, lockText, loadCatalog } from './shopCatalog.js';
import { wearPart } from './idgLookParts/wear.js';
import { recoCard } from './shopPanels/_reco.js';

const META = '/assets/iandragon_game/ai/meta/';
const STAR = '/assets/iandragon_game/ai/result/star_on.webp';   // 등급 별 (결과 창 별과 같은 그림)
/* 패널 파일 — 있으면 처음 열 때 받는다(따로 묶음). 없으면 빈 묶음 */
const PANELS = import.meta.glob('./shopPanels/*.js');
const panelPath = (name) => `./shopPanels/${name}.js`;
const hasPanel = (name) => !!PANELS[panelPath(name)];

const BIG = [['dragon', '드래곤'], ['castle', '드래곤캐슬'], ['deal', '특가'], ['cons', '편의품']];
/* 하위 메뉴 [id, 이름, 패널 파일(있으면 패널)] — 칸 id 는 shopCatalog 의 SHOP_SLOT 과 같다 */
const SUBS = {
  dragon: [['dragon', '드래곤', 'dragon'], ['power', '강화', 'breath'], ['hat', '모자'], ['neck', '목 장식'], ['breath', '브레스 색'], ['aura', '오라'], ['pet', '펫']],
  castle: [['stage', '캐슬 단계', 'castle'], ['gear', '장비', 'gear'], ['flag', '깃발'], ['roof', '지붕'], ['gate', '정문'], ['yard', '앞마당']],
};
const firstSub = (big) => { const l = SUBS[big]; return (l.find((s) => (s[2] ? hasPanel(s[2]) : true)) || l[0])[0]; };

/** 아이템 그림 — 그림 파일이 아직 없으면 글자(이름 앞 두 글자)로 보인다 */
function artBox(it) {
  const wrap = el('span.idg-shop-art');
  const img = el('img', { src: it.art, alt: '', loading: 'lazy', decoding: 'async', draggable: false });
  img.onerror = () => { wrap.replaceChildren(el('i', String(it.name).slice(0, 2))); };
  wrap.append(img);
  return wrap;
}

export function showShop({ idg, save, onClose }) {
  Sfx.play('sfx_menu_select');
  let cur = idg, big = 'dragon', gen = 0, dead = false, offPanel = null;
  const sub = { dragon: firstSub('dragon'), castle: firstSub('castle') };
  let onlyMissing = false;
  const fresh = new Set();   // 이번에 방금 산 열쇠 — 맨 위에 두고 «바로 입기»

  /* ── 저장 · 알림 ── */
  const ctx = {
    get g() { return cur; },
    save(part) { const next = save(part); if (next) cur = next; head.update({ coins: cur.coins, gems: cur.gems }); return cur; },
    refresh() { draw(false); },
    toast(msg) { uiToast(msg); },
    sfx(name) { Sfx.play(name); },
    openLook(slot) {
      import('./idgLook.js').then((m) => m.showLook({ idg: cur, save: ctx.save, onClose: () => { if (!dead) draw(false); } })).catch(() => {});
    },
  };

  /* ── 틀 ── */
  const head = kitWallet({ coins: cur.coins, gems: cur.gems });
  const help = el('div.idg-shop-help');
  const keeper = el('img.idg-shopkeeper', { src: META + 'shopkeeper.png', alt: '', onerror: (e) => { e.target.style.display = 'none'; } });
  const bigTabs = kitTabs({ old: true, label: '샵 큰 메뉴', tabs: BIG.map(([id, label]) => ({ id, label })), value: big, onPick: (k) => { big = k; draw(true); } });
  bigTabs.classList.add('idg-shop-big');
  let subTabs = null;
  const subSlot = el('div.idg-shop-subslot');
  const countEl = el('span.idg-shop-count');
  const filter = kitCheck({ label: '안 가진 것만', on: onlyMissing, onChange: (v) => { onlyMissing = v; draw(true); } });
  const info = el('div.idg-shop-info', null, [countEl, filter]);
  const content = el('div.idg-shop-content');
  const scroll = kitScroll([content]);
  scroll.classList.add('idg-shop-scroll');

  const side = el('div.idg-shop-side', null, [el('div.idg-shop-wal', null, [keeper, head]), info, help]);
  const reco = el('div.idg-shop-reco');
  const main = el('div.idg-shop-main', null, [reco, bigTabs, subSlot, scroll]);
  const wrap = el('div.idg-shop-wrap', null, [side, main]);
  const box = el('div.dialog.idg-shop.idg-lab.idg-k', { onclick: (e) => e.stopPropagation() }, [el('div.idg-how-title', null, ['아이템 샵', kitClose(() => close())]), wrap]);   /* 닫기 = 머리 오른쪽 X 하나 (IDG_UI_PATTERNS §5) */
  const overlay = el('div.dialog-overlay', { onclick: () => close() }, [box]);
  const closeO = presentOverlay(overlay);
  const close = () => { dead = true; leavePanel(); closeO(); onClose?.(); };   // 닫으면 로비 코인 · 젬 다시 그리기
  function leavePanel() { if (typeof offPanel === 'function') { try { offPanel(); } catch { /* 무시 */ } } offPanel = null; }

  /* ── 사기 · 입기 ── */
  const msg = (t) => ctx.toast(t);
  function buy(it, price) {
    const now = cur;
    if (isOwned(now, it)) return;
    if (!canPay(now, price)) { Sfx.play('sfx_denied'); return; }
    const next = ctx.save({ owned: [...(now.owned || []), it.key], ...(price.coin ? { coins: now.coins - price.coin } : {}), ...(price.gem ? { gems: now.gems - price.gem } : {}) });
    if (next) fresh.add(it.key);
    Sfx.play('sfx_purchase'); draw(false);
  }
  function equip(it) {
    ctx.save(wearPart(cur, it.slot, it.id));
    fresh.delete(it.key); Sfx.play('sfx_menu_select'); msg(`${it.name} 입었어요`); draw(false);
  }

  /* ── 카드 ── */
  /** 값 단추 : 초록 고급 단추 + 재화 아이콘 + 숫자 (둘 다 있으면 두 개 · 모자란 쪽 숫자만 빨강) */
  function priceBtn(price, onClick) {
    const poor = !canPay(cur, price);
    const coinShort = price.coin && (cur.coins || 0) < price.coin, gemShort = price.gem && (cur.gems || 0) < price.gem;
    const label = [price.coin ? `금화 ${kitFmt(price.coin)}` : '', price.gem ? `젬 ${kitFmt(price.gem)}` : ''].filter(Boolean).join(' ');
    const b = el(`button.idg-k-btn.price.green.sm${poor ? '.poor' : ''}`, { type: 'button', disabled: poor, 'aria-label': label + (poor ? ' (모자라요)' : ''), title: poor ? '모자라요' : null,
      onclick: () => { if (!b.disabled) { Sfx.play('sfx_menu_select'); onClick(); } } },
    [price.coin ? kitCoin(price.coin, { cls: coinShort ? 'short' : '' }) : null, price.gem ? kitGem(price.gem, { cls: gemShort ? 'short' : '' }) : null]);
    return b;
  }
  /** 물건 카드 — sale 이면 특가(30% 싸게 · 정가 줄긋기) */
  function card(it, sale) {
    const st = stateOf(cur, it), pr = it.price && sale ? { ...(it.price.coin ? { coin: dealPrice(it.price.coin) } : {}), ...(it.price.gem ? { gem: dealPrice(it.price.gem) } : {}) } : it.price;
    const worn = st === 'owned' && isWorn(cur, it);
    let foot;
    if (st === 'buy') foot = priceBtn(pr, () => buy(it, pr));
    else if (st === 'locked') foot = el('span.idg-shop-lock', lockText(it));
    else if (fresh.has(it.key) && !worn) foot = kitBtn({ kind: 'green', text: '바로 입기', size: 'sm', onClick: () => equip(it) });
    else foot = kitBtn({ kind: 'purple', text: worn ? '입는 중' : '가졌어요', size: 'sm', disabled: true });
    const stateCls = st === 'owned' ? 'got' : st === 'locked' ? 'locked' : (canPay(cur, pr) ? 'buy' : 'buy poor');
    return el(`div.idg-shop-card.r-${it.rarity}.${stateCls.split(' ').join('.')}`, { role: 'group', 'aria-label': `${it.name} · ${RARITY[it.rarity].name} ★${RARITY[it.rarity].stars}${st === 'locked' ? ' · 잠김' : st === 'owned' ? ' · 가졌어요' : ''}` }, [
      el('div.idg-shop-artwrap', null, [artBox(it), el('span.idg-shop-stars', { 'aria-hidden': 'true' }, Array.from({ length: RARITY[it.rarity].stars }, () => el('img', { src: STAR, alt: '', draggable: false }))), st === 'locked' ? kitLock() : null]),
      el('b.idg-shop-name', it.name),
      el('span.idg-shop-fx', it.fx),
      sale && st === 'buy' ? el('i.idg-shop-sale', '30%') : null,
      el('div.idg-shop-foot', null, [foot]),
    ]);
  }
  /** 살 수 있음(방금 산 것 맨 위 · 값 낼 수 있는 것 먼저) → 잠김(조건 순서) → 가짐 */
  function ordered(list) {
    const rank = (it) => (fresh.has(it.key) ? -1 : { buy: canPay(cur, it.price) ? 0 : 1, locked: 2, owned: 3 }[stateOf(cur, it)]);
    return list.map((it, i) => [it, i, rank(it)]).sort((a, b) => a[2] - b[2] || a[1] - b[1]).map((x) => x[0]);
  }

  /* ── 한 칸 그리기 ── */
  function setSubTabs() {
    subSlot.replaceChildren();
    subTabs = null;
    if (!SUBS[big]) return;
    subTabs = kitTabs({ label: '샵 하위 메뉴', tabs: SUBS[big].map(([id, label]) => ({ id, label })), value: sub[big], onPick: (k) => { sub[big] = k; draw(true); } });
    subTabs.classList.add('idg-shop-sub');
    subSlot.append(subTabs);
    requestAnimationFrame(() => subTabs.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' }));   // 가로로 넘치면 고른 단추가 보이게
  }
  const setInfo = (on, text = '') => { info.style.display = on ? '' : 'none'; countEl.textContent = text; };
  const soon = (t) => [kitPaper([t, el('small', '곧 열려요')])];
  function place(nodes) { content.replaceChildren(...nodes); scroll.refresh(); }

  async function draw(top) {
    const my = ++gen;
    head.update({ coins: cur.coins, gems: cur.gems });
    bigTabs.set(big);
    drawReco();
    if (top) { leavePanel(); setSubTabs(); scroll.inner.scrollTop = 0; } else if (subTabs && SUBS[big]) subTabs.set(sub[big]);
    help.replaceChildren();
    content.className = 'idg-shop-content';
    if (big === 'deal') {
      setInfo(false);
      const day = todayKst();
      help.replaceChildren(kitPaper([`오늘(${day})의 특가 — 꾸미기 3개가 `, el('b', '30% 싸요'), '.', el('small', '한국 시간 자정에 바뀌어요.')]));
      content.classList.add('is-grid');
      return place(dealsOf(day, cur).map((it) => card(it, true)));
    }
    if (big === 'cons') {
      setInfo(false);
      help.replaceChildren(kitPaper(['편의품은 한 판에 ', el('b', '하나만'), ' 쓸 수 있어요. 혼자 하기(스테이지)에서만 써요.']));
      content.classList.add('is-list');
      return place(CONSUMABLES.map((c) => {
        const n = Number(cur.cons?.[c.id]) || 0, can = cur.coins >= c.price && n < CONS_MAX;
        const buyC = () => {
          const now = cur, have0 = Number(now.cons?.[c.id]) || 0;
          if (now.coins < c.price || have0 >= CONS_MAX) { Sfx.play('sfx_denied'); return; }
          ctx.save({ coins: now.coins - c.price, cons: { ...(now.cons || {}), [c.id]: have0 + 1 } });
          Sfx.play('sfx_purchase'); draw(false);
        };
        const poor = !can && n < CONS_MAX;
        return kitRow({ title: `${c.name} (가진 수 ${n})`, sub: c.desc,
          right: n >= CONS_MAX ? kitBtn({ kind: 'purple', text: '가득 찼어요', size: 'sm', disabled: true })
            : el(`button.idg-k-btn.price.green.sm${poor ? '.poor' : ''}`, { type: 'button', disabled: poor, 'aria-label': `금화 ${kitFmt(c.price)}`, onclick: buyC }, [kitCoin(c.price, { cls: poor ? 'short' : '' })]) });
      }));
    }
    /* 드래곤 · 드래곤캐슬 */
    const [id, , panel] = SUBS[big].find((s) => s[0] === sub[big]) || SUBS[big][0];
    if (panel) {
      setInfo(false);
      content.classList.add('is-panel');
      if (!hasPanel(panel)) return place(soon('이 칸은 준비 중이에요'));
      const holder = el('div.idg-shop-panel');
      place([holder]);
      try {
        const mod = await PANELS[panelPath(panel)]();
        if (my !== gen || dead) return;
        leavePanel();
        offPanel = mod.default(holder, ctx);
        scroll.refresh();
      } catch (e) { if (my === gen) place(soon('이 칸은 준비 중이에요')); }
      return;
    }
    const all = itemsOf(id, cur);
    if (!all.length) { setInfo(false); content.classList.add('is-panel'); return place(soon(`${SHOP_SLOT[id].name} 물건은 아직 없어요`)); }
    const got = all.filter((it) => isOwned(cur, it)).length;
    setInfo(true, `모은 수 ${got} / ${all.length}`);
    const list = ordered(all).filter((it) => !onlyMissing || !isOwned(cur, it) || fresh.has(it.key));
    content.classList.add('is-grid');
    place(list.length ? list.map((it) => card(it, false)) : [kitPaper(['다 모았어요!', el('small', '«안 가진 것만» 을 끄면 다 보여요.')])]);
  }
  /* 맨 위 «추천 강화» 한 장 — 드래곤 · 드래곤캐슬 큰 메뉴에서만 */
  function drawReco() {
    reco.replaceChildren();
    if (big !== 'dragon' && big !== 'castle') return;
    const c = recoCard(ctx, { onBought: () => draw(false) });
    if (c) reco.append(c);
  }
  /* 물건 목록(data/catalog.js)은 처음 열 때 한 번 받는다 */
  place(soon('불러오는 중이에요'));
  loadCatalog().then(() => { if (!dead) draw(true); });
}
