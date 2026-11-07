/**
 * 줄넘기 챔피언 — 상점. 판에서 받은 **별사탕**으로 산다(현금으로 사는 것은 없다).
 *   아이템: 보호막 · 하트 하나 더 · 별사탕 두 배 (한 판에 하나씩, 최대 9개)
 *   줄넘기: 상점 전용 6개
 *   옷 · 모자: 상점 전용 꾸미기 부품
 */

import { el, button, backButton, screen, title, segmented, confirmDialog, toast } from '../ui.js';
import * as Sfx from '../../audio/sfx.js';
import * as J from '../../services/jumprope.js';
import { ITEMS, ITEM_MAX, ROPES, LOOK_PARTS } from '../../games/jumprope/data.js';
import { itemIcon, ropeIcon, figureCanvas } from '../../games/jumprope/art.js';
import { ensureJrStyle, candyTag } from './jrui.js';

const TABS = [
  { value: 'item', label: '아이템' },
  { value: 'rope', label: '줄넘기' },
  { value: 'wear', label: '옷·모자' },
  { value: 'mask', label: '가면' },
];

export default function JrShop(nav, params = {}) {
  ensureJrStyle();
  let tab = TABS.some((t) => t.value === params.tab) ? params.tab : 'item';

  async function confirmBuy(name, price) {
    const j = J.jr();
    if (j.candy < price) { Sfx.play('sfx_denied'); toast(`별사탕이 ${price - j.candy}개 모자라요`, 2000); return false; }
    return confirmDialog({ message: `${name}을(를) 살까요?`, detail: `별사탕 ${price}개`, yes: '살래요', no: '아니요' });
  }
  const done = (name) => { Sfx.play('sfx_purchase'); toast(`${name}을(를) 샀어요!`, 1600); nav.refresh(); };

  return {
    render() {
      const j = J.jr();
      let list;
      if (tab === 'item') {
        list = ITEMS.map((it) => {
          const have = j.items[it.id] | 0;
          return el('div.jr-item', null, [
            itemIcon(it.id, 2),
            el('div.jr-item-body', null, [el('div.jr-item-name', `${it.name} · ${have}개`), el('div.jr-item-desc', it.desc)]),
            have >= ITEM_MAX ? el('div.hint', '가득') : button(`${it.price}`, async () => {
              /* 아이템은 싸고 자주 사니 묻지 않는다 */
              const r = J.buyItem(it.id);
              if (!r.ok) { Sfx.play('sfx_denied'); toast(r.full ? `${ITEM_MAX}개까지만 가질 수 있어요` : `별사탕이 ${r.short}개 모자라요`, 1800); return; }
              done(it.name);
            }, { primary: j.candy >= it.price }),
          ]);
        });
      } else if (tab === 'rope') {
        list = ROPES.filter((r) => r.get.price).map((r) => {
          const have = J.hasRope(r.id, j);
          return el('div.jr-item', null, [
            ropeIcon(r, 2),
            el('div.jr-item-body', null, [el('div.jr-item-name', r.name), el('div.jr-item-desc', r.trail ? '꼬리 효과가 있어요' : '모양이 다른 줄넘기')]),
            have ? el('div.hint', '가지고 있어요') : button(`${r.get.price}`, async () => {
              if (!(await confirmBuy(r.name, r.get.price))) return;
              const res = J.buyRope(r.id);
              if (!res.ok) { toast('살 수 없어요', 1600); return; }
              done(r.name);
            }, { primary: j.candy >= r.get.price }),
          ]);
        });
      } else if (tab === 'mask') {
        /* 콤보 선물 가면 — 상점에서 팔지 않는다. 보통 · 어려움에서 콤보 기록을 세우면 선물 (2026-11-07) */
        const look = J.look(j);
        const part = LOOK_PARTS.find((p) => p.key === 'mask');
        const rec = J.comboOf(j);
        list = [el('div.jr-box.jr-mask-head', null, [
          el('h4', '🎭 콤보 선물 가면'),
          el('div', '돈으로 못 사요! 콤보 기록으로만 받아요.'),
          el('div', `보통 · 어려움에서 세운 내 최고 콤보: ${rec}`),
        ])];
        (part?.list || []).forEach((it, i) => {
          if (i === 0) return;
          const need = J.maskNeed(i);
          const have = J.hasPart('mask', i, j);
          const on = look.mask === i;
          const pct = Math.min(100, Math.round((rec / need) * 100));
          list.push(el('div.jr-mask', { class: [have ? 'have' : 'lock', i >= 6 ? 'rare' : ''].filter(Boolean).join(' ') }, [
            el('div.jr-mask-pic', null, [figureCanvas({ ...look, mask: i }, null, 3, { w: i >= 6 ? 40 : 30, h: i >= 6 ? 40 : 30, focus: 'head', t: 0.6 })]),   // 무지개 · 보스는 왕관 · 뿔 · 오라까지 보이게
            el('div.jr-mask-body', null, [
              el('div.jr-mask-name', `${it.name}`),
              el('div.jr-mask-need', `콤보 ${need} 선물`),
              el('div.jr-mask-desc', it.desc || ''),
              have ? null : el('div.jr-lvbar', null, [el('div.jr-lvbar-fill', { style: `width:${pct}%` })]),
              have ? null : el('div.jr-mask-left', `${rec} / ${need} — ${need - rec} 콤보 더!`),
            ]),
            have
              ? button(on ? '쓰는 중' : '쓰기', () => { J.setLook({ ...J.look(), mask: on ? 0 : i }); Sfx.play('sfx_menu_select'); nav.refresh(); }, { primary: !on })
              : el('div.jr-mask-lock', '🔒'),
          ]));
        });
      } else {
        const look = J.look(j);
        list = [];
        for (const p of LOOK_PARTS) p.list.forEach((it, i) => {
          if (!it.get?.price) return;
          const have = J.hasPart(p.key, i, j);
          list.push(el('div.jr-item', null, [
            figureCanvas({ ...look, [p.key]: i }, null, 2, { w: 26, h: 26, focus: ['shirt', 'pants', 'shoes'].includes(p.key) ? 'body' : 'head' }),
            el('div.jr-item-body', null, [el('div.jr-item-name', it.name), el('div.jr-item-desc', p.name)]),
            have ? el('div.hint', '가지고 있어요') : button(`${it.get.price}`, async () => {
              if (!(await confirmBuy(it.name, it.get.price))) return;
              const res = J.buyPart(p.key, i);
              if (!res.ok) { toast('살 수 없어요', 1600); return; }
              J.setLook({ ...J.look(), [p.key]: i });
              done(it.name);
            }, { primary: j.candy >= it.get.price }),
          ]));
        });
      }
      return screen(
        title('상점'),
        candyTag(j.candy, '내 별사탕'),
        el('div.hint', '별사탕은 스테이지와 무한 줄넘기에서 받아요. 현금으로 사는 것은 없어요.'),
        segmented(TABS, tab, (v) => { tab = v; nav.refresh(); }),
        el('div.jr-list', null, list),
        el('div.spacer'),
        backButton('뒤로', () => nav.back()),
      );
    },
  };
}
