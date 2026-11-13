/**
 * 꾸미기 창 «드래곤캐슬 꾸미기» 미리보기 무대 (겜보조 2 · 11/13)
 *  = 캐슬(고른 모습) + 오른쪽 땅 깃발 + 장비 칸. 지붕 · 정문 · 앞마당은 아직 그림이 없어 점선 네모로 자리만 둔다(임시).
 *  드래곤 무대(idgLook.js)와 같은 카드 판 테 · 석판 · 이름표 — 깃발은 같은 깃대 모양.
 */
import { el } from '../ui.js';
import { artOf } from '../../games/iandragon_game/data/looks.js';
import { ICON, CASTLE_LV, GEAR } from '../shopPanels/_data.js';

/** 장비 칸 아이콘 : 임시(로비 아이콘) — shopPanels 와 같은 ICON 표 */
const gearIcon = (id) => ICON.gear[id];

export function castleStage() {
  const castle = el('img.idg-lc-castle', { alt: '', draggable: 'false' });
  const ph = (cls, label) => el(`i.idg-ph.${cls}`, { 'aria-hidden': 'true', title: `${label} (자리 · 그림 준비 중)` }, [el('small', label)]);   /* 임시 점선 네모 */
  const flagImg = el('img.idg-lk-banner', { alt: '' });
  const flagBox = el('div.idg-lk-flag', { role: 'img' }, [el('i.idg-lk-pole'), el('i.idg-lk-knob'), flagImg, el('i.idg-lk-pole-foot')]);
  const gears = el('div.idg-lc-gears', { role: 'group', 'aria-label': '장비 칸' });
  const nameEl = el('b.idg-lk-name');
  const node = el('div.idg-lk-stage.idg-lc-stage', null, [
    el('i.idg-lk-slab'), castle, ph('roof', '지붕'), ph('gate', '정문'), ph('yard', '앞마당'), flagBox, gears,
    el('div.idg-lk-tag', null, [nameEl]),
  ]);
  /** w = 입은 모습(flag · skin) · slots = 장비 칸 배열(id|null) */
  function update(w, slots) {
    const def = CASTLE_LV[Math.max(1, Math.min(CASTLE_LV.length, w.skin || 1)) - 1];
    castle.src = ICON.castle;   /* 임시 : 새 캐슬 10단계 그림이 오면 단계별 그림으로 */
    nameEl.textContent = `${def.lv}단계 · ${def.name}`;
    node.classList.toggle('has-flag', !!w.flag);
    if (w.flag) { flagImg.src = artOf('flag', w.flag); flagBox.setAttribute('aria-label', `드래곤캐슬 깃발 : ${w.flag}`); }
    gears.replaceChildren(...slots.map((id) => {
      const g = GEAR.find((x) => x.id === id);
      return el(`i.idg-lc-gear${g ? '.on' : ''}`, { title: g ? g.name : '빈 장비 칸', 'aria-label': g ? g.name : '빈 장비 칸' }, g ? [el('img', { src: gearIcon(id), alt: '' })] : []);
    }));
    gears.hidden = !slots.length;
  }
  return { node, update };
}
