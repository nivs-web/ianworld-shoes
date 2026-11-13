/**
 * 좀비와 드래곤 — «꾸미기» 창 (개편 11/13 · 겜보조 2 · 기획 IDG_DRAGON_CASTLE_PLAN §3 · IDG_COLLECTION_PLAN §2 · §10)
 *  위 큰 탭 2개 «드래곤 꾸미기» · «드래곤캐슬 꾸미기» → 작은 단추 → 물건 격자(샵과 같은 카드 · 등급 색 테 + ★).
 *   드래곤 : 대장(가진 것 중 고르기 + 레벨업 = shopPanels/dragon.js 재사용) · 모자 · 목 장식 · 브레스 색 · 오라 · 펫
 *   드래곤캐슬 : 캐슬 모습(가진 단계 중) · 깃발 · 지붕 · 정문 · 앞마당 · 장비(칸 수 = 캐슬 단계)
 *  미리보기 : 드래곤 탭 = 살아 있는 드래곤 / 캐슬 탭 = 캐슬 + 오른쪽 땅 깃발 + 장비 칸. 코디 3칸 저장 · 불러오기 · 주사위 코디.
 *  저장 필드 : look (드래곤 글자 · 깃발 포함) · clook (새 칸 5개) · outfits ['', '', ''] · castle.skin / castle.slots · leader · lead (레벨업)
 *  테두리 · 칭호 고르기는 프로필 창으로 옮긴다 — 여기서는 이미 고른 값만 그대로 두고 저장한다(건드리지 않음).
 *  showLook({ idg, save, onClose }) — save(part) = 저장 후 새 idg 를 돌려주는 함수(G.saveIdg).
 *  물건 목록 = idgLookParts/catalog.js (임시 어댑터 · shopCatalog.js 가 오면 거기만 바꾼다).
 */
import { el, button, presentOverlay } from './ui.js';
import * as Sfx from '../audio/sfx.js';
import { kitTabs, kitKeepScroll } from './idgKit.js';
import { LOOKS, TITLES, encodeLook, decodeLook, artOf } from '../games/iandragon_game/data/looks.js';
import { LEADERS } from '../games/iandragon_game/data/leaders.js';
import { leaderFor, stageByNo } from '../games/iandragon_game/render/battleSetup.js';
import { CASTLE_LV, GEAR, ICON, castleOf, gearLv, leadOwn } from './shopPanels/_data.js';
import dragonPanel from './shopPanels/dragon.js';
import { liveDragon } from './idgLookParts/dragonLive.js';
import { castleStage } from './idgLookParts/castleStage.js';
import { itemGrid } from './idgLookParts/grid.js';
import { outfitBar } from './idgLookParts/outfitBar.js';
import { DRAGON_TABS, CASTLE_TABS, WORN, catalogFor, owns, encodeClook, decodeClook, encodeOutfit, decodeOutfit } from './idgLookParts/catalog.js';
import '../styles/idg-look.css';
import '../styles/idg-look2.css';

const FRAME_COLOR = { wood: '#a0703a', silver: '#c8d0d8', gold: '#FFC93C', fire: '#ff6b2b' };

/** 지금 판 리더 (연구소 설정 g.leader → 실제 무대 드래곤) — 로비 leaderOf · 전투 leaderFor 와 같은 계산 */
const stageNow = (g) => stageByNo(Math.min(100, (g.cleared || 0) + 1));
const autoLeader = (g) => { try { return leaderFor(stageNow(g), { ...g, leader: 'auto' }) || 'novart'; } catch { return 'novart'; } };
const wantOf = (g) => (!g.leader || !LEADERS[g.leader] ? 'auto' : g.leader);
/** 무대에 서는 대장 : 고른 드래곤이 «가진 것»이면 그 드래곤 · 아니면 월드 추천 */
const leadOf = (g) => { const w = wantOf(g); return w !== 'auto' && leadOwn(g).includes(w) ? w : autoLeader(g); };
const pick1 = (a) => a[Math.floor(Math.random() * a.length)];

