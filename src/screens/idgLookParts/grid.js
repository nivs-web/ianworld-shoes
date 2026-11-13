/**
 * 꾸미기 창 물건 격자 — 샵과 같은 카드 모양(shopPanels/_ui.js card) · 등급 색 테 + ★ 수 (겜보조 2 · 11/13)
 *  가진 것 = 눌러서 입기 · 입은 것을 다시 누르면 벗기 · 안 가진 것 = 자물쇠 + «아이템 샵에서 팔아요» + 바로 가기
 *  고를 때 격자를 다시 그리지 않는다(.mark() 가 «.on» 표만 바꿈) → 스크롤 자리가 그대로.
 */
import { el } from '../ui.js';
import { kitBtn } from '../idgKit.js';
import { card, list, line, lockLine, snd } from '../shopPanels/_ui.js';
import { ICON } from '../shopPanels/_data.js';
import { RARITY, stars } from './catalog.js';

const PLACE = '곧 새 물건이 들어와요';   /* 임시 : 오라 · 펫 · 지붕 · 정문 · 앞마당은 아직 물건(그림)이 없다 */

/**
 * @param {Array<{id:string, name:string, owned:boolean, rarity?:number, sub?:string, fx?:string, art?:string, lock?:string}>} items
 * @param {{none?:string, toggle?:boolean, isOn:(id:string|null)=>boolean, onPick:(id:string|null)=>void, goShop?:()=>void}} o  none = «벗기» 카드 이름(없으면 카드 없음) · toggle = 입은 것을 다시 눌러도 id 를 넘김(장비 칸처럼 부르는 쪽이 켜고 끈다)
 * @returns {HTMLElement & {mark:()=>void}}
 */
export function itemGrid(items, o) {
  const root = el('div.idg-lg');
  const cards = [];
  /* 세로(작은 카드) : 효과 한 줄 · 잠김 안내는 카드 대신 이 설명 줄에 — 카드를 누르면 채워진다(가로는 카드 안에 그대로 있어 이 줄을 숨김) */
  const desc = el('div.idg-lg-desc', { role: 'status', 'aria-live': 'polite' });
  const say = (it) => {
    desc.replaceChildren(el('b', it.name), ...(it.fx ? [el('span', it.fx)] : []),
      ...(it.owned ? [] : [lockLine(it.lock || '아이템 샵에서 팔아요'), ...(o.goShop ? [kitBtn({ kind: 'purple', size: 'sm', text: '샵 가기', cls: 'idg-lg-go', onClick: (e) => { e.stopPropagation(); o.goShop(); } })] : [])]));
  };
  const mk = (it) => {
    const r = it.rarity ? RARITY[it.rarity - 1] : null;
    const l1 = r ? el('span.stars', { style: { '--rc': r.c } }, [stars(it.rarity), el('small', ` ${r.n}`)]) : it.sub || ' ';
    const c = card({
      id: it.id, face: it.art || '', name: it.name, l1, locked: !it.owned,
      rows: it.fx ? [line(it.fx)] : [],
      foot: it.owned ? [] : [lockLine(it.lock || '아이템 샵에서 팔아요'), ...(o.goShop ? [kitBtn({ kind: 'purple', size: 'sm', text: '샵 가기', cls: 'idg-lg-go', onClick: (e) => { e.stopPropagation(); o.goShop(); } })] : [])],
    });
    if (r) c.style.setProperty('--rc', r.c), c.classList.add(`r${it.rarity}`);
    if (it.filter) { const im = c.querySelector('img'); if (im) im.style.filter = it.filter; }   /* 새 테두리 = 기존 그림 + 색 필터 (미리보기 카드 한정 · 전투 아님) */
    if (!it.owned) {
      c.querySelector('.idg-sp-top')?.append(el('img.idg-lg-lockmini', { src: ICON.lock, alt: '', draggable: 'false' }));
      c.addEventListener('click', () => { snd('sfx_menu_select'); say(it); });
    }
    if (it.owned) {
      c.classList.add('pick'); c.tabIndex = 0; c.setAttribute('role', 'button');
      const go = () => { snd('sfx_menu_select'); say(it); o.onPick(o.toggle || !o.isOn(it.id) ? it.id : null); };
      c.onclick = go;
      c.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } };
    }
    cards.push({ id: it.id, node: c });
    return c;
  };
  const owned = items.filter((x) => x.owned), rest = items.filter((x) => !x.owned);
  const nodes = [];
  if (o.none) {
    const n = card({ id: '', face: '', name: o.none, l1: '벗기', rows: [] });
    n.classList.add('pick', 'none'); n.tabIndex = 0; n.setAttribute('role', 'button');
    n.onclick = () => { snd('sfx_menu_select'); o.onPick(null); };
    n.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); o.onPick(null); } };
    cards.push({ id: '', node: n }); nodes.push(n);
  }
  nodes.push(...owned.map(mk), ...rest.map(mk));
  if (!items.length) root.append(el('div.idg-lg-empty', null, [el('i'), el('span', PLACE)]));
  root.append(list(nodes), desc);
  root.mark = () => {
    for (const { id, node } of cards) {
      const on = o.isOn(id || null);
      node.classList.toggle('on', on);
      if (node.classList.contains('pick')) node.setAttribute('aria-pressed', String(on));
      const l1 = node.querySelector('.l1'), tag = l1?.querySelector('.tag');
      if (on && !tag) l1?.append(el('em.tag', id ? '입는 중' : '선택'));
      if (!on && tag) tag.remove();
    }
  };
  root.mark();
  return root;
}
