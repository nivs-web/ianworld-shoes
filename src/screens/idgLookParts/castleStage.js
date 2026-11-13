/**
 * 꾸미기 창 «드래곤캐슬 꾸미기» 미리보기 무대 (겜보조 2 · 11/13)
 *  = 캐슬(고른 모습 · 단계마다 다른 그림) + 지붕 · 정문 · 앞마당 + 낀 장비 + 오른쪽 땅 깃발. 전투 · 로비와 같은 castleView(castleKit) 하나로 그린다.
 *  드래곤 무대(idgLook.js)와 같은 카드 판 테 · 석판 · 이름표.
 */
import { el } from '../ui.js';
import { CASTLE_LV } from '../shopPanels/_data.js';
import { liveCastle } from '../../games/iandragon_game/render/castleView.js';
import { CW, CH } from './dragonLive.js';

export function castleStage() {
  const box = el('div.idg-lk-dbox'), live = liveCastle(box, { W: CW, H: CH, cls: 'idg-lk-dragon live' });
  const nameEl = el('b.idg-lk-name');
  const node = el('div.idg-lk-stage.idg-lc-stage', null, [el('i.idg-lk-slab'), box, el('div.idg-lk-tag', null, [nameEl])]);
  let key = '';
  /** w = 입은 모습(flag · roof · gate · yard · skin) · slots = 장비 칸 배열(id|null) · lvOf(id) = 그 장비 단계 */
  function update(w, slots, lvOf) {
    const def = CASTLE_LV[Math.max(1, Math.min(CASTLE_LV.length, w.skin || 1)) - 1];
    nameEl.textContent = `${def.lv}단계 · ${def.name}`;
    const gear = slots.filter(Boolean).map((id) => ({ id, lv: lvOf(id) }));
    const k = [def.lv, w.flag, w.roof, w.gate, w.yard, gear.map((x) => `${x.id}${x.lv}`).join()].join('|');
    if (k === key) return;
    key = k;
    live.show({ skin: def.lv, roof: w.roof || null, gate: w.gate || null, yard: w.yard || null, flag: w.flag || null, gear }).catch(() => {});
  }
  return { node, update, kill: live.kill };
}