export function showLook({ idg, save, onClose }) {
  Sfx.play('sfx_menu_select');
  let cur = idg, big = 'dragon', trial = null, panelH = null;
  const small = { dragon: 'dragon', castle: 'skin' };
  const saveSync = (part) => { const n = save(part); if (n) cur = n; return n; };

  /* ── 지금 입은 모습 W (가진 것만 남긴다 — 예전 저장값이 이상해도 안전) ── */
  const lk = decodeLook(cur.look), W = { hat: lk.hat, neck: lk.neck, breath: lk.breath, flag: lk.flag, ...decodeClook(cur.clook), skin: castleOf(cur).skin };
  const keep = { frame: lk.frame, title: TITLES.some((t) => t.id === cur.title && t.has(cur)) ? cur.title : null };   /* 프로필 창 몫 — 그대로 둔다 */
  for (const s of WORN) if (W[s] && !owns(cur, s, W[s])) W[s] = null;
  W.skin = Math.max(1, Math.min(castleOf(cur).lv, W.skin));
  const shown = () => trial || W;
  const persist = () => {
    saveSync({ look: encodeLook({ hat: W.hat, neck: W.neck, breath: W.breath, flag: W.flag, frame: keep.frame, title: keep.title }), title: keep.title || '', clook: encodeClook(W) });
    const c = castleOf(cur); if (c.skin !== W.skin) saveSync({ castle: { ...c, skin: W.skin } });
  };

  /* ── 미리보기 무대 2개 : 드래곤(살아 있는 rig) · 드래곤캐슬 ── */
  const dragonBox = el('div.idg-lk-dbox'), live = liveDragon(dragonBox);
  const nameEl = el('b.idg-lk-name'), titleEl = el('span.idg-lk-title');
  const flame = el('img.idg-lk-breath-img.idg-lk-flame', { alt: '' }), flameBox = el('div.idg-lk-breath', { role: 'img' }, [flame]);
  const ph = (cls, label) => el(`i.idg-ph.${cls}`, { 'aria-hidden': 'true', title: `${label} (자리 · 그림 준비 중)` }, [el('small', label)]);   /* 임시 점선 네모 */
  const dragonStage = el('div.idg-lk-stage', null, [el('i.idg-lk-slab'), ph('aura', '오라'), dragonBox, ph('pet', '펫'), flameBox, el('div.idg-lk-tag', null, [nameEl, titleEl])]);
  const cs = castleStage();
  const side = el('div.idg-lk-side');
  let shownKey = '';
  function drawDragon() {
    const w = shown(), ld = leadOf(cur), t = TITLES.find((x) => x.id === keep.title);
    dragonStage.style.setProperty('--fc', FRAME_COLOR[keep.frame] || 'transparent');
    dragonStage.classList.toggle('framed', !!FRAME_COLOR[keep.frame]);
    nameEl.textContent = LEADERS[ld]?.ko || ld;
    titleEl.textContent = t ? `«${t.name}»` : ''; titleEl.hidden = !t;
    const key = `${ld}|${w.hat || ''}|${w.neck || ''}`;
    if (key !== shownKey) { shownKey = key; live.show(ld, encodeLook({ hat: w.hat, neck: w.neck })); }
    const br = w.breath || 'basic';
    flame.src = artOf('breath', br);
    flameBox.setAttribute('aria-label', `브레스 색 : ${LOOKS.breath.find((x) => x.id === br)?.name || '기본 불꽃'}`);
    dragonStage.classList.toggle('has-aura', !!w.aura); dragonStage.classList.toggle('has-pet', !!w.pet);
  }
  const gearSlots = () => { const c = castleOf(cur), n = CASTLE_LV[c.lv - 1].slots; return Array.from({ length: n }, (_, i) => (GEAR.some((g) => g.id === c.slots[i]) && gearLv(cur, c.slots[i]) ? c.slots[i] : null)); };
  const drawStage = () => (big === 'dragon' ? drawDragon() : cs.update(shown(), gearSlots()));

  /* ── 코디 줄 · 주사위 확인 줄 ── */
  const outfitsOf = () => [0, 1, 2].map((i) => (Array.isArray(cur.outfits) && typeof cur.outfits[i] === 'string' ? cur.outfits[i] : ''));
  const trialBar = el('div.idg-trial', { hidden: true }, [
    el('span', '주사위 코디를 입혀 봤어요'),
    button('이걸로 입기', () => { Object.assign(W, trial); trial = null; persist(); afterWear(); }),
    button('돌아가기', () => { trial = null; afterWear(); }),
  ]);
  const bar = outfitBar({
    outfits: outfitsOf,
    onSave: (i) => { const o = outfitsOf(); o[i] = encodeOutfit(shown()); saveSync({ outfits: o }); },
    onLoad: (i) => { const w = decodeOutfit(outfitsOf()[i], cur, castleOf(cur).lv); if (!w) return; trial = null; Object.assign(W, w); W.skin = Math.max(1, w.skin); persist(); afterWear(); },
    onDice: () => {
      const w = { ...W }, c = castleOf(cur);
      for (const s of WORN) { const own = catalogFor(s).filter((x) => owns(cur, s, x.id)); w[s] = own.length && Math.random() < own.length / (own.length + 1) ? pick1(own).id : null; }
      w.skin = 1 + Math.floor(Math.random() * c.lv);
      trial = w; afterWear(); bar.say('가진 것 중에서 무작위로 입혀 봤어요');
    },
  });
  function afterWear() { trialBar.hidden = !trial; drawStage(); grid?.mark?.(); }

  /* ── 작은 단추별 내용 ── */
  let grid = null;
  const goShop = () => import('./idgShop.js').then((m) => m.showShop({ idg: cur, save: saveSync, onClose: () => { buildPanel(); drawStage(); } })).catch(() => {});
  const wear = (slot, id) => { if (trial) trial = null; W[slot] = id; persist(); afterWear(); };
  const itemsOf = (slot) => catalogFor(slot).map((x) => ({ ...x, owned: owns(cur, slot, x.id) }));
  function gridFor(slot) {
    if (slot === 'skin') {
      const c = castleOf(cur);
      return itemGrid(CASTLE_LV.map((d) => ({ id: String(d.lv), name: d.name, sub: `${d.lv}단계`, fx: `체력 +${d.hp}% · 장비 칸 ${d.slots}`, art: ICON.castle, owned: d.lv <= c.lv })), {
        isOn: (id) => id != null && Number(id) === shown().skin, onPick: (id) => { if (id != null) { if (trial) trial = null; W.skin = Number(id); persist(); afterWear(); } }, goShop });
    }
    if (slot === 'gear') {
      const c = castleOf(cur), n = CASTLE_LV[c.lv - 1].slots;
      return itemGrid(GEAR.map((d) => ({ id: d.id, name: d.name, sub: gearLv(cur, d.id) ? `Lv ${gearLv(cur, d.id)}` : '아직 없어요', fx: d.line(Math.max(1, gearLv(cur, d.id))), art: ICON.gear[d.id], owned: gearLv(cur, d.id) > 0, lock: '아이템 샵에서 팔아요' })), {
        toggle: true, isOn: (id) => gearSlots().includes(id),
        onPick: (id) => {
          const cc = castleOf(cur), arr = gearSlots().slice();
          const at = arr.indexOf(id);
          if (at >= 0) arr[at] = null; else { const free = arr.indexOf(null); if (free < 0) { bar.say(n ? `장비 칸 ${n}개가 가득 찼어요` : '장비 칸이 없어요 · 드래곤캐슬을 올리면 생겨요'); return; } arr[free] = id; }
          saveSync({ castle: { ...cc, slots: arr } }); drawStage(); grid.mark();
        }, goShop });
    }
    return itemGrid(itemsOf(slot), { none: '없음', isOn: (id) => (shown()[slot] || null) === id, onPick: (id) => wear(slot, id), goShop });
  }
  const content = el('div.idg-lk-content');
  const smallTabs = el('div.idg-lk-small');
  function buildPanel() {
    const slot = small[big];
    panelH = null; grid = null;
    if (big === 'dragon' && slot === 'dragon') {
      const ctx = { get g() { return cur; }, set g(v) { cur = v; }, save: saveSync, refresh: () => {}, toast: (m) => bar.say(m) };
      panelH = dragonPanel(content, ctx, { look: true, want: () => wantOf(cur), autoId: () => autoLeader(cur), goShop,
        pick: (id) => { if (wantOf(cur) === id) return; saveSync({ leader: id }); kitKeepScroll(content, () => panelH.redraw()); drawStage();
          const ld = leadOf(cur); import('../games/iandragon_game/audio/index.js').then((A) => { A.init(); A.voice(`name/${ld}`); }).catch(() => {}); } });
      return;
    }
    content.replaceChildren(grid = gridFor(slot));
  }
  function buildSmall() {
    const tabs = big === 'dragon' ? DRAGON_TABS : CASTLE_TABS;
    smallTabs.replaceChildren(kitTabs({ tabs: tabs.map(([id, label]) => ({ id, label })), value: small[big], label: '작은 칸', onPick: (id) => { small[big] = id; buildPanel(); } }));
  }
  function switchBig(id) {
    big = id; side.replaceChildren(id === 'dragon' ? dragonStage : cs.node);
    buildSmall(); buildPanel(); drawStage();
  }
  const bigTabs = kitTabs({ old: true, label: '꾸미기 칸', tabs: [{ id: 'dragon', label: '드래곤 꾸미기' }, { id: 'castle', label: '드래곤캐슬 꾸미기' }], value: big, onPick: switchBig });

  const list = el('div.idg-lk-list', null, [bar, trialBar, bigTabs, smallTabs, content]);
  switchBig('dragon');

  const wrap = el('div.idg-lk', null, [side, list]);
  const box = el('div.dialog.idg-look.idg-look2.idg-lab.idg-k', { onclick: (e) => e.stopPropagation() }, [el('div.idg-how-title', '꾸미기'), wrap, button('닫기', () => close())]);
  const overlay = el('div.dialog-overlay', { onclick: () => close() }, [box]);
  let done = false;
  const ended = () => { if (done) return; done = true; live.kill(); onClose?.(); };   // 닫으면(뒤로가기 포함) 로비 다시 그리기 — 무대 드래곤 · 코인 · 젬
  const closeO = presentOverlay(overlay, ended);
  const close = () => { closeO(); ended(); };
}
