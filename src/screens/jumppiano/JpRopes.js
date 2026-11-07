/**
 * 점프 피아노 — 줄넘기 고르기 (27개 진열장).
 * 줄넘기 챔피언 `JrRopes.js` 를 복사해 이름만 바꿨다 — 가진 줄넘기 · 별사탕은 피아노 것(`jp`)이다.
 * 위에는 고른 줄넘기로 줄넘기하는 내 캐릭터가 움직이고, 아래는 줄넘기 전부.
 * 가진 것은 누르면 바로 들고, 상점 줄넘기는 별사탕으로 사고, 잠긴 것은 얻는 법을 알려 준다.
 * 모양만 다르다 — 판정 · 점수는 같아서 명예의 전당이 공평하다.
 */

import { el, button, backButton, screen, title, confirmDialog, toast } from '../ui.js';
import * as Sfx from '../../audio/sfx.js';
import * as J from '../../services/jumppiano.js';
import { ROPES, ROPE_BY_ID } from '../../games/jumprope/data.js';
import { ropeIcon, animFigure } from '../../games/jumprope/art.js';
import { ensureJpStyle, candyTag, jpRopeHow as ropeHow } from './jpui.js';

export default function JpRopes(nav) {
  ensureJpStyle();
  let view = J.rope().id;
  let anim = null;
  const stop = () => { anim?.stop(); anim = null; };

  return {
    onLeave() { stop(); },
    render() {
      stop();
      const j = J.jp();
      const r = ROPE_BY_ID[view] || ROPES[0];
      const owned = J.hasRope(r.id, j);
      const using = owned && J.rope(j).id === r.id;
      anim = animFigure(J.look(j), r, 3, 44, 68);

      async function buy() {
        const price = r.get.price;
        if (j.candy < price) { Sfx.play('sfx_denied'); toast(`별사탕이 ${price - j.candy}개 모자라요`, 2200); return; }
        if (!(await confirmDialog({ message: `${r.name}을(를) 살까요?`, detail: `별사탕 ${price}개`, yes: '살래요', no: '아니요' }))) return;
        const res = J.buyRope(r.id);
        if (!res.ok) { toast(res.short ? `별사탕이 ${res.short}개 모자라요` : '살 수 없어요', 2200); return; }
        Sfx.play('sfx_purchase');
        toast(`${r.name}을(를) 샀어요!`, 2000);
        nav.refresh();
      }

      let action;
      if (using) action = el('div.dg-using', '지금 들고 있어요');
      else if (owned) action = button('이 줄넘기로 할래요', () => { J.setRope(r.id); Sfx.play('sfx_menu_select'); nav.refresh(); }, { primary: true });
      else if (r.get.price) action = button(`별사탕 ${r.get.price}개로 사기`, buy, { primary: j.candy >= r.get.price });
      else action = el('div.hint', `🔒 ${ropeHow(r)}`);

      return screen(
        title('줄넘기 고르기'),
        candyTag(j.candy),
        el('div.jr-preview', null, [anim.cv]),
        el('div.char-name', { style: 'text-align:center' }, r.name),
        el('div.hint', ropeHow(r) + (r.trail ? ' · 꼬리 효과가 있어요' : '')),
        action,
        el('div.hint', `모은 줄넘기 ${J.ownedRopes(j).length} / ${ROPES.length}`),
        el('div.jr-grid', null, ROPES.map((x) => {
          const have = J.hasRope(x.id, j);
          const use = have && J.rope(j).id === x.id;
          return el('button.jr-card', {
            type: 'button',
            class: [x.id === view ? 'on' : '', have ? '' : 'locked'].filter(Boolean).join(' '),
            onclick: () => { view = x.id; Sfx.play('sfx_menu_move'); if (have) J.setRope(x.id); nav.refresh(); },
          }, [
            use ? el('span.jr-card-tag.use', '사용 중') : !have && x.get.price ? el('span.jr-card-tag', x.get.price) : null,
            ropeIcon(x, 2),
            el('div.jr-card-name', x.name),
            have ? null : el('div.jr-card-how', ropeHow(x)),
          ]);
        })),
        el('div.spacer'),
        backButton('게임 로비로', () => nav.back()),
      );
    },
  };
}
