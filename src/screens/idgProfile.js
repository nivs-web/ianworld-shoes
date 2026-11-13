/**
 * 좀비와 드래곤 — «프로필» 창 (겜보조 2 · 11/13 · 로비 왼쪽 위 프로필을 누르면 · IDG_UI_PATTERNS §5 현판 + X 하나)
 *  테두리 · 칭호 고르기 (꾸미기 창에서 옮겨 왔다). 꾸미기 창은 이미 고른 값만 그대로 두고 저장한다.
 *  초고수 칭호는 data/looks.js 한 곳의 규칙(titleVisible · visibleLooks) 그대로 — 보통 10-10 을 깨지 않은 계정에는 목록 · 잠김 안내 어디에도 «초고수» 글자가 없다.
 *  showProfile({ idg, save, info, onClose }) — info() = 위 얼굴 · 이름 · 레벨 줄(로비가 만든 것) · save(part) = 저장 후 새 idg 를 돌려주는 함수(G.saveIdg).
 */
import { el, presentOverlay } from './ui.js';
import * as Sfx from '../audio/sfx.js';
import { kitTabs, kitClose } from './idgKit.js';
import { itemGrid } from './idgLookParts/grid.js';
import { visibleLooks, hasItem, artOf, artFilter, titleVisible, TITLES, SEES_MASTER } from '../games/iandragon_game/data/looks.js';
import { wearOf, keepOf, partsFor } from './idgLookParts/wear.js';
import { allStars } from '../services/iandragonGame.js';
import '../styles/idg-lobby2.css';   /* 로비 프로필 판 부품(.l2-*) 그대로 재사용 */
import '../styles/idg-lvbadge.css';
import '../styles/idg-look2.css';
import '../styles/idg-profile.css';

const TABS = [['frame', '테두리'], ['title', '칭호']];
const HOW = { frame: '명예의 전당 시즌 보상으로 받아요', gift: '레벨 선물에서 나와요' };

export function showProfile({ idg, save, info, onClose }) {
  Sfx.play('sfx_menu_select');
  let cur = idg, tab = 'frame', grid = null;
  const keep = keepOf(cur);
  const sel = { frame: keep.frame || null, title: TITLES.some((t) => t.id === cur.title && t.has(cur) && titleVisible(t, cur)) ? cur.title : null };

  /** 이 칸의 카드들 — 가진 것 → 못 가진 것(얻는 법만) . 보이면 안 되는 것(초고수 칭호)은 visibleLooks 가 거른다 */
  function itemsOf(slot) {
    /* «보라 불꽃 테두리»(초고수 10-10 보상)는 data 에 vis 가 없어 여기서 같은 규칙으로 거른다 — 보통 10-10 전 계정에는 보라 · 초고수 단서가 없어야 한다 */
    return visibleLooks(cur)[slot].filter((x) => !(slot === 'frame' && x.id === 'violet') || SEES_MASTER(cur) || hasItem(cur, slot, x.id)).map((x) => {
      const t = slot === 'title' ? TITLES.find((q) => q.id === x.id) : null, owned = hasItem(cur, slot, x.id);
      const f = artFilter(slot, x.id);
      return { id: x.id, name: x.name, owned, sub: ' ', art: artOf(slot, x.id), filter: f, lock: t ? t.how : x.gift ? HOW.gift : HOW.frame };
    });
  }
  const commit = (slot, id) => {
    sel[slot] = id || null;
    const p = partsFor(wearOf(cur), { frame: sel.frame, title: sel.title });   // 오라 · 펫 · 지붕 …도 같이 다시 적는다(테두리 · 칭호 글자만 바뀜)
    const n = save({ ...p, title: sel.title || '' }); if (n) cur = n;
    grid?.mark();
  };
  function build() {
    const slot = tab;
    grid = itemGrid(itemsOf(slot), { none: '없음', isOn: (id) => (sel[slot] || null) === id, onPick: (id) => commit(slot, id) });
    content.replaceChildren(grid);
  }
  const content = el('div.idg-pf-content');
  const tabs = kitTabs({ old: true, label: '프로필 칸', tabs: TABS.map(([id, label]) => ({ id, label })), value: tab, onPick: (id) => { tab = id; build(); } });
  build();

  /** 머리 = 로비 왼쪽 위 프로필 판과 같은 부품(.l2-player · 금 얼굴 테 · 칭호 리본 · 이름 판 · Lv 배지 · 경험치) — 로비가 넘긴 얼굴 · 이름 · 레벨 · 칭호만 골라 같은 모양으로 다시 짠다 */
  function headOf() {
    const src = info?.(); if (!src) return null;
    const face = src.querySelector('.l2-face'), nick = src.querySelector('.idg-pf-nick')?.textContent || '???', lv = src.querySelector('.idg-lv'), ttl = (src.querySelector('.idg-pf-ttl')?.textContent || '').replace(/[«»]/g, '');
    const all = allStars(cur);
    return el('div.l2-player', null, [
      face,
      el('div.l2-plate', null, [
        ttl ? el('div.l2-ttl', null, [el('i', '칭호'), el('span', ttl)]) : null,
        el('div.l2-name', null, [lv, el('span.l2-nick', nick)]),
        el('span.l2-xp', { title: `별 ${all}개 · 다음 레벨까지 ${5 - (all % 5)}개` }, [el('i', { style: `width:${Math.round((all % 5) / 5 * 100)}%` })]),
      ]),
    ]);
  }
  const head = el('div.idg-pf-info', null, [headOf()]);
  const box = el('div.dialog.idg-shop.idg-lab.idg-k.idg-profile', { onclick: (e) => e.stopPropagation() }, [
    el('div.idg-how-title', null, ['프로필', kitClose(() => close())]),
    el('div.idg-shop-wrap', null, [head, el('div.idg-pf-main', null, [tabs, content])]),   // 가로 = 왼쪽 머리 | 오른쪽(탭 · 격자)
  ]);
  const overlay = el('div.dialog-overlay', { onclick: () => close() }, [box]);
  let done = false;
  const ended = () => { if (done) return; done = true; onClose?.(); };   // 닫으면(뒤로가기 포함) 로비 다시 그리기
  const closeO = presentOverlay(overlay, ended);
  const close = () => { closeO(); ended(); };
}
