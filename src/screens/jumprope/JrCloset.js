/**
 * 줄넘기 챔피언 — 캐릭터 꾸미기.
 * 피부 · 머리 모양 · 머리 색 · 눈 · 윗옷 · 아래옷 · 신발 · 모자 · 표정 이모티콘(명예의 전당에 뜬다).
 * 고르면 바로 입는다(저장). 잠긴 것은 레벨 보상이거나 상점(별사탕) 물건이다.
 */

import { el, backButton, screen, title, confirmDialog, toast } from '../ui.js';
import * as Sfx from '../../audio/sfx.js';
import * as J from '../../services/jumprope.js';
import { LOOK_PARTS, EMOJIS } from '../../games/jumprope/data.js';
import { figureCanvas, animFigure } from '../../games/jumprope/art.js';
import { ensureJrStyle, candyTag } from './jrui.js';

const COLOR_KEYS = new Set(['skin', 'hairColor']);
const BODY_KEYS = new Set(['shirt', 'pants', 'shoes']);

export default function JrCloset(nav) {
  ensureJrStyle();
  let tab = 'hair';
  let anim = null;
  const stop = () => { anim?.stop(); anim = null; };

  return {
    onLeave() { stop(); },
    render() {
      stop();
      const j = J.jr();
      const look = J.look(j);
      const part = LOOK_PARTS.find((p) => p.key === tab) || LOOK_PARTS[0];
      anim = animFigure(look, J.rope(j), 3, 44, 68);

      async function pick(i) {
        const it = part.list[i];
        if (J.hasPart(part.key, i, j)) {
          J.setLook({ ...look, [part.key]: i });
          Sfx.play('sfx_menu_select');
          nav.refresh();
          return;
        }
        const g = it.get || {};
        if (g.combo) { Sfx.play('sfx_denied'); toast(`콤보 ${g.combo} 기록을 세우면 선물로 받아요 (보통 · 어려움)`, 2200); return; }
        if (g.lv) { Sfx.play('sfx_denied'); toast(`레벨 ${g.lv}이 되면 얻어요`, 1800); return; }
        if (g.price) {
          if (j.candy < g.price) { Sfx.play('sfx_denied'); toast(`별사탕이 ${g.price - j.candy}개 모자라요`, 2000); return; }
          if (!(await confirmDialog({ message: `${it.name}을(를) 살까요?`, detail: `별사탕 ${g.price}개`, yes: '살래요', no: '아니요' }))) return;
          const r = J.buyPart(part.key, i);
          if (!r.ok) { toast('살 수 없어요', 1800); return; }
          Sfx.play('sfx_purchase');
          J.setLook({ ...J.look(), [part.key]: i });
          toast(`${it.name}을(를) 샀어요!`, 1800);
          nav.refresh();
        }
      }

      const chip = (it, i) => {
        const have = J.hasPart(part.key, i, j);
        const on = look[part.key] === i;
        let pic;
        if (part.key === 'emoji') pic = el('span', { style: 'font-size:24px;line-height:1' }, EMOJIS[i]);
        else if (COLOR_KEYS.has(part.key)) pic = el('div.jr-sw', { style: { background: it.c } });
        else pic = figureCanvas({ ...look, [part.key]: i }, null, 2, { w: 26, h: 26, focus: BODY_KEYS.has(part.key) ? 'body' : 'head' });
        const g = it.get || {};
        return el('button.jr-chip', {
          type: 'button',
          class: [on ? 'on' : '', have ? '' : 'locked'].filter(Boolean).join(' '),
          onclick: () => pick(i),
        }, [
          pic,
          part.key === 'emoji' ? null : el('span', it.name),
          have ? null : el('small', g.combo ? `🔒 콤보 ${g.combo}` : g.lv ? `🔒 Lv.${g.lv}` : `🛒 ${g.price}`),
        ]);
      };

      return screen(
        title('캐릭터 꾸미기'),
        candyTag(j.candy),
        el('div.jr-preview', null, [anim.cv]),
        el('div.jr-chip-row', null, LOOK_PARTS.map((p) => el('button.jr-chip', {
          type: 'button', class: p.key === tab ? 'on' : '',
          onclick: () => { tab = p.key; Sfx.play('sfx_menu_move'); nav.refresh(); },
        }, [el('span', p.name)]))),
        el('div.diff-title', part.name),
        el('div.jr-chip-row', null, part.list.map(chip)),
        el('div.spacer'),
        backButton('게임 로비로', () => nav.back()),
      );
    },
  };
}
